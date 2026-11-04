import type { DriveRoute } from '../types.js';
import { useT } from '../i18n/lang.js';
import { AppIcon } from './Brand.js';
import { Ripple } from './material/Ripple.js';

export function BottomNavigation({ route, drawerOpen, onRoute, onMore }: {
  route: DriveRoute;
  drawerOpen: boolean;
  onRoute: (route: DriveRoute) => void;
  onMore: () => void;
}) {
  const { lang, t } = useT();
  const entries = [
    { route: 'drive' as const, label: lang === 'en' ? 'Files' : 'File', icon: 'folder' as const },
    { route: 'recent' as const, label: t('recent'), icon: 'clock' as const },
    { route: 'images' as const, label: lang === 'en' ? 'Photos' : 'Foto', icon: 'image' as const },
  ];
  return <nav className="app-bottom-navigation" aria-label={lang === 'en' ? 'Main navigation' : 'Navigasi utama'}>
    {entries.map(entry => <button key={entry.route} type="button"
      className={route === entry.route && !drawerOpen ? 'is-active' : ''}
      aria-current={route === entry.route ? 'page' : undefined}
      onClick={() => onRoute(entry.route)}>
      <span className="app-navigation-icon"><Ripple /><AppIcon name={entry.icon} size={24} /></span>
      <span>{entry.label}</span>
    </button>)}
    <button type="button" className={drawerOpen || route === 'documents' || route === 'trash' ? 'is-active' : ''}
      aria-label={lang === 'en' ? 'More, settings and account' : 'Lainnya, pengaturan dan akun'}
      aria-expanded={drawerOpen} aria-controls="drive-navigation" onClick={onMore}>
      <span className="app-navigation-icon"><Ripple /><AppIcon name="menu" size={24} /></span>
      <span>{lang === 'en' ? 'More' : 'Lainnya'}</span>
    </button>
  </nav>;
}
