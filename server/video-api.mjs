// ── 컨셉 영상 ───────────────────────────────────────────────────────
// 유료 영상 API를 붙이지 않는다. 오픈소스 경로 두 가지를 둔다.
//
//  1) ComfyUI 백엔드 (권장 · 무료 · 오픈소스)
//     ComfyUI(https://github.com/comfyanonymous/ComfyUI)를 로컬에 띄우고,
//     이미지→영상 워크플로를 API 형식(JSON)으로 저장해 두면 여기서 그대로 실행한다.
//     검증된 오픈 웨이트 조합:
//       · Wan 2.2 I2V      https://github.com/Wan-Video/Wan2.2         (Apache-2.0)
//       · LTX-Video        https://github.com/Lightricks/LTX-Video     (오픈 웨이트, 빠름)
//       · CogVideoX        https://github.com/THUDM/CogVideo           (Apache-2.0)
//       · Stable Video Diffusion  https://github.com/Stability-AI/generative-models
//     .env 에 COMFY_URL=http://127.0.0.1:8188 과
//            COMFY_I2V_WORKFLOW=workflows/i2v.json 을 넣으면 켜진다.
//
//  2) 폴백 (GPU 없이도 항상 된다)
//     생성해 둔 컨셉 스틸을 이용해 카메라 무빙(줌·팬)만 있는 짧은 클립을
//     애니메이션 WebP로 만든다. ffmpeg 없이 sharp만으로 만든다.
//     생성 모델이 만든 움직임은 아니지만, 보드에서 "영상 자리"가 비지 않는다.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

let sharpMod = null
async function getSharp() {
  if (sharpMod === null) {
    try { sharpMod = (await import('sharp')).default } catch { sharpMod = false }
  }
  return sharpMod
}

