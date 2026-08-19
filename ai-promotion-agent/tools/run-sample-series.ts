// ── 시리즈 샘플 · 코트 하이 아카이브를 읽어 다음 시즌을 저작한다 ─────
//
// 시리즈 모드가 하는 일: 이미 있는 라인의 사진을 읽어 "이 라인이 늘 지키는 것"을 뽑고,
// 사람이 승인한 것만 잠근 뒤, 그 잠금 안에서 다음 시즌을 저작한다.
//
// 아카이브는 실제 에어 조던 1 제품 사진이다 (tools/fetch-archive.mjs 가 공개된 제품
// 소개 페이지에서 받아 업로드해 둔다). 한 실루엣의 여러 컬러웨이라 "반복되는 것"과
// "매번 바뀌는 것"이 실제로 갈린다 — 시리즈 판정을 시험하기에 맞는 입력이다.
//
// 브랜드는 가상으로 둔다. 사진은 분석 입력일 뿐이고, 그 브랜드인 척하지 않는다.
// 사진 자체는 업로드 캐시에만 남고 배포물에는 실리지 않는다 (굳힌 샘플에는 파일명과 크기만).
//
//   node tools/fetch-archive.mjs <제품 소개 페이지 URL ...>     ← 먼저
//   npx esbuild tools/run-sample-series.ts --bundle --platform=node --format=esm \
//     --outfile=.cache/run-series.mjs --external:undici \
//     --define:import.meta.env='{"BASE_URL":"/","VITE_API_BASE":"http://localhost:8080"}' --loader:.json=json
//   node .cache/run-series.mjs
//
// .cache/archive-uploads.json 과 서버(8080)가 있어야 한다.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { runPipeline } from '../src/core/pipeline'
import type { PipelineEvent, RunParams, RunState } from '../src/core/types'
import { DEFAULT_PARAMS, defaultLineProfile } from '../src/core/types'
import type { BrandIdentity } from '../src/core/brand'

// Node 기본 fetch 는 헤더를 300초까지만 기다린다. 리서치 한 레그는 그보다 오래 걸린다.
{
  const { Agent, setGlobalDispatcher } = await import('undici')
  setGlobalDispatcher(new Agent({ headersTimeout: 25 * 60_000, bodyTimeout: 25 * 60_000, connectTimeout: 30_000 }))
}

const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v) },
  removeItem: (k: string) => { mem.delete(k) },
}
;(globalThis as any).document = { documentElement: { lang: 'ko' } }
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ko-KR' }, configurable: true })

const ROOT = process.cwd()
const API = String(import.meta.env.VITE_API_BASE ?? '')
const SAMPLE_ID = 'sample_series_aj1'
const CACHE_IMG = join(ROOT, '.cache', 'images')
const CACHE_MODEL = join(ROOT, '.cache', 'models')
const PUBLIC = join(ROOT, 'public', 'samples')
const OUT_JSON = join(ROOT, 'src', 'samples', `${SAMPLE_ID}.json`)

// ── 아카이브 사진 목록을 읽는다 ─────────────────────────────────────
// 사진은 tools/fetch-archive.mjs 가 공개된 제품 소개 페이지에서 미리 받아 업로드해 뒀다.
// 여기서는 그 업로드 id 만 읽는다. 사진 자체는 업로드 캐시에만 있고 배포물에는 실리지
// 않는다 — 굳힌 샘플에는 파일명과 크기만 남는다.
function loadArchiveUploads(): { id: string; name: string; type: string; bytes: number }[] {
  const manifest = join(ROOT, '.cache', 'archive-uploads.json')
  if (!existsSync(manifest)) {
    throw new Error('.cache/archive-uploads.json 이 없다 — 먼저 tools/fetch-archive.mjs 로 아카이브 사진을 받아라')
  }
  const ups = JSON.parse(readFileSync(manifest, 'utf8')) as { id: string; name: string; type: string; bytes: number }[]
  // DNA 읽기는 "몇 장 중 몇 장에서 보였나"로 불변 요소를 가른다. 장수가 너무 적으면
  // 10/10 같은 수치가 의미를 잃는다.
  if (ups.length < 5) throw new Error(`아카이브가 ${ups.length}장뿐이다 — 시리즈 판정에는 부족하다`)
  console.log(`archive · ${ups.length} reference photos of one silhouette`)
  for (const u of ups) console.log(`  ${u.name} · ${(u.bytes / 1000).toFixed(0)}KB`)
  return ups
}

