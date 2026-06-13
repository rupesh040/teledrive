import type { FolderItem } from '../types.js';
import { useT } from '../i18n/lang.js';
import { IconHome, IconChevron } from './icons.js';

interface Props {
  trail: FolderItem[];                       // jejak dari akar ke folder aktif
  onNavigate: (folderId: number | null) => void;
}

export function Breadcrumb({ trail, onNavigate }: Props) {
  const { t } = useT();
  return (
    <nav className="flex items-center gap-1.5 text-sm flex-wrap">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1.5 text-muted hover:text-accent transition"
      >
        <IconHome size={15} /> {t('myDrive')}
      </button>
      {trail.map((f, i) => (
        <span key={f.id} className="flex items-center gap-1.5">
          <span className="text-faint"><IconChevron size={14} /></span>
          <button
            onClick={() => onNavigate(f.id)}
            className={`transition ${
              i === trail.length - 1 ? 'text-content font-medium' : 'text-muted hover:text-accent'
            }`}
          >
            {f.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
