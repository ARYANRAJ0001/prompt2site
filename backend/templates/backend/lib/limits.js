/**
 * Simple in-memory rate limiting (per server instance), e.g. to stop
 * password guessing: limiter.hit(key) returns false once the limit is reached.
 */
function createLimiter({ max, windowMs }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, 60000).unref();

  return {
    hit(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.reset < now) {
        hits.set(key, { count: 1, reset: now + windowMs });
        return true;
      }
      entry.count++;
      return entry.count <= max;
    },
    clear(key) {
      hits.delete(key);
    },
    minutesLeft(key) {
      const e = hits.get(key);
      return e ? Math.max(1, Math.ceil((e.reset - Date.now()) / 60000)) : 0;
    },
  };
}

module.exports = { createLimiter };
