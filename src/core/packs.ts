// ── FootwearPack · 신발 전용 팩 (지시서 4.1, 6장, 7장, 9.3, 11장) ────
import type { Category, CostEstimate, DesignSpec, DesignTier, RuleResult } from './types'
import { TYPE_LABEL, groupOf } from './types'
import type { Rng } from './rng'

export interface CategoryPack {
  id: Category
  types: string[]
  fieldLabels: Record<string, string>
  /** hint는 조사 신호에서 읽어낸 값이다. 유형이 허용하는 범위 안에서만 반영한다. */
  generateSpec: (rng: Rng, tier: DesignTier, itemType: string, locked: Record<string, string | number>, hint?: Record<string, string | number>) => DesignSpec
  rules: (spec: DesignSpec) => RuleResult[]
  costModel: (spec: DesignSpec, rng: Rng) => CostEstimate
  signalAxes: string[]
  viewSet: { key: string; label: string; required: boolean }[]
  qaChecks: string[]
}

let seq = 0
export function resetSeq() { seq = 0 }
function nextId(tier: DesignTier) {
  seq += 1
  const t = tier === 'core' ? 'C' : tier === 'push' ? 'P' : 'S'
  return `SH-26FW-${t}${String(seq).padStart(2, '0')}`
}

const TOES = ['almond', 'square', 'round', 'pointed'] as const

// 브랜드 라스트 라이브러리 (지시서 18장 · Core·S-04의 전제)
// family가 다르면 같은 토 셰이프라도 다른 라스트다. 러닝 라스트에 드레스 어퍼를 얹을 수 없다.
export const LAST_LIBRARY = [
  { last_id: 'LST-2024-07', toe: 'almond', label: 'Almond dress last', family: 'dress' },
  { last_id: 'LST-2024-11', toe: 'square', label: 'Square dress last', family: 'dress' },
  { last_id: 'LST-2023-03', toe: 'round', label: 'Round dress last', family: 'dress' },
  { last_id: 'LST-2025-01', toe: 'pointed', label: 'Pointed heel last', family: 'heel' },
  { last_id: 'LST-HEEL-02', toe: 'almond', label: 'Almond heel last, 55-75mm pitch', family: 'heel' },
  { last_id: 'LST-RUN-02', toe: 'round', label: 'Running last, medium volume', family: 'running' },
  { last_id: 'LST-RUN-05', toe: 'round', label: 'Running last, wide 2E', family: 'running' },
  { last_id: 'LST-RUN-07', toe: 'round', label: 'Racing last, low volume', family: 'running' },
  { last_id: 'LST-CRT-01', toe: 'round', label: 'Court last', family: 'running' },
  { last_id: 'LST-BOOT-04', toe: 'round', label: 'Boot last, medium-high volume', family: 'boot' },
  { last_id: 'LST-FLAT-01', toe: 'round', label: 'Wide comfort flat last', family: 'flat' },
]

