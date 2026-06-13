import { fileMeta } from '../lib/format.js';

// Folder glyph — a tabbed folder shape with an amber tint.
export function FolderGlyph({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2bd66" />
          <stop offset="1" stopColor="#d4912f" />
        </linearGradient>
      </defs>
      <path
        d="M8 18a4 4 0 0 1 4-4h12l4 5h24a4 4 0 0 1 4 4v25a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z"
        fill="url(#fg)"
      />
      <path d="M8 24h48" stroke="#00000022" strokeWidth="1.5" />
      <path
        d="M8 24h48v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z"
        fill="#ffffff10"
      />
    </svg>
  );
}

// File glyph — a "page" with a folded corner + an extension badge colored by category.
export function FileGlyph({ mime, name, size = 56 }: { mime: string; name: string; size?: number }) {
  const { label, color } = fileMeta(mime, name);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M16 8h22l12 12v34a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z"
        fill="#2b2218"
        stroke={color}
        strokeOpacity="0.5"
        strokeWidth="1.4"
      />
      <path d="M38 8v10a2 2 0 0 0 2 2h10" fill="#3a2e1f" stroke={color} strokeOpacity="0.5" strokeWidth="1.4" />
      <rect x="14" y="36" width="36" height="15" rx="3" fill={color} />
      <text
        x="32"
        y="46.5"
        textAnchor="middle"
        fontFamily="'Hanken Grotesk', sans-serif"
        fontSize="9.5"
        fontWeight="700"
        fill="#1a130b"
        letterSpacing="0.5"
      >
        {label}
      </text>
    </svg>
  );
}
