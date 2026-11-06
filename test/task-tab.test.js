import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const taskTab = path.join(here, '..', 'bin', 'task-tab');

// task-tab gives up silently without Chrome, so there is nothing to observe.
const noChrome = !existsSync('/Applications/Google Chrome.app');

const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

// A stand-in for macOS `open` that records the URL task-tab would hand to
// Chrome, so a test can read back which control page it asked for.
const STUB_OPEN = `#!/bin/sh
for last; do :; done
printf '%s\\n' "$last" >> "$OPEN_LOG"
`;

const withCli = (body) => {
  const home = mkdtempSync(path.join(tmpdir(), 'ttabs-cli-'));
  const stubs = path.join(home, 'stubs');
  mkdirSync(stubs);
  writeFileSync(path.join(stubs, 'open'), STUB_OPEN);
  chmodSync(path.join(stubs, 'open'), 0o755);
  writeFileSync(path.join(home, 'extension-id'), `${EXTENSION_ID}\n`);

  const openLog = path.join(home, 'open.log');
  const env = {
    ...process.env,
    PATH: `${stubs}:${process.env.PATH}`,
    TASK_TABS_HOME: home,
    OPEN_LOG: openLog,
    // task-color reports to the hub; a missing file keeps tests away from it.
    VCHASNO_HUB: path.join(home, 'missing-hub.mjs'),
  };

  const run = (...args) => spawnSync(taskTab, args, { env, encoding: 'utf8' });
  const opened = () => (existsSync(openLog) ? readFileSync(openLog, 'utf8').trim().split('\n').filter(Boolean) : []);

  try {
    body({ run, opened, home });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
};

test('color-by opens the control page with the chosen source of colour', { skip: noChrome }, () => {
  withCli(({ run, opened }) => {
    assert.equal(run('color-by', 'status').status, 0);
    assert.equal(run('color-by', 'task').status, 0);
    assert.deepEqual(opened(), [
      `chrome-extension://${EXTENSION_ID}/control.html?action=colorBy&by=status`,
      `chrome-extension://${EXTENSION_ID}/control.html?action=colorBy&by=task`,
    ]);
  });
});

test('color-by refuses anything but task or status', { skip: noChrome }, () => {
  withCli(({ run, opened }) => {
    for (const args of [['color-by'], ['color-by', 'stage']]) {
      const result = run(...args);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /usage: task-tab color-by <task\|status>/);
    }
    assert.deepEqual(opened(), []);
  });
});

test('color-by refuses the split flags, which only mean something for add', { skip: noChrome }, () => {
  withCli(({ run, opened }) => {
    const result = run('--split', 'color-by', 'status');
    assert.equal(result.status, 2);
    assert.deepEqual(opened(), []);
  });
});
