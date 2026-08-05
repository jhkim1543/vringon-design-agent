// ── CategoryPack · 주얼리·신발 팩 (지시서 4.1, 6장, 7장) ─────────────
import type { Category, CostEstimate, DesignSpec, DesignTier, RuleResult } from './types'
import { TYPE_LABEL } from './types'
import type { Rng } from './rng'

export interface CategoryPack {
  id: Category
  types: string[]
  fieldLabels: Record<string, string>
  generateSpec: (rng: Rng, tier: DesignTier, itemType: string, locked: Record<string, string | number>) => DesignSpec
  rules: (spec: DesignSpec) => RuleResult[]
  costModel: (spec: DesignSpec, rng: Rng) => CostEstimate
  signalAxes: string[]
  viewSet: { key: string; label: string; required: boolean }[]
  qaChecks: string[]
}

let seq = 0
export function resetSeq() { seq = 0 }
function nextId(cat: Category, tier: DesignTier) {
  seq += 1
  const p = cat === 'jewelry' ? 'JW' : 'SH'
  const t = tier === 'core' ? 'C' : tier === 'push' ? 'P' : 'S'
  return `${p}-26FW-${t}${String(seq).padStart(2, '0')}`
}

// ════════════════════════════════ 주얼리 팩 ═══════════════════════════
const METALS = ['925 silver', '14k gold', 'brass'] as const
const SETTINGS = ['prong', 'bezel', 'pave', 'channel'] as const
const FINISHES = ['polished', 'matte', 'hammered'] as const

interface JewelProfile {
  stones: [number, number]
  weight: [number, number]
  cap: number                   // 유형별 원가 상한 기준 (Core 100% 기준액)
  pair?: boolean
  chain?: boolean
  settings?: string[]
}
const JEWEL_PROFILE: Record<string, JewelProfile> = {
  band_ring: { stones: [0, 0], weight: [2.5, 6], cap: 58000 },
  solitaire: { stones: [1, 1], weight: [2, 4.5], cap: 72000, settings: ['prong', 'bezel'] },
  eternity: { stones: [12, 24], weight: [2.5, 5], cap: 115000, settings: ['channel', 'pave', 'bezel'] },
  signet: { stones: [0, 1], weight: [4, 9], cap: 88000, settings: ['bezel'] },
  stud: { stones: [1, 2], weight: [0.8, 2.5], cap: 42000, pair: true },
  hoop: { stones: [0, 12], weight: [1.5, 5], cap: 60000, pair: true },
  drop: { stones: [1, 6], weight: [2, 6], cap: 78000, pair: true },
  ear_cuff: { stones: [0, 5], weight: [1, 3], cap: 40000 },
  pendant: { stones: [1, 14], weight: [2, 7], cap: 82000, chain: true },
  choker: { stones: [0, 10], weight: [4, 12], cap: 135000, chain: true },
  chain_necklace: { stones: [0, 0], weight: [5, 16], cap: 155000, chain: true },
  station: { stones: [5, 12], weight: [3, 9], cap: 118000, chain: true, settings: ['bezel', 'prong'] },
  bangle: { stones: [0, 8], weight: [8, 22], cap: 175000 },
  chain_bracelet: { stones: [0, 6], weight: [5, 15], cap: 145000, chain: true },
  cuff: { stones: [0, 6], weight: [10, 26], cap: 205000 },
  tennis: { stones: [20, 40], weight: [4, 10], cap: 195000, settings: ['prong', 'channel'] },
  brooch: { stones: [1, 16], weight: [3, 10], cap: 95000 },
  anklet: { stones: [0, 8], weight: [2, 6], cap: 72000, chain: true },
}
const DEFAULT_JEWEL_PROFILE: JewelProfile = { stones: [1, 6], weight: [2, 5], cap: 68000 }
export const jewelCapOf = (t: string) => (JEWEL_PROFILE[t] ?? DEFAULT_JEWEL_PROFILE).cap

