// ── 두 이미지 엔진을 같은 조건에서 비교한다 ─────────────────────────
//
// 단가만 보고 "fast 로 내려도 품질은 같다"고 말할 수는 없다. 두 가지가 다르기 때문이다.
//   ① 스케치·기준 렌더는 shapePrompt 가 엔진별로 다른 프롬프트를 만든다.
//      detail 쪽에만 소재 표현 규칙(스웨이드 해칭·패턴트 스트릭·메쉬 크로스해칭)이 있다.
//   ② 편집(뷰·컬러웨이·컨셉)은 프롬프트가 같고 모델만 바뀐다.
// 그래서 ①과 ②를 따로 찍어 봐야 한다.
//
//   npx esbuild tools/engine-compare.ts --bundle --platform=node --format=esm \
//     --outfile=.cache/engine-compare.mjs --external:undici \
//     --define:import.meta.env='{"BASE_URL":"/","VITE_API_BASE":"http://localhost:8080"}' --loader:.json=json
//   node .cache/engine-compare.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { sketchPrompt } from '../src/core/aiClient'
import { colorwayEditPrompt } from '../src/core/aiClient'
import type { DesignSpec } from '../src/core/types'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: () => {}, removeItem: () => {},
}
;(globalThis as any).document = { documentElement: { lang: 'ko' } }
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ko-KR' }, configurable: true })

const ROOT = process.cwd()
const API = 'http://localhost:8080'
const OUT = join(ROOT, '.cache', 'engine-compare')
mkdirSync(OUT, { recursive: true })

const st = JSON.parse(readFileSync(join(ROOT, 'src', 'samples', 'sample_trend_running.json'), 'utf8'))
const d = st.designs.find((x: any) => x.spec.genome && x.images.some((i: any) => i.view === 'sketch'))
const spec: DesignSpec = d.spec
const baseImg = d.images.find((i: any) => i.origin === 'regenerated_hq' || i.view === 'lateral')

async function gen(prompt: string, engine: 'fast' | 'detail', label: string) {
  const t0 = Date.now()
  const r = await fetch(`${API}/api/image/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, size: '1024x1024', engine }),
    signal: AbortSignal.timeout(400_000),
  })
  const j = await r.json()
  if (!r.ok) { console.log(`  ${label}: 실패 ${j.error}`); return null }
  const sec = Math.round((Date.now() - t0) / 1000)
  const buf = Buffer.from(await (await fetch(`${API}/api/image/file/${j.hash}.png`)).arrayBuffer())
  writeFileSync(join(OUT, `${label}.png`), buf)
  console.log(`  ${label}: ${sec}s · ${(buf.length / 1000).toFixed(0)}KB · cached=${j.cached}`)
  return j.hash
}

async function edt(baseHash: string, prompt: string, engine: 'fast' | 'detail', label: string) {
  const t0 = Date.now()
  const r = await fetch(`${API}/api/image/edit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseHash, prompt, size: '1024x1024', engine }),
    signal: AbortSignal.timeout(400_000),
  })
  const j = await r.json()
  if (!r.ok) { console.log(`  ${label}: 실패 ${j.error}`); return null }
  const sec = Math.round((Date.now() - t0) / 1000)
  const buf = Buffer.from(await (await fetch(`${API}/api/image/file/${j.hash}.png`)).arrayBuffer())
  writeFileSync(join(OUT, `${label}.png`), buf)
  console.log(`  ${label}: ${sec}s · ${(buf.length / 1000).toFixed(0)}KB · cached=${j.cached}`)
  return j.hash
}

async function main() {
  console.log(`비교 대상: ${spec.design_id}\n`)

  // ① 스케치 · 프롬프트가 엔진별로 다르다
  const pFast = sketchPrompt(spec, 'fast')
  const pDetail = sketchPrompt(spec, 'detail')
  console.log(`① 스케치 프롬프트 길이 · fast ${pFast.length}자 / detail ${pDetail.length}자`)
  const matWords = /hatching|streak|cross-hatch|dotted line|napped/gi
  console.log(`   소재 표현 규칙 언급 · fast ${(pFast.match(matWords) ?? []).length}회 / detail ${(pDetail.match(matWords) ?? []).length}회`)
  writeFileSync(join(OUT, 'prompt-fast.txt'), pFast)
  writeFileSync(join(OUT, 'prompt-detail.txt'), pDetail)
  console.log('   그리는 중…')
  await gen(pFast, 'fast', '1-sketch-fast')
  await gen(pDetail, 'detail', '1-sketch-detail')

  // ② 편집 · 프롬프트가 같고 모델만 다르다
  if (baseImg?.hash) {
    const cw = colorwayEditPrompt({ name: 'Deep Cobalt', hex: '#1F49C4', clause: 'Deep Cobalt (#1F49C4) as the dominant colour, applied as the brand wears it', why: 'test' } as any)
    console.log(`\n② 컬러웨이 편집 · 프롬프트 동일(${cw.length}자), 모델만 교체`)
    console.log('   그리는 중…')
    await edt(baseImg.hash, cw, 'fast', '2-edit-fast')
    await edt(baseImg.hash, cw, 'detail', '2-edit-detail')
  } else {
    console.log('\n② 기준 렌더 해시가 없어 편집 비교는 건너뜀')
  }

  console.log(`\n→ ${OUT}`)
}
main().catch(e => { console.error('FAILED', e); process.exit(1) })
