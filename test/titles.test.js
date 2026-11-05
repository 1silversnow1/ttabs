import test from 'node:test';
import assert from 'node:assert';

import { abbreviate } from '../extension/lib/statuses.js';
import { keyFromTitle, titleFor, isOurTitle } from '../extension/lib/titles.js';

test('maps a known status to its prefix', () => {
  assert.equal(abbreviate('In dev'), 'DEV');
  assert.equal(abbreviate('  ready for test '), 'RQA');
});

test('falls back to the first four letters of an unmapped status', () => {
  assert.equal(abbreviate('Newly Invented'), 'NEWL');
});

test('builds the group title', () => {
  assert.equal(titleFor('ACME-2253', 'In dev'), 'DEV|ACME-2253');
  assert.equal(titleFor('ABC-7', 'On hold'), 'HOLD|ABC-7');
});

test('reads the task key out of a title', () => {
  assert.equal(keyFromTitle('DEV|ACME-2253'), 'ACME-2253');
  assert.equal(keyFromTitle('[1] ACME-2253'), 'ACME-2253');
  assert.equal(keyFromTitle('ACME-2253'), 'ACME-2253');
  assert.equal(keyFromTitle('scratch'), null);
});

// A group renamed to "ACME-2253 [2]" used to read as no task at all, so the next
// `task-tab add` built a second group beside it and split the task's tabs.
test('reads the key when the decoration comes after it', () => {
  assert.equal(keyFromTitle('ACME-2253 [2]'), 'ACME-2253');
  assert.equal(keyFromTitle('DEV|ACME-2253 [2]'), 'ACME-2253');
  assert.equal(keyFromTitle('ACME-2253 ⚠️'), 'ACME-2253');
  assert.equal(keyFromTitle('ACME-2253 (waiting on design)'), 'ACME-2253');
});

test('reads the key out of a branch-shaped title', () => {
  assert.equal(keyFromTitle('ACME-2253-empty-state-fixes'), 'ACME-2253');
});

test('takes the leftmost key when a title carries two', () => {
  assert.equal(keyFromTitle('ACME-1 / ACME-2'), 'ACME-1');
});

test('still reads nothing out of a title without a key', () => {
  assert.equal(keyFromTitle('scratch'), null);
  assert.equal(keyFromTitle(''), null);
  assert.equal(keyFromTitle('lowercase-2253'), null);
});

test('reads a release version tag as its own key', () => {
  assert.equal(keyFromTitle('v2026.08.31.01'), 'v2026.08.31.01');
  assert.equal(keyFromTitle('v2026.08.31.01 [2]'), 'v2026.08.31.01');
  assert.equal(keyFromTitle('DEV|v2026.08.31.01'), 'v2026.08.31.01');
});

test('owns a bare key and its own prefixes', () => {
  assert.equal(isOurTitle('ACME-2253', 'ACME-2253'), true);
  assert.equal(isOurTitle('DEV|ACME-2253', 'ACME-2253'), true);
  assert.equal(isOurTitle('DONE|ACME-2253', 'ACME-2253'), true);
});

test('leaves a hand-written title alone', () => {
  assert.equal(isOurTitle('[1] ACME-2253', 'ACME-2253'), false);
  assert.equal(isOurTitle('[1]|ACME-2253', 'ACME-2253'), false);
  assert.equal(isOurTitle('ACME-2253 urgent', 'ACME-2253'), false);
});

test('keeps updating a fallback prefix it wrote itself', () => {
  assert.equal(isOurTitle('NEWL|ACME-2253', 'ACME-2253', 'NEWL|ACME-2253'), true);
  assert.equal(isOurTitle('NEWL|ACME-2253', 'ACME-2253', 'DEV|ACME-2253'), false);
});

test('does not claim a group belonging to another key', () => {
  assert.equal(isOurTitle('DEV|ACME-9999', 'ACME-2253'), false);
});
