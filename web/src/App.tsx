import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type {
  FolderItem,
  FileItem,
  Stats,
  SortKey,
  SortDir,
  MovingItem,
  ItemKind,
  DriveRoute,
} from "./types.js";
import { selKey } from "./types.js";
import { api } from "./api/client.js";
import { useT } from "./i18n/lang.js";
import { sizeLabel } from "./lib/format.js";
import { Sidebar } from "./components/Sidebar.js";
import { Topbar } from "./components/Topbar.js";
import { Breadcrumb } from "./components/Breadcrumb.js";
import { FileView } from "./components/FileView.js";
import { TrashView } from "./components/TrashView.js";
import { PreviewModal } from "./components/PreviewModal.js";
import { MoveModal } from "./components/MoveModal.js";
import { UploadQueue, type UploadItem } from "./components/UploadQueue.js";
import { UploadButton } from "./components/UploadButton.js";
import { MaterialButton } from "./components/material/MaterialButton.js";
import { WavyProgress } from "./components/material/WavyProgress.js";
import { Ripple } from "./components/material/Ripple.js";
import { ActionDialog, type DialogRequest } from "./components/ActionDialog.js";
import { AppIcon } from "./components/Brand.js";
import {
  IconMove,
  IconTrash,
  IconDownload,
  IconX,
  IconFolderPlus,
  IconCheck,
  IconArrowUp,
  IconArrowDown,
} from "./components/icons.js";

