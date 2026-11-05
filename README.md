# 📦 TeleDrive

A personal file manager powered by **Telegram Cloud**, with a Material Design 3 interface. Organize folders, upload, download, preview, and search while the actual files live in your own Telegram account in a private channel.

Run it locally or deploy the full app to Render. The supplied free Render configuration uses temporary SQLite storage.

## Tech stack

- **Backend:** Node.js + TypeScript + Express + GramJS (MTProto). SQLite via Node's built-in **`node:sqlite`** (no native compilation).
- **Frontend:** React + Vite + TypeScript + Tailwind CSS and Google's **Material Web** controls. Material Color Utilities generate coordinated light/dark palettes; Roboto fonts are bundled locally. Responsive layouts, file thumbnails, and saved grid/list preferences. Bilingual UI (English / Indonesian), following your browser language by default.

## Project structure

```
.
├── server/   → backend API (port 3000)
└── web/      → frontend React app (port 5173)
```

## Requirements

- **Node.js 22.5 or newer** (the backend uses the built-in `node:sqlite` module, available from Node 22.5+).
- A Telegram account, plus an **API ID & API Hash** from https://my.telegram.org.

## Getting started

Configure the Telegram application's **API ID and API Hash once on the server**. Copy `server/.env.example` to `server/.env` and set `TG_API_ID` and `TG_API_HASH`. Keep this file private. On Render, set these two values under the service's **Environment** settings instead.

1. **Backend**
   ```bash
   cd server
   npm install
   npm run dev          # API at http://localhost:3000
   ```
2. **Frontend**
   ```bash
   cd web
   npm install
   npm run dev          # open http://localhost:5173
   ```
3. Open http://localhost:5173 and enter your **Telegram phone number**, including its country code → Telegram verification code → two-step password (if enabled) → create an app **PIN**. The "TeleDrive Storage" channel is created automatically and you enter the drive immediately. API credentials are never requested in the browser.

After this one-time setup, sign in using the **same Telegram phone number**, then choose either **Telegram code** or **app PIN**. A code is sent through Telegram's login system, usually to an already signed-in Telegram app. If Telegram requires a two-step password, enter it when prompted. PIN sign-in checks both the phone number and PIN. This is a single-account personal drive: another phone number cannot create an account over the saved drive.

Sign out ends only the current browser session; it preserves the connected Telegram account, PIN, storage channel, and files. Ordinary sessions use this tab's session storage and expire after 12 hours. **Remember this device** uses local storage and extends the session to seven days. Restarting the backend invalidates all browser sessions.

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| server   | `npm run dev`       | Run the API (watch mode) |
| server   | `npm test`          | Run unit tests |
| server   | `npm run login`     | (optional) CLI login → save session to DB |
| server   | `npm run mkchannel` | (optional) Create channel → save id to DB |
| web      | `npm run dev`       | Run the frontend |
| web      | `npm run build`     | Production build |
| web      | `npm run theme:generate` | Regenerate Material 3 light/dark color tokens |

## Install the app

Use **Install app** on the login page or in the drive sidebar. Chrome and Edge can open the native installation prompt. Other browsers show installation instructions, including Safari's Add to Home Screen / Add to Dock.

The production build includes a web manifest, normal and maskable icons, and a versioned service worker. Only the public app shell and static assets are cached. Login responses, API calls, private file contents, and URLs containing tokens are never cached by the worker. Telegram login and file transfers still require a connection. Updates become active after existing app windows close so transfers are not interrupted.

## Deploy to Render

The root [render.yaml](render.yaml) and [Dockerfile](Dockerfile) deploy the frontend and backend together as one web service. The `/api/health` endpoint is used for health checks.

1. Push the completed project to a GitHub repository you own.
2. In Render, create a Blueprint from that repository and select your workspace.
3. The supplied Blueprint uses Render's free plan with `DB_PATH=/tmp/teledrive.db`. Account settings and file metadata reset when the service restarts or redeploys. Files already uploaded to Telegram remain in Telegram, but this temporary configuration does not preserve their TeleDrive index. See [Render's free service limits](https://render.com/docs/free).
4. Set `TG_API_ID` and `TG_API_HASH` in the service's **Environment** settings, save and deploy, then open its HTTPS URL and complete phone signup. Your local database and credentials are excluded from the Docker build and are not uploaded automatically. One-time signup remains saved while the database is retained; the free temporary-storage setup resets it on restarts.

For persistent hosting, upgrade to a paid compute plan, attach a disk at `/data`, set `DB_PATH=/data/teledrive.db`, and set `EPHEMERAL_STORAGE=false`. Render supports persistent disks on paid services. See [Render's disk documentation](https://render.com/docs/disks) and [current pricing](https://render.com/pricing).

Use one service instance because browser sessions, login challenges, and the Telegram client stay in process memory. A restart always signs browsers out. With a persistent disk, it preserves the saved drive connection; on the free plan, it also resets setup and the file index.

For a local production preview, first build `web`, then run the backend with `WEB_DIST_PATH` set to the absolute path of `web/dist`. Normal development still uses Vite.

## Notes

- Choose **Light**, **Dark**, or **System** under Appearance in the sidebar or on the login screen. The toolbar also provides a quick light/dark toggle. Appearance persists across reloads and System mode follows operating-system changes.
- The mobile app has bottom navigation for Files, Recents, Photos, and More, plus a floating upload action. More opens the full navigation, account, and preferences drawer. The login screen groups theme and language under **Appearance & language**.
- Material buttons and ripple state layers use the official Material Web components. Page, dialog, transfer-panel, and theme transitions honor reduced-motion preferences.
- Loading uses simple circular spinners and straight progress bars. Upload percentages reflect the browser's transfer progress; the bar becomes indeterminate while Telegram saves the file. Completion and errors stop the animation. Loading and interface transitions respect reduced-motion preferences.

- Browse **Recents**, **Photos & images**, and **Documents** across all folders, or search your entire drive instantly.
- Upload multiple files using the upload button or drag and drop. Both use the same transfer queue, with progress and failure feedback.
- Create, rename, move, and trash items using accessible dialogs and keyboard-friendly action menus. Press `/` to search and `Escape` to dismiss a dialog.
- Storage totals reflect actual file metadata; the UI does not impose or display an invented quota.

- Files are stored as messages in a private channel named **"TeleDrive Storage"**.
- Size limit: 2 GB per file (4 GB on Telegram Premium).
- Telegram credentials and your PIN are stored in SQLite (`teledrive.db`), which is **git-ignored** — never commit it.
- The PIN is stored as a salted hash. Signup requires the same verified login challenge through PIN creation, and saves the connection and PIN together once. Returning Telegram verification uses a temporary connection and checks that the verified account matches the connected drive. Login challenges expire after five minutes, and code requests and incorrect attempts are rate limited.
- For reasonable personal use only. Telegram may remove content that violates its Terms of Service, so don't rely on this as your only backup for important data.

If port 3000 is already occupied, set `PORT` before starting the server, then set `TELEDRIVE_API_URL` to that server URL before starting Vite. For example, in PowerShell use `$env:PORT='3002'` in the server terminal and `$env:TELEDRIVE_API_URL='http://localhost:3002'` in the frontend terminal.

## Security

This repository is safe to publish: secrets (`.env`, `teledrive.db`, Telegram session) are excluded via `.gitignore` and are never committed.
