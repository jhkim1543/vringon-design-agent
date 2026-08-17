// ── 품평 보드 · 좌에서 우로 흐르는 근거 흐름도 (React Flow) ──────────
// Input → Research → Signals → Directions → Designs → Picks. 연결선은 실제 데이터다.
import { t } from '../core/i18n'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useReactFlow, applyNodeChanges, Handle, Position, MarkerType, NodeResizer,
} from '@xyflow/react'
import type { Node, Edge, NodeChange } from '@xyflow/react'
import type { DesignImage, RunState } from '../core/types'
import { TIER_LABEL, TYPE_LABEL , isSketchView } from '../core/types'
import { buildBoardModel } from '../core/boardModel'
import { openTrendReportPdf, saveTrendReportHtml } from '../core/reportPdf'
import { openDossierPdf, saveDossierHtml } from '../core/dossierPdf'
import type { BoardEdits } from '../core/boardEdits'
import { EMPTY_EDITS, getActor, loadEdits, newNoteId, saveEdits, setActor } from '../core/boardEdits'
import type { SyncHandle } from '../core/boardSync'
import { connectBoardSync } from '../core/boardSync'
import { editImage } from '../core/aiClient'
import { detectRuntime } from '../core/runtime'
import type { BoardNode } from '../core/boardModel'
import { plainProse } from '../core/prose'
import { DesignCard } from './Card'
import { ThemeToggle } from './bits'
import { ModelViewer } from './ModelViewer'
import { copyText, shareLink } from '../core/share'
import { apiUrl } from '../core/apiBase'

// 노드를 키웠으므로 열 간격·행 높이도 같이 커진다. 붙여 두면 사진이 겹친다.
// 5번(스케치 레인)이 들어와 열이 10개다.
const COL_X = [0, 490, 980, 1440, 1900, 2360, 3140, 3640, 4140, 4640]
const colX = (c: number) => {
  const i = Math.floor(c)
  const base = COL_X[Math.min(i, COL_X.length - 1)]
  const next = COL_X[Math.min(i + 1, COL_X.length - 1)]
  return base + (c - i) * (next - base)
}
// 세로 위치는 카드 실제 높이를 쌓아 정한다 (build 안 GAP). 고정 간격은 겹침을 만든다.

// ── 노드 렌더러 ──────────────────────────────────────────────────────
// 편집 모드에서는 제목과 본문을 그 자리에서 고칠 수 있다.
// contentEditable을 쓰면 캔버스 드래그와 싸우므로, 클릭했을 때만 textarea로 바꾼다.
interface NodeEdit {
  editing: boolean
  light?: boolean
  onTitle: (id: string, v: string) => void
  onBody: (id: string, v: string[]) => void
  onHide: (id: string) => void
  /** 드래그로 조절한 칸 크기를 저장한다 · Run별로 남는다 */
  onSize: (id: string, w: number, h: number) => void
  /** 카드 우측의 + · 이 카드에서 이어 만들기(프롬프트 수정·재생성·섞기)와 코멘트를 연다 */
  onPlus?: (id: string) => void
  /** 이 카드에 달린 코멘트 수 · 배지로 보인다 */
  commentCount?: (id: string) => number
}

/** 카드 우측 중앙의 + 버튼과 코멘트 배지 · VIZCOM식 이어 만들기의 입구 */
function PlusHandle({ id, ed, hover }: { id: string; ed?: NodeEdit; hover: boolean }) {
  if (!ed?.onPlus) return null
  const n = ed.commentCount?.(id) ?? 0
  return (
    <>
      {n > 0 && (
        <button className="bn-cbadge" title={t('Comments')}
          onPointerDown={e => e.stopPropagation()} onClick={() => ed.onPlus!(id)}>💬 {n}</button>
      )}
      <button className={`bn-plus${hover ? ' show' : ''}`} title={t('Continue from this card')}
        onPointerDown={e => e.stopPropagation()} onClick={() => ed.onPlus!(id)}>+</button>
    </>
  )
}

function EditableText({ value, onSave, className, multiline, editing }: {
  value: string; onSave: (v: string) => void; className: string; multiline?: boolean; editing: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  if (!editing || !open) {
    return (
      <div className={className}
        onDoubleClick={editing ? (e) => { e.stopPropagation(); setOpen(true) } : undefined}
        title={editing ? 'Double-click to edit' : undefined}
        style={editing ? { cursor: 'text' } : undefined}>
        {value || (editing ? <span className="hint">{t('Double-click to write')}</span> : null)}
      </div>
    )
  }
  const commit = () => { setOpen(false); if (draft !== value) onSave(draft) }
  return multiline ? (
    <textarea className="bn-edit" value={draft} autoFocus rows={Math.max(2, draft.split('\n').length)}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setOpen(false) } }}
      onPointerDown={e => e.stopPropagation()} />
  ) : (
    <input className="bn-edit" value={draft} autoFocus
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setOpen(false) } }}
      onPointerDown={e => e.stopPropagation()} />
  )
}

/** 카드 안 내용이 실제로 차지한 높이. 손잡이와 크기조절 선은 빼고 잰다.
 *  글자 수로 높이를 추정하면 사진이 한 장만 늘어도 어긋난다. 그래서 재서 쓴다. */
function contentHeight(el: HTMLElement | null): number {
  if (!el) return 0
  let bottom = 0
  for (const c of Array.from(el.children) as HTMLElement[]) {
    const cls = c.className.toString()
    if (cls.includes('react-flow__handle') || cls.includes('resize')) continue
    bottom = Math.max(bottom, c.offsetTop + c.offsetHeight)
  }
  return bottom ? Math.ceil(bottom + (parseFloat(getComputedStyle(el).paddingBottom) || 0)) : 0
}

