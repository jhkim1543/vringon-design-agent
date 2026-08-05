// ── 새 Run 위저드 · 모드·카테고리·파라미터 + 실시간 시간·비용 재계산 ──
import { useEffect, useMemo, useState } from 'react'
import { detectRuntime } from '../core/runtime'
import type { Runtime } from '../core/runtime'
import { CAT_LABEL, DEFAULT_PARAMS, firstTypeOf, groupOf, MODE_LABEL, MODE_SCOPE, TAXONOMY, TYPE_LABEL } from '../core/types'
import type { Mode, Category, RunParams, Stage } from '../core/types'
import { cumulative, estimate, SCOPE_COPY } from '../core/estimate'
import { LAST_LIBRARY } from '../core/packs'
import { Seg, Tag } from './bits'
import { ENGINES } from '../core/imageEngines'

const MODE_DESC: Record<Mode, string> = {
  trend: 'Name your competitors. Their best sellers and the trends get researched.',
  series: 'Upload your series and what it stands for. Trends are added on top.',
  moodboard: 'Works only from the report or moodboard you upload.',
}

export default function Wizard({ onStart }: { onStart: (p: RunParams) => void }) {
  const [p, setP] = useState<RunParams>(DEFAULT_PARAMS)
  // 카테고리 전환은 pickCategory가 품목까지 함께 맞춘다
  const set = <K extends keyof RunParams>(k: K, v: RunParams[K]) => setP(prev => ({ ...prev, [k]: v }))
  const [rt, setRt] = useState<Runtime | null>(null)
  useEffect(() => { detectRuntime().then(setRt) }, [])
  const api = rt?.kind === 'live' ? { keyPresent: rt.keyPresent, cachedImages: rt.cachedImages } : null
  const isStatic = rt?.kind === 'static'
  const est = useMemo(() => estimate(p), [p])
  const scope = MODE_SCOPE[p.mode]
  const [draft, setDraft] = useState('')
  const [more, setMore] = useState(false)
  const setTrend = (patch: Partial<RunParams['trend']>) => setP(v => ({ ...v, trend: { ...v.trend, ...patch } }))
  const setSeries = (patch: Partial<RunParams['series']>) => setP(v => ({ ...v, series: { ...v.series, ...patch } }))
  const setMood = (patch: Partial<RunParams['moodboard']>) => setP(v => ({ ...v, moodboard: { ...v.moodboard, ...patch } }))
  const addCompetitor = () => {
    const n = draft.trim()
    if (!n) return
    setP(v => v.trend.competitors.includes(n) ? v
      : ({ ...v, trend: { ...v.trend, competitors: [...v.trend.competitors, n] } }))
    setDraft('')
  }
  // 모드별 착수 조건 · 자료 없이 돌리면 결과를 설명할 수 없다
  const blocked = isStatic ? 'Live runs need the local server. Open the saved sample from History to see a finished run.'
    : p.mode === 'trend' ? (p.trend.competitors.length === 0 ? 'Add at least one competitor' : null)
    : p.mode === 'series' ? (p.series.archiveFiles.length === 0 ? 'Upload your series designs'
      : !p.series.valueStatement.trim() ? 'Describe what the series stands for' : null)
    : (p.moodboard.files.length === 0 ? 'Upload a PDF' : null)
  const cum = useMemo(() => cumulative(p), [p])
  const curGroup = groupOf(p.category, p.itemType)
  const pickCategory = (c: Category) => setP(v => ({
    ...v, category: c, itemType: TAXONOMY[c][0].types[0].id,
  }))
  const [rc, rp, rs] = p.tierRatio
  const rsum = rc + rp + rs
  const perTier = (r: number) => Math.round(p.sketchCount * r / rsum)

  return (
    <div className="wizard">
      <div className="wizard-inner">
        <div>
          {isStatic && (
            <div className="staticnote">
              <b>Read-only demo.</b> Research and image generation run on a local Node server that is not part of this
              static build, so nothing is called from here. Everything a full run produced is saved: open
              <b> History</b> in the left rail to walk through the sample Run, its board, the season dossier and the PDFs.
              <a href="https://github.com/jhkim1543/vringon-design-agent#running-it-for-real" target="_blank" rel="noreferrer">How to run it for real</a>
            </div>
          )}
          <div className="wizhead">
            <div>
              <h1>Run Setup</h1>
              <p className="lead">Set the brief, pick how far to go, and run.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setP(DEFAULT_PARAMS)}>Reset</button>
          </div>

          <div className="wcard">
            <h3><span className="n">1</span> Agent mode</h3>
            <div className="mode-grid">
              {(Object.keys(MODE_LABEL) as Mode[]).map(m => (
                <button key={m} className={`mode-card ${p.mode === m ? 'on' : ''}`} onClick={() => set('mode', m)}>
                  <div className="t">{MODE_LABEL[m]}{p.mode === m && <Tag kind="accent">Selected</Tag>}</div>
                  <div className="d">{MODE_DESC[m]}</div>
                </button>
              ))}
            </div>
            <div className="scope-note">
              <span className="sn-t">Research</span>
              <span className={`sn-i ${scope.competitor ? 'on' : ''}`}>Competitors</span>
              <span className={`sn-i ${scope.trend ? 'on' : ''}`}>Trends</span>
              <span className={`sn-i ${scope.upload ? 'on' : ''}`}>Your files</span>
              <span className="hint" style={{ flexBasis: '100%', marginTop: 2 }}>{scope.note}</span>
            </div>
          </div>

          {/* 모드별 입력 · 모드마다 필요한 자료가 다르다 */}
          <div className="wcard">
            <h3><span className="n">2</span> {p.mode === 'trend' ? 'Competitors' : p.mode === 'series' ? 'Series' : 'Files'}</h3>

            {p.mode === 'trend' && (<>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="lbl">Brands</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="chiplist">
                    {p.trend.competitors.map(c => (
                      <span className="chip-in" key={c}>
                        {c}
                        <button onClick={() => setP(v => ({ ...v, trend: { ...v.trend, competitors: v.trend.competitors.filter(x => x !== c) } }))} aria-label={`Remove ${c}`}>Remove</button>
                      </span>
                    ))}
                    {p.trend.competitors.length === 0 && <span className="hint">Real brand names only. They get searched on the web.</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input className="input" style={{ maxWidth: 220 }} placeholder="Brand name"
                      value={draft} onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addCompetitor() }} />
                    <button className="btn btn-ghost btn-sm" onClick={addCompetitor}>Add</button>
                  </div>
                  {/* 이미 조사해 둔 조합은 즉시 불러온다 */}
                  <div className="chiplist" style={{ marginTop: 8 }}>
                    <span className="hint" style={{ marginRight: 2 }}>Quick add</span>
                    {(p.category === 'shoe'
                      ? ['ASICS', 'adidas', 'Nike', 'New Balance', 'HOKA']
                      : ['Tiffany', 'Cartier', 'Pandora', 'Swarovski']
                    ).filter(b => !p.trend.competitors.includes(b)).map(b => (
                      <button key={b} className="pick sm"
                        onClick={() => setP(v => v.trend.competitors.includes(b) ? v : ({ ...v, trend: { ...v.trend, competitors: [...v.trend.competitors, b] } }))}>{b}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="row"><span className="lbl">Tier</span>
                <Seg options={['mass', 'contemporary', 'premium', 'luxury'] as const} value={p.trend.priceBand}
                  onChange={v => setTrend({ priceBand: v })} />
              </div>
              <div className="row"><span className="lbl">Price</span>
                <input className="input" style={{ maxWidth: 110 }} type="number" value={p.trend.priceMinKrw}
                  onChange={e => setTrend({ priceMinKrw: Number(e.target.value) })} />
                <span className="hint">~</span>
                <input className="input" style={{ maxWidth: 110 }} type="number" value={p.trend.priceMaxKrw}
                  onChange={e => setTrend({ priceMaxKrw: Number(e.target.value) })} />
                <span className="hint">KRW. Search widens 30% beyond this.</span>
              </div>
            </>)}

            {p.mode === 'series' && (<>
              <div className="row"><span className="lbl">Series</span>
                <input className="input" style={{ maxWidth: 260 }} placeholder="e.g. Arc line"
                  value={p.series.seriesName} onChange={e => setSeries({ seriesName: e.target.value })} />
              </div>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="lbl">Designs</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label className="dropzone">
                    <input type="file" multiple accept="image/*" hidden
                      onChange={e => setSeries({ archiveFiles: [...p.series.archiveFiles, ...Array.from(e.target.files ?? []).map(f => f.name)] })} />
                    Upload past designs from this series
                    <span className="dz-sub">8 or more, so the constants can be told apart</span>
                  </label>
                  {p.series.archiveFiles.length > 0 && (
                    <div className="chiplist" style={{ marginTop: 8 }}>
                      {p.series.archiveFiles.slice(0, 6).map((f, i) => <span className="chip-in" key={i}>{f}</span>)}
                      {p.series.archiveFiles.length > 6 && <span className="hint">+{p.series.archiveFiles.length - 6} more</span>}
                    </div>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <Tag kind={p.series.archiveFiles.length >= 8 ? 'ok' : 'warn'}>
                      {p.series.archiveFiles.length} files · {p.series.archiveFiles.length >= 8 ? 'enough to separate constants' : 'need 8 or more'}
                    </Tag>
                  </div>
                </div>
              </div>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="lbl">Value</span>
                <textarea className="input" rows={3} style={{ flex: 1, resize: 'vertical' }}
                  placeholder="What this series has kept, and what you want to change this season"
                  value={p.series.valueStatement} onChange={e => setSeries({ valueStatement: e.target.value })} />
              </div>
              <div className="row"><span className="lbl">Trends</span>
                <Seg options={['On', 'Off'] as const} value={p.series.trendSearch ? 'On' : 'Off'}
                  onChange={v => setSeries({ trendSearch: v === 'On' })} />
                <span className="hint">The only outside research in this mode</span>
              </div>
            </>)}

            {p.mode === 'moodboard' && (<>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="lbl">Files</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label className="dropzone">
                    <input type="file" multiple accept="application/pdf" hidden
                      onChange={e => setMood({ files: [...p.moodboard.files, ...Array.from(e.target.files ?? []).map(f => f.name)] })} />
                    Upload your trend report or moodboard PDF
                    <span className="dz-sub">Nothing outside these files is used</span>
                  </label>
                  {p.moodboard.files.length > 0 && (
                    <div className="chiplist" style={{ marginTop: 8 }}>
                      {p.moodboard.files.map((f, i) => (
                        <span className="chip-in" key={i}>{f}
                          <button onClick={() => setMood({ files: p.moodboard.files.filter((_, j) => j !== i) })} aria-label="Remove">Remove</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="lbl">Notes</span>
                <textarea className="input" rows={2} style={{ flex: 1, resize: 'vertical' }}
                  placeholder="Anything specific to look for"
                  value={p.moodboard.notes} onChange={e => setMood({ notes: e.target.value })} />
              </div>
              <div className="row">
                <span className="hint">Uploaded files are treated as data, never as instructions</span>
              </div>
            </>)}
          </div>

          <div className="wcard">
            <h3><span className="n">3</span> Product</h3>

            {/* 1단계 · 무엇을 만드는가 */}
            <div className="catpick">
              {(['shoe', 'jewelry'] as const).map(c => (
                <button key={c} className={`catcard ${p.category === c ? 'on' : ''}`} onClick={() => pickCategory(c)}>
                  <span className="cc-t">{CAT_LABEL[c]}</span>
                  <span className="cc-d">{TAXONOMY[c].length} families</span>
                </button>
              ))}
            </div>

            {/* 2단계 · 어떤 계열인가 */}
            <div className="steprow">
              <span className="lbl">Family</span>
              <div className="chiprow">
                {TAXONOMY[p.category].map(g => (
                  <button key={g.id} className={`pick ${curGroup?.id === g.id ? 'on' : ''}`}
                    onClick={() => set('itemType', firstTypeOf(p.category, g.id))}>
                    {g.label}
                    <span className="pk-n">{g.note}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3단계 · 세부 품목 */}
            <div className="steprow">
              <span className="lbl">Type</span>
              <div className="chiprow">
                {(curGroup?.types ?? []).map(t => (
                  <button key={t.id} className={`pick sm ${p.itemType === t.id ? 'on' : ''}`}
                    onClick={() => set('itemType', t.id)}>{t.label}</button>
                ))}
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              {p.category === 'shoe'
                ? <Tag kind="ok">{LAST_LIBRARY.length} lasts loaded</Tag>
                : <Tag kind="ok">22 molds loaded</Tag>}
              <span className="hint">
                {p.category === 'shoe'
                  ? 'Athletic types need a running last' : 'Core must reuse an existing mold'}
              </span>
            </div>
          </div>

          <div className="wcard">
            <h3><span className="n">4</span> Volume</h3>
            <div className="row"><span className="lbl">Sketches</span>
              <Seg options={[6, 12, 18, 24] as const} value={p.sketchCount} onChange={v => set('sketchCount', v)} />
              <span className="hint">Core {perTier(rc)} · Push {perTier(rp)} · Signature {p.sketchCount - perTier(rc) - perTier(rp)}</span>
            </div>
            <div className="row"><span className="lbl">Top picks</span>
              <Seg options={[1, 2, 3, 4, 5] as const} value={p.topN as any} onChange={v => set('topN', Number(v))} />
              <span className="hint">At least one from each tier</span>
            </div>

            <button className="moretoggle" onClick={() => setMore(v => !v)}>
              {more ? 'Hide' : 'More'} settings
              <span className="mt-sum">{`${p.tierRatio.join(':')} · ${Math.round(p.renderRatio * 100)}% · ${p.viewCount} views · ${p.colorwayCount} colorways`}</span>
            </button>

            {more && (<div className="morebox">
              <div className="row"><span className="lbl">Mix</span>
                <Seg options={['1:1:1', '2:1:1', '1:2:1', '2:2:1'] as const}
                  value={p.tierRatio.join(':') as any}
                  onChange={v => set('tierRatio', String(v).split(':').map(Number) as [number, number, number])} />
                <span className="hint">Core : Push : Signature</span>
              </div>
              <div className="row"><span className="lbl">To render</span>
                <Seg options={[0.25, 0.5, 0.75] as const} value={p.renderRatio} onChange={v => set('renderRatio', v)} format={v => `${Number(v) * 100}%`} />
                <span className="hint">{Math.max(1, Math.round(p.sketchCount * p.renderRatio))} move on</span>
              </div>
              <div className="row"><span className="lbl">Views</span>
                <Seg options={[1, 3, 4] as const} value={p.viewCount} onChange={v => set('viewCount', v)} />
                <span className="lbl" style={{ minWidth: 60, marginLeft: 8 }}>Colorways</span>
                <Seg options={[0, 1, 2, 3] as const} value={p.colorwayCount} onChange={v => set('colorwayCount', v)} />
              </div>
              <div className="row"><span className="lbl">Variations</span>
                <Seg options={[0, 2, 3, 4, 6, 8] as const} value={p.variationCount} onChange={v => set('variationCount', v)} />
                <span className="hint">Branches off one sketch, one axis changed each</span>
              </div>
              <div className="row"><span className="lbl">Concept shoot</span>
                <Seg options={[0, 2, 3] as const} value={p.conceptShots} onChange={v => set('conceptShots', v)} />
                <span className="hint">Worn on a virtual model, on set, on location</span>
              </div>
              <div className="row"><span className="lbl">Worn</span>
                <Seg options={[0, 2, 4] as const} value={p.wearCuts} onChange={v => set('wearCuts', v)} />
                <span className="lbl" style={{ minWidth: 60, marginLeft: 8 }}>Video</span>
                <Seg options={['Off', 'On'] as const} value={p.video ? 'On' : 'Off'} onChange={v => set('video', v === 'On')} />
              </div>
              <div className="row">
                <span className="hint">Video costs the most. Reviews run on stills.</span>
              </div>
            </div>)}
          </div>

          <div className="wcard">
            <h3><span className="n">5</span> Generation</h3>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="lbl">Model</span>
              <div className="enginepick">
                {(['fast', 'detail'] as const).map(id => (
                  <button key={id} className={`engcard ${p.imageEngine === id ? 'on' : ''}`}
                    onClick={() => set('imageEngine', id)}>
                    <span className="eg-t">{ENGINES[id].label}</span>
                    <span className="eg-d">{ENGINES[id].blurb}</span>
                    <span className="eg-m">
                      ${ENGINES[id].usdPerImage.toFixed(3)} · {ENGINES[id].secPerImage}s each
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="row"><span className="lbl">Images</span>
              <Seg options={[0, 6, 12, 24, 48] as const} value={p.imageBudget}
                onChange={v => set('imageBudget', v)}
                format={v => v === 0 ? 'None' : `${v}`} />
              <span className="hint">
                {api && !api.keyPresent
                  ? 'No image server. Diagrams only.'
                  : p.imageBudget === 0
                    ? 'Spec diagrams only'
                    : `Anything past the cap falls back to a diagram${api?.cachedImages ? ` · ${api.cachedImages} reusable` : ''}`}
              </span>
            </div>
            <div className="row">
              <span className="hint">
                Rule-failed specs are never rendered. Extra views are edits of the base shot, not new images.
              </span>
            </div>
          </div>
        </div>

        <div className="est panel">
          <div className="pickedbar">
            <span className="pb-i strong">{TYPE_LABEL[p.itemType]}</span>
            <span className="pb-i">{MODE_LABEL[p.mode]}</span>
          </div>
          <div className="panel-h">Scope</div>
          <div className="scope" style={{ padding: '12px 12px 4px' }}>
            {cum.map(s => (
              <button key={s.stage} className={p.endStage === s.stage ? 'on' : ''} onClick={() => set('endStage', s.stage as Stage)}>
                <span className="radio" />
                <span className="sc-body">
                  <span className="sc-top">
                    <span className="st">{SCOPE_COPY[s.stage as Stage].title}</span>
                    <span className="meta">{s.minutes}m · ${s.usd.toFixed(2)}</span>
                  </span>
                  <span className="sc-gets">{SCOPE_COPY[s.stage as Stage].gets}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="big">
            <div><div className="v">{est.totalMinutes}m</div><div className="k">Time</div></div>
            <div><div className="v">${est.totalUsd.toFixed(2)}</div><div className="k">Cost</div></div>
            <div><div className="v">{est.realImages}</div><div className="k">Images</div></div>
          </div>
          <table>
            <tbody>
              {est.perStage.map(s => {
                const active = ['S1', 'S2', 'S3', 'S4', 'S5'].indexOf(s.stage) <= ['S1', 'S2', 'S3', 'S4', 'S5'].indexOf(p.endStage)
                return (
                  <tr key={s.stage} className={active ? '' : 'dim'}>
                    <td><span className="stg">{s.stage}</span> {s.label}</td>
                    {/* 상한에 걸리면 "만들 수 있는 수 / 원한 수"로 보여야 오해가 없다 */}
                    <td>{s.images > 0 ? (s.real < s.images ? `${s.real} of ${s.images}` : `${s.images} imgs`) : ''}</td>
                    <td>{Math.max(1, Math.round(s.minutes))}m · ${s.usd.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="go">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12.5, color: 'var(--text-2)' }}>
              <input type="checkbox" checked={p.approvalGate} onChange={e => set('approvalGate', e.target.checked)} />
              Pause after sketches for review
            </label>
            <button className="btn btn-primary" style={{ width: '100%', padding: '11px' }}
              disabled={!!blocked} onClick={() => onStart(p)}>
              Run · {SCOPE_COPY[p.endStage].title}
            </button>
            {blocked && <div className="blockmsg">{blocked}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
