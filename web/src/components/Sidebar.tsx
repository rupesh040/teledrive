import { useEffect, useRef, useState } from "react";
import type { DriveRoute, FolderItem, Stats } from "../types.js";
import { sizeLabel } from "../lib/format.js";
import { useT } from "../i18n/lang.js";
import { IconTrashBin, IconX } from "./icons.js";
import { AccountMenu } from "./AccountMenu.js";
import { LangToggle } from "./LangToggle.js";
import { Brand, AppIcon } from "./Brand.js";
import { ThemeToggle } from "../theme/ThemeToggle.js";
import { Ripple } from "./material/Ripple.js";
import { InstallApp } from "../pwa/InstallApp.js";

interface Props {
  stats: Stats | null;
  route: DriveRoute;
  current: number | null;
  folders: FolderItem[];
  onRoute: (route: DriveRoute) => void;
  onFolder: (id: number) => void;
  onLoggedOut?: () => void;
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  stats,
  route,
  current,
  folders,
  onRoute,
  onFolder,
  onLoggedOut,
  mobileOpen,
  onClose,
}: Props) {
  const { t, lang } = useT();
  const panel = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(
    () => matchMedia("(max-width: 800px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 800px)");
    const update = () => setIsMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (panel.current) panel.current.inert = isMobile && !mobileOpen;
    if (!isMobile || !mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      previous?.focus();
    };
  }, [isMobile, mobileOpen]);
  const entries = [
    {
      route: "drive" as const,
      label: t("allFiles"),
      icon: <AppIcon name="cloud" />,
    },
    {
      route: "recent" as const,
      label: t("recent"),
      icon: <AppIcon name="clock" />,
    },
    {
      route: "images" as const,
      label: t("images"),
      icon: <AppIcon name="image" />,
    },
    {
      route: "documents" as const,
      label: t("documents"),
      icon: <AppIcon name="document" />,
    },
  ];
  return (
    <>
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label={t("closeNavigation")}
          onClick={onClose}
        />
      )}
      <aside
        ref={panel}
        className={`sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label={t("library")}
        aria-hidden={isMobile && !mobileOpen ? true : undefined}
        onKeyDown={(event) => {
          if (!isMobile || !mobileOpen || event.key !== "Tab") return;
          const nodes = Array.from(
            panel.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),a[href]",
            ) ?? [],
          ).filter((element) => element.getClientRects().length > 0);
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-only"
            onClick={onClose}
            aria-label={t("closeNavigation")}
          >
            <IconX />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label={t("collections")}>
          <p className="nav-label">{t("library")}</p>
          {entries.map((entry) => (
            <button
              key={entry.route}
              className={`nav-item ${route === entry.route && current === null ? "active" : ""}`}
              aria-current={
                route === entry.route && current === null ? "page" : undefined
              }
              onClick={() => onRoute(entry.route)}
            >
              <Ripple />
              {entry.icon}
              <span>{entry.label}</span>
              {entry.route === "drive" && stats && (
                <span className="nav-count">{stats.totalFiles}</span>
              )}
            </button>
          ))}
          <button
            className={`nav-item trash-nav ${route === "trash" ? "active" : ""}`}
            aria-current={route === "trash" ? "page" : undefined}
            onClick={() => onRoute("trash")}
          >
            <Ripple />
            <IconTrashBin size={20} />
            <span>{t("trashNav")}</span>
          </button>
        </nav>
        {folders.length > 0 && (
          <nav className="sidebar-folders" aria-label={t("yourFolders")}>
            <p className="nav-label">{t("yourFolders")}</p>
            {folders.slice(0, 5).map((folder, index) => (
              <button
                className={`nav-item ${current === folder.id && route === "drive" ? "active" : ""}`}
                key={folder.id}
                onClick={() => onFolder(folder.id)}
              >
                <Ripple />
                <span className={`folder-dot dot-${index % 4}`} />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
          </nav>
        )}
        <div className="sidebar-bottom">
          <div className="storage-card">
            <span className="storage-cloud">
              <AppIcon name="cloud" size={22} />
            </span>
            <div>
              <strong>{t("storage")}</strong>
              <p>
                {sizeLabel(stats?.totalBytes ?? 0)} <span>{t("used")}</span>
              </p>
            </div>
            <span className="storage-check">
              <AppIcon name="shield" size={17} />
            </span>
            <p className="storage-note">{t("privateHint")}</p>
          </div>
          <InstallApp sidebar />
          <div className="sidebar-appearance">
            <p className="nav-label">
              {lang === "en" ? "Appearance" : "Tampilan"}
            </p>
            <ThemeToggle showLabels />
          </div>
          <div className="sidebar-preferences">
            <LangToggle />
            <span className="connection-dot" title={t("connected")} />
          </div>
          <AccountMenu onLoggedOut={onLoggedOut} />
        </div>
      </aside>
    </>
  );
}
