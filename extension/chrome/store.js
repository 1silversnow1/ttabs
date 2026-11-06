// Everything the extension keeps between runs.

const SITE = 'site';
const TITLES = 'titles';
const ACTIVE_TABS = 'lastActiveTabs';
const SORT_GROUPS = 'sortGroups';

export const readSite = async () => {
  const stored = await chrome.storage.local.get(SITE);
  return stored[SITE] ?? '';
};

export const writeSite = async (site) => {
  await chrome.storage.local.set({ [SITE]: site.replace(/\/+$/, '') });
};

// The titles the sync wrote last time, keyed by task — the memory behind the
// "or the exact string it wrote last time" half of the ownership rule.
export const readTitles = async () => {
  const stored = await chrome.storage.local.get(TITLES);
  return stored[TITLES] ?? {};
};

export const writeTitles = async (titles) => {
  await chrome.storage.local.set({ [TITLES]: titles });
};

// Off unless `task-tab sort on` asked for it: moving groups the user arranged
// by hand is not something to do by default.
export const readSortGroups = async () => {
  const stored = await chrome.storage.local.get(SORT_GROUPS);
  return stored[SORT_GROUPS] === true;
};

export const writeSortGroups = async (on) => {
  await chrome.storage.local.set({ [SORT_GROUPS]: on });
};

// Session-scoped: which tab the user was looking at in each window. Nothing to
// carry over into the next browser run.
export const readActiveTabs = async () => {
  const stored = await chrome.storage.session.get(ACTIVE_TABS);
  return stored[ACTIVE_TABS] ?? {};
};

export const writeActiveTabs = async (byWindow) => {
  await chrome.storage.session.set({ [ACTIVE_TABS]: byWindow });
};
