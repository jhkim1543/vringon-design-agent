// ── 시즌 트렌드 도시에 · MICAM/Livetrend 형식을 그대로 데이터로 옮긴다 ──────
//
// 참고한 형식 (첨부 리포트 3종):
//   MICAM 101 FW26 Buyer's Guide, MICAM 100 SS26 Buyer's Guide, MICAM 102 SS27 Press Kit
//   - 데이터 소스 4종: 이커머스(MARKET) / 인스타그램(SOCIAL) / 패션쇼(SHOWS) / 검색량(CONSUMER)
//   - 트렌드 등급 6종: EDGY / EARLY SIGN / SAFE / BIG / STABLE / LAST CALL
//   - 시즌 서사 1편 → 매크로트렌드 4개 → 각 매크로마다
//       서브트렌드 칩 · 검색 성장률 3개 · 팔레트(Pantone TCX + HEX) · 소재 4 · 디테일 4 · 키아이템(여/남/키즈)
//   - 모든 수치는 전년 대비(YoY)이고 어느 소스에서 나왔는지 아이콘으로 표시된다
//
// 여기서는 그 구조를 강제 스키마로 만들어, 모든 수치가 출처 URL을 달고 나오게 한다.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const SOURCE_KINDS = ['market', 'social', 'shows', 'consumer']
export const TREND_GRADES = ['edgy', 'early_sign', 'safe', 'big', 'stable', 'last_call']

const GRADE_NOTE = `등급 기준 (MICAM 분류를 따른다):
- edgy: 아주 약한 신호. 마이크로 트렌드 가능성, 위험 매우 높음
- early_sign: 부상 중. 전망은 있으나 위험이 큼
- safe: 이미 예고된 트렌드. 성장 중이고 위험이 낮음
- big: 상업적 잠재력이 크고 확산이 빠른 큰 트렌드
- stable: 이미 시장에 있고 성장은 평평함
- last_call: 전망은 꺾였지만 아직 사업성은 남아 있음`

const SOURCE_NOTE = `데이터 소스는 넷 중 하나로 표기한다:
- market: 이커머스에서 관측한 전년 대비 변화 (판매 페이지, 품절/재입고, 노출 수)
- social: 인스타그램 등 소셜에서의 전년 대비 노출 증가
- shows: 패션쇼/컬렉션에서의 전년 대비 등장 증가
- consumer: 검색량 등 소비자 관심의 전년 대비 증가`

/** 근거가 붙은 수치 하나. 화면에서는 "+265% YoY · MARKET" 처럼 보인다. */
const METRIC = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'yoy_percent', 'magnitude', 'source_kind', 'source_url', 'observed_note'],
  properties: {
    label: { type: 'string', description: '무엇이 늘었는가. 예: FISHERMAN, RETRO SPORT, AUTHENTIC SUEDE' },
    yoy_percent: { type: ['number', 'null'], description: '공개된 전년 대비 증감 %를 찾았을 때만 넣는다. 못 찾았으면 null. 지어내지 말 것' },
    magnitude: { type: 'string', enum: ['surging', 'rising', 'steady', 'softening'], description: '숫자를 못 찾아도 이건 반드시 채운다. 관측한 양으로 판단한 방향과 세기' },
    source_kind: { type: 'string', enum: SOURCE_KINDS },
    source_url: { type: 'string', description: '이 수치를 확인한 실제 URL. 없으면 빈 문자열' },
    observed_note: { type: 'string', description: '어떻게 확인했는지 한 문장. 추정이면 추정이라고 쓴다' },
  },
}

const COLOR = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'pantone_tcx', 'hex'],
  properties: {
    name: { type: 'string', description: '컬러 이름. 예: Peat Moss, Rose Dust' },
    pantone_tcx: { type: 'string', description: 'Pantone TCX 코드. 모르면 빈 문자열' },
    hex: { type: 'string', description: '#RRGGBB' },
  },
}

const KEY_ITEM = {
  type: 'object',
  additionalProperties: false,
  required: ['segment', 'name', 'description', 'metric', 'grade', 'silhouette_spec'],
  properties: {
    segment: { type: 'string', enum: ['women', 'men', 'kids'] },
    name: { type: 'string', description: '아이템 이름. 예: THE STRAPPY STILETTO' },
    description: { type: 'string', description: '3~5문장. 형태와 그것이 주는 인상을 함께 쓴다' },
    metric: METRIC,
    grade: { type: 'string', enum: TREND_GRADES },
    silhouette_spec: { type: 'string', description: '디자인 스펙으로 바로 옮길 수 있는 구절. 토 셰이프·힐·소재·클로저·부자재' },
  },
}

