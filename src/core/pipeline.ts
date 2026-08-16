// ── 파이프라인 엔진 S1~S5 · 진행 스트리밍·승인 게이트·체크포인트 ────
//
// 이 파일은 일부러 하나다. 위에서 아래로 S1 → S5 순서로 읽힌다. '══ S' 로 단계 사이를 뛴다.
//
//   S1  조사        경쟁사(브랜드별 병렬) · 리테일 펄스 · 트렌드 신호(다단계, 미드솔/아웃솔·소셜·인접 카테고리
//                   하위 질문 고정) · 시즌 도시에. 전부 주 시장 + 참조 시장 안에서. 실패는 실패로 두고 대체하지 않는다.
//   S1b 신호→힌트   신호가 스펙 필드를 요구하면 프로필 범위에 통과시켜 hintApplied/hintBlocked 로 남긴다.
//   S2  영토·게놈   LLM 이 설계 영토 6개를 계획하고, 안마다 게놈(구조 축 + 파트별 form/material + 툴링)을 저작한다.
//                   다양성 게이트가 겹치는 축만 지목해 재저작. 3회 실패면 겹침을 카드에 적고 채택.
//   S2  스펙·룰     generateSpec 이 게놈 힌트를 클램프하고, 룰 엔진(S-01..S-11)과 원가 모델이 검사한다.
//   S2  스케치      기준 측면 선화 + 아웃솔(바닥면) 도면. 형태만 — 색·소재는 여기 없다. → approvalGate
//   S3  디자인      스케치를 사진으로. 스케치당 컨셉 N개(첫 번째=기준 렌더=commercial_safe, 이후 소재/컬러/창의) —
//                   컨셉은 서버가 조사·게놈·브랜드를 근거로 저작하고 파트별 소재·색과 '왜'를 들고 온다.
//                   추가 뷰·컬러웨이는 기준 렌더의 편집. 비전 검사 → 실패 항목만 1회 수리 → 재검사.
//   S4  선정        통과 > 미검증 > 실패 순 + 원가순 → MD 페르소나 리뷰(있으면 그 선택이 최종) → finalGate
//                   (캠페인·3D 지출 전에 사람이 슬레이트 확인) → 캠페인 컷(착용·연출)
//   S5  3D          선정작마다 히어로 렌더 한 장 → GLB.
//
// 게이트 셋(approvalGate·dna-gate·finalGate)은 전부 Promise 다. UI 가 PipelineHandle 로 풀어 준다.
// 사람의 카드 판정은 handle.setVerdict 로 들어온다 — 화면의 Design 복사본과 파이프라인 인스턴스는 다르다.──
import type { Design, DesignSpec, DesignTier, PipelineEvent, Rationale, RunParams, Signal, Stage, Territory } from './types'
import { PACKS, profileOf, resetSeq, tierCapRule, viewSetFor } from './packs'
import { blockedNarrative, deriveSpecHints, deriveSpecHintsFrom, drivingFromHint, hintNarrative, locksFromSeries, reconcileHint, signalCombos } from './signalSpec'
import type { SpecHint } from './signalSpec'
import { makeRng } from './rng'
import {
  colorwayEditPrompt, conceptPrompt, conceptRenderPrompt, editImage, generateImage, outsoleSketchPrompt, planColorways, renderFromSketchPrompt, renderPrompt,
  generateModel, sketchPrompt, silhouetteRead, stampLogo, viewEditPrompt, wearEditPrompt,
} from './aiClient'
import type { TrendClauseInput } from './aiClient'
import { fetchCompetitors, fetchDossier, fetchRetailPulse, fetchTrends, pulseToCompetitors, toBias, toCompetitors, toSignals, setRunLang } from './research'
import { readMoodboard, readSeries, reviewAsMd, toSeriesDna } from './uploads'
import { authorConcepts, authorGenome, brandSummaryOf, diversityGate, genomeDigest, genomeToHint, planTerritories, verifyRender } from './genome'
import type { BrandIdentity } from './brand'
import { checkBrandFit } from './brand'
import type { Genome } from './genome'
import { getLang, LANG_NAME } from './i18n'
import { campaignCount, lineFingerprint, MODE_LABEL, MODE_SCOPE, TIER_LABEL, TYPE_EN, TYPE_LABEL , isSketchView } from './types'
import { ENGINES } from './imageEngines'

export type Emit = (e: PipelineEvent) => void

export interface PipelineHandle {
  resume: () => void         // 승인 게이트 해제
  cancel: () => void
  /** 시리즈 DNA 가설 승인 · 사람이 확인한 요소 label 만 스펙을 잠글 수 있다 (규칙 16) */
  approveDna?: (approvedLabels: string[]) => void
  /** 사람이 카드에서 내린 판정 · 최종 게이트에서 지출 대상을 거른다 (규칙 9) */
  setVerdict?: (id: string, v: 'approve' | 'reject') => void
}

/** 컨셉 촬영에 실을 무드 한 줄. 브랜드 톤이 있으면 그것을 쓴다. */
function st_mood(params: RunParams): string {
  const b = params.brand
  if (b?.toneWords?.length) return b.toneWords.join(', ')
  return ''
}

const STAGE_ORDER: Stage[] = ['S1', 'S2', 'S3', 'S4', 'S5']

function sleep(ms: number, cancelled: () => boolean): Promise<void> {
  return new Promise(res => {
    const t = setTimeout(res, ms)
    if (cancelled()) { clearTimeout(t); res() }
  })
}

/** 동시 실행 상한을 둔 작업 풀 · 한 건 실패가 전체를 멈추지 않는다 (부분 실패 격리) */
async function pool<T>(items: T[], limit: number, worker: (item: T, i: number) => Promise<void>): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      try { await worker(items[i], i) } catch { /* 개별 실패는 worker 내부에서 기록 */ }
    }
  })
  await Promise.all(runners)
}

