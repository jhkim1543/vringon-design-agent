// ── 보드 사용자 편집 · Run과 함께 저장된다 ──────────────────────────
// 파이프라인이 만든 보드는 읽기 전용 흐름도였다. 발표 준비를 하려면
// 문구를 고치고, 메모를 붙이고, 칸을 하나 더 여는 정도는 보드 안에서 되어야 한다.
// 편집은 원본 모델을 덮어쓰지 않고 "덧칠(overlay)"로 저장한다.
// 그래야 Run을 다시 계산해도 사용자가 쓴 것이 남는다.

export interface NoteNode {
  id: string
  column: number
  row: number
  title: string
  body: string[]
  tone?: 'neutral' | 'accent' | 'warn' | 'muted'
}

/** 카드에 달린 피드백 한 건 · 누가 언제 뭐라고 했는지 */
export interface BoardComment {
  id: string
  author: string
  text: string
  at: string                 // ISO
}

export interface BoardEdits {
  /** 노드 id → 덮어쓴 제목 */
  titles: Record<string, string>
  /** 노드 id → 덮어쓴 본문 줄 */
  bodies: Record<string, string[]>
  /** 사용자가 직접 추가한 메모 노드 */
  notes: NoteNode[]
  /** 사용자가 추가한 칸(열) 이름. 기본 열 뒤에 붙는다 */
  extraColumns: { key: string; title: string; note: string }[]
  /** 숨긴 노드 */
  hidden: string[]
  /** 옮긴 위치 */
  positions: Record<string, { x: number; y: number }>
  /** 드래그로 조절한 칸 크기 · 없으면 기본 추정 크기를 쓴다 */
  sizes: Record<string, { w: number; h: number }>
  /** 카드별 피드백 스레드 · 같이 보는 사람들의 코멘트가 여기 쌓인다 */
  comments: Record<string, BoardComment[]>
}

export const EMPTY_EDITS: BoardEdits = {
  titles: {}, bodies: {}, notes: [], extraColumns: [], hidden: [], positions: {}, sizes: {}, comments: {},
}

// ── 참여자 이름 · 코멘트와 동시 편집 표시에 쓴다 ──────────────────────
const ACTOR_KEY = 'vringon.actor'

export function getActor(): string {
  try {
    let a = localStorage.getItem(ACTOR_KEY)
    if (!a) {
      a = `게스트-${Math.random().toString(36).slice(2, 6)}`
      localStorage.setItem(ACTOR_KEY, a)
    }
    return a
  } catch { return '게스트' }
}

export function setActor(name: string) {
  try { localStorage.setItem(ACTOR_KEY, name.trim() || '게스트') } catch { /* 무시 */ }
}

const KEY = (runId: string) => `vringon.board.${runId}`

export function loadEdits(runId: string): BoardEdits {
  try {
    const raw = localStorage.getItem(KEY(runId))
    if (!raw) return { ...EMPTY_EDITS }
    return { ...EMPTY_EDITS, ...JSON.parse(raw) }
  } catch {
    return { ...EMPTY_EDITS }
  }
}

export function saveEdits(runId: string, e: BoardEdits) {
  try { localStorage.setItem(KEY(runId), JSON.stringify(e)) } catch { /* 용량 초과는 무시 */ }
}

let noteSeq = 0
export function newNoteId() {
  noteSeq += 1
  return `note_${Date.now().toString(36)}_${noteSeq}`
}
