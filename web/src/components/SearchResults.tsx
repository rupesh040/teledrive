import { useMemo } from 'react';
import type { FolderItem, FileItem } from '../types.js';
import { sizeLabel } from '../lib/format.js';
import { useT } from '../i18n/lang.js';
import { FolderGlyph, FileGlyph } from './Glyph.js';

interface Props {
  folders: FolderItem[];
  files: FileItem[];
  allFolders: FolderItem[];
  onOpenFolder: (id: number) => void;
  onPreview: (f: FileItem) => void;
}

export function SearchResults({ folders, files, allFolders, onOpenFolder, onPreview }: Props) {
  const { t } = useT();
  const byId = useMemo(() => {
    const m = new Map<number, FolderItem>();
    allFolders.forEach((f) => m.set(f.id, f));
    return m;
  }, [allFolders]);

  // Jalur lokasi sebuah folder (mis. "Foto / 2024"); akar → label Beranda.
  const pathOf = (folderId: number | null): string => {
    if (folderId == null) return t('homeRoot');
    const parts: string[] = [];
    let cur = byId.get(folderId);
    let guard = 0;
    while (cur && guard++ < 50) {
      parts.unshift(cur.name);
      cur = cur.parent_id == null ? undefined : byId.get(cur.parent_id);
    }
    return parts.length ? parts.join(' / ') : t('homeRoot');
  };

  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="grid place-items-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl border border-line bg-panel/60 grid place-items-center mb-4 text-3xl">🔍</div>
        <p className="font-display text-2xl text-content">{t('noResults')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {folders.map((f) => (
        <button
          key={`d${f.id}`}
          onClick={() => onOpenFolder(f.id)}
          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:bg-panel/70 hover:border-line transition text-left"
        >
          <span className="shrink-0"><FolderGlyph size={30} /></span>
          <span className="flex-1 min-w-0">
            <span className="block truncate text-content">{f.name}</span>
            <span className="block truncate text-xs text-faint">{t('inLocation')} {pathOf(f.parent_id)}</span>
          </span>
          <span className="text-xs text-faint shrink-0">{t('folder')}</span>
        </button>
      ))}
      {files.map((f) => (
        <button
          key={`f${f.id}`}
          onClick={() => onPreview(f)}
          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent hover:bg-panel/70 hover:border-line transition text-left"
        >
          <span className="shrink-0"><FileGlyph mime={f.mime_type} name={f.name} size={30} /></span>
          <span className="flex-1 min-w-0">
            <span className="block truncate text-content">{f.name}</span>
            <span className="block truncate text-xs text-faint">{t('inLocation')} {pathOf(f.folder_id)}</span>
          </span>
          <span className="text-xs text-faint shrink-0">{sizeLabel(f.size)}</span>
        </button>
      ))}
    </div>
  );
}
