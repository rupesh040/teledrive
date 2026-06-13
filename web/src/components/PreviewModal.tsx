import { useEffect, useState } from 'react';
import type { FileItem } from '../types.js';
import { api } from '../api/client.js';
import { sizeLabel, isImage, isVideo, isAudio, isPdf, isText } from '../lib/format.js';
import { useT } from '../i18n/lang.js';
import { IconX, IconDownload } from './icons.js';

interface Props {
  file: FileItem | null;
  onClose: () => void;
}

export function PreviewModal({ file, onClose }: Props) {
  const { t: tr } = useT();
  const [text, setText] = useState<string | null>(null);

  const asText = !!file && isText(file.mime_type, file.name);

  useEffect(() => {
    setText(null);
    if (!file || !asText) return;
    let alive = true;
    fetch(api.previewUrl(file.id))
      .then((r) => r.text())
      .then((txt) => { if (alive) setText(txt.slice(0, 200_000)); })
      .catch(() => { if (alive) setText(tr('notPreviewable')); });
    return () => { alive = false; };
  }, [file, asText, tr]);

  if (!file) return null;
  const url = api.previewUrl(file.id);
  const t = file.mime_type;
  const previewable = isImage(t) || isVideo(t) || isAudio(t) || isPdf(t) || asText;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="pop-in bg-panel border border-line rounded-2xl max-w-[92vw] max-h-[92vh] overflow-auto shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between gap-4 px-5 py-3.5 border-b border-line bg-panel/95 backdrop-blur">
          <div className="min-w-0">
            <h3 className="font-medium text-content truncate">{file.name}</h3>
            <p className="text-xs text-faint">{sizeLabel(file.size)}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={api.downloadUrl(file.id)}
              title={tr('download')}
              className="grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-accent hover:bg-ink/70 transition"
            >
              <IconDownload size={18} />
            </a>
            <button
              onClick={onClose}
              className="grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-content hover:bg-ink/70 transition"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        <div className="p-5">
          {isImage(t) && <img src={url} alt={file.name} className="max-w-full rounded-xl" />}
          {isVideo(t) && <video src={url} controls autoPlay className="max-w-full max-h-[78vh] rounded-xl" />}
          {isAudio(t) && (
            <div className="w-[70vw] max-w-xl py-10 grid place-items-center gap-4">
              <div className="text-6xl">🎵</div>
              <audio src={url} controls autoPlay className="w-full" />
            </div>
          )}
          {isPdf(t) && (
            <iframe src={url} title={file.name} className="w-[80vw] h-[72vh] rounded-xl bg-white" />
          )}
          {asText && (
            <pre className="w-[80vw] max-w-3xl max-h-[72vh] overflow-auto text-sm text-content bg-ink/60 border border-line rounded-xl p-4 whitespace-pre-wrap break-words">
              {text ?? tr('loading')}
            </pre>
          )}
          {!previewable && (
            <div className="py-16 px-8 text-center">
              <p className="text-muted">{tr('notPreviewable')}</p>
              <a
                href={api.downloadUrl(file.id)}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl font-semibold text-ink bg-gradient-to-b from-accent-2 to-accent shadow-glow transition"
              >
                <IconDownload size={18} /> {tr('downloadFile')}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
