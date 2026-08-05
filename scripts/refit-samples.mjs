// ── 저장된 샘플의 착용·컨셉 컷만 새 프롬프트로 다시 뽑는다 ──────────
// 조사·스펙·스케치·렌더·베리에이션은 그대로 두고, 착용 위치가 틀린 컷만 교체한다.
// 반지를 손목에 끼운 사진 하나 때문에 45분짜리 실행을 통째로 다시 돌릴 이유는 없다.
//
//   node scripts/refit-samples.mjs sample_jewel_ring sample_jewel_hoop
//
// 서버(npm run dev)가 떠 있어야 한다.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.API ?? 'http://localhost:5188'

const { Agent, fetch: uf } = await import('undici')
const agent = new Agent({ headersTimeout: 15 * 60_000, bodyTimeout: 15 * 60_000 })

// 착용 위치 · aiClient.ts 의 WEAR_SPOT 과 같은 내용을 여기서도 쓴다
const SPOT = {
  band: { on: 'worn on the ring finger of one hand', framing: [
    'macro close-up of a relaxed hand, fingers slightly curled, the ring on the ring finger filling the frame',
    'close crop of two hands resting together, the ring on the ring finger clearly readable, the other hand out of focus behind',
  ] },
  stud: { on: 'worn in the earlobe', framing: [
    'tight profile crop of one ear and jawline, hair tucked behind the ear, the earring reading clearly, eyes out of frame',
    'three-quarter crop of the side of the head from cheekbone to shoulder, hair pulled back, the earring catching the light',
  ] },
  pendant: { on: 'worn around the neck, sitting on the collarbone', framing: [
    'close crop from chin to upper chest, plain neckline, the necklace lying naturally on the skin',
    'three-quarter crop of the neck and shoulder, the chain following the collarbone, the pendant centred',
  ] },
  bangle: { on: 'worn on the wrist', framing: [
    'close crop of a forearm and wrist held across the body, the bracelet sitting just above the wrist bone',
    'close crop of a hand resting on a surface, the bracelet on the wrist, fingers relaxed and out of focus',
  ] },
}
const ALIAS = {
  solitaire: 'band', eternity: 'band', signet: 'band',
  hoop: 'stud', drop: 'stud', ear_cuff: 'stud',
  choker: 'pendant', chain: 'pendant', station: 'pendant',
  chain_bracelet: 'bangle', cuff: 'bangle', tennis: 'bangle',
}
const spotOf = (item) => SPOT[ALIAS[item] ?? item] ?? SPOT.band

const PERSONAS = [
  'a woman in her twenties, elegant neck and shoulder line, simple slip dress in a neutral tone, hair pulled back',
  'a person in their thirties, hands in frame, rolled sleeves, unpolished natural setting',
]

function wearPrompt(item, i) {
  const s = spotOf(item)
  return [
    'Keep this exact product: same design, same materials, same proportions, same colour, same hardware.',
    `Show it being worn by a real person. It is ${s.on}.`,
    `Framing: ${s.framing[i % s.framing.length]}.`,
    'Plain seamless light grey studio backdrop, soft even studio light, the product sharp and unmistakably the subject.',
    'Photorealistic editorial campaign photography.',
    `Do not place it anywhere other than where it belongs — it is ${s.on}, nowhere else.`,
    'Do not redesign the product. Do not show a face. No text, no logo, no watermark.',
  ].join(' ')
}

