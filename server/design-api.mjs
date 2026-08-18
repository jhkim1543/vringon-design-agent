// ── Design Genome · 디자인 저작을 LLM에게 넘긴다 (지시서 v2 S3~S4) ──────
//
// 이전에는 구조 결정(토·힐·패널·클로저)이 프로필 범위 안 난수였다. 조사가 정한 몇 필드를
// 빼면, 디자인의 저자는 rng.pick()이었다. 여기서 뒤집는다:
//   S3 planTerritories — 신호와 브랜드를 받아 서로 다른 설계 영토를 계획하고
//   S4 authorGenome    — 영토마다 독립 호출로 게놈(설계 의도)을 저작한다
// 룰은 검증만 한다. 프롬프트는 게놈에서만 파생된다 (단일 진실 원천).
//
// 게놈 스키마에는 그릴 수 있는 축만 넣는다. mm·비율은 spec_sheet 필드로 분리한다 —
// 이미지 모델은 25mm와 29mm를 구분해 그리지 못하고, 못 그릴 것을 지시하면
// 문서와 실물이 어긋난다. 그 어긋남을 걷어내는 것이 이 파일의 존재 이유다.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { familyOf } from './category-templates.mjs'
import { askJson } from './inference.mjs'
import { record } from './usage-ledger.mjs'

const MODEL = 'gpt-5'

const cacheDir = (root) => {
  const d = join(root, '.cache', 'design')
  if (!existsSync(d)) mkdirSync(d, { recursive: true })
  return d
}

// 저작·검증은 사내 GPU 로 돌릴 수 있다. .env 에서 INFER_AUTHOR / INFER_VISION 을
// local 로 두면 이 호출이 밖으로 안 나간다. 설정이 없으면 예전 경로 그대로다.
async function ask(apiKey, { input, schema, name, effort = 'medium', role = 'author' }) {
  return askJson({
    role, input, schema, name,
    hosted: async () => {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          reasoning: { effort },
          input,
          text: { format: { type: 'json_schema', name, schema, strict: true } },
        }),
        signal: AbortSignal.timeout(300_000),
      })
      if (!r.ok) throw new Error(`design ${r.status}: ${(await r.text()).slice(0, 300)}`)
      const j = await r.json()
      // 응답의 usage 를 장부에 남긴다. 예전에는 여기서 텍스트만 꺼내고 usage 는 버렸다.
      record({ kind: 'inference', name: `design/${name}`, model: MODEL, usage: j.usage, meta: { effort, role } })
      const text = j.output?.find(o => o.type === 'message')?.content?.[0]?.text
      if (!text) throw new Error('empty design response')
      return JSON.parse(text)
    },
  })
}

// ── S3 · Concept Territory ───────────────────────────────────────────
const TERRITORY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['territories'],
  properties: {
    territories: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'name', 'consumer_role', 'use_signal_ids', 'drop_signal_ids', 'drop_reason', 'allowed_tiers', 'season_note'],
        properties: {
          id: { type: 'string', description: 't1..t8 같은 짧은 키' },
          name: { type: 'string', description: '영토 이름. 요청된 출력 언어로' },
          consumer_role: { type: 'string', description: '이 영토가 소비자에게 제공하는 역할 한 문장' },
          use_signal_ids: { type: 'array', items: { type: 'string' }, description: '이 영토가 밀 신호 id 1~3개' },
          drop_signal_ids: { type: 'array', items: { type: 'string' }, description: '이 영토가 일부러 버리는 주류 신호 id' },
          drop_reason: { type: 'string', description: '왜 버리는가 한 문장. 버린 것이 없으면 빈 문자열' },
          allowed_tiers: { type: 'array', items: { type: 'string', enum: ['core', 'push', 'signature'] } },
          season_note: { type: 'string', description: '이 방향이 목표 시즌에 유효한 이유 또는 위험. 근거 없으면 unknown이라고 쓴다' },
        },
      },
    },
  },
}