const MACRO = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'statement', 'narrative', 'sub_trends', 'drivers', 'palette', 'materials', 'details', 'key_items', 'grade'],
  properties: {
    name: { type: 'string', description: '매크로트렌드 이름. 두 단어. 예: MARE NOIR, BUCOLIC SLUMBER' },
    statement: { type: 'string', description: '한 문장 요약. 리포트 하단 인용구로 쓰인다' },
    narrative: { type: 'string', description: '3문단. 무드 → 신발에 어떻게 나타나는가 → 팔레트' },
    sub_trends: { type: 'array', description: '서브트렌드 칩 3~4개', items: { type: 'string' } },
    drivers: { type: 'array', description: '이 매크로를 떠받치는 성장 지표 3개', items: METRIC },
    palette: { type: 'array', description: '컬러 8~9개', items: COLOR },
    materials: { type: 'array', description: '소재 4개', items: METRIC },
    details: { type: 'array', description: '디테일 4개. 예: 브로그 펀칭, 모카신 웰트 심', items: METRIC },
    key_items: { type: 'array', description: '여성 3 · 남성 3 · 키즈 3', items: KEY_ITEM },
    grade: { type: 'string', enum: TREND_GRADES },
  },
}

export const DOSSIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['season', 'season_title', 'powershift', 'season_narrative', 'macrotrends', 'yearly_context', 'method_note', 'open_questions', 'sources'],
  properties: {
    season: { type: 'string', description: '예: SS27, FW26' },
    season_title: { type: 'string', description: '시즌 제목. 예: A RAW RENAISSANCE, ANTIDOTE TO SUFFERING' },
    powershift: { type: 'string', description: '이 시즌을 움직이는 큰 힘 한 단어~두 단어. 예: FUTUREKIND' },
    season_narrative: { type: 'string', description: '4~6문단. 왜 이 시즌이 이런 모습인지. 마지막 문단에서 매크로 4개를 소개한다' },
    macrotrends: { type: 'array', description: '정확히 4개', items: MACRO },
    yearly_context: {
      type: 'array',
      description: '연도별 흐름. 최근 3~5개 시즌을 한 줄씩. 각 항목에 출처 URL을 단다',
      items: {
        type: 'object', additionalProperties: false,
        required: ['season', 'headline', 'what_changed', 'source_url'],
        properties: {
          season: { type: 'string' },
          headline: { type: 'string' },
          what_changed: { type: 'string', description: '전 시즌 대비 무엇이 달라졌는가' },
          source_url: { type: 'string' },
        },
      },
    },
    method_note: { type: 'string', description: '어떤 소스를 몇 번 확인했고 무엇이 한계였는지' },
    open_questions: { type: 'array', items: { type: 'string' } },
    sources: {
      type: 'array',
      description: '본문에 쓰인 모든 출처. 제목과 URL을 함께 둔다',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'url', 'used_for'],
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
          used_for: { type: 'string', description: '이 출처가 무엇을 뒷받침하는가' },
        },
      },
    },
  },
}

