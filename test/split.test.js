import test from 'node:test';
import assert from 'node:assert';

import { pickPartner, rightHalf } from '../extension/lib/split.js';

const tab = (id, index, url, splitViewId = -1) => ({ id, index, url, splitViewId });

const tabs = [
  tab(1, 4, 'https://acme.atlassian.net/browse/ACME-1'),
  tab(2, 5, 'http://localhost:3000/'),
  tab(3, 6, 'http://localhost:4000/qa'),
];

test('pairs with the rightmost tab when asked for the last one', () => {
  assert.equal(pickPartner(tabs, { last: true }).id, 3);
});

test('reads the rightmost tab by index, not by array order', () => {
  assert.equal(pickPartner([...tabs].reverse(), { last: true }).id, 3);
});

test('pairs with the first tab whose url starts with the prefix', () => {
  assert.equal(pickPartner(tabs, { prefix: 'http://localhost' }).id, 2);
});

test('falls back to pendingUrl for a tab that has not committed yet', () => {
  const loading = [{ id: 9, index: 0, url: '', pendingUrl: 'http://localhost:3000/', splitViewId: -1 }];
  assert.equal(pickPartner(loading, { prefix: 'http://localhost:3000' }).id, 9);
});

test('finds no partner when the prefix matches nothing', () => {
  assert.equal(pickPartner(tabs, { prefix: 'https://nowhere' }), null);
});

test('finds no partner in an empty group', () => {
  assert.equal(pickPartner([], { last: true }), null);
});

test('finds no partner when no mode was asked for', () => {
  assert.equal(pickPartner(tabs, {}), null);
});

test('rightHalf is null for a tab that is not split', () => {
  assert.equal(rightHalf(tabs, tabs[1]), null);
});

test('rightHalf returns the other tab of the pair when the partner is on the left', () => {
  const pair = [tab(1, 0, 'a'), tab(2, 1, 'b', 7), tab(3, 2, 'c', 7)];
  assert.equal(rightHalf(pair, pair[1]).id, 3);
});

test('rightHalf returns the tab itself when the partner is the right one', () => {
  const pair = [tab(1, 0, 'a'), tab(2, 1, 'b', 7), tab(3, 2, 'c', 7)];
  assert.equal(rightHalf(pair, pair[2]).id, 3);
});
