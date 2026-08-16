// ── 품평 보드 모델 · 화면(React Flow)과 Miro 내보내기가 같은 구조를 쓴다 ──
// 순서: 입력 → 조사 → 신호 → 디렉션 → 디자인 → 선정
// 연결(edge)은 장식이 아니라 실제 데이터다. 디자인이 어떤 신호에서 나왔는지는
// rationale.driving_signals에, 디렉션이 어떤 신호를 묶었는지는 signal_ids에 있다.
import type { Design, RunState } from './types'
import { COMP_GROUP_LABEL, lineFingerprint, MODE_LABEL, MODE_SCOPE, TIER_LABEL, TYPE_LABEL } from './types'
import { buildLocalPitch } from './pitch'
import type { SeasonDossier } from './research'
import { GRADE_LABEL, shotUrl, metricText } from './research'

export type BoardNodeKind =
  | 'input' | 'research' | 'signal' | 'direction' | 'design' | 'selection' | 'appendix'

export interface BoardNode {
  id: string
  kind: BoardNodeKind
  column: number            // 0..5 · 좌에서 우로 흐른다
  row: number
  title: string
  body: string[]
  tone?: 'neutral' | 'accent' | 'warn' | 'muted'
  design?: Design           // design 노드일 때만
  imageUrl?: string
  /** 3D 모델 (GLB) · 보드에서 뷰어로 돌려 본다 */
  modelUrl?: string
  /** 시즌 팔레트 · 글 대신 색으로 보인다 */
  palette?: { name: string; hex: string }[]
  /** 이 카드에 얽힌 실제 생성 프롬프트 발췌 · 스케치가 디자인이 된 근거 */
  prompts?: string[]
  isPitch?: boolean         // 발표 근거 카드
}

export interface BoardEdge {
  from: string
  to: string
  label?: string
  weight?: number           // 굵기 · 기여도
  dashed?: boolean
}

export interface BoardModel {
  columns: { key: string; title: string; note: string }[]
  nodes: BoardNode[]
  edges: BoardEdge[]
}

