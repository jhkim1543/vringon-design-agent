// ── 예시 Run · 처음 열어도 결과가 어떻게 나오는지 볼 수 있게 심어 둔다 ──
// 실제로 파이프라인을 돌려 만든 결과를 JSON으로 떠서 넣는다. API 호출은 하지 않는다.
import type { RunState } from './types'
import { deleteRun, listRuns, saveRun } from './store'

// 지금 파이프라인이 실제로 돌려 만든 결과만 둔다. 옛 판은 지금 하는 말과 다른 말을 한다.
// 시리즈는 조던 1 아카이브 12장을, 무드보드는 MICAM FW25 프레스킷 14쪽을 실제로 읽은 결과다.
const SAMPLE_IDS = ['sample_series_aj1', 'sample_moodboard_micam']

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
    const im = d.images.find(i => i.view !== 'sketch' && i.view !== 'sketch_var') ?? d.images[0]
    if (im) return im.url
  }
  return undefined
}
