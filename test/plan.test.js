import test from 'node:test';
import assert from 'node:assert';

import { planUpdates } from '../extension/lib/plan.js';
import { colorFor } from '../extension/lib/statuses.js';

const group = (id, title, color) => ({ group: { id, title, color }, key: title.match(/[A-Z]+-\d+/)[0] });
const byStatus = { colorByStatus: true };

test('rewrites a bare key into a prefixed title', () => {
  const tracked = [group(1, 'ACME-2253')];
  const { updates } = planUpdates(tracked, { 'ACME-2253': 'In dev' }, {});
  assert.deepEqual(updates, [{ groupId: 1, title: 'DEV|ACME-2253' }]);
});

test('leaves a title that already says the right thing', () => {
  const tracked = [group(1, 'DEV|ACME-2253')];
  const { updates } = planUpdates(tracked, { 'ACME-2253': 'In dev' }, {});
  assert.deepEqual(updates, []);
});

test('skips a group whose status did not come back', () => {
  const tracked = [group(1, 'ACME-2253')];
  const { updates } = planUpdates(tracked, {}, {});
  assert.deepEqual(updates, []);
});

test('skips a title the user typed themselves', () => {
  const tracked = [{ group: { id: 1, title: '[1] ACME-2253' }, key: 'ACME-2253' }];
  const { updates } = planUpdates(tracked, { 'ACME-2253': 'In dev' }, {});
  assert.deepEqual(updates, []);
});

test('remembers every title it decided on', () => {
  const tracked = [group(1, 'ACME-1'), group(2, 'REV|ACME-2')];
  const statuses = { 'ACME-1': 'In dev', 'ACME-2': 'In review' };
  const { titles } = planUpdates(tracked, statuses, {});
  assert.deepEqual(titles, { 'ACME-1': 'DEV|ACME-1', 'ACME-2': 'REV|ACME-2' });
});

test('forgets keys whose groups are gone', () => {
  const tracked = [group(1, 'ACME-1')];
  const written = { 'ACME-1': 'DEV|ACME-1', 'ACME-999': 'DONE|ACME-999' };
  const { titles } = planUpdates(tracked, { 'ACME-1': 'In dev' }, written);
  assert.deepEqual(titles, { 'ACME-1': 'DEV|ACME-1' });
});

test('keeps remembering a group it could not refresh this round', () => {
  const tracked = [{ group: { id: 1, title: 'NEWL|ACME-1' }, key: 'ACME-1' }];
  const written = { 'ACME-1': 'NEWL|ACME-1' };
  const { titles, updates } = planUpdates(tracked, {}, written);
  assert.deepEqual(updates, []);
  assert.deepEqual(titles, { 'ACME-1': 'NEWL|ACME-1' });
});

test('keeps updating a fallback prefix it wrote itself', () => {
  const tracked = [{ group: { id: 1, title: 'NEWL|ACME-1' }, key: 'ACME-1' }];
  const written = { 'ACME-1': 'NEWL|ACME-1' };
  const { updates } = planUpdates(tracked, { 'ACME-1': 'In dev' }, written);
  assert.deepEqual(updates, [{ groupId: 1, title: 'DEV|ACME-1' }]);
});

test('leaves the colour alone unless asked to colour by status', () => {
  const tracked = [group(1, 'DEV|ACME-1', 'pink')];
  const { updates } = planUpdates(tracked, { 'ACME-1': 'In review' }, {});
  assert.deepEqual(updates, [{ groupId: 1, title: 'REV|ACME-1' }]);
});

test('colours a group by its status when asked', () => {
  const tracked = [group(1, 'ACME-1', 'pink')];
  const { updates } = planUpdates(tracked, { 'ACME-1': 'In dev' }, {}, byStatus);
  assert.deepEqual(updates, [{ groupId: 1, title: 'DEV|ACME-1', color: 'blue' }]);
});

test('recolours a group whose title is right but whose colour is not', () => {
  const tracked = [group(1, 'REV|ACME-1', 'green')];
  const { updates } = planUpdates(tracked, { 'ACME-1': 'In review' }, {}, byStatus);
  assert.deepEqual(updates, [{ groupId: 1, title: 'REV|ACME-1', color: 'purple' }]);
});

test('leaves a group whose title and colour both match its status', () => {
  const tracked = [group(1, 'REV|ACME-1', 'purple')];
  const { updates } = planUpdates(tracked, { 'ACME-1': 'In review' }, {}, byStatus);
  assert.deepEqual(updates, []);
});

test('keeps the colour of a group the user renamed', () => {
  const tracked = [{ group: { id: 1, title: '[1] ACME-1', color: 'pink' }, key: 'ACME-1' }];
  const { updates } = planUpdates(tracked, { 'ACME-1': 'In dev' }, {}, byStatus);
  assert.deepEqual(updates, []);
});

test('gives every stage of the board its own colour', () => {
  assert.equal(colorFor('Backlog'), 'grey');
  assert.equal(colorFor('Ready for dev'), 'grey');
  assert.equal(colorFor('In progress'), 'blue');
  assert.equal(colorFor('On review'), 'purple');
  assert.equal(colorFor('Ready for test'), 'yellow');
  assert.equal(colorFor('In test'), 'yellow');
  assert.equal(colorFor('Ready for release'), 'green');
  assert.equal(colorFor('Ready'), 'green');
  assert.equal(colorFor('Closed'), 'green');
  assert.equal(colorFor('Blocked'), 'red');
});

test('marks a status nobody mapped with a colour of its own', () => {
  assert.equal(colorFor('Waiting for design'), 'cyan');
});
