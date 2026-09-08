import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PANEL_CSS } from '../extension/qa/styles.js';

// A rule can outlive the element it was written for and nothing in a browser
// says so. The note field was restyled from a `.note` box to a `.quoted` line,
// and nothing but this would have said whether the old rule went and the new one
// arrived.
//
// The list below is written out by hand on purpose: adding a class to the panel
// has to be a deliberate edit in one place. Which is also the limit of what this
// proves — the list is trusted, not derived. The direction it does prove is the
// stylesheet's: a rule naming a class the list does not declare fails, whether
// it was never set or has stopped being.

// Set by extension/qa/panel.js.
const PANEL_CLASSES = [
  'panel',
  'collapsed',
  'dragging',
  'head',
  'task',
  'count',
  'hands-on',
  'chevron',
  'body',
  'foot',
  'area',
  'case',
  'new',
  'updated',
  'unchanged',
  'outdated',
  'row',
  'title',
  'badge',
  'full',
  'partial',
  'details',
  'expected',
  'covered',
  'quoted',
  'comment-text',
  'discrepancies',
  'discrepancy',
  'summary',
  'meta',
  'error',
  'finish-error',
  'hide-covered',
  'active',
  'criteria',
  'criterion',
  'evidence-test',
  'evidence-drive',
  'evidence-agent',
  'evidence-manual',
  'evidence-deferred',
  'done',
  'ended',
];

// Every class the stylesheet names anywhere, compounds included — a compound's
// second name is just as capable of outliving the element it was written for.
const classesNamed = (css) => {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = new Set();

  for (const [, prelude] of withoutComments.matchAll(/([^{}]+)\{/g)) {
    for (const selector of prelude.split(',')) {
      for (const compound of selector.trim().split(/[\s>+~]+/)) {
        const bare = compound.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, '');
        for (const [, name] of bare.matchAll(/\.([a-zA-Z0-9_-]+)/g)) found.add(name);
      }
    }
  }

  return [...found];
};

test('every class the stylesheet names is one the panel sets', () => {
  const known = new Set(PANEL_CLASSES);
  const unknown = classesNamed(PANEL_CSS).filter((name) => !known.has(name));
  assert.deepEqual(unknown, [], 'a rule for a class the panel never sets is either dead or a name nobody declared');
});
