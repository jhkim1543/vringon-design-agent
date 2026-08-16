// ── 이미지 생성 클라이언트 · OpenAI (서버 프록시 경유) · 신발 전용 ────
// 키는 서버(Vite dev 미들웨어 / server/openai-api.mjs)에만 존재한다.
// 브라우저 번들에는 키가 들어가지 않는다 (VITE_ prefix 사용 금지).
import { withRetry } from './net'
import type { DesignConcept, DesignSpec, FootwearLineProfile } from './types'
import { TYPE_EN, UNKNOWN } from './types'
import type { EngineId } from './imageEngines'
import { shapePrompt } from './imageEngines'
import type { BrandIdentity } from './brand'
import { brandPromptClause } from './brand'
import { apiUrl } from './apiBase'

export const IMAGE_MODEL = 'gpt-image-1'
/** gpt-image-1 medium 1024² 근사 단가 (USD) · 정확한 청구액은 OpenAI 대시보드 기준 */
export const USD_PER_IMAGE = 0.042

export interface GenResult { url: string; hash: string; cached: boolean }

/** 이미지 한 장을 만드는 요청. 시간 제한과 재시도가 여기 한 곳에 있다.
 *
 *  노트북이 잠들면 진행 중이던 요청이 ERR_NETWORK_IO_SUSPENDED로 끊긴다.
 *  한 장이 끊겼다고 분석 전체를 버릴 이유는 없다 — 깨어난 뒤 다시 부르면 대개 된다.
 *  서버가 프롬프트로 캐시하므로 재시도가 중복 과금이 되지도 않는다. */
/** 서버가 돌려준 루트 기준 주소를 실제로 열 수 있는 주소로 바꾼다. 이미 절대주소면 그대로. */
const absolutize = (u: string | undefined): string =>
  !u ? '' : /^(https?:|data:|blob:)/.test(u) ? u : u.startsWith('/api/') ? apiUrl(u) : u

async function imageCall(url: string, body: unknown, what: string): Promise<GenResult> {
  // 재시도 규칙은 net.ts 하나로 모았다. 예전에는 여기 손으로 쓴 루프가 4초·8초만 쉬어서
  // 1분짜리 상류 장애를 못 넘겼다 — 실제로 그 창에서 스케치 두 장이 그대로 날아갔다.
  // 서버가 프롬프트로 캐시하므로 다시 걸어도 중복 과금은 없다.
  return withRetry(async () => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(330_000),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || `${what} ${r.status}`)
    // 서버는 '/api/image/file/…' 처럼 루트 기준으로 답한다. 그 주소는 앱이 사이트 루트에
    // 있을 때만 맞는다. 하위 경로 배포나 다른 도메인 API 에서는 여기서 고쳐 둬야
    // 저장된 Run 안의 <img src> 가 나중에도 열린다.
    return { ...j, url: absolutize(j.url) } as GenResult
  }, {
    tries: 3,
    onRetry: (n, wait, msg) => console.warn(`[image] ${what} 실패(${msg}) · ${wait / 1000}초 뒤 ${n + 1}번째 시도`),
  })
}

/** 신규 생성 · 동일 프롬프트는 서버 캐시로 재사용되어 중복 과금이 없다 */
export function generateImage(prompt: string, engine: EngineId = 'detail'): Promise<GenResult> {
  return imageCall(apiUrl('/api/image/generate'), { prompt, size: '1024x1024', engine }, 'generate')
}

