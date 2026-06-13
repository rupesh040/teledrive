import { useState } from 'react';
import type { FolderItem, FileItem } from '../types.js';
import { api } from '../api/client.js';
import { sizeLabel, isImage } from '../lib/format.js';
import { useT } from '../i18n/lang.js';
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
  index?: number;
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
  index?: number;
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
      className={`absolute top-2.5 left-2.5 z-10 grid place-items-center w-5 h-5 rounded-md border transition ${
        selected
          ? 'bg-accent border-accent text-ink opacity-100'
          : `bg-ink/70 border-line text-transparent ${selectionActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`
      }`}
    >
      <IconCheck size={13} />
    </button>
  );
}

const shell =
  'group relative rounded-2xl border border-line bg-panel/80 p-4 transition-all duration-200 ' +
  'hover:bg-panel-hi hover:border-line-hi hover:-translate-y-0.5 hover:shadow-lift fade-up';

function IconBtn({
  onClick, title, tone = 'accent', children, as,
}: {
  onClick?: () => void;
  title: string;
  tone?: 'accent' | 'danger';
  children: React.ReactNode;
  as?: { href: string };
}) {
  const cls =
    'grid place-items-center w-7 h-7 rounded-lg bg-ink/80 border border-line text-muted transition ' +
    (tone === 'danger' ? 'hover:text-[#e0584c] hover:border-[#e0584c]/50' : 'hover:text-accent hover:border-line-hi');
  return as ? (
    <a href={as.href} title={title} className={cls}>{children}</a>
  ) : (
    <button onClick={onClick} title={title} className={cls}>{children}</button>
  );
}

export function ItemCard(props: Props) {
  const { t } = useT();
  const [over, setOver] = useState(false);
  const delay = { animationDelay: `${Math.min((props.index ?? 0) * 35, 500)}ms` };

  if (props.kind === 'folder') {
    const { folder, onOpen, onRename, onDelete, onMove, onMoveByDrag, onUploadToFolder, selected, selectionActive, onToggleSelect } = props;
    const canDrop = (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('Files')) return true;
      const d = dnd.get();
      return !!d && !(d.kind === 'folder' && d.id === folder.id);
    };
    return (
      <div
        className={`${shell} ${over || selected ? 'ring-2 ring-accent border-line-hi' : ''}`}
        style={delay}
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
        <button className="w-full flex flex-col items-center gap-3 pt-2" onClick={() => onOpen(folder.id)}>
          <FolderGlyph size={58} />
          <span className="text-sm text-center text-content break-words line-clamp-2 leading-snug">{folder.name}</span>
          <span className="text-[11px] text-faint">{t('folder')}</span>
        </button>
        <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <IconBtn title={t('move')} onClick={() => onMove(folder.id)}><IconMove size={15} /></IconBtn>
          <IconBtn title={t('rename')} onClick={() => onRename(folder.id)}><IconPencil size={15} /></IconBtn>
          <IconBtn title={t('deleteFolder')} tone="danger" onClick={() => onDelete(folder.id)}><IconTrash size={15} /></IconBtn>
        </div>
      </div>
    );
  }

  const { file, onPreview, onRename, onDelete, onMove, selected, selectionActive, onToggleSelect } = props;
  return (
    <div
      className={`${shell} ${selected ? 'ring-2 ring-accent border-line-hi' : ''}`}
      style={delay}
      draggable
      onDragStart={() => dnd.set({ kind: 'file', id: file.id })}
      onDragEnd={() => dnd.set(null)}
    >
      <SelectBox selected={selected} selectionActive={selectionActive} onToggle={onToggleSelect} />
      <button className="w-full flex flex-col items-center gap-3" onClick={() => onPreview(file)}>
        {isImage(file.mime_type) ? (
          <img
            src={api.previewUrl(file.id)}
            alt={file.name}
            loading="lazy"
            className="w-full h-28 object-cover rounded-xl bg-ink border border-line"
          />
        ) : (
          <div className="h-28 grid place-items-center">
            <FileGlyph mime={file.mime_type} name={file.name} size={62} />
          </div>
        )}
        <span className="text-sm text-center text-content break-words line-clamp-2 leading-snug">{file.name}</span>
        <span className="text-[11px] text-faint">{sizeLabel(file.size)}</span>
      </button>
      <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <IconBtn title={t('download')} as={{ href: api.downloadUrl(file.id) }}><IconDownload size={15} /></IconBtn>
        <IconBtn title={t('move')} onClick={() => onMove(file.id)}><IconMove size={15} /></IconBtn>
        <IconBtn title={t('rename')} onClick={() => onRename(file.id)}><IconPencil size={15} /></IconBtn>
        <IconBtn title={t('delete')} tone="danger" onClick={() => onDelete(file.id)}><IconTrash size={15} /></IconBtn>
      </div>
    </div>
  );
}