/** 렌더가 끝난 뒤 실제 높이를 배치기에 돌려준다 */
function useMeasure(ref: React.RefObject<HTMLElement>, id: string, report?: (id: string, h: number) => void, deps: unknown[] = []) {
  useEffect(() => {
    const el = ref.current
    if (!el || !report) return
    const send = () => { const h = contentHeight(el); if (h > 0) report(id, h) }
    send()
    const ro = new ResizeObserver(send)
    ro.observe(el)
    for (const c of Array.from(el.children)) ro.observe(c)
    // 사진은 늦게 도착한다. 도착하면 카드가 커지고, 그때 다시 재야 한다.
    const imgs = Array.from(el.querySelectorAll('img'))
    imgs.forEach(i => i.addEventListener('load', send))
    return () => { ro.disconnect(); imgs.forEach(i => i.removeEventListener('load', send)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, report, ...deps])
}

function StepNode({ id, data, selected }: { id: string; data: { n: BoardNode; ed?: NodeEdit; onMeasure?: (id: string, h: number) => void }; selected?: boolean }) {
  const { n, ed } = data
  const editing = !!ed?.editing
  // 내가 붙인 메모는 편집 모드를 켜지 않아도 바로 지울 수 있어야 한다.
  const isNote = n.tone === ('note' as typeof n.tone)
  // 칸 크기를 조절하면 3D 캔버스도 따라 커져야 한다 · 노드 높이를 재서 넘긴다
  const rootRef = useRef<HTMLDivElement>(null)
  const [mvH, setMvH] = useState(228)
  // 손잡이가 고른 칸에만 나타나면, 고를 수 있다는 것부터 모른다. 올려 두기만 해도 보인다.
  const [hover, setHover] = useState(false)
  useMeasure(rootRef, id, data.onMeasure, [n.body.length, n.imageUrl, n.modelUrl, n.prompts?.length, editing])
  useEffect(() => {
    if (!n.modelUrl || !rootRef.current) return
    const el = rootRef.current
    const ro = new ResizeObserver(() => {
      setMvH(Math.max(180, el.clientHeight - 96 - n.body.length * 20))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [n.modelUrl, n.body.length])
  return (
    <div ref={rootRef} className={`bnode tone-${n.tone ?? 'neutral'}${editing ? ' editing' : ''}${isNote ? ' is-note' : ''}`}
      onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
      {/* 칸에 마우스를 올리거나 골라 모서리를 끌면 커지고 작아진다 · 크기는 이 Run에 저장된다 */}
      <NodeResizer isVisible={!!selected || hover} minWidth={300} minHeight={130}
        lineClassName="bn-resize-line" handleClassName="bn-resize-handle"
        onResizeEnd={(_, p) => ed?.onSize(id, Math.round(p.width), Math.round(p.height))} />
      <Handle type="target" position={Position.Left} />
      {(editing || isNote) && (
        <button className="bn-x" title={t(isNote ? 'Delete this note' : 'Hide this card')}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => ed?.onHide(n.id)}>✕</button>
      )}
      <EditableText className="bn-t" value={plainProse(n.title)} editing={editing}
        onSave={v => ed?.onTitle(n.id, v)} />
      {/* 착용 컷처럼 이미지가 붙는 노드는 사진이 먼저 보여야 한다.
          원격 수집 사진이 죽으면 깨진 아이콘 대신 조용히 접는다. */}
      {n.imageUrl && !n.modelUrl && <img className="bn-img" src={n.imageUrl} alt="" loading="lazy"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
      {/* 3D는 카드 안에서 바로 돌려 본다 */}
      {n.modelUrl && <ModelViewer url={n.modelUrl} poster={n.imageUrl} height={mvH} light={ed?.light} />}
      {/* 팔레트는 글이 아니라 색으로 보인다 */}
      {n.palette && n.palette.length > 0 && (
        <div className="bn-pal">
          {n.palette.slice(0, 8).map((c, i) => (
            <span key={c.hex + i} title={c.name}><i style={{ background: c.hex }} />{c.name}</span>
          ))}
        </div>
      )}
      <EditableText className="bn-body" multiline editing={editing}
        value={n.body.map(plainProse).join('\n')}
        onSave={v => ed?.onBody(n.id, v.split('\n').filter(x => x.trim()))} />
      {/* 스케치가 디자인이 된 실제 프롬프트 · 근거는 이 카드가 들고 다닌다 */}
      {n.prompts && n.prompts.length > 0 && (
        <div className="bn-prompts">
          {n.prompts.map((p, i) => <div key={i} className="bn-prompt">{p}</div>)}
        </div>
      )}
      <PlusHandle id={n.id} ed={ed} hover={hover} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function DesignFlowNode({ id, data, selected }: { id: string; data: { n: BoardNode; st: RunState; onVerdict: any; ed?: NodeEdit; onMeasure?: (id: string, h: number) => void }; selected?: boolean }) {
  const { n, st, onVerdict, ed } = data
  const rootRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState(false)
  // 근거 패널을 펴면 카드가 두 배로 길어진다 · 그때마다 다시 재서 아래 칸을 밀어낸다
  useMeasure(rootRef, id, data.onMeasure, [n.design?.images.length, n.design?.verdict])
  if (!n.design) return null
  return (
    <div ref={rootRef} style={{ width: '100%', minWidth: 268, position: 'relative', height: '100%', overflow: 'hidden' }}
      onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
      <NodeResizer isVisible={!!selected || hover} minWidth={268} minHeight={380}
        lineClassName="bn-resize-line" handleClassName="bn-resize-handle"
        onResizeEnd={(_, p) => ed?.onSize(id, Math.round(p.width), Math.round(p.height))} />
      <Handle type="target" position={Position.Left} />
      <DesignCard d={n.design} signals={st.signals} stagePassed={{ s3: true, s4: true }} onVerdict={onVerdict} />
      <PlusHandle id={n.id} ed={ed} hover={hover} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function ColumnNode({ data }: { data: { title: string; note: string; h: number; w?: number } }) {
  return (
    <div className="bcol" style={{ height: data.h, width: data.w ?? 356 }}>
      <div className="bcol-h">
        <span className="bcol-t">{t(data.title)}</span>
        <span className="bcol-n">{t(data.note)}</span>
      </div>
    </div>
  )
}

const nodeTypes = { step: StepNode, designFlow: DesignFlowNode, column: ColumnNode }

function build(st: RunState, onVerdict: any, edits: BoardEdits, ed: NodeEdit, measured: Record<string, number> = {}, onMeasure?: (id: string, h: number) => void): { nodes: Node[]; edges: Edge[] } {
  const model = buildBoardModel(st)
  const nodes: Node[] = []
  const hidden = new Set(edits.hidden)

  // 사용자가 고친 문구를 원본 위에 덧칠한다
  const apply = (n: BoardNode): BoardNode => ({
    ...n,
    title: edits.titles[n.id] ?? n.title,
    body: edits.bodies[n.id] ?? n.body,
  })

  // 치수와 핸들 위치를 명시한다 · DOM 측정을 기다리지 않고 연결선이 즉시 계산된다
  const visible = model.nodes.filter(n => !hidden.has(n.id)).map(apply)
  const noteNodes: BoardNode[] = edits.notes.filter(n => !hidden.has(n.id)).map(n => ({
    id: n.id, kind: 'selection', column: n.column, row: n.row,
    title: edits.titles[n.id] ?? n.title,
    body: edits.bodies[n.id] ?? n.body,
    tone: 'note' as any,
  }))

  /** 카드가 실제로 차지하는 크기. 사진이 붙으면 훌쩍 커진다.
   *  글자 수 추정은 첫 프레임에만 쓰고, 그다음부터는 카드가 재서 알려준 실제 높이를 쓴다. */
  const sizeOf = (n: BoardNode) => {
    const isDesign = n.kind === 'design' && !!n.design
    const sz = edits.sizes[n.id]
    const w = sz?.w ?? (isDesign ? 300 : (n as any).isPitch ? 360 : 384)
    const guess = isDesign ? 470
      : 46 + n.body.length * 22 + (n.imageUrl ? 240 : 0) + (n.modelUrl ? 244 : 0)
        + (n.palette?.length ? 30 : 0) + (n.prompts?.length ? n.prompts.length * 46 : 0)
    // 손으로 끌어 맞춘 크기가 있으면 그게 최우선. 넘치는 내용은 칸 안에서 잘린다.
    const h = sz?.h ?? measured[n.id] ?? guess
    return { w, h, isDesign }
  }

  // 행 번호에 고정 간격을 곱하면 사진 카드가 서로 겹친다 (카드는 300px이 넘는데 간격은 172px이었다).
  // 열마다 실제 높이를 쌓아 내려간다. 손으로 옮긴 카드는 그 자리를 지킨다.
  const GAP = 28
  const cursor = new Map<number, number>()
  const colHeight = new Map<number, number>()
  const laid = [...visible, ...noteNodes].sort((a, b) => a.column - b.column || a.row - b.row)
  const autoPos = new Map<string, { x: number; y: number }>()
  for (const n of laid) {
    const { h } = sizeOf(n)
    const y = cursor.get(n.column) ?? 0
    autoPos.set(n.id, { x: colX(n.column), y })
    cursor.set(n.column, y + h + GAP)
    colHeight.set(Math.floor(n.column), Math.max(colHeight.get(Math.floor(n.column)) ?? 0, y + h))
  }

  // 컬럼 배경 · 단계 구분. 높이는 그 열이 실제로 쓴 만큼.
  const allColumns = [...model.columns, ...edits.extraColumns]
  allColumns.forEach((c, i) => {
    nodes.push({
      id: `col-${c.key}`, type: 'column',
      position: { x: colX(i) - 24, y: -86 },
      data: {
        title: c.title, note: c.note,
        h: Math.max((colHeight.get(i) ?? 0) + 150, 360),
        w: (i === 5 ? 720 : 430),
      },
      selectable: false, draggable: false, zIndex: -1,
    })
  })

  for (const n of laid) {
    const { w, h, isDesign } = sizeOf(n)
    nodes.push({
      id: n.id,
      type: isDesign ? 'designFlow' : 'step',
      width: w, height: h,
      handles: [
        { type: 'target', position: Position.Left, x: 0, y: h / 2, width: 1, height: 1 },
        { type: 'source', position: Position.Right, x: w, y: h / 2, width: 1, height: 1 },
      ],
      data: isDesign ? { n, st, onVerdict, ed, onMeasure } : { n, ed, onMeasure },
      position: edits.positions[n.id] ?? autoPos.get(n.id) ?? { x: colX(n.column), y: 0 },
    })
  }

  const edges: Edge[] = model.edges.filter(e => !hidden.has(e.from) && !hidden.has(e.to)).map((e, i) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    label: e.label,
    animated: !!e.weight && e.weight >= 0.35,
    style: {
      stroke: e.dashed ? '#54585F' : '#4A50D6',
      strokeWidth: e.weight ? Math.max(1.2, e.weight * 5) : 1.2,
      strokeDasharray: e.dashed ? '5 4' : undefined,
    },
    labelStyle: { fill: '#A0A4AC', fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: '#101014', fillOpacity: 0.9 },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 3,
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: e.dashed ? '#54585F' : '#4A50D6' },
  }))

  return { nodes, edges }
}

// ── 이어 만들기 패널 · 프롬프트를 고쳐 다시 뽑고, 다른 안과 섞고, 코멘트를 단다 ──
//
// 보드가 결과 전시로 끝나면 PT 도구지 작업 도구가 아니다. 여기가 그 경계를 넘는 지점이다:
// AI 가 쓴 프롬프트를 사람이 고쳐 그 자리에서 재생성해 보고, 두 안의 아이디어를 섞어 보고,
// 같이 보는 사람이 카드에 의견을 단다. 생성은 기준 이미지의 편집(edit)이라
// 실루엣이 유지된다 — 새로 그리는 게 아니라 그 안에서 움직인다.
function RemixPanel({ st, nodeId, edits, live, actor, onClose, onComment, onImage }: {
  st: RunState
  nodeId: string
  edits: BoardEdits
  live: boolean
  actor: string
  onClose: () => void
  onComment: (nodeId: string, text: string) => void
  onImage: (designId: string, img: DesignImage) => void
}) {
  // 노드 → 기준 이미지. 디자인 카드는 히어로 렌더, 스케치 카드는 그 스케치.
  const skMatch = nodeId.match(/^sk-(.+)-(\d+)$/)
  const designId = skMatch ? skMatch[1] : nodeId
  const d = st.designs.find(x => x.spec.design_id === designId)
  const base = (() => {
    if (!d) return null
    if (skMatch) {
      const sketches = d.images.filter(i => isSketchView(i.view))
      return sketches[Number(skMatch[2])] ?? null
    }
    return d.images.find(i => !isSketchView(i.view)) ?? null
  })()

  const [prompt, setPrompt] = useState(() => base?.promptUsed ?? '')
  const [mixWith, setMixWith] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [made, setMade] = useState<DesignImage | null>(null)
  const [draft, setDraft] = useState('')
  const thread = edits.comments[nodeId] ?? []

  // 섞기 · 상대 안의 저작된 아이디어를 프롬프트에 문장으로 넣는다.
  // 사용자가 그 문장을 그대로 보고 고칠 수 있어야 하므로, 몰래 합치지 않고 텍스트로 얹는다.
  const mix = (otherId: string) => {
    setMixWith(otherId)
    if (!otherId) return
    const o = st.designs.find(x => x.spec.design_id === otherId)
    if (!o) return
    const idea = o.spec.genome
      ? `${o.spec.genome.hero_mutation.drawing_instruction} Upper material: ${o.spec.genome.spec_sheet.upper_material}.`
      : (o.spec.comboLabel ?? 'its lead idea')
    setPrompt(p => `${p.trim()} Blend in the defining elements of ${otherId}: ${idea} Keep this shoe's silhouette and outsole line.`)
  }

  const generate = async () => {
    if (!d || !base || !prompt.trim() || busy) return
    setBusy(true); setErr('')
    try {
      const r = await editImage(base.hash, prompt.trim(), 'detail')
      const img: DesignImage = {
        view: 'design', url: r.url, hash: r.hash, origin: 'edited_from', editedFrom: base.hash,
        promptUsed: prompt.trim(),
        whyUsed: `Board remix by ${actor}: the prompt was edited by hand${mixWith ? `, blending in ${mixWith}` : ''}.`,
      }
      onImage(d.spec.design_id, img)
      setMade(img)
    } catch (e) {
      setErr(String((e as Error).message ?? e).slice(0, 140))
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="remix" onPointerDown={e => e.stopPropagation()}>
      <div className="remix-h">
        <b>{skMatch ? `${designId} · ${t('Sketch')} ${Number(skMatch[2]) + 1}` : designId}</b>
        <button className="btn btn-ghost btn-sm sq" onClick={onClose}>✕</button>
      </div>

      {base && (
        <>
          <img className="remix-img" src={made?.url ?? base.url} alt="" />
          {made && <div className="notice info" style={{ fontSize: 12 }}>{t('Added to this design. It is on the board now.')}</div>}
          {live ? (
            <>
              <span className="lbl">{t('Prompt · edit it and regenerate')}</span>
              <textarea className="remix-ta" value={prompt} onChange={e => setPrompt(e.target.value)}
                rows={7} placeholder={t('No prompt stored for this cut — write one')} />
              <div className="inrow">
                <select className="input" value={mixWith} onChange={e => mix(e.target.value)}>
                  <option value="">{t('Blend with another design…')}</option>
                  {st.designs.filter(x => !x.rejected && x.spec.design_id !== designId).map(x => (
                    <option key={x.spec.design_id} value={x.spec.design_id}>{x.spec.design_id} · {x.spec.comboLabel?.slice(0, 28) ?? TIER_LABEL[x.spec.tier]}</option>
                  ))}
                </select>
                <button className="btn btn-primary btn-sm" onClick={generate} disabled={busy || !prompt.trim()}>
                  {busy ? t('Generating…') : t('Regenerate')}
                </button>
              </div>
              {err && <div className="notice warn" style={{ fontSize: 12 }}>{err}</div>}
              <p className="hint">{t('Runs as an edit of this cut, so the silhouette holds. The result lands on this design with your name on the why.')}</p>
            </>
          ) : (
            <p className="hint">{t('Viewing a static copy — regeneration needs the live server. Comments still work for people on this browser.')}</p>
          )}
        </>
      )}

      {/* ── 코멘트 · 같이 보는 사람의 피드백이 카드에 남는다 ── */}
      <span className="lbl">{t('Comments')} {thread.length ? `· ${thread.length}` : ''}</span>
      <div className="remix-thread">
        {thread.length === 0 && <span className="hint">{t('Nothing yet. Leave the first note.')}</span>}
        {thread.map(c => (
          <div className="remix-c" key={c.id}>
            <b>{c.author}</b>
            <span>{c.text}</span>
            <i>{new Date(c.at).toLocaleString()}</i>
          </div>
        ))}
      </div>
      <div className="inrow">
        <input className="input" value={draft} onChange={e => setDraft(e.target.value)}
          placeholder={t('Write a comment')} onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onComment(nodeId, draft.trim()); setDraft('') } }} />
        <button className="btn btn-ghost btn-sm" disabled={!draft.trim()}
          onClick={() => { onComment(nodeId, draft.trim()); setDraft('') }}>{t('Add')}</button>
      </div>
    </aside>
  )
}

function BoardInner({ st, onVerdict, runId, onBoardImage }: { st: RunState; onVerdict: any; runId: string; onBoardImage?: (designId: string, img: DesignImage) => void }) {
  const [editing, setEditing] = useState(false)
  const [edits, setEdits] = useState<BoardEdits>(() => loadEdits(runId))

  // ── 동시 편집 · 서버가 있으면 이 보드는 같이 보는 화면이 된다 ──────
  const [viewers, setViewers] = useState(0)
  const [syncNote, setSyncNote] = useState('')
  const [live, setLive] = useState(false)
  const [actorName, setActorName] = useState(() => getActor())
  const syncRef = useRef<SyncHandle | null>(null)
  const remoteRef = useRef(false)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    let dead = false
    detectRuntime().then(rt => {
      if (dead || rt.kind !== 'live') return
      setLive(true)
      syncRef.current = connectBoardSync(runId, getActor(), {
        edits: (remote) => { remoteRef.current = true; setEdits({ ...EMPTY_EDITS, ...remote }) },
        viewers: (n, note) => {
          setViewers(n)
          if (note) {
            setSyncNote(note)
            if (noteTimer.current) clearTimeout(noteTimer.current)
            noteTimer.current = setTimeout(() => setSyncNote(''), 4000)
          }
        },
      })
    })
    return () => { dead = true; syncRef.current?.close(); syncRef.current = null }
  }, [runId])

  useEffect(() => {
    saveEdits(runId, edits)
    // 원격에서 받은 변경을 그대로 되돌려 보내면 두 브라우저가 핑퐁한다
    if (remoteRef.current) { remoteRef.current = false; return }
    syncRef.current?.push(edits)
  }, [runId, edits])

  // 편집 콜백은 안정적이어야 한다. 매 렌더마다 새로 만들면 노드가 통째로 다시 그려진다.
  const [light, setLight] = useState(() => (localStorage.getItem('vringon.boardTheme') ?? 'light') === 'light')
  // + 패널 · 어느 카드가 열려 있는가
  const [panelNode, setPanelNode] = useState<string | null>(null)
  const commentTotals = useMemo(() => {
    const m: Record<string, number> = {}
    for (const [k, v] of Object.entries(edits.comments ?? {})) m[k] = v.length
    return m
  }, [edits.comments])

  const ed = useMemo<NodeEdit>(() => ({
    editing,
    light,
    onTitle: (id, v) => setEdits(e => ({ ...e, titles: { ...e.titles, [id]: v } })),
    onBody: (id, v) => setEdits(e => ({ ...e, bodies: { ...e.bodies, [id]: v } })),
    // 내가 만든 메모는 지운다. 파이프라인이 만든 카드는 숨기기만 한다 (다시 계산하면 돌아온다)
    onHide: (id) => setEdits(e => e.notes.some(n => n.id === id)
      ? { ...e, notes: e.notes.filter(n => n.id !== id) }
      : { ...e, hidden: [...new Set([...e.hidden, id])] }),
    // 모서리를 끌어 바꾼 크기 · 이 Run의 보드에 저장된다
    onSize: (id, w, h) => setEdits(e => ({ ...e, sizes: { ...e.sizes, [id]: { w, h } } })),
    onPlus: (id) => setPanelNode(cur => cur === id ? null : id),
    commentCount: (id) => commentTotals[id] ?? 0,
  }), [editing, light, commentTotals])

  const addComment = useCallback((nodeId: string, text: string) => {
    setEdits(e => ({
      ...e,
      comments: {
        ...(e.comments ?? {}),
        [nodeId]: [...((e.comments ?? {})[nodeId] ?? []), {
          id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          author: getActor(), text, at: new Date().toISOString(),
        }],
      },
    }))
  }, [])

  // 카드가 렌더된 뒤 실제 높이를 알려 준다. 그 높이로 다시 쌓아야 아래 칸이 안 겹친다.
  const [measured, setMeasured] = useState<Record<string, number>>({})
  const onMeasure = useCallback((id: string, h: number) => {
    setMeasured(m => Math.abs((m[id] ?? 0) - h) > 6 ? { ...m, [id]: h } : m)
  }, [])

  const initial = useMemo(() => build(st, onVerdict, edits, ed, measured, onMeasure), [st, onVerdict, edits, ed, measured, onMeasure])
  const [nodes, setNodes] = useState<Node[]>(initial.nodes)
  const [present, setPresent] = useState(false)
  const [presentIdx, setPresentIdx] = useState(0)
  const [showNotes, setShowNotes] = useState(true)
  const [miro, setMiro] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null })
  const [showEdges, setShowEdges] = useState(true)
  useEffect(() => {
    localStorage.setItem('vringon.boardTheme', light ? 'light' : 'dark')
    // 보드도 attribute만 바꾸면 일부 배경이 옛 테마 값으로 남는다. 강제 재계산.
    const el = document.querySelector('.board') as HTMLElement | null
    if (el) { const p = el.style.display; el.style.display = 'none'; void el.offsetHeight; el.style.display = p }
  }, [light])
  const rf = useReactFlow()
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({})

  // 종류 필터 · 보드가 빽빽해지면 한 갈래만 따라가고 싶어진다
  const [kindFilter, setKindFilter] = useState<'all' | 'research' | 'design' | 'selection'>('all')
  // 도구 · 'note'/'lane' 을 고른 뒤 보드를 누르면 그 자리에 놓인다.
  // 실제로 동작하는 것만 둔다. 눌러도 아무 일 없는 도구는 만들지 않는다.
  const [tool, setTool] = useState<'select' | 'note' | 'lane'>('select')
  const [zoomPct, setZoomPct] = useState(100)

  useEffect(() => {
    // 열(column) 노드는 늘 남긴다. 빼면 화면이 뼈대를 잃는다.
    const KEEP: Record<string, string[]> = {
      research: ['input', 'research', 'signal', 'direction'],
      design: ['design', 'appendix'],
      selection: ['selection'],
    }
    const allow = KEEP[kindFilter]
    setNodes(build(st, onVerdict, edits, ed, measured, onMeasure).nodes
      // 종류는 data.n.kind 에 있다. data.kind 는 열 노드에만 없는 게 아니라 아예 없다.
      .filter(n => !allow || n.type === 'column'
        || allow.includes(String((n.data as { n?: BoardNode })?.n?.kind ?? '')))
      .map(n => positionsRef.current[n.id] ? { ...n, position: positionsRef.current[n.id] } : n))
  }, [st, onVerdict, edits, ed, kindFilter, measured, onMeasure])

  // 노드 측정이 늦게 끝나는 환경에서도 첫 화면이 전체 흐름으로 맞춰지게 한다
  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ duration: 300, padding: 0.12 }), 120)
    return () => clearTimeout(t)
  }, [rf])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(ns => applyNodeChanges(changes, ns))
    for (const c of changes) {
      if (c.type !== 'position' || !c.position) continue
      positionsRef.current[c.id] = c.position
      // 드래그가 끝났을 때만 저장한다. 이동 중에 매번 쓰면 스토리지가 요동친다.
      if (c.dragging === false) {
        const p = c.position
        setEdits(e => ({ ...e, positions: { ...e.positions, [c.id]: p } }))
      }
    }
  }, [])

  // 메모 카드 · 누른 자리에 연다. 자리를 안 주면 흐름 오른쪽 끝에 쌓는다.
  const addNote = useCallback((at?: { x: number; y: number }) => {
    const id = newNoteId()
    setEdits(e => {
      const col = Math.max(0, buildBoardModel(st).columns.length - 1)
      const row = e.notes.filter(n => n.column === col).length + 6
      return {
        ...e,
        notes: [...e.notes, { id, column: col, row, title: 'Note', body: ['Double-click to write'] }],
        // 위치를 함께 저장해야 누른 자리에 그대로 놓인다
        positions: at ? { ...e.positions, [id]: at } : e.positions,
      }
    })
  }, [st])

  // 칸 추가 · 흐름 오른쪽에 새 단계를 연다
  const addColumn = useCallback(() => {
    setEdits(e => {
      const n = e.extraColumns.length + 1
      return { ...e, extraColumns: [...e.extraColumns, { key: `extra${n}`, title: `${buildBoardModel(st).columns.length + n} · New lane`, note: 'Yours to fill' }] }
    })
  }, [st])

  const resetEdits = useCallback(() => {
    if (!confirm('Discard every edit you made on this board?')) return
    setEdits({ ...EMPTY_EDITS })
    positionsRef.current = {}
  }, [])

  // 발표 순서 = 보드의 논리 순서 그대로
  const focusOrder = useMemo(() => buildBoardModel(st).nodes.map(n => n.id), [st])

  useEffect(() => {
    if (!present) return
    const n = rf.getNodes().find(x => x.id === focusOrder[presentIdx])
    if (n) rf.fitView({ nodes: [n], duration: 480, padding: 0.34 })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPresent(false); rf.fitView({ duration: 480 }) }
      if (e.key === 'ArrowRight') setPresentIdx(i => Math.min(focusOrder.length - 1, i + 1))
      if (e.key === 'ArrowLeft') setPresentIdx(i => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [present, presentIdx, focusOrder, rf])

  // 공유 · 이 보드를 가리키는 주소를 복사한다.
  // 다른 기기에서는 그 분석이 없어 열리지 않으므로, 그때는 내보내기를 써야 한다.
  const share = useCallback(async () => {
    const url = shareLink(runId, 'board')
    const ok = await copyText(url)
    // 복사가 막히는 환경이 있다. 그때는 링크를 그대로 띄워 직접 복사하게 둔다.
    setMiro({ busy: false, msg: ok ? t('Link copied. It opens this board in a browser that has this run.') : url })
  }, [runId])

  // Miro 토큰은 사용자마다 다르다. 이 브라우저에만 저장하고, 내보낼 때 요청에 실어 보낸다.
  // 서버는 저장하지 않는다 — 데모를 쓰는 사람마다 자기 토큰으로 자기 팀에 보드를 만든다.
  const [miroToken, setMiroToken] = useState<string>(() => localStorage.getItem('vringon.miroToken') ?? '')
  const [miroModal, setMiroModal] = useState(false)
  const [miroDraft, setMiroDraft] = useState('')

  const exportMiro = useCallback(async (tokenOverride?: string) => {
    setMiro({ busy: true, msg: 'Converting board for Miro' })
    try {
      const model = buildBoardModel(st)
      const r = await fetch(apiUrl('/api/miro/export'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          token: tokenOverride ?? miroToken ?? undefined,
          meta: {
            name: `VRINGON review · footwear ${new Date().toISOString().slice(0, 10)}`,
            description: 'The reasoning from research through to selection',
          },
        }),
      })
      const j = await r.json()
      if (j.mode === 'created') {
        setMiro({ busy: false, msg: `Miro board created · ${j.created.frames} frames · ${j.created.items} cards · ${j.created.connectors} connections` })
        if (j.viewLink) window.open(j.viewLink, '_blank', 'noopener')
      } else if (j.plan) {
        // 토큰이 없다 · 파일을 떨구는 대신 연결 안내를 연다. 각자 자기 토큰으로 연결한다.
        setMiro({ busy: false, msg: null })
        setMiroModal(true)
      } else {
        setMiro({ busy: false, msg: j.error ?? 'Export failed' })
        // 401/403 이면 토큰이 죽은 것 · 다시 연결하게 연다
        if (/40[13]/.test(String(j.error ?? ''))) { setMiroToken(''); localStorage.removeItem('vringon.miroToken'); setMiroModal(true) }
      }
    } catch (e) {
      setMiro({ busy: false, msg: String((e as Error).message) })
    }
  }, [st, miroToken])

  const connectMiro = useCallback(() => {
    const tk = miroDraft.trim()
    if (!tk) return
    localStorage.setItem('vringon.miroToken', tk)
    setMiroToken(tk)
    setMiroModal(false)
    setMiroDraft('')
    exportMiro(tk)
  }, [miroDraft, exportMiro])

  const currentNode = present ? buildBoardModel(st).nodes.find(n => n.id === focusOrder[presentIdx]) : undefined

  return (
    <div className={`board ${light ? 'board-light' : ''}${tool !== 'select' ? ' placing' : ''}`} data-theme={light ? 'light' : 'dark'}>
      <div className="boardbar">
        {!present ? (<>
          {/* ── 윗줄 · 정체와 내보내기 ─────────────────────── */}
          <div className="bb-row bb-top">
            <span className="bb-title">{t('Review board')}</span>
            <span className="bb-sub">{t(TYPE_LABEL[st.params.itemType])} · {nodes.length} {t('cards')}</span>
            {/* 같이 보는 사람 · 서버가 있을 때만 뜬다. 이름은 코멘트와 재생성 기록에 쓰인다. */}
            {live && (
              <span className="bb-live" title={t('People looking at this board right now')}>
                <i />{viewers > 1 ? `${viewers} ${t('viewing')}` : t('Only you')}
                <input className="bb-name" value={actorName}
                  onChange={e => setActorName(e.target.value)}
                  onBlur={() => setActor(actorName)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
              </span>
            )}
            {syncNote && <span className="bb-syncnote">{syncNote}</span>}
            <span className="bb-gap" />
            <ThemeToggle theme={light ? 'light' : 'dark'} onToggle={() => setLight(v => !v)} />
            <button className="btn btn-ghost btn-sm" onClick={share} title={t('Copy a link to this board')}>{t('Share')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>{t('Board PDF')}</button>
            {!!st.trendReport && (
              <span className="btn-split">
                <button className="btn btn-ghost btn-sm" onClick={() => openTrendReportPdf(st)}>{t('Report PDF')}</button>
                <button className="btn btn-ghost btn-sm sq" title={t('Save as file')}
                  onClick={() => saveTrendReportHtml(st)}>↓</button>
              </span>
            )}
            {!!st.dossier && (
              <span className="btn-split">
                <button className="btn btn-ghost btn-sm" onClick={() => openDossierPdf(st)}>{t('Season dossier')}</button>
                <button className="btn btn-ghost btn-sm sq" title={t('Save as file')}
                  onClick={() => saveDossierHtml(st)}>↓</button>
              </span>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => exportMiro()} disabled={miro.busy}>
              {miro.busy ? t('Exporting') : t('Export to Miro')}
            </button>
          </div>

          {/* ── 아랫줄 · 지금 보이는 것과 조작 ─────────────── */}
          <div className="bb-row bb-sub-row">
            {([['all', 'All'], ['research', 'Research'], ['design', 'Designs'], ['selection', 'Selection']] as const).map(([k, label]) => (
              <button key={k} className={`chipbtn ${kindFilter === k ? 'on' : ''}`}
                onClick={() => setKindFilter(k)}>{t(label)}</button>
            ))}
            <span className="bar-sep" />
            <button className={`chipbtn ${showEdges ? 'on' : ''}`}
              onClick={() => setShowEdges(v => !v)} title={t('Show the lines between nodes')}>{t('Links')}</button>
            <button className={`chipbtn ${editing ? 'on' : ''}`}
              onClick={() => setEditing(v => !v)} title={t('Double-click any card to rewrite it')}>{t('Edit text')}</button>
            {(edits.notes.length > 0 || edits.hidden.length > 0 || Object.keys(edits.titles).length > 0) && (
              <button className="chipbtn" onClick={resetEdits} title={t('Back to the generated board')}>{t('Reset edits')}</button>
            )}
            <span className="bb-gap" />
            <button className="chipbtn" onClick={() => { setPresent(true); setPresentIdx(0) }}>{t('Present')}</button>
            <button className="chipbtn" onClick={() => rf.fitView({ duration: 400 })}>{t('Fit')}</button>
          </div>
        </>) : (<>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{presentIdx + 1} / {focusOrder.length}</span>
          <span className="hint">{currentNode?.title}</span>
          <span className="bar-sep" />
          <button className="btn btn-ghost btn-sm" onClick={() => setPresentIdx(i => Math.max(0, i - 1))}>{t('Prev')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPresentIdx(i => Math.min(focusOrder.length - 1, i + 1))}>{t('Next')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowNotes(v => !v)}>{t('Notes')} {t(showNotes ? 'On' : 'Off')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setPresent(false); rf.fitView({ duration: 480 }) }}>{t('Exit')}</button>
        </>)}
      </div>

      {miro.msg && !present && (
        <div className="board-toast" onClick={() => setMiro(m => ({ ...m, msg: null }))}>{miro.msg}</div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={showEdges ? initial.edges : []}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.04}
        maxZoom={4}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        panOnScroll={false}
        preventScrolling
        selectionOnDrag={false}
        proOptions={{ hideAttribution: true }}
        colorMode={light ? 'light' : 'dark'}
        onMove={(_, vp) => setZoomPct(Math.round(vp.zoom * 100))}
        /* 도구를 고른 상태에서는 캔버스를 끄는 대신 놓는다 */
        panOnDrag={tool === 'select' ? [0, 1, 2] : [1, 2]}
        onPaneClick={(e) => {
          if (tool === 'select') return
          const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
          if (tool === 'note') addNote(at)
          else addColumn()
          setTool('select')        // 한 번 놓으면 손을 뗀다
        }}
      >
        <Background color={light ? '#E3E7EC' : '#1C1C22'} gap={28} />
        <Controls showInteractive={false} />

        {/* 도구 레일 · 실제로 무언가 일어나는 것만 둔다 */}
        <div className="btools">
          {([
            ['select', t('Select'), 'M5 3.4 18 11.6l-5.4 1.2-2.4 5.2z'],
            ['note', t('Note'), 'M5.4 4h13.2v10.4L14 19H5.4zM14 19v-4.6h4.6'],
            ['lane', t('Lane'), 'M4.6 4h4.4v16H4.6zM10.8 4h4.4v16h-4.4zM17 4h2.4v16H17z'],
          ] as const).map(([k, label, d]) => (
            <button key={k} className={`btool ${tool === k ? 'on' : ''}`} title={label}
              onClick={() => {
                // 칸은 놓을 위치가 없다(열은 항상 오른쪽 끝). 누르는 즉시 추가한다.
                if (k === 'lane') { addColumn(); return }
                setTool(k)
              }}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 도구를 고른 동안 무엇을 하면 되는지 알려 준다 */}
        {tool !== 'select' && (
          <div className="btool-hint">
            {t(tool === 'note' ? 'Click the board to place a note' : 'Click the board to add a lane')}
            <button onClick={() => setTool('select')}>{t('Cancel')}</button>
          </div>
        )}

        <div className="bzoom">{zoomPct}%</div>
        <MiniMap pannable zoomable
          nodeColor={light ? '#D5DAE2' : '#2A2E35'}
          maskColor={light ? 'rgba(240,242,245,.72)' : 'rgba(10,10,12,.72)'}
          style={{
            background: light ? '#FFFFFF' : '#121216',
            border: `1px solid ${light ? '#E3E7EC' : '#23232A'}`, borderRadius: 8,
          }} />
      </ReactFlow>

      {/* + 로 연 카드의 이어 만들기 패널 · 보드 위에 떠 있고, 뒤 캔버스는 계속 산다 */}
      {panelNode && !present && (
        <RemixPanel st={st} nodeId={panelNode} edits={edits} live={live} actor={actorName}
          onClose={() => setPanelNode(null)} onComment={addComment}
          onImage={(designId, img) => onBoardImage?.(designId, img)} />
      )}

      {present && showNotes && currentNode && (
        <div className="present-note">
          <b>{currentNode.title}</b>
          {currentNode.design
            ? currentNode.design.rationale.narrative.map((n, i) => <div key={i}>{n}</div>)
            : currentNode.body.map((b, i) => <div key={i}>{b}</div>)}
          {currentNode.design?.viewMismatch && (
            <div style={{ color: 'var(--warn)' }}>{t('Details disagree between views on this one. The gap survived a regeneration and is left visible.')}</div>
          )}
          {currentNode.design && (
            <div style={{ color: 'var(--text-3)', marginTop: 4 }}>
              {TIER_LABEL[currentNode.design.spec.tier]} · {currentNode.design.rationale.type_placement_reason}
            </div>
          )}
        </div>
      )}

      {/* Miro 연결 · 토큰은 사용자마다 다르다. 이 브라우저에만 저장되고 서버에는 남지 않는다. */}
      {miroModal && (
        <div className="modal-back" onClick={() => setMiroModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-h">
              <div>
                <h2>{t('Connect your Miro')}</h2>
                <p className="hint">{t('Each person uses their own token, so the board lands in your team. The token stays in this browser only and is never stored on the server.')}</p>
              </div>
            </div>
            <div style={{ padding: '4px 20px 8px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, lineHeight: 1.6 }}>
              <div><b>1.</b> <a href="https://miro.com/app/settings/user-profile/apps" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-hi)' }}>miro.com/app/settings/user-profile/apps</a> {t('and press Create new app, then pick your team')}</div>
              <div><b>2.</b> {t('Tick the boards:read and boards:write scopes, then press Install app and get OAuth token')}</div>
              <div><b>3.</b> {t('Paste the token below')}</div>
              <input className="input" type="password" placeholder={t('Miro access token')} autoFocus
                value={miroDraft} onChange={e => setMiroDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') connectMiro() }} />
            </div>
            <div className="modal-foot">
              {miroToken && (
                <button className="btn btn-ghost btn-sm"
                  onClick={() => { localStorage.removeItem('vringon.miroToken'); setMiroToken(''); setMiro({ busy: false, msg: t('Miro disconnected on this browser.') }) }}>
                  {t('Disconnect')}
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setMiroModal(false)}>{t('Cancel')}</button>
              <button className="btn btn-primary" style={{ marginLeft: 'auto' }} disabled={!miroDraft.trim()}
                onClick={connectMiro}>
                {t('Connect and export')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Board(props: { st: RunState; onVerdict: any; runId?: string; onBoardImage?: (designId: string, img: DesignImage) => void }) {
  if (props.st.designs.length === 0 && props.st.signals.length === 0) {
    return <div className="empty" style={{ flex: 1 }}>
      <div>{t('Nothing on the board yet.')}<br /><span className="hint">{t('Run the agent and the flow from research to selection fills in.')}</span></div>
    </div>
  }
  return <ReactFlowProvider><BoardInner {...props} runId={props.runId ?? 'current'} /></ReactFlowProvider>
}
