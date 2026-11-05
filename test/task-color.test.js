import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, utimesSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const taskColor = path.join(here, '..', 'bin', 'task-color');

// The palette, in the order task-color hands it out.
const PALETTE = ['blue', 'green', 'purple', 'yellow', 'red', 'grey'];

// The stub hub appends each call's arguments as one line, so a test can read
// back what task-color reported. Tests never reach the real hub.
const STUB_HUB = `
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.HUB_LOG, process.argv.slice(2).join(' ') + '\\n');
`;

const withStore = (body, { hub = 'stub' } = {}) => {
  const home = mkdtempSync(path.join(tmpdir(), 'ttabs-'));
  const hubLog = path.join(home, 'hub.log');
  let hubPath = path.join(home, 'missing-hub.mjs');
  if (hub === 'stub') {
    hubPath = path.join(home, 'hub.mjs');
    writeFileSync(hubPath, STUB_HUB);
  }
  if (hub === 'failing') {
    hubPath = path.join(home, 'hub.mjs');
    writeFileSync(hubPath, "console.log('noise'); console.error('boom'); process.exit(3);");
  }
  const env = { ...process.env, TASK_TABS_HOME: home, VCHASNO_HUB: hubPath, HUB_LOG: hubLog };
  const runRaw = (...args) => execFileSync(taskColor, args, { env }).toString();
  const run = (...args) => runRaw(...args).trim();

  // The hub is called in the background, so wait for the expected number of lines.
  const hubCalls = (count) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const lines = existsSync(hubLog) ? readFileSync(hubLog, 'utf8').trim().split('\n').filter(Boolean) : [];
      if (lines.length >= count) return lines;
      execFileSync('sleep', ['0.05']);
    }
    throw new Error(`hub got fewer than ${count} calls`);
  };

  const colors = path.join(home, 'colors');
  // mtime is what marks a reservation as recently used, and a whole test runs
  // inside one second — so tests that care about age set it themselves.
  const age = (key, secondsAgo) => {
    const when = new Date(Date.now() - secondsAgo * 1000);
    utimesSync(path.join(colors, key), when, when);
  };

  try {
    body({ run, runRaw, age, colors, hubCalls });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
};

test('gives different colours to different tasks', () => {
  withStore(({ run }) => {
    const first = run('--chrome', 'ACME-1');
    const second = run('--chrome', 'ACME-2');
    assert.notEqual(first, second);
  });
});

test('remembers a colour it already handed out', () => {
  withStore(({ run }) => {
    const first = run('--chrome', 'ACME-1');
    assert.equal(run('--chrome', 'ACME-1'), first);
    assert.equal(run('--emoji', 'ACME-1'), run('--emoji', 'ACME-1'));
  });
});

test('returns a released colour to the pool', () => {
  withStore(({ run }) => {
    const first = run('--chrome', 'ACME-1');
    run('--release', 'ACME-1');
    assert.equal(run('--chrome', 'ACME-2'), first);
  });
});

test('hands out the whole palette before repeating', () => {
  withStore(({ run }) => {
    const given = PALETTE.map((_, i) => run('--chrome', `ACME-${i}`));
    assert.deepEqual([...given].sort(), [...PALETTE].sort());
  });
});

// Reading a colour is what marks a task as live, so these fill the palette once
// and keep the answers rather than asking again.
const fillPalette = (run) => {
  const given = {};
  PALETTE.forEach((_, i) => {
    given[`ACME-${i}`] = run('--chrome', `ACME-${i}`);
  });
  return given;
};

test('takes the colour of the task nobody has asked about in longest', () => {
  withStore(({ run, age, colors }) => {
    const given = fillPalette(run);

    age('ACME-0', 60);
    age('ACME-3', 3600); // the stalest — most likely finished
    age('ACME-5', 120);

    const fresh = run('--chrome', 'ACME-99');

    assert.equal(fresh, given['ACME-3'], 'the new task should inherit the stalest colour');
    assert.equal(existsSync(path.join(colors, 'ACME-3')), false, 'stale reservation is gone');
    assert.equal(readdirSync(colors).length, PALETTE.length, 'the store does not grow past the palette');
  });
});

test('asking about a task keeps it from being the one taken over', () => {
  withStore(({ run, age }) => {
    const given = fillPalette(run);

    age('ACME-0', 3600);
    age('ACME-1', 1800);
    // ACME-0 was the stalest until this read stamped it as live again.
    run('--chrome', 'ACME-0');

    const fresh = run('--chrome', 'ACME-99');

    assert.notEqual(fresh, given['ACME-0'], 'a task just asked about keeps its colour');
    assert.equal(fresh, given['ACME-1'], 'the next stalest is taken over instead');
  });
});

test('reports the first assignment, --set and --release to the hub', () => {
  withStore(({ run, hubCalls }) => {
    const first = run('--chrome', 'ACME-1');
    assert.deepEqual(hubCalls(1), [`task-color ACME-1 ${first}`]);

    run('--chrome', 'ACME-1');
    run('--set', 'red', 'ACME-1');
    assert.deepEqual(hubCalls(2), [`task-color ACME-1 ${first}`, 'task-color ACME-1 red']);

    run('--release', 'ACME-1');
    assert.deepEqual(hubCalls(3).at(-1), 'task-color ACME-1 none');
  });
});

test('reports a takeover as none for the old task, then the colour for the new one', () => {
  withStore(({ run, age, hubCalls }) => {
    const given = fillPalette(run);
    hubCalls(PALETTE.length);
    age('ACME-3', 3600);

    run('--chrome', 'ACME-99');

    const lines = hubCalls(PALETTE.length + 2);
    assert.deepEqual(lines.slice(-2), ['task-color ACME-3 none', `task-color ACME-99 ${given['ACME-3']}`]);
  });
});

for (const hub of ['missing', 'failing']) {
  test(`a ${hub} hub changes neither output nor exit code`, () => {
    withStore(({ runRaw }) => {
      assert.equal(runRaw('ACME-1'), 'blue 🟦\n');
      assert.equal(runRaw('--set', 'red', 'ACME-1'), 'red 🟥\n');
      assert.equal(runRaw('--release', 'ACME-1'), '');
    }, { hub });
  });
}
