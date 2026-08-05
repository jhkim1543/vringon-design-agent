// ── VRINGON Design Agent · 앱 셸 ─────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PipelineEvent, RunParams, RunState, Stage } from './core/types'
import { runPipeline } from './core/pipeline'
import type { PipelineHandle } from './core/pipeline'
import Wizard from './ui/Wizard'
import RunView from './ui/RunView'
import Board from './ui/Board'
import { ThemeToggle, VringonLogo } from './ui/bits'
import BrandSetup from './ui/BrandSetup'
import { loadBrand, saveBrand, isBrandConfigured } from './core/brand'
import type { BrandIdentity } from './core/brand'
import { useTheme } from './ui/useTheme'
import Library from './ui/Library'
import ErrorBoundary from './ui/ErrorBoundary'
import { clearCurrent, firstImage, loadCurrent, newRunId, saveCurrent, saveRun } from './core/store'
import type { RunRecord } from './core/store'
import { CAT_LABEL, MODE_LABEL, TYPE_LABEL } from './core/types'
import { ensureSampleRuns } from './core/sampleRun'

type View = 'create' | 'run' | 'board' | 'library' | 'starred'

function freshState(params: RunParams): RunState {
  return {
    params,
    stageStatus: { S1: 'idle', S2: 'idle', S3: 'idle', S4: 'idle', S5: 'idle' },
    logs: [], signals: [], competitors: [], directions: [],
    seriesDna: null, dnaConflict: null, reportBias: null,
    trendReport: null, reportPending: false,
    dossier: null, dossierPending: false,
    designs: [], checkpoints: [], finished: false,
  }
}