function dossierDir(root) {
  const d = join(root, '.cache', 'research')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

/** 시즌 도시에 조사.
 *  ① 매크로 후보 잡기 → ② 매크로별 개별 심층 조사 → ③ 연도 흐름 → ④ 하나로 합치기
 *  한 번에 다 물으면 응답이 얕아지고 상류 연결도 먼저 끊긴다. */
export async function researchDossier(deps, root, opts) {
  const { ask } = deps
  const { categoryEn, season, priceBand, brands = [], deep = false, onStep, langName = 'English' } = opts
  const key = createHash('sha256').update(JSON.stringify(['dossier3', langName, categoryEn, season, priceBand ?? '', brands, deep])).digest('hex').slice(0, 24)
  const file = join(dossierDir(root), `${key}.json`)
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true }

  const LANG = langName
  const base = `출력 언어: 모든 문자열을 ${LANG}로 쓴다. 검색은 어떤 언어로 하든 좋다. 브랜드·모델명은 공식 표기 그대로 둔다.
대상: ${categoryEn} · 시즌 ${season}${priceBand ? ` · 가격대 ${priceBand}` : ''}${brands.length ? ` · 참고 브랜드 ${brands.join(', ')}` : ''}

${SOURCE_NOTE}

${GRADE_NOTE}

규칙:
- 웹 검색으로 실제 확인한 것만 씁니다. 공개된 % 수치를 못 찾으면 yoy_percent는 null로 두되, magnitude는 관측량으로 판단해 반드시 채웁니다.
- 리테일 랭킹·품절 표기·쇼 등장 횟수·검색 트렌드처럼 % 없이도 방향을 말할 수 있는 근거를 찾아 observed_note에 씁니다.
- source_url은 실제로 연 페이지의 URL이어야 합니다. 지어내지 마세요.
- 검색은 한국어·영어 모두 씁니다. 다만 출력 문자열은 전부 영어로 씁니다.
- 트렌드 리포트 업계(MICAM, Livetrend, WGSN, Pantone, Vogue Runway, Fashion Snoops 등)의 공개 자료와 브랜드 공식몰, 리테일러 랭킹 페이지를 함께 봅니다.`

  onStep?.('Mapping macrotrends')
  const plan = await ask({
    input: `${base}

이 시즌 ${categoryEn} 트렌드를 설명하는 매크로트렌드 4개를 잡으세요.
각각 이름(두 단어, 대문자), 한 줄 요약, 서브트렌드 칩 3~4개를 답하세요.
서로 겹치지 않아야 하고, 넷을 합치면 시즌 전체가 설명되어야 합니다.`,
    schema: {
      type: 'object', additionalProperties: false, required: ['season_title', 'powershift', 'macros'],
      properties: {
        season_title: { type: 'string' },
        powershift: { type: 'string' },
        macros: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['name', 'statement', 'sub_trends'],
            properties: {
              name: { type: 'string' }, statement: { type: 'string' },
              sub_trends: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    name: 'dossier_plan',
  })

  const macros = (plan.data.macros ?? []).slice(0, 4)
  let searches = plan.searches

  onStep?.(`Researching ${macros.length} macrotrends`)
  const filled = await Promise.allSettled(macros.map(async (m) => {
    const r = await ask({
      input: `${base}

매크로트렌드 "${m.name}" (${m.statement}) 를 깊게 조사하세요.
서브트렌드: ${(m.sub_trends ?? []).join(', ')}

채울 것:
- narrative 3문단
- drivers 3개: 이 무드를 떠받치는 검색·소셜·쇼 성장 지표
- palette 8~9개: 실제 시즌 컬러. Pantone TCX 코드를 찾을 수 있으면 넣습니다
- materials 4개: 소재별 전년 대비 성장
- details 4개: 부자재·봉제·마감 디테일별 성장
- key_items 9개: 여성 3, 남성 3, 키즈 3. 각각 이름·설명·성장률·등급·스펙 구절
- grade: 이 매크로 전체의 등급`,
      schema: MACRO, name: 'macrotrend',
    })
    searches += r.searches
    return { ...r.data, name: r.data.name || m.name, statement: r.data.statement || m.statement }
  }))

  const macrotrends = filled.filter(r => r.status === 'fulfilled').map(r => r.value)

  onStep?.('Tracing the last few seasons')
  const yearly = await ask({
    input: `${base}

최근 3~5개 시즌의 ${categoryEn} 트렌드 흐름을 시즌별 한 줄로 정리하세요.
각 항목에 실제 출처 URL을 답니다. 무엇이 직전 시즌 대비 달라졌는지가 핵심입니다.
그리고 이번 시즌 서사(season_narrative)를 4~6문단으로 쓰세요. 마지막 문단에서 매크로 4개(${macrotrends.map(m => m.name).join(', ')})를 소개합니다.`,
    schema: {
      type: 'object', additionalProperties: false,
      required: ['season_narrative', 'yearly_context', 'method_note', 'open_questions', 'sources'],
      properties: {
        season_narrative: { type: 'string' },
        yearly_context: DOSSIER_SCHEMA.properties.yearly_context,
        method_note: { type: 'string' },
        open_questions: { type: 'array', items: { type: 'string' } },
        sources: DOSSIER_SCHEMA.properties.sources,
      },
    },
    name: 'dossier_context',
  })
  searches += yearly.searches

  const out = {
    season,
    season_title: plan.data.season_title,
    powershift: plan.data.powershift,
    season_narrative: yearly.data.season_narrative,
    macrotrends,
    yearly_context: yearly.data.yearly_context ?? [],
    method_note: yearly.data.method_note ?? '',
    open_questions: yearly.data.open_questions ?? [],
    sources: yearly.data.sources ?? [],
    searches,
    collected_at: new Date().toISOString().slice(0, 10),
  }
  writeFileSync(file, JSON.stringify(out))
  return { ...out, cached: false }
}