function conceptPrompt(item, subject, k, mood) {
  const s = spotOf(item)
  const persona = PERSONAS[k % PERSONAS.length]
  if (k % 3 === 0) {
    return { label: 'Virtual fitting', persona: k % 2 ? 'Quiet artisan' : 'Studio muse', prompt: [
      'Keep this exact product: same design, materials, proportions, colour and hardware.',
      `Place it on a model: ${persona}. The piece is ${s.on}.`,
      'Editorial campaign frame, the product clearly visible and in sharp focus, natural pose, plain studio backdrop with soft directional light.',
      mood ? `Mood: ${mood}.` : '',
      `Photorealistic fashion photography. It goes ${s.on} and nowhere else.`,
      'Do not redesign the product. No text, no logo, no watermark.',
    ].filter(Boolean).join(' ') }
  }
  if (k % 3 === 1) {
    return { label: 'Studio concept', persona: 'Studio muse', prompt: [
      'Keep this exact product: same design, materials, proportions and colour.',
      `Restage it as a concept still life: the ${subject} on a sculpted plinth in a studio set, coloured seamless backdrop, one hard directional light with a soft fill, a long clean shadow, a single prop echoing the mood.`,
      mood ? `Mood: ${mood}.` : '',
      'High-end editorial product photography, shallow depth of field. Do not redesign the product. No text, no logo, no watermark, no human.',
    ].filter(Boolean).join(' ') }
  }
  return { label: 'Location concept', persona: 'Quiet artisan', prompt: [
    'Keep this exact product: same design, materials, proportions and colour.',
    `Place the ${subject} in a real location that carries the mood: natural daylight, a textured surface underneath, the setting visible but out of focus behind.`,
    mood ? `The location should read as: ${mood}.` : '',
    'Photorealistic editorial photography, the product sharp and centred. Do not redesign the product. No text, no logo, no watermark, no human.',
  ].filter(Boolean).join(' ') }
}

async function edit(baseHash, prompt, engine) {
  const r = await uf(`${API}/api/image/edit`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, dispatcher: agent,
    body: JSON.stringify({ baseHash, prompt, engine }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error ?? `edit ${r.status}`)
  return j
}

const names = process.argv.slice(2)
if (!names.length) { console.error('사용법: node scripts/refit-samples.mjs <sample_id> [...]'); process.exit(1) }

for (const name of names) {
  const file = join(ROOT, 'src', 'samples', `${name}.json`)
  if (!existsSync(file)) { console.log(`${name}: 파일 없음, 건너뜀`); continue }
  const st = JSON.parse(readFileSync(file, 'utf8'))
  const item = st.params.itemType
  const engine = st.params.imageEngine ?? 'fast'
  const subject = item.replace(/_/g, ' ')
  const mood = (st.params.brand?.toneWords ?? []).join(', ')
  console.log(`\n=== ${name} · ${st.params.category}/${item} → ${spotOf(item).on}`)

  let redone = 0
  for (const d of st.designs) {
    const base = d.images.find(i => i.origin === 'generated' && !['sketch'].includes(i.view))
    if (!base) continue
    const baseHash = /([a-f0-9]{8,64})\.(png|webp)$/.exec(base.url)?.[1] ?? base.hash

    let wi = 0, ci = 0
    for (let n = 0; n < d.images.length; n++) {
      const im = d.images[n]
      if (im.view !== 'wear' && im.view !== 'concept') continue
      try {
        const prompt = im.view === 'wear'
          ? wearPrompt(item, wi++)
          : conceptPrompt(item, subject, ci, mood).prompt
        const meta = im.view === 'concept' ? conceptPrompt(item, subject, ci, mood) : null
        if (im.view === 'concept') ci++
        const r = await edit(baseHash, prompt, engine)
        d.images[n] = {
          ...im, url: `/samples/${r.hash}.webp`, hash: r.hash,
          ...(meta ? { conceptLabel: meta.label, persona: meta.persona } : {}),
        }
        redone++
        process.stdout.write(`  ${d.spec.design_id} ${im.view} ok\n`)
      } catch (e) {
        process.stdout.write(`  ${d.spec.design_id} ${im.view} 실패 · ${String(e.message).slice(0, 70)}\n`)
      }
    }
  }
  writeFileSync(file, JSON.stringify(st, null, 1))
  console.log(`  다시 뽑은 컷: ${redone}`)
}
console.log('\n끝. public/samples 로 옮기려면 scripts/sync-sample-assets.mjs 를 돌린다.')