export function runPipeline(params: RunParams, emit: Emit, speed = 1): PipelineHandle {
  let cancelled = false
  let gateResolve: (() => void) | null = null
  let dnaResolve: ((labels: string[]) => void) | null = null
  // 사람의 카드 판정 · App 이 넘겨준다. 파이프라인의 Design 객체는 화면의 복사본과
  // 다른 인스턴스라, 화면에서 누른 거절이 여기로 직접 오지 않으면 게이트가 보지 못한다.
  const humanVerdicts = new Map<string, 'approve' | 'reject'>()
  const isCancelled = () => cancelled

  const handle: PipelineHandle = {
    resume() { gateResolve?.(); gateResolve = null },
    cancel() { cancelled = true; gateResolve?.(); dnaResolve?.([]) },
    approveDna(labels) { dnaResolve?.(labels); dnaResolve = null },
    setVerdict(id, v) { humanVerdicts.set(id, v) },
  }

  ;(async () => {
    const rng = makeRng(params.sketchCount * 7919 + params.mode.length * 131 + 17)
    resetSeq()
    const pack = PACKS.shoe
    const views = viewSetFor(params.itemType)
    const wait = (ms: number) => sleep(ms / speed, isCancelled)
    const upto = STAGE_ORDER.indexOf(params.endStage)
    // 시즌 · 위저드의 season(FW26/SS27/carryover) 이 조사에 실려야 한다. 예전에는 '2026 F/W' 가 하드코딩돼
    // 컨트롤을 바꿔도 아무것도 안 바뀌었다. carryover 는 시즌이 아니라 상태라 현재 시즌으로 둔다.
    const seasonCode = String(params.line?.product?.season ?? 'FW26')
    // dd 가 아니라 \d\d 다. 리터럴 'dd' 로 적혀 있던 동안에는 'FWdd' 라는 불가능한
    // 문자열만 통과해서, 위저드가 무엇을 고르든 전부 아래 폴백으로 떨어졌다.
    // FW26 은 폴백과 우연히 같아 티가 안 났고, SS27 을 고르면 SS27 이라 적힌 채
    // 직전 FW 시즌을 조사하는 결과가 나왔다.
    const seasonKo = /^FW\d\d$/.test(seasonCode) ? `20${seasonCode.slice(2)} F/W`
      : /^SS\d\d$/.test(seasonCode) ? `20${seasonCode.slice(2)} S/S` : '2026 F/W'
    const seasonDossier = /^(FW|SS)\d\d$/.test(seasonCode) ? seasonCode : 'FW26'
    // 실제 생성 상한 · 초과분은 SVG 폴백. 비용 통제 지점.
    //
    // 상한을 먼저 오는 단계가 다 써 버리면 뒤 단계가 통째로 굶는다. 스케치 12장이
    // 상한 12를 그대로 먹으면, 색이 들어간 디자인이 한 장도 안 나오고 3D도 못 만든다.
    // 사용자는 "3D 쇼룸까지"를 골랐는데 결과에 3D가 없는 셈이다.
    // 그래서 색 단계까지 가는 분석이면 스케치는 상한의 40%까지만 쓴다.
    let spent = 0
    let spentSketch = 0
    const goesToColour = upto >= STAGE_ORDER.indexOf('S3')
    const sketchCap = goesToColour
      ? Math.max(1, Math.round(params.imageBudget * 0.4))
      : params.imageBudget
    const budget = {
      left: () => Math.max(0, params.imageBudget - spent),
      /** 스케치 단계가 지금 더 쓸 수 있는 장수 */
      leftSketch: () => Math.max(0, Math.min(params.imageBudget - spent, sketchCap - spentSketch)),
      spend: () => { spent += 1 },
      spendSketch: () => { spent += 1; spentSketch += 1 },
    }

    // 조사에서 나온 시즌 방향. S2 스케치와 S3 렌더 프롬프트가 이걸 참조한다.
    let trendClause: TrendClauseInput | null = null
    // 촬영 계획에 실을 시즌 방향. trendClause는 뒤에서 타입이 좁혀지므로 값만 따로 붙든다.
    let macroName = ''
    // 도시에가 캐시에 있으면 스케치 전에 반영되어야 한다. 새로 조사할 때만 뒤에서 따라온다.
    let dossierJob: Promise<unknown> | null = null
    // MD가 구성 전체에 남긴 한마디 · 리포트가 이걸 싣는다
    // 무드보드가 문서에서 실제로 읽어 낸 신호. 못 읽었으면 비어 있고, 비어 있으면 비어 있다고 말한다.
    let moodSignals: Signal[] = []
    // 시리즈에서 실제로 반복된 것 중, 스펙 값으로 옮길 수 있는 것만. 사진으로 못 보는 건 안 잠근다.
    let seriesLocks: Record<string, string | number> = {}
    /** 승인된 불변 요소를 사람 말 그대로 · 스펙 칸이 없는 것까지 게놈 저작자에게 넘긴다 */
    let seriesInvariantNotes: string[] = []
    // 설계 영토 = 디렉션. S1에서 계획해 내보내고 S2가 게놈 저작에 쓴다.
    let territories: Territory[] = []

    // ══ S1 조사 ══
    const scope = MODE_SCOPE[params.mode]
    const typeName = TYPE_LABEL[params.itemType] ?? params.itemType
    const line = params.line
    const fingerprint = lineFingerprint(line, params.itemType)

    // 이 분석의 조사 언어를 고정한다. 도중에 화면 언어를 바꿔도 결과는 안 섞인다.
    setRunLang(params.researchLang ?? null)

    emit({ kind: 'stage-start', stage: 'S1' })
    emit({ kind: 'log', stage: 'S1', text: `${MODE_LABEL[params.mode]} mode · building the brief` })
    emit({ kind: 'log', stage: 'S1', text: `Line profile: ${fingerprint}` })
    await wait(400)

    if (params.mode === 'trend') {
      // 트렌드 · 유일하게 경쟁사 리서치를 수행하는 모드. 브랜드가 아니라 라인 단위로 본다.
      const brands = params.trend.competitors
      const band = `KRW ${(params.trend.priceMinKrw / 10000).toFixed(0)}0k-${(params.trend.priceMaxKrw / 10000).toFixed(0)}0k`
      emit({ kind: 'log', stage: 'S1', text: `${brands.length} competitor lines: ${brands.join(', ')} · primary band ${band}${params.trend.adjacentBand ? ' + adjacent reference band' : ''}` })
      emit({ kind: 'log', stage: 'S1', text: `1 Competitor products · searching ${brands.join(', ')} for ${typeName} (1-2 min)` })
      try {
        // 경쟁 라인 조사와 백화점·명품몰 펄스는 서로 독립이다 · 병렬로 돈다
        // 실제 판매처는 시장·계열에 따라 서버가 고른다 (research-api 의 retailClause).
        // 여기에 다섯 곳을 박아 두면 미국 시장 Run 의 기록에도 롯데·SSG 가 남는다.
        emit({ kind: 'log', stage: 'S1', text: `Also sweeping bestseller pages at the retailers that matter in ${params.line?.commercial?.homeMarket ?? 'KR'}, chosen per market and product family` })
        const [r, pulse] = await Promise.all([
          fetchCompetitors({
            brands, typeKo: typeName,
            priceMin: params.trend.priceMinKrw, priceMax: params.trend.priceMaxKrw,
            adjacentBand: !!params.trend.adjacentBand,
            line, itemType: params.itemType,
          }),
          fetchRetailPulse({ typeKo: typeName, line, itemType: params.itemType }).catch(e => {
            emit({ kind: 'log', stage: 'S1', text: `Retail pulse failed · ${String((e as Error).message).slice(0, 90)} · continuing with brand research alone` })
            return null
          }),
        ])
        if (cancelled) return
        let comps = toCompetitors(r, params.trend.priceMinKrw, params.trend.priceMaxKrw)
        if (pulse?.products?.length) {
          const pulseComps = pulseToCompetitors(pulse, comps.length)
          comps = [...pulseComps, ...comps]
          const retailers = [...new Set(pulseComps.map(c => c.retailer).filter(Boolean))]
          emit({ kind: 'log', stage: 'S1', text: `Department-store pulse: ${pulseComps.length} bestseller-flagged products with photos from ${retailers.join(', ')} (${pulse.searches} searches)` })
        }
        emit({ kind: 'log', stage: 'S1', text: `${r.searches} web searches, ${comps.length} products${r.cached ? ' (reused an earlier pass)' : ''}` })
        // 프로필과 안 맞는 제품은 버리지 않고 참조군으로 분류된다 (지시서 5.1)
        const refs = comps.filter(c => c.competitor_group && c.competitor_group !== 'direct')
        if (refs.length) emit({ kind: 'log', stage: 'S1', text: `${refs.length} kept as reference groups rather than direct competitors — different construction, tier or use` })
        const broken = comps.filter(c => c.size_status === 'size_broken').length
        if (broken) emit({ kind: 'log', stage: 'S1', text: `${broken} products are selling with a broken size run — availability recorded per size, not read as sales` })
        const strong = comps.filter(c => c.evidence_strength === 'strong').length
        emit({ kind: 'log', stage: 'S1', text: `2 Checking popularity evidence · ${strong} strong, the rest single source · surface position never stored as a sales rank` })
        emit({ kind: 'log', stage: 'S1', text: 'No sales proxy scored. One pass gives no time series, so restock and sell-out trends need repeat collection.' })
        if (r.notes) emit({ kind: 'log', stage: 'S1', text: `Limits of this pass: ${r.notes.slice(0, 160)}` })
        emit({ kind: 'competitors', items: comps })
      } catch (e) {
        // 여기도 샘플 상수(COMPETITORS.shoe)를 대신 내보내고 있었다. 그 제품들은
        // 이 Run 이 조사한 시장·품목과 아무 상관이 없고, 보드의 경쟁 제품 칸에
        // 조사해서 찾은 것처럼 걸렸다. 실패는 실패로 둔다.
        emit({ kind: 'log', stage: 'S1', text: `Competitor research failed · ${String((e as Error).message).slice(0, 120)} · nothing is substituted, so this run has no competitor set` })
        emit({ kind: 'competitors', items: [] })
      }
      if (cancelled) return
      emit({ kind: 'log', stage: 'S1', text: '3 Trend research · looking for design signals' })
    } else if (params.mode === 'series') {
      // 시리즈 · 업로드 자료가 주. 외부 조사는 트렌드까지만, 경쟁사 리서치 없음
      const si = params.series
      const ups = si.uploads ?? []
      emit({ kind: 'log', stage: 'S1', text: `Series "${si.seriesName || 'untitled'}" · ${ups.length} uploads · value statement ${si.valueStatement.length} chars` })
      await wait(400)
      if (ups.length) {
        emit({ kind: 'log', stage: 'S1', text: `1 Reading your ${ups.length} designs · looking at every one to separate what repeats from what changes (1-2 min)` })
        try {
          const read = await readSeries({
            uploadIds: ups.map(u => u.id),
            valueStatement: si.valueStatement,
            itemTypeEn: TYPE_EN[params.itemType] ?? 'footwear',
            langName: LANG_NAME[params.researchLang ?? getLang()],
          })
          if (cancelled) return
          emit({ kind: 'series-dna', dna: toSeriesDna(read) })
          // 사진에서 읽은 불변 요소는 가설이다 (규칙 16). 여기서 잘못 잠그면 그 오독이
          // 이 Run 의 모든 안을 구속한다. 그래서 사람이 승인한 요소만 잠근다 —
          // 예전에는 읽은 즉시 잠갔고, 사람이 끼어들 지점이 없었다.
          if (read.invariant.length) {
            emit({ kind: 'log', stage: 'S1', text: `${read.invariant.length} elements read as fixed. They lock the specs only after you confirm them — uncheck anything the photos got wrong.` })
            emit({ kind: 'dna-gate', invariant: toSeriesDna(read).invariant, of: read.of })
            const approved = await new Promise<string[]>(res => { dnaResolve = res })
            if (cancelled) return
            const kept = read.invariant.filter(e => approved.includes(e.label))
            seriesLocks = locksFromSeries(kept, read.of)
            // 승인한 것 전부를 문장으로도 들고 간다. locksFromSeries 가 스펙 값으로 옮길 수
            // 있는 건 toe_shape·closure·sole_construction 셋뿐이고 그 표는 드레스화 어휘라,
            // 러닝화에서는 여덟 개를 승인해도 하나만 남는다. 나머지 일곱은 어디에도 닿지
            // 않으면서 게이트는 "every design inherits these" 라고 말하고 있었다.
            seriesInvariantNotes = kept.map(e => e.label)
            const droppedN = read.invariant.length - kept.length
            emit({ kind: 'log', stage: 'S1', text: droppedN
              ? `You approved ${kept.length} of ${read.invariant.length} fixed elements · ${droppedN} rejected as misreads and not locked`
              : `All ${kept.length} fixed elements confirmed · locked into every spec` })
          } else {
            seriesLocks = {}
          }
          emit({ kind: 'log', stage: 'S1', text: `Read ${read.of} designs${read.cached ? ' (reused an earlier pass)' : ''} · ${read.invariant.length} elements repeat, ${read.variable.length} vary, ${read.ambiguous.length} unclear` })
          for (const inv of read.invariant.slice(0, 3)) {
            emit({ kind: 'log', stage: 'S1', text: `Repeats in ${inv.observed_in} of ${read.of}: ${inv.label} — ${inv.evidence}` })
          }
          if (read.read_note) emit({ kind: 'log', stage: 'S1', text: `What the uploads do not show: ${read.read_note}` })
          emit({ kind: 'log', stage: 'S1', text: '2 Comparing the values you wrote against what is actually there' })
          const sc = read.statement_check
          if (sc?.brand_claim) {
            emit({ kind: 'dna-conflict', brandClaim: sc.brand_claim, observed: sc.observed })
            emit({ kind: 'log', stage: 'S1', text: sc.agrees
              ? `Statement and designs agree: ${sc.brand_claim} · ${sc.note}`
              : `Statement and observation disagree: ${sc.brand_claim} vs ${sc.observed} · pick which one holds` })
          } else {
            emit({ kind: 'log', stage: 'S1', text: 'No value statement to check against, so nothing is claimed about intent' })
          }
        } catch (e) {
          // 못 읽었으면 못 읽었다고 한다. 예전에는 여기서 상수를 내보내며 읽은 척했다.
          emit({ kind: 'log', stage: 'S1', text: `Could not read the uploads · ${String((e as Error).message).slice(0, 140)} · no series DNA is claimed from files that were not read` })
        }
      } else {
        emit({ kind: 'log', stage: 'S1', text: 'No designs uploaded, so there is no series to read. Nothing is claimed about your DNA.' })
      }
      await wait(400)
      if (si.trendSearch) {
        emit({ kind: 'log', stage: 'S1', text: '3 Trend research · no competitor product research in this mode' })
        await wait(700)
      } else {
        emit({ kind: 'log', stage: 'S1', text: '3 Trend research off · working from your uploads only' })
      }
      // 예전에는 여기서 상수 하나를 꺼내 "가치 문장을 이 필드들에 반영했다"고 적었다.
      // 아무것도 파싱하지 않았다. 문장이 실제로 하는 일은 위의 대조 하나뿐이므로 그것만 말한다.
      if (si.valueStatement.trim()) {
        emit({ kind: 'log', stage: 'S1', text: '4 The value statement is used to check the uploads, not to set spec values. Locks come from what repeats in the designs.' })
      }
    } else {
      // 무드보드 · 외부 조사 없음. 업로드 문서만. 결과는 신발 문법으로 번역된다.
      const mi = params.moodboard
      const ups = mi.uploads ?? []
      emit({ kind: 'log', stage: 'S1', text: `${ups.length} uploads: ${ups.map(u => u.name).join(', ') || 'none'} · nothing outside these files` })
      await wait(300)
      if (ups.length) {
        emit({ kind: 'log', stage: 'S1', text: '1 Reading the document · every page, its images and captions (1-3 min)' })
        emit({ kind: 'log', stage: 'S1', text: '2 Uploads tagged as untrusted · any instruction inside them is treated as data, not a command' })
        try {
          const read = await readMoodboard({
            uploadIds: ups.map(u => u.id),
            notes: mi.notes,
            itemTypeEn: TYPE_EN[params.itemType] ?? 'footwear',
            langName: LANG_NAME[params.researchLang ?? getLang()],
          })
          if (cancelled) return
          emit({ kind: 'log', stage: 'S1', text: `Read ${read.pages_read} pages${read.cached ? ' (reused an earlier pass)' : ''} · ${read.doc_summary}` })
          // 페이지 번호는 모델이 실제로 그 페이지를 봤을 때만 붙는다. 빈 값은 빈 값으로 둔다.
          moodSignals = read.signals.map((s, i) => ({
            signal_id: `mb_${String(i + 1).padStart(3, '0')}`,
            attribute: s.attribute,
            label: s.label,
            axis: s.axis,
            observed_count: s.observed_count,
            sources: read.files.map(f => f.name),
            price_bands: [],
            confidence: s.confidence,
            direction: 'stable' as const,
            first_seen: new Date().toISOString().slice(0, 10),
            dedup_group: s.attribute,
            oem_group: null,
            page_ref: s.page_ref || undefined,
            evidence: [s.quote, s.footwear_translation].filter(Boolean),
          }))
          emit({ kind: 'log', stage: 'S1', text: `3 Translating what repeats into footwear grammar · ${moodSignals.length} signals, ${moodSignals.filter(s => s.page_ref).length} of them pinned to a page` })
          for (const s of read.signals.slice(0, 3)) {
            emit({ kind: 'log', stage: 'S1', text: `${s.page_ref ? s.page_ref + ' · ' : ''}${s.label} → ${s.footwear_translation}` })
          }
          if (read.palette?.length) {
            emit({ kind: 'log', stage: 'S1', text: `Colours taken from the document: ${read.palette.slice(0, 6).map(c => `${c.name} ${c.hex}`).join(', ')}` })
          }
          emit({ kind: 'report-bias', bias: {
            publisher: read.files.map(f => f.name).join(', '),
            perspective: read.source_bias.perspective,
            notes: [
              ...read.source_bias.covers.map(c => `Covers: ${c}`),
              ...read.source_bias.misses.map(m => `Does not cover: ${m}`),
            ],
          } })
          emit({ kind: 'log', stage: 'S1', text: `4 Source perspective: ${read.source_bias.perspective} · no market or sales claims are made from a moodboard` })
          if (read.not_found) emit({ kind: 'log', stage: 'S1', text: `Not in this document: ${read.not_found}` })
        } catch (e) {
          emit({ kind: 'log', stage: 'S1', text: `Could not read the document · ${String((e as Error).message).slice(0, 140)} · no findings are claimed from a file that was not read` })
        }
      } else {
        emit({ kind: 'log', stage: 'S1', text: 'No file uploaded, so there is nothing to read. Moodboard mode makes no claims without a document.' })
      }
    }
    // ── 신호 확정 · 트렌드 조사를 하는 모드는 실제 검색 결과를 쓴다
    let signals: Signal[] = []
    const doTrend = scope.trend && (params.mode !== 'series' || params.series.trendSearch)
    if (doTrend) {
      try {
        // 신호는 빠른 경로로 먼저 받는다. 상세 보고서는 S1을 막지 않고 뒤에서 따라온다.
        const tr = await fetchTrends({
          typeKo: typeName, season: seasonKo,
          brands: params.mode === 'trend' ? params.trend.competitors : undefined,
          priceBandKo: params.mode === 'trend'
            ? `KRW ${(params.trend.priceMinKrw / 10000).toFixed(0)}0k-${(params.trend.priceMaxKrw / 10000).toFixed(0)}0k ${params.trend.priceBand}`
            : undefined,
          objectives: params.mode === 'trend' ? params.trend.objectives : undefined,
          line, itemType: params.itemType,
          wantReport: false,
        })
        if (cancelled) return
        signals = toSignals(tr)
        emit({ kind: 'report-bias', bias: toBias(tr) })

        // 상세 트렌드 보고서는 오래 걸리므로 뒤에서 받아 붙인다. S1은 기다리지 않는다.
        emit({ kind: 'report-pending', on: true })
        emit({ kind: 'log', stage: 'S1', text: 'The full trend report is being written separately. It attaches to the research panel when done.' })

        // 시즌 도시에 · 매크로트렌드 → 소재·디테일 → 키아이템. 오래 걸리므로 뒤에서 붙인다.
        emit({ kind: 'dossier-pending', on: true })
        emit({ kind: 'log', stage: 'S1', text: 'Building the season dossier: macrotrends, palettes, materials, key items. It attaches when done.' })
        dossierJob = fetchDossier({
          categoryEn: 'Footwear',
          season: seasonDossier,
          priceBand: params.mode === 'trend'
            ? `KRW ${(params.trend.priceMinKrw / 10000).toFixed(0)}0k-${(params.trend.priceMaxKrw / 10000).toFixed(0)}0k ${params.trend.priceBand}`
            : undefined,
          brands: params.mode === 'trend' ? params.trend.competitors : [],
          line, itemType: params.itemType,
        }).then(d => {
          if (cancelled) return
          // 첫 매크로를 기준 방향으로 잡는다. 여기서 나온 소재·디테일·팔레트가 이미지 프롬프트로 넘어간다.
          const m0 = d.macrotrends?.[0]
          if (m0) {
            trendClause = {
              macroName: m0.name,
              materials: (m0.materials ?? []).map(x => x.label),
              details: (m0.details ?? []).map(x => x.label),
              colors: (m0.palette ?? []).map(c => ({ name: c.name, hex: c.hex })),
              keySpec: (m0.key_items ?? []).find(k => k.segment === 'women')?.silhouette_spec,
            }
            macroName = m0.name
            emit({ kind: 'log', stage: 'S1', text: `Design prompts now carry the ${m0.name} direction: ${(m0.materials ?? []).map(x => x.label).slice(0, 3).join(', ')}` })
          }
          emit({ kind: 'dossier', dossier: d })
          emit({ kind: 'log', stage: 'S1', text: `Season dossier ready · ${d.macrotrends?.length ?? 0} macrotrends, ${d.sources?.length ?? 0} sources (${d.searches} searches)` })
        }).catch(() => {
          emit({ kind: 'dossier-pending', on: false })
          emit({ kind: 'log', stage: 'S1', text: 'The season dossier failed to build. Signals and the report are still usable.' })
        })
        fetchTrends({
          typeKo: typeName, season: seasonKo,
          brands: params.mode === 'trend' ? params.trend.competitors : undefined,
          priceBandKo: params.mode === 'trend'
            ? `KRW ${(params.trend.priceMinKrw / 10000).toFixed(0)}0k-${(params.trend.priceMaxKrw / 10000).toFixed(0)}0k ${params.trend.priceBand}`
            : undefined,
          objectives: params.mode === 'trend' ? params.trend.objectives : undefined,
          line, itemType: params.itemType,
          wantReport: true,
        }).then(full => {
          if (cancelled) return
          if (full.report) {
            emit({ kind: 'trend-report', report: full.report })
            emit({ kind: 'log', stage: 'S1', text: `Trend report done · ${full.report.design_implications?.length ?? 0} implications from ${full.searches} searches` })
          } else {
            emit({ kind: 'report-pending', on: false })
          }
        }).catch(() => {
          emit({ kind: 'report-pending', on: false })
          emit({ kind: 'log', stage: 'S1', text: 'The full report failed to write. Signals and sources are still usable.' })
        })
        emit({ kind: 'log', stage: 'S1', text: `${tr.searches} web searches, ${signals.length} signals${tr.cached ? ' (reused an earlier pass)' : ''} · each linked to a source` })
      } catch (e) {
        // 예전에는 "falling back to sample data" 라고 적었다. 그런 폴백은 없다 —
        // 예시 상수는 지웠고, 실패하면 신호 없이 계속 간다. 없는 폴백을 말하지 않는다.
        emit({ kind: 'log', stage: 'S1', text: `Trend research failed · ${String((e as Error).message).slice(0, 120)} · continuing without trend signals, and every card will say so` })
      }
    }
    // 무드보드는 문서에서 실제로 읽어 낸 신호를 쓴다.
    // 예전에는 여기서 샘플 상수에 난수 페이지 번호를 붙여 출처인 척했다. 그건 조작이다.
    if (!signals.length && moodSignals.length) signals = moodSignals
    // 조사가 아무것도 못 가져왔을 때 SIGNALS.shoe(샘플 상수 6개)를 대신 끼워 넣고 있었다.
    // 그 상수의 출처는 전부 https://observed.example/… 이다 — 존재한 적 없는 주소다.
    // 조사가 실패한 Run 과 성공한 Run 이 화면에서 구분되지 않았고, 카드에는 가짜 URL 이
    // 근거로 붙었다. 규칙 1·2 그대로: 실패를 기본값으로 대체하지 않는다.
    if (!signals.length) {
      emit({ kind: 'log', stage: 'S1', text: 'No signals came back from research. Nothing is substituted for them — the specs below come from the archetype grammar, and every card says so.' })
    }
    emit({ kind: 'signals', signals })
    const lowConf = signals.filter(s => s.confidence === 'low').length
    emit({ kind: 'log', stage: 'S1', text: `${signals.length} signals confirmed · none unsourced${lowConf ? ` · ${lowConf} single source, marked low confidence` : ''}` })
    emit({ kind: 'log', stage: 'S1', text: 'Each signal carries four indices — commercial, cultural, forecast, feasibility — never a single blended score' })
    await wait(600)
    // ── 디렉션 = 설계 영토 (지시서 v2 S3) ──────────────────────────────
    // 예전에는 DIRECTIONS.shoe라는 상수 셋을 무조건 내보냈다. 첼시 부츠를 돌려도
    // "penny silhouette를 유지한다"는 로퍼 문구가 나왔고, 신호 id도 이 실행과
    // 무관한 sg_014 같은 샘플 값이라 보드 연결선이 통째로 끊겨 있었다.
    // 이제 실제 조사 신호와 브랜드로 계획한 영토가 그대로 디렉션이 된다.
    const langName = LANG_NAME[params.researchLang ?? getLang()]
    const brandSummary = brandSummaryOf(params.brand)
    if (!brandSummary) {
      emit({ kind: 'log', stage: 'S1', text: 'Brand lens is empty · directions will lean toward the market average. Set up the brand to pull them your way.' })
    }
    try {
      emit({ kind: 'log', stage: 'S1', text: 'Planning design directions · distinct design spaces, not intensity steps of one trend' })
      const tr = await planTerritories({
        signals, itemTypeEn: TYPE_EN[params.itemType] ?? 'shoe',
        itemType: params.itemType, brandSummary, langName,
      })
      if (cancelled) return
      territories = tr.territories ?? []
      emit({ kind: 'directions', items: territories.map(t => ({
        id: t.id,
        title: t.name,
        summary: [t.consumer_role, t.drop_signal_ids?.length ? `일부러 버린 신호: ${t.drop_reason}` : '', t.season_note]
          .filter(Boolean).join(' '),
        signal_ids: t.use_signal_ids ?? [],
      })) })
      emit({ kind: 'log', stage: 'S1', text: `${territories.length} directions planned${tr.cached ? ' (reused an earlier pass)' : ''} · each cites the signals it uses and the ones it drops` })
    } catch (e) {
      emit({ kind: 'log', stage: 'S1', text: `Direction planning failed · ${String((e as Error).message).slice(0, 100)} · designs will fall back to signal combinations` })
    }
    emit({ kind: 'checkpoint', label: 'S1 done · signals and directions saved' })
    emit({ kind: 'stage-done', stage: 'S1' })
    if (upto === 0 || cancelled) { emit({ kind: 'done', endStage: 'S1' }); return }

    // 캐시에 있으면 여기서 바로 붙는다. 새로 조사 중이면 짧게만 기다리고 넘어간다.
    if (dossierJob) {
      await Promise.race([dossierJob.catch(() => null), wait(20_000)])
      if (trendClause) emit({ kind: 'log', stage: 'S2', text: 'Sketch prompts carry the season direction from the dossier' })
      else emit({ kind: 'log', stage: 'S2', text: 'Dossier still building, so sketches go ahead on signals alone. Renders pick it up when it lands.' })
    }

    // ══ S2 스케치 ══
    emit({ kind: 'stage-start', stage: 'S2' })
    const [rc, rp, rs] = params.tierRatio
    const rsum = rc + rp + rs
    const nCore = Math.round(params.sketchCount * rc / rsum)
    const nPush = Math.round(params.sketchCount * rp / rsum)
    const nSig = params.sketchCount - nCore - nPush
    emit({ kind: 'log', stage: 'S2', text: `Specs per tier · Core ${nCore} · Push ${nPush} · Signature ${nSig} (schema enforced, presets locked)` })
    emit({ kind: 'log', stage: 'S2', text: 'Tier means tooling: Core reuses last and bottom, Push keeps one, Signature may open a new last or mould' })
    // 시리즈 잠금은 올린 디자인에서 실제로 반복된 것만 잠근다.
    // 예전에는 상수 하나(almond dress last)를 무조건 박았다. 조던 같은 운동화 시리즈에
    // 드레스 라스트가 박히면 S-11이 전부 걸려 결과가 통째로 버려졌다.
    // 라스트 아이디는 사진으로 알 수 없다. 모델도 "같은 라스트인지 확인 불가"라고 말한다. 그래서 안 잠근다.
    const locked = params.mode === 'series' ? seriesLocks : {}
    const invariantNotes = params.mode === 'series' ? seriesInvariantNotes : []
    if (params.mode === 'series') {
      // 스펙 값으로 잠긴 것과 문장으로만 전달되는 것을 나눠 말한다. 예전에는 잠금 한 줄만
      // 적으면서 "every design inherits these" 라고 해서, 여덟 개를 승인해도 하나만
      // 효력이 있다는 사실이 로그 어디에도 안 보였다.
      const noteOnly = invariantNotes.length - Object.keys(locked).length
      if (noteOnly > 0) {
        emit({ kind: 'log', stage: 'S2', text: `${invariantNotes.length} approved elements go to the design author; ${Object.keys(locked).length} of them also pin a spec field. The rest have no spec column, so they ride as written rules the author must not break.` })
      }
      emit({ kind: 'log', stage: 'S2', text: Object.keys(locked).length
        ? `Series DNA locked from your uploads: ${Object.entries(locked).map(([k, v]) => `${k}=${v}`).join(', ')} · every design inherits these`
        : 'Nothing locked: the uploads did not show a repeating feature that maps to a spec value, so all fields stay open' })
    }
    emit({ kind: 'log', stage: 'S2', text: 'Reference bank loaded: 4 approved, 2 near-miss rejects (too familiar, cost)' })
    await wait(800)

    const designs: Design[] = []
    const tiers: DesignTier[] = [
      ...Array(nCore).fill('core'), ...Array(nPush).fill('push'), ...Array(nSig).fill('signature'),
    ]
    // 조사 신호를 스펙 값으로 옮긴다 · 티어마다 실행 가능한 신호가 다르다
    const athletic = !!profileOf(params.itemType).athletic
    const hintByTier: Record<DesignTier, ReturnType<typeof deriveSpecHints>> = {
      core: deriveSpecHints(signals, 'core', athletic),
      push: deriveSpecHints(signals, 'push', athletic),
      signature: deriveSpecHints(signals, 'signature', athletic),
    }
    for (const t of ['core', 'push', 'signature'] as DesignTier[]) {
      const h = hintByTier[t]
      const n = Object.keys(h.fields).length
      emit({ kind: 'log', stage: 'S2', text: n
        ? `${TIER_LABEL[t]} reads ${n} spec values out of the research: ${Object.keys(h.fields).map(k => k.replace(/_/g, ' ')).join(', ')}`
        : `${TIER_LABEL[t]} found no signal it can build without changing tooling, so its spec stays open` })
    }
    // 디자인마다 다른 신호 조합을 준다. 같은 힌트로 열두 장을 뽑으면 열두 장이 서로 닮는다.
    // 조합은 티어별로 따로 만든다 — Core에서 못 쓰는 신호가 Signature에서는 쓰이기 때문이다.
    const comboByTier: Record<DesignTier, { ids: string[]; label: string }[]> = {
      core: signalCombos(signals, 'core', tiers.filter(t => t === 'core').length),
      push: signalCombos(signals, 'push', tiers.filter(t => t === 'push').length),
      signature: signalCombos(signals, 'signature', tiers.filter(t => t === 'signature').length),
    }
    const comboCursor: Record<string, number> = { core: 0, push: 0, signature: 0 }
    // 이미 나온 스펙 · 같은 후보를 두 번 만들지 않는다
    const specSeen = new Set<string>()
    for (const t of ['core', 'push', 'signature'] as DesignTier[]) {
      const c = comboByTier[t]
      if (c.length > 1) emit({ kind: 'log', stage: 'S2', text: `${TIER_LABEL[t]} explores ${c.length} different readings of the research, not one: ${c.slice(0, 3).map(x => x.label).join(' / ')}${c.length > 3 ? ' …' : ''}` })
    }

    // ── Design Genome 저작 (지시서 v2 S4 · 라이트 모드) ────────────────
    // 영토는 S1에서 이미 계획해 디렉션으로 내보냈다. 여기서는 그 영토마다
    // 독립 호출로 게놈을 받는다. 실패하면 조합 경로로 떨어지되 폴백임을 남긴다.
    const gProf = profileOf(params.itemType)
    const genomeProfile = {
      heelMin: gProf.heel[0], heelMax: gProf.heel[1],
      panelMin: gProf.panels[0], panelMax: gProf.panels[1],
      closures: gProf.closures, constructions: gProf.constructions,
    }
    const acceptedGenomes: Genome[] = []
    const terrCursor: Record<DesignTier, number> = { core: 0, push: 0, signature: 0 }
    const pickTerritory = (tier: DesignTier): Territory | null => {
      if (!territories.length) return null
      const eligible = territories.filter(t => (t.allowed_tiers ?? []).includes(tier))
      const pool = eligible.length ? eligible : territories
      return pool[terrCursor[tier]++ % pool.length]
    }

    // 실제로 반영된 필드 수 · 제안과 반영은 다르다
    const tookByTier: Record<string, Set<string>> = { core: new Set(), push: new Set(), signature: new Set() }
    const blockedSeen = new Set<string>()

    for (let i = 0; i < tiers.length; i++) {
      if (cancelled) return
      const tier = tiers[i]
      // 이 디자인이 볼 신호 조합. 조합이 다르면 스펙이 다르고, 스펙이 다르면 스케치가 다르다.
      // 조합이 달라도 스펙이 같아질 수 있다 (막힌 신호는 아무것도 못 바꾼다).
      // 그때는 다음 조합으로 넘긴다 — 똑같은 후보를 두 장 만들 이유가 없다.
      // ① 게놈 저작 시도 · 독립 호출 + 다양성 게이트, 충돌 축만 지목해 1회 재저작
      let genome: Genome | null = null
      if (territories.length) {
        const terr = pickTerritory(tier)!
        let lastCollisions: string[] = []
        // 게이트를 못 넘은 마지막 후보는 버리지 않고 들고 있는다. 아래를 보라.
        let nearMiss: Genome | null = null
        for (let attempt = 0; attempt < 3 && !genome; attempt++) {
          try {
            const g = await authorGenome({
              territory: terr, tier, signals, profile: genomeProfile, brandSummary,
              antiSimilarity: [
                ...acceptedGenomes.map(genomeDigest),
                ...(attempt > 0 ? [`이전 시도는 다음 축이 겹쳐 탈락: ${lastCollisions.join(', ')}. 이 축들만 바꾸고 나머지는 유지하라.`] : []),
              ],
              itemTypeEn: TYPE_EN[params.itemType] ?? 'shoe', langName,
              assets: { lastReuse: params.line?.lastFit?.existingLastReuse ?? true, bottomReuse: params.line?.bottom?.existingBottomReuse ?? true },
              locked, invariantNotes,
            })
            if (cancelled) return
            const gate = diversityGate(g, acceptedGenomes, tier)
            if (gate.pass) genome = g
            else {
              lastCollisions = gate.collisions
              nearMiss = g
              emit({ kind: 'log', stage: 'S2', text: `Genome for ${terr.name} collides on ${gate.collisions.join(', ')} · re-authoring those axes only` })
            }
          } catch (e) {
            emit({ kind: 'log', stage: 'S2', text: `Genome authorship failed for ${terr.name} · ${String((e as Error).message).slice(0, 80)} · this slot falls back to signal combos (not LLM-authored)` })
            break
          }
        }
        // 5개 축에 Signature는 3축 상이를 요구한다. 앞선 안이 여덟 개쯤 쌓이면
        // 그 요구를 통과하는 자리가 남지 않아, 늘 뒤쪽 Signature들만 조합 폴백으로 떨어졌다.
        // 축이 하나 겹친 LLM 저작 안이 규칙으로 뽑은 안보다 낫다. 겹친 축은 카드에 적는다.
        if (!genome && nearMiss) {
          genome = { ...nearMiss, gate_overlap: lastCollisions }
          emit({ kind: 'log', stage: 'S2', text: `Kept the authored genome for ${terr.name} despite overlap on ${lastCollisions.join(', ')} · the overlap is printed on the card` })
        }
      }

      const combos = comboByTier[tier]
      let combo: { ids: string[]; label: string } | null = null
      let tierHint = hintByTier[tier]
      let spec = null as ReturnType<typeof pack.generateSpec> | null
      if (genome) {
        // 게놈 경로 · 프로필 클램프는 generateSpec이 그대로 적용하고 받은/거부한 값을 기록한다
        spec = pack.generateSpec(rng, tier, params.itemType, locked, genomeToHint(genome))
        spec.genome = genome
        spec.silhouetteRead = genome.silhouette_family
        spec.comboLabel = genome.hero_mutation.label
        tierHint = { fields: {}, applied: {} }
        acceptedGenomes.push(genome)
        const terrName = territories.find(t => t.id === genome!.territory_id)?.name ?? genome.territory_id
        emit({ kind: 'log', stage: 'S2', text: `${spec.design_id} authored in ${terrName} · hero: ${genome.hero_mutation.label}` })
      } else {
        for (let tryN = 0; tryN < Math.max(1, combos.length); tryN++) {
          combo = combos.length ? combos[comboCursor[tier]++ % combos.length] : null
          tierHint = combo ? deriveSpecHintsFrom(signals, combo.ids, tier, athletic) : hintByTier[tier]
          const cand = pack.generateSpec(rng, tier, params.itemType, locked, tierHint.fields)
          const sig = JSON.stringify(cand.fields)
          if (!specSeen.has(sig) || tryN === combos.length - 1) { spec = cand; specSeen.add(sig); break }
        }
        if (!spec) spec = pack.generateSpec(rng, tier, params.itemType, locked, tierHint.fields)
        if (combo) spec.comboLabel = combo.label
        // 선화에서 실제로 달라지는 축 · 안마다 다른 실루엣 읽기를 준다
        spec.silhouetteRead = silhouetteRead(i).key
      }
      // 스펙이 실제로 받아들인 필드만 근거로 남긴다
      const hint = reconcileHint(tierHint, spec.hintApplied)
      for (const k of spec.hintApplied ?? []) tookByTier[tier].add(k)
      for (const b of spec.hintBlocked ?? []) blockedSeen.add(`${b.field}|${b.wanted}|${b.got}`)
      const cost = pack.costModel(spec, rng)
      const ruleResults = [...pack.rules(spec), ...tierCapRule(spec, cost)]
      const rejected = ruleResults.some(r => r.severity === 'fail')
      const rationale = buildRationale(params, spec, signals, rng, hint)
      const d: Design = {
        spec, ruleResults, rejected, cost, rationale,
        qa: [], viewMismatch: false,
        metrics: buildMetrics(spec, cost, rationale, signals),
        // 평가는 모든 안이 나온 뒤에 채운다. 서로 얼마나 다른지는 혼자서는 알 수 없다.
        modelEval: [],
        colorways: [], images: [], isTop: false,
      }
      designs.push(d)
      emit({ kind: 'design', design: d })
      emit({ kind: 'log', stage: 'S2', text: `${spec.design_id} [${tier}] ${rejected ? 'rule reject · ' + ruleResults.filter(r => r.severity === 'fail').map(r => r.rule).join(', ') : 'passed rules, queued for sketch'}` })
      emit({ kind: 'progress', stage: 'S2', pct: Math.round(((i + 1) / tiers.length) * 100) })
      await wait(180)
    }
    // 안이 다 나왔으니 이제 서로 견줄 수 있다. 세 줄 평가를 여기서 실제로 센다.
    fillModelEval(designs, params.brand, signals)
    designs.forEach(d => emit({ kind: 'design-update', design: { ...d } }))

    const alive = designs.filter(d => !d.rejected)
    // 조사가 어디까지 실제로 반영됐는지 남긴다. 반영과 제안을 섞어서 적지 않는다.
    for (const t of ['core', 'push', 'signature'] as DesignTier[]) {
      const took = [...tookByTier[t]]
      if (took.length) emit({ kind: 'log', stage: 'S2', text: `${TIER_LABEL[t]} specs carry ${took.length} field${took.length > 1 ? 's' : ''} set by the research: ${took.map(k => k.replace(/_/g, ' ')).join(', ')}` })
    }
    for (const b of [...blockedSeen].slice(0, 3)) {
      const [field, wanted, got] = b.split('|')
      emit({ kind: 'log', stage: 'S2', text: `Research asked for ${field.replace(/_/g, ' ')} ${wanted}; a ${TYPE_LABEL[params.itemType] ?? params.itemType} holds at ${got}, so it was not applied` })
    }
    emit({ kind: 'log', stage: 'S2', text: `${alive.length} of ${designs.length} specs passed · ${designs.length - alive.length} rejected early · rejects are never rendered` })

    // 렌더로 진출할 안을 여기서 먼저 정한다.
    // 예전에는 스케치는 alive 앞에서부터, 렌더는 원가순 정렬에서 골라 서로 다른 부분집합이었다.
    // 그래서 스케치가 있는데 렌더가 없는 안, 스케치 없이 렌더만 있는 안이 동시에 나왔고
    // 후자는 "스케치를 사진으로 옮긴다"는 계보가 아예 끊긴 채 새로 그려졌다.
    // 스케치 예산보다 많이 진출시키면 다시 계보가 끊긴다. 진출 수를 스케치할 수 있는 수로 묶는다.
    // 예산이 얕으면 안을 적게 밀고, 민 안은 스케치와 렌더를 모두 갖는다.
    // 진출한 안 하나는 스케치 예산을 두 장 쓴다 — 기준 스케치와 아웃솔 시트.
    // 예전에는 스케치 상한 전부를 진출 수로 잡아서, 기준 스케치가 상한을 다 먹고
    // 아웃솔 블록이 통째로 건너뛰어졌다 (기본 상한 12에서 실제로 한 장도 안 나왔다).
    const sketchCapNow = budget.leftSketch()
    const advanceCap = sketchCapNow > 0 ? Math.max(1, Math.floor(sketchCapNow / 2)) : Number.POSITIVE_INFINITY
    const advanceN = Math.max(1, Math.min(
      Math.round(alive.length * params.renderRatio),
      advanceCap,
    ))
    const advancing = [...alive].sort((a, b) => a.cost.cap_ratio - b.cost.cap_ratio).slice(0, advanceN)

    // 실제 스케치 생성 · 렌더로 갈 안부터, 상한까지. 초과분은 도식으로 남는다.
    // 단계가 갈라진다: ① 외형을 잡는 기준 스케치(흑백) → ② 같은 외형에서 흑백 스케치 변형.
    // 컬러는 여기서 절대 나오지 않는다. 색은 S3에서 이 스케치들을 사진으로 옮길 때 처음 들어간다.
    if (budget.leftSketch() > 0) {
      const targets = advancing
      emit({ kind: 'log', stage: 'S2', text: `Sketching ${targets.length} base forms · black ink only, colour never enters this stage` })
      let done = 0
      await pool(targets, ENGINES[params.imageEngine].concurrency, async (d) => {
        if (cancelled) return
        try {
          const skPrompt = sketchPrompt(d.spec, params.imageEngine, params.brand, trendClause, line)
          const r = await generateImage(skPrompt, params.imageEngine)
          budget.spendSketch()
          d.images = [...d.images, { view: 'sketch', url: r.url, hash: r.hash, origin: 'generated', promptUsed: skPrompt }]
          emit({ kind: 'log', stage: 'S2', text: `${d.spec.design_id} base form sketched${r.cached ? ' (reused)' : ''}` })
        } catch (e) {
          d.imageError = String((e as Error).message || e)
          emit({ kind: 'log', stage: 'S2', text: `${d.spec.design_id} sketch failed · ${d.imageError} · falling back to a diagram` })
        }
        done++
        emit({ kind: 'design-update', design: { ...d } })
        emit({ kind: 'progress', stage: 'S2', pct: Math.round((done / targets.length) * 100) })
      })
      if (alive.length > targets.length)
        emit({ kind: 'log', stage: 'S2', text: `${alive.length - targets.length} past the cap show as diagrams (cap ${params.imageBudget} images)` })

      // ② 아웃솔(바닥면) 스케치 · 기준 스케치와 짝을 이룬다.
      // 미드솔·아웃솔은 어퍼만큼 중요한데, 측면 스케치에는 러그·플렉스 그루브·컴파운드 분할이 안 보인다.
      // 게놈의 parts.outsole.form 이 이 도면의 지시다. 스케치 예산에서 나가고, 없으면 측면만 남는다.
      //
      // 예전에 이 자리에 있던 '스케치 변형'(같은 외형의 흑백 어퍼 재해석)은 없앴다.
      // 스케치당 여러 디자인은 이제 S3 에서 컨셉으로 갈린다 — 형태는 하나, 소재·컬러가 N개.
      const withSketch = targets.filter(d => d.images.some(i => i.view === 'sketch'))
      if (withSketch.length && budget.leftSketch() > 0) {
        emit({ kind: 'log', stage: 'S2', text: `Outsole sheets · a bottom-view tread drawing for each base form, from the genome's outsole instruction` })
        await pool(withSketch, ENGINES[params.imageEngine].concurrency, async (d) => {
          if (cancelled || budget.leftSketch() <= 0) return
          try {
            const p = outsoleSketchPrompt(d.spec)
            const r = await generateImage(p, params.imageEngine)
            budget.spendSketch()
            d.images = [...d.images, { view: 'sketch_outsole', url: r.url, hash: r.hash, origin: 'generated', promptUsed: p,
              whyUsed: d.spec.genome?.parts?.outsole?.form ? `Outsole as authored: ${d.spec.genome.parts.outsole.form}` : 'Outsole from the archetype tread grammar.' }]
            emit({ kind: 'design-update', design: { ...d } })
            emit({ kind: 'log', stage: 'S2', text: `${d.spec.design_id} outsole sheet drawn${r.cached ? ' (reused)' : ''}` })
          } catch (e) {
            emit({ kind: 'log', stage: 'S2', text: `${d.spec.design_id} outsole sheet failed · ${String((e as Error).message).slice(0, 70)} · side view only` })
          }
        })
      }
    }
    emit({ kind: 'checkpoint', label: 'S2 done · specs, sketches and rationale saved. You can resume at S3 days later.' })
    emit({ kind: 'stage-done', stage: 'S2' })

    if (params.approvalGate && upto >= 2) {
      emit({ kind: 'gate', stage: 'S2' })
      emit({ kind: 'log', stage: 'S2', text: 'Approval gate · review, then continue to S3. This gate is where feedback gets collected.' })
      await new Promise<void>(res => { gateResolve = res })
      if (cancelled) return
    }
    if (upto === 1) { emit({ kind: 'done', endStage: 'S2' }); return }

    // ══ S3 디자인 (멀티뷰) ══
    emit({ kind: 'stage-start', stage: 'S3' })
    emit({ kind: 'log', stage: 'S3', text: `${Math.round(params.renderRatio * 100)}% move to render · ${advanceN} selected, the same ones that were sketched` })

    // 앞선 디자인이 추가 뷰와 컬러웨이로 남은 상한을 다 써 버리면 뒤 디자인은 한 장도 못 받는다.
    // 실제로 첫 디자인이 7컷을 가져가고 나머지 넷이 0컷으로 끝난 적이 있다.
    // 그래서 먼저 모두에게 기준 렌더 한 장씩 몫을 떼어 두고, 남는 만큼만 추가 컷에 쓴다.
    const perDesignExtras = Math.max(0, Math.floor((budget.left() - advancing.length) / Math.max(1, advancing.length)))
    if (advancing.length > 1) {
      emit({ kind: 'log', stage: 'S3', text: perDesignExtras > 0
        ? `Every design gets its base render, then up to ${perDesignExtras} extra cuts each, so the cap does not land on the first one`
        : 'The cap covers one render each and no extra views, so every design still gets a photo' })
    }

    for (let i = 0; i < advancing.length; i++) {
      if (cancelled) return
      const d = advancing[i]
      // 이 디자인이 추가 컷에 쓸 수 있는 장수 · 기준 렌더는 이 몫에서 빼지 않는다
      let extrasLeft = perDesignExtras
      emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} colour enters here: the black-ink sheet becomes a photoreal render, then ${params.viewCount - 1} more views as edits` })
      // 컬러웨이는 브랜드 팔레트 → 시즌 팔레트 → 중립 순으로 뽑는다. 취향이 아니라 출처가 있다.
      const cwPlan = planColorways(params.colorwayCount, params.brand, trendClause)
      // d.colorways 는 여기서 채우지 않는다. 예전에는 계획한 이름을 그대로 박아 둬서,
      // 상한에 걸려 컬러웨이가 한 장도 안 나온 Run 도 리포트에는 컬러웨이 두 개가
      // 있다고 적혔다. 실제로 렌더된 것만 아래에서 담는다.

      if (budget.left() > 0) {
        // ① 기준 렌더 1장 · 스케치가 있으면 새로 그리지 않고 스케치를 사진으로 옮긴다.
        // 테크시트의 실루엣·패널·아웃솔 기하가 렌더에 그대로 이어진다 (Gemini QA 지적).
        let baseHash: string | null = null
        const sketchIm = d.images.find(i => i.view === 'sketch')
        const basePrompt = sketchIm
          ? renderFromSketchPrompt(d.spec, trendClause, line, params.brand)
          : renderPrompt(d.spec, params.imageEngine, params.brand, trendClause, line)
        try {
          const r = sketchIm
            ? await editImage(sketchIm.hash, basePrompt, params.imageEngine)
            : await generateImage(basePrompt, params.imageEngine)
          budget.spend(); baseHash = r.hash
          let baseUrl = r.url
          // 브랜드 로고는 프롬프트가 아니라 실제 파일로 얹는다. 형태가 어긋나지 않는다.
          // 사용자가 "이미지에 로고 넣기"를 껐으면 넣지 않는다. 예전에는 이 스위치를 무시했다.
          // 참고 사진에서 배치를 배웠으면 마크는 이미 그려져 있다. 그 위에 파일을 덧붙이면 두 번 나온다.
          // 참고 사진이 없을 때만 올린 파일을 그 자리에 합성한다.
          const drewMark = !!params.brand?.logo?.style?.prompt_clause
          if (!drewMark && params.brand?.applyLogoToImages && params.brand?.logo?.dataUrl && params.brand.logo.placement !== 'none') {
            try {
              const stamped = await stampLogo(r.hash, params.brand)
              if (stamped) {
                baseHash = stamped.hash; baseUrl = stamped.url
                emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} brand logo composited at the ${params.brand.logo.placement}` })
              }
            } catch (e) {
              emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} logo composite failed · ${String((e as Error).message).slice(0, 80)}` })
            }
          }
          // 이 컷의 소재·색이 어디서 왔는지 한 줄. 보드가 PT 자료가 되는 데 필요한 최소 단위다.
          const baseWhy = d.spec.genome
            ? `Material as authored: ${d.spec.genome.spec_sheet.upper_material} — part of the "${d.spec.genome.hero_mutation.label}" concept${d.spec.genome.source_signal_ids.length ? ', grounded in the cited research signals' : ''}.`
            : 'Material from the archetype spec — no authored concept behind this one, and the card says so.'
          d.images = [...d.images, { view: views[0].key, url: baseUrl, hash: baseHash, origin: 'generated', promptUsed: basePrompt, whyUsed: baseWhy, logoStamped: drewMark || baseHash !== r.hash }]
          emit({ kind: 'design-update', design: { ...d } })
        } catch (e) {
          d.imageError = String((e as Error).message || e)
          emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} base render failed · ${d.imageError}` })
        }
        // ② 스케치당 디자인 컨셉 N개 · 형태는 그대로, 소재·컬러·창의도만 갈린다.
        //
        // 이게 사용자가 말한 '베리에이션'이다. 예전에는 흑백 스케치 변형 → 고정 6개 소재 표 →
        // 렌더 뒤 슬라이더 편집, 세 갈래가 따로 있었고 어느 것도 조사·게놈·브랜드를 보지 않았다.
        // 이제 컨셉은 서버가 그 셋을 근거로 저작한다: 첫 번째는 상업 안전(게놈 소재 + 브랜드 팔레트),
        // 이후는 소재 전환 / 컬러 전환 / 창의 밀기. 각각 파트별 소재·색과 '왜'를 들고 온다.
        // 첫 컨셉은 기준 렌더 그 자체다 (위에서 이미 만들었다). 두 번째부터가 여기서 나온다.
        const dpsWanted = params.designsPerSketch ?? 1
        const sketchIm2 = d.images.find(i => i.view === 'sketch')
        if (dpsWanted > 1 && sketchIm2 && d.spec.genome && budget.left() > 0 && extrasLeft > 0) {
          try {
            // trendClause 는 S1 안의 try 에서 채워진다 · TS 흐름분석이 여기서는 null 로 좁히므로 명시적으로 넓힌다
            const tc = trendClause as TrendClauseInput | null
            const seasonPalette = tc?.colors ?? []
            const seasonMaterials = tc?.materials ?? []
            const cr = await authorConcepts({
              count: dpsWanted, genome: d.spec.genome, signals, brandSummary,
              brandPalette: params.brand?.colorPalette ?? [], seasonPalette, seasonMaterials,
              itemTypeEn: TYPE_EN[params.itemType] ?? 'shoe', langName,
            })
            if (cancelled) return
            const concepts = (cr.concepts ?? []).slice(0, dpsWanted)
            const first = concepts[0]
            // 필수 뷰 몫을 먼저 떼어 둔다. 컨셉과 추가 뷰·컬러웨이가 같은 extrasLeft 를
            // 나눠 쓰는데 컨셉 루프가 먼저 돌아서, 상한이 빡빡하면 컨셉이 전부 가져가고
            // 내측·후면이 한 장도 안 남았다. 신발을 한 방향에서만 보여 주는 카드가 된다.
            const requiredExtraViews = views.filter(v => v.required).slice(1, params.viewCount).length
            const conceptCap = Math.max(0, extrasLeft - requiredExtraViews)
            if (concepts.length - 1 > conceptCap) {
              emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} cap allows ${conceptCap} of ${concepts.length - 1} extra concepts · the required views keep their share` })
            }
            // 기준 렌더에는 이름표만 붙이고 이유는 건드리지 않는다.
            // 이 컷은 컨셉이 저작되기 전에 게놈 프롬프트로 이미 만들어졌다. 컨셉의 why 를
            // 여기에 덮어쓰면, 그 컷에 들어간 적 없는 파트별 컬러 배정을 근거라고 말하게 된다.
            // baseWhy 는 실제로 보낸 프롬프트에서 계산한 것이라 그대로 둔다.
            // 이름표도 commercial_safe 일 때만 붙인다 — 스키마가 순서를 강제하지 않으므로
            // 첫 컨셉이 다른 angle 로 올 수 있고, 그러면 이 컷의 성격과 어긋난다.
            if (first && first.angle === 'commercial_safe') {
              d.images = d.images.map(im => im.view === views[0].key && !im.colorway && !im.concept
                ? { ...im, concept: { index: 0, name: first.name, angle: first.angle } }
                : im)
            }
            emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} ${concepts.length} concepts authored on one sketch · ${concepts.map(c => c.angle).join(' / ')}${cr.cached ? ' (reused)' : ''}` })
            for (let k = 1; k < concepts.length; k++) {
              if (cancelled || budget.left() <= 0 || extrasLeft <= 0) break
              if (k - 1 >= conceptCap) break
              const c = concepts[k]
              const p2 = conceptRenderPrompt(d.spec, c, params.brand)
              try {
                const r2 = await editImage(sketchIm2.hash, p2, params.imageEngine)
                budget.spend(); extrasLeft -= 1
                d.images = [...d.images, {
                  view: 'design', url: r2.url, hash: r2.hash, origin: 'edited_from', editedFrom: sketchIm2.hash,
                  promptUsed: p2, whyUsed: `${c.why} (${c.angle})`,
                  concept: { index: k, name: c.name, angle: c.angle },
                }]
                emit({ kind: 'design-update', design: { ...d } })
                emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} concept ${k + 1}: ${c.name} · ${c.angle}` })
              } catch {
                emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} concept ${k + 1} render failed · skipping that one` })
              }
            }
          } catch (e) {
            emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} concept authoring failed · ${String((e as Error).message).slice(0, 80)} · base render only` })
          }
        }

        // ③④ 추가 뷰·컬러웨이 = 기준 렌더의 편집 (동일 객체 유지)
        // 계열별 필수 뷰셋을 따른다 · 스니커즈는 내측, 힐은 후면이 반드시 있어야 한다
        if (baseHash) {
          const jobs: { view: string; colorway?: string; prompt: string; why?: string }[] = [
            ...views.filter(v => v.required).slice(1, params.viewCount)
              .map(v => ({ view: v.key, prompt: viewEditPrompt(v.key) })),
            ...cwPlan.map(cw => ({ view: views[0].key, colorway: cw.name, prompt: colorwayEditPrompt(cw), why: cw.why })),
          ].slice(0, Math.min(budget.left(), extrasLeft))
          await pool(jobs, 2, async (job) => {
            if (cancelled) return
            try {
              const r = await editImage(baseHash!, job.prompt, params.imageEngine)
              budget.spend(); extrasLeft -= 1
              d.images = [...d.images, { view: job.view, colorway: job.colorway, url: r.url, hash: r.hash, origin: 'edited_from', editedFrom: baseHash!, promptUsed: job.prompt, whyUsed: job.why }]
              emit({ kind: 'design-update', design: { ...d } })
            } catch (e) {
              emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} ${job.colorway ?? job.view} edit failed · dropping that cut only` })
            }
          })
          // 실제로 렌더된 컬러웨이만 적는다. 계획한 것이 아니라 나온 것이다.
          d.colorways = d.images.map(im => im.colorway).filter((c): c is string => !!c)
          const missed = cwPlan.length - d.colorways.length
          if (missed > 0) {
            emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} ${missed} of ${cwPlan.length} planned colourways did not render · the card lists only the ${d.colorways.length} that exist` })
          }
        }
      } else {
        await wait(350)
      }

      // (예전 자리) 렌더 뒤 스타일 슬라이더 베리에이션은 없앴다.
      // 스케치당 여러 디자인은 위 ② 에서 컨셉으로 나온다 — 조사·게놈·브랜드를 근거로.
      // 슬라이더 편집은 근거 없는 축(무드·엣지 등)을 렌더에 덧씌우는 것이라 카드가 '왜'를 말할 수 없었다.

      // 실제 비전 검증 (지시서 규칙 13 · rng 시뮬레이션 QA 폐기).
      // 렌더를 진짜로 보고 설계 의도와 대조한다. 검사가 실패하면 실패로 표기하고,
      // 호출 자체가 안 되면 "미검증"으로 남긴다 — 난수로 통과를 지어내지 않는다.
      const heroForQa = d.images.find(im => im.view === views[0].key && !im.colorway)
      if (heroForQa) {
        try {
          const v = await verifyRender({
            hash: heroForQa.hash,
            genome: d.spec.genome ?? {
              toe_family: String(d.spec.fields.toe_shape) as Genome['toe_family'],
              closure_form: String(d.spec.fields.closure),
            },
            langName,
          })
          d.qa = v.checks
          let failedN = v.checks.filter(c => !c.pass).length
          if (!v.single_object) {
            d.viewMismatch = true
            emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} render shows more than one object · flagged, kept visible` })
          }
          emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} vision check ${v.checks.length - failedN}/${v.checks.length}${failedN ? ' · mismatches flagged, not hidden' : ''}` })

          // ── 수리 1회 (지시서 §S6·§S8) · 검사가 실패를 찾았으면 그 컷만 한 번 고쳐 본다.
          // 실패한 항목만 짚어 편집하고, 고친 컷을 다시 검사한다. 두 번째도 실패면
          // 실패로 표기한 채 둔다 — 무한 수리도, 못 고친 것을 고쳤다는 표기도 없다.
          if (failedN > 0 && budget.left() > 0) {
            const fails = v.checks.filter(c => !c.pass)
            const repairPrompt = [
              'Keep this exact shoe, camera angle, lighting and background. Fix only the following, changing nothing else:',
              ...fails.map(c => `${c.check}: it currently reads as ${c.observed}, it must read as ${c.target}.`),
              'One single shoe, photorealistic, no text, no logo.',
            ].join(' ')
            try {
              emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} repairing ${failedN} mismatch${failedN > 1 ? 'es' : ''} · one pass, then re-checked` })
              const fixed = await editImage(heroForQa.hash, repairPrompt, params.imageEngine)
              budget.spend()
              const v2 = await verifyRender({ hash: fixed.hash, genome: d.spec.genome ?? {
                toe_family: String(d.spec.fields.toe_shape) as Genome['toe_family'],
                closure_form: String(d.spec.fields.closure),
              }, langName })
              const failed2 = v2.checks.filter(c => !c.pass).length
              if (failed2 < failedN) {
                // 수리가 실제로 좁혔다 · 히어로를 교체하고 두 번째 검사 결과를 기록한다
                const idx = d.images.indexOf(heroForQa)
                d.images = d.images.map((im, k) => k === idx ? {
                  ...im, url: fixed.url, hash: fixed.hash, origin: 'regenerated_hq' as const,
                  editedFrom: heroForQa.hash, promptUsed: repairPrompt,
                  // 수리 사실만 남기고 덮어쓰면, 그 카드에서 소재 근거가 사라진다.
                  // 둘 다 참이므로 둘 다 남긴다 — 무엇을 의도했고, 그 컷에 무슨 일이 있었는지.
                  whyUsed: [im.whyUsed, `Vision check found ${failedN} mismatch${failedN > 1 ? 'es' : ''}; one repair pass closed ${failedN - failed2} of them.`]
                    .filter(Boolean).join(' '),
                  // 수리 프롬프트가 'no logo'로 끝난다 — 합성해 둔 마크가 지워졌을 수 있다.
                  // 표시를 남겨 두면 S4 의 재합성 백스톱이 이 컷을 건너뛴다. 거짓 표시를 지운다.
                  logoStamped: false,
                } : im)
                d.qa = v2.checks
                // 다중 객체 판정도 두 번째 검사 기준으로 갱신한다. 첫 판정을 남기면
                // 수리로 생긴 두 짝 문제를 못 잡고, 수리로 고친 문제를 계속 경고한다.
                d.viewMismatch = !v2.single_object
                failedN = failed2
                emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} repair re-check ${v2.checks.length - failed2}/${v2.checks.length}${failed2 ? ' · remaining mismatches stay flagged' : ' · clean'}` })
              } else {
                emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} repair did not close the gap · original kept, mismatches stay flagged` })
              }
            } catch (e) {
              emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} repair pass failed · ${String((e as Error).message).slice(0, 70)} · flagged as-is` })
            }
          } else if (failedN > 0) {
            emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} image cap reached · mismatches flagged without repair` })
          }
        } catch (e) {
          d.qa = []
          emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} verification call failed · left unverified (no simulated pass) · ${String((e as Error).message).slice(0, 70)}` })
        }
      }
      emit({ kind: 'design-update', design: { ...d } })
      // 디자인 한 건이 끝날 때마다 남긴다. 중간에 멈추면 어디서 멈췄는지 로그가 말해 준다.
      emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} done · ${d.images.filter(im => !isSketchView(im.view)).length} cuts (${i + 1} of ${advancing.length})` })
      emit({ kind: 'progress', stage: 'S3', pct: Math.round(((i + 1) / advancing.length) * 100) })
    }
    emit({ kind: 'checkpoint', label: 'S3 done · renders, colourways and QA results saved' })
    emit({ kind: 'stage-done', stage: 'S3' })
    if (upto === 2) { emit({ kind: 'done', endStage: 'S3' }); return }

    // ══ S4 착용 ══
    emit({ kind: 'stage-start', stage: 'S4' })
    emit({ kind: 'log', stage: 'S4', text: 'Scoring metrics. Deterministic numbers and model judgement stay separate and are never summed.' })
    await wait(600)
    // Top N · 다양성 제약 (11.2)
    const topCandidates = advancing.filter(d => !d.rejected)
    const top: Design[] = pickTopDiverse(topCandidates, params.topN)
    // 선정작끼리 실제로 얼마나 다른가. 예전에는 0.42~0.82 난수를 찍어 'spec distance'라고
    // 화면에 적었다 — 왜 이 조합을 골랐는지 설명하는 자리에 지어낸 숫자가 있었다.
    top.forEach((d, i) => {
      d.isTop = true
      d.topDistance = meanDistanceTo(d, top)
      emit({ kind: 'design-update', design: { ...d } })
      emit({ kind: 'log', stage: 'S4', text: `Top ${i + 1}: ${d.spec.design_id} [${d.spec.tier}] · differs from the other picks on ${Math.round(d.topDistance * 100)}% of spec fields` })
    })
    // ── MD 리뷰 · 지표는 이미 있다. 여기서 필요한 건 "그래서 뭘 사겠는가"다 ──
    // 페르소나가 없으면 부르지 않는다. 아무나 할 수 있는 말을 MD 평가라고 붙이지 않는다.
    const md = params.brand?.md
    if (md?.role && topCandidates.length) {
      emit({ kind: 'log', stage: 'S4', text: `${md.role} is reviewing ${topCandidates.length} candidates against ${md.channel || 'the channel'} and the ${md.priceBandKrw || 'stated'} band` })
      try {
        const review = await reviewAsMd({
          persona: md,
          brand: [params.brand?.brandName, params.brand?.tagline].filter(Boolean).join(' · '),
          langName: LANG_NAME[params.researchLang ?? getLang()],
          designs: topCandidates.map(d => ({
            design_id: d.spec.design_id,
            tier: TIER_LABEL[d.spec.tier],
            combo: d.spec.comboLabel,
            spec: Object.entries(d.spec.fields)
              .filter(([k]) => !k.startsWith('is_'))
              .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', '),
            cap: `${Math.round((d.cost.cap_ratio - 1) * 100)}%`,
            moulds: d.cost.tooling.mold_count_required,
            // 비전 검사 결과도 MD 가 본다 · 렌더가 스펙과 어긋난 안을 모르고 살 수는 없다
            rules: [
              ...d.ruleResults.map(r => `${r.rule} ${r.severity}`),
              d.qa.length ? `vision check ${d.qa.length - qaFails(d)}/${d.qa.length}` : 'vision check not run',
            ].join(', '),
          })),
        })
        if (cancelled) return
        // 평가를 각 안에 붙인다. 카드가 이걸 그대로 보여 준다.
        for (const r of review.reviews ?? []) {
          const d = topCandidates.find(x => x.spec.design_id === r.design_id)
          if (d) d.mdReview = r
        }
        for (const p of review.picks ?? []) {
          const d = topCandidates.find(x => x.spec.design_id === p.design_id)
          if (d) d.mdPick = p
        }
        if (review.floor_note) emit({ kind: 'md-floor-note', text: review.floor_note })
        const buys = (review.reviews ?? []).filter(r => r.verdict === 'buy').length
        const fixes = (review.reviews ?? []).filter(r => r.verdict === 'buy_if_fixed').length
        emit({ kind: 'log', stage: 'S4', text: `MD verdict: ${buys} to buy, ${fixes} to buy if fixed, ${(review.reviews ?? []).length - buys - fixes} passed${review.cached ? ' (reused an earlier pass)' : ''}` })
        for (const p of (review.picks ?? []).slice(0, 3)) {
          emit({ kind: 'log', stage: 'S4', text: `MD picks ${p.design_id} as ${p.role_in_range}: ${p.reason}` })
        }
        if (review.floor_note) emit({ kind: 'log', stage: 'S4', text: `On the floor: ${review.floor_note}` })
        // MD가 실제로 고른 것이 있으면 그것이 최종 선정이다. 지표 순위보다 사람의 판단이 앞선다.
        const picked = (review.picks ?? []).map(p => topCandidates.find(x => x.spec.design_id === p.design_id)).filter((x): x is Design => !!x)
        if (picked.length) {
          top.forEach(d => { d.isTop = false; emit({ kind: 'design-update', design: { ...d } }) })
          top.length = 0
          picked.slice(0, params.topN).forEach((d, i) => {
            // 새 선정에 표시를 켠다. 이걸 빼면 최종 선정이 화면에 하나도 안 뜬다.
            d.isTop = true
            d.topDistance = meanDistanceTo(d, picked.slice(0, params.topN))
            top.push(d)
            emit({ kind: 'design-update', design: { ...d } })
            emit({ kind: 'log', stage: 'S4', text: `Final ${i + 1}: ${d.spec.design_id} — chosen by the MD, not by the metric ranking` })
          })
        }
      } catch (e) {
        emit({ kind: 'log', stage: 'S4', text: `MD review unavailable · ${String((e as Error).message).slice(0, 120)} · falling back to the metric ranking` })
      }
    }

    // 최종 선정 컷에는 브랜드 로고가 반드시 올라가야 한다.
    // S3에서 로고를 못 얹은 건(그때 실패했거나 도식으로 떨어진 건)이 그대로 최종이 되면,
    // 브랜드가 자기 로고 없는 이미지를 최종안으로 받게 된다. 여기서 한 번 더 확인한다.
    const brandLogo = params.brand
    if (brandLogo?.applyLogoToImages && brandLogo.logo?.dataUrl && brandLogo.logo.placement !== 'none' && !brandLogo.logo.style?.prompt_clause) {
      for (const d of top) {
        const main = d.images.find(im => im.view === views[0].key && !im.colorway)
        if (!main || main.logoStamped) continue
        try {
          const stamped = await stampLogo(main.hash, brandLogo)
          if (stamped) {
            d.images = d.images.map(im => im === main
              ? { ...im, url: stamped.url, hash: stamped.hash, logoStamped: true } : im)
            emit({ kind: 'design-update', design: { ...d } })
            emit({ kind: 'log', stage: 'S4', text: `${d.spec.design_id} final cut carries the ${brandLogo.brandName || 'brand'} logo at the ${brandLogo.logo.placement}` })
          }
        } catch (e) {
          emit({ kind: 'log', stage: 'S4', text: `${d.spec.design_id} could not carry the logo · ${String((e as Error).message).slice(0, 80)}` })
        }
      }
    }
    await wait(700)
    emit({ kind: 'log', stage: 'S4', text: 'Ground contact aligned and heel height checked visually, within 20%' })
    await wait(800)
    // ── 최종 인간 게이트 (규칙 9) · 가장 비싼 두 단계 앞에서 사람이 슬레이트를 확인한다.
    // 예전에는 게이트가 스케치 직후에만 있어서, 캠페인 컷과 3D 비용이 전부
    // MD 모델이 고른 안 뒤에 실렸다. MD 가 틀리면 지출이 통째로 잘못된 안에 갔다.
    // 카드에서 거절한 최종 후보는 이 지출에서 빠진다. 전부 거절하면 지출 없이 끝난다.
    // 지출이 실제로 앞에 있어야 게이트가 선다. endStage 가 S4 면 3D(S5)는 돌지 않는데
    // make3d 기본값이 true 라, 그걸 이유로 게이트를 세우면 없는 지출을 지키는 셈이다.
    const spendAhead = (campaignCount(params) > 0 && upto >= 3) || (params.make3d && upto >= 4)
    if (params.finalGate !== false && top.length && spendAhead) {
      emit({ kind: 'log', stage: 'S4', text: `Final slate: ${top.map(d => d.spec.design_id).join(', ')}. Campaign shots and 3D wait for your confirmation — reject any pick on its card to drop it from the spend, then continue.` })
      emit({ kind: 'gate', stage: 'S4' })
      await new Promise<void>(res => { gateResolve = res })
      if (cancelled) return
      const dropped = top.filter(d => humanVerdicts.get(d.spec.design_id) === 'reject')
      if (dropped.length) {
        for (const d of dropped) {
          d.isTop = false
          emit({ kind: 'design-update', design: { ...d } })
        }
        const kept = top.filter(d => humanVerdicts.get(d.spec.design_id) !== 'reject')
        top.length = 0
        top.push(...kept)
        emit({ kind: 'log', stage: 'S4', text: `You dropped ${dropped.map(d => d.spec.design_id).join(', ')} · campaign shots and 3D run only for ${top.length ? top.map(d => d.spec.design_id).join(', ') : 'nothing — all picks rejected, so the spend is skipped'}` })
      } else {
        emit({ kind: 'log', stage: 'S4', text: 'Slate confirmed as picked · continuing to campaign shots' })
      }
    }

    // 캠페인 컷 · 착용컷과 연출컷을 한 단계에서 같이 뽑는다.
    // 둘 다 기준 렌더의 편집이다. 새로 그리면 같은 제품이 아니게 된다.
    const shots = campaignCount(params)
    if (shots > 0) {
      const worn = Math.ceil(shots / 2)          // 절반은 착용, 나머지는 연출
      emit({ kind: 'log', stage: 'S4', text: `${shots} campaign cuts per top pick · ${worn} worn, ${shots - worn} staged · caption forced: simulated wear, the real fit may differ` })
      const subject = (TYPE_LABEL[params.itemType] ?? params.itemType).toLowerCase()
      const jobs: { d: Design; base: string; idx: number; kind: 'wear' | 'concept' }[] = []
      for (const d of top) {
        const base = d.images.find(i => i.view === 'lateral' && !i.colorway)
          ?? d.images.find(i => !isSketchView(i.view))
        if (!base) continue
        for (let k = 0; k < shots; k++) {
          jobs.push({ d, base: base.hash, idx: k, kind: k < worn ? 'wear' : 'concept' })
        }
      }
      // 캠페인 컷은 최종 후보의 산출물이라 상한에서 면제한다 (턴어라운드와 같은 논리).
      // 상한이 볼륨 단계(S2·S3)에서 소진돼도 머천다이저가 받아야 할 컷은 나와야 한다.
      await pool(jobs, 2, async (job) => {
        if (cancelled) return
        const personaIdx = top.indexOf(job.d)
        const c = job.kind === 'concept'
          ? conceptPrompt(params.itemType, job.idx - worn, personaIdx, subject, macroName || st_mood(params))
          : null
        const prompt = c ? c.prompt : wearEditPrompt(params.itemType, job.idx)
        const what = c ? c.label : `worn cut ${job.idx + 1}`
        try {
          const r = await editImage(job.base, prompt, params.imageEngine)
          budget.spend()
          job.d.images = [...job.d.images, {
            view: job.kind, url: r.url, hash: r.hash, origin: 'edited_from', editedFrom: job.base,
            conceptLabel: c?.label, persona: c?.persona,
          }]
          emit({ kind: 'design-update', design: { ...job.d } })
          emit({ kind: 'log', stage: 'S4', text: `${job.d.spec.design_id} ${what} done` })
        } catch {
          emit({ kind: 'log', stage: 'S4', text: `${job.d.spec.design_id} ${what} failed · skipping that cut` })
        }
      })
    }
    emit({ kind: 'checkpoint', label: 'S4 done · Top N and campaign shots saved' })
    emit({ kind: 'stage-done', stage: 'S4' })
    if (upto === 3) { emit({ kind: 'done', endStage: 'S4' }); return }

    // ══ S5 3D 쇼룸 ══
    emit({ kind: 'stage-start', stage: 'S5' })
    // 단일 이미지 → 3D (2026-08-13 방식 변경).
    // 턴어라운드 4뷰를 만들지 않는다 — 편집으로 돌린 뷰끼리 미세하게 어긋나 형상을 흐렸고,
    // 선정작당 이미지 3장이 굳는다. 기준 렌더 한 장을 그대로 Tripo image_to_model에 보낸다.
    if (params.make3d) {
      emit({ kind: 'log', stage: 'S5', text: 'Building the 3D showroom · each pick becomes a model from its hero render' })
      for (const d of top) {
        if (cancelled) return
        const base = d.images.find(i => i.view === 'lateral' && !i.colorway)
          ?? d.images.find(i => !isSketchView(i.view) && !['wear', 'concept', 'variation'].includes(i.view))
        if (!base) {
          emit({ kind: 'log', stage: 'S5', text: `${d.spec.design_id} has no clean product render, so 3D is skipped` })
          continue
        }
        try {
          emit({ kind: 'log', stage: 'S5', text: `${d.spec.design_id} building the 3D model from the hero render · a few minutes` })
          const m = await generateModel(base.hash, {
            subject: (TYPE_LABEL[params.itemType] ?? params.itemType).toLowerCase(),
            itemType: params.itemType,
          })
          d.model = { url: m.url, hash: m.hash, format: m.format, views: m.views }
          emit({ kind: 'design-update', design: { ...d } })
          emit({ kind: 'log', stage: 'S5', text: `${d.spec.design_id} 3D ready${m.cached ? ' (reused)' : ''} · GLB downloadable from the card` })
        } catch (e) {
          emit({ kind: 'log', stage: 'S5', text: `${d.spec.design_id} 3D failed · ${String((e as Error).message).slice(0, 90)}` })
        }
      }
    }

    emit({ kind: 'log', stage: 'S5', text: 'Assembling the board · five lanes: brief, Core, Push, Signature, appendix' })
    await wait(600)
    emit({ kind: 'log', stage: 'S5', text: 'Writing the talk track from rationale: trend evidence, brand fit, objections, sources' })
    emit({ kind: 'checkpoint', label: 'S5 done · 3D showroom, board and PDF export ready' })
    emit({ kind: 'stage-done', stage: 'S5' })
    emit({ kind: 'done', endStage: 'S5' })
  })().catch((err: unknown) => {
    // 이 catch가 없던 동안, 안쪽 try 밖에서 던진 예외 하나가 분석을 조용히 끝냈다.
    // 화면에는 마지막 로그가 그대로 남아 영원히 진행 중처럼 보였다.
    // 멈췄으면 멈췄다고 말한다. 그때까지 만든 것은 그대로 남는다.
    if (cancelled) return
    const msg = String((err as Error)?.message ?? err).slice(0, 200)
    console.error('[VRINGON] pipeline stopped', err)
    emit({ kind: 'log', stage: params.endStage, text: `The run stopped here: ${msg}. Everything produced up to this point is saved.` })
    emit({ kind: 'done', endStage: params.endStage })
  })

  return handle
}

