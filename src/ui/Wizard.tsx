// ── 새 Run 위저드 · 신발 전용 ─────────────────────────────────────
// 한 화면에 결정 열 개를 늘어놓으면 어느 것도 주인공이 되지 못한다.
// 그래서 질문 세 개로 나눈다: 무엇을 · 어떻게 조사할지 · 어디까지.
//
// 신발은 조사 전에 라인부터 고정해야 한다 (지시서 2·3장): 같은 로퍼라도
// 합성피혁+시멘티드 10만원대와 굿이어+가죽솔 60만원대는 다른 시장이다.
// 그래서 1단계에 제품·용도와 빠른 프리셋, 2단계에 라스트·어퍼·바텀·공법의
// 전문가 설정과 시장·경쟁군·조사 목적이 들어간다.
import { uploadFiles } from '../core/uploads'
import { getLang, t } from '../core/i18n'
import { useEffect, useMemo, useState } from 'react'
import { detectRuntime } from '../core/runtime'
import type { Runtime } from '../core/runtime'
import {
  asFootwearLine, DEFAULT_PARAMS, firstTypeOf, groupOf, LINE_PRESETS, MODE_LABEL, MODE_SCOPE,
  OBJECTIVE_LABEL, TAXONOMY, TYPE_LABEL, UNKNOWN, defaultLineProfile, lineFingerprint,
  HOME_MARKETS, REFERENCE_MARKETS,
} from '../core/types'
import type { FootwearLineProfile, MarketId, Mode, ResearchObjective, RunParams, Stage } from '../core/types'
import { cumulative, estimate, SCOPE_COPY } from '../core/estimate'
import { Seg, Tag } from './bits'
import { ENGINES } from '../core/imageEngines'
import {
  GROUP_ICON, IcArrow, IcExternal, IcMoodboard, IcSeries, IcShoe, IcTrend,
} from './icons'

// 카드 안에서는 한 줄만 읽게 한다. 자세한 설명은 고른 뒤에 보여준다.
const MODE_SHORT: Record<Mode, string> = {
  trend: 'Research competitor lines and market trends',
  series: 'Carry on a series you already have',
  moodboard: 'Work only from a file you upload',
}
const MODE_ICON: Record<Mode, () => JSX.Element> = {
  trend: IcTrend, series: IcSeries, moodboard: IcMoodboard,
}

// 사용자 말로 쓴 범위 이름. S1~S5는 안쪽 사정이라 화면에 내보내지 않는다.
const SCOPE_NAME: Record<Stage, string> = {
  S1: 'Research only',
  S2: 'Through sketches',
  S3: 'Finished designs',
  S4: 'With campaign shots',
  S5: 'With a 3D showroom',
}

// 각 범위가 실제로 무엇을 내놓는지, 지난 Run에서 나온 결과물로 보여준다.
const BASE = import.meta.env.BASE_URL || '/'
const SCOPE_ART: Record<Stage, string | null> = {
  S1: null,
  S2: `${BASE}samples/7a28342791c4e3faaa6ab809.webp`,
  S3: `${BASE}samples/780ee2d38cb8913d406ef5ca.webp`,
  S4: `${BASE}samples/dc69e9e92eda584357e17437.webp`,
  S5: `${BASE}samples/21ec3965bb8961e7292d8fb6.webp`,
}

/** 리포트 미리보기 · S1은 이미지가 아니라 문서라서 문서처럼 그린다 */
function ReportThumb() {
  return (
    <svg className="sc-art" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="6" y="4" width="52" height="56" rx="3" className="rt-page" />
      <rect x="12" y="11" width="26" height="4" rx="2" className="rt-hd" />
      <rect x="12" y="20" width="40" height="2.4" rx="1.2" className="rt-ln" />
      <rect x="12" y="26" width="34" height="2.4" rx="1.2" className="rt-ln" />
      <rect x="12" y="32" width="38" height="2.4" rx="1.2" className="rt-ln" />
      <rect x="12" y="44" width="6" height="10" rx="1" className="rt-br" />
      <rect x="22" y="40" width="6" height="14" rx="1" className="rt-br" />
      <rect x="32" y="47" width="6" height="7" rx="1" className="rt-br" />
      <rect x="42" y="42" width="6" height="12" rx="1" className="rt-br" />
    </svg>
  )
}

/** 고른 카드에만 붙는 체크 배지 */
const Badge = () => (
  <span className="o-badge" aria-hidden="true">
    <svg viewBox="0 0 16 16"><path d="M3.6 8.3 6.5 11.2 12.4 5" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span>
)

const STEPS = [
  { n: 1, tab: 'What to create', ask: 'What are we making?' },
  { n: 2, tab: 'Line and research', ask: 'Define the line, then what to research' },
  { n: 3, tab: 'Results', ask: 'How far should we take it?' },
] as const

// Seg에 쓰는 'Not set' 표기 · unknown을 그대로 노출하면 오타처럼 보인다
const U_FMT = (v: string) => v === UNKNOWN ? 'Not set' : v.replace(/_/g, ' ')

const OBJECTIVES = Object.keys(OBJECTIVE_LABEL) as ResearchObjective[]

