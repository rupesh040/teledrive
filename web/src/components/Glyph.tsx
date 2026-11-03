import { fileMeta } from '../lib/format.js';

export function fileTone(mime: string): 'primary' | 'secondary' | 'tertiary' {
  if (/^(image|video|audio)\//.test(mime) || /presentation|powerpoint/.test(mime)) return 'tertiary';
  if (/compressed|zip|rar|7z/.test(mime) || mime.startsWith('text/')) return 'secondary';
  return 'primary';
}

export function FolderGlyph({ size = 56 }: { size?: number }) {
  return (
    <svg className="folder-glyph" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M9 13h17l7 7h22a5 5 0 0 1 5 5v24a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V18a5 5 0 0 1 5-5Z" fill="var(--md-sys-color-primary-container)" />
      <path d="M4 28a5 5 0 0 1 5-5h46a5 5 0 0 1 5 5v21a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V28Z" fill="var(--md-sys-color-primary)" />
    </svg>
  );
}

export function FileGlyph({ mime, name, size = 56 }: { mime: string; name: string; size?: number }) {
  const { label } = fileMeta(mime, name);
  const tone = fileTone(mime);
  return (
    <svg className="document-glyph" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M17 6h23l12 12v36a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4Z" fill={`var(--md-sys-color-${tone}-container)`} />
      <path d="M40 6v9a3 3 0 0 0 3 3h9" fill={`var(--md-sys-color-${tone})`} fillOpacity=".3" />
      <path d="M22 25h20M22 30h14" stroke={`var(--md-sys-color-on-${tone}-container)`} strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
      <rect x="9" y="36" width="38" height="17" rx="4" fill={`var(--md-sys-color-${tone})`} />
      <text x="28" y="47.7" textAnchor="middle" fontFamily="inherit" fontSize="9.5" fontWeight="700" fill={`var(--md-sys-color-on-${tone})`} letterSpacing=".5">{label}</text>
    </svg>
  );
}
