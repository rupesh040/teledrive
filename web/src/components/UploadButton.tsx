import { useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useT } from '../i18n/lang.js';
import { IconUpload } from './icons.js';

interface Props {
  folderId: number | null;
  onUploaded: () => void;
}

export function UploadButton({ folderId, onUploaded }: Props) {
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await api.uploadFile(file, folderId);
      onUploaded();
    } catch (err) {
      alert(t('uploadFailed') + (err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" hidden onChange={handleChange} />
      <button
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="h-[42px] px-4 rounded-xl font-semibold text-ink bg-gradient-to-b from-accent-2 to-accent hover:from-accent hover:to-accent-deep shadow-glow transition disabled:opacity-60 flex items-center gap-2"
      >
        <IconUpload size={18} />
        {busy ? t('uploading') : t('upload')}
      </button>
    </>
  );
}
