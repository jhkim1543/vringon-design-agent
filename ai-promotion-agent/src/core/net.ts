// ── 일시적 실패는 다시 시도한다 ────────────────────────────────────────
//
// 왜 있는가: 146분짜리 Run 하나가 1분짜리 상류 장애로 망가졌다. 그 순간 게놈 저작 4건,
// 시즌 도시에, 트렌드 리포트, 스케치 2장이 전부 'fetch failed' 로 죽었고, 호출부는
// 한 번 실패하면 바로 폴백으로 내려갔다. 결과물은 일곱 안 중 셋만 저작된 게놈을 가졌다.
//
// 조사와 저작은 비싸고 느리다. 네트워크가 잠깐 끊긴 것과 요청이 틀린 것을 구분하지 않으면,
// 몇 초짜리 문제로 몇 시간짜리 결과가 무너진다. 그래서 일시적 실패로 보이는 것만 다시 건다.
//
// 다시 걸지 않는 것: 스키마 위반, 400, 인증 실패처럼 다시 걸어도 같은 답이 오는 것들.
// 그건 진짜 오류이므로 그대로 위로 던져 카드가 "이건 실패했다"고 말하게 둔다.

/** 다시 걸면 될 법한 실패인가. 메시지에 상태 코드가 실려 오므로 그것도 본다. */
const TRANSIENT = /fetch failed|network|socket hang up|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|aborted|timed? ?out|\b(429|500|502|503|504)\b/i

export function isTransient(e: unknown): boolean {
  return TRANSIENT.test(String((e as Error)?.message ?? e))
}

/** 지수적으로 늘려 기다린다. 상류가 몰려 있을 때 즉시 재시도하면 같이 죽는다. */
const BACKOFF_MS = [4_000, 15_000, 40_000]

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: {
    /** 총 시도 횟수 (첫 시도 포함) */
    tries?: number
    /** 재시도 직전에 부른다 · 로그로 남기라고 있는 자리다. 조용히 재시도하지 않는다. */
    onRetry?: (attempt: number, waitMs: number, message: string) => void
  },
): Promise<T> {
  const tries = Math.max(1, opts?.tries ?? 3)
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      // 마지막 시도였거나, 다시 걸어도 소용없는 실패면 그대로 던진다
      if (i === tries - 1 || !isTransient(e)) throw e
      const wait = BACKOFF_MS[i] ?? BACKOFF_MS[BACKOFF_MS.length - 1]
      opts?.onRetry?.(i + 1, wait, String((e as Error).message ?? e).slice(0, 90))
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw last
}
