// Everything the extension keeps between runs.

const SITE = 'site';
const TITLES = 'titles';
const ACTIVE_TABS = 'lastActiveTabs';
const COLOR_BY = 'colorBy';

// What decides a group's colour: 'task' — the colour `task-color` picked, which
// the terminal shares — or 'status', the stage the task is in.
export const COLOR_BY_VALUES = ['task', 'status'];

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

export const readColorBy = async () => {
  const stored = await chrome.storage.local.get(COLOR_BY);
  return stored[COLOR_BY] ?? 'task';
};

export const writeColorBy = async (value) => {
  await chrome.storage.local.set({ [COLOR_BY]: value });
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
