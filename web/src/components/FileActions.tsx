import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/lang.js';
import { IconDownload, IconMove, IconPencil, IconTrash } from './icons.js';
import { Ripple } from './material/Ripple.js';

interface Props {
  name: string;
  downloadUrl?: string;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

export function FileActions({ name, downloadUrl, onRename, onMove, onDelete }: Props) {
  const { t, lang } = useT();
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = (restoreFocus = false) => {
    setPosition(null);
    if (restoreFocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    };
    const dismiss = () => close();
    const onScroll = (event: Event) => { if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) close(); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', dismiss);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [position]);

  return (
    <>
      <button
        ref={trigger} type="button" className={`file-more md-state-layer ${position ? 'is-open' : ''}`}
        draggable={false} aria-label={`${lang === 'id' ? 'Tindakan untuk' : 'Actions for'} ${name}`}
        aria-haspopup="menu" aria-expanded={!!position} aria-controls={position ? id : undefined}
        onClick={(event) => {
          event.stopPropagation();
          if (position) { close(true); return; }
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - (downloadUrl ? 232 : 184))), left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)) });
        }}
      >
        <Ripple />
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
      </button>
      {position && createPortal(
        <div ref={menu} id={id} role="menu" aria-label={name} className="file-action-menu" style={position}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
            if (event.key === 'Tab') close();
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
              const active = items.indexOf(document.activeElement as HTMLElement);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
              items[next]?.focus();
            }
          }}
        >
          {downloadUrl && <a role="menuitem" className="md-state-layer" href={downloadUrl} onClick={() => close(true)}><Ripple /><IconDownload size={24} />{t('download')}</a>}
          <button role="menuitem" className="md-state-layer" onClick={() => { close(true); onRename(); }}><Ripple /><IconPencil size={24} />{t('rename')}</button>
          <button role="menuitem" className="md-state-layer" onClick={() => { close(true); onMove(); }}><Ripple /><IconMove size={24} />{t('move')}</button>
          <div className="file-menu-divider" />
          <button role="menuitem" className="is-danger md-state-layer" onClick={() => { close(true); onDelete(); }}><Ripple /><IconTrash size={24} />{t('delete')}</button>
        </div>, document.body,
      )}
    </>
  );
}
