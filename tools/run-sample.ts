// ── 브라우저 없이 실제 파이프라인을 돌려 샘플 JSON 으로 굳힌다 ─────────
//
// 앱이 쓰는 runPipeline 을 그대로 부른다 — 별도 경로가 아니라 같은 코드다.
// 게이트는 자동으로 통과시킨다: DNA 승인은 전부 승인, S2·S4 게이트는 그대로 계속.
// (데모 샘플이므로 사람의 판단이 들어갈 자리는 로그에 남기고 넘어간다.)
//
//   npx esbuild tools/run-sample.ts --bundle --platform=node --format=esm \
//     --outfile=.cache/run-sample.mjs --define:import.meta.env='{"BASE_URL":"/","VITE_API_BASE":"http://localhost:8080"}' \
//     --loader:.json=json
//   node .cache/run-sample.mjs
//
// 서버(8080)가 떠 있어야 한다. 끝나면 src/samples/<id>.json 과 public/samples/ 로 사진·GLB 를 옮긴다.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runPipeline } from '../src/core/pipeline'
import type { PipelineEvent, RunParams, RunState } from '../src/core/types'
import { DEFAULT_PARAMS, defaultLineProfile , isSketchView } from '../src/core/types'
import type { BrandIdentity } from '../src/core/brand'

// Node 의 기본 fetch 는 헤더 응답을 300초까지만 기다린다 (undici 기본값). 리서치 한 레그는
// 그보다 오래 걸린다. 브라우저에는 이 제한이 없으므로, 여기서만 전역 dispatcher 를 길게 잡는다.
{
  const { Agent, setGlobalDispatcher } = await import('undici')
  setGlobalDispatcher(new Agent({ headersTimeout: 25 * 60_000, bodyTimeout: 25 * 60_000, connectTimeout: 30_000 }))
}

// Node 에는 localStorage 가 없다 · i18n/brand 가 손대는 최소만 채운다
const mem = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, v) },
  removeItem: (k: string) => { mem.delete(k) },
}
;(globalThis as any).document = { documentElement: { lang: 'ko' } }
// Node 24 의 navigator 는 getter 뿐이라 대입이 안 된다 · 정의로 덮는다
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ko-KR' }, configurable: true })

const ROOT = process.cwd()
const SAMPLE_ID = 'sample_trend_running'
const CACHE_IMG = join(ROOT, '.cache', 'images')
const CACHE_MODEL = join(ROOT, '.cache', 'models')
const OUT_PUBLIC = join(ROOT, 'public', 'samples')
const OUT_JSON = join(ROOT, 'src', 'samples', `${SAMPLE_ID}.json`)

// ── 브랜드 · 러닝 전문 · 첫 세션의 STRIDE LAB 그대로 ─────────────────
const brand: BrandIdentity = {
  brandName: 'STRIDE LAB',
  tagline: '매일 달리는 사람을 위한 도구. 장식은 무게다.',
  signatureElements: ['노출 미드솔 사이드월', '최소 패널 어퍼', '힐 카운터 리플렉티브 스트립'],
  forbidden: ['장식용 하드웨어', '과장된 청키 실루엣', '가짜 통기구'],
  colorPalette: [
    { name: '무광 블랙', hex: '#1A1A1C' }, { name: '코발트', hex: '#1F49C4' },
    { name: '실버', hex: '#C8CCD2' }, { name: '라임', hex: '#C7F04A' },
  ],
  materials: ['엔지니어드 메시', '수퍼크리티컬 EVA', '리사이클 니트'],
  toneWords: ['절제된', '기능적', '날카로운'],
  logo: null,
  applyLogoToImages: false,
  md: {
    role: '러닝 전문점 바이어 9년차',
    channel: '러닝 전문 편집숍 · 러닝 크루 커뮤니티 공동구매',
    customer: '주 3회 이상 달리는 30-40대, 하프 이상 대회 경험',
    kpis: ['정상판매율 70%', '리오더율 30%', '시즌 소진 14주'],
    priceBandKrw: '17만~26만원',
    riskAppetite: 'conservative',
    pastMisses: ['작년 광폭 플랫폼 모델이 러너들에게 무겁다고 반품됐다', '리플렉티브만 강조한 모델이 낮에 안 팔렸다'],
    dealBreakers: ['300g 초과', '접지력이 불명확한 아웃솔', '세탁 불가 어퍼'],
    competingOnFloor: ['경쟁사 데일리 트레이너 2종', '자사 전작', '해외 카본 레이서'],
  },
}

