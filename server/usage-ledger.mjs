// ── 사용량 장부 · 실제로 쓴 토큰과 장수를 한 줄씩 남긴다 ───────────────
//
// 왜 있는가: 비용 분석을 하다 보니 추론 토큰이 어디에도 기록돼 있지 않았다. 응답에는
// usage 가 매번 실려 오는데 세 곳(design·research·upload)이 전부 그걸 버리고 텍스트만
// 꺼냈다. 그래서 조사·저작 비용은 공개 단가로 짐작한 ±40% 짜리 숫자였다.
//
// 이 장부는 그 짐작을 실측으로 바꾼다. 원칙 셋:
//   ① 응답의 usage 를 그대로 적는다. 가공하지 않는다.
//   ② 캐시 적중은 0 으로 적는다 — 과금이 없었으니 비용도 0 이다. 대신 cached:true 를 남겨
//      "이 Run 이 캐시 덕에 얼마를 아꼈나"를 나중에 셀 수 있게 한다.
//   ③ 응답 형태를 건드리지 않는다. 호출부는 record() 한 줄만 더 부르고, 하던 대로 반환한다.
//      장부 기록이 실패해도 파이프라인은 멈추지 않는다.
//
// 파일: .cache/usage/YYYY-MM-DD.jsonl · 한 줄이 한 호출이다.
// 요약: node tools/usage-report.mjs
import { appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

let ROOT = process.cwd()
export function setLedgerRoot(root) { ROOT = root }
const dir = () => join(ROOT, '.cache', 'usage')

/** 지금 이 서버가 처리 중인 Run 의 이름표. 러너·앱이 헤더로 넘기면 줄마다 붙는다.
 *  없으면 'unlabelled' — 그래도 적는다. 이름표가 없다고 돈이 안 나간 것은 아니다. */
let currentRun = 'unlabelled'
export function setCurrentRun(id) { currentRun = String(id || 'unlabelled').slice(0, 80) }

/**
 * 한 호출을 적는다.
 *  kind      'inference' | 'image' | 'model3d'
 *  name      어느 기능인가 · design/genome, research/trend, image/generate, ...
 *  model     실제로 쓴 모델 이름 (공급사명은 넣지 않는다 — 모델 id 만)
 *  usage     추론이면 응답의 usage 객체 그대로 · 이미지·3D 면 { units: 1 }
 *  cached    캐시 적중이면 true (그러면 usage 는 0 이어야 한다)
 *  meta      effort, engine, searches 같은 부가 정보
 */
export function record({ kind, name, model, usage, cached = false, meta = {} }) {
  try {
    mkdirSync(dir(), { recursive: true })
    const day = new Date().toISOString().slice(0, 10)
    const line = {
      t: new Date().toISOString(),
      run: currentRun,
      kind, name, model: String(model ?? ''),
      cached: !!cached,
      // 추론: input/output/reasoning 토큰과 캐시된 입력 토큰. 이미지·3D: units.
      in: usage?.input_tokens ?? 0,
      out: usage?.output_tokens ?? 0,
      reasoning: usage?.output_tokens_details?.reasoning_tokens ?? 0,
      cachedIn: usage?.input_tokens_details?.cached_tokens ?? 0,
      units: usage?.units ?? 0,
      ...meta,
    }
    appendFileSync(join(dir(), `${day}.jsonl`), JSON.stringify(line) + '\n')
  } catch (e) {
    // 장부가 파이프라인을 멈춰선 안 된다. 다만 조용히도 넘어가지 않는다.
    console.warn('[usage] 기록 실패:', String(e?.message ?? e).slice(0, 80))
  }
}

/** 응답 usage 에서 web_search 호출 수를 센다. Responses API 는 output 배열에
 *  web_search_call 항목으로 남긴다. 검색은 건당 과금이라 따로 세야 한다. */
export function countSearches(responseJson) {
  return (responseJson?.output ?? []).filter(o => o.type === 'web_search_call').length
}
