// ── 시즌 도시에 리포트 (인쇄용) ─────────────────────────────────────
// 첨부받은 MICAM/Livetrend 바이어스 가이드의 구성을 그대로 따른다.
//   표지 → 방법론(데이터 소스 4종·등급 6종) → 시즌 서사 → 매크로 4개
//   → 매크로별: 성장 지표 · 팔레트(TCX+HEX) · 소재 · 디테일 · 키아이템(여/남/키즈)
//   → 연도별 흐름 → 미확인 항목 → 출처 (원문 링크가 그대로 살아 있어야 한다)
import type { RunState } from './types'
import { CAT_LABEL, TYPE_LABEL, MODE_LABEL } from './types'
import type { SeasonDossier, DossierMetric } from './research'
import { GRADE_LABEL, SOURCE_LABEL, metricText } from './research'

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const pct = metricText

function metricRow(m: DossierMetric): string {
  const src = m.source_url
    ? `<a href="${esc(m.source_url)}">${esc(SOURCE_LABEL[m.source_kind] ?? m.source_kind)}</a>`
    : esc(SOURCE_LABEL[m.source_kind] ?? m.source_kind)
  return `<tr>
    <td class="ml">${esc(m.label)}</td>
    <td class="mv">${esc(pct(m))}<span class="yoy">YoY</span></td>
    <td class="ms">${src}</td>
    <td class="mn">${esc(m.observed_note)}</td>
  </tr>`
}

function macroSection(m: SeasonDossier['macrotrends'][number], i: number): string {
  const items = (seg: string) => (m.key_items ?? []).filter(k => k.segment === seg)
  const itemBlock = (seg: string, label: string) => {
    const list = items(seg)
    if (!list.length) return ''
    return `<h4>Key items · ${esc(label)}</h4>
    ${list.map(k => `<div class="item">
      <div class="ihead"><span class="iname">${esc(k.name)}</span>
        <span class="ipct">${esc(k.metric ? pct(k.metric) : '—')}<span class="yoy">YoY</span></span>
        <span class="grade g-${esc(k.grade)}">${esc(GRADE_LABEL[k.grade] ?? k.grade)}</span></div>
      <p>${esc(k.description)}</p>
      <div class="spec">Spec: ${esc(k.silhouette_spec)}</div>
      ${k.metric?.source_url ? `<div class="src"><a href="${esc(k.metric.source_url)}">${esc(k.metric.source_url)}</a></div>` : ''}
    </div>`).join('')}`
  }

  return `<section class="macro">
    <div class="mhead">
      <span class="num">${i + 1}</span>
      <h2>${esc(m.name)}</h2>
      <span class="grade g-${esc(m.grade)}">${esc(GRADE_LABEL[m.grade] ?? m.grade)}</span>
    </div>
    <p class="statement">${esc(m.statement)}</p>
    <div class="chips">${(m.sub_trends ?? []).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
    ${(m.narrative ?? '').split(/\n{2,}/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('')}

    ${(m.drivers ?? []).length ? `<h4>What is driving it</h4>
    <table class="metrics">${m.drivers.map(metricRow).join('')}</table>` : ''}

    ${(m.palette ?? []).length ? `<h4>Palette</h4>
    <div class="palette">${m.palette.map(c => `<div class="sw">
      <div class="chipc" style="background:${esc(c.hex)}"></div>
      <div class="cn">${esc(c.name)}</div>
      <div class="cc">${esc(c.pantone_tcx || '—')}</div>
      <div class="cc">${esc(c.hex)}</div>
    </div>`).join('')}</div>` : ''}

    ${(m.materials ?? []).length ? `<h4>Materials</h4>
    <table class="metrics">${m.materials.map(metricRow).join('')}</table>` : ''}

    ${(m.details ?? []).length ? `<h4>Details</h4>
    <table class="metrics">${m.details.map(metricRow).join('')}</table>` : ''}

    ${itemBlock('women', 'Women')}
    ${itemBlock('men', 'Men')}
    ${itemBlock('kids', 'Kids')}
  </section>`
}

