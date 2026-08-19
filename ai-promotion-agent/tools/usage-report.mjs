// ── 사용량 장부 → 비용표 ──────────────────────────────────────────────
//
// .cache/usage/*.jsonl 을 읽어 Run 별·기능별로 합산하고 비용을 계산한다.
// 토큰·장수는 실측이다. 단가만 아래 RATES 에 있고, 단가는 공급사가 바꾸면 여기만 고친다.
//
//   node tools/usage-report.mjs                 오늘
//   node tools/usage-report.mjs --all           전부
//   node tools/usage-report.mjs --run <id>      한 Run 만 (부분 일치)
//   node tools/usage-report.mjs --json          기계용 출력
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, '.cache', 'usage')

// ── 단가 · USD ────────────────────────────────────────────────────────
// 여기 있는 숫자만 가정이다. 나머지는 전부 장부의 실측이다.
// 모델 id 로 찾고, 못 찾으면 kind 의 기본값을 쓴다. 바뀌면 여기만 고친다.
const RATES = {
  // 추론 · 1M 토큰당. input / cached input / output (reasoning 은 output 에 포함돼 과금된다)
  inference: {
    default: { in: 1.25, cachedIn: 0.125, out: 10.0 },
  },
  // 검색 · 1회당. Responses API 의 web_search 도구
  search: 0.01,
  // 이미지 · 1장당. 모델 id → 단가. 코드의 imageEngines.ts 와 같은 값
  image: {
    'gpt-image-1.5': 0.045,
    'gpt-image-2': 0.190,
    default: 0.190,
  },
  // 3D · 1건당
  model3d: { default: 0.30 },
}

const args = process.argv.slice(2)
const all = args.includes('--all')
const asJson = args.includes('--json')
const runFilter = args.includes('--run') ? args[args.indexOf('--run') + 1] : null

if (!existsSync(DIR)) { console.log('장부 없음 · .cache/usage/ 가 비어 있다. 서버를 새 코드로 다시 띄운 뒤 Run 을 돌리면 생긴다.'); process.exit(0) }

const files = readdirSync(DIR).filter(f => f.endsWith('.jsonl')).sort()
const today = new Date().toISOString().slice(0, 10)
const chosen = all ? files : files.filter(f => f.startsWith(today))
if (!chosen.length) { console.log(`오늘(${today}) 장부 없음 · --all 로 전부 보거나, Run 을 먼저 돌려라.`); process.exit(0) }

const rows = []
for (const f of chosen) {
  for (const line of readFileSync(join(DIR, f), 'utf8').split('\n')) {
    if (!line.trim()) continue
    try { rows.push(JSON.parse(line)) } catch { /* 깨진 줄은 건너뛴다 */ }
  }
}
const filtered = runFilter ? rows.filter(r => String(r.run).includes(runFilter)) : rows

function costOf(r) {
  if (r.kind === 'inference') {
    const rate = RATES.inference[r.model] ?? RATES.inference.default
    const tok = ((r.in - r.cachedIn) * rate.in + r.cachedIn * rate.cachedIn + r.out * rate.out) / 1e6
    const search = (r.searches ?? 0) * RATES.search
    return { tokens: tok, search, total: tok + search }
  }
  if (r.kind === 'image') {
    const rate = RATES.image[r.model] ?? RATES.image.default
    return { tokens: 0, search: 0, total: (r.units ?? 0) * rate }
  }
  if (r.kind === 'model3d') {
    const rate = RATES.model3d[r.model] ?? RATES.model3d.default
    return { tokens: 0, search: 0, total: (r.units ?? 0) * rate }
  }
  return { tokens: 0, search: 0, total: 0 }
}

// ── 집계 ──
const byRun = new Map()
for (const r of filtered) {
  const c = costOf(r)
  if (!byRun.has(r.run)) byRun.set(r.run, { run: r.run, calls: 0, cachedCalls: 0, in: 0, out: 0, reasoning: 0, searches: 0, images: 0, models: 0, usd: 0, byName: new Map(), first: r.t, last: r.t })
  const g = byRun.get(r.run)
  g.calls++; if (r.cached) g.cachedCalls++
  g.in += r.in; g.out += r.out; g.reasoning += r.reasoning; g.searches += r.searches ?? 0
  if (r.kind === 'image') g.images += r.units ?? 0
  if (r.kind === 'model3d') g.models += r.units ?? 0
  g.usd += c.total
  if (r.t < g.first) g.first = r.t
  if (r.t > g.last) g.last = r.t
  const key = r.name + (r.kind === 'image' ? ` (${r.engine ?? r.model})` : '')
  if (!g.byName.has(key)) g.byName.set(key, { calls: 0, cached: 0, in: 0, out: 0, reasoning: 0, searches: 0, units: 0, usd: 0 })
  const n = g.byName.get(key)
  n.calls++; if (r.cached) n.cached++
  n.in += r.in; n.out += r.out; n.reasoning += r.reasoning; n.searches += r.searches ?? 0; n.units += r.units ?? 0; n.usd += c.total
}

const usd = v => `$${v.toFixed(2)}`
const k = v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)

if (asJson) {
  const out = [...byRun.values()].map(g => ({ ...g, byName: Object.fromEntries(g.byName) }))
  console.log(JSON.stringify(out, null, 1)); process.exit(0)
}

console.log(`장부 ${chosen.length}일치 · 줄 ${filtered.length}개 · Run ${byRun.size}개`)
console.log(`단가는 tools/usage-report.mjs 의 RATES 만 가정. 토큰·장수·검색 수는 전부 실측.\n`)

for (const g of [...byRun.values()].sort((a, b) => a.first.localeCompare(b.first))) {
  const mins = Math.round((Date.parse(g.last) - Date.parse(g.first)) / 60000)
  console.log(`══ ${g.run}`)
  console.log(`   호출 ${g.calls} (캐시 ${g.cachedCalls}) · ${mins}분 · 입력 ${k(g.in)} · 출력 ${k(g.out)} (추론 ${k(g.reasoning)}) · 검색 ${g.searches} · 이미지 ${g.images} · 3D ${g.models}`)
  console.log(`   ▶ 합계 ${usd(g.usd)}`)
  const names = [...g.byName.entries()].sort((a, b) => b[1].usd - a[1].usd)
  for (const [name, n] of names) {
    const parts = []
    if (n.in || n.out) parts.push(`in ${k(n.in)} / out ${k(n.out)}` + (n.reasoning ? ` (추론 ${k(n.reasoning)})` : ''))
    if (n.searches) parts.push(`검색 ${n.searches}`)
    if (n.units) parts.push(`${n.units}건`)
    if (n.cached) parts.push(`캐시 ${n.cached}`)
    console.log(`     ${name.padEnd(30)} ${String(n.calls).padStart(3)}회  ${usd(n.usd).padStart(8)}   ${parts.join(' · ')}`)
  }
  console.log()
}

const total = [...byRun.values()].reduce((a, g) => a + g.usd, 0)
console.log(`전체 ${usd(total)}`)
