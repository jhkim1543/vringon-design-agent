// ── 샘플에 남은 원격 제품 사진을 파일로 굳힌다 ─────────────────────────
// 정적 배포(Pages)에는 /api/shot 프록시가 없어서 원격 참조는 전부 깨진다.
// 사용: node tools/freeze-sample-shots.mjs [샘플이름 ...]   (생략하면 전부)
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchShotImage, shotFromPage } from '../server/openai-api.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SAMPLES = join(ROOT, 'src', 'samples')
const OUT = join(ROOT, 'public', 'samples')
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' }

const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(SAMPLES).filter(f => f.endsWith('.json') && f !== 'raw.json').map(f => f.replace(/\.json$/, ''))

mkdirSync(OUT, { recursive: true })

for (const name of names) {
  const file = join(SAMPLES, `${name}.json`)
  if (!existsSync(file)) { console.log(`${name}: 없음`); continue }
  const st = JSON.parse(readFileSync(file, 'utf8'))
  let frozen = 0, already = 0, failed = 0

  for (const c of st.competitors ?? []) {
    const urls = c.image_urls ?? []
    if (urls.length && !/^https?:/.test(urls[0])) { already++; continue }
    const page = c.product_url || ''
    let local = null
    for (const u of [...urls, ...(page ? [''] : [])]) {
      try {
        let got = null
        if (/^https?:\/\//.test(u)) {
          try { got = await fetchShotImage(u, page || undefined) } catch { /* 페이지 폴백으로 */ }
        }
        if (!got && page) got = await fetchShotImage(await shotFromPage(page), page)
        if (!got) continue
        const key = createHash('sha256').update(got.buf).digest('hex').slice(0, 24)
        const fname = `${key}.${EXT[got.type] ?? 'jpg'}`
        writeFileSync(join(OUT, fname), got.buf)
        local = `/samples/${fname}`
        break
      } catch { /* 다음 후보 */ }
    }
    c.image_urls = local ? [local] : []
    if (local) frozen++; else failed++
  }

  writeFileSync(file, JSON.stringify(st, null, 1))
  console.log(`${name}: 새로 굳힘 ${frozen} · 이미 로컬 ${already} · 사진 없음 ${failed}`)
}
