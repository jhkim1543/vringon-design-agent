import { getLang, LANG_NAME } from './i18n'
import type { Lang } from './i18n'

/** 이 분석이 쓰는 언어. 파이프라인이 시작할 때 한 번 정하고 끝까지 유지한다. */
let runLang: Lang | null = null
export function setRunLang(l: Lang | null) { runLang = l }
// ── 리서치 클라이언트 · 서버가 웹 검색으로 실제 수집한 결과를 받는다 ──
import type { CompetitorGroup, CompetitorProduct, FootwearLineProfile, ReportBias, ResearchObjective, Signal } from './types'
import { asFootwearLine } from './types'
import { apiUrl } from './apiBase'

export interface CompetitorProductRaw {
  brand: string
  brand_line: string
  model_name: string
  price_krw: number
  released: string
  popularity_evidence: string[]
  evidence_strength: 'strong' | 'moderate' | 'weak' | 'none'
  rank_note: string
  rank_semantics: 'verified_sales_rank' | 'retailer_bestseller_membership' | 'surface_position' | 'marketplace_trade_rank' | 'none'
  competitor_group: CompetitorGroup
  construction_tier: string
  user_sentiment: 'positive' | 'mixed' | 'negative' | 'unknown'
  praise_points: string[]
  complaint_points: string[]
  design_traits: string[]
  offered_sizes: number
  available_sizes: number
  size_status: 'full' | 'partial' | 'size_broken' | 'sold_out' | 'unknown'
  colorway_count: number
  image_urls: string[]
  product_url: string
  source_urls: string[]
}

export interface CompetitorResearch {
  products: CompetitorProductRaw[]
  notes: string
  searches: number
  collected_at: string
  cached?: boolean
}

export interface TrendReport {
  title: string
  executive_view: string
  body_markdown: string
  design_implications: { area: string; guidance: string; basis: string }[]
  open_questions: string[]
  sources: string[]
}

/** 수집한 원격 이미지는 서버 캐시를 거쳐 불러온다.
 *  page를 함께 주면 직링크가 죽었을 때 서버가 페이지의 og:image로 폴백한다.
 *  이미 로컬로 굳힌 경로(/samples/…)는 그대로 쓴다 — 정적 데모에는 프록시가 없다.
 *  u가 비어 있어도 page가 있으면 페이지에서 대표 이미지를 찾는다. */
export const shotUrl = (u: string, page?: string) => {
  if (u && !/^https?:\/\//.test(u)) return u
  const q: string[] = []
  if (u) q.push(`u=${encodeURIComponent(u)}`)
  if (page) q.push(`p=${encodeURIComponent(page)}`)
  return apiUrl(`/api/shot?${q.join('&')}`)
}

export interface TrendResearch {
  signals: {
    label: string
    axis: string
    attribute: string
    direction: 'rising' | 'stable' | 'declining'
    observed_count: number
    evidence: string[]
    source_urls: string[]
    confidence: 'high' | 'medium' | 'low'
    co_occurring: string[]
    commercial_index: 'high' | 'medium' | 'low' | 'none'
    cultural_index: 'high' | 'medium' | 'low' | 'none'
    forecast_index: 'high' | 'medium' | 'low' | 'none'
    feasibility_index: 'high' | 'medium' | 'low' | 'none'
    adoption_stage: 'emerging' | 'growing' | 'established' | 'declining' | 'unknown'
    last_change: 'not_required' | 'modification' | 'required' | 'unknown'
    bottom_tooling_change: 'not_required' | 'modification' | 'required' | 'unknown'
    upper_pattern_change: 'minor' | 'major' | 'unknown'
  }[]
  report_perspective: string
  notes: string
  searches: number
  collected_at: string
  cached?: boolean
  engine?: 'deep' | 'multi' | 'fast'
  report?: TrendReport
  sub_questions?: string[]
}

async function post<T>(url: string, body: unknown): Promise<T> {
  // 조사 결과의 언어는 분석을 시작할 때 정한다. 화면 언어를 그때그때 따라가면
  // 도중에 언어를 바꿨을 때 한 리포트 안에 두 언어가 섞인다.
  const lang = runLang ?? getLang()
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(body as object), lang, langName: LANG_NAME[lang] }),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error ?? `${url} ${r.status}`)
  return j as T
}

