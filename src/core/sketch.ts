// ── 파라메트릭 스케치/렌더 SVG · 스펙이 먼저, 이미지가 나중 (지시서 5장)
// 스톤 수·프롱 수·힐 높이·토 셰이프·패널 수가 실제 도형에 반영된다.
import type { DesignSpec } from './types'

export type ViewKey = 'front' | 'q45' | 'detail' | 'lateral' | 'q34' | 'top' | 'outsole' | 'wear'
export type RenderMode = 'sketch' | 'render'

const COLORWAY_HUES: Record<string, [string, string]> = {
  original: ['#C9CDD6', '#9AA0AD'],
  gold: ['#D9B96C', '#A8833B'],
  black: ['#4A4A52', '#26262C'],
  bordeaux: ['#9C5560', '#6B3540'],
  ivory: ['#E4DECE', '#B5AD97'],
}
export const COLORWAY_NAMES = Object.keys(COLORWAY_HUES).filter(k => k !== 'original')

function svgWrap(inner: string, mode: RenderMode): string {
  const bg = mode === 'sketch' ? '#F5F4F0' : '#FAFAF8'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="${bg}"/>${inner}</svg>`
}

function stroke(mode: RenderMode) {
  return mode === 'sketch'
    ? `fill="none" stroke="#3A3A40" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`
    : `stroke="#2E2E33" stroke-width="0.8" stroke-linejoin="round"`
}

// ════════ 주얼리 ════════
function ringSVG(f: Record<string, any>, mode: RenderMode, view: ViewKey, cw: string): string {
  const [hi, lo] = COLORWAY_HUES[cw] ?? COLORWAY_HUES.original
  const s = stroke(mode)
  const stones = Math.min(18, Number(f.stone_count) || 1)
  const stoneR = Math.max(2.5, Math.min(8, Number(f.stone_size_mm) * 1.8))
  const bandW = f.setting_type === 'bezel' ? 9 : 7
  const fill = mode === 'render' ? `fill="url(#m)"` : 'fill="none"'
  const defs = mode === 'render' ? `<defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>` : ''
  let stonesSvg = ''
  const cx = 100, cy = view === 'detail' ? 120 : 78
  if (stones === 1) {
    stonesSvg = gem(cx, cy - 26, stoneR * 2.2, mode, hi)
    if (f.setting_type === 'prong') {
      const pc = Number(f.prong_count) || 4
      for (let i = 0; i < pc; i++) {
        const a = (i / pc) * Math.PI * 2 - Math.PI / 2
        stonesSvg += `<line x1="${cx + Math.cos(a) * stoneR * 2.4}" y1="${cy - 26 + Math.sin(a) * stoneR * 2.4}" x2="${cx + Math.cos(a) * stoneR * 3.1}" y2="${cy - 26 + Math.sin(a) * stoneR * 3.1}" ${s}/>`
      }
    } else if (f.setting_type === 'bezel') {
      stonesSvg += `<circle cx="${cx}" cy="${cy - 26}" r="${stoneR * 2.6}" ${s} fill="none"/>`
    }
  } else {
    // 멀티스톤: 링 상단 아크에 배열 (halo/pave)
    const arcR = 34
    for (let i = 0; i < stones; i++) {
      const a = Math.PI * (0.15 + 0.7 * (i / Math.max(1, stones - 1))) + Math.PI
      stonesSvg += gem(cx + Math.cos(a) * arcR, cy + 20 + Math.sin(a) * arcR, Math.max(2.2, stoneR), mode, hi)
    }
  }
  const scale = view === 'detail' ? 'scale(1.45) translate(-31,-38)' : view === 'q45' ? 'scale(1 .78) translate(0 28)' : ''
  return svgWrap(`${defs}<g transform="${scale}">
    <ellipse cx="100" cy="112" rx="42" ry="46" ${s} ${fill}/>
    <ellipse cx="100" cy="112" rx="${42 - bandW}" ry="${46 - bandW}" ${s} fill="${mode === 'render' ? '#FAFAF8' : 'none'}"/>
    ${stonesSvg}</g>`, mode)
}

function gem(x: number, y: number, r: number, mode: RenderMode, hue: string): string {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    return `${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`
  }).join(' ')
  const fill = mode === 'render' ? `fill="#EDF2F7" stroke="${hue}" stroke-width="0.8"` : `fill="none" stroke="#3A3A40" stroke-width="1.2"`
  return `<polygon points="${pts}" ${fill}/><line x1="${x - r * 0.5}" y1="${y - r * 0.4}" x2="${x + r * 0.5}" y2="${y + r * 0.4}" stroke="${mode === 'render' ? hue : '#3A3A40'}" stroke-width="0.6"/>`
}

function earringSVG(f: Record<string, any>, mode: RenderMode, view: ViewKey, cw: string): string {
  const [hi, lo] = COLORWAY_HUES[cw] ?? COLORWAY_HUES.original
  const s = stroke(mode)
  const stones = Math.min(9, Number(f.stone_count) || 1)
  const defs = mode === 'render' ? `<defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>` : ''
  const fill = mode === 'render' ? `fill="url(#m)"` : 'fill="none"'
  const one = (ox: number) => {
    let drop = ''
    for (let i = 0; i < stones; i++) {
      const t = i / Math.max(1, stones - 1)
      drop += gem(ox, 78 + t * 62, Math.max(2.4, 6 - t * 3), mode, hi)
    }
    return `<circle cx="${ox}" cy="58" r="9" ${s} ${fill}/>
      <line x1="${ox}" y1="67" x2="${ox}" y2="74" ${s}/>${drop}`
  }
  // 페어: 좌우 2개 (지시서 6.5 · 페어 일관성)
  return svgWrap(`${defs}${one(70)}${view === 'detail' ? '' : one(130)}`, mode)
}

function necklaceSVG(f: Record<string, any>, mode: RenderMode, view: ViewKey, cw: string): string {
  const [hi, lo] = COLORWAY_HUES[cw] ?? COLORWAY_HUES.original
  const s = stroke(mode)
  const stones = Math.min(16, Number(f.stone_count) || 1)
  const defs = mode === 'render' ? `<defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>` : ''
  // 체인: 링크 반복
  let chain = ''
  const links = 26
  for (let i = 0; i <= links; i++) {
    const t = i / links
    const x = 30 + t * 140
    const y = 40 + Math.sin(t * Math.PI) * 52
    chain += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" ${s} fill="none"/>`
  }
  let pend = ''
  if (stones === 1) pend = gem(100, 118, 9, mode, hi)
  else {
    // halo 펜던트
    pend = gem(100, 118, 6.5, mode, hi)
    for (let i = 0; i < Math.min(stones - 1, 14); i++) {
      const a = (i / Math.min(stones - 1, 14)) * Math.PI * 2
      pend += gem(100 + Math.cos(a) * 14, 118 + Math.sin(a) * 14, 2.8, mode, hi)
    }
  }
  pend += `<path d="M100 96 L96 104 L104 104 Z" ${s} ${mode === 'render' ? `fill="url(#m)"` : ''}/>`
  return svgWrap(`${defs}${chain}${pend}`, mode)
}

