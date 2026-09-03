export function pruneExpired<K>(entries: Map<K, { expiresAt: number }>, now = Date.now()): void {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) {
      entries.delete(key);
    }
  }
}
