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

// 인용 URL 끝에 붙어 오는 추적 파라미터를 떼어 낸다.
// 검색 도구가 모든 링크에 utm_source=<공급사> 를 붙여 돌려주는데, 그게 신호·경쟁사·
// 리포트 본문에 실려 저장되고 샘플 JSON을 타고 배포 번들까지 들어간다.
// 공급사명은 UI·저장소·히스토리·바이너리 어디에도 남기지 않는다.
// 서버(research-api.mjs)에서도 저장 전에 떼지만, 이미 굳어 있는 옛 샘플과
// 그 수정 전에 시작된 Run 이 있으니 굳히는 자리에서 한 번 더 훑는다.
// utm_* 는 순수 추적용이라 떼어 내도 링크는 그대로 열린다.
function scrubTracking(v) {
  if (typeof v === 'string') {
    return v
      .replace(/\?utm_[a-z_]+=[^&\s)"'\]]*&/gi, '?')
      .replace(/[?&]utm_[a-z_]+=[^&\s)"'\]]*/gi, '')
  }
  if (Array.isArray(v)) return v.map(scrubTracking)
  if (v && typeof v === 'object') {
    const o = {}
    for (const [k, val] of Object.entries(v)) o[k] = scrubTracking(val)
    return o
  }
  return v
}

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

  // 도시에 키아이템 사진도 같은 이유로 굳혀야 한다. 정적 배포에서 /api/shot 이 없으면
  // 시즌 도시에의 실제 제품 사진이 전부 빈 칸이 된다 — 경쟁사 사진과 똑같은 구멍이었다.
  let dosFrozen = 0, dosFailed = 0
  for (const m of st.dossier?.macrotrends ?? []) {
    for (const k of m.key_items ?? []) {
      const u = k.image_url ?? ''
      if (!u || !/^https?:/.test(u)) continue
      const page = k.metric?.source_url || ''
      try {
        let got = null
        try { got = await fetchShotImage(u, page || undefined) } catch { /* 페이지 폴백 */ }
        if (!got && page) got = await fetchShotImage(await shotFromPage(page), page)
        if (!got) { dosFailed++; continue }
        const key = createHash('sha256').update(got.buf).digest('hex').slice(0, 24)
        const fname = `${key}.${EXT[got.type] ?? 'jpg'}`
        writeFileSync(join(OUT, fname), got.buf)
        k.image_url = `/samples/${fname}`
        dosFrozen++
      } catch { dosFailed++ }
    }
  }

  const before = (JSON.stringify(st).match(/utm_[a-z_]+=/gi) ?? []).length
  const clean = scrubTracking(st)
  writeFileSync(file, JSON.stringify(clean, null, 1))
  console.log(`${name}: 경쟁사 새로 굳힘 ${frozen} · 이미 로컬 ${already} · 사진 없음 ${failed} / 도시에 키아이템 굳힘 ${dosFrozen} · 실패 ${dosFailed}${before ? ` / 추적 파라미터 ${before}건 제거` : ''}`)
}
