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

test('sync opens the control page with the sync action and nothing else', { skip: noChrome }, () => {
  withCli(({ run, opened }) => {
    const result = run('sync');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(opened(), [`chrome-extension://${EXTENSION_ID}/control.html?action=sync`]);
  });
});

test('sync refuses the split flags, which only mean something for add', { skip: noChrome }, () => {
  withCli(({ run, opened }) => {
    const result = run('--split', 'sync');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /apply to add only/);
    assert.deepEqual(opened(), []);
  });
});

test('sync is a silent no-op before install.sh has recorded the extension id', { skip: noChrome }, () => {
  withCli(({ run, opened, home }) => {
    rmSync(path.join(home, 'extension-id'));
    const result = run('sync');
    assert.equal(result.status, 0);
    assert.equal(result.stdout + result.stderr, '');
    assert.deepEqual(opened(), []);
  });
});
