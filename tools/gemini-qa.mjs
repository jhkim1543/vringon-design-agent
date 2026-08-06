// ── Gemini 품질 감사 · 완성된 Run의 산출물을 제3의 모델이 심사한다 ──────
// 사용: node tools/gemini-qa.mjs <run-summary.json> [out.json]
// run-summary.json 형식: { name, endStage, params, signals, reportExcerpt, dossierExcerpt,
//                          competitors, designs:[{id,tier,spec,ruleFails,qa}], images:[{label,hash}] }
// 이미지 hash는 .cache/images/<hash>.png 에서 읽어 함께 보낸다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const CACHE = join(ROOT, '.cache', 'images')

function loadEnv() {
  const out = {}
  for (const f of ['.env.local', '.env']) {
    const p = join(ROOT, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return out
}
const env = { ...loadEnv(), ...process.env }
const KEY = env.GEMINI_API_KEY || env.GOOGLE_API_KEY
if (!KEY) { console.error('GEMINI_API_KEY not set'); process.exit(1) }

const MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-pro']

const [, , inFile, outFile] = process.argv
if (!inFile) { console.error('usage: node tools/gemini-qa.mjs <run-summary.json> [out.json]'); process.exit(1) }
const summary = JSON.parse(readFileSync(inFile, 'utf8'))

const parts = []
parts.push({
  text: `You are a senior footwear product director and design-tool UX reviewer auditing the output of an AI footwear design agent.
The agent fixed a Footwear Line Profile, researched competitors and trends on the live web, generated technical sketches and
photoreal renders, campaign shots, and a 3D model. Below is a structured summary of one full run, followed by the actual
generated images (each labelled).

Judge honestly and concretely. For every issue, say exactly what is wrong and what change would fix it.
Focus areas:
1. Research quality: are signals specific and design-actionable? Are competitor entries line-level with real evidence?
   Is anything invented or vague?
2. Design output quality: do the images plausibly match the spec (toe shape, stack, closure, midsole)? Are sketches truly
   technical line drawings? Do views look like the SAME product? Any AI artefacts (warped lasts, fused laces, floating parts)?
3. Report and prose quality: professional buyer's-guide tone? Any leftover markdown symbols (##, **, bullet dashes),
   arrows, or filler phrases?
4. Pipeline coherence: does the sketch-to-design-to-campaign chain read as one product line? Does the tier logic
   (Core reuses tooling, Signature opens tooling) hold in the data?
5. What is missing that a footwear merchandiser would need before a real line review?

Respond ONLY with JSON matching:
{
  "overall_score": 0-10,
  "verdict": "one paragraph",
  "strengths": ["..."],
  "issues": [{"area": "research|design_image|prose|pipeline|ux", "severity": "high|medium|low", "detail": "...", "fix": "..."}]
}

RUN SUMMARY:
${JSON.stringify(summary, (k, v) => k === 'images' ? undefined : v, 1).slice(0, 28000)}`,
})

let sent = 0
for (const im of (summary.images ?? []).slice(0, 10)) {
  const p = join(CACHE, `${im.hash}.png`)
  if (!existsSync(p)) continue
  parts.push({ text: `IMAGE: ${im.label}` })
  parts.push({ inline_data: { mime_type: 'image/png', data: readFileSync(p).toString('base64') } })
  sent++
}
console.error(`sending ${sent} images`)

async function ask(model) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  })
  if (!r.ok) throw new Error(`${model} ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const j = await r.json()
  const text = j.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
  if (!text) throw new Error(`${model}: empty response`)
  return { model, review: JSON.parse(text) }
}

let result = null
for (const m of MODELS) {
  try { result = await ask(m); break }
  catch (e) { console.error(String(e.message).slice(0, 200)) }
}
if (!result) { console.error('all models failed'); process.exit(1) }
const out = JSON.stringify(result, null, 2)
if (outFile) writeFileSync(outFile, out)
console.log(out)