function savedView(): "grid" | "list" {
  try {
    return localStorage.getItem("td-view") === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export function App({ onLoggedOut }: { onLoggedOut?: () => void }) {
  const { t } = useT();
  const [current, setCurrent] = useState<number | null>(null);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [preview, setPreview] = useState<FileItem | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">(savedView);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState<"all" | "folder" | "file">("all");
  const [movingItems, setMovingItems] = useState<MovingItem[] | null>(null);
  const [dropping, setDropping] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [route, setRoute] = useState<DriveRoute>("drive");
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [trashFolders, setTrashFolders] = useState<FolderItem[]>([]);
  const [trashFiles, setTrashFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const dialogResolver = useRef<((value: string | null) => void) | null>(null);
  const dragDepth = useRef(0);
  const uploadSeq = useRef(0);
  const uploadJobs = useRef<
    { qid: number; file: File; folderId: number | null }[]
  >([]);
  const uploadRunning = useRef(false);
  const mounted = useRef(true);
  const loadVersion = useRef(0);
  const searching = query.trim().length > 0;
  const canUploadHere = route !== "trash" && !searching;
  const destination = route === "drive" ? current : null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      uploadJobs.current = [];
      dialogResolver.current?.(null);
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("td-view", view);
    } catch {
      /* Preference is optional. */
    }
  }, [view]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (
        event.key === "/" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !dialog &&
        !preview &&
        !movingItems
      ) {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>(".search-field input")
          ?.focus();
      }
      if (event.key === "Escape") {
        setMobileOpen(false);
        setSelected(new Set());
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [dialog, preview, movingItems]);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const [folders, files, totals, trashFo, trashFi] = await Promise.all([
        api.listAllFolders(),
        api.listAllFiles(),
        api.stats(),
        api.trashFolders(),
        api.trashFiles(),
      ]);
      if (!mounted.current || version !== loadVersion.current) return;
      setAllFolders(folders);
      setAllFiles(files);
      setStats(totals);
      setTrashFolders(trashFo);
      setTrashFiles(trashFi);
      setError(null);
      setCurrent((id) =>
        id !== null && !folders.some((folder) => folder.id === id) ? null : id,
      );
    } catch {
      if (mounted.current && version === loadVersion.current)
        setError(t("loadError"));
    } finally {
      if (mounted.current && version === loadVersion.current) setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);

  const perform = useCallback(
    async (action: () => Promise<unknown>) => {
      setError(null);
      try {
        await action();
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("actionError"));
      }
    },
    [load, t],
  );
  function ask(request: DialogRequest): Promise<string | null> {
    dialogResolver.current?.(null);
    setDialog(request);
    return new Promise((resolve) => {
      dialogResolver.current = resolve;
    });
  }
  function resolveDialog(value: string | null) {
    dialogResolver.current?.(value);
    dialogResolver.current = null;
    setDialog(null);
  }

  const trail = useMemo(() => {
    const list: FolderItem[] = [];
    const seen = new Set<number>();
    let folder = allFolders.find((item) => item.id === current);
    while (folder && !seen.has(folder.id)) {
      seen.add(folder.id);
      list.unshift(folder);
      const parent = folder.parent_id;
      folder = allFolders.find((item) => item.id === parent);
    }
    return list;
  }, [current, allFolders]);
  const shownFolders = useMemo(() => {
    if (route !== "drive" || filter === "file") return [];
    const q = query.trim().toLocaleLowerCase();
    const dir = sortDir === "asc" ? 1 : -1;
    return allFolders
      .filter((f) =>
        searching
          ? f.name.toLocaleLowerCase().includes(q)
          : f.parent_id === current,
      )
      .sort(
        (a, b) =>
          dir *
          (sortKey === "date"
            ? a.created_at.localeCompare(b.created_at)
            : a.name.localeCompare(b.name)),
      );
  }, [allFolders, current, query, searching, sortKey, sortDir, route, filter]);
  const shownFiles = useMemo(() => {
    if (filter === "folder") return [];
    const q = query.trim().toLocaleLowerCase();
    const dir = sortDir === "asc" ? 1 : -1;
    return allFiles
      .filter((file) => {
        if (route === "drive" && !searching && file.folder_id !== current)
          return false;
        if (route === "images" && !file.mime_type.startsWith("image/"))
          return false;
        if (
          route === "documents" &&
          !/^(text\/)|pdf|document|sheet|presentation|word|excel|powerpoint|json|xml/.test(
            file.mime_type,
          )
        )
          return false;
        return file.name.toLocaleLowerCase().includes(q);
      })
      .sort((a, b) =>
        sortKey === "size"
          ? dir * (a.size - b.size)
          : sortKey === "date"
            ? dir * a.created_at.localeCompare(b.created_at)
            : dir * a.name.localeCompare(b.name),
      );
  }, [allFiles, current, query, searching, sortKey, sortDir, route, filter]);
  const shownKeys = useMemo(
    () => [
      ...shownFolders.map((f) => selKey("folder", f.id)),
      ...shownFiles.map((f) => selKey("file", f.id)),
    ],
    [shownFolders, shownFiles],
  );
  const allSelected =
    shownKeys.length > 0 && shownKeys.every((key) => selected.has(key));
  useEffect(() => {
    setSelected((previous) => {
      const allowed = new Set(shownKeys);
      const next = new Set([...previous].filter((key) => allowed.has(key)));
      return next.size === previous.size ? previous : next;
    });
  }, [shownKeys]);
  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const toggleSelect = useCallback((kind: ItemKind, id: number) => {
    setSelected((previous) => {
      const next = new Set(previous);
      const key = selKey(kind, id);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);
  function selectedAsItems(): MovingItem[] {
    // A selected folder already carries its descendants. Avoid moving them
    // twice or issuing a second delete after a recursive folder deletion.
    const selectedFolders = new Set(
      allFolders
        .filter((folder) => selected.has(selKey("folder", folder.id)))
        .map((folder) => folder.id),
    );
    const parents = new Map(
      allFolders.map((folder) => [folder.id, folder.parent_id]),
    );
    function coveredByFolder(folderId: number | null) {
      const seen = new Set<number>();
      while (folderId !== null && !seen.has(folderId)) {
        if (selectedFolders.has(folderId)) return true;
        seen.add(folderId);
        folderId = parents.get(folderId) ?? null;
      }
      return false;
    }
    return [
      ...allFolders
        .filter(
          (f) =>
            selected.has(selKey("folder", f.id)) &&
            !coveredByFolder(f.parent_id),
        )
        .map((f) => ({ kind: "folder" as const, id: f.id, name: f.name })),
      ...allFiles
        .filter(
          (f) =>
            selected.has(selKey("file", f.id)) && !coveredByFolder(f.folder_id),
        )
        .map((f) => ({ kind: "file" as const, id: f.id, name: f.name })),
    ];
  }
  function navigate(id: number | null) {
    setCurrent(id);
    setRoute("drive");
    setQuery("");
    setFilter("all");
    clearSelection();
    setMobileOpen(false);
  }
  function changeRoute(next: DriveRoute) {
    setRoute(next);
    setCurrent(null);
    setQuery("");
    setFilter("all");
    clearSelection();
    setMobileOpen(false);
    if (next === "recent") {
      setSortKey("date");
      setSortDir("desc");
    } else {
      setSortKey("name");
      setSortDir("asc");
    }
  }
  async function newFolder() {
    const name = await ask({
      title: t("newFolder"),
      label: t("folderName"),
      confirm: t("create"),
    });
    if (name)
      await perform(async () => {
        await api.createFolder(name, destination);
        if (route !== "drive") navigate(null);
      });
  }
  async function rename(kind: ItemKind, id: number) {
    const item =
      kind === "folder"
        ? allFolders.find((f) => f.id === id)
        : allFiles.find((f) => f.id === id);
    if (!item) return;
    let name = await ask({
      title: t("renameTitle"),
      label: kind === "folder" ? t("folderName") : t("fileName"),
      initial: item.name,
      confirm: t("save"),
    });
    if (!name || name === item.name) return;
    if (kind === "file") {
      const dot = item.name.lastIndexOf(".");
      if (dot > 0 && !name.includes(".")) name += item.name.slice(dot);
    }
    await perform(() =>
      kind === "folder"
        ? api.renameFolder(id, name!)
        : api.renameFile(id, name!),
    );
  }
  async function deleteItems(items: MovingItem[]) {
    if (!items.length) return;
    const result = await ask({
      title: t("deleteTitle"),
      description: items.length > 1 ? t("confirmDeleteMany") : items[0].name,
      confirm: t("delete"),
      danger: true,
    });
    if (result)
      await perform(async () => {
        for (const item of items)
          await (item.kind === "folder"
            ? api.deleteFolder(item.id)
            : api.deleteFile(item.id));
        clearSelection();
      });
  }
  function deleteOne(kind: ItemKind, id: number) {
    const item = (kind === "folder" ? allFolders : allFiles).find(
      (f) => f.id === id,
    );
    if (item) void deleteItems([{ kind, id, name: item.name }]);
  }
  function moveOne(kind: ItemKind, id: number) {
    const item = (kind === "folder" ? allFolders : allFiles).find(
      (f) => f.id === id,
    );
    if (item) setMovingItems([{ kind, id, name: item.name }]);
  }
  function bulkDownload() {
    const ids = allFiles
      .filter((f) => selected.has(selKey("file", f.id)))
      .map((f) => f.id);
    if (!ids.length) return;
    const link = document.createElement("a");
    link.href =
      ids.length === 1 ? api.downloadUrl(ids[0]) : api.downloadZipUrl(ids);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  async function moveByDrag(
    source: { kind: ItemKind; id: number },
    folderId: number,
  ) {
    if (source.kind === "folder" && source.id === folderId) return;
    await perform(() =>
      source.kind === "folder"
        ? api.moveFolder(source.id, folderId)
        : api.moveFile(source.id, folderId),
    );
  }
  async function uploadFiles(list: FileList | File[], folderId: number | null) {
    dragDepth.current = 0;
    setDropping(false);
    const jobs = Array.from(list).map((file) => ({
      qid: ++uploadSeq.current,
      file,
      folderId,
    }));
    uploadJobs.current.push(...jobs);
    setUploadQueue((queue) => [
      ...queue,
      ...jobs.map((job) => ({
        id: job.qid,
        name: job.file.name,
        progress: 0,
        status: "uploading" as const,
      })),
    ]);
    if (uploadRunning.current) return;
    uploadRunning.current = true;
    try {
      while (mounted.current && uploadJobs.current.length) {
        const job = uploadJobs.current.shift()!;
        try {
          await api.uploadFile(job.file, job.folderId, (progress) => {
            if (mounted.current)
              setUploadQueue((queue) =>
                queue.map((item) =>
                  item.id === job.qid ? { ...item, progress } : item,
                ),
              );
          });
          if (mounted.current)
            setUploadQueue((queue) =>
              queue.map((item) =>
                item.id === job.qid
                  ? { ...item, progress: 100, status: "done" }
                  : item,
              ),
            );
        } catch {
          if (mounted.current)
            setUploadQueue((queue) =>
              queue.map((item) =>
                item.id === job.qid ? { ...item, status: "error" } : item,
              ),
            );
        }
      }
    } finally {
      uploadRunning.current = false;
      if (mounted.current) await load();
    }
  }
  async function purge(kind: ItemKind, id: number) {
    const result = await ask({
      title: t("deleteForever"),
      description: t("confirmPurge"),
      confirm: t("deleteForever"),
      danger: true,
    });
    if (result)
      await perform(() =>
        kind === "folder"
          ? api.deleteFolderPermanent(id)
          : api.deleteFilePermanent(id),
      );
  }
  const title = searching
    ? t("searchResults")
    : route === "trash"
      ? t("trashTitle")
      : route === "recent"
        ? t("recent")
        : route === "images"
          ? t("images")
          : route === "documents"
            ? t("documents")
            : (trail.at(-1)?.name ?? t("myDrive"));
  const subtitle = searching
    ? `“${query.trim()}”`
    : route === "trash"
      ? t("trashHint")
      : route === "recent"
        ? t("recentHint")
        : route === "images"
          ? t("imagesHint")
          : route === "documents"
            ? t("documentsHint")
            : t("driveHint");
  const visibleTrashFolders = trashFolders.filter((folder) =>
    folder.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const visibleTrashFiles = trashFiles.filter((file) =>
    file.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const count =
    route === "trash"
      ? visibleTrashFolders.length + visibleTrashFiles.length
      : shownKeys.length;
  const hasOsFiles = (event: React.DragEvent) =>
    event.dataTransfer.types.includes("Files");

  return (
    <div className="app-shell">
      <Sidebar
        stats={stats}
        route={route}
        current={current}
        folders={allFolders.filter((f) => f.parent_id === null)}
        onRoute={changeRoute}
        onFolder={navigate}
        onLoggedOut={onLoggedOut}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <main className="main-pane">
        <Topbar
          title={route === "drive" ? t("myDrive") : title}
          query={query}
          onQuery={setQuery}
          view={view}
          onView={setView}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortKey={setSortKey}
          onToggleSortDir={() =>
            setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
          }
          onMenu={() => setMobileOpen(true)}
          onRefresh={() => void load()}
          refreshing={loading}
          browseControls={route !== "trash"}
        />
        <div
          className="drive-content"
          onDragEnter={(event) => {
            if (canUploadHere && hasOsFiles(event)) {
              event.preventDefault();
              dragDepth.current++;
              setDropping(true);
            }
          }}
          onDragOver={(event) => {
            if (canUploadHere && hasOsFiles(event)) event.preventDefault();
          }}
          onDragLeave={(event) => {
            if (hasOsFiles(event)) {
              dragDepth.current--;
              if (dragDepth.current <= 0) setDropping(false);
            }
          }}
          onDrop={(event) => {
            if (!canUploadHere || !event.dataTransfer.files.length) return;
            event.preventDefault();
            dragDepth.current = 0;
            setDropping(false);
            void uploadFiles(event.dataTransfer.files, destination);
          }}
        >
          <div className="drive-progress-slot"><WavyProgress active={loading} label={t('loading')} /></div>
          <div
            className="content-inner"
            key={`${route}:${current}:${searching ? "search" : "browse"}`}
          >
            {route === "drive" && !current && !searching && (
              <section
                className="cloud-overview"
                aria-label={t("personalCloud")}
              >
                <div className="overview-copy">
                  <span className="eyebrow">{t("personalCloud")}</span>
                  <h2>{t("spaceTitle")}</h2>
                  <p>{t("spaceHint")}</p>
                </div>
                <div className="overview-stats">
                  <div>
                    <span className="overview-icon">
                      <AppIcon name="document" size={19} />
                    </span>
                    <strong>{stats?.totalFiles ?? "—"}</strong>
                    <small>{t("storedFiles")}</small>
                  </div>
                  <div>
                    <span className="overview-icon purple">
                      <AppIcon name="cloud" size={20} />
                    </span>
                    <strong>{stats ? sizeLabel(stats.totalBytes) : "—"}</strong>
                    <small>{t("storageUsed")}</small>
                  </div>
                  <div className="privacy-stat">
                    <span className="overview-icon green">
                      <AppIcon name="shield" size={20} />
                    </span>
                    <strong>{t("privateStorage")}</strong>
                    <small>{t("privateHint")}</small>
                  </div>
                </div>
              </section>
            )}
            {current !== null && route === "drive" && !searching && (
              <div className="breadcrumb-bar">
                <Breadcrumb trail={trail} onNavigate={navigate} />
              </div>
            )}
            <div className="page-heading">
              <div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
              </div>
              {route !== "trash" && (
                <div className="page-actions">
                  <MaterialButton
                    variant="outlined"
                    icon={<IconFolderPlus size={18} />}
                    onClick={() => void newFolder()}
                    disabled={!canUploadHere}
                  >
                    <span>{t("newFolder")}</span>
                  </MaterialButton>
                  <UploadButton
                    onFiles={(files) => void uploadFiles(files, destination)}
                    disabled={!canUploadHere}
                  />
                </div>
              )}
            </div>
            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button onClick={() => void load()}>{t("retry")}</button>
                <button
                  aria-label={t("clearSelection")}
                  onClick={() => setError(null)}
                >
                  <IconX size={16} />
                </button>
              </div>
            )}
            {route !== "trash" && (
              <div className="content-toolbar">
                {selected.size ? (
                  <div className="selection-toolbar">
                    <button
                      className="selection-count"
                      onClick={() =>
                        setSelected(
                          allSelected ? new Set() : new Set(shownKeys),
                        )
                      }
                    >
                      <IconCheck size={14} />
                      {selected.size} {t("selectedSuffix")}
                    </button>
                    <div className="selection-actions">
                      <button
                        className="icon-button"
                        onClick={bulkDownload}
                        disabled={
                          !allFiles.some((f) =>
                            selected.has(selKey("file", f.id)),
                          )
                        }
                        aria-label={t("download")}
                        title={t("download")}
                      >
                        <IconDownload size={18} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => setMovingItems(selectedAsItems())}
                        aria-label={t("move")}
                        title={t("move")}
                      >
                        <IconMove size={18} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => void deleteItems(selectedAsItems())}
                        aria-label={t("delete")}
                        title={t("delete")}
                      >
                        <IconTrash size={18} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={clearSelection}
                        aria-label={t("clearSelection")}
                      >
                        <IconX size={17} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className="filter-tabs"
                      role="group"
                      aria-label={t("allTypes")}
                    >
                      {(["all", "folder", "file"] as const).map((type) => (
                        <button
                          key={type}
                          className={filter === type ? "active" : ""}
                          aria-pressed={filter === type}
                          onClick={() => setFilter(type)}
                          disabled={type === "folder" && route !== "drive"}
                        >
                          <Ripple />
                          {t(
                            type === "all"
                              ? "allTypes"
                              : type === "folder"
                                ? "foldersOnly"
                                : "filesOnly",
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="mobile-sort">
                      <select
                        value={sortKey}
                        onChange={(event) =>
                          setSortKey(event.target.value as SortKey)
                        }
                        aria-label={t("sortBy")}
                      >
                        <option value="name">{t("sortName")}</option>
                        <option value="date">{t("sortDate")}</option>
                        <option value="size">{t("sortSize")}</option>
                      </select>
                      <button
                        aria-label={
                          sortDir === "asc" ? t("sortAsc") : t("sortDesc")
                        }
                        onClick={() =>
                          setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
                        }
                      >
                        {sortDir === "asc" ? (
                          <IconArrowUp size={13} />
                        ) : (
                          <IconArrowDown size={13} />
                        )}
                      </button>
                    </div>
                    <span className="item-count">
                      {count} {t(count === 1 ? "item" : "items")}
                    </span>
                    {count > 0 && (
                      <button
                        className="icon-button select-items"
                        aria-label={t("selectAll")}
                        title={t("selectAll")}
                        onClick={() => setSelected(new Set(shownKeys))}
                      >
                        <IconCheck size={17} />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {loading && !stats ? (
              <div
                className="loading-grid"
                role="status"
                aria-label={t("loading")}
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <div key={i} />
                ))}
              </div>
            ) : route === "trash" && !(searching && count === 0) ? (
              <TrashView
                folders={visibleTrashFolders}
                files={visibleTrashFiles}
                onRestoreFolder={(id) => perform(() => api.restoreFolder(id))}
                onRestoreFile={(id) => perform(() => api.restoreFile(id))}
                onPurgeFolder={(id) => purge("folder", id)}
                onPurgeFile={(id) => purge("file", id)}
              />
            ) : count === 0 && (searching || filter !== "all") ? (
              <div className="no-matches">
                <AppIcon name="document" size={38} />
                <h2>{t("noResults")}</h2>
                <p>{t("noMatches")}</p>
                <MaterialButton
                  variant="outlined"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  {t("clearSearch")}
                </MaterialButton>
              </div>
            ) : (
              <FileView
                key={`${route}:${current}:${view}`}
                view={view}
                folders={shownFolders}
                files={shownFiles}
                onOpenFolder={navigate}
                onPreview={setPreview}
                onRenameFolder={(id) => void rename("folder", id)}
                onRenameFile={(id) => void rename("file", id)}
                onDeleteFolder={(id) => deleteOne("folder", id)}
                onDeleteFile={(id) => deleteOne("file", id)}
                onMoveFolder={(id) => moveOne("folder", id)}
                onMoveFile={(id) => moveOne("file", id)}
                onMoveByDrag={moveByDrag}
                onUploadToFolder={uploadFiles}
                selected={selected}
                onToggleSelect={toggleSelect}
              />
            )}
            {route !== "trash" &&
              count === 0 &&
              !searching &&
              filter === "all" &&
              !loading && (
                <div className="empty-upload">
                  <UploadButton
                    onFiles={(files) => void uploadFiles(files, destination)}
                  />
                </div>
              )}
          </div>
          {dropping && (
            <div className="drop-overlay">
              <div>
                <AppIcon name="cloud" size={48} />
                <h2>{t("dropToUpload")}</h2>
                <p>{t("privateHint")}</p>
              </div>
            </div>
          )}
        </div>
        <footer className="drive-footer">
          <span>
            <span className="connection-dot" />
            {t("connected")}
          </span>
          <span>
            {canUploadHere && (
              <>
                {t("uploadedHint")}
                <span className="footer-separator">·</span>
              </>
            )}
            <AppIcon name="shield" size={13} />
            {t("privateStorage")}
          </span>
        </footer>
      </main>
      <PreviewModal file={preview} onClose={() => setPreview(null)} />
      <UploadQueue
        items={uploadQueue}
        onClose={() =>
          setUploadQueue((queue) =>
            queue.filter((item) => item.status === "uploading"),
          )
        }
      />
      {movingItems && (
        <MoveModal
          items={movingItems}
          onClose={() => setMovingItems(null)}
          onDone={() => {
            setMovingItems(null);
            clearSelection();
            void load();
          }}
        />
      )}
      {dialog && <ActionDialog request={dialog} onResolve={resolveDialog} />}
    </div>
  );
}