// ── 근거 추적 체인 (지시서 10.1) ─────────────────────────────────────
function buildRationale(params: RunParams, spec: DesignSpec, signals: Signal[], _rng: ReturnType<typeof makeRng>, hint: SpecHint): Rationale {
  // ── 게놈 경로 · 근거는 게놈이 실제로 인용한 신호이고, 서사는 저작 의도 그 자체다 ──
  if (spec.genome) {
    const g = spec.genome
    const cited = g.source_signal_ids
      .map(id => signals.find(s => s.signal_id === id))
      .filter((s): s is Signal => !!s)
    const w = cited.length ? Math.round(100 / cited.length) / 100 : 0
    const placementG = spec.tier === 'core'
      ? 'Existing last and existing bottom unit, inside the cost cap. That is what Core is for.'
      : spec.tier === 'push'
        ? 'Keeps either the last or the bottom unit and changes the other, cost within 30% more. That is Push.'
        : 'New last or new outsole mould allowed with amortisation stated. That is Signature.'
    // 게놈이 요구했지만 품목 프로필이 접은 값도 그대로 말한다 (정직성 유지)
    const clampLines = blockedNarrative(spec.hintBlocked)
    return {
      agent_mode: params.mode,
      driving_signals: cited.map(s => ({ signal_id: s.signal_id, weight: w })),
      reference_images: [],
      reference_prompts: params.mode === 'series' && params.series.valueStatement.trim()
        ? [{ text: params.series.valueStatement.trim(), origin: 'user_input' as const, applied_as: spec.fieldsLocked }]
        : [],
      series_dna_inherited: params.mode === 'series' ? spec.fieldsLocked : [],
      type_placement_reason: placementG,
      narrative: [
        g.concept_thesis,
        `${g.hero_mutation.label} — ${g.hero_mutation.drawing_instruction}`,
        ...(g.preserve.length ? [`Kept untouched: ${g.preserve.join(', ')}.`] : []),
        ...clampLines,
        ...(cited.length
          ? [`Built on ${cited.map(s => s.label).join(', ')}.`]
          : ['No research signal cited — this concept works from the archetype grammar alone, and says so.']),
        placementG,
      ],
    }
  }

  // 근거는 실제로 스펙을 바꾼 신호다. 아무것도 못 바꿨을 때만 가장 센 신호로 대신한다.
  const driving = drivingFromHint(hint)
  const byId = (id: string) => signals.find(s => s.signal_id === id)
  const applied = driving.map(d => byId(d.signal_id)).filter((s): s is Signal => !!s)
  // 스펙을 정한 신호가 없으면 가장 많이 관측된 신호를 대신 인용한다.
  // 예전에는 rng.pick(signals) 로 아무 신호나 골라 "이것 때문에 이렇게 됐다"고 서술했다.
  // 무작위로 고른 것을 근거라고 부르면 그건 근거가 아니다. 적어도 세어 본 것을 고른다.
  const strongest = [...signals].sort((a, b) => (b.observed_count ?? 0) - (a.observed_count ?? 0))
  const s1 = applied[0] ?? strongest[0]
  const s2 = applied[1] ?? strongest.find(s => s.signal_id !== s1?.signal_id) ?? s1
  const placement = spec.tier === 'core'
    ? 'Existing last and existing bottom unit, inside the cost cap. That is what Core is for.'
    : spec.tier === 'push'
      ? 'Keeps either the last or the bottom unit and changes the other, cost within 30% more. That is Push.'
      : 'New last or new outsole mould allowed with amortisation stated. That is Signature.'
  const proxyTxt = s1.sales_proxy_score ? ` It also scores ${s1.sales_proxy_score} (${s1.proxy_confidence}) on the sales proxy.` : ''
  const feas = s1.indices?.feasibility ? ` Feasibility reads ${s1.indices.feasibility} — tooling: last ${s1.last_change ?? 'unknown'}, bottom mould ${s1.bottom_tooling_change ?? 'unknown'}.` : ''
  // 신호가 어떤 필드를 정했는지 그대로 적는다. 못 정했으면 그렇다고 적는다.
  const setLines = hintNarrative(hint, signals)
  const openingLine = setLines.length
    ? setLines[0]
    : `${s1.label} showed up ${s1.observed_count} times in this price band, but nothing in it fixes a spec value at this tier.${proxyTxt}`
  return {
    agent_mode: params.mode,
    driving_signals: driving.length ? driving : [
      { signal_id: s1.signal_id, weight: 0 },
      { signal_id: s2.signal_id, weight: 0 },
    ],
    // 예전에는 여기에 competitor.example/product/8812 과 supabase://uploads/archive_112.jpg 를
    // 수집 날짜까지 붙여 넣었다. 둘 다 존재한 적 없는 주소다. 실제로 본 참조가 생기기
    // 전까지는 비워 둔다 — 없는 출처를 적는 것보다 출처가 없다고 하는 편이 낫다.
    reference_images: [],
    // 사용자가 쓴 문장을 그대로 싣는다. 어느 필드에 반영됐는지는 실제로 잠긴 필드만 적는다.
    reference_prompts: params.mode === 'series' && params.series.valueStatement.trim()
      ? [{
          text: params.series.valueStatement.trim(),
          origin: 'user_input' as const,
          applied_as: Object.keys(spec.fieldsLocked ?? []).length ? spec.fieldsLocked : ['checked against the uploads, not applied as a spec value'],
        }]
      : [],
    series_dna_inherited: params.mode === 'series' ? spec.fieldsLocked : [],
    type_placement_reason: placement,
    narrative: [
      openingLine,
      ...setLines.slice(1),
      ...blockedNarrative(spec.hintBlocked),
      driving.length
        ? `Everything else in the spec is open, chosen inside what a ${TYPE_LABEL[spec.itemType] ?? spec.itemType} allows.${feas}`
        : `${s2.label}, observed ${s2.observed_count} times, is the nearest evidence.${feas}`,
      placement,
    ],
  }
}

