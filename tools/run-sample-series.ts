// ── 러닝화 시리즈 샘플 · 앞선 트렌드 Run 이 만든 라인을 이어 간다 ─────
//
// 시리즈 모드가 하는 일: 이미 있는 시리즈의 사진을 읽어 "이 라인이 늘 지키는 것"을 뽑고,
// 사람이 승인한 것만 스펙에 잠근 뒤, 그 잠금 안에서 다음 시즌을 저작한다.
//
// 아카이브를 지어내지 않는다. sample_trend_running 이 실제로 만든 히어로 렌더를 올린다 —
// "우리 FW26 라인을 이어 간다"가 되므로 근거가 진짜다. 경쟁사 사진을 자기 아카이브라고
// 부르는 것은 이 제품이 걷어내 온 종류의 거짓말이다.
//
//   npx esbuild tools/run-sample-series.ts --bundle --platform=node --format=esm \
//     --outfile=.cache/run-series.mjs --external:undici \
//     --define:import.meta.env='{"BASE_URL":"/","VITE_API_BASE":"http://localhost:8080"}' --loader:.json=json
//   node .cache/run-series.mjs
//
// 앞선 sample_trend_running.json 이 있어야 한다. 서버(8080)도 떠 있어야 한다.
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
const SOURCE_ID = 'sample_trend_running'
const SAMPLE_ID = 'sample_series_running'
const CACHE_IMG = join(ROOT, '.cache', 'images')
const CACHE_MODEL = join(ROOT, '.cache', 'models')
const PUBLIC = join(ROOT, 'public', 'samples')
const OUT_JSON = join(ROOT, 'src', 'samples', `${SAMPLE_ID}.json`)