// ── 라인 · 로드 러닝 데일리 프리셋 + 주 시장 KR, 참조 US·JP ──────────
const line = defaultLineProfile()
line.product = { useCase: 'running', environment: 'urban', targetConsumer: 'unisex', season: 'FW26', climate: 'all_season' }
line.lastFit = { lastFamily: 'performance running, medium volume', baseSize: 'unknown', width: 'unknown', toeShape: 'round', toeVolume: 'medium', heelHold: 'secure', existingLastReuse: false }
line.upper = { outer: 'engineered mesh', lining: 'moisture-management textile', reinforcement: 'light', closure: 'lace', protection: 'none' }
line.bottom = { midsole: 'supercritical foam', plate: 'none', outsole: 'segmented rubber', stackBand: 'high', dropMm: '6-10', rocker: 'moderate', heel: 'none', existingBottomReuse: false }
line.construction = { lasting: 'strobel', soleAttachment: 'cemented' }
line.performance = { weightTargetG: '260-290', cushioning: 'high', stability: 'moderate', wetGrip: 'preferred', flexibility: 'moderate' }
line.commercial = { homeMarket: 'KR', referenceMarkets: ['US', 'JP'], channels: ['running specialty', 'DTC'] }

const params: RunParams = {
  ...DEFAULT_PARAMS,
  mode: 'trend', category: 'shoe', itemType: 'running', line, linePreset: 'road_daily',
  endStage: 'S5',
  sketchCount: 12, tierRatio: [1, 1, 1], renderRatio: 0.5, viewCount: 3, colorwayCount: 2,
  topN: 3, designsPerSketch: 2, variationCount: 3, campaignShots: 4, make3d: true,
  approvalGate: true, finalGate: true,
  imageEngine: 'detail', imageBudget: 24,
  trend: {
    ...DEFAULT_PARAMS.trend,
    competitors: ['ASICS', 'Nike Running', 'HOKA'],
    priceBand: 'contemporary', priceMinKrw: 170000, priceMaxKrw: 260000, adjacentBand: true,
    objectives: ['live_commercial_pulse', 'design_trends', 'performance_tech', 'next_season_forecast'],
  },
  researchLang: 'ko',
  brand,
}

// ── 상태 축적 · App.tsx 의 onEvent 리듀서와 같은 규칙 ─────────────────
const st: RunState = {
  params,
  stageStatus: { S1: 'idle', S2: 'idle', S3: 'idle', S4: 'idle', S5: 'idle' },
  logs: [], signals: [], competitors: [], directions: [],
  seriesDna: null, dnaConflict: null, reportBias: null,
  trendReport: null, reportPending: false,
  dossier: null, dossierPending: false,
  designs: [], checkpoints: [], finished: false,
}

let handle: ReturnType<typeof runPipeline>
let images = 0
const t0 = Date.now()
const stamp = () => `${String(Math.floor((Date.now() - t0) / 60000)).padStart(3, ' ')}m`

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
      const n = st.designs.reduce((a, d) => a + d.images.length, 0)
      if (n !== images) { images = n }
      break
    }
    case 'md-floor-note': st.mdFloorNote = e.text; break
    case 'checkpoint': st.checkpoints.push(e.label); console.log(`${stamp()} ✓ ${e.label}`); break
    case 'done': st.finished = true; console.log(`\n${stamp()} ══ done (${e.endStage}) ══`); break
    // 게이트는 데모용으로 자동 통과 · 로그에 사람 자리가 있었음을 남긴다
    case 'dna-gate':
      console.log(`${stamp()} [gate] DNA approval · auto-approving all ${e.invariant.length} for the sample`)
      setTimeout(() => handle.approveDna?.(e.invariant.map(x => x.label)), 200)
      break
    case 'gate':
      st.stageStatus[e.stage] = 'gated'
      console.log(`${stamp()} [gate] ${e.stage} · human gate · continuing as picked (sample run)`)
      setTimeout(() => { st.stageStatus[e.stage] = e.stage === 'S4' ? 'running' : 'done'; handle.resume() }, 800)
      break
  }
}

