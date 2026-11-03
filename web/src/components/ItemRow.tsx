import { useState } from 'react';
import type { FolderItem, FileItem } from '../types.js';
import { api } from '../api/client.js';
import { sizeLabel, dateLabel, fileMeta } from '../lib/format.js';
import { useT } from '../i18n/lang.js';
import { DATE_LOCALE } from '../i18n/strings.js';
import { dnd, type DragItem } from '../lib/dnd.js';
import { FolderGlyph, FileGlyph } from './Glyph.js';
import { IconCheck } from './icons.js';
import { FileActions } from './FileActions.js';
import { Ripple } from './material/Ripple.js';

interface SelectProps { selected: boolean; selectionActive: boolean; onToggleSelect: () => void; }
interface FolderProps extends SelectProps {
  kind: 'folder'; folder: FolderItem;
  onOpen: (id: number) => void;
  onRename: (id: number) => void;
  onDelete: (id: number) => void;
  onMove: (id: number) => void;
  onMoveByDrag: (src: DragItem, destFolderId: number) => void;
  onUploadToFolder: (files: FileList | File[], folderId: number) => void;
}
interface FileProps extends SelectProps {
  kind: 'file'; file: FileItem;
  onPreview: (f: FileItem) => void;
  onRename: (id: number) => void;
  onDelete: (id: number) => void;
  onMove: (id: number) => void;
  onMoveByDrag: (src: DragItem, destFolderId: number) => void;
}
type Props = FolderProps | FileProps;

export function ItemRow(props: Props) {
  const { t, lang } = useT();
  const [over, setOver] = useState(false);
  const folder = props.kind === 'folder' ? props.folder : null;
  const file = props.kind === 'file' ? props.file : null;
  const item = folder ?? file!;
  const canDrop = (event: React.DragEvent) => {
    if (!folder) return false;
    if (event.dataTransfer.types.includes('Files')) return true;
    const source = dnd.get();
    return !!source && !(source.kind === 'folder' && source.id === folder.id);
  };
  return (
    <div className={`file-row ${props.selected ? 'is-selected' : ''} ${over ? 'is-drop-target' : ''} ${props.selectionActive ? 'selection-active' : ''}`}
      draggable
      onDragStart={(event) => { dnd.set({ kind: props.kind, id: item.id }); event.dataTransfer.setData('text/plain', item.name); event.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={() => { dnd.set(null); setOver(false); }}
      onDragOver={(event) => { if (canDrop(event)) { event.preventDefault(); setOver(true); } }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false); }}
      onDrop={(event) => {
        if (!canDrop(event) || props.kind !== 'folder') return;
        event.preventDefault(); event.stopPropagation(); setOver(false);
        if (event.dataTransfer.files.length) props.onUploadToFolder(event.dataTransfer.files, props.folder.id);
        else { const source = dnd.get(); if (source) props.onMoveByDrag(source, props.folder.id); dnd.set(null); }
      }}
    >
      <button type="button" className="file-select md-state-layer" role="checkbox" aria-checked={props.selected} aria-label={`${lang === 'id' ? 'Pilih' : 'Select'} ${item.name}`} draggable={false}
        onClick={() => props.onToggleSelect()}><Ripple /><IconCheck size={18} /></button>
      <button type="button" className="file-row-open md-state-layer" title={item.name} onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || props.selectionActive) { props.onToggleSelect(); return; }
        if (props.kind === 'folder') props.onOpen(props.folder.id);
        else props.onPreview(props.file);
      }}>
        <Ripple />
        {folder ? <FolderGlyph size={34} /> : <FileGlyph mime={file!.mime_type} name={file!.name} size={34} />}
        <span>{item.name}</span>
      </button>
      <span className="file-row-date">{dateLabel(item.created_at, DATE_LOCALE[lang])}</span>
      <span className="file-row-type">{folder ? t('folder') : fileMeta(file!.mime_type, file!.name).label}</span>
      <span className="file-row-size">{file ? sizeLabel(file.size) : '—'}</span>
      <FileActions name={item.name} downloadUrl={file ? api.downloadUrl(file.id) : undefined}
        onRename={() => props.onRename(item.id)} onMove={() => props.onMove(item.id)} onDelete={() => props.onDelete(item.id)} />
    </div>
  );
}
