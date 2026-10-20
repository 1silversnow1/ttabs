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
