// ── 브랜드 아이덴티티 · 어떤 에이전트를 쓰든 결과물에 공통으로 실린다 ──
// 에이전트(트렌드·시리즈·무드보드)의 판단이 우선이지만, 로고와 브랜드 규칙은
// 그 위에 항상 덧씌워진다. 그래서 파이프라인이 아니라 별도 저장소에 둔다.

/** 로고가 실제 제품에 어떻게 올라가는지 · 참고 사진에서 읽어 낸 규칙 */
export interface LogoStyle {
  /** 프롬프트에 그대로 실리는 한 문단. 이게 있으면 렌더가 마크를 형태로 그린다 */
  prompt_clause: string
  /** 어디에 앉는가 · 사람이 읽는 요약 */
  placement_description: string
  /** 크기와 비율 */
  scale_note: string
  /** 어떻게 얹혀 있는가 (스티치·오버레이·프린트·엠보스) */
  integration: string
  /** 색 처리 */
  colour_treatment: string
  /** 참고 사진에서 확인 못 한 것 */
  not_seen: string
  /** 이 규칙을 뽑는 데 쓴 사진 */
  from: { id: string; name: string }[]
}

export interface BrandLogo {
  name: string
  dataUrl: string          // 브라우저에만 두고 서버로 보내지 않는다
  placement: 'none' | 'tongue' | 'heel' | 'side' | 'insole' | 'clasp' | 'pendant'
  scale: 'subtle' | 'normal' | 'bold'
  /** 로고가 이미 적용된 제품 사진 · 서버가 읽고, 배치 규칙을 여기서 뽑는다.
   *  파일 자체는 서버 캐시에 있고 여기에는 손잡이만 둔다. */
  references?: { id: string; name: string; type: string; bytes: number }[]
  /** 참고 사진에서 읽어 낸 배치 규칙. 참고 사진이 없으면 없다. */
  style?: LogoStyle | null
}

/** MD 페르소나 · 디자인을 고르는 사람이 누구인가.
 *
 *  LLM에게 "MD처럼 평가해"라고만 하면 누구에게나 통하는 말을 한다. 실제 MD의 판단은
 *  자기가 책임지는 숫자에서 나온다 — 어느 채널에서 얼마에 팔아야 하고, 재고를 몇 주에
 *  털어야 하고, 지난 시즌에 무엇으로 데었는가. 그래서 아래 항목은 전부 "판단을 가르는 것"만 둔다.
 *  취향 형용사는 넣지 않는다. 그건 이미 브랜드 톤에 있다. */
export interface MdPersona {
  /** 직함과 담당 · 예: 백화점 여성화 바이어 8년차 */
  role: string
  /** 어디서 파는가 · 채널이 다르면 같은 신발도 다르게 팔린다 */
  channel: string
  /** 누구에게 파는가 · 나이·상황까지 구체적으로 */
  customer: string
  /** 무엇으로 평가받는가 · 이 사람의 KPI. 예: 정상판매율 65%, 시즌 소진 12주 */
  kpis: string[]
  /** 얼마에 팔 수 있는가 */
  priceBandKrw: string
  /** 새로운 것에 얼마나 베팅하는가 */
  riskAppetite: 'conservative' | 'balanced' | 'aggressive'
  /** 지난 시즌에 데인 경험 · 이게 없으면 평가가 교과서적으로 흐른다 */
  pastMisses: string[]
  /** 절대 안 사는 것 */
  dealBreakers: string[]
  /** 매장에서 무엇과 나란히 놓이는가 */
  competingOnFloor: string[]
}

export const EMPTY_MD: MdPersona = {
  role: '', channel: '', customer: '', kpis: [], priceBandKrw: '',
  riskAppetite: 'balanced', pastMisses: [], dealBreakers: [], competingOnFloor: [],
}

