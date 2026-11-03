import { useState } from 'react';
import type { FolderItem, FileItem } from '../types.js';
import { sizeLabel, dateLabel } from '../lib/format.js';
import { useT } from '../i18n/lang.js';
import { FolderGlyph, FileGlyph } from './Glyph.js';
import { IconRestore, IconTrash, IconTrashBin } from './icons.js';
import './support-flows.css';

interface Props {
  folders: FolderItem[];
  files: FileItem[];
  onRestoreFolder: (id: number) => void;
  onRestoreFile: (id: number) => void;
  onPurgeFolder: (id: number) => void;
  onPurgeFile: (id: number) => void;
}

export function TrashView({ folders, files, onRestoreFolder, onRestoreFile, onPurgeFolder, onPurgeFile }: Props) {
  const { t, lang } = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(key: string, action: () => void) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try { await action(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : (lang === 'en' ? 'The item could not be updated. Please try again.' : 'Item tidak dapat diperbarui. Coba lagi.')); }
    finally { setBusy(null); }
  }

  if (folders.length === 0 && files.length === 0) {
    return <div className="support-empty library-empty"><span className="support-empty-symbol"><IconTrashBin size={36} /></span><h2>{t('trashEmpty')}</h2><p>{t('trashEmptyHint')}</p></div>;
  }

  const entries = [
    ...folders.map((item) => ({ item, kind: 'folder' as const })),
    ...files.map((item) => ({ item, kind: 'file' as const })),
  ];

  return (
    <div className="support-results">
      <div className="trash-note"><IconRestore size={18} /><span>{lang === 'en' ? 'Changed your mind? Restore an item to put it back in your drive.' : 'Berubah pikiran? Pulihkan item untuk mengembalikannya ke drive.'}</span></div>
      {error && <p role="alert" className="support-error">{error}</p>}
      <div className="support-list-header"><span>{lang === 'en' ? 'Name' : 'Nama'}</span><span>{lang === 'en' ? 'Deleted' : 'Dihapus'}</span><span>{lang === 'en' ? 'Size' : 'Ukuran'}</span><span className="sr-only">{lang === 'en' ? 'Actions' : 'Tindakan'}</span></div>
      {entries.map(({ item, kind }) => {
        const key = `${kind}:${item.id}`;
        const restore = kind === 'folder' ? onRestoreFolder : onRestoreFile;
        const purge = kind === 'folder' ? onPurgeFolder : onPurgeFile;
        return <div key={key} className="support-file-row" aria-busy={busy === key}>
          <span className="support-file-name"><span className="support-row-glyph">{kind === 'folder' ? <FolderGlyph size={34} /> : <FileGlyph mime={(item as FileItem).mime_type} name={item.name} size={34} />}</span><span title={item.name}>{item.name}</span></span>
          <span className="support-row-date">{item.deleted_at ? dateLabel(item.deleted_at, lang === 'en' ? 'en-US' : 'id-ID') : '—'}</span>
          <span className="support-row-size">{kind === 'folder' ? t('folder') : sizeLabel((item as FileItem).size)}</span>
          <span className="support-row-actions">
            {busy === key ? <span role="status" className="support-spinner" aria-label={t('loading')} /> : <>
              <button disabled={busy !== null} className="support-icon-button" title={t('restore')} aria-label={`${t('restore')} ${item.name}`} onClick={() => act(key, () => restore(item.id))}><IconRestore size={17} /></button>
              <button disabled={busy !== null} className="support-icon-button support-danger" title={t('deleteForever')} aria-label={`${t('deleteForever')} ${item.name}`} onClick={() => act(key, () => purge(item.id))}><IconTrash size={17} /></button>
            </>}
          </span>
        </div>;
      })}
    </div>
  );
}
