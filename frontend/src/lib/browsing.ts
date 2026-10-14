export interface Visit {
  id: string;
  at: string;
}
const VISITS = 'shop.visits.v1';
const SEARCHES = 'shop.searches.v1';
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Browser storage may be disabled. */
  }
}
export function visits(): Visit[] {
  const raw = readLocal<Visit[]>(VISITS, []);
  return Array.isArray(raw)
    ? raw
        .filter(
          (x) =>
            typeof x?.id === 'string' &&
            Number.isFinite(Date.parse(x.at)) &&
            Date.parse(x.at) > Date.now() - 30 * 86400000,
        )
        .slice(0, 200)
    : [];
}
export function recordVisit(id: string) {
  writeLocal(VISITS, [{ id, at: new Date().toISOString() }, ...visits().filter((v) => v.id !== id)]);
}
export function removeVisit(id?: string) {
  writeLocal(VISITS, id ? visits().filter((v) => v.id !== id) : []);
}
export function searches(): string[] {
  const raw = readLocal<string[]>(SEARCHES, []);
  return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string').slice(0, 10) : [];
}
export function recordSearch(term: string) {
  if (term.trim()) writeLocal(SEARCHES, [term.trim(), ...searches().filter((s) => s !== term.trim())].slice(0, 10));
}
export function removeSearch(term?: string) {
  writeLocal(SEARCHES, term ? searches().filter((s) => s !== term) : []);
}
