import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { FolderItem, FileItem, Stats, SortKey, SortDir, MovingItem, ItemKind } from './types.js';
import { selKey } from './types.js';
import { api } from './api/client.js';
import { useT } from './i18n/lang.js';
import { Sidebar } from './components/Sidebar.js';
import { Topbar } from './components/Topbar.js';
import { Breadcrumb } from './components/Breadcrumb.js';
import { FileView } from './components/FileView.js';
import { SearchResults } from './components/SearchResults.js';
import { TrashView } from './components/TrashView.js';
import { PreviewModal } from './components/PreviewModal.js';
import { MoveModal } from './components/MoveModal.js';
import { UploadQueue, type UploadItem } from './components/UploadQueue.js';
import { IconMove, IconTrash, IconDownload, IconX } from './components/icons.js';

type Route = 'drive' | 'trash';

export function App({ onLoggedOut }: { onLoggedOut?: () => void }) {
  const { t } = useT();
  const [current, setCurrent] = useState<number | null>(null);
  const [trail, setTrail] = useState<FolderItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [preview, setPreview] = useState<FileItem | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [movingItems, setMovingItems] = useState<MovingItem[] | null>(null);
  const [dropping, setDropping] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [route, setRoute] = useState<Route>('drive');
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  // Global search
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [searchFolders, setSearchFolders] = useState<FolderItem[]>([]);
  const [searchFiles, setSearchFiles] = useState<FileItem[]>([]);
  // Trash
  const [trashFolders, setTrashFolders] = useState<FolderItem[]>([]);
  const [trashFiles, setTrashFiles] = useState<FileItem[]>([]);
  const dragDepth = useRef(0);
  const uploadSeq = useRef(0);

  const searching = route === 'drive' && query.trim().length > 0;
  const canUploadHere = route === 'drive' && !searching;

  const load = useCallback(async () => {
    const [fo, fi, st] = await Promise.all([
      api.listFolders(current),
      api.listFiles(current),
      api.stats(),
    ]);
    setFolders(fo);
    setFiles(fi);
    setStats(st);
  }, [current]);

  useEffect(() => { load(); }, [load]);

  // Load trash contents when opening the Trash tab.
  const loadTrash = useCallback(async () => {
    const [fo, fi] = await Promise.all([api.trashFolders(), api.trashFiles()]);
    setTrashFolders(fo);
    setTrashFiles(fi);
  }, []);
  useEffect(() => { if (route === 'trash') loadTrash(); }, [route, loadTrash]);

  // Global search (debounced) as the user types in the search box.
  useEffect(() => {
    if (!searching) { setSearchFolders([]); setSearchFiles([]); return; }
    const q = query.trim();
    let alive = true;
    const handle = setTimeout(() => {
      Promise.all([api.searchFolders(q), api.searchFiles(q), api.listAllFolders()])
        .then(([fo, fi, all]) => { if (alive) { setSearchFolders(fo); setSearchFiles(fi); setAllFolders(all); } })
        .catch(() => {});
    }, 200);
    return () => { alive = false; clearTimeout(handle); };
  }, [searching, query]);

  const dir = sortDir === 'asc' ? 1 : -1;

  // Filter in realtime (query), then sort by the chosen sort option.
  // Folders have no size → when sorting by "size" they are sorted by name.
  const shownFolders = useMemo(() => {
    const q = query.toLowerCase();
    return folders
      .filter((f) => f.name.toLowerCase().includes(q))
      .sort((a, b) =>
        sortKey === 'date'
          ? dir * a.created_at.localeCompare(b.created_at)
          : dir * a.name.localeCompare(b.name)
      );
  }, [folders, query, sortKey, dir]);

  const shownFiles = useMemo(() => {
    const q = query.toLowerCase();
    return files
      .filter((f) => f.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortKey === 'size') return dir * (a.size - b.size);
        if (sortKey === 'date') return dir * a.created_at.localeCompare(b.created_at);
        return dir * a.name.localeCompare(b.name);
      });
  }, [files, query, sortKey, dir]);

  function openFolder(id: number) {
    const f = folders.find((x) => x.id === id);
    if (f) setTrail((t) => [...t, f]);
    setQuery('');
    setSelected(new Set());
    setCurrent(id);
  }

  function navigate(folderId: number | null) {
    if (folderId === null) {
      setTrail([]);
    } else {
      setTrail((t) => {
        const idx = t.findIndex((x) => x.id === folderId);
        return idx >= 0 ? t.slice(0, idx + 1) : t;
      });
    }
    setQuery('');
    setSelected(new Set());
    setCurrent(folderId);
  }

  async function newFolder() {
    const name = prompt(t('promptFolderName'));
    if (!name?.trim()) return;
    await api.createFolder(name.trim(), current);
    load();
  }

  async function renameFolder(id: number) {
    const folder = folders.find((f) => f.id === id);
    const name = prompt(t('promptFolderName'), folder?.name);
    if (!name?.trim() || name.trim() === folder?.name) return;
    await api.renameFolder(id, name.trim());
    load();
  }

  async function renameFile(id: number) {
    const file = files.find((f) => f.id === id);
    if (!file) return;
    const input = prompt(t('promptRenameFile'), file.name);
    let name = input?.trim();
    if (!name || name === file.name) return;
    // Keep the original extension if the user didn't type any extension
    // (e.g. typing "foto" for "foto.png" → stays "foto.png").
    const dot = file.name.lastIndexOf('.');
    const ext = dot > 0 ? file.name.slice(dot) : '';
    if (ext && !name.includes('.')) name += ext;
    await api.renameFile(id, name);
    load();
  }

  async function deleteFolder(id: number) {
    if (!confirm(t('confirmDeleteFolder'))) return;
    await api.deleteFolder(id);
    load();
  }

  async function deleteFile(id: number) {
    if (!confirm(t('confirmDeleteFile'))) return;
    await api.deleteFile(id);
    load();
  }

  function moveFolder(id: number) {
    const f = folders.find((x) => x.id === id);
    if (f) setMovingItems([{ kind: 'folder', id, name: f.name }]);
  }

  function moveFile(id: number) {
    const f = files.find((x) => x.id === id);
    if (f) setMovingItems([{ kind: 'file', id, name: f.name }]);
  }

  // --- Multi-item selection ---
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const toggleSelect = useCallback((kind: ItemKind, id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = selKey(kind, id);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }, []);

  const shownKeys = useMemo(
    () => [
      ...shownFolders.map((f) => selKey('folder', f.id)),
      ...shownFiles.map((f) => selKey('file', f.id)),
    ],
    [shownFolders, shownFiles]
  );
  const allSelected = shownKeys.length > 0 && shownKeys.every((k) => selected.has(k));

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(shownKeys));
  }

  function selectedAsItems(): MovingItem[] {
    const out: MovingItem[] = [];
    folders.forEach((f) => { if (selected.has(selKey('folder', f.id))) out.push({ kind: 'folder', id: f.id, name: f.name }); });
    files.forEach((f) => { if (selected.has(selKey('file', f.id))) out.push({ kind: 'file', id: f.id, name: f.name }); });
    return out;
  }

  async function bulkDelete() {
    if (!confirm(t('confirmDeleteMany'))) return;
    for (const it of selectedAsItems()) {
      if (it.kind === 'folder') await api.deleteFolder(it.id);
      else await api.deleteFile(it.id);
    }
    clearSelection();
    load();
  }

  function bulkMove() {
    const items = selectedAsItems();
    if (items.length) setMovingItems(items);
  }

  function bulkDownload() {
    const ids = files.filter((f) => selected.has(selKey('file', f.id))).map((f) => f.id);
    if (ids.length === 0) return;
    // >1 file → a single .zip archive; 1 file → download it directly as-is.
    const a = document.createElement('a');
    a.href = ids.length === 1 ? api.downloadUrl(ids[0]) : api.downloadZipUrl(ids);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Quick move via drag-and-drop: drop a file/folder onto a folder.
  async function moveByDrag(src: { kind: 'file' | 'folder'; id: number }, destFolderId: number) {
    if (src.kind === 'folder') {
      if (src.id === destFolderId) return;
      await api.moveFolder(src.id, destFolderId);
    } else {
      await api.moveFile(src.id, destFolderId);
    }
    load();
  }

  // Upload files from the computer to a destination folder (null = current
  // folder), with a queue + per-file progress.
  async function uploadFiles(list: FileList | File[], folderId: number | null) {
    const arr = Array.from(list);
    if (arr.length === 0) return;
    const entries = arr.map((file) => ({ qid: ++uploadSeq.current, file }));
    setUploadQueue((q) => [
      ...q,
      ...entries.map((e) => ({ id: e.qid, name: e.file.name, progress: 0, status: 'uploading' as const })),
    ]);
    for (const e of entries) {
      try {
        await api.uploadFile(e.file, folderId, (pct) =>
          setUploadQueue((q) => q.map((it) => (it.id === e.qid ? { ...it, progress: pct } : it)))
        );
        setUploadQueue((q) => q.map((it) => (it.id === e.qid ? { ...it, progress: 100, status: 'done' } : it)));
      } catch {
        setUploadQueue((q) => q.map((it) => (it.id === e.qid ? { ...it, status: 'error' } : it)));
      }
    }
    await load();
  }

  // Open a folder from search results: build the trail from its ancestors.
  function goToFolder(id: number) {
    const byId = new Map(allFolders.map((f) => [f.id, f]));
    const trailArr: FolderItem[] = [];
    let cur = byId.get(id);
    let guard = 0;
    while (cur && guard++ < 50) {
      trailArr.unshift(cur);
      cur = cur.parent_id == null ? undefined : byId.get(cur.parent_id);
    }
    setTrail(trailArr);
    setQuery('');
    setSelected(new Set());
    setRoute('drive');
    setCurrent(id);
  }

  // --- Trash actions ---
  async function restoreFolderTrash(id: number) { await api.restoreFolder(id); loadTrash(); load(); }
  async function restoreFileTrash(id: number) { await api.restoreFile(id); loadTrash(); load(); }
  async function purgeFolder(id: number) {
    if (!confirm(t('confirmPurge'))) return;
    await api.deleteFolderPermanent(id); loadTrash(); load();
  }
  async function purgeFile(id: number) {
    if (!confirm(t('confirmPurge'))) return;
    await api.deleteFilePermanent(id); loadTrash(); load();
  }

  // Detect files dragged from the OS (not an internal item drag).
  const hasOsFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

  return (
    <div className="flex h-screen">
      <Sidebar
        stats={stats}
        route={route}
        onHome={() => { setRoute('drive'); navigate(null); }}
        onTrash={() => { setRoute('trash'); setQuery(''); setSelected(new Set()); }}
        onLoggedOut={onLoggedOut}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-line flex flex-col gap-4">
          <Topbar
            query={query}
            onQuery={setQuery}
            view={view}
            onView={setView}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKey={setSortKey}
            onToggleSortDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            folderId={current}
            onNewFolder={newFolder}
            onUploaded={load}
          />
          {route === 'trash' ? (
            <h2 className="font-display text-lg text-content">{t('trashTitle')}</h2>
          ) : searching ? (
            <h2 className="font-display text-lg text-content">{t('searchResults')}</h2>
          ) : selected.size > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-content">
                {selected.size} {t('selectedSuffix')}
              </span>
              <button
                onClick={toggleSelectAll}
                className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-content hover:bg-panel-hi border border-line transition"
              >
                {allSelected ? t('deselectAll') : t('selectAll')}
              </button>
              <div className="flex-1" />
              <button onClick={bulkDownload} title={t('download')} className="h-9 px-3 rounded-lg bg-panel/70 border border-line text-content hover:text-accent hover:border-line-hi transition flex items-center gap-2">
                <IconDownload size={17} /><span className="hidden sm:inline">{t('download')}</span>
              </button>
              <button onClick={bulkMove} title={t('move')} className="h-9 px-3 rounded-lg bg-panel/70 border border-line text-content hover:text-accent hover:border-line-hi transition flex items-center gap-2">
                <IconMove size={17} /><span className="hidden sm:inline">{t('move')}</span>
              </button>
              <button onClick={bulkDelete} title={t('delete')} className="h-9 px-3 rounded-lg bg-panel/70 border border-line text-content hover:text-[#e0584c] hover:border-[#e0584c]/50 transition flex items-center gap-2">
                <IconTrash size={17} /><span className="hidden sm:inline">{t('delete')}</span>
              </button>
              <button onClick={clearSelection} title={t('clearSelection')} className="grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-content hover:bg-panel-hi border border-line transition">
                <IconX size={17} />
              </button>
            </div>
          ) : (
            <Breadcrumb trail={trail} onNavigate={navigate} />
          )}
        </div>

        <div
          className="flex-1 overflow-y-auto px-6 py-5 relative"
          onDragEnter={(e) => { if (canUploadHere && hasOsFiles(e)) { e.preventDefault(); dragDepth.current++; setDropping(true); } }}
          onDragOver={(e) => { if (canUploadHere && hasOsFiles(e)) e.preventDefault(); }}
          onDragLeave={(e) => { if (canUploadHere && hasOsFiles(e)) { dragDepth.current--; if (dragDepth.current <= 0) setDropping(false); } }}
          onDrop={(e) => {
            if (!canUploadHere || !e.dataTransfer.files.length) return;
            e.preventDefault();
            dragDepth.current = 0;
            setDropping(false);
            uploadFiles(e.dataTransfer.files, current);
          }}
        >
          {route === 'trash' ? (
            <TrashView
              folders={trashFolders}
              files={trashFiles}
              onRestoreFolder={restoreFolderTrash}
              onRestoreFile={restoreFileTrash}
              onPurgeFolder={purgeFolder}
              onPurgeFile={purgeFile}
            />
          ) : searching ? (
            <SearchResults
              folders={searchFolders}
              files={searchFiles}
              allFolders={allFolders}
              onOpenFolder={goToFolder}
              onPreview={setPreview}
            />
          ) : (
            <FileView
              view={view}
              folders={shownFolders}
              files={shownFiles}
              onOpenFolder={openFolder}
              onPreview={setPreview}
              onRenameFolder={renameFolder}
              onRenameFile={renameFile}
              onDeleteFolder={deleteFolder}
              onDeleteFile={deleteFile}
              onMoveFolder={moveFolder}
              onMoveFile={moveFile}
              onMoveByDrag={moveByDrag}
              onUploadToFolder={uploadFiles}
              selected={selected}
              onToggleSelect={toggleSelect}
            />
          )}

          {dropping && canUploadHere && (
            <div className="pointer-events-none absolute inset-3 z-30 rounded-2xl border-2 border-dashed border-accent bg-ink/70 backdrop-blur-sm grid place-items-center">
              <p className="font-display text-xl text-accent">{t('dropToUpload')}</p>
            </div>
          )}
        </div>
      </main>

      <PreviewModal file={preview} onClose={() => setPreview(null)} />
      <UploadQueue items={uploadQueue} onClose={() => setUploadQueue([])} />
      {movingItems && (
        <MoveModal
          items={movingItems}
          onClose={() => setMovingItems(null)}
          onDone={() => { setMovingItems(null); clearSelection(); load(); }}
        />
      )}
    </div>
  );
}
