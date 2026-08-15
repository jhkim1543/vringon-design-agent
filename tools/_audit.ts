// 샘플 3종을 실제 보드 모델로 만들어 이상을 전수 점검한다.
import { readFileSync } from 'node:fs'
import { buildBoardModel } from '../src/core/boardModel'
import type { RunState } from '../src/core/types'

const files = ['sample_trend_running', 'sample_trend_chelsea', 'sample_series_aj1', 'sample_moodboard_micam']
for (const f of files) {
  const st = JSON.parse(readFileSync(`src/samples/${f}.json`, 'utf8')) as RunState
  const m = buildBoardModel(st)
  const issues: string[] = []

  // ① 디자인 칸이 스케치 이미지를 쓰고 있는가
  const sketchHashes = new Set(st.designs.flatMap(d => d.images.filter(i => ['sketch','sketch_var'].includes(i.view)).map(i => i.hash)))
  for (const n of m.nodes.filter(n => n.kind === 'design' && n.column === 5 && n.imageUrl)) {
    const hit = [...sketchHashes].some(h => n.imageUrl!.includes(h))
    if (hit) issues.push(`디자인 칸이 스케치 이미지 사용: ${n.id}`)
  }
  // ② 렌더 없는 디자인
  for (const d of st.designs.filter(d => !d.rejected)) {
    const renders = d.images.filter(i => !['sketch','sketch_var'].includes(i.view))
    if (!renders.length) issues.push(`렌더 0장: ${d.spec.design_id}`)
  }
  // ③ 스케치 없는 디자인 (계보 끊김)
  for (const d of st.designs.filter(d => !d.rejected)) {
    const sk = d.images.filter(i => ['sketch','sketch_var'].includes(i.view))
    const renders = d.images.filter(i => !['sketch','sketch_var'].includes(i.view))
    if (!sk.length && renders.length) issues.push(`스케치 없이 렌더만: ${d.spec.design_id} (계보 끊김)`)
  }
  // ④ 끊긴 엣지
  const ids = new Set(m.nodes.map(n => n.id))
  for (const e of m.edges) {
    if (!ids.has(e.from)) issues.push(`엣지 출발지 없음: ${e.from} → ${e.to}`)
    if (!ids.has(e.to)) issues.push(`엣지 도착지 없음: ${e.from} → ${e.to}`)
  }
  // ⑤ 이미지 없는 카드
  const noImg = m.nodes.filter(n => n.kind === 'design' && !n.imageUrl && !n.design).length
  if (noImg) issues.push(`이미지 없는 디자인 카드 ${noImg}건`)
  // ⑥ 게놈 없는 디자인이 살아남았나 (폴백 경로)
  const noGen = st.designs.filter(d => !d.rejected && !d.spec.genome).length
  if (noGen) issues.push(`게놈 없이 살아남은 디자인 ${noGen}건 (폴백 경로)`)
  // ⑦ QA 없는 디자인 (검증 미실행)
  const noQa = st.designs.filter(d => !d.rejected && d.images.some(i => !['sketch','sketch_var'].includes(i.view)) && !(d.qa||[]).length).length
  if (noQa) issues.push(`렌더는 있는데 검증 기록 없음 ${noQa}건`)

  console.log(`══ ${f} · 노드 ${m.nodes.length} / 엣지 ${m.edges.length}`)
  if (!issues.length) console.log('   이상 없음')
  else issues.forEach(x => console.log('   ✗', x))
}
