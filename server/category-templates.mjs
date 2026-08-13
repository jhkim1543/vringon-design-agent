// ── 카테고리 조사 템플릿 · 계열마다 봐야 할 것이 다르다 ────────────────
//
// 지시서 v2 §S1 "카테고리 조사 템플릿". 이전에는 품목명과 라인 프로필 주입까지만
// 품목을 반영했고, 조사 렌즈·리테일 대상·도시에 세그먼트는 전 카테고리 공통이었다.
// 힐을 조사하면서 스택·드롭을 묻고, 러닝화를 조사하면서 피치·토박스를 묻는 식의
// 낭비와 공백이 여기서 갈린다.
//
// familyId는 클라이언트 TAXONOMY의 그룹 id와 같다: sneaker/dress/heel/flat/boot/sandal.

/** 계열별 추가 조사 렌즈 · 공통 렌즈(OBJECTIVE_LENS) 위에 얹힌다 */
export const FAMILY_LENS = {
  sneaker: [
    '미드솔 스택 높이·드롭·로커 각도가 어느 밴드로 움직이는가',
    '폼(EVA·수퍼크리티컬·PEBA)과 플레이트(카본·나일론) 채택이 어느 가격대까지 내려왔는가',
    '아웃솔 러그·세그먼트 패턴과 접지 컴파운드가 어떻게 변하는가',
  ],
  dress: [
    '라스트 토 셰이프(아몬드·스퀘어·라운드)와 토 볼륨이 어느 쪽으로 움직이는가',
    '공법(굿이어·블레이크·시멘티드) 비중과 웰트 노출 스타일이 어떻게 변하는가',
    '가죽 등급·마감(풀그레인·스웨이드·페이턴트)과 스티치 디테일의 방향',
  ],
  heel: [
    '힐 높이 밴드와 피치가 어디로 움직이는가 (킥튼·미드·하이)',
    '힐 형상(블록·스틸레토·플레어·조형힐)과 토박스 여유의 조합',
    '착화 안정 장치(플랫폼 전족부·쿠션 인솔·스트랩)가 어느 가격대에서 표준이 되는가',
  ],
  flat: [
    '토박스 폭과 발볼 여유가 어느 쪽으로 움직이는가',
    '아웃솔 유연성·굽힘 홈과 쿠션 풋베드 채택',
    '슬링백·메리제인 등 고정 방식 변형의 확산',
  ],
  boot: [
    '샤프트 높이·개구부 구조(지퍼·고어·레이스)의 방향',
    '방수·보온(멤브레인·셰어링)과 아웃솔 러그의 조합',
    '웰트 구조와 스톰 웰트 노출이 어느 티어까지 확산되는가',
  ],
  sandal: [
    '풋베드 소재(코르크·EVA·가죽)와 조형이 어떻게 변하는가',
    '스트랩 구조(개수·고정 방식·조절)와 하드웨어',
    '스포츠 샌들과 드레스 샌들 사이 하이브리드의 확산',
  ],
}

/** 계열별 리테일 펄스 대상 지면 · 러닝화를 백화점 구두 층에서 찾으면 안 나온다 */
export const FAMILY_RETAIL = {
  sneaker: '국내: 무신사 랭킹, 카카오스타일, ABC마트·슈마커 베스트 / 해외: JD Sports, Foot Locker, END., SNS(Sneakersnstuff), StockX 인기 차트',
  dress: '국내: 롯데백화점몰·SSG 신세계백화점·더현대닷컴 남성/여성 구두 층 / 해외: MR PORTER, Harrods, Selfridges 포멀 슈즈',
  heel: '국내: 롯데백화점몰·SSG·더현대닷컴 여성 슈즈 층, W컨셉 / 해외: NET-A-PORTER, Harrods, Selfridges 힐 카테고리',
  flat: '국내: 롯데백화점몰·SSG·W컨셉 플랫·로퍼 / 해외: NET-A-PORTER, MyTheresa 플랫',
  boot: '국내: 백화점몰 부츠 + 아웃도어 편집(오케이몰 등) / 해외: MR PORTER·END. 부츠, REI·Backcountry(아웃도어 계열일 때)',
  sandal: '국내: 무신사·백화점몰 샌들 시즌 기획전 / 해외: SSENSE·NET-A-PORTER 샌들, Birkenstock·Teva 공식몰 베스트',
}

/** 계열별 도시에 키아이템 세그먼트 · 펌프스에 kids를 강제하면 지어내게 된다 */
export const FAMILY_SEGMENTS = {
  sneaker: ['women', 'men', 'kids'],
  dress: ['women', 'men'],
  heel: ['women'],
  flat: ['women'],
  boot: ['women', 'men'],
  sandal: ['women', 'men', 'kids'],
}