// 타입별 설계 프로파일 · 룰과 원가가 타입에 따라 달라지는 지점
interface ShoeProfile {
  heel: [number, number]          // 힐/스택 높이 범위 mm
  closures: string[]
  panels: [number, number]
  constructions: string[]
  athletic?: boolean              // 운동화 계열 · 라스트·금형 논리가 다르다
  shaft?: number                  // 부츠 목높이 mm
  open?: boolean                  // 샌들류 · 갑피 면적이 작다
  lastFamily: string              // 이 유형이 요구하는 라스트 계열
  foams?: string[]                // 미드솔 폼 후보 (운동화)
  plates?: string[]               // 플레이트 후보 (운동화)
  drop?: [number, number]         // heel-to-toe drop 범위 (운동화)
  lugs?: [number, number]         // 러그 깊이 범위 mm (트레일·하이킹)
}
const SHOE_PROFILE: Record<string, ShoeProfile> = {
  // ── Sneakers ──
  running: { heel: [28, 40], closures: ['lace'], panels: [5, 11], constructions: ['cemented'], athletic: true, lastFamily: 'running', foams: ['EVA', 'supercritical EVA', 'PEBA blend'], plates: ['none', 'none', 'nylon'], drop: [6, 10] },
  max_cushion: { heel: [38, 52], closures: ['lace'], panels: [5, 10], constructions: ['cemented'], athletic: true, lastFamily: 'running', foams: ['supercritical EVA', 'PEBA blend', 'EVA'], plates: ['none'], drop: [4, 8] },
  tempo_racer: { heel: [30, 40], closures: ['lace'], panels: [4, 8], constructions: ['cemented'], athletic: true, lastFamily: 'running', foams: ['PEBA', 'PEBA blend'], plates: ['carbon', 'nylon', 'carbon'], drop: [4, 8] },
  trail: { heel: [24, 36], closures: ['lace'], panels: [6, 12], constructions: ['cemented'], athletic: true, lastFamily: 'running', foams: ['EVA', 'supercritical EVA'], plates: ['none', 'rock plate'], drop: [4, 8], lugs: [3.5, 5.5] },
  court_sneaker: { heel: [18, 28], closures: ['lace'], panels: [4, 9], constructions: ['cemented', 'vulcanized', 'cupsole'], athletic: true, lastFamily: 'running', foams: ['EVA'], plates: ['none', 'tpu shank'] },
  lifestyle_runner: { heel: [24, 36], closures: ['lace'], panels: [6, 12], constructions: ['cemented'], athletic: true, lastFamily: 'running', foams: ['EVA'], plates: ['none'], drop: [8, 12] },
  chunky_sneaker: { heel: [30, 55], closures: ['lace'], panels: [6, 12], constructions: ['cemented'], athletic: true, lastFamily: 'running', foams: ['EVA', 'PU'], plates: ['none'] },
  // ── Dress ──
  loafer: { heel: [18, 35], closures: ['slip_on', 'elastic_gore'], panels: [3, 6], constructions: ['cemented', 'blake', 'goodyear'], lastFamily: 'dress' },
  horsebit_loafer: { heel: [18, 35], closures: ['slip_on'], panels: [3, 6], constructions: ['blake', 'cemented'], lastFamily: 'dress' },
  chunky_loafer: { heel: [30, 55], closures: ['slip_on', 'elastic_gore'], panels: [3, 7], constructions: ['cemented', 'blake'], lastFamily: 'dress' },
  derby: { heel: [20, 35], closures: ['lace'], panels: [4, 7], constructions: ['blake', 'goodyear', 'cemented'], lastFamily: 'dress' },
  oxford: { heel: [20, 35], closures: ['lace'], panels: [4, 8], constructions: ['goodyear', 'blake'], lastFamily: 'dress' },
  monk: { heel: [20, 35], closures: ['buckle'], panels: [4, 7], constructions: ['blake', 'goodyear'], lastFamily: 'dress' },
  // ── Heels ──
  pump: { heel: [45, 95], closures: ['slip_on'], panels: [2, 5], constructions: ['cemented', 'blake'], lastFamily: 'heel' },
  slingback: { heel: [35, 85], closures: ['strap'], panels: [3, 6], constructions: ['cemented'], lastFamily: 'heel' },
  mary_jane: { heel: [15, 55], closures: ['strap'], panels: [3, 6], constructions: ['cemented', 'blake'], lastFamily: 'heel' },
  mule: { heel: [25, 80], closures: ['slip_on'], panels: [2, 4], constructions: ['cemented'], lastFamily: 'heel' },
  // ── Flats ──
  ballet_flat: { heel: [5, 15], closures: ['slip_on', 'elastic_gore'], panels: [2, 5], constructions: ['cemented', 'blake'], lastFamily: 'flat' },
  driving: { heel: [8, 18], closures: ['slip_on'], panels: [3, 6], constructions: ['moccasin', 'cemented'], lastFamily: 'flat' },
  espadrille: { heel: [10, 30], closures: ['slip_on'], panels: [2, 5], constructions: ['cemented'], lastFamily: 'flat' },
  // ── Boots ──
  ankle_boot: { heel: [25, 70], closures: ['zip', 'lace'], panels: [4, 8], constructions: ['cemented', 'goodyear'], shaft: 110, lastFamily: 'boot' },
  chelsea: { heel: [20, 45], closures: ['elastic_gore'], panels: [3, 6], constructions: ['cemented', 'goodyear'], shaft: 120, lastFamily: 'boot' },
  combat: { heel: [25, 45], closures: ['lace'], panels: [5, 10], constructions: ['goodyear', 'cemented'], shaft: 150, lastFamily: 'boot' },
  long_boot: { heel: [25, 75], closures: ['zip'], panels: [5, 9], constructions: ['cemented'], shaft: 380, lastFamily: 'boot' },
  hiking: { heel: [28, 42], closures: ['lace'], panels: [6, 12], constructions: ['cemented'], shaft: 130, lastFamily: 'boot', foams: ['PU', 'EVA'], lugs: [4, 6] },
  // ── Sandals ──
  strap_sandal: { heel: [10, 75], closures: ['buckle', 'strap'], panels: [3, 7], constructions: ['cemented'], open: true, lastFamily: 'flat' },
  slide: { heel: [10, 45], closures: ['slip_on'], panels: [1, 3], constructions: ['cemented'], open: true, lastFamily: 'flat' },
  sport_sandal: { heel: [18, 40], closures: ['strap'], panels: [2, 5], constructions: ['cemented'], open: true, lastFamily: 'flat', foams: ['EVA'] },
  gladiator: { heel: [10, 40], closures: ['buckle'], panels: [5, 10], constructions: ['cemented'], open: true, lastFamily: 'flat' },
}
const DEFAULT_SHOE_PROFILE: ShoeProfile = { heel: [20, 40], closures: ['slip_on'], panels: [3, 7], constructions: ['cemented'], lastFamily: 'dress' }
export const profileOf = (t: string) => SHOE_PROFILE[t] ?? DEFAULT_SHOE_PROFILE
const isAthletic = (t: string) => !!SHOE_PROFILE[t]?.athletic
const isOpen = (t: string) => !!SHOE_PROFILE[t]?.open
const NAME = (t: string) => TYPE_LABEL[t] ?? t