export function buildBoardModel(st: RunState): BoardModel {
  const p = st.params
  const scope = MODE_SCOPE[p.mode]
  const nodes: BoardNode[] = []
  const edges: BoardEdge[] = []

  const columns = [
    { key: 'input', title: '1 · Input', note: 'What you gave it' },
    { key: 'research', title: '2 · Research', note: scope.competitor ? 'What the agent collected' : scope.trend ? 'Trend research' : 'Your uploads, read' },
    { key: 'signal', title: '3 · Signals', note: 'Observations with a source' },
    { key: 'direction', title: '4 · Directions', note: 'Signals combined' },
    { key: 'sketchlane', title: '5 · Sketches', note: 'One form, black ink only' },
    { key: 'design', title: '6 · Designs', note: 'Colour enters here' },
    { key: 'selection', title: '7 · Selection', note: 'Metrics and calls' },
    { key: 'variation', title: '8 · Concepts', note: 'Same sketch, another material and colour story' },
    { key: 'campaign', title: '9 · Campaign shots', note: 'Worn on a model, staged on set' },
    { key: 'showroom', title: '10 · 3D showroom', note: 'Turn it, or open it full size' },
  ]

  // ── 1 입력 ──────────────────────────────────────────────────────
  const inputBody: string[] = []
  inputBody.push(`Line: ${lineFingerprint(p.line, p.itemType)}`)
  if (p.mode === 'trend') {
    inputBody.push(`${p.trend.competitors.length} competitor lines: ${p.trend.competitors.join(', ')}`)
    inputBody.push(`Primary band KRW ${(p.trend.priceMinKrw / 10000).toFixed(0)}0k-${(p.trend.priceMaxKrw / 10000).toFixed(0)}0k · ${p.trend.priceBand}${p.trend.adjacentBand ? ' · adjacent band as reference' : ''}`)
  } else if (p.mode === 'series') {
    inputBody.push(`Series "${p.series.seriesName || 'untitled'}" · ${p.series.archiveFiles.length} designs`)
    if (p.series.valueStatement) inputBody.push(`Value: ${p.series.valueStatement.slice(0, 90)}`)
    inputBody.push(p.series.trendSearch ? 'Trend research on, no competitor research' : 'No outside research')
  } else {
    inputBody.push(`${p.moodboard.files.length} uploads: ${p.moodboard.files.join(', ') || 'none'}`)
    inputBody.push('Nothing outside these files')
  }
  nodes.push({
    id: 'in', kind: 'input', column: 0, row: 0,
    title: `${MODE_LABEL[p.mode]} mode input`, body: inputBody, tone: 'accent',
  })

  // ── 2 조사 ──────────────────────────────────────────────────────
  let researchIds: string[] = []
  if (p.mode === 'trend') {
    const inBand = st.competitors.filter(c => c.in_band)
    const out = st.competitors.filter(c => !c.in_band)
    // 조사 레인의 주인공은 제품 사진이다. 요약 카드는 한 줄로 줄인다.
    const noProxy = st.competitors.filter(c => c.observation_count < 2)
    nodes.push({
      id: 'r-comp', kind: 'research', column: 1, row: 0,
      title: 'What the market is selling',
      body: [
        `${st.competitors.length} products · ${inBand.length} in band${out.length ? ` · ${out.length} reference` : ''}`,
        noProxy.length ? 'Single pass, so no sales ranking is inferred' : '',
      ].filter(Boolean),
      tone: 'accent',
    })
    researchIds = ['r-comp', 'r-trend']
    edges.push({ from: 'in', to: 'r-comp', label: 'competitor lines' })
    // 실제 수집한 제품 사진을 보드에 올린다 · 근거는 글이 아니라 사진으로 보인다.
    // 백화점·명품몰 베스트셀러(retailer가 붙은 것)가 먼저 온다 — 지금 팔리는 것부터.
    const withShots = st.competitors.filter(c => c.image_urls?.length || c.product_url)
    const shotPick = [...withShots.filter(c => c.retailer), ...withShots.filter(c => !c.retailer)].slice(0, 14)
    shotPick.forEach((c, k) => {
      const id = `comp-shot-${k}`
      nodes.push({
        id, kind: 'research', column: 1, row: 1 + k,
        title: `${c.brand} ${c.name}`,
        // 가격과 어디서 팔리는지 한 줄. 나머지는 사진이 말한다.
        body: [[
          c.price_krw > 0 ? `KRW ${(c.price_krw / 10000).toFixed(0)}0k` : '',
          c.retailer ? `${c.retailer} bestseller` : (c.competitor_group ? COMP_GROUP_LABEL[c.competitor_group] : ''),
          c.size_status === 'size_broken' ? 'size broken' : '',
        ].filter(Boolean).join(' · ')].filter(Boolean),
        imageUrl: shotUrl(c.image_urls?.[0] ?? '', c.product_url),
        tone: c.retailer ? 'accent' : 'neutral',
      })
      edges.push({ from: 'r-comp', to: id, dashed: true })
    })
    nodes.push({
      id: 'r-trend', kind: 'research', column: 1, row: 1 + shotPick.length,
      title: 'Trend research', body: [`${st.signals.length} signals, each with a source`],
    })
    edges.push({ from: 'in', to: 'r-trend', label: 'line profile' })
  } else if (p.mode === 'series') {
    nodes.push({
      id: 'r-dna', kind: 'research', column: 1, row: 0,
      title: 'Series DNA',
      body: [
        `${st.seriesDna?.invariant.length ?? 0} fixed · ${st.seriesDna?.variable.length ?? 0} variable · ${st.seriesDna?.ambiguous.length ?? 0} unclear`,
        ...(st.seriesDna?.invariant.slice(0, 2).map(i => `Fixed: ${i.label} (${i.observed_in}/${i.of})`) ?? []),
      ],
      tone: 'accent',
    })
    nodes.push({
      id: 'r-check', kind: 'research', column: 1, row: 1,
      title: 'Stated vs observed',
      body: st.dnaConflict
        ? [`You wrote ${st.dnaConflict.brandClaim}`, `We see ${st.dnaConflict.observed}`,
           st.dnaConflict.resolved ? `Going with: ${st.dnaConflict.resolved}` : 'Not resolved yet']
        : ['No conflict'],
      tone: 'warn',
    })
    researchIds = ['r-dna', 'r-check']
    edges.push({ from: 'in', to: 'r-dna', label: 'uploaded designs' })
    edges.push({ from: 'in', to: 'r-check', label: 'value statement' })
    edges.push({ from: 'r-dna', to: 'r-check', label: 'observed elements' })
    if (p.series.trendSearch) {
      nodes.push({ id: 'r-trend', kind: 'research', column: 1, row: 2, title: 'Trend research', body: ['The only outside research in Series mode', 'No competitor research'] })
      researchIds.push('r-trend')
    }
  } else {
    nodes.push({
      id: 'r-pdf', kind: 'research', column: 1, row: 0,
      title: 'Uploads, read',
      body: ['Sections, images, captions and colour chips', 'Tagged untrusted so any instruction inside stays data'],
      tone: 'accent',
    })
    nodes.push({
      id: 'r-bias', kind: 'research', column: 1, row: 1,
      title: 'Source perspective',
      body: st.reportBias ? [st.reportBias.perspective, ...st.reportBias.notes.slice(0, 2)] : [],
      tone: 'warn',
    })
    researchIds = ['r-pdf', 'r-bias']
    edges.push({ from: 'in', to: 'r-pdf', label: 'PDF' })
    edges.push({ from: 'r-pdf', to: 'r-bias', label: 'citation spread' })
  }

  // ── 시즌 도시에 · MICAM 형식의 매크로트렌드를 조사 열에 얹는다 ──────
  // 경쟁 제품 사진 카드가 이미 3행부터 쓰고 있으면 그 아래로 내린다
  const compShotRows = nodes.filter(n => n.id.startsWith('comp-shot-')).length
  const dosRow = 2 + compShotRows
  const dossier = st.dossier as SeasonDossier | null
  if (dossier?.macrotrends?.length) {
    nodes.push({
      id: 'dos', kind: 'research', column: 1, row: dosRow,
      title: `${dossier.season} · ${dossier.season_title}`,
      body: [dossier.powershift ? dossier.powershift : `${dossier.macrotrends.length} directions`],
      tone: 'accent',
    })
    edges.push({ from: 'in', to: 'dos', label: 'season brief' })

    // 매크로 카드는 한 줄 + 팔레트 스와치. 수치와 근거는 리포트에 있다.
    dossier.macrotrends.forEach((m, i) => {
      const id = `macro-${i}`
      nodes.push({
        id, kind: 'research', column: 1, row: dosRow + 1 + i * 10,
        title: `${m.name} · ${GRADE_LABEL[m.grade] ?? m.grade}`,
        body: [
          m.statement,
          (m.key_items ?? []).slice(0, 3).map(k => k.name).join(' · '),
        ].filter(Boolean),
        palette: (m.palette ?? []).slice(0, 8).map(c => ({ name: c.name, hex: c.hex })),
      })
      edges.push({ from: 'dos', to: id, label: 'macrotrend' })

      // 예측도 근거 사진을 들고 있어야 한다 · 키아이템이 인용한 상품 페이지에서 끌어온다
      const withShot = (m.key_items ?? []).filter(k =>
        (k as { image_url?: string }).image_url || k.metric?.source_url).slice(0, 3)
      withShot.forEach((k, j) => {
        const kid = `macro-${i}-item-${j}`
        nodes.push({
          // 반 칸(1.5)에 두면 x 범위가 조사 열과 139px 겹친다. 같은 열에 두고 아래로 쌓는다.
          id: kid, kind: 'research', column: 1, row: dosRow + 1 + i * 10 + j + 1,
          title: k.name,
          body: [[metricText(k.metric), GRADE_LABEL[k.grade] ?? k.grade].filter(Boolean).join(' · '),
            k.silhouette_spec].filter(Boolean),
          imageUrl: shotUrl((k as { image_url?: string }).image_url ?? '', k.metric?.source_url),
          tone: 'muted',
        })
        edges.push({ from: id, to: kid, label: 'evidence', dashed: true })
      })
    })
  }

  // ── 3 신호 ──────────────────────────────────────────────────────
  const signalIds = new Set(st.signals.map(s => s.signal_id))
  st.signals.forEach((s, i) => {
    nodes.push({
      id: `sg-${s.signal_id}`, kind: 'signal', column: 2, row: i,
      title: s.label,
      body: [
        `${s.axis} · seen ${s.observed_count}x · ${s.direction === 'rising' ? 'rising' : s.direction === 'stable' ? 'holding' : 'fading'}`,
        // 파트 · 미드솔/아웃솔 신호는 이름으로 드러난다
        ...(s.part && s.part !== 'other' ? [`part: ${s.part.replace(/_/g, ' ')}`] : []),
        // 소셜에서 왔으면 어느 플랫폼에서, 무엇과 함께, 왜 · 사실 기반 조사의 세 질문
        ...(s.social_platforms?.length ? [`seen on ${s.social_platforms.slice(0, 3).join(', ')}`] : []),
        ...(s.mentioned_with?.length ? [`mentioned with ${s.mentioned_with.slice(0, 3).join(', ')}`] : []),
        ...(s.purchase_drivers?.length ? [`why it sells: ${s.purchase_drivers.slice(0, 2).join('; ')}`] : []),
        // 출처의 질 · 개수가 아니라 등급이 confidence 를 정했다는 것을 카드가 보여 준다
        ...(s.source_tiers?.length
          ? [`sources: ${(['T1', 'T2', 'T3', 'T4'] as const).map(tier => {
              const n = s.source_tiers!.filter(x => x === tier).length
              return n ? `${tier}×${n}` : ''
            }).filter(Boolean).join(' ')} → ${s.confidence}`]
          : []),
        s.sales_proxy_score != null ? `proxy ${s.sales_proxy_score} (${s.proxy_confidence})`
          : s.page_ref ? `source ${s.page_ref}` : `${s.sources.length} sources`,
      ],
      tone: s.confidence === 'low' ? 'muted' : 'neutral',
    })
    // 신호의 출처 노드 연결 · 프록시가 붙은 신호는 프록시 노드에서 온다
    const src = p.mode === 'trend'
      ? 'r-trend'
      : p.mode === 'series' ? (researchIds.includes('r-trend') ? 'r-trend' : 'r-dna')
      : 'r-pdf'
    edges.push({ from: src, to: `sg-${s.signal_id}`, dashed: s.confidence === 'low' })
  })

  // ── 4 디렉션 ────────────────────────────────────────────────────
  st.directions.forEach((d, i) => {
    nodes.push({
      id: `dir-${d.id}`, kind: 'direction', column: 3, row: i,
      title: d.title, body: [d.summary], tone: 'accent',
    })
    // 이 Run에 실제로 있는 신호만 잇는다. 저작 모델이 없는 신호 id를 부르면
    // 선이 허공에서 시작해, 화면에는 출발지 없는 화살표가 남는다.
    d.signal_ids.filter(sid => signalIds.has(sid)).forEach(sid => edges.push({ from: `sg-${sid}`, to: `dir-${d.id}` }))
  })
  // 시리즈 불변 요소는 디렉션 전 단계에서 스펙을 직접 잠근다
  if (p.mode === 'series' && st.seriesDna) {
    st.directions.forEach(d => edges.push({ from: 'r-dna', to: `dir-${d.id}`, label: 'DNA lock', dashed: true }))
  }

  // ── 5 디자인 ────────────────────────────────────────────────────
  const alive = st.designs.filter(d => !d.rejected)
  const rejected = st.designs.filter(d => d.rejected)
  const deck = buildLocalPitch(st)
  const pitchOf = (id: string) => deck.designPitches.find(x => x.design_id === id)

  // ── 5 스케치 레인 · 외형이 잡히는 흑백 단계. 색이 들어간 디자인과 명확히 갈라 보인다.
  // 기준 측면 스케치 + 아웃솔(바닥면) 도면. 옛 저장본의 sketch_var(흑백 어퍼 변형)도 그대로 읽는다.
  let skRow = 0
  const SKETCH_VIEWS = ['sketch', 'sketch_outsole', 'sketch_var']
  alive.forEach(d => {
    const sketches = d.images.filter(im => SKETCH_VIEWS.includes(im.view))
    sketches.forEach((im, k) => {
      const id = `sk-${d.spec.design_id}-${k}`
      const isBase = im.view === 'sketch'
      const isOutsole = im.view === 'sketch_outsole'
      // 왜 이 스케치가 나왔는지는 스케치 옆에 있어야 한다. 디자인 칸이 아니라 여기다.
      const pit = pitchOf(d.spec.design_id)
      const why = isBase
        ? [
            d.spec.comboLabel ? `Reads the research as: ${d.spec.comboLabel}` : '',
            ...(pit?.why ?? []).slice(0, 2),
            d.rationale?.narrative?.[0] ?? '',
          ].filter(Boolean)
        : isOutsole
          ? [im.whyUsed ?? 'Bottom view of the same form: lugs, flex grooves and compound split.', 'The midsole and outsole are designed, not inherited — this sheet is their drawing.']
          : ['Same silhouette and outsole as the base form. Only the upper is read differently.']
      nodes.push({
        id, kind: 'design', column: 4, row: skRow++,
        title: `${d.spec.design_id} · ${isBase ? 'Base form' : isOutsole ? 'Outsole sheet' : `Ink variation ${k}`}`,
        body: why,
        imageUrl: im.url,
        prompts: im.promptUsed ? [`Sketch prompt: ${im.promptUsed.slice(0, 180)}${im.promptUsed.length > 180 ? '…' : ''}`] : undefined,
        tone: 'muted',
      })
      const dir = st.directions.find(x => d.rationale.driving_signals.some(ds => x.signal_ids.includes(ds.signal_id)))
      if (isBase && dir) edges.push({ from: `dir-${dir.id}`, to: id, label: 'form' })
      if (!isBase) edges.push({ from: `sk-${d.spec.design_id}-0`, to: id, label: isOutsole ? 'same form, from below' : 'ink variation', dashed: true })
      // 렌더가 없으면 "coloured"라고 쓸 수 없다. 색이 안 들어갔으니까. 아웃솔 도면은 디자인으로 이어지지 않는다 — 참조다.
      const rendered = d.images.some(x => !SKETCH_VIEWS.includes(x.view))
      if (!isOutsole) edges.push({ from: id, to: d.spec.design_id, label: isBase ? (rendered ? 'coloured' : 'spec only') : undefined, dashed: isBase && !rendered })
    })
  })

  alive.forEach((d, i) => {
    // 디자인 칸에는 렌더만 온다. 예전에는 렌더가 없으면 ?? d.images[0]로 스케치가 실려
    // "색이 들어가는 칸"에 흑백 선화가 걸리고, 스케치 칸의 같은 그림과 화살표로 이어져
    // 스케치에서 스케치로 가는 것처럼 보였다. 없으면 없다고 두는 편이 정직하다.
    const hero = d.images.find(im => !['sketch', 'sketch_var'].includes(im.view))
    const pit = pitchOf(d.spec.design_id)
    if (pit) {
      // 카드 옆에 "어떤 근거에서 이 스케치가 나왔고, 어떤 프롬프트가 디자인으로 만들었는지"를 붙인다.
      // 발표할 때 카드만 보고도 계보가 말이 되게 하는 자리다.
      const heroWhy = d.images.find(im => im.whyUsed && im.view !== 'sketch' && im.view !== 'sketch_var')?.whyUsed
      const basePrompt = d.images.find(im => im.origin === 'generated' && im.view !== 'sketch')?.promptUsed
      const variantPrompt = d.images.find(im => im.view === 'design')?.promptUsed
      const cut = (s?: string) => s ? (s.length > 150 ? s.slice(0, 150) + '…' : s) : null
      // 조사가 실제로 정한 값과, 이 유형이 안 받은 값. 카드가 비어 보이던 자리를 이게 채운다.
      const setBy = (d.spec.hintApplied ?? [])
        .filter(k => k in d.spec.fields)
        .map(k => `${k.replace(/_/g, ' ')} ${d.spec.fields[k]}`)
      const refused = (d.spec.hintBlocked ?? []).slice(0, 2)
        .map(b => `${b.field.replace(/_/g, ' ')} ${b.wanted}, held at ${b.got}`)
      const capPct = Math.round((d.cost.cap_ratio - 1) * 100)
      nodes.push({
        id: `pitch-${d.spec.design_id}`, kind: 'selection', column: 5.5, row: i,
        // 스케치가 왜 나왔는지는 스케치 레인이 말한다. 여기는 그 스케치를 어떻게 디자인으로 옮겼는가다.
        title: 'From sketch to design: what was asked, and why',
        body: [
          d.spec.comboLabel
            ? `This design was asked to lead with one idea: ${d.spec.comboLabel.replace(/^Only /, '')}. That is why the prompt below names it first.`
            : 'The prompt below carries the spec straight from the sketch.',
          // 소재·색 조합의 '왜' · PT 에서 제일 먼저 나오는 질문이라 제일 앞줄에 둔다
          ...(heroWhy ? [heroWhy] : []),
          ...(setBy.length ? [`The research fixed ${setBy.length} value${setBy.length > 1 ? 's' : ''} in that prompt: ${setBy.join(', ')}.`] : []),
          ...(refused.length ? [`It also asked for ${refused.join(' and ')}. A ${TYPE_LABEL[d.spec.itemType] ?? d.spec.itemType} cannot take that, so it is absent from the prompt.`] : []),
          `Tooling: ${d.cost.tooling.mold_count_required === 0 ? 'no new moulds' : `${d.cost.tooling.mold_count_required} new moulds`}. Cost sits ${capPct === 0 ? 'level with' : capPct > 0 ? `${capPct}% over` : `${Math.abs(capPct)}% under`} the cap.`,
          ...(d.mdReview ? [`MD: ${d.mdReview.verdict === 'buy' ? 'would buy' : d.mdReview.verdict === 'buy_if_fixed' ? 'would buy if fixed' : 'passes'} — ${d.mdReview.why}`] : []),
          ...(d.mdReview?.concern ? [`MD concern: ${d.mdReview.concern}`] : []),
          ...(d.mdReview?.fix ? [`MD would need: ${d.mdReview.fix}`] : []),
        ],
        prompts: [
          cut(basePrompt) ? `Sketch to design: ${cut(basePrompt)}` : null,
          cut(variantPrompt) ? `Second design from the same sketch: ${cut(variantPrompt)}` : null,
        ].filter((x): x is string => !!x),
        tone: 'muted',
        isPitch: true,
      })
      edges.push({ from: d.spec.design_id, to: `pitch-${d.spec.design_id}`, label: 'reasoning', dashed: true })
    }
    nodes.push({
      id: d.spec.design_id, kind: 'design', column: 5, row: i,
      title: `${d.spec.design_id} · ${TIER_LABEL[d.spec.tier]}`,
      body: [
        ...d.metrics.map(m => `${m.label} ${m.value}`),
        // 렌더가 없으면 그 사실을 카드가 말한다. 스케치를 대신 걸어 두지 않는다.
        ...(hero ? [] : ['Not rendered in this run: the image cap was reached before this one. The spec and reasoning below still hold.']),
        // 게놈 없이 나온 안은 조합 폴백이다. 저작자가 다르면 카드도 그렇게 말해야 한다.
        ...(d.spec.genome ? [] : ['Spec built from signal combinations, not authored as a concept.']),
        // 게이트를 못 넘고도 채택된 안은 어디가 겹치는지 말한다.
        ...(d.spec.genome?.gate_overlap?.length
          ? [`Shares ${d.spec.genome.gate_overlap.join(', ')} with an earlier design — kept for its concept, not its silhouette.`]
          : []),
      ],
      design: d, imageUrl: hero?.url,
    })
    // 어떤 신호에서 나왔는지 · 가중치가 곧 선 굵기.
    // 스펙을 실제로 정한 신호만 선을 긋는다. 예전 분석은 그 연결이 없어 가중치를 안 믿는다.
    const traced = d.spec.hintApplied !== undefined
    d.rationale.driving_signals
      .filter(ds => (!traced || ds.weight > 0) && (signalIds.has(ds.signal_id) || st.directions.some(x => x.signal_ids.includes(ds.signal_id))))
      .forEach(ds => {
      const dir = st.directions.find(x => x.signal_ids.includes(ds.signal_id))
      edges.push({
        from: dir ? `dir-${dir.id}` : `sg-${ds.signal_id}`,
        to: d.spec.design_id,
        label: traced ? `${Math.round(ds.weight * 100)}% of the spec` : `${Math.round(ds.weight * 100)}%`,
        weight: ds.weight,
      })
    })
  })
  if (rejected.length) {
    nodes.push({
      id: 'rejected', kind: 'design', column: 5, row: alive.length,
      title: `${rejected.length} rejected on rules`,
      body: rejected.slice(0, 4).map(d =>
        `${d.spec.design_id} · ${d.ruleResults.filter(r => r.severity === 'fail').map(r => r.rule).join(', ')}`),
      tone: 'muted',
    })
  }

  // ── 6 선정 ──────────────────────────────────────────────────────
  const top = st.designs.filter(d => d.isTop)
  if (top.length) {
    nodes.push({
      id: 'top', kind: 'selection', column: 6, row: 0,
      title: `Top ${top.length}`,
      body: [
        ...top.map(d => `${d.spec.design_id} · ${TIER_LABEL[d.spec.tier]} · distance ${d.topDistance ?? 'n/a'}`),
        // MD 가 이 구성을 매장에 깔았을 때 · 예전에는 계산만 하고 어디에도 안 실렸다
        ...(st.mdFloorNote ? [`On the floor: ${st.mdFloorNote}`] : ['At least one per tier, with a distance threshold so they do not converge']),
      ],
      tone: 'accent',
    })
    top.forEach(d => edges.push({ from: d.spec.design_id, to: 'top', label: 'selected' }))

    // 캠페인 컷은 디자인 다음 단계다. 착용컷과 연출컷을 한 열에 나란히 올린다.
    let campaignRow = 0
    let showroomRow = 0
    top.forEach((d) => {
      const worn = d.images.filter(im => im.view === 'wear')
      const concepts = d.images.filter(im => im.view === 'concept')
      // 사진이 주인공이다 · 설명은 사진이 말하지 못하는 것만 한 줄
      const frames = [
        ...worn.map(im => ({ im, label: 'Worn', note: 'Simulated wear' })),
        ...concepts.map(im => ({ im, label: im.conceptLabel ?? 'Concept', note: im.persona ?? '' })),
      ]
      if (d.model) {
        const id = `model-${d.spec.design_id}`
        nodes.push({
          id, kind: 'selection', column: 9, row: showroomRow++,
          title: `${d.spec.design_id} · 3D`,
          body: ['Drag to turn'],
          modelUrl: d.model.url,
          imageUrl: (d.images.find(i => i.view === 'lateral' && !i.colorway) ?? d.images[0])?.url,
        })
        edges.push({ from: 'top', to: id, label: '3D' })
      }
      frames.forEach((fr, k) => {
        const id = `shot-${d.spec.design_id}-${k}`
        nodes.push({
          id, kind: 'selection', column: 8, row: campaignRow++,
          title: `${d.spec.design_id} · ${fr.label}`,
          body: fr.note ? [fr.note] : [],
          imageUrl: fr.im.url,
        })
        edges.push({ from: 'top', to: id, label: k === 0 ? 'campaign' : undefined })
      })
    })
  }
  // ── 8 컨셉 · 한 스케치 위의 다른 디자인들 (형태 고정, 소재·컬러·창의도만 다름) ─────
  //
  // 이 레인이 곧 '베리에이션'이다. 6번 칸의 히어로가 첫 컨셉(commercial_safe)이고, 여기 오는 것이
  // 두 번째부터다. 예전에는 렌더 뒤에 스타일 슬라이더로 편집한 컷이 여기 걸렸는데, 그 편집은
  // 조사·게놈·브랜드를 보지 않아 카드가 '왜'를 말할 수 없었다. 이제 컨셉마다 why 와 angle 이 있다.
  // 옛 저장본의 view:'variation' 컷도 같은 자리에 그대로 읽는다.
  let conRow = 0
  st.designs.filter(d => !d.rejected).forEach(d => {
    const concepts = d.images.filter(im => (im.view === 'design' && im.concept) || im.view === 'variation')
    concepts.forEach((im, k) => {
      const id = `var-${d.spec.design_id}-${k}`
      const isConcept = !!im.concept
      // 옛 슬라이더 컷은 무엇을 밀었는지만 남아 있다 · 있는 그대로 보여 준다
      const sl = im.sliders
        ? Object.entries(im.sliders).filter(([, v]) => Math.abs(v) > 0.2)
            .map(([key, v]) => `${key.split('_').slice(1).join(' ')} ${v > 0 ? '+' : ''}${v.toFixed(2)}`)
        : []
      nodes.push({
        id, kind: 'design', column: 7, row: conRow++,
        title: isConcept
          ? `${d.spec.design_id} · ${im.concept!.name}`
          : `${d.spec.design_id} · ${(im.variantAxis ?? 'Variation').split(' · ')[0]}`,
        body: isConcept
          ? [
              `Concept ${im.concept!.index + 1} · ${im.concept!.angle.replace(/_/g, ' ')}`,
              im.whyUsed ?? '',
              'Same sketch as the hero. Only material, colour and finish moved.',
            ].filter(Boolean)
          : [
              im.variantAxis?.split(' · ')[1] ?? 'One axis changed',
              sl.length ? `Sliders: ${sl.join(', ')}` : '',
              'Structure and palette held; only this axis moved.',
            ].filter(Boolean),
        imageUrl: im.url,
        prompts: im.promptUsed ? [`Concept prompt: ${im.promptUsed.slice(0, 200)}${im.promptUsed.length > 200 ? '…' : ''}`] : undefined,
      })
      edges.push({ from: d.spec.design_id, to: id, label: isConcept ? im.concept!.angle.replace(/_/g, ' ') : (im.variantAxis ?? 'variation').split(' · ')[0] })
    })
  })

  const approved = st.designs.filter(d => d.verdict === 'approve')
  const rejectedByUser = st.designs.filter(d => d.verdict === 'reject')
  if (approved.length || rejectedByUser.length) {
    const tagCount: Record<string, number> = {}
    rejectedByUser.forEach(d => d.verdictTags?.forEach(t => { tagCount[t] = (tagCount[t] ?? 0) + 1 }))
    nodes.push({
      id: 'verdict', kind: 'selection', column: 6, row: 1,
      title: 'Review calls',
      body: [
        `${approved.length} approved · ${rejectedByUser.length} rejected`,
        ...(Object.keys(tagCount).length ? [`Reasons: ${Object.entries(tagCount).map(([k, v]) => `${k} ${v}`).join(', ')}`] : []),
        'Calls and reasons feed the reference bank for the next run',
      ],
    })
    approved.forEach(d => edges.push({ from: d.spec.design_id, to: 'verdict', label: 'approved' }))
    rejectedByUser.forEach(d => edges.push({ from: d.spec.design_id, to: 'verdict', label: 'rejected', dashed: true }))
  }

  nodes.push({
    id: 'appendix', kind: 'appendix', column: 6, row: 2,
    title: 'Appendix · assumptions and limits',
    body: [
      'Costs are rough. The band, the assumptions and what is excluded sit on each card.',
      'Worn shots are simulated. The real fit may differ.',
      'Competitor references were read for attributes only and never fed into generation.',
      'Generated elements may not be copyrightable depending on jurisdiction.',
    ],
    tone: 'muted',
  })

  return { columns, nodes, edges }
}