export interface BrandIdentity {
  brandName: string
  tagline: string
  /** 결과를 고르는 MD · 없으면 선정 단계에서 평가 없이 지표만 나온다 */
  md?: MdPersona | null
  /** 브랜드를 알아보게 하는 조형 요소. 프롬프트에 그대로 실린다 */
  signatureElements: string[]
  /** 절대 하지 않는 것. 위반 시 카드에 경고가 붙는다 */
  forbidden: string[]
  colorPalette: { name: string; hex: string }[]
  materials: string[]
  toneWords: string[]
  logo: BrandLogo | null
  /** 로고를 이미지에 실제로 그릴지. 끄면 프롬프트에서 로고를 명시적으로 배제한다 */
  applyLogoToImages: boolean
}

export const EMPTY_BRAND: BrandIdentity = {
  brandName: '',
  tagline: '',
  signatureElements: [],
  forbidden: [],
  colorPalette: [],
  materials: [],
  toneWords: [],
  logo: null,
  applyLogoToImages: false,
}

const KEY = 'vringon.brand'

export function loadBrand(): BrandIdentity {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_BRAND
    return { ...EMPTY_BRAND, ...JSON.parse(raw) }
  } catch { return EMPTY_BRAND }
}

export function saveBrand(b: BrandIdentity) {
  localStorage.setItem(KEY, JSON.stringify(b))
}

export function isBrandConfigured(b: BrandIdentity): boolean {
  return !!b.brandName.trim() &&
    (b.signatureElements.length > 0 || b.colorPalette.length > 0 || b.materials.length > 0)
}

/** 이미지 프롬프트에 덧붙이는 브랜드 구절.
 *  에이전트가 정한 스펙 뒤에 놓여, 스펙을 덮지 않으면서 브랜드 인상을 얹는다. */
export function brandPromptClause(b: BrandIdentity): string {
  const parts: string[] = []
  if (b.signatureElements.length)
    parts.push(`Brand signature details: ${b.signatureElements.join(', ')}`)
  if (b.colorPalette.length)
    parts.push(`Brand palette: ${b.colorPalette.map(c => `${c.name} ${c.hex}`).join(', ')}`)
  if (b.materials.length)
    parts.push(`Preferred materials: ${b.materials.join(', ')}`)
  if (b.toneWords.length)
    parts.push(`Overall impression: ${b.toneWords.join(', ')}`)

  // 로고를 파일로 얹기만 하면 네모난 판을 붙인 티가 난다. 실제 마크는 패널을 타고 휜다.
  // 그래서 "로고가 적용된 제품 사진"을 올렸으면, 거기서 읽어 낸 형태 묘사를 프롬프트에 싣는다.
  // 상표명은 절대 싣지 않는다 — 이름을 주면 모델이 기억 속의 다른 것을 그린다. 형태만 준다.
  if (b.applyLogoToImages && b.logo && b.logo.placement !== 'none') {
    const where: Record<string, string> = {
      tongue: 'on the tongue', heel: 'on the heel counter', side: 'on the lateral side panel',
      insole: 'on the insole', clasp: 'on the clasp', pendant: 'on the pendant face',
    }
    const size = b.logo.scale === 'subtle' ? 'very small and understated'
      : b.logo.scale === 'bold' ? 'clearly visible' : 'modest'
    if (b.logo.style?.prompt_clause) {
      parts.push(`${b.logo.style.prompt_clause} Render this mark as part of the shoe's construction, following the curve of the panel it sits on. No text, no lettering, no wordmark.`)
    } else {
      parts.push(`Leave a clean unbranded area ${where[b.logo.placement]} for a ${size} brand mark. Do not invent any logo, text, or lettering.`)
    }
  } else {
    parts.push('No logo, no text, no lettering anywhere on the product.')
  }

  if (b.forbidden.length)
    parts.push(`Avoid: ${b.forbidden.join(', ')}`)

  return parts.join('. ')
}

/** 스펙이 브랜드 금지 규칙을 어겼는지 검사한다. 룰 엔진과 별개로 카드에 표시된다. */
export function checkBrandFit(b: BrandIdentity, fields: Record<string, unknown>): string[] {
  const hits: string[] = []
  const hay = Object.values(fields).map(v => String(v).toLowerCase()).join(' ')
  for (const f of b.forbidden) {
    const t = f.trim().toLowerCase()
    if (t && hay.includes(t)) hits.push(f)
  }
  return hits
}
