import { useEffect, useMemo, useState } from 'react';
import type { FolderItem, MovingItem } from '../types.js';
import { api } from '../api/client.js';
import { useT } from '../i18n/lang.js';
import { IconX, IconHome } from './icons.js';
import { FolderGlyph } from './Glyph.js';

interface Props {
  items: MovingItem[];       // one or many items being moved
  onDone: () => void;        // called after a successful move
  onClose: () => void;
}

// Build a path label (e.g. "Photos / 2024") from a flat list of folders.
function pathLabel(f: FolderItem, byId: Map<number, FolderItem>): string {
  const parts: string[] = [];
  let cur: FolderItem | undefined = f;
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parent_id == null ? undefined : byId.get(cur.parent_id);
  }
  return parts.join(' / ');
}

export function MoveModal({ items, onDone, onClose }: Props) {
  const { t } = useT();
  const [folders, setFolders] = useState<FolderItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = items.length === 1 ? items[0].name : `${items.length} ${t('selectedSuffix')}`;

  useEffect(() => {
    api.listAllFolders().then(setFolders).catch((e) => setError(e.message));
  }, []);

  const byId = useMemo(() => {
    const m = new Map<number, FolderItem>();
    (folders ?? []).forEach((f) => m.set(f.id, f));
    return m;
  }, [folders]);

  // For each selected folder: block itself + all its descendants as a
  // destination (would create a cycle — the backend rejects it too).
  const blocked = useMemo(() => {
    const set = new Set<number>();
    items.forEach((it) => { if (it.kind === 'folder') set.add(it.id); });
    let added = true;
    while (added) {
      added = false;
      (folders ?? []).forEach((f) => {
        if (f.parent_id != null && set.has(f.parent_id) && !set.has(f.id)) {
          set.add(f.id);
          added = true;
        }
      });
    }
    return set;
  }, [folders, items]);

  const targets = useMemo(
    () =>
      (folders ?? [])
        .filter((f) => !blocked.has(f.id))
        .map((f) => ({ f, label: pathLabel(f, byId) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [folders, blocked, byId]
  );

  async function move(dest: number | null) {
    setBusy(true);
    setError(null);
    try {
      for (const it of items) {
        if (it.kind === 'folder') await api.moveFolder(it.id, dest);
        else await api.moveFile(it.id, dest);
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="pop-in bg-panel border border-line rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-3">
          <h2 className="font-medium truncate text-content">
            {t('moveTitle')} <span className="text-accent">{title}</span>
          </h2>
          <button className="grid place-items-center w-8 h-8 rounded-lg text-muted hover:text-content hover:bg-ink/70 transition shrink-0" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>

        <p className="px-5 pt-3.5 text-[11px] uppercase tracking-[0.16em] text-faint">{t('chooseTarget')}</p>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          {folders === null && <p className="text-muted text-sm px-2 py-4">{t('loading')}</p>}

          <button
            disabled={busy}
            onClick={() => move(null)}
            className="flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl text-content hover:bg-panel-hi border border-transparent hover:border-line transition disabled:opacity-50"
          >
            <span className="text-accent"><IconHome size={17} /></span> {t('homeRoot')}
          </button>

          {targets.map(({ f, label }) => (
            <button
              key={f.id}
              disabled={busy}
              onClick={() => move(f.id)}
              className="flex items-center gap-2.5 text-left px-3 py-2.5 rounded-xl text-content hover:bg-panel-hi border border-transparent hover:border-line transition disabled:opacity-50"
            >
              <span className="shrink-0"><FolderGlyph size={22} /></span>
              <span className="truncate">{label}</span>
            </button>
          ))}

          {folders !== null && targets.length === 0 && (
            <p className="text-muted text-sm px-2 py-2">{t('noOtherFolders')}</p>
          )}
        </div>

        {error && <p className="px-5 pb-4 text-sm text-[#e0584c]">{error}</p>}
      </div>
    </div>
  );
}
