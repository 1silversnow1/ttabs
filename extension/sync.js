// Keeps every task group's title in step with its tracker status.
//
// Runs on an alarm, on browser start, and on demand right after `task-tab add`.
// This file only orchestrates: where the statuses come from is `providers/`,
// what to write is `lib/plan.js`.

import { trackedGroups } from './chrome/groups.js';
import { rememberActiveTab, restoreFocus } from './chrome/focus.js';
import { readSite, readTitles, writeTitles } from './chrome/store.js';
import { planUpdates } from './lib/plan.js';
import { fetchStatuses } from './providers/jira.js';

const ALARM = 'jira-status-sync';
const PERIOD_MINUTES = 5;

const sync = async () => {
  const site = await readSite();
  if (!site) {
    console.warn('[task-tabs] no Jira site configured — run `task-tab site <url>`');
    return;
  }

  const tracked = await trackedGroups();
  if (tracked.length === 0) return;

  const keys = [...new Set(tracked.map((t) => t.key))];
  const statuses = await fetchStatuses(site, keys);
  const written = await readTitles();

  const { updates, titles } = planUpdates(tracked, statuses, written);
  for (const { groupId, title } of updates) {
    await chrome.tabGroups.update(groupId, { title });
  }

  await writeTitles(titles);
};

const runSync = () => sync().catch((e) => console.warn('[task-tabs] sync failed:', e));

const schedule = () => chrome.alarms.create(ALARM, { periodInMinutes: PERIOD_MINUTES });

chrome.runtime.onInstalled.addListener(() => {
  schedule();
  runSync();
});

chrome.runtime.onStartup.addListener(() => {
  schedule();
  runSync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) runSync();
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  rememberActiveTab(tabId, windowId).catch((e) => console.warn('[task-tabs]', e));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'sync') {
    runSync();
    return false;
  }

  if (message?.type === 'restoreFocus') {
    // The control page waits for this before closing itself, so the answer has
    // to be async — hence the `true`.
    restoreFocus(message.windowId)
      .catch((e) => console.warn('[task-tabs]', e))
      .finally(() => sendResponse(true));
    return true;
  }

  return false;
});
