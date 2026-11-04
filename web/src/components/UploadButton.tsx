import { useRef } from "react";
import { useT } from "../i18n/lang.js";
import { IconUpload } from "./icons.js";
import { MaterialButton } from "./material/MaterialButton.js";
import { Ripple } from './material/Ripple.js';
export function UploadButton({
  onFiles,
  disabled = false,
  floating = false,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  floating?: boolean;
}) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          if (files.length) onFiles(files);
          event.target.value = "";
        }}
      />
      {floating ? <button type="button" className="app-upload-fab" aria-label={t('uploadFiles')}
        disabled={disabled} onClick={() => input.current?.click()}>
        <Ripple /><IconUpload size={24} /><span>{t('uploadFiles')}</span>
      </button> : <MaterialButton
        icon={<IconUpload size={18} />}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <span>{t("uploadFiles")}</span>
      </MaterialButton>}
    </>
  );
}
