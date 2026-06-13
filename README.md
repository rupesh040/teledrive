# 📦 TeleDrive

A personal Google Drive powered by **Telegram Cloud** — it looks and works like Google Drive (folders, upload, download, preview, search), but the actual files live in your own Telegram account (a private channel) used as a free "hard disk".

Runs **100% locally** on your machine. It only needs the internet to talk to Telegram.

## Tech stack

- **Backend:** Node.js + TypeScript + Express + GramJS (MTProto). SQLite via Node's built-in **`node:sqlite`** (no native compilation).
- **Frontend:** React + Vite + TypeScript + Tailwind CSS — modern dark theme with sidebar, search, thumbnails, and a grid/list toggle. Bilingual UI (English / Indonesian).

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

Telegram credentials are entered **through the login page in the web app** — not via `.env`.

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
3. Open http://localhost:5173 and follow the onboarding wizard: enter your **API ID & API Hash** (from https://my.telegram.org) and phone number → OTP → 2FA (if enabled) → set an app **PIN**. The "TeleDrive Storage" channel is created automatically.

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| server   | `npm run dev`       | Run the API (watch mode) |
| server   | `npm test`          | Run unit tests |
| server   | `npm run login`     | (optional) CLI login → save session to DB |
| server   | `npm run mkchannel` | (optional) Create channel → save id to DB |
| web      | `npm run dev`       | Run the frontend |
| web      | `npm run build`     | Production build |

## Notes

- Files are stored as messages in a private channel named **"TeleDrive Storage"**.
- Size limit: 2 GB per file (4 GB on Telegram Premium).
- Telegram credentials and your PIN are stored in SQLite (`teledrive.db`), which is **git-ignored** — never commit it.
- For reasonable personal use only. Telegram may remove content that violates its Terms of Service, so don't rely on this as your only backup for important data.

## Security

This repository is safe to publish: secrets (`.env`, `teledrive.db`, Telegram session) are excluded via `.gitignore` and are never committed.
