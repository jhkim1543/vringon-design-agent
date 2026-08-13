// ── API 주소 한 곳 ──────────────────────────────────────────────────
//
// 예전에는 호출마다 '/api/...' 를 그대로 적었다. 그러면 앱이 사이트 루트에 있을 때만 맞는다.
// GitHub Pages 처럼 하위 경로(/vringon-design-agent/)에 올라가면 전부 빗나가고,
// API 를 다른 도메인에 두는 것은 아예 불가능했다. 그래서 "분석은 로컬 서버가 있어야 합니다"
// 였다 — 배포본에는 부를 수 있는 API 가 없었다.
//
// 두 가지를 다 담는다:
//   ① API 가 같은 서비스 안에 있으면 (권장) → 그냥 앱의 base 경로를 붙인다
//   ② 화면은 Pages, API 는 다른 도메인이면 → 빌드할 때 VITE_API_BASE 를 준다
//
// VITE_ 접두사는 브라우저로 나간다. 여기 들어가도 되는 것은 주소뿐이다 —
// 키는 예전과 같이 서버 프로세스에만 있고, 이 파일 근처에도 오지 않는다.

const RAW = String(import.meta.env.VITE_API_BASE ?? '').trim().replace(/\/+$/, '')

/** API 를 다른 도메인에서 부르고 있는가. 화면에 "무엇이 켜져 있는지" 적을 때 쓴다. */
export const API_IS_REMOTE = !!RAW

/** '/api/status' → 실제로 부를 주소. 경로는 항상 슬래시로 시작해서 넘긴다. */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (RAW) return RAW + p
  // BASE_URL 은 항상 슬래시로 끝난다 ('/' 또는 '/vringon-design-agent/').
  return `${import.meta.env.BASE_URL}${p.slice(1)}`
}
