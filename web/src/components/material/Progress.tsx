import type { CSSProperties } from 'react';
import './progress.css';

interface Props {
  label: string;
  value?: number;
  valueText?: string;
  indeterminate?: boolean;
  state?: 'active' | 'complete' | 'error';
  active?: boolean;
  decorative?: boolean;
  className?: string;
}

/** A straight progress bar; percentages reflect the operation's reported progress. */
export function LinearProgress({ label, value, valueText, indeterminate, state = 'active', active = true, decorative = false, className = '' }: Props) {
  const percent = state === 'complete' ? 100 : Math.min(100, Math.max(0, Number.isFinite(value) ? value! : 0));
  const waiting = state === 'active' && (indeterminate ?? value === undefined);
  const accessible = active && !decorative;
  return <div
    className={`linear-progress ${className}`.trim()}
    style={{ '--progress-value': `${percent}%` } as CSSProperties}
    data-state={state}
    data-indeterminate={waiting}
    data-active={active}
    role={accessible ? 'progressbar' : undefined}
    aria-label={accessible ? label : undefined}
    aria-valuemin={accessible ? 0 : undefined}
    aria-valuemax={accessible ? 100 : undefined}
    aria-valuenow={accessible && !waiting ? percent : undefined}
    aria-valuetext={accessible ? valueText : undefined}
    aria-hidden={!accessible ? true : undefined}
  ><span className="linear-progress-indicator" /></div>;
}

/** Decorative circular spinner for controls that already provide a busy label. */
export function LoadingSpinner({ className = '' }: { className?: string }) {
  return <span className={`loading-spinner ${className}`.trim()} aria-hidden="true" />;
}
