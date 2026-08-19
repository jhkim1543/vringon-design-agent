// ── 수집 사진 감사 · 어떤 사이트에서 사진이 실패하는지 호스트별로 센다 ──
// 유료 스크래핑 프록시가 필요한지는 감이 아니라 이 표를 보고 정한다.
// 사용: node tools/shot-audit.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// 서버가 실제로 쓰는 수집기를 그대로 부른다. 감사와 실물이 갈라지면 감사가 무의미하다.
import { fetchShotImage, shotFromPage } from '../server/openai-api.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RES = join(ROOT, '.cache', 'research')

const host = (u) => { try { return new URL(u).host.replace(/^www\./, '') } catch { return '?' } }
const tryImage = (u, referer) => fetchShotImage(u, referer)
const fromPage = (p) => shotFromPage(p)

// 캐시된 조사 결과에서 제품을 모은다 (브랜드 조사 + 백화점 펄스)
const products = []
if (existsSync(RES)) {
  for (const f of readdirSync(RES)) {
    let j
    try { j = JSON.parse(readFileSync(join(RES, f), 'utf8')) } catch { continue }
    for (const p of j.products ?? []) {
      if (!p.model_name) continue
      products.push({
        who: `${p.retailer ? p.retailer.split(' ')[0] + ' ' : ''}${p.brand} ${p.model_name}`.slice(0, 46),
        imgs: p.image_urls ?? [],
        page: p.product_url ?? '',
      })
    }
  }
}
// 같은 제품이 여러 캐시에 겹친다. 페이지 주소로 중복을 없앤다.
const seen = new Set()
const uniq = products.filter(p => {
  const k = p.page || p.imgs[0] || p.who
  if (seen.has(k)) return false
  seen.add(k); return true
})

console.log(`감사 대상 ${uniq.length}개 제품\n`)

const byHost = new Map()
const note = (h, field) => {
  const e = byHost.get(h) ?? { direct: 0, og: 0, fail: 0, total: 0 }
  e[field]++; e.total++
  byHost.set(h, e)
}

const rows = []
for (const p of uniq) {
  const h = host(p.page || p.imgs[0] || '')
  let how = null, why = ''
  for (const u of p.imgs) {
    try { await tryImage(u, p.page || undefined); how = 'direct'; break }
    catch (e) { why = String(e.message) }
  }
  if (!how && p.page) {
    try { await tryImage(await fromPage(p.page), p.page); how = 'og' }
    catch (e) { why = String(e.message) }
  }
  note(h, how ?? 'fail')
  rows.push(`${how ? (how === 'direct' ? 'OK  ' : 'OG  ') : 'FAIL'} ${h.padEnd(26)} ${p.who}${how ? '' : '  ← ' + why}`)
}

console.log(rows.sort().join('\n'))
console.log('\n호스트별')
const totals = { direct: 0, og: 0, fail: 0, total: 0 }
for (const [h, e] of [...byHost.entries()].sort((a, b) => b[1].total - a[1].total)) {
  for (const k of Object.keys(totals)) totals[k] += e[k]
  console.log(`${h.padEnd(28)} 직링크 ${e.direct}  og ${e.og}  실패 ${e.fail}  (${e.total})`)
}
const okAll = totals.direct + totals.og
console.log(`\n합계 ${okAll}/${totals.total} 성공 (${Math.round(okAll / Math.max(1, totals.total) * 100)}%) · 직링크 ${totals.direct} · og 폴백 ${totals.og} · 실패 ${totals.fail}`)
