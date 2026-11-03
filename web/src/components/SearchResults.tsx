import { useMemo } from 'react';
import type { FolderItem, FileItem } from '../types.js';
import { sizeLabel } from '../lib/format.js';
import { useT } from '../i18n/lang.js';
import { FolderGlyph, FileGlyph } from './Glyph.js';
import { IconSearch, IconChevron } from './icons.js';
import './support-flows.css';

interface Props {
  folders: FolderItem[];
  files: FileItem[];
  allFolders: FolderItem[];
  onOpenFolder: (id: number) => void;
  onPreview: (f: FileItem) => void;
}

export function SearchResults({ folders, files, allFolders, onOpenFolder, onPreview }: Props) {
  const { t, lang } = useT();
  const byId = useMemo(() => new Map(allFolders.map((folder) => [folder.id, folder])), [allFolders]);
  const pathOf = (folderId: number | null): string => {
    if (folderId == null) return t('myDrive');
    const parts: string[] = [];
    const visited = new Set<number>();
    let current = byId.get(folderId);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      parts.unshift(current.name);
      current = current.parent_id == null ? undefined : byId.get(current.parent_id);
    }
    return parts.length ? parts.join(' / ') : t('myDrive');
  };

  if (folders.length === 0 && files.length === 0) {
    return <div className="support-empty library-empty"><span className="support-empty-symbol"><IconSearch size={34} /></span><h2>{t('noResults')}</h2><p>{lang === 'en' ? 'Try a different name or a shorter search.' : 'Coba nama lain atau pencarian yang lebih singkat.'}</p></div>;
  }

  return (
    <div className="support-results search-results">
      <p className="search-result-count" role="status">{folders.length + files.length} {lang === 'en' ? ((folders.length + files.length) === 1 ? 'result in your drive' : 'results in your drive') : 'hasil di drive Anda'}</p>
      {folders.map((folder) => <button key={`d${folder.id}`} onClick={() => onOpenFolder(folder.id)} className="search-result-row">
        <span className="support-row-glyph"><FolderGlyph size={37} /></span>
        <span className="search-result-name"><span title={folder.name}>{folder.name}</span><small>{pathOf(folder.parent_id)}</small></span>
        <span className="support-row-size">{t('folder')}</span><IconChevron size={17} />
      </button>)}
      {files.map((file) => <button key={`f${file.id}`} onClick={() => onPreview(file)} className="search-result-row">
        <span className="support-row-glyph"><FileGlyph mime={file.mime_type} name={file.name} size={37} /></span>
        <span className="search-result-name"><span title={file.name}>{file.name}</span><small>{pathOf(file.folder_id)}</small></span>
        <span className="support-row-size">{sizeLabel(file.size)}</span><IconChevron size={17} />
      </button>)}
    </div>
  );
}
