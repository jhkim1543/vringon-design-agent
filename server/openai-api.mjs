// ── OpenAI 이미지 생성 API — 서버 사이드 전용 ────────────────────────
// 키는 이 프로세스(Node)에만 존재하고 브라우저 번들에 들어가지 않는다.
// Vite dev 서버 미들웨어로 붙이거나, 단독 HTTP 서버로도 재사용 가능하다.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMiroBoard, planMiroBoard } from './miro-api.mjs'
import { DEEP_MODEL_DEFAULT, researchCompetitors, researchRetailPulse, researchTrends, researchSeasonDossier } from './research-api.mjs'
import { compositeLogo, logoAvailable } from './logo-api.mjs'
import { tripoSingle, tripoProbe, readModel } from './tripo-api.mjs'
import { brightdataProbe, unlockImage, unlockPage } from './brightdata.mjs'
import { analyzeLogoStyle, analyzeMoodboard, analyzeSeries, reviewAsMd, saveUpload } from './upload-api.mjs'
import { authorConcepts, authorGenome, planTerritories, verifyRender } from './design-api.mjs'
import { inferenceStatus, isLocal, localImageEdit, localImageGenerate, localModelFromImage, localProbe } from './inference.mjs'
import { marketOf } from './markets.mjs'
import { handleBoardSync } from './board-sync.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const CACHE_DIR = join(ROOT, '.cache', 'images')

// 이미지 생성 모델 — OpenAI 최상위 이미지 모델
export const IMAGE_MODEL = 'gpt-image-1'
// 디자인 생성 모델 · 화면에는 성격으로만 노출한다 (빠른 모델 / 디테일 모델)
// 계정에서 실제 호출되는 것을 확인한 최신 모델을 쓴다.
//   gpt-image-1.5  medium  16초   · 빠른 쪽
//   gpt-image-2    medium  57초   · 디테일 쪽
// 최고 사양으로 둔다. 비용보다 결과를 우선한다는 지시.
//   gpt-image-1.5 high  29초  · 빠른 쪽
//   gpt-image-2   high  136초 · 디테일 쪽
const ENGINE = {
  fast:   { model: 'gpt-image-1.5', quality: 'high', provider: 'openai' },
  detail: { model: 'gpt-image-2',   quality: 'high', provider: 'openai' },
}
const pick = (e) => ENGINE[e] || ENGINE.detail

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
const API_KEY = env.OPENAI_API_KEY || ''
const MIRO_TOKEN = env.MIRO_ACCESS_TOKEN || ''
// 딥리서치는 같은 키를 쓴다. 계정에서 열린 뒤 이 값을 1로 두면 켜진다.
const DEEP_RESEARCH = env.OPENAI_DEEP_RESEARCH === '1'
// 딥리서치는 전용 키가 있으면 그쪽을 쓴다 (조직 인증이 끝난 프로젝트 키)
const DEEP_KEY = env.OPENAI_DEEP_RESEARCH_KEY || env.OPENAI_API_KEY || ''
const DEEP_MODEL = env.OPENAI_DEEP_RESEARCH_MODEL || DEEP_MODEL_DEFAULT

// Tripo · 멀티뷰에서 3D 모델을 만든다
const TRIPO_KEY = env.TRIPO_API_KEY || ''

// Bright Data · WAF에 막힌 스토어에서만 쓰는 유료 폴백 (호출당 과금)
const BD_KEY = env.BRIGHTDATA_API_KEY || ''
const BD_ZONE = env.BRIGHTDATA_ZONE || ''

const SHOT_DIR = join(ROOT, '.cache', 'shots')

function ensureCache() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
}
function ensureShotCache() {
  if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true })
}

// ── 수집 사진 내려받기 · /api/shot 프록시와 샘플 동결이 같은 경로를 쓴다 ──
const SHOT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// 한 호스트를 연달아 두드리면 429가 돌아온다 (ECCO가 그랬다).
// 호스트별로 줄을 세우고 최소 간격을 둔다. 서로 다른 호스트는 그대로 병렬이다.
const hostQueue = new Map()
function hostOf(u) { try { return new URL(u).host } catch { return '?' } }
function throttled(u, fn) {
  const h = hostOf(u)
  const prev = hostQueue.get(h) ?? Promise.resolve()
  const next = prev.then(async () => {
    await new Promise(r => setTimeout(r, 350))
    return fn()
  }, async () => {
    await new Promise(r => setTimeout(r, 350))
    return fn()
  })
  // 큐는 성공·실패와 무관하게 이어져야 한다. 결과는 호출자에게만 던진다.
  hostQueue.set(h, next.catch(() => {}))
  return next
}

