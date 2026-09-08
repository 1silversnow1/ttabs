import test from 'node:test';
import assert from 'node:assert';

import {
  UNGROUPED,
  normalizeState,
  groupByArea,
  uncheckedCount,
  handsOnLeftCount,
  applyPassed,
  matchesTask,
  finishWarning,
} from '../extension/lib/qa-cases.js';

const payload = () => ({
  task: 'ACME-1234',
  cases: [
    {
      id: 'TC-1',
      title: 'opens the form',
      steps: ['click add', 'see the form'],
      expectedResult: 'the form is open',
      area: 'forms',
      status: 'new',
      passed: false,
    },
    {
      id: 'TC-2',
      title: 'saves the form',
      steps: [],
      expectedResult: 'a row appears',
      area: 'forms',
      status: 'outdated',
      passed: true,
    },
    {
      id: 'TC-3',
      title: 'shows the list',
      steps: [],
      expectedResult: 'rows are listed',
      area: 'list',
      status: 'unchanged',
      passed: false,
    },
  ],
  discrepancies: [
    { id: 'D-1', summary: 'no empty state', source: 'comment', implemented: 'renders nothing' },
  ],
});

test('normalises a well-formed payload unchanged', () => {
  const state = normalizeState(payload());
  assert.equal(state.task, 'ACME-1234');
  assert.equal(state.cases.length, 3);
  assert.equal(state.discrepancies.length, 1);
});

test('rejects a payload that is not a session', () => {
  assert.equal(normalizeState(null), null);
  assert.equal(normalizeState({}), null);
  assert.equal(normalizeState({ task: 'ACME-1' }), null);
  assert.equal(normalizeState({ cases: [] }), null);
});

test('accepts a session with no cases yet', () => {
  const state = normalizeState({ task: 'ACME-1', cases: [] });
  assert.deepEqual(state, { task: 'ACME-1', cases: [], discrepancies: [], criteria: [] });
});

test('drops cases without an id or a title', () => {
  const raw = payload();
  raw.cases.push({ title: 'no id' }, { id: 'TC-9' });
  const state = normalizeState(raw);
  assert.deepEqual(state.cases.map((c) => c.id), ['TC-1', 'TC-2', 'TC-3']);
});

test('fills in the parts a case may be missing', () => {
  const state = normalizeState({ task: 'ACME-1', cases: [{ id: 'TC-1', title: 'bare' }] });
  assert.deepEqual(state.cases[0], {
    id: 'TC-1',
    title: 'bare',
    steps: [],
    expectedResult: '',
    area: UNGROUPED,
    status: 'unchanged',
    passed: false,
    comment: '',
    coveredBy: '',
    coverage: 'none',
  });
});

test('carries a comment through', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [{ id: 'TC-1', title: 'x', comment: 'flaky on retry' }],
  });
  assert.equal(state.cases[0].comment, 'flaky on retry');
});

test('carries the automated-test coverage through', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [{ id: 'TC-1', title: 'x', coveredBy: 'e2e: spec.ts › "does the thing"' }],
  });
  assert.equal(state.cases[0].coveredBy, 'e2e: spec.ts › "does the thing"');
});

test('defaults a missing comment to an empty string', () => {
  const state = normalizeState({ task: 'ACME-1', cases: [{ id: 'TC-1', title: 'x' }] });
  assert.equal(state.cases[0].comment, '');
});

test('drops a non-string comment', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [{ id: 'TC-1', title: 'x', comment: 42 }],
  });
  assert.equal(state.cases[0].comment, '');
});

test('keeps an unknown status out of the case', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [{ id: 'TC-1', title: 'x', status: 'weird' }],
  });
  assert.equal(state.cases[0].status, 'unchanged');
});

test('groups cases by area in first-appearance order', () => {
  const state = normalizeState(payload());
  assert.deepEqual(
    groupByArea(state.cases).map((g) => [g.area, g.cases.map((c) => c.id)]),
    [['forms', ['TC-1', 'TC-2']], ['list', ['TC-3']]],
  );
});

test('counts only the cases not marked passed', () => {
  const state = normalizeState(payload());
  assert.equal(uncheckedCount(state.cases), 2);
});

