import { useEffect, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/lang.js';
import { IconFolderPlus, IconPencil, IconTrash } from './icons.js';
import { MaterialButton } from './material/MaterialButton.js';
import { useSupportDialog } from './support-dialog.js';
import './support-flows.css';

export interface DialogRequest {
  title: string;
  description?: string;
  label?: string;
  initial?: string;
  confirm: string;
  danger?: boolean;
}

export function ActionDialog({ request, onResolve }: {
  request: DialogRequest;
  onResolve: (value: string | null) => void;
}) {
  const { t } = useT();
  const [value, setValue] = useState(request.initial ?? '');
  const panel = useSupportDialog<HTMLFormElement>(true, () => onResolve(null));
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const input = panel.current?.querySelector<HTMLInputElement>('input');
      if (input) { input.focus(); input.select(); }
    });
    return () => cancelAnimationFrame(frame);
  }, [panel]);

  return createPortal(
    <div className="support-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onResolve(null);
    }}>
      <form ref={panel} className={`support-dialog support-action-dialog ${request.danger ? 'support-action-danger' : ''}`}
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        aria-describedby={request.description ? descriptionId : undefined} tabIndex={-1}
        onSubmit={(event) => {
          event.preventDefault();
          if (!request.label || value.trim()) onResolve(request.label ? value.trim() : 'yes');
        }}>
        <div className="support-action-content">
          <span className="support-action-symbol">
            {request.danger ? <IconTrash size={24} /> : request.initial ? <IconPencil size={24} /> : <IconFolderPlus size={24} />}
          </span>
          <h2 id={titleId}>{request.title}</h2>
          {request.description && <p id={descriptionId}>{request.description}</p>}
          {request.label && <div className="support-action-field">
            <label htmlFor={inputId}>{request.label}</label>
            <input id={inputId} type="text" value={value} onChange={(event) => setValue(event.target.value)} required maxLength={255} autoComplete="off" />
          </div>}
        </div>
        <div className="support-dialog-footer support-action-footer">
          <MaterialButton type="button" variant="text" onClick={() => onResolve(null)}>{t('cancel')}</MaterialButton>
          <MaterialButton type="submit" className={request.danger ? 'support-destructive-button' : ''} disabled={!!request.label && !value.trim()}>{request.confirm}</MaterialButton>
        </div>
      </form>
    </div>, document.body,
  );
}
