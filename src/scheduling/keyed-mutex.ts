export class KeyedMutex<K> {
  private readonly tail = new Map<K, Promise<unknown>>();

  async run<T>(key: K, work: () => Promise<T>): Promise<T> {
    const prev = this.tail.get(key) ?? Promise.resolve();
    const next = prev.then(work, work);
    const settled = next.then(
      () => undefined,
      () => undefined,
    );
    this.tail.set(key, settled);
    try {
      return await next;
    } finally {
      if (this.tail.get(key) === settled) {
        this.tail.delete(key);
      }
    }
  }
}