/** 계열별 아톰 커버리지 필수 축 · 이 축들이 비면 조사를 더 돈다 (v2 S2) */
export const FAMILY_REQUIRED_AXES = {
  sneaker: ['bottom_unit', 'upper_material', 'silhouette', 'closure'],
  dress: ['construction', 'last_toe', 'leather_finish', 'silhouette'],
  heel: ['heel_geometry', 'last_toe', 'fit_stability', 'silhouette'],
  flat: ['toe_volume', 'sole_flex', 'closure', 'silhouette'],
  boot: ['shaft', 'construction', 'weather', 'silhouette'],
  sandal: ['footbed', 'strap_topology', 'silhouette'],
}

/** 품목별 추가 렌즈 · 계열 렌즈로는 갈리지 않는 것만 둔다.
 *
 *  계열 렌즈까지만 있던 시절에는 러닝화·트레일화·템포 레이서·코트화가 전부 같은 세 질문을
 *  받았다 — 스택/드롭, 폼/플레이트, 러그. 트레일화에 "어느 가격대까지 카본이 내려왔나"를
 *  묻는 것은 낭비고, 그러는 동안 아웃솔 컴파운드와 락플레이트는 아무도 안 물었다.
 *  사용자가 위저드에서 고른 것은 계열이 아니라 품목이다. 그 선택이 조사에 닿아야 한다. */
export const TYPE_LENS = {
  running: [
    '데일리 트레이너 밴드에서 스택·드롭이 어디로 수렴하는가 (일상 주행 기준, 레이싱 제외)',
    '수퍼크리티컬 폼이 논-플레이트 데일리 모델에 어디까지 내려왔는가',
    '내구 아웃솔 커버리지와 노출 미드솔 비중의 균형',
  ],
  max_cushion: [
    '스택 상한과 규정·안정성 논쟁이 형태에 어떻게 반영되는가 (광폭 베이스·사이드월)',
    '높은 스택에서 흔들림을 잡는 장치 (지오메트리·프레임·가이드레일)',
    '무게 페널티를 어디서 상쇄하는가',
  ],
  tempo_racer: [
    '플레이트 형상·강성과 폼 조합이 레이스와 템포 사이에서 어떻게 갈리는가',
    '어퍼 경량화 (모노메시·최소 보강)가 어디까지 가는가',
    '규정 스택 상한 안에서의 지오메트리 경쟁',
  ],
  trail: [
    '러그 깊이·간격·배치와 진흙/암반 노선별 분화',
    '아웃솔 고무 컴파운드와 젖은 바위 접지 (전용 컴파운드 채택 여부)',
    '락플레이트·토캡·거싯 텅 등 보호 장치와 무게의 절충',
  ],
  court_sneaker: [
    '코트 헤리티지 요소(폭싱 테이프·퍼포레이션·힐탭)가 어떻게 재해석되는가',
    '컵솔 대 발크라이즈 비중과 사이드월 높이',
    '어퍼 가죽 등급·패널 분할의 변화',
  ],
  lifestyle_runner: [
    '아카이브 러너 실루엣 중 무엇이 다시 올라오는가 (연대·모델 계열)',
    '기능 요소가 장식으로 옮겨 가는 방식 (더미 플레이트·가짜 통기구 등)',
    '소재 믹스(스웨이드·메시·리플렉티브) 조합의 방향',
  ],
  chunky_sneaker: [
    '볼륨을 어디서 만드는가 (미드솔 매스·레이어 분할·토 스프링)',
    '레이어 개수와 색 분할이 덩어리감에 미치는 영향',
    '무게·착화 편의와 볼륨의 절충',
  ],
  hiking: [
    '방수 멤브레인 채택과 통기의 절충이 어느 밴드에서 갈리는가',
    '샤프트 높이·발목 지지와 경량 하이킹의 경계',
    '러그 패턴과 미드솔 강성(섕크·락플레이트)의 조합',
  ],
}

export const typeLens = (itemType) => TYPE_LENS[itemType] ?? []
export const familyLens = (familyId) => FAMILY_LENS[familyId] ?? []
export const familyRetail = (familyId) => FAMILY_RETAIL[familyId] ?? FAMILY_RETAIL.dress
export const familySegments = (familyId) => FAMILY_SEGMENTS[familyId] ?? ['women', 'men']

// 품목 → 계열 · 클라이언트 TAXONOMY 그룹과 동일해야 한다
const TYPE_FAMILY = {
  running: 'sneaker', max_cushion: 'sneaker', tempo_racer: 'sneaker', trail: 'sneaker',
  court_sneaker: 'sneaker', lifestyle_runner: 'sneaker', chunky_sneaker: 'sneaker',
  loafer: 'dress', horsebit_loafer: 'dress', chunky_loafer: 'dress',
  derby: 'dress', oxford: 'dress', monk: 'dress',
  pump: 'heel', slingback: 'heel', mary_jane: 'heel', mule: 'heel',
  ballet_flat: 'flat', driving: 'flat', espadrille: 'flat',
  ankle_boot: 'boot', chelsea: 'boot', combat: 'boot', long_boot: 'boot', hiking: 'boot',
  strap_sandal: 'sandal', slide: 'sandal', sport_sandal: 'sandal', gladiator: 'sandal',
}
export const familyOf = (itemType) => TYPE_FAMILY[itemType] ?? 'dress'
