// ── VRINGON Shoe Agent · 도메인 타입 (신발 전용) ─────────────────────
// 주얼리는 별도 제품(vringon-jewelry-agent)으로 분리되었다. 여기는 신발만 다룬다.

// lineFingerprint 가 화면에 그대로 붙는 요약을 만든다. i18n 은 types 를 안 부르므로 순환은 없다.
import { t } from './i18n'

export type Mode = 'trend' | 'series' | 'moodboard'
/** 카테고리는 신발 하나다. 저장된 Run과의 호환을 위해 리터럴 타입만 남긴다. */
export type Category = 'shoe'
export type DesignTier = 'core' | 'push' | 'signature'
export type Stage = 'S1' | 'S2' | 'S3' | 'S4' | 'S5'

export const MODE_LABEL: Record<Mode, string> = {
  trend: 'Trend', series: 'Series', moodboard: 'Moodboard',
}
export const CAT_LABEL: Record<Category, string> = { shoe: 'Footwear' }
export const TIER_LABEL: Record<DesignTier, string> = {
  core: 'Core', push: 'Push', signature: 'Signature',
}

// 티어의 의미를 생산 현실에 묶는다 (지시서 9.3).
// 이미지의 과감함이 아니라 라스트·몰드 변경 수준이 티어를 가른다.
export const TIER_MEANING: Record<DesignTier, string> = {
  core: 'Existing last and existing bottom unit. Colour, material and minor upper changes only.',
  push: 'Keeps either the last or the bottom unit, and changes the structure of the other.',
  signature: 'New last, new outsole mould, new heel or a core technology package.',
}

// ── 품목 분류 · 계열 → 세부 유형 ────────────────────────────────────
// en은 이미지 프롬프트에, label은 화면에 쓴다. 한 곳에서만 정의한다.
export interface TypeDef { id: string; label: string; en: string }
export interface GroupDef { id: string; label: string; note: string; types: TypeDef[] }

export const TAXONOMY: Record<Category, GroupDef[]> = {
  shoe: [
    {
      id: 'sneaker', label: 'Sneakers', note: 'Running, court, lifestyle', types: [
        { id: 'running', label: 'Road daily trainer', en: 'road running daily trainer with engineered mesh upper, cushioned rocker midsole and segmented rubber outsole' },
        { id: 'max_cushion', label: 'Max cushion', en: 'max-cushion running shoe with a tall soft midsole stack, wide platform and moderate rocker' },
        { id: 'tempo_racer', label: 'Tempo / racing', en: 'lightweight tempo racing shoe with a low-slung aggressive rocker midsole and thin engineered mesh upper' },
        { id: 'trail', label: 'Trail', en: 'trail running shoe with aggressive lugged outsole, toe bumper and reinforced upper' },
        { id: 'court_sneaker', label: 'Court', en: 'low-top court sneaker with leather upper and cupsole' },
        // 하이컷 코트화는 스니커에서 가장 흔한 원형 중 하나인데 자리가 없었다.
        // court_sneaker 는 'low-top' 이라고 못박혀 있어서, 하이컷 아카이브를 올리면
        // 조사와 프롬프트가 로우탑을 말하고 사진은 하이컷인 상태가 된다.
        { id: 'court_high', label: 'Court high', en: 'high-top court sneaker with leather upper, padded ankle collar and rubber cupsole' },
        { id: 'lifestyle_runner', label: 'Lifestyle runner', en: 'retro lifestyle runner with layered suede and nylon mesh upper and EVA wedge midsole' },
        { id: 'chunky_sneaker', label: 'Chunky', en: 'chunky dad sneaker with layered exaggerated midsole' },
      ],
    },
    {
      id: 'dress', label: 'Dress', note: 'Loafer, derby, oxford', types: [
        { id: 'loafer', label: 'Penny loafer', en: 'penny loafer with raised apron seam and saddle strap' },
        { id: 'horsebit_loafer', label: 'Horsebit loafer', en: 'horsebit loafer with metal snaffle hardware across the vamp' },
        { id: 'chunky_loafer', label: 'Chunky loafer', en: 'chunky loafer with a lugged platform sole and high rounded volume' },
        { id: 'derby', label: 'Derby', en: 'derby shoe with open lacing' },
        { id: 'oxford', label: 'Oxford', en: 'oxford shoe with closed lacing' },
        { id: 'monk', label: 'Monk strap', en: 'monk strap shoe with metal buckle' },
      ],
    },
    {
      id: 'heel', label: 'Heels', note: 'Pump, slingback', types: [
        { id: 'pump', label: 'Pump', en: 'pump' },
        { id: 'slingback', label: 'Slingback', en: 'slingback with heel strap' },
        { id: 'mary_jane', label: 'Mary jane', en: 'mary jane shoe with instep strap' },
        { id: 'mule', label: 'Mule', en: 'backless mule' },
      ],
    },
    {
      id: 'flat', label: 'Flats', note: 'Ballet, driving', types: [
        { id: 'ballet_flat', label: 'Ballet flat', en: 'ballet flat' },
        { id: 'driving', label: 'Driving', en: 'driving moccasin with pebbled rubber pod sole' },
        { id: 'espadrille', label: 'Espadrille', en: 'espadrille flat with jute-wrapped sole' },
      ],
    },
    {
      id: 'boot', label: 'Boots', note: 'Ankle, chelsea, hiking', types: [
        { id: 'ankle_boot', label: 'Ankle boot', en: 'ankle boot' },
        { id: 'chelsea', label: 'Chelsea', en: 'chelsea boot with elastic side gore' },
        { id: 'combat', label: 'Combat', en: 'lace-up combat boot with lugged sole' },
        { id: 'long_boot', label: 'Knee-high', en: 'knee-high long boot' },
        { id: 'hiking', label: 'Hiking', en: 'hiking boot with deep lugged outsole, protective toe cap and padded collar' },
      ],
    },
    {
      id: 'sandal', label: 'Sandals', note: 'Slide, sport, strappy', types: [
        { id: 'strap_sandal', label: 'Strappy', en: 'strappy sandal' },
        { id: 'slide', label: 'Slide', en: 'single-band slide sandal' },
        { id: 'sport_sandal', label: 'Sport', en: 'sport sandal with moulded footbed and adjustable webbing straps' },
        { id: 'gladiator', label: 'Gladiator', en: 'gladiator sandal with multiple ankle straps' },
      ],
    },
  ],
}

export const ALL_TYPES: TypeDef[] = Object.values(TAXONOMY).flatMap(gs => gs.flatMap(g => g.types))
export const TYPE_LABEL: Record<string, string> = Object.fromEntries(ALL_TYPES.map(t => [t.id, t.label]))
export const TYPE_EN: Record<string, string> = Object.fromEntries(ALL_TYPES.map(t => [t.id, t.en]))

export function groupOf(category: Category, typeId: string): GroupDef | undefined {
  return TAXONOMY[category].find(g => g.types.some(t => t.id === typeId))
}
export function firstTypeOf(category: Category, groupId: string): string {
  return TAXONOMY[category].find(g => g.id === groupId)?.types[0].id ?? TAXONOMY[category][0].types[0].id
}

