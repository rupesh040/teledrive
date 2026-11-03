import {
  IconCloud,
  IconClock,
  IconImage,
  IconDocument,
  IconShield,
  IconFolder,
  IconMenu,
  IconLogout,
  IconRefresh,
} from "./icons.js";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M9 23h15a5 5 0 0 0 0-10h-.3A8 8 0 0 0 8.2 12 5.6 5.6 0 0 0 9 23Z"
            fill="currentColor"
          />
          <path
            d="m12 17 8-3-2.4 7-2.4-2.7-2 1.2.7-3"
            fill="var(--md-sys-color-primary-container)"
          />
        </svg>
      </span>
      {!compact && (
        <span>
          TeleDrive<span className="brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
const appIcons = {
  cloud: IconCloud,
  clock: IconClock,
  image: IconImage,
  document: IconDocument,
  shield: IconShield,
  folder: IconFolder,
  menu: IconMenu,
  logout: IconLogout,
  refresh: IconRefresh,
};
export function AppIcon({
  name,
  size = 24,
}: {
  name: keyof typeof appIcons;
  size?: number;
}) {
  const Icon = appIcons[name];
  return <Icon size={size} />;
}
