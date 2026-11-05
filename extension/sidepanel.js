// Phase board for the active tab's task group. The harness bridge
// (engine/scripts/phase-bridge.mjs) owns the data and runs every action; this page draws.
const BRIDGE = 'http://127.0.0.1:47824';
const KEY = /[A-Z][A-Z0-9]*-\d+/;

let task = null;
let source = null;
let expansion = JSON.parse(localStorage.getItem('expansion') ?? '{}');
let toastTimer = null;

const $ = (id) => document.getElementById(id);

async function taskOfActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return null;
  const group = await chrome.tabGroups.get(tab.groupId);
  const found = KEY.exec(group.title ?? '');
  return found ? found[0] : null;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function toast(message) {
  const box = $('toast');
  clearTimeout(toastTimer);
  box.hidden = !message;
  box.textContent = message;
  if (message) toastTimer = setTimeout(() => toast(''), 6000);
}

function stateUrl() {
  return `${BRIDGE}/state?task=${task}&exp=${encodeURIComponent(JSON.stringify(expansion))}`;
}

async function act(name, phase) {
  try {
    const res = await fetch(`${BRIDGE}/act`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, name, phase }),
    });
    if (res.status === 403) return toast('Writes are locked: run ttabs install.sh so the bridge knows this extension.');
    const body = await res.json().catch(() => null);
    if (!body) return toast(`${name} ${phase}: refused`);
    if (!body.ok) return toast(body.message);
    toast(name === 'run' ? `Sent ${phase} to the session` : '');
    const fresh = await fetch(stateUrl());
    if (fresh.ok) draw(await fresh.json());
  } catch {
    toast('Bridge offline.');
  }
}

function toggleGroup(id, expanded, isFinished) {
  expansion = { ...expansion, [id]: { expanded: !expanded, whenFinished: isFinished } };
  localStorage.setItem('expansion', JSON.stringify(expansion));
  connect();
}

function dot(status, onClick, label) {
  const node = el(onClick ? 'button' : 'span', `dot ${status}`);
  if (status === 'done') node.textContent = '✓';
  if (status === 'skip') node.textContent = '';
  if (onClick) {
    node.title = label;
    node.onclick = onClick;
  }
  return node;
}

let menu = null;

function closeMenu() {
  menu?.remove();
  menu = null;
}

function menuItems(row) {
  if (row.optional) return [['▶', 'Run the phase', 'run'], ['+', 'Add to the task', 'add']];
  return [
    ['▶', 'Run the phase', 'run'],
    ['◉', 'In progress', 'wip'],
    ['⤼', 'Skip', 'skip'],
    ['◆', row.planned ? 'Remove from the /auto plan' : 'Plan for /auto', 'plan'],
    ['↺', 'Back to not started', 'undo'],
    ['✕', 'Drop to optional', 'drop'],
  ];
}

