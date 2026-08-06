// ── 분석 리포트 · 끝난 분석을 한 장짜리 문서처럼 보여준다 ────────────
// 진행 로그와 접힘 패널은 그대로 두되, 맨 위에 "무엇이 나왔는가"를 먼저 둔다.
// 여기 있는 숫자와 표는 전부 수집된 데이터에서 뽑는다. 채워 넣은 값은 없다.
import { t } from '../core/i18n'
import { useMemo } from 'react'
import type { RunState } from '../core/types'
import { CAT_LABEL, TYPE_LABEL, MODE_LABEL } from '../core/types'
import { GRADE_LABEL, shotUrl } from '../core/research'
import type { Macrotrend, SeasonDossier, TrendReport } from '../core/research'
import { DeckViewer } from './DeckViewer'
import { dossierDeckHtml, openDossierPdf, saveDossierHtml } from '../core/dossierPdf'
import { openTrendReportPdf, saveTrendReportHtml, trendDeckHtml } from '../core/reportPdf'
import { IcGem, IcReport, IcShoe, IcTrend } from './icons'

const KRW = (n: number) => `₩${Math.round(n).toLocaleString('en-US')}`

/** 매크로트렌드 카드에 쓸 대표 이미지 · 키아이템 사진이 있으면 그것을 쓴다 */
function macroShot(m: Macrotrend): string | null {
  for (const k of m.key_items ?? []) {
    const u = (k as { image_url?: string }).image_url
    if (u) return shotUrl(u)
  }
  return null
}

