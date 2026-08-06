// ── S1 샘플 데이터 · 신발 전용 신호/경쟁사/디렉션/DNA (데모·폴백용) ──
import type { Category, CompetitorProduct, Direction, ReportBias, SeriesDna, Signal } from './types'

const SRC = (n: number) => Array.from({ length: n }, (_, i) => `https://observed.example/${1000 + i * 37}`)

export const SIGNALS: Record<Category, Signal[]> = {
  shoe: [
    {
      signal_id: 'sg_014', attribute: 'square_toe', label: 'Elongated soft square toe', axis: 'Toe shape',
      observed_count: 7, sources: SRC(3), price_bands: ['contemporary'], confidence: 'high', direction: 'rising',
      first_seen: '2026-02', dedup_group: 'dg_003', oem_group: null, sales_proxy_score: 0.72, proxy_confidence: 'medium',
      co_occurring: ['medium-long vamp', 'low sole profile', '20-30mm heel band'],
      indices: { commercial: 'medium', cultural: 'high', forecast: 'high', feasibility: 'medium' },
      adoption_stage: 'growing', last_change: 'required', bottom_tooling_change: 'not_required', upper_pattern_change: 'major',
    },
    {
      signal_id: 'sg_027', attribute: 'chunky_sole', label: 'Chunky lugged sole', axis: 'Sole thickness',
      observed_count: 4, sources: SRC(2), price_bands: ['contemporary', 'premium'], confidence: 'medium', direction: 'rising',
      first_seen: '2026-01', dedup_group: 'dg_007', oem_group: 'oem_2', sales_proxy_score: 0.61, proxy_confidence: 'medium',
      co_occurring: ['high stack', 'wide platform', 'raised sidewall', 'segmented rubber'],
      indices: { commercial: 'medium', cultural: 'high', forecast: 'high', feasibility: 'low' },
      adoption_stage: 'growing', last_change: 'not_required', bottom_tooling_change: 'required', upper_pattern_change: 'minor',
    },
    {
      signal_id: 'sg_031', attribute: 'low_block_heel', label: 'Low block heel, 25-35mm', axis: 'Heel height band',
      observed_count: 6, sources: SRC(3), price_bands: ['contemporary'], confidence: 'high', direction: 'stable',
      first_seen: '2025-11', dedup_group: 'dg_010', oem_group: null, sales_proxy_score: 0.68, proxy_confidence: 'high',
      co_occurring: ['stacked leather finish', 'rubber top piece'],
      indices: { commercial: 'high', cultural: 'medium', forecast: 'medium', feasibility: 'high' },
      adoption_stage: 'established', last_change: 'not_required', bottom_tooling_change: 'not_required', upper_pattern_change: 'minor',
    },
    {
      signal_id: 'sg_038', attribute: 'elastic_gore', label: 'Elastic gore closure', axis: 'Closure',
      observed_count: 3, sources: SRC(2), price_bands: ['mass', 'contemporary'], confidence: 'medium', direction: 'rising',
      first_seen: '2026-03', dedup_group: 'dg_012', oem_group: null, sales_proxy_score: 0.44, proxy_confidence: 'low',
      co_occurring: ['clean vamp', 'tonal stitching'],
      indices: { commercial: 'medium', cultural: 'low', forecast: 'medium', feasibility: 'high' },
      adoption_stage: 'emerging', last_change: 'not_required', bottom_tooling_change: 'not_required', upper_pattern_change: 'minor',
    },
    {
      signal_id: 'sg_042', attribute: 'suede_texture', label: 'Suede upper', axis: 'Upper',
      observed_count: 5, sources: SRC(3), price_bands: ['contemporary'], confidence: 'medium', direction: 'stable',
      first_seen: '2025-12', dedup_group: 'dg_015', oem_group: null, sales_proxy_score: 0.57, proxy_confidence: 'medium',
      co_occurring: ['brushed finish', 'tonal welt'],
      indices: { commercial: 'high', cultural: 'medium', forecast: 'medium', feasibility: 'high' },
      adoption_stage: 'established', last_change: 'not_required', bottom_tooling_change: 'not_required', upper_pattern_change: 'minor',
    },
    {
      signal_id: 'sg_047', attribute: 'metal_hardware', label: 'Metal hardware accent', axis: 'Hardware',
      observed_count: 4, sources: SRC(2), price_bands: ['premium'], confidence: 'low', direction: 'rising',
      first_seen: '2026-04', dedup_group: 'dg_018', oem_group: null, sales_proxy_score: 0.51, proxy_confidence: 'low',
      co_occurring: ['slim vamp plate', 'polished silver tone'],
      indices: { commercial: 'low', cultural: 'high', forecast: 'medium', feasibility: 'high' },
      adoption_stage: 'emerging', last_change: 'not_required', bottom_tooling_change: 'not_required', upper_pattern_change: 'minor',
    },
  ],
}

