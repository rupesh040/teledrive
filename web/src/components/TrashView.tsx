import type { FolderItem, FileItem } from '../types.js';
import { sizeLabel } from '../lib/format.js';
import { useT } from '../i18n/lang.js';
import { FolderGlyph, FileGlyph } from './Glyph.js';
import { IconRestore, IconTrash } from './icons.js';

interface Props {
  folders: FolderItem[];
  files: FileItem[];
  onRestoreFolder: (id: number) => void;
  onRestoreFile: (id: number) => void;
  onPurgeFolder: (id: number) => void;
  onPurgeFile: (id: number) => void;
}

export function TrashView({ folders, files, onRestoreFolder, onRestoreFile, onPurgeFolder, onPurgeFile }: Props) {
  const { t } = useT();

  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="grid place-items-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl border border-line bg-panel/60 grid place-items-center mb-4 text-3xl">🗑️</div>
        <p className="font-display text-2xl text-content">{t('trashEmpty')}</p>
        <p className="text-sm text-muted mt-1.5">{t('trashEmptyHint')}</p>
      </div>
    );
  }

  const actionBtn = 'grid place-items-center w-8 h-8 rounded-lg text-muted hover:bg-ink/70 transition';

  return (
    <div className="flex flex-col gap-0.5">
      {folders.map((f) => (
        <div key={`d${f.id}`} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:bg-panel/70 hover:border-line transition">
          <span className="shrink-0"><FolderGlyph size={30} /></span>
          <span className="flex-1 truncate text-content">{f.name}</span>
          <span className="text-xs text-faint w-20 text-right">{t('folder')}</span>
          <div className="flex gap-0.5">
            <button className={`${actionBtn} hover:text-accent`} title={t('restore')} onClick={() => onRestoreFolder(f.id)}><IconRestore size={16} /></button>
            <button className={`${actionBtn} hover:text-[#e0584c]`} title={t('deleteForever')} onClick={() => onPurgeFolder(f.id)}><IconTrash size={16} /></button>
          </div>
        </div>
      ))}
      {files.map((f) => (
        <div key={`f${f.id}`} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:bg-panel/70 hover:border-line transition">
          <span className="shrink-0"><FileGlyph mime={f.mime_type} name={f.name} size={30} /></span>
          <span className="flex-1 truncate text-content">{f.name}</span>
          <span className="text-xs text-muted w-20 text-right">{sizeLabel(f.size)}</span>
          <div className="flex gap-0.5">
            <button className={`${actionBtn} hover:text-accent`} title={t('restore')} onClick={() => onRestoreFile(f.id)}><IconRestore size={16} /></button>
            <button className={`${actionBtn} hover:text-[#e0584c]`} title={t('deleteForever')} onClick={() => onPurgeFile(f.id)}><IconTrash size={16} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