// ── 계열별 필수 뷰 (지시서 19장) · 계열이 다르면 봐야 하는 각도가 다르다
const VIEWSETS: Record<string, { key: string; label: string; required: boolean }[]> = {
  sneaker: [
    { key: 'lateral', label: 'Lateral side (reference)', required: true },
    { key: 'medial', label: 'Medial side', required: true },
    { key: 'q34', label: 'Three-quarter front', required: true },
    { key: 'top', label: 'Top-down', required: true },
    { key: 'outsole', label: 'Outsole (Top N)', required: false },
  ],
  dress: [
    { key: 'lateral', label: 'Lateral side (reference)', required: true },
    { key: 'q34', label: 'Three-quarter front', required: true },
    { key: 'top', label: 'Top-down', required: true },
    { key: 'outsole', label: 'Outsole and welt (Top N)', required: false },
  ],
  heel: [
    { key: 'lateral', label: 'Lateral side (reference)', required: true },
    { key: 'q34', label: 'Three-quarter front', required: true },
    { key: 'rear', label: 'Rear, heel and seat', required: true },
    { key: 'top', label: 'Top-down', required: false },
  ],
  flat: [
    { key: 'lateral', label: 'Lateral side (reference)', required: true },
    { key: 'top', label: 'Top-down, vamp and topline', required: true },
    { key: 'rear', label: 'Rear, heel hold', required: true },
    { key: 'outsole', label: 'Outsole (Top N)', required: false },
  ],
  boot: [
    { key: 'lateral', label: 'Lateral side (reference)', required: true },
    { key: 'q34', label: 'Three-quarter front', required: true },
    { key: 'rear', label: 'Rear, shaft and heel', required: true },
    { key: 'outsole', label: 'Outsole (Top N)', required: false },
  ],
  sandal: [
    { key: 'lateral', label: 'Lateral side (reference)', required: true },
    { key: 'top', label: 'Top-down, straps and footbed', required: true },
    { key: 'q34', label: 'Three-quarter front', required: true },
    { key: 'outsole', label: 'Outsole (Top N)', required: false },
  ],
}

