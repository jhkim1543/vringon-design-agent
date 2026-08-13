// ── 시장 레지스트리 · 어디를 조사하는가 ────────────────────────────────
//
// 조사 언어(researchLang)와 시장은 다른 축이다. 언어는 "결과를 무슨 말로 쓰는가",
// 시장은 "누구네 매대를 보는가"다. 지금까지 후자가 없어서, 어떤 Run 이든
// 무신사·ABC마트를 보고 한국어로 검색하고 한국 정가를 물었다.
//
// 지역을 넣는 값어치가 실제로 어디에 있는지는 분명히 해 둔다:
//   ● 확실히 달라지는 것 — 검색어(한국어 vs 현지어), 리테일 지면, 가격 기준, 검색 지역
//   ○ 별로 안 달라지는 것 — 트렌드 신호의 '속성' 자체. 토 셰이프·스택·폼은
//     전 세계 같은 브랜드들이 정하기 때문에 시장을 바꿔도 대체로 같은 속성이 나온다.
//     달라지는 것은 그 속성의 '순위와 도달 시점'이지 목록이 아니다.
// 그래서 이 파일은 리테일·경쟁사 조사를 실제로 바꾸는 데 집중하고, 트렌드 쪽에는
// 시장을 '관점'으로만 넘긴다. 안 달라지는 것을 달라지는 척하지 않는다.

/** 홈 마켓으로 고를 수 있는 시장. 로스터는 손으로 유지해야 하므로 적게 둔다. */
export const MARKETS = {
  KR: {
    id: 'KR', label: '한국',
    searchLang: '한국어',
    currency: 'KRW',
    // web_search 의 user_location · 프롬프트 문구가 아니라 검색 자체를 움직인다
    location: { country: 'KR', city: 'Seoul', region: 'Seoul' },
    acceptLanguage: 'ko-KR,ko;q=0.9,en;q=0.8',
    // 한국어 별칭을 써야 검색이 걸리는 시장. 다른 시장에서는 오히려 방해가 된다.
    useKoreanAliases: true,
    priceNote: '한국 정가(원)',
  },
  US: {
    id: 'US', label: '미국',
    searchLang: '영어',
    currency: 'USD',
    location: { country: 'US', city: 'New York', region: 'New York' },
    acceptLanguage: 'en-US,en;q=0.9',
    useKoreanAliases: false,
    priceNote: 'US list price (USD)',
  },
  JP: {
    id: 'JP', label: '일본',
    searchLang: '일본어',
    currency: 'JPY',
    location: { country: 'JP', city: 'Tokyo', region: 'Tokyo' },
    acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.8',
    useKoreanAliases: false,
    priceNote: '日本の定価(円)',
  },
}

/** 참조 시장으로만 고를 수 있다. 홈 마켓이 될 수 없는 이유는 단순하다 —
 *  글로벌 정가라는 것은 존재하지 않는다. 어느 나라 매대에서 얼마인지가 없으면
 *  가격 밴드도 경쟁군도 정의되지 않는다. */
export const GLOBAL = {
  id: 'GLOBAL', label: '글로벌',
  searchLang: '영어',
  currency: null,
  location: null,
  acceptLanguage: 'en-US,en;q=0.9',
  useKoreanAliases: false,
  priceNote: null,
}

export const marketOf = (id) => MARKETS[String(id ?? '').toUpperCase()] ?? (String(id).toUpperCase() === 'GLOBAL' ? GLOBAL : MARKETS.KR)

/** 계열 × 시장별 리테일 지면.
 *  예전에는 계열마다 '국내: … / 해외: …' 문자열 하나였다. 국내/해외가 필드가 아니라
 *  문장 부호였기 때문에, 미국 시장을 보겠다고 해도 무신사가 따라왔다. */
