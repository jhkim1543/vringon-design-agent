// ── 파이프라인 엔진 S1~S5 · 진행 스트리밍·승인 게이트·체크포인트 ──────
import type { Design, DesignSpec, DesignTier, PipelineEvent, Rationale, RunParams, Signal, Stage, Territory } from './types'
import { PACKS, profileOf, resetSeq, tierCapRule, viewSetFor } from './packs'
import { blockedNarrative, deriveSpecHints, deriveSpecHintsFrom, drivingFromHint, hintNarrative, locksFromSeries, reconcileHint, signalCombos } from './signalSpec'
import type { SpecHint } from './signalSpec'
import { makeRng } from './rng'
import { COMPETITORS, DIRECTIONS, SIGNALS } from './samples'
import { COLORWAY_NAMES } from './sketch'
import {
  colorwayEditPrompt, conceptPrompt, editImage, generateImage, renderFromSketchPrompt, renderPrompt,
  generateModel, sketchPrompt, sketchVariationPrompt, silhouetteRead, slidersToLabel, stampLogo, variationPrompt, variationSliders, viewEditPrompt, wearEditPrompt,
} from './aiClient'
import type { TrendClauseInput } from './aiClient'
import { fetchCompetitors, fetchDossier, fetchRetailPulse, fetchTrends, pulseToCompetitors, toBias, toCompetitors, toSignals, setRunLang } from './research'
import { readMoodboard, readSeries, reviewAsMd, toSeriesDna } from './uploads'
import { authorGenome, brandSummaryOf, diversityGate, genomeDigest, genomeToHint, planTerritories, verifyRender } from './genome'
import type { Genome } from './genome'
import { getLang, LANG_NAME } from './i18n'
import { campaignCount, lineFingerprint, MODE_LABEL, MODE_SCOPE, TIER_LABEL, TYPE_EN, TYPE_LABEL } from './types'
import { ENGINES } from './imageEngines'

export type Emit = (e: PipelineEvent) => void

export interface PipelineHandle {
  resume: () => void         // 승인 게이트 해제
  cancel: () => void
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
  const isCancelled = () => cancelled

  const handle: PipelineHandle = {
    resume() { gateResolve?.(); gateResolve = null },
    cancel() { cancelled = true; gateResolve?.() },
  }

