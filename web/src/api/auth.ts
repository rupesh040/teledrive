// Keep ordinary sign-ins in this tab; only remembered sessions survive closing it.
const KEY = 'td-token';
const listeners = new Set<() => void>();
function read(storage: 'sessionStorage' | 'localStorage'): string | null {
  try { return window[storage].getItem(KEY); } catch { return null; }
}
function remove(storage: 'sessionStorage' | 'localStorage'): void {
  try { window[storage].removeItem(KEY); } catch { /* Memory-only sessions still work. */ }
}
let token = read('sessionStorage') ?? read('localStorage');
let remembered = !read('sessionStorage') && !!token;

export function getToken(): string | null {
  return token;
}
export function setToken(value: string, remember = false): void {
  // Remove legacy/previous credentials before choosing the new storage scope.
  remove('sessionStorage');
  remove('localStorage');
  token = value;
  remembered = remember;
  try { window[remember ? 'localStorage' : 'sessionStorage'].setItem(KEY, value); } catch { /* Keep it in memory. */ }
}
export function clearToken(expectedToken?: string | null): boolean {
  // A late 401 from an older request must not clear a newer sign-in.
  if (expectedToken !== undefined && expectedToken !== token) return false;
  const previousToken = token;
  token = null;
  remembered = false;
  for (const storage of ['sessionStorage', 'localStorage'] as const) {
    if (read(storage) === previousToken) remove(storage);
  }
  listeners.forEach((fn) => fn());
  return true;
}
window.addEventListener('storage', event => {
  if (!remembered || !token || event.storageArea !== window.localStorage) return;
  if (event.key === null || (event.key === KEY && event.oldValue === token && event.newValue !== token)) {
    // Do not remove a different session that another tab has just saved.
    token = null;
    remembered = false;
    listeners.forEach(fn => fn());
  }
});
// Called when the active session expires or signs out.
export function onLocked(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
