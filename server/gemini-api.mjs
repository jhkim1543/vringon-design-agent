// ── Gemini 이미지 생성 · GEMINI_API_KEY가 있을 때만 활성화된다 ────────
// 화면에는 회사명을 노출하지 않는다. "빠른 모델"의 백엔드로만 쓰인다.
const BASE = 'https://generativelanguage.googleapis.com/v1beta'

// 이미지 생성이 가능한 모델을 순서대로 시도한다.
// 계정마다 열려 있는 모델이 달라, 첫 성공을 채택하고 기억한다.
// 실측(2026-08): 2.5-flash 6초 · 3.1-flash 10초 · 3-pro 16초.
// "빠른 모델" 용도이므로 빠른 순으로 시도한다.
const CANDIDATES = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
]
let resolved = null

async function callModel(apiKey, model, parts) {
  const r = await fetch(`${BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  })
  if (!r.ok) {
    const err = new Error(`Gemini ${model} ${r.status}: ${(await r.text()).slice(0, 200)}`)
    err.status = r.status
    throw err
  }
  const j = await r.json()
  const p = j.candidates?.[0]?.content?.parts ?? []
  const img = p.find(x => x.inlineData?.data)
  if (!img) throw new Error('Gemini 응답에 이미지 없음')
  return Buffer.from(img.inlineData.data, 'base64')
}

async function withFallback(apiKey, parts) {
  const order = resolved ? [resolved, ...CANDIDATES.filter(m => m !== resolved)] : CANDIDATES
  let last
  for (const m of order) {
    try {
      const buf = await callModel(apiKey, m, parts)
      resolved = m
      return { buf, model: m }
    } catch (e) {
      last = e
      // 404/403은 그 모델이 안 열린 것이므로 다음 후보로 넘어간다
      if (e.status && e.status !== 404 && e.status !== 403) throw e
    }
  }
  throw last ?? new Error('Gemini 사용 가능한 이미지 모델 없음')
}

export async function geminiGenerate(apiKey, { prompt }) {
  return withFallback(apiKey, [{ text: prompt }])
}

export async function geminiEdit(apiKey, { prompt, baseImage }) {
  return withFallback(apiKey, [
    { inlineData: { mimeType: 'image/png', data: baseImage.toString('base64') } },
    { text: prompt },
  ])
}

/** 어떤 이미지 모델이 열려 있는지 진단 */
export async function geminiProbe(apiKey) {
  const tried = []
  for (const m of CANDIDATES) {
    try {
      await callModel(apiKey, m, [{ text: 'a plain grey square' }])
      resolved = m
      return { available: true, model: m, tried }
    } catch (e) {
      tried.push({ model: m, error: String(e.message).slice(0, 120) })
    }
  }
  return { available: false, tried }
}
