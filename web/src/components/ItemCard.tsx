import { useState } from 'react';
import type { FolderItem, FileItem } from '../types.js';
import { api } from '../api/client.js';
import { sizeLabel, isImage, fileMeta } from '../lib/format.js';
import { useT } from '../i18n/lang.js';
import { dnd, type DragItem } from '../lib/dnd.js';
import { FolderGlyph, FileGlyph, fileTone } from './Glyph.js';
import { IconCheck } from './icons.js';
import { FileActions } from './FileActions.js';
import { Ripple } from './material/Ripple.js';

interface SelectProps {
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: () => void;
}
interface FolderProps extends SelectProps {
  kind: 'folder'; folder: FolderItem; index?: number;
  onOpen: (id: number) => void;
  onRename: (id: number) => void;
  onDelete: (id: number) => void;
  onMove: (id: number) => void;
  onMoveByDrag: (src: DragItem, destFolderId: number) => void;
  onUploadToFolder: (files: FileList | File[], folderId: number) => void;
}
interface FileProps extends SelectProps {
  kind: 'file'; file: FileItem; index?: number;
  onPreview: (f: FileItem) => void;
  onRename: (id: number) => void;
  onDelete: (id: number) => void;
  onMove: (id: number) => void;
  onMoveByDrag: (src: DragItem, destFolderId: number) => void;
}
type Props = FolderProps | FileProps;

export function ItemCard(props: Props) {
  const { t, lang } = useT();
  const [over, setOver] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const folder = props.kind === 'folder' ? props.folder : null;
  const file = props.kind === 'file' ? props.file : null;
  const item = folder ?? file!;
  const selectedLabel = `${lang === 'id' ? 'Pilih' : 'Select'} ${item.name}`;
  const canDrop = (event: React.DragEvent) => {
    if (!folder) return false;
    if (event.dataTransfer.types.includes('Files')) return true;
    const source = dnd.get();
    return !!source && !(source.kind === 'folder' && source.id === folder.id);
  };
  const activate = (event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || props.selectionActive) { props.onToggleSelect(); return; }
    if (props.kind === 'folder') props.onOpen(props.folder.id);
    else props.onPreview(props.file);
  };
  return (
    <article
      className={`file-card ${folder ? 'folder-card' : 'document-card'} ${props.selected ? 'is-selected' : ''} ${over ? 'is-drop-target' : ''} ${props.selectionActive ? 'selection-active' : ''}`}
      style={{ animationDelay: `${Math.min((props.index ?? 0) * 24, 240)}ms` }}
      draggable
      onDragStart={(event) => { dnd.set({ kind: props.kind, id: item.id }); event.dataTransfer.setData('text/plain', item.name); event.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={() => { dnd.set(null); setOver(false); }}
      onDragOver={(event) => { if (canDrop(event)) { event.preventDefault(); event.dataTransfer.dropEffect = event.dataTransfer.types.includes('Files') ? 'copy' : 'move'; setOver(true); } }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false); }}
      onDrop={(event) => {
        if (!canDrop(event) || props.kind !== 'folder') return;
        event.preventDefault(); event.stopPropagation(); setOver(false);
        if (event.dataTransfer.files.length) props.onUploadToFolder(event.dataTransfer.files, props.folder.id);
        else { const source = dnd.get(); if (source) props.onMoveByDrag(source, props.folder.id); dnd.set(null); }
      }}
    >
      <button type="button" className="file-select md-state-layer" role="checkbox" aria-checked={props.selected} aria-label={selectedLabel} draggable={false}
        onClick={(event) => { event.stopPropagation(); props.onToggleSelect(); }}><Ripple /><IconCheck size={18} /></button>
      <FileActions name={item.name} downloadUrl={file ? api.downloadUrl(file.id) : undefined}
        onRename={() => props.onRename(item.id)} onMove={() => props.onMove(item.id)} onDelete={() => props.onDelete(item.id)} />
      <button type="button" className="file-card-open md-state-layer" onClick={activate} title={item.name} draggable={false}>
        <Ripple />
        {folder ? (
          <>
            <div className="folder-card-art"><FolderGlyph size={52} /></div>
            <span className="file-card-name">{folder.name}</span>
            <span className="file-card-meta">{t('folder')}</span>
          </>
        ) : (
          <>
            <div className={`file-card-art file-tone-${fileTone(file!.mime_type)} ${isImage(file!.mime_type) && !imageFailed ? 'is-image' : ''}`}>
              {isImage(file!.mime_type) && !imageFailed
                ? <img src={api.previewUrl(file!.id)} alt="" loading="lazy" draggable={false} onError={() => setImageFailed(true)} />
                : <FileGlyph mime={file!.mime_type} name={file!.name} size={74} />}
            </div>
            <span className="file-card-details"><span className="file-card-name">{file!.name}</span><span className="file-card-meta">{fileMeta(file!.mime_type, file!.name).label} <span aria-hidden="true">·</span> {sizeLabel(file!.size)}</span></span>
          </>
        )}
      </button>
    </article>
  );
}
