// ── 품평 보드 · 좌에서 우로 흐르는 근거 흐름도 (React Flow) ──────────
// Input → Research → Signals → Directions → Designs → Picks. 연결선은 실제 데이터다.
import { t } from '../core/i18n'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useReactFlow, applyNodeChanges, Handle, Position, MarkerType,
} from '@xyflow/react'
import type { Node, Edge, NodeChange } from '@xyflow/react'
import type { RunState } from '../core/types'
import { TIER_LABEL } from '../core/types'
import { buildBoardModel } from '../core/boardModel'
import { openTrendReportPdf, saveTrendReportHtml } from '../core/reportPdf'
import { openDossierPdf, saveDossierHtml } from '../core/dossierPdf'
import type { BoardEdits } from '../core/boardEdits'
import { EMPTY_EDITS, loadEdits, newNoteId, saveEdits } from '../core/boardEdits'
import type { BoardNode } from '../core/boardModel'
import { DesignCard } from './Card'
import { Tag, ThemeToggle } from './bits'
import { ModelViewer } from './ModelViewer'

const COL_X = [0, 400, 800, 1180, 1600, 2320, 2740, 3160]
const colX = (c: number) => {
  const i = Math.floor(c)
  const base = COL_X[Math.min(i, COL_X.length - 1)]
  const next = COL_X[Math.min(i + 1, COL_X.length - 1)]
  return base + (c - i) * (next - base)
}
const ROW_Y = 150

