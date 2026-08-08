// ── 조사 신호를 실제 스펙 값으로 옮긴다 ─────────────────────────────
// 여기가 없으면 조사는 장식이다. 신호를 잔뜩 모아 놓고 스펙은 난수로 뽑으면,
// 카드에 붙은 "이 신호에서 나왔다"는 문장이 사실이 아니게 된다.
//
// 규칙은 하나다: 신호가 스펙 필드를 바꿀 수 있을 때만 그 신호를 근거로 적는다.
// 바꾸지 못한 신호는 근거 목록에 오르지 않는다.
import type { DesignTier, Signal } from './types'

export interface SpecHint {
  /** 신호에서 읽어낸 스펙 값 */
  fields: Record<string, string | number>
  /** 실제로 값을 바꾼 신호 id → 바꾼 필드 이름들 */
  applied: Record<string, string[]>
}

/** 이 신호를 이 티어에서 실행할 수 있는가.
 *  Core는 툴링을 안 건드리는 신호만, Push는 하나까지, Signature는 다 받는다. */
function allowedInTier(s: Signal, tier: DesignTier): boolean {
  const last = s.last_change ?? 'unknown'
  const bottom = s.bottom_tooling_change ?? 'unknown'
  const needsTooling = (v: string) => v === 'required' || v === 'modification'
  if (tier === 'signature') return true
  if (tier === 'push') return !(needsTooling(last) && needsTooling(bottom))
  return !needsTooling(last) && !needsTooling(bottom)
}

/** 신호 한 건이 말하는 모든 문구 · 라벨과 공존 속성을 함께 읽는다 */
const textOf = (s: Signal) => [s.label, s.axis, s.attribute, ...(s.co_occurring ?? [])].join(' ').toLowerCase()

/** "25-35mm", "6–10 mm" 같은 구간에서 가운뎃값을 뽑는다 */
function midRange(text: string, near?: RegExp): number | null {
  const re = /(\d{1,3})\s*(?:[-–~]|to)\s*(\d{1,3})\s*mm/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (near && !near.test(text.slice(Math.max(0, m.index - 40), m.index + 40))) continue
    return Math.round((Number(m[1]) + Number(m[2])) / 2)
  }
  const single = /(\d{1,3})\s*mm/.exec(text)
  if (single && (!near || near.test(text))) return Number(single[1])
  return null
}