/** 편집 · S3 추가 뷰·컬러웨이는 신규 생성이 아니라 기준 렌더의 편집 (지시서 S3-③④) */
export function editImage(baseHash: string, prompt: string, engine: EngineId = 'detail'): Promise<GenResult> {
  return imageCall(apiUrl('/api/image/edit'), { baseHash, prompt, size: '1024x1024', engine }, 'edit')
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

// 소재명 → 마감 서술 · "patent"라고만 쓰면 광택이 안 살아난다 (Gemini QA 지적)
const FINISH_EN: Record<string, string> = {
  patent: 'high-gloss patent leather with sharp mirror-like specular highlights',
  calf: 'smooth full-grain calf leather with a soft satin sheen and visible pores',
  nappa: 'soft nappa leather with a gentle sheen',
  suede: 'brushed suede with a clearly readable napped texture',
  knit: 'fine technical knit with a visible loop structure',
  'engineered mesh': 'engineered mesh with an open breathable weave',
  synthetic: 'matte technical synthetic with a uniform surface',
}

// 공법 → 눈에 보이는 단서 · 스케치·렌더가 공법 차이를 시각으로 구분해야 한다 (Gemini QA 지적)
const CONSTRUCTION_EN: Record<string, string> = {
  goodyear: 'goodyear welt construction with a clearly visible stitched welt line running around the sole edge',
  blake: 'blake-stitched construction with a close-trimmed sleek sole edge',
  cemented: 'cemented construction with a clean bonded sole joint and no welt stitching',
  vulcanized: 'vulcanized construction with a foxing tape wrapping the sole edge',
  cupsole: 'cupsole construction with a raised rubber sidewall wrapping the lower upper',
  direct_injection: 'direct-injected sole flowing seamlessly into the upper',
  handsewn: 'handsewn moccasin construction with visible hand stitching',
  moccasin: 'moccasin construction with a raised apron seam',
}

// 힐 높이는 숫자만으론 스케일이 안 잡힌다 · 상대 표현을 붙인다
function heelQualifier(h: number, athletic: boolean): string {
  if (athletic) return h >= 42 ? 'a visibly tall max-cushion stack' : h >= 32 ? 'a substantial mid-height stack' : 'a low-profile stack'
  return h >= 60 ? 'a visibly tall elevated heel' : h >= 35 ? 'a clearly raised mid-height heel' : h >= 18 ? 'a modest low heel' : 'an almost flat profile'
}

/** 스펙 필드를 프롬프트 구절로 · 유형에 따라 의미 없는 필드는 뺀다 */
function shoeSpecPhrase(spec: DesignSpec): string {
  const f = spec.fields as Record<string, string | number | boolean>
  const mat = String(f.upper_material ?? '')
  const finish = Object.keys(FINISH_EN).find(k => mat.startsWith(k))
  const athletic = f.heel_type === 'sport_midsole'
  const heelH = Number(f.heel_height_mm) || 20
  const construction = CONSTRUCTION_EN[String(f.sole_construction)]
  const parts = [
    TOE_EN[String(f.toe_shape)],
    athletic
      ? `${heelH}mm thick cushioned midsole, ${heelQualifier(heelH, true)}`
      : `${heelH}mm ${HEEL_EN[String(f.heel_type)] ?? 'heel'}, ${heelQualifier(heelH, false)}`,
    construction,
    `upper divided into ${f.panel_count} panels`,
    finish ? `${mat} upper, ${FINISH_EN[finish]}` : `${mat} upper`,
    `${String(f.closure).replace(/_/g, ' ')} closure`,
  ]
  if (f.midsole_foam) parts.push(`${f.midsole_foam} midsole`)
  if (f.plate && f.plate !== 'none') parts.push(`${f.plate} plate embedded in the midsole`)
  if (f.lug_depth_mm) parts.push(`${f.lug_depth_mm}mm deep outsole lugs`)
  const shaft = Number(f.shaft_height_mm) || 0
  if (shaft > 0) parts.push(`${shaft}mm shaft height`)
  return parts.filter(Boolean).join(', ')
}

/** 스케치용 스펙 구절 · 선으로 그릴 수 있는 것만.
 *
 *  shoeSpecPhrase 는 렌더용으로 쓰였고 "mirror-like specular highlights" 같은 사진 마감과
 *  mm 수치를 담는다. 그게 스케치 프롬프트에도 그대로 실리고 있었다 — 무색 선화에 광택을
 *  지시하고, 이미지 모델이 구분해 그리지도 못하는 25mm/29mm 를 적는 식이다 (규칙 12 위반).
 *  스케치가 말할 수 있는 것은 비례·선·구조뿐이다: 토 형태, 상대적 높이, 패널 분할,
 *  클로저의 형태, 공법이 만드는 가시적 선(웰트 스티치 등), 목높이의 유무. */
function sketchSpecPhrase(spec: DesignSpec): string {
  const f = spec.fields as Record<string, string | number | boolean>
  const athletic = f.heel_type === 'sport_midsole'
  const heelH = Number(f.heel_height_mm) || 20
  const construction = CONSTRUCTION_EN[String(f.sole_construction)]
  const parts = [
    TOE_EN[String(f.toe_shape)],
    athletic ? heelQualifier(heelH, true) : `${HEEL_EN[String(f.heel_type)] ?? 'heel'}, ${heelQualifier(heelH, false)}`,
    construction,                                        // 공법은 웰트 선·폭싱 등 '보이는 선'을 만든다
    `upper divided into ${f.panel_count} panels`,
    `${String(f.closure).replace(/_/g, ' ')} closure`,
  ]
  if (f.plate && f.plate !== 'none') parts.push('a plate line visible along the midsole sidewall')
  const shaft = Number(f.shaft_height_mm) || 0
  if (shaft > 0) parts.push(shaft > 250 ? 'a tall shaft' : 'an ankle-height shaft')
  return parts.filter(Boolean).join(', ')
}

/** 스케치용 브랜드 구절 · 선으로 그릴 수 있는 것만.
 *
 *  brandPromptClause 는 렌더용이다 — 팔레트 hex, 선호 소재, 사진용 로고 문구가 들어 있다.
 *  그게 "no color" 스케치 프롬프트에 그대로 실려, 무색 지시와 색 지정이 한 문장에서
 *  싸우고 있었다. 스케치 단계의 브랜드는 둘뿐이다: 형태로 알아볼 시그니처와,
 *  마크가 앉을 자리(선화로 표현) 또는 마크 금지. */
function sketchBrandClause(b: BrandIdentity | undefined): string {
  if (!b) return ''
  const parts: string[] = []
  if (b.signatureElements.length)
    parts.push(`Carry the brand's structural signatures where they are drawable as line work: ${b.signatureElements.join(', ')}.`)
  if (b.applyLogoToImages && b.logo && b.logo.placement !== 'none') {
    const where: Record<string, string> = {
      tongue: 'on the tongue', heel: 'on the heel counter', side: 'on the lateral side panel',
      insole: 'on the insole', clasp: 'on the clasp', pendant: 'on the pendant face',
    }
    parts.push(`Reserve a clean, unmarked area ${where[b.logo.placement] ?? 'on the side panel'} where the brand mark will sit. Do not draw any logo, letters or symbol there.`)
  } else {
    parts.push('No logo or mark anywhere.')
  }
  if (b.forbidden.length) parts.push(`Never draw: ${b.forbidden.join(', ')}.`)
  return parts.join(' ')
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

/** 이 안이 무엇을 앞세우는가 · 신호 조합 이름을 프롬프트 지시로 바꾼다.
 *  같은 티어의 안들이 서로 닮지 않으려면, 스펙 숫자만이 아니라 무엇이 먼저 읽히는지가 달라야 한다. */
function emphasisClause(spec: DesignSpec): string {
  const label = (spec as { comboLabel?: string }).comboLabel
  if (!label) return ''
  return `This design leads with one idea: ${label.replace(/^Only /, '')}. Make that the first thing the eye reads, and keep everything else quiet.`
}

// ── 실루엣 읽기 · 선화에서 실제로 달라질 수 있는 유일한 것 ─────────────
//
// 스케치 프롬프트에는 "no colour, no shading, no texture"가 박혀 있다. 그래서 스펙 변화가
// 소재와 마감에 몰려 있으면 — 스웨이드든 페이턴트든 — 완전히 같은 선 그림이 나온다.
// 힐 25mm와 30mm, 패널 4장과 5장도 이미지 모델은 구분해 그리지 못한다.
//
// 선으로 구분되는 것은 비례와 선 구성뿐이다. 그래서 안마다 다른 "읽기"를 하나씩 준다.
// 어휘는 베리에이션 슬라이더와 같은 축을 쓴다 — 같은 언어를 두 벌 만들 이유가 없다.
const SILHOUETTE_READS: { key: string; label: string; clause: string }[] = [
  { key: 'slim', label: 'Slim and long',
    clause: 'Draw it slim and long: a narrow waist, a low-slung sole edge, and a toe that runs out rather than up. Fewer seams, longer unbroken lines.' },
  { key: 'volume', label: 'Voluminous',
    clause: 'Draw it voluminous: a fuller instep, a rounder toe box with visible height, and a sole that reads thick from the side. The outline should feel inflated against the last.' },
  { key: 'structured', label: 'Structured and sharp',
    clause: 'Draw it structured and sharp: crisp panel breaks meeting at hard angles, a defined heel counter edge, and straight seam runs rather than curved ones.' },
  { key: 'fluid', label: 'Soft and fluid',
    clause: 'Draw it soft and fluid: panel seams that curve into one another, a rounded collar line, and no hard corners anywhere in the outline.' },
  { key: 'dense', label: 'Dense detail',
    clause: 'Draw it dense with detail: more panel divisions than usual, visible topstitch runs along each seam, and small functional pieces such as pull loops and reinforcement patches.' },
  { key: 'airy', label: 'Stripped back',
    clause: 'Draw it stripped back: the fewest panels the construction allows, one continuous upper wherever possible, and no decorative stitching at all.' },
  { key: 'grounded', label: 'Grounded stance',
    clause: 'Draw it with a grounded stance: a wider sole footprint that flares slightly beyond the upper, a lower heel-to-toe difference, and a flat contact line.' },
  { key: 'lifted', label: 'Lifted stance',
    clause: 'Draw it lifted: a taller heel block that steps back from the upper, a raised heel-to-toe pitch, and a visibly lighter forefoot edge.' },
]

/** 이 안이 어떤 실루엣으로 읽혀야 하는가 · 안마다 다른 것이 배정된다 */
export function silhouetteRead(index: number): { key: string; label: string; clause: string } {
  return SILHOUETTE_READS[index % SILHOUETTE_READS.length]
}

function silhouetteClause(spec: DesignSpec): string {
  const r = (spec as { silhouetteRead?: string }).silhouetteRead
  if (!r) return ''
  return SILHOUETTE_READS.find(x => x.key === r)?.clause ?? ''
}

/** 게놈의 그리기 지시 · 단일 진실 원천 (지시서 규칙 11).
 *  게놈이 있으면 Hero와 Supporting이 프롬프트의 구조 지시가 된다.
 *  아톰·조합 라벨을 직접 싣던 경로는 게놈 앞에서 물러난다. */
function genomeClause(spec: DesignSpec): string {
  const g = spec.genome
  if (!g) return ''
  const stance = g.stance === 'grounded'
    ? 'Give it a grounded stance with a flat, planted contact line.'
    : g.stance === 'lifted'
      ? 'Give it a lifted stance with a visibly raised heel-to-toe pitch.'
      : ''
  return [
    `The one idea this design leads with: ${g.hero_mutation.drawing_instruction}`,
    ...g.supporting.slice(0, 3),
    stance,
  ].filter(Boolean).join(' ')
}

// ── 파트별 절 · 게놈의 parts 블록을 프롬프트로 ────────────────────────
//
// 신발은 어퍼 하나가 아니다. 예전 프롬프트는 upper_material 하나가 신발 전체의 소재였고,
// 미드솔·아웃솔은 "34mm midsole" 같은 수치 한 줄이었다. 백카운터·토캡·설포·칼라는 이름조차
// 안 나왔다. 게놈이 파트마다 form(선으로 그릴 것)과 material(렌더에서만)을 갖게 됐으니,
// 스케치에는 form 만, 렌더에는 둘 다 실린다 — 층이 그대로 지켜진다.
const PART_EN: Record<string, string> = {
  heel_counter: 'Heel counter', toe_cap: 'Toe cap', midsole: 'Midsole', outsole: 'Outsole',
  tongue_eyestay: 'Tongue and eyestay', collar: 'Collar', overlays: 'Overlays',
}
// materialFor: 파트별 소재를 갈아끼운다 (컨셉 렌더 전용).
// 형태는 게놈이 쥔다 — 같은 스케치에서 나온 디자인들이니 실루엣·패널이 달라지면 안 된다.
// 소재와 색만 컨셉의 축이다. 이 구분이 없으면 컨셉이 "어퍼를 모노필라먼트 메쉬로"라고
// 말하는 같은 프롬프트 안에서 게놈이 "어퍼를 엔지니어드 메쉬로"라고 말해, 지시가 서로 싸운다.
// 그러면 소재 전환(material_shift) 컨셉이 소재를 못 바꾼다.
export function partsClause(spec: DesignSpec, mode: 'sketch' | 'render', materialFor?: Record<string, string>): string {
  const parts = spec.genome?.parts
  if (!parts) return ''
  const lines = Object.entries(parts)
    .filter(([, v]) => v && v.form && v.form.toLowerCase() !== 'none')
    .map(([k, v]) => {
      if (mode === 'sketch') return `${PART_EN[k] ?? k}: ${v.form}`
      const mat = materialFor?.[k] ?? v.material
      return `${PART_EN[k] ?? k}: ${v.form}${mat && mat.toLowerCase() !== 'none' ? `, in ${mat}` : ''}`
    })
  return lines.length ? `Part by part — ${lines.join('. ')}.` : ''
}

/** 아웃솔(바닥면) 스케치 · 기준 스케치와 짝을 이룬다.
 *  미드솔·아웃솔은 어퍼만큼 중요한데 측면 스케치에는 러그·플렉스 그루브·컴파운드 분할이 안 보인다.
 *  게놈의 outsole.form 이 그 도면의 지시다. 스케치와 같은 흑백 선화 규칙을 따른다. */
export function outsoleSketchPrompt(spec: DesignSpec): string {
  const o = spec.genome?.parts?.outsole
  const f = spec.fields as Record<string, string | number | boolean>
  const tread = o?.form
    ? o.form
    : f.lug_depth_mm
      ? `lugged tread with ${f.lug_depth_mm}mm lugs, heel and forefoot zones distinct`
      : 'segmented rubber tread with flex grooves across the forefoot and a distinct heel pad'
  return [
    `Black-ink technical drawing of the OUTSOLE of the same ${en(spec.itemType)}, seen straight from below (bottom view), toe at the top of the frame and heel at the bottom.`,
    `Tread pattern: ${tread}.`,
    'Show lug shapes, flex grooves and any compound split between heel and forefoot as clean line work. Outline the sole perimeter exactly matching the shoe form.',
    'One single outsole centred in frame, no side view, no upper visible, no second object.',
    'Black ink line on white paper, single consistent line weight, no colour, no shading, no photographic texture.',
    'No text, no numbers, no measurement lines, no labels, no logo.',
  ].join(' ')
}

export function sketchPrompt(spec: DesignSpec, engine: EngineId = 'detail', brand?: BrandIdentity, _trend?: TrendClauseInput | null, line?: FootwearLineProfile): string {
  // 스케치는 측면 한 컷이다. 한 장에 여러 시점을 넣으면 카드에서 서로 겹쳐 읽히지 않는다.
  // 다른 각도는 S3에서 컬러 렌더의 뷰로 따로 만든다.
  //
  // 층이 명확해야 한다: 스케치 = 형태(비례·선·구조·마크 자리), 렌더 = 소재·색·부자재.
  // 그래서 여기는 sketchSpecPhrase / sketchBrandClause 를 쓴다. 렌더용 구절을 그대로 실으면
  // 무색 선화에 광택·팔레트가 지시되고, 층이 섞이면 스케치와 디자인의 역할 구분이 사라진다.
  const view = SHOE_VIEW.lateral + ', one single shoe only, one single view, nothing else in frame'
  return shapePrompt(engine, {
    subject: en(spec.itemType), spec: sketchSpecPhrase(spec), view,
    brand: [silhouetteClause(spec), spec.genome ? genomeClause(spec) : emphasisClause(spec), partsClause(spec, 'sketch'), linePromptClause(line), sketchBrandClause(brand)].filter(Boolean).join(' '),
    mode: 'sketch',
  })
}

export function renderPrompt(spec: DesignSpec, engine: EngineId = 'detail', brand?: BrandIdentity, trend?: TrendClauseInput | null, line?: FootwearLineProfile): string {
  return shapePrompt(engine, {
    subject: en(spec.itemType), spec: shoeSpecPhrase(spec), view: SHOE_VIEW.lateral,
    brand: [silhouetteClause(spec), spec.genome ? genomeClause(spec) : emphasisClause(spec), linePromptClause(line), trendPromptClause(trend ?? null), brand ? brandPromptClause(brand) : ''].filter(Boolean).join(' '),
    mode: 'render',
  })
}

// ── 컨셉 렌더 · 한 스케치 위의 N번째 디자인 ─────────────────────────
//
// 이게 '베리에이션'이다. 스케치(형태)는 그대로 두고 소재·컬러·창의도만 갈린다.
// 예전에는 스케치 변형(흑백 어퍼 재해석) → 고정 6개 소재 표 → 렌더 뒤 슬라이더 편집,
// 세 갈래가 따로 있었고 어느 것도 조사·게놈·브랜드를 보지 않았다.
// 이제 컨셉은 서버(authorConcepts)가 그 셋을 근거로 저작하고, 여기서는 그 render_clause 를
// 스케치 편집 프롬프트로 감싸기만 한다. 파트별 소재·색이 문단으로 들어간다.
export function conceptRenderPrompt(spec: DesignSpec, concept: DesignConcept, brand?: BrandIdentity): string {
  const markClause = brand ? brandPromptClause(brand) : ''
  const drawsMark = !!brand?.applyLogoToImages && !!brand.logo?.style?.prompt_clause
  return [
    'Replace this line drawing with a full-colour photorealistic studio product photograph of the same shoe.',
    'The output must be a photograph, not a drawing: no outlines, no white fill, no flat areas.',
    'Keep the silhouette, panel lines, lacing layout, midsole geometry and the outsole line exactly as drawn — nothing about the form changes.',
    concept.render_clause,
    // 컨셉이 파트 소재를 지정했으면 그것을 쓴다. 게놈 소재를 그대로 실으면
    // 바로 윗줄의 render_clause 와 모순된 지시가 한 프롬프트에 두 번 들어간다.
    partsClause(spec, 'render', concept.part_materials),
    markClause,
    'Strict lateral side view, one single shoe, toe pointing to the left and heel on the right, seamless white background, sharp focus, real material texture under studio light.',
    drawsMark
      ? 'Laces as clearly separated cords with distinct eyelets. No text, no lettering, no watermark, no human.'
      : 'Laces as clearly separated cords with distinct eyelets. No text, no logo, no watermark, no human.',
  ].filter(Boolean).join(' ')
}

/** 스케치 → 기준 렌더 · 새로 그리지 않고 테크시트를 사진으로 옮긴다.
 *  스케치의 실루엣·패널·아웃솔 기하가 렌더에 그대로 보존된다 (Gemini QA 지적). */
// 색이 들어가는 단계에서만 보이는 것들 · 소재 해석과 컬러 블로킹.
// 선화는 질감을 못 그린다. 그래서 소재 변화는 여기서 갈라야 의미가 있다.
// 스케치 한 장에서 디자인 여러 장을 뽑을 때, 이 목록이 장마다 다른 해석을 준다.
// (예전 자리) MATERIAL_READS 고정 6개 표는 서버 authorConcepts 가 조사·게놈·브랜드를 근거로 저작하는 컨셉으로 대체됐다.

export function renderFromSketchPrompt(spec: DesignSpec, trend?: TrendClauseInput | null, line?: FootwearLineProfile, brand?: BrandIdentity): string {
  // 브랜드 마크를 사진에 그려 넣을지는 브랜드 설정이 정한다.
  // 참고 사진에서 배치 규칙을 읽어 두었으면 그 형태 묘사가 여기 실린다.
  const markClause = brand ? brandPromptClause(brand) : ''
  const drawsMark = !!brand?.applyLogoToImages && !!brand.logo?.style?.prompt_clause
  return [
    'Replace this line drawing with a full-colour photorealistic studio product photograph of the same shoe.',
    'The output must be a photograph, not a drawing: no outlines, no white fill, no flat areas.',
    'Every surface carries real material colour and texture, with studio lighting, soft shadows and highlights.',
    'Keep the silhouette, panel lines, lacing layout, midsole geometry and the outsole line exactly as drawn.',
    `Materials and colour: ${shoeSpecPhrase(spec)}.`,
    spec.genome ? genomeClause(spec) : emphasisClause(spec),
    partsClause(spec, 'render'),
    linePromptClause(line),
    trendPromptClause(trend ?? null),
    markClause,
    'Strict lateral side view, one single shoe, toe pointing to the left and heel on the right, seamless white background, sharp focus.',
    // 마크를 그리라고 해 놓고 같은 문장에서 로고를 금지하면 모델이 마크를 지운다.
    drawsMark
      ? 'Laces as clearly separated cords with distinct eyelets. No text, no lettering, no watermark, no human.'
      : 'Laces as clearly separated cords with distinct eyelets. No text, no logo, no watermark, no human.',
  ].filter(Boolean).join(' ')
}

/** 추가 뷰 · 동일 객체를 유지한 채 시점만 바꾸는 편집 지시 */
export function viewEditPrompt(viewKey: string): string {
  const v = SHOE_VIEW[viewKey] ?? SHOE_VIEW.q34
  return `Keep the exact same product design, materials, proportions and color. Only change the camera angle to: ${v}. Same seamless white background and lighting.`
}

// ── 컬러웨이 · 어디서 왔는지가 곧 근거다 ─────────────────────────────
//
// 예전에는 gold/black/bordeaux/ivory/silver 고정 목록이었다 — 주얼리 시절 잔재라,
// 브랜드가 팔레트를 정성껏 설정해도 컬러웨이는 그걸 본 적이 없었다.
// 순서가 곧 논리다: 브랜드 팔레트(정체성) → 시즌 팔레트(조사 근거) → 중립 안전색.
// 각 컬러웨이는 자기가 어디서 왔는지(why)를 들고 다니고, 그 한 줄이 보드 카드에 실린다.

export interface ColorwayPlan { name: string; hex?: string; clause: string; why: string }

const NEUTRAL_COLORWAYS: ColorwayPlan[] = [
  { name: 'core black', clause: 'deep matte black with tonal details', why: 'Neutral anchor: the safe volume colour in nearly every footwear range.' },
  { name: 'off-white', clause: 'warm off-white with natural tonal stitching', why: 'Neutral anchor: reads clean at retail and photographs well against dark product walls.' },
  { name: 'grey tonal', clause: 'mid grey, sole and upper in close tones', why: 'Neutral anchor: bridges the range when the brand and season palettes are both strong.' },
]

/** 이 Run 의 컬러웨이 계획 · 브랜드 팔레트와 시즌 팔레트에서 뽑고, 출처를 기록한다 */
export function planColorways(count: number, brand?: BrandIdentity, trend?: TrendClauseInput | null): ColorwayPlan[] {
  const out: ColorwayPlan[] = []
  for (const c of brand?.colorPalette ?? []) {
    if (out.length >= count) break
    out.push({
      name: c.name, hex: c.hex,
      clause: `${c.name} (${c.hex}) as the dominant colour, applied as the brand wears it`,
      why: `Brand palette: ${c.name} is one of the colours this brand claims as its own.`,
    })
  }
  for (const c of trend?.colors ?? []) {
    if (out.length >= count) break
    if (out.some(x => x.name === c.name)) continue
    out.push({
      name: c.name, hex: c.hex,
      clause: `${c.name} (${c.hex}) as the dominant colour`,
      why: `Season palette: ${c.name} came out of the ${trend?.macroName ?? 'season'} research, not from taste.`,
    })
  }
  for (const c of NEUTRAL_COLORWAYS) {
    if (out.length >= count) break
    if (out.some(x => x.name === c.name)) continue
    out.push(c)
  }
  return out.slice(0, count)
}

/** 컬러웨이 · 형태 불변, 색만 변경 */
export function colorwayEditPrompt(cw: ColorwayPlan | string): string {
  // 옛 저장본 호환 · 이름 문자열만 남아 있는 Run 이 있다
  const clause = typeof cw === 'string' ? cw : cw.clause
  return `Keep the exact same product, same camera angle, same shape and proportions. Only recolor the main material to ${clause}. Same seamless white background and lighting.`
}

// (예전 자리) 3D 턴어라운드 4뷰 프롬프트는 2026-08-13 단일 이미지 3D 로 바뀌며 호출자가 사라졌다. 제거.

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

// (예전 자리) 렌더 뒤 베리에이션 — 고정 8축 목록과 스타일 슬라이더 — 은 conceptRenderPrompt + 서버 authorConcepts 로 대체됐다.
// 둘 다 조사·게놈·브랜드를 보지 않아 카드가 '왜'를 말할 수 없었다. 스케치당 여러 디자인은 이제 컨셉으로 갈린다.

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
    build: (_subject, p, mood) => [
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
  const r = await fetch(apiUrl('/api/image/logo'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseHash, dataUrl: logo.dataUrl, placement: logo.placement, scale: logo.scale,
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `logo ${r.status}`)
  return { ...j, url: absolutize(j.url) }
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


/** ordered에는 [front, left, back, right] 순서로 해시를 넣는다. 없는 자리는 null. */
/** 단일 이미지 → 3D (2026-08-13 방식 변경).
 *  턴어라운드 4뷰를 만들지 않는다 — 뷰 간 불일치가 형상을 흐렸고, 선정작당 이미지 3장이 굳는다.
 *  기준 렌더 해시 하나만 보낸다. */
export async function generateModel(single: string, meta: {
  subject?: string; itemType?: string
}): Promise<ModelResult> {
  const r = await fetch(apiUrl('/api/model/generate'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ single, ...meta }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `model ${r.status}`)
  return { ...j, url: absolutize(j.url) }
}
