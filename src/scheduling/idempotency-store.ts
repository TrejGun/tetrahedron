import { pruneExpired } from "../common/prune-expired";

export class IdempotencyStore<T> {
  private readonly entries = new Map<string, { fingerprint: string; value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string, now = Date.now()): { fingerprint: string; value: T } | undefined {
    pruneExpired(this.entries, now);
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    return { fingerprint: entry.fingerprint, value: entry.value };
  }

  set(key: string, fingerprint: string, value: T, now = Date.now()): void {
    if (this.ttlMs <= 0) {
      return;
    }
    pruneExpired(this.entries, now);
    this.entries.set(key, { fingerprint, value, expiresAt: now + this.ttlMs });
  }
}