/** 신호 → 스펙 필드. 읽어낼 게 없으면 빈 객체. */
function fieldsFromSignal(s: Signal, athletic: boolean): Record<string, string | number> {
  const t = textOf(s)
  const out: Record<string, string | number> = {}

  // 토 셰이프 · 라스트 정합은 packs가 다시 맞춘다
  if (/\btoe\b|토/.test(t)) {
    const toe = /square/.test(t) ? 'square' : /almond/.test(t) ? 'almond'
      : /pointed/.test(t) ? 'pointed' : /round/.test(t) ? 'round' : null
    if (toe) out.toe_shape = toe
  }

  // 힐 높이·스택 · 구간이 적힌 신호만
  const heel = midRange(t, /heel|stack|스택|힐/)
  if (heel && heel >= 4 && heel <= 120) out.heel_height_mm = heel

  // 드롭 (운동화)
  if (athletic && /drop/.test(t)) {
    const d = midRange(t, /drop/)
    if (d && d >= 0 && d <= 14) out.drop_mm = d
  }

  // 힐 유형
  if (/block heel/.test(t)) out.heel_type = 'block'
  else if (/stiletto/.test(t)) out.heel_type = 'stiletto'
  else if (/stacked (leather )?heel/.test(t)) out.heel_type = 'stacked'
  else if (/kitten/.test(t)) out.heel_type = 'block'

  // 미드솔 폼 · 운동화에서만 의미가 있다
  if (athletic) {
    if (/peba/.test(t)) out.midsole_foam = 'PEBA blend'
    else if (/supercritical/.test(t)) out.midsole_foam = 'supercritical EVA'
    else if (/\bpu\b|polyurethane/.test(t)) out.midsole_foam = 'PU'
    else if (/\beva\b/.test(t)) out.midsole_foam = 'EVA'
    if (/carbon plate|carbon-plate/.test(t)) out.plate = 'carbon'
    else if (/nylon plate|composite plate|winged .*plate/.test(t)) out.plate = 'nylon'
    else if (/rock plate/.test(t)) out.plate = 'rock plate'
    else if (/no plate|plateless/.test(t)) out.plate = 'none'
  }

  // 러그 깊이 (트레일·하이킹)
  if (/lug/.test(t)) {
    const lug = /(\d(?:\.\d)?)\s*mm/.exec(t)
    if (lug && Number(lug[1]) >= 2 && Number(lug[1]) <= 8) out.lug_depth_mm = Number(lug[1])
  }

  // 클로저
  if (/elastic gore|gore panel/.test(t)) out.closure = 'elastic_gore'
  else if (/\bbuckle\b/.test(t)) out.closure = 'buckle'
  else if (/\bdial\b|boa/.test(t)) out.closure = 'lace'
  else if (/slip-?on/.test(t)) out.closure = 'slip_on'
  else if (/\blacing\b|\blace\b/.test(t)) out.closure = 'lace'

  // 어퍼 소재 · packs의 두께 표기와 같은 어휘를 쓴다
  if (/engineered mesh|engineered upper|woven upper/.test(t)) out.upper_material = 'engineered mesh 0.9mm'
  else if (/\bknit\b/.test(t)) out.upper_material = 'knit 0.8mm'
  else if (/suede/.test(t)) out.upper_material = 'suede 1.4mm'
  else if (/patent|hi-?shine|high-?shine/.test(t)) out.upper_material = 'patent 1.1mm'
  else if (/full-?grain|calf/.test(t)) out.upper_material = 'calf 1.6mm'
  else if (/nappa/.test(t)) out.upper_material = 'nappa 1.2mm'

  // 패널 수 · 방향만 읽는다 (줄이자/늘리자)
  if (/reduced overlays|fewer panels|minimal seams|one-?piece/.test(t)) out.panel_count = -1
  else if (/more panels|panelled|panel split|overlays/.test(t)) out.panel_count = 1

  // 공법
  if (/goodyear|storm welt/.test(t)) out.sole_construction = 'goodyear'
  else if (/blake/.test(t)) out.sole_construction = 'blake'
  else if (/vulcani/.test(t)) out.sole_construction = 'vulcanized'
  else if (/cupsole/.test(t)) out.sole_construction = 'cupsole'
  else if (/cemented/.test(t)) out.sole_construction = 'cemented'

  return out
}

/** 이 티어에서 실행 가능한 신호들을 스펙 힌트로 모은다.
 *  같은 필드를 여러 신호가 말하면 먼저 온 신호(관측 횟수가 많은 쪽)가 이긴다. */
export function deriveSpecHints(signals: Signal[], tier: DesignTier, athletic: boolean): SpecHint {
  const hint: SpecHint = { fields: {}, applied: {} }
  // 근거가 센 신호부터 본다. 관측 횟수, 그다음 상업 지수.
  const rank = (s: Signal) => s.observed_count * 10
    + (s.indices?.commercial === 'high' ? 3 : s.indices?.commercial === 'medium' ? 1 : 0)
  const ordered = [...signals].sort((a, b) => rank(b) - rank(a))

  for (const s of ordered) {
    if (!allowedInTier(s, tier)) continue
    const f = fieldsFromSignal(s, athletic)
    const took: string[] = []
    for (const [k, v] of Object.entries(f)) {
      if (k in hint.fields) continue          // 이미 더 센 신호가 정했다
      hint.fields[k] = v
      took.push(k)
    }
    if (took.length) hint.applied[s.signal_id] = took
  }
  return hint
}

/** 스펙 생성이 실제로 받아들인 필드만 남긴다.
 *  유형이 허용하지 않아 접힌 값은 근거에서 빠진다. 제안했다는 이유로 근거가 되지는 않는다. */
