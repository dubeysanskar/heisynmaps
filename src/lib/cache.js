// Small in-memory LRU with TTL, shared across hot reloads.
export function lru(name, { max = 1000, ttlMs = 300_000 } = {}) {
  const store = (globalThis.__nakshaLru ??= {});
  const map = (store[name] ??= new Map());
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (Date.now() - hit.at > ttlMs) {
        map.delete(key);
        return undefined;
      }
      map.delete(key); // refresh recency
      map.set(key, hit);
      return hit.value;
    },
    set(key, value) {
      map.set(key, { value, at: Date.now() });
      if (map.size > max) map.delete(map.keys().next().value);
    },
  };
}

// fetch with one retry on throttling/transient upstream errors.
export async function fetchWithRetry(url, init, { retries = 2, delayMs = 600 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (![429, 502, 503, 504].includes(res.status) || attempt >= retries) return res;
    const retryAfter = Number(res.headers.get("retry-after"));
    await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 3000) : delayMs * (attempt + 1)));
  }
}
