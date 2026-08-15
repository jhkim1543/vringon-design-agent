// ── 실제 리서치 — OpenAI Responses API + web_search · 신발 전용 ────────
// 사용자가 입력한 경쟁 라인을 실제로 검색해서 최근 제품과 인기 근거를 수집한다.
// 판매 프록시는 여기서 만들지 않는다. 1회 검색으로는 시계열이 성립하지 않기 때문이다.
// FootwearLineProfile이 검색어·필터·캐시 키 전부를 관통한다 (지시서 22장).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { researchDossier } from './dossier-api.mjs'
import { familyLens, familyOf, typeLens } from './category-templates.mjs'
import { resolveMarkets, retailClause, searchClause, sourceQuota, userLocation } from './markets.mjs'

export const RESEARCH_MODEL = 'gpt-5'
// 딥리서치 · 계정에서 열리면 .env에 OPENAI_DEEP_RESEARCH=1 을 넣어 켠다.
// 같은 API 키를 쓰며 별도 키가 필요 없다. 모델이 없으면 자동으로 기본 경로로 되돌아간다.
export const DEEP_MODEL_DEFAULT = 'o3-deep-research'
const DEEP_POLL_MS = 10_000
const DEEP_MAX_WAIT_MS = 15 * 60 * 1000

const COMPETITOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['products', 'notes'],
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['brand', 'brand_line', 'model_name', 'price_krw', 'price_local', 'price_currency', 'released', 'popularity_evidence', 'evidence_strength',
          'rank_note', 'rank_semantics', 'competitor_group', 'construction_tier',
          'user_sentiment', 'praise_points', 'complaint_points', 'design_traits',
          'offered_sizes', 'available_sizes', 'size_status', 'colorway_count',
          'image_urls', 'product_url', 'source_urls'],
        properties: {
          brand: { type: 'string' },
          brand_line: { type: 'string', description: '브랜드 안의 라인·컬렉션. 예: Performance Running, Lifestyle, Court. 모르면 빈 문자열' },
          model_name: { type: 'string', description: '모델 패밀리 이름. 컬러웨이 하나하나를 별개 제품으로 내지 말 것' },
          price_krw: { type: 'integer', description: '한국 정가를 실제로 확인했을 때만. 환율로 어림한 값 금지. 모르면 0' },
          price_local: { type: 'number', description: '홈 시장 현지 정가. 환산하지 말고 본 그대로. 모르면 0' },
          price_currency: { type: 'string', description: '현지 정가의 통화 ISO 코드 (KRW·USD·JPY 등). 모르면 빈 문자열' },
          released: { type: 'string', description: '출시 시점. 모르면 unknown' },
          popularity_evidence: {
            type: 'array', items: { type: 'string' },
            description: '베스트셀러 선정·어워드·품절·재입고 등 관측된 근거. 추측 금지',
          },
          evidence_strength: { type: 'string', enum: ['strong', 'moderate', 'weak', 'none'] },
          rank_note: { type: 'string', description: '판매 순위·랭킹 표기를 확인했으면 그대로 인용. 없으면 빈 문자열' },
          rank_semantics: {
            type: 'string', enum: ['verified_sales_rank', 'retailer_bestseller_membership', 'surface_position', 'marketplace_trade_rank', 'none'],
            description: '그 순위가 무엇인지. 페이지 노출 위치(surface_position)를 판매 순위로 표기하면 안 된다',
          },
          competitor_group: {
            type: 'string', enum: ['direct', 'commercial_leader', 'technical_authority', 'heritage_authority', 'directional_designer', 'aspirational', 'adjacent'],
            description: '요청된 라인 프로필과의 관계. 공법·가격·용도가 다르면 제외하지 말고 aspirational/adjacent로 분류한다',
          },
          construction_tier: { type: 'string', description: '공법·기술 티어. 예: mass cemented, contemporary cemented, premium blake, goodyear welt, supercritical+plate' },
          user_sentiment: { type: 'string', enum: ['positive', 'mixed', 'negative', 'unknown'] },
          praise_points: { type: 'array', items: { type: 'string' }, description: '리뷰에서 반복되는 칭찬. 확인한 것만' },
          complaint_points: { type: 'array', items: { type: 'string' }, description: '리뷰에서 반복되는 불만. 핏·폭·힐 슬립·토 압박을 특히 살핀다' },
          design_traits: { type: 'array', items: { type: 'string' }, description: '눈에 보이는 디자인 특징 (실루엣·라스트 볼륨·솔 구조·소재·클로저)' },
          offered_sizes: { type: 'integer', description: '판매 페이지에 표시된 사이즈 수. 확인 못 하면 0' },
          available_sizes: { type: 'integer', description: '그중 지금 구매 가능한 사이즈 수. 확인 못 하면 -1' },
          size_status: { type: 'string', enum: ['full', 'partial', 'size_broken', 'sold_out', 'unknown'], description: '핵심 사이즈가 빠져 있으면 size_broken' },
          colorway_count: { type: 'integer', description: '이 모델의 컬러웨이 수. 컬러웨이는 별개 디자인이 아니다. 모르면 0' },
          image_urls: { type: 'array', items: { type: 'string' }, description: '제품 사진 직링크. 모든 제품에 최소 1개 필수. 상세 페이지의 og:image 메타 태그 값이 가장 확실하다' },
          product_url: { type: 'string', description: '제품 상세 페이지 URL' },
          source_urls: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    notes: { type: 'string', description: '수집 한계와 확인하지 못한 항목' },
  },
}

