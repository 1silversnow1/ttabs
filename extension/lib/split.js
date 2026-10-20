// Which tab a new one is split beside, and which half of a finished pair is
// the one to replace. Pure, so it can be tested without a browser.

const SPLIT_NONE = -1;

const urlOf = (tab) => tab.url || tab.pendingUrl || '';

export const pickPartner = (tabs, { last = false, prefix = '' }) => {
  if (prefix) return tabs.find((t) => urlOf(t).startsWith(prefix)) ?? null;
  if (!last) return null;
  return tabs.reduce((right, t) => (!right || t.index > right.index ? t : right), null);
};

// The right half is the one that gets a new page: the left one is the app being
// checked, the right one is the checklist beside it.
export const rightHalf = (tabs, partner) => {
  if (partner.splitViewId === undefined || partner.splitViewId === SPLIT_NONE) return null;
  const pair = tabs.filter((t) => t.splitViewId === partner.splitViewId);
  return pair.reduce((right, t) => (!right || t.index > right.index ? t : right), null);
};