function videoDir(root) {
  const d = join(root, '.cache', 'video')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

/** ComfyUI가 실제로 떠 있는지 확인 */
export async function comfyProbe(comfyUrl) {
  if (!comfyUrl) return { available: false, reason: 'No COMFY_URL set' }
  try {
    const r = await fetch(`${comfyUrl}/system_stats`, { signal: AbortSignal.timeout(2500) })
    if (!r.ok) return { available: false, reason: `ComfyUI ${r.status}` }
    const j = await r.json()
    return { available: true, device: j?.devices?.[0]?.name ?? 'unknown' }
  } catch (e) {
    return { available: false, reason: String(e.message || e).slice(0, 80) }
  }
}

/** 워크플로 JSON 안의 자리표시자를 실제 값으로 바꾼다.
 *  워크플로에 "%IMAGE%", "%PROMPT%", "%SEED%" 를 넣어 두면 여기서 채운다. */
function fillWorkflow(tpl, { imageName, prompt, seed }) {
  const text = JSON.stringify(tpl)
    .split('%IMAGE%').join(imageName)
    .split('%PROMPT%').join(String(prompt).replace(/"/g, '\\"'))
    .split('%SEED%').join(String(seed))
  return JSON.parse(text)
}

async function comfyUpload(comfyUrl, buf, name) {
  const form = new FormData()
  form.append('image', new Blob([buf], { type: 'image/png' }), name)
  form.append('overwrite', 'true')
  const r = await fetch(`${comfyUrl}/upload/image`, { method: 'POST', body: form })
  if (!r.ok) throw new Error(`ComfyUI upload ${r.status}`)
  const j = await r.json()
  return j.name ?? name
}

async function comfyRun(comfyUrl, workflow, { timeoutMs = 12 * 60_000, onStep } = {}) {
  const q = await fetch(`${comfyUrl}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  })
  if (!q.ok) throw new Error(`ComfyUI prompt ${q.status}: ${(await q.text()).slice(0, 200)}`)
  const { prompt_id } = await q.json()

  const started = Date.now()
  for (;;) {
    if (Date.now() - started > timeoutMs) throw new Error('ComfyUI timed out')
    await new Promise(r => setTimeout(r, 3000))
    const h = await fetch(`${comfyUrl}/history/${prompt_id}`)
    if (!h.ok) continue
    const hist = await h.json()
    const entry = hist[prompt_id]
    if (!entry) { onStep?.(Math.round((Date.now() - started) / 1000)); continue }
    const outputs = entry.outputs ?? {}
    for (const nodeId of Object.keys(outputs)) {
      const o = outputs[nodeId]
      const file = (o.gifs ?? o.videos ?? o.images ?? [])[0]
      if (file?.filename) return file
    }
    if (entry.status?.completed) throw new Error('ComfyUI finished but produced no video output')
  }
}

/** ComfyUI 경로 · 실제 오픈소스 영상 모델이 만든 클립 */
export async function generateVideoComfy(root, {
  comfyUrl, workflowPath, baseImagePath, prompt, seed = 12345, onStep,
}) {
  const tplPath = join(root, workflowPath)
  if (!existsSync(tplPath)) throw new Error(`Workflow file not found: ${workflowPath}`)
  const tpl = JSON.parse(readFileSync(tplPath, 'utf8'))
  const imageName = await comfyUpload(comfyUrl, readFileSync(baseImagePath), `vringon_${Date.now()}.png`)
  const wf = fillWorkflow(tpl, { imageName, prompt, seed })
  const file = await comfyRun(comfyUrl, wf, { onStep })

  const url = new URL(`${comfyUrl}/view`)
  url.searchParams.set('filename', file.filename)
  if (file.subfolder) url.searchParams.set('subfolder', file.subfolder)
  url.searchParams.set('type', file.type ?? 'output')
  const r = await fetch(url)
  if (!r.ok) throw new Error(`ComfyUI view ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())

  const ext = /\.(webp|gif|mp4|webm)$/i.exec(file.filename)?.[1] ?? 'mp4'
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 24)
  writeFileSync(join(videoDir(root), `${hash}.${ext}`), buf)
  return { hash, ext, backend: 'comfyui', cached: false }
}

/** 폴백 · 스틸 한 장에서 카메라 무빙만 있는 짧은 클립을 만든다.
 *  생성 모델의 움직임은 아니다. 그 점을 UI에서도 그대로 표기한다. */
export async function generateVideoFallback(root, { baseImagePath, frames = 24, sizeOut = 640 }) {
  const sharp = await getSharp()
  if (!sharp) throw new Error('sharp is not installed, so the fallback clip cannot be built')

  const src = readFileSync(baseImagePath)
  const hash = createHash('sha256').update(src).update(`kb${frames}${sizeOut}`).digest('hex').slice(0, 24)
  const out = join(videoDir(root), `${hash}.webp`)
  if (existsSync(out)) return { hash, ext: 'webp', backend: 'kenburns', cached: true }

  const meta = await sharp(src).metadata()
  const W = meta.width ?? 1024
  const H = meta.height ?? 1024

  // 천천히 밀고 들어가면서 살짝 옆으로 흐른다. 급하게 움직이면 제품이 뭉개져 보인다.
  const buffers = []
  for (let i = 0; i < frames; i++) {
    const t = i / (frames - 1)
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    const zoom = 1 - 0.16 * ease
    const cw = Math.round(W * zoom)
    const ch = Math.round(H * zoom)
    const left = Math.round((W - cw) * (0.30 + 0.40 * ease))
    const top = Math.round((H - ch) * (0.55 - 0.15 * ease))
    buffers.push(await sharp(src)
      .extract({ left, top, width: cw, height: ch })
      .resize(sizeOut, sizeOut, { fit: 'cover' })
      .toBuffer())
  }

  // 애니메이션 WebP · sharp 0.33+ 의 join 으로 프레임 배열을 그대로 묶는다
  const webp = await sharp(buffers, { join: { animated: true } })
    .webp({ quality: 82, loop: 0, delay: Math.round(1000 / 12), effort: 4 })
    .toBuffer()

  writeFileSync(out, webp)
  return { hash, ext: 'webp', backend: 'kenburns', cached: false }
}
