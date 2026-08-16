// ── Tripo · 단일 이미지 → 3D 모델 ────────────────────────────────────
// 기준 렌더(측면 히어로) 한 장으로 image_to_model 을 돌린다.
//
// 흐름: 이미지 업로드 → image_to_model 태스크 생성 → 폴링 → GLB 내려받아 캐시
// 키는 .env 의 TRIPO_API_KEY 에만 둔다. 브라우저로 나가지 않는다.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = 'https://api.tripo3d.ai/v2/openapi'
const POLL_MS = 4000
const MAX_WAIT_MS = 12 * 60_000

function modelDir(root) {
  const d = join(root, '.cache', 'models')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

export async function tripoProbe(apiKey) {
  if (!apiKey) return { available: false, reason: 'No TRIPO_API_KEY set' }
  try {
    const r = await fetch(`${BASE}/user/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    })
    if (!r.ok) return { available: false, reason: `Tripo ${r.status}` }
    const j = await r.json()
    return { available: true, balance: j?.data?.balance ?? null }
  } catch (e) {
    return { available: false, reason: String(e.message || e).slice(0, 80) }
  }
}

/** 이미지 한 장을 올리고 image_token 을 받는다 */
async function upload(apiKey, buf, name) {
  const form = new FormData()
  form.append('file', new Blob([buf], { type: 'image/png' }), name)
  const r = await fetch(`${BASE}/upload/sts`, {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form,
  })
  if (!r.ok) throw new Error(`Tripo upload ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  const token = j?.data?.image_token
  if (!token) throw new Error('Tripo upload returned no image_token')
  return token
}

async function poll(apiKey, taskId, onStep) {
  const started = Date.now()
  for (;;) {
    if (Date.now() - started > MAX_WAIT_MS) throw new Error('Tripo timed out')
    await new Promise(r => setTimeout(r, POLL_MS))
    const r = await fetch(`${BASE}/task/${taskId}`, { headers: { Authorization: `Bearer ${apiKey}` } })
    if (!r.ok) continue
    const j = await r.json()
    const d = j?.data
    if (!d) continue
    onStep?.(d.status, d.progress ?? 0, Math.round((Date.now() - started) / 1000))
    if (d.status === 'success') return d
    if (['failed', 'cancelled', 'banned', 'expired'].includes(d.status)) {
      throw new Error(`Tripo task ${d.status}`)
    }
  }
}

// (예전 자리) 멀티뷰 → 3D 는 2026-08-13 에 단일 이미지 방식으로 바뀌며 제거됐다.
// 뷰 간 불일치가 형상을 흐렸고, 선정작마다 이미지 3장이 굳었다. tripoSingle 만 남는다.

export async function tripoSingle(root, apiKey, { view, onStep }) {
  if (!apiKey) throw new Error('No TRIPO_API_KEY set')
  if (!view?.buf) throw new Error('no image to send')

  const hash = createHash('sha256')
    .update('single|' + createHash('sha256').update(view.buf).digest('hex'))
    .digest('hex').slice(0, 24)
  const out = join(modelDir(root), `${hash}.glb`)
  if (existsSync(out)) return { hash, format: 'glb', views: 1, cached: true }

  onStep?.('uploading', 0, 0)
  const token = await upload(apiKey, view.buf, view.name)

  const create = await fetch(`${BASE}/task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      type: 'image_to_model',
      file: { type: 'png', file_token: token },
      model_version: 'v2.5-20250123',
      texture: true,
      pbr: true,
    }),
  })
  if (!create.ok) throw new Error(`Tripo task ${create.status}: ${(await create.text()).slice(0, 240)}`)
  const cj = await create.json()
  const taskId = cj?.data?.task_id
  if (!taskId) throw new Error('Tripo returned no task_id')

  const done = await poll(apiKey, taskId, onStep)
  const url = done?.output?.pbr_model ?? done?.output?.model ?? done?.result?.pbr_model?.url ?? done?.result?.model?.url
  if (!url) throw new Error('Tripo finished but returned no model url')

  const dl = await fetch(url)
  if (!dl.ok) throw new Error(`Tripo download ${dl.status}`)
  writeFileSync(out, Buffer.from(await dl.arrayBuffer()))
  return { hash, format: 'glb', views: 1, cached: false, taskId }
}

export function readModel(root, name) {
  const f = join(modelDir(root), name)
  return existsSync(f) ? readFileSync(f) : null
}
