// ── 디자인 카드 (지시서 12.4) · 목표값/시각화/검증 분리 + 근거 패널 + 게이트 ──
import { t } from '../core/i18n'
import { useState } from 'react'
import type { Design, Signal } from '../core/types'
import { TIER_LABEL, TYPE_LABEL, VERDICT_TAGS } from '../core/types'
import { viewSetFor } from '../core/packs'
import { Tag } from './bits'

export function DesignCard({ d, signals, stagePassed, onVerdict, compact }: {
  d: Design
  signals: Signal[]
  stagePassed: { s3: boolean; s4: boolean }
  onVerdict?: (id: string, v: 'approve' | 'reject', tags: string[]) => void
  compact?: boolean
}) {
  const [showRationale, setShowRationale] = useState(false)
  const [pendingReject, setPendingReject] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const views = viewSetFor(d.spec.itemType)
  const rendered = stagePassed.s3 && !d.rejected && d.colorways.length >= 0 && d.qa.length > 0
  const mainView = 'lateral'
  const f = d.spec.fields
  // 실제 생성 이미지 우선 · 렌더(기준뷰) > 스케치 > SVG 시뮬레이션 폴백
  const baseImg = d.images.find(i => i.view === mainView && !i.colorway)
  const sketchImg = d.images.find(i => i.view === 'sketch')
  const heroImg = baseImg ?? sketchImg
  const extraImgs = d.images.filter(i => i !== heroImg && i.view !== 'sketch')

  const specSummary = [
    `${f.heel_height_mm}mm ${f.heel_type === 'sport_midsole' ? 'stack' : 'heel'}`,
    `${f.panel_count} panels`, String(f.toe_shape), String(f.last_id),
    f.midsole_foam ? String(f.midsole_foam) : null,
    f.plate && f.plate !== 'none' ? `${f.plate} plate` : null,
  ].filter(Boolean).join(' · ')

  // 조사가 실제로 정한 필드. 제안만 되고 접힌 값은 여기 없다.
  const fromResearch = (d.spec.hintApplied ?? []).filter(k => k in f)

  const fails = d.ruleResults.filter(r => r.severity === 'fail')
  const warns = d.ruleResults.filter(r => r.severity === 'warn')
  const qaPass = d.qa.filter(q => q.pass).length

  return (
    <div className={`dcard ${d.rejected ? 'rejected' : ''}`}>
      <div className="imgwrap">
        {/* 생성된 컷이 없으면 도식을 그리지 않는다.
            회색 신발 도형은 보기 싫었고, 그 SVG는 <g>를 안 닫아 브라우저에서 깨진 아이콘으로 떴다.
            안 만들어졌으면 안 만들어졌다고 적는 편이 낫다. */}
        {heroImg
          ? <img src={heroImg.url} alt={d.spec.design_id}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          : (
            <div className="nocut">
              <b>{d.spec.design_id}</b>
              <span>{d.rejected ? t('Rejected by a rule, so it was never rendered') : t('No render yet — the image cap was reached before this one')}</span>
              <i>{specSummary}</i>
            </div>
          )}
        <div className="flag" style={{ display: 'flex', gap: 4 }}>
          {d.isTop && <Tag kind="accent">TOP</Tag>}
          {d.viewMismatch && <Tag kind="warn">{t('View mismatch')}</Tag>}
          {d.rejected && <Tag kind="danger">{t('Rule reject')}</Tag>}
        </div>
      </div>

      {/* 실제로 생성된 컷만 건다. 예전에는 컷이 없으면 도식(SVG)을 대신 깔았는데,
          다섯 개짜리 회색 신발 그림이 카드 아래에 늘어서는 것은 없느니만 못했다.
          안 만들어진 컷은 안 보여 주고, 몇 장이 남았는지만 말한다. */}
      {rendered && !compact && extraImgs.length > 0 && (
        <div style={{ padding: '6px 10px 0' }}>
          <div className="viewstrip">
            {extraImgs.map(im => (
              <div className="v" key={im.hash}
                title={im.variantAxis ? im.variantAxis : im.colorway ? `${im.colorway} colourway` : im.view}>
                <img src={im.url} alt={im.colorway ?? im.view} />
              </div>
            ))}
          </div>
          <div className="hint" style={{ marginTop: 4 }}>
            {extraImgs.some(im => im.variantAxis)
              ? extraImgs.filter(im => im.variantAxis).map(im => im.variantAxis!.split(' · ')[0]).join(' · ')
              : t('Extra views and colourways are edits of the base render, so every cut is the same product.')}
          </div>
        </div>
      )}

      <div className="body">
        <div className="idline">
          {d.spec.design_id}
          <span className="muted">{TYPE_LABEL[d.spec.itemType] ?? d.spec.itemType}</span>
          <Tag kind={d.spec.tier === 'signature' ? 'accent' : undefined}>{TIER_LABEL[d.spec.tier]}</Tag>
          {d.model && (
            <a className="tag tag-accent" href={d.model.url} download={`${d.spec.design_id}.glb`}
              title={t('Download the 3D model (GLB)')}
              onClick={e => e.stopPropagation()}>GLB ↓</a>
          )}
        </div>

        {/* 설계 목표값 (AI 생성 스펙) · 한 줄 요약, 상세는 근거 패널 */}
        <div className="metric"><b>{t('Target')}</b> {specSummary}
          {d.spec.fieldsLocked.length > 0 && <> · <span style={{ color: 'var(--accent-hi)' }}>🔒 DNA {d.spec.fieldsLocked.length}</span></>}
          {fromResearch.length > 0 && (
            <> · <span style={{ color: 'var(--ok)' }}
              title={`${t('Set by the research')}: ${fromResearch.map(k => `${k.replace(/_/g, ' ')} ${f[k]}`).join(', ')}`}>
              {fromResearch.length} {t('from research')}
            </span></>
          )}
        </div>

        {/* 룰 코드는 바이어에게 무의미하다 · 칩에 사유를 함께 싣는다 (Gemini QA 지적) */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {fails.length === 0
            ? <Tag kind="ok">{t('Passed rules')}</Tag>
            : fails.map(r => <span key={r.rule} title={r.message}><Tag kind="danger">{r.rule} · {r.message.split('.')[0]}</Tag></span>)}
          {warns.map(r => <span key={r.rule} title={r.message}><Tag kind="warn">{r.rule}</Tag></span>)}
          {d.qa.length > 0 && <Tag kind={qaPass === d.qa.length ? 'ok' : 'warn'}>QA {qaPass}/{d.qa.length}</Tag>}
        </div>

        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowRationale(v => !v)}>
          {showRationale ? '▾' : '▸'} Reasoning, metrics, cost
        </button>
      </div>

      {showRationale && <RationalePanel d={d} signals={signals} />}

      {/* 승인 게이트 · 카드 위 (별도 평가 화면 금지) */}
      {onVerdict && !d.rejected && (
        <div className="gate-actions">
          {d.verdict === 'approve' && <Tag kind="ok">{t('Approved')}</Tag>}
          {d.verdict === 'reject' && <Tag kind="danger">Rejected · {d.verdictTags?.join(', ')}</Tag>}
          {!d.verdict && !pendingReject && (<>
            <button className="btn btn-ok btn-sm" onClick={() => onVerdict(d.spec.design_id, 'approve', [])}>{t('Approve')}</button>
            <button className="btn btn-danger btn-sm" onClick={() => setPendingReject(true)}>{t('Reject')}</button>
          </>)}
          {pendingReject && (<>
            <div className="tagpick">
              {VERDICT_TAGS.map(t => (
                <button key={t} className={tags.includes(t) ? 'on' : ''}
                  onClick={() => setTags(v => v.includes(t) ? v.filter(x => x !== t) : [...v, t])}>{t}</button>
              ))}
            </div>
            <button className="btn btn-danger btn-sm" disabled={tags.length === 0}
              onClick={() => { onVerdict(d.spec.design_id, 'reject', tags); setPendingReject(false) }}>{t('Confirm reasons')}</button>
          </>)}
        </div>
      )}
    </div>
  )
}