/** 세부 유형의 필수 뷰셋 · 계열 기준 */
export function viewSetFor(itemType: string): { key: string; label: string; required: boolean }[] {
  const g = groupOf('shoe', itemType)
  return VIEWSETS[g?.id ?? 'sneaker'] ?? VIEWSETS.sneaker
}

export const shoePack: CategoryPack = {
  id: 'shoe',
  types: Object.keys(SHOE_PROFILE),
  fieldLabels: {
    last_id: 'Last', is_new_last: 'New last', toe_shape: 'Toe shape',
    heel_height_mm: 'Heel / stack (mm)', heel_type: 'Heel type', sole_construction: 'Construction',
    is_new_outsole_mold: 'New outsole mould', panel_count: 'Panels', closure: 'Closure',
    upper_material: 'Upper', upper_thickness_mm: 'Upper thickness (mm)', size_run_count: 'Size run',
    midsole_foam: 'Midsole foam', plate: 'Plate', drop_mm: 'Drop (mm)', lug_depth_mm: 'Lug depth (mm)',
  },
  generateSpec(rng, tier, itemType, locked, hint = {}) {
    const prof = profileOf(itemType)
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    // 조사가 정한 값과 이 유형이 실제로 허용한 값을 나눠 기록한다.
    // 카드에 "이 신호가 이 필드를 정했다"고 적으려면 진짜로 정했어야 한다.
    const took: string[] = []
    const blocked: { field: string; wanted: string | number; got: string | number }[] = []
    const verdict = (field: string, wanted: string | number | undefined, got: string | number) => {
      if (wanted === undefined) return
      if (wanted === got) took.push(field)
      else blocked.push({ field, wanted, got })
    }
    // 조사가 토 셰이프를 말했으면 그 토를 가진 라스트를 먼저 찾는다.
    // 없으면 유형이 요구하는 라스트 계열에서 고르고, 정합은 S-04가 잡는다.
    const famPool = LAST_LIBRARY.filter(l => l.family === prof.lastFamily)
    const hintToe = typeof hint.toe_shape === 'string' ? hint.toe_shape : null
    const toePool = hintToe ? famPool.filter(l => l.toe === hintToe) : []
    const last = rng.pick(toePool.length ? toePool : famPool.length ? famPool : LAST_LIBRARY)
    // 라스트 정합: 대부분 라스트의 토 형상을 따르되, 일부는 어긋나게 (S-04 검증용)
    const toe = hintToe && toePool.length ? hintToe
      : rng.chance(0.82) ? last.toe : rng.pick(TOES)
    // 조사가 말한 높이는 유형이 허용하는 범위 안으로 접어 넣는다
    const heelH = typeof hint.heel_height_mm === 'number'
      ? clamp(hint.heel_height_mm, prof.heel[0], prof.heel[1])
      : rng.int(prof.heel[0], prof.heel[1])
    const heelHint = typeof hint.heel_type === 'string' ? hint.heel_type : null
    const heelType = prof.athletic ? 'sport_midsole'
      : heelHint && heelH >= 18 ? heelHint
      : heelH > 65 ? rng.pick(['stiletto', 'block'])
      : heelH < 18 ? 'flat'
      : rng.pick(['flat', 'block', 'stacked'])
    // 공법은 유형이 실제로 쓰는 것 중에서만 반영한다 (러닝화에 굿이어를 붙일 수는 없다)
    const consHint = typeof hint.sole_construction === 'string' && prof.constructions.includes(hint.sole_construction)
      ? hint.sole_construction : null
    const construction = consHint ?? rng.pick(prof.constructions)
    // 굿이어 웰트에는 두꺼운 갑피가 필요하다 · 대체로 맞추되 위반 사례도 남긴다 (S-06 검증용)
    const materials = prof.athletic
      ? ['engineered mesh 0.9mm', 'knit 0.8mm', 'synthetic 1.1mm', 'suede 1.4mm']
      : construction === 'goodyear' && rng.chance(0.8)
        ? ['calf 1.6mm', 'suede 1.4mm']
        : ['nappa 1.2mm', 'suede 1.4mm', 'patent 1.1mm', 'calf 1.6mm']

    // ── 티어 = 라스트·몰드 변경 수준 (지시서 9.3) ──
    // Core: 기존 라스트 + 기존 바텀. Push: 하나만 변경. Signature: 신규 허용.
    // 일부러 위반 사례도 남긴다 — 룰이 실제로 걸러내는 것을 보여주는 지점.
    let newLast = false, newMold = false
    if (tier === 'core') {
      newLast = rng.chance(0.06)                        // 위반 사례 (S-02가 잡는다)
      newMold = rng.chance(0.1)                         // 위반 사례 (S-01이 잡는다)
    } else if (tier === 'push') {
      const which = rng.next()
      newLast = which < 0.3
      newMold = which >= 0.3 && which < 0.75            // 대부분 하나만 바꾼다
      if (rng.chance(0.08)) { newLast = true; newMold = true }  // 위반 사례 (S-03)
    } else {
      newLast = rng.chance(0.5)
      newMold = rng.chance(0.7)
    }

    // 패널 수 힌트는 방향(+1 / -1)으로 온다. 유형이 허용하는 범위 안에서만 움직인다.
    const panelHi = tier === 'signature' ? prof.panels[1] : Math.max(prof.panels[0], prof.panels[1] - 2)
    const panelBase = rng.int(prof.panels[0], panelHi)
    const panelDelta = hint.panel_count === -1 ? -2 : hint.panel_count === 1 ? 2 : 0
    const closureHint = typeof hint.closure === 'string' && prof.closures.includes(hint.closure) ? hint.closure : null
    const upperHint = typeof hint.upper_material === 'string' && materials.includes(hint.upper_material) ? hint.upper_material : null

    const f: Record<string, string | number | boolean> = {
      last_id: last.last_id,
      is_new_last: newLast,
      toe_shape: toe,
      heel_height_mm: heelH,
      heel_type: heelType,
      sole_construction: construction,
      is_new_outsole_mold: newMold,
      panel_count: clamp(panelBase + panelDelta, prof.panels[0], panelHi),
      closure: closureHint ?? rng.pick(prof.closures),
      upper_material: upperHint ?? rng.pick(materials),
      upper_thickness_mm: Math.round((prof.athletic ? 0.8 + rng.next() * 0.6
        : construction === 'goodyear' ? 1.35 + rng.next() * 0.45 : 1.0 + rng.next() * 0.8) * 10) / 10,
      size_run_count: prof.athletic ? 11 : 7,
      shaft_height_mm: prof.shaft ?? 0,
    }
    // 운동화 전용 필드 · 바텀 유닛이 곧 제품이다
    if (prof.foams) {
      const fh = typeof hint.midsole_foam === 'string' ? hint.midsole_foam : null
      f.midsole_foam = fh && prof.foams.includes(fh) ? fh : rng.pick(prof.foams)
    }
    if (prof.plates) {
      const ph = typeof hint.plate === 'string' ? hint.plate : null
      f.plate = ph && prof.plates.includes(ph) ? ph : rng.pick(prof.plates)
    }
    if (prof.drop) {
      f.drop_mm = typeof hint.drop_mm === 'number'
        ? clamp(hint.drop_mm, prof.drop[0], prof.drop[1])
        : rng.int(prof.drop[0], prof.drop[1])
    }
    if (prof.lugs) {
      f.lug_depth_mm = typeof hint.lug_depth_mm === 'number'
        ? clamp(hint.lug_depth_mm, prof.lugs[0], prof.lugs[1])
        : Math.round((prof.lugs[0] + rng.next() * (prof.lugs[1] - prof.lugs[0])) * 10) / 10
    }

    // ── 조사가 실제로 정한 값 대조 ──
    verdict('toe_shape', hint.toe_shape, f.toe_shape as string)
    verdict('heel_height_mm', hint.heel_height_mm, f.heel_height_mm as number)
    if (!prof.athletic) verdict('heel_type', hint.heel_type, f.heel_type as string)
    else if (hint.heel_type !== undefined) blocked.push({ field: 'heel_type', wanted: hint.heel_type, got: 'sport_midsole' })
    verdict('sole_construction', hint.sole_construction, f.sole_construction as string)
    verdict('closure', hint.closure, f.closure as string)
    verdict('upper_material', hint.upper_material, f.upper_material as string)
    if (typeof hint.panel_count === 'number' && hint.panel_count !== 0) {
      const moved = (f.panel_count as number) - panelBase
      if (moved !== 0 && Math.sign(moved) === Math.sign(hint.panel_count)) took.push('panel_count')
      else blocked.push({ field: 'panel_count', wanted: hint.panel_count < 0 ? 'fewer panels' : 'more panels', got: `${f.panel_count} panels, the limit for this type` })
    }
    if (prof.foams) verdict('midsole_foam', hint.midsole_foam, f.midsole_foam as string)
    if (prof.plates) verdict('plate', hint.plate, f.plate as string)
    if (prof.drop) verdict('drop_mm', hint.drop_mm, f.drop_mm as number)
    if (prof.lugs) verdict('lug_depth_mm', hint.lug_depth_mm, f.lug_depth_mm as number)
    // 이 유형에 없는 필드를 조사가 말했다면 그건 반영될 자리가 없다
    for (const k of Object.keys(hint)) {
      if (!(k in f) && k !== 'panel_count') blocked.push({ field: k, wanted: hint[k], got: 'not a field on this type' })
    }

    const lockedKeys: string[] = []
    for (const [k, v] of Object.entries(locked)) { f[k] = v; lockedKeys.push(k) }
    return {
      design_id: nextId(tier), tier, category: 'shoe', itemType, fields: f, fieldsLocked: lockedKeys,
      hintApplied: took.filter(k => !lockedKeys.includes(k)),
      hintBlocked: blocked,
    }
  },
  rules(spec) {
    const f = spec.fields
    const r: RuleResult[] = []
    // ── 티어 룰 · 라스트·몰드 변경 수준이 티어를 가른다 (지시서 9.3) ──
    if (f.is_new_outsole_mold && spec.tier === 'core')
      r.push({ rule: 'S-01', severity: 'fail', message: 'New outsole mould on a Core piece. Core reuses the existing bottom unit.' })
    if (f.is_new_last && spec.tier === 'core')
      r.push({ rule: 'S-02', severity: 'fail', message: 'New last on a Core piece. Core runs on an existing last.' })
    if (f.is_new_last && f.is_new_outsole_mold && spec.tier === 'push')
      r.push({ rule: 'S-03', severity: 'fail', message: 'Push changed both the last and the bottom unit. Push keeps one of the two.' })
    const last = LAST_LIBRARY.find(l => l.last_id === f.last_id)
    if (last && last.toe !== f.toe_shape && !f.is_new_last)
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
    if (isAthletic(spec.itemType) && LAST_LIBRARY.some(l => l.last_id === f.last_id && l.family !== 'running'))
      r.push({ rule: 'S-11', severity: 'fail', message: `${LAST_LIBRARY.find(l => l.last_id === f.last_id)?.label ?? f.last_id} on a ${NAME(spec.itemType)}. It needs a running-family last.` })
    if (isAthletic(spec.itemType) && !['cemented', 'vulcanized', 'cupsole'].includes(String(f.sole_construction)))
      r.push({ rule: 'S-12', severity: 'fail', message: `${f.sole_construction} construction on an athletic shoe. Not workable.` })
    // 부츠 · 목높이가 있으면 지퍼 또는 고어가 있어야 신을 수 있다
    const shaft = Number(f.shaft_height_mm) || 0
    if (shaft >= 150 && !['zip', 'elastic_gore', 'lace'].includes(String(f.closure)))
      r.push({ rule: 'S-13', severity: 'fail', message: `${shaft}mm shaft with no way in or out (${f.closure}).` })
    // 경기용 · World Athletics 규정은 로드 스택 40mm를 상한으로 둔다
    if (f.plate === 'carbon' && (f.heel_height_mm as number) > 40)
      r.push({ rule: 'S-14', severity: 'warn', message: `${f.heel_height_mm}mm stack with a carbon plate. Past the World Athletics 40mm road limit — competition eligibility needs checking.` })
    // 트레일 · 러그가 얕으면 트레일 접지가 안 나온다
    if ((spec.itemType === 'trail' || spec.itemType === 'hiking') && Number(f.lug_depth_mm) < 3)
      r.push({ rule: 'S-15', severity: 'warn', message: `${f.lug_depth_mm}mm lugs on a ${NAME(spec.itemType)}. Under 3mm reads as a road outsole.` })
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
    // 미드솔 · 폼 등급이 원가를 가른다 (수퍼크리티컬·PEBA는 비싸다)
    const foam = String(f.midsole_foam ?? '')
    const midsole = !athletic && !foam ? 0
      : foam.includes('PEBA') ? 14500 : foam.includes('supercritical') ? 10500 : foam === 'PU' ? 5200 : 6500
    const plate = f.plate === 'carbon' ? 12000 : f.plate === 'nylon' || f.plate === 'tpu shank' || f.plate === 'rock plate' ? 3800 : 0
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
      ...(midsole ? [{ label: `Midsole${foam ? ` (${foam})` : ''}`, krw: midsole }] : []),
      ...(plate ? [{ label: `Plate (${f.plate})`, krw: plate }] : []),
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
  signalAxes: ['Silhouette', 'Toe shape', 'Heel height band', 'Heel type', 'Sole thickness', 'Midsole and plate', 'Upper', 'Closure', 'Hardware', 'Tread', 'Price band'],
  viewSet: VIEWSETS.sneaker,
  qaChecks: ['Toe shape reads correctly', 'Heel height within 20%', 'Panel count matches', 'Closure type', 'Same object across views >=0.80', 'Ground line aligns', 'Lateral and medial sides consistent'],
}

export const PACKS: Record<Category, CategoryPack> = { shoe: shoePack }

// ── 원가 상한 (유형 프리셋 · Core 100% / Push 130% / Signature 200%) ──
export const TIER_COST_CAP: Record<DesignTier, number> = { core: 1.0, push: 1.3, signature: 2.0 }

export function tierCapRule(spec: DesignSpec, cost: CostEstimate): RuleResult[] {
  const cap = TIER_COST_CAP[spec.tier]
  const out: RuleResult[] = []
  if (cost.cap_ratio > cap)
    out.push({ rule: 'S-CAP', severity: cost.cap_ratio > cap * 1.25 ? 'fail' : 'warn', message: `Cost sits at ${Math.round(cost.cap_ratio * 100)}% against a ${Math.round(cap * 100)}% cap` })
  // S-10: 툴링 상각 > 상한의 15%
  if (cost.tooling.tooling_per_unit_krw > 0) {
    const capBase = 46000
    if (cost.tooling.tooling_per_unit_krw > capBase * cap * 0.15)
      out.push({ rule: 'S-10', severity: 'warn', message: `Tooling amortises to KRW ${cost.tooling.tooling_per_unit_krw.toLocaleString()} per unit, over 15% of the cap` })
  }
  return out
}
