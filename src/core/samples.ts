// ── S1 샘플 데이터 · 모드·카테고리별 신호/경쟁사/디렉션/DNA (데모용) ──
import type { Category, CompetitorProduct, Direction, Mode, ReportBias, SeriesDna, Signal } from './types'

const SRC = (n: number) => Array.from({ length: n }, (_, i) => `https://observed.example/${1000 + i * 37}`)

export const SIGNALS: Record<Category, Signal[]> = {
  shoe: [
    { signal_id: 'sg_014', attribute: 'square_toe', label: 'Square toe', axis: 'Toe shape', observed_count: 7, sources: SRC(3), price_bands: ['contemporary'], confidence: 'high', direction: 'rising', first_seen: '2026-02', dedup_group: 'dg_003', oem_group: null, sales_proxy_score: 0.72, proxy_confidence: 'medium' },
    { signal_id: 'sg_027', attribute: 'chunky_sole', label: 'Chunky sole', axis: 'Sole thickness', observed_count: 4, sources: SRC(2), price_bands: ['contemporary', 'premium'], confidence: 'medium', direction: 'rising', first_seen: '2026-01', dedup_group: 'dg_007', oem_group: 'oem_2', sales_proxy_score: 0.61, proxy_confidence: 'medium' },
    { signal_id: 'sg_031', attribute: 'low_block_heel', label: 'Low block heel, 25-35mm', axis: 'Heel height band', observed_count: 6, sources: SRC(3), price_bands: ['contemporary'], confidence: 'high', direction: 'stable', first_seen: '2025-11', dedup_group: 'dg_010', oem_group: null, sales_proxy_score: 0.68, proxy_confidence: 'high' },
    { signal_id: 'sg_038', attribute: 'elastic_gore', label: 'Elastic gore closure', axis: 'Closure', observed_count: 3, sources: SRC(2), price_bands: ['mass', 'contemporary'], confidence: 'medium', direction: 'rising', first_seen: '2026-03', dedup_group: 'dg_012', oem_group: null, sales_proxy_score: 0.44, proxy_confidence: 'low' },
    { signal_id: 'sg_042', attribute: 'suede_texture', label: 'Suede upper', axis: 'Upper', observed_count: 5, sources: SRC(3), price_bands: ['contemporary'], confidence: 'medium', direction: 'stable', first_seen: '2025-12', dedup_group: 'dg_015', oem_group: null, sales_proxy_score: 0.57, proxy_confidence: 'medium' },
    { signal_id: 'sg_047', attribute: 'metal_hardware', label: 'Metal hardware accent', axis: 'Hardware', observed_count: 4, sources: SRC(2), price_bands: ['premium'], confidence: 'low', direction: 'rising', first_seen: '2026-04', dedup_group: 'dg_018', oem_group: null, sales_proxy_score: 0.51, proxy_confidence: 'low' },
  ],
  jewelry: [
    { signal_id: 'sg_101', attribute: 'bold_band', label: 'Bold band', axis: 'Form', observed_count: 8, sources: SRC(4), price_bands: ['contemporary'], confidence: 'high', direction: 'rising', first_seen: '2026-01', dedup_group: 'dg_101', oem_group: null, sales_proxy_score: 0.74, proxy_confidence: 'high' },
    { signal_id: 'sg_105', attribute: 'bezel_setting', label: 'Bezel setting', axis: 'Setting', observed_count: 6, sources: SRC(3), price_bands: ['contemporary', 'premium'], confidence: 'high', direction: 'rising', first_seen: '2025-12', dedup_group: 'dg_104', oem_group: null, sales_proxy_score: 0.66, proxy_confidence: 'medium' },
    { signal_id: 'sg_109', attribute: 'mixed_metal', label: 'Mixed metal', axis: 'Metal and colour', observed_count: 4, sources: SRC(2), price_bands: ['premium'], confidence: 'medium', direction: 'rising', first_seen: '2026-02', dedup_group: 'dg_108', oem_group: 'oem_5', sales_proxy_score: 0.58, proxy_confidence: 'medium' },
    { signal_id: 'sg_113', attribute: 'matte_finish', label: 'Matte finish', axis: 'Form', observed_count: 5, sources: SRC(3), price_bands: ['contemporary'], confidence: 'medium', direction: 'stable', first_seen: '2025-11', dedup_group: 'dg_111', oem_group: null, sales_proxy_score: 0.52, proxy_confidence: 'medium' },
    { signal_id: 'sg_118', attribute: 'layering_chain', label: 'Layering chain', axis: 'Layering', observed_count: 5, sources: SRC(2), price_bands: ['mass', 'contemporary'], confidence: 'medium', direction: 'rising', first_seen: '2026-03', dedup_group: 'dg_114', oem_group: null, sales_proxy_score: 0.49, proxy_confidence: 'low' },
    { signal_id: 'sg_121', attribute: 'organic_form', label: 'Organic form', axis: 'Form', observed_count: 3, sources: SRC(2), price_bands: ['premium'], confidence: 'low', direction: 'rising', first_seen: '2026-04', dedup_group: 'dg_117', oem_group: null, sales_proxy_score: 0.46, proxy_confidence: 'low' },
  ],
}