/** 429는 잠깐 기다리면 대개 풀린다. 403은 봇 차단이라 재시도해도 소용없다. */
async function fetchWithBackoff(u, init, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    const r = await throttled(u, () => fetch(u, init))
    if (r.status !== 429) return r
    last = r
    const ra = Number(r.headers.get('retry-after'))
    await new Promise(res => setTimeout(res, Number.isFinite(ra) && ra > 0 ? Math.min(ra, 5) * 1000 : 1200 * (i + 1)))
  }
  return last
}

/** 벽에 막힌 응답인가 · 이때만 유료 언락커를 쓴다 */
const isWalled = (status) => status === 403 || status === 429 || status === 401 || status === 503

export async function fetchShotImage(imgUrl, referer, marketId) {
  const r = await fetchWithBackoff(imgUrl, {
    headers: {
      'User-Agent': SHOT_UA,
      Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
      'Accept-Language': marketOf(marketId).acceptLanguage,
      ...(referer ? { Referer: referer } : {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(12_000),
  })
  if (!r.ok && isWalled(r.status) && BD_KEY) {
    const got = await unlockImage(BD_KEY, BD_ZONE, imgUrl)
    if (got) return got
  }
  if (!r.ok) throw new Error(String(r.status))
  const type = r.headers.get('content-type') || ''
  if (!type.startsWith('image/')) throw new Error('not image')
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length > 8e6) throw new Error('too large')
  if (buf.length < 1200) throw new Error('too small')   // 1px 추적 픽셀·플레이스홀더 차단
  return { buf, type }
}

// 페이지에서 대표 이미지 주소를 찾는다.
// og:image가 표준이지만 없는 곳이 있어(까르띠에) 다른 관례까지 훑는다.
const PAGE_IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  /<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]+href=["']([^"']+)["']/i,
  /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
  /"(?:image|contentUrl|thumbnailUrl)"\s*:\s*"(https:[^"]+?\.(?:jpe?g|png|webp|avif)[^"]*)"/i,
  /"(?:image|contentUrl)"\s*:\s*\[\s*"(https:[^"]+?)"/i,
]

// 사이트 공용 이미지 · og:image에 브랜드 로고를 박아 두는 곳이 있다.
// ASICS는 제품 페이지에도 /data/icon/favicon/snslogo.jpg 를 준다. 그대로 쓰면
// 보드의 경쟁 제품 칸에 신발 대신 아식스 로고가 세 장 나란히 걸린다.
const LOGO_LIKE = /(^|[\/_-])(logo|snslogo|favicon|og[-_]?default|default[-_]?(og|share|image)|share[-_]?image|placeholder|no[-_]?image|opengraph)([\/_.-]|$)/i

/** 이 주소가 제품 사진이 아니라 사이트 공용 이미지인가 */
function looksLikeLogo(u) {
  try { return LOGO_LIKE.test(new URL(u).pathname) } catch { return LOGO_LIKE.test(String(u)) }
}

/** 이 파이프라인에서 실제로 페이지를 여는 곳은 여기 하나뿐이다.
 *  여기가 계속 ko-KR 을 보내면, 미국 시장을 조사했다는 말이 네트워크 층에서 거짓이 된다 —
 *  많은 쇼핑몰이 이 헤더로 지역몰을 갈라 리다이렉트한다. 홈 시장을 따라간다. */
