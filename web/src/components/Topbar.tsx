import type { SortKey, SortDir } from '../types.js';
import { UploadButton } from './UploadButton.js';
import { useT } from '../i18n/lang.js';
import { IconSearch, IconGrid, IconList, IconArrowUp, IconArrowDown, IconFolderPlus } from './icons.js';

interface Props {
  query: string;
  onQuery: (q: string) => void;
  view: 'grid' | 'list';
  onView: (v: 'grid' | 'list') => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSortKey: (k: SortKey) => void;
  onToggleSortDir: () => void;
  folderId: number | null;
  onNewFolder: () => void;
  onUploaded: () => void;
}

const segBtn = (active: boolean) =>
  `grid place-items-center w-9 h-9 transition ${
    active ? 'bg-accent-soft text-accent' : 'text-muted hover:text-content hover:bg-panel-hi'
  }`;

export function Topbar({
  query, onQuery, view, onView, sortKey, sortDir, onSortKey, onToggleSortDir,
  folderId, onNewFolder, onUploaded,
}: Props) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <div className="relative flex-1 min-w-52">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none">
          <IconSearch size={18} />
        </span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="ring-accent w-full pl-11 pr-4 py-2.5 rounded-xl bg-panel/70 border border-line text-content transition"
        />
      </div>

      <div className="flex items-center rounded-xl border border-line bg-panel/70 overflow-hidden h-[42px]">
        <select
          value={sortKey}
          onChange={(e) => onSortKey(e.target.value as SortKey)}
          className="h-full pl-3.5 pr-2 bg-transparent text-sm text-content outline-none cursor-pointer hover:text-accent transition"
          title={t('sortBy')}
        >
          <option value="name">{t('sortName')}</option>
          <option value="date">{t('sortDate')}</option>
          <option value="size">{t('sortSize')}</option>
        </select>
        <button
          onClick={onToggleSortDir}
          className="grid place-items-center w-9 h-full text-muted hover:text-accent border-l border-line transition"
          title={sortDir === 'asc' ? t('sortAsc') : t('sortDesc')}
        >
          {sortDir === 'asc' ? <IconArrowUp size={17} /> : <IconArrowDown size={17} />}
        </button>
      </div>

      <div className="flex rounded-xl border border-line bg-panel/70 overflow-hidden h-[42px] items-center">
        <button onClick={() => onView('grid')} className={segBtn(view === 'grid')} title={t('viewGrid')}>
          <IconGrid size={17} />
        </button>
        <div className="w-px h-5 bg-line" />
        <button onClick={() => onView('list')} className={segBtn(view === 'list')} title={t('viewList')}>
          <IconList size={17} />
        </button>
      </div>

      <button
        onClick={onNewFolder}
        className="h-[42px] px-4 rounded-xl bg-panel/70 border border-line text-content hover:border-line-hi hover:text-accent transition flex items-center gap-2"
      >
        <IconFolderPlus size={18} />
        <span className="font-medium hidden sm:inline">{t('folder')}</span>
      </button>

      <UploadButton folderId={folderId} onUploaded={onUploaded} />
    </div>
  );
}
