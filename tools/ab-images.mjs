// ── 같은 프롬프트, 두 곳 · 나란히 놓고 눈으로 고른다 ──────────────────
//
// 사내 GPU 로 바꿀지는 구조가 아니라 그림이 정한다. 지금 샘플이 실제로 쓴 프롬프트를
// 그대로 꺼내, 바깥과 사내에서 한 장씩 뽑아 HTML 한 장에 붙인다.
//
//   node tools/ab-images.mjs                 스케치 3 · 렌더 3
//   node tools/ab-images.mjs 6               각각 6장
//
// 서버(포트 5188)가 떠 있어야 하고, .env 에 LOCAL_IMAGE_URL 이 있어야 한다.
// 이 스크립트는 INFER_IMAGE 설정을 건드리지 않는다 — 두 경로를 직접 부른다.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'http://localhost:5188'
const N = parseInt(process.argv[2] ?? '3', 10)

const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))

const LOCAL = (env.LOCAL_IMAGE_URL || '').replace(/\/+$/, '')
if (!LOCAL) { console.error('LOCAL_IMAGE_URL is not in .env — nothing to compare against'); process.exit(1) }

// 샘플이 실제로 쓴 프롬프트를 꺼낸다. 새로 지어내면 비교가 무의미하다.
const st = JSON.parse(readFileSync(join(ROOT, 'src/samples/sample_trend_chelsea.json'), 'utf8'))
const all = st.designs.flatMap(d => d.images.filter(i => i.promptUsed).map(i => ({
  view: i.view, prompt: i.promptUsed, design: d.spec.design_id,
})))
const sketches = all.filter(i => i.view === 'sketch' || i.view === 'sketch_var').slice(0, N)
const renders = all.filter(i => i.view !== 'sketch' && i.view !== 'sketch_var').slice(0, N)
const picks = [...sketches, ...renders]
if (!picks.length) { console.error('no stored prompts in the sample'); process.exit(1) }

const hosted = async (prompt, engine) => {
  const r = await fetch(`${BASE}/api/image/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, engine }),
  })
  const j = await r.json()
  if (j.error) throw new Error(j.error)
  return { src: `${BASE}${j.url ?? `/api/image/file/${j.hash}.png`}`, note: j.cached ? 'cached' : 'fresh' }
}

const local = async (prompt) => {
  const t0 = Date.now()
  const r = await fetch(`${LOCAL}/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, width: 1024, height: 1024 }),
  })
  if (!r.ok) throw new Error(`local ${r.status}: ${(await r.text()).slice(0, 160)}`)
  const j = await r.json()
  return { src: `data:image/png;base64,${j.image_b64}`, note: `${Math.round((Date.now() - t0) / 1000)}s` }
}

const rows = []
for (const [i, p] of picks.entries()) {
  const isSketch = p.view === 'sketch' || p.view === 'sketch_var'
  process.stdout.write(`${i + 1}/${picks.length} ${p.design} ${p.view} … `)
  const [a, b] = await Promise.all([
    hosted(p.prompt, isSketch ? 'fast' : 'detail').catch(e => ({ src: '', note: `실패: ${e.message}` })),
    local(p.prompt).catch(e => ({ src: '', note: `실패: ${e.message}` })),
  ])
  console.log(`밖 ${a.note} · 안 ${b.note}`)
  rows.push({ ...p, a, b })
}

const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
const html = `<!doctype html><meta charset="utf-8"><title>같은 프롬프트, 두 곳</title>
<style>
 body{font:14px/1.6 system-ui;background:#0f1217;color:#e6e9ef;margin:0;padding:28px}
 h1{font-size:18px;margin:0 0 4px} p.sub{color:#8b93a3;margin:0 0 24px}
 .row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:0 0 34px}
 .row h2{grid-column:1/-1;font-size:13px;margin:0;color:#8b93a3;font-weight:600}
 figure{margin:0}figcaption{color:#8b93a3;font-size:12px;margin-top:6px}
 img{width:100%;background:#fff;border-radius:8px;display:block;aspect-ratio:1}
 .empty{aspect-ratio:1;display:grid;place-items:center;border:1px dashed #2a3040;border-radius:8px;color:#8b93a3;font-size:12px;padding:16px;text-align:center}
 pre{grid-column:1/-1;white-space:pre-wrap;color:#6f7789;font-size:11px;margin:8px 0 0;border-top:1px solid #1c212c;padding-top:8px}
</style>
<h1>같은 프롬프트, 두 곳</h1>
<p class="sub">왼쪽이 지금 쓰는 바깥, 오른쪽이 사내 GPU. 프롬프트는 샘플이 실제로 쓴 것 그대로입니다.</p>
${rows.map(r => `<section class="row">
 <h2>${esc(r.design)} · ${esc(r.view)}</h2>
 <figure>${r.a.src ? `<img src="${r.a.src}">` : `<div class="empty">${esc(r.a.note)}</div>`}<figcaption>밖 · ${esc(r.a.note)}</figcaption></figure>
 <figure>${r.b.src ? `<img src="${r.b.src}">` : `<div class="empty">${esc(r.b.note)}</div>`}<figcaption>사내 · ${esc(r.b.note)}</figcaption></figure>
 <pre>${esc(r.prompt)}</pre>
</section>`).join('\n')}`

const out = join(ROOT, '.cache', 'ab-images.html')
writeFileSync(out, html)
console.log(`\n→ ${out}`)
