import cron from 'node-cron';
import * as db from './db.js';
import { runScanCycle } from './scanner.js';
import { CATEGORIES, resolveCategory } from './categories.js';

function emptyStatus() {
  return {
    running: false,
    lastRun: null,
    lastSummary: null,
    lastError: null,
    nextRun: null,
  };
}

const statusByCategory = {};
for (const key of Object.keys(CATEGORIES)) {
  statusByCategory[key] = emptyStatus();
}

// Only one scan runs at a time across all categories - the Playwright
// scraper uses a single shared browser instance that gets closed at the end
// of each scan cycle, so concurrent cycles would fight over it.
let runningCategory = null;

let cronTask = null;

export function getStatus(categoryKey) {
  categoryKey = resolveCategory(categoryKey);
  return { ...statusByCategory[categoryKey], anyRunning: runningCategory != null };
}

export function getIntervalHours() {
  const fromSettings = db.getSetting('scan_interval_hours');
  const hours = Math.round(Number(fromSettings ?? process.env.SCAN_INTERVAL_HOURS ?? 6));
  return Math.max(1, Math.min(24, Number.isFinite(hours) ? hours : 6));
}

/** Returns the fixed hour-of-day (0-23) for a daily scheduled scan, or null if interval mode is used. */
export function getScanDailyHour() {
  const val = db.getSetting('scan_daily_hour');
  if (val === null || val === undefined) return null;
  const h = Number(val);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
}

/** Runs a scan cycle for one category and updates its status. Assumes the caller holds the run lock. */
async function runCategory(categoryKey) {
  const status = statusByCategory[categoryKey];
  runningCategory = categoryKey;
  status.running = true;
  status.lastError = null;

  try {
    status.lastSummary = await runScanCycle(categoryKey);
  } catch (err) {
    status.lastError = String(err?.message || err);
  } finally {
    status.lastRun = Date.now();
    status.running = false;
    status.nextRun = nextCronRunTime();
    runningCategory = null;
  }
}

/** Clears the in-memory "running" lock, e.g. after a fatal error that bypassed the normal catch/finally. */
export function resetRunningState(errorMessage) {
  if (runningCategory != null) {
    const status = statusByCategory[runningCategory];
    status.running = false;
    status.lastError = errorMessage;
    status.lastRun = Date.now();
    runningCategory = null;
  }
}

/** Manually triggers a scan cycle for one category. No-op if any scan is already running. */
export async function triggerScan(categoryKey) {
  categoryKey = resolveCategory(categoryKey);
  if (runningCategory != null) {
    return { started: false, reason: 'A scan is already running.' };
  }

  runCategory(categoryKey);

  return { started: true };
}

// Returns the next scheduled run time in ms.
function nextCronRunTime() {
  const dailyHour = getScanDailyHour();
  const now = new Date();
  if (dailyHour !== null) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), dailyHour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime();
  }
  const h = getIntervalHours();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  while (next.getHours() % h !== 0 || next <= now) {
    next.setHours(next.getHours() + 1);
  }
  return next.getTime();
}

function scheduleTask() {
  if (cronTask) cronTask.stop();
  const dailyHour = getScanDailyHour();
  const cronExpr = dailyHour !== null
    ? `0 ${dailyHour} * * *`
    : `0 */${getIntervalHours()} * * *`;
  cronTask = cron.schedule(cronExpr, async () => {
    if (runningCategory != null) return;
    for (const key of Object.keys(CATEGORIES)) {
      await runCategory(key);
    }
  });
}

/** Starts the recurring scan loop based on the configured interval. */
export function startScheduler() {
  scheduleTask();
  const nextRun = nextCronRunTime();
  for (const status of Object.values(statusByCategory)) {
    status.nextRun = nextRun;
  }
}

/** Re-applies the schedule after the interval setting changes. */
export function applyIntervalChange() {
  scheduleTask();
  const nextRun = nextCronRunTime();
  for (const status of Object.values(statusByCategory)) {
    status.nextRun = nextRun;
  }
}
