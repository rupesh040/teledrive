import type { FolderItem, FileItem, Stats, SetupStatus } from '../types.js';
import { getToken, clearToken } from './auth.js';

// Attach the token; handle 401 (locked session) globally.
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

const J = async (r: Response) => {
  if (r.status === 401) {
    clearToken();
    throw new Error('Sesi terkunci');
  }
  if (!r.ok) {
    const msg = await r.json().then((b) => b?.error).catch(() => null);
    throw new Error(msg || 'Request gagal');
  }
  return r.json();
};

export const api = {
  // --- setup / auth ---
  setupStatus: (): Promise<SetupStatus> => fetch('/api/setup/status').then(J),
  setupStart: (apiId: number, apiHash: string, phone: string): Promise<{ loginId: string; needs: 'code' }> =>
    fetch('/api/setup/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiId, apiHash, phone }),
    }).then(J),
  setupVerify: (loginId: string, code: string): Promise<{ needs: 'pin' | 'password' }> =>
    fetch('/api/setup/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, code }),
    }).then(J),
  setupPassword: (loginId: string, password: string): Promise<{ needs: 'pin' }> =>
    fetch('/api/setup/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password }),
    }).then(J),
  setupPin: (pin: string): Promise<{ token: string }> =>
    fetch('/api/setup/pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    }).then(J),
  unlock: (pin: string): Promise<{ token: string }> =>
    fetch('/api/auth/unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    }).then(J),
  logout: (): Promise<{ ok: boolean }> =>
    fetch('/api/account/logout', { method: 'POST', headers: authHeaders() }).then(J),

  // --- folders ---
  listFolders: (parent: number | null): Promise<FolderItem[]> =>
    fetch(`/api/folders${parent ? `?parent=${parent}` : ''}`, { headers: authHeaders() }).then(J),
  listAllFolders: (): Promise<FolderItem[]> => fetch('/api/folders/all', { headers: authHeaders() }).then(J),
  searchFolders: (q: string): Promise<FolderItem[]> =>
    fetch(`/api/folders/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() }).then(J),
  trashFolders: (): Promise<FolderItem[]> => fetch('/api/folders/trash', { headers: authHeaders() }).then(J),
  restoreFolder: (id: number) => fetch(`/api/folders/${id}/restore`, { method: 'POST', headers: authHeaders() }).then(J),
  deleteFolderPermanent: (id: number) => fetch(`/api/folders/${id}/permanent`, { method: 'DELETE', headers: authHeaders() }).then(J),
  createFolder: (name: string, parentId: number | null): Promise<FolderItem> =>
    fetch('/api/folders', {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name, parentId }),
    }).then(J),
  renameFolder: (id: number, name: string) =>
    fetch(`/api/folders/${id}`, {
      method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name }),
    }).then(J),
  moveFolder: (id: number, parentId: number | null) =>
    fetch(`/api/folders/${id}`, {
      method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ parentId }),
    }).then(J),
  deleteFolder: (id: number) => fetch(`/api/folders/${id}`, { method: 'DELETE', headers: authHeaders() }).then(J),

  // --- files ---
  listFiles: (folder: number | null): Promise<FileItem[]> =>
    fetch(`/api/files${folder ? `?folder=${folder}` : ''}`, { headers: authHeaders() }).then(J),
  searchFiles: (q: string): Promise<FileItem[]> =>
    fetch(`/api/files/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() }).then(J),
  trashFiles: (): Promise<FileItem[]> => fetch('/api/files/trash', { headers: authHeaders() }).then(J),
  restoreFile: (id: number) => fetch(`/api/files/${id}/restore`, { method: 'POST', headers: authHeaders() }).then(J),
  deleteFilePermanent: (id: number) => fetch(`/api/files/${id}/permanent`, { method: 'DELETE', headers: authHeaders() }).then(J),
  // Upload via XHR so it can report progress (fetch doesn't support upload progress yet).
  uploadFile: (file: File, folderId: number | null, onProgress?: (pct: number) => void): Promise<FileItem> => {
    const fd = new FormData();
    fd.append('file', file);
    if (folderId) fd.append('folderId', String(folderId));
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/files');
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status === 401) { clearToken(); reject(new Error('Sesi terkunci')); return; }
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Respons tidak valid')); }
        } else {
          let msg = 'Upload gagal';
          try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* ignore */ }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error('Koneksi gagal saat upload'));
      xhr.send(fd);
    });
  },
  renameFile: (id: number, name: string) =>
    fetch(`/api/files/${id}`, {
      method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name }),
    }).then(J),
  moveFile: (id: number, folderId: number | null) =>
    fetch(`/api/files/${id}`, {
      method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ folderId }),
    }).then(J),
  deleteFile: (id: number) => fetch(`/api/files/${id}`, { method: 'DELETE', headers: authHeaders() }).then(J),
  downloadUrl: (id: number) => `/api/files/${id}/download?token=${getToken() ?? ''}`,
  downloadZipUrl: (ids: number[]) => `/api/files/download-zip?ids=${ids.join(',')}&token=${getToken() ?? ''}`,
  previewUrl: (id: number) => `/api/files/${id}/preview?token=${getToken() ?? ''}`,

  stats: (): Promise<Stats> => fetch('/api/files/stats', { headers: authHeaders() }).then(J),
};
