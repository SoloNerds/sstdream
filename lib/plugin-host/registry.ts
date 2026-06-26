// The runtime registry SHAPE, lifted from the lane registry (lib/targets/registry.ts).
//
// THE LOAD-BEARING DISTINCTION: the lane registry is a STATIC, compile-time, first-party instance
// the credential-free builder depends on — it is part of the zero-AI-writes moat and must never
// become a runtime plugin loader (a plugin must never be able to influence codegen). This is a
// SEPARATE generic the host instantiates at RUNTIME for plugin contributors. Same shape, opposite
// trust zone and load timing. Two instances, one shape — they never merge.

export class Registry<T extends { readonly id: string }> {
  private readonly items = new Map<string, T>();

  register(item: T): void {
    if (this.items.has(item.id)) throw new Error(`duplicate registration for id "${item.id}"`);
    this.items.set(item.id, item);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  list(): T[] {
    return [...this.items.values()];
  }
}
