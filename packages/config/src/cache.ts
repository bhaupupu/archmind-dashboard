/**
 * Simple in-memory cache simulating a distributed Redis cache.
 * In a real production environment, this module wraps `ioredis`.
 */
const store = new Map<string, { value: any; expiresAt: number }>();

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return null;
    }
    return entry.value as T;
  },

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  async del(key: string): Promise<void> {
    store.delete(key);
  },

  /** Clear all keys (useful for testing) */
  async flushAll(): Promise<void> {
    store.clear();
  }
};