// ── 앞 Run 의 디자인 컷을 아카이브로 올린다 ──────────────────────────
async function uploadArchive(): Promise<{ id: string; name: string; type: string; bytes: number }[]> {
  const src = join(ROOT, 'src', 'samples', `${SOURCE_ID}.json`)
  if (!existsSync(src)) throw new Error(`${SOURCE_ID}.json is not there yet — run the trend sample first`)
  const prev = JSON.parse(readFileSync(src, 'utf8')) as RunState

  // 컬러가 들어간 제품 컷만 아카이브가 된다.
  // 스케치·아웃솔 시트는 선 그림이고, wear/concept 뷰는 캠페인 사진이라 제품 아카이브가 아니다.
  // 'design' 뷰에는 스케치당 컨셉 베리에이션이 들어 있다 — 한 시즌 라인의 실제 폭이라 넣는다.
  const cuts = prev.designs
    .filter(d => !d.rejected)
    .flatMap(d => d.images.filter(i => i.view === 'lateral' || i.view === 'design'))
    .slice(0, 12)
  if (cuts.length < 4) throw new Error(`only ${cuts.length} archive cuts available — the series read needs more`)

  const files = cuts.map((im, i) => {
    // 굳힌 샘플은 /samples/<hash>.png · 원본은 public/samples 아니면 이미지 캐시에 있다
    const name = basename(im.url)
    const p = [join(PUBLIC, name), join(CACHE_IMG, name)].find(existsSync)
    if (!p) return null
    return { name: `stride-fw26-${String(i + 1).padStart(2, '0')}.png`, type: 'image/png', dataBase64: readFileSync(p).toString('base64') }
  }).filter(Boolean) as { name: string; type: string; dataBase64: string }[]

  // 한 번에 다 보내지 않는다. 서버 본문 상한은 48MB이고 base64 는 원본보다 1/3 크다.
  // 지금 컷으로는 20MB 안쪽이지만 렌더 엔진을 올리면 장당 용량이 커진다 —
  // 90분짜리 Run 이 첫 요청에서 죽는 것만은 막는다.
  const out: { id: string; name: string; type: string; bytes: number }[] = []
  const BATCH = 4
  for (let i = 0; i < files.length; i += BATCH) {
    const chunk = files.slice(i, i + BATCH)
    const r = await fetch(`${API}/api/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: chunk }), signal: AbortSignal.timeout(120_000),
    })
    const j = await r.json()
    if (j.error) throw new Error(`upload batch ${i / BATCH + 1}: ${j.error}`)
    out.push(...j.files)
  }
  const mb = files.reduce((a, f) => a + f.dataBase64.length, 0) / 1e6
  console.log(`archive uploaded · ${out.length} cuts from ${SOURCE_ID} · ${mb.toFixed(1)}MB base64 in ${Math.ceil(files.length / BATCH)} batches`)
  return out
}

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

const line = defaultLineProfile()
line.product = { useCase: 'running', environment: 'urban', targetConsumer: 'unisex', season: 'SS27', climate: 'all_season' }
line.lastFit = { lastFamily: 'performance running, medium volume', baseSize: 'unknown', width: 'unknown', toeShape: 'round', toeVolume: 'medium', heelHold: 'secure', existingLastReuse: true }
line.upper = { outer: 'engineered mesh', lining: 'moisture-management textile', reinforcement: 'light', closure: 'lace', protection: 'none' }
line.bottom = { midsole: 'supercritical foam', plate: 'none', outsole: 'segmented rubber', stackBand: 'high', dropMm: '6-10', rocker: 'moderate', heel: 'none', existingBottomReuse: true }
line.construction = { lasting: 'strobel', soleAttachment: 'cemented' }
line.performance = { weightTargetG: '255-280', cushioning: 'high', stability: 'neutral_stable', wetGrip: 'preferred', flexibility: 'moderate' }
line.commercial = { homeMarket: 'KR', referenceMarkets: ['US', 'JP'], channels: ['running specialty', 'DTC'] }

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

  const uploads = await uploadArchive()

  const params: RunParams = {
    ...DEFAULT_PARAMS,
    mode: 'series', category: 'shoe', itemType: 'running', line, linePreset: 'road_daily',
    endStage: 'S5',
    // 장수를 맞춰 둔 근거 (파이프라인 예산 모델 그대로 계산):
    //   sketchCap = imageBudget * 0.4 = 19  ← 스케치 8 + 아웃솔 시트 8 = 16, 들어간다
    //   S3 진입 시 남은 장수 32, 렌더로 넘어가는 디자인 4 (renderRatio 0.5 × 8)
    //   perDesignExtras = floor((32 - 4) / 4) = 7
    //   디자인 한 장당: 컨셉 3 + 추가 뷰 2 + 컬러웨이 2 = 7  ← 딱 맞는다
    // 트렌드 샘플은 예산 24라 perDesignExtras 가 1이었고, 그 한 장을 컨셉이 가져가
    // 컬러웨이도 추가 뷰도 한 장도 안 나왔다. 두 샘플이 서로 다른 걸 보여 주게 둔다 —
    // 트렌드는 조사 깊이, 시리즈는 디자인 깊이.
    sketchCount: 8, tierRatio: [1, 1, 1], renderRatio: 0.5, viewCount: 3, colorwayCount: 2,
    // 4로 두면 네 angle 이 모두 나온다. 서버는 commercial_safe → material_shift →
    // colour_shift → creative_push 순으로 저작하므로, 2에서는 뒤의 둘이 영영 안 보인다.
    topN: 3, designsPerSketch: 4, campaignShots: 4, make3d: true,
    approvalGate: true, finalGate: true,
    imageEngine: 'detail', imageBudget: 48,
    series: {
      ...DEFAULT_PARAMS.series,
      seriesName: 'STRIDE LAB FW26 데일리 트레이너',
      valueStatement: '노출 미드솔 사이드월과 최소 패널 어퍼로 알아본다. 무게를 늘리는 장식은 넣지 않는다.',
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

  console.log(`starting ${SAMPLE_ID} · series of ${SOURCE_ID} · endStage ${params.endStage}`)
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
    ? `Series · STRIDE LAB SS27, carrying the FW26 running line forward through ${lockedN} approved DNA elements`
    : 'Series · STRIDE LAB SS27, continuing the FW26 running line — the archive read returned no fixed elements'
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