export const COMPETITORS: Record<Category, CompetitorProduct[]> = {
  shoe: [
    { product_id: 'cp_s01', brand: 'Brand A', name: 'Square-toe loafer', price_krw: 258000, sales_proxy_score: 0.72, proxy_signals: ['restock:3', 'sold_out_days:22', 'colorway_expansion:2'], observation_count: 6, observation_window: '2026-01-01~2026-06-30', confidence: 'medium', in_band: true },
    { product_id: 'cp_s02', brand: 'Brand B', name: 'Chunky chain loafer', price_krw: 312000, sales_proxy_score: 0.61, proxy_signals: ['restock:2', 'rank_entry:4'], observation_count: 5, observation_window: '2026-01-01~2026-06-30', confidence: 'medium', in_band: true },
    { product_id: 'cp_s03', brand: 'Brand C', name: 'Classic penny loafer', price_krw: 198000, sales_proxy_score: 0.68, proxy_signals: ['sold_out_days:31', 'no_discount:120d'], observation_count: 7, observation_window: '2026-01-01~2026-06-30', confidence: 'high', in_band: true },
    { product_id: 'cp_s04', brand: 'Brand D', name: 'Suede gore loafer', price_krw: 152000, sales_proxy_score: null, proxy_signals: [], observation_count: 1, observation_window: '2026-06-12, single pass', confidence: 'none', in_band: true },
    { product_id: 'cp_s05', brand: 'Brand E (luxury)', name: 'Horsebit loafer', price_krw: 1290000, sales_proxy_score: null, proxy_signals: [], observation_count: 4, observation_window: '2026-01-01~2026-06-30', confidence: 'medium', in_band: false },
  ],
  jewelry: [
    { product_id: 'cp_j01', brand: 'Brand A', name: 'Bold band ring', price_krw: 148000, sales_proxy_score: 0.74, proxy_signals: ['restock:4', 'colorway_expansion:1'], observation_count: 8, observation_window: '2026-01-01~2026-06-30', confidence: 'high', in_band: true },
    { product_id: 'cp_j02', brand: 'Brand B', name: 'Bezel solitaire', price_krw: 220000, sales_proxy_score: 0.66, proxy_signals: ['sold_out_days:18', 'rank_entry:3'], observation_count: 5, observation_window: '2026-01-01~2026-06-30', confidence: 'medium', in_band: true },
    { product_id: 'cp_j03', brand: 'Brand C', name: 'Mixed-metal ear cuff', price_krw: 96000, sales_proxy_score: 0.58, proxy_signals: ['restock:2'], observation_count: 4, observation_window: '2026-02-01~2026-06-30', confidence: 'medium', in_band: true },
    { product_id: 'cp_j04', brand: 'Brand D', name: 'Pave chain bracelet', price_krw: 340000, sales_proxy_score: null, proxy_signals: [], observation_count: 1, observation_window: '2026-05-20, single pass', confidence: 'none', in_band: true },
  ],
}

