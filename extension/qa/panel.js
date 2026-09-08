// The panel's DOM, and nothing else — it renders what it is given and reports
// clicks back. Deciding what to do with a click is session.js's business.

import { groupByArea, handsOnLeftCount } from '../lib/qa-cases.js';
import { PANEL_CSS } from './styles.js';
import { makeDraggable } from '../lib/draggable.js';

const HOST_ID = 'task-tabs-qa-panel';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const details = (item) => {
  const box = el('div', 'details');

  if (item.steps.length > 0) {
    const list = el('ol');
    for (const step of item.steps) list.append(el('li', null, step));
    box.append(list);
  }

  if (item.expectedResult) box.append(el('div', 'expected', `→ ${item.expectedResult}`));

  // Which automated test already covers this case. Without it the panel gives no
  // way to tell a case that still needs a human from one that is only listed for
  // the record, and every round gets re-run by hand.
  if (item.coveredBy) box.append(el('div', 'covered', item.coveredBy));

  return box;
};

const caseRow = (item, onToggle, foldOverrides, commentText, editedIds, onComment, onCommentCommit) => {
  const wrapper = el('div', `case ${item.status}`);
  wrapper.dataset.id = item.id;

  const row = el('div', 'row');

  const checkbox = el('input');
  checkbox.type = 'checkbox';
  checkbox.checked = item.passed;
  checkbox.addEventListener('change', () => {
    // The pass state is about to change, so whatever fold the developer
    // chose under the old state no longer applies — let the new default
    // (folded once passed) take back over until they fold/unfold again.
    foldOverrides.delete(item.id);
    onToggle(item.id, checkbox.checked);
  });

  const title = el('button', 'title', item.title);
  const expanded = details(item);

  row.append(checkbox, title);
  if (item.status === 'new' || item.status === 'updated') {
    row.append(el('span', `badge ${item.status}`, item.status));
  }
  if (item.coverage === 'full') {
    row.append(el('span', 'badge full', 'covered'));
  } else if (item.coverage === 'partial') {
    row.append(el('span', 'badge partial', 'partial'));
  }

  // A draft that now matches the server's echo has already landed there —
  // whatever sent it succeeded, so keeping the draft afterwards would only
  // let it drift silently out of sync with a later external edit (e.g. the
  // same session open in another tab) instead of tracking the server.
  if (commentText.has(item.id) && commentText.get(item.id) === item.comment) {
    commentText.delete(item.id);
    editedIds.delete(item.id);
  }
  const currentComment = () => (commentText.has(item.id) ? commentText.get(item.id) : item.comment);

  const note = el('textarea', 'quoted');
  note.rows = 1;
  note.placeholder = 'note…';
  note.value = currentComment();
  const commentDisplay = el('div', 'comment-text');

  // A finished case folds away, an unfinished one shows what to do; the map
  // stores what "folded" should be, so an override reads the same way.
  let folded = foldOverrides.has(item.id) ? foldOverrides.get(item.id) : item.passed;

  // Folded, a case shows the note as a line rather than a field: the fold hides
  // what to do, never what was found.
  const applyFold = () => {
    const value = currentComment();
    expanded.hidden = folded;
    note.hidden = folded;
    commentDisplay.textContent = value;
    commentDisplay.hidden = !folded || value.trim() === '';
  };
  applyFold();

  title.addEventListener('click', () => {
    folded = !folded;
    foldOverrides.set(item.id, folded);
    applyFold();
  });

  note.addEventListener('input', () => {
    commentText.set(item.id, note.value);
    editedIds.add(item.id);
    onComment(item.id, note.value);
  });

  // An untouched field already shows the server's own text (or the local
  // draft, if one exists) — committing it on blur would just resend
  // identical text, so only a field the developer actually edited here is
  // committed.
  //
  // Losing focus must not fold the case either. The keep-alive rebuild
  // necessarily takes focus off this node, and a field folded by that is a
  // field rendered hidden — which focus() cannot restore.
  note.addEventListener('blur', () => {
    if (editedIds.has(item.id)) onCommentCommit(item.id, note.value);
  });

  wrapper.append(row, expanded, note, commentDisplay);
  return wrapper;
};