/** 라인 프로필을 서버에 넘길 요약으로. 검색어·필터·캐시 키가 모두 이 값을 쓴다. */
export function lineForServer(raw?: FootwearLineProfile, itemType?: string) {
  const lp = asFootwearLine(raw)
  if (!lp) return undefined
  return {
    itemType: itemType ?? '',
    useCase: lp.product.useCase, targetConsumer: lp.product.targetConsumer,
    season: lp.product.season, climate: lp.product.climate,
    lastFamily: lp.lastFit.lastFamily, toeShape: lp.lastFit.toeShape,
    upperOuter: lp.upper.outer, closure: lp.upper.closure, protection: lp.upper.protection,
    midsole: lp.bottom.midsole, plate: lp.bottom.plate, outsole: lp.bottom.outsole,
    stackBand: lp.bottom.stackBand, dropMm: lp.bottom.dropMm, rocker: lp.bottom.rocker, heel: lp.bottom.heel,
    lasting: lp.construction.lasting, soleAttachment: lp.construction.soleAttachment,
    cushioning: lp.performance.cushioning, stability: lp.performance.stability, wetGrip: lp.performance.wetGrip,
    // 시장은 이제 자유 텍스트 한 줄이 아니라 구조로 간다. 서버가 이걸로
    // 검색 언어·리테일 지면·검색 위치·가격 기준·캐시 키를 전부 가른다.
    homeMarket: lp.commercial.homeMarket ?? (lp.commercial.markets?.[0] as string | undefined) ?? 'KR',
    referenceMarkets: lp.commercial.referenceMarkets ?? [],
    channels: lp.commercial.channels,
  }
}

export const fetchCompetitors = (b: {
  brands: string[]; typeKo: string; priceMin: number; priceMax: number
  adjacentBand?: boolean; line?: FootwearLineProfile; itemType?: string
}) => post<CompetitorResearch>(apiUrl('/api/research/competitors'), {
  brands: b.brands, typeKo: b.typeKo, priceMin: b.priceMin, priceMax: b.priceMax,
  adjacentBand: b.adjacentBand, line: lineForServer(b.line, b.itemType),
})

// ── 백화점·명품몰 베스트셀러 펄스 ───────────────────────────────────
export interface RetailPulseRaw {
  retailer: string
  brand: string
  model_name: string
  price_krw: number
  rank_note: string
  rank_semantics: 'verified_sales_rank' | 'retailer_bestseller_membership' | 'surface_position' | 'none'
  construction_tier: string
  design_traits: string[]
  image_urls: string[]
  product_url: string
  source_urls: string[]
}
export interface RetailPulse {
  products: RetailPulseRaw[]
  notes: string
  searches: number
  collected_at: string
  cached?: boolean
}

export const fetchRetailPulse = (b: { typeKo: string; line?: FootwearLineProfile; itemType?: string }) =>
  post<RetailPulse>(apiUrl('/api/research/pulse'), { typeKo: b.typeKo, line: lineForServer(b.line, b.itemType) })