export const jewelryPack: CategoryPack = {
  id: 'jewelry',
  types: Object.keys(JEWEL_PROFILE),
  fieldLabels: {
    metal: 'Metal', plating: 'Plating', target_weight_g: 'Target weight (g)',
    stone_count: 'Stones', stone_size_mm: 'Stone size (mm)', setting_type: 'Setting',
    min_wall_thickness_mm: 'Min wall (mm)', prong_count: 'Prongs',
    chain_type: 'Chain', finish: 'Finish', is_pair: 'Pair', is_new_mold: 'New mould',
    existing_mold_id: 'Mould ID',
  },
  generateSpec(rng, tier, itemType, locked) {
    const prof = JEWEL_PROFILE[itemType] ?? DEFAULT_JEWEL_PROFILE
    // 유형이 허용하는 범위 안에서, 티어가 위로 갈수록 상단을 쓴다
    const span = prof.stones[1] - prof.stones[0]
    const bias = tier === 'core' ? 0.35 : tier === 'push' ? 0.65 : 1
    const stoneCount = prof.stones[0] + Math.round(span * rng.next() * bias)
    const wSpan = prof.weight[1] - prof.weight[0]
    const weight = prof.weight[0] + wSpan * (tier === 'signature' ? 0.5 + rng.next() * 0.5 : rng.next() * 0.7)
    // Core는 원가가 낮은 금속 위주, Signature에서만 금을 폭넓게 쓴다
    const metalPool = tier === 'core' ? ['925 silver', '925 silver', 'brass']
      : tier === 'push' ? ['925 silver', '925 silver', 'brass', '14k gold']
      : METALS as unknown as string[]
    const f: Record<string, string | number | boolean> = {
      metal: rng.pick(metalPool),
      plating: rng.pick(['rhodium', '18k gold', 'none']),
      target_weight_g: Math.round(weight * 10) / 10,
      stone_count: stoneCount,
      stone_size_mm: Math.round((0.8 + rng.next() * (itemType === 'tennis' || itemType === 'eternity' ? 1.8 : 4.5)) * 10) / 10,
      setting_type: rng.pick(prof.settings ?? SETTINGS),
      prong_count: rng.pick([4, 4, 4, 6, 3]),
      // 주조 하한(0.8mm) 근처를 노리되, 일부는 미달하게 두어 룰이 실제로 걸러내게 한다
      min_wall_thickness_mm: Math.round((0.74 + rng.next() * 0.86) * 100) / 100,
      chain_type: prof.chain ? rng.pick(['cable', 'box', 'snake']) : 'none',
      finish: rng.pick(FINISHES),
      is_pair: !!prof.pair,
      is_new_mold: tier === 'signature' ? rng.chance(0.6) : rng.chance(0.15),
      existing_mold_id: `MLD-2024-${rng.int(3, 18)}`,
    }
    const lockedKeys: string[] = []
    for (const [k, v] of Object.entries(locked)) { f[k] = v; lockedKeys.push(k) }
    return { design_id: nextId('jewelry', tier), tier, category: 'jewelry', itemType, fields: f, fieldsLocked: lockedKeys }
  },
  rules(spec) {
    const f = spec.fields
    const r: RuleResult[] = []
    if ((f.min_wall_thickness_mm as number) < 0.8)
      r.push({ rule: 'J-01', severity: 'fail', message: `Wall thickness ${f.min_wall_thickness_mm}mm is under 0.8mm. Cannot be cast.` })
    if (f.is_new_mold && spec.tier === 'core')
      r.push({ rule: 'J-02', severity: 'fail', message: 'New mould on a Core piece. Core has to reuse an existing mould.' })
    if (f.setting_type === 'pave' && (f.stone_size_mm as number) < 1.0)
      r.push({ rule: 'J-03', severity: 'warn', message: `Pave with ${f.stone_size_mm}mm stones under 1.0mm. Setting labour climbs sharply.` })
    if (f.metal === '925 silver' && f.plating === 'none' && f.finish === 'polished')
      r.push({ rule: 'J-04', severity: 'warn', message: 'Unplated polished silver will tarnish.' })
    if ((f.prong_count as number) < 4 && (f.stone_size_mm as number) > 5.0)
      r.push({ rule: 'J-05', severity: 'fail', message: `${f.prong_count} prongs on a ${f.stone_size_mm}mm stone. The stone can work loose.` })
    if (f.chain_type === 'snake' && (f.target_weight_g as number) > 8)
      r.push({ rule: 'J-07', severity: 'warn', message: 'Snake chain with a pendant over 8g. Structurally marginal.' })
    // 연속 세팅 유형은 스톤 크기 편차가 크면 라인이 흐트러진다
    if ((spec.itemType === 'tennis' || spec.itemType === 'eternity') && (f.stone_size_mm as number) > 3.0)
      r.push({ rule: 'J-09', severity: 'warn', message: `${f.stone_size_mm}mm stones on a ${TYPE_KO(spec.itemType)}. Both worn thickness and unit cost jump.` })
    // 귀걸이류는 무게가 귓불 부담으로 직결된다
    if (f.is_pair && (f.target_weight_g as number) > 5)
      r.push({ rule: 'J-10', severity: 'fail', message: `${f.target_weight_g}g per earring. Past what an earlobe carries comfortably.` })
    return r
  },
  costModel(spec, rng) {
    const f = spec.fields
    const metalRate = f.metal === '14k gold' ? 21000 : f.metal === '925 silver' ? 6600 : 2400
    const metal = Math.round((f.target_weight_g as number) * metalRate)
    const stone = (f.stone_count as number) * (f.stone_size_mm as number) * 480
    const setting = f.setting_type === 'pave' ? (f.stone_count as number) * 1400 : (f.stone_count as number) * 700
    const casting = 5000, findings = 3000
    const plating = f.plating === 'none' ? 0 : 4000
    const finishing = 3500
    const chain = f.chain_type === 'none' ? 0 : 8000
    const newMold = f.is_new_mold ? 480000 : 0
    const amort = 500
    const toolingPerUnit = Math.round(newMold / amort)
    const lines = [
      { label: 'Metal', krw: metal }, { label: 'Stones', krw: Math.round(stone) },
      { label: 'Findings', krw: findings }, { label: 'Chain', krw: chain },
      { label: 'Casting', krw: casting }, { label: 'Setting labour', krw: Math.round(setting) },
      { label: 'Plating', krw: plating }, { label: 'Finishing', krw: finishing },
      { label: 'Tooling, amortised', krw: toolingPerUnit },
    ]
    const total = lines.reduce((s, l) => s + l.krw, 0)
    const yieldFactor = 1.12
    const est = Math.round(total * yieldFactor)
    const capBase = jewelCapOf(spec.itemType)
    return {
      lines,
      tooling: { total_tooling_krw: newMold, mold_count_required: f.is_new_mold ? 1 : 0, amortization_volume: amort, tooling_per_unit_krw: toolingPerUnit },
      estimated_total_krw: est,
      estimated_band_krw: [Math.round(est * 0.85), Math.round(est * (1.18 + rng.next() * 0.06))],
      cap_ratio: Math.round((est / capBase) * 100) / 100,
      confidence: 'low',
      assumptions: ['MOQ 300', 'Silver and gold priced at 2026-08-01', 'Standard setting labour rate', `Amortised over ${amort} units`],
      excluded_costs: ['Packaging', 'Freight', 'Vendor margin', 'Defect rate', 'Sampling'],
    }
  },
  signalAxes: ['Form', 'Metal and colour', 'Stones', 'Setting', 'How it is worn', 'Scale', 'Layering', 'Price band'],
  viewSet: [
    { key: 'front', label: 'Front (reference)', required: true },
    { key: 'q45', label: '45 degrees', required: true },
    { key: 'detail', label: 'Detail close-up', required: true },
    { key: 'wear', label: 'Worn angle', required: false },
  ],
  qaChecks: ['Stone count matches', 'Setting reads correctly', 'Prong count', 'Same object across three views >=0.80', 'Pair matches left to right'],
}

