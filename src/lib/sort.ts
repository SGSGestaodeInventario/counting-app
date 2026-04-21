// Helper genérico de ordenação por coluna com toggle asc/desc/none
export type SortDir = "asc" | "desc";
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

export function nextSort<K extends string>(state: SortState<K> | null, key: K): SortState<K> | null {
  if (!state || state.key !== key) return { key, dir: "asc" };
  if (state.dir === "asc") return { key, dir: "desc" };
  return null; // 3º clique remove ordenação
}

export function compareValues(a: unknown, b: unknown): number {
  // null/undefined sempre por último
  const aNil = a === null || a === undefined || a === "";
  const bNil = b === null || b === undefined || b === "";
  if (aNil && bNil) return 0;
  if (aNil) return 1;
  if (bNil) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

export function applySort<T, K extends string>(rows: T[], state: SortState<K> | null, getter: (r: T, k: K) => unknown): T[] {
  if (!state) return rows;
  const sign = state.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * compareValues(getter(a, state.key), getter(b, state.key)));
}

export function sortIndicator<K extends string>(state: SortState<K> | null, key: K): string {
  if (!state || state.key !== key) return "";
  return state.dir === "asc" ? " ▲" : " ▼";
}
