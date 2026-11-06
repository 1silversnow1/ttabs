// Where task groups should stand in the tab strip, with no browser API in sight.

import { STAGE_ORDER, abbreviate } from './statuses.js';
import { prefixOf } from './titles.js';

const UNRANKED = STAGE_ORDER.length;

// How far along the board a group's task is. The status fetched this round wins;
// without one, the prefix already in the title stands in, so a task Jira did not
// answer for keeps its place instead of dropping to the end.
export const rankOf = (status, title) => {
  const prefix = status ? abbreviate(status) : prefixOf(title);
  const rank = STAGE_ORDER.indexOf(prefix);
  return rank < 0 ? UNRANKED : rank;
};

const byPosition = (a, b) => a.index - b.index;

// One window's moves. Groups of the same rank keep the order they are in, so
// the sort never shuffles tasks that sit in one column.
const planWindow = (groups) => {
  const current = [...groups].sort(byPosition);
  const wanted = [...current].sort((a, b) => a.rank - b.rank);
  if (wanted.every((group, i) => group === current[i])) return [];

  // Groups line up from where the first of them stands. Each one is moved left
  // to the cursor, so everything already placed stays put and the indexes still
  // to come only ever shift right, by the size of the group that jumped over them.
  const positions = new Map(current.map((g) => [g.id, g.index]));
  const moves = [];
  let cursor = current[0].index;

  for (const group of wanted) {
    const from = positions.get(group.id);
    if (from !== cursor) {
      moves.push({ groupId: group.id, index: cursor });
      for (const [id, index] of positions) {
        if (index >= cursor && index < from) positions.set(id, index + group.size);
      }
      positions.set(group.id, cursor);
    }
    cursor += group.size;
  }

  return moves;
};

// `groups` are the task groups as they stand: id, window, index of the first
// tab, number of tabs and rank. Returns the `chrome.tabGroups.move` calls that
// put each window's groups in board order, to be applied one after another.
export const planOrder = (groups) => {
  const byWindow = new Map();
  for (const group of groups) {
    const list = byWindow.get(group.windowId) ?? [];
    list.push(group);
    byWindow.set(group.windowId, list);
  }
  return [...byWindow.values()].flatMap(planWindow);
};
