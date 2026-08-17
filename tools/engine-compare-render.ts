// ── fast 스케치가 detail 렌더에 어떻게 이어지는가 ────────────────────
//
// 기준 렌더는 스케치의 *편집*이다 (pipeline.ts: editImage(sketchIm.hash, renderFromSketchPrompt)).
// 즉 스케치를 fast 로 그리면 그 선화가 렌더의 입력이 된다. 스케치가 소재 해칭을 덜 담으면
// 렌더가 그걸 읽지 못할 수 있다. 이건 앞선 비교(engine-compare.ts)가 못 본 연결이다.
//
// 같은 스펙 · fast 스케치와 detail 스케치를 각각 그린 뒤 · 둘 다 detail 렌더로 편집한다.
//   npx esbuild tools/engine-compare-render.ts --bundle --platform=node --format=esm \
//     --outfile=.cache/engine-compare-render.mjs --external:undici \
//     --define:import.meta.env='{"BASE_URL":"/","VITE_API_BASE":"http://localhost:8080"}' --loader:.json=json
//   node .cache/engine-compare-render.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { sketchPrompt, renderFromSketchPrompt } from '../src/core/aiClient'
import type { DesignSpec } from '../src/core/types'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: () => {}, removeItem: () => {} }
;(globalThis as any).document = { documentElement: { lang: 'ko' } }
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ko-KR' }, configurable: true })

const ROOT = process.cwd()
const API = 'http://localhost:8080'
const OUT = join(ROOT, '.cache', 'engine-compare')
mkdirSync(OUT, { recursive: true })

const st = JSON.parse(readFileSync(join(ROOT, 'src', 'samples', 'sample_trend_running.json'), 'utf8'))
const d = st.designs.find((x: any) => x.spec.genome && x.images.some((i: any) => i.view === 'sketch'))
const spec: DesignSpec = d.spec

async function call(path: string, body: object, label: string) {
  const t0 = Date.now()
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(400_000) })
  const j = await r.json()
  if (!r.ok) { console.log(`  ${label}: 실패 ${j.error}`); return null }
  const buf = Buffer.from(await (await fetch(`${API}/api/image/file/${j.hash}.png`)).arrayBuffer())
  writeFileSync(join(OUT, `${label}.png`), buf)
  console.log(`  ${label}: ${Math.round((Date.now() - t0) / 1000)}s · cached=${j.cached}`)
  return j.hash as string
}

async function main() {
  console.log(`스펙: ${spec.design_id}\n`)
  // 스케치 둘 · 앞선 비교와 같은 프롬프트라 캐시에 있다 (재과금 없음)
  const skFast = await call('/api/image/generate', { prompt: sketchPrompt(spec, 'fast'), size: '1024x1024', engine: 'fast' }, '1-sketch-fast')
  const skDetail = await call('/api/image/generate', { prompt: sketchPrompt(spec, 'detail'), size: '1024x1024', engine: 'detail' }, '1-sketch-detail')
  if (!skFast || !skDetail) return

  // 렌더 · 프롬프트는 같고, 입력 스케치만 다르다. 둘 다 detail 로.
  const rp = renderFromSketchPrompt(spec, null, undefined, undefined)
  console.log(`\n렌더 프롬프트 ${rp.length}자 · 둘 다 detail 엔진 · 입력 스케치만 다름`)
  await call('/api/image/edit', { baseHash: skFast, prompt: rp, size: '1024x1024', engine: 'detail' }, '3-render-from-fast-sketch')
  await call('/api/image/edit', { baseHash: skDetail, prompt: rp, size: '1024x1024', engine: 'detail' }, '3-render-from-detail-sketch')
  console.log(`\n→ ${OUT}`)
}
main().catch(e => { console.error('FAILED', e); process.exit(1) })