function braceletSVG(f: Record<string, any>, mode: RenderMode, view: ViewKey, cw: string): string {
  const [hi, lo] = COLORWAY_HUES[cw] ?? COLORWAY_HUES.original
  const s = stroke(mode)
  const stones = Math.min(12, Number(f.stone_count) || 0)
  const defs = mode === 'render' ? `<defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>` : ''
  const fill = mode === 'render' ? `fill="url(#m)"` : 'fill="none"'
  let st = ''
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2
    st += gem(100 + Math.cos(a) * 52, 100 + Math.sin(a) * 44, 3, mode, hi)
  }
  return svgWrap(`${defs}
    <ellipse cx="100" cy="100" rx="58" ry="50" ${s} ${fill}/>
    <ellipse cx="100" cy="100" rx="46" ry="38" ${s} fill="${mode === 'render' ? '#FAFAF8' : 'none'}"/>
    ${st}<rect x="94" y="44" width="12" height="10" rx="3" ${s} ${fill}/>`, mode)
}

// ════════ 신발 (lateral 기준 · 지시서 7.6) ════════
function shoeSVG(spec: DesignSpec, mode: RenderMode, view: ViewKey, cw: string): string {
  const f = spec.fields as Record<string, any>
  const [hi, lo] = COLORWAY_HUES[cw] ?? COLORWAY_HUES.original
  const s = stroke(mode)
  const heelMm = Number(f.heel_height_mm) || 20
  const heelPx = Math.min(58, 6 + heelMm * 0.62)          // mm → px 스케일 기준선
  const ground = 158
  const toe = String(f.toe_shape)
  const panels = Number(f.panel_count) || 4
  const defs = mode === 'render' ? `<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>` : ''
  const fill = mode === 'render' ? `fill="url(#m)"` : 'fill="none"'

  if (view === 'top') {
    // top-down: 토 셰이프·오프닝
    const toePath = toe === 'square' ? 'L166 84 L166 116' : toe === 'pointed' ? 'Q176 100 166 104 L166 96' : toe === 'round' ? 'Q178 100 166 112' : 'Q174 92 174 100 Q174 108 166 110'
    return svgWrap(`${defs}<path d="M34 100 Q34 80 60 78 L150 82 ${toePath} L150 118 Q60 122 34 100 Z" ${s} ${fill}/>
      <ellipse cx="78" cy="100" rx="26" ry="13" ${s} fill="${mode === 'render' ? '#F1EFE9' : 'none'}"/>
      ${f.closure === 'strap' ? `<rect x="104" y="86" width="8" height="28" rx="2" ${s} ${fill}/>` : ''}`, mode)
  }
  if (view === 'outsole') {
    let tread = ''
    for (let i = 0; i < 7; i++) tread += `<line x1="${52 + i * 16}" y1="86" x2="${48 + i * 16}" y2="114" ${s}/>`
    return svgWrap(`${defs}<path d="M36 100 Q36 78 64 76 L152 80 Q176 88 176 100 Q176 112 152 120 L64 124 Q36 122 36 100 Z" ${s} ${fill}/>${tread}
      <ellipse cx="58" cy="100" rx="14" ry="16" ${s} fill="none"/>`, mode)
  }

  const athletic = f.heel_type === 'sport_midsole'
  const shaft = Number(f.shaft_height_mm) || 0
  const open = ['strap_sandal', 'slide', 'gladiator'].includes(spec.itemType)

  // 운동화 · 두꺼운 미드솔 + 아웃솔, 힐 블록 없음
  if (athletic) {
    const stack = Math.min(46, 10 + heelMm * 0.55)
    const topY2 = ground - stack - 42
    let lace = ''
    for (let i = 0; i < 5; i++) {
      const x = 84 + i * 13
      lace += `<line x1="${x}" y1="${topY2 + 12 + i * 3}" x2="${x + 11}" y2="${topY2 + 6 + i * 3}" ${s}/>`
    }
    let panelL = ''
    for (let i = 1; i < Math.min(panels, 8); i++) {
      const x = 62 + (i / panels) * 96
      panelL += `<path d="M${x} ${topY2 + 16 + i * 2} Q${x + 6} ${ground - stack - 12} ${x - 4} ${ground - stack - 2}" stroke="${mode === 'render' ? '#00000030' : '#3A3A40'}" stroke-width=".9" fill="none"/>`
    }
    return svgWrap(`${defs}
      <path d="M30 ${ground - stack - 8} Q28 ${topY2 + 10} 58 ${topY2 + 2} Q92 ${topY2 - 6} 118 ${topY2 + 10} Q152 ${topY2 + 26} 172 ${ground - stack - 6} L30 ${ground - stack - 8} Z" ${s} ${fill}/>
      <path d="M26 ${ground - stack} Q24 ${ground - 6} 44 ${ground - 2} L166 ${ground - 2} Q180 ${ground - 8} 176 ${ground - stack} Z" ${s} ${mode === 'render' ? 'fill="#E9E7E1"' : 'fill="none"'}/>
      <path d="M26 ${ground - stack * 0.42} L176 ${ground - stack * 0.42}" ${s}/>
      <line x1="20" y1="${ground}" x2="192" y2="${ground}" stroke="${mode === 'sketch' ? '#B9B7AF' : '#D8D5CC'}" stroke-width="1" stroke-dasharray="3 4"/>
      ${panelL}${lace}
      <ellipse cx="74" cy="${topY2 + 12}" rx="20" ry="7" ${s} fill="${mode === 'render' ? '#F1EFE9' : 'none'}"/>
      <text x="8" y="${ground - stack / 2}" font-size="7" fill="#8A8880" font-family="monospace">${heelMm}mm</text>`, mode)
  }

  // 샌들 · 갑피 대신 스트랩
  if (open) {
    const h = Math.min(52, 6 + heelMm * 0.6)
    let straps = ''
    const n = Math.max(1, Math.min(panels, 5))
    for (let i = 0; i < n; i++) {
      const x = 92 + i * 18
      straps += `<path d="M${x} ${ground - h - 6} Q${x + 6} ${ground - h - 22} ${x + 16} ${ground - h - 8}" ${s} fill="none"/>`
    }
    const hb = 26
    return svgWrap(`${defs}
      <path d="M40 ${ground - h - 4} Q60 ${ground - h - 10} 100 ${ground - h - 9} Q150 ${ground - h - 8} 178 ${ground - h - 2} L176 ${ground - h + 4} Q120 ${ground - h + 2} 42 ${ground - h + 2} Z" ${s} ${fill}/>
      <path d="M${hb + 4} ${ground - h} L${hb + 8} ${ground} L${hb + 28} ${ground} L${hb + 30} ${ground - h}" ${s} ${fill}/>
      ${straps}
      <line x1="20" y1="${ground}" x2="192" y2="${ground}" stroke="${mode === 'sketch' ? '#B9B7AF' : '#D8D5CC'}" stroke-width="1" stroke-dasharray="3 4"/>
      <text x="8" y="${ground - h / 2}" font-size="7" fill="#8A8880" font-family="monospace">${heelMm}mm</text>`, mode)
  }

  // lateral / q34: 실루엣 · 토 형상과 힐 높이 반영
  const toeTip = toe === 'square' ? `L182 ${ground - 14} L182 ${ground - 2}` :
    toe === 'pointed' ? `Q192 ${ground - 8} 184 ${ground - 2}` :
    toe === 'round' ? `Q188 ${ground - 16} 180 ${ground - 2}` :
    `Q186 ${ground - 12} 180 ${ground - 2}`   // almond
  const topY = ground - heelPx - 34
  const heelBack = 26
  const heelShape = f.heel_type === 'stiletto'
    ? `M${heelBack + 10} ${ground - heelPx} L${heelBack + 14} ${ground} L${heelBack + 20} ${ground} L${heelBack + 22} ${ground - heelPx}`
    : `M${heelBack + 4} ${ground - heelPx} L${heelBack + 8} ${ground} L${heelBack + 30} ${ground} L${heelBack + 32} ${ground - heelPx}`
  // 갑피 패널 라인 (panel_count 반영)
  let panelLines = ''
  for (let i = 1; i < Math.min(panels, 8); i++) {
    const x = 60 + (i / panels) * 100
    panelLines += `<path d="M${x} ${topY + 10 + i * 1.5} Q${x + 8} ${ground - heelPx - 10} ${x - 6} ${ground - 8}" stroke="${mode === 'render' ? '#00000030' : '#3A3A40'}" stroke-width="0.9" fill="none"/>`
  }
  const closure = f.closure === 'strap'
    ? `<path d="M96 ${topY + 6} L120 ${topY + 2}" ${s}/><circle cx="122" cy="${topY + 2}" r="2.6" ${s} fill="none"/>`
    : f.closure === 'elastic_gore'
      ? `<path d="M92 ${topY + 8} l10 -3 l0 12 l-10 3 Z" ${s} fill="${mode === 'render' ? '#3B3B42' : 'none'}"/>`
      : f.closure === 'buckle' ? `<rect x="108" y="${topY + 2}" width="12" height="8" rx="2" ${s} fill="none"/>` : ''
  const skew = view === 'q34' ? `transform="translate(12 0) scale(.92 1) skewX(-6)"` : ''
  // 부츠 · 목높이만큼 갑피가 위로 올라간다
  const shaftPx = Math.min(96, shaft * 0.26)
  const shaftSvg = shaftPx > 4
    ? `<path d="M${heelBack} ${topY + 6} L${heelBack - 2} ${topY - shaftPx} Q${heelBack + 26} ${topY - shaftPx - 8} ${heelBack + 54} ${topY - shaftPx + 2} L${heelBack + 52} ${topY + 12} Z" ${s} ${fill}/>`
    : ''
  return svgWrap(`${defs}<g ${skew}>
    ${shaftSvg}
    <path d="M${heelBack} ${ground - heelPx - 6} Q${heelBack - 4} ${topY + 14} ${heelBack + 22} ${topY} Q70 ${topY - 8} 96 ${topY + 4} Q140 ${topY + 14} 168 ${ground - 22} ${toeTip} L${heelBack + 8} ${ground - heelPx} Z" ${s} ${fill}/>
    <path d="${heelShape}" ${s} ${fill}/>
    <path d="M${heelBack + 6} ${ground - heelPx} L178 ${ground - 4}" ${s}/>
    <line x1="20" y1="${ground}" x2="192" y2="${ground}" stroke="${mode === 'sketch' ? '#B9B7AF' : '#D8D5CC'}" stroke-width="1" stroke-dasharray="3 4"/>
    ${panelLines}${closure}
    <ellipse cx="86" cy="${topY + 10}" rx="22" ry="7" ${s} fill="${mode === 'render' ? '#F1EFE9' : 'none'}"/>
  </g>
  <text x="8" y="${ground - heelPx / 2}" font-size="7" fill="#8A8880" font-family="monospace">${heelMm}mm</text>
  <line x1="16" y1="${ground}" x2="16" y2="${ground - heelPx}" stroke="#8A8880" stroke-width="0.8"/>`, mode)
}