// ── Footwear Line Profile (지시서 2장 · 22장) ────────────────────────
// "어떤 라스트 위에 어떤 어퍼 구조와 바텀 유닛을 쓰는가"를 조사 전에 고정한다.
// 모르는 값은 'unknown'으로 두는 것이 원칙이다. 사진만으로 라스트 치수를 확정하지 않는다.

export type Unknown = 'unknown'

export interface LineProduct {
  useCase: 'daily' | 'running' | 'work' | 'formal' | 'outdoor' | 'travel' | 'occasion' | Unknown
  environment: 'urban' | 'indoor' | 'trail' | 'court' | 'wet_climate' | 'all' | Unknown
  targetConsumer: 'women' | 'men' | 'unisex' | 'kids'
  season: string                    // 'FW26', 'SS27', 'carryover'
  climate: 'all_season' | 'hot_humid' | 'cold_dry' | 'rainy' | Unknown
}

export interface LineLastFit {
  lastFamily: string                // 'performance running medium volume' | 'existing dress last' | 'unknown'
  baseSize: string                  // 'EU 42' | 'US W7' | 'unknown'
  width: string                     // 'D' | 'D, 2E' | 'unknown'
  toeShape: 'round' | 'almond' | 'square' | 'pointed' | Unknown
  toeVolume: 'low' | 'medium' | 'high' | Unknown
  heelHold: 'relaxed' | 'standard' | 'secure' | Unknown
  existingLastReuse: boolean        // 기존 라스트 재사용 전제인가
}

export interface LineUpper {
  outer: string                     // 'engineered mesh' | 'full-grain calf' | 'suede' | 'knit' | 'synthetic' | 'unknown'
  lining: string
  reinforcement: 'none' | 'light' | 'structured' | Unknown
  closure: 'lace' | 'slip_on' | 'buckle' | 'strap' | 'zip' | 'elastic_gore' | 'dial' | Unknown
  protection: 'none' | 'water_resistant' | 'waterproof_membrane' | Unknown
}

export interface LineBottom {
  midsole: string                   // 'supercritical foam' | 'EVA' | 'PU' | 'leather/none' | 'unknown'
  plate: 'none' | 'nylon' | 'tpu' | 'carbon' | Unknown
  outsole: string                   // 'segmented rubber' | 'full rubber' | 'leather' | 'rubber forepart' | 'unknown'
  stackBand: 'low' | 'mid' | 'high' | Unknown
  dropMm: string                    // '6-10' | '8' | 'unknown'
  rocker: 'none' | 'mild' | 'moderate' | 'aggressive' | Unknown
  heel: 'none' | 'stacked' | 'block' | 'wedge' | 'stiletto' | 'kitten' | Unknown
  existingBottomReuse: boolean      // 기존 몰드·아웃솔 재사용 전제인가
}

export interface LineConstruction {
  lasting: 'strobel' | 'board' | 'moccasin' | Unknown
  soleAttachment: 'cemented' | 'vulcanized' | 'blake' | 'goodyear' | 'direct_injection' | 'cupsole' | 'handsewn' | Unknown
}

export interface LinePerformance {
  weightTargetG: string             // '240-285 (US M9)' | 'unknown'
  cushioning: 'firm' | 'moderate' | 'high' | 'max' | Unknown
  stability: 'neutral' | 'neutral_stable' | 'stability' | Unknown
  wetGrip: 'not_required' | 'preferred' | 'required' | Unknown
  flexibility: 'stiff' | 'moderate' | 'flexible' | Unknown
}

/** 조사할 수 있는 시장. GLOBAL 은 참조로만 쓴다 — 글로벌 정가라는 것은 없기 때문이다. */
export type MarketId = 'KR' | 'US' | 'JP'
export type ReferenceMarketId = MarketId | 'GLOBAL'

export const HOME_MARKETS: { id: MarketId; label: string }[] = [
  { id: 'KR', label: '한국' }, { id: 'US', label: '미국' }, { id: 'JP', label: '일본' },
]
export const REFERENCE_MARKETS: { id: ReferenceMarketId; label: string }[] = [
  ...HOME_MARKETS, { id: 'GLOBAL', label: '글로벌' },
]

export interface LineCommercial {
  /** 파는 시장. 가격 밴드·경쟁군·리테일 지면이 전부 이 시장 기준이다 */
  homeMarket: MarketId
  /** 먼저 보는 시장 0~2곳. 홈보다 앞서 가는 곳을 본다는 뜻이지 파는 곳이 아니다 */
  referenceMarkets: ReferenceMarketId[]
  /** 옛 저장본 호환 · homeMarket 이 없을 때만 읽는다 */
  markets?: string[]
  channels: string[]                // ['DTC', 'department store', 'running specialty']
}

/** 신발 라인 정의 · 조사·프롬프트·리포트·QA 전 과정이 이 값을 공유한다 */
export interface FootwearLineProfile {
  product: LineProduct
  lastFit: LineLastFit
  upper: LineUpper
  bottom: LineBottom
  construction: LineConstruction
  performance: LinePerformance
  commercial: LineCommercial
}

export const UNKNOWN = 'unknown' as const

export function defaultLineProfile(): FootwearLineProfile {
  return {
    product: { useCase: 'daily', environment: 'urban', targetConsumer: 'unisex', season: 'FW26', climate: 'all_season' },
    lastFit: { lastFamily: UNKNOWN, baseSize: UNKNOWN, width: UNKNOWN, toeShape: UNKNOWN, toeVolume: UNKNOWN, heelHold: UNKNOWN, existingLastReuse: true },
    upper: { outer: UNKNOWN, lining: UNKNOWN, reinforcement: UNKNOWN, closure: UNKNOWN, protection: UNKNOWN },
    bottom: { midsole: UNKNOWN, plate: UNKNOWN, outsole: UNKNOWN, stackBand: UNKNOWN, dropMm: UNKNOWN, rocker: UNKNOWN, heel: UNKNOWN, existingBottomReuse: true },
    construction: { lasting: UNKNOWN, soleAttachment: UNKNOWN },
    performance: { weightTargetG: UNKNOWN, cushioning: UNKNOWN, stability: UNKNOWN, wetGrip: UNKNOWN, flexibility: UNKNOWN },
    commercial: { homeMarket: 'KR', referenceMarkets: [], channels: ['DTC'] },
  }
}

/** 저장된 line이 신발 프로필이 맞는지 확인한다.
 *  이 앱이 주얼리도 다루던 시절의 Run이 브라우저에 남아 있고, 그 line은 모양이 전혀 다르다
 *  ({preset, baseMetal, coating, stone}). 그대로 읽으면 화면이 통째로 죽는다.
 *  모양이 아니면 없는 것으로 친다 — 라인 조건 없이도 결과는 읽을 수 있어야 한다. */
