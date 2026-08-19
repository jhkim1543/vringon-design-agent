// ── 설정이 결과를 실제로 바꾸는가 · 값싸게 확인한다 ────────────────────
//
// 전체 Run 을 두 번 돌리면 몇 시간에 이미지값까지 든다. 확인하려는 것은 두 가지뿐이다:
//   ① 브랜드를 바꾸면 설계 영토가 달라지는가
//   ② MD 페르소나를 바꾸면 고르는 안이 달라지는가
// 둘 다 이미지 없이 텍스트 호출로만 확인된다.
//
//   node tools/settings-probe.mjs          (서버가 5188 또는 8080 에 떠 있어야 한다)
const BASE = process.env.PROBE_BASE || 'http://localhost:8080'

const post = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(600_000),
  })
  const j = await r.json()
  if (j.error) throw new Error(j.error)
  return j
}

// 같은 신호를 준다. 달라지는 것은 브랜드뿐이어야 한다.
const SIGNALS = [
  { signal_id: 'sg_1', label: '수퍼크리티컬 폼의 데일리 트레이너 확산', axis: 'midsole', attribute: 'foam_grade', observed_count: 6, confidence: 'high', co_occurring: ['supercritical EVA', '38-42mm stack', 'moderate rocker'] },
  { signal_id: 'sg_2', label: '광폭 베이스와 사이드월 안정 구조', axis: 'bottom', attribute: 'base_width', observed_count: 5, confidence: 'high', co_occurring: ['wide base', 'raised sidewall', 'flared heel'] },
  { signal_id: 'sg_3', label: '모노메시 어퍼의 패널 축소', axis: 'upper', attribute: 'panel_count', observed_count: 4, confidence: 'medium', co_occurring: ['mono mesh', '3-4 panels', 'welded overlay'] },
  { signal_id: 'sg_4', label: '내구 아웃솔 커버리지 축소와 노출 미드솔', axis: 'outsole', attribute: 'coverage', observed_count: 3, confidence: 'medium', co_occurring: ['partial rubber', 'exposed foam', 'weight saving'] },
  { signal_id: 'sg_5', label: '리플렉티브 디테일의 상시화', axis: 'detail', attribute: 'reflective', observed_count: 3, confidence: 'low', co_occurring: ['reflective heel', 'night visibility'] },
]

const BRAND_A = `브랜드: 정밀 퍼포먼스 러닝
브랜드 선언: 기록을 위해 만든다. 장식은 무게다.
유지할 시그니처: 노출 미드솔 사이드월, 최소 패널 어퍼
금지: 과장된 청키 실루엣, 장식용 하드웨어
선호 소재: 엔지니어드 메시, 수퍼크리티컬 폼
톤: 절제된, 기능적, 날카로운
팔레트 성격: 무광 블랙, 코발트, 실버`

const BRAND_B = `브랜드: 도시 산책 레저
브랜드 선언: 하루 종일 편한 신발. 뛰지 않아도 된다.
유지할 시그니처: 두툼한 쿠션 스택, 스웨이드 오버레이
금지: 레이싱 플레이트, 노출된 기능 부자재
선호 소재: 스웨이드, 코듀라, 리사이클 니트
톤: 부드러운, 편안한, 복고적
팔레트 성격: 오트밀, 세이지, 테라코타`

const MD_A = {
  role: '러닝 전문점 바이어 9년차', channel: '러닝 전문 편집숍 · 러닝 크루 커뮤니티',
  customer: '주 3회 이상 달리는 30-40대, 대회 참가 경험 있음',
  kpis: ['정상판매율 70%', '리오더율 30%'], priceBandKrw: '17만~26만원',
  riskAppetite: 'conservative',
  pastMisses: ['작년 광폭 플랫폼 모델이 러너들에게 무겁다고 반품됐다'],
  dealBreakers: ['300g 초과', '접지력 불명확한 아웃솔'],
  competingOnFloor: ['경쟁사 데일리 트레이너 2종', '자사 전작'],
}
const MD_B = {
  role: '백화점 스포츠 캐주얼 바이어 6년차', channel: '백화점 스포츠 편집 매장',
  customer: '운동은 가끔, 스타일로 신는 20-30대',
  kpis: ['객단가 상승', '시즌 소진 10주'], priceBandKrw: '19만~34만원',
  riskAppetite: 'aggressive',
  pastMisses: ['수수한 디자인이 매대에서 안 집혔다'],
  dealBreakers: ['매대에서 눈에 안 띄는 실루엣'],
  competingOnFloor: ['해외 라이프스타일 러너', '패션 브랜드 협업 스니커'],
}

