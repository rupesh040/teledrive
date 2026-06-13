// Session token storage + 'locked' signal for the Gate.
const KEY = 'td-token';
const listeners = new Set<() => void>();

export function getToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function setToken(token: string): void {
  try { localStorage.setItem(KEY, token); } catch { /* ignore */ }
}
export function clearToken(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
}
// Called on a 401 → the Gate shows the LockScreen.
export function onLocked(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
