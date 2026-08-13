// ── 단독 서버 · 화면과 API 를 한 도메인에서 같이 내보낸다 ─────────────
//
// 지금까지 API 는 Vite dev 서버 미들웨어로만 붙어 있었다. 그래서 배포본(GitHub Pages)에는
// 부를 API 가 없었고, 열면 "분석은 로컬 서버가 있어야 합니다" 가 떴다.
//
// 이 파일이 그 줄을 없앤다. 빌드된 화면(dist/)과 /api 를 같은 프로세스가 내보내므로
// CORS 도, VITE_API_BASE 도 필요 없다. 도메인 하나만 붙이면 실제 서비스처럼 돈다.
//
//   npm run build            → dist/
//   node server/standalone.mjs
//
// 키는 예전과 똑같이 이 프로세스에만 있다. 브라우저 번들에는 안 들어간다.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApi } from './openai-api.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const DIST = process.env.STATIC_DIR || join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 8080)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.map': 'application/json; charset=utf-8',
}

function sendFile(res, file) {
  const ext = extname(file).toLowerCase()
  res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream')
  // 해시가 박힌 자산은 영원히 캐시해도 되지만 index.html 은 절대 안 된다 —
  // 배포해도 옛 화면이 계속 뜬다.
  res.setHeader('Cache-Control', /\.[a-f0-9]{8,}\./.test(file)
    ? 'public, max-age=31536000, immutable'
    : 'no-cache')
  createReadStream(file).pipe(res)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res).catch(err => {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: String(err?.message ?? err) }))
    })
    return
  }

  if (!existsSync(DIST)) {
    res.statusCode = 500
    res.end('build the frontend first: npm run build')
    return
  }

  // '..' 로 dist 밖을 읽는 것을 막는다.
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  const file = join(DIST, rel)
  if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) return sendFile(res, file)

  // 나머지는 전부 SPA 진입점으로. 새로고침해도 404 가 안 뜬다.
  const index = join(DIST, 'index.html')
  if (existsSync(index)) return sendFile(res, index)
  res.statusCode = 404
  res.end('not found')
})

// 이미지 한 장이 2분 넘게 걸린다. 기본 타임아웃(2분)이면 렌더가 매번 끊긴다.
server.requestTimeout = 0
server.headersTimeout = 65_000
server.keepAliveTimeout = 620_000
server.timeout = 0

server.listen(PORT, () => {
  console.log(`vringon design agent · http://localhost:${PORT}`)
  console.log(`  static: ${DIST}`)
})