export function asFootwearLine(lp: unknown): FootwearLineProfile | undefined {
  const l = lp as Partial<FootwearLineProfile> | undefined
  if (!l || !l.product || !l.lastFit || !l.upper || !l.bottom || !l.construction) return undefined
  return l as FootwearLineProfile
}

/** 시장 한 조각 · 'KR' 또는 'KR←US,JP' */
export function marketFingerprint(c: LineCommercial | undefined): string {
  const home = c?.homeMarket ?? (c?.markets?.[0] as string | undefined) ?? 'KR'
  const refs = c?.referenceMarkets ?? []
  return refs.length ? `${home}←${refs.join(',')}` : home
}

/** 라인 프로필을 사람이 읽는 짧은 지문으로. 리포트 표지와 캐시 키가 같이 쓴다. */
export function lineFingerprint(raw: FootwearLineProfile | undefined, itemType: string): string {
  const lp = asFootwearLine(raw)
  if (!lp) return TYPE_LABEL[itemType] ?? itemType
  // 화면에 그대로 붙는 요약이라 여기서도 사전을 거친다. 저장되는 값은 바뀌지 않는다.
  const bits = [
    t(TYPE_LABEL[itemType] ?? itemType),
    lp.product.useCase !== UNKNOWN ? t(lp.product.useCase) : '',
    t(lp.product.targetConsumer),
    lp.lastFit.lastFamily !== UNKNOWN ? lp.lastFit.lastFamily : '',
    lp.upper.outer !== UNKNOWN ? `${lp.upper.outer} upper` : '',
    lp.bottom.outsole !== UNKNOWN ? lp.bottom.outsole : '',
    lp.construction.soleAttachment !== UNKNOWN ? lp.construction.soleAttachment : '',
    lp.product.season,
    // 같은 라인을 다른 시장으로 돌리면 다른 조사다. 제목에서 구분되어야 한다.
    marketFingerprint(lp.commercial),
  ].filter(Boolean)
  return bits.join(' · ')
}

// ── 빠른 프리셋 (지시서 4장) · 최종 분류가 아니라 입력값 번들 ─────────
export interface LinePreset {
  id: string
  label: string
  blurb: string
  itemType: string
  fill: (lp: FootwearLineProfile) => FootwearLineProfile
}

const P = (base: FootwearLineProfile, patch: {
  product?: Partial<LineProduct>; lastFit?: Partial<LineLastFit>; upper?: Partial<LineUpper>
  bottom?: Partial<LineBottom>; construction?: Partial<LineConstruction>; performance?: Partial<LinePerformance>
  commercial?: Partial<LineCommercial>
}): FootwearLineProfile => ({
  ...base,
  product: { ...base.product, ...patch.product },
  lastFit: { ...base.lastFit, ...patch.lastFit },
  upper: { ...base.upper, ...patch.upper },
  bottom: { ...base.bottom, ...patch.bottom },
  construction: { ...base.construction, ...patch.construction },
  performance: { ...base.performance, ...patch.performance },
  commercial: { ...base.commercial, ...patch.commercial },
})