export function reconcileHint(hint: SpecHint, appliedFields: string[] = []): SpecHint {
  const ok = new Set(appliedFields)
  const out: SpecHint = { fields: {}, applied: {} }
  for (const k of ok) if (k in hint.fields) out.fields[k] = hint.fields[k]
  for (const [id, fs] of Object.entries(hint.applied)) {
    const kept = fs.filter(f => ok.has(f))
    if (kept.length) out.applied[id] = kept
  }
  return out
}

/** 조사가 요구했지만 유형이 못 받은 값 · 디자이너가 알아야 할 충돌 지점 */
export function blockedNarrative(blocked: { field: string; wanted: string | number; got: string | number }[] = []): string[] {
  return blocked.slice(0, 2).map(b =>
    `The research pointed to ${b.field.replace(/_/g, ' ')} ${b.wanted}, but this type holds at ${b.got}.`)
}

/** 근거 목록 · 실제로 바꾼 필드 수에 비례한 가중치. 아무것도 못 바꿨으면 비어 있다. */
export function drivingFromHint(hint: SpecHint): { signal_id: string; weight: number }[] {
  const entries = Object.entries(hint.applied)
  if (!entries.length) return []
  const total = entries.reduce((n, [, fs]) => n + fs.length, 0)
  return entries
    .map(([id, fs]) => ({ signal_id: id, weight: Math.round((fs.length / total) * 100) / 100 }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
}

/** 시리즈에서 반복된 요소를 스펙 잠금값으로 옮긴다.
 *
 *  사진에서 확실히 읽히는 것만 잠근다. 라스트 아이디는 여기 없다 —
 *  옆모습 사진으로 라스트가 같은지 알 수 없고, 모르는 것을 잠그면 뒤 단계가 통째로 어긋난다.
 *  (드레스 라스트를 상수로 박아 두던 시절, 운동화 시리즈는 룰에서 전부 걸렸다.) */
export function locksFromSeries(
  invariant: { element: string; label: string; observed_in: number }[],
  of: number,
): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  // 거의 모든 장에서 보인 것만 잠근다. 절반쯤 보이는 것은 그 시리즈의 규칙이 아니다.
  const strong = invariant.filter(e => of > 0 && e.observed_in >= Math.ceil(of * 0.8))
  for (const e of strong) {
    const t = `${e.element} ${e.label}`.toLowerCase()
    if (!('toe_shape' in out)) {
      const toe = /\bsquare\b/.test(t) ? 'square' : /\balmond\b/.test(t) ? 'almond'
        : /\bpointed\b/.test(t) ? 'pointed' : /\bround\b/.test(t) ? 'round' : null
      if (toe && /toe/.test(t)) out.toe_shape = toe
    }
    if (!('closure' in out)) {
      if (/elastic gore|gore panel/.test(t)) out.closure = 'elastic_gore'
      else if (/\bbuckle\b/.test(t)) out.closure = 'buckle'
      else if (/slip-?on/.test(t)) out.closure = 'slip_on'
      else if (/\blacing\b|\blace\b|eyelet|eyestay/.test(t)) out.closure = 'lace'
    }
    if (!('sole_construction' in out)) {
      if (/goodyear|storm welt/.test(t)) out.sole_construction = 'goodyear'
      else if (/\bblake\b/.test(t)) out.sole_construction = 'blake'
      else if (/vulcani/.test(t)) out.sole_construction = 'vulcanized'
      else if (/cupsole/.test(t)) out.sole_construction = 'cupsole'
    }
  }
  return out
}

/** 사람이 읽는 한 줄 · "이 신호가 이 필드를 이렇게 정했다" */
export function hintNarrative(hint: SpecHint, signals: Signal[]): string[] {
  const label = (id: string) => signals.find(s => s.signal_id === id)?.label ?? id
  const count = (id: string) => signals.find(s => s.signal_id === id)?.observed_count
  return Object.entries(hint.applied).slice(0, 3).map(([id, fs]) => {
    const seen = count(id)
    const where = seen ? `, seen ${seen} times in this band,` : ''
    const pairs = fs.map(f => `${f.replace(/_/g, ' ')} to ${hint.fields[f]}`).join(' and ')
    return `${label(id)}${where} set ${pairs}.`
  })
}
