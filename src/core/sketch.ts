// ── 파라메트릭 스케치/렌더 SVG · 스펙이 먼저, 이미지가 나중 (지시서 5장)
// 힐 높이·토 셰이프·패널 수·목높이가 실제 도형에 반영된다. 신발 전용이다.
import type { DesignSpec } from './types'

export type ViewKey = 'lateral' | 'medial' | 'q34' | 'top' | 'outsole' | 'rear' | 'front' | 'wear'
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

// ════════ 신발 (lateral 기준 · 지시서 7.6) ════════
const OPEN_TYPES = ['strap_sandal', 'slide', 'gladiator', 'sport_sandal']

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
  if (view === 'rear') {
    // 후면: 힐 블록·시트·톱라인 (힐 계열·부츠에서 본다)
    const shaftMm = Number(f.shaft_height_mm) || 0
    const shaftPx = Math.min(80, shaftMm * 0.2)
    const topY = ground - heelPx - 52 - shaftPx
    const heelW = f.heel_type === 'stiletto' ? 7 : 22
    return svgWrap(`${defs}
      <path d="M78 ${ground - heelPx} Q76 ${topY + 16} 84 ${topY + 4} Q100 ${topY - 4} 116 ${topY + 4} Q124 ${topY + 16} 122 ${ground - heelPx} Z" ${s} ${fill}/>
      <path d="M${100 - heelW / 2} ${ground - heelPx} L${100 - heelW / 2 + 2} ${ground} L${100 + heelW / 2 - 2} ${ground} L${100 + heelW / 2} ${ground - heelPx} Z" ${s} ${fill}/>
      <line x1="60" y1="${ground}" x2="140" y2="${ground}" stroke="${mode === 'sketch' ? '#B9B7AF' : '#D8D5CC'}" stroke-width="1" stroke-dasharray="3 4"/>
      <text x="146" y="${ground - heelPx / 2}" font-size="7" fill="#8A8880" font-family="monospace">${heelMm}mm</text>`, mode)
  }

  const athletic = f.heel_type === 'sport_midsole'
  const shaft = Number(f.shaft_height_mm) || 0
  const open = OPEN_TYPES.includes(spec.itemType)
  // medial은 lateral의 좌우 반전이다 · 토가 오른쪽을 본다
  const mirror = view === 'medial' ? `transform="translate(200 0) scale(-1 1)"` : ''

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
    return svgWrap(`${defs}<g ${mirror}>
      <path d="M30 ${ground - stack - 8} Q28 ${topY2 + 10} 58 ${topY2 + 2} Q92 ${topY2 - 6} 118 ${topY2 + 10} Q152 ${topY2 + 26} 172 ${ground - stack - 6} L30 ${ground - stack - 8} Z" ${s} ${fill}/>
      <path d="M26 ${ground - stack} Q24 ${ground - 6} 44 ${ground - 2} L166 ${ground - 2} Q180 ${ground - 8} 176 ${ground - stack} Z" ${s} ${mode === 'render' ? 'fill="#E9E7E1"' : 'fill="none"'}/>
      <path d="M26 ${ground - stack * 0.42} L176 ${ground - stack * 0.42}" ${s}/>
      ${panelL}${lace}
      <ellipse cx="74" cy="${topY2 + 12}" rx="20" ry="7" ${s} fill="${mode === 'render' ? '#F1EFE9' : 'none'}"/></g>
      <line x1="20" y1="${ground}" x2="192" y2="${ground}" stroke="${mode === 'sketch' ? '#B9B7AF' : '#D8D5CC'}" stroke-width="1" stroke-dasharray="3 4"/>
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
    return svgWrap(`${defs}<g ${mirror}>
      <path d="M40 ${ground - h - 4} Q60 ${ground - h - 10} 100 ${ground - h - 9} Q150 ${ground - h - 8} 178 ${ground - h - 2} L176 ${ground - h + 4} Q120 ${ground - h + 2} 42 ${ground - h + 2} Z" ${s} ${fill}/>
      <path d="M${hb + 4} ${ground - h} L${hb + 8} ${ground} L${hb + 28} ${ground} L${hb + 30} ${ground - h}" ${s} ${fill}/>
      ${straps}</g>
      <line x1="20" y1="${ground}" x2="192" y2="${ground}" stroke="${mode === 'sketch' ? '#B9B7AF' : '#D8D5CC'}" stroke-width="1" stroke-dasharray="3 4"/>
      <text x="8" y="${ground - h / 2}" font-size="7" fill="#8A8880" font-family="monospace">${heelMm}mm</text>`, mode)
  }

  // lateral / medial / q34: 실루엣 · 토 형상과 힐 높이 반영
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
  const skew = view === 'q34' ? `transform="translate(12 0) scale(.92 1) skewX(-6)"` : mirror
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

export function designSVG(spec: DesignSpec, mode: RenderMode, view: ViewKey, colorway = 'original'): string {
  // 알 수 없는 뷰 키는 기준(lateral)으로 그린다 · 옛 저장본의 'front' 포함
  const v: ViewKey = (['lateral', 'medial', 'q34', 'top', 'outsole', 'rear'] as ViewKey[]).includes(view) ? view : 'lateral'
  return shoeSVG(spec, mode, v, colorway)
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