function buildMetrics(_spec: { category: string }, cost: { cap_ratio: number; tooling: { mold_count_required: number } }, rationale: Rationale, signals: Signal[]): { label: string; value: string }[] {
  const linked = rationale.driving_signals
    .map(ds => signals.find(s => s.signal_id === ds.signal_id))
    .filter((s): s is Signal => !!s)
  const obsSum = linked.reduce((sum, s) => sum + s.observed_count, 0)
  const proxies = linked.map(s => s.sales_proxy_score).filter((x): x is number => typeof x === 'number')
  const proxyAvg = proxies.length ? (proxies.reduce((a, b) => a + b, 0) / proxies.length).toFixed(2) : null
  const capPct = Math.round((cost.cap_ratio - 1) * 100)
  return [
    { label: 'Against cost cap', value: capPct === 0 ? 'level' : capPct > 0 ? `${capPct}% over` : `${Math.abs(capPct)}% under` },
    { label: 'New moulds', value: `${cost.tooling.mold_count_required}` },
    { label: 'Signals observed', value: `${obsSum}${proxyAvg ? ` (proxy ${proxyAvg})` : ''}` },
  ]
}

// ── 안 평가 · 세 줄 모두 실제로 센 것이어야 한다 ──────────────────────
//
// 예전 이 함수는 rng.pick(['High','Medium','Low']) 였다. 값은 난수인데 basis 에는
// "같은 가격대 경쟁 제품과의 속성 거리" 같은 방법론이 적혀 있었다. 하지도 않은 계산의
// 이름을 붙인 것이라, 삭제된 rng QA 와 같은 종류의 거짓말이었다.
// 지금은 셋 다 손에 있는 데이터로 센다. 셀 수 없는 것은 셀 수 없다고 적는다.

