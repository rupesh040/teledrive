import { useRef, useState } from "react";
import type { SortKey, SortDir } from "../types.js";
import { useT } from "../i18n/lang.js";
import {
  IconSearch,
  IconGrid,
  IconList,
  IconArrowUp,
  IconArrowDown,
  IconX,
} from "./icons.js";
import { AppIcon } from "./Brand.js";
import { ThemeToggle } from "../theme/ThemeToggle.js";
import { Ripple } from "./material/Ripple.js";

interface Props {
  query: string;
  onQuery: (q: string) => void;
  view: "grid" | "list";
  onView: (v: "grid" | "list") => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSortKey: (k: SortKey) => void;
  onToggleSortDir: () => void;
  onMenu: () => void;
  onRefresh: () => void;
  title: string;
  refreshing: boolean;
  browseControls: boolean;
}
export function Topbar({
  query,
  onQuery,
  view,
  onView,
  sortKey,
  sortDir,
  onSortKey,
  onToggleSortDir,
  onMenu,
  onRefresh,
  title,
  refreshing,
  browseControls,
}: Props) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  return (
    <header className="topbar">
      <div className="topbar-location">
        <button
          className="icon-button mobile-only"
          onClick={onMenu}
          aria-label={t("openNavigation")}
        >
          <Ripple />
          <AppIcon name="menu" />
        </button>
        <AppIcon name="cloud" size={19} />
        <span>{title}</span>
      </div>
      <div className="topbar-search-row">
        <div className={`search-field ${focused ? "is-focused" : ""}`}>
          <IconSearch size={18} />
          <input
            ref={input}
            type="search"
            aria-label={t("searchPlaceholder")}
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {query ? (
            <button
              onClick={() => {
                onQuery("");
                input.current?.focus();
              }}
              aria-label={t("clearSearch")}
            >
              <Ripple />
              <IconX size={15} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </div>
        {browseControls && (
          <div className="view-switch" role="group" aria-label={t("viewGrid")}>
            <button type="button" onClick={() => onView("grid")} className={view === "grid" ? "active" : ""}
              aria-pressed={view === "grid"} aria-label={t("viewGrid")} title={t("viewGrid")}><Ripple /><IconGrid size={20} /></button>
            <button type="button" onClick={() => onView("list")} className={view === "list" ? "active" : ""}
              aria-pressed={view === "list"} aria-label={t("viewList")} title={t("viewList")}><Ripple /><IconList size={20} /></button>
          </div>
        )}
      </div>
      <div className="topbar-tools">
        <ThemeToggle compact />
        <button
          className={`icon-button refresh-button ${refreshing ? "is-refreshing" : ""}`}
          onClick={onRefresh}
          aria-label={t("refresh")}
          title={t("refresh")}
          disabled={refreshing}
        >
          <Ripple />
          <AppIcon name="refresh" size={18} />
        </button>
        {browseControls && (
          <div className="sort-control">
            <select
              value={sortKey}
              onChange={(e) => onSortKey(e.target.value as SortKey)}
              aria-label={t("sortBy")}
            >
              <option value="name">{t("sortName")}</option>
              <option value="date">{t("sortDate")}</option>
              <option value="size">{t("sortSize")}</option>
            </select>
            <button
              onClick={onToggleSortDir}
              aria-label={sortDir === "asc" ? t("sortAsc") : t("sortDesc")}
              title={sortDir === "asc" ? t("sortAsc") : t("sortDesc")}
            >
              {sortDir === "asc" ? (
                <IconArrowUp size={14} />
              ) : (
                <IconArrowDown size={14} />
              )}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
