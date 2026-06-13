import { useT } from '../i18n/lang.js';
import { IconX, IconCheck } from './icons.js';

export interface UploadItem {
  id: number;
  name: string;
  progress: number; // 0..100
  status: 'uploading' | 'done' | 'error';
}

interface Props {
  items: UploadItem[];
  onClose: () => void;
}

export function UploadQueue({ items, onClose }: Props) {
  const { t } = useT();
  if (items.length === 0) return null;

  const active = items.filter((i) => i.status === 'uploading').length;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[92vw] bg-panel border border-line rounded-2xl shadow-lift overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <span className="text-sm font-medium text-content">
          {active > 0 ? `${t('uploading')} (${active})` : t('upload')}
        </span>
        <button onClick={onClose} className="grid place-items-center w-7 h-7 rounded-lg text-muted hover:text-content hover:bg-ink/70 transition">
          <IconX size={16} />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1.5">
        {items.map((it) => (
          <div key={it.id} className="px-2 py-1.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex-1 truncate text-sm text-content">{it.name}</span>
              {it.status === 'done' && <span className="text-accent"><IconCheck size={15} /></span>}
              {it.status === 'error' && <span className="text-xs text-[#e0584c]">!</span>}
              {it.status === 'uploading' && <span className="text-xs text-faint">{it.progress}%</span>}
            </div>
            <div className="h-1.5 rounded-full bg-ink overflow-hidden border border-line">
              <div
                className={`h-full rounded-full transition-all duration-200 ${it.status === 'error' ? 'bg-[#e0584c]' : 'bg-gradient-to-r from-accent-2 to-accent'}`}
                style={{ width: `${it.status === 'done' ? 100 : it.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
