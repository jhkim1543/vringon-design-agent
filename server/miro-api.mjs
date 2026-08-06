// ── Miro 내보내기 — REST API v2 ──────────────────────────────────────
// 보드 모델(컬럼·노드·엣지)을 Miro의 프레임 / 스티키·셰이프 / 커넥터로 옮긴다.
// 토큰이 없으면 생성 페이로드를 그대로 돌려주어, 사용자가 자기 토큰으로 실행할 수 있게 한다.
const API = 'https://api.miro.com/v2'

// 컬럼(단계)별 프레임 지오메트리
const COL_W = 460
const COL_GAP = 90
const ROW_H = 190
const HEADER_H = 120

// 카드 테마는 hex를 받는다 (스티키의 색 이름과 다름)
const TONE_HEX = {
  neutral: '#7f8c8d',
  accent: '#444ae8',
  warn: '#fb8200',
  muted: '#c5c9cf',
}

/** 보드 모델 → Miro 아이템 생성 계획 (토큰 없이도 만들 수 있다) */
export function planMiroBoard(model, meta) {
  const frames = model.columns.map((c, i) => ({
    kind: 'frame',
    key: `frame-${c.key}`,
    payload: {
      data: { title: `${c.title} — ${c.note}`, format: 'custom', type: 'freeform' },
      position: { x: i * (COL_W + COL_GAP), y: 0 },
      geometry: { width: COL_W, height: HEADER_H + maxRow(model, i) * ROW_H + 120 },
      style: { fillColor: '#0f0f13' },
    },
  }))

  // Miro는 스티키보다 카드가 제목·본문 구조를 그대로 유지한다.
  // 이미지가 있는 노드는 카드 옆에 이미지 아이템을 따로 붙인다.
  // 로컬 캐시 이미지(/api/...)는 URL로 못 가져가므로 파일 업로드 대상으로 표시한다.
  const items = []
  for (const n of model.nodes) {
    const x = n.column * (COL_W + COL_GAP)
    const y = HEADER_H + n.row * ROW_H
    const bodyLines = [
      ...n.body,
      ...(n.palette?.length ? [n.palette.map(c => `${c.name} ${c.hex}`).join(' · ')] : []),
      ...(n.prompts ?? []),
    ]
    items.push({
      kind: 'card',
      key: n.id,
      payload: {
        data: {
          title: esc(plain(n.title)),
          description: bodyLines.map(b => `<p>${esc(plain(b))}</p>`).join(''),
        },
        style: { cardTheme: TONE_HEX[n.tone ?? 'neutral'] },
        position: { x, y },
        geometry: { width: COL_W - 60 },
      },
    })
    if (n.imageUrl) {
      items.push({
        kind: 'image',
        key: `${n.id}__img`,
        // 원격 URL은 그대로, 로컬 경로는 localUrl로 넘겨 서버가 파일 업로드로 바꾼다
        ...(/^https?:\/\//.test(n.imageUrl) ? {} : { localUrl: n.imageUrl }),
        payload: {
          data: { title: esc(plain(n.title)), ...(/^https?:\/\//.test(n.imageUrl) ? { url: n.imageUrl } : {}) },
          position: { x: x + COL_W - 20, y },
          geometry: { width: 220 },
        },
      })
    }
  }

  const connectors = model.edges.map((e, i) => ({
    kind: 'connector',
    key: `edge-${i}`,
    from: e.from,
    to: e.to,
    payload: {
      shape: 'elbowed',
      style: {
        strokeColor: e.dashed ? '#6E727B' : '#444ae8',
        strokeWidth: String(e.weight ? Math.max(1, Math.round(e.weight * 6)) : 1),
        strokeStyle: e.dashed ? 'dashed' : 'normal',
        endStrokeCap: 'arrow',
      },
      ...(e.label ? { captions: [{ content: esc(e.label), position: '50%' }] } : {}),
    },
  }))

  return {
    board: {
      name: meta.name,
      description: meta.description,
      policy: { permissionsPolicy: { collaborationToolsStartAccess: 'all_editors', sharingAccess: 'team_members_with_editing_rights' } },
    },
    frames, items, connectors,
    counts: { frames: frames.length, items: items.length, connectors: connectors.length },
  }
}

function maxRow(model, col) {
  return model.nodes.filter(n => n.column === col).reduce((m, n) => Math.max(m, n.row + 1), 1)
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
/** 마크다운 기호를 걷어낸다 · Miro 카드에 ##, ** 가 그대로 보이면 안 된다 */
function plain(s) {
  return String(s ?? '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-•*]\s+/gm, '')
}

async function miro(token, path, body, method = 'POST') {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`Miro ${method} ${path} → ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return r.json()
}

/** 로컬 캐시 이미지를 Miro에 파일 업로드한다 (URL은 localhost라 Miro가 못 가져간다) */
async function miroImageUpload(token, bid, buf, name, payload) {
  const form = new FormData()
  form.append('resource', new Blob([buf], { type: 'image/png' }), name)
  form.append('data', JSON.stringify({
    title: payload?.data?.title ?? name,
    position: payload?.position,
    geometry: payload?.geometry,
  }))
  const r = await fetch(`${API}/boards/${bid}/images`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
  })
  if (!r.ok) throw new Error(`Miro image upload → ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

/** 실제 생성 — 프레임 → 카드 → 커넥터 순 (커넥터는 아이템 id가 있어야 한다)
 *  resolveLocal(url) → Buffer | null 을 주면 로컬 캐시 이미지를 파일로 올린다. */
export async function createMiroBoard(token, plan, resolveLocal) {
  const board = await miro(token, '/boards', plan.board)
  const bid = board.id
  const idMap = {}

  for (const f of plan.frames) {
    const res = await miro(token, `/boards/${bid}/frames`, f.payload)
    idMap[f.key] = res.id
  }
  for (const it of plan.items) {
    try {
      if (it.kind === 'image' && it.localUrl) {
        const buf = resolveLocal?.(it.localUrl)
        if (!buf) continue
        const res = await miroImageUpload(token, bid, buf, `${it.key}.png`, it.payload)
        idMap[it.key] = res.id
        continue
      }
      const path = it.kind === 'image' ? 'images' : 'cards'
      const res = await miro(token, `/boards/${bid}/${path}`, it.payload)
      idMap[it.key] = res.id
    } catch (e) {
      // 이미지 URL이 만료·차단이면 그 카드만 건너뛴다
      if (it.kind !== 'image') throw e
    }
  }
  let connectorsMade = 0
  for (const c of plan.connectors) {
    const a = idMap[c.from], b = idMap[c.to]
    if (!a || !b) continue
    try {
      await miro(token, `/boards/${bid}/connectors`, {
        startItem: { id: a, snapTo: 'right' },
        endItem: { id: b, snapTo: 'left' },
        ...c.payload,
      })
      connectorsMade++
    } catch { /* 커넥터 한 건 실패가 전체를 막지 않는다 */ }
  }
  return { boardId: bid, viewLink: board.viewLink, created: { ...plan.counts, connectors: connectorsMade } }
}
