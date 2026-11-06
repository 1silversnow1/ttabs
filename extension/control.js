// One page load performs one action, then closes the tab.
//
// Adding a command means adding an entry to ACTIONS and a branch in `task-tab`;
// nothing else in the extension has to know about it.

import { findGroup } from './chrome/groups.js';
import { writeSite, writeSortGroups } from './chrome/store.js';
import { pickPartner, rightHalf } from './lib/split.js';

// Chrome's own enum, used to reject a bad `--color` before it throws inside
// tabGroups.update. Which colour a task gets is decided by `task-color`, so the
// palette itself lives there and nowhere here.
const CHROME_COLORS = new Set([
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan',
]);

// Splitting is a nicety on top of a tab that already exists in the group: any
// failure here — Chrome older than 155, tabs that cannot be paired — leaves the
// tab as a plain one rather than losing the page.
const splitBeside = async (partner, tab) => {
  try {
    if (tab.index !== partner.index + 1) {
      await chrome.tabs.move(tab.id, { index: partner.index + 1 });
    }
    await chrome.tabs.createSplit([partner.id, tab.id]);
  } catch (e) {
    console.warn('[task-tabs] split skipped:', e);
  }
};

const activate = async (tab, focus) => {
  if (!focus) return;
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
};

const add = async (key, url, color, focus, split) => {
  const group = await findGroup(key);

  if (group) {
    const tabs = await chrome.tabs.query({ groupId: group.id });
    const existing = tabs.find((t) => t.url === url || t.pendingUrl === url);
    if (existing) {
      await activate(existing, focus);
      return;
    }

    const partner = pickPartner(tabs, split);
    const half = partner && rightHalf(tabs, partner);
    if (half) {
      // Replacing the page keeps the pair, its place in the group and the
      // left half untouched.
      await chrome.tabs.update(half.id, { url });
      await activate(half, focus);
      return;
    }
  }

  const tab = await chrome.tabs.create({ url, active: false });
  const groupId = await chrome.tabs.group(
    group ? { tabIds: tab.id, groupId: group.id } : { tabIds: tab.id },
  );

  if (!group) {
    // No colour from the caller means Chrome keeps the one it just picked.
    const properties = { title: key };
    if (CHROME_COLORS.has(color)) properties.color = color;
    await chrome.tabGroups.update(groupId, properties);
  }

  if (group && (split.last || split.prefix)) {
    const tabs = await chrome.tabs.query({ groupId: group.id });
    const partner = pickPartner(tabs.filter((t) => t.id !== tab.id), split);
    if (partner) {
      const created = await chrome.tabs.get(tab.id);
      await splitBeside(partner, created);
    }
  }

  // Without this the freshly created group would sit prefix-less until the next
  // alarm, up to five minutes away.
  chrome.runtime.sendMessage({ type: 'sync' }).catch(() => {});
};

const close = async (key) => {
  const group = await findGroup(key);
  if (!group) return;
  const tabs = await chrome.tabs.query({ groupId: group.id });
  await chrome.tabs.remove(tabs.map((t) => t.id));
};

const collapse = async (key) => {
  const group = await findGroup(key);
  if (group) await chrome.tabGroups.update(group.id, { collapsed: true });
};

const ACTIONS = {
  add: {
    required: ['group', 'url'],
    run: (p) => add(p.get('group'), p.get('url'), p.get('color'), p.get('focus') === '1', {
      last: p.get('split') === '1',
      prefix: p.get('splitWith') ?? '',
    }),
  },
  close: {
    required: ['group'],
    run: (p) => close(p.get('group')),
  },
  collapse: {
    required: ['group'],
    run: (p) => collapse(p.get('group')),
  },
  config: {
    required: ['site'],
    run: (p) => writeSite(p.get('site')),
  },
  // Turning the sort on lines the groups up right away, rather than at the next
  // status change.
  sort: {
    required: ['sort'],
    run: async (p) => {
      const on = p.get('sort') === 'on';
      await writeSortGroups(on);
      if (on) await chrome.runtime.sendMessage({ type: 'sync', reorder: true }).catch(() => {});
    },
  },
};

const run = async () => {
  const params = new URLSearchParams(location.search);
  const action = ACTIONS[params.get('action')];
  if (!action) return;
  if (action.required.some((name) => !params.get(name))) return;

  await action.run(params);
};

// Opening this page made it the active tab of whatever window the user was
// looking at. The service worker knows which tab that was, so hand focus back
// before closing — closing an inactive tab leaves the selection alone, while
// closing the active one makes Chrome pick a neighbour of its own choosing.
const handBackFocus = async (windowId) => {
  await chrome.runtime.sendMessage({ type: 'restoreFocus', windowId }).catch(() => {});
};

// The control tab must disappear even when the action threw, or a junk tab is
// left behind on the user's screen.
run()
  .catch((e) => console.error('[task-tabs]', e))
  .finally(async () => {
    const self = await chrome.tabs.getCurrent();
    if (!self) return;
    await handBackFocus(self.windowId);
    await chrome.tabs.remove(self.id);
  });