export const DIRECTIONS: Record<Category, Direction[]> = {
  shoe: [
    { id: 'dir_1', title: 'Square toe with a low block heel', summary: 'The two strongest signals in this band, combined. It runs on the existing LST-2024-11 last, so development stays cheap.', signal_ids: ['sg_014', 'sg_031'] },
    { id: 'dir_2', title: 'Chunky sole, played for volume', summary: 'The chunky sole scores high on the proxy, pulled back to a volume that fits the brand. The new outsole mould, one per size, is the cost to watch.', signal_ids: ['sg_027', 'sg_042'] },
    { id: 'dir_3', title: 'Soft classic, refined', summary: 'Keeps the classic penny silhouette and improves the fit with suede and a gore panel. Restock signals back this one, so it is the safe axis.', signal_ids: ['sg_042', 'sg_038'] },
  ],
  jewelry: [
    { id: 'dir_1', title: 'Bold band with a bezel', summary: 'The top two rising signals together. Start where an existing mould can be modified.', signal_ids: ['sg_101', 'sg_105'] },
    { id: 'dir_2', title: 'Matte mixed metal', summary: 'Differentiates on finish contrast. The extra plating step has to be absorbed inside the cap.', signal_ids: ['sg_109', 'sg_113'] },
    { id: 'dir_3', title: 'Layering system', summary: 'Built to combine rather than stand alone. Standardising the chain spec keeps SKU count down.', signal_ids: ['sg_118', 'sg_101'] },
  ],
}

export const SERIES_DNA: Record<Category, SeriesDna> = {
  jewelry: {
    invariant: [
      { element: 'signature_bezel_edge', label: 'Signature bezel edge', observed_in: 7, of: 8, confidence: 'high', must_inherit: true },
      { element: 'band_width_ratio_0.18', label: 'Band width ratio 0.18', observed_in: 8, of: 8, confidence: 'high', must_inherit: true },
    ],
    variable: [
      { element: 'stone_color', label: 'Stone colour', observed_in: 8, of: 8, confidence: 'high', variation_range: ['clear', 'champagne', 'smoky'] },
      { element: 'finish', label: 'Finish', observed_in: 8, of: 8, confidence: 'medium', variation_range: ['polished', 'matte'] },
    ],
    ambiguous: [
      { element: 'prong_count', label: 'Prong count', observed_in: 4, of: 4, confidence: 'low', observed: [4, 4, 6, 4], note: 'needs a call' },
    ],
  },
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
  jewelry: { setting_type: 'bezel', min_wall_thickness_mm: 0.9 },
  shoe: { last_id: 'LST-2024-07', toe_shape: 'almond' },
}

export const DNA_CONFLICT: Record<Category, { brandClaim: string; observed: string }> = {
  jewelry: { brandClaim: '"minimal and restrained"', observed: '9 stones on average, pave setting in 6 of 8' },
  shoe: { brandClaim: '"light and flexible, for every day"', observed: 'Goodyear welt in 4 of 6, weight in the upper range' },
}

export const REPORT_BIAS: ReportBias = {
  publisher: 'EU trend research report, 2026 S/S',
  perspective: 'Written from a European contemporary view',
  notes: ['Asia comes up 3 times across 41 sections', '62% of citations are luxury houses', '12 claims name no price band, so they are docked when promoted to signals'],
}

// 컨셉 프롬프트 파싱 예 (지시서 1.2 ⑤)
export const PROMPT_PARSE: Record<Category, { text: string; applied: string[] }> = {
  jewelry: { text: 'This season, bolder and more masculine, matte materials', applied: ['target_weight_g: +30~50%', 'finish: matte|brushed', 'band_width: increase', 'mood: bold, masculine'] },
  shoe: { text: 'This season, a firmer and more structural impression', applied: ['heel_type: block|stacked', 'panel_count: +1~2', 'upper: prefer calf 1.6mm', 'mood: structured'] },
}
