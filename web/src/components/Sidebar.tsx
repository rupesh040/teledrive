import type { Stats } from '../types.js';
import { sizeLabel } from '../lib/format.js';
import { useT } from '../i18n/lang.js';
import { IconLogo, IconHome, IconTrashBin } from './icons.js';
import { AccountMenu } from './AccountMenu.js';
import { LangToggle } from './LangToggle.js';

interface Props {
  stats: Stats | null;
  route: 'drive' | 'trash';
  onHome: () => void;
  onTrash: () => void;
  onLoggedOut?: () => void;
}

// Display-only quota (not Telegram's actual limit). For the capacity bar aesthetic.
const QUOTA_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB

export function Sidebar({ stats, route, onHome, onTrash, onLoggedOut }: Props) {
  const { t } = useT();
  const used = stats?.totalBytes ?? 0;
  const pct = Math.min(100, (used / QUOTA_BYTES) * 100);
  const navItem = (active: boolean) =>
    `group text-left px-3 py-2.5 rounded-xl border transition flex items-center gap-3 ${
      active ? 'bg-accent-soft text-content border-line-hi/30 hover:border-line-hi' : 'text-muted border-transparent hover:bg-panel-hi hover:text-content'
    }`;

  return (
    <aside className="w-64 shrink-0 bg-ink-2/70 backdrop-blur-xl border-r border-line px-5 py-6 flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent-soft text-accent border border-line-hi/40">
          <IconLogo size={22} />
        </span>
        <div className="leading-none">
          <div className="font-display text-2xl tracking-tight text-content">TeleDrive</div>
          <div className="text-[11px] text-faint mt-1 tracking-wide">{t('tagline')}</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        <p className="text-[11px] uppercase tracking-[0.18em] text-faint px-2 mb-1">{t('library')}</p>
        <button onClick={onHome} className={navItem(route === 'drive')}>
          <span className={route === 'drive' ? 'text-accent' : ''}><IconHome size={18} /></span>
          <span className="font-medium">{t('myDrive')}</span>
        </button>
        <button onClick={onTrash} className={navItem(route === 'trash')}>
          <span className={route === 'trash' ? 'text-accent' : ''}><IconTrashBin size={18} /></span>
          <span className="font-medium">{t('trashNav')}</span>
        </button>
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <AccountMenu onLoggedOut={onLoggedOut} />
        <LangToggle className="self-start" />

        <div className="rounded-2xl border border-line bg-panel/60 p-4">
        <div className="flex items-baseline justify-between mb-2.5">
          <span className="text-xs uppercase tracking-[0.16em] text-faint">{t('storage')}</span>
          <span className="text-xs text-accent font-semibold">{pct.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full bg-ink overflow-hidden border border-line">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-2 to-accent-deep transition-all duration-500"
            style={{ width: `${Math.max(pct, used > 0 ? 4 : 0)}%` }}
          />
        </div>
        <div className="text-xs text-muted mt-2.5">
          <span className="text-content font-medium">{sizeLabel(used)}</span> {t('used')}
          <span className="text-faint"> · {stats?.totalFiles ?? 0} {t('files')}</span>
        </div>
        </div>
      </div>
    </aside>
  );
}