export async function planTerritories(apiKey, root, {
  signals = [], itemTypeEn = 'footwear', itemType = '', brandSummary = '', langName = 'English',
}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')
  const sigDigest = signals.map(s =>
    `${s.signal_id}: ${s.label} (축 ${s.axis} · ${s.observed_count}회 관측 · 툴링 last=${s.last_change ?? 'unknown'}/bottom=${s.bottom_tooling_change ?? 'unknown'})`
  ).join('\n')
  const key = createHash('sha256').update(JSON.stringify(['terr1', langName, itemType, sigDigest, brandSummary])).digest('hex').slice(0, 24)
  const file = join(cacheDir(root), `${key}.json`)
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true }

  const data = await ask(apiKey, {
    name: 'territories', schema: TERRITORY_SCHEMA, effort: 'high',
    input: `당신은 신발 브랜드의 수석 기획자입니다. 아래 조사 신호로 ${itemTypeEn}의 설계 영토 6개를 계획하세요.

영토는 "같은 트렌드의 강도 차이"가 아니라 서로 다른 설계 공간이어야 합니다.
반드시 포함: 상업 앵커 1개(가장 검증된 신호), 역트렌드 1개(주류 신호를 일부러 버리는 방향).
각 영토는 신호를 1~3개만 골라 밀고, 나머지는 버립니다. 무엇을 왜 버리는지 적으세요.
품목 정체성과 충돌하는 영토는 만들지 마세요 (${itemTypeEn}이 아니게 되는 방향 금지).

툴링 표시가 required인 신호는 core 영토에 넣지 마세요 — core는 기존 라스트·몰드를 재사용합니다.

조사 신호:
${sigDigest || '(신호 없음 — 이 경우 영토는 품목의 고전적 스펙트럼으로 가르되, season_note에 unknown이라 쓰세요)'}

${brandSummary ? `브랜드 조건 (영토가 이 안에서 출발해야 합니다):\n${brandSummary}` : '브랜드 조건 없음 — 결과가 시장 평균에 수렴할 수 있음을 감안하세요.'}

name·consumer_role·drop_reason·season_note는 ${langName}로 쓰세요.`,
  })
  const out = { ...data, collected_at: new Date().toISOString().slice(0, 10) }
  writeFileSync(file, JSON.stringify(out))
  return out
}

// ── S4 · Design Genome ──────────────────────────────────────────────
// 그릴 수 있는 축만. 실루엣 계열 키는 클라이언트 SILHOUETTE_READS와 일치해야 한다.
const SILHOUETTE_KEYS = ['slim', 'volume', 'structured', 'fluid', 'dense', 'airy', 'grounded', 'lifted']

