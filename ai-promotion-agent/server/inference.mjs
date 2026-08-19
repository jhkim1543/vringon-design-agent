// ── 추론 라우터 · 역할마다 어디서 돌릴지 정한다 ──────────────────────
//
// 지금까지 모든 추론은 밖으로 나갔다. 사내 GPU에 올릴 수 있는 역할은 넷이다:
//   author  게놈 저작·영토 계획·업로드 분석 (텍스트 + 이미지 입력)
//   vision  렌더 검증 (이미지를 보고 스펙과 맞는지 판단)
//   image   스케치·디자인·캠페인 컷 생성과 편집
//   model3d 단일 이미지 → GLB
// 리서치(웹 검색)는 여기 없다. GPU는 검색 색인을 주지 않는다 — 그 레그는 밖에 남는다.
//
// 화면에는 이 파일의 어떤 이름도 나가지 않는다. 사용자가 보는 것은 역할과 "사내/외부"뿐이다.
//
// 켜는 법은 .env 에서만 한다. 값이 없으면 전부 예전대로 밖으로 나간다 —
// 이 파일이 있다는 것만으로 동작이 바뀌지는 않는다.
//   INFER_AUTHOR=local        (기본 hosted)
//   INFER_VISION=local
//   INFER_IMAGE=local
//   INFER_3D=local
//   LOCAL_LLM_URL=http://10.0.0.11:8000/v1     OpenAI 호환 서버 (vLLM·SGLang 등)
//   LOCAL_LLM_MODEL=<서빙 중인 모델 이름>
//   LOCAL_VISION_MODEL=<비전 모델 이름 · 없으면 LOCAL_LLM_MODEL>
//   LOCAL_IMAGE_URL=http://10.0.0.11:8100      h100/serve.py 계약
//   LOCAL_3D_URL=http://10.0.0.11:8200         h100/serve.py 계약
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const env = process.env

export const ROLES = ['author', 'vision', 'image', 'model3d']

const ROLE_ENV = {
  author: 'INFER_AUTHOR',
  vision: 'INFER_VISION',
  image: 'INFER_IMAGE',
  model3d: 'INFER_3D',
}

const LLM_URL = (env.LOCAL_LLM_URL || '').replace(/\/+$/, '')
const IMAGE_URL = (env.LOCAL_IMAGE_URL || '').replace(/\/+$/, '')
const MODEL3D_URL = (env.LOCAL_3D_URL || '').replace(/\/+$/, '')

/** 이 역할이 사내에서 도는가. 주소가 없으면 켜 두었어도 밖으로 나간다 —
 *  주소 없이 local 이라고 적힌 설정 때문에 Run 전체가 죽는 것보다 낫다. */
export function isLocal(role) {
  if (env[ROLE_ENV[role]] !== 'local') return false
  if (role === 'image') return !!IMAGE_URL
  if (role === 'model3d') return !!MODEL3D_URL
  return !!LLM_URL
}

/** /api/status 용 · 어떤 역할이 어디서 도는지. 모델 이름은 여기서만 쓰고 화면에는 안 나간다. */
export function inferenceStatus() {
  return {
    roles: Object.fromEntries(ROLES.map(r => [r, isLocal(r) ? 'local' : 'hosted'])),
    endpoints: {
      llm: LLM_URL ? LLM_URL.replace(/\/\/[^@]*@/, '//') : null,
      image: IMAGE_URL || null,
      model3d: MODEL3D_URL || null,
    },
  }
}

/** 사내 서버가 살아 있는지. 켜기 전에 눌러 보는 자리다. */
export async function localProbe() {
  const out = {}
  const ping = async (name, url, path) => {
    if (!url) { out[name] = { available: false, reason: 'no url set' }; return }
    try {
      const r = await fetch(url + path, { signal: AbortSignal.timeout(6000) })
      if (!r.ok) { out[name] = { available: false, reason: `${r.status}` }; return }
      const j = await r.json().catch(() => ({}))
      out[name] = { available: true, models: j.data?.map?.(m => m.id) ?? j.model ?? null }
    } catch (e) {
      out[name] = { available: false, reason: String(e.message || e).slice(0, 90) }
    }
  }
  await Promise.all([
    ping('llm', LLM_URL, '/models'),
    ping('image', IMAGE_URL, '/health'),
    ping('model3d', MODEL3D_URL, '/health'),
  ])
  return out
}

