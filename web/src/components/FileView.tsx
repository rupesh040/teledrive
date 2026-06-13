import type { FolderItem, FileItem, ItemKind } from '../types.js';
import { selKey } from '../types.js';
import type { DragItem } from '../lib/dnd.js';
import { useT } from '../i18n/lang.js';
import { ItemCard } from './ItemCard.js';
import { ItemRow } from './ItemRow.js';

interface Props {
  view: 'grid' | 'list';
  folders: FolderItem[];
  files: FileItem[];
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

export function FileView({
  view, folders, files, onOpenFolder, onPreview,
  onRenameFolder, onRenameFile, onDeleteFolder, onDeleteFile, onMoveFolder, onMoveFile, onMoveByDrag, onUploadToFolder,
  selected, onToggleSelect,
}: Props) {
  const { t } = useT();
  const selActive = selected.size > 0;
  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="grid place-items-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl border border-line bg-panel/60 grid place-items-center mb-4 text-3xl">📭</div>
        <p className="font-display text-2xl text-content">{t('emptyTitle')}</p>
        <p className="text-sm text-muted mt-1.5">{t('emptyHint')}</p>
      </div>
    );
  }

  if (view === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
        {folders.map((f, i) => (
          <ItemCard key={`d${f.id}`} kind="folder" folder={f} index={i} onOpen={onOpenFolder} onRename={onRenameFolder} onDelete={onDeleteFolder} onMove={onMoveFolder} onMoveByDrag={onMoveByDrag} onUploadToFolder={onUploadToFolder} selected={selected.has(selKey('folder', f.id))} selectionActive={selActive} onToggleSelect={() => onToggleSelect('folder', f.id)} />
        ))}
        {files.map((f, i) => (
          <ItemCard key={`f${f.id}`} kind="file" file={f} index={folders.length + i} onPreview={onPreview} onRename={onRenameFile} onDelete={onDeleteFile} onMove={onMoveFile} onMoveByDrag={onMoveByDrag} selected={selected.has(selKey('file', f.id))} selectionActive={selActive} onToggleSelect={() => onToggleSelect('file', f.id)} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-3 px-3 pb-2 text-[11px] uppercase tracking-[0.16em] text-faint border-b border-line mb-1">
        <span className="w-[30px]" />
        <span className="flex-1">{t('sortName')}</span>
        <span className="w-28 text-right hidden md:block">{t('sortDate')}</span>
        <span className="w-20 text-right">{t('sortSize')}</span>
        <span className="w-[148px]" />
      </div>
      {folders.map((f) => (
        <ItemRow key={`d${f.id}`} kind="folder" folder={f} onOpen={onOpenFolder} onRename={onRenameFolder} onDelete={onDeleteFolder} onMove={onMoveFolder} onMoveByDrag={onMoveByDrag} onUploadToFolder={onUploadToFolder} selected={selected.has(selKey('folder', f.id))} selectionActive={selActive} onToggleSelect={() => onToggleSelect('folder', f.id)} />
      ))}
      {files.map((f) => (
        <ItemRow key={`f${f.id}`} kind="file" file={f} onPreview={onPreview} onRename={onRenameFile} onDelete={onDeleteFile} onMove={onMoveFile} onMoveByDrag={onMoveByDrag} selected={selected.has(selKey('file', f.id))} selectionActive={selActive} onToggleSelect={() => onToggleSelect('file', f.id)} />
      ))}
    </div>
  );
}
