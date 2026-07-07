// PWA install plumbing. The `beforeinstallprompt` event can fire before React
// mounts, so this module captures it at import time (main.tsx imports it early)
// and lets the landing page trigger the browser's install prompt on demand.

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Stop Chrome's mini-infobar so we can present our own install button.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

/** True once the browser has offered an installable prompt we can replay. */
export function canInstall(): boolean {
  return deferred !== null;
}

/** Show the native install prompt. Returns the user's choice, or 'unavailable'
 *  when no prompt was captured (iOS Safari, already installed, etc.). */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  if (outcome === 'accepted') deferred = null;
  return outcome;
}

/** Subscribe to install-availability changes; returns an unsubscribe fn. */
export function onInstallChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** True when running as an installed PWA (standalone window) rather than a
 *  regular browser tab — used to skip the landing page and open straight in. */
export function isInstalledPWA(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    false;
  // iOS Safari signals an installed home-screen app via navigator.standalone.
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

/** iOS (incl. iPadOS, which masquerades as Mac) — no beforeinstallprompt there,
 *  so the landing page shows manual "Add to Home Screen" instructions instead. */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}
