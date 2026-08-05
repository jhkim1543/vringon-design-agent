// ── 트렌드 리포트 단독 PDF ─────────────────────────────────────────
// 보드 전체를 인쇄하는 것과 별개로, 리포트만 깔끔하게 뽑아 갈 수 있어야 한다.
// 별도 창을 열어 인쇄 전용 스타일로 그린 뒤 브라우저 인쇄(=PDF 저장)를 부른다.
import type { TrendReport } from './research'
import type { RunState } from './types'
import { CAT_LABEL, TYPE_LABEL, MODE_LABEL } from './types'

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 리포트 본문의 마크다운을 아주 얕게만 해석한다. 제목과 문단이면 충분하다. */
function bodyHtml(md: string): string {
  return md.split(/\n{2,}/).map(block => {
    const t = block.trim()
    if (!t) return ''
    const h = /^(#{1,4})\s+(.*)$/.exec(t)
    if (h) return `<h${h[1].length + 1}>${esc(h[2])}</h${h[1].length + 1}>`
    if (/^[-*]\s+/m.test(t)) {
      const items = t.split('\n').filter(l => /^[-*]\s+/.test(l)).map(l => `<li>${esc(l.replace(/^[-*]\s+/, ''))}</li>`)
      return `<ul>${items.join('')}</ul>`
    }
    return `<p>${esc(t).replace(/\n/g, '<br>')}</p>`
  }).join('\n')
}

export function openTrendReportPdf(st: RunState) {
  const rep = st.trendReport as TrendReport | null
  if (!rep) return

  const p = st.params
  const item = `${CAT_LABEL[p.category]} / ${TYPE_LABEL[p.itemType] ?? p.itemType}`
  const band = p.mode === 'trend'
    ? `KRW ${(p.trend.priceMinKrw / 10000).toFixed(0)}0k-${(p.trend.priceMaxKrw / 10000).toFixed(0)}0k · ${p.trend.priceBand}`
    : ''
  const brands = p.mode === 'trend' && p.trend.competitors.length ? p.trend.competitors.join(', ') : ''
  const bias = st.reportBias

  const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(rep.title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.65 -apple-system, "Segoe UI", Roboto, sans-serif; color: #14181D; margin: 0; }
  .meta { font-size: 9pt; color: #6B7178; letter-spacing: .02em; text-transform: uppercase; }
  h1 { font-size: 20pt; line-height: 1.25; margin: 6px 0 10px; }
  h2 { font-size: 13pt; margin: 22px 0 6px; }
  h3 { font-size: 11.5pt; margin: 16px 0 4px; }
  .exec { font-size: 11.5pt; padding: 12px 14px; background: #F4F6F8; border-left: 3px solid #5D6CFA; margin: 14px 0 20px; }
  table.facts { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 0 0 18px; }
  table.facts th { text-align: left; width: 26%; color: #6B7178; font-weight: 600; padding: 3px 0; vertical-align: top; }
  table.facts td { padding: 3px 0; vertical-align: top; }
  .imp { display: flex; gap: 10px; padding: 7px 0; border-top: 1px solid #E3E7EC; }
  .imp .area { flex: 0 0 26%; font-weight: 700; font-size: 10pt; }
  .imp .basis { color: #6B7178; font-size: 9pt; margin-top: 2px; }
  ul { margin: 4px 0 4px 18px; padding: 0; }
  li { margin: 2px 0; }
  ol.src { margin: 4px 0 0 18px; padding: 0; font-size: 9pt; word-break: break-all; }
  .foot { margin-top: 26px; padding-top: 10px; border-top: 1px solid #E3E7EC; font-size: 8.5pt; color: #6B7178; }
  @media print { .noprint { display: none } }
  .noprint { position: fixed; top: 12px; right: 12px; }
  .noprint button { font: 600 12px sans-serif; padding: 8px 14px; border-radius: 8px; border: 1px solid #14181D; background: #14181D; color: #fff; cursor: pointer; }
</style></head><body>
<div class="noprint"><button onclick="window.print()">Save as PDF</button></div>

<div class="meta">VRINGON Design Agent · Trend report</div>
<h1>${esc(rep.title)}</h1>

<table class="facts">
  <tr><th>Item</th><td>${esc(item)}</td></tr>
  ${band ? `<tr><th>Price band</th><td>${esc(band)}</td></tr>` : ''}
  ${brands ? `<tr><th>Brands referenced</th><td>${esc(brands)}</td></tr>` : ''}
  <tr><th>Agent mode</th><td>${esc(MODE_LABEL[p.mode])}</td></tr>
  <tr><th>Signals used</th><td>${st.signals.length}</td></tr>
  ${bias ? `<tr><th>Collected</th><td>${esc(bias.publisher)}</td></tr>` : ''}
  ${bias ? `<tr><th>Perspective</th><td>${esc(bias.perspective)}</td></tr>` : ''}
</table>

<div class="exec">${esc(rep.executive_view)}</div>

${rep.design_implications?.length ? `<h2>What to change in the design</h2>
${rep.design_implications.map(d => `<div class="imp"><div class="area">${esc(d.area)}</div><div>${esc(d.guidance)}<div class="basis">From: ${esc(d.basis)}</div></div></div>`).join('')}` : ''}

<h2>Report</h2>
${bodyHtml(rep.body_markdown ?? '')}

${rep.open_questions?.length ? `<h2>Still unverified</h2><ul>${rep.open_questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}

${rep.sources?.length ? `<h2>Sources</h2><ol class="src">${rep.sources.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}

<div class="foot">
  Every claim here traces to a source listed above. Numbers that could not be verified are named in "Still unverified" rather than estimated.
  Costs, if referenced, are rough and exclude duty, freight, vendor margin and defect rate.
</div>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  // 렌더가 끝난 뒤에 인쇄창을 띄운다. 바로 부르면 빈 페이지가 뽑힌다.
  w.onload = () => setTimeout(() => w.print(), 260)
}