export async function shotFromPage(pageUrl, marketId) {
  const r = await fetchWithBackoff(pageUrl, {
    headers: {
      'User-Agent': SHOT_UA,
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': marketOf(marketId).acceptLanguage,
    },
    redirect: 'follow', signal: AbortSignal.timeout(12_000),
  })
  let html = null
  if (r.ok) html = (await r.text()).slice(0, 900_000)
  else if (isWalled(r.status) && BD_KEY) {
    // 여기서만 돈을 쓴다 · 평범한 fetch로 이미 91%는 들어와 있다
    const unlocked = await unlockPage(BD_KEY, BD_ZONE, pageUrl)
    if (unlocked) html = unlocked.slice(0, 900_000)
  }
  if (!html) throw new Error(`page ${r.status}`)
  // 로고로 보이는 후보는 건너뛰고 다음 패턴을 본다. JSON-LD 쪽에 진짜 제품 사진이 있는 경우가 많다.
  let skipped = null
  for (const re of PAGE_IMAGE_PATTERNS) {
    const m = re.exec(html)
    if (m?.[1]) {
      let u2 = m[1].replace(/&amp;/g, '&').trim()
      if (u2.startsWith('//')) u2 = 'https:' + u2
      if (u2.startsWith('/')) { try { u2 = new URL(u2, pageUrl).href } catch { /* 무시 */ } }
      if (!/^https:\/\//.test(u2)) continue
      if (looksLikeLogo(u2)) { skipped = skipped ?? u2; continue }
      return u2
    }
  }
  // 로고밖에 없으면 사진이 없는 것으로 본다. 로고를 제품 사진 자리에 넣지는 않는다.
  if (skipped) throw new Error('only a site logo on this page')
  throw new Error('no page image')
}

/** 캐시에 있으면 그대로, 없으면 내려받아 캐시한다. 실패는 1시간 동안 기억한다.
 *  성공 시 { file, type, key } — 샘플 동결이 이 파일을 그대로 복사한다. */
async function ensureShotCached(src, page) {
  ensureShotCache()
  const key = keyOf(['shot2', src, page])
  const file = join(SHOT_DIR, `${key}.img`)
  const miss = file + '.miss'
  if (existsSync(file)) {
    const type = existsSync(file + '.type') ? readFileSync(file + '.type', 'utf8') : 'image/jpeg'
    return { file, type, key }
  }
  if (existsSync(miss) && Date.now() - Number(readFileSync(miss, 'utf8') || 0) < 3600_000) return null
  let got = null
  if (/^https:\/\//.test(src)) {
    try { got = await fetchShotImage(src, page || undefined) } catch { /* 직링크 실패 → 페이지 폴백 */ }
  }
  if (!got && page && /^https:\/\//.test(page)) {
    try { got = await fetchShotImage(await shotFromPage(page), page) } catch { /* 페이지 폴백도 실패 */ }
  }
  if (!got) { writeFileSync(miss, String(Date.now())); return null }
  writeFileSync(file, got.buf)
  writeFileSync(file + '.type', got.type)
  return { file, type: got.type, key }
}

const EXT_OF = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' }

function keyOf(parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24)
}

// 업로드는 base64라 원본보다 4/3 크다. 12MB 파일이면 16MB가 넘어오므로 따로 열어 준다.
function readBody(req, max = 8e6) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', c => { raw += c; if (raw.length > max) reject(new Error('body too large')) })
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

function json(res, code, obj) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(obj))
}

// ── 하루 상한 · 공개 주소에 올릴 때의 안전선 ──────────────────────────
// 링크가 공개되면 누구나 눌러 볼 수 있고, 한 장 한 장이 돈이다. 상한이 없으면
// 하루 만에 예산이 사라진다. 캐시 히트는 돈이 안 나가므로 세지 않는다.
// DAILY_IMAGE_CAP 을 안 정하면 상한이 없다 — 로컬에서 쓰던 대로 돈다.
const DAILY_CAP = Number(env.DAILY_IMAGE_CAP || 0)
let spentDay = ''
let spentCount = 0

function chargeOne() {
  if (!DAILY_CAP) return
  const today = new Date().toISOString().slice(0, 10)
  if (today !== spentDay) { spentDay = today; spentCount = 0 }
  if (spentCount >= DAILY_CAP) {
    throw new Error(`오늘 생성 한도(${DAILY_CAP}장)에 닿았습니다. 저장된 샘플은 그대로 열립니다.`)
  }
  spentCount++
}

/** 남은 장수 · /api/status 에 실어 화면이 미리 알 수 있게 한다 */
function capState() {
  if (!DAILY_CAP) return null
  const today = new Date().toISOString().slice(0, 10)
  const used = today === spentDay ? spentCount : 0
  return { cap: DAILY_CAP, used, left: Math.max(0, DAILY_CAP - used) }
}