// 브랜드는 가상이다. 아카이브로 읽는 사진은 실제 제품이지만, 그 브랜드인 척하지 않는다.
// 시리즈 모드가 하는 일은 "이 실루엣이 늘 지키는 것"을 읽어 우리 라인으로 이어 가는 것이다.
const brand: BrandIdentity = {
  brandName: 'COURT SEVEN',
  tagline: '85년의 코트 하이를 지금 신을 수 있게. 형태는 그대로, 만듦새는 오늘 것으로.',
  signatureElements: ['하이 컷 파이핑 칼라', '통가죽 패널 분할', '토 박스 천공'],
  forbidden: ['과장된 청키 솔', '형광 컬러 블로킹', '합성 피혁 어퍼'],
  colorPalette: [
    { name: '오프 화이트', hex: '#F1EDE6' }, { name: '딥 레드', hex: '#9E2B2B' },
    { name: '차콜', hex: '#2A2A2C' }, { name: '샌드', hex: '#C7B49A' },
  ],
  materials: ['풀그레인 카프', '텀블드 레더', '스웨이드'],
  toneWords: ['견고한', '고전적인', '군더더기 없는'],
  logo: null,
  applyLogoToImages: false,
  md: {
    role: '스니커 편집숍 바이어 8년차',
    channel: '자사몰 + 스니커 편집숍 30곳',
    customer: '20-35세, 아카이브 실루엣을 알고 사는 사람',
    kpis: ['정상판매율 68%', '리오더율 25%', '시즌 소진 15주'],
    priceBandKrw: '18만~28만원',
    riskAppetite: 'balanced',
    pastMisses: ['작년 로우컷 변형이 하이컷 수요를 못 가져왔다', '스웨이드 단독 어퍼가 우기에 반품이 많았다'],
    dealBreakers: ['합성 피혁 어퍼', '칼라 폼이 3개월 만에 주저앉는 것', '아웃솔 조기 마모'],
    competingOnFloor: ['수입 코트화 3종', '자사 전작', '복각 러닝화'],
  },
}

const line = defaultLineProfile()
line.product = { useCase: 'daily', environment: 'urban', targetConsumer: 'unisex', season: 'SS27', climate: 'all_season' }
line.lastFit = { lastFamily: 'court basketball high-top, medium volume', baseSize: 'unknown', width: 'unknown', toeShape: 'round', toeVolume: 'medium', heelHold: 'secure', existingLastReuse: true }
line.upper = { outer: 'full-grain leather', lining: 'textile', reinforcement: 'structured', closure: 'lace', protection: 'none' }
line.bottom = { midsole: 'EVA', plate: 'none', outsole: 'rubber cupsole', stackBand: 'low', dropMm: '0-4', rocker: 'none', heel: 'none', existingBottomReuse: true }
line.construction = { lasting: 'board', soleAttachment: 'cemented' }
line.performance = { weightTargetG: '380-430', cushioning: 'moderate', stability: 'neutral', wetGrip: 'preferred', flexibility: 'stiff' }
line.commercial = { homeMarket: 'KR', referenceMarkets: ['US', 'JP'], channels: ['sneaker specialty', 'DTC'] }

let handle: ReturnType<typeof runPipeline>
const t0 = Date.now()
const stamp = () => `${String(Math.floor((Date.now() - t0) / 60000)).padStart(3, ' ')}m`