const IDX = { type: 'string', enum: ['high', 'medium', 'low', 'none'] }
const TREND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['signals', 'report_perspective', 'notes'],
  properties: {
    signals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'axis', 'attribute', 'direction', 'observed_count', 'evidence', 'source_urls', 'source_tiers', 'confidence',
          'co_occurring', 'commercial_index', 'cultural_index', 'forecast_index', 'feasibility_index',
          'adoption_stage', 'last_change', 'bottom_tooling_change', 'upper_pattern_change'],
        properties: {
          label: { type: 'string', description: 'Signal name, in the requested output language' },
          axis: { type: 'string', description: 'Attribute axis, in the requested output language (e.g. Toe shape, Sole thickness, Midsole and plate)' },
          attribute: { type: 'string', description: '영문 속성 키 (snake_case)' },
          direction: { type: 'string', enum: ['rising', 'stable', 'declining'] },
          observed_count: { type: 'integer', description: '서로 다른 출처에서 확인된 횟수' },
          evidence: { type: 'array', items: { type: 'string' } },
          source_urls: { type: 'array', items: { type: 'string' } },
          source_tiers: {
            type: 'array', items: { type: 'string', enum: ['T1', 'T2', 'T3', 'T4'] },
            description: 'source_urls와 같은 순서·같은 길이. T1 산업 공인(WGSN·전시회 공식·업계 리포트) / T2 검증된 시장 신호(리테일러 랭킹·재고·베스트셀러 지면) / T3 전문 매체(트레이드 프레스) / T4 소셜·블로그·UGC',
          },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          co_occurring: {
            type: 'array', items: { type: 'string' },
            description: '함께 관측되는 속성 묶음. "청키 러닝화" 같은 뭉툭한 신호 금지 — high stack, wide platform, moderate rocker처럼 공존 속성으로 쪼갠다',
          },
          commercial_index: { ...IDX, description: '실제 판매·베스트셀러·재고·반복 출시 근거의 세기' },
          cultural_index: { ...IDX, description: '검색·소셜·리세일·스타일링 근거의 세기' },
          forecast_index: { ...IDX, description: '전시회·소재 트렌드·신진 브랜드·전문 전망 근거의 세기' },
          feasibility_index: { ...IDX, description: '라스트·몰드·패턴·시험·원가 실현성. 신규 아웃솔 몰드가 필요하면 낮다' },
          adoption_stage: { type: 'string', enum: ['emerging', 'growing', 'established', 'declining', 'unknown'], description: '1회 수집이면 상승·하락 판정 대신 unknown이 정직하다' },
          last_change: { type: 'string', enum: ['not_required', 'modification', 'required', 'unknown'], description: '이 신호를 실행할 때 라스트 변경이 필요한가' },
          bottom_tooling_change: { type: 'string', enum: ['not_required', 'modification', 'required', 'unknown'], description: '아웃솔·미드솔 몰드 변경이 필요한가' },
          upper_pattern_change: { type: 'string', enum: ['minor', 'major', 'unknown'], description: '어퍼 패턴 변경의 크기' },
        },
      },
    },
    report_perspective: { type: 'string', description: '수집된 자료의 관점·편향' },
    notes: { type: 'string' },
  },
}


// ── 출처 등급 → confidence · 규칙은 코드가 강제한다 (지시서 §S1 출처 4등급제) ──
//
// 예전 규칙은 "출처 3곳 이상이면 high" — 개수만 셌다. 소셜 언급 세 건이 업계 리포트
// 한 건을 이겼다. 등급 분류 자체는 여전히 모델의 판단이지만(도메인 레지스트리가 없는 한
// 불가피하다), 등급에서 confidence 로 가는 계산은 여기서 결정적으로 한다 —
// 모델이 뭐라고 자기 판정을 했든 이 값으로 덮어쓴다.
function confidenceFromTiers(tiers) {
  const arr = Array.isArray(tiers) ? tiers : []
  const t12 = arr.filter(t => t === 'T1' || t === 'T2').length
  const t3 = arr.filter(t => t === 'T3').length
  if (t12 >= 2) return 'high'
  if (t12 === 1 || t3 >= 2) return 'medium'
  return 'low'
}

/** 신호 배열에 등급 규칙을 적용한다. 등급이 아예 없으면(옛 캐시) 건드리지 않는다. */
function applyTierRule(signals) {
  // 이 함수는 신선한 응답에만 돈다 (캐시는 이 앞에서 조기 반환). 그러니 빈 배열을
  // 봐줄 이유가 없다 — source_tiers: [] 로 자기 confidence 를 high 로 적어 내는 것이
  // 정확히 이 규칙이 막아야 할 인플레이션이다. 등급이 배열이면 무조건 규칙을 태운다:
  // 빈 배열은 confidenceFromTiers([]) = low 다.
  return (signals ?? []).map(sg => Array.isArray(sg.source_tiers)
    ? { ...sg, confidence: confidenceFromTiers(sg.source_tiers) }
    : sg)
}

// 지시서 14장 · 리포트 문체 규격
const reportStyle = (langName = 'English') => `Write in ${langName}. Style rules:
- No markdown symbols anywhere in prose: no bold asterisks, no backticks, no bullet dashes, no heading hashes.
  The only exception: body_markdown may start a section heading line with "## " — nothing else.
- No emoji. Do not fall into repeated three-bullet groups. Avoid "the key is", "in conclusion", "not only but also", "it can be said that".
- Vary paragraph length between two and seven sentences. Do not let equal-length paragraphs run in sequence.
- Do not add a summary paragraph at the end.
- No percentages you cannot source. Numbers you observed go in with their source.
- Where you are unsure, say so plainly, as in "seen at three brands, but the sample is too small to call".
- If observations conflict, put both in rather than hiding one.`

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'executive_view', 'body_markdown', 'design_implications', 'open_questions', 'sources'],
  properties: {
    title: { type: 'string' },
    executive_view: { type: 'string', description: '이 시즌에 무엇을 해야 하는지 3~5문장' },
    body_markdown: { type: 'string', description: '## 소제목을 쓴 본문. 관측·해석·반대신호를 포함. 라스트·핏, 어퍼 구조, 솔·힐·트레드, 공법 절이 반드시 있어야 한다' },
    design_implications: {
      type: 'array',
      description: '디자인 스펙으로 옮길 수 있는 구체 지침',
      items: {
        type: 'object', additionalProperties: false,
        required: ['area', 'guidance', 'basis'],
        properties: {
          area: { type: 'string', description: '라스트·핏 / 실루엣 / 어퍼 / 솔·힐·트레드 / 소재 / 컬러 / 부자재 / 공법' },
          guidance: { type: 'string' },
          basis: { type: 'string', description: '어떤 관측에서 나왔는지' },
        },
      },
    },
    open_questions: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'string' } },
  },
}