/** 생성 — 캐시 히트면 API를 호출하지 않는다 (재개 시 중복 과금 0건) */
async function generate({ prompt, size = '1024x1024', engine = 'detail' }) {
  const { model, quality } = pick(engine)
  // 사내 GPU 로 도는 그림은 캐시 키가 달라야 한다. 같은 프롬프트라도 다른 그림이 나오고,
  // 키가 같으면 사내로 바꾼 뒤에도 예전 그림이 계속 나온다.
  const local = isLocal('image')
  const usedModel = local ? 'local' : model
  ensureCache()
  const hash = keyOf(['gen', usedModel, prompt, size, quality])
  const file = join(CACHE_DIR, `${hash}.png`)
  if (existsSync(file)) return { hash, cached: true, model: usedModel }

  chargeOne()

  if (local) {
    writeFileSync(file, await localImageGenerate({ prompt, size }))
    return { hash, cached: false, model: usedModel }
  }
  if (!API_KEY) throw new Error('OPENAI_API_KEY 미설정 — fashion-agent/.env 확인')

  // 시간 제한이 없으면 한 건이 매달렸을 때 분석 전체가 영원히 멈춘다.
  // 실제로 렌더 한 장에서 17분을 기다리다 멈춘 적이 있다. gpt-image-2 high가
  // 느릴 때 약 140초이므로 그 두 배를 주고, 넘으면 그 장만 포기한다.
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model, prompt, size, quality, n: 1, background: 'opaque' }),
    signal: AbortSignal.timeout(300_000),
  })
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 400)}`)
  const data = await r.json()
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI 응답에 이미지 없음')
  writeFileSync(file, Buffer.from(b64, 'base64'))
  return { hash, cached: false, model: usedModel }
}

/** 편집 — S3 멀티뷰·컬러웨이는 신규 생성이 아니라 기준 렌더의 편집 (지시서 S3-③) */
async function edit({ baseHash, prompt, size = '1024x1024', engine = 'detail' }) {
  const { model, quality } = pick(engine)
  const local = isLocal('image')
  const usedModel = local ? 'local' : model
  ensureCache()
  const hash = keyOf(['edit', usedModel, baseHash, prompt, size, quality])
  const file = join(CACHE_DIR, `${hash}.png`)
  if (existsSync(file)) return { hash, cached: true }
  const basePath = join(CACHE_DIR, `${baseHash}.png`)
  if (!existsSync(basePath)) throw new Error(`기준 이미지 없음: ${baseHash}`)

  chargeOne()

  if (local) {
    writeFileSync(file, await localImageEdit({ prompt, baseBuf: readFileSync(basePath), size }))
    return { hash, cached: false, model: usedModel }
  }
  if (!API_KEY) throw new Error('OPENAI_API_KEY 미설정')

  const form = new FormData()
  form.append('model', model)
  form.append('prompt', prompt)
  form.append('size', size)
  form.append('quality', quality)
  form.append('image', new Blob([readFileSync(basePath)], { type: 'image/png' }), 'base.png')

  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(300_000),
  })
  if (!r.ok) throw new Error(`OpenAI edit ${r.status}: ${(await r.text()).slice(0, 400)}`)
  const data = await r.json()
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI 편집 응답에 이미지 없음')
  writeFileSync(file, Buffer.from(b64, 'base64'))
  return { hash, cached: false, model: usedModel }
}

/** 3D 한 장 → GLB. 사내 GPU 와 바깥 서비스가 같은 모양으로 돌려주므로
 *  호출하는 쪽은 어디서 만들어졌는지 알 필요가 없다. */
async function makeModel(view) {
  return isLocal('model3d')
    ? localModelFromImage(ROOT, { view })
    : tripoSingle(ROOT, TRIPO_KEY, { view })
}

// ── 다른 도메인에서 부를 수 있게 · 화면과 API 가 갈라져 있을 때만 필요하다 ──
// 한 서비스가 화면과 API 를 같이 내보내면(권장) 여기 아무것도 안 적어도 된다.
// 적을 때는 반드시 주소를 하나하나 적는다. '*' 로 열면 누구나 이 키로 그림을 뽑는다.
const ALLOWED_ORIGINS = String(env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean)

function applyCors(req, res) {
  const origin = (req.headers.origin || '').replace(/\/+$/, '')
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Max-Age', '86400')
}

/** connect 스타일 핸들러 — Vite dev 미들웨어와 단독 서버 양쪽에서 사용 */
export async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  applyCors(req, res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }

  // 보드 동시 편집 · SSE 라우트는 일반 json 헬퍼를 타지 않는다
  if (path.startsWith('/api/board/')) {
    if (await handleBoardSync(req, res, ROOT, url)) return
  }

  if (path === '/api/status') {
    ensureCache()
    const n = readdirSync(CACHE_DIR).filter(f => f.endsWith('.png')).length
    return json(res, 200, {
      keyPresent: !!API_KEY, model: IMAGE_MODEL, cachedImages: n,
      miroConnected: !!MIRO_TOKEN,
      deepResearch: DEEP_RESEARCH, deepModel: DEEP_MODEL,
      tripoConnected: !!TRIPO_KEY,
      unlockerConnected: !!BD_KEY,
      engines: { fast: ENGINE.fast.model, detail: ENGINE.detail.model },
      // 어떤 역할이 사내에서 도는가. 유출 방지가 목적이면 이 줄이 곧 증거다.
      inference: inferenceStatus(),
      // 공개 주소에서 오늘 몇 장 남았는가. 상한을 안 걸었으면 null.
      dailyCap: capState(),
    })
  }

  // 사내 추론 서버가 살아 있는지. 역할을 local 로 바꾸기 전에 눌러 본다.
  if (path === '/api/inference/probe') {
    return json(res, 200, { routes: inferenceStatus(), reachable: await localProbe() })
  }

  // 딥리서치 접근 진단 · 계정에서 열렸는지 한 번에 확인한다
  if (path === '/api/research/deep-check') {
    if (!DEEP_KEY) return json(res, 200, { available: false, reason: '딥리서치 키 미설정' })
    const candidates = [DEEP_MODEL, 'o3-deep-research', 'o4-mini-deep-research']
    const tried = []
    for (const m of [...new Set(candidates)]) {
      try {
        const r = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEP_KEY}` },
          body: JSON.stringify({
            model: m, input: 'ping', background: true,
            tools: [{ type: 'web_search_preview' }],
          }),
        })
        if (r.ok) {
          const j = await r.json()
          // 진단용이므로 즉시 취소해 과금을 남기지 않는다
          fetch(`https://api.openai.com/v1/responses/${j.id}/cancel`, {
            method: 'POST', headers: { Authorization: `Bearer ${DEEP_KEY}` },
          }).catch(() => {})
          return json(res, 200, { available: true, model: m, enabledInEnv: DEEP_RESEARCH, tried })
        }
        tried.push({ model: m, status: r.status, message: (await r.text()).slice(0, 140) })
      } catch (e) {
        tried.push({ model: m, error: String(e.message).slice(0, 140) })
      }
    }
    return json(res, 200, {
      available: false, enabledInEnv: DEEP_RESEARCH, tried,
      hint: '프로젝트의 모델 권한에서 deep research 모델을 허용해야 합니다 (platform.openai.com → Project → Limits).',
    })
  }

  // 수집한 제품 사진을 서버가 받아 캐시한다. 핫링크·CORS·만료 링크를 피한다.
  // 직링크가 죽어 있으면 제품 페이지(p)의 og:image로 폴백한다 — 리서치가 물어온
  // 이미지 주소는 자주 만료되므로, 페이지가 살아 있는 한 사진은 나와야 한다.
  if (path === '/api/shot') {
    const src = url.searchParams.get('u') || ''
    const page = url.searchParams.get('p') || ''
    // 직링크가 아예 없어도 상품 페이지만 있으면 og:image로 간다 (조사가 이미지 URL을 못 물어온 제품)
    if (!/^https:\/\//.test(src) && !/^https:\/\//.test(page)) { res.statusCode = 400; return res.end('bad url') }
    try {
      const got = await ensureShotCached(src, page)
      if (!got) throw new Error('unavailable')
      res.setHeader('Content-Type', got.type)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      return res.end(readFileSync(got.file))
    } catch {
      res.statusCode = 404
      return res.end('shot unavailable')
    }
  }

  if (path === '/api/image/providers') {
    // 이미지 공급자는 하나(호스티드) + 사내 GPU 뿐이다. 예전에는 두 번째 벤더 분기가 코드에 있었지만
    // 상수 하나로 영구히 꺼져 있어 도달할 수 없었고, 상태 화면에는 '연결됨' 으로 떴다. 걷어냈다.
    return json(res, 200, { openai: { keyPresent: !!API_KEY, fast: ENGINE.fast.model, detail: ENGINE.detail.model }, inference: inferenceStatus() })
  }

  if (path === '/api/research/competitors' && req.method === 'POST') {
    try {
      if (!API_KEY) throw new Error('OPENAI_API_KEY 미설정')
      const body = await readBody(req)
      return json(res, 200, await researchCompetitors(API_KEY, ROOT, body))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  // 백화점·명품몰 베스트셀러 펄스 · 브랜드 입력과 무관한 상업 신호
  if (path === '/api/research/pulse' && req.method === 'POST') {
    try {
      if (!API_KEY) throw new Error('OPENAI_API_KEY 미설정')
      const body = await readBody(req)
      return json(res, 200, await researchRetailPulse(API_KEY, ROOT, body))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  if (path === '/api/research/trends' && req.method === 'POST') {
    try {
      if (!API_KEY) throw new Error('OPENAI_API_KEY 미설정')
      const body = await readBody(req)
      // 딥리서치를 켜면 전용 키로 넘긴다
      return json(res, 200, await researchTrends(DEEP_RESEARCH ? DEEP_KEY : API_KEY, ROOT, {
        ...body,
        deep: DEEP_RESEARCH,
        deepModel: DEEP_MODEL,
      }))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  // 시즌 도시에 · MICAM 형식의 구조화된 트렌드 자료
  if (path === '/api/research/dossier' && req.method === 'POST') {
    try {
      const b = await readBody(req)
      return json(res, 200, await researchSeasonDossier(DEEP_RESEARCH ? DEEP_KEY : API_KEY, ROOT, {
        categoryEn: b.categoryEn, season: b.season, priceBand: b.priceBand,
        brands: b.brands ?? [], deep: DEEP_RESEARCH, langName: b.langName, line: b.line,
      }))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  // ── 업로드 · 파일을 실제로 받아 두고, 실제로 읽는다 ────────────────
  // 예전에는 파일명만 params에 담고 내용은 아무도 열지 않았다.
  // 라우트 존재 확인용. 옛 서버가 포트를 쥐고 있는 채로 새 코드를 돌리는 사고가
  // 실제로 있었다 — 20분짜리 Run 이 옛 파이프라인으로 조용히 돌았다.
  // POST 로 떠보면 실제 추론이 돌아 과금되므로, 값싼 GET 을 따로 둔다.
  if (path === '/api/design/concepts' && req.method === 'GET') {
    return json(res, 200, { ok: true, route: 'concepts' })
  }

  if (path === '/api/upload' && req.method === 'POST') {
    try {
      const b = await readBody(req, 48e6)
      const files = Array.isArray(b.files) ? b.files : [b]
      const saved = files.map(f => saveUpload(ROOT, f))
      return json(res, 200, { files: saved })
    } catch (e) { return json(res, 400, { error: String(e.message || e) }) }
  }

  if (path === '/api/analyze/series' && req.method === 'POST') {
    try {
      const b = await readBody(req)
      return json(res, 200, await analyzeSeries(API_KEY, ROOT, {
        uploadIds: b.uploadIds, valueStatement: b.valueStatement,
        itemTypeEn: b.itemTypeEn, langName: b.langName,
      }))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  // MD 페르소나가 후보를 보고 고른다
  if (path === '/api/analyze/md-review' && req.method === 'POST') {
    try {
      const b = await readBody(req)
      return json(res, 200, await reviewAsMd(API_KEY, ROOT, {
        persona: b.persona, brand: b.brand, designs: b.designs, langName: b.langName,
      }))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  // ── Design Genome · 디자인 저작 (지시서 v2 S3~S4) ──────────────────
  if (path === '/api/design/territories' && req.method === 'POST') {
    try {
      const b = await readBody(req)
      return json(res, 200, await planTerritories(API_KEY, ROOT, {
        signals: b.signals, itemTypeEn: b.itemTypeEn, itemType: b.itemType,
        brandSummary: b.brandSummary, langName: b.langName,
      }))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  if (path === '/api/design/genome' && req.method === 'POST') {
    try {
      const b = await readBody(req)
      return json(res, 200, await authorGenome(API_KEY, ROOT, {
        territory: b.territory, tier: b.tier, signals: b.signals, profile: b.profile,
        brandSummary: b.brandSummary, antiSimilarity: b.antiSimilarity,
        itemTypeEn: b.itemTypeEn, langName: b.langName, assets: b.assets, locked: b.locked,
      }))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  // 스케치 하나 → 디자인 컨셉 N개 · 소재·컬러·창의도만 갈리고 형태는 고정
  if (path === '/api/design/concepts' && req.method === 'POST') {
    try {
      const b = await readBody(req)
      return json(res, 200, await authorConcepts(API_KEY, ROOT, {
        count: b.count, genome: b.genome, signals: b.signals, brandSummary: b.brandSummary,
        brandPalette: b.brandPalette, seasonPalette: b.seasonPalette, seasonMaterials: b.seasonMaterials,
        itemTypeEn: b.itemTypeEn, langName: b.langName,
      }))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  // 실제 비전 검증 · rng QA를 대체한다
  if (path === '/api/verify/render' && req.method === 'POST') {
    try {
      const b = await readBody(req)
      return json(res, 200, await verifyRender(API_KEY, CACHE_DIR, {
        hash: b.hash, genome: b.genome, langName: b.langName,
      }))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  // 로고가 적용된 제품 사진에서 배치 규칙을 읽는다
  if (path === '/api/analyze/logo-style' && req.method === 'POST') {
    try {
      const b = await readBody(req)
      return json(res, 200, await analyzeLogoStyle(API_KEY, ROOT, {
        logoId: b.logoId, referenceIds: b.referenceIds,
        itemTypeEn: b.itemTypeEn, langName: b.langName,
      }))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  if (path === '/api/analyze/moodboard' && req.method === 'POST') {
    try {
      const b = await readBody(req)
      return json(res, 200, await analyzeMoodboard(API_KEY, ROOT, {
        uploadIds: b.uploadIds, notes: b.notes,
        itemTypeEn: b.itemTypeEn, langName: b.langName,
      }))
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  // 브랜드 로고를 생성 이미지 위에 실제로 얹는다 (프롬프트로 그리지 않는다)
  if (path === '/api/image/logo' && req.method === 'POST') {
    try {
      const b = await readBody(req)
      const r = await compositeLogo(CACHE_DIR, b)
      return json(res, 200, { ...r, url: `/api/image/file/${r.hash}.png` })
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  // 3D 모델 · 기준 렌더 한 장을 3D 생성기에 넘긴다. 사내 GPU 로 돌릴 수 있다.
  if (path === '/api/model/probe') {
    return json(res, 200, isLocal('model3d') ? (await localProbe()).model3d : await tripoProbe(TRIPO_KEY))
  }

  // 언락커 진단 · 계정에 zone이 있어야 실제 요청이 나간다
  if (path === '/api/shot/unlocker-check') {
    return json(res, 200, await brightdataProbe(BD_KEY))
  }

  if (path === '/api/model/generate' && req.method === 'POST') {
    try {
      const b = await readBody(req)
      const okHash = h => typeof h === 'string' && /^[a-f0-9]{8,64}$/.test(h)

      // 단일 이미지 방식 (2026-08-13 변경) · 기준 렌더 한 장으로 만든다.
      // single 필드가 오면 이 경로. 턴어라운드 3컷을 만들지 않아 뷰 불일치가 형상을 흐릴 일이 없다.
      if (okHash(b.single)) {
        const p = join(CACHE_DIR, `${b.single}.png`)
        if (!existsSync(p)) return json(res, 404, { error: 'that render is not in the cache' })
        const r = await makeModel({ buf: readFileSync(p), name: `${b.single}.png` })
        return json(res, 200, { ...r, url: `/api/model/file/${r.hash}.${r.format}` })
      }

      // 구 클라이언트 호환 · ordered/hashes 멀티뷰 요청은 첫 유효 뷰 한 장으로 처리한다
      const legacy = (Array.isArray(b.ordered) ? b.ordered : Array.isArray(b.hashes) ? b.hashes : []).filter(okHash)
      const first = legacy.map(h => join(CACHE_DIR, `${h}.png`)).find(existsSync)
      if (!first) return json(res, 400, { error: 'no usable view given' })
      const r = await makeModel({ buf: readFileSync(first), name: 'view.png' })
      return json(res, 200, { ...r, url: `/api/model/file/${r.hash}.${r.format}` })
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  if (path.startsWith('/api/model/file/')) {
    const raw = path.slice('/api/model/file/'.length)
    if (!/^[a-f0-9]{8,64}\.(glb|gltf)$/.test(raw)) { res.statusCode = 400; return res.end('bad name') }
    const buf = readModel(ROOT, raw)
    if (!buf) { res.statusCode = 404; return res.end('not found') }
    res.setHeader('Content-Type', 'model/gltf-binary')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return res.end(buf)
  }

  if (path === '/api/miro/export' && req.method === 'POST') {
    try {
      const { model, meta, token } = await readBody(req)
      // 형태가 어긋나면 planMiroBoard 안에서 TypeError 가 나 원인이 안 보인다
      if (!model || !Array.isArray(model.columns) || !Array.isArray(model.nodes)) {
        return json(res, 400, { error: 'board model must have columns[] and nodes[]' })
      }
      const plan = planMiroBoard(model, meta ?? { name: 'VRINGON 품평 보드', description: '' })
      // 사용자마다 토큰이 다르다. 요청에 실려 온 개인 토큰이 서버 환경값보다 우선한다.
      // 토큰은 저장하지 않는다 — 이 요청 한 번에만 쓰인다.
      const MIRO = (typeof token === 'string' && token.trim()) ? token.trim() : MIRO_TOKEN
      if (!MIRO) {
        return json(res, 200, {
          mode: 'plan',
          plan,
          hint: 'MIRO_ACCESS_TOKEN을 .env에 넣으면 보드를 바로 생성합니다. 지금은 생성 계획만 반환했습니다.',
        })
      }
      // 로컬 캐시 이미지(/api/image/file/…, /api/shot?…)는 파일로 올린다.
      // Miro는 URL을 자기 서버에서 가져가므로 localhost 주소는 절대 닿지 않는다.
      const resolveLocal = (u) => {
        try {
          const m1 = /^\/api\/image\/file\/([a-f0-9]{8,64})\.png$/.exec(u)
          if (m1) {
            const p = join(CACHE_DIR, `${m1[1]}.png`)
            return existsSync(p) ? readFileSync(p) : null
          }
          if (u.startsWith('/api/shot?')) {
            const q = new URL('http://x' + u.slice(4)).searchParams
            const name = `${keyOf(['shot2', q.get('u') || '', q.get('p') || ''])}.img`
            const p = join(SHOT_DIR, name)
            return existsSync(p) ? readFileSync(p) : null
          }
        } catch { /* 개별 이미지 실패는 건너뛴다 */ }
        return null
      }
      const out = await createMiroBoard(MIRO, plan, resolveLocal)
      return json(res, 200, { mode: 'created', ...out })
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) })
    }
  }

  // 개발용 · 지금 실행한 Run을 예시 샘플로 굳힌다.
  // 참조된 이미지는 캐시에서 public/samples 로 복사해, 캐시를 지워도 샘플이 살아 있게 한다.
  if (path === '/api/dev/save-sample' && req.method === 'POST') {
    try {
      const { name, state } = await readBody(req)
      if (!/^[a-z0-9_]+$/.test(String(name ?? ''))) return json(res, 400, { error: 'bad name' })
      const outDir = join(ROOT, 'public', 'samples')
      mkdirSync(outDir, { recursive: true })

      // 수집한 경쟁·베스트셀러 사진을 파일로 함께 굳힌다.
      // 정적 배포에는 /api/shot 프록시가 없고, 원격 직링크는 핫링크 차단·만료로 깨진다.
      // 캐시에 없으면 지금 내려받아 본다 — 그래도 실패한 제품은 image_urls를 비워
      // 화면이 "사진 없음"으로 정직하게 말하게 둔다.
      let frozenShots = 0
      for (const c of (state?.competitors ?? [])) {
        const page = c.product_url || ''
        const candidates = [...(c.image_urls ?? []), ...(page ? [''] : [])]
        let local = null
        for (const u of candidates) {
          try {
            const got = await ensureShotCached(u, page)
            if (!got) continue
            const ext = EXT_OF[got.type] ?? 'jpg'
            const fname = `${got.key}.${ext}`
            writeFileSync(join(outDir, fname), readFileSync(got.file))
            local = `/samples/${fname}`
            break
          } catch { /* 다음 후보 */ }
        }
        c.image_urls = local ? [local] : []
        if (local) frozenShots++
      }

      let text = JSON.stringify(state)
      const hashes = [...new Set([...text.matchAll(/\/api\/image\/file\/([a-f0-9]{8,64})\.png/g)].map(m => m[1]))]
      let copied = 0
      for (const h of hashes) {
        const src = join(CACHE_DIR, h + '.png')
        if (!existsSync(src)) continue
        writeFileSync(join(outDir, `${h}.png`), readFileSync(src))
        copied++
      }
      // 3D 모델(GLB)도 함께 옮긴다. 캐시를 지워도 샘플이 살아 있어야 한다.
      const modelRe = new RegExp('/api/(?:video|model)/file/([a-f0-9]{8,64})\\.(webp|gif|mp4|webm|glb|gltf)', 'g')
      const modelNames = [...new Set([...text.matchAll(modelRe)].map(m => m[1] + '.' + m[2]))]
      for (const name of modelNames) {
        const src = join(ROOT, '.cache', 'models', name)
        if (!existsSync(src)) continue
        writeFileSync(join(outDir, name), readFileSync(src))
        copied++
      }
      text = text.replaceAll('/api/image/file/', '/samples/').replaceAll('/api/model/file/', '/samples/')
      const dir = join(ROOT, 'src', 'samples')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(JSON.parse(text), null, 1))
      return json(res, 200, { ok: true, file: `src/samples/${name}.json`, images: hashes.length, copied, frozenShots })
    } catch (e) { return json(res, 500, { error: String(e.message || e) }) }
  }

  if (path.startsWith('/api/image/file/')) {
    // 캐시 파일명은 "<hex24>.png" 형태만 허용한다 (경로 이탈 차단)
    const raw = path.slice('/api/image/file/'.length)
    const m = /^([a-f0-9]{8,64})\.png$/.exec(raw)
    if (!m) { res.statusCode = 400; return res.end('bad name') }
    const file = join(CACHE_DIR, `${m[1]}.png`)
    if (!existsSync(file)) { res.statusCode = 404; return res.end('not found') }
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return res.end(readFileSync(file))
  }

  if (req.method !== 'POST') { res.statusCode = 405; return res.end('method not allowed') }

  try {
    const body = await readBody(req)
    if (path === '/api/image/generate') {
      const { hash, cached, model } = await generate(body)
      return json(res, 200, { url: `/api/image/file/${hash}.png`, hash, cached, model })
    }
    if (path === '/api/image/edit') {
      const { hash, cached, model } = await edit(body)
      return json(res, 200, { url: `/api/image/file/${hash}.png`, hash, cached, model })
    }
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) })
  }

  res.statusCode = 404
  res.end('not found')
}

/** Vite 플러그인 — dev 서버에 /api 라우트를 붙인다 */
export function openaiApiPlugin() {
  return {
    name: 'vringon-openai-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        handleApi(req, res).catch(err => {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err) }))
        })
      })
    },
  }
}
