// ── 이미지 생성 클라이언트 · OpenAI (서버 프록시 경유) · 신발 전용 ────
// 키는 서버(Vite dev 미들웨어 / server/openai-api.mjs)에만 존재한다.
// 브라우저 번들에는 키가 들어가지 않는다 (VITE_ prefix 사용 금지).
import type { DesignSpec, FootwearLineProfile } from './types'
import { TYPE_EN, UNKNOWN } from './types'
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

const TOE_EN: Record<string, string> = {
  almond: 'almond toe', square: 'square toe', round: 'round toe', pointed: 'pointed toe',
}
const HEEL_EN: Record<string, string> = {
  flat: 'flat heel', block: 'block heel', stiletto: 'stiletto heel',
  stacked: 'stacked leather heel', flare: 'flared heel', wedge: 'wedge heel',
}
// 품목 영문 표현은 TAXONOMY 한 곳에서 온다
const en = (typeId: string) => TYPE_EN[typeId] ?? 'shoe'

const SHOE_VIEW: Record<string, string> = {
  // 방향을 고정한다. 로고 합성 좌표가 힐이 오른쪽에 있다고 전제하기 때문이다.
  lateral: 'strict lateral side view, outer side facing the viewer, toe pointing to the left and heel on the right',
  medial: 'strict medial inner side view, inner arch side facing the viewer, toe pointing to the right and heel on the left',
  q34: 'three-quarter front angle view',
  top: 'top-down view showing the opening and toe shape',
  outsole: 'outsole view showing the tread pattern',
  rear: 'straight rear view showing the heel, heel seat and topline from behind',
  front: 'straight frontal view, the toe facing the viewer head-on',
}

/** 스펙 필드를 프롬프트 구절로 · 유형에 따라 의미 없는 필드는 뺀다 */
function shoeSpecPhrase(spec: DesignSpec): string {
  const f = spec.fields as Record<string, string | number | boolean>
  const parts = [
    TOE_EN[String(f.toe_shape)],
    f.heel_type === 'sport_midsole'
      ? `${f.heel_height_mm}mm thick cushioned midsole stack`
      : `${f.heel_height_mm}mm ${HEEL_EN[String(f.heel_type)] ?? 'heel'}`,
    `upper divided into ${f.panel_count} panels`,
    `${f.upper_material} upper`,
    `${String(f.closure).replace(/_/g, ' ')} closure`,
  ]
  if (f.midsole_foam) parts.push(`${f.midsole_foam} midsole`)
  if (f.plate && f.plate !== 'none') parts.push(`${f.plate} plate embedded in the midsole`)
  if (f.lug_depth_mm) parts.push(`${f.lug_depth_mm}mm deep outsole lugs`)
  const shaft = Number(f.shaft_height_mm) || 0
  if (shaft > 0) parts.push(`${shaft}mm shaft height`)
  return parts.filter(Boolean).join(', ')
}

/** 라인 프로필을 프롬프트 구절로 · 조사 전에 고정한 어퍼·바텀·공법이 이미지에도 실린다 */
export function linePromptClause(lp: FootwearLineProfile | undefined): string {
  if (!lp) return ''
  const bits: string[] = []
  if (lp.upper.outer !== UNKNOWN) bits.push(`${lp.upper.outer} upper`)
  if (lp.bottom.midsole !== UNKNOWN && lp.bottom.midsole !== 'leather/none') bits.push(`${lp.bottom.midsole} midsole`)
  if (lp.bottom.outsole !== UNKNOWN) bits.push(`${lp.bottom.outsole} outsole`)
  if (lp.bottom.rocker !== UNKNOWN && lp.bottom.rocker !== 'none') bits.push(`${lp.bottom.rocker} rocker profile`)
  if (lp.construction.soleAttachment !== UNKNOWN) bits.push(`${lp.construction.soleAttachment} construction`)
  if (!bits.length) return ''
  return `The line programme fixes: ${bits.join(', ')}.`
}

export function sketchPrompt(spec: DesignSpec, engine: EngineId = 'detail', brand?: BrandIdentity, trend?: TrendClauseInput | null, line?: FootwearLineProfile): string {
  return shapePrompt(engine, {
    subject: en(spec.itemType), spec: shoeSpecPhrase(spec), view: SHOE_VIEW.lateral,
    brand: [linePromptClause(line), trendPromptClause(trend ?? null), brand ? brandPromptClause(brand) : ''].filter(Boolean).join(' '),
    mode: 'sketch',
  })
}

export function renderPrompt(spec: DesignSpec, engine: EngineId = 'detail', brand?: BrandIdentity, trend?: TrendClauseInput | null, line?: FootwearLineProfile): string {
  return shapePrompt(engine, {
    subject: en(spec.itemType), spec: shoeSpecPhrase(spec), view: SHOE_VIEW.lateral,
    brand: [linePromptClause(line), trendPromptClause(trend ?? null), brand ? brandPromptClause(brand) : ''].filter(Boolean).join(' '),
    mode: 'render',
  })
}