function cacheDir(root) {
  const d = join(root, '.cache', 'research')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

/** 딥리서치 · 오래 걸리므로 background로 띄우고 폴링한다. 결과는 인용이 붙은 장문 리포트 */
async function deepResearch(apiKey, { input, model, onProgress }) {
  const create = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      input,
      background: true,                       // 수 분 걸리므로 필수
      tools: [{ type: 'web_search_preview' }], // 딥리서치는 데이터 소스 도구가 반드시 있어야 한다
      reasoning: { summary: 'auto' },
    }),
  })
  if (!create.ok) {
    const body = await create.text()
    const err = new Error(`deep research ${create.status}: ${body.slice(0, 200)}`)
    err.status = create.status
    throw err
  }
  let job = await create.json()
  const started = Date.now()
  while (job.status === 'queued' || job.status === 'in_progress') {
    if (Date.now() - started > DEEP_MAX_WAIT_MS) throw new Error('딥리서치 시간 초과')
    await new Promise(r => setTimeout(r, DEEP_POLL_MS))
    const poll = await fetch(`https://api.openai.com/v1/responses/${job.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!poll.ok) throw new Error(`deep research poll ${poll.status}`)
    job = await poll.json()
    onProgress?.(job.status, Math.round((Date.now() - started) / 1000))
  }
  if (job.status !== 'completed') throw new Error(`딥리서치 실패: ${job.status}`)
  const msg = (job.output ?? []).find(o => o.type === 'message')
  const text = msg?.content?.[0]?.text ?? ''
  const searches = (job.output ?? []).filter(o => o.type === 'web_search_call').length
  const citations = (msg?.content?.[0]?.annotations ?? [])
    .filter(a => a.type === 'url_citation').map(a => a.url)
  return { text, searches, citations, elapsedSec: Math.round((Date.now() - started) / 1000) }
}

// 웹 검색이 붙은 호출은 기본 헤더 타임아웃(5분)을 넘길 수 있다.
// Node 기본 dispatcher를 그대로 두면 조용히 끊기므로 상한을 크게 잡는다.
// 주의: Node 내장 fetch에 별도 설치한 undici의 Agent를 넘기면 즉시 실패한다.
// 둘은 서로 다른 인스턴스라, dispatcher를 쓰려면 fetch도 같은 패키지 것을 써야 한다.
let longFetch = fetch
try {
  const { Agent, fetch: undiciFetch } = await import('undici')
  const agent = new Agent({ headersTimeout: 20 * 60_000, bodyTimeout: 20 * 60_000, connectTimeout: 30_000 })
  longFetch = (url, init = {}) => undiciFetch(url, { ...init, dispatcher: agent })
} catch { /* undici가 없으면 내장 fetch로 진행한다 */ }

async function ask(apiKey, { input, schema, name, location = null }) {
  const r = await longFetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: RESEARCH_MODEL,
      // 위치를 붙이면 검색 도구가 실제로 다른 결과를 집는다. 프롬프트에 나라 이름을
      // 적는 것과 다르다 — 그건 모델이 무시할 수 있는 부탁이고, 이건 도구 인자다.
      tools: [{ type: 'web_search', ...(location ? { user_location: location } : {}) }],
      // 비용보다 결과를 우선한다 · 추론 강도를 최고로 둔다
      reasoning: { effort: 'high' },
      input,
      text: { format: { type: 'json_schema', name, schema, strict: true } },
    }),
  })
  if (!r.ok) throw new Error(`OpenAI research ${r.status}: ${(await r.text()).slice(0, 400)}`)
  const j = await r.json()
  const msg = j.output?.find(o => o.type === 'message')
  const text = msg?.content?.[0]?.text
  if (!text) throw new Error('리서치 응답이 비어 있습니다')
  const searches = (j.output ?? []).filter(o => o.type === 'web_search_call').length
  return { data: JSON.parse(text), searches }
}

// 화면에는 영문으로 노출하지만, 국내 검색은 한글 브랜드명이 훨씬 잘 걸린다.
// 캐시 키도 정규화한 이름으로 잡아 같은 조사를 두 번 돌리지 않는다.
const BRAND_ALIAS = {
  'nike': '나이키', 'adidas': '아디다스', 'asics': '아식스',
  'new balance': '뉴발란스', 'newbalance': '뉴발란스', 'hoka': '호카',
  'salomon': '살로몬', 'on': '온러닝', 'on running': '온러닝', 'brooks': '브룩스', 'saucony': '써코니',
  'mizuno': '미즈노', 'puma': '푸마', 'converse': '컨버스', 'vans': '반스',
  'dr. martens': '닥터마틴', 'dr martens': '닥터마틴', 'birkenstock': '버켄스탁',
  'clarks': '클락스', 'ecco': '에코', 'camper': '캄퍼', 'timberland': '팀버랜드',
}
function canonBrand(b, ko = true) {
  if (!ko) return String(b).trim()
  const raw = String(b).trim()
  // "Nike Performance Running"처럼 라인이 붙어 있으면 브랜드만 정규화하고 라인은 살린다
  const lower = raw.toLowerCase()
  for (const [en, ko] of Object.entries(BRAND_ALIAS)) {
    if (lower === en) return ko
    if (lower.startsWith(en + ' ')) return `${ko}${raw.slice(en.length)}`
  }
  return raw
}

// 카테고리·품목도 마찬가지다. 화면은 영문, 검색은 한글.
const TERM_ALIAS = {
  footwear: '신발', shoe: '신발', shoes: '신발',
  'road daily trainer': '데일리 트레이너 러닝화', 'daily trainer': '데일리 트레이너 러닝화',
  'max cushion': '맥스 쿠셔닝 러닝화', 'tempo / racing': '카본 레이싱화', racing: '레이싱화',
  trail: '트레일 러닝화', court: '코트 스니커즈', 'lifestyle runner': '라이프스타일 러닝화 스니커즈',
  chunky: '청키 스니커즈', sneakers: '스니커즈', sneaker: '스니커즈',
  'penny loafer': '페니 로퍼', 'horsebit loafer': '홀스빗 로퍼', 'chunky loafer': '청키 로퍼', loafer: '로퍼',
  derby: '더비 슈즈', oxford: '옥스퍼드 슈즈', 'monk strap': '몽크스트랩 슈즈',
  pump: '펌프스', slingback: '슬링백', 'mary jane': '메리제인 슈즈', mule: '뮬',
  'ballet flat': '발레 플랫', driving: '드라이빙 슈즈', espadrille: '에스파드류',
  'ankle boot': '앵클 부츠', chelsea: '첼시 부츠', combat: '워커 부츠', 'knee-high': '롱부츠', hiking: '하이킹 부츠 등산화',
  strappy: '스트랩 샌들', slide: '슬라이드', sport: '스포츠 샌들', gladiator: '글래디에이터 샌들',
}
function canonTerm(t, ko = true) { return ko ? (TERM_ALIAS[String(t).trim().toLowerCase()] ?? t) : String(t).trim() }

/** 라인 프로필 → 프롬프트 블록. 조사·필터·신호 생성이 전부 이 조건을 본다. */
function lineBlock(line) {
  if (!line) return ''
  const u = (v) => v && v !== 'unknown' ? v : null
  const rows = [
    ['용도·환경', [u(line.useCase), u(line.climate)].filter(Boolean).join(' · ')],
    ['타깃', u(line.targetConsumer)],
    ['시즌', u(line.season)],
    ['라스트·핏', [u(line.lastFamily), u(line.toeShape) && `${line.toeShape} toe`].filter(Boolean).join(' · ')],
    ['어퍼', [u(line.upperOuter), u(line.closure) && `${line.closure} closure`, u(line.protection)].filter(Boolean).join(' · ')],
    ['바텀', [u(line.midsole), u(line.plate) && line.plate !== 'none' && `${line.plate} plate`, u(line.outsole), u(line.stackBand) && `${line.stackBand} stack`, u(line.dropMm) && `drop ${line.dropMm}mm`, u(line.rocker) && line.rocker !== 'none' && `${line.rocker} rocker`, u(line.heel) && line.heel !== 'none' && `${line.heel} heel`].filter(Boolean).join(' · ')],
    ['공법', [u(line.lasting), u(line.soleAttachment)].filter(Boolean).join(' + ')],
    ['성능', [u(line.cushioning) && `cushioning ${line.cushioning}`, u(line.stability), u(line.wetGrip) === 'required' && 'wet grip required'].filter(Boolean).join(' · ')],
    ['채널', (line.channels ?? []).join(' · ')],
  ].filter(([, v]) => v)
  if (!rows.length) return ''
  return `\n조사 대상 신발 라인 정의 (이 조합이 곧 경쟁군이다 — 같은 외형이라도 이 조건이 다르면 다른 시장이다):
${rows.map(([k, v]) => `- ${k}: ${v}`).join('\n')}
프로필과 공법·가격·용도가 다른 제품은 버리지 말고 competitor_group을 aspirational 또는 adjacent로 분류한다.\n`
}

/** 캐시 키에 넣을 라인 지문 · 프로필이 바뀌면 조사도 다시 돈다 */
function lineKey(line) {
  if (!line) return ''
  return createHash('sha256').update(JSON.stringify(line)).digest('hex').slice(0, 12)
}

/** 브랜드가 여러 곳이면 한 번에 묶지 않고 브랜드별로 나눠 병렬로 돈다.
 *  한 요청이 커지면 상류 연결이 먼저 끊기고, 한 브랜드 실패가 전체를 날린다. */
export async function researchCompetitors(apiKey, root, opts) {
  const { brands = [], typeKo, priceMin, priceMax, adjacentBand = false, line, langName = 'English' } = opts
  const mk = resolveMarkets({ home: line?.homeMarket, reference: line?.referenceMarkets })
  const key = createHash('sha256').update(JSON.stringify(['comp8ft', langName, brands, typeKo, priceMin, priceMax, adjacentBand, lineKey(line), mk.home.id, mk.refIds])).digest('hex').slice(0, 24)
  const file = join(cacheDir(root), `${key}.json`)
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true }

  const results = await Promise.allSettled(
    brands.map(b => researchOneBrand(apiKey, root, { ...opts, brand: b, langName })),
  )
  const products = []
  const notes = []
  let searches = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      products.push(...r.value.products)
      searches += r.value.searches || 0
      if (r.value.notes) notes.push(`${brands[i]}: ${r.value.notes}`)
    } else {
      notes.push(`${brands[i]}: 수집 실패 (${String(r.reason?.message || r.reason).slice(0, 80)})`)
    }
  })
  const out = { products, notes: notes.join(' / '), searches, collected_at: new Date().toISOString().slice(0, 10) }
  writeFileSync(file, JSON.stringify(out))
  return { ...out, cached: false }
}

async function researchOneBrand(apiKey, root, { brand: rawBrand, typeKo: rawType, priceMin, priceMax, adjacentBand = false, line, langName = 'English' }) {
  const LANG = langName
  const mk = resolveMarkets({ home: line?.homeMarket, reference: line?.referenceMarkets })
  // 한국어 별칭은 한국 시장에서만 검색을 도와준다. 미국 시장을 조사하면서
  // 'penny loafer'를 '페니 로퍼'로 바꿔 검색하면 한국 쇼핑몰만 나온다 —
  // 시장을 바꿔도 결과가 같아 보이던 가장 큰 이유가 여기였다.
  const ko = mk.home.useKoreanAliases
  const brand = canonBrand(rawBrand, ko)
  const typeKo = canonTerm(rawType, ko)
  const key = createHash('sha256').update(JSON.stringify(['brand7ft', langName, brand, typeKo, priceMin, priceMax, adjacentBand, lineKey(line), mk.home.id])).digest('hex').slice(0, 24)
  const file = join(cacheDir(root), `${key}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))

  const input = `당신은 신발 브랜드의 상품기획 리서처입니다. 웹 검색으로 사실만 수집하세요.

대상: ${brand} (브랜드 전체가 아니라 이 품목과 맞는 라인을 본다 — 같은 브랜드라도 퍼포먼스 러닝과 라이프스타일은 별개 경쟁군이다)
품목: ${typeKo}
조사 시장: ${mk.home.label} (홈)${mk.reference.length ? ` · 참조 ${mk.reference.map(r => r.label).join(', ')}` : ''}
Primary 가격 밴드: ${priceMin.toLocaleString()}원 ~ ${priceMax.toLocaleString()}원 (KRW 기준. 같은 공법·기술 티어의 직접 비교 구간)
${adjacentBand ? '한 단계 위·아래 티어도 참고용으로 1개까지 포함하되 competitor_group을 aspirational/adjacent로 분류합니다.' : '이 밴드 밖 제품은 넣지 않습니다.'}
${lineBlock(line)}
이 브랜드에서 최근 출시되었거나 현재 잘 팔리는 ${typeKo} 모델을 2~3개만 찾아주세요.
브랜드 공식몰의 베스트셀러·랭킹 페이지와 리뷰를 함께 확인하세요. 검색은 8회 이내로 끝내세요.

읽기 규칙 (반드시 지킬 것):
- 화살표와 대시를 문장 연결에 쓰지 않는다. "->", "→", "—", " - " 금지. 문장으로 풀어 쓴다.
- 개조식 나열 대신 완결된 문장을 쓴다. 각 문장은 주어와 서술어를 갖춘다.
- 항목 이름 뒤에 콜론을 붙여 설명을 잇지 않는다. 이름과 설명은 별개 필드다.
- 괄호 안에 출처 URL을 늘어놓지 않는다. 출처는 source_url 필드에만 넣는다.
- 한 문장은 60자 안팎으로 끊는다. 쉼표로 세 번 이상 잇지 않는다.

규칙:
- 실제로 검색해서 확인한 것만 적습니다. 확인하지 못한 값은 지어내지 마세요.
- 모델 패밀리 하나가 한 항목입니다. 컬러웨이 10개를 제품 10개로 내지 말고 colorway_count에 수를 적으세요.
- price_local과 price_currency에 ${mk.home.priceNote ?? '홈 시장 정가'}를 그대로 넣습니다. 환산하지 마세요.
- price_krw는 한국 정가를 실제로 확인한 경우에만 넣고, 아니면 0으로 둡니다. 환율로 추정한 값을 넣지 마세요.
  (환산은 서버가 기록된 환율로 합니다. 모델이 어림한 환산가는 근거 없는 숫자입니다.)
- 세일가를 정가로 적지 마세요.
- 가격도 공법·기술 티어도 사이즈 재고도 하나도 확인하지 못한 제품은 목록에 넣지 않습니다.
  빈 값투성이 항목은 벤치마크를 오염시킵니다 — 확인된 제품 2개가 미확인 제품 3개보다 낫습니다.
- rank_note에는 사이트에 표기된 순위를 그대로 옮기고, rank_semantics로 그 순위의 의미를 분류합니다.
  페이지에서 3번째로 노출된 것은 surface_position이지 판매 순위가 아닙니다.
- 사이즈 재고를 확인하세요: 판매 페이지의 사이즈 선택 UI에서 제공 사이즈 수(offered_sizes)와
  현재 구매 가능한 사이즈 수(available_sizes)를 셉니다. 핵심 사이즈가 빠져 있으면 size_status를 size_broken으로 둡니다.
  사이즈 부족은 초기 생산량의 영향도 받으므로 판매량으로 해석하지 않습니다.
- construction_tier에는 공법·기술 티어를 적습니다. 사진만으로 공법을 확정하지 말고, 공식 사양에서 확인한 것만 단정합니다.
- user_sentiment / praise_points / complaint_points는 실제 리뷰에서 반복되는 내용만 적습니다.
  핏이 크다/작다, 볼이 좁다, 힐 슬립, 토 압박 같은 핏 신호를 특히 찾으세요. 리뷰를 못 찾으면 unknown과 빈 배열로 둡니다.
- design_traits에는 사진과 상세 설명에서 확인되는 디자인 특징을 적습니다 (예: "두꺼운 수퍼크리티컬 폼 미드솔", "메시 갑피에 TPU 오버레이", "라스트 볼륨이 낮고 토가 길다").
- image_urls는 **모든 제품에 최소 1개**가 있어야 합니다. 사진 없는 항목은 벤치마크에서 쓸모가 없습니다.
  상세 페이지 HTML의 og:image 메타 태그 값을 그대로 옮기는 것이 가장 확실합니다. 그 태그는 거의 모든 쇼핑몰에 있습니다.
  og:image가 없으면 상세 페이지의 대표 상품 이미지 파일 주소(.jpg/.png/.webp/.avif)를 찾아 넣습니다.
  페이지 주소가 아니라 이미지 파일 주소여야 하고, 가능하면 모델당 2~3개를 넣어 하나가 만료돼도 남게 합니다.
  어떤 제품의 이미지 주소를 끝내 못 찾으면, 그 제품을 빼고 사진을 찾을 수 있는 다른 모델로 대체하세요.
- product_url에는 제품 상세 페이지 주소를 넣습니다.
- In notes, list what you could not confirm and the limits of this pass. Write it in ${LANG}.
- ${searchClause(mk, LANG)} Keep brand and model names as they are officially written.`

  const { data, searches } = await ask(apiKey, { input, schema: COMPETITOR_SCHEMA, name: 'competitor_research', location: userLocation(mk.home) })
  const out = { ...data, searches }
  writeFileSync(file, JSON.stringify(out))
  return out
}