/** 두 스펙이 몇 퍼센트나 다른가 · 공통 필드만 본다 */
function specDistance(a: DesignSpec, b: DesignSpec): number {
  const keys = [...new Set([...Object.keys(a.fields), ...Object.keys(b.fields)])]
    .filter(k => !k.startsWith('is_'))
  if (!keys.length) return 0
  const diff = keys.filter(k => String(a.fields[k]) !== String(b.fields[k])).length
  return diff / keys.length
}

const band = (x: number, hi: number, mid: number) => (x >= hi ? 'High' : x >= mid ? 'Medium' : 'Low')

/** 이 안이 같이 뽑힌 안들과 평균 몇 퍼센트나 다른가 (0~1) */
function meanDistanceTo(d: Design, group: Design[]): number {
  const others = group.filter(x => x !== d)
  if (!others.length) return 0
  const sum = others.reduce((a, o) => a + specDistance(d.spec, o.spec), 0)
  return Math.round((sum / others.length) * 100) / 100
}

/** 모든 안이 나온 뒤 한 번에 채운다. 세 줄 각각이 무엇을 셌는지 basis 에 적는다. */
function fillModelEval(pool: Design[], brand: BrandIdentity | undefined, signals: Signal[]): void {
  const configured = !!brand?.brandName
  for (const d of pool) {
    const others = pool.filter(x => x !== d)
    // ① 브랜드 적합 · 금지 위반과 시그니처 반영을 실제로 센다
    const spec = d.spec
    const violations = brand ? checkBrandFit(brand, spec.fields) : []
    const hay = [
      ...Object.values(spec.fields).map(String),
      spec.genome ? [spec.genome.concept_thesis, spec.genome.hero_mutation.label, ...spec.genome.supporting].join(' ') : '',
    ].join(' ').toLowerCase()
    const sig: string[] = brand?.signatureElements ?? []
    const sigHit = sig.filter(s => s.trim() && hay.includes(s.trim().toLowerCase())).length
    const brandFit = !configured
      ? { value: 'Not set', basis: 'No brand is configured, so there is nothing to fit to.' }
      : violations.length
        ? { value: 'Low', basis: `Breaks a brand rule: ${violations.join(', ')}.` }
        : {
            value: sig.length ? band(sigHit / sig.length, 0.5, 0.01) : 'Medium',
            basis: sig.length
              ? `${sigHit} of ${sig.length} signature elements show up in the spec or the concept, and no forbidden rule is broken.`
              : 'No forbidden rule is broken. No signature elements were listed to check against.',
          }

    // ② 차별성 · 이 Run 안의 다른 안들과 실제로 얼마나 다른가
    //    경쟁 제품 속성 벡터는 갖고 있지 않다. 가진 것으로만 말한다.
    const dists = others.map(o => specDistance(spec, o.spec))
    const nearest = dists.length ? Math.min(...dists) : 1
    const overlap = spec.genome?.gate_overlap?.length ?? 0
    const distinct = dists.length
      ? {
          value: overlap ? 'Low' : band(nearest, 0.5, 0.3),
          basis: overlap
            ? `Shares ${spec.genome!.gate_overlap!.join(', ')} with an earlier concept. Its closest neighbour in this run differs on ${Math.round(nearest * 100)}% of spec fields.`
            : `Its closest neighbour in this run differs on ${Math.round(nearest * 100)}% of spec fields. Measured inside this run only — competitor products are not compared field by field.`,
        }
      : { value: 'Unknown', basis: 'Only one design in this run, so there is nothing to be distinct from.' }

    // ③ 트렌드 근거 · 스펙을 실제로 정한 신호만 센다 (weight 0 은 아무것도 못 정한 신호다)
    const cited = d.rationale.driving_signals.filter(s => s.weight > 0)
      .map(s => signals.find(g => g.signal_id === s.signal_id)).filter((s): s is Signal => !!s)
    const obs = cited.reduce((a, s) => a + (s.observed_count ?? 0), 0)
    const highConf = cited.filter(s => s.confidence === 'high').length
    const backing = !cited.length
      ? { value: 'None', basis: 'No research signal set a value on this spec. It comes from the archetype grammar.' }
      : { value: band(obs, 6, 3), basis: `${cited.length} signal${cited.length > 1 ? 's' : ''} set values on this spec, observed ${obs} times in total, ${highConf} of them at high confidence.` }

    d.modelEval = [
      { label: 'Brand fit', value: brandFit.value, basis: brandFit.basis },
      { label: 'Distinctiveness', value: distinct.value, basis: distinct.basis },
      { label: 'Trend backing', value: backing.value, basis: backing.basis },
    ]
  }
}

