import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { FolderItem, MovingItem } from '../types.js';
import { api } from '../api/client.js';
import { useT } from '../i18n/lang.js';
import { IconX, IconHome, IconCheck, IconMove } from './icons.js';
import { FolderGlyph } from './Glyph.js';
import { useSupportDialog } from './support-dialog.js';
import { MaterialButton } from './material/MaterialButton.js';
import { WavySpinner } from './material/WavyProgress.js';
import './support-flows.css';

interface Props {
  items: MovingItem[];
  onDone: () => void;
  onClose: () => void;
}

function pathLabel(folder: FolderItem, byId: Map<number, FolderItem>): string {
  const parts: string[] = [];
  const visited = new Set<number>();
  let current: FolderItem | undefined = folder;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    parts.unshift(current.name);
    current = current.parent_id == null ? undefined : byId.get(current.parent_id);
  }
  return parts.join(' / ');
}

export function MoveModal({ items, onDone, onClose }: Props) {
  const { t, lang } = useT();
  const [folders, setFolders] = useState<FolderItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] = useState<number | null>(null);
  const titleId = useId();
  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  const dialog = useSupportDialog(true, close);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    api.listAllFolders().then((value) => { if (alive) setFolders(value); })
      .catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : (lang === 'en' ? 'Could not load folders.' : 'Folder tidak dapat dimuat.')); });
    return () => { alive = false; };
  }, [revision, lang]);

  const byId = useMemo(() => new Map((folders ?? []).map((folder) => [folder.id, folder])), [folders]);
  const blocked = useMemo(() => {
    const ids = new Set(items.filter((item) => item.kind === 'folder').map((item) => item.id));
    let added = true;
    while (added) {
      added = false;
      (folders ?? []).forEach((folder) => {
        if (folder.parent_id != null && ids.has(folder.parent_id) && !ids.has(folder.id)) {
          ids.add(folder.id);
          added = true;
        }
      });
    }
    return ids;
  }, [folders, items]);
  const targets = useMemo(() => (folders ?? [])
    .filter((folder) => !blocked.has(folder.id))
    .map((folder) => ({ folder, label: pathLabel(folder, byId) }))
    .sort((a, b) => a.label.localeCompare(b.label)), [folders, blocked, byId]);

  async function move() {
    if (busy || folders === null) return;
    setBusy(true);
    setError(null);
    try {
      for (const item of items) {
        if (item.kind === 'folder') await api.moveFolder(item.id, destination);
        else await api.moveFile(item.id, destination);
      }
      onDone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (lang === 'en' ? 'Could not move these items.' : 'Item tidak dapat dipindahkan.'));
      setBusy(false);
    }
  }

  return (
    <div className="support-backdrop" onClick={close}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="support-dialog move-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="support-dialog-header">
          <span className="support-heading-symbol"><IconMove size={22} /></span>
          <div className="support-dialog-title"><h2 id={titleId}>{t('moveTitle')}</h2><p>{items.length === 1 ? items[0].name : `${items.length} ${t('selectedSuffix')}`}</p></div>
          <button disabled={busy} className="support-icon-button" onClick={close} aria-label={lang === 'en' ? 'Close' : 'Tutup'}><IconX size={19} /></button>
        </header>
        <p className="move-description">{t('chooseTarget')}</p>
        <div className="move-destinations" aria-busy={folders === null && !error}>
          {folders === null && !error ? <p className="support-loading" role="status"><WavySpinner />{t('loading')}</p> : folders !== null && <>
            <button disabled={busy} onClick={() => setDestination(null)} className={`move-destination ${destination === null ? 'is-selected' : ''}`} aria-pressed={destination === null}>
              <IconHome size={24} /><span>{t('myDrive')}</span>{destination === null && <IconCheck size={18} />}
            </button>
            {targets.map(({ folder, label }) => <button key={folder.id} disabled={busy} onClick={() => setDestination(folder.id)} className={`move-destination ${destination === folder.id ? 'is-selected' : ''}`} aria-pressed={destination === folder.id}>
              <FolderGlyph size={27} /><span title={label}>{label}</span>{destination === folder.id && <IconCheck size={18} />}
            </button>)}
            {targets.length === 0 && <p className="move-empty-hint">{t('noOtherFolders')}</p>}
          </>}
          {error && <div role="alert" className="support-error"><p>{error}</p>{folders === null && <MaterialButton variant="text" onClick={() => setRevision((value) => value + 1)}>{lang === 'en' ? 'Try again' : 'Coba lagi'}</MaterialButton>}</div>}
        </div>
        <footer className="support-dialog-footer">
          <MaterialButton disabled={busy} variant="text" onClick={close}>{lang === 'en' ? 'Cancel' : 'Batal'}</MaterialButton>
          <MaterialButton disabled={busy || folders === null} icon={busy ? <WavySpinner /> : <IconMove size={18} />} onClick={move}>{busy ? t('loading') : (lang === 'en' ? 'Move here' : 'Pindahkan ke sini')}</MaterialButton>
        </footer>
      </div>
    </div>
  );
}
