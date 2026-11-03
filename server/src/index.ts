import express from 'express';
import { config } from './config.js';
import { foldersRouter } from './routes/folders.js';
import { filesRouter } from './routes/files.js';
import { setupRouter } from './routes/setup.js';
import { authRouter } from './routes/auth.js';
import { accountRouter } from './routes/account.js';
import { requireAuth } from './auth/middleware.js';
import { createCors } from './http/cors.js';
import { serveFrontend } from './http/frontend.js';

const app = express();
app.use(createCors(config.allowedOrigins));
app.use(express.json());

// Open: screen selection & login flow.
app.use('/api/setup', setupRouter);
app.use('/api/auth', authRouter);
app.use('/api/account', accountRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Locked: requires a token obtained through Telegram verification or the app PIN.
app.use('/api/folders', requireAuth, foldersRouter);
app.use('/api/files', requireAuth, filesRouter);

serveFrontend(app, process.env.WEB_DIST_PATH);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`TeleDrive server running at http://localhost:${config.port}`);
});
