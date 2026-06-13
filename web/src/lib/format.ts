export function sizeLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Emoji icon per mime category (for non-image files)
export function fileIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime === 'application/pdf') return '📕';
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('compressed')) return '🗜️';
  if (mime.startsWith('text/')) return '📝';
  return '📄';
}

export function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}
export function isVideo(mime: string): boolean {
  return mime.startsWith('video/');
}
export function isAudio(mime: string): boolean {
  return mime.startsWith('audio/');
}
export function isPdf(mime: string): boolean {
  return mime === 'application/pdf';
}
// Text/code that's safe to display as-is in <pre>.
export function isText(mime: string, name = ''): boolean {
  if (mime.startsWith('text/')) return true;
  if (['application/json', 'application/xml', 'application/javascript'].includes(mime)) return true;
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return ['txt', 'md', 'json', 'csv', 'log', 'xml', 'yml', 'yaml', 'js', 'ts', 'css', 'html'].includes(ext);
}

// Compact date for the list view (e.g. "10 Jun 2026").
// locale follows the active language (id-ID / en-US).
export function dateLabel(iso: string, locale = 'id-ID'): string {
  try {
    return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

// Visual metadata for the file glyph: extension label + category color.
export interface FileMeta {
  label: string; // badge text (e.g. "PDF", "MP3")
  color: string; // category accent color (hex)
}

export function fileMeta(mime: string, name: string): FileMeta {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase().slice(0, 4) : '';
  const by = (color: string, fallback: string): FileMeta => ({ color, label: ext || fallback });

  if (mime.startsWith('image/')) return by('#e8739b', 'IMG');
  if (mime.startsWith('video/')) return by('#9b7be8', 'VID');
  if (mime.startsWith('audio/')) return by('#4fb888', 'AUD');
  if (mime === 'application/pdf') return by('#e0584c', 'PDF');
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z') || mime.includes('compressed'))
    return by('#e0a23b', 'ZIP');
  if (mime.includes('word') || mime.includes('document')) return by('#5b9be0', 'DOC');
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return by('#4fb36b', 'XLS');
  if (mime.includes('presentation') || mime.includes('powerpoint')) return by('#e08a3b', 'PPT');
  if (mime.startsWith('text/')) return by('#9aa6b2', 'TXT');
  return by('#b8ae9e', 'FILE');
}
