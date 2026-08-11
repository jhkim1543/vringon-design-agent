// ── 업로드 · 파일을 실제로 서버에 올리고, 실제로 읽힌 결과를 받는다 ────────
// 예전에는 여기가 없었다. 파일 입력이 f.name만 담고 내용은 아무도 열지 않았다.
import type { SeriesDna, UploadRef } from './types'
import type { LogoStyle } from './brand'

const MAX_FILES = 12

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result ?? '')
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    r.onerror = () => reject(new Error(`Could not read ${file.name}`))
    r.readAsDataURL(file)
  })
}

/** 파일을 서버 캐시로 올린다. 브라우저에는 손잡이(id)만 남는다.
 *  base64를 RunParams에 담으면 localStorage 용량을 바로 넘긴다. */
export async function uploadFiles(files: File[]): Promise<{ ok: UploadRef[]; failed: string[] }> {
  const ok: UploadRef[] = []
  const failed: string[] = []
  // 한 번에 다 보내면 요청 하나가 수십 MB가 된다. 한 장씩 보낸다.
  for (const f of files.slice(0, MAX_FILES)) {
    try {
      const dataBase64 = await toBase64(f)
      const r = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ name: f.name, type: f.type, dataBase64 }] }),
      })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error ?? String(r.status))
      ok.push(...(j.files as UploadRef[]))
    } catch (e) {
      failed.push(`${f.name}: ${String((e as Error).message).slice(0, 80)}`)
    }
  }
  return { ok, failed }
}

/** 서버가 읽어 낸 시리즈 DNA · 하드코딩 상수가 아니라 올린 장들에서 나온 것 */
export interface SeriesRead {
  of: number
  invariant: { element: string; label: string; observed_in: number; evidence: string }[]
  variable: { element: string; label: string; observed_in: number; evidence: string }[]
  ambiguous: { element: string; label: string; observed_in: number; evidence: string }[]
  read_note: string
  statement_check: { brand_claim: string; observed: string; agrees: boolean; note: string }
  files: { id: string; name: string }[]
  cached?: boolean
}

export interface MoodboardRead {
  doc_summary: string
  pages_read: number
  signals: {
    label: string; attribute: string; axis: string; observed_count: number
    page_ref: string; quote: string; footwear_translation: string
    confidence: 'high' | 'medium' | 'low'
  }[]
  palette: { name: string; hex: string; page_ref: string }[]
  source_bias: { perspective: string; covers: string[]; misses: string[] }
  not_found: string
  files: { id: string; name: string }[]
  cached?: boolean
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(j.error ?? `${url} ${r.status}`)
  return j as T
}

export const readSeries = (b: { uploadIds: string[]; valueStatement: string; itemTypeEn: string; langName: string }) =>
  post<SeriesRead>('/api/analyze/series', b)

export const readMoodboard = (b: { uploadIds: string[]; notes: string; itemTypeEn: string; langName: string }) =>
  post<MoodboardRead>('/api/analyze/moodboard', b)

/** 로고가 적용된 제품 사진에서 배치 규칙을 읽는다 */
export const readLogoStyle = (b: { logoId?: string; referenceIds: string[]; itemTypeEn: string; langName: string }) =>
  post<LogoStyle>('/api/analyze/logo-style', b)

/** 읽어 낸 결과를 화면이 쓰는 SeriesDna 모양으로 옮긴다.
 *  confidence는 몇 장에서 보였는지로만 정한다. 지어내지 않는다. */
export function toSeriesDna(r: SeriesRead): SeriesDna {
  const conv = (list: SeriesRead['invariant'], mustInherit: boolean) => list.map(e => ({
    element: e.element,
    label: e.label,
    observed_in: e.observed_in,
    of: r.of,
    confidence: (e.observed_in >= r.of * 0.8 ? 'high' : e.observed_in >= r.of * 0.5 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    must_inherit: mustInherit,
    note: e.evidence,
  }))
  return {
    invariant: conv(r.invariant, true),
    variable: conv(r.variable, false),
    ambiguous: conv(r.ambiguous, false),
  }
}
