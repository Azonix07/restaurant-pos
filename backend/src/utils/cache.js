/**
 * Simple in-memory cache with TTL for frequently accessed data.
 * Used for menu items, categories, and other read-heavy data.
 */
class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  /**
   * Get cached value if not expired
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Set cache entry with TTL
   * @param {string} key
   * @param {any} value
   * @param {number} ttlMs - time to live in milliseconds (default 60s)
   */
  set(key, value, ttlMs = 60000) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate a specific key or pattern
   * @param {string} pattern - exact key or prefix with '*' wildcard
   */
  invalidate(pattern) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      for (const key of this.store.keys()) {
        if (key.startsWith(prefix)) this.store.delete(key);
      }
    } else {
      this.store.delete(pattern);
    }
  }

  /** Clear entire cache */
  clear() {
    this.store.clear();
  }

  /** Get cache stats */
  stats() {
    let active = 0;
    let expired = 0;
    const now = Date.now();
    for (const entry of this.store.values()) {
      if (now > entry.expiresAt) expired++;
      else active++;
    }
    return { active, expired, total: this.store.size };
  }
}

// Singleton instance
module.exports = new MemoryCache();