/** 추가 뷰 · 동일 객체를 유지한 채 시점만 바꾸는 편집 지시 */
export function viewEditPrompt(viewKey: string): string {
  const v = SHOE_VIEW[viewKey] ?? SHOE_VIEW.q34
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

// ── 3D 멀티뷰 · Tripo가 기대하는 [front, left, back, right] 턴어라운드 ─
// 기준 렌더(lateral, 토가 왼쪽)는 곧 left 뷰다. 나머지 세 방향을 편집으로 만든다.
// 임의 각도 컷을 아무 자리에 끼우는 것보다, 규약에 맞는 직교 4뷰를 주는 쪽이
// 형태 복원이 훨씬 정확하다.
export type TripoRole = 'front' | 'left' | 'back' | 'right'

const TURNAROUND: Record<TripoRole, string> = {
  front: 'a strict frontal orthographic view: the toe faces the viewer head-on, both edges of the shoe symmetrical in frame',
  left: 'a strict left side orthographic profile: toe pointing to the left, heel on the right',
  back: 'a strict rear orthographic view: the heel counter faces the viewer head-on, the topline visible from behind',
  right: 'a strict right side orthographic profile: toe pointing to the right, heel on the left',
}

/** 턴어라운드 편집 지시 · 같은 신발을 카메라만 돌려 다시 찍는다 */
export function turnaroundPrompt(role: TripoRole): string {
  return [
    'This is one frame of a product turnaround for 3D reconstruction.',
    'Keep the exact same shoe: same design, same materials, same colours, same proportions, same sole.',
    `Rotate the camera to ${TURNAROUND[role]}.`,
    'Orthographic product photography: camera at the mid-height of the shoe, the whole shoe centred and fully in frame,',
    'seamless pure white background, soft even light, no perspective distortion, no crop.',
    'No text, no logo, no watermark, no human, no props, no reflection.',
  ].join(' ')
}

/** 착용 컷 · 기준 렌더를 편집해 사람이 착용한 상태로 옮긴다.
 *  제품 형태는 그대로 두고 배경과 사람만 들어오게 지시한다. */
// 신발은 전부 발에 신지만, 목이 있는 것과 없는 것은 프레임이 다르다
const SHOE_FRAMING: Record<string, string[]> = {
  low: [
    'mid-stride walking, camera at floor level, frame cropped from just below the knee down, bare lower legs, both shoes visible, three-quarter side view',
    'standing with one foot slightly forward, camera at floor level, frame cropped from mid-calf down, plain tapered trousers just touching the shoe, side view',
  ],
  tall: [
    'standing, camera low, frame cropped from mid-thigh down so the full shaft of the boot is visible, slim trousers tucked in, three-quarter view',
    'one leg crossed over the other while seated, frame cropped from the knee down, the shaft and the ankle break both readable',
  ],
  open: [
    'standing on a warm concrete floor, camera at floor level, frame cropped from mid-calf down, bare feet and ankles, the straps and toe line clearly readable, three-quarter view',
    'mid-step, camera at floor level, frame cropped from just below the knee, bare legs, the footbed and straps in focus',
  ],
  run: [
    'mid-stride running on an urban road at dawn, camera at floor level, frame cropped from the knee down, technical running tights, both shoes visible with one heel lifting',
    'standing on a running track, camera at floor level, frame cropped from mid-calf down, the midsole stack and outsole clearly readable, side view',
  ],
}
const SHOE_KIND: Record<string, keyof typeof SHOE_FRAMING> = {
  ankle_boot: 'tall', chelsea: 'tall', long_boot: 'tall', combat: 'tall', hiking: 'tall',
  strap_sandal: 'open', slide: 'open', gladiator: 'open', sport_sandal: 'open',
  running: 'run', max_cushion: 'run', tempo_racer: 'run', trail: 'run',
}

function framingOf(itemType: string): string[] {
  return SHOE_FRAMING[SHOE_KIND[itemType] ?? 'low']
}

export function wearEditPrompt(itemType: string, index: number): string {
  const framing = framingOf(itemType)[index % framingOf(itemType).length]
  return [
    'Keep this exact product: same design, same materials, same proportions, same colour, same hardware.',
    'Show it being worn by a real person, on both feet.',
    `Framing: ${framing}.`,
    'Plain seamless light grey studio backdrop, soft even studio light, the product sharp and unmistakably the subject.',
    'Photorealistic editorial campaign photography.',
    'Do not redesign the product. Do not show a face. No text, no logo, no watermark.',
  ].join(' ')
}

// ── 스케치 한 장에서 갈라져 나오는 실제 제품 베리에이션 ─────────────
// 같은 골격을 유지하되 한 축씩만 바꾼다. 전부 바꾸면 다른 신발이 되고 비교가 안 된다.
const VARIATION_AXES: { key: string; label: string; instruction: string }[] = [
  { key: 'material', label: 'Material swap', instruction: 'Keep the exact silhouette and proportions. Change the upper to a different material with visibly different surface: brushed suede instead of smooth calf, with the grain clearly readable.' },
  { key: 'sole', label: 'Sole rebuild', instruction: 'Keep the exact upper. Rebuild the sole unit: thicker lugged rubber outsole with a slightly raised platform, so the stance reads heavier and more grounded.' },
  { key: 'hardware', label: 'Hardware shift', instruction: 'Keep the exact silhouette, material and colour. Change the hardware and trim: add a slim metal plate across the vamp and replace the stitching accent with a tonal one.' },
  { key: 'tone', label: 'Tonal shift', instruction: 'Keep the exact shape, material and hardware. Shift the colourway to a deep ink tone with a matte finish, keeping the sole in a contrasting natural shade.' },
  { key: 'toe', label: 'Toe reshape', instruction: 'Keep the material, colour and sole. Reshape the toe into a squarer, blunter front while holding the same overall length.' },
  { key: 'panel', label: 'Panel split', instruction: 'Keep the silhouette, colour and sole. Break the upper into more panels with a visible seam running from the vamp to the quarter.' },
  { key: 'closure', label: 'Closure change', instruction: 'Keep the silhouette and material. Change how it opens: add an elastic gore panel at the side instead of the current opening.' },
  { key: 'shaft', label: 'Height shift', instruction: 'Keep the material, colour and toe. Raise the collar so it sits higher on the ankle, reading as a taller, more covered shape.' },
]

export function variationAxes() {
  return VARIATION_AXES
}

/** 스케치·기준 렌더에서 갈라지는 제품 베리에이션. 편집이라 같은 계보가 유지된다. */
export function variationPrompt(axisIndex: number): string {
  const a = VARIATION_AXES[axisIndex % VARIATION_AXES.length]
  return [
    'This is a product design variation, not a new product.',
    a.instruction,
    'Photorealistic studio product photograph on a seamless white background, same camera angle as the original, soft even light, sharp focus.',
    'No text, no logo, no watermark, no human.',
  ].join(' ')
}

// ── 컨셉 촬영 · 디자인 다음 단계 ────────────────────────────────────
// 가상 모델 착용컷과, 무드에 맞는 스튜디오·로케이션 컨셉컷을 만든다.

export interface ConceptPersona {
  id: string
  label: string
  brief: string
}

/** 가상 인물 설정. 얼굴을 특정 실존 인물로 만들지 않도록 일반 서술만 쓴다. */
export const PERSONAS: ConceptPersona[] = [
  { id: 'urban', label: 'Urban editor', brief: 'a woman in her late twenties, calm confident posture, minimal tailored clothing in muted tones, natural makeup, mid-length dark hair' },
  { id: 'coastal', label: 'Coastal wanderer', brief: 'a man in his early thirties, relaxed stance, loose linen shirt and soft trousers, sun-warmed skin, tousled hair' },
  { id: 'runner', label: 'Morning runner', brief: 'an athletic person in their twenties, technical running apparel in muted tones, mid-motion, focused expression kept out of frame' },
]

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
      `Place it on a model: ${p.brief}. The shoes are worn on both feet.`,
      'Editorial campaign frame, the product clearly visible and in sharp focus, natural pose, plain studio backdrop with soft directional light.',
      mood ? `Mood: ${mood}.` : '',
      'Photorealistic fashion photography. The shoes go on the feet and nowhere else.',
      'Do not redesign the product. No text, no logo, no watermark.',
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
  itemType: string, shotIndex: number, personaIndex: number, subject: string, mood: string,
): { prompt: string; label: string; persona: string } {
  const shot = CONCEPT_SHOTS[shotIndex % CONCEPT_SHOTS.length]
  // 러닝 계열은 러너 페르소나를 우선 배정한다
  const kind = SHOE_KIND[itemType]
  const pool = kind === 'run' ? [PERSONAS[2], PERSONAS[0]] : [PERSONAS[0], PERSONAS[1]]
  const persona = pool[personaIndex % pool.length]
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


// ── 3D 모델 · Tripo ─────────────────────────────────────────────────
// 규약에 맞는 직교 4뷰([front, left, back, right] 턴어라운드)를 만들어 그대로 넘긴다.
// 임의 각도 한두 장으로 추론시키는 것보다 형태가 훨씬 정확하다.
export interface ModelResult {
  hash: string
  url: string
  format: string
  views: number
  cached: boolean
  note?: string
}

export async function modelProbe(): Promise<{ available: boolean; reason?: string }> {
  const r = await fetch('/api/model/probe')
  return r.json()
}

/** ordered에는 [front, left, back, right] 순서로 해시를 넣는다. 없는 자리는 null. */
export async function generateModel(ordered: (string | null)[], meta: {
  subject?: string; itemType?: string
}): Promise<ModelResult> {
  const r = await fetch('/api/model/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ordered, ...meta }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `model ${r.status}`)
  return j
}