function openMenu(event, row) {
  event.preventDefault();
  closeMenu();
  menu = el('div', 'menu');
  menu.setAttribute('role', 'menu');
  const title = el('div', 'menu-title', row.phase);
  menu.append(title);
  for (const [glyph, label, name] of menuItems(row)) {
    const item = el('button', 'menu-item');
    item.setAttribute('role', 'menuitem');
    item.append(el('span', 'menu-glyph', glyph), el('span', '', label));
    item.onclick = () => {
      closeMenu();
      act(name, row.phase);
    };
    menu.append(item);
  }
  document.body.append(menu);
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(4, Math.min(event.clientX, window.innerWidth - width - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(event.clientY, window.innerHeight - height - 4))}px`;
}

document.addEventListener('click', closeMenu);
document.addEventListener('keydown', (event) => event.key === 'Escape' && closeMenu());
window.addEventListener('blur', closeMenu);
window.addEventListener('scroll', closeMenu, true);

function phaseRow(line, group) {
  const { row } = line;
  const status = row.optional ? 'optional' : row.status;
  const node = el('div', `row ${status}${line.parent ? ' child' : ''}${group ? ' toggle' : ''}`);
  if (group) {
    const chev = el('span', 'chev', group.expanded ? '▾' : '▸');
    chev.onclick = group.onToggle;
    node.append(chev);
  }
  const dotStatus = row.optional ? 'todo' : row.status;
  const label = row.status === 'done' || row.status === 'skip' ? 'Back to not started' : 'Mark done';
  node.append(dot(dotStatus, row.optional ? null : () => act('toggle', row.phase), label));
  const name = el('span', 'name', row.phase);
  if (group) name.onclick = group.onToggle;
  node.append(name);
  if (group) node.append(el('span', `count${group.warn ? ' warn' : ''}`, `${group.passed}/${group.total}${group.warn ? ' not closed' : ''}`));
  if (group && !group.expanded && group.current) node.append(el('span', 'hint', group.current));
  if (row.planned) node.append(el('span', 'plan-mark', '◆'));
  if (row.status !== 'done') {
    const run = el('button', 'run', '▶');
    run.title = `Run ${row.phase}: sends its prompt to the task session`;
    run.onclick = (event) => {
      event.stopPropagation();
      act('run', row.phase);
    };
    node.append(run);
  }
  node.oncontextmenu = (event) => openMenu(event, row);
  return node;
}

function groupRow(line) {
  const node = el('div', 'row toggle');
  const onToggle = () => toggleGroup(line.id, line.expanded, line.passed === line.total);
  const chev = el('span', 'chev', line.expanded ? '▾' : '▸');
  chev.onclick = onToggle;
  const name = el('span', 'name', line.id);
  name.onclick = onToggle;
  node.classList.add(line.status);
  node.append(chev, dot(line.status), name, el('span', 'count', `${line.passed}/${line.total}`));
  if (!line.expanded && line.current) node.append(el('span', 'hint', line.current));
  return node;
}

function draw({ model, lines }) {
  $('task').textContent = model.task;
  $('preset').textContent = model.preset;
  const active = model.rows.filter((r) => !r.optional);
  const passed = active.filter((r) => r.status === 'done' || r.status === 'skip').length;
  $('count').textContent = `${passed}/${active.length}`;
  $('fill').style.width = `${active.length ? (passed / active.length) * 100 : 0}%`;
  const rail = $('rail');
  rail.replaceChildren();
  for (const line of lines) {
    if (line.kind === 'stage') {
      const label = line.isFinished || line.isOptional ? '' : `${line.passed}/${line.total}`;
      const stage = el('div', `stage${line.isFinished ? ' done' : ''}`);
      stage.append(el('span', '', line.stage), el('span', '', label));
      rail.append(stage);
    } else if (line.kind === 'step') {
      const status = line.state === '' ? 'todo' : line.state;
      const node = el('div', `row child step ${status}`);
      node.append(dot(status), el('span', 'name', `${line.n}. ${line.title}`));
      rail.append(node);
    } else if (line.kind === 'group') {
      rail.append(groupRow(line));
    } else if (line.counter) {
      const { counter } = line;
      rail.append(phaseRow(line, {
        expanded: counter.expanded, passed: counter.passed, total: counter.total, warn: counter.notClosed, current: counter.current,
        onToggle: () => toggleGroup(line.id, counter.expanded, counter.passed === counter.total),
      }));
    } else {
      rail.append(phaseRow(line, null));
    }
  }
}

function connect() {
  source?.close();
  if (!task) {
    $('status').textContent = 'This tab is not in a task group.';
    return;
  }
  $('status').textContent = '';
  source = new EventSource(`${BRIDGE}/events?task=${task}&exp=${encodeURIComponent(JSON.stringify(expansion))}`);
  source.onmessage = (event) => {
    draw(JSON.parse(event.data));
    $('status').textContent = '';
  };
  source.addEventListener('failure', (event) => {
    $('status').textContent = `${task}: ${event.data}`;
  });
  source.onerror = () => {
    $('status').textContent = 'Bridge offline. It starts with a Claude session.';
  };
}

async function resolve() {
  const next = await taskOfActiveTab();
  if (next === task) return;
  task = next;
  $('rail').replaceChildren();
  connect();
}

chrome.tabs.onActivated.addListener(resolve);
chrome.tabs.onUpdated.addListener((_id, change) => {
  if ('groupId' in change || change.status === 'complete') resolve();
});
chrome.tabGroups.onUpdated.addListener(resolve);
resolve();