// 세부 품목 → 도식 계열
const JEWEL_SHAPE: Record<string, 'ring' | 'earring' | 'necklace' | 'bracelet'> = {
  band_ring: 'ring', solitaire: 'ring', eternity: 'ring', signet: 'ring',
  stud: 'earring', hoop: 'earring', drop: 'earring', ear_cuff: 'earring',
  pendant: 'necklace', choker: 'necklace', chain_necklace: 'necklace', station: 'necklace', anklet: 'necklace',
  bangle: 'bracelet', chain_bracelet: 'bracelet', cuff: 'bracelet', tennis: 'bracelet', brooch: 'bracelet',
}

export function designSVG(spec: DesignSpec, mode: RenderMode, view: ViewKey, colorway = 'original'): string {
  if (spec.category === 'shoe') return shoeSVG(spec, mode, view === 'front' ? 'lateral' : view, colorway)
  const f = spec.fields as Record<string, any>
  switch (JEWEL_SHAPE[spec.itemType] ?? 'ring') {
    case 'ring': return ringSVG(f, mode, view, colorway)
    case 'earring': return earringSVG(f, mode, view, colorway)
    case 'necklace': return necklaceSVG(f, mode, view, colorway)
    default: return braceletSVG(f, mode, view, colorway)
  }
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