const GENOME_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['concept_thesis', 'consumer_role', 'hero_mutation', 'supporting',
    'silhouette_family', 'toe_family', 'sole_mass', 'panel_density', 'closure_form', 'stance',
    'parts', 'spec_sheet', 'source_signal_ids', 'preserve', 'forbidden'],
  properties: {
    concept_thesis: { type: 'string', description: '이 안이 무엇인지 두 문장. 요청된 출력 언어로. 보드 카드에 그대로 실린다' },
    consumer_role: { type: 'string', description: '누가 왜 사는가 한 문장' },
    hero_mutation: {
      type: 'object', additionalProperties: false,
      required: ['axis', 'label', 'drawing_instruction'],
      properties: {
        axis: { type: 'string', enum: ['silhouette', 'sole', 'upper_topology', 'closure', 'material_construction'] },
        label: { type: 'string', description: '변화의 이름. 출력 언어로' },
        drawing_instruction: { type: 'string', description: '영어 한두 문장. 선으로 그릴 수 있는 지시만 — 비례·선·구조. 소재 질감·색 금지 (선화 단계에서 못 그린다)' },
      },
    },
    supporting: {
      type: 'array', minItems: 2, maxItems: 4,
      items: { type: 'string', description: '영어 한 문장씩. Hero를 받치는 부수 변화. 역시 선으로 그릴 수 있는 것만' },
    },
    silhouette_family: { type: 'string', enum: SILHOUETTE_KEYS },
    toe_family: { type: 'string', enum: ['round', 'almond', 'square', 'pointed'] },
    sole_mass: { type: 'string', enum: ['low', 'mid', 'high'], description: '옆에서 본 솔의 시각적 두께' },
    panel_density: { type: 'string', enum: ['minimal', 'standard', 'dense'] },
    closure_form: { type: 'string', description: '품목 프로필이 허용하는 클로저 중 하나. 허용 목록은 입력에 있다' },
    stance: { type: 'string', enum: ['grounded', 'neutral', 'lifted'] },
    // 파트별 지시 · 신발은 어퍼 하나가 아니다. 백카운터·토캡·미드솔·아웃솔·설포/아이스테이·칼라·오버레이가
    // 각각 형태와 소재를 갖는다. 예전에는 upper_material 하나가 신발 전체의 소재였고, 미드솔·아웃솔은
    // mm 수치 하나로만 언급됐다. 스케치는 form 만, 렌더는 form+material 을 쓴다.
    parts: {
      type: 'object', additionalProperties: false,
      required: ['heel_counter', 'toe_cap', 'midsole', 'outsole', 'tongue_eyestay', 'collar', 'overlays'],
      properties: {
        heel_counter: { type: 'object', additionalProperties: false, required: ['form', 'material'],
          properties: {
            form: { type: 'string', description: '힐 카운터(백카운터) · 형태만, 영어 한 문장. 선으로 그릴 수 있는 것: 높이·윤곽·분할·각도. 소재·색 금지' },
            material: { type: 'string', description: '힐 카운터(백카운터) · 소재와 마감, 영어 한 구절. 렌더 단계에서만 쓴다. 예: "compression-moulded EVA, matte, tonal"' },
          } },
        toe_cap: { type: 'object', additionalProperties: false, required: ['form', 'material'],
          properties: {
            form: { type: 'string', description: '토캡/토 범퍼 · 형태만, 영어 한 문장. 선으로 그릴 수 있는 것: 높이·윤곽·분할·각도. 소재·색 금지' },
            material: { type: 'string', description: '토캡/토 범퍼 · 소재와 마감, 영어 한 구절. 렌더 단계에서만 쓴다. 예: "compression-moulded EVA, matte, tonal"' },
          } },
        midsole: { type: 'object', additionalProperties: false, required: ['form', 'material'],
          properties: {
            form: { type: 'string', description: '미드솔 · 사이드월 조형·두께 변화·홈 · 형태만, 영어 한 문장. 선으로 그릴 수 있는 것: 높이·윤곽·분할·각도. 소재·색 금지' },
            material: { type: 'string', description: '미드솔 · 사이드월 조형·두께 변화·홈 · 소재와 마감, 영어 한 구절. 렌더 단계에서만 쓴다. 예: "compression-moulded EVA, matte, tonal"' },
          } },
        outsole: { type: 'object', additionalProperties: false, required: ['form', 'material'],
          properties: {
            form: { type: 'string', description: '아웃솔 · 러그/세그먼트 패턴·플렉스 그루브·컴파운드 분할 — 바닥면 스케치의 근거 · 형태만, 영어 한 문장. 선으로 그릴 수 있는 것: 높이·윤곽·분할·각도. 소재·색 금지' },
            material: { type: 'string', description: '아웃솔 · 러그/세그먼트 패턴·플렉스 그루브·컴파운드 분할 — 바닥면 스케치의 근거 · 소재와 마감, 영어 한 구절. 렌더 단계에서만 쓴다. 예: "compression-moulded EVA, matte, tonal"' },
          } },
        tongue_eyestay: { type: 'object', additionalProperties: false, required: ['form', 'material'],
          properties: {
            form: { type: 'string', description: '설포와 아이스테이 · 레이싱 기하 · 형태만, 영어 한 문장. 선으로 그릴 수 있는 것: 높이·윤곽·분할·각도. 소재·색 금지' },
            material: { type: 'string', description: '설포와 아이스테이 · 레이싱 기하 · 소재와 마감, 영어 한 구절. 렌더 단계에서만 쓴다. 예: "compression-moulded EVA, matte, tonal"' },
          } },
        collar: { type: 'object', additionalProperties: false, required: ['form', 'material'],
          properties: {
            form: { type: 'string', description: '칼라/개구부 · 형태만, 영어 한 문장. 선으로 그릴 수 있는 것: 높이·윤곽·분할·각도. 소재·색 금지' },
            material: { type: 'string', description: '칼라/개구부 · 소재와 마감, 영어 한 구절. 렌더 단계에서만 쓴다. 예: "compression-moulded EVA, matte, tonal"' },
          } },
        overlays: { type: 'object', additionalProperties: false, required: ['form', 'material'],
          properties: {
            form: { type: 'string', description: '어퍼 오버레이/보강 · 없으면 "none" · 형태만, 영어 한 문장. 선으로 그릴 수 있는 것: 높이·윤곽·분할·각도. 소재·색 금지' },
            material: { type: 'string', description: '어퍼 오버레이/보강 · 없으면 "none" · 소재와 마감, 영어 한 구절. 렌더 단계에서만 쓴다. 예: "compression-moulded EVA, matte, tonal"' },
          } },
      },
    },
    spec_sheet: {
      type: 'object', additionalProperties: false,
      required: ['is_new_last', 'is_new_outsole_mold', 'heel_height_mm', 'panel_count', 'sole_construction', 'upper_material'],
      properties: {
        is_new_last: { type: 'boolean', description: '이 안이 신규 라스트를 요구하는가. Core는 반드시 false' },
      is_new_outsole_mold: { type: 'boolean', description: '이 안이 신규 아웃솔 몰드를 요구하는가. Core는 반드시 false' },
      heel_height_mm: { type: 'integer', description: '허용 범위 안에서. 범위는 입력에 있다. 같은 영토라도 30 고정 금지 — 범위를 분산해 쓴다' },
        panel_count: { type: 'integer' },
        sole_construction: { type: 'string', description: '허용 공법 중 하나' },
        upper_material: { type: 'string', description: '예: suede 1.4mm, calf 1.6mm, engineered mesh 0.9mm' },
      },
    },
    source_signal_ids: { type: 'array', items: { type: 'string' }, description: '이 게놈이 실제로 쓴 신호 id. 안 쓴 신호를 적으면 근거 조작이다' },
    preserve: { type: 'array', items: { type: 'string' }, description: '건드리지 않은 것 1~3개' },
    forbidden: { type: 'array', items: { type: 'string' }, description: '이 안에서 금지한 것. 브랜드 금지요소 포함' },
  },
}