// ── 백화점·명품몰 상업 펄스 (지시서 12.2 데이터 소스 계층 6·7) ─────────
// 사용자가 입력한 브랜드와 무관하게, 조사 시점에 백화점·명품 리테일러가
// "베스트셀러·판매 랭킹"으로 표기한 제품을 그대로 수집한다. 노출 위치는 판매 순위가 아니다.
const PULSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['products', 'notes'],
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['retailer', 'market', 'brand', 'model_name', 'price_krw', 'price_local', 'price_currency', 'rank_note', 'rank_semantics',
          'construction_tier', 'design_traits', 'image_urls', 'product_url', 'source_urls'],
        properties: {
          retailer: { type: 'string', description: '수집처. 예: 롯데백화점몰, SSG 신세계백화점, 더현대닷컴, Harrods, Selfridges, MR PORTER, NET-A-PORTER' },
          brand: { type: 'string' },
          model_name: { type: 'string' },
          market: { type: 'string', description: '이 지면이 속한 시장 코드 (KR·US·JP·GLOBAL). 지시된 시장 중 하나여야 한다' },
          price_local: { type: 'number', description: '그 지면에 표시된 가격 그대로. 환산 금지. 모르면 0' },
          price_currency: { type: 'string', description: '표시 가격의 통화 ISO 코드. 모르면 빈 문자열' },
          price_krw: { type: 'integer', description: '한국 지면에서 원화 가격을 직접 본 경우에만. 환율 어림 금지. 모르면 0' },
          rank_note: { type: 'string', description: '사이트에 표기된 그대로. 예: "여성 스니커즈 베스트 3위", "Best Seller 배지"' },
          rank_semantics: { type: 'string', enum: ['verified_sales_rank', 'retailer_bestseller_membership', 'surface_position', 'none'] },
          construction_tier: { type: 'string', description: '확인된 공법·기술 티어. 모르면 빈 문자열' },
          design_traits: { type: 'array', items: { type: 'string' } },
          image_urls: { type: 'array', items: { type: 'string' }, description: '제품 사진 직링크 또는 og:image. 사진 없는 항목은 넣지 말 것' },
          product_url: { type: 'string' },
          source_urls: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    notes: { type: 'string' },
  },
}

