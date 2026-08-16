// ── 예시 Run · 처음 열어도 결과가 어떻게 나오는지 볼 수 있게 심어 둔다 ──
// 실제로 파이프라인을 돌려 만든 결과를 JSON으로 떠서 넣는다. API 호출은 하지 않는다.
import type { RunState } from './types'
import { deleteRun, listRuns, saveRun } from './store'

// 지금 파이프라인이 실제로 돌려 만든 결과만 둔다. 옛 판은 지금 하는 말과 다른 말을 한다.
// 앞의 둘이 러닝화다. 트렌드 판은 최종본 파이프라인(시장 설정·출처 등급·파트별 게놈·
// 아웃솔 시트·스케치당 컨셉 베리에이션·비전 수리·최종 게이트)으로 돌렸고,
// 시리즈 판은 그 트렌드 판이 만든 디자인을 아카이브로 올려 DNA 승인 게이트까지 태운 결과다.
// 두 모드가 같은 품목을 다르게 다루는 것을 나란히 보라고 앞에 뒀다.
// 첼시는 이전 판, 시리즈(AJ1)는 조던 1 아카이브 12장, 무드보드는 MICAM FW25 프레스킷 14쪽을 실제로 읽은 결과다.
const SAMPLE_IDS = ['sample_trend_running', 'sample_series_running', 'sample_trend_chelsea', 'sample_series_aj1', 'sample_moodboard_micam']

export async function ensureSampleRuns() {
  // 이미 있으면 건너뛰던 시절에는, 샘플을 새로 뜨면 옛 방문자에게 영영 닿지 않았다.
  // 옛 샘플이 참조하던 이미지는 정리되면서 사라지고 카드가 빈 채로 남는다.
  // 그래서 저장된 시각을 대조해, 파일이 새 것이면 덮어쓴다.
  const stored = new Map(listRuns().map(r => [r.id, r]))

  // 목록에서 빠진 예시는 이 브라우저에서도 치운다. 안 그러면 옛 방문자에게만 옛 샘플이 남는다.
  // 사용자가 직접 돌린 Run은 sample 표시가 없으니 건드리지 않는다.
  for (const [id, rec] of stored) {
    if ((rec.state as RunState).sample && !SAMPLE_IDS.includes(id)) {
      deleteRun(id)
      try { localStorage.removeItem(`vringon.board.${id}`) } catch { /* 스토리지가 막혀 있으면 넘어간다 */ }
    }
  }
  for (const id of SAMPLE_IDS) {
    try {
      const mod = await import(`../samples/${id}.json`)
      // 배포 경로가 하위 폴더면(예: GitHub Pages) 절대경로 /samples/ 가 어긋난다.
      // 저장된 JSON은 그대로 두고, 읽어들일 때만 base를 붙인다.
      const base = import.meta.env.BASE_URL || '/'
      const raw = JSON.stringify(mod.default ?? mod).replaceAll('"/samples/', `"${base}samples/`)
      const st = JSON.parse(raw) as RunState
      st.sample = true
      const have = stored.get(id)
      // 같은 판이면 그대로 둔다. 사용자가 즐겨찾기를 달았을 수 있다.
      if (have && (have.state as RunState).savedAtISO === st.savedAtISO) continue
      saveRun({
        id,
        savedAt: Date.parse(st.savedAtISO ?? '') || Date.now(),
        favorite: have?.favorite ?? false,
        title: st.sampleTitle ?? 'Sample run',
        thumb: firstThumb(st),
        state: st,
      })
    } catch {
      // 샘플 파일이 없으면 조용히 넘어간다. 없어도 앱은 동작해야 한다.
    }
  }
}

function firstThumb(st: RunState): string | undefined {
  for (const d of st.designs) {
    // 선 그림은 목록 썸네일로 쓰지 않는다. sketch·sketch_var 에 더해 아웃솔 시트
    // (sketch_outsole)도 걸러야 한다 — 안 그러면 카드가 트레드 도면으로 뜬다.
    const im = d.images.find(i => !i.view.startsWith('sketch')) ?? d.images[0]
    if (im) return im.url
  }
  return undefined
}