async function main() {
  // 서버가 옛 코드면 조용히 옛 파이프라인으로 돈다. 먼저 막는다.
  // GET 으로 물어본다. POST 로 빈 몸통을 보내면 서버가 그대로 받아 실제 추론 호출을
  // 일으키고(과금), 클라이언트는 8초 뒤 끊어도 서버는 끝까지 돈다.
  const probe = await fetch(`${API}/api/design/concepts`, {
    method: 'GET', signal: AbortSignal.timeout(8000),
  }).catch(() => null)
  if (!probe || probe.status === 404) {
    console.error('FAILED: this server does not have /api/design/concepts — it is running older code.')
    process.exit(1)
  }

  const uploads = loadArchiveUploads()

  const params: RunParams = {
    ...DEFAULT_PARAMS,
    mode: 'series', category: 'shoe', itemType: 'court_high', line,
    endStage: 'S5',
    // 장수를 맞춰 둔 근거 (파이프라인 예산 모델 그대로 계산):
    //   sketchCap = imageBudget * 0.4 = 19  ← 스케치 8 + 아웃솔 시트 8 = 16, 들어간다
    //   S3 진입 시 남은 장수 32, 렌더로 넘어가는 디자인 4 (renderRatio 0.5 × 8)
    //   perDesignExtras = floor((32 - 4) / 4) = 7
    //   디자인 한 장당: 컨셉 3 + 추가 뷰 2 + 컬러웨이 2 = 7  ← 딱 맞는다
    // 트렌드 샘플은 예산 24라 perDesignExtras 가 1이었고, 그 한 장을 컨셉이 가져가
    // 컬러웨이도 추가 뷰도 한 장도 안 나왔다. 두 샘플이 서로 다른 걸 보여 주게 둔다 —
    // 트렌드는 조사 깊이, 시리즈는 디자인 깊이.
    sketchCount: 6, tierRatio: [1, 1, 1], renderRatio: 0.5, viewCount: 3, colorwayCount: 2,
    // 4로 두면 네 angle 이 모두 나온다. 서버는 commercial_safe → material_shift →
    // colour_shift → creative_push 순으로 저작하므로, 2에서는 뒤의 둘이 영영 안 보인다.
    topN: 3, designsPerSketch: 4, campaignShots: 4, make3d: true,
    approvalGate: true, finalGate: true,
    imageEngine: 'detail', imageBudget: 48,
    series: {
      ...DEFAULT_PARAMS.series,
      seriesName: 'COURT SEVEN 코트 하이 아카이브',
      valueStatement: '하이컷 파이핑 칼라와 통가죽 패널 분할로 알아본다. 실루엣은 그대로 두고 만듦새만 오늘 것으로 바꾼다.',
      archiveFiles: uploads.map(u => u.name),
      uploads,
      trendSearch: true,
    },
    researchLang: 'ko',
    brand,
  }

  const st: RunState = {
    params,
    stageStatus: { S1: 'idle', S2: 'idle', S3: 'idle', S4: 'idle', S5: 'idle' },
    logs: [], signals: [], competitors: [], directions: [],
    seriesDna: null, dnaConflict: null, reportBias: null,
    trendReport: null, reportPending: false,
    dossier: null, dossierPending: false,
    designs: [], checkpoints: [], finished: false,
  }

  const onEvent = (e: PipelineEvent) => {
    switch (e.kind) {
      case 'log': st.logs.push({ stage: e.stage, text: e.text, t: Date.now() }); console.log(`${stamp()} [${e.stage}] ${e.text.slice(0, 140)}`); break
      case 'stage-start': st.stageStatus[e.stage] = 'running'; console.log(`\n${stamp()} ══ ${e.stage} start ══`); break
      case 'stage-done': st.stageStatus[e.stage] = 'done'; break
      case 'signals': st.signals = e.signals; break
      case 'competitors': st.competitors = e.items; break
      case 'directions': st.directions = e.items; break
      case 'series-dna': st.seriesDna = e.dna; break
      case 'dna-conflict': st.dnaConflict = { brandClaim: e.brandClaim, observed: e.observed }; break
      case 'report-bias': st.reportBias = e.bias; break
      case 'trend-report': st.trendReport = e.report; st.reportPending = false; break
      case 'report-pending': st.reportPending = e.on; break
      case 'dossier': st.dossier = e.dossier; st.dossierPending = false; break
      case 'dossier-pending': st.dossierPending = e.on; break
      case 'design': st.designs.push(e.design); break
      case 'design-update': {
        const i = st.designs.findIndex(d => d.spec.design_id === e.design.spec.design_id)
        if (i >= 0) st.designs[i] = e.design
        break
      }
      case 'md-floor-note': st.mdFloorNote = e.text; break
      case 'checkpoint': st.checkpoints.push(e.label); console.log(`${stamp()} ✓ ${e.label}`); break
      case 'done': st.finished = true; console.log(`\n${stamp()} ══ done (${e.endStage}) ══`); break
      // 시리즈의 핵심 게이트 · 사진에서 읽은 불변 요소를 사람이 승인해야 잠긴다.
      // 샘플이므로 전부 승인하되, 무엇을 승인했는지 로그로 남긴다.
      case 'dna-gate':
        console.log(`${stamp()} [gate] DNA · ${e.invariant.length} elements read as fixed across ${e.of} uploads:`)
        for (const el of e.invariant) console.log(`        · ${el.label} (${el.observed_in}/${e.of})`)
        console.log(`${stamp()} [gate] approving all for the sample — a real run is where a person unchecks a misread`)
        setTimeout(() => handle.approveDna?.(e.invariant.map(x => x.label)), 200)
        break
      case 'gate':
        st.stageStatus[e.stage] = 'gated'
        console.log(`${stamp()} [gate] ${e.stage} · human gate · continuing as picked (sample run)`)
        setTimeout(() => { st.stageStatus[e.stage] = e.stage === 'S4' ? 'running' : 'done'; handle.resume() }, 800)
        break
    }
  }

  console.log(`starting ${SAMPLE_ID} · series of ${uploads.length} archive photos · endStage ${params.endStage}`)
  await new Promise<void>((resolve, reject) => {
    const guard = setTimeout(() => reject(new Error('run exceeded 4h')), 4 * 3600_000)
    handle = runPipeline(params, (e) => {
      onEvent(e)
      if (e.kind === 'done') { clearTimeout(guard); resolve() }
    }, 1.6)
  })

  // ── 굳히기 · 트렌드 러너와 같은 규칙
  mkdirSync(PUBLIC, { recursive: true })
  let copied = 0, missing = 0
  const rewrite = (url: string): string => {
    const m = url.match(/\/api\/image\/file\/([a-f0-9]+\.png)/) ?? url.match(/\/api\/model\/file\/([a-f0-9]+\.glb)/)
    if (!m) return url
    const name = m[1]
    const src = name.endsWith('.glb') ? join(CACHE_MODEL, name) : join(CACHE_IMG, name)
    const dst = join(PUBLIC, name)
    if (existsSync(src)) { if (!existsSync(dst)) { copyFileSync(src, dst); copied++ } return `/samples/${name}` }
    missing++
    return url
  }
  for (const d of st.designs) {
    d.images = d.images.map(im => ({ ...im, url: rewrite(im.url) }))
    if (d.model) d.model = { ...d.model, url: rewrite(d.model.url) }
  }
  writeFileSync(OUT_JSON, JSON.stringify(st, null, 1))
  const { execFileSync } = await import('node:child_process')
  try {
    execFileSync('node', ['tools/freeze-sample-shots.mjs', SAMPLE_ID], { cwd: ROOT, stdio: 'inherit' })
    Object.assign(st, JSON.parse(readFileSync(OUT_JSON, 'utf8')))
  } catch { console.log('freeze-sample-shots failed · remote shots stay remote') }
  ;(st as any).sample = true
  // 제목은 실제로 일어난 것만 적는다. DNA 읽기가 실패하면 파이프라인은 로그만 남기고
  // 그냥 진행하므로, 승인 게이트를 돈 척하는 제목이 붙어 버릴 수 있다.
  const lockedN = st.seriesDna?.invariant.length ?? 0
  ;(st as any).sampleTitle = lockedN
    ? `Series · a court high read from ${uploads.length} Air Jordan 1 reference photos, continued as an original SS27 line under ${lockedN} approved invariants`
    : `Series · a court high read from ${uploads.length} Air Jordan 1 reference photos — the archive read returned no fixed elements`
  ;(st as any).savedAtISO = new Date().toISOString()
  writeFileSync(OUT_JSON, JSON.stringify(st, null, 1))

  const alive = st.designs.filter(d => !d.rejected)
  console.log(`\n── frozen → ${OUT_JSON}`)
  console.log(`   images copied ${copied} · missing ${missing}`)
  console.log(`   DNA: ${st.seriesDna?.invariant.length ?? 0} fixed · ${st.seriesDna?.variable.length ?? 0} variable · ${st.seriesDna?.ambiguous.length ?? 0} unclear`)
  console.log(`   designs ${st.designs.length} · alive ${alive.length} · genome ${alive.filter(d => d.spec.genome).length} · concepts ${alive.reduce((a, d) => a + d.images.filter(i => i.concept).length, 0)}`)
  console.log(`   md picks ${alive.filter(d => d.mdPick).map(d => d.spec.design_id).join(',') || 'none'} · 3D ${alive.filter(d => d.model).length}`)
  process.exit(0)
}

main().catch(e => { console.error('FAILED', e); process.exit(1) })