export async function researchRetailPulse(apiKey, root, { typeKo: rawType, line, langName = 'English' }) {
  const LANG = langName
  const mk = resolveMarkets({ home: line?.homeMarket, reference: line?.referenceMarkets })
  const typeKo = canonTerm(rawType, mk.home.useKoreanAliases)
  const key = createHash('sha256').update(JSON.stringify(['pulse4ft', LANG, typeKo, lineKey(line), mk.home.id, mk.refIds])).digest('hex').slice(0, 24)
  const file = join(cacheDir(root), `${key}.json`)
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true }

  const input = `당신은 신발 MD입니다. 웹 검색으로, 조사 시점 기준 백화점·명품 리테일러가 실제로
"베스트셀러 / 판매 랭킹 / 인기 순위"로 표기한 ${typeKo} 제품을 수집하세요.
${lineBlock(line)}
확인할 곳 (이 계열이 실제로 팔리는 지면 · ${sourceQuota(mk)}):
${retailClause(mk, familyOf(line?.itemType))}
각 제품의 market 필드에 어느 시장 지면에서 봤는지 코드로 적으세요. 지면과 시장이 어긋나면 그 항목은 빼세요.

규칙:
- 4~6개 제품만. 반드시 랭킹·베스트셀러 표기가 실제로 붙은 제품이어야 합니다.
- rank_note에는 사이트 표기를 그대로 옮기고, rank_semantics로 의미를 분류합니다.
  숫자 순위가 있으면 verified_sales_rank가 아니라, 그 순위가 "판매량 기준"이라고 명시된 경우에만 verified로 둡니다.
  단순 노출 순서는 surface_position입니다.
- image_urls가 비는 제품은 목록에서 뺍니다. 상세 페이지 HTML의 og:image 메타 태그 값을 그대로 옮기는 것이 가장 확실하고,
  없으면 대표 상품 이미지 파일 주소(.jpg/.png/.webp/.avif)를 찾습니다. 가능하면 2개 이상 넣습니다.
- 가격은 그 지면에 표시된 그대로 price_local + price_currency 에 넣습니다. 환산하지 마세요 —
  환율 없이 어림한 환산가는 근거 없는 숫자이고, 환산은 서버가 기록된 환율로 합니다.
- 검색은 10회 이내. ${searchClause(mk, LANG)}`

  const { data, searches } = await ask(apiKey, { input, schema: PULSE_SCHEMA, name: 'retail_pulse', location: userLocation(mk.home) })
  const out = { ...data, searches, collected_at: new Date().toISOString().slice(0, 10) }
  writeFileSync(file, JSON.stringify(out))
  return { ...out, cached: false }
}