async function main() {
  // 서버가 옛 코드를 물고 있으면 Run 전체가 조용히 옛 파이프라인으로 돈다.
  // 실제로 그렇게 20분을 버렸다 — Windows 에서 pkill 이 안 먹어 옛 프로세스가 포트를 쥐고 있었고,
  // 새 서버는 바인드 실패로 죽었는데 러너는 그걸 모른 채 옛 스키마로 조사를 마쳤다.
  // 이 Run 이 필요로 하는 새 라우트가 없으면 여기서 멈춘다.
  {
    const base = String(import.meta.env.VITE_API_BASE ?? '')
    const r = await fetch(`${base}/api/design/concepts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), signal: AbortSignal.timeout(8000),
    }).catch((e: Error) => (String(e.name) === 'TimeoutError' ? { status: 200 } as Response : null))
    if (!r || r.status === 404) {
      console.error('FAILED: the server on this port does not have /api/design/concepts — it is running older code.')
      console.error('Kill every node "standalone.mjs" process (PowerShell: Stop-Process -Id <pid> -Force) and start it again.')
      process.exit(1)
    }
  }
  console.log(`starting ${SAMPLE_ID} · endStage ${params.endStage} · budget ${params.imageBudget}`)
  await new Promise<void>((resolve, reject) => {
    const guard = setTimeout(() => reject(new Error('run exceeded 4h')), 4 * 3600_000)
    handle = runPipeline(params, (e) => {
      onEvent(e)
      if (e.kind === 'done') { clearTimeout(guard); resolve() }
    }, 1.6)
  })

  // ── 굳히기 · 이미지·GLB 를 public/samples 로 옮기고 URL 을 /samples/ 로 바꾼다
  mkdirSync(OUT_PUBLIC, { recursive: true })
  let copied = 0, missing = 0
  const rewrite = (url: string): string => {
    const m = url.match(/\/api\/image\/file\/([a-f0-9]+\.png)/) ?? url.match(/\/api\/model\/file\/([a-f0-9]+\.glb)/)
    if (!m) return url
    const name = m[1]
    const src = name.endsWith('.glb') ? join(CACHE_MODEL, name) : join(CACHE_IMG, name)
    const dst = join(OUT_PUBLIC, name)
    if (existsSync(src)) { if (!existsSync(dst)) { copyFileSync(src, dst); copied++ } return `/samples/${name}` }
    missing++
    return url
  }
  for (const d of st.designs) {
    d.images = d.images.map(im => ({ ...im, url: rewrite(im.url) }))
    if (d.model) d.model = { ...d.model, url: rewrite(d.model.url) }
  }
  // 수집 사진(경쟁 제품·도시에 키아이템)은 아직 원격 URL 이다. 정적 배포에는 /api/shot 프록시가
  // 없어 전부 빈 칸이 된다 — 첫 러닝 샘플에서 실제로 그랬다. 굳히기까지 러너의 일이다.
  writeFileSync(OUT_JSON, JSON.stringify(st, null, 1))
  const { execFileSync } = await import('node:child_process')
  try {
    execFileSync('node', ['tools/freeze-sample-shots.mjs', SAMPLE_ID], { cwd: ROOT, stdio: 'inherit' })
    Object.assign(st, JSON.parse(readFileSync(OUT_JSON, 'utf8')))
  } catch (e) {
    console.log('freeze-sample-shots failed · remote shots stay remote:', String((e as Error).message).slice(0, 120))
  }
  ;(st as any).sample = true
  ;(st as any).sampleTitle = 'Trend · Road running FW26, market-scoped research, tiered sources, repaired renders and a human gate'
  ;(st as any).savedAtISO = new Date().toISOString()
  writeFileSync(OUT_JSON, JSON.stringify(st, null, 1))

  const alive = st.designs.filter(d => !d.rejected)
  const withRender = alive.filter(d => d.images.some(i => !isSketchView(i.view)))
  const withQa = alive.filter(d => d.qa.length)
  const repaired = alive.filter(d => d.images.some(i => i.origin === 'regenerated_hq'))
  const tiered = st.signals.filter(s => s.source_tiers?.length)
  console.log(`\n── frozen → ${OUT_JSON}`)
  console.log(`   images copied ${copied} · missing ${missing}`)
  console.log(`   designs ${st.designs.length} · alive ${alive.length} · rendered ${withRender.length} · vision-checked ${withQa.length} · repaired ${repaired.length}`)
  console.log(`   signals ${st.signals.length} · with source tiers ${tiered.length} · top ${alive.filter(d => d.isTop).map(d => d.spec.design_id).join(',')}`)
  console.log(`   md picks ${alive.filter(d => d.mdPick).map(d => d.spec.design_id).join(',') || 'none'} · 3D ${alive.filter(d => d.model).length}`)
  process.exit(0)
}

main().catch(e => { console.error('FAILED', e); process.exit(1) })