// ── 텍스트·비전 ──────────────────────────────────────────────────────
//
// 바깥은 Responses API 형식으로 부른다. 사내 서버는 OpenAI 호환 chat/completions 이다.
// 두 형식은 입력 모양이 다르므로 여기서 옮긴다. 스키마는 그대로 간다 —
// vLLM·SGLang 은 response_format.json_schema 로 유도 디코딩을 걸어 준다.

/** Responses 입력 → chat messages. 못 옮기는 입력은 조용히 버리지 않고 알린다. */
function toChatMessages(input) {
  const arr = Array.isArray(input) ? input : [{ role: 'user', content: [{ type: 'input_text', text: String(input) }] }]
  return arr.map(turn => {
    const parts = Array.isArray(turn.content) ? turn.content : [{ type: 'input_text', text: String(turn.content ?? '') }]
    const content = parts.map(p => {
      if (p.type === 'input_text' || p.type === 'text') return { type: 'text', text: p.text }
      if (p.type === 'input_image') return { type: 'image_url', image_url: { url: p.image_url } }
      if (p.type === 'input_file') {
        // PDF 를 그대로 읽는 오픈 서빙은 아직 흔하지 않다. 페이지를 이미지로 굽지 않는 한
        // 사내 경로로는 무드보드 PDF 를 못 읽는다. 조용히 빈 분석을 내놓느니 여기서 멈춘다.
        throw new Error('local author cannot read PDFs yet — keep INFER_AUTHOR=hosted for moodboard runs, or upload page images instead')
      }
      return { type: 'text', text: JSON.stringify(p) }
    })
    return { role: turn.role === 'assistant' ? 'assistant' : turn.role === 'system' ? 'system' : 'user', content }
  })
}