// ════════════════════════════════ 신발 팩 ════════════════════════════
const TOES = ['almond', 'square', 'round', 'pointed'] as const
const HEEL_TYPES = ['flat', 'block', 'stiletto', 'stacked'] as const
const CLOSURES = ['slip_on', 'lace', 'buckle', 'strap', 'elastic_gore'] as const

// 브랜드 라스트 라이브러리 (지시서 18장 · 신발 Core·S-04의 전제)
export const LAST_LIBRARY = [
  { last_id: 'LST-2024-07', toe: 'almond', label: 'Almond last', athletic: false },
  { last_id: 'LST-2024-11', toe: 'square', label: 'Square last', athletic: false },
  { last_id: 'LST-2023-03', toe: 'round', label: 'Round last', athletic: false },
  { last_id: 'LST-2025-01', toe: 'pointed', label: 'Pointed last', athletic: false },
  { last_id: 'LST-RUN-02', toe: 'round', label: 'Running last, standard', athletic: true },
  { last_id: 'LST-RUN-05', toe: 'round', label: 'Running last, wide', athletic: true },
]

// 타입별 설계 프로파일 · 룰과 원가가 타입에 따라 달라지는 지점
interface ShoeProfile {
  heel: [number, number]          // 힐/솔 높이 범위 mm
  closures: string[]
  panels: [number, number]
  constructions: string[]
  athletic?: boolean              // 운동화 계열 · 라스트·금형 논리가 다르다
  shaft?: number                  // 부츠 목높이 mm
  open?: boolean                  // 샌들류 · 갑피 면적이 작다
}
const SHOE_PROFILE: Record<string, ShoeProfile> = {
  running: { heel: [22, 38], closures: ['lace'], panels: [5, 11], constructions: ['cemented'], athletic: true },
  court_sneaker: { heel: [18, 28], closures: ['lace'], panels: [4, 9], constructions: ['cemented', 'vulcanized'], athletic: true },
  chunky_sneaker: { heel: [30, 55], closures: ['lace'], panels: [6, 12], constructions: ['cemented'], athletic: true },
  trail: { heel: [24, 40], closures: ['lace'], panels: [6, 12], constructions: ['cemented'], athletic: true },
  loafer: { heel: [18, 35], closures: ['slip_on', 'elastic_gore'], panels: [3, 6], constructions: ['cemented', 'blake', 'goodyear'] },
  derby: { heel: [20, 35], closures: ['lace'], panels: [4, 7], constructions: ['blake', 'goodyear', 'cemented'] },
  oxford: { heel: [20, 35], closures: ['lace'], panels: [4, 8], constructions: ['goodyear', 'blake'] },
  monk: { heel: [20, 35], closures: ['buckle'], panels: [4, 7], constructions: ['blake', 'goodyear'] },
  pump: { heel: [45, 95], closures: ['slip_on'], panels: [2, 5], constructions: ['cemented', 'blake'] },
  slingback: { heel: [35, 85], closures: ['strap'], panels: [3, 6], constructions: ['cemented'] },
  mary_jane: { heel: [15, 55], closures: ['strap'], panels: [3, 6], constructions: ['cemented', 'blake'] },
  mule: { heel: [25, 80], closures: ['slip_on'], panels: [2, 4], constructions: ['cemented'] },
  ballet_flat: { heel: [5, 15], closures: ['slip_on', 'elastic_gore'], panels: [2, 5], constructions: ['cemented', 'blake'] },
  driving: { heel: [8, 18], closures: ['slip_on'], panels: [3, 6], constructions: ['cemented'] },
  ankle_boot: { heel: [25, 70], closures: ['zip', 'lace'], panels: [4, 8], constructions: ['cemented', 'goodyear'], shaft: 110 },
  chelsea: { heel: [20, 45], closures: ['elastic_gore'], panels: [3, 6], constructions: ['cemented', 'goodyear'], shaft: 120 },
  long_boot: { heel: [25, 75], closures: ['zip'], panels: [5, 9], constructions: ['cemented'], shaft: 380 },
  combat: { heel: [25, 45], closures: ['lace'], panels: [5, 10], constructions: ['goodyear', 'cemented'], shaft: 150 },
  strap_sandal: { heel: [10, 75], closures: ['buckle', 'strap'], panels: [3, 7], constructions: ['cemented'], open: true },
  slide: { heel: [10, 45], closures: ['slip_on'], panels: [1, 3], constructions: ['cemented'], open: true },
  gladiator: { heel: [10, 40], closures: ['buckle'], panels: [5, 10], constructions: ['cemented'], open: true },
}
const DEFAULT_SHOE_PROFILE: ShoeProfile = { heel: [20, 40], closures: ['slip_on'], panels: [3, 7], constructions: ['cemented'] }
const isAthletic = (t: string) => !!SHOE_PROFILE[t]?.athletic
const isOpen = (t: string) => !!SHOE_PROFILE[t]?.open
const TYPE_KO = (t: string) => TYPE_LABEL[t] ?? t