export default function RunReport({ st, onOpenBoard }: { st: RunState; onOpenBoard: () => void }) {
  const d = st.dossier as SeasonDossier | null
  const report = st.trendReport as TrendReport | null
  const macros = d?.macrotrends ?? []
  const top = st.designs.filter(x => x.isTop)
  const shown = (top.length ? top : st.designs.filter(x => !x.rejected)).slice(0, 6)

  // 히어로 이미지는 이번 분석이 실제로 만든 렌더를 쓴다
  const hero = useMemo(() => {
    for (const x of [...top, ...st.designs]) {
      const im = x.images.find(i => i.origin === 'generated' && i.view !== 'sketch')
      if (im) return im.url
    }
    return null
  }, [st.designs, top])

  // 경쟁 구도 · 브랜드별로 묶어 가격 범위와 대표 제품을 낸다
  const brands = useMemo(() => {
    const by = new Map<string, typeof st.competitors>()
    for (const c of st.competitors) {
      if (!by.has(c.brand)) by.set(c.brand, [])
      by.get(c.brand)!.push(c)
    }
    return [...by.entries()].map(([brand, items]) => {
      const prices = items.map(i => i.price_krw).filter((n): n is number => typeof n === 'number' && n > 0)
      return {
        brand,
        items,
        lo: prices.length ? Math.min(...prices) : null,
        hi: prices.length ? Math.max(...prices) : null,
        traits: [...new Set(items.flatMap(i => i.praise_points ?? []))].slice(0, 3),
        shots: items.map(i => i.image_urls?.[0]).filter(Boolean).slice(0, 2) as string[],
        inBand: items.filter(i => i.in_band).length,
      }
    }).sort((a, b) => b.items.length - a.items.length)
  }, [st.competitors])

  // 디자인 시사점 · 도시에의 소재·디테일·팔레트와 신호를 축별로 묶는다
  const implications = useMemo(() => {
    const pick = (list: readonly { label?: string; name?: string }[] | undefined, n: number) =>
      (list ?? []).map(x => x.label ?? x.name ?? '').filter(Boolean).slice(0, n)
    const mats = [...new Set(macros.flatMap(m => pick(m.materials, 3)))]
    const dets = [...new Set(macros.flatMap(m => pick(m.details, 3)))]
    const cols = [...new Set(macros.flatMap(m => (m.palette ?? []).map(c => c.name)))]
    const axes = [...new Set(st.signals.map(s => s.axis))]
    const rows: { k: string; label: string; body: string }[] = []
    if (axes.length) rows.push({ k: 'silhouette', label: 'Silhouette', body: axes.slice(0, 4).join(' · ') })
    if (mats.length) rows.push({ k: 'material', label: 'Material', body: mats.slice(0, 5).join(' · ') })
    if (dets.length) rows.push({ k: 'detail', label: 'Detail', body: dets.slice(0, 5).join(' · ') })
    if (cols.length) rows.push({ k: 'palette', label: 'Palette', body: cols.slice(0, 6).join(' · ') })
    if (d?.powershift) rows.push({ k: 'direction', label: 'Market direction', body: d.powershift })
    return rows
  }, [macros, st.signals, d])

  const sourceCount = (d?.sources?.length ?? 0) + (report?.sources?.length ?? 0)
  // 덱은 st 가 바뀔 때만 다시 만든다. 매 렌더마다 만들면 iframe 이 계속 새로 뜬다.
  const trendDeck = useMemo(() => (report ? trendDeckHtml(st) : null), [report, st])
  const seasonDeck = useMemo(() => (d ? dossierDeckHtml(st) : null), [d, st])
  const CatIcon = st.params.category === 'shoe' ? IcShoe : IcGem

  return (
    <div className="rep">
      {/* ── 표지 ─────────────────────────────────────────────── */}
      <header className="rep-hero">
        <div className="rep-hero-txt">
          <nav className="rep-crumb">
            <span>{t(MODE_LABEL[st.params.mode])}</span>
            <i>/</i><span>{t(TYPE_LABEL[st.params.itemType])}</span>
            <i>/</i><span>{d?.season ?? st.params.trend.priceBand}</span>
          </nav>
          <h1>{d?.season_title ?? `${t(CAT_LABEL[st.params.category])} ${t('macro trends')}`}</h1>
          <p className="rep-sub">{t(TYPE_LABEL[st.params.itemType])} {t('trend report')}</p>
          <p className="rep-lede">{d?.season_narrative ?? report?.executive_view ?? t('The analysis is still filling in. Sections appear as they land.')}</p>
          <div className="rep-stats">
            <div><b>{macros.length || '—'}</b><span>{t('Key macro trends')}</span></div>
            <div><b>{sourceCount || '—'}</b><span>{t('Data sources')}</span></div>
            <div><b>{implications.length || '—'}</b><span>{t('Design implications')}</span></div>
          </div>
        </div>
        {hero && <div className="rep-hero-art"><img src={hero} alt="" /></div>}
      </header>

      {/* ── 트렌드 리포트 PDF ─────────────────────────────────── */}
      {report && (
        <section className="rep-sect">
          <div className="rep-head">
            <h2>{t('Trend report')}</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => openTrendReportPdf(st)}>{t('Download PDF')}</button>
          </div>
          {trendDeck && (
            <DeckViewer title={trendDeck.title} html={trendDeck.html}
              onPrint={() => openTrendReportPdf(st)} onSave={() => saveTrendReportHtml(st)} />
          )}
        </section>
      )}

      {/* ── 매크로트렌드 ──────────────────────────────────────── */}
      {macros.length > 0 && (
        <section className="rep-sect">
          <div className="rep-head"><h2>{t('Key macro trends')}</h2></div>
          <div className="rep-macros">
            {macros.map(m => {
              const shot = macroShot(m)
              return (
                <article className="rep-macro" key={m.name}>
                  <span className="rm-art">
                    {shot ? <img src={shot} alt="" /> : <CatIcon />}
                  </span>
                  <span className="rm-txt">
                    <b>{m.name}</b>
                    <span className="rm-d">{m.statement}</span>
                  </span>
                  <span className="rm-grade">{t(GRADE_LABEL[m.grade] ?? m.grade)}</span>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Top 디자인 ────────────────────────────────────────── */}
      {shown.length > 0 && (
        <section className="rep-sect">
          <div className="rep-head">
            <h2>{t('Top trending designs')}</h2>
            <button className="btn btn-ghost btn-sm" onClick={onOpenBoard}>{t('View all designs')}</button>
          </div>
          <div className="rep-designs">
            {shown.map(x => {
              const im = x.images.find(i => i.origin === 'generated' && i.view !== 'sketch') ?? x.images[0]
              return (
                <article className="rep-design" key={x.spec.design_id}>
                  <span className="rd-shot">{im ? <img src={im.url} alt="" /> : null}</span>
                  <span className="rd-id">{x.spec.design_id}<i className={`rd-tier t-${x.spec.tier}`}>{t(x.spec.tier)}</i></span>
                  <span className="rd-spec">{x.metrics.slice(0, 2).map(m => `${m.label} ${m.value}`).join(' · ')}</span>
                  <span className="rd-chips">
                    <i className={x.rejected ? 'bad' : ''}>{x.rejected ? t('Rule reject') : t('Passed rules')}</i>
                    {x.qa.length > 0 && <i>QA {x.qa.filter(q => q.pass).length}/{x.qa.length}</i>}
                  </span>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 경쟁 구도 ─────────────────────────────────────────── */}
      {brands.length > 0 && (
        <section className="rep-sect">
          <div className="rep-head"><h2>{t('Competitive landscape')}</h2></div>
          <div className="rep-tablewrap">
            <table className="rep-table">
              <thead>
                <tr>
                  <th>{t('Brand')}</th><th>{t('Traits observed')}</th><th>{t('Key products')}</th>
                  <th>{t('Price range')}</th><th>{t('In band')}</th>
                </tr>
              </thead>
              <tbody>
                {brands.map(b => (
                  <tr key={b.brand}>
                    <td className="rt-brand">{b.brand}</td>
                    <td>{b.traits.length ? b.traits.join(', ') : <span className="dim">{t('none recorded')}</span>}</td>
                    <td className="rt-shots">
                      {b.shots.map((s, i) => <img key={i} src={shotUrl(s)} alt=""
                        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />)}
                    </td>
                    <td className="rt-price">{b.lo != null ? `${KRW(b.lo)} – ${KRW(b.hi!)}` : <span className="dim">—</span>}</td>
                    <td>{b.inBand} / {b.items.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 시즌 도시에 PDF ───────────────────────────────────── */}
      {d && (
        <section className="rep-sect">
          <div className="rep-head">
            <h2>{t('Season report')}</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => openDossierPdf(st)}>{t('Download PDF')}</button>
          </div>
          {seasonDeck && (
            <DeckViewer title={seasonDeck.title} html={seasonDeck.html}
              onPrint={() => openDossierPdf(st)} onSave={() => saveDossierHtml(st)} />
          )}
        </section>
      )}

      {/* ── 디자인 시사점 ─────────────────────────────────────── */}
      {implications.length > 0 && (
        <section className="rep-sect">
          <div className="rep-head"><h2>{t('Design implications')}</h2></div>
          <div className="rep-impl">
            {implications.map(r => (
              <div className="ri-row" key={r.k}>
                <span className="ri-ic"><IcTrend /></span>
                <span className="ri-l">{t(r.label)}</span>
                <span className="ri-b">{r.body}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {d && (
        <footer className="rep-foot">
          <IcReport />
          <span>
            {t('Collected up to')} {new Date(d.collected_at).toLocaleDateString()} · {d.searches} {t('web searches')} · {d.sources.length} {t('sources')}.
            {d.method_note ? ` ${d.method_note}` : ''}
          </span>
        </footer>
      )}
    </div>
  )
}
