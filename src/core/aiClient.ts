// ── 이미지 생성 클라이언트 · OpenAI gpt-image-1 (서버 프록시 경유) ────
// 키는 서버(Vite dev 미들웨어 / server/openai-api.mjs)에만 존재한다.
// 브라우저 번들에는 키가 들어가지 않는다 (VITE_ prefix 사용 금지).
import type { Category, DesignSpec } from './types'
import { TYPE_EN } from './types'
import type { EngineId } from './imageEngines'
import { shapePrompt } from './imageEngines'
import type { BrandIdentity } from './brand'
import { brandPromptClause } from './brand'

export const IMAGE_MODEL = 'gpt-image-1'
/** gpt-image-1 medium 1024² 근사 단가 (USD) · 정확한 청구액은 OpenAI 대시보드 기준 */
export const USD_PER_IMAGE = 0.042

export interface GenResult { url: string; hash: string; cached: boolean }

export async function apiStatus(): Promise<{ keyPresent: boolean; model: string; cachedImages: number }> {
  const r = await fetch('/api/status')
  if (!r.ok) throw new Error(`status ${r.status}`)
  return r.json()
}

/** 신규 생성 · 동일 프롬프트는 서버 캐시로 재사용되어 중복 과금이 없다 */
export async function generateImage(prompt: string, engine: EngineId = 'detail'): Promise<GenResult> {
  const r = await fetch('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, size: '1024x1024', engine }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `generate ${r.status}`)
  return j
}

/** 편집 · S3 추가 뷰·컬러웨이는 신규 생성이 아니라 기준 렌더의 편집 (지시서 S3-③④) */
export async function editImage(baseHash: string, prompt: string, engine: EngineId = 'detail'): Promise<GenResult> {
  const r = await fetch('/api/image/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseHash, prompt, size: '1024x1024', engine }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `edit ${r.status}`)
  return j
}

// ── 스펙 → 프롬프트 (지시서 S2-4) ────────────────────────────────────
// 이미지 모델은 수치를 기하 제약으로 실행하지 않는다(5장). 프롬프트는 최선의
// 시각적 해석 요청이고, 실제 일치 여부는 비전 QA가 사후 검증한다.

const TOE_KO: Record<string, string> = {
  almond: 'almond toe', square: 'square toe', round: 'round toe', pointed: 'pointed toe',
}
const HEEL_KO: Record<string, string> = {
  flat: 'flat heel', block: 'block heel', stiletto: 'stiletto heel',
  stacked: 'stacked leather heel', flare: 'flared heel', wedge: 'wedge heel',
}
// 품목 영문 표현은 TAXONOMY 한 곳에서 온다
const en = (typeId: string, fallback: string) => TYPE_EN[typeId] ?? fallback

const SHOE_VIEW: Record<string, string> = {
  // 방향을 고정한다. 로고 합성 좌표가 힐이 오른쪽에 있다고 전제하기 때문이다.
  lateral: 'strict lateral side view, outer side facing the viewer, toe pointing to the left and heel on the right',
  q34: 'three-quarter front angle view',
  top: 'top-down view showing the opening and toe shape',
  outsole: 'outsole view showing the tread pattern',
}
const JEWEL_VIEW: Record<string, string> = {
  front: 'straight front view',
  q45: '45 degree angled view showing volume and thickness',
  detail: 'macro close-up of the setting and finish',
  wear: 'worn on the body at a natural angle',
}

/** 스펙 필드를 프롬프트 구절로 · 유형에 따라 의미 없는 필드는 뺀다 */
function shoeSpecPhrase(spec: DesignSpec): string {
  const f = spec.fields as Record<string, string | number | boolean>
  const parts = [
    TOE_KO[String(f.toe_shape)],
    f.heel_type === 'sport_midsole'
      ? `${f.heel_height_mm}mm thick cushioned midsole stack`
      : `${f.heel_height_mm}mm ${HEEL_KO[String(f.heel_type)] ?? 'heel'}`,
    `upper divided into ${f.panel_count} panels`,
    `${f.upper_material} upper`,
    `${String(f.closure).replace(/_/g, ' ')} closure`,
  ]
  const shaft = Number(f.shaft_height_mm) || 0
  if (shaft > 0) parts.push(`${shaft}mm shaft height`)
  return parts.filter(Boolean).join(', ')
}

function jewelSpecPhrase(spec: DesignSpec): string {
  const f = spec.fields as Record<string, string | number | boolean>
  const stones = Number(f.stone_count)
  const parts = [
    stones > 0
      ? `${f.setting_type} setting holding exactly ${stones} round stone${stones > 1 ? 's' : ''} of ${f.stone_size_mm}mm`
      : 'no stones, clean metal surface',
    `${f.metal} metal with ${f.finish} finish`,
  ]
  if (f.chain_type !== 'none') parts.push(`${f.chain_type} chain`)
  if (f.is_pair) parts.push('shown as a matched pair')
  return parts.join(', ')
}

export function sketchPrompt(spec: DesignSpec, engine: EngineId = 'detail', brand?: BrandIdentity, trend?: TrendClauseInput | null): string {
  const subject = spec.category === 'shoe' ? en(spec.itemType, 'shoe') : en(spec.itemType, 'jewelry piece')
  const view = spec.category === 'shoe' ? SHOE_VIEW.lateral : JEWEL_VIEW.front
  const specStr = spec.category === 'shoe' ? shoeSpecPhrase(spec) : jewelSpecPhrase(spec)
  return shapePrompt(engine, {
    subject, spec: specStr, view,
    brand: [trendPromptClause(trend ?? null), brand ? brandPromptClause(brand) : ''].filter(Boolean).join(' '),
    mode: 'sketch',
  })
}

export function renderPrompt(spec: DesignSpec, engine: EngineId = 'detail', brand?: BrandIdentity, trend?: TrendClauseInput | null): string {
  const subject = spec.category === 'shoe' ? en(spec.itemType, 'shoe') : en(spec.itemType, 'jewelry piece')
  const view = spec.category === 'shoe' ? SHOE_VIEW.lateral : JEWEL_VIEW.front
  const specStr = spec.category === 'shoe' ? shoeSpecPhrase(spec) : jewelSpecPhrase(spec)
  return shapePrompt(engine, {
    subject, spec: specStr, view,
    brand: [trendPromptClause(trend ?? null), brand ? brandPromptClause(brand) : ''].filter(Boolean).join(' '),
    mode: 'render',
  })
}

/** 추가 뷰 · 동일 객체를 유지한 채 시점만 바꾸는 편집 지시 */
export function viewEditPrompt(category: Category, viewKey: string): string {
  const v = category === 'shoe' ? SHOE_VIEW[viewKey] : JEWEL_VIEW[viewKey]
  return `Keep the exact same product design, materials, proportions and color. Only change the camera angle to: ${v}. Same seamless white background and lighting.`
}

/** 컬러웨이 · 형태 불변, 색만 변경 */
export function colorwayEditPrompt(colorway: string): string {
  const desc: Record<string, string> = {
    gold: 'warm polished gold', black: 'deep matte black', bordeaux: 'dark bordeaux red',
    ivory: 'soft ivory cream', silver: 'brushed silver',
  }
  return `Keep the exact same product, same camera angle, same shape and proportions. Only recolor the main material to ${desc[colorway] ?? colorway}. Same seamless white background and lighting.`
}

/** 착용 컷 · 기준 렌더를 편집해 사람이 착용한 상태로 옮긴다.
 *  제품 형태는 그대로 두고 배경과 사람만 들어오게 지시한다. */
const WEAR_SCENE: Record<Category, string[]> = {
  shoe: [
    'a real person actually wearing this pair, mid-stride walking, camera at floor level, frame cropped from just below the knee down so only the lower legs and both shoes are visible, bare lower legs, plain seamless light grey studio floor and backdrop, soft even studio light, a faint reflection of the shoes on the floor, both shoes clearly readable, three-quarter side view',
    'a real person actually wearing this pair, standing still with one foot slightly forward, camera at floor level, frame cropped from mid-calf down, plain tapered trousers just touching the shoe, plain seamless light grey studio floor and backdrop, soft even studio light, side view',
  ],
  jewelry: [
    'a real person actually wearing this piece, close crop on the hand and wrist, relaxed natural pose, plain seamless light grey backdrop, soft even studio light, the piece sharp and clearly readable',
    'a real person actually wearing this piece, close crop on the neck and collarbone, chin out of frame, plain seamless light grey backdrop, soft even studio light, the piece sharp and clearly readable',
  ],
}

export function wearEditPrompt(category: Category, index: number): string {
  const scenes = WEAR_SCENE[category]
  const scene = scenes[index % scenes.length]
  return [
    'Keep this exact product: same design, same materials, same proportions, same colour, same hardware.',
    `Show it being worn: ${scene}.`,
    'Photorealistic editorial campaign photography, the product stays in sharp focus and is the subject of the frame.',
    'Do not redesign the product. Do not show a face. No text, no logo, no watermark.',
  ].join(' ')
}

// ── 스케치 한 장에서 갈라져 나오는 실제 제품 베리에이션 ─────────────
// 같은 골격을 유지하되 한 축씩만 바꾼다. 전부 바꾸면 다른 신발이 되고 비교가 안 된다.
const VARIATION_AXES: Record<Category, { key: string; label: string; instruction: string }[]> = {
  shoe: [
    { key: 'material', label: 'Material swap', instruction: 'Keep the exact silhouette and proportions. Change the upper to a different material with visibly different surface: brushed suede instead of smooth calf, with the grain clearly readable.' },
    { key: 'sole', label: 'Sole rebuild', instruction: 'Keep the exact upper. Rebuild the sole unit: thicker lugged rubber outsole with a slightly raised platform, so the stance reads heavier and more grounded.' },
    { key: 'hardware', label: 'Hardware shift', instruction: 'Keep the exact silhouette, material and colour. Change the hardware and trim: add a slim metal plate across the vamp and replace the stitching accent with a tonal one.' },
    { key: 'tone', label: 'Tonal shift', instruction: 'Keep the exact shape, material and hardware. Shift the colourway to a deep ink tone with a matte finish, keeping the sole in a contrasting natural shade.' },
    { key: 'toe', label: 'Toe reshape', instruction: 'Keep the material, colour and sole. Reshape the toe into a squarer, blunter front while holding the same overall length.' },
    { key: 'panel', label: 'Panel split', instruction: 'Keep the silhouette, colour and sole. Break the upper into more panels with a visible seam running from the vamp to the quarter.' },
    { key: 'closure', label: 'Closure change', instruction: 'Keep the silhouette and material. Change how it opens: add an elastic gore panel at the side instead of the current opening.' },
    { key: 'shaft', label: 'Height shift', instruction: 'Keep the material, colour and toe. Raise the collar so it sits higher on the ankle, reading as a taller, more covered shape.' },
  ],
  jewelry: [
    { key: 'metal', label: 'Metal swap', instruction: 'Keep the exact form and stone layout. Change the metal to a brushed, cooler tone with a matte finish.' },
    { key: 'setting', label: 'Setting change', instruction: 'Keep the exact form and metal. Change the stone setting to a bezel with a raised rim, so the stones sit flush and protected.' },
    { key: 'scale', label: 'Scale shift', instruction: 'Keep the exact design language. Make the piece noticeably heavier and wider in section, so it reads as a bolder statement piece.' },
    { key: 'texture', label: 'Surface texture', instruction: 'Keep the exact form. Change the surface to a hammered, irregular texture that catches light unevenly.' },
    { key: 'stone', label: 'Stone layout', instruction: 'Keep the metal and form. Rearrange the stones into a tighter cluster with one larger centre stone.' },
    { key: 'profile', label: 'Profile change', instruction: 'Keep the metal, stones and finish. Flatten the profile so it sits closer to the body with a squarer section.' },
    { key: 'edge', label: 'Edge treatment', instruction: 'Keep everything. Change the edges to a chamfered, faceted border that catches a hard highlight.' },
    { key: 'contrast', label: 'Two-tone', instruction: 'Keep the form and stones. Split the metal into two tones, warm on the body and cool on the setting.' },
  ],
}

export function variationAxes(category: Category) {
  return VARIATION_AXES[category]
}

/** 스케치·기준 렌더에서 갈라지는 제품 베리에이션. 편집이라 같은 계보가 유지된다. */
export function variationPrompt(category: Category, axisIndex: number): string {
  const axes = VARIATION_AXES[category]
  const a = axes[axisIndex % axes.length]
  return [
    'This is a product design variation, not a new product.',
    a.instruction,
    'Photorealistic studio product photograph on a seamless white background, same camera angle as the original, soft even light, sharp focus.',
    'No text, no logo, no watermark, no human.',
  ].join(' ')
}

// ── 컨셉 촬영 · 디자인 다음 단계 ────────────────────────────────────
// 가상 모델 착용컷과, 무드에 맞는 스튜디오·로케이션 컨셉컷을 만든다.
// MICAM 프레스킷의 컨셉 이미지들이 이 자리에 오는 것들이다.

export interface ConceptPersona {
  id: string
  label: string
  brief: string
}

/** 가상 인물 설정. 얼굴을 특정 실존 인물로 만들지 않도록 일반 서술만 쓴다. */
export const PERSONAS: Record<Category, ConceptPersona[]> = {
  shoe: [
    { id: 'urban', label: 'Urban editor', brief: 'a woman in her late twenties, calm confident posture, minimal tailored clothing in muted tones, natural makeup, mid-length dark hair' },
    { id: 'coastal', label: 'Coastal wanderer', brief: 'a man in his early thirties, relaxed stance, loose linen shirt and soft trousers, sun-warmed skin, tousled hair' },
  ],
  jewelry: [
    { id: 'studio', label: 'Studio muse', brief: 'a woman in her twenties, elegant neck and shoulder line, simple slip dress in a neutral tone, hair pulled back' },
    { id: 'artisan', label: 'Quiet artisan', brief: 'a person in their thirties, hands in frame, rolled sleeves, unpolished natural setting' },
  ],
}

export interface ConceptShot {
  key: string
  label: string
  build: (subject: string, persona: ConceptPersona, mood: string) => string
}

/** 컨셉 촬영 컷 목록. 착용컷 → 스튜디오 → 로케이션 순으로 쓰인다. */
export const CONCEPT_SHOTS: ConceptShot[] = [
  {
    key: 'fit_full',
    label: 'Virtual fitting',
    build: (subject, p, mood) => [
      'Keep this exact product: same design, materials, proportions, colour and hardware.',
      `Place it on a model: ${p.brief}, actually wearing the ${subject}.`,
      'Full editorial campaign frame, the product clearly visible and in sharp focus, natural pose, plain studio backdrop with soft directional light.',
      mood ? `Mood: ${mood}.` : '',
      'Photorealistic fashion photography. Do not redesign the product. No text, no logo, no watermark.',
    ].filter(Boolean).join(' '),
  },
  {
    key: 'studio_still',
    label: 'Studio concept',
    build: (subject, _p, mood) => [
      'Keep this exact product: same design, materials, proportions and colour.',
      `Restage it as a concept still life: the ${subject} on a sculpted plinth in a studio set, coloured seamless backdrop, one hard directional light with a soft fill, a long clean shadow, a single prop echoing the mood.`,
      mood ? `Mood: ${mood}.` : '',
      'High-end editorial product photography, shallow depth of field. Do not redesign the product. No text, no logo, no watermark, no human.',
    ].filter(Boolean).join(' '),
  },
  {
    key: 'location',
    label: 'Location concept',
    build: (subject, _p, mood) => [
      'Keep this exact product: same design, materials, proportions and colour.',
      `Place the ${subject} in a real location that carries the mood: natural daylight, a textured surface underneath, the setting visible but out of focus behind.`,
      mood ? `The location should read as: ${mood}.` : '',
      'Photorealistic editorial photography, the product sharp and centred. Do not redesign the product. No text, no logo, no watermark, no human.',
    ].filter(Boolean).join(' '),
  },
]

export function conceptPrompt(
  category: Category, shotIndex: number, personaIndex: number, subject: string, mood: string,
): { prompt: string; label: string; persona: string } {
  const shot = CONCEPT_SHOTS[shotIndex % CONCEPT_SHOTS.length]
  const list = PERSONAS[category]
  const persona = list[personaIndex % list.length]
  return { prompt: shot.build(subject, persona, mood), label: shot.label, persona: persona.label }
}

// ── 조사 결과를 디자인 생성에 실어 보낸다 ───────────────────────────
// 트렌드를 조사해 놓고 이미지 프롬프트가 그것을 모르면, 조사한 의미가 없다.
// 매크로트렌드의 소재·디테일·팔레트를 짧은 구절로 눌러 담아 스펙 뒤에 붙인다.
export interface TrendClauseInput {
  macroName?: string
  materials?: string[]
  details?: string[]
  colors?: { name: string; hex: string }[]
  keySpec?: string
}

export function trendPromptClause(t: TrendClauseInput | null): string {
  if (!t) return ''
  const bits: string[] = []
  if (t.keySpec) bits.push(t.keySpec)
  if (t.materials?.length) bits.push(`season materials: ${t.materials.slice(0, 3).join(', ')}`)
  if (t.details?.length) bits.push(`season details: ${t.details.slice(0, 3).join(', ')}`)
  if (t.colors?.length) bits.push(`season palette: ${t.colors.slice(0, 3).map(c => `${c.name} ${c.hex}`).join(', ')}`)
  if (!bits.length) return ''
  return `It should read as part of the ${t.macroName ?? 'season'} direction: ${bits.join('; ')}.`
}

/** 브랜드 로고를 생성 이미지 위에 실제로 얹는다.
 *  프롬프트로 그리게 하면 형태가 어긋나므로, 원본 파일을 서버에서 합성한다. */
export async function stampLogo(baseHash: string, brand: BrandIdentity): Promise<GenResult | null> {
  const logo = brand.logo
  if (!logo?.dataUrl || logo.placement === 'none') return null
  const r = await fetch('/api/image/logo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseHash, dataUrl: logo.dataUrl, placement: logo.placement, scale: logo.scale,
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `logo ${r.status}`)
  return j
}


// ── 컨셉 영상 ───────────────────────────────────────────────────────
// 유료 영상 API를 쓰지 않는다. 로컬 ComfyUI(오픈소스)가 떠 있으면 그쪽으로 가고,
// 없으면 스틸에서 카메라 무빙만 있는 짧은 클립으로 대체한다.
export interface VideoResult {
  hash: string
  ext: string
  url: string
  backend: 'comfyui' | 'kenburns'
  note?: string
}

export async function videoProbe(): Promise<{ available: boolean; reason?: string; device?: string }> {
  const r = await fetch('/api/video/probe')
  return r.json()
}

export async function generateVideo(baseHash: string, prompt: string): Promise<VideoResult> {
  const r = await fetch('/api/video/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseHash, prompt }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `video ${r.status}`)
  return j
}