export default function Wizard({ onStart }: { onStart: (p: RunParams) => void }) {
  const [p, setP] = useState<RunParams>({ ...DEFAULT_PARAMS, line: defaultLineProfile() })
  const [step, setStep] = useState(1)
  const set = <K extends keyof RunParams>(k: K, v: RunParams[K]) => setP(prev => ({ ...prev, [k]: v }))
  const [rt, setRt] = useState<Runtime | null>(null)
  useEffect(() => { detectRuntime().then(setRt) }, [])
  const api = rt?.kind === 'live' ? { keyPresent: rt.keyPresent, cachedImages: rt.cachedImages } : null
  const isStatic = rt?.kind === 'static'
  const est = useMemo(() => estimate(p), [p])
  const cum = useMemo(() => cumulative(p), [p])
  const scope = MODE_SCOPE[p.mode]
  const [draft, setDraft] = useState('')
  const [more, setMore] = useState(false)
  const [lineOpen, setLineOpen] = useState(false)
  const [breakdown, setBreakdown] = useState(false)
  const setTrend = (patch: Partial<RunParams['trend']>) => setP(v => ({ ...v, trend: { ...v.trend, ...patch } }))
  const setSeries = (patch: Partial<RunParams['series']>) => setP(v => ({ ...v, series: { ...v.series, ...patch } }))
  const setMood = (patch: Partial<RunParams['moodboard']>) => setP(v => ({ ...v, moodboard: { ...v.moodboard, ...patch } }))

  // 업로드는 파일명만 담아 두면 아무 의미가 없다. 실제로 서버에 올려 두고 손잡이를 받는다.
  const [upBusy, setUpBusy] = useState(false)
  const [upError, setUpError] = useState<string | null>(null)
  const takeFiles = async (e: React.ChangeEvent<HTMLInputElement>, which: 'series' | 'moodboard') => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''            // 같은 파일을 다시 고를 수 있어야 한다
    if (!picked.length) return
    setUpBusy(true); setUpError(null)
    try {
      const { ok, failed } = await uploadFiles(picked)
      if (failed.length) setUpError(`${failed.length} file${failed.length > 1 ? 's' : ''} could not be read · ${failed[0]}`)
      if (ok.length) {
        if (which === 'series') {
          setP(v => ({ ...v, series: {
            ...v.series,
            archiveFiles: [...v.series.archiveFiles, ...ok.map(f => f.name)],
            uploads: [...(v.series.uploads ?? []), ...ok],
          } }))
        } else {
          setP(v => ({ ...v, moodboard: {
            ...v.moodboard,
            files: [...v.moodboard.files, ...ok.map(f => f.name)],
            uploads: [...(v.moodboard.uploads ?? []), ...ok],
          } }))
        }
      }
    } catch (err) {
      setUpError(String((err as Error).message).slice(0, 140))
    } finally {
      setUpBusy(false)
    }
  }
  const line = asFootwearLine(p.line) ?? defaultLineProfile()
  // 라인 프로필의 한 구역만 갈아 끼운다. 프리셋 채움과 개별 수정이 같은 경로를 쓴다.
  const setLine = <S extends keyof FootwearLineProfile>(section: S, patch: Partial<FootwearLineProfile[S]>) =>
    setP(v => {
      const lp = asFootwearLine(v.line) ?? defaultLineProfile()
      return { ...v, linePreset: undefined, line: { ...lp, [section]: { ...(lp[section] as object), ...patch } as FootwearLineProfile[S] } }
    })
  const applyPreset = (id: string) => {
    const pr = LINE_PRESETS.find(x => x.id === id)
    if (!pr) return
    setP(v => ({ ...v, itemType: pr.itemType, linePreset: id, line: pr.fill(asFootwearLine(v.line) ?? defaultLineProfile()) }))
  }
  const addCompetitor = (name?: string) => {
    const n = (name ?? draft).trim()
    if (!n) return
    setP(v => v.trend.competitors.includes(n) ? v
      : ({ ...v, trend: { ...v.trend, competitors: [...v.trend.competitors, n] } }))
    if (!name) setDraft('')
  }
  const toggleObjective = (o: ResearchObjective) => setTrend({
    objectives: (p.trend.objectives ?? []).includes(o)
      ? (p.trend.objectives ?? []).filter(x => x !== o)
      : [...(p.trend.objectives ?? []), o],
  })

  // 모드별 착수 조건 · 자료 없이 돌리면 결과를 설명할 수 없다
  const blocked = isStatic ? 'Live runs need the local server. Open the saved sample from History to see a finished run.'
    : p.mode === 'trend' ? (p.trend.competitors.length === 0 ? 'Add at least one competitor line'
      : (p.trend.objectives ?? []).length === 0 ? 'Pick at least one research objective' : null)
    : p.mode === 'series' ? (p.series.archiveFiles.length === 0 ? 'Upload your series designs'
      : !p.series.valueStatement.trim() ? 'Describe what the series stands for' : null)
    : (p.moodboard.files.length === 0 ? 'Upload a PDF' : null)
  // 2단계에서 막히는 조건은 2단계에서 알려야 한다
  const stepBlocked = step === 2 && !isStatic ? blocked : null

  const curGroup = groupOf('shoe', p.itemType)
  const [rc, rp] = p.tierRatio
  const rsum = p.tierRatio.reduce((a, b) => a + b, 0)
  const perTier = (r: number) => Math.round(p.sketchCount * r / rsum)
  // 컬러웨이는 별개 디자인이 아니라 같은 Design ID의 SKU다 (지시서 20장)
  const designCount = Math.max(1, Math.round(p.sketchCount * p.renderRatio))
  const designIds = designCount * (p.designsPerSketch ?? 2)
  const skuCount = designIds * (1 + p.colorwayCount)

  // 전문가 설정 요약 한 줄 · 접힌 상태에서도 무엇이 정해져 있는지 보인다
  const lineSummary = [
    line.lastFit.lastFamily !== UNKNOWN ? line.lastFit.lastFamily : null,
    line.upper.outer !== UNKNOWN ? line.upper.outer : null,
    line.bottom.outsole !== UNKNOWN ? line.bottom.outsole : null,
    line.construction.soleAttachment !== UNKNOWN ? line.construction.soleAttachment : null,
  ].filter(Boolean).join(' · ') || t('Nothing fixed yet — research will treat the line as open')

  return (
    <div className="wizard">
      <div className="wizard-inner">
        <div className="wcol">
          {isStatic && (
            <div className="staticnote">
              <div className="sn-body">
                <b>{t('This is a preview of the full demo.')}</b>
                <p>{t('Research and image generation run on a local Node server that is not part of this static build, so nothing is called from here. Everything a full run produced is saved: open History in the left rail to walk through the sample run, its board, the season dossier and the PDFs.')}</p>
                <a href="https://github.com/jhkim1543/vringon-design-agent#running-it-for-real" target="_blank" rel="noreferrer">
                  {t('Learn how it actually works')} <IcArrow />
                </a>
              </div>
              <span className="sn-art" aria-hidden="true" />
            </div>
          )}

          {/* 단계 표시 */}
          <nav className="steps" aria-label={t('Steps')}>
            {STEPS.map(s => (
              <button key={s.n} className={`stp ${step === s.n ? 'on' : ''} ${step > s.n ? 'done' : ''}`}
                onClick={() => setStep(s.n)}>
                <span className="stp-n">{s.n}</span>
                <span className="stp-t">{t(s.tab)}</span>
              </button>
            ))}
          </nav>

          <h1 className="ask">{t(STEPS[step - 1].ask)}</h1>

          {/* ── 1단계 · 무엇을 ──────────────────────────────────── */}
          {step === 1 && (<>
            <section className="sect">
              <h2>{t('Reference')}</h2>
              <div className="opts three">
                {(Object.keys(MODE_LABEL) as Mode[]).map(m => {
                  const Icon = MODE_ICON[m]
                  return (
                    <button key={m} className={`opt ${p.mode === m ? 'on' : ''}`} onClick={() => set('mode', m)}>
                      <span className="o-ic"><Icon /></span>
                      <span className="o-t">{t(MODE_LABEL[m])}</span>
                      <span className="o-d">{t(MODE_SHORT[m])}</span>
                      {p.mode === m && <Badge />}
                    </button>
                  )
                })}
              </div>
              <p className="note">{t('Pick where the design should start from. It decides what gets researched in the next step.')}</p>
            </section>

            <section className="sect">
              <h2>{t('Product family')}</h2>
              <div className="stack">
                <div className="famrow">
                  {TAXONOMY.shoe.map(g => {
                    const Icon = GROUP_ICON[g.id] ?? IcShoe
                    const on = curGroup?.id === g.id
                    return (
                      <button key={g.id} className={`fam ${on ? 'on' : ''}`}
                        onClick={() => set('itemType', firstTypeOf('shoe', g.id))}>
                        <span className="fam-ic"><Icon /></span>
                        <span className="fam-txt">
                          <span className="fam-t">{g.label}</span>
                          <span className="fam-n">{g.note}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="stack">
                <span className="lbl">{t('Archetype')}</span>
                <div className="chiprow">
                  {(curGroup?.types ?? []).map(ty => (
                    <button key={ty.id} className={`pick ${p.itemType === ty.id ? 'on' : ''}`}
                      onClick={() => set('itemType', ty.id)}>{ty.label}</button>
                  ))}
                </div>
              </div>

              <p className="note">
                {t('Archetypes are separate markets: a daily trainer, a max-cushion shoe and a carbon racer never sit in one competitive set.')}
              </p>
            </section>

            <section className="sect">
              <h2>{t('Quick presets')}</h2>
              <p className="note top">{t('A preset fills the line profile in one tap. It is a bundle of defaults, not a final classification — everything stays editable in step 2.')}</p>
              <div className="opts three tight presetgrid">
                {LINE_PRESETS.map(pr => (
                  <button key={pr.id} className={`opt ${p.linePreset === pr.id ? 'on' : ''}`}
                    onClick={() => applyPreset(pr.id)}>
                    <span className="o-t">{t(pr.label)}</span>
                    <span className="o-d">{pr.blurb}</span>
                    {p.linePreset === pr.id && <Badge />}
                  </button>
                ))}
              </div>
            </section>

            <section className="sect">
              <h2>{t('Product and use')}</h2>
              <div className="stack">
                <span className="lbl">{t('Use case')}</span>
                <div className="chiprow">
                  {(['daily', 'running', 'work', 'formal', 'outdoor', 'travel', 'occasion'] as const).map(u => (
                    <button key={u} className={`pick ${line.product.useCase === u ? 'on' : ''}`}
                      onClick={() => setLine('product', { useCase: u })}>{u}</button>
                  ))}
                </div>
              </div>
              <div className="stack">
                <span className="lbl">{t('Environment')}</span>
                <div className="chiprow">
                  {(['urban', 'indoor', 'trail', 'court', 'wet_climate', 'all'] as const).map(u => (
                    <button key={u} className={`pick ${line.product.environment === u ? 'on' : ''}`}
                      onClick={() => setLine('product', { environment: u })}>{u.replace('_', ' ')}</button>
                  ))}
                </div>
              </div>
              <div className="stack">
                <span className="lbl">{t('Target consumer')}</span>
                <div className="inrow">
                  <Seg options={['women', 'men', 'unisex', 'kids'] as const} value={line.product.targetConsumer}
                    onChange={v => setLine('product', { targetConsumer: v })} />
                  <span className="hint">{t('A marketing split. The actual fit lives in the last and fit programme.')}</span>
                </div>
              </div>
              <div className="stack">
                <span className="lbl">{t('Season')}</span>
                <div className="inrow">
                  <Seg options={['FW26', 'SS27', 'carryover'] as const} value={line.product.season as any}
                    onChange={v => setLine('product', { season: v })} />
                  <span className="lbl sub">{t('Climate')}</span>
                  <Seg options={['all_season', 'hot_humid', 'cold_dry', 'rainy'] as const} value={line.product.climate as any}
                    onChange={v => setLine('product', { climate: v as typeof line.product.climate })} format={U_FMT} />
                </div>
              </div>
            </section>
          </>)}

          {/* ── 2단계 · 라인 정의와 조사 ──────────────────────────── */}
          {step === 2 && (<>
            {/* 라인 정의 · 경쟁 브랜드 입력보다 위에 있어야 한다 (지시서 3장) */}
            <section className="sect">
              <h2>{t('Line definition')}</h2>
              <p className="note top">{t('The same loafer at four price points is four different markets. What you fix here drives the competitor set, the search terms, the signals and the reports.')}</p>
              <button className="moretoggle" onClick={() => setLineOpen(v => !v)}>
                {lineOpen ? t('Hide the line programme') : t('Last, upper, bottom and construction')}
                <span className="mt-sum">{lineSummary}</span>
              </button>
              {lineOpen && (<div className="morebox">
                {/* ── 라스트·핏 · 신발에서 가장 중요한 사전 설정 ── */}
                <div className="stack"><span className="lbl">{t('Last family')}</span>
                  <div className="inrow">
                    <input className="input" style={{ maxWidth: 300 }} placeholder={t('e.g. performance running, medium volume — or leave unknown')}
                      value={line.lastFit.lastFamily === UNKNOWN ? '' : line.lastFit.lastFamily}
                      onChange={e => setLine('lastFit', { lastFamily: e.target.value.trim() || UNKNOWN })} />
                    <Seg options={['reuse', 'new'] as const} value={line.lastFit.existingLastReuse ? 'reuse' : 'new'}
                      onChange={v => setLine('lastFit', { existingLastReuse: v === 'reuse' })} />
                    <span className="hint">{t('Reuse an existing last, or open a new one')}</span>
                  </div>
                </div>
                <div className="stack"><span className="lbl">{t('Toe shape')}</span>
                  <div className="inrow">
                    <Seg options={[UNKNOWN, 'round', 'almond', 'square', 'pointed'] as const} value={line.lastFit.toeShape}
                      onChange={v => setLine('lastFit', { toeShape: v })} format={U_FMT} />
                    <span className="lbl sub">{t('Toe volume')}</span>
                    <Seg options={[UNKNOWN, 'low', 'medium', 'high'] as const} value={line.lastFit.toeVolume}
                      onChange={v => setLine('lastFit', { toeVolume: v })} format={U_FMT} />
                  </div>
                </div>
                <div className="stack"><span className="lbl">{t('Fit programme')}</span>
                  <div className="inrow">
                    <input className="input" style={{ maxWidth: 120 }} placeholder={t('Base size')}
                      value={line.lastFit.baseSize === UNKNOWN ? '' : line.lastFit.baseSize}
                      onChange={e => setLine('lastFit', { baseSize: e.target.value.trim() || UNKNOWN })} />
                    <input className="input" style={{ maxWidth: 110 }} placeholder={t('Width, e.g. D, 2E')}
                      value={line.lastFit.width === UNKNOWN ? '' : line.lastFit.width}
                      onChange={e => setLine('lastFit', { width: e.target.value.trim() || UNKNOWN })} />
                    <span className="lbl sub">{t('Heel hold')}</span>
                    <Seg options={[UNKNOWN, 'relaxed', 'standard', 'secure'] as const} value={line.lastFit.heelHold}
                      onChange={v => setLine('lastFit', { heelHold: v })} format={U_FMT} />
                  </div>
                  <p className="note">{t('No numbers yet is fine — unknown is honest. Last dimensions are never decided from product photos.')}</p>
                </div>
                {/* ── 어퍼 프로그램 ── */}
                <div className="stack"><span className="lbl">{t('Upper')}</span>
                  <div className="inrow">
                    <input className="input" style={{ maxWidth: 220 }} placeholder={t('Outer, e.g. engineered mesh / full-grain calf')}
                      value={line.upper.outer === UNKNOWN ? '' : line.upper.outer}
                      onChange={e => setLine('upper', { outer: e.target.value.trim() || UNKNOWN })} />
                    <input className="input" style={{ maxWidth: 180 }} placeholder={t('Lining')}
                      value={line.upper.lining === UNKNOWN ? '' : line.upper.lining}
                      onChange={e => setLine('upper', { lining: e.target.value.trim() || UNKNOWN })} />
                    <span className="lbl sub">{t('Reinforcement')}</span>
                    <Seg options={[UNKNOWN, 'none', 'light', 'structured'] as const} value={line.upper.reinforcement}
                      onChange={v => setLine('upper', { reinforcement: v })} format={U_FMT} />
                  </div>
                </div>
                <div className="stack"><span className="lbl">{t('Closure')}</span>
                  <div className="inrow">
                    <div className="chiprow">
                      {([UNKNOWN, 'lace', 'slip_on', 'buckle', 'strap', 'zip', 'elastic_gore', 'dial'] as const).map(c => (
                        <button key={c} className={`pick ${line.upper.closure === c ? 'on' : ''}`}
                          onClick={() => setLine('upper', { closure: c })}>{U_FMT(c)}</button>
                      ))}
                    </div>
                    <span className="lbl sub">{t('Protection')}</span>
                    <Seg options={[UNKNOWN, 'none', 'water_resistant', 'waterproof_membrane'] as const} value={line.upper.protection}
                      onChange={v => setLine('upper', { protection: v })} format={v => v === UNKNOWN ? 'Not set' : v === 'waterproof_membrane' ? 'membrane' : v.replace('_', ' ')} />
                  </div>
                </div>
                {/* ── 바텀 유닛·솔 프로그램 ── */}
                <div className="stack"><span className="lbl">{t('Bottom unit')}</span>
                  <div className="inrow">
                    <input className="input" style={{ maxWidth: 220 }} placeholder={t('Midsole, e.g. supercritical foam / EVA')}
                      value={line.bottom.midsole === UNKNOWN ? '' : line.bottom.midsole}
                      onChange={e => setLine('bottom', { midsole: e.target.value.trim() || UNKNOWN })} />
                    <input className="input" style={{ maxWidth: 220 }} placeholder={t('Outsole, e.g. segmented rubber / leather')}
                      value={line.bottom.outsole === UNKNOWN ? '' : line.bottom.outsole}
                      onChange={e => setLine('bottom', { outsole: e.target.value.trim() || UNKNOWN })} />
                    <Seg options={['reuse', 'new'] as const} value={line.bottom.existingBottomReuse ? 'reuse' : 'new'}
                      onChange={v => setLine('bottom', { existingBottomReuse: v === 'reuse' })} />
                    <span className="hint">{t('Existing mould, or new tooling')}</span>
                  </div>
                </div>
                <div className="stack"><span className="lbl">{t('Geometry')}</span>
                  <div className="inrow">
                    <span className="lbl sub">{t('Stack')}</span>
                    <Seg options={[UNKNOWN, 'low', 'mid', 'high'] as const} value={line.bottom.stackBand}
                      onChange={v => setLine('bottom', { stackBand: v })} format={U_FMT} />
                    <span className="lbl sub">{t('Rocker')}</span>
                    <Seg options={[UNKNOWN, 'none', 'mild', 'moderate', 'aggressive'] as const} value={line.bottom.rocker}
                      onChange={v => setLine('bottom', { rocker: v })} format={U_FMT} />
                    <input className="input" style={{ maxWidth: 110 }} placeholder={t('Drop mm')}
                      value={line.bottom.dropMm === UNKNOWN ? '' : line.bottom.dropMm}
                      onChange={e => setLine('bottom', { dropMm: e.target.value.trim() || UNKNOWN })} />
                  </div>
                </div>
                <div className="stack"><span className="lbl">{t('Plate and heel')}</span>
                  <div className="inrow">
                    <Seg options={[UNKNOWN, 'none', 'nylon', 'tpu', 'carbon'] as const} value={line.bottom.plate}
                      onChange={v => setLine('bottom', { plate: v })} format={U_FMT} />
                    <span className="lbl sub">{t('Heel')}</span>
                    <Seg options={[UNKNOWN, 'none', 'stacked', 'block', 'wedge', 'stiletto', 'kitten'] as const} value={line.bottom.heel}
                      onChange={v => setLine('bottom', { heel: v })} format={U_FMT} />
                  </div>
                </div>
                {/* ── 제조 공법 · 가격과 경쟁군을 나누는 핵심 축 ── */}
                <div className="stack"><span className="lbl">{t('Construction')}</span>
                  <div className="inrow">
                    <span className="lbl sub">{t('Lasting')}</span>
                    <Seg options={[UNKNOWN, 'strobel', 'board', 'moccasin'] as const} value={line.construction.lasting}
                      onChange={v => setLine('construction', { lasting: v })} format={U_FMT} />
                  </div>
                  <div className="chiprow">
                    {([UNKNOWN, 'cemented', 'vulcanized', 'cupsole', 'blake', 'goodyear', 'direct_injection', 'handsewn'] as const).map(c => (
                      <button key={c} className={`pick ${line.construction.soleAttachment === c ? 'on' : ''}`}
                        onClick={() => setLine('construction', { soleAttachment: c })}>{U_FMT(c)}</button>
                    ))}
                  </div>
                  <p className="note">{t('Same look, different construction: different cost, flexibility, repairability, MOQ and lead time.')}</p>
                </div>
                {/* ── 성능 목표 ── */}
                <div className="stack"><span className="lbl">{t('Performance')}</span>
                  <div className="inrow">
                    <span className="lbl sub">{t('Cushioning')}</span>
                    <Seg options={[UNKNOWN, 'firm', 'moderate', 'high', 'max'] as const} value={line.performance.cushioning}
                      onChange={v => setLine('performance', { cushioning: v })} format={U_FMT} />
                    <span className="lbl sub">{t('Wet grip')}</span>
                    <Seg options={[UNKNOWN, 'not_required', 'preferred', 'required'] as const} value={line.performance.wetGrip}
                      onChange={v => setLine('performance', { wetGrip: v })} format={U_FMT} />
                  </div>
                  <div className="inrow">
                    <input className="input" style={{ maxWidth: 220 }} placeholder={t('Weight target, e.g. 240-285g (US M9)')}
                      value={line.performance.weightTargetG === UNKNOWN ? '' : line.performance.weightTargetG}
                      onChange={e => setLine('performance', { weightTargetG: e.target.value.trim() || UNKNOWN })} />
                    <span className="hint">{t('Stated at a base size, never as a bare number')}</span>
                  </div>
                </div>
              </div>)}
            </section>

            {p.mode === 'trend' && (<>
              <section className="sect">
                <h2>{t('Competitor lines')}</h2>
                <p className="note top">{t('Name the line, not just the brand: "Nike Performance Running" and "Nike Lifestyle" are different competitive sets. Products that do not match the profile are kept as references, never silently dropped.')}</p>
                <div className="chiplist">
                  {p.trend.competitors.map(c => (
                    <span className="chip-in" key={c}>
                      {c}
                      <button onClick={() => setP(v => ({ ...v, trend: { ...v.trend, competitors: v.trend.competitors.filter(x => x !== c) } }))} aria-label={`Remove ${c}`}>{t('Remove')}</button>
                    </span>
                  ))}
                </div>
                <div className="inrow">
                  <input className="input" style={{ maxWidth: 280 }} placeholder={t('Brand or brand line')}
                    value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCompetitor() }} />
                  <button className="btn btn-ghost btn-sm" onClick={() => addCompetitor()}>{t('Add')}</button>
                </div>
                <div className="chiplist quick">
                  <span className="hint">{t('Quick add')}</span>
                  {(groupOf('shoe', p.itemType)?.id === 'sneaker'
                    ? ['ASICS', 'Nike Running', 'HOKA', 'New Balance', 'adidas', 'On Running', 'Salomon']
                    : groupOf('shoe', p.itemType)?.id === 'boot'
                      ? ['Dr. Martens', 'Timberland', 'Clarks', 'Blundstone']
                      : ['Clarks', 'ECCO', 'Camper', 'Dr. Martens', 'Birkenstock']
                  ).filter(b => !p.trend.competitors.includes(b)).map(b => (
                    <button key={b} className="pick" onClick={() => addCompetitor(b)}>{b}</button>
                  ))}
                </div>
              </section>

              <section className="sect">
                <h2>{t('Where it sits in the market')}</h2>
                {/* 시장은 조사 언어와 다른 축이다. 언어는 결과를 무슨 말로 쓸지,
                    시장은 누구네 매대를 볼지를 정한다. 그래서 여기(경쟁·가격 옆)에 두고,
                    3단계의 리포트 언어와는 떼어 놓는다. */}
                <div className="stack">
                  <span className="lbl">{t('Home market')}</span>
                  <div className="inrow">
                    <Seg options={HOME_MARKETS.map(m => m.id) as unknown as readonly MarketId[]}
                      value={line.commercial.homeMarket ?? 'KR'}
                      onChange={v => setLine('commercial', { homeMarket: v })} />
                    <span className="hint">{t('Where you sell. Retail pages, list prices and the search language all follow this.')}</span>
                  </div>
                </div>
                <div className="stack">
                  <span className="lbl">{t('Reference markets')}</span>
                  <div className="chiprow">
                    {REFERENCE_MARKETS.filter(m => m.id !== (line.commercial.homeMarket ?? 'KR')).map(m => {
                      const on = (line.commercial.referenceMarkets ?? []).includes(m.id)
                      return (
                        <button key={m.id} className={`pick ${on ? 'on' : ''}`}
                          onClick={() => {
                            const cur = line.commercial.referenceMarkets ?? []
                            setLine('commercial', {
                              referenceMarkets: on ? cur.filter(x => x !== m.id) : [...cur, m.id].slice(-2),
                            })
                          }}>{t(m.label)}</button>
                      )
                    })}
                  </div>
                  <span className="hint">{t('Markets you watch because they run ahead of yours. Up to two. They do not set your price band.')}</span>
                </div>
                <div className="stack">
                  <span className="lbl">{t('Tier')}</span>
                  <Seg options={['mass', 'contemporary', 'premium', 'luxury'] as const} value={p.trend.priceBand}
                    onChange={v => setTrend({ priceBand: v })} />
                </div>
                <div className="stack">
                  <span className="lbl">{t('Primary band')}</span>
                  <div className="inrow">
                    <input className="input" style={{ maxWidth: 110 }} type="number" value={p.trend.priceMinKrw}
                      onChange={e => setTrend({ priceMinKrw: Number(e.target.value) })} />
                    <span className="hint">~</span>
                    <input className="input" style={{ maxWidth: 110 }} type="number" value={p.trend.priceMaxKrw}
                      onChange={e => setTrend({ priceMaxKrw: Number(e.target.value) })} />
                    <span className="hint">{t('KRW. Direct comparison stays inside this band and the same construction tier.')}</span>
                  </div>
                </div>
                <div className="stack">
                  <span className="lbl">{t('Adjacent band')}</span>
                  <div className="inrow">
                    <Seg options={['On', 'Off'] as const} value={p.trend.adjacentBand ? 'On' : 'Off'}
                      onChange={v => setTrend({ adjacentBand: v === 'On' })} />
                    <span className="hint">{t('Also look one tier up and down, kept as references rather than direct competitors')}</span>
                  </div>
                </div>
                <p className="note">{t(scope.note)}</p>
              </section>

              <section className="sect">
                <h2>{t('Research objectives')}</h2>
                <div className="chiprow">
                  {OBJECTIVES.map(o => (
                    <button key={o} className={`pick ${(p.trend.objectives ?? []).includes(o) ? 'on' : ''}`}
                      onClick={() => toggleObjective(o)}>{t(OBJECTIVE_LABEL[o])}</button>
                  ))}
                </div>
                <p className="note">{t('Every result gets filtered through the line profile above — a macro trend only survives if it translates to this product.')}</p>
              </section>
            </>)}

            {p.mode === 'series' && (<>
              <section className="sect">
                <h2>{t('Your series')}</h2>
                <div className="stack">
                  <span className="lbl">{t('Name')}</span>
                  <input className="input" style={{ maxWidth: 260 }} placeholder="e.g. Arc line"
                    value={p.series.seriesName} onChange={e => setSeries({ seriesName: e.target.value })} />
                </div>
                <label className="dropzone">
                  <input type="file" multiple accept="image/png,image/jpeg,image/webp" hidden
                    onChange={e => void takeFiles(e, 'series')} />
                  {upBusy ? t('Uploading…') : t('Upload past designs from this series')}
                  <span className="dz-sub">{t('8 or more, so the constants can be told apart')}</span>
                </label>
                {upError && <p className="note" style={{ color: 'var(--danger)' }}>{upError}</p>}
                {p.series.archiveFiles.length > 0 && (
                  <div className="chiplist quick">
                    {p.series.archiveFiles.slice(0, 6).map((f, i) => <span className="chip-in" key={i}>{f}</span>)}
                    {p.series.archiveFiles.length > 6 && <span className="hint">+{p.series.archiveFiles.length - 6} more</span>}
                  </div>
                )}
                <div className="chiplist quick">
                  <Tag kind={p.series.archiveFiles.length >= 8 ? 'ok' : 'warn'}>
                    {p.series.archiveFiles.length} files · {p.series.archiveFiles.length >= 8 ? 'enough to separate constants' : 'need 8 or more'}
                  </Tag>
                </div>
                <p className="note">{t('Locked DNA: last silhouette, toe shape, sole sidewall, icon overlays. Flexible: colour blocking, materials, lining, hardware.')}</p>
              </section>
              <section className="sect">
                <h2>{t('What it stands for')}</h2>
                <textarea className="input" rows={3} style={{ width: '100%', resize: 'vertical' }}
                  placeholder={t('What this series has kept, and what you want to change this season')}
                  value={p.series.valueStatement} onChange={e => setSeries({ valueStatement: e.target.value })} />
                <div className="stack">
                  <span className="lbl">{t('Trends')}</span>
                  <Seg options={['On', 'Off'] as const} value={p.series.trendSearch ? 'On' : 'Off'}
                    onChange={v => setSeries({ trendSearch: v === 'On' })} />
                </div>
                <p className="note">{t('The only outside research in this mode')}</p>
              </section>
            </>)}

            {p.mode === 'moodboard' && (
              <section className="sect">
                <h2>{t('Your file')}</h2>
                <label className="dropzone">
                  <input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" hidden
                    onChange={e => void takeFiles(e, 'moodboard')} />
                  {upBusy ? t('Uploading…') : t('Upload your trend report or moodboard PDF')}
                  <span className="dz-sub">{t('Nothing outside these files is used')}</span>
                </label>
                {upError && <p className="note" style={{ color: 'var(--danger)' }}>{upError}</p>}
                {p.moodboard.files.length > 0 && (
                  <div className="chiplist quick">
                    {p.moodboard.files.map((f, i) => (
                      <span className="chip-in" key={i}>{f}
                        <button onClick={() => setMood({
                          files: p.moodboard.files.filter((_, j) => j !== i),
                          uploads: (p.moodboard.uploads ?? []).filter((_, j) => j !== i),
                        })} aria-label={t('Remove')}>{t('Remove')}</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="stack">
                  <span className="lbl">{t('Notes')}</span>
                  <textarea className="input" rows={2} style={{ width: '100%', resize: 'vertical' }}
                    placeholder={t('Anything specific to look for')}
                    value={p.moodboard.notes} onChange={e => setMood({ notes: e.target.value })} />
                </div>
                <p className="note">{t('Moodboard findings never claim market growth or sales — they translate what repeats in your file into footwear grammar: massing to sole sidewalls, split lines to panels, repeats to tread.')}</p>
              </section>
            )}
          </>)}

          {/* ── 3단계 · 어디까지 ────────────────────────────────── */}
          {step === 3 && (<>
            <section className="sect">
              <h2>{t('Stop after')}</h2>
              <div className="scopegrid">
                {cum.map(s => {
                  const st = s.stage as Stage
                  const art = SCOPE_ART[st]
                  const on = p.endStage === st
                  return (
                    <button key={st} className={`scopecard ${on ? 'on' : ''}`} onClick={() => set('endStage', st)}>
                      {/* 넷 합쳐 57KB다. lazy로 미루면 이득 없이 빈 칸만 잠깐 보인다. */}
                      <span className="sc-thumb">{art ? <img src={art} alt="" /> : <ReportThumb />}</span>
                      <span className="sc-txt">
                        <span className="sc-n">{t(SCOPE_NAME[st])}</span>
                        <span className="sc-g">{t(SCOPE_COPY[st].gets)}</span>
                      </span>
                      <span className="sc-m">{s.minutes}m · ${s.usd.toFixed(2)}</span>
                      {on && <Badge />}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="sect">
              <h2>{t('How many')}</h2>
              <div className="stack">
                <span className="lbl">{t('Structure candidates')}</span>
                <div className="inrow">
                  <Seg options={[6, 12, 18, 24] as const} value={p.sketchCount} onChange={v => set('sketchCount', v)} />
                  <span className="hint">{t('Core')} {perTier(rc)} · {t('Push')} {perTier(rp)} · {t('Signature')} {p.sketchCount - perTier(rc) - perTier(rp)}</span>
                </div>
                <p className="note">{t('Core reuses the last and bottom unit. Push keeps one of the two. Signature may open new tooling.')}</p>
              </div>
              <div className="stack">
                <span className="lbl">{t('Designs per sketch')}</span>
                <div className="inrow">
                  <Seg options={[1, 2, 3, 4] as const} value={p.designsPerSketch ?? 2} onChange={v => set('designsPerSketch', v)} />
                  <span className="hint">{designIds} {t('Design IDs in total, each from a trend-based prompt')}</span>
                </div>
              </div>
              <div className="stack">
                <span className="lbl">{t('Top picks')}</span>
                <div className="inrow">
                  <Seg options={[1, 2, 3, 4, 5] as const} value={p.topN as any} onChange={v => set('topN', Number(v))} />
                  <span className="hint">{t('At least one from each tier')}</span>
                </div>
              </div>
              {/* 조사 결과를 어느 말로 쓸지. 화면 언어와 따로 고른다 —
                  한국어 화면으로 보면서 영문 리포트를 뽑는 경우가 실제로 있다. */}
              <div className="stack"><span className="lbl">{t('Report language')}</span>
                <div className="inrow">
                  <Seg options={['ko', 'ja', 'en'] as const}
                    value={p.researchLang ?? getLang()}
                    onChange={v => set('researchLang', v)}
                    format={v => v === 'ko' ? '한국어' : v === 'ja' ? '日本語' : 'English'} />
                  <span className="hint">{t('Research, signals and both PDFs come out in this language.')}</span>
                </div>
              </div>
              <label className="checkline">
                <input type="checkbox" checked={p.approvalGate} onChange={e => set('approvalGate', e.target.checked)} />
                {t('Show me the sketches before rendering')}
              </label>
            </section>

            <button className="moretoggle" onClick={() => setMore(v => !v)}>
              {more ? t('Hide advanced settings') : t('Advanced settings')}
              <span className="mt-sum">{`${p.tierRatio.join(':')} · ${Math.round(p.renderRatio * 100)}% · ${p.viewCount} views · ${p.campaignShots} cuts · ${ENGINES[p.imageEngine].label}`}</span>
            </button>

            {more && (<div className="morebox">
              <div className="stack"><span className="lbl">{t('Mix')}</span>
                <div className="inrow">
                  <Seg options={['1:1:1', '2:1:1', '1:2:1', '2:2:1'] as const}
                    value={p.tierRatio.join(':') as any}
                    onChange={v => set('tierRatio', String(v).split(':').map(Number) as [number, number, number])} />
                  <span className="hint">{t('Core : Push : Signature')}</span>
                </div>
              </div>
              <div className="stack"><span className="lbl">{t('To render')}</span>
                <div className="inrow">
                  <Seg options={[0.25, 0.5, 0.75] as const} value={p.renderRatio} onChange={v => set('renderRatio', v)} format={v => `${Number(v) * 100}%`} />
                  <span className="hint">{designCount} {t('move on')}</span>
                </div>
              </div>
              <div className="stack"><span className="lbl">{t('Views')}</span>
                <div className="inrow">
                  <Seg options={[1, 3, 4] as const} value={p.viewCount} onChange={v => set('viewCount', v)} />
                  <span className="lbl sub">{t('Colorways')}</span>
                  <Seg options={[0, 1, 2, 3] as const} value={p.colorwayCount} onChange={v => set('colorwayCount', v)} />
                  <span className="hint">{t('Colourways are SKUs of one Design ID, never counted as separate designs')}</span>
                </div>
              </div>
              <div className="stack"><span className="lbl">{t('Variations')}</span>
                <div className="inrow">
                  <Seg options={[0, 2, 3, 4, 6, 8] as const} value={p.variationCount} onChange={v => set('variationCount', v)} />
                  <span className="hint">{t('Branches off one sketch, one axis changed each')}</span>
                </div>
              </div>
              <div className="stack"><span className="lbl">{t('Campaign cuts')}</span>
                <div className="inrow">
                  <Seg options={[0, 2, 4, 6] as const} value={p.campaignShots} onChange={v => set('campaignShots', v)} />
                  <span className="hint">{t('Per selected design. Half worn on a model, half staged.')}</span>
                </div>
              </div>
              <div className="stack"><span className="lbl">{t('3D showroom')}</span>
                <div className="inrow">
                  <Seg options={['Off', 'On'] as const} value={p.make3d ? 'On' : 'Off'} onChange={v => set('make3d', v === 'On')} />
                  <span className="hint">{t('Final picks only. Turn it on the board, download it for CAD.')}</span>
                </div>
              </div>
              <div className="stack"><span className="lbl">{t('Model')}</span>
                <div className="opts two tight">
                  {(['fast', 'detail'] as const).map(id => (
                    <button key={id} className={`opt ${p.imageEngine === id ? 'on' : ''}`}
                      onClick={() => set('imageEngine', id)}>
                      <span className="o-t">{ENGINES[id].label}</span>
                      <span className="o-d">{ENGINES[id].blurb}</span>
                      <span className="o-m">${ENGINES[id].usdPerImage.toFixed(3)} · {ENGINES[id].secPerImage}s each</span>
                      {p.imageEngine === id && <Badge />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="stack"><span className="lbl">{t('Image cap')}</span>
                <div className="inrow">
                  <Seg options={[0, 6, 12, 24, 48] as const} value={p.imageBudget}
                    onChange={v => set('imageBudget', v)}
                    format={v => v === 0 ? 'None' : `${v}`} />
                  <span className="hint">
                    {api && !api.keyPresent
                      ? t('No image server. Diagrams only.')
                      : p.imageBudget === 0
                        ? t('Spec diagrams only')
                        : `${t('Anything past the cap falls back to a diagram')}${api?.cachedImages ? ` · ${api.cachedImages} ${t('reusable')}` : ''}`}
                  </span>
                </div>
              </div>
            </div>)}
          </>)}

          {/* 강한 CTA는 화면에 하나뿐이다 */}
          <div className="wizbar">
            <button className="btn btn-ghost" onClick={() => step === 1 ? setP({ ...DEFAULT_PARAMS, line: defaultLineProfile() }) : setStep(step - 1)}>
              {step === 1 ? t('Reset') : t('Back')}
            </button>
            <div className="wb-msg">{stepBlocked && t(stepBlocked)}</div>
            {step < 3
              ? <button className="btn btn-primary" disabled={!!stepBlocked} onClick={() => setStep(step + 1)}>
                  {t('Continue')} <IcArrow />
                </button>
              : <button className="btn btn-primary" disabled={!!blocked} onClick={() => onStart(p)}>
                  {t('Start the run')} <IcArrow />
                </button>}
          </div>
          {step === 3 && blocked && <div className="blockmsg">{t(blocked)}</div>}
        </div>

        {/* 오른쪽은 요약이다. 결정하는 자리가 아니다. */}
        <aside className="summary">
          <div className="sumcard">
            <h3>{t('Project summary')}</h3>
            <div className="sm-brief">
              <b>{t(TYPE_LABEL[p.itemType])}</b>
              <span>{t(MODE_LABEL[p.mode])} · {t(SCOPE_NAME[p.endStage])}</span>
              <span className="hint" style={{ display: 'block', marginTop: 4 }}>{lineFingerprint(p.line, p.itemType)}</span>
            </div>
            <div className="sm-stats">
              <div><span className="v">{p.endStage === 'S1' ? '—' : designIds}</span><span className="k">{t('Design IDs')}</span></div>
              <div><span className="v">{p.endStage === 'S1' ? '—' : skuCount}</span><span className="k">{t('SKUs')}</span></div>
              <div><span className="v">{est.totalMinutes}<i>m</i></span><span className="k">{t('Estimated time')}</span></div>
              <div><span className="v">${est.totalUsd.toFixed(2)}</span><span className="k">{t('Estimated cost')}</span></div>
            </div>
            <button className="btn btn-ghost btn-sm sm-more" onClick={() => setBreakdown(v => !v)}>
              {breakdown ? t('Hide details') : t('View details')} <IcExternal />
            </button>
            {breakdown && (
              <table className="sm-table">
                <tbody>
                  {est.perStage.map(s => {
                    const order = ['S1', 'S2', 'S3', 'S4', 'S5']
                    const active = order.indexOf(s.stage) <= order.indexOf(p.endStage)
                    return (
                      <tr key={s.stage} className={active ? '' : 'dim'}>
                        <td>{t(s.label)}</td>
                        {/* 상한에 걸리면 "만들 수 있는 수 / 원한 수"로 보여야 오해가 없다 */}
                        <td>{s.images > 0 ? (s.real < s.images ? `${s.real} of ${s.images}` : `${s.images} imgs`) : ''}</td>
                        <td>{Math.max(1, Math.round(s.minutes))}m · ${s.usd.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