/** 사내 OpenAI 호환 서버에 JSON 스키마를 걸어 묻는다. */
async function askLocal({ role, input, schema, name, timeoutMs = 300_000 }) {
  const model = (role === 'vision' ? env.LOCAL_VISION_MODEL : null) || env.LOCAL_LLM_MODEL
  if (!model) throw new Error('LOCAL_LLM_MODEL is not set')
  const r = await fetch(`${LLM_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 사내 서버가 키를 요구하면 쓴다. 없으면 헤더도 안 붙인다.
      ...(env.LOCAL_LLM_KEY ? { Authorization: `Bearer ${env.LOCAL_LLM_KEY}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages: toChatMessages(input),
      temperature: Number(env.LOCAL_LLM_TEMP ?? 0.8),
      max_tokens: Number(env.LOCAL_LLM_MAX_TOKENS ?? 4096),
      response_format: { type: 'json_schema', json_schema: { name, schema, strict: true } },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!r.ok) throw new Error(`local ${role} ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const j = await r.json()
  const text = j.choices?.[0]?.message?.content
  if (!text) throw new Error(`local ${role} returned an empty message`)
  try {
    return JSON.parse(text)
  } catch {
    // 유도 디코딩이 안 걸린 서버는 코드펜스를 두르고 돌려준다. 한 번만 벗겨 본다.
    const m = String(text).match(/\{[\s\S]*\}/)
    if (!m) throw new Error(`local ${role} did not return JSON`)
    return JSON.parse(m[0])
  }
}

/** 역할별 라우팅. hosted 경로는 호출한 쪽이 넘겨준 함수를 그대로 쓴다 —
 *  이 파일이 바깥 API 의 세부를 다시 알 필요가 없다. */
export async function askJson({ role, input, schema, name, timeoutMs, hosted }) {
  if (isLocal(role)) return askLocal({ role, input, schema, name, timeoutMs })
  return hosted()
}

// ── 이미지 ───────────────────────────────────────────────────────────
// 계약은 h100/README.md 에 적혀 있다. 두 개뿐이다:
//   POST /generate {prompt, width, height, seed?}                → {image_b64}
//   POST /edit     {prompt, image_b64, width, height, strength?} → {image_b64}

const sizeOf = (size) => {
  const [w, h] = String(size || '1024x1024').split('x').map(n => parseInt(n, 10) || 1024)
  return { width: w, height: h }
}

export async function localImageGenerate({ prompt, size, seed }) {
  const { width, height } = sizeOf(size)
  const r = await fetch(`${IMAGE_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, width, height, ...(seed != null ? { seed } : {}) }),
    signal: AbortSignal.timeout(Number(env.LOCAL_IMAGE_TIMEOUT_MS ?? 300_000)),
  })
  if (!r.ok) throw new Error(`local image ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  if (!j.image_b64) throw new Error('local image server returned no image')
  return Buffer.from(j.image_b64, 'base64')
}

export async function localImageEdit({ prompt, baseBuf, size, strength }) {
  const { width, height } = sizeOf(size)
  const r = await fetch(`${IMAGE_URL}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt, width, height,
      image_b64: Buffer.from(baseBuf).toString('base64'),
      ...(strength != null ? { strength } : {}),
    }),
    signal: AbortSignal.timeout(Number(env.LOCAL_IMAGE_TIMEOUT_MS ?? 300_000)),
  })
  if (!r.ok) throw new Error(`local image edit ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  if (!j.image_b64) throw new Error('local image server returned no image')
  return Buffer.from(j.image_b64, 'base64')
}

// ── 3D ───────────────────────────────────────────────────────────────
// 바깥 3D 와 같은 모양으로 돌려준다 — 파이프라인은 어디서 만들었는지 몰라도 된다.
//   POST /image_to_model {image_b64} → {job_id}
//   GET  /job/{id}                   → {status, progress, glb_b64?}

const POLL_MS = 3000

function modelDir(root) {
  const d = join(root, '.cache', 'models')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

export async function localModelFromImage(root, { view, onStep }) {
  if (!view?.buf) throw new Error('no image to send')
  const hash = createHash('sha256')
    .update('local-single|' + createHash('sha256').update(view.buf).digest('hex'))
    .digest('hex').slice(0, 24)
  const out = join(modelDir(root), `${hash}.glb`)
  if (existsSync(out)) return { hash, format: 'glb', views: 1, cached: true }

  onStep?.('uploading', 0, 0)
  const create = await fetch(`${MODEL3D_URL}/image_to_model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_b64: Buffer.from(view.buf).toString('base64'), texture: true }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!create.ok) throw new Error(`local 3D ${create.status}: ${(await create.text()).slice(0, 200)}`)
  const { job_id: jobId } = await create.json()
  if (!jobId) throw new Error('local 3D server returned no job_id')

  const started = Date.now()
  const maxWait = Number(env.LOCAL_3D_TIMEOUT_MS ?? 12 * 60_000)
  for (;;) {
    if (Date.now() - started > maxWait) throw new Error('local 3D timed out')
    await new Promise(r => setTimeout(r, POLL_MS))
    const r = await fetch(`${MODEL3D_URL}/job/${jobId}`, { signal: AbortSignal.timeout(30_000) }).catch(() => null)
    if (!r?.ok) continue
    const j = await r.json()
    onStep?.(j.status, j.progress ?? 0, Math.round((Date.now() - started) / 1000))
    if (j.status === 'success') {
      if (!j.glb_b64) throw new Error('local 3D finished but returned no model')
      writeFileSync(out, Buffer.from(j.glb_b64, 'base64'))
      return { hash, format: 'glb', views: 1, cached: false, jobId }
    }
    if (['failed', 'cancelled'].includes(j.status)) throw new Error(`local 3D ${j.status}: ${j.error ?? ''}`.trim())
  }
}

export function readLocalModel(root, name) {
  const f = join(modelDir(root), name)
  return existsSync(f) ? readFileSync(f) : null
}
