/** Browser-owned install prompts are single-use and must be opened by a user gesture. */
interface InstallChoice {
  outcome: 'accepted' | 'dismissed';
}
interface InstallPromptEvent extends Event {
  prompt(): Promise<void | InstallChoice>;
  userChoice: Promise<InstallChoice>;
}
export interface InstallState {
  installed: boolean;
  available: boolean;
  prompting: boolean;
}

const displayModes = [
  window.matchMedia('(display-mode: standalone)'),
  window.matchMedia('(display-mode: minimal-ui)'),
  window.matchMedia('(display-mode: window-controls-overlay)'),
];
const isStandalone = () => displayModes.some(media => media.matches)
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;
let deferredPrompt: InstallPromptEvent | null = null;
let state: InstallState = { installed: isStandalone(), available: false, prompting: false };
const subscribers = new Set<() => void>();

function update(next: Partial<InstallState>) {
  state = { ...state, ...next };
  subscribers.forEach(listener => listener());
}

// The module is imported before React renders, so switching screens cannot lose a prompt.
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  if (state.installed) return;
  deferredPrompt = event as InstallPromptEvent;
  update({ available: true });
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  update({ installed: true, available: false, prompting: false });
});
displayModes.forEach(media => media.addEventListener('change', () => {
  const installed = isStandalone();
  if (installed) deferredPrompt = null;
  update({ installed, available: !installed && deferredPrompt !== null });
}));

export function getInstallState(): InstallState { return state; }
export function subscribeToInstall(listener: () => void): () => void {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}

export async function requestAppInstall(): Promise<'accepted' | 'dismissed' | 'unavailable' | 'failed'> {
  if (state.installed || state.prompting) return 'dismissed';
  if (!deferredPrompt) return 'unavailable';
  const prompt = deferredPrompt;
  deferredPrompt = null;
  update({ available: false, prompting: true });
  try {
    // Keep this call before the first await so the browser receives the click gesture.
    const opened = prompt.prompt();
    const result = await opened;
    const choice = result ?? await prompt.userChoice;
    return choice.outcome;
  } catch {
    return 'failed';
  } finally {
    update({ prompting: false, available: !state.installed && deferredPrompt !== null });
  }
}

export function installPlatform(): 'ios' | 'android' | 'mac-safari' | 'desktop' {
  const userAgent = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  if (/Macintosh/i.test(userAgent) && /Safari/i.test(userAgent) && !/Chrome|Chromium|Edg|OPR/i.test(userAgent)) return 'mac-safari';
  return 'desktop';
}