// buildQA(난수 시뮬레이션 QA)는 2026-08-13에 폐기됐다.
// "vision QA"라는 이름으로 이미지를 보지 않은 채 rng.chance()로 통과/실패를 지어냈다.
// 실제 검증은 /api/verify/render (server/design-api.mjs)가 한다 — 지시서 규칙 13.

// Top N 다양성 제약 (지시서 11.2 · 유형별 최소 1개 + 스펙 거리)
/** 비전 검사에서 몇 항목이 어긋났는가 */
const qaFails = (d: Design) => d.qa.filter(q => !q.pass).length

/** 선정 정렬용 검증 점수 · 통과(0) < 미검증(0.5) < 실패(1+).
 *  미검증을 0으로 두면 검사를 안 받은 안이 다 통과한 안과 동점이 된다 —
 *  검증이 죽었을 때 오히려 유리해지는 구조는 검증을 무의미하게 만든다. */
const qaScore = (d: Design) => d.qa.length === 0 ? 0.5 : qaFails(d)

function pickTopDiverse(pool: Design[], n: number): Design[] {
  const byTier: Record<string, Design[]> = { core: [], push: [], signature: [] }
  pool.forEach(d => byTier[d.spec.tier].push(d))
  // 검증을 통과한 안이 먼저다. 예전에는 원가순뿐이라, 비전 검사에서 어긋난 안이
  // 그대로 최종에 올랐다 — 검사를 하고도 결과가 선정에 닿지 않았다 (지시서 §S8).
  // 같은 검증 상태 안에서는 원가순을 유지한다.
  const rank = (a: Design, b: Design) => (qaScore(a) - qaScore(b)) || (a.cost.cap_ratio - b.cost.cap_ratio)
  for (const t of Object.keys(byTier)) byTier[t].sort(rank)
  const picked: Design[] = []
  // 유형별 최소 1개
  for (const t of ['core', 'push', 'signature']) {
    if (picked.length < n && byTier[t].length) picked.push(byTier[t].shift()!)
  }
  const rest = [...byTier.core, ...byTier.push, ...byTier.signature].sort(rank)
  while (picked.length < n && rest.length) picked.push(rest.shift()!)
  return picked
}