test('applies a toggle without touching the original state', () => {
  const state = normalizeState(payload());
  const next = applyPassed(state, 'TC-1', true);
  assert.equal(next.cases[0].passed, true);
  assert.equal(state.cases[0].passed, false);
});

test('ignores a toggle for an id it does not know', () => {
  const state = normalizeState(payload());
  const next = applyPassed(state, 'TC-404', true);
  assert.deepEqual(next.cases, state.cases);
});

test('matchesTask rejects a null or empty key', () => {
  const state = normalizeState(payload());
  assert.equal(matchesTask(state, null), false);
  assert.equal(matchesTask(state, ''), false);
});

test('matchesTask rejects a different task', () => {
  const state = normalizeState(payload());
  assert.equal(matchesTask(state, 'ACME-9999'), false);
});

test('matchesTask accepts the same task', () => {
  const state = normalizeState(payload());
  assert.equal(matchesTask(state, 'ACME-1234'), true);
});

test('warns about the cases still unchecked', () => {
  const state = normalizeState(payload());
  assert.equal(finishWarning(state.cases), '2 cases not marked passed — finish anyway?');
});

test('warns in the singular for one unchecked case', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [{ id: 'TC-1', title: 'x' }, { id: 'TC-2', title: 'y', passed: true }],
  });
  assert.equal(finishWarning(state.cases), '1 case not marked passed — finish anyway?');
});

test('does not warn when everything is checked', () => {
  const state = normalizeState({ task: 'ACME-1', cases: [{ id: 'TC-1', title: 'x', passed: true }] });
  assert.equal(finishWarning(state.cases), null);
});

test('carries a recognized coverage value through', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [
      { id: 'TC-1', title: 'a', coverage: 'full' },
      { id: 'TC-2', title: 'b', coverage: 'partial' },
      { id: 'TC-3', title: 'c', coverage: 'none' },
    ],
  });
  assert.deepEqual(state.cases.map((c) => c.coverage), ['full', 'partial', 'none']);
});

test('defaults an unrecognized or missing coverage value to "none"', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [
      { id: 'TC-1', title: 'a', coverage: 'covered somehow' },
      { id: 'TC-2', title: 'b' },
    ],
  });
  assert.deepEqual(state.cases.map((c) => c.coverage), ['none', 'none']);
});

test('normalizes a well-formed criteria array', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [],
    criteria: [{ id: 'AC-1', text: 'a doc can be created', evidence: 'manual', reason: '' }],
  });
  assert.deepEqual(state.criteria, [
    { id: 'AC-1', text: 'a doc can be created', evidence: 'manual', reason: '' },
  ]);
});

test('drops a criterion missing an id or text', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [],
    criteria: [{ text: 'no id' }, { id: 'AC-2' }, { id: 'AC-3', text: 'kept' }],
  });
  assert.deepEqual(state.criteria.map((c) => c.id), ['AC-3']);
});

test('defaults a missing or unrecognized criterion evidence to an empty string', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [],
    criteria: [{ id: 'AC-1', text: 'x', evidence: 'made up' }, { id: 'AC-2', text: 'y' }],
  });
  assert.deepEqual(state.criteria.map((c) => c.evidence), ['', '']);
});

test('accepts "agent" as a recognized criterion evidence value', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [],
    criteria: [{ id: 'AC-1', text: 'x', evidence: 'agent' }],
  });
  assert.equal(state.criteria[0].evidence, 'agent');
});

test('defaults criteria to an empty array when the key is absent', () => {
  const state = normalizeState({ task: 'ACME-1', cases: [] });
  assert.deepEqual(state.criteria, []);
});

test('handsOnLeftCount counts unpassed cases that are not fully covered', () => {
  const state = normalizeState({
    task: 'ACME-1',
    cases: [
      { id: 'TC-1', title: 'a', coverage: 'full', passed: false },
      { id: 'TC-2', title: 'b', coverage: 'partial', passed: false },
      { id: 'TC-3', title: 'c', coverage: 'none', passed: false },
      { id: 'TC-4', title: 'd', coverage: 'none', passed: true },
    ],
  });
  assert.equal(handsOnLeftCount(state.cases), 2);
});
