import type { FolderItem, FileItem, ItemKind } from '../types.js';
import { selKey } from '../types.js';
import type { DragItem } from '../lib/dnd.js';
import { useT } from '../i18n/lang.js';
import { ItemCard } from './ItemCard.js';
import { ItemRow } from './ItemRow.js';
import { FolderGlyph } from './Glyph.js';
import './file-view.css';

interface Props {
  view: 'grid' | 'list'; folders: FolderItem[]; files: FileItem[];
  onOpenFolder: (id: number) => void;
  onPreview: (file: FileItem) => void;
  onRenameFolder: (id: number) => void;
  onRenameFile: (id: number) => void;
  onDeleteFolder: (id: number) => void;
  onDeleteFile: (id: number) => void;
  onMoveFolder: (id: number) => void;
  onMoveFile: (id: number) => void;
  onMoveByDrag: (src: DragItem, destFolderId: number) => void;
  onUploadToFolder: (files: FileList | File[], folderId: number) => void;
  selected: Set<string>;
  onToggleSelect: (kind: ItemKind, id: number) => void;
}

export function FileView({ view, folders, files, onOpenFolder, onPreview, onRenameFolder, onRenameFile, onDeleteFolder, onDeleteFile, onMoveFolder, onMoveFile, onMoveByDrag, onUploadToFolder, selected, onToggleSelect }: Props) {
  const { t, lang } = useT();
  const selActive = selected.size > 0;
  const folderProps = (folder: FolderItem) => ({ kind: 'folder' as const, folder, onOpen: onOpenFolder, onRename: onRenameFolder, onDelete: onDeleteFolder, onMove: onMoveFolder, onMoveByDrag, onUploadToFolder, selected: selected.has(selKey('folder', folder.id)), selectionActive: selActive, onToggleSelect: () => onToggleSelect('folder', folder.id) });
  const fileProps = (file: FileItem) => ({ kind: 'file' as const, file, onPreview, onRename: onRenameFile, onDelete: onDeleteFile, onMove: onMoveFile, onMoveByDrag, selected: selected.has(selKey('file', file.id)), selectionActive: selActive, onToggleSelect: () => onToggleSelect('file', file.id) });

  if (!folders.length && !files.length) return (
    <div className="file-empty">
      <div className="file-empty-art"><FolderGlyph size={78} /><span className="file-empty-plus">+</span></div>
      <h3>{t('emptyTitle')}</h3>
      <p>{t('emptyHint')}</p>
      <span className="file-empty-drop">{lang === 'id' ? 'Atau seret dan lepaskan file di sini' : 'Or drag and drop your files here'}</span>
    </div>
  );

  if (view === 'grid') return (
    <div className="file-library">
      {!!folders.length && <section aria-label={lang === 'id' ? 'Folder' : 'Folders'}>
        <div className="file-section-heading"><h3>{lang === 'id' ? 'Folder' : 'Folders'}</h3><span>{folders.length}</span></div>
        <div className="folder-grid">{folders.map((folder, index) => <ItemCard key={`d${folder.id}`} {...folderProps(folder)} index={index} />)}</div>
      </section>}
      {!!files.length && <section aria-label={lang === 'id' ? 'File' : 'Files'}>
        <div className="file-section-heading"><h3>{lang === 'id' ? 'File' : 'Files'}</h3><span>{files.length}</span></div>
        <div className="document-grid">{files.map((file, index) => <ItemCard key={`f${file.id}`} {...fileProps(file)} index={index} />)}</div>
      </section>}
    </div>
  );

  return (
    <div className="file-list" aria-label={lang === 'id' ? 'File dan folder' : 'Files and folders'}>
      <div className="file-list-heading" aria-hidden="true"><span /><span>{t('sortName')}</span><span className="file-row-date">{t('sortDate')}</span><span className="file-row-type">{lang === 'id' ? 'Jenis' : 'Kind'}</span><span className="file-row-size">{t('sortSize')}</span><span /></div>
      {folders.map((folder) => <ItemRow key={`d${folder.id}`} {...folderProps(folder)} />)}
      {files.map((file) => <ItemRow key={`f${file.id}`} {...fileProps(file)} />)}
    </div>
  );
}