const DESIGNS = [
  { design_id: 'SH-A', tier: 'Core', combo: '경량 모노메시 데일리', spec: 'heel height mm 34, midsole foam supercritical EVA, plate none, panel count 4, upper material engineered mesh, closure lace, weight target g 262', cap: '4%', moulds: 0, rules: '' },
  { design_id: 'SH-B', tier: 'Push', combo: '광폭 베이스 안정 트레이너', spec: 'heel height mm 42, midsole foam supercritical EVA, plate nylon, panel count 6, upper material engineered mesh, closure lace, weight target g 298', cap: '21%', moulds: 0, rules: '' },
  { design_id: 'SH-C', tier: 'Signature', combo: '조형 스택 라이프스타일 러너', spec: 'heel height mm 48, midsole foam PU, plate none, panel count 9, upper material suede, closure lace, weight target g 372', cap: '46%', moulds: 8, rules: 'cost_cap warn' },
]

const axes = t => `${t.name} | 밀 신호 ${(t.use_signal_ids ?? []).join(',')} | 버릴 신호 ${(t.drop_signal_ids ?? []).join(',')}`

const run = async () => {
  console.log('① 브랜드가 설계 영토를 바꾸는가\n')
  const [a, b] = await Promise.all([
    post('/api/design/territories', { signals: SIGNALS, itemTypeEn: 'running shoe', itemType: 'running', brandSummary: BRAND_A, langName: 'Korean' }),
    post('/api/design/territories', { signals: SIGNALS, itemTypeEn: 'running shoe', itemType: 'running', brandSummary: BRAND_B, langName: 'Korean' }),
  ])
  const ta = (a.territories ?? []).map(axes)
  const tb = (b.territories ?? []).map(axes)
  console.log('  브랜드 A (정밀 퍼포먼스):'); ta.forEach(x => console.log('   ·', x))
  console.log('  브랜드 B (도시 레저):'); tb.forEach(x => console.log('   ·', x))
  const same = ta.filter(x => tb.includes(x)).length
  console.log(`\n  → 같은 영토 ${same} / ${Math.max(ta.length, tb.length)} · ${same === 0 ? '완전히 갈림 (정상)' : '겹침 있음 — 확인 필요'}`)
  console.log(`  → 캐시: A ${a.cached ? '재사용' : '새로'} · B ${b.cached ? '재사용' : '새로'}\n`)

  console.log('② MD 페르소나가 선택을 바꾸는가\n')
  const [ma, mb] = await Promise.all([
    post('/api/analyze/md-review', { persona: MD_A, brand: '테스트 브랜드', langName: 'Korean', designs: DESIGNS }),
    post('/api/analyze/md-review', { persona: MD_B, brand: '테스트 브랜드', langName: 'Korean', designs: DESIGNS }),
  ])
  const show = (m, who) => {
    console.log(`  ${who}`)
    for (const r of m.reviews ?? []) console.log(`   · ${r.design_id} ${r.verdict} — ${String(r.why ?? '').slice(0, 110)}`)
    console.log(`   고른 것: ${(m.picks ?? []).map(p => `${p.design_id}(${p.role_in_range})`).join(', ') || '없음'}`)
  }
  show(ma, 'MD A · 러닝 전문점, 보수적, 300g 초과 거부')
  show(mb, 'MD B · 백화점 스포츠, 공격적, 눈에 띄어야 함')
  const pa = (ma.picks ?? []).map(p => p.design_id).join(',')
  const pb = (mb.picks ?? []).map(p => p.design_id).join(',')
  console.log(`\n  → 선택 ${pa} vs ${pb} · ${pa === pb ? '같음 — 페르소나가 안 먹었을 수 있다' : '다름 (정상)'}`)
  console.log(`  → 캐시: A ${ma.cached ? '재사용' : '새로'} · B ${mb.cached ? '재사용' : '새로'}`)
}

run().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
