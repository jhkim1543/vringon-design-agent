// ── Design Genome 클라이언트 · 저작은 LLM, 검증과 조립은 코드 ──────────
//
// 지시서 v2 S3~S5. 구조 결정의 저자가 rng.pick()에서 LLM으로 바뀐다.
// 코드가 하는 일은 셋뿐이다:
//   ① 게놈이 품목 프로필을 어겼는지 검사 (하드 실현성 — generateSpec의 클램프 재사용)
//   ② 채택된 게놈들과 구조축이 겹치는지 검사 (다양성 게이트 · 품질 판단 금지)
//   ③ 게놈 → 스펙 힌트 변환 (기존 hintApplied/blocked 정직성 기계를 그대로 탄다)
import type { DesignGenome, DesignTier, Signal, Territory } from './types'

export type Genome = DesignGenome

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error ?? `${url} ${r.status}`)
  return j as T
}

export const planTerritories = (b: {
  signals: Signal[]; itemTypeEn: string; itemType: string; brandSummary: string; langName: string
}) => post<{ territories: Territory[]; cached?: boolean }>('/api/design/territories', b)

export const authorGenome = (b: {
  territory: Territory; tier: DesignTier; signals: Signal[]
  profile: { heelMin: number; heelMax: number; panelMin: number; panelMax: number; closures: string[]; constructions: string[] }
  brandSummary: string; antiSimilarity: string[]; itemTypeEn: string; langName: string
}) => post<Genome & { cached?: boolean }>('/api/design/genome', b)

export interface RenderVerify {
  checks: { check: string; target: string; observed: string; pass: boolean }[]
  single_object: boolean
  notes: string
}
export const verifyRender = (b: { hash: string; genome: Partial<Genome>; langName: string }) =>
  post<RenderVerify>('/api/verify/render', b)

// ── 구조 다양성 게이트 · 5축, 순수 코드 (규칙 18: 품질 판단 금지) ──────
const AXES = ['silhouette_family', 'toe_family', 'sole_mass', 'panel_density', 'closure_form'] as const

/** 티어별 최소 상이 축 수 (지시서 S5) */
const TIER_MIN_DIFF: Record<DesignTier, number> = { core: 1, push: 2, signature: 3 }

export interface GateResult {
  pass: boolean
  /** 겹친 축 이름들 · 재저작 지시에 그대로 실린다 */
  collisions: string[]
}

/** 새 게놈이 채택된 게놈들과 구조적으로 충분히 다른가.
 *  모든 기채택 안과 비교해 티어별 최소 축 수 이상 달라야 한다.
 *  색·소재명 차이는 여기 들어오지 않는다 (규칙 6). */
export function diversityGate(g: Genome, accepted: Genome[], tier: DesignTier): GateResult {
  const need = TIER_MIN_DIFF[tier]
  const allCollisions = new Set<string>()
  for (const a of accepted) {
    const same = AXES.filter(ax => g[ax] === a[ax])
    const diff = AXES.length - same.length
    if (diff < need) same.forEach(ax => allCollisions.add(ax))
  }
  return { pass: allCollisions.size === 0, collisions: [...allCollisions] }
}

/** 게놈의 구조 요약 한 줄 · 다음 저작 호출의 반유사 다이제스트로 보낸다 */
export function genomeDigest(g: Genome): string {
  return `${g.silhouette_family} silhouette, ${g.toe_family} toe, ${g.sole_mass} sole, ${g.panel_density} panels, ${g.closure_form} closure — hero: ${g.hero_mutation.label}`
}

/** 게놈 → 스펙 힌트. 기존 generateSpec의 hint 경로를 그대로 탄다.
 *  프로필 클램프와 hintApplied/blocked 기록이 이미 거기 있으므로 재구현하지 않는다. */
export function genomeToHint(g: Genome): Record<string, string | number> {
  return {
    toe_shape: g.toe_family,
    heel_height_mm: g.spec_sheet.heel_height_mm,
    // hint의 panel_count는 방향(+1/-1)만 받는다 · 밀도에서 방향을 정한다
    panel_count: g.panel_density === 'dense' ? 1 : g.panel_density === 'minimal' ? -1 : 0,
    closure: g.closure_form,
    sole_construction: g.spec_sheet.sole_construction,
    upper_material: g.spec_sheet.upper_material,
  }
}

/** 브랜드 요약 · 영토·게놈 프롬프트에 들어가는 조건 텍스트.
 *  없는 항목은 없다고 두는 것이 규칙이다 (빈 브랜드 = 시장 평균 수렴을 정직하게 감수). */
export function brandSummaryOf(b?: {
  brandName?: string; signatureElements?: string[]; forbidden?: string[]
  materials?: string[]; toneWords?: string[]
} | null): string {
  if (!b?.brandName) return ''
  const parts: string[] = [`브랜드: ${b.brandName}`]
  if (b.signatureElements?.length) parts.push(`유지할 시그니처: ${b.signatureElements.join(', ')}`)
  if (b.forbidden?.length) parts.push(`금지: ${b.forbidden.join(', ')}`)
  if (b.materials?.length) parts.push(`선호 소재: ${b.materials.join(', ')}`)
  if (b.toneWords?.length) parts.push(`톤: ${b.toneWords.join(', ')}`)
  return parts.join('\n')
}