export const COMPETITORS: Record<Category, CompetitorProduct[]> = {
  shoe: [
    { product_id: 'cp_s01', brand: 'Brand A', name: 'Square-toe loafer', price_krw: 258000, sales_proxy_score: 0.72, proxy_signals: ['restock:3', 'sold_out_days:22', 'colorway_expansion:2'], observation_count: 6, observation_window: '2026-01-01~2026-06-30', confidence: 'medium', in_band: true, competitor_group: 'direct', construction_tier: 'contemporary cemented', rank_semantics: 'retailer_bestseller_membership', offered_sizes: 8, available_sizes: 5, size_status: 'partial', colorway_count: 3 },
    { product_id: 'cp_s02', brand: 'Brand B', name: 'Chunky chain loafer', price_krw: 312000, sales_proxy_score: 0.61, proxy_signals: ['restock:2', 'rank_entry:4'], observation_count: 5, observation_window: '2026-01-01~2026-06-30', confidence: 'medium', in_band: true, competitor_group: 'directional_designer', construction_tier: 'contemporary cemented', rank_semantics: 'surface_position', offered_sizes: 7, available_sizes: 3, size_status: 'size_broken', colorway_count: 2 },
    { product_id: 'cp_s03', brand: 'Brand C', name: 'Classic penny loafer', price_krw: 198000, sales_proxy_score: 0.68, proxy_signals: ['sold_out_days:31', 'no_discount:120d'], observation_count: 7, observation_window: '2026-01-01~2026-06-30', confidence: 'high', in_band: true, competitor_group: 'commercial_leader', construction_tier: 'contemporary cemented', rank_semantics: 'retailer_bestseller_membership', offered_sizes: 9, available_sizes: 9, size_status: 'full', colorway_count: 4 },
    { product_id: 'cp_s04', brand: 'Brand D', name: 'Suede gore loafer', price_krw: 152000, sales_proxy_score: null, proxy_signals: [], observation_count: 1, observation_window: '2026-06-12, single pass', confidence: 'none', in_band: true, competitor_group: 'direct', construction_tier: 'mass cemented', rank_semantics: 'none', size_status: 'unknown' },
    { product_id: 'cp_s05', brand: 'Brand E (luxury)', name: 'Horsebit loafer', price_krw: 1290000, sales_proxy_score: null, proxy_signals: [], observation_count: 4, observation_window: '2026-01-01~2026-06-30', confidence: 'medium', in_band: false, competitor_group: 'aspirational', construction_tier: 'luxury blake', rank_semantics: 'retailer_bestseller_membership', size_status: 'unknown' },
  ],
}

export const DIRECTIONS: Record<Category, Direction[]> = {
  shoe: [
    { id: 'dir_1', title: 'Square toe with a low block heel', summary: 'The two strongest signals in this band, combined. It runs on the existing LST-2024-11 last, so development stays cheap.', signal_ids: ['sg_014', 'sg_031'] },
    { id: 'dir_2', title: 'Chunky sole, played for volume', summary: 'The chunky sole scores high culturally, pulled back to a volume that fits the brand. The new outsole mould, one per size, is the cost to watch — feasibility is the low index here.', signal_ids: ['sg_027', 'sg_042'] },
    { id: 'dir_3', title: 'Soft classic, refined', summary: 'Keeps the classic penny silhouette and improves the fit with suede and a gore panel. Restock signals back this one, so it is the safe axis.', signal_ids: ['sg_042', 'sg_038'] },
  ],
}

export const SERIES_DNA: Record<Category, SeriesDna> = {
  shoe: {
    invariant: [
      { element: 'last_LST-2024-07', label: 'Last LST-2024-07 (almond)', observed_in: 6, of: 6, confidence: 'high', must_inherit: true },
      { element: 'tonal_stitching', label: 'Tonal stitching', observed_in: 5, of: 6, confidence: 'high', must_inherit: true },
    ],
    variable: [
      { element: 'upper_material', label: 'Upper', observed_in: 6, of: 6, confidence: 'high', variation_range: ['nappa', 'suede', 'patent'] },
      { element: 'hardware_finish', label: 'Hardware finish', observed_in: 4, of: 6, confidence: 'medium', variation_range: ['brushed gold', 'silver'] },
    ],
    ambiguous: [
      { element: 'heel_height', label: 'Heel height', observed_in: 6, of: 6, confidence: 'low', observed: [20, 25, 25, 35, 25, 45], note: 'mostly 25mm, one at 45mm, needs a call' },
    ],
  },
}

// 시리즈 모드 · DNA 잠금 필드 (S2 스펙 필드값으로 실제 잠김, 지시서 DoD)
export const DNA_LOCKS: Record<Category, Record<string, string | number>> = {
  shoe: { last_id: 'LST-2024-07', toe_shape: 'almond' },
}

export const DNA_CONFLICT: Record<Category, { brandClaim: string; observed: string }> = {
  shoe: { brandClaim: '"light and flexible, for every day"', observed: 'Goodyear welt in 4 of 6, weight in the upper range' },
}

export const REPORT_BIAS: ReportBias = {
  publisher: 'EU trend research report, 2026 S/S',
  perspective: 'Written from a European contemporary view',
  notes: ['Asia comes up 3 times across 41 sections', '62% of citations are luxury houses', '12 claims name no price band, so they are docked when promoted to signals'],
}

// 컨셉 프롬프트 파싱 예 (지시서 1.2 ⑤)
export const PROMPT_PARSE: Record<Category, { text: string; applied: string[] }> = {
  shoe: { text: 'This season, a firmer and more structural impression', applied: ['heel_type: block|stacked', 'panel_count: +1~2', 'upper: prefer calf 1.6mm', 'mood: structured'] },
}