export async function authorGenome(apiKey, root, {
  territory, tier = 'core', signals = [], profile = {}, brandSummary = '',
  antiSimilarity = [], itemTypeEn = 'footwear', langName = 'English',
  // 라인이 이미 라스트·바텀을 재사용한다고 선언했으면 그게 Core 의 출발 자산이다.
  // 위저드에 이 스위치가 있는데 어디도 읽지 않았다 — 저작자가 알아야 지킬 수 있다.
  assets = { lastReuse: true, bottomReuse: true },
  // 시리즈 모드 · 사람이 승인한 불변 요소. 저작자가 모르면 그 축을 바꾸려다 클램프에 걸려 조용히 잘린다.
  locked = {},
  invariantNotes = [],
}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')
  const used = signals.filter(s => (territory?.use_signal_ids ?? []).includes(s.signal_id))
  const sigText = used.map(s => `${s.signal_id}: ${s.label} — 공존 속성 ${(s.co_occurring ?? []).join(', ') || '없음'}`).join('\n')
  const key = createHash('sha256').update(JSON.stringify([
    // genome5: 승인된 불변 요소 문장이 프롬프트에 들어갔다. genome4 캐시는 그것 없이
    //          저작된 결과라, 그대로 쓰면 승인해도 아무것도 안 달라진다.
    'genome5', langName, tier, territory?.id, sigText, JSON.stringify(profile), brandSummary, antiSimilarity, assets, locked, invariantNotes,
  ])).digest('hex').slice(0, 24)
  const file = join(cacheDir(root), `${key}.json`)
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true }

  const assetNote = `라인 선언: 라스트 ${assets.lastReuse ? '기존 재사용' : '신규 개발 예정'} · 바텀 유닛 ${assets.bottomReuse ? '기존 재사용' : '신규 개발 예정'}.`
  const tierRule = tier === 'core'
    ? `Core: 기존 라스트와 바텀 유닛을 재사용합니다 (${assetNote}). 실루엣·솔을 크게 바꾸지 마세요. Hero는 어퍼 토폴로지나 클로저에서.`
    : tier === 'push'
      ? 'Push: 라스트 또는 바텀 중 하나만 바꿀 수 있습니다.'
      : 'Signature: 새 라스트·새 몰드가 허용됩니다. 가장 멀리 가는 안입니다.'

  const data = await ask(apiKey, {
    name: 'genome', schema: GENOME_SCHEMA, effort: 'medium',
    input: `당신은 신발 디자이너입니다. 정확히 하나의 ${itemTypeEn} 컨셉을 저작하세요.

설계 영토: ${territory?.name ?? '(미지정)'} — ${territory?.consumer_role ?? ''}
${territory?.drop_signal_ids?.length ? `이 영토는 다음 신호를 일부러 버립니다: ${territory.drop_signal_ids.join(', ')} (${territory.drop_reason})` : ''}
티어: ${tier}. ${tierRule}

쓸 신호 (이것만 근거로 씁니다 · source_signal_ids에는 실제로 쓴 것만):
${sigText || '(신호 없음 — 품목의 고전 문법으로 저작하되 source_signal_ids는 빈 배열로 두세요)'}

품목 제약 (어기면 게이트에서 탈락합니다):
- 힐 높이 허용: ${profile.heelMin ?? 10}~${profile.heelMax ?? 60}mm
- 패널 수 허용: ${profile.panelMin ?? 2}~${profile.panelMax ?? 8}
- 클로저 허용: ${(profile.closures ?? []).join(', ') || 'lace'}
- 공법 허용: ${(profile.constructions ?? []).join(', ') || 'cemented'}

${brandSummary ? `브랜드 조건:\n${brandSummary}` : ''}
${Object.keys(locked).length ? `시리즈 불변 요소 (사람이 승인한 것 · 이 값은 바꾸지 마세요. Hero 는 다른 축에서 찾으세요):\n${Object.entries(locked).map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : ''}
${invariantNotes.length ? `이 시리즈가 사진에서 항상 지켜 온 것 (사람이 승인함 · 스펙 칸이 없는 것들이라 문장으로 옵니다):
${invariantNotes.map(s => `- ${s}`).join('\n')}
위 요소는 이 라인을 알아보게 하는 표식입니다. parts 의 form 과 hero_mutation 이 이것들과
어긋나면 안 됩니다. Hero 는 이것들을 지운 자리가 아니라 다른 축에서 찾으세요.` : ''}
${antiSimilarity.length ? `이미 채택된 안들과 겹치지 마세요 (구조 요약):\n${antiSimilarity.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : ''}

규칙:
- Hero Mutation은 정확히 하나. 모든 신호를 한 제품에 넣지 마세요.
- drawing_instruction과 supporting은 선으로 그릴 수 있는 것만: 비례, 선의 방향, 패널 분할, 구조.
  "미니멀한", "모던한" 같은 형용사 단독 금지. 소재 질감·색은 spec_sheet에만.
- parts 는 일곱 파트 전부 채웁니다. form 은 선으로 그릴 것만(높이·윤곽·분할·각도·러그 패턴), material 은 소재·마감만.
  아웃솔 form 은 바닥면 스케치가 그대로 그릴 수 있게 구체적으로: 러그 형태·배열·플렉스 그루브·힐/전족 컴파운드 분할.
- concept_thesis·consumer_role·hero_mutation.label은 ${langName}로, drawing_instruction·supporting·parts는 영어로.`,
  })
  const out = { ...data, territory_id: territory?.id ?? '', tier }
  writeFileSync(file, JSON.stringify(out))
  return out
}

