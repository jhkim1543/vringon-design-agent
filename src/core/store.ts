// ── Run 저장소 · 실행 이력과 즐겨찾기를 라이브러리처럼 다룬다 ──────────
// 진행 중인 Run도 계속 저장한다. 새로고침이나 렌더 오류로 화면이 날아가도
// 결과를 잃지 않게 하기 위한 것이다.
import { isSketchView } from './types'
import type { RunState } from './types'

export interface RunRecord {
  id: string
  savedAt: number
  favorite: boolean
  title: string
  /** 목록 썸네일 · 첫 디자인 이미지 */
  thumb?: string
  state: RunState
}

const KEY = 'vringon.runs'
const CURRENT = 'vringon.currentRun'
const MAX = 40

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k)
    return raw ? JSON.parse(raw) as T : fallback
  } catch { return fallback }
}

function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)) }
  catch { /* 용량 초과 시 조용히 넘긴다. 저장 실패가 실행을 막으면 안 된다 */ }
}

/** 이 앱이 주얼리도 다루던 시절의 Run이 브라우저에 남아 있다.
 *  주얼리는 별도 제품으로 갈라져 나갔고 이 빌드에는 그 팩도, 그 품목 분류도 없다.
 *  열면 화면이 죽으므로 목록에서 걸러내고, 저장소에서도 한 번만 지운다. */
function isFootwear(r: RunRecord): boolean {
  const p = r.state?.params as { category?: string } | undefined
  return !p?.category || p.category === 'shoe'
}

export function listRuns(): RunRecord[] {
  const all = read<RunRecord[]>(KEY, [])
  const keep = all.filter(isFootwear)
  if (keep.length !== all.length) write(KEY, keep)
  return keep.sort((a, b) => b.savedAt - a.savedAt)
}

export function getRun(id: string): RunRecord | undefined {
  return listRuns().find(r => r.id === id)
}

export function saveRun(rec: RunRecord) {
  const all = read<RunRecord[]>(KEY, []).filter(r => r.id !== rec.id)
  all.unshift(rec)
  // 즐겨찾기는 지우지 않고, 나머지만 오래된 순으로 정리한다
  const favs = all.filter(r => r.favorite)
  const rest = all.filter(r => !r.favorite).slice(0, MAX - favs.length)
  write(KEY, [...favs, ...rest])
}

export function deleteRun(id: string) {
  write(KEY, read<RunRecord[]>(KEY, []).filter(r => r.id !== id))
}

export function toggleFavorite(id: string): boolean {
  const all = read<RunRecord[]>(KEY, [])
  const r = all.find(x => x.id === id)
  if (!r) return false
  r.favorite = !r.favorite
  write(KEY, all)
  return r.favorite
}

// ── 진행 중 Run · 새로고침 복구용 ───────────────────────────────────
export function saveCurrent(id: string, st: RunState) {
  write(CURRENT, { id, savedAt: Date.now(), state: st })
}
export function loadCurrent(): { id: string; savedAt: number; state: RunState } | null {
  const cur = read<{ id: string; savedAt: number; state: RunState } | null>(CURRENT, null)
  // 진행 중이던 Run도 옛 주얼리 것이면 되살리지 않는다
  const cat = (cur?.state?.params as { category?: string } | undefined)?.category
  if (cur && cat && cat !== 'shoe') { clearCurrent(); return null }
  return cur
}
export function clearCurrent() {
  try { localStorage.removeItem(CURRENT) } catch { /* 무시 */ }
}

export function newRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** 목록에 보여줄 한 줄 제목 · 화면에서 길게 늘어지지 않게 짧게 만든다 */
export function makeTitle(_st: RunState, labels: { mode: string; category: string; type: string }): string {
  return `${labels.type} · ${labels.mode}`
}

export function firstImage(st: RunState): string | undefined {
  for (const d of st.designs) {
    const im = d.images.find(i => !isSketchView(i.view)) ?? d.images[0]
    if (im) return im.url
  }
  return undefined
}