export const LINE_PRESETS: LinePreset[] = [
  {
    id: 'road_daily', label: 'Road running daily', blurb: 'Daily running · mesh · cushioned rocker · rubber', itemType: 'running',
    fill: lp => P(lp, {
      product: { useCase: 'running', environment: 'urban' },
      lastFit: { lastFamily: 'performance running, medium volume', toeShape: 'round', toeVolume: 'medium', heelHold: 'secure', existingLastReuse: false },
      upper: { outer: 'engineered mesh', lining: 'moisture-management textile', reinforcement: 'light', closure: 'lace', protection: 'none' },
      bottom: { midsole: 'supercritical foam', plate: 'none', outsole: 'segmented rubber', stackBand: 'high', dropMm: '6-10', rocker: 'moderate', heel: 'none', existingBottomReuse: false },
      construction: { lasting: 'strobel', soleAttachment: 'cemented' },
      performance: { weightTargetG: '240-285 (US M9)', cushioning: 'high', stability: 'neutral_stable', wetGrip: 'required', flexibility: 'moderate' },
    }),
  },
  {
    id: 'performance_racing', label: 'Performance racing', blurb: 'Light · high stack · plate · rules check', itemType: 'tempo_racer',
    fill: lp => P(lp, {
      product: { useCase: 'running', environment: 'urban' },
      lastFit: { lastFamily: 'racing, low volume', toeShape: 'round', toeVolume: 'low', heelHold: 'secure', existingLastReuse: false },
      upper: { outer: 'thin engineered mesh', lining: 'minimal', reinforcement: 'none', closure: 'lace', protection: 'none' },
      bottom: { midsole: 'PEBA supercritical foam', plate: 'carbon', outsole: 'thin rubber', stackBand: 'high', dropMm: '6-8', rocker: 'aggressive', heel: 'none', existingBottomReuse: false },
      construction: { lasting: 'strobel', soleAttachment: 'cemented' },
      performance: { weightTargetG: '180-215 (US M9)', cushioning: 'high', stability: 'neutral', wetGrip: 'preferred', flexibility: 'stiff' },
    }),
  },
  {
    id: 'trail_technical', label: 'Trail technical', blurb: 'Lugs · wet grip · toe protection · stability', itemType: 'trail',
    fill: lp => P(lp, {
      product: { useCase: 'outdoor', environment: 'trail', climate: 'all_season' },
      lastFit: { lastFamily: 'trail running, medium volume', toeShape: 'round', toeVolume: 'medium', heelHold: 'secure', existingLastReuse: false },
      upper: { outer: 'ripstop mesh with TPU overlays', lining: 'drainage mesh', reinforcement: 'structured', closure: 'lace', protection: 'water_resistant' },
      bottom: { midsole: 'EVA with rock plate', plate: 'tpu', outsole: 'deep lugged rubber', stackBand: 'mid', dropMm: '4-8', rocker: 'mild', heel: 'none', existingBottomReuse: false },
      construction: { lasting: 'strobel', soleAttachment: 'cemented' },
      performance: { weightTargetG: '260-310 (US M9)', cushioning: 'moderate', stability: 'stability', wetGrip: 'required', flexibility: 'moderate' },
    }),
  },
  {
    id: 'lifestyle_runner', label: 'Lifestyle runner', blurb: 'Fashion sneaker · suede mesh · EVA rubber', itemType: 'lifestyle_runner',
    fill: lp => P(lp, {
      product: { useCase: 'daily', environment: 'urban' },
      lastFit: { lastFamily: 'lifestyle, medium volume', toeShape: 'round', toeVolume: 'medium', heelHold: 'standard', existingLastReuse: true },
      upper: { outer: 'suede and nylon mesh', lining: 'textile', reinforcement: 'light', closure: 'lace', protection: 'none' },
      bottom: { midsole: 'EVA', plate: 'none', outsole: 'rubber', stackBand: 'mid', dropMm: '8-10', rocker: 'none', heel: 'none', existingBottomReuse: true },
      construction: { lasting: 'strobel', soleAttachment: 'cemented' },
      performance: { weightTargetG: 'unknown', cushioning: 'moderate', stability: 'neutral', wetGrip: 'not_required', flexibility: 'moderate' },
    }),
  },
  {
    id: 'court_performance', label: 'Court performance', blurb: 'Lateral stability · pivot zone · toe drag', itemType: 'court_sneaker',
    fill: lp => P(lp, {
      product: { useCase: 'running', environment: 'court' },
      lastFit: { lastFamily: 'court, medium volume', toeShape: 'round', toeVolume: 'medium', heelHold: 'secure', existingLastReuse: false },
      upper: { outer: 'leather and synthetic', lining: 'textile', reinforcement: 'structured', closure: 'lace', protection: 'none' },
      bottom: { midsole: 'EVA with lateral wrap', plate: 'tpu', outsole: 'herringbone rubber with pivot', stackBand: 'low', dropMm: '8-10', rocker: 'none', heel: 'none', existingBottomReuse: false },
      construction: { lasting: 'board', soleAttachment: 'cupsole' },
      performance: { weightTargetG: 'unknown', cushioning: 'moderate', stability: 'stability', wetGrip: 'not_required', flexibility: 'stiff' },
    }),
  },
  {
    id: 'premium_loafer', label: 'Premium leather loafer', blurb: 'Full-grain calf · dress last · low profile', itemType: 'loafer',
    fill: lp => P(lp, {
      product: { useCase: 'formal', environment: 'urban' },
      lastFit: { lastFamily: 'existing dress last', toeShape: 'almond', toeVolume: 'low', heelHold: 'standard', existingLastReuse: true },
      upper: { outer: 'full-grain calf', lining: 'leather', reinforcement: 'structured', closure: 'slip_on', protection: 'none' },
      bottom: { midsole: 'leather/none', plate: 'none', outsole: 'rubber forepart with stacked heel', stackBand: 'low', dropMm: 'unknown', rocker: 'none', heel: 'stacked', existingBottomReuse: true },
      construction: { lasting: 'board', soleAttachment: 'blake' },
      performance: { weightTargetG: 'unknown', cushioning: 'firm', stability: 'neutral', wetGrip: 'not_required', flexibility: 'stiff' },
    }),
  },
  {
    id: 'tailored_oxford', label: 'Tailored oxford', blurb: 'Closed lacing · calf · welt or blake', itemType: 'oxford',
    fill: lp => P(lp, {
      product: { useCase: 'formal', environment: 'urban' },
      lastFit: { lastFamily: 'existing dress last', toeShape: 'almond', toeVolume: 'low', heelHold: 'standard', existingLastReuse: true },
      upper: { outer: 'full-grain calf', lining: 'leather', reinforcement: 'structured', closure: 'lace', protection: 'none' },
      bottom: { midsole: 'leather/none', plate: 'none', outsole: 'leather with rubber top piece', stackBand: 'low', dropMm: 'unknown', rocker: 'none', heel: 'stacked', existingBottomReuse: true },
      construction: { lasting: 'board', soleAttachment: 'goodyear' },
      performance: { weightTargetG: 'unknown', cushioning: 'firm', stability: 'neutral', wetGrip: 'not_required', flexibility: 'stiff' },
    }),
  },
  {
    id: 'fashion_pump', label: 'Fashion pump', blurb: 'Heel last · pitch · toe shape', itemType: 'pump',
    fill: lp => P(lp, {
      product: { useCase: 'occasion', environment: 'urban', targetConsumer: 'women' },
      lastFit: { lastFamily: 'heel last, 55-75mm pitch', toeShape: 'pointed', toeVolume: 'low', heelHold: 'secure', existingLastReuse: true },
      upper: { outer: 'nappa or patent leather', lining: 'leather', reinforcement: 'structured', closure: 'slip_on', protection: 'none' },
      bottom: { midsole: 'leather/none', plate: 'none', outsole: 'leather with rubber top piece', stackBand: 'low', dropMm: 'unknown', rocker: 'none', heel: 'stiletto', existingBottomReuse: true },
      construction: { lasting: 'board', soleAttachment: 'cemented' },
      performance: { weightTargetG: 'unknown', cushioning: 'firm', stability: 'neutral', wetGrip: 'not_required', flexibility: 'stiff' },
    }),
  },
  {
    id: 'comfort_flat', label: 'Comfort flat', blurb: 'Wide toe box · flexible sole · cushioned footbed', itemType: 'ballet_flat',
    fill: lp => P(lp, {
      product: { useCase: 'daily', environment: 'urban', targetConsumer: 'women' },
      lastFit: { lastFamily: 'wide comfort last', toeShape: 'round', toeVolume: 'high', heelHold: 'relaxed', existingLastReuse: true },
      upper: { outer: 'soft nappa', lining: 'textile', reinforcement: 'light', closure: 'slip_on', protection: 'none' },
      bottom: { midsole: 'cushioned footbed', plate: 'none', outsole: 'flexible rubber', stackBand: 'low', dropMm: 'unknown', rocker: 'none', heel: 'none', existingBottomReuse: true },
      construction: { lasting: 'strobel', soleAttachment: 'cemented' },
      performance: { weightTargetG: 'unknown', cushioning: 'high', stability: 'neutral', wetGrip: 'not_required', flexibility: 'flexible' },
    }),
  },
  {
    id: 'chelsea_boot', label: 'Chelsea boot', blurb: 'Ankle last · shaft · gore · pull tab', itemType: 'chelsea',
    fill: lp => P(lp, {
      product: { useCase: 'daily', environment: 'urban', climate: 'cold_dry' },
      lastFit: { lastFamily: 'ankle boot last', toeShape: 'almond', toeVolume: 'medium', heelHold: 'standard', existingLastReuse: true },
      upper: { outer: 'full-grain calf or suede', lining: 'leather', reinforcement: 'structured', closure: 'elastic_gore', protection: 'water_resistant' },
      bottom: { midsole: 'leather/none', plate: 'none', outsole: 'rubber', stackBand: 'low', dropMm: 'unknown', rocker: 'none', heel: 'stacked', existingBottomReuse: true },
      construction: { lasting: 'board', soleAttachment: 'goodyear' },
      performance: { weightTargetG: 'unknown', cushioning: 'firm', stability: 'neutral', wetGrip: 'preferred', flexibility: 'stiff' },
    }),
  },
  {
    id: 'outdoor_boot', label: 'Outdoor boot', blurb: 'Waterproof · insulated · lugs · toe protection', itemType: 'hiking',
    fill: lp => P(lp, {
      product: { useCase: 'outdoor', environment: 'trail', climate: 'cold_dry' },
      lastFit: { lastFamily: 'hiking last, medium-high volume', toeShape: 'round', toeVolume: 'high', heelHold: 'secure', existingLastReuse: false },
      upper: { outer: 'nubuck with textile panels', lining: 'waterproof membrane bootie', reinforcement: 'structured', closure: 'lace', protection: 'waterproof_membrane' },
      bottom: { midsole: 'PU or EVA', plate: 'tpu', outsole: 'deep lugged rubber', stackBand: 'mid', dropMm: '8-12', rocker: 'mild', heel: 'none', existingBottomReuse: false },
      construction: { lasting: 'strobel', soleAttachment: 'cemented' },
      performance: { weightTargetG: 'unknown', cushioning: 'moderate', stability: 'stability', wetGrip: 'required', flexibility: 'stiff' },
    }),
  },
  {
    id: 'slide_sandal', label: 'Slide / sandal', blurb: 'Footbed · straps · barefoot wear', itemType: 'slide',
    fill: lp => P(lp, {
      product: { useCase: 'daily', environment: 'indoor', climate: 'hot_humid' },
      lastFit: { lastFamily: 'sandal footbed last', toeShape: 'round', toeVolume: 'high', heelHold: 'relaxed', existingLastReuse: true },
      upper: { outer: 'moulded synthetic or leather band', lining: 'none', reinforcement: 'none', closure: 'slip_on', protection: 'none' },
      bottom: { midsole: 'contoured EVA footbed', plate: 'none', outsole: 'rubber', stackBand: 'low', dropMm: 'unknown', rocker: 'mild', heel: 'none', existingBottomReuse: true },
      construction: { lasting: 'strobel', soleAttachment: 'cemented' },
      performance: { weightTargetG: 'unknown', cushioning: 'high', stability: 'neutral', wetGrip: 'preferred', flexibility: 'flexible' },
    }),
  },
]