// ── S7 · 스케치 하나에서 여러 디자인 컨셉 ────────────────────────────
//
// 이게 '베리에이션'의 실제 의미다. 스케치(형태)는 고정하고, 그 위에 서로 다른 소재·컬러·
// 창의도 조합을 N개 저작한다. 예전에는 두 갈래가 따로 있었다 — 고정 6개 표(MATERIAL_READS)를
// 인덱스로 돌리는 것과, 렌더 뒤에 스타일 슬라이더로 다시 편집하는 것. 둘 다 조사·게놈·브랜드를
// 안 봤다. 여기서는 그 셋을 근거로 컨셉을 저작하고, 컨셉마다 파트별 소재·컬러와 '왜'를 남긴다.
const CONCEPTS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['concepts'],
  properties: {
    concepts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'angle', 'palette', 'part_materials', 'why', 'render_clause'],
        properties: {
          name: { type: 'string', description: '컨셉 이름. 출력 언어로. 카드 제목이 된다' },
          angle: { type: 'string', enum: ['commercial_safe', 'material_shift', 'colour_shift', 'creative_push'], description: '이 컨셉이 앞선 컨셉과 다른 축' },
          palette: {
            type: 'array', minItems: 2, maxItems: 4,
            items: { type: 'object', additionalProperties: false, required: ['role', 'name', 'hex'],
              properties: { role: { type: 'string', enum: ['upper', 'midsole', 'outsole', 'accent'] }, name: { type: 'string' }, hex: { type: 'string' } } },
          },
          part_materials: {
            type: 'object', additionalProperties: false,
            required: ['upper', 'heel_counter', 'toe_cap', 'midsole', 'outsole', 'tongue_eyestay', 'collar', 'overlays'],
            properties: Object.fromEntries(['upper', 'heel_counter', 'toe_cap', 'midsole', 'outsole', 'tongue_eyestay', 'collar', 'overlays']
              .map(k => [k, { type: 'string', description: `${k} 소재·마감·색. 영어 한 구절. 형태는 바꾸지 않는다` }])),
          },
          why: { type: 'string', description: '왜 이 소재·색 조합인가. 조사 신호·브랜드 팔레트·시즌 팔레트 중 무엇에서 왔는지 한두 문장. 출력 언어로. 보드 카드에 실린다' },
          render_clause: { type: 'string', description: '이미지 편집 프롬프트에 그대로 들어갈 영어 문단. 파트별 소재·색을 다 적고, 형태·실루엣·아웃솔 라인은 스케치 그대로 유지하라고 명시' },
        },
      },
    },
  },
}