export const shoePack: CategoryPack = {
  id: 'shoe',
  types: Object.keys(SHOE_PROFILE),
  fieldLabels: {
    last_id: 'Last', is_new_last: 'New last', toe_shape: 'Toe shape',
    heel_height_mm: 'Heel height (mm)', heel_type: 'Heel type', sole_construction: 'Construction',
    is_new_outsole_mold: 'New outsole mould', panel_count: 'Panels', closure: 'Closure',
    upper_material: 'Upper', upper_thickness_mm: 'Upper thickness (mm)', size_run_count: 'Size run',
  },
  generateSpec(rng, tier, itemType, locked) {
    const prof = SHOE_PROFILE[itemType] ?? DEFAULT_SHOE_PROFILE
    // 운동화는 러닝 라스트를, 그 외는 정장 라스트를 쓴다
    const pool = prof.athletic
      ? LAST_LIBRARY.filter(l => l.athletic)
      : LAST_LIBRARY.filter(l => !l.athletic)
    const last = rng.pick(pool.length ? pool : LAST_LIBRARY)
    // 라스트 정합: 대부분 라스트의 토 형상을 따르되, 일부는 어긋나게 (S-04 검증용)
    const toe = rng.chance(0.82) ? last.toe : rng.pick(TOES)
    const heelH = rng.int(prof.heel[0], prof.heel[1])
    const heelType = prof.athletic ? 'sport_midsole'
      : heelH > 65 ? rng.pick(['stiletto', 'block'])
      : heelH < 18 ? 'flat'
      : rng.pick(['flat', 'block', 'stacked'])
    const construction = rng.pick(prof.constructions)
    // 굿이어 웰트에는 두꺼운 갑피가 필요하다 · 대체로 맞추되 위반 사례도 남긴다 (S-06 검증용)
    const materials = prof.athletic
      ? ['engineered mesh 0.9mm', 'knit 0.8mm', 'synthetic 1.1mm', 'suede 1.4mm']
      : construction === 'goodyear' && rng.chance(0.8)
        ? ['calf 1.6mm', 'suede 1.4mm']
        : ['nappa 1.2mm', 'suede 1.4mm', 'patent 1.1mm', 'calf 1.6mm']
    const f: Record<string, string | number | boolean> = {
      last_id: last.last_id,
      is_new_last: tier === 'signature' ? rng.chance(0.4) : false,
      toe_shape: toe,
      heel_height_mm: heelH,
      heel_type: heelType,
      sole_construction: construction,
      is_new_outsole_mold: tier === 'core' ? rng.chance(0.12) : tier === 'push' ? rng.chance(0.35) : rng.chance(0.6),
      panel_count: rng.int(prof.panels[0], tier === 'signature' ? prof.panels[1] : Math.max(prof.panels[0], prof.panels[1] - 2)),
      closure: rng.pick(prof.closures),
      upper_material: rng.pick(materials),
      upper_thickness_mm: Math.round((prof.athletic ? 0.8 + rng.next() * 0.6
        : construction === 'goodyear' ? 1.35 + rng.next() * 0.45 : 1.0 + rng.next() * 0.8) * 10) / 10,
      size_run_count: prof.athletic ? 11 : 7,
      shaft_height_mm: prof.shaft ?? 0,
    }
    const lockedKeys: string[] = []
    for (const [k, v] of Object.entries(locked)) { f[k] = v; lockedKeys.push(k) }
    return { design_id: nextId('shoe', tier), tier, category: 'shoe', itemType, fields: f, fieldsLocked: lockedKeys }
  },
  rules(spec) {
    const f = spec.fields
    const r: RuleResult[] = []
    if (f.is_new_outsole_mold && spec.tier === 'core')
      r.push({ rule: 'S-01', severity: 'fail', message: 'New outsole mould on a Core piece. Rejected.' })
    if (f.is_new_last && spec.tier !== 'signature')
      r.push({ rule: 'S-02', severity: 'fail', message: 'A new last is only allowed on Signature. Rejected.' })
    const last = LAST_LIBRARY.find(l => l.last_id === f.last_id)
    if (last && last.toe !== f.toe_shape)
      r.push({ rule: 'S-04', severity: 'fail', message: `Toe shape ${f.toe_shape} does not match last ${f.last_id} (${last.toe}).` })
    if ((f.heel_height_mm as number) > 70 && f.heel_type === 'stiletto')
      r.push({ rule: 'S-05', severity: 'warn', message: `${f.heel_height_mm}mm stiletto. The shank spec needs checking.` })
    if (f.sole_construction === 'goodyear' && (f.upper_thickness_mm as number) < 1.4)
      r.push({ rule: 'S-06', severity: 'fail', message: `Goodyear welt with a ${f.upper_thickness_mm}mm upper, under 1.4mm. Not workable.` })
    if ((f.panel_count as number) > 8 && !isAthletic(spec.itemType))
      r.push({ rule: 'S-07', severity: 'warn', message: `${f.panel_count} panels. Stitching labour runs over.` })
    // 부츠(첼시 등)는 고어와 웰트를 함께 쓰는 것이 정상이라 제외한다
    if (f.closure === 'elastic_gore' && f.sole_construction === 'goodyear' && !(Number(f.shaft_height_mm) > 0))
      r.push({ rule: 'S-09', severity: 'fail', message: 'Goodyear welt on a gore slip-on. The stretch opening fights the welt.' })
    // 운동화 전용 · 러닝 라스트가 아니면 발볼·토스프링이 맞지 않는다
    if (isAthletic(spec.itemType) && !String(f.last_id).startsWith('LST-RUN'))
      r.push({ rule: 'S-11', severity: 'fail', message: `Dress last ${f.last_id} on a ${TYPE_KO(spec.itemType)}. It needs a running last.` })
    if (isAthletic(spec.itemType) && f.sole_construction !== 'cemented' && f.sole_construction !== 'vulcanized')
      r.push({ rule: 'S-12', severity: 'fail', message: `${f.sole_construction} construction on an athletic shoe. Not workable.` })
    // 부츠 · 목높이가 있으면 지퍼 또는 고어가 있어야 신을 수 있다
    const shaft = Number(f.shaft_height_mm) || 0
    if (shaft >= 150 && !['zip', 'elastic_gore', 'lace'].includes(String(f.closure)))
      r.push({ rule: 'S-13', severity: 'fail', message: `${shaft}mm shaft with no way in or out (${f.closure}).` })
    return r
  },
  costModel(spec, rng) {
    const f = spec.fields
    const athletic = isAthletic(spec.itemType)
    const open = isOpen(spec.itemType)
    const shaft = Number(f.shaft_height_mm) || 0
    const m = String(f.upper_material)
    const matRate = m.startsWith('calf') ? 16000 : m.startsWith('patent') ? 13000
      : m.startsWith('engineered') ? 7000 : m.startsWith('knit') ? 6000 : m.startsWith('synthetic') ? 5500 : 12000
    // 갑피 면적 · 샌들은 적게, 부츠는 목높이만큼 더 든다
    const areaFactor = open ? 0.45 : 1 + shaft / 400
    const upper = Math.round(matRate * areaFactor)
    const lining = Math.round((open ? 900 : 3000) * (1 + shaft / 500))
    const outsole = athletic ? 7200 : 4500
    const heel = athletic ? 0 : (f.heel_height_mm as number) > 50 ? 3200 : 2000
    const midsole = athletic ? 6500 : 0     // EVA·폼 미드솔은 운동화에만
    const hardware = f.closure === 'buckle' || f.closure === 'strap' ? 1800
      : f.closure === 'zip' ? 2600 : f.closure === 'lace' ? 1200 : 800
    const insole = athletic ? 2400 : 1200
    const cutting = Math.round((open ? 1800 : 3000) * (1 + shaft / 600))
    const stitching = 5500 + (f.panel_count as number) * 700
    const lasting = f.sole_construction === 'goodyear' ? 9500 : athletic ? 7000 : 6000
    const finishing = 2000
    // ★ 지시서 7.2 · 아웃솔 금형은 사이즈마다: mold_count_required = size_run_count
    const sizeRun = f.size_run_count as number
    const moldCount = f.is_new_outsole_mold ? sizeRun : 0
    const newOutsoleMoldUnit = 850000
    const newLast = f.is_new_last ? 2200000 : 0
    const totalTooling = moldCount * newOutsoleMoldUnit + newLast
    const amort = 3000
    const toolingPerUnit = Math.round(totalTooling / amort)
    const lines = [
      { label: 'Upper', krw: upper }, { label: 'Lining', krw: lining },
      { label: 'Outsole', krw: outsole },
      ...(midsole ? [{ label: 'Midsole', krw: midsole }] : []),
      ...(heel ? [{ label: 'Heel', krw: heel }] : []),
      { label: 'Hardware', krw: hardware }, { label: 'Insole', krw: insole },
      { label: 'Cutting', krw: cutting }, { label: 'Stitching labour', krw: stitching },
      { label: 'Lasting and assembly', krw: lasting }, { label: 'Finishing', krw: finishing },
      { label: `Tooling amortised (${moldCount} moulds)`, krw: toolingPerUnit },
    ]
    const total = lines.reduce((s, l) => s + l.krw, 0)
    const capBase = athletic ? 58000 : open ? 34000 : 46000
    return {
      lines,
      tooling: { total_tooling_krw: totalTooling, mold_count_required: moldCount, size_run_count: sizeRun, amortization_volume: amort, tooling_per_unit_krw: toolingPerUnit },
      estimated_total_krw: total,
      estimated_band_krw: [Math.round(total * 0.86), Math.round(total * (1.2 + rng.next() * 0.04))],
      cap_ratio: Math.round((total / capBase) * 100) / 100,
      confidence: 'low',
      assumptions: [`MOQ ${athletic ? 1200 : 600} pairs`, `${sizeRun} sizes`, `Amortised over ${amort.toLocaleString()} pairs`, 'Material prices as of 2026-08-01'],
      excluded_costs: ['Duty', 'Freight', 'Shoe box', 'Defect rate', 'Vendor margin', 'Sampling and last revisions'],
    }
  },
  signalAxes: ['Silhouette', 'Toe shape', 'Heel height band', 'Heel type', 'Sole thickness', 'Upper', 'Closure', 'Hardware', 'Price band'],
  viewSet: [
    { key: 'lateral', label: 'Lateral side (reference)', required: true },
    { key: 'q34', label: 'Three-quarter front', required: true },
    { key: 'top', label: 'top-down', required: true },
    { key: 'outsole', label: 'Outsole (Top N)', required: false },
  ],
  qaChecks: ['Toe shape reads correctly', 'Heel height within 20%', 'Panel count matches', 'Closure type', 'Same object across three views >=0.80', 'Ground line aligns'],
}

