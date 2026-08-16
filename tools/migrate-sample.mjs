// ── 굳은 샘플을 지금 파이프라인이 내놨을 모습으로 맞춘다 ─────────────────
//
// 왜 필요한가: 샘플 하나를 90분 돌리는 도중에 정직성 결함 두 개를 고쳤다. 돌고 있는
// 프로세스는 이미 번들된 옛 코드를 쓰므로, 그 Run 의 결과에는 결함이 그대로 굳는다.
// 조사와 이미지를 다시 사기에는 비싸고, 고친 로직은 전부 "파일 안에 이미 있는 값으로
// 다시 계산"하는 종류라 재실행 없이 같은 결과를 낼 수 있다.
//
// 여기서 하는 일은 셋 다 재계산이다. 없는 사실을 지어내지 않는다:
//   1) colorways 를 계획이 아니라 실제로 렌더된 컷에서 다시 뽑는다
//   2) 기준 렌더의 whyUsed 를 게놈에서 다시 계산한다 (컨셉 why 로 덮인 것을 되돌린다)
//   3) 기준 렌더의 컨셉 이름표는 commercial_safe 일 때만 남긴다
//
// 2번의 식은 pipeline.ts 의 baseWhy 와 한 글자도 다르지 않아야 한다. 다르면 카드가
// 프롬프트와 또 어긋난다.
//
// 사용: node tools/migrate-sample.mjs <샘플이름 ...>       (생략하면 전부)
//       node tools/migrate-sample.mjs --check <샘플이름>    (고치지 않고 보기만)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SAMPLES = join(ROOT, 'src', 'samples')

const argv = process.argv.slice(2)
const checkOnly = argv.includes('--check')
const names = argv.filter(a => a !== '--check')
const targets = names.length
  ? names
  : readdirSync(SAMPLES).filter(f => f.endsWith('.json') && f !== 'raw.json').map(f => f.replace(/\.json$/, ''))

/** pipeline.ts 의 baseWhy 와 같은 식. 바꾸려면 양쪽을 같이 바꾼다. */
function baseWhyOf(spec) {
  return spec.genome
    ? `Material as authored: ${spec.genome.spec_sheet.upper_material} — part of the "${spec.genome.hero_mutation.label}" concept${spec.genome.source_signal_ids.length ? ', grounded in the cited research signals' : ''}.`
    : 'Material from the archetype spec — no authored concept behind this one, and the card says so.'
}

for (const name of targets) {
  const file = join(SAMPLES, `${name}.json`)
  if (!existsSync(file)) { console.log(`${name}: 없음`); continue }
  const st = JSON.parse(readFileSync(file, 'utf8'))
  let cwFixed = 0, whyFixed = 0, labelDropped = 0

  for (const d of st.designs ?? []) {
    // 1) 실제로 렌더된 컬러웨이만 남긴다
    const real = (d.images ?? []).map(im => im.colorway).filter(Boolean)
    const claimed = d.colorways ?? []
    if (claimed.length !== real.length || claimed.some((c, i) => c !== real[i])) {
      if (!checkOnly) d.colorways = real
      cwFixed++
      console.log(`  ${name} ${d.spec?.design_id}: 컬러웨이 ${claimed.length}개 주장 → 실제 ${real.length}개`)
    }

    // 2)(3) 기준 렌더 · 컨셉이 덮어쓴 이유를 되돌리고 이름표를 정리한다
    for (const im of d.images ?? []) {
      if (!im.concept || im.concept.index !== 0) continue
      // 기준 렌더의 이유는 세 가지 상태로 온다.
      const want = baseWhyOf(d.spec)
      const cur = String(im.whyUsed ?? '')
      if (cur.startsWith(want)) {
        // ① 이미 계산된 근거로 시작한다 (뒤에 수리 기록이 붙었을 수 있다) · 그대로 둔다
      } else if (im.origin === 'regenerated_hq') {
        // ② 수리된 컷인데 수리 기록만 남아 소재 근거가 사라졌다.
        //    수리 기록도 참이므로 지우지 않고 근거를 앞에 되돌려 붙인다.
        if (!checkOnly) im.whyUsed = [want, cur].filter(Boolean).join(' ')
        whyFixed++
      } else {
        // ③ 컨셉의 why 가 계산된 근거를 통째로 덮어쓴 옛 판 · 근거로 되돌린다
        if (!checkOnly) im.whyUsed = want
        whyFixed++
      }
      if (im.concept.angle !== 'commercial_safe') {
        if (!checkOnly) delete im.concept
        labelDropped++
      }
    }
  }

  if (!cwFixed && !whyFixed && !labelDropped) { console.log(`${name}: 고칠 것 없음`); continue }
  if (!checkOnly) writeFileSync(file, JSON.stringify(st, null, 1))
  console.log(`${name}: ${checkOnly ? '[검사만] ' : ''}컬러웨이 ${cwFixed}건 · 기준 렌더 이유 ${whyFixed}건 · 어긋난 컨셉 이름표 ${labelDropped}건`)
}