// ── 조사 목적 (지시서 8장) · 복수 선택 ───────────────────────────────
export type ResearchObjective =
  | 'live_commercial_pulse' | 'design_trends' | 'materials_construction'
  | 'performance_technology' | 'price_whitespace' | 'next_season_forecast'

export const OBJECTIVE_LABEL: Record<ResearchObjective, string> = {
  live_commercial_pulse: 'Live commercial pulse',
  design_trends: 'Design trends',
  materials_construction: 'Materials and construction',
  performance_technology: 'Performance technology',
  price_whitespace: 'Price whitespace',
  next_season_forecast: 'Next-season forecast',
}

// ── 경쟁군 (지시서 5.1) · 브랜드가 아니라 라인 단위 ──────────────────
export type CompetitorGroup =
  | 'direct' | 'commercial_leader' | 'technical_authority' | 'heritage_authority'
  | 'directional_designer' | 'aspirational' | 'adjacent'

export const COMP_GROUP_LABEL: Record<CompetitorGroup, string> = {
  direct: 'Direct competitor',
  commercial_leader: 'Commercial leader',
  technical_authority: 'Technical authority',
  heritage_authority: 'Heritage authority',
  directional_designer: 'Directional designer',
  aspirational: 'Aspirational reference',
  adjacent: 'Adjacent reference',
}

// ── 모드별 입력 · 세 모드는 조사 범위 자체가 다르다 ──────────────────
// 트렌드   : 경쟁 라인 입력 → 경쟁사 제품 리서치 + 트렌드 리서치 (외부 조사 최대)
// 시리즈   : 시리즈 디자인 업로드 + 가치 기입 → 트렌드 조사까지만 (경쟁사 리서치 없음)
// 무드보드 : 유저 PDF만 → 외부 조사 없음
export interface TrendInput {
  /** 경쟁 라인 · "Nike Performance Running"처럼 브랜드+라인으로 쓰는 것을 권장 */
  competitors: string[]
  priceBand: 'mass' | 'contemporary' | 'premium' | 'luxury'
  /** Primary competitive band · 같은 공법·기술 티어의 직접 비교 구간 */
  priceMinKrw: number
  priceMaxKrw: number
  /** 한 단계 위·아래 티어를 참고 구간으로 함께 볼지 (Adjacent reference band) */
  adjacentBand?: boolean
  /** 조사 목적 · 복수 선택 */
  objectives?: ResearchObjective[]
}
/** 서버에 올려 둔 파일 한 건. 내용은 서버 캐시에 있고 여기에는 손잡이만 둔다.
 *  RunParams는 localStorage에 저장되므로 base64를 실으면 용량이 터진다. */
export interface UploadRef {
  id: string
  name: string
  type: string
  bytes: number
}
export interface SeriesInput {
  seriesName: string
  archiveFiles: string[]        // 업로드한 시리즈 디자인 파일명 (표시용)
  /** 실제로 서버가 읽는 파일들. 비어 있으면 아무것도 읽지 않았다는 뜻이다. */
  uploads?: UploadRef[]
  valueStatement: string        // 시리즈 가치·철학 기입
  trendSearch: boolean          // 트렌드 조사 ON/OFF (시리즈가 하는 유일한 외부 조사)
}
export interface MoodboardInput {
  files: string[]               // 트렌드 리포트·무드보드 PDF (표시용)
  /** 실제로 서버가 읽는 파일들 */
  uploads?: UploadRef[]
  notes: string
}

export const MODE_SCOPE: Record<Mode, { competitor: boolean; trend: boolean; upload: boolean; note: string }> = {
  trend: { competitor: true, trend: true, upload: false, note: 'Researches competitor lines and market trends' },
  series: { competitor: false, trend: true, upload: true, note: 'Reads your series, then checks trends only' },
  moodboard: { competitor: false, trend: false, upload: true, note: 'Uses only the files you upload' },
}

// ── 실행 파라미터 (지시서 2.1) ──────────────────────────────────────
export interface RunParams {
  mode: Mode
  category: Category
  itemType: string
  /** 신발 라인 정의 · 조사 전 과정이 공유한다. 옛 저장본에는 없다. */
  line?: FootwearLineProfile
  /** 채워 넣은 프리셋 id · 표시용 */
  linePreset?: string
  endStage: Stage
  /** 구조 후보 수 · Design ID가 되는 스펙의 수 */
  sketchCount: 6 | 12 | 18 | 24
  tierRatio: [number, number, number]      // Core : Push : Signature
  renderRatio: 0.25 | 0.5 | 0.75
  viewCount: 1 | 3 | 4
  /** 후보별 컬러웨이 수 · 컬러웨이는 별도 디자인이 아니라 같은 Design ID의 SKU다 */
  colorwayCount: 0 | 1 | 2 | 3
  topN: number                              // 1~5
  /** 스케치 한 장마다 몇 개의 디자인 컨셉을 뽑을지 · 형태는 고정, 소재·컬러·창의도만 갈린다.
   *  첫 번째는 상업 안전(게놈 소재+브랜드 팔레트), 이후 소재 전환/컬러 전환/창의 밀기. 각각 '왜'를 들고 온다. */
  designsPerSketch?: 1 | 2 | 3 | 4
  /** (옛 저장본 호환) 렌더 뒤 슬라이더 베리에이션 수 · 지금은 designsPerSketch 가 그 역할을 한다 */
  variationCount?: 0 | 2 | 3 | 4 | 6 | 8
  /** 캠페인 컷 · 착용컷과 연출컷을 한 묶음으로 뽑는다 (top 하나당 장수) */
  campaignShots: 0 | 2 | 4 | 6
  /** 옛 샘플 호환 · 저장된 Run이 아직 이 두 값을 들고 있다 */
  wearCuts?: number
  conceptShots?: number
  /** 멀티뷰 → 3D 모델 생성 */
  make3d: boolean
  approvalGate: boolean
  /** 캠페인·3D 지출 전에 최종 선정을 사람이 확인한다 (규칙 9) · 기본 켬 */
  finalGate?: boolean
  /** 디자인 생성 모델 · 화면에는 성격으로만 노출한다 */
  imageEngine: 'fast' | 'detail'
  /** 실제 생성 상한 (장) · 초과분은 SVG로 폴백. 비용 통제 */
  imageBudget: 0 | 6 | 12 | 24 | 48
  trend: TrendInput
  series: SeriesInput
  moodboard: MoodboardInput
  /** 조사 결과를 쓸 언어. 화면 언어와 별개로 분석 시작 시 정한다. */
  researchLang?: import('./i18n').Lang
  /** 브랜드 아이덴티티 · 모든 결과물에 공통으로 실린다 */
  brand?: import('./brand').BrandIdentity
}


