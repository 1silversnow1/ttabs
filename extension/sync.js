// Keeps every task group's title in step with its tracker status, and, when
// `task-tab sort on` is set, the groups themselves in board order.
//
// Runs on an alarm, on browser start, and on demand right after `task-tab add`.
// This file only orchestrates: where the statuses come from is `providers/`,
// what to write is `lib/plan.js`.

import { groupSpans, trackedGroups } from './chrome/groups.js';
import { rememberActiveTab, restoreFocus } from './chrome/focus.js';
import { readSite, readSortGroups, readTitles, writeTitles } from './chrome/store.js';
import { planOrder, rankOf } from './lib/order.js';
import { planUpdates } from './lib/plan.js';
import { fetchStatuses } from './providers/jira.js';
import './panel.js';

const ALARM = 'jira-status-sync';
const PERIOD_MINUTES = 5;

const reorder = async (tracked, statuses) => {
  const spans = await groupSpans();
  const groups = [];
  for (const { group, key } of tracked) {
    const span = spans.get(group.id);
    if (!span) continue;
    groups.push({ id: group.id, windowId: group.windowId, ...span, rank: rankOf(statuses[key], group.title ?? '') });
  }

  // Each move is planned against the strip the previous one left behind, so a
  // failure part-way stops the rest; the next change sorts from scratch.
  for (const { groupId, index } of planOrder(groups)) {
    await chrome.tabGroups.move(groupId, { index });
  }
};

// `reorder` forces a sort — the user has just turned it on. Otherwise groups
// move only when this run changed a title: a new task got its prefix or a task
// changed status. A group dragged by hand stays where it was put until then.
const sync = async ({ reorder: forced = false } = {}) => {
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

  if ((forced || updates.length > 0) && (await readSortGroups())) {
    await reorder(tracked, statuses);
  }
};

const runSync = (options) => sync(options).catch((e) => console.warn('[task-tabs] sync failed:', e));

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
    runSync({ reorder: message.reorder === true });
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