export function openDossierPdf(st: RunState) {
  const d = st.dossier as SeasonDossier | null
  if (!d) return
  const p = st.params
  const item = `${CAT_LABEL[p.category]} / ${TYPE_LABEL[p.itemType] ?? p.itemType}`

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(d.season)} ${esc(d.season_title)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font: 10.5pt/1.62 -apple-system, "Segoe UI", Roboto, sans-serif; color: #14181D; margin: 0; }
  a { color: #3B45C8; text-decoration: none; word-break: break-all; }
  .cover { padding: 34mm 0 20mm; border-bottom: 3px solid #14181D; margin-bottom: 16px; }
  .kicker { font-size: 9pt; letter-spacing: .14em; text-transform: uppercase; color: #6B7178; }
  h1 { font-size: 30pt; line-height: 1.1; margin: 10px 0 6px; letter-spacing: -.01em; }
  .power { font-size: 13pt; color: #3B45C8; font-weight: 700; letter-spacing: .04em; }
  h2 { font-size: 16pt; margin: 0; }
  h3 { font-size: 12pt; margin: 22px 0 6px; border-bottom: 1px solid #E3E7EC; padding-bottom: 4px; }
  h4 { font-size: 10pt; margin: 16px 0 5px; letter-spacing: .06em; text-transform: uppercase; color: #6B7178; }
  table.facts { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 10px 0 18px; }
  table.facts th { text-align: left; width: 25%; color: #6B7178; font-weight: 600; padding: 3px 0; vertical-align: top; }
  table.facts td { padding: 3px 0; vertical-align: top; }
  .method { background: #F4F6F8; padding: 12px 14px; border-left: 3px solid #14181D; font-size: 9.5pt; margin: 0 0 18px; }
  .method b { display: block; margin-bottom: 3px; }
  .grades { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 0; }
  .grade { font-size: 8pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
           padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
  .g-edgy { background: #E8F5E9; color: #2E5B34 }
  .g-early_sign { background: #F3E8FB; color: #5B3A78 }
  .g-safe { background: #E4E9F2; color: #33415C }
  .g-big { background: #F8DEDE; color: #8C2F2F }
  .g-stable { background: #FBF1DA; color: #7A5C1E }
  .g-last_call { background: #FDE6DC; color: #8A4326 }
  section.macro { break-inside: avoid-page; page-break-inside: avoid; margin: 0 0 26px; padding-top: 8px; }
  .mhead { display: flex; align-items: center; gap: 10px; border-top: 2px solid #14181D; padding-top: 10px; }
  .mhead .num { font-size: 22pt; font-weight: 800; color: #C9CED6; line-height: 1; }
  .statement { font-size: 11.5pt; font-weight: 600; margin: 8px 0 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 0 0 10px; }
  .chip { font-size: 8.5pt; padding: 2px 8px; border-radius: 999px; background: #EEF1F5; color: #40474F; }
  table.metrics { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 2px 0 4px; }
  table.metrics td { padding: 4px 6px 4px 0; border-top: 1px solid #EEF1F5; vertical-align: top; }
  td.ml { font-weight: 700; width: 26% }
  td.mv { width: 13%; font-weight: 700; font-size: 11pt; white-space: nowrap }
  td.ms { width: 14% }
  td.mn { color: #6B7178 }
  .yoy { font-size: 7pt; color: #9AA1A9; margin-left: 3px; vertical-align: super }
  .palette { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 6px; }
  .sw { width: 78px; font-size: 7.5pt; }
  .chipc { height: 34px; border-radius: 4px; border: 1px solid rgba(0,0,0,.12); }
  .cn { font-weight: 700; margin-top: 3px; line-height: 1.25 }
  .cc { color: #6B7178 }
  .item { border-top: 1px solid #EEF1F5; padding: 7px 0; break-inside: avoid; }
  .ihead { display: flex; align-items: baseline; gap: 8px; }
  .iname { font-weight: 800; letter-spacing: .03em; text-transform: uppercase; font-size: 9.5pt }
  .ipct { font-weight: 700; font-size: 11pt }
  .item p { margin: 3px 0 2px }
  .spec { font-size: 8.5pt; color: #40474F; background: #F6F8FA; padding: 4px 7px; border-radius: 4px; }
  .src { font-size: 7.5pt; margin-top: 3px }
  ol.src, ul.q { margin: 4px 0 0 18px; padding: 0; font-size: 9pt }
  ol.src li { margin: 3px 0 }
  .yr { display: flex; gap: 10px; padding: 6px 0; border-top: 1px solid #EEF1F5; font-size: 9.5pt }
  .yr b { flex: 0 0 70px }
  .foot { margin-top: 22px; padding-top: 10px; border-top: 1px solid #E3E7EC; font-size: 8.5pt; color: #6B7178 }
  @media print { .noprint { display: none } }
  .noprint { position: fixed; top: 12px; right: 12px; }
  .noprint button { font: 600 12px sans-serif; padding: 8px 14px; border-radius: 8px;
                    border: 1px solid #14181D; background: #14181D; color: #fff; cursor: pointer; }
</style></head><body>
<div class="noprint"><button onclick="window.print()">Save as PDF</button></div>

<div class="cover">
  <div class="kicker">VRINGON Design Agent · Season dossier</div>
  <h1>${esc(d.season)}<br>${esc(d.season_title)}</h1>
  ${d.powershift ? `<div class="power">Powershift: ${esc(d.powershift)}</div>` : ''}
</div>

<table class="facts">
  <tr><th>Item</th><td>${esc(item)}</td></tr>
  <tr><th>Agent mode</th><td>${esc(MODE_LABEL[p.mode])}</td></tr>
  ${p.mode === 'trend' && p.trend.competitors.length ? `<tr><th>Brands referenced</th><td>${esc(p.trend.competitors.join(', '))}</td></tr>` : ''}
  <tr><th>Collected</th><td>${esc(d.collected_at)} · ${esc(d.searches)} searches · ${(d.sources ?? []).length} sources</td></tr>
</table>

<div class="method">
  <b>How this was built</b>
  Four data sources are read separately and every number is year on year:
  e-commerce assortments, Instagram visibility, runway appearances, and search volume.
  Each figure below carries the source it came from; anything that could not be verified is left blank rather than estimated.
  <div class="grades">
    <span class="grade g-edgy">Edgy · weak signal, high risk</span>
    <span class="grade g-early_sign">Early sign · emerging</span>
    <span class="grade g-safe">Safe · announced, growing</span>
    <span class="grade g-big">Big · high commercial potential</span>
    <span class="grade g-stable">Stable · present, flat</span>
    <span class="grade g-last_call">Last call · declining, still sellable</span>
  </div>
  ${d.method_note ? `<div style="margin-top:8px">${esc(d.method_note)}</div>` : ''}
</div>

<h3>The season</h3>
${(d.season_narrative ?? '').split(/\n{2,}/).filter(Boolean).map(p2 => `<p>${esc(p2)}</p>`).join('')}

<h3>Macrotrends</h3>
${(d.macrotrends ?? []).map(macroSection).join('')}

${(d.yearly_context ?? []).length ? `<h3>How the last few seasons moved</h3>
${d.yearly_context.map(y => `<div class="yr"><b>${esc(y.season)}</b><div>${esc(y.headline)}<br><span style="color:#6B7178">${esc(y.what_changed)}</span>${y.source_url ? `<br><a href="${esc(y.source_url)}">${esc(y.source_url)}</a>` : ''}</div></div>`).join('')}` : ''}

${(d.open_questions ?? []).length ? `<h3>Still unverified</h3><ul class="q">${d.open_questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}

${(d.sources ?? []).length ? `<h3>Sources</h3>
<ol class="src">${d.sources.map(x => `<li><a href="${esc(x.url)}">${esc(x.title || x.url)}</a><br><span style="color:#6B7178">${esc(x.used_for)}</span></li>`).join('')}</ol>` : ''}

<div class="foot">
  Every figure traces to a source listed above and is year on year. Where a number could not be confirmed it is shown as an em dash
  rather than an estimate. Grades follow the six-step scale set out under "How this was built".
  Concept imagery produced alongside this dossier is generated, not photographed, and the people in it are not real.
</div>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.onload = () => setTimeout(() => w.print(), 300)
}