/** 캠페인 컷 수 · 옛 Run은 wearCuts + conceptShots 로 저장돼 있다 */
export function campaignCount(p: Pick<RunParams, 'campaignShots' | 'wearCuts' | 'conceptShots'>): number {
  if (typeof p.campaignShots === 'number') return p.campaignShots
  return (p.wearCuts ?? 0) + (p.conceptShots ?? 0)
}

export const DEFAULT_PARAMS: RunParams = {
  mode: 'trend', category: 'shoe', itemType: 'loafer',
  line: defaultLineProfile(),
  endStage: 'S3', sketchCount: 12, tierRatio: [1, 1, 1],
  renderRatio: 0.5, viewCount: 3, colorwayCount: 2,
  topN: 3, designsPerSketch: 2, campaignShots: 4, make3d: true, approvalGate: true, finalGate: true,
  imageEngine: 'detail', imageBudget: 12,
  trend: {
    // 기본을 비워둔다. 가상의 브랜드명으로 검색하면 결과가 무의미하고 시간만 든다.
    competitors: [],
    priceBand: 'contemporary', priceMinKrw: 150000, priceMaxKrw: 450000,
    adjacentBand: true,
    objectives: ['live_commercial_pulse', 'design_trends', 'next_season_forecast'],
  },
  series: {
    seriesName: '', archiveFiles: [], valueStatement: '', trendSearch: true,
  },
  moodboard: { files: [], notes: '' },
}

// ── 신호 (S1) · 신발용 스키마 (지시서 15·16장) ───────────────────────
export interface SignalIndices {
  /** 실제 판매·베스트셀러·재고·반복 출시 */
  commercial: 'high' | 'medium' | 'low' | null
  /** 검색·소셜·리세일·스타일링 */
  cultural: 'high' | 'medium' | 'low' | null
  /** 전시회·소재 트렌드·전문 전망 */
  forecast: 'high' | 'medium' | 'low' | null
  /** 라스트·몰드·패턴·시험·원가 실현성 */
  feasibility: 'high' | 'medium' | 'low' | null
}

export interface Signal {
  signal_id: string
  attribute: string
  label: string
  axis: string
  observed_count: number
  sources: string[]
  price_bands: string[]
  confidence: 'high' | 'medium' | 'low'
  direction: 'rising' | 'stable' | 'declining'
  first_seen: string
  dedup_group: string
  oem_group: string | null
  page_ref?: string            // 무드보드 모드: 페이지·위치 참조
  sales_proxy_score?: number   // 트렌드 모드 (옛 샘플 호환)
  proxy_confidence?: 'high' | 'medium' | 'low' | 'none'
  evidence?: string[]          // 웹 수집 시 확인된 근거 문장
  /** 출처 등급 · 웹 수집 출처마다 하나. T1 산업공인 / T2 시장신호 / T3 전문매체 / T4 소셜.
   *  confidence 는 서버가 이 등급에서 계산한다 — 개수로는 high 가 되지 않는다. */
  source_tiers?: ('T1' | 'T2' | 'T3' | 'T4')[]
  /** 이 신호가 주로 다루는 파트 · 미드솔·아웃솔은 어퍼에 묻히지 않게 따로 표시된다 */
  part?: 'upper' | 'midsole' | 'outsole' | 'last_fit' | 'closure' | 'colour_material' | 'cross_category' | 'other'
  /** 소셜에서 봤다면 어느 플랫폼인지 */
  social_platforms?: string[]
  /** 함께 언급되는 것들 · 다른 신발·의류·가방·활동·크리에이터 */
  mentioned_with?: string[]
  /** 왜 사는가 · 인기의 근거가 아니라 이유 */
  purchase_drivers?: string[]
  /** 함께 관측되는 속성 묶음 · "chunky"가 아니라 high stack + wide platform + …로 */
  co_occurring?: string[]
  /** 하나의 점수 대신 네 지수로 분리 */
  indices?: SignalIndices
  /** 채택 단계 · 1회 수집이면 trajectory는 unknown이 정상이다 */
  adoption_stage?: 'emerging' | 'growing' | 'established' | 'declining' | 'unknown'
  /** 이 신호를 실행할 때 필요한 개발 변경 수준 */
  last_change?: 'not_required' | 'modification' | 'required' | 'unknown'
  bottom_tooling_change?: 'not_required' | 'modification' | 'required' | 'unknown'
  upper_pattern_change?: 'minor' | 'major' | 'unknown'
}

export interface CompetitorProduct {
  product_id: string
  brand: string
  name: string
  price_krw: number
  sales_proxy_score: number | null
  proxy_signals: string[]
  observation_count: number
  observation_window: string
  confidence: 'high' | 'medium' | 'low' | 'none'
  in_band: boolean
  evidence_strength?: 'strong' | 'moderate' | 'weak' | 'none'
  source_urls?: string[]
  rank_note?: string
  user_sentiment?: 'positive' | 'mixed' | 'negative' | 'unknown'
  praise_points?: string[]
  complaint_points?: string[]
  /** 왜 사는가 · 리뷰·언급에서 반복되는 구매 이유 */
  purchase_drivers?: string[]
  design_traits?: string[]
  image_urls?: string[]
  product_url?: string
  /** 경쟁군 분류 · 프로필과 안 맞아도 제외하지 않고 참조군으로 분류한다 */
  competitor_group?: CompetitorGroup
  brand_line?: string
  /** 공법·기술 티어 · 가격 비교는 같은 티어끼리가 우선이다 */
  construction_tier?: string
  /** 순위 표기의 의미 · 노출 위치를 판매 순위로 저장하면 안 된다 */
  rank_semantics?: 'verified_sales_rank' | 'retailer_bestseller_membership' | 'surface_position' | 'marketplace_trade_rank' | 'none'
  /** 사이즈별 재고 (지시서 13장) · 신발은 사이즈가 깨진 채 팔린다 */
  offered_sizes?: number
  available_sizes?: number
  size_status?: 'full' | 'partial' | 'size_broken' | 'sold_out' | 'unknown'
  /** 같은 모델의 컬러웨이 수 · 컬러웨이 10개는 디자인 10개가 아니다 */
  colorway_count?: number
  /** 백화점·명품몰 베스트셀러 수집처 · 롯데백화점, SSG, Harrods 등 (지시서 12.2) */
  retailer?: string
}

