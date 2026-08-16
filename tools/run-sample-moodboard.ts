// ── 무드보드 샘플 · 올린 문서 하나만 읽고 디자인한다 ────────────────────
//
// 무드보드 모드가 하는 일: 외부 조사를 전혀 하지 않는다. 업로드한 트렌드 덱만 읽고,
// 거기서 읽어 낸 것을 신발 문법으로 옮긴다. 문서에 없는 것은 없다고 말한다.
// 그래서 이 샘플은 "조사 없이도 근거가 있는가"를 보여 주는 자리다.
//
// 근거 문서는 실제 MICAM FW25 풋웨어 트렌드 프레스킷(7.4MB PDF)이다. 이미 업로드
// 캐시에 있으므로 다시 올리지 않고 그 id 를 그대로 쓴다.
//
//   npx esbuild tools/run-sample-moodboard.ts --bundle --platform=node --format=esm \
//     --outfile=.cache/run-mood.mjs --external:undici \
//     --define:import.meta.env='{"BASE_URL":"/","VITE_API_BASE":"http://localhost:8080"}' --loader:.json=json
//   node .cache/run-mood.mjs
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runPipeline } from '../src/core/pipeline'
import type { PipelineEvent, RunParams, RunState } from '../src/core/types'
import { DEFAULT_PARAMS, defaultLineProfile } from '../src/core/types'
import type { BrandIdentity } from '../src/core/brand'

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
const SAMPLE_ID = 'sample_moodboard_micam'
const CACHE_IMG = join(ROOT, '.cache', 'images')
const CACHE_MODEL = join(ROOT, '.cache', 'models')
const PUBLIC = join(ROOT, 'public', 'samples')
const OUT_JSON = join(ROOT, 'src', 'samples', `${SAMPLE_ID}.json`)

// 업로드 캐시에 이미 있는 실제 문서. 파일명은 meta.json 이 들고 있다.
const DOC = { id: '277b889979f6cb0254869e58', name: 'MICAM_FW25_footwear_trends.pdf', type: 'application/pdf', bytes: 7_400_000 }

const brand: BrandIdentity = {
  brandName: 'ATELIER NORD',
  tagline: '유행을 읽되 따라가지 않는다. 한 시즌 더 신을 수 있게 만든다.',
  signatureElements: ['클린 토 라인', '컵솔 스티치 노출', '단색 어퍼에 대비 아일릿'],
  forbidden: ['과장된 로고 플레이', '형광 컬러', '레이스 없는 슬립온'],
  colorPalette: [
    { name: '오프 화이트', hex: '#EDE9E2' }, { name: '잉크 네이비', hex: '#1E2A3A' },
    { name: '탠 레더', hex: '#A9764B' }, { name: '올리브', hex: '#5C6248' },
  ],
  materials: ['풀그레인 카프', '스웨이드', '재생 캔버스'],
  toneWords: ['담백한', '단단한', '오래가는'],
  logo: null,
  applyLogoToImages: false,
  md: {
    role: '컨템포러리 편집숍 바이어 6년차',
    channel: '자사몰 + 국내 편집숍 20곳',
    customer: '25-35세, 스니커즈를 옷에 맞추는 사람',
    kpis: ['정상판매율 65%', '시즌 소진 16주'],
    priceBandKrw: '19만~29만원',
    riskAppetite: 'balanced',
    pastMisses: ['작년 청키 솔 모델이 편집숍에서 반응이 없었다'],
    dealBreakers: ['합피 어퍼', '3개월 만에 밑창 분리'],
    competingOnFloor: ['수입 코트화 2종', '자사 전작'],
  },
}

const line = defaultLineProfile()
line.product = { useCase: 'daily', environment: 'urban', targetConsumer: 'unisex', season: 'FW26', climate: 'all_season' }
line.upper = { outer: 'full-grain leather', lining: 'pigskin', reinforcement: 'medium', closure: 'lace', protection: 'none' }
line.bottom = { midsole: 'EVA', plate: 'none', outsole: 'rubber cupsole', stackBand: 'low', dropMm: '0-4', rocker: 'none', heel: 'none' }
line.construction = { lasting: 'board', soleAttachment: 'cemented' }
line.commercial = { homeMarket: 'KR', referenceMarkets: ['JP'], channels: ['multi-brand retail', 'DTC'] }

let handle: ReturnType<typeof runPipeline>
const t0 = Date.now()
const stamp = () => `${String(Math.floor((Date.now() - t0) / 60000)).padStart(3, ' ')}m`

async function main() {
  const probe = await fetch(`${API}/api/design/concepts`, { method: 'GET', signal: AbortSignal.timeout(8000) }).catch(() => null)
  if (!probe || probe.status === 404) {
    console.error('FAILED: server is running older code (no /api/design/concepts)')
    process.exit(1)
  }
  if (!existsSync(join(ROOT, '.cache', 'uploads', `${DOC.id}.pdf`))) {
    console.error(`FAILED: the source document is not in the upload cache (${DOC.id}.pdf)`)
    process.exit(1)
  }

  const params: RunParams = {
    ...DEFAULT_PARAMS,
    mode: 'moodboard', category: 'shoe', itemType: 'court_sneaker', line,
    endStage: 'S5',
    // 시리즈 샘플과 같은 배분. 상한 48이면 디자인마다 컨셉 2 + 추가 뷰 2 + 컬러웨이 2 가 들어간다.
    sketchCount: 8, tierRatio: [1, 1, 1], renderRatio: 0.5, viewCount: 3, colorwayCount: 2,
    // 3이면 commercial_safe / material_shift / colour_shift 까지 나온다.
    topN: 3, designsPerSketch: 3, campaignShots: 4, make3d: true,
    approvalGate: true, finalGate: true,
    imageEngine: 'detail', imageBudget: 48,
    moodboard: { files: [DOC.name], uploads: [DOC], notes: '' },
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
      case 'gate':
        st.stageStatus[e.stage] = 'gated'
        console.log(`${stamp()} [gate] ${e.stage} · human gate · continuing as picked (sample run)`)
        setTimeout(() => { st.stageStatus[e.stage] = e.stage === 'S4' ? 'running' : 'done'; handle.resume() }, 800)
        break
    }
  }

  console.log(`starting ${SAMPLE_ID} · moodboard of ${DOC.name} · endStage ${params.endStage}`)
  await new Promise<void>((resolve, reject) => {
    const guard = setTimeout(() => reject(new Error('run exceeded 4h')), 4 * 3600_000)
    handle = runPipeline(params, (e) => {
      onEvent(e)
      if (e.kind === 'done') { clearTimeout(guard); resolve() }
    }, 1.6)
  })

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
  ;(st as any).sampleTitle = 'Moodboard · one uploaded MICAM deck, read and translated into court sneakers with no outside research'
  ;(st as any).savedAtISO = new Date().toISOString()
  writeFileSync(OUT_JSON, JSON.stringify(st, null, 1))

  const alive = st.designs.filter(d => !d.rejected)
  console.log(`\n── frozen → ${OUT_JSON}`)
  console.log(`   images copied ${copied} · missing ${missing}`)
  console.log(`   signals from the document ${st.signals.length} · designs ${st.designs.length} · alive ${alive.length}`)
  console.log(`   concepts ${alive.reduce((a, d) => a + d.images.filter(i => i.concept).length, 0)} · colourways ${alive.reduce((a, d) => a + d.images.filter(i => i.colorway).length, 0)} · 3D ${alive.filter(d => d.model).length}`)
  process.exit(0)
}

main().catch(e => { console.error('FAILED', e); process.exit(1) })
