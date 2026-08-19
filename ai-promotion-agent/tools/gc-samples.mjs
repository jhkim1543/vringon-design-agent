// ── 샘플이 참조하지 않는 파일을 지운다 ────────────────────────────────
//
// public/samples 는 굳힌 Run 의 이미지·GLB 가 쌓이는 곳이다. 샘플을 새로 뜨면 옛 파일은
// 아무도 안 보는 채로 남는다. 실제로 273MB 까지 불었고 그 대부분이 이미 사라진 Run 의
// 잔해였다 — GLB 한 개가 12~15MB 라 몇 개만 남아도 배포가 무거워진다.
//
// 참조는 src/samples/*.json 이 정본이다. 거기서 "/samples/<파일>" 을 전부 긁어 모아
// 그 목록에 없는 파일을 지운다. 샘플 JSON 을 먼저 최종본으로 만들어 두고 돌릴 것.
//
//   node tools/gc-samples.mjs --check   확인만 (아무것도 안 지운다)
//   node tools/gc-samples.mjs           실제로 지운다
import { readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SAMPLES = join(ROOT, 'src', 'samples')
const PUBLIC = join(ROOT, 'public', 'samples')
const checkOnly = process.argv.includes('--check')

// 참조 수집 · JSON 을 문자열로 훑는다. 어느 필드에 있든 "/samples/x.png" 형태면 잡힌다.
const referenced = new Set()
const sampleFiles = readdirSync(SAMPLES).filter(f => f.endsWith('.json') && f !== 'raw.json')
for (const f of sampleFiles) {
  const text = readFileSync(join(SAMPLES, f), 'utf8')
  for (const m of text.matchAll(/\/samples\/([A-Za-z0-9._-]+)/g)) referenced.add(m[1])
}

const onDisk = readdirSync(PUBLIC)
const orphan = onDisk.filter(f => !referenced.has(f))
const mb = (list) => (list.reduce((a, f) => a + statSync(join(PUBLIC, f)).size, 0) / 1e6).toFixed(1)

console.log(`샘플 ${sampleFiles.length}개가 참조하는 파일 ${referenced.size}개`)
console.log(`디스크에 ${onDisk.length}개 · ${mb(onDisk)}MB`)
console.log(`참조 없음 ${orphan.length}개 · ${mb(orphan)}MB`)

// 참조는 있는데 파일이 없는 경우 · 이쪽이 더 위험하다 (화면에 빈 칸이 된다)
const missing = [...referenced].filter(f => !onDisk.includes(f))
if (missing.length) {
  console.log(`\n!! 참조하는데 파일이 없음 ${missing.length}개 — 화면에서 빈 칸이 된다:`)
  for (const f of missing.slice(0, 10)) console.log(`   ${f}`)
}

if (!orphan.length) { console.log('\n지울 것 없음'); process.exit(missing.length ? 1 : 0) }
if (checkOnly) { console.log('\n[검사만] 지우지 않았다'); process.exit(0) }

let freed = 0
for (const f of orphan) { freed += statSync(join(PUBLIC, f)).size; unlinkSync(join(PUBLIC, f)) }
console.log(`\n${orphan.length}개 삭제 · ${(freed / 1e6).toFixed(1)}MB 확보`)
console.log(`남은 파일 ${readdirSync(PUBLIC).length}개 · ${mb(readdirSync(PUBLIC))}MB`)
process.exit(missing.length ? 1 : 0)