export const MARKET_RETAIL = {
  KR: {
    sneaker: '무신사 랭킹, 카카오스타일, ABC마트·슈마커 베스트, 29CM',
    dress: '롯데백화점몰, SSG 신세계백화점, 더현대닷컴 남성/여성 구두',
    heel: '롯데백화점몰, SSG, 더현대닷컴 여성 슈즈, W컨셉',
    flat: '롯데백화점몰, SSG, W컨셉 플랫·로퍼',
    boot: '백화점몰 부츠 카테고리, 오케이몰',
    sandal: '무신사·백화점몰 샌들 시즌 기획전',
  },
  US: {
    sneaker: 'Foot Locker, JD Sports US, Running Warehouse, Fleet Feet, Dick\'s Sporting Goods 베스트셀러',
    dress: 'Nordstrom, MR PORTER, Todd Snyder, Brooks Brothers 드레스 슈즈',
    heel: 'Nordstrom, Saks Fifth Avenue, NET-A-PORTER US 힐 카테고리',
    flat: 'Nordstrom, Anthropologie, NET-A-PORTER US 플랫',
    boot: 'Nordstrom, REI, Backcountry, Huckberry 부츠',
    sandal: 'Nordstrom, Zappos, REI 샌들',
  },
  JP: {
    sneaker: 'ABC-MART, atmos, 스텝스포츠(ステップスポーツ), ZOZOTOWN 스니커 랭킹',
    dress: '이세탄 신주쿠 남성관, 미츠코시, 三陽山長·리갈 공식몰',
    heel: '이세탄·한큐 여성 슈즈, ZOZOTOWN 힐 랭킹',
    flat: 'ZOZOTOWN 플랫·발레, 이세탄 여성 슈즈',
    boot: 'ZOZOTOWN 부츠 랭킹, 이세탄·한큐 부츠',
    sandal: 'ZOZOTOWN 샌들 랭킹, ABC-MART 샌들',
  },
  GLOBAL: {
    sneaker: 'END., Sneakersnstuff, StockX 인기 차트, JD Sports',
    dress: 'MR PORTER, Harrods, Selfridges 포멀 슈즈',
    heel: 'NET-A-PORTER, Harrods, Selfridges 힐',
    flat: 'NET-A-PORTER, MyTheresa 플랫',
    boot: 'MR PORTER, END., Selfridges 부츠',
    sandal: 'SSENSE, NET-A-PORTER 샌들',
  },
}

/** 이 시장에서 이 계열을 볼 지면. 없으면 그 시장의 dress 로스터로 떨어진다. */
export function retailFor(marketId, familyId) {
  const m = MARKET_RETAIL[String(marketId ?? 'KR').toUpperCase()] ?? MARKET_RETAIL.KR
  return m[familyId] ?? m.dress
}

/** 홈 + 참조 시장을 프롬프트에 실을 수 있는 모양으로 정리한다.
 *  참조 시장은 홈과 겹치면 버린다. 같은 곳을 두 번 보라고 할 이유가 없다. */
export function resolveMarkets({ home, reference = [] } = {}) {
  const h = marketOf(home)
  const refIds = [...new Set(reference.map(r => String(r ?? '').toUpperCase()))]
    .filter(id => id && id !== h.id)
    .slice(0, 2)
  return { home: h, reference: refIds.map(marketOf), refIds }
}

/** 검색을 어느 말로 할지. 예전에는 세 프롬프트에 '한국어로 검색하라'가 그대로 박혀 있었다. */
export function searchClause({ home, reference = [] }, langName) {
  const bits = [`${home.searchLang}로 검색하세요 — ${home.label} 시장이 조사 대상입니다.`]
  if (reference.length) {
    bits.push(`참조 시장(${reference.map(r => r.label).join(', ')})은 ${[...new Set(reference.map(r => r.searchLang))].join('·')}로 따로 확인하고, 홈 시장과 무엇이 다른지에만 쓰세요.`)
  }
  bits.push(`출력하는 모든 문자열은 ${langName}로 씁니다. 검색 언어와 출력 언어는 별개입니다.`)
  return bits.join(' ')
}

/** 지면 지시문. 참조 시장이 있으면 홈을 먼저, 참조를 뒤에 둔다. */
export function retailClause({ home, reference = [] }, familyId) {
  const rows = [`${home.label}(홈): ${retailFor(home.id, familyId)}`]
  for (const r of reference) rows.push(`${r.label}(참조): ${retailFor(r.id, familyId)}`)
  return rows.join('\n')
}

/** 출처 수 지시문. '국내 2곳 + 해외 1곳'은 글로벌을 고르면 문장 자체가 성립하지 않았다. */
export function sourceQuota({ home, reference = [] }) {
  return reference.length
    ? `${home.label} 지면에서 2곳 이상, 참조 시장에서 1곳 이상 확인하세요.`
    : `${home.label} 지면에서 3곳 이상 확인하세요.`
}

/** web_search 에 넘길 위치. 프롬프트 문구가 아니라 검색 자체를 움직이는 유일한 손잡이다. */
export function userLocation(home) {
  if (!home?.location) return null
  return { type: 'approximate', ...home.location }
}