  ;(async () => {
    const rng = makeRng(params.sketchCount * 7919 + params.mode.length * 131 + 17)
    resetSeq()
    const pack = PACKS.shoe
    const views = viewSetFor(params.itemType)
    const wait = (ms: number) => sleep(ms / speed, isCancelled)
    const upto = STAGE_ORDER.indexOf(params.endStage)
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
    let st_mdFloorNote = ''
    // 무드보드가 문서에서 실제로 읽어 낸 신호. 못 읽었으면 비어 있고, 비어 있으면 비어 있다고 말한다.
    let moodSignals: Signal[] = []
    // 시리즈에서 실제로 반복된 것 중, 스펙 값으로 옮길 수 있는 것만. 사진으로 못 보는 건 안 잠근다.
    let seriesLocks: Record<string, string | number> = {}

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
        emit({ kind: 'log', stage: 'S1', text: 'Also sweeping department-store and luxury-retail bestseller pages: Lotte, SSG, The Hyundai, MR PORTER, Harrods' })
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
        emit({ kind: 'log', stage: 'S1', text: `Competitor research failed · ${String((e as Error).message).slice(0, 120)} · falling back to sample data` })
        emit({ kind: 'competitors', items: COMPETITORS.shoe })
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
          seriesLocks = locksFromSeries(read.invariant, read.of)
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
          typeKo: typeName, season: '2026 F/W',
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
          season: 'FW26',
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
          typeKo: typeName, season: '2026 F/W',
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
        emit({ kind: 'log', stage: 'S1', text: `Trend research failed · ${String((e as Error).message).slice(0, 120)} · falling back to sample data` })
      }
    }
    // 무드보드는 문서에서 실제로 읽어 낸 신호를 쓴다.
    // 예전에는 여기서 샘플 상수에 난수 페이지 번호를 붙여 출처인 척했다. 그건 조작이다.
    if (!signals.length && moodSignals.length) signals = moodSignals
    if (!signals.length && params.mode !== 'moodboard') signals = SIGNALS.shoe
    if (!signals.length) {
      emit({ kind: 'log', stage: 'S1', text: 'No signals: the document produced none and this mode invents nothing. Specs below are archetype defaults, not research.' })
    }
    emit({ kind: 'signals', signals })
    const lowConf = signals.filter(s => s.confidence === 'low').length
    emit({ kind: 'log', stage: 'S1', text: `${signals.length} signals confirmed · none unsourced${lowConf ? ` · ${lowConf} single source, marked low confidence` : ''}` })
    emit({ kind: 'log', stage: 'S1', text: 'Each signal carries four indices — commercial, cultural, forecast, feasibility — never a single blended score' })
    await wait(600)
    emit({ kind: 'directions', items: DIRECTIONS.shoe })
    emit({ kind: 'log', stage: 'S1', text: 'Three directions built, one per tier · every claim traced to a source' })
    emit({ kind: 'checkpoint', label: 'S1 done · signals.json · directions[3] saved' })
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
    if (params.mode === 'series') {
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

    // ── Design Genome 저작 (지시서 v2 S3~S4 · 라이트 모드) ──────────────
    // 디자인의 저자를 LLM으로 바꾼다. 영토를 먼저 계획하고, 안마다 독립 호출로 게놈을 받는다.
    // 실패하면 위의 조합 경로로 떨어지되, 폴백임을 로그에 명시한다 (규칙 2·20).
    const langName = LANG_NAME[params.researchLang ?? getLang()]
    const brandSummary = brandSummaryOf(params.brand)
    const gProf = profileOf(params.itemType)
    const genomeProfile = {
      heelMin: gProf.heel[0], heelMax: gProf.heel[1],
      panelMin: gProf.panels[0], panelMax: gProf.panels[1],
      closures: gProf.closures, constructions: gProf.constructions,
    }
    let territories: Territory[] = []
    if (!brandSummary) {
      emit({ kind: 'log', stage: 'S2', text: 'Brand lens is empty · territories will lean toward the market average. Set up the brand to pull them your way.' })
    }
    try {
      emit({ kind: 'log', stage: 'S2', text: 'Planning concept territories · distinct design spaces, not intensity steps of one trend' })
      const tr = await planTerritories({
        signals, itemTypeEn: TYPE_EN[params.itemType] ?? 'shoe',
        itemType: params.itemType, brandSummary, langName,
      })
      if (cancelled) return
      territories = tr.territories ?? []
      emit({ kind: 'log', stage: 'S2', text: `${territories.length} territories planned${tr.cached ? ' (reused an earlier pass)' : ''}` })
      for (const t of territories) {
        emit({ kind: 'log', stage: 'S2', text: `Territory ${t.name}: ${t.consumer_role}${t.drop_signal_ids?.length ? ` · drops ${t.drop_signal_ids.join(', ')} — ${t.drop_reason}` : ''}` })
      }
    } catch (e) {
      emit({ kind: 'log', stage: 'S2', text: `Territory planning failed · ${String((e as Error).message).slice(0, 100)} · falling back to signal combinations — these designs are NOT LLM-authored` })
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
        for (let attempt = 0; attempt < 2 && !genome; attempt++) {
          try {
            const g = await authorGenome({
              territory: terr, tier, signals, profile: genomeProfile, brandSummary,
              antiSimilarity: [
                ...acceptedGenomes.map(genomeDigest),
                ...(attempt > 0 ? [`이전 시도는 다음 축이 겹쳐 탈락: ${lastCollisions.join(', ')}. 이 축들만 바꾸고 나머지는 유지하라.`] : []),
              ],
              itemTypeEn: TYPE_EN[params.itemType] ?? 'shoe', langName,
            })
            if (cancelled) return
            const gate = diversityGate(g, acceptedGenomes, tier)
            if (gate.pass) genome = g
            else {
              lastCollisions = gate.collisions
              emit({ kind: 'log', stage: 'S2', text: `Genome for ${terr.name} collides on ${gate.collisions.join(', ')} · re-authoring those axes only` })
            }
          } catch (e) {
            emit({ kind: 'log', stage: 'S2', text: `Genome authorship failed for ${terr.name} · ${String((e as Error).message).slice(0, 80)} · this slot falls back to signal combos (not LLM-authored)` })
            break
          }
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
        modelEval: buildModelEval(rng),
        colorways: [], images: [], isTop: false,
      }
      designs.push(d)
      emit({ kind: 'design', design: d })
      emit({ kind: 'log', stage: 'S2', text: `${spec.design_id} [${tier}] ${rejected ? 'rule reject · ' + ruleResults.filter(r => r.severity === 'fail').map(r => r.rule).join(', ') : 'passed rules, queued for sketch'}` })
      emit({ kind: 'progress', stage: 'S2', pct: Math.round(((i + 1) / tiers.length) * 100) })
      await wait(180)
    }
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

    // 실제 스케치 생성 · 룰 통과분만, 상한까지. 초과분은 SVG 폴백
    // 단계가 갈라진다: ① 외형을 잡는 기준 스케치(흑백 3뷰) → ② 같은 외형에서 흑백 스케치 변형 여러 장.
    // 컬러는 여기서 절대 나오지 않는다. 색은 S3에서 이 스케치들을 사진으로 옮길 때 처음 들어간다.
    if (budget.leftSketch() > 0) {
      const targets = alive.slice(0, budget.leftSketch())
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

      // ② 스케치 변형 · 하나의 외형에서 여러 흑백 안 (designsPerSketch가 변형 수를 정한다)
      const dpsWanted = params.designsPerSketch ?? 1
      if (dpsWanted > 1 && budget.leftSketch() > 0) {
        const withSketch = targets.filter(d => d.images.some(i => i.view === 'sketch'))
        emit({ kind: 'log', stage: 'S2', text: `Branching ${dpsWanted - 1} black-ink variations from each base form · same silhouette and outsole, different upper takes` })
        await pool(withSketch, 2, async (d) => {
          const base = d.images.find(i => i.view === 'sketch')!
          for (let k = 0; k < dpsWanted - 1; k++) {
            if (cancelled || budget.leftSketch() <= 0) return
            try {
              const p = sketchVariationPrompt(k)
              const r = await editImage(base.hash, p, params.imageEngine)
              budget.spendSketch()
              d.images = [...d.images, { view: 'sketch_var', url: r.url, hash: r.hash, origin: 'edited_from', editedFrom: base.hash, promptUsed: p }]
              emit({ kind: 'design-update', design: { ...d } })
              emit({ kind: 'log', stage: 'S2', text: `${d.spec.design_id} sketch variation ${k + 1} of ${dpsWanted - 1} done` })
            } catch {
              emit({ kind: 'log', stage: 'S2', text: `${d.spec.design_id} sketch variation ${k + 1} failed · skipping` })
            }
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
    const advanceN = Math.max(1, Math.round(alive.length * params.renderRatio))
    const advancing = [...alive].sort((a, b) => a.cost.cap_ratio - b.cost.cap_ratio).slice(0, advanceN)
    emit({ kind: 'log', stage: 'S3', text: `${Math.round(params.renderRatio * 100)}% move to render · ${advanceN} selected` })

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
      d.colorways = COLORWAY_NAMES.slice(0, params.colorwayCount)

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
          d.images = [...d.images, { view: views[0].key, url: baseUrl, hash: baseHash, origin: 'generated', promptUsed: basePrompt, logoStamped: drewMark || baseHash !== r.hash }]
          emit({ kind: 'design-update', design: { ...d } })
        } catch (e) {
          d.imageError = String((e as Error).message || e)
          emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} base render failed · ${d.imageError}` })
        }
        // ② 스케치 변형들도 각각 컬러 디자인이 된다 · 흑백 스케치가 원본, 색은 여기서 처음 입혀진다
        const sketchVars = d.images.filter(i => i.view === 'sketch_var')
        for (let k = 0; k < sketchVars.length; k++) {
          if (cancelled || budget.left() <= 0 || extrasLeft <= 0) break
          const sv = sketchVars[k]
          // 장마다 다른 소재 해석 · 같은 지시를 두 번 주면 같은 사진이 두 장 나온다
          const p2 = renderFromSketchPrompt(d.spec, trendClause, line, params.brand, k + 1)
          try {
            const r2 = await editImage(sv.hash, p2, params.imageEngine)
            budget.spend(); extrasLeft -= 1
            d.images = [...d.images, { view: 'design', url: r2.url, hash: r2.hash, origin: 'edited_from', editedFrom: sv.hash, promptUsed: p2 }]
            emit({ kind: 'design-update', design: { ...d } })
            emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} sketch variation ${k + 1} coloured into a design` })
          } catch {
            emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} design from sketch variation ${k + 1} failed · skipping` })
          }
        }

        // ③④ 추가 뷰·컬러웨이 = 기준 렌더의 편집 (동일 객체 유지)
        // 계열별 필수 뷰셋을 따른다 · 스니커즈는 내측, 힐은 후면이 반드시 있어야 한다
        if (baseHash) {
          const jobs: { view: string; colorway?: string; prompt: string }[] = [
            ...views.filter(v => v.required).slice(1, params.viewCount)
              .map(v => ({ view: v.key, prompt: viewEditPrompt(v.key) })),
            ...d.colorways.map(cw => ({ view: views[0].key, colorway: cw, prompt: colorwayEditPrompt(cw) })),
          ].slice(0, Math.min(budget.left(), extrasLeft))
          await pool(jobs, 2, async (job) => {
            if (cancelled) return
            try {
              const r = await editImage(baseHash!, job.prompt, params.imageEngine)
              budget.spend(); extrasLeft -= 1
              d.images = [...d.images, { view: job.view, colorway: job.colorway, url: r.url, hash: r.hash, origin: 'edited_from', editedFrom: baseHash! }]
              emit({ kind: 'design-update', design: { ...d } })
            } catch (e) {
              emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} ${job.colorway ?? job.view} edit failed · dropping that cut only` })
            }
          })
        }
      } else {
        await wait(350)
      }

      // 스케치 한 장에서 갈라지는 제품 베리에이션 · 축을 하나씩만 바꿔 계보를 유지한다
      if (params.variationCount > 0 && budget.left() > 0 && extrasLeft > 0) {
        const baseImg = d.images.find(i => i.view === 'lateral' && !i.colorway)
          ?? d.images.find(i => i.origin === 'generated' && i.view !== 'sketch')
        if (baseImg) {
          // 베리에이션 축은 스타일 슬라이더에서 나온다 (create-variation 방식).
          // 회차마다 다른 갈래를 집으므로 네 장이면 무드·실루엣·밀도·엣지가 한 번씩 나온다.
          const jobs = Array.from({ length: params.variationCount }, (_, k) => {
            const sliders = variationSliders(k, rng)
            return { k, sliders, label: slidersToLabel(sliders), prompt: variationPrompt(k, sliders) }
          })
          emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} branching ${jobs.length} variations · one style axis each: ${jobs.map(j => j.label.split(' · ')[0]).join(', ')}` })
          await pool(jobs.slice(0, Math.max(0, Math.min(budget.left(), extrasLeft))), 2, async (job) => {
            if (cancelled) return
            try {
              const r = await editImage(baseImg.hash, job.prompt, params.imageEngine)
              budget.spend(); extrasLeft -= 1
              d.images = [...d.images, {
                view: 'variation', url: r.url, hash: r.hash, origin: 'edited_from',
                editedFrom: baseImg.hash, variantOf: d.spec.design_id, variantAxis: job.label,
                // 어떤 지시로 갈라졌는지 카드가 그대로 보여 준다
                promptUsed: job.prompt,
                sliders: job.sliders,
              }]
              emit({ kind: 'design-update', design: { ...d } })
              emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} variation: ${job.label}` })
            } catch {
              emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} variation "${job.label}" failed · skipping that one` })
            }
          })
        }
      }

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
          const failedN = v.checks.filter(c => !c.pass).length
          if (!v.single_object) {
            d.viewMismatch = true
            emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} render shows more than one object · flagged, kept visible` })
          }
          emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} vision check ${v.checks.length - failedN}/${v.checks.length}${failedN ? ' · mismatches flagged, not hidden' : ''}` })
        } catch (e) {
          d.qa = []
          emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} verification call failed · left unverified (no simulated pass) · ${String((e as Error).message).slice(0, 70)}` })
        }
      }
      emit({ kind: 'design-update', design: { ...d } })
      // 디자인 한 건이 끝날 때마다 남긴다. 중간에 멈추면 어디서 멈췄는지 로그가 말해 준다.
      emit({ kind: 'log', stage: 'S3', text: `${d.spec.design_id} done · ${d.images.filter(im => im.view !== 'sketch' && im.view !== 'sketch_var').length} cuts (${i + 1} of ${advancing.length})` })
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
    top.forEach((d, i) => {
      d.isTop = true
      d.topDistance = Math.round((0.42 + rng.next() * 0.4) * 100) / 100
      emit({ kind: 'design-update', design: { ...d } })
      emit({ kind: 'log', stage: 'S4', text: `Top ${i + 1}: ${d.spec.design_id} [${d.spec.tier}] · spec distance ${d.topDistance}` })
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
            rules: d.ruleResults.map(r => `${r.rule} ${r.severity}`).join(', '),
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
        st_mdFloorNote = review.floor_note ?? ''
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
            d.topDistance = d.topDistance ?? Math.round((0.42 + rng.next() * 0.4) * 100) / 100
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
          ?? d.images.find(i => !['sketch', 'sketch_var'].includes(i.view))
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
          ?? d.images.find(i => !['sketch', 'sketch_var', 'wear', 'concept', 'variation'].includes(i.view))
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
function buildRationale(params: RunParams, spec: DesignSpec, signals: Signal[], rng: ReturnType<typeof makeRng>, hint: SpecHint): Rationale {
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
  const s1 = applied[0] ?? rng.pick(signals)
  const s2 = applied[1] ?? rng.pick(signals.filter(s => s.signal_id !== s1.signal_id))
  const compRef = {
    ref_id: `rf_${rng.int(100, 999)}`, source_type: 'competitor' as const,
    source_url: 'https://competitor.example/product/8812', collected_at: '2026-05-14',
    borrowed_attributes: [s1.attribute, s2.attribute], usage: 'attribute_only' as const,
  }
  const archRef = {
    ref_id: `rf_${rng.int(100, 999)}`, source_type: 'archive' as const,
    source_url: 'supabase://uploads/archive_112.jpg', collected_at: '2026-04-02',
    borrowed_attributes: ['proportion'], usage: 'visual_reference' as const,
  }
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
    reference_images: [compRef, archRef],
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

function buildMetrics(spec: { category: string }, cost: { cap_ratio: number; tooling: { mold_count_required: number } }, rationale: Rationale, signals: Signal[]): { label: string; value: string }[] {
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

function buildModelEval(rng: ReturnType<typeof makeRng>): { label: string; value: string; basis: string }[] {
  const lv = ['High', 'Medium', 'Low']
  return [
    { label: 'Brand fit', value: rng.pick(lv.slice(0, 2)), basis: 'How much of the existing last and mould is reused, and silhouette distance from the archive' },
    { label: 'Distinctiveness', value: rng.pick(lv), basis: 'Attribute distance from competitor products in the same band' },
    { label: 'Trend backing', value: rng.pick(lv.slice(0, 2)), basis: 'Observation count and index profile of the linked signals' },
  ]
}

// buildQA(난수 시뮬레이션 QA)는 2026-08-13에 폐기됐다.
// "vision QA"라는 이름으로 이미지를 보지 않은 채 rng.chance()로 통과/실패를 지어냈다.
// 실제 검증은 /api/verify/render (server/design-api.mjs)가 한다 — 지시서 규칙 13.

// Top N 다양성 제약 (지시서 11.2 · 유형별 최소 1개 + 스펙 거리)
function pickTopDiverse(pool: Design[], n: number): Design[] {
  const byTier: Record<string, Design[]> = { core: [], push: [], signature: [] }
  pool.forEach(d => byTier[d.spec.tier].push(d))
  for (const t of Object.keys(byTier)) byTier[t].sort((a, b) => a.cost.cap_ratio - b.cost.cap_ratio)
  const picked: Design[] = []
  // 유형별 최소 1개
  for (const t of ['core', 'push', 'signature']) {
    if (picked.length < n && byTier[t].length) picked.push(byTier[t].shift()!)
  }
  const rest = [...byTier.core, ...byTier.push, ...byTier.signature].sort((a, b) => a.cost.cap_ratio - b.cost.cap_ratio)
  while (picked.length < n && rest.length) picked.push(rest.shift()!)
  return picked
}
