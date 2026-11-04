import { useId, type CSSProperties } from 'react';
import './wavy-progress.css';

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

/** Material Expressive wave motion; a supplied percentage always comes from the operation. */
export function WavyProgress({ label, value, valueText, indeterminate, state = 'active', active = true, decorative = false, className = '' }: Props) {
  const waveId = `progress-wave-${useId().replace(/:/g, '')}`;
  const percent = state === 'complete' ? 100 : Math.min(100, Math.max(0, Number.isFinite(value) ? value! : 0));
  const waiting = state === 'active' && (indeterminate ?? value === undefined);
  const accessible = active && !decorative;
  return <div
    className={`wavy-progress ${className}`.trim()}
    style={{ '--wavy-progress-value': `${percent}%` } as CSSProperties}
    data-state={state}
    data-indeterminate={waiting}
    data-active={active}
    data-empty={!waiting && percent === 0}
    role={accessible ? 'progressbar' : undefined}
    aria-label={accessible ? label : undefined}
    aria-valuemin={accessible ? 0 : undefined}
    aria-valuemax={accessible ? 100 : undefined}
    aria-valuenow={accessible && !waiting ? percent : undefined}
    aria-valuetext={accessible ? valueText : undefined}
    aria-hidden={!accessible ? true : undefined}
  >
    <span className="wavy-progress-track" />
    <span className="wavy-progress-stop" />
    <span className="wavy-progress-indicator">
      <svg className="wavy-progress-wave" width="100%" height="16" aria-hidden="true" focusable="false">
        <defs><pattern id={waveId} width="40" height="16" patternUnits="userSpaceOnUse">
          <path d="M-40 8 Q-30 0 -20 8 T0 8 T20 8 T40 8 T60 8 T80 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="wavy-progress-path" />
        </pattern></defs>
        <rect width="100%" height="16" fill={`url(#${waveId})`} />
      </svg>
      <span className="wavy-progress-settled" />
    </span>
  </div>;
}

const circularWave = Array.from({ length: 97 }, (_, index) => {
  const angle = index / 96 * Math.PI * 2;
  const radius = 7 + Math.sin(angle * 6) * 0.75;
  return `${index ? 'L' : 'M'}${(10 + Math.cos(angle) * radius).toFixed(3)} ${(10 + Math.sin(angle) * radius).toFixed(3)}`;
}).join(' ') + 'Z';

/** Compact, decorative version for buttons with their own busy label. */
export function WavySpinner({ className = '' }: { className?: string }) {
  return <svg className={`wavy-spinner ${className}`.trim()} width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
    <path d={circularWave} stroke="currentColor" strokeWidth="1.8" opacity=".18" />
    <path className="wavy-spinner-trail" d={circularWave} pathLength="100" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