export interface Direction {
  id: string
  title: string
  summary: string
  signal_ids: string[]
}

export interface SeriesDnaElement {
  element: string
  label: string
  observed_in: number
  of: number
  confidence: 'high' | 'medium' | 'low'
  must_inherit?: boolean
  variation_range?: string[]
  observed?: (string | number)[]
  note?: string
}

export interface SeriesDna {
  invariant: SeriesDnaElement[]
  variable: SeriesDnaElement[]
  ambiguous: SeriesDnaElement[]
}

export interface ReportBias {
  publisher: string
  perspective: string
  notes: string[]
}

// ── 근거 추적 체인 (지시서 10장) ────────────────────────────────────
export interface ReferenceImage {
  ref_id: string
  source_type: 'competitor' | 'archive' | 'user_upload' | 'trend_report'
  source_url: string
  collected_at: string
  borrowed_attributes: string[]
  usage: 'attribute_only' | 'visual_reference'
  blocked?: boolean            // competitor + visual_reference → 시스템 차단
}

export interface Rationale {
  agent_mode: Mode
  driving_signals: { signal_id: string; weight: number }[]
  reference_images: ReferenceImage[]
  reference_prompts: { text: string; origin: string; applied_as: string[] }[]
  series_dna_inherited: string[]
  type_placement_reason: string
  narrative: string[]          // 발표 노트 3~4문장
}

// ── 룰·검증 ─────────────────────────────────────────────────────────
export interface RuleResult {
  rule: string
  severity: 'fail' | 'warn'
  message: string
}

export interface QAResult {
  check: string
  target: string
  observed: string
  pass: boolean
}

export interface CostEstimate {
  lines: { label: string; krw: number }[]
  tooling: {
    total_tooling_krw: number
    mold_count_required: number
    size_run_count?: number
    amortization_volume: number
    tooling_per_unit_krw: number
  }
  estimated_total_krw: number
  estimated_band_krw: [number, number]
  cap_ratio: number            // 원가 상한 대비 (1.0 = 100%)
  confidence: 'low' | 'medium' | 'high'
  assumptions: string[]
  excluded_costs: string[]
}

// ── 디자인 (스펙 + 산출물) ──────────────────────────────────────────
/** LLM이 저작한 설계 의도 (지시서 v2 S4).
 *  그릴 수 있는 축만 담는다 — mm·비율은 spec_sheet에 분리하고 이미지 지시에 쓰지 않는다.
 *  이후 모든 프롬프트는 이 게놈에서만 파생된다 (단일 진실 원천). */
export interface DesignGenome {
  concept_thesis: string
  consumer_role: string
  hero_mutation: { axis: string; label: string; drawing_instruction: string }
  supporting: string[]
  silhouette_family: string
  toe_family: 'round' | 'almond' | 'square' | 'pointed'
  sole_mass: 'low' | 'mid' | 'high'
  panel_density: 'minimal' | 'standard' | 'dense'
  closure_form: string
  stance: 'grounded' | 'neutral' | 'lifted'
  /** 파트별 지시 · form 은 스케치(선), material 은 렌더에서만. 신발은 어퍼 하나가 아니다. */
  parts?: Record<ShoePart, { form: string; material: string }>
  spec_sheet: {
    /** 티어의 정의 그 자체다. 예전에는 이 두 값이 rng.chance() 였고,
     *  LLM 에게 "Core 는 기존 라스트를 재사용한다"고 시켜 놓고 그 답을 버렸다. */
    is_new_last: boolean
    is_new_outsole_mold: boolean
    heel_height_mm: number
    panel_count: number
    sole_construction: string
    upper_material: string
  }
  source_signal_ids: string[]
  preserve: string[]
  forbidden: string[]
  territory_id: string
  tier: DesignTier
  /** 다양성 게이트를 끝내 못 넘고 채택된 경우, 앞선 안과 겹친 구조축.
   *  비어 있으면 게이트를 통과한 안이다. 카드가 이 차이를 그대로 말한다. */
  gate_overlap?: string[]
}

/** 신발의 주요 파트 · 게놈·컨셉·프롬프트가 같은 키를 쓴다 */
export type ShoePart = 'heel_counter' | 'toe_cap' | 'midsole' | 'outsole' | 'tongue_eyestay' | 'collar' | 'overlays'
export const SHOE_PARTS: ShoePart[] = ['heel_counter', 'toe_cap', 'midsole', 'outsole', 'tongue_eyestay', 'collar', 'overlays']

/** 한 스케치 위의 디자인 컨셉 · 형태 고정, 소재·컬러·창의도만 갈린다 (S7).
 *  '베리에이션'의 실제 단위다 — 스케치당 N개, 각각 다른 angle. */
// ── 선 그림 뷰 ────────────────────────────────────────────────────
// 제품 사진이 아닌 뷰들. 히어로 이미지·썸네일·PDF·3D 입력·캠페인 베이스를 고를 때
// 전부 이걸로 걸러야 한다.
//
// 왜 상수로 두는가: 예전에는 스무 군데가 ['sketch','sketch_var'] 를 각자 적어 뒀다.
// S2에 아웃솔 시트(sketch_outsole)가 생기자 그 스무 군데가 한꺼번에 틀렸다.
// 아웃솔 시트는 기준 렌더보다 먼저 배열에 들어가므로, find() 가 죄다 그걸 집어
// 보드의 디자인 카드·라이브러리 썸네일·덱 갤러리가 검은 선 트레드 도면이 되고,
// 3D 는 그 도면으로 유료 모델을 만들 뻔했다.
// 선화 뷰를 새로 더할 일이 있으면 여기만 고친다.
export const SKETCH_VIEWS = ['sketch', 'sketch_outsole', 'sketch_var'] as const
export function isSketchView(view: string): boolean {
  return (SKETCH_VIEWS as readonly string[]).includes(view)
}

export interface DesignConcept {
  name: string
  angle: 'commercial_safe' | 'material_shift' | 'colour_shift' | 'creative_push'
  palette: { role: 'upper' | 'midsole' | 'outsole' | 'accent'; name: string; hex: string }[]
  part_materials: Record<'upper' | ShoePart, string>
  why: string
  render_clause: string
}

/** 설계 영토 (지시서 v2 S3) · 서로 다른 설계 공간의 계획 */
export interface Territory {
  id: string
  name: string
  consumer_role: string
  use_signal_ids: string[]
  drop_signal_ids: string[]
  drop_reason: string
  allowed_tiers: DesignTier[]
  season_note: string
}