export default function App() {
  const [view, setView] = useState<View>('create')
  const [st, setSt] = useState<RunState | null>(null)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [gated, setGated] = useState(false)
  const [usage, setUsage] = useState({ images: 0, searches: 0 })
  const handleRef = useRef<PipelineHandle | null>(null)
  const { theme, setTheme } = useTheme()
  const [brand, setBrand] = useState<BrandIdentity>(() => loadBrand())
  const [brandOpen, setBrandOpen] = useState(false)
  const [brandGate, setBrandGate] = useState<RunParams | null>(null)
  const runIdRef = useRef<string>(newRunId())

  // 예시 Run을 한 번 심어 둔다. 처음 열어도 결과가 어떻게 나오는지 볼 수 있게.
  useEffect(() => { ensureSampleRuns() }, [])

  // 새로고침이나 렌더 오류로 화면이 날아가도 진행 결과를 되살린다
  useEffect(() => {
    const prev = loadCurrent()
    if (prev && prev.state.designs.length) {
      runIdRef.current = prev.id
      setSt(prev.state)
    }
  }, [])

  const onEvent = useCallback((e: PipelineEvent) => {
    setSt(prev => {
      if (!prev) return prev
      const next = { ...prev }
      switch (e.kind) {
        case 'log': next.logs = [...next.logs, { stage: e.stage, text: e.text, t: Date.now() }]; break
        case 'stage-start': next.stageStatus = { ...next.stageStatus, [e.stage]: 'running' }; break
        case 'stage-done': next.stageStatus = { ...next.stageStatus, [e.stage]: 'done' }; break
        case 'signals': next.signals = e.signals; break
        case 'competitors': next.competitors = e.items; break
        case 'directions': next.directions = e.items; break
        case 'series-dna': next.seriesDna = e.dna; break
        case 'dna-conflict': next.dnaConflict = { brandClaim: e.brandClaim, observed: e.observed }; break
        case 'report-bias': next.reportBias = e.bias; break
        case 'trend-report': next.trendReport = e.report; next.reportPending = false; break
        case 'report-pending': next.reportPending = e.on; break
        case 'dossier': next.dossier = e.dossier; next.dossierPending = false; break
        case 'dossier-pending': next.dossierPending = e.on; break
        case 'design': next.designs = [...next.designs, e.design]; break
        case 'design-update':
          next.designs = next.designs.map(d => d.spec.design_id === e.design.spec.design_id ? e.design : d); break
        case 'checkpoint': next.checkpoints = [...next.checkpoints, e.label]; break
        case 'done': next.finished = true; break
      }
      return next
    })
    if (e.kind === 'progress') setProgress(p => ({ ...p, [e.stage]: e.pct }))
    // 사용량 집계 · 로그 문구에서 실제 발생한 호출만 센다
    if (e.kind === 'log') {
      if (/sketch done|render done/.test(e.text)) setUsage(u => ({ ...u, images: u.images + 1 }))
      const m = e.text.match(/(\d+) web searches/)
      if (m) setUsage(u => ({ ...u, searches: u.searches + Number(m[1]) }))
    }
    if (e.kind === 'gate') {
      setGated(true)
      setSt(prev => prev ? { ...prev, stageStatus: { ...prev.stageStatus, [e.stage]: 'gated' as const } } : prev)
    }
    if (e.kind === 'stage-start') setProgress(p => ({ ...p, [e.stage]: 0 }))
  }, [])

  // 진행 중 상태를 계속 남긴다. 저장 실패가 실행을 막지 않도록 store에서 삼킨다.
  useEffect(() => {
    if (!st) return
    saveCurrent(runIdRef.current, st)
    if (st.finished) {
      saveRun({
        id: runIdRef.current, savedAt: Date.now(), favorite: false,
        title: `${TYPE_LABEL[st.params.itemType] ?? st.params.itemType} · ${MODE_LABEL[st.params.mode]}`,
        thumb: firstImage(st), state: st,
      })
    }
  }, [st])

  const start = useCallback((params: RunParams) => {
    handleRef.current?.cancel()
    runIdRef.current = newRunId()
    clearCurrent()
    setSt(freshState(params))
    setProgress({})
    setGated(false)
    setView('run')
    handleRef.current = runPipeline({ ...params, brand }, onEvent, 1.6)
  }, [onEvent, brand])

  const resume = useCallback(() => {
    setGated(false)
    setSt(prev => prev ? { ...prev, stageStatus: { ...prev.stageStatus, S2: 'done' } } : prev)
    handleRef.current?.resume()
  }, [])

  const onResolveDna = useCallback((choice: string) => {
    setSt(prev => prev && prev.dnaConflict ? {
      ...prev,
      dnaConflict: { ...prev.dnaConflict, resolved: choice },
      logs: [...prev.logs, { stage: 'S1', text: `Conflict resolved: going with "${choice}" · recorded in the reasoning chain`, t: Date.now() }],
    } : prev)
  }, [])

  const onVerdict = useCallback((id: string, v: 'approve' | 'reject', tags: string[]) => {
    setSt(prev => {
      if (!prev) return prev
      return {
        ...prev,
        designs: prev.designs.map(d => d.spec.design_id === id ? { ...d, verdict: v, verdictTags: tags } : d),
        logs: [...prev.logs, { stage: 'FB', text: `${id} ${v === 'approve' ? 'approved' : 'rejected (' + tags.join(', ') + ')'} · added to the reference bank, kept per ${prev.params.category} and ${prev.params.mode}`, t: Date.now() }],
      }
    })
  }, [])

  return (
    <ErrorBoundary onReset={() => setView('create')}>
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <VringonLogo />
          VRINGON
          <span className="module">Design Agent</span>
        </div>
        <nav className="topnav">
          <button className={view === 'create' ? 'on' : ''} onClick={() => setView('create')}>Create</button>
          <button className={view === 'run' ? 'on' : ''} onClick={() => st && setView('run')} disabled={!st} style={!st ? { opacity: .4 } : undefined}>Run</button>
          <button className={view === 'board' ? 'on' : ''} onClick={() => st && setView('board')} disabled={!st} style={!st ? { opacity: .4 } : undefined}>Board</button>
        </nav>
        <div className="right">
          <button className={`btn btn-sm ${isBrandConfigured(brand) ? 'btn-ghost' : 'btn-primary'}`}
            onClick={() => setBrandOpen(true)}
            title="Logo and brand rules ride along with every result">
            {isBrandConfigured(brand) ? brand.brandName : 'Set up brand'}
          </button>
          <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          <div className="avatar">J</div>
        </div>
      </div>
      <div className="main">
        <aside className="siderail">
          <nav>
            <button className={`sr-i ${view === 'create' ? 'on' : ''}`} onClick={() => setView('create')}>Run setup</button>
            <button className={`sr-i ${view === 'library' ? 'on' : ''}`} onClick={() => setView('library')}>History</button>
            <button className={`sr-i ${view === 'starred' ? 'on' : ''}`} onClick={() => setView('starred')}>Starred</button>
          </nav>
          <div className="sr-foot">
            <div className="sr-label">This session</div>
            <div className="sr-usage">
              <b>{usage.images}</b> images · <b>{usage.searches}</b> searches
            </div>
            <div className="sr-bar"><div style={{ width: `${Math.min(100, usage.images * 3)}%` }} /></div>
          </div>
        </aside>
        {view === 'create' && (
          <Wizard onStart={p => {
            if (!isBrandConfigured(brand)) { setBrandGate(p); return }
            start(p)
          }} />
        )}
        {(view === 'library' || view === 'starred') && (
          <Library filter={view === 'starred' ? 'favorite' : 'all'} onOpen={(rec, target) => {
            handleRef.current?.cancel()
            runIdRef.current = rec.id
            setSt(rec.state)
            setGated(false)
            setView(target)
          }} />
        )}
        {view === 'run' && st && (
          <RunView st={st} progress={progress} gated={gated}
            onResume={resume} onGateVerdict={onVerdict} onOpenBoard={() => setView('board')}
            onResolveDna={onResolveDna} />
        )}
        {view === 'board' && st && <Board st={st} onVerdict={onVerdict} runId={runIdRef.current} />}
        {(view === 'run' || view === 'board') && !st && <div className="empty">No run open. Start one from Run setup.</div>}
      </div>
      {brandOpen && (
        <BrandSetup brand={brand} onClose={() => setBrandOpen(false)}
          onSave={b => { setBrand(b); saveBrand(b) }} />
      )}

      {brandGate && (
        <div className="modal-back" onClick={() => setBrandGate(null)}>
          <div className="modal gate" onClick={e => e.stopPropagation()}>
            <div className="modal-h">
              <div>
                <h2>Set up your brand first</h2>
                <p className="hint">
                  Whatever the agent decides, the result still has to look like your brand.
                  The logo placement, signature details and the things you never do get attached to every image.
                  Setting this once takes a minute and it applies to all runs.
                </p>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost btn-sm"
                onClick={() => { const p = brandGate; setBrandGate(null); if (p) start(p) }}>
                Run without it
              </button>
              <button className="btn btn-primary" style={{ marginLeft: 'auto' }}
                onClick={() => { setBrandGate(null); setBrandOpen(true) }}>
                Set up brand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  )
}
