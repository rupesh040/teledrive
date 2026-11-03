import { useEffect, useRef } from 'react';

/** Keep keyboard focus inside an open dialog, and return it to its opener. */
export function useSupportDialog<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => ref.current?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab' || !ref.current) return;
      const controls = Array.from(ref.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), md-filled-button:not([disabled]), md-filled-tonal-button:not([disabled]), md-outlined-button:not([disabled]), md-text-button:not([disabled]), md-icon-button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), audio[controls], video[controls], iframe, [tabindex="0"]',
      )).filter((element) => element.getClientRects().length > 0 && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        ref.current.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, [open]);

  return ref;
}
