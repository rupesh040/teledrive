import type { FolderItem, FileItem, Stats, SetupStatus, AuthSession } from "../types.js";
import { getToken, clearToken } from "./auth.js";

// A bounded wait lets the UI recover when the local API is unreachable.
const responseTokens = new WeakMap<Response, string | null>();
const request = async (input: RequestInfo | URL, init?: RequestInit) => {
  const authorization = new Headers(init?.headers).get('Authorization');
  const requestToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  const response = await fetch(input, {
    ...init,
    signal:
      init?.signal ??
      AbortSignal.timeout(
        init?.method && init.method !== "GET" ? 120000 : 15000,
      ),
  });
  responseTokens.set(response, requestToken);
  return response;
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// Attach the token; handle 401 (locked session) globally.
function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

const J = async (r: Response) => {
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    const usedToken = responseTokens.get(r);
    if (r.status === 401 && usedToken) clearToken(usedToken);
    const seconds = Number(r.headers.get('Retry-After') ?? body?.retryAfter);
    throw new ApiError(
      typeof body?.error === 'string' ? body.error : 'Request failed. Please try again.',
      r.status,
      typeof body?.code === 'string' ? body.code : undefined,
      Number.isFinite(seconds) && seconds > 0 ? seconds : undefined,
    );
  }
  return r.json();
};

export const api = {
  // --- setup / auth ---
  setupStatus: (): Promise<SetupStatus> => request("/api/setup/status").then(J),
  authSession: (): Promise<AuthSession> => request('/api/auth/session', { headers: authHeaders() }).then(J),
  telegramStart: (phone: string, remember = false): Promise<{ loginId: string; needs: 'code'; retryAfter: number }> =>
    request('/api/auth/telegram/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, remember }),
    }).then(J),
  telegramVerify: (loginId: string, code: string): Promise<{ needs: 'password' } | { token: string }> =>
    request('/api/auth/telegram/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, code }),
    }).then(J),
  telegramPassword: (loginId: string, password: string): Promise<{ token: string }> =>
    request('/api/auth/telegram/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password }),
    }).then(J),
  telegramCancel: (loginId: string): Promise<{ ok: boolean }> =>
    request('/api/auth/telegram/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId }),
    }).then(J),
  setupStart: (
    phone: string,
    remember = false,
  ): Promise<{ loginId: string; needs: "code"; retryAfter: number }> =>
    request("/api/setup/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, remember }),
    }).then(J),
  setupVerify: (
    loginId: string,
    code: string,
  ): Promise<{ needs: "pin" | "password" }> =>
    request("/api/setup/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, code }),
    }).then(J),
  setupPassword: (
    loginId: string,
    password: string,
  ): Promise<{ needs: "pin" }> =>
    request("/api/setup/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password }),
    }).then(J),
  setupCancel: (loginId: string): Promise<{ ok: boolean }> =>
    request('/api/setup/cancel', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId }),
    }).then(J),
  setupPin: (loginId: string, pin: string, remember = false): Promise<{ ok: boolean; token: string }> =>
    request("/api/setup/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, pin, remember }),
    }).then(J),
  unlock: (phone: string, pin: string): Promise<{ token: string }> =>
    request("/api/auth/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, pin }),
    }).then(J),
  login: (phone: string, pin: string, remember = false): Promise<{ token: string }> =>
    request('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin, remember }),
    }).then(J),
  logout: (): Promise<{ ok: boolean }> =>
    request("/api/auth/logout", {
      method: "POST",
      headers: authHeaders(),
    }).then(J),

  // --- folders ---
  listFolders: (parent: number | null): Promise<FolderItem[]> =>
    request(`/api/folders${parent ? `?parent=${parent}` : ""}`, {
      headers: authHeaders(),
    }).then(J),
  listAllFolders: (): Promise<FolderItem[]> =>
    request("/api/folders/all", { headers: authHeaders() }).then(J),
  searchFolders: (q: string): Promise<FolderItem[]> =>
    request(`/api/folders/search?q=${encodeURIComponent(q)}`, {
      headers: authHeaders(),
    }).then(J),
  trashFolders: (): Promise<FolderItem[]> =>
    request("/api/folders/trash", { headers: authHeaders() }).then(J),
  restoreFolder: (id: number) =>
    request(`/api/folders/${id}/restore`, {
      method: "POST",
      headers: authHeaders(),
    }).then(J),
  deleteFolderPermanent: (id: number) =>
    request(`/api/folders/${id}/permanent`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then(J),
  createFolder: (name: string, parentId: number | null): Promise<FolderItem> =>
    request("/api/folders", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name, parentId }),
    }).then(J),
  renameFolder: (id: number, name: string) =>
    request(`/api/folders/${id}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name }),
    }).then(J),
  moveFolder: (id: number, parentId: number | null) =>
    request(`/api/folders/${id}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ parentId }),
    }).then(J),
  deleteFolder: (id: number) =>
    request(`/api/folders/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then(J),

  // --- files ---
  listAllFiles: (): Promise<FileItem[]> =>
    request("/api/files/all", { headers: authHeaders() }).then(J),
  listFiles: (folder: number | null): Promise<FileItem[]> =>
    request(`/api/files${folder ? `?folder=${folder}` : ""}`, {
      headers: authHeaders(),
    }).then(J),
  searchFiles: (q: string): Promise<FileItem[]> =>
    request(`/api/files/search?q=${encodeURIComponent(q)}`, {
      headers: authHeaders(),
    }).then(J),
  trashFiles: (): Promise<FileItem[]> =>
    request("/api/files/trash", { headers: authHeaders() }).then(J),
  restoreFile: (id: number) =>
    request(`/api/files/${id}/restore`, {
      method: "POST",
      headers: authHeaders(),
    }).then(J),
  deleteFilePermanent: (id: number) =>
    request(`/api/files/${id}/permanent`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then(J),
  // Upload via XHR so it can report progress (fetch doesn't support upload progress yet).
  uploadFile: (
    file: File,
    folderId: number | null,
    onProgress?: (pct: number) => void,
  ): Promise<FileItem> => {
    const fd = new FormData();
    fd.append("file", file);
    if (folderId) fd.append("folderId", String(folderId));
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/files");
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable)
          onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status === 401) {
          if (token) clearToken(token);
          reject(new ApiError('Your session has expired. Please sign in again.', 401, 'SESSION_EXPIRED'));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error("Respons tidak valid"));
          }
        } else {
          let msg = "Upload gagal";
          try {
            msg = JSON.parse(xhr.responseText).error || msg;
          } catch {
            /* ignore */
          }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error("Koneksi gagal saat upload"));
      xhr.send(fd);
    });
  },
  renameFile: (id: number, name: string) =>
    request(`/api/files/${id}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ name }),
    }).then(J),
  moveFile: (id: number, folderId: number | null) =>
    request(`/api/files/${id}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ folderId }),
    }).then(J),
  deleteFile: (id: number) =>
    request(`/api/files/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).then(J),
  downloadUrl: (id: number) =>
    `/api/files/${id}/download?token=${getToken() ?? ""}`,
  downloadZipUrl: (ids: number[]) =>
    `/api/files/download-zip?ids=${ids.join(",")}&token=${getToken() ?? ""}`,
  previewUrl: (id: number) =>
    `/api/files/${id}/preview?token=${getToken() ?? ""}`,

  stats: (): Promise<Stats> =>
    request("/api/files/stats", { headers: authHeaders() }).then(J),
};