export interface DesignSpec {
  design_id: string
  tier: DesignTier
  category: Category
  itemType: string
  fields: Record<string, string | number | boolean>
  fieldsLocked: string[]       // 시리즈 DNA로 잠긴 필드
  /** 조사 신호가 실제로 정한 필드 이름. 제안만 되고 반영 안 된 것은 여기 없다. */
  hintApplied?: string[]
  /** 이 안이 어떤 실루엣으로 읽혀야 하는가 · 선화에서 실제로 달라지는 유일한 축 */
  silhouetteRead?: string
  /** 이 안이 어떤 신호 조합을 읽었는가 · 같은 티어 안에서도 안마다 다르다 */
  comboLabel?: string
  /** 조사가 요구했지만 이 유형이 허용하지 않아 접힌 값 */
  hintBlocked?: { field: string; wanted: string | number; got: string | number }[]
  /** 이 안을 저작한 게놈 (지시서 v2 S4) · 있으면 디자인의 저자는 LLM이고,
   *  없으면 아키타입 폴백이다 — 카드가 그 차이를 정직하게 말해야 한다 */
  genome?: DesignGenome
}

/** 실제 생성된 이미지 · origin은 지시서 9장 이미지 원장 */
export interface DesignImage {
  view: string
  colorway?: string
  url: string
  hash: string
  origin: 'generated' | 'edited_from' | 'regenerated_hq'
  /** 베리에이션 축 이름 · 어떤 축을 바꾼 안인지 */
  variantOf?: string
  variantAxis?: string
  /** 이 이미지를 만든 프롬프트 · 근거 표시용. 없으면 옛 데이터다. */
  promptUsed?: string
  /** 왜 이 소재·컬러 조합인가 · 프롬프트가 '무엇을'이라면 이것은 '왜'다.
   *  보드가 PT 자료가 되려면 컷마다 이 한 줄이 있어야 한다. */
  whyUsed?: string
  /** 이 컷이 어느 디자인 컨셉인가 · 같은 스케치의 N개 디자인을 카드에서 가른다 */
  concept?: { index: number; name: string; angle: DesignConcept['angle'] }
  /** 브랜드 로고를 실제로 합성한 이미지인가 · 최종 선정 컷은 이게 true여야 한다 */
  logoStamped?: boolean
  /** 베리에이션을 만든 스타일 슬라이더 값 · 무엇을 얼마나 밀었는지 */
  sliders?: Record<string, number>
  /** 컨셉 촬영 컷 라벨과 가상 인물 */
  conceptLabel?: string
  persona?: string
  editedFrom?: string
}

export interface MdVerdict { design_id: string; verdict: 'buy' | 'buy_if_fixed' | 'pass'; why: string; concern: string; fix: string }
export interface MdPick { design_id: string; reason: string; role_in_range: string }

export interface Design {
  spec: DesignSpec
  ruleResults: RuleResult[]
  rejected: boolean            // 룰 탈락
  cost: CostEstimate
  rationale: Rationale
  qa: QAResult[]
  viewMismatch: boolean        // S3 2회 재시도 실패 플래그
  // 결정적 지표 (계층 1)
  metrics: { label: string; value: string }[]
  // 모델 평가 (계층 2)
  modelEval: { label: string; value: string; basis: string }[]
  colorways: string[]          // hue names
  images: DesignImage[]        // 실제 생성 이미지 (비면 SVG 시뮬레이션 표시)
  /** 멀티뷰에서 만든 3D 모델 (GLB) */
  model?: { url: string; hash: string; format: string; views: number; note?: string }
  imageError?: string          // 부분 실패 격리 · 이 건만 실패, 나머지는 진행
  isTop: boolean
  /** MD 페르소나의 평가 · 페르소나가 설정돼 있을 때만 */
  mdReview?: MdVerdict
  /** MD가 실제로 고른 이유 */
  mdPick?: MdPick
  topDistance?: number         // Top N 상호 스펙 거리
  // 품평 게이트 (계층 3)
  verdict?: 'approve' | 'reject'
  verdictTags?: string[]
}

// ── 파이프라인 이벤트 ───────────────────────────────────────────────
export type PipelineEvent =
  | { kind: 'log'; stage: Stage | 'S0'; text: string }
  | { kind: 'stage-start'; stage: Stage }
  | { kind: 'stage-done'; stage: Stage }
  | { kind: 'progress'; stage: Stage; pct: number }
  | { kind: 'signals'; signals: Signal[] }
  | { kind: 'competitors'; items: CompetitorProduct[] }
  | { kind: 'directions'; items: Direction[] }
  | { kind: 'series-dna'; dna: SeriesDna }
  | { kind: 'dna-conflict'; brandClaim: string; observed: string }
  | { kind: 'report-bias'; bias: ReportBias }
  | { kind: 'trend-report'; report: unknown }
  | { kind: 'report-pending'; on: boolean }
  | { kind: 'dossier'; dossier: unknown }
  | { kind: 'dossier-pending'; on: boolean }
  | { kind: 'design'; design: Design }
  | { kind: 'design-update'; design: Design }
  | { kind: 'gate'; stage: Stage }         // 승인 게이트 대기
  /** MD 가 구성 전체를 매장에 깔았을 때의 한 문단 · 선정 카드에 실린다 */
  | { kind: 'md-floor-note'; text: string }
  // 시리즈 DNA 승인 대기 · 사진에서 읽은 불변 요소는 가설이다. 사람이 승인해야 잠긴다 (규칙 16)
  | { kind: 'dna-gate'; invariant: import('./types').SeriesDnaElement[]; of: number }
  | { kind: 'checkpoint'; label: string }
  | { kind: 'done'; endStage: Stage }

export interface RunState {
  params: RunParams
  stageStatus: Record<Stage, 'idle' | 'running' | 'done' | 'gated'>
  logs: { stage: string; text: string; t: number }[]
  signals: Signal[]
  competitors: CompetitorProduct[]
  directions: Direction[]
  seriesDna: SeriesDna | null
  dnaConflict: { brandClaim: string; observed: string; resolved?: string } | null
  reportBias: ReportBias | null
  trendReport: unknown | null
  /** 시즌 도시에 · MICAM 형식의 구조화된 트렌드 자료 */
  dossier: unknown | null
  dossierPending: boolean
  reportPending: boolean
  designs: Design[]
  /** MD 가 최종 구성을 매장 관점에서 한 문단으로 · 없으면 MD 리뷰가 안 돈 것 */
  mdFloorNote?: string
  checkpoints: string[]
  finished: boolean
  /** 미리 만들어 둔 예시 Run · 삭제되지 않는다 */
  sample?: boolean
  sampleTitle?: string
  savedAtISO?: string
}

export const VERDICT_TAGS = ['Form', 'Material', 'Colour', 'Cost', 'Brand tone', 'Manufacturing', 'Too familiar', 'Timing']
