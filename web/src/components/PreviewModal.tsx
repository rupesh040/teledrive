import { useEffect, useId, useState } from 'react';
import type { FileItem } from '../types.js';
import { api } from '../api/client.js';
import { sizeLabel, isImage, isVideo, isAudio, isPdf, isText } from '../lib/format.js';
import { useT } from '../i18n/lang.js';
import { IconX, IconDownload } from './icons.js';
import { FileGlyph } from './Glyph.js';
import { useSupportDialog } from './support-dialog.js';
import { MaterialButton } from './material/MaterialButton.js';
import { WavyProgress } from './material/WavyProgress.js';
import './support-flows.css';

interface Props {
  file: FileItem | null;
  onClose: () => void;
}

export function PreviewModal({ file, onClose }: Props) {
  const { t, lang } = useT();
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const titleId = useId();
  const dialog = useSupportDialog(!!file, onClose);
  const asText = !!file && isText(file.mime_type, file.name);

  useEffect(() => {
    setText(null);
    setFailed(false);
    setLoaded(false);
    if (!file || !asText) return;
    const controller = new AbortController();
    fetch(api.previewUrl(file.id), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Preview unavailable');
        return response.text();
      })
      .then((value) => { if (!controller.signal.aborted) { setText(value.slice(0, 200_000)); setLoaded(true); } })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [file, asText, retry]);

  if (!file) return null;
  const url = api.previewUrl(file.id);
  const mime = file.mime_type;
  const previewable = isImage(mime) || isVideo(mime) || isAudio(mime) || isPdf(mime) || asText;
  const closeLabel = lang === 'en' ? 'Close preview' : 'Tutup pratinjau';

  return (
    <div className="support-backdrop" onClick={onClose}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="support-dialog preview-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="support-dialog-header">
          <span className="preview-file-icon"><FileGlyph mime={mime} name={file.name} size={32} /></span>
          <div className="support-dialog-title">
            <h2 id={titleId}>{file.name}</h2>
            <p>{sizeLabel(file.size)}<span aria-hidden="true"> · </span>{lang === 'en' ? 'File preview' : 'Pratinjau file'}</p>
          </div>
          <a href={api.downloadUrl(file.id)} title={t('download')} aria-label={`${t('download')} ${file.name}`} className="support-icon-button"><IconDownload size={19} /></a>
          <button onClick={onClose} title={closeLabel} aria-label={closeLabel} className="support-icon-button"><IconX size={19} /></button>
        </header>
        <div className={`preview-content ${isImage(mime) ? 'preview-image-content' : ''}`}>
          {failed || !previewable ? (
            <div className="support-empty preview-empty">
              <span className="support-empty-symbol"><FileGlyph mime={mime} name={file.name} size={64} /></span>
              <h3>{t('notPreviewable')}</h3>
              {failed && <p>{lang === 'en' ? 'The preview could not be loaded. You can try again or download the original.' : 'Pratinjau tidak dapat dimuat. Coba lagi atau unduh file asli.'}</p>}
              <div className="support-inline-actions">
                {failed && <MaterialButton variant="text" onClick={() => setRetry((value) => value + 1)}>{lang === 'en' ? 'Try again' : 'Coba lagi'}</MaterialButton>}
                <MaterialButton icon={<IconDownload size={18} />} onClick={() => window.location.assign(api.downloadUrl(file.id))}>{t('downloadFile')}</MaterialButton>
              </div>
            </div>
          ) : (
            <>
              {!loaded && (isImage(mime) || asText) && <div className="preview-loading"><WavyProgress label={t('loading')} /><span role="status">{t('loading')}</span></div>}
              {isImage(mime) && <img key={retry} src={url} alt={file.name} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={loaded ? '' : 'preview-hidden'} />}
              {isVideo(mime) && <video key={retry} src={url} controls playsInline onError={() => setFailed(true)} />}
              {isAudio(mime) && <div className="preview-audio"><FileGlyph mime={mime} name={file.name} size={94} /><h3>{file.name}</h3><audio key={retry} src={url} controls onError={() => setFailed(true)} /></div>}
              {isPdf(mime) && <iframe key={retry} src={url} title={file.name} />}
              {asText && text !== null && <pre>{text}</pre>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