const discrepancySection = (discrepancies) => {
  const box = el('section', 'discrepancies');
  box.append(el('h2', null, 'requirement discrepancies'));

  for (const item of discrepancies) {
    const entry = el('div', 'discrepancy');
    entry.append(el('div', 'summary', `${item.id} — ${item.summary}`));
    if (item.source) entry.append(el('div', 'meta', `source: ${item.source}`));
    if (item.implemented) entry.append(el('div', 'meta', `implemented: ${item.implemented}`));
    box.append(entry);
  }

  return box;
};

const criteriaSection = (criteria) => {
  const box = el('section', 'criteria');
  box.append(el('h2', null, 'acceptance criteria'));

  for (const item of criteria) {
    const entry = el('div', 'criterion');
    entry.append(el('div', 'summary', `${item.id} — ${item.text}`));
    if (item.evidence) {
      entry.append(el('span', `badge evidence-${item.evidence}`, item.evidence));
    }
    if (item.evidence === 'deferred' && item.reason) {
      entry.append(el('div', 'meta', item.reason));
    }
    box.append(entry);
  }

  return box;
};

export const createPanel = ({ onToggle, onComment, onCommentCommit, onFinish }) => {
  const host = el('div');
  host.id = HOST_ID;
  // Closed so a script elsewhere on the page cannot reach shadowRoot to read
  // notes or forge input/click events; the panel keeps its own reference below.
  const root = host.attachShadow({ mode: 'closed' });

  // Collapsed state is UI-only and lives here, not in session.js: a poll can
  // re-render at any time and must not undo a collapse the developer just did
  // to see the page underneath.
  let collapsed = false;

  // The default fold now depends on the case itself (folded once passed,
  // open otherwise), so a single set of "folded" ids can no longer express
  // it. This map holds only the cases where the developer clicked the title
  // and overrode that default; an id absent from it just follows the
  // default for its current pass state. The checkbox handler drops a case's
  // entry the moment its pass state changes, so the new default takes back
  // over instead of carrying a stale choice made under the old state. The
  // keep-alive poll rebuilds every row on a timer and must not undo the
  // developer's explicit choice underneath them every 15 seconds.
  const foldOverrides = new Map();

  const commentText = new Map();
  const editedIds = new Set();

  // UI-only, like `collapsed` — never sent to the server, reset on reload.
  let hideCovered = false;
  let lastState = null;

  const style = el('style', null, PANEL_CSS);
  const panel = el('div', 'panel');
  // The header itself is the collapse control (a real button, so it is
  // keyboard-reachable) rather than a div wrapping its own button — nesting
  // a clickable button inside a clickable div would fire both listeners on
  // a click on the button and toggle twice, i.e. do nothing.
  const head = el('button', 'head');
  head.type = 'button';
  const task = el('span', 'task');
  const count = el('span', 'count');
  const chevron = el('span', 'chevron', '–');
  const body = el('div', 'body');
  const foot = el('div', 'foot');
  const done = el('button', 'done', 'Done');
  const hideCoveredToggle = el('button', 'hide-covered', 'Hide covered');
  hideCoveredToggle.type = 'button';
  hideCoveredToggle.setAttribute('aria-pressed', 'false');
  const finishError = el('div', 'error finish-error');
  finishError.hidden = true;

  const applyCollapsed = () => {
    body.hidden = collapsed;
    foot.hidden = collapsed;
    panel.classList.toggle('collapsed', collapsed);
    head.setAttribute('aria-label', collapsed ? 'expand' : 'collapse');
    // Collapsed, the header shrinks to an icon-only square — the task and
    // count text disappear visually (CSS) but stay reachable as the title
    // tooltip so hovering still answers "what session is this".
    chevron.textContent = collapsed ? '📋' : '–';
    head.title = collapsed ? `${task.textContent} — ${count.textContent}` : '';
  };

  const drag = makeDraggable(panel, head);

  head.addEventListener('click', () => {
    // The header is the drag handle as well as the collapse control, and a drag
    // ends in a click on it — without this, moving the panel would fold it too.
    if (drag.moved()) return;
    collapsed = !collapsed;
    applyCollapsed();
  });

  done.addEventListener('click', onFinish);
  hideCoveredToggle.addEventListener('click', () => {
    hideCovered = !hideCovered;
    hideCoveredToggle.classList.toggle('active', hideCovered);
    hideCoveredToggle.setAttribute('aria-pressed', String(hideCovered));
    if (lastState) panelApi.render(lastState);
  });
  head.append(task, count, chevron);
  foot.append(finishError, hideCoveredToggle, done);
  panel.append(head, body, foot);
  root.append(style, panel);
  document.documentElement.append(host);

  const panelApi = {
    render(state) {
      lastState = state;
      task.textContent = state.task;
      const passed = state.cases.filter((c) => c.passed).length;
      const handsOnLeft = handsOnLeftCount(state.cases);
      count.replaceChildren(document.createTextNode(`${passed}/${state.cases.length}`));
      if (handsOnLeft > 0) {
        count.append(
          document.createTextNode(' · '),
          el('span', 'hands-on', `${handsOnLeft} hands-on left`),
        );
      }

      const knownIds = new Set(state.cases.map((c) => c.id));
      for (const id of foldOverrides.keys()) {
        if (!knownIds.has(id)) foldOverrides.delete(id);
      }
      for (const id of commentText.keys()) {
        if (!knownIds.has(id)) commentText.delete(id);
      }
      for (const id of editedIds) {
        if (!knownIds.has(id)) editedIds.delete(id);
      }

      const scrollTop = body.scrollTop;

      const focused = root.activeElement;
      const typing = focused?.classList.contains('quoted')
        ? {
            id: focused.closest('.case').dataset.id,
            start: focused.selectionStart,
            end: focused.selectionEnd,
          }
        : null;

      // A pass state flipped from outside this tab would otherwise fold the very
      // field being typed into, and a hidden field cannot take the focus back.
      if (typing) foldOverrides.set(typing.id, false);

      body.replaceChildren();
      for (const group of groupByArea(state.cases)) {
        const visible = hideCovered ? group.cases.filter((c) => c.coverage !== 'full') : group.cases;
        if (visible.length === 0) continue;
        body.append(el('div', 'area', group.area));
        for (const item of visible) {
          body.append(caseRow(item, onToggle, foldOverrides, commentText, editedIds, onComment, onCommentCommit));
        }
      }
      if (state.discrepancies.length > 0) body.append(discrepancySection(state.discrepancies));
      if (state.criteria.length > 0) body.append(criteriaSection(state.criteria));
      body.scrollTop = scrollTop;

      if (typing) {
        const restored = body.querySelector(`.case[data-id="${CSS.escape(typing.id)}"] .quoted`);
        if (restored) {
          restored.focus();
          restored.setSelectionRange(typing.start, typing.end);
        }
      }

      applyCollapsed();
    },

    showError(id, message) {
      const row = body.querySelector(`.case[data-id="${CSS.escape(id)}"]`);
      if (!row) return;
      const existing = row.querySelector('.error');
      if (existing) existing.remove();
      row.append(el('div', 'error', message));
    },

    // A finish failure has no single row to attach to — cases: [] is a valid
    // session — so it goes beside Done instead. Expanding on error rather than
    // leaving it silently behind a collapsed panel.
    showFinishError(message) {
      finishError.textContent = message;
      finishError.hidden = false;
      if (collapsed) {
        collapsed = false;
        applyCollapsed();
      }
    },

    clearFinishError() {
      finishError.hidden = true;
      finishError.textContent = '';
    },

    showEnded() {
      body.replaceChildren(el('div', 'ended', 'session ended'));
      foot.hidden = true;
    },

    destroy() {
      host.remove();
    },
  };

  return panelApi;
};
