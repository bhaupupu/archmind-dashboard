import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let warned = false;

/**
 * Builds a per-key sliding-window limiter backed by Upstash Redis. Returns null
 * (limiting disabled) only when the Upstash env vars are absent — and warns loudly
 * exactly once so a misconfigured deployment shows up in logs instead of silently
 * running with no rate limiting at all.
 */
export function makeRateLimiter(requests: number, window: `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (!warned) {
      console.warn(
        '[atlas] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting is DISABLED on all routes. ' +
        'Set them before public deployment to prevent abuse/cost blowups.'
      );
      warned = true;
    }
    return null;
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requests, window),
  });
}

export async function checkRateLimit(limiter: Ratelimit | null, key: string): Promise<{ ok: true } | { ok: false }> {
  if (!limiter) return { ok: true };
  try {
    const { success } = await limiter.limit(key);
    return success ? { ok: true } : { ok: false };
  } catch (err) {
    // Fail open: a Redis outage must not turn every guarded route into a 500.
    // Losing rate limiting during the outage is the lesser failure mode.
    console.error('[atlas] rate-limit check failed (Redis unreachable?) — failing open', err);
    return { ok: true };
  }
}
