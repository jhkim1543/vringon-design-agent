// ── 시리즈 아카이브용 실제 제품 사진을 모은다 ────────────────────────
//
// 시리즈 모드는 "이미 있는 라인"의 사진을 읽어 반복되는 요소를 뽑는다. 그 입력은 진짜
// 제품 사진이어야 의미가 있다. 여기서는 공개된 제품 소개 페이지의 대표 이미지(og:image)를
// 앱이 이미 쓰는 경로(fetchShotImage / shotFromPage)로 가져온다 — 경쟁사 조사가 제품
// 사진을 집을 때와 같은 방식이다.
//
// 받은 사진은 업로드 캐시(.cache/uploads)에만 들어간다. 굳힌 샘플에는 파일명과 크기만
// 남고 사진 자체는 배포물에 실리지 않는다 (옛 AJ1 샘플에서 확인). 즉 분석 입력으로만 쓰인다.
//
//   node tools/fetch-archive.mjs <URL> [URL ...]
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchShotImage, shotFromPage } from '../server/openai-api.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, '.cache', 'archive-in')
const API = process.env.API_BASE || 'http://localhost:8080'
// 업로드가 받는 형식만 모은다. avif 는 서버가 거절하는데, 그건 옳다 —
// 분석에 쓰는 비전 모델도 avif 를 못 읽으므로 넣어 봐야 뒤에서 깨진다.
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

const urls = process.argv.slice(2)
if (!urls.length) { console.error('URL 을 하나 이상 주세요'); process.exit(1) }
mkdirSync(OUT, { recursive: true })

const got = []
for (const [i, page] of urls.entries()) {
  const label = `${i + 1}/${urls.length}`
  try {
    const direct = await shotFromPage(page)
    if (!direct) { console.log(`${label} 대표 이미지 없음 · ${page.slice(0, 60)}`); continue }
    const img = await fetchShotImage(direct, page)
    if (!img) { console.log(`${label} 내려받기 실패 · ${page.slice(0, 60)}`); continue }
    const ext = EXT[img.type]
    if (!ext) { console.log(`${label} 건너뜀 · ${img.type} 은 업로드가 받지 않는다 · ${page.slice(0, 45)}`); continue }
    const name = `archive-${String(i + 1).padStart(2, '0')}.${ext}`
    writeFileSync(join(OUT, name), img.buf)
    got.push({ name, type: img.type, bytes: img.buf.length, page })
    console.log(`${label} ${name} · ${(img.buf.length / 1000).toFixed(0)}KB · ${img.type}`)
  } catch (e) {
    console.log(`${label} 오류 ${String(e.message).slice(0, 70)} · ${page.slice(0, 50)}`)
  }
}

if (!got.length) { console.error('\n한 장도 못 받았습니다'); process.exit(1) }

// 업로드 · 서버 본문 상한을 넘기지 않게 나눠 보낸다
const { readFileSync } = await import('node:fs')
const uploaded = []
for (let i = 0; i < got.length; i += 4) {
  const chunk = got.slice(i, i + 4).map(g => ({
    name: g.name, type: g.type,
    dataBase64: readFileSync(join(OUT, g.name)).toString('base64'),
  }))
  const r = await fetch(`${API}/api/upload`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: chunk }), signal: AbortSignal.timeout(120_000),
  })
  const j = await r.json()
  if (j.error) { console.error('업로드 실패:', j.error); process.exit(1) }
  uploaded.push(...j.files)
}

const manifest = join(ROOT, '.cache', 'archive-uploads.json')
writeFileSync(manifest, JSON.stringify(uploaded, null, 1))
console.log(`\n${uploaded.length}장 업로드 · 목록 → ${manifest}`)
for (const u of uploaded) console.log(`  ${u.id}  ${u.name}  ${(u.bytes / 1000).toFixed(0)}KB`)
