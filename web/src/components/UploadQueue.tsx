import { useEffect, useState } from 'react';
import { useT } from '../i18n/lang.js';
import { IconX, IconCheck, IconUpload, IconChevron } from './icons.js';
import './support-flows.css';

export interface UploadItem {
  id: number;
  name: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
}

interface Props {
  items: UploadItem[];
  onClose: () => void;
}

export function UploadQueue({ items, onClose }: Props) {
  const { t, lang } = useT();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { if (items.length === 0) setCollapsed(false); }, [items.length]);
  if (items.length === 0) return null;
  const active = items.filter((item) => item.status === 'uploading').length;
  const completed = items.filter((item) => item.status === 'done').length;
  const failed = items.filter((item) => item.status === 'error').length;
  const heading = active > 0 ? `${t('uploading')} (${active})` : failed > 0
    ? (lang === 'en' ? 'Some uploads need attention' : 'Beberapa unggahan gagal')
    : (lang === 'en' ? 'Uploads complete' : 'Unggahan selesai');
  const toggleLabel = collapsed ? (lang === 'en' ? 'Expand uploads' : 'Perluas unggahan') : (lang === 'en' ? 'Minimize uploads' : 'Perkecil unggahan');

  return (
    <section className="upload-panel" aria-label={lang === 'en' ? 'File transfers' : 'Transfer file'}>
      <header className="upload-panel-header">
        <span className="upload-panel-symbol"><IconUpload size={19} /></span>
        <div><h2 role="status" aria-live="polite">{heading}</h2><p>{completed} / {items.length} {lang === 'en' ? 'files complete' : 'file selesai'}</p></div>
        <button onClick={() => setCollapsed((value) => !value)} className={`support-icon-button upload-toggle ${collapsed ? 'is-collapsed' : ''}`} title={toggleLabel} aria-label={toggleLabel} aria-expanded={!collapsed}><IconChevron size={16} /></button>
        {active === 0 && <button onClick={onClose} className="support-icon-button" title={lang === 'en' ? 'Dismiss transfers' : 'Tutup transfer'} aria-label={lang === 'en' ? 'Dismiss transfers' : 'Tutup transfer'}><IconX size={17} /></button>}
      </header>
      <div className={`upload-panel-collapse ${collapsed ? 'is-collapsed' : ''}`} aria-hidden={collapsed}><div className="upload-panel-items"><div className="upload-panel-scroll">{items.map((item) => {
        const progress = Math.min(100, Math.max(0, item.progress));
        return <div key={item.id} className={`upload-transfer upload-transfer-${item.status}`}>
          <div className="upload-transfer-label"><span title={item.name}>{item.name}</span>
            {item.status === 'done' ? <span className="upload-success" title={lang === 'en' ? 'Complete' : 'Selesai'}><IconCheck size={16} /></span>
              : item.status === 'error' ? <span className="upload-failed-label">{lang === 'en' ? 'Failed' : 'Gagal'}</span>
              : <small>{progress === 100 ? (lang === 'en' ? 'Saving…' : 'Menyimpan…') : `${progress}%`}</small>}
          </div>
          <div className="upload-progress-track" role="progressbar" aria-label={item.name} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-valuetext={item.status === 'error' ? (lang === 'en' ? 'Upload failed' : 'Unggahan gagal') : item.status === 'done' ? (lang === 'en' ? 'Complete' : 'Selesai') : `${progress}%`}><div style={{ width: `${item.status === 'done' ? 100 : progress}%` }} /></div>
          {item.status === 'error' && <p>{lang === 'en' ? 'Upload this file again to retry.' : 'Unggah file ini lagi untuk mencoba kembali.'}</p>}
        </div>;
      })}</div></div></div>
    </section>
  );
}
