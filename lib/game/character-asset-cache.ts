/** Ref-counted immutable resources. Actor-owned skeletons/materials never enter this cache. */
export type AssetLease<T> = { value: T; release: () => void };
type Entry<T> = {
  promise: Promise<T>;
  value?: T;
  users: number;
  bytes: number;
  touched: number;
};
export class CharacterAssetCache<T> {
  private entries = new Map<string, Entry<T>>();
  constructor(
    private readonly load: (key: string) => Promise<T>,
    private readonly destroy: (value: T) => void,
    private readonly size: (value: T) => number,
    private readonly idleBudget = 32 * 1024 * 1024,
  ) {}
  async acquire(key: string): Promise<AssetLease<T>> {
    let entry = this.entries.get(key);
    if (!entry) {
      const next: Entry<T> = {
        promise: undefined!,
        users: 0,
        bytes: 0,
        touched: 0,
      };
      next.promise = this.load(key)
        .then((value) => {
          next.value = value;
          next.bytes = this.size(value);
          return value;
        })
        .catch((error) => {
          if (this.entries.get(key) === next) this.entries.delete(key);
          throw error;
        });
      entry = next;
      this.entries.set(key, entry);
    }
    entry.users++;
    entry.touched = performance.now();
    try {
      const value = await entry.promise;
      let released = false;
      return {
        value,
        release: () => {
          if (released) return;
          released = true;
          entry.users--;
          entry.touched = performance.now();
          this.trim();
        },
      };
    } catch (error) {
      entry.users--;
      throw error;
    }
  }
  trim(allIdle = false) {
    const idle = [...this.entries.entries()]
      .filter(([, e]) => !e.users && e.value)
      .sort((a, b) => a[1].touched - b[1].touched);
    let bytes = idle.reduce((n, [, e]) => n + e.bytes, 0);
    for (const [key, entry] of idle) {
      if (!allIdle && bytes <= this.idleBudget) break;
      this.entries.delete(key);
      bytes -= entry.bytes;
      this.destroy(entry.value!);
    }
  }
  stats() {
    return {
      entries: this.entries.size,
      users: [...this.entries.values()].reduce((n, e) => n + e.users, 0),
      bytes: [...this.entries.values()].reduce((n, e) => n + e.bytes, 0),
    };
  }
}
