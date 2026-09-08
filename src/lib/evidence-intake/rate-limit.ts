// B2 — a minimal fixed-window rate limiter for the public intake. In-memory and
// per-instance: it throttles abuse of a single link on one server, and is NOT a
// distributed guarantee (a hosted deployment behind several instances should back
// this with a shared store). Kept deliberately small and dependency-free.
export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Record an attempt for `key`; returns false when the window's limit is spent. */
  take(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }
}

// Shared limiter for the intake route: 10 uploads per token per 10 minutes.
export const intakeRateLimiter = new FixedWindowRateLimiter(10, 10 * 60 * 1000);
