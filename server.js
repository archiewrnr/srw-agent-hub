import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRouter from './routes/api.js';
import { startScheduler, resetRunningState } from './src/scheduler.js';
import * as db from './src/db.js'; // also ensures schema is initialized

// A previous process may have crashed mid-scan, leaving a 'running' row behind.
db.markStaleRunsAsFailed('Interrupted by server restart');

// Keep the dashboard alive even if a scrape/scoring step throws somewhere
// that isn't caught by runScanCycle's own try/catch (e.g. a stray promise).
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err);
  resetRunningState(String(err?.message || err));
});
process.on('unhandledRejection', (err) => {
  console.error('[fatal] unhandledRejection:', err);
  resetRunningState(String(err?.message || err));
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use('/api', apiRouter);
app.use(express.static(path.join(__dirname, 'public')));

// Agent Hub home redirect
app.get('/', (_req, res) => res.redirect('/home.html'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Earth & Essence Opportunity Finder running at http://localhost:${PORT}`);
  startScheduler();
});