export function RationalePanel({ d, signals }: { d: Design; signals: Signal[] }) {
  return (
    <div className="rationale">
      <div>
        <h5>{t('Metrics, calculated and reproducible')}</h5>
        <div style={{ color: 'var(--text-2)' }}>
          {d.metrics.map(m => <span key={m.label}>{m.label} <b style={{ color: 'var(--text)' }}>{m.value}</b> · </span>)}
          {d.topDistance != null && <span>{t('Distance between top picks')} <b style={{ color: 'var(--text)' }}>{d.topDistance}</b></span>}
        </div>
      </div>
      <div>
        <h5>{t('Model judgement, kept separate')}</h5>
        {d.modelEval.map(m => (
          <div key={m.label} style={{ color: 'var(--text-2)' }}>{m.label} <b style={{ color: 'var(--text)' }}>{m.value}</b> <span style={{ color: 'var(--text-3)' }}>· {m.basis}</span></div>
        ))}
      </div>
      <div>
        {/* 예전 분석은 신호와 스펙이 이어져 있지 않았다. 그때 것을 정했다고 적으면 거짓말이 된다. */}
        <h5>{d.spec.hintApplied === undefined
          ? t('Signals behind this, with sources')
          : d.rationale.driving_signals.some(x => x.weight > 0)
            ? t('Signals that set this spec, with sources')
            : t('Nearest evidence, though none of it set a spec value here')}</h5>
        {d.rationale.driving_signals.map(ds => {
          const s = signals.find(x => x.signal_id === ds.signal_id)
          if (!s) return null
          const idx = s.indices
          return (
            <div className="sig" key={ds.signal_id}>
              <Tag kind="accent">{s.signal_id}</Tag>
              <span>{s.label} · seen {s.observed_count}x{d.spec.hintApplied !== undefined && ds.weight > 0 ? ` · ${Math.round(ds.weight * 100)}% of what the research fixed here` : ''}
                {s.sales_proxy_score != null && ` · proxy ${s.sales_proxy_score} (${s.proxy_confidence})`}
                {s.page_ref && ` · ${s.page_ref}`}
                {idx && (idx.commercial || idx.cultural || idx.forecast || idx.feasibility) &&
                  ` · C ${idx.commercial ?? '–'} / Cu ${idx.cultural ?? '–'} / F ${idx.forecast ?? '–'} / Fe ${idx.feasibility ?? '–'}`}
                {s.co_occurring?.length ? ` · with ${s.co_occurring.slice(0, 3).join(', ')}` : ''}
                {' '}{s.sources.slice(0, 2).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer">[{i + 1}]</a>)}
              </span>
            </div>
          )
        })}
      </div>
      <div>
        <h5>{t('References, for attribution')}</h5>
        {d.rationale.reference_images.map(r => (
          <div className="refthumb" key={r.ref_id} style={{ marginBottom: 4 }}>
            <div className="ph">{r.source_type === 'competitor' ? 'CMP' : r.source_type === 'archive' ? 'ARC' : 'REF'}</div>
            <div style={{ fontSize: 11, lineHeight: 1.5 }}>
              {r.source_type} · collected {r.collected_at} · {r.borrowed_attributes.join(', ')}
              <div>
                <Tag kind={r.usage === 'attribute_only' ? undefined : 'accent'}>{r.usage}</Tag>
                {r.source_type === 'competitor' && <span style={{ color: 'var(--text-3)' }}> {t('blocked from generation, attributes only')}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {d.rationale.reference_prompts.length > 0 && (
        <div>
          <h5>{t('Concept prompt')}</h5>
          {d.rationale.reference_prompts.map((p, i) => (
            <div key={i} style={{ color: 'var(--text-2)' }}>"{p.text}" → {p.applied_as.join(' · ')}</div>
          ))}
        </div>
      )}
      {d.rationale.series_dna_inherited.length > 0 && (
        <div><h5>{t('Inherited series DNA')}</h5>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {d.rationale.series_dna_inherited.map(e => <Tag key={e} kind="accent">🔒 {e}</Tag>)}
          </div>
        </div>
      )}
      <div>
        <h5>{t('Why this tier')}</h5>
        <div style={{ color: 'var(--text-2)' }}>{d.rationale.type_placement_reason}</div>
      </div>
      <div>
        <h5>{t('Talk track')}</h5>
        {d.rationale.narrative.map((n, i) => <div key={i} style={{ color: 'var(--text-2)' }}>{i + 1}. {n}</div>)}
      </div>
      {d.qa.length > 0 && (
        <div>
          <h5>{t('Vision QA')}</h5>
          {d.qa.map(q => (
            <div key={q.check} style={{ color: q.pass ? 'var(--text-2)' : 'var(--warn)' }}>
              {q.pass ? '✓' : '⚠'} {q.check} · target {q.target} / observed {q.observed}
            </div>
          ))}
        </div>
      )}
      <div>
        <h5>{t('Cost, with band, assumptions and exclusions')}</h5>
        <div style={{ color: 'var(--text-2)' }}>
          Estimated KRW {(d.cost.estimated_total_krw / 10000).toFixed(1)}0k · band {d.cost.estimated_band_krw.map(v => (v / 10000).toFixed(1)).join('~')}0k · confidence {d.cost.confidence}
          {d.cost.tooling.total_tooling_krw > 0 && (
            <div>Tooling KRW {(d.cost.tooling.total_tooling_krw / 10000).toFixed(0)}0k
              {d.cost.tooling.size_run_count ? ` (${d.cost.tooling.mold_count_required} moulds across a ${d.cost.tooling.size_run_count} size run)` : ''}
              {' '}÷ {d.cost.tooling.amortization_volume.toLocaleString()} = {d.cost.tooling.tooling_per_unit_krw.toLocaleString()} each</div>
          )}
          <div style={{ color: 'var(--text-3)', fontSize: 11 }}>Assumes: {d.cost.assumptions.join(' · ')}</div>
          <div style={{ color: 'var(--text-3)', fontSize: 11 }}>Excludes: {d.cost.excluded_costs.join(' · ')}</div>
        </div>
      </div>
    </div>
  )
}
