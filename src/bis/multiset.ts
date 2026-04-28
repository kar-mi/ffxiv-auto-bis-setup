export function multisetEquals(a: number[], b: number[]): boolean {
  const count = (ids: number[]): Map<number, number> => {
    const m = new Map<number, number>();
    for (const id of ids) if (id !== 0) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  };
  const ca = count(a), cb = count(b);
  if (ca.size !== cb.size) return false;
  for (const [id, n] of ca) if (cb.get(id) !== n) return false;
  return true;
}

export function multisetDiff(a: number[], b: number[]): { onlyA: number[]; onlyB: number[] } {
  const count = (ids: number[]): Map<number, number> => {
    const m = new Map<number, number>();
    for (const id of ids) if (id !== 0) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  };
  const ca = count(a), cb = count(b);
  const onlyA: number[] = [];
  const onlyB: number[] = [];
  for (const [id, have] of ca) {
    const need = cb.get(id) ?? 0;
    for (let i = need; i < have; i++) onlyA.push(id);
  }
  for (const [id, need] of cb) {
    const have = ca.get(id) ?? 0;
    for (let i = have; i < need; i++) onlyB.push(id);
  }
  return { onlyA, onlyB };
}
