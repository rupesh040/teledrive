import { useEffect, useState } from "react";
import type { SetupStatus } from "../types.js";
import { api } from "../api/client.js";
import { clearToken, getToken } from "../api/auth.js";
import { useT } from "../i18n/lang.js";
import { AppIcon } from "./Brand.js";

export function AccountMenu({ onLoggedOut }: { onLoggedOut?: () => void }) {
  const { t } = useT();
  const [account, setAccount] = useState<SetupStatus["account"]>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .authSession()
      .then((s) => setAccount(s.account))
      .catch(() => {});
  }, []);
  async function logout() {
    if (busy) return;
    const token = getToken();
    setBusy(true);
    setError(false);
    try {
      await api.logout();
      if (clearToken(token)) onLoggedOut?.();
    } catch {
      setError(true);
      setBusy(false);
    }
  }
  const name = account?.name || t("personalAccount");
  return (
    <div className="account-area">
      {error && (
        <p className="account-error" role="alert">
          {t("signOutError")}
        </p>
      )}
      <div className="account-profile">
        <span className="account-avatar">{name.charAt(0).toUpperCase()}</span>
        <div>
          <strong>{name}</strong>
          <small>{t("personalAccount")}</small>
        </div>
        <button
          className="icon-button"
          aria-label={t("logout")}
          title={t("logout")}
          onClick={logout}
          disabled={busy}
        >
          <AppIcon name="logout" size={18} />
        </button>
      </div>
    </div>
  );
}