// 조사 목적 → 하위 질문 설계에 쓰는 렌즈 (지시서 8장)
const OBJECTIVE_LENS = {
  live_commercial_pulse: '지금 어떤 모델·실루엣·가격대가 실제로 팔리는가 (베스트셀러 포함, 품절·재입고, 사이즈 재고)',
  design_trends: '실루엣·라스트 볼륨·토 셰이프·어퍼 패널·클로저가 어떻게 변하는가',
  materials_construction: '소재(가죽·메시·니트·필름)와 공법(시멘티드·블레이크·웰트·사출)이 어떻게 변하는가',
  performance_technology: '폼·플레이트·멤브레인·구조 기술이 어떻게 확대되는가',
  price_whitespace: '수요 대비 공급이 적은 가격·구조 조합은 무엇인가',
  next_season_forecast: '아직 작지만 다음 시즌에 확산될 가능성이 있는 구조·소재는 무엇인가',
}

export async function researchTrends(apiKey, root, {
  typeKo: rawType, brands: rawBrands, season, priceBandKo, deep, deepModel, wantReport = true, depth = 4, onStep,
  objectives = [], line,
  langName = 'English',
}) {
  const LANG = langName
  const mk = resolveMarkets({ home: line?.homeMarket, reference: line?.referenceMarkets })
  const ko = mk.home.useKoreanAliases
  const typeKo = canonTerm(rawType, ko)
  const brands = (rawBrands ?? []).map(b => canonBrand(b, ko))
  const useDeep = !!deep
  const key = createHash('sha256').update(JSON.stringify([
    'trend10ft', LANG, typeKo, brands ?? [], season, priceBandKo ?? '', [...objectives].sort(), lineKey(line), mk.home.id, mk.refIds,
    useDeep ? 'deep' : wantReport ? `multi${depth}` : 'fast',
  ])).digest('hex').slice(0, 24)
  const file = join(cacheDir(root), `${key}.json`)
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true }

  const lenses = (objectives.length ? objectives : ['live_commercial_pulse', 'design_trends', 'next_season_forecast'])
    .map(o => OBJECTIVE_LENS[o]).filter(Boolean)
  // 계열 특화 렌즈 · 힐을 조사하며 스택·드롭을 묻는 낭비를 막는다 (v2 카테고리 템플릿)
  lenses.push(...familyLens(familyOf(line?.itemType)))
  // 품목이 계열보다 구체적이면 그 차이만큼 더 묻는다 (트레일화에 카본 플레이트를 묻지 않도록)
  lenses.push(...typeLens(line?.itemType))

  const input = `당신은 신발 브랜드의 트렌드 리서처입니다. 웹 검색으로 사실만 수집하세요.

품목: ${typeKo}
시즌: ${season}
홈 시장: ${mk.home.label}${mk.reference.length ? `
참조 시장: ${mk.reference.map(r => r.label).join(', ')}` : ''}
${brands?.length ? `참고 브랜드: ${brands.join(', ')}` : ''}
${lineBlock(line)}
조사 렌즈 (사용자가 고른 조사 목적):
${lenses.map((l, i) => `${i + 1}. ${l}`).join('\n')}

이 품목의 디자인 트렌드 신호를 5~7개 찾아주세요. 신호는 "무엇이 어떻게 바뀌고 있다"는 관측이어야 하고,
디자인 스펙으로 옮길 수 있을 만큼 구체적이어야 합니다. (예: 토 셰이프, 라스트 볼륨, 솔 스택, 힐 높이 밴드, 미드솔 폼, 플레이트, 러그, 소재, 클로저)

규칙:
- 실제로 검색해서 확인한 것만 적습니다. 확인하지 못한 것은 넣지 마세요.
- observed_count는 서로 다른 출처에서 확인된 횟수입니다. 부풀리지 마세요.
- source_tiers에 출처마다 등급을 적으세요. 등급이 confidence를 정합니다 — 개수가 아닙니다.
  서버가 등급으로 confidence를 다시 계산하므로, 소셜 언급을 아무리 모아도 high가 되지 않습니다.
- label과 axis는 반드시 ${LANG}로 씁니다. attribute만 영어 snake_case로 두세요 (기계가 쓰는 키라서 언어를 타면 안 됩니다).
- 신호 하나는 뭉툭한 한 단어가 아니라 공존 속성 묶음이어야 합니다. co_occurring에 함께 관측되는 속성을 2~4개 적으세요.
  나쁜 예: "Chunky running shoe". 좋은 예: label "High-stack platform trainer", co_occurring ["high stack", "wide platform", "moderate rocker", "segmented rubber"].
- 하나의 트렌드 점수 대신 네 지수를 따로 판정합니다 (지어내지 말고 근거가 없으면 none):
  commercial_index 실제 판매·베스트셀러·재고 / cultural_index 검색·소셜·리세일 / forecast_index 전시회·소재·전문 전망 / feasibility_index 라스트·몰드·패턴 실현성.
- last_change / bottom_tooling_change / upper_pattern_change로 개발 변경 수준을 표시합니다. 문화적으로 강해도 신규 몰드가 필요하면 feasibility는 낮습니다.
- 1회 수집으로 상승·하락 궤적을 단정하지 않습니다. adoption_stage가 애매하면 unknown으로 둡니다.
- In report_perspective, say which market and viewpoint the material leans towards.
- ${searchClause(mk, LANG)}
- 시장에 대해 정직할 것: 신발의 형태 트렌드(토 셰이프·스택·폼·플레이트)는 대체로 전 세계 같은
  브랜드들이 정하므로, 시장을 바꿔도 '속성 목록'은 크게 다르지 않습니다. 시장에 따라 진짜 달라지는 것은
  그 속성이 ${mk.home.label} 매대에 실제로 얼마나 도달했는가입니다. 없는 차이를 지어내지 말고,
  commercial_index는 ${mk.home.label} 지면에서 확인한 근거로만 판정하세요.${mk.reference.length ? `
  참조 시장(${mk.reference.map(r => r.label).join(', ')})에서 이미 주류인데 홈에서 아직 안 보이면, 그 사실을 evidence에 한 줄로 적으세요.
  단, "참조 시장에는 있는데 홈에는 없다"는 판단은 홈 지면을 실제로 확인했을 때만 씁니다. 못 찾은 것과 없는 것은 다릅니다.` : ''}
- 신호는 반드시 '제품에서 관측된 디자인 속성'이어야 합니다. 실제 판매 중인 제품 페이지·리뷰·기사에서 본 형태, 소재, 부자재, 비율, 컬러를 적으세요.
- 데이터가 없다거나 확인이 어렵다는 서술은 신호가 아닙니다. 그런 내용은 notes에만 적고 signals에는 절대 넣지 마세요.
- label은 디자인 속성 이름이어야 합니다. 좋은 예: 'Elongated soft square toe', 'High-stack platform trainer', 'Low block heel 25-35mm', 'Suede upper', 'Elastic gore closure'.
- 나쁜 예(넣지 말 것): 'No quantified shares', 'Access constraints', 'Data not available', 'GTM requirement'.
- 정량 통계를 못 찾더라도, 개별 제품에서 반복 관측되는 속성이면 confidence를 low로 두고 신호로 올리세요.`

  // 딥리서치 모델이 없어도 상세 보고서가 나오도록, 조사를 여러 단계로 쪼갠다.
  // ① 하위 질문 설계 → ② 질문별 개별 검색 → ③ 종합 보고서 → ④ 스키마 정리
  if (!useDeep && wantReport) {
    const planned = await ask(apiKey, {
      location: userLocation(mk.home),
      input: `${typeKo} · ${season} · 가격대 ${priceBandKo ?? '미지정'} 의 디자인 트렌드를 조사하려 합니다.
${lineBlock(line)}
조사 렌즈:
${lenses.map((l, i) => `${i + 1}. ${l}`).join('\n')}

서로 겹치지 않는 조사 하위 질문 ${depth}개를 만드세요. 각 질문은 위 렌즈 중 하나를 다루고, 웹에서 사실로 확인 가능한 것이어야 하고,
디자인 스펙(라스트·실루엣·어퍼·솔·힐·트레드·소재·부자재·컬러·비율)으로 옮길 수 있는 답이 나오는 질문이어야 합니다.
선택한 품목과 직접 관련된 질문이 대부분이어야 합니다 — 러닝화를 조사하는데 부츠·힐 질문을 만들면 안 됩니다.`,
      schema: {
        type: 'object', additionalProperties: false, required: ['questions'],
        properties: { questions: { type: 'array', items: { type: 'string' } } },
      },
      name: 'research_plan',
    })
    const qs = (planned.data.questions ?? []).slice(0, depth)
    onStep?.(`하위 질문 ${qs.length}개 설계 완료`)

    // 하위 질문은 서로 독립이므로 병렬로 돈다. 순차로 하면 5배 느리다.
    let totalSearch = planned.searches
    const settled = await Promise.allSettled(qs.map(q => ask(apiKey, {
      location: userLocation(mk.home),
      input: `웹 검색으로 다음 질문에 답하세요. 확인한 사실만 쓰고 출처 URL을 함께 남기세요.
검색은 4회 이내로 끝내세요. 이미 아는 사실은 다시 검색하지 마세요.
대상: ${typeKo} · ${season} · 가격대 ${priceBandKo ?? '미지정'} · 시장 ${mk.home.label}
${searchClause(mk, LANG)}
질문: ${q}`,
      schema: {
        type: 'object', additionalProperties: false, required: ['answer', 'facts', 'sources'],
        properties: {
          answer: { type: 'string' },
          facts: { type: 'array', items: { type: 'string' } },
          sources: { type: 'array', items: { type: 'string' } },
        },
      },
      name: 'sub_finding',
    })))
    const findings = []
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        totalSearch += r.value.searches
        findings.push({ q: qs[i], ...r.value.data })
      }
    })
    onStep?.(`조사 ${findings.length}/${qs.length}건 완료 · 종합 보고서 작성 중`)

    const digest = findings.map((f, i) =>
      `[Q${i + 1}] ${f.q}\n답: ${f.answer}\n사실: ${(f.facts ?? []).join(' / ')}\n출처: ${(f.sources ?? []).join(', ')}`
    ).join('\n\n')

    const rep = await ask(apiKey, {
      input: `아래 조사 결과만 근거로 ${typeKo} (${season}, 가격대 ${priceBandKo ?? '미지정'}) trend report written in ${LANG}, using only the research below.
보고서 분량의 60~70%는 선택 품목의 직접 신호, 20~25%는 인접 계열, 10~15%만 신발 전체 매크로 맥락이어야 합니다.
본문에는 라스트·핏 / 어퍼 구조 / 솔·힐·트레드 / 공법 절이 반드시 들어갑니다.

${reportStyle(LANG)}

--- 조사 결과 ---
${digest}
--- 끝 ---`,
      schema: REPORT_SCHEMA, name: 'trend_report',
    })
    totalSearch += rep.searches

    const structured = await ask(apiKey, {
      input: `아래 보고서에 적힌 내용만 사용해 신호 스키마로 정리하세요. 없는 내용을 만들지 마세요.
신호마다 co_occurring 속성 묶음과 네 지수(commercial/cultural/forecast/feasibility), 라스트·몰드·패턴 변경 수준을 채웁니다.

${rep.data.body_markdown}

인용 가능한 출처: ${findings.flatMap(f => f.sources ?? []).slice(0, 40).join(', ')}`,
      schema: TREND_SCHEMA, name: 'trend_research',
    })

    const out = {
      ...structured.data,
      signals: applyTierRule(structured.data.signals),
      searches: totalSearch,
      engine: 'multi',
      report: rep.data,
      sub_questions: qs,
      collected_at: new Date().toISOString().slice(0, 10),
    }
    writeFileSync(file, JSON.stringify(out))
    return { ...out, cached: false }
  }

  // 딥리서치가 열려 있으면 먼저 장문 리포트를 만들고, 그 리포트를 구조화한다.
  // 조사와 문장화를 분리하면 근거가 잘리지 않고 스키마에 담긴다.
  if (useDeep) {
    try {
      const dr = await deepResearch(apiKey, { input, model: deepModel || DEEP_MODEL_DEFAULT })
      const { data } = await ask(apiKey, {
        input: `아래는 웹 리서치로 작성된 조사 리포트입니다. 이 리포트에 적힌 내용만 사용해 스키마로 정리하세요.
없는 내용을 추가하지 말고, source_urls에는 리포트에 인용된 URL만 넣으세요.

--- 리포트 시작 ---
${dr.text.slice(0, 120_000)}
--- 리포트 끝 ---

참고 인용 URL: ${dr.citations.slice(0, 40).join(', ')}`,
        schema: TREND_SCHEMA, name: 'trend_research',
      })
      const out = {
        ...data, signals: applyTierRule(data.signals), searches: dr.searches, engine: 'deep', elapsed_sec: dr.elapsedSec,
        report: dr.text.slice(0, 20_000),
        collected_at: new Date().toISOString().slice(0, 10),
      }
      writeFileSync(file, JSON.stringify(out))
      return { ...out, cached: false }
    } catch (e) {
      // 모델 미개방(404) 등은 조용히 기본 경로로 되돌린다
      const fellBack = `딥리서치 사용 불가로 기본 검색으로 진행: ${String(e.message).slice(0, 120)}`
      const { data, searches } = await ask(apiKey, { input, schema: TREND_SCHEMA, name: 'trend_research', location: userLocation(mk.home) })
      const out = { ...data, signals: applyTierRule(data.signals), searches, engine: 'fast', fallback_reason: fellBack, collected_at: new Date().toISOString().slice(0, 10) }
      writeFileSync(file, JSON.stringify(out))
      return { ...out, cached: false }
    }
  }

  const { data, searches } = await ask(apiKey, { input, schema: TREND_SCHEMA, name: 'trend_research', location: userLocation(mk.home) })
  const out = { ...data, signals: applyTierRule(data.signals), searches, engine: 'fast', collected_at: new Date().toISOString().slice(0, 10) }
  writeFileSync(file, JSON.stringify(out))
  return { ...out, cached: false }
}


/** 시즌 도시에 · MICAM 형식. ask()를 주입해 dossier-api가 같은 검색 경로를 쓰게 한다. */
export async function researchSeasonDossier(apiKey, root, opts) {
  return researchDossier({ ask: (a) => ask(apiKey, a) }, root, opts)
}
