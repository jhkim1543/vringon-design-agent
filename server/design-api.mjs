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
    'spec_sheet', 'source_signal_ids', 'preserve', 'forbidden'],
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
    spec_sheet: {
      type: 'object', additionalProperties: false,
      required: ['heel_height_mm', 'panel_count', 'sole_construction', 'upper_material'],
      properties: {
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
}) {
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')
  const used = signals.filter(s => (territory?.use_signal_ids ?? []).includes(s.signal_id))
  const sigText = used.map(s => `${s.signal_id}: ${s.label} — 공존 속성 ${(s.co_occurring ?? []).join(', ') || '없음'}`).join('\n')
  const key = createHash('sha256').update(JSON.stringify([
    'genome1', langName, tier, territory?.id, sigText, JSON.stringify(profile), brandSummary, antiSimilarity,
  ])).digest('hex').slice(0, 24)
  const file = join(cacheDir(root), `${key}.json`)
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true }

  const tierRule = tier === 'core'
    ? 'Core: 기존 라스트와 바텀 유닛을 재사용합니다. 실루엣·솔을 크게 바꾸지 마세요. Hero는 어퍼 토폴로지나 클로저에서.'
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
${antiSimilarity.length ? `이미 채택된 안들과 겹치지 마세요 (구조 요약):\n${antiSimilarity.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : ''}

규칙:
- Hero Mutation은 정확히 하나. 모든 신호를 한 제품에 넣지 마세요.
- drawing_instruction과 supporting은 선으로 그릴 수 있는 것만: 비례, 선의 방향, 패널 분할, 구조.
  "미니멀한", "모던한" 같은 형용사 단독 금지. 소재 질감·색은 spec_sheet에만.
- concept_thesis·consumer_role·hero_mutation.label은 ${langName}로, drawing_instruction·supporting은 영어로.`,
  })
  const out = { ...data, territory_id: territory?.id ?? '', tier }
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
