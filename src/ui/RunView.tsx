// ── Run 실행 화면 · 핵심만 노출, 상세는 접힘 (진행 · 부분 결과 · 게이트) ──
import { t } from '../core/i18n'
import { useEffect, useRef, useState } from 'react'
import type { RunState } from '../core/types'
import { COMP_GROUP_LABEL, MODE_LABEL, TIER_LABEL, TYPE_LABEL , isSketchView } from '../core/types'
import RunReport from './RunReport'
import { DesignCard } from './Card'
import { ModelViewer } from './ModelViewer'
import { Collapse, Tag } from './bits'
import { shotUrl } from '../core/research'
import { plainProse, proseBlocks } from '../core/prose'
import type { TrendReport } from '../core/research'
import { openTrendReportPdf } from '../core/reportPdf'
import { openDossierPdf } from '../core/dossierPdf'
import type { SeasonDossier } from '../core/research'
import { GRADE_LABEL, SOURCE_LABEL, metricText } from '../core/research'

// 순위 표기의 의미 · 노출 위치를 판매 순위처럼 읽지 않게 라벨을 단다 (지시서 12.1)
const RANK_SEM: Record<string, string> = {
  verified_sales_rank: 'sales rank',
  retailer_bestseller_membership: 'retailer bestseller',
  surface_position: 'page position',
  marketplace_trade_rank: 'resale rank',
}

/** 수집 사진 · 직링크가 죽으면 다음 후보, 다 죽으면 페이지 og:image 폴백까지 시도한다.
 *  이미지 URL이 하나도 없어도 상품 페이지가 있으면 페이지에서 대표 사진을 찾는다. */
function CompShot({ urls, page, alt, frozen }: { urls: string[]; page?: string; alt: string; frozen?: boolean }) {
  const [i, setI] = useState(0)
  const list = urls.length ? urls : (page ? [''] : [])
  if (!list.length || i >= list.length) return <span className="cc-noshot">{t('No photo')}</span>
  const src = shotUrl(list[i], page, frozen)
  // 굳은 샘플에서 로컬 경로가 아니면 그 사진은 존재하지 않는다. 죽을 요청을 보내지 않는다.
  if (!src) return <span className="cc-noshot">{t('No photo')}</span>
  return <img src={src} alt={alt} loading="lazy" onError={() => setI(v => v + 1)} />
}

const STAGE_META: { key: 'S1' | 'S2' | 'S3' | 'S4' | 'S5'; t: string; d: string }[] = [
  { key: 'S1', t: 'Research', d: 'Signals and directions' },
  { key: 'S2', t: 'Sketch', d: 'Specs, rules, rationale' },
  { key: 'S3', t: 'Design', d: 'Renders and views' },
  { key: 'S4', t: 'Selection', d: 'MD review, final gate, campaign shots' },
  { key: 'S5', t: '3D showroom', d: 'One GLB per pick' },
]