/** 펄스 제품 → 경쟁 제품 목록에 합쳐 넣는다. 백화점 베스트셀러는 commercial_leader다. */
export function pulseToCompetitors(r: RetailPulse, startIdx: number): CompetitorProduct[] {
  return r.products.filter(p => p.image_urls?.length).map((p, i) => ({
    product_id: `pl_${startIdx + i + 1}`,
    brand: p.brand,
    name: p.model_name,
    price_krw: p.price_krw,
    sales_proxy_score: null,
    proxy_signals: p.rank_note ? [p.rank_note] : [],
    observation_count: 1,
    observation_window: `${r.collected_at}, single pass`,
    confidence: 'none' as const,
    in_band: true,
    evidence_strength: 'strong' as const,
    source_urls: p.source_urls,
    rank_note: p.rank_note,
    rank_semantics: p.rank_semantics,
    competitor_group: 'commercial_leader' as const,
    construction_tier: p.construction_tier || undefined,
    design_traits: p.design_traits,
    image_urls: p.image_urls,
    product_url: p.product_url,
    retailer: p.retailer,
  }))
}

export const fetchTrends = (b: {
  typeKo: string; brands?: string[]; season: string
  priceBandKo?: string; wantReport?: boolean; depth?: number
  objectives?: ResearchObjective[]; line?: FootwearLineProfile; itemType?: string
}) => post<TrendResearch>(apiUrl('/api/research/trends'), {
  typeKo: b.typeKo, brands: b.brands, season: b.season, priceBandKo: b.priceBandKo,
  wantReport: b.wantReport, depth: b.depth, objectives: b.objectives,
  line: lineForServer(b.line, b.itemType),
})

// ── 수집 결과 → 도메인 타입 ─────────────────────────────────────────
// 판매 프록시는 만들지 않는다. 1회 수집으로는 시계열이 성립하지 않는다.
const lvl = (v?: string): 'high' | 'medium' | 'low' | null =>
  v === 'high' || v === 'medium' || v === 'low' ? v : null

export function toCompetitors(r: CompetitorResearch, priceMin: number, priceMax: number): CompetitorProduct[] {
  const lo = priceMin * 0.7, hi = priceMax * 1.3
  return r.products.map((p, i) => ({
    product_id: `cp_${i + 1}`,
    brand: p.brand,
    name: p.model_name,
    price_krw: p.price_krw,
    sales_proxy_score: null,
    proxy_signals: p.popularity_evidence,
    observation_count: 1,
    observation_window: `${r.collected_at}, single pass`,
    confidence: 'none',
    in_band: p.price_krw === 0 ? true : p.price_krw >= lo && p.price_krw <= hi,
    evidence_strength: p.evidence_strength,
    source_urls: p.source_urls,
    rank_note: p.rank_note,
    rank_semantics: p.rank_semantics,
    competitor_group: p.competitor_group,
    brand_line: p.brand_line,
    construction_tier: p.construction_tier,
    user_sentiment: p.user_sentiment,
    praise_points: p.praise_points,
    complaint_points: p.complaint_points,
    design_traits: p.design_traits,
    offered_sizes: p.offered_sizes > 0 ? p.offered_sizes : undefined,
    available_sizes: p.available_sizes >= 0 && p.offered_sizes > 0 ? p.available_sizes : undefined,
    size_status: p.size_status,
    colorway_count: p.colorway_count > 0 ? p.colorway_count : undefined,
    image_urls: p.image_urls,
    product_url: p.product_url,
  }))
}

// 모델이 가끔 "확인하지 못했다"를 신호로 올린다. 그건 신호가 아니라 조사의 한계라
// 리포트 본문에만 남기고 신호 목록에서는 걸러낸다.
const NOT_A_SIGNAL = /\b(not computable|undetermined|visibility gap|not available|no data|unavailable|inconsistent|not standardi[sz]ed|coverage gap|access constraint)\b/i