export async function authorConcepts(apiKey, root, {
  count = 2, genome, signals = [], brandSummary = '', brandPalette = [], seasonPalette = [], seasonMaterials = [],
  itemTypeEn = 'footwear', langName = 'English',
}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')
  const used = signals.filter(s => (genome?.source_signal_ids ?? []).includes(s.signal_id))
  const sigText = used.map(s => `${s.signal_id}: ${s.label} — ${(s.co_occurring ?? []).join(', ') || ''}`).join('\n')
  const key = createHash('sha256').update(JSON.stringify([
    'concepts1', langName, count, genome?.hero_mutation?.label, JSON.stringify(genome?.parts), sigText, brandSummary,
    brandPalette.map(c => c.hex), seasonPalette.map(c => c.hex), seasonMaterials,
  ])).digest('hex').slice(0, 24)
  const file = join(cacheDir(root), `${key}.json`)
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true }

  const parts = genome?.parts ?? {}
  const partLines = Object.entries(parts).map(([k, v]) => `- ${k}: form "${v.form}" · authored material "${v.material}"`).join('\n')

  const data = await ask(apiKey, {
    name: 'concepts', schema: CONCEPTS_SCHEMA, effort: 'medium',
    input: `당신은 신발 CMF 디자이너입니다. 하나의 확정된 형태(스케치) 위에 서로 다른 디자인 컨셉 ${count}개를 저작하세요.

형태는 바꾸지 않습니다. 실루엣·패널 분할·아웃솔 라인은 스케치 그대로입니다. 바꾸는 것은 소재·마감·컬러·창의도뿐입니다.

컨셉의 씨앗 (게놈):
- 컨셉 논지: ${genome?.concept_thesis ?? ''}
- Hero: ${genome?.hero_mutation?.label ?? ''} — ${genome?.hero_mutation?.drawing_instruction ?? ''}
- 어퍼 소재(현재): ${genome?.spec_sheet?.upper_material ?? '(미정)'}
- 파트별 형태와 저작된 소재:
${partLines || '(파트 정보 없음)'}

이 게놈이 쓴 조사 신호:
${sigText || '(없음)'}

${brandSummary ? `브랜드 조건:\n${brandSummary}\n` : ''}
브랜드 팔레트: ${brandPalette.length ? brandPalette.map(c => `${c.name} ${c.hex}`).join(', ') : '(없음)'}
시즌 팔레트(조사): ${seasonPalette.length ? seasonPalette.map(c => `${c.name} ${c.hex}`).join(', ') : '(없음)'}
시즌 소재(조사): ${seasonMaterials.join(', ') || '(없음)'}

규칙:
- ${count}개는 서로 다른 angle 이어야 합니다. 첫 번째는 commercial_safe (게놈의 소재를 브랜드 팔레트로), 두 번째부터는
  material_shift / colour_shift / creative_push 를 순서대로 씁니다. 같은 angle 두 번 금지.
- 컬러는 브랜드 팔레트 → 시즌 팔레트 → 중립 순으로 근거를 둡니다. why 에 그 출처를 적으세요.
  "취향" 은 근거가 아닙니다. 조사 신호나 팔레트를 못 대면 그 조합을 쓰지 마세요.
- part_materials 는 여덟 파트 전부. 미드솔·아웃솔의 소재와 색은 어퍼와 독립적으로 정합니다 — 어퍼 소재 하나가
  신발 전체를 덮지 않게.
- render_clause 는 이미지 모델에게 바로 주는 영어 문단입니다. 파트별로 "The heel counter is …, the midsole is …" 식으로
  다 적고, 마지막에 형태 유지 문장을 넣습니다.
- name·why 는 ${langName}로.`,
  })
  const out = { ...data, collected_at: new Date().toISOString().slice(0, 10) }
  writeFileSync(file, JSON.stringify(out))
  return out
}

