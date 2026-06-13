// Minimalist stroke icon set (Lucide style) — consistent, replaces emoji.
interface IconProps {
  className?: string;
  size?: number;
}

function svg(path: React.ReactNode, size = 18, className = '') {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

export const IconSearch = ({ className, size }: IconProps) =>
  svg(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>, size, className);

export const IconGrid = ({ className, size }: IconProps) =>
  svg(
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>,
    size,
    className
  );

export const IconList = ({ className, size }: IconProps) =>
  svg(
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
    </>,
    size,
    className
  );

export const IconArrowUp = ({ className, size }: IconProps) =>
  svg(<path d="M12 19V5M6 11l6-6 6 6" />, size, className);

export const IconArrowDown = ({ className, size }: IconProps) =>
  svg(<path d="M12 5v14M6 13l6 6 6-6" />, size, className);

export const IconFolderPlus = ({ className, size }: IconProps) =>
  svg(
    <>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.2H19.5A1.5 1.5 0 0 1 21 9.7v8.3a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" />
      <path d="M12 12.5v4M10 14.5h4" />
    </>,
    size,
    className
  );

export const IconUpload = ({ className, size }: IconProps) =>
  svg(<><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>, size, className);

export const IconMove = ({ className, size }: IconProps) =>
  svg(
    <>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.2H19.5A1.5 1.5 0 0 1 21 9.7v8.3a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" />
      <path d="M9 13.5h6M13 11l2.4 2.5L13 16" />
    </>,
    size,
    className
  );

export const IconPencil = ({ className, size }: IconProps) =>
  svg(
    <>
      <path d="M4 20h4l10-10a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="m13.5 6.5 3 3" />
    </>,
    size,
    className
  );

export const IconTrash = ({ className, size }: IconProps) =>
  svg(
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
      <path d="M10 11v6M14 11v6" />
    </>,
    size,
    className
  );

export const IconDownload = ({ className, size }: IconProps) =>
  svg(<><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>, size, className);

export const IconHome = ({ className, size }: IconProps) =>
  svg(<><path d="M4 11 12 4l8 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>, size, className);

export const IconChevron = ({ className, size }: IconProps) =>
  svg(<path d="m9 6 6 6-6 6" />, size, className);

export const IconX = ({ className, size }: IconProps) =>
  svg(<path d="M6 6l12 12M18 6 6 18" />, size, className);

export const IconCheck = ({ className, size }: IconProps) =>
  svg(<path d="m5 12.5 4.5 4.5L19 7" />, size, className);

export const IconRestore = ({ className, size }: IconProps) =>
  svg(
    <>
      <path d="M4 10a8 8 0 1 1 .9 4.7" />
      <path d="M4 5v5h5" />
    </>,
    size,
    className
  );

export const IconTrashBin = ({ className, size }: IconProps) =>
  svg(
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
    </>,
    size,
    className
  );

// Mark/logo: a stack of cards with the Telegram "signal" curve
export const IconLogo = ({ className, size = 24 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 9.5h18" stroke="currentColor" strokeWidth="1.6" />
    <path d="m7.5 14.5 3 2 6-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
