// ── 보드 동시 편집 클라이언트 · SSE 로 받고, 디바운스로 보낸다 ─────────
//
// 모델은 단순하다: 전체 편집 상태를 마지막 저장이 이기는(LWW) 방식으로 주고받고,
// actor 이름으로 자기 메아리를 거른다. 받은 직후의 저장 한 번은 되돌려 보내지 않는다 —
// 안 그러면 두 브라우저가 서로의 상태를 영원히 핑퐁한다.
import { apiUrl } from './apiBase'
import type { BoardEdits } from './boardEdits'

export interface SyncHandle {
  /** 로컬 편집이 바뀔 때마다 부른다 · 원격에서 온 변경이면 부르지 않아야 한다 */
  push: (edits: BoardEdits) => void
  close: () => void
}

export function connectBoardSync(runId: string, actor: string, on: {
  edits: (edits: BoardEdits, actor: string) => void
  viewers: (n: number, note?: string) => void
  dead?: () => void
}): SyncHandle {
  let closed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: BoardEdits | null = null

  const es = new EventSource(apiUrl(`/api/board/${runId}/events`) + `?actor=${encodeURIComponent(actor)}`)
  es.addEventListener('hello', (e) => {
    try { on.viewers(JSON.parse((e as MessageEvent).data).viewers ?? 1) } catch { /* 무시 */ }
  })
  es.addEventListener('presence', (e) => {
    try {
      const d = JSON.parse((e as MessageEvent).data)
      on.viewers(d.viewers ?? 1, d.joined ? `${d.joined} 님이 들어왔습니다` : d.left ? `${d.left} 님이 나갔습니다` : undefined)
    } catch { /* 무시 */ }
  })
  es.addEventListener('edits', (e) => {
    try {
      const d = JSON.parse((e as MessageEvent).data)
      if (d.actor === actor) return       // 내 편집의 메아리
      on.edits(d.edits, d.actor)
    } catch { /* 무시 */ }
  })
  es.onerror = () => { if (!closed) on.dead?.() }

  // 서버에 이미 상태가 있으면 그걸 받는다 (내 localStorage 보다 방이 우선).
  // 그 전에는 보내지 않는다 — 마운트 직후의 빈 편집이 방의 상태를 덮어쓰면
  // 나중에 들어온 사람이 앞사람의 메모를 지워 버린 꼴이 된다.
  let ready = false
  fetch(apiUrl(`/api/board/${runId}/state`))
    .then(r => r.json())
    .then(j => { if (j.edits) on.edits(j.edits, '') })
    .catch(() => { /* 서버 없음 · 로컬 전용으로 동작 */ })
    .finally(() => { ready = true; if (pending) send() })

  const send = () => {
    if (!pending || !ready) return
    const body = JSON.stringify({ edits: pending, actor })
    pending = null
    fetch(apiUrl(`/api/board/${runId}/state`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    }).catch(() => { /* 다음 편집 때 다시 시도된다 */ })
  }

  return {
    push(edits) {
      pending = edits
      if (timer) clearTimeout(timer)
      timer = setTimeout(send, 700)      // 드래그 중 매 프레임 보내지 않게
    },
    close() {
      closed = true
      if (timer) { clearTimeout(timer); send() }
      es.close()
    },
  }
}
