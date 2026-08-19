// ── 보드 동시 편집 · 한 Run 의 보드를 여러 사람이 같이 본다 ────────────
//
// 지금까지 보드 편집(위치·메모·숨김)은 각자 브라우저 localStorage 에만 있었다.
// 링크를 보내도 상대는 빈 보드를 봤다. 여기가 그 간극을 메운다:
//   GET  /api/board/:runId/state    현재 편집 상태 (없으면 빈 것)
//   POST /api/board/:runId/state    {edits, actor} · 저장하고 다른 참여자에게 방송
//   GET  /api/board/:runId/events   SSE · 편집과 입장/퇴장이 흘러온다
//
// 동시성 모델은 일부러 단순하다: 마지막 저장이 이긴다(LWW), actor 태그로 자기 메아리를
// 거른다. 디자인 리뷰 보드는 초 단위 충돌이 드물고, CRDT 는 이 규모에 과하다.
// 편집 상태는 파일로도 떨어져 서버를 재시작해도 보드가 남는다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const rooms = new Map()   // runId → { clients: Set<res>, state: object|null, actors: Map<actorId, name> }

const dir = (root) => {
  const d = join(root, '.cache', 'boards')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

const okId = (id) => /^[A-Za-z0-9_-]{1,80}$/.test(String(id ?? ''))
const fileOf = (root, runId) => join(dir(root), `${runId}.json`)

function room(runId) {
  let r = rooms.get(runId)
  if (!r) { r = { clients: new Set(), state: null, actors: new Map() }; rooms.set(runId, r) }
  return r
}

function broadcast(r, event, data, exceptRes = null) {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of r.clients) {
    if (res === exceptRes) continue
    try { res.write(line) } catch { r.clients.delete(res) }
  }
}

function loadState(root, runId, r) {
  if (r.state) return r.state
  const f = fileOf(root, runId)
  if (existsSync(f)) { try { r.state = JSON.parse(readFileSync(f, 'utf8')) } catch { /* 깨진 파일은 빈 보드로 */ } }
  return r.state
}

/** connect 스타일 · openai-api.mjs handleApi 에서 /api/board/ 프리픽스로 위임된다 */
export async function handleBoardSync(req, res, root, url) {
  const m = url.pathname.match(/^\/api\/board\/([^/]+)\/(state|events)$/)
  if (!m) return false
  const [, runId, what] = m
  if (!okId(runId)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'bad run id' })); return true }
  const r = room(runId)

  if (what === 'state' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ edits: loadState(root, runId, r), viewers: r.clients.size }))
    return true
  }

  if (what === 'state' && req.method === 'POST') {
    const body = await new Promise((resolve) => {
      let s = ''; req.on('data', d => { s += d; if (s.length > 2_000_000) req.destroy() })
      req.on('end', () => resolve(s)); req.on('error', () => resolve(''))
    })
    try {
      const { edits, actor } = JSON.parse(body || '{}')
      if (!edits || typeof edits !== 'object') throw new Error('no edits')
      r.state = edits
      writeFileSync(fileOf(root, runId), JSON.stringify(edits))
      broadcast(r, 'edits', { edits, actor: String(actor ?? '') })
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, viewers: r.clients.size }))
    } catch (e) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: String(e.message ?? e) }))
    }
    return true
  }

  if (what === 'events' && req.method === 'GET') {
    const actor = String(url.searchParams.get('actor') ?? '익명')
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write(`event: hello\ndata: ${JSON.stringify({ viewers: r.clients.size + 1 })}\n\n`)
    r.clients.add(res)
    broadcast(r, 'presence', { viewers: r.clients.size, joined: actor }, res)
    // 프록시가 조용한 연결을 끊지 않게 25초마다 심장박동
    const beat = setInterval(() => { try { res.write(': beat\n\n') } catch { /* 아래 close 가 정리 */ } }, 25_000)
    req.on('close', () => {
      clearInterval(beat)
      r.clients.delete(res)
      broadcast(r, 'presence', { viewers: r.clients.size, left: actor })
    })
    return true
  }

  return false
}
