interface CacheRecord<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;
}

export class TtlSwrCache {
  private store = new Map<string, CacheRecord<unknown>>();

  get<T>(key: string): { value: T; isStale: boolean } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now <= entry.expiresAt) {
      return { value: entry.value as T, isStale: false };
    }
    if (now <= entry.staleUntil) {
      return { value: entry.value as T, isStale: true };
    }

    this.store.delete(key);
    return null;
  }

  set<T>(key: string, value: T, ttlSeconds: number, swrSeconds = 300): void {
    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlSeconds * 1000,
      staleUntil: now + (ttlSeconds + swrSeconds) * 1000,
    });
  }

  size(): number {
    return this.store.size;
  }
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export class IpRateLimiter {
  private buckets = new Map<string, RateBucket>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 60, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  allow(ip: string): { allowed: boolean; remaining: number; resetInSec: number } {
    const now = Date.now();
    const existing = this.buckets.get(ip);

    if (!existing || now > existing.resetAt) {
      this.buckets.set(ip, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetInSec: Math.ceil(this.windowMs / 1000),
      };
    }

    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetInSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - existing.count),
      resetInSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
}