// ── S8 축소판 · 실제 비전 검증 (rng QA 대체) ──────────────────────────
// 라이트 모드: 생성과 같은 벤더의 자기검사. 검사했다는 사실 자체가 난수보다 낫다.
const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['checks', 'single_object', 'notes'],
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['check', 'target', 'observed', 'pass'],
        properties: {
          check: { type: 'string' },
          target: { type: 'string' },
          observed: { type: 'string', description: '이미지에서 실제로 본 것. 추정이면 추정이라고 쓴다' },
          pass: { type: 'boolean' },
        },
      },
    },
    single_object: { type: 'boolean', description: '신발 한 짝만 있는가' },
    notes: { type: 'string' },
  },
}

export async function verifyRender(apiKey, cacheDirImages, { hash, genome, langName = 'English' }) {
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')
  if (!/^[a-f0-9]{8,64}$/.test(String(hash ?? ''))) throw new Error('bad render hash')
  const p = join(cacheDirImages, `${hash}.png`)
  if (!existsSync(p)) throw new Error('render not in cache')
  const b64 = readFileSync(p).toString('base64')

  const g = genome ?? {}
  const data = await ask(apiKey, {
    name: 'render_verify', schema: VERIFY_SCHEMA, effort: 'low', role: 'vision',
    input: [{
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `이 렌더가 설계 의도와 일치하는지 이미지를 실제로 보고 검사하세요. 본 것만 적습니다.

설계 의도:
- 토 계열: ${g.toe_family ?? 'unknown'}
- 솔 두께감: ${g.sole_mass ?? 'unknown'} (low=얇게 보임, high=두껍게 보임)
- 패널 밀도: ${g.panel_density ?? 'unknown'}
- 클로저: ${g.closure_form ?? 'unknown'}
- Hero: ${g.hero_mutation?.drawing_instruction ?? '(없음)'}

checks에는 위 다섯 항목을 각각 한 건씩. observed는 이미지에서 실제로 본 서술 (${langName}).
확신이 없으면 pass=false가 아니라 observed에 "판별 불가"라고 쓰고 pass는 관대하게 두세요 —
이 검사는 명백한 불일치를 잡는 것이지 트집이 아닙니다.`,
        },
        { type: 'input_image', image_url: `data:image/png;base64,${b64}`, detail: 'low' },
      ],
    }],
  })
  return data
}