export function toSignals(r: TrendResearch): Signal[] {
  return r.signals
    .filter(s => s.observed_count > 0 && !NOT_A_SIGNAL.test(s.label))
    .map((s, i) => ({
    signal_id: `sg_${String(i + 1).padStart(3, '0')}`,
    attribute: s.attribute,
    label: s.label,
    axis: s.axis,
    observed_count: s.observed_count,
    sources: s.source_urls,
    price_bands: [],
    confidence: s.confidence,
    direction: s.direction,
    first_seen: r.collected_at,
    dedup_group: `dg_${i + 1}`,
    oem_group: null,
    evidence: s.evidence,
    co_occurring: s.co_occurring?.length ? s.co_occurring : undefined,
    indices: {
      commercial: lvl(s.commercial_index),
      cultural: lvl(s.cultural_index),
      forecast: lvl(s.forecast_index),
      feasibility: lvl(s.feasibility_index),
    },
    adoption_stage: s.adoption_stage,
    last_change: s.last_change,
    bottom_tooling_change: s.bottom_tooling_change,
    upper_pattern_change: s.upper_pattern_change,
  }))
}

export function toBias(r: TrendResearch): ReportBias {
  return {
    publisher: `Web, collected ${r.collected_at} across ${r.searches} searches`,
    perspective: r.report_perspective,
    notes: r.notes ? [r.notes] : [],
  }
}

// ── 시즌 도시에 · MICAM 형식 ────────────────────────────────────────
export interface DossierMetric {
  label: string
  yoy_percent: number | null
  /** 공개 수치를 못 찾았을 때도 방향과 세기는 항상 채워진다 */
  magnitude: 'surging' | 'rising' | 'steady' | 'softening'
  source_kind: 'market' | 'social' | 'shows' | 'consumer'
  source_url: string
  observed_note: string
}
export interface DossierColor { name: string; pantone_tcx: string; hex: string }
export type TrendGrade = 'edgy' | 'early_sign' | 'safe' | 'big' | 'stable' | 'last_call'
export interface DossierKeyItem {
  segment: 'women' | 'men' | 'kids'
  name: string
  description: string
  metric: DossierMetric
  grade: TrendGrade
  silhouette_spec: string
}
export interface Macrotrend {
  name: string
  statement: string
  narrative: string
  sub_trends: string[]
  drivers: DossierMetric[]
  palette: DossierColor[]
  materials: DossierMetric[]
  details: DossierMetric[]
  key_items: DossierKeyItem[]
  grade: TrendGrade
}
export interface SeasonDossier {
  season: string
  season_title: string
  powershift: string
  season_narrative: string
  macrotrends: Macrotrend[]
  yearly_context: { season: string; headline: string; what_changed: string; source_url: string }[]
  method_note: string
  open_questions: string[]
  sources: { title: string; url: string; used_for: string }[]
  searches: number
  collected_at: string
  cached?: boolean
}

export const fetchDossier = (b: {
  categoryEn: string; season: string; priceBand?: string; brands?: string[]
  line?: FootwearLineProfile; itemType?: string
}) => post<SeasonDossier>(apiUrl('/api/research/dossier'), {
  categoryEn: b.categoryEn, season: b.season, priceBand: b.priceBand, brands: b.brands,
  line: lineForServer(b.line, b.itemType),
})

export const GRADE_LABEL: Record<TrendGrade, string> = {
  edgy: 'Edgy', early_sign: 'Early sign', safe: 'Safe',
  big: 'Big trend', stable: 'Stable', last_call: 'Last call',
}
export const SOURCE_LABEL: Record<DossierMetric['source_kind'], string> = {
  market: 'E-commerce', social: 'Instagram', shows: 'Runway', consumer: 'Search',
}

export const MAG_LABEL: Record<DossierMetric['magnitude'], string> = {
  surging: 'Surging', rising: 'Rising', steady: 'Steady', softening: 'Softening',
}
/** 화면 표기 · 공개된 %가 있으면 그것을, 없으면 강도를 쓴다 */
export function metricText(m: Pick<DossierMetric, 'yoy_percent' | 'magnitude'>): string {
  if (m.yoy_percent != null) return `${m.yoy_percent > 0 ? '+' : ''}${m.yoy_percent}%`
  return MAG_LABEL[m.magnitude] ?? '—'
}
