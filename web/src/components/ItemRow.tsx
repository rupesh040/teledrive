import { useState } from 'react';
import type { FolderItem, FileItem } from '../types.js';
import { api } from '../api/client.js';
import { sizeLabel, dateLabel } from '../lib/format.js';
import { useT } from '../i18n/lang.js';
import { DATE_LOCALE } from '../i18n/strings.js';
import { dnd, type DragItem } from '../lib/dnd.js';
import { FolderGlyph, FileGlyph } from './Glyph.js';
import { IconMove, IconPencil, IconTrash, IconDownload, IconCheck } from './icons.js';

interface SelectProps {
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: () => void;
}
interface FolderProps extends SelectProps {
  kind: 'folder';
  folder: FolderItem;
  onOpen: (id: number) => void;
  onRename: (id: number) => void;
  onDelete: (id: number) => void;
  onMove: (id: number) => void;
  onMoveByDrag: (src: DragItem, destFolderId: number) => void;
  onUploadToFolder: (files: FileList | File[], folderId: number) => void;
}
interface FileProps extends SelectProps {
  kind: 'file';
  file: FileItem;
  onPreview: (f: FileItem) => void;
  onRename: (id: number) => void;
  onDelete: (id: number) => void;
  onMove: (id: number) => void;
  onMoveByDrag: (src: DragItem, destFolderId: number) => void;
}
type Props = FolderProps | FileProps;

function SelectBox({ selected, selectionActive, onToggle }: { selected: boolean; selectionActive: boolean; onToggle: () => void }) {
  return (
    <button
      draggable={false}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`shrink-0 grid place-items-center w-5 h-5 rounded-md border transition ${
        selected
          ? 'bg-accent border-accent text-ink opacity-100'
          : `bg-ink/70 border-line text-transparent ${selectionActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`
      }`}
    >
      <IconCheck size={13} />
    </button>
  );
}

const iconBtn =
  'grid place-items-center w-8 h-8 rounded-lg text-muted hover:text-accent hover:bg-ink/70 transition';
const danger = 'grid place-items-center w-8 h-8 rounded-lg text-muted hover:text-[#e0584c] hover:bg-ink/70 transition';

export function ItemRow(props: Props) {
  const { t, lang } = useT();
  const [over, setOver] = useState(false);
  const loc = DATE_LOCALE[lang];
  if (props.kind === 'folder') {
    const { folder, onOpen, onRename, onDelete, onMove, onMoveByDrag, onUploadToFolder, selected, selectionActive, onToggleSelect } = props;
    const canDrop = (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('Files')) return true;
      const d = dnd.get();
      return !!d && !(d.kind === 'folder' && d.id === folder.id);
    };
    return (
      <div
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${
          over || selected ? 'bg-accent-soft border-line-hi' : 'border-transparent hover:bg-panel/70 hover:border-line'
        }`}
        draggable
        onDragStart={() => dnd.set({ kind: 'folder', id: folder.id })}
        onDragEnd={() => dnd.set(null)}
        onDragOver={(e) => { if (canDrop(e)) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!canDrop(e)) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          if (e.dataTransfer.files.length) { onUploadToFolder(e.dataTransfer.files, folder.id); return; }
          const d = dnd.get();
          if (d) onMoveByDrag(d, folder.id);
        }}
      >
        <SelectBox selected={selected} selectionActive={selectionActive} onToggle={onToggleSelect} />
        <span className="shrink-0"><FolderGlyph size={30} /></span>
        <button className="flex-1 text-left truncate text-content" onClick={() => onOpen(folder.id)}>{folder.name}</button>
        <span className="text-xs text-faint w-28 text-right hidden md:block">{dateLabel(folder.created_at, loc)}</span>
        <span className="text-xs text-faint w-20 text-right">—</span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
          <button className={iconBtn} title={t('move')} onClick={() => onMove(folder.id)}><IconMove size={16} /></button>
          <button className={iconBtn} title={t('rename')} onClick={() => onRename(folder.id)}><IconPencil size={16} /></button>
          <button className={danger} title={t('delete')} onClick={() => onDelete(folder.id)}><IconTrash size={16} /></button>
        </div>
      </div>
    );
  }

  const { file, onPreview, onRename, onDelete, onMove, selected, selectionActive, onToggleSelect } = props;
  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${
        selected ? 'bg-accent-soft border-line-hi' : 'border-transparent hover:bg-panel/70 hover:border-line'
      }`}
      draggable
      onDragStart={() => dnd.set({ kind: 'file', id: file.id })}
      onDragEnd={() => dnd.set(null)}
    >
      <SelectBox selected={selected} selectionActive={selectionActive} onToggle={onToggleSelect} />
      <span className="shrink-0"><FileGlyph mime={file.mime_type} name={file.name} size={30} /></span>
      <button className="flex-1 text-left truncate text-content" onClick={() => onPreview(file)}>{file.name}</button>
      <span className="text-xs text-faint w-28 text-right hidden md:block">{dateLabel(file.created_at, loc)}</span>
      <span className="text-xs text-muted w-20 text-right">{sizeLabel(file.size)}</span>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
        <a className={iconBtn} title={t('download')} href={api.downloadUrl(file.id)}><IconDownload size={16} /></a>
        <button className={iconBtn} title={t('move')} onClick={() => onMove(file.id)}><IconMove size={16} /></button>
        <button className={iconBtn} title={t('rename')} onClick={() => onRename(file.id)}><IconPencil size={16} /></button>
        <button className={danger} title={t('delete')} onClick={() => onDelete(file.id)}><IconTrash size={16} /></button>
      </div>
    </div>
  );
}
