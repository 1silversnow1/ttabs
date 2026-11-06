import test from 'node:test';
import assert from 'node:assert';

import { planOrder, rankOf } from '../extension/lib/order.js';

// A window's tab strip, written left to right: a group is `PREFIX|KEY xN` (N
// tabs, 1 when omitted), a tab outside any group is `-`. The rank comes from the
// prefix, as it would from a fresh status of the same stage.
const strip = (windowId, ...blocks) => {
  const tabs = [];
  for (const block of blocks) {
    if (block === '-') {
      tabs.push(null);
      continue;
    }
    const [title, count = '1'] = block.split(' x');
    for (let i = 0; i < Number(count); i++) tabs.push(title);
  }
  return { windowId, tabs };
};

const groupsOf = ({ windowId, tabs }) => {
  const groups = [];
  tabs.forEach((title, index) => {
    if (!title) return;
    const last = groups.at(-1);
    if (last?.id === title && last.index + last.size === index) {
      last.size += 1;
      return;
    }
    groups.push({ id: title, windowId, index, size: 1, rank: rankOf(null, title) });
  });
  return groups;
};

// What chrome.tabGroups.move does for a move to the left: the group's tabs come
// out and go back in so that its first tab lands on `index`.
const applyMoves = ({ windowId, tabs }, moves) => {
  let result = [...tabs];
  for (const { groupId, index } of moves) {
    const moved = result.filter((t) => t === groupId);
    const firstAt = result.indexOf(groupId);
    assert.ok(index <= firstAt, `${groupId} is only ever moved left`);
    result = result.filter((t) => t !== groupId);
    result.splice(index, 0, ...moved);
  }
  return { windowId, tabs: result };
};

const titlesIn = ({ tabs }) => tabs.filter((t, i) => t !== tabs[i - 1]).map((t) => t ?? '-');

const sortStrip = (window) => applyMoves(window, planOrder(groupsOf(window)));

test('leaves groups that already stand in board order alone', () => {
  const window = strip(1, 'DEV|ACME-1', 'REV|ACME-2 x2', 'QA|ACME-3');
  assert.deepEqual(planOrder(groupsOf(window)), []);
});

test('does not gather groups that are in order but have loose tabs between them', () => {
  const window = strip(1, 'DEV|ACME-1', '-', 'QA|ACME-3');
  assert.deepEqual(planOrder(groupsOf(window)), []);
});

test('puts a released task before the ones already done', () => {
  const window = strip(1,
    'DEV|HRS-2956', 'DEV|HRS-2996', 'DEV|HRS-2997',
    'RQA|HRS-2983', 'RQA|HRS-2603', 'RQA|HRS-2817', 'RQA|HRS-2870',
    'RDY|HRS-2340', 'REL|HRS-2902', 'RDY|HRS-2789', 'RDY|HRS-2782');
  assert.deepEqual(titlesIn(sortStrip(window)), [
    'DEV|HRS-2956', 'DEV|HRS-2996', 'DEV|HRS-2997',
    'RQA|HRS-2983', 'RQA|HRS-2603', 'RQA|HRS-2817', 'RQA|HRS-2870',
    'REL|HRS-2902', 'RDY|HRS-2340', 'RDY|HRS-2789', 'RDY|HRS-2782',
  ]);
});

test('moves a new task in development up to the others in development', () => {
  const window = strip(1, 'DEV|ACME-1 x3', 'QA|ACME-2 x2', 'DONE|ACME-3', 'DEV|ACME-4 x2');
  assert.deepEqual(titlesIn(sortStrip(window)), ['DEV|ACME-1', 'DEV|ACME-4', 'QA|ACME-2', 'DONE|ACME-3']);
});

test('keeps groups of one stage in the order they were in', () => {
  const window = strip(1, 'QA|ACME-3', 'DEV|ACME-1', 'QA|ACME-2', 'DEV|ACME-4');
  assert.deepEqual(titlesIn(sortStrip(window)), ['DEV|ACME-1', 'DEV|ACME-4', 'QA|ACME-3', 'QA|ACME-2']);
});

test('lines groups up from where the first one stands, past loose tabs', () => {
  const window = strip(1, '-', '-', 'QA|ACME-2', '-', 'DEV|ACME-1 x2');
  assert.deepEqual(titlesIn(sortStrip(window)), ['-', 'DEV|ACME-1', 'QA|ACME-2', '-']);
});

test('keeps every tab of every group, in the same count', () => {
  const window = strip(1, 'DONE|ACME-1 x4', '-', 'REV|ACME-2 x3', 'BL|ACME-3', 'HOLD|ACME-4 x2');
  const sorted = sortStrip(window);
  assert.equal(sorted.tabs.length, window.tabs.length);
  assert.deepEqual(titlesIn(sorted), ['BL|ACME-3', 'REV|ACME-2', 'DONE|ACME-1', 'HOLD|ACME-4', '-']);
});

test('sorts each window on its own', () => {
  const left = strip(1, 'QA|ACME-1', 'DEV|ACME-2');
  const right = strip(2, 'DEV|ACME-3', 'QA|ACME-4');
  const moves = planOrder([...groupsOf(left), ...groupsOf(right)]);
  assert.deepEqual(moves, [{ groupId: 'DEV|ACME-2', index: 0 }]);
});

test('ranks by the status that came back, not by the prefix it replaces', () => {
  assert.ok(rankOf('In test', 'DEV|ACME-1') > rankOf('In dev', 'QA|ACME-2'));
});

test('falls back to the prefix in the title when the status did not come back', () => {
  assert.equal(rankOf(undefined, 'QA|ACME-1'), rankOf('In test', 'ACME-1'));
});

test('sends a status nobody mapped, or a title with no prefix, to the end', () => {
  const last = rankOf('On hold', 'ACME-1');
  assert.ok(rankOf('Waiting for design', 'ACME-1') > last);
  assert.ok(rankOf(undefined, '[1] ACME-1') > last);
});