export const PACKS: Record<Category, CategoryPack> = { jewelry: jewelryPack, shoe: shoePack }

// ── 원가 상한 (유형 프리셋 · Core 100% / Push 130% / Signature 200%) ──
export const TIER_COST_CAP: Record<DesignTier, number> = { core: 1.0, push: 1.3, signature: 2.0 }

export function tierCapRule(spec: DesignSpec, cost: CostEstimate): RuleResult[] {
  const cap = TIER_COST_CAP[spec.tier]
  const out: RuleResult[] = []
  if (cost.cap_ratio > cap)
    out.push({ rule: spec.category === 'shoe' ? 'S-CAP' : 'J-CAP', severity: cost.cap_ratio > cap * 1.25 ? 'fail' : 'warn', message: `Cost sits at ${Math.round(cost.cap_ratio * 100)}% against a ${Math.round(cap * 100)}% cap` })
  // J-08 / S-10: 툴링 상각 > 상한의 15%
  if (cost.tooling.tooling_per_unit_krw > 0) {
    const capBase = spec.category === 'shoe' ? 46000 : jewelCapOf(spec.itemType)
    if (cost.tooling.tooling_per_unit_krw > capBase * cap * 0.15)
      out.push({ rule: spec.category === 'shoe' ? 'S-10' : 'J-08', severity: 'warn', message: `Tooling amortises to KRW ${cost.tooling.tooling_per_unit_krw.toLocaleString()} per unit, over 15% of the cap` })
  }
  return out
}