// ── 노드 렌더러 ──────────────────────────────────────────────────────
// 편집 모드에서는 제목과 본문을 그 자리에서 고칠 수 있다.
// contentEditable을 쓰면 캔버스 드래그와 싸우므로, 클릭했을 때만 textarea로 바꾼다.
interface NodeEdit {
  editing: boolean
  light?: boolean
  onTitle: (id: string, v: string) => void
  onBody: (id: string, v: string[]) => void
  onHide: (id: string) => void
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

function StepNode({ data }: { data: { n: BoardNode; ed?: NodeEdit } }) {
  const { n, ed } = data
  const editing = !!ed?.editing
  return (
    <div className={`bnode tone-${n.tone ?? 'neutral'}${editing ? ' editing' : ''}`}>
      <Handle type="target" position={Position.Left} />
      {editing && (
        <button className="bn-x" title="Hide this card"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => ed?.onHide(n.id)}>{t('Hide')}</button>
      )}
      <EditableText className="bn-t" value={n.title} editing={editing}
        onSave={v => ed?.onTitle(n.id, v)} />
      {/* 착용 컷처럼 이미지가 붙는 노드는 사진이 먼저 보여야 한다 */}
      {n.imageUrl && !n.modelUrl && <img className="bn-img" src={n.imageUrl} alt="" loading="lazy" />}
      {/* 3D는 카드 안에서 바로 돌려 본다 */}
      {n.modelUrl && <ModelViewer url={n.modelUrl} poster={n.imageUrl} height={186} light={ed?.light} />}
      <EditableText className="bn-body" multiline editing={editing}
        value={n.body.join('\n')}
        onSave={v => ed?.onBody(n.id, v.split('\n').filter(x => x.trim()))} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function DesignFlowNode({ data }: { data: { n: BoardNode; st: RunState; onVerdict: any } }) {
  const { n, st, onVerdict } = data
  if (!n.design) return null
  return (
    <div style={{ width: 268 }}>
      <Handle type="target" position={Position.Left} />
      <DesignCard d={n.design} signals={st.signals} stagePassed={{ s3: true, s4: true }} onVerdict={onVerdict} />
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

function build(st: RunState, onVerdict: any, edits: BoardEdits, ed: NodeEdit): { nodes: Node[]; edges: Edge[] } {
  const model = buildBoardModel(st)
  const nodes: Node[] = []
  const hidden = new Set(edits.hidden)

  // 사용자가 고친 문구를 원본 위에 덧칠한다
  const apply = (n: BoardNode): BoardNode => ({
    ...n,
    title: edits.titles[n.id] ?? n.title,
    body: edits.bodies[n.id] ?? n.body,
  })

  // 컬럼 배경 · 단계 구분
  const allColumns = [...model.columns, ...edits.extraColumns]
  allColumns.forEach((c, i) => {
    const rows = Math.max(
      model.nodes.filter(n => n.column === i).length,
      edits.notes.filter(n => n.column === i).length,
    ) || 1
    nodes.push({
      id: `col-${c.key}`, type: 'column',
      position: { x: colX(i) - 24, y: -86 },
      data: { title: c.title, note: c.note, h: Math.max(rows * ROW_Y + 150, 360), w: (i === 4 ? 660 : 356) },
      selectable: false, draggable: false, zIndex: -1,
    })
  })

  // 치수와 핸들 위치를 명시한다 · DOM 측정을 기다리지 않고 연결선이 즉시 계산된다
  const visible = model.nodes.filter(n => !hidden.has(n.id)).map(apply)
  const noteNodes: BoardNode[] = edits.notes.filter(n => !hidden.has(n.id)).map(n => ({
    id: n.id, kind: 'selection', column: n.column, row: n.row,
    title: edits.titles[n.id] ?? n.title,
    body: edits.bodies[n.id] ?? n.body,
    tone: 'note' as any,
  }))
  ;[...visible, ...noteNodes].forEach(n => {
    const isDesign = n.kind === 'design' && !!n.design
    const w = isDesign ? 268 : (n as any).isPitch ? 300 : 312
    // 이미지가 붙는 노드는 사진 높이만큼 더 잡아야 연결선이 엉뚱한 데 붙지 않는다
    const h = isDesign ? 430 : 44 + n.body.length * 20 + (n.imageUrl ? 186 : 0) + (n.modelUrl ? 200 : 0)
    nodes.push({
      id: n.id,
      type: isDesign ? 'designFlow' : 'step',
      width: w, height: h,
      handles: [
        { type: 'target', position: Position.Left, x: 0, y: h / 2, width: 1, height: 1 },
        { type: 'source', position: Position.Right, x: w, y: h / 2, width: 1, height: 1 },
      ],
      data: isDesign ? { n, st, onVerdict } : { n, ed },
      position: edits.positions[n.id] ?? { x: colX(n.column), y: n.row * ROW_Y },
    })
  })

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

function BoardInner({ st, onVerdict, runId }: { st: RunState; onVerdict: any; runId: string }) {
  const [editing, setEditing] = useState(false)
  const [edits, setEdits] = useState<BoardEdits>(() => loadEdits(runId))
  useEffect(() => { saveEdits(runId, edits) }, [runId, edits])

  // 편집 콜백은 안정적이어야 한다. 매 렌더마다 새로 만들면 노드가 통째로 다시 그려진다.
  const [light, setLight] = useState(() => (localStorage.getItem('vringon.boardTheme') ?? 'light') === 'light')
  const ed = useMemo<NodeEdit>(() => ({
    editing,
    light,
    onTitle: (id, v) => setEdits(e => ({ ...e, titles: { ...e.titles, [id]: v } })),
    onBody: (id, v) => setEdits(e => ({ ...e, bodies: { ...e.bodies, [id]: v } })),
    onHide: (id) => setEdits(e => ({ ...e, hidden: [...new Set([...e.hidden, id])] })),
  }), [editing, light])

  const initial = useMemo(() => build(st, onVerdict, edits, ed), [st, onVerdict, edits, ed])
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

  useEffect(() => {
    setNodes(build(st, onVerdict, edits, ed).nodes.map(n =>
      positionsRef.current[n.id] ? { ...n, position: positionsRef.current[n.id] } : n))
  }, [st, onVerdict, edits, ed])

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

  // 메모 카드 · 빈 자리에 노란 카드를 하나 연다
  const addNote = useCallback(() => {
    const id = newNoteId()
    setEdits(e => {
      const col = Math.max(0, buildBoardModel(st).columns.length - 1)
      const row = e.notes.filter(n => n.column === col).length + 6
      return { ...e, notes: [...e.notes, { id, column: col, row, title: 'Note', body: ['Double-click to write'] }] }
    })
    setEditing(true)
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

  const exportMiro = useCallback(async () => {
    setMiro({ busy: true, msg: 'Converting board for Miro' })
    try {
      const model = buildBoardModel(st)
      const r = await fetch('/api/miro/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          meta: {
            name: `VRINGON review · ${st.params.category === 'shoe' ? 'footwear' : 'jewelry'} ${new Date().toISOString().slice(0, 10)}`,
            description: 'The reasoning from research through to selection',
          },
        }),
      })
      const j = await r.json()
      if (j.mode === 'created') {
        setMiro({ busy: false, msg: `Miro board created · ${j.created.frames} frames · ${j.created.items} cards · ${j.created.connectors} connections` })
        if (j.viewLink) window.open(j.viewLink, '_blank', 'noopener')
      } else if (j.plan) {
        const blob = new Blob([JSON.stringify(j.plan, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'miro-board-plan.json'
        a.click()
        URL.revokeObjectURL(a.href)
        setMiro({ busy: false, msg: `No Miro token, so the build plan was downloaded instead (${j.plan.counts.items} cards, ${j.plan.counts.connectors} connections)` })
      } else {
        setMiro({ busy: false, msg: j.error ?? 'Export failed' })
      }
    } catch (e) {
      setMiro({ busy: false, msg: String((e as Error).message) })
    }
  }, [st])

  const currentNode = present ? buildBoardModel(st).nodes.find(n => n.id === focusOrder[presentIdx]) : undefined
  const approved = st.designs.filter(d => d.verdict === 'approve').length
  const rejectedByUser = st.designs.filter(d => d.verdict === 'reject').length

  return (
    <div className={`board ${light ? 'board-light' : ''}`} data-theme={light ? 'light' : 'dark'}>
      <div className="boardbar">
        {!present ? (<>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{t('Review board')}</span>
          <span className="hint">{t('Input → Research → Signals → Directions → Designs → Picks')}</span>
          <span className="bar-sep" />
          <Tag kind="ok">{approved} approved</Tag>
          <Tag kind="danger">{rejectedByUser} rejected</Tag>
          <span className="bar-sep" />
          <button className="btn btn-ghost btn-sm" onClick={() => { setPresent(true); setPresentIdx(0) }}>{t('Present')}</button>
          {/* 확대·축소는 상단에서도 바로 되게 둔다. 우하단 패널에만 의존하지 않는다 */}
          <button className="btn btn-ghost btn-sm" onClick={() => rf.zoomOut({ duration: 200 })} title={t('Zoom out')}>{t('Zoom out')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => rf.zoomIn({ duration: 200 })} title={t('Zoom in')}>{t('Zoom in')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => rf.fitView({ duration: 400 })}>{t('Fit')}</button>
          <button className={`btn btn-sm ${showEdges ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setShowEdges(v => !v)} title={t('Show the lines between nodes')}>
            {t('Links')} {t(showEdges ? 'On' : 'Off')}
          </button>
          <span className="bar-sep" />
          <button className={`btn btn-sm ${editing ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setEditing(v => !v)}
            title="Double-click any card to rewrite it">
            {t('Edit')} {t(editing ? 'On' : 'Off')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={addNote} title={t('Drop a note card on the board')}>{t('Add note')}</button>
          <button className="btn btn-ghost btn-sm" onClick={addColumn} title={t('Open another lane on the right')}>{t('Add lane')}</button>
          {(edits.notes.length > 0 || edits.hidden.length > 0 || Object.keys(edits.titles).length > 0) && (
            <button className="btn btn-ghost btn-sm" onClick={resetEdits} title={t('Back to the generated board')}>{t('Reset edits')}</button>
          )}
          <ThemeToggle theme={light ? 'light' : 'dark'} onToggle={() => setLight(v => !v)} />
          <button className="btn btn-primary btn-sm" onClick={exportMiro} disabled={miro.busy}>
            {miro.busy ? t('Exporting') : t('Export to Miro')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>{t('Board PDF')}</button>
          {/* 리포트는 인쇄(=PDF 저장)와 파일 저장 두 가지로 낸다.
              인쇄 대화상자가 막힌 환경에서도 손에 남는 것이 있어야 한다. */}
          {st.trendReport && (
            <span className="btn-split">
              <button className="btn btn-ghost btn-sm" onClick={() => openTrendReportPdf(st)}>{t('Report PDF')}</button>
              <button className="btn btn-ghost btn-sm sq" title={t('Save as file')}
                onClick={() => saveTrendReportHtml(st)}>↓</button>
            </span>
          )}
          {st.dossier && (
            <span className="btn-split">
              <button className="btn btn-primary btn-sm" onClick={() => openDossierPdf(st)}>{t('Season dossier')}</button>
              <button className="btn btn-primary btn-sm sq" title={t('Save as file')}
                onClick={() => saveDossierHtml(st)}>↓</button>
            </span>
          )}
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
        /* 캔버스 어디를 잡아도 끌리게 둔다. 왼쪽·가운데·오른쪽 버튼 모두 팬으로 쓴다. */
        panOnDrag={[0, 1, 2]}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        panOnScroll={false}
        preventScrolling
        selectionOnDrag={false}
        proOptions={{ hideAttribution: true }}
        colorMode={light ? 'light' : 'dark'}
      >
        <Background color={light ? '#E3E7EC' : '#1C1C22'} gap={28} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable
          nodeColor={light ? '#D5DAE2' : '#2A2E35'}
          maskColor={light ? 'rgba(240,242,245,.72)' : 'rgba(10,10,12,.72)'}
          style={{
            background: light ? '#FFFFFF' : '#121216',
            border: `1px solid ${light ? '#E3E7EC' : '#23232A'}`, borderRadius: 8,
          }} />
      </ReactFlow>

      {present && showNotes && currentNode && (
        <div className="present-note">
          <b>{currentNode.title}</b>
          {currentNode.design
            ? currentNode.design.rationale.narrative.map((n, i) => <div key={i}>{n}</div>)
            : currentNode.body.map((b, i) => <div key={i}>{b}</div>)}
          {currentNode.design?.viewMismatch && (
            <div style={{ color: 'var(--warn)' }}>Details disagree between views on this one. The gap survived a regeneration and is left visible.</div>
          )}
          {currentNode.design && (
            <div style={{ color: 'var(--text-3)', marginTop: 4 }}>
              {TIER_LABEL[currentNode.design.spec.tier]} · {currentNode.design.rationale.type_placement_reason}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Board(props: { st: RunState; onVerdict: any; runId?: string }) {
  if (props.st.designs.length === 0 && props.st.signals.length === 0) {
    return <div className="empty" style={{ flex: 1 }}>
      <div>{t('Nothing on the board yet.')}<br /><span className="hint">{t('Run the agent and the flow from research to selection fills in.')}</span></div>
    </div>
  }
  return <ReactFlowProvider><BoardInner {...props} runId={props.runId ?? 'current'} /></ReactFlowProvider>
}
