import { keyFromTitle } from '../lib/titles.js';

// A group is matched by the task key in its title rather than by the whole
// title, which carries a status prefix ("DEV|ACME-2261") once the sync has run.
export const trackedGroups = async () => {
  const groups = await chrome.tabGroups.query({});
  const tracked = [];
  for (const group of groups) {
    const key = keyFromTitle(group.title ?? '');
    if (key) tracked.push({ group, key });
  }
  return tracked;
};

export const findGroup = async (key) => {
  const tracked = await trackedGroups();
  return tracked.find((t) => t.key === key)?.group ?? null;
};

// Where each group starts and how many tabs it holds, by group id. Chrome keeps
// a group's tabs contiguous, so the first index and the count are its span.
export const groupSpans = async () => {
  const tabs = await chrome.tabs.query({});
  const spans = new Map();
  for (const tab of tabs) {
    if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) continue;
    const span = spans.get(tab.groupId);
    if (span) {
      span.index = Math.min(span.index, tab.index);
      span.size += 1;
    } else {
      spans.set(tab.groupId, { index: tab.index, size: 1 });
    }
  }
  return spans;
};
