// ── Bright Data Web Unlocker · 봇 벽에 막힌 페이지의 마지막 수단 ──────
// 수집 사진의 91%는 그냥 fetch로 들어온다. 나머지는 스토어의 WAF가 403/429로 막는데
// (adidas.co.kr, kr.ecco.com, MR PORTER, REI, Selfridges) 그때만 여기로 넘긴다.
// 유료 호출이므로 순서가 중요하다: 직링크 → 페이지 og:image → 여기.
//
// 키는 .env의 BRIGHTDATA_API_KEY에만 둔다. 브라우저 번들에는 들어가지 않는다.
const API = 'https://api.brightdata.com/request'

/** 계정 상태 · zone이 없으면 요청을 보낼 수 없다 (대시보드에서 하나 만들어야 한다) */
export async function brightdataProbe(key) {
  if (!key) return { available: false, reason: 'No BRIGHTDATA_API_KEY set' }
  try {
    const [st, zones] = await Promise.all([
      fetch('https://api.brightdata.com/status', {
        headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000),
      }).then(r => r.json()).catch(() => null),
      fetch('https://api.brightdata.com/zone/get_active_zones', {
        headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000),
      }).then(r => r.json()).catch(() => []),
    ])
    const names = Array.isArray(zones) ? zones.map(z => z?.name).filter(Boolean) : []
    if (!st) return { available: false, reason: 'status call failed' }
    if (st.can_make_requests === false) {
      return {
        available: false, customer: st.customer, zones: names,
        reason: st.auth_fail_reason === 'zone_not_found'
          ? 'No zone on the account yet. Create a Web Unlocker zone in the Bright Data dashboard, then set BRIGHTDATA_ZONE.'
          : String(st.auth_fail_reason ?? 'cannot make requests'),
      }
    }
    return { available: true, customer: st.customer, zones: names }
  } catch (e) {
    return { available: false, reason: String(e.message).slice(0, 120) }
  }
}

/** zone 이름을 고른다 · 설정값이 우선, 없으면 계정의 첫 활성 zone */
let cachedZone = null
async function resolveZone(key, configured) {
  if (configured) return configured
  if (cachedZone) return cachedZone
  try {
    const r = await fetch('https://api.brightdata.com/zone/get_active_zones', {
      headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000),
    })
    const zones = await r.json()
    const name = Array.isArray(zones) ? zones.find(z => z?.name)?.name : null
    if (name) cachedZone = name
    return name
  } catch { return null }
}

// 자격 증명이 틀렸으면 남은 요청도 전부 틀린다. 한 번 확인하고 이 프로세스에서는 더 안 부른다.
// 토큰을 새로 넣으면 서버를 다시 띄우므로 이 플래그도 같이 사라진다.
let credentialsDead = false

/** 막힌 주소를 언락커로 한 번 가져온다. 실패하면 던진다 — 호출자가 조용히 포기한다. */
async function unlock(key, zone, url, wantBinary) {
  if (credentialsDead) throw new Error('brightdata credentials rejected earlier')
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ zone, url, format: 'raw' }),
    signal: AbortSignal.timeout(60_000),
  })
  if (r.status === 401 || r.status === 403) {
    credentialsDead = true
    console.warn('[shot] Bright Data rejected the token (%d). Falling back to plain fetch for the rest of this session. Put a fresh BRIGHTDATA_API_KEY in .env and restart to re-enable it.', r.status)
  }
  if (!r.ok) throw new Error(`brightdata ${r.status}: ${(await r.text()).slice(0, 160)}`)
  if (!wantBinary) return await r.text()
  const type = r.headers.get('content-type') || ''
  const buf = Buffer.from(await r.arrayBuffer())
  return { buf, type }
}

/** WAF에 막힌 상품 페이지의 HTML. 실패하면 null. */
export async function unlockPage(key, zoneName, url) {
  if (!key) return null
  const zone = await resolveZone(key, zoneName)
  if (!zone) return null
  try { return await unlock(key, zone, url, false) }
  catch { return null }
}

/** WAF에 막힌 이미지. 실패하면 null. */
export async function unlockImage(key, zoneName, url) {
  if (!key) return null
  const zone = await resolveZone(key, zoneName)
  if (!zone) return null
  try {
    const got = await unlock(key, zone, url, true)
    if (!got?.buf?.length || got.buf.length < 1200) return null
    // 언락커가 콘텐츠 타입을 안 주는 경우가 있다. 매직 넘버로 본다.
    const b = got.buf
    const type = got.type.startsWith('image/') ? got.type
      : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg'
      : b[0] === 0x89 && b[1] === 0x50 ? 'image/png'
      : b.slice(8, 12).toString() === 'WEBP' ? 'image/webp'
      : null
    return type ? { buf: b, type } : null
  } catch { return null }
}