export default function RunView({ st, progress, gated, onResume, onGateVerdict, onOpenBoard, onResolveDna, dnaGate, onApproveDna, onToggleDna }: {
  st: RunState
  progress: Record<string, number>
  gated: boolean
  onResume: () => void
  onGateVerdict: (id: string, v: 'approve' | 'reject', tags: string[]) => void
  onOpenBoard: () => void
  onResolveDna: (choice: string) => void
  /** 시리즈 DNA 승인 대기 · 사진에서 읽은 불변 요소는 사람이 확인해야 스펙을 잠근다 (규칙 16).
   *  checked 는 App 이 들고 있다 — 보드에 갔다 와도 체크가 남아야 한다. */
  dnaGate?: { invariant: import('../core/types').SeriesDnaElement[]; of: number; checked: Record<string, boolean> } | null
  onApproveDna?: (labels: string[]) => void
  onToggleDna?: (key: string, v: boolean) => void
}) {
  const [showLog, setShowLog] = useState(false)
  // 디자인 상세 모달 · 캠페인 컷과 3D 를 연다
  const [detail, setDetail] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (showLog) logRef.current?.scrollTo({ top: 1e9 }) }, [st.logs.length, showLog])

  const approvedCount = st.designs.filter(d => d.verdict === 'approve').length
  const rejectedCount = st.designs.filter(d => d.verdict === 'reject').length
  const lastCheckpoint = st.checkpoints[st.checkpoints.length - 1]

  // 접힘 패널 요약 문구 · 실수집이면 근거 강도 기준으로 요약
  const inBand = st.competitors.filter(c => c.in_band)
  const isLiveResearch = st.competitors.some(c => (c.source_urls?.length ?? 0) > 0)
  const strongCnt = st.competitors.filter(c => c.evidence_strength === 'strong').length
  const compSummary = st.competitors.length
    ? isLiveResearch
      ? `${st.competitors.length} products · ${inBand.length} in band · ${strongCnt} strong`
      : `${st.competitors.length} products (sample)`
    : ''
  const rising = st.signals.filter(s => s.direction === 'rising').length
  const sigSummary = st.signals.length ? `${st.signals.length} signals · ${rising} rising` : ''

  // 아래 세 블록은 리포트 섹션 안으로 들어간다 (예전에는 화면 맨 밑에 따로 있었다)
  const competitorDetail = st.competitors.length > 0 && (
          <Collapse title={t('Collected products')} summary={compSummary}>
            <div style={{ padding: '8px 14px 0' }}>
              {isLiveResearch ? (
                <div className="notice info" style={{ fontSize: 12 }}>
                  Collected by searching these brands on the web. Only facts found in sources are listed. No sales score until there are repeat observations.
                </div>
              ) : (
                <div className="notice warn" style={{ fontSize: 12 }}>
                  Fixed sample (collection fell back). Do not treat as real numbers.
                </div>
              )}
            </div>
            <div className="compgrid">
              {st.competitors.map(c => (
                <div className={`compcard ${c.in_band ? '' : 'out'}`} key={c.product_id}>
                  <div className="cc-shot">
                    <CompShot urls={c.image_urls ?? []} page={c.product_url} alt={c.name} frozen={!!st.sample} />
                  </div>
                  <div className="cc-main">
                    <div className="cc-head">
                      <b>{c.brand}</b> {c.name}
                      {c.retailer && <Tag kind="accent">{c.retailer}</Tag>}
                      {c.competitor_group && c.competitor_group !== 'direct' &&
                        <Tag kind={c.retailer ? 'ok' : 'warn'}>{COMP_GROUP_LABEL[c.competitor_group]}</Tag>}
                      {c.competitor_group === 'direct' && <Tag kind="ok">{COMP_GROUP_LABEL.direct}</Tag>}
                      {!c.in_band && <Tag kind="warn">{t('Out of band')}</Tag>}
                    </div>
                    {/* 미확인 값은 줄에서 뺀다 · unknown이 나열되면 바이어 톤이 무너진다 (Gemini QA) */}
                    <div className="cc-meta">
                      {[
                        c.price_krw > 0 ? `₩${(c.price_krw / 10000).toFixed(1)}0,000` : null,
                        c.construction_tier && c.construction_tier !== 'unknown'
                          ? plainProse(c.construction_tier).slice(0, 90) : null,
                        c.evidence_strength && c.evidence_strength !== 'none' ? c.evidence_strength : null,
                      ].filter(Boolean).join(' · ') || 'confirmed on the product page only'}
                      {c.rank_note && <> · <span className="cc-rank">{c.rank_note}</span>
                        {c.rank_semantics && c.rank_semantics !== 'none' && <span className="hint"> ({RANK_SEM[c.rank_semantics]})</span>}</>}
                    </div>
                    {(c.offered_sizes && c.available_sizes != null) || (c.size_status && c.size_status !== 'unknown') || (c.colorway_count ?? 0) > 1 ? (
                      <div className="cc-meta">
                        {c.offered_sizes && c.available_sizes != null ? `sizes ${c.available_sizes} of ${c.offered_sizes} in stock` : ''}
                        {c.size_status && c.size_status !== 'unknown' && (
                          <> · <Tag kind={c.size_status === 'size_broken' || c.size_status === 'sold_out' ? 'warn' : 'ok'}>
                            {c.size_status.replace('_', ' ')}
                          </Tag></>
                        )}
                        {typeof c.colorway_count === 'number' && c.colorway_count > 1 && <> · {c.colorway_count} colourways, one design</>}
                      </div>
                    ) : null}
                    {c.proxy_signals[0] && <div className="cc-ev">{c.proxy_signals[0]}</div>}
                    {c.design_traits?.length ? (
                      <div className="cc-traits">
                        {c.design_traits.slice(0, 3).map((t, i) => <Tag key={i}>{t}</Tag>)}
                      </div>
                    ) : null}
                    {(c.praise_points?.length || c.complaint_points?.length) ? (
                      <div className="cc-review">
                        {c.user_sentiment && c.user_sentiment !== 'unknown' && (
                          <Tag kind={c.user_sentiment === 'positive' ? 'ok' : c.user_sentiment === 'negative' ? 'danger' : 'warn'}>
                            {c.user_sentiment === 'positive' ? 'liked' : c.user_sentiment === 'negative' ? 'disliked' : 'mixed'}
                          </Tag>
                        )}
                        {c.praise_points?.[0] && <div className="cc-good">+ {c.praise_points[0]}</div>}
                        {c.complaint_points?.[0] && <div className="cc-bad">− {c.complaint_points[0]}</div>}
                      </div>
                    ) : null}
                    <div className="cc-links">
                      {c.product_url && <a href={c.product_url} target="_blank" rel="noreferrer">{t('Product')}</a>}
                      {(c.source_urls ?? []).slice(0, 2).map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer">{t('Source')} {i + 1}</a>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Collapse>
        )
  // 아래 세 블록은 리포트 섹션 안으로 들어간다 (예전에는 화면 맨 밑에 따로 있었다)
  const dossierDetail = (st.dossier || st.dossierPending) && (
          <Collapse
            title={t('Forecast evidence')}
            summary={st.dossier
              ? `${(st.dossier as SeasonDossier).macrotrends?.length ?? 0} macrotrends · ${(st.dossier as SeasonDossier).sources?.length ?? 0} sources`
              : 'Building'}
            defaultOpen={!!st.dossier}>
            {st.dossierPending && !st.dossier ? (
              <div style={{ padding: '14px 16px' }} className="hint">
                Mapping the macrotrends first, then filling each one with palettes, materials, details and key items.
              </div>
            ) : st.dossier ? (() => {
              const d = st.dossier as SeasonDossier
              const pct = metricText
              return (
                <div className="dossier">
                  <div className="ds-head">
                    <div>
                      <h4>{d.season} · {d.season_title}</h4>
                      {d.powershift && <div className="ds-power">Powershift: {d.powershift}</div>}
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => openDossierPdf(st)}>{t('Dossier PDF')}</button>
                  </div>
                  {(d.macrotrends ?? []).map((m, i) => (
                    <div className="ds-macro" key={m.name + i}>
                      <div className="ds-m-h">
                        <span className="ds-num">{i + 1}</span>
                        <b>{m.name}</b>
                        <Tag kind="accent">{GRADE_LABEL[m.grade] ?? m.grade}</Tag>
                      </div>
                      <div className="ds-state">{m.statement}</div>
                      <div className="chiplist">
                        {(m.sub_trends ?? []).map(t => <span className="chip-in" key={t}>{t}</span>)}
                      </div>
                      <div className="ds-metrics">
                        {(m.drivers ?? []).map((x, k) => (
                          <span key={x.label + k} className="ds-met">
                            <b>{pct(x)}</b> {x.label}
                            <span className="hint"> · {SOURCE_LABEL[x.source_kind] ?? x.source_kind}</span>
                          </span>
                        ))}
                      </div>
                      {(m.palette ?? []).length > 0 && (
                        <div className="ds-pal">
                          {m.palette.map(c => (
                            <span className="ds-sw" key={c.hex + c.name} title={`${c.name} ${c.pantone_tcx}`}>
                              <i style={{ background: c.hex }} />{c.name}
                            </span>
                          ))}
                        </div>
                      )}
                      {(m.materials ?? []).length > 0 && (
                        <div className="ds-metrics">
                          {m.materials.map((x, k) => (
                            <span key={x.label + k} className="ds-met sm">
                              <b>{pct(x)}</b> {x.label}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="ds-items">
                        {(m.key_items ?? []).map((k, j) => (
                          <div className="ds-item" key={k.name + j}>
                            <div className="ds-i-h">
                              <b>{k.name}</b>
                              <span className="ds-i-p">{k.metric ? pct(k.metric) : '—'}</span>
                              <span className="hint">{k.segment}</span>
                            </div>
                            <div className="hint">{k.silhouette_spec}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(d.yearly_context ?? []).length > 0 && (
                    <div className="ds-years">
                      <div className="ds-sub">{t('How the last few seasons moved')}</div>
                      {d.yearly_context.map((y, i) => (
                        <div className="ds-year" key={y.season + i}>
                          <b>{y.season}</b>
                          <span>{y.headline}
                            {y.source_url && <a className="ds-link" href={y.source_url} target="_blank" rel="noreferrer">{t('source')}</a>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })() : null}
          </Collapse>
        )
  // 아래 세 블록은 리포트 섹션 안으로 들어간다 (예전에는 화면 맨 밑에 따로 있었다)
  const reportDetail = (st.trendReport || st.reportPending) && (
          <Collapse
            title={t('Report text')}
            summary={st.trendReport
              ? `${(st.trendReport as TrendReport).design_implications?.length ?? 0} design implications`
              : 'Writing'}
            defaultOpen={!!st.trendReport}>
            {st.reportPending && !st.trendReport ? (
              <div style={{ padding: '14px 16px' }} className="hint">
                Breaking it into sub-questions and pulling them together. It lands here when done.
              </div>
            ) : st.trendReport ? (() => {
              const rep = st.trendReport as TrendReport
              return (
                <div className="treport">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <h4 style={{ flex: 1, minWidth: 0 }}>{rep.title}</h4>
                    {/* 리포트만 따로 뽑아 갈 수 있어야 한다 */}
                    <button className="btn btn-ghost btn-sm" onClick={() => openTrendReportPdf(st)}>{t('Report PDF')}</button>
                  </div>
                  <div className="tr-exec">{plainProse(rep.executive_view)}</div>
                  {rep.design_implications?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 700, marginBottom: 4 }}>
                        What to change in the design
                      </div>
                      {rep.design_implications.map((d, i) => (
                        <div className="tr-imp" key={i}>
                          <span className="tr-area">{d.area}</span>
                          <span>
                            {d.guidance}
                            <div className="tr-basis">From: {d.basis}</div>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 마크다운 기호를 화면에 그대로 내보내지 않는다 · 헤딩은 스타일로, 기호는 제거 */}
                  <div className="tr-body">
                    {proseBlocks(rep.body_markdown).map((b, i) =>
                      b.kind === 'h'
                        ? <h5 key={i} style={{ margin: '10px 0 4px', fontSize: 12.5, color: 'var(--accent-hi)' }}>{b.text}</h5>
                        : <p key={i} style={{ margin: '0 0 8px' }}>{b.text}</p>)}
                  </div>
                  {rep.open_questions?.length > 0 && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 700, marginBottom: 4 }}>
                        Still unverified
                      </div>
                      {rep.open_questions.map((q, i) => <div key={i}>· {q}</div>)}
                    </div>
                  )}
                </div>
              )
            })() : null}
          </Collapse>
        )

  // 분석이 끝나면 왼쪽은 진행표시가 아니라 목차가 된다.
  // 오른쪽 리포트의 섹션 id 로 스크롤한다.
  const TOC: { id: string; label: string; on: boolean }[] = [
    { id: 'sec-report', label: 'Trend report', on: !!st.trendReport },
    { id: 'sec-macros', label: 'Key macro trends', on: !!(st.dossier as { macrotrends?: unknown[] } | null)?.macrotrends?.length },
    { id: 'sec-designs', label: 'Top trending designs', on: st.designs.length > 0 },
    { id: 'sec-pulse', label: 'Selling now', on: st.competitors.some(c => c.retailer && c.image_urls?.length) },
    { id: 'sec-rivals', label: 'Competitor products', on: st.competitors.some(c => !c.retailer && c.image_urls?.length) },
    { id: 'sec-shots', label: 'Campaign gallery', on: st.designs.some(d => d.images.some(i => ['wear', 'concept', 'variation'].includes(i.view))) },
    { id: 'sec-comp', label: 'Competitive landscape', on: st.competitors.length > 0 },
    { id: 'sec-season', label: 'Season report', on: !!st.dossier },
    { id: 'sec-impl', label: 'Design implications', on: !!st.dossier || st.signals.length > 0 },
  ].filter(x => x.on)
  // scrollIntoView 의 smooth 는 탭이 백그라운드면 멈춘다. 컨테이너를 직접 굴린다.
  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const box = el.closest('.run-center') as HTMLElement | null
    if (!box) { el.scrollIntoView(); return }
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 12
    box.scrollTo({ top, behavior: 'smooth' })
    // smooth 가 무시되는 환경 대비 · 한 프레임 뒤에 위치를 못 잡았으면 즉시 이동
    setTimeout(() => { if (Math.abs(box.scrollTop - top) > 400) box.scrollTop = top }, 350)
  }

  return (
    <div className="run">
      {/* 좌: 단계 네비 */}
      <div className="run-left">
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{MODE_LABEL[st.params.mode]}</div>
          <div className="hint">{TYPE_LABEL[st.params.itemType]} · {st.params.sketchCount} sketches · through {st.params.endStage}</div>
        </div>
        {st.finished && TOC.length > 0 ? (
          <nav className="toc">
            <div className="toc-h">{t('Contents')}</div>
            {TOC.map(x => (
              <button key={x.id} className="toc-i" onClick={() => jump(x.id)}>{t(x.label)}</button>
            ))}
          </nav>
        ) : (
        <div className="stageline">
          {STAGE_META.map(s => {
            const status = st.stageStatus[s.key]
            return (
              <div key={s.key} className={`stage-item ${status}`}>
                <div className="dot" />
                <div style={{ flex: 1 }}>
                  <div className="t">{t(s.t)}</div>
                  <div className="d">{t(s.d)}</div>
                  {status === 'running' && progress[s.key] != null && (
                    <div className="progressbar"><div style={{ width: `${progress[s.key]}%` }} /></div>
                  )}
                  {status === 'gated' && <Tag kind="warn">{t('Waiting')}</Tag>}
                </div>
              </div>
            )
          })}
        </div>
        )}
        {lastCheckpoint && (
          <div className="hint" style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            💾 {lastCheckpoint}
          </div>
        )}
        {st.finished && (
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={onOpenBoard}>
            Open board
          </button>
        )}
      </div>

      {/* 중앙: 핵심 결과 */}
      <div className="run-center">
        {/* 리포트가 맨 위 · 무엇이 나왔는지부터 보이고, 근거는 아래 접힘 패널에 그대로 남는다 */}
        {(st.dossier || st.trendReport || st.designs.length > 0) && (
          <RunReport st={st} onOpenBoard={onOpenBoard}
            competitorDetail={competitorDetail} dossierDetail={dossierDetail} reportDetail={reportDetail} />
        )}
        {gated && (
          <div className="gatebar">
            <span style={{ fontWeight: 700 }}>{t('Review gate')}</span>
            <span className="hint">{t('Approve or reject on the cards. Rejected picks are dropped before campaign shots and 3D, and the reasons are summarised on this board.')}</span>
            <span style={{ marginLeft: 'auto' }} className="hint">{approvedCount} approved · {rejectedCount} rejected</span>
            <button className="btn btn-primary btn-sm" onClick={onResume}>{t('Continue')}</button>
          </div>
        )}

        {/* 시리즈 DNA 승인 · 사진에서 읽은 것은 가설이고, 잠그는 것은 사람이다.
            여기서 잘못 승인하면 그 오독이 이 Run 의 모든 안을 구속한다. */}
        {dnaGate && onApproveDna && (
          <div className="notice warn" style={{ marginBottom: 14, flexDirection: 'column', gap: 10 }}>
            <div>
              <b>{t('These read as fixed across your uploads. Confirm before they lock every spec.')}</b>{' '}
              {t('Uncheck anything the photos got wrong — a misread here would constrain every design in this run.')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dnaGate.invariant.map((e, i) => (
                <label key={`${i}|${e.label}`} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={dnaGate.checked[`${i}|${e.label}`] ?? true}
                    onChange={ev => onToggleDna?.(`${i}|${e.label}`, ev.target.checked)} />
                  <span><b>{e.label}</b> · {e.observed_in}/{dnaGate.of} {t('designs')}{e.note ? ` · ${e.note}` : ''}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary btn-sm"
                onClick={() => onApproveDna(dnaGate.invariant.filter((e, i) => dnaGate.checked[`${i}|${e.label}`] ?? true).map(e => e.label))}>
                {t('Lock the checked elements and continue')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => onApproveDna([])}>
                {t('Lock nothing — treat all as variable')}
              </button>
            </div>
          </div>
        )}
        {st.dnaConflict && !st.dnaConflict.resolved && (
          <div className="notice warn" style={{ marginBottom: 14, flexDirection: 'column' }}>
            <div>
              <b>{t('Your description and what we observed disagree.')}</b> {st.dnaConflict.brandClaim} vs {st.dnaConflict.observed}. {t('Pick which one leads.')}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => onResolveDna('description')}>{t('Follow the description')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onResolveDna('archive')}>{t('Follow the archive')}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onResolveDna('shift')}>{t('Shift toward the description')}</button>
            </div>
          </div>
        )}
        {st.dnaConflict?.resolved && (
          <div className="notice info" style={{ marginBottom: 14 }}>
            Using <b>{st.dnaConflict.resolved}</b> as the reference. The choice is recorded in the rationale.
          </div>
        )}

        {/* S1 상세 · 접힘. 요약 한 줄이 곧 논리 구조의 각 단계 */}






        {st.seriesDna && (
          <Collapse title={t('Series DNA')}
            summary={`${st.seriesDna.invariant.length} fixed (locked) · ${st.seriesDna.variable.length} variable · ${st.seriesDna.ambiguous.length} unclear`}
            defaultOpen={!st.dnaConflict?.resolved}>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
              {st.seriesDna.invariant.map(e => (
                <div key={e.element}>
                  <Tag kind="accent">{t('Locked')}</Tag> <b>{e.label}</b>
                  <span className="hint"> seen in {e.observed_in}/{e.of} · {e.confidence} · must_inherit</span>
                </div>
              ))}
              {st.seriesDna.variable.map(e => (
                <div key={e.element}><Tag>{t('Variable')}</Tag> {e.label} <span className="hint">{e.variation_range?.join(' / ')}</span></div>
              ))}
              {st.seriesDna.ambiguous.map(e => (
                <div key={e.element}><Tag kind="warn">{t('Unclear')}</Tag> {e.label} <span className="hint">{t('seen as')} [{e.observed?.join(', ')}] · {e.note}</span></div>
              ))}
            </div>
          </Collapse>
        )}

        {st.reportBias && (
          <Collapse title={t('Source bias')} summary={`${st.reportBias.publisher} · ${st.reportBias.perspective}`}>
            <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--text-2)' }}>
              {st.reportBias.notes.map((n, i) => <div key={i}>· {n}</div>)}
            </div>
          </Collapse>
        )}

        {st.signals.length > 0 && (
          <Collapse title={t('Signals')} summary={sigSummary}>
            <table className="mini">
              <thead><tr><th>{t('Signal')}</th><th>{t('Axis')}</th><th>{t('Seen')}</th><th>{t('Trend')}</th><th title={t('Commercial / Cultural / Forecast / Feasibility')}>{t('Indices')}</th><th>{t('Tooling')}</th><th>{t('Source')}</th></tr></thead>
              <tbody>
                {st.signals.map(s => {
                  const idx = s.indices
                  const iTxt = idx && (idx.commercial || idx.cultural || idx.forecast || idx.feasibility)
                    ? `${(idx.commercial ?? '–')[0].toUpperCase()} / ${(idx.cultural ?? '–')[0].toUpperCase()} / ${(idx.forecast ?? '–')[0].toUpperCase()} / ${(idx.feasibility ?? '–')[0].toUpperCase()}`
                    : (s.page_ref ?? (s.sales_proxy_score != null ? `${s.sales_proxy_score} (${s.proxy_confidence})` : '—'))
                  const tooling = [
                    s.last_change === 'required' ? 'new last' : s.last_change === 'modification' ? 'last mod' : null,
                    s.bottom_tooling_change === 'required' ? 'new mould' : s.bottom_tooling_change === 'modification' ? 'mould mod' : null,
                    s.upper_pattern_change === 'major' ? 'pattern major' : null,
                  ].filter(Boolean).join(' · ') || 'reuses tooling'
                  return (
                    <tr key={s.signal_id}>
                      <td><b>{s.label}</b> <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{s.signal_id}</span>{s.oem_group && <Tag kind="warn">{t('OEM group')}</Tag>}
                        {s.co_occurring?.length ? <div style={{ color: 'var(--text-3)', fontSize: 11 }}>with {s.co_occurring.slice(0, 4).join(' · ')}</div> : null}
                      </td>
                      <td>{s.axis}</td>
                      <td>{s.observed_count}x</td>
                      <td>{s.adoption_stage && s.adoption_stage !== 'unknown' ? s.adoption_stage : s.direction === 'rising' ? 'Rising' : s.direction === 'stable' ? 'Holding' : 'Fading'}</td>
                      <td title={t('Commercial / Cultural / Forecast / Feasibility')}>{iTxt}</td>
                      <td style={{ fontSize: 11 }}>{tooling}</td>
                      <td>{s.sources.slice(0, 2).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-hi)', marginRight: 4 }}>[{i + 1}]</a>)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Collapse>
        )}

        {/* 디렉션 · S1의 결론이므로 항상 노출 */}
        {st.directions.length > 0 && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-h">{t('Three directions')}</div>
            <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {st.directions.map(d => (
                <div key={d.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 9, padding: '10px 12px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>{d.summary}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>{d.signal_ids.map(s => <Tag key={s} kind="accent">{s}</Tag>)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {st.designs.length > 0 && (
          <section className="skflow" id="sec-flow">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '4px 0 10px' }}>
              <h3 style={{ fontSize: 15 }}>{t('From sketch to design')}</h3>
              <span className="hint">{st.designs.length} {t('sketches')} · {st.designs.filter(d => !d.rejected).length} {t('passed')}</span>
            </div>
            {st.designs.map(d => {
              // 흑백 단계: 기준 외형 + 잉크 변형들 · 컬러 단계: 각 스케치가 사진이 된 디자인들
              const sketches = d.images.filter(i => isSketchView(i.view))
              const sketch = sketches[0]
              const outs = d.images.filter(i =>
                (i.view === 'lateral' && !i.colorway) || i.view === 'design'
                || (i.origin === 'generated' && !isSketchView(i.view)))
              // 이 스케치를 만든 근거 · 가중치 큰 신호부터.
              // 스펙을 실제로 정한 신호만 남긴다. 예전 분석에는 그 연결이 없어 가중치를 믿지 않는다.
              const traced = d.spec.hintApplied !== undefined
              const evidence = (d.rationale?.driving_signals ?? [])
                .slice()
                .filter(x => !traced || x.weight > 0)
                .sort((a, b) => b.weight - a.weight)
                .map(x => st.signals.find(g => g.signal_id === x.signal_id)?.label)
                .filter((x): x is string => !!x)
                .slice(0, 3)
              return (
                <article className={`skrow ${d.rejected ? 'rejected' : ''}`} key={d.spec.design_id}>
                  <div className="sk-src">
                    {/* 스케치가 없으면 "도식"이라고 적힌 빈 회색 칸이 떴다.
                        도식은 그리지 않은 지 오래고, 그 자리에 있는 것은 아무것도 아니다.
                        왜 없는지를 적는다 — 룰에서 떨어졌거나, 상한에 걸렸거나. */}
                    <span className={`sk-shot${sketch ? '' : ' empty'}`}>{sketch
                      ? <img src={sketch.url} alt="" loading="lazy" />
                      : <span className="sk-none">{d.rejected
                          ? t('Rejected by a rule, so it was never sketched')
                          : t('Not sketched — the sketch cap was reached before this one')}</span>}</span>
                    {sketches.slice(1).map((sv, i2) => (
                      <span className="sk-shot" key={sv.hash + i2} title={t('Ink variation, same form')}>
                        <img src={sv.url} alt="" loading="lazy" />
                      </span>
                    ))}
                    <b>{d.spec.design_id}</b>
                    <span className="sk-tier">{t(TIER_LABEL[d.spec.tier] ?? d.spec.tier)}</span>
                    {evidence.length > 0 && (
                      <span className="sk-ev">
                        <i>{t('Based on')}</i>
                        {evidence.map(e => <em key={e}>{e}</em>)}
                      </span>
                    )}
                    {d.rationale?.narrative?.[0] && <span className="sk-why">{d.rationale.narrative[0]}</span>}
                  </div>
                  <div className="sk-outs">
                    {outs.length === 0 && <span className="hint">{d.rejected ? t('Rule reject') : t('Rendering')}</span>}
                    {outs.map((im, i) => (
                      <button className="sk-out" key={im.hash + i} onClick={() => setDetail(d.spec.design_id)}
                        title={t('Open campaign shots and 3D')}>
                        <img src={im.url} alt="" loading="lazy" />
                        {/* 프롬프트가 '무엇을'이라면 이 줄은 '왜'다. PT 에서 먼저 읽히는 쪽은 이쪽이다. */}
                        {im.whyUsed && <span className="sk-why-used">{im.whyUsed}</span>}
                        <span className="sk-prompt">{im.promptUsed
                          ? im.promptUsed.slice(0, 110) + (im.promptUsed.length > 110 ? '…' : '')
                          : t('Prompt not stored for this older run')}</span>
                      </button>
                    ))}
                  </div>
                </article>
              )
            })}
          </section>
        )}

        {/* 디자인 상세 · 캠페인 컷과 3D 는 여기 저장돼 있다 */}
        {detail && (() => {
          const d = st.designs.find(x => x.spec.design_id === detail)
          if (!d) return null
          const camp = d.images.filter(i => i.view === 'wear' || i.view === 'concept')
          return (
            <div className="dd-modal" onClick={() => setDetail(null)}>
              <div className="dd-box" onClick={e => e.stopPropagation()}>
                <div className="dd-head">
                  <b>{d.spec.design_id}</b>
                  <span className="hint">{t(TIER_LABEL[d.spec.tier] ?? d.spec.tier)}</span>
                  <button className="dv-x" onClick={() => setDetail(null)} aria-label={t('Close')}>✕</button>
                </div>
                <div className="dd-body">
                  <div className="dd-left">
                    <DesignCard d={d} signals={st.signals}
                      stagePassed={{ s3: true, s4: true }}
                      onVerdict={gated || st.finished ? onGateVerdict : undefined} />
                  </div>
                  <div className="dd-right">
                    {d.model && (
                      <>
                        <div className="dd-sub">{t('3D showroom')}</div>
                        <ModelViewer url={d.model.url} height={230}
                          poster={(d.images.find(i => i.origin === 'generated' && i.view !== 'sketch') ?? d.images[0])?.url} />
                      </>
                    )}
                    <div className="dd-sub">{t('Campaign shots')} {camp.length === 0 && <span className="hint">{t('None for this design')}</span>}</div>
                    <div className="dd-camp">
                      {camp.map((im, i) => <img key={im.hash + i} src={im.url} alt="" loading="lazy" />)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {st.designs.length === 0 && st.signals.length === 0 && (
          <div className="empty" style={{ height: 300 }}>
            <div>{t('Starting the pipeline')}<br /><span className="hint">{t('Partial results appear here as they land')}</span></div>
          </div>
        )}
      </div>

      {/* 우: 로그 · 기본 접힘 */}
      {showLog ? (
        <div className="run-right">
          <div className="panel-h" style={{ borderBottom: '1px solid var(--line)' }}>
            Progress log
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowLog(false)}>{t('Close')}</button>
          </div>
          <div className="log" ref={logRef}>
            {st.logs.map((l, i) => (
              <div className="ln" key={i}>
                <span className="st">{l.stage}</span>
                <span className={`tx ${l.text.startsWith('⚠') ? 'warn' : ''}`}>{l.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="log-rail">
          <button onClick={() => setShowLog(true)}>Log {st.logs.length}</button>
        </div>
      )}
    </div>
  )
}
