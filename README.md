# ttabs

English · [Українська](./README.uk.md)

Groups Chrome tabs by Jira task, from the command line, and keeps each group's
title in step with the task's status:

```
REQ|ACME-218   DEV|ACME-253   REV|ACME-254   QA|ACME-261   HOLD|ACME-266
```

One window can then hold several tasks side by side without their tabs mixing,
and the tab strip doubles as a board. Scripts drive it: a "start working on a
task" command opens the group with the issue, a "run it locally" command adds the
dev server, a "clean up" command closes the group.

macOS + Google Chrome only.

## Why an extension

Chrome tab groups exist only behind the `chrome.tabGroups` extension API —
AppleScript cannot see them and the DevTools Protocol has no such domain. So the
grouping lives in a small unpacked extension.

The CLI reaches it without a daemon: Chrome accepts `chrome-extension://` URLs
from `open`, so `task-tab` opens the extension's own control page with query
parameters. That page performs the operation and closes itself. No native
messaging host, no local server. The only background piece is the status sync.

## Install

```bash
git clone https://github.com/vladimirfriptu/ttabs.git ~/ttabs && cd ~/ttabs
./install.sh
```

The first run links `task-tab` and `task-color` into `~/.local/bin` and then
stops, because Chrome has not seen the extension yet. Load it — `chrome://extensions`
→ **Developer mode** → **Load unpacked** → select this repo's `extension/`
directory — and run `./install.sh` again. It resolves the id Chrome assigned,
caches it, and asks for your Jira site:

```
Jira site
  URL (e.g. https://acme.atlassian.net), empty to skip: https://acme.atlassian.net
```

You can set it later, or change it, with `task-tab site https://acme.atlassian.net`.
Chrome will ask for access to that host the first time the sync runs.

Re-run `./install.sh` whenever the extension is reloaded from a different
directory — Chrome derives an unpacked extension's id from its path, so moving
the repo changes the id.

Paths, all overridable by environment variable:

| What | Default | Override |
|---|---|---|
| CLI symlinks | `~/.local/bin` | `TASK_TABS_BIN` |
| State (`extension-id`, `colors/`) | `~/.local/share/task-tabs` | `TASK_TABS_HOME`, `XDG_DATA_HOME` |

## Usage

```bash
task-tab add ACME-1234 https://acme.atlassian.net/browse/ACME-1234
task-tab add ACME-1234 http://localhost:3000        # same group, second tab
task-tab --focus add ACME-1234 http://localhost:3000  # ...and jump to it
task-tab collapse ACME-1234                         # fold it up
task-tab close ACME-1234                            # close every tab in it
task-tab site https://acme.atlassian.net            # point the sync at your Jira
task-tab color-by status                            # colour groups by status, not by task
```

Adding a URL already in the group is a no-op instead of opening a duplicate.
`task-tab` is a deliberate silent no-op in general — it exits 0 without output
when it cannot work, so a script may call it unconditionally.

### Split view

Chrome 155 can show two tabs side by side. `--split` opens the new tab as the
right half of a split view, beside the group's last tab; `--split-with` pairs it
with the first tab whose URL starts with the given prefix instead:

```bash
task-tab add ACME-1234 http://localhost:3000                      # the app
task-tab --split add ACME-1234 http://localhost:4000/checklist    # beside it
task-tab --split-with http://localhost:3000 add ACME-1234 http://localhost:4000/checklist
```

If the partner already sits in a split view, the new URL replaces the page in the
pair's right half. If there is no partner, or Chrome cannot split, the page opens
as a plain tab in the group. Both flags apply to `add` only and are a silent
no-op like the rest of the CLI.

### Nothing steals your focus

Tabs are arranged in the background. `open -g` keeps Chrome from coming to the
front, new tabs are created inactive, and the control page — which Chrome does
make active for the ~200 ms it exists — hands the selection back to the tab you
were reading before closing itself. The service worker tracks that tab per
window, ignoring control pages, so the answer is right even after several
commands in a row.

`--focus` opts out for the one call where you do want to be taken to the tab.

## The status prefix

The service worker refreshes every group's title every five minutes, on browser
start, and immediately after `task-tab add`. It collects the task keys from the
tab groups themselves, asks Jira for their statuses in one JQL request, and
rewrites only the titles that changed.

Authentication is your ordinary browser session — `fetch` with
`credentials: 'include'`. No token is stored anywhere. While the session is
expired the sync fails silently and the titles simply stop moving; opening Jira
in a tab fixes it.

Default map — a Jira status not listed here still gets a prefix, the first four
letters of its name:

| Status | Prefix | | Status | Prefix |
|---|---|---|---|---|
| Backlog | `BL` | | In test | `QA` |
| Requirements | `REQ` | | Ready for release | `REL` |
| Ready for dev / To Do | `RDEV` / `TODO` | | Ready (after the release) | `RDY` |
| In dev / In progress | `DEV` | | Closed / Done | `DONE` |
| On review / In review | `REV` | | On hold / Blocked | `HOLD` |

Adapting it to another workflow is one edit in `extension/lib/statuses.js`;
nothing else knows the status names.

`Closed` is just another prefix — the group stays open until `task-tab close`
takes it down.

### A title you typed yourself is never overwritten

The sync rewrites a title only when it is a bare key (`ACME-261`), one of its own
prefixes (`DEV|ACME-261`), or the exact string it wrote last time — that last
case is what lets a fallback prefix for an unmapped status keep updating.
Anything else (`[1] ACME-261`, `⚠️ ACME-261`) is yours, and the sync leaves that
group alone for good. Rename it back to a bare key to hand it over again.

**Keep the key in the title.** That is the one rule renaming has to respect: the
key is how every command finds the group, and decoration around it — on either
side, in any amount — is ignored. `[2] ACME-261`, `ACME-261 [2]`,
`ACME-261 (waiting on design)` and `ACME-261-empty-state-fixes` all still belong
to `ACME-261`, so `task-tab add`, `close` and `collapse` keep reaching them. Drop
the key (`design work`) and the group becomes invisible to the CLI: the next
`task-tab add` will build a second group beside it rather than adopt it. When a
title carries two keys, the leftmost one wins.

## The colour anchor

If your terminal multiplexer labels its own tabs per task, `task-color` gives
both ends the same colour to agree on:

```bash
task-color ACME-1234            # -> "purple 🟪"
task-color --chrome ACME-1234   # -> "purple"      (used by task-tab)
task-color --emoji  ACME-1234   # -> "🟪"          (for a terminal tab label)
task-color --set red ACME-1234  # override, remembered like any assignment
task-color --release ACME-1234  # return it to the pool
```

The colour is picked on first call from whatever no other live task holds, then
stored in `<state>/colors/<key>` — that file is both the memory and the "taken"
list. `task-tab close` releases it, so finished tasks give their colour back.

That is not the only way a task ends, though: close the group by hand, delete the
worktree, restart the machine, and the reservation would be held for good. The
CLI cannot ask Chrome which groups still exist, so instead every read stamps the
reservation as live, and a task that finds nothing free takes over the colour
nobody has asked about in longest — the one most likely to be finished. Colours
therefore repeat only while you genuinely have more than six tasks in flight, and
the store never grows past the palette.

Every colour change (first pick, takeover, `--set`, `--release`) is also
mirrored to the Vchasno hub (`hub.mjs task-color <key> <colour|none>`), so the
task map shows it. The hub path comes from `VCHASNO_HUB`; when the file is
missing, the call is skipped. It runs in the background, its output is discarded,
and a failing hub never changes what `task-color` prints or its exit code.

The palette is the six Chrome tab-group colours with a solid emoji square: blue,
green, purple, yellow, red, grey — in that order, so grey is the last resort.
Chrome's pink and cyan are skipped: their squares are Unicode 15 and render
inconsistently in terminals.

### Colour by status instead

The anchor is the default because it keeps the terminal and the browser in
agreement. If you would rather read the board off the tab strip, switch the
group colour to follow the status:

```bash
task-tab color-by status   # every sync recolours the group by its stage
task-tab color-by task     # back to the task-color anchor
```

| Prefixes | Colour |
|---|---|
| `BL`, `REQ`, `RDEV`, `TODO` | grey |
| `DEV` | blue |
| `REV` | purple |
| `RQA`, `QA` | yellow |
| `REL`, `RDY`, `DONE` | green |
| `HOLD` | red |
| a status not in the map | cyan |

The map is `PREFIX_COLORS` in `extension/lib/statuses.js`. The switch recolours
every group at once. A group whose title you typed yourself keeps the colour you
gave it, the same way it keeps its title. With colours by status the browser no
longer matches the terminal label or the hub: those still show the `task-color`
anchor. Switching back to `task` leaves the current colours as they are; groups
opened after that get their anchor colour.

## Development

```bash
npm test        # node:test over extension/lib, plus task-color end to end
```

The extension is plain ES modules — `"type": "module"` on the service worker and
`<script type="module">` on the control page — so there is no build step and no
bundler: edit a file and press *Reload* on the extension card in
`chrome://extensions`. Everything under `extension/lib/` is free of browser APIs
and is what the tests import directly.

Files:

| Path | Role |
|---|---|
| `bin/task-tab` | CLI: opens the control page with the requested action |
| `bin/task-color` | CLI: assigns and remembers a task's colour |
| `bin/lib/common.sh` | Shared by both CLIs and the installer: state dir, URL encoding |
| `extension/control.js` | Performs one action per page load, then closes the tab |
| `extension/sync.js` | Service worker: schedules the sync and wires up the messages |
| `extension/lib/statuses.js` | The status → prefix map and the prefix → colour map, nothing else |
| `extension/lib/titles.js` | Title format, key extraction, title-ownership rule |
| `extension/lib/plan.js` | Decides which titles to rewrite — pure, no browser APIs |
| `extension/chrome/` | Thin wrappers over `chrome.*`: groups, focus, storage |
| `extension/providers/jira.js` | The only file that knows Jira's API |
| `install.sh` | Links the CLI, resolves the extension id, sets the Jira site |

### Pointing it at another tracker

`extension/providers/jira.js` is the whole coupling. A sibling exporting the same
`fetchStatuses(site, keys) -> { key: statusName }` plus one import line in
`sync.js` and the new host in `manifest.json` is the entire change; `lib/` and
`chrome/` never learn about it.

## When tabs stop appearing

`task-tab` fails quietly by design, so start here, in order of likelihood:

1. **The id went stale.** The repo moved, or the extension was reloaded from
   another directory. Re-run `./install.sh`.
2. **The extension got disabled.** Chrome periodically offers to turn off
   developer-mode extensions, and it is easy to accept by reflex. Check
   `chrome://extensions`.
3. **`extension-id` is missing.** `ls ~/.local/share/task-tabs/extension-id`. If
   absent, run `./install.sh`.

To see what the CLI would do, run its `open` line by hand — the control page logs
errors to its own console under `chrome://extensions` → *Inspect views*.

## When the status prefix stops moving

The sync is silent too. Open `chrome://extensions` → *Inspect views: service
worker* — a failed run logs `[task-tabs] sync failed:` there.

1. **No Jira site configured.** The log says so; run `task-tab site <url>`.
2. **The Jira session expired.** The request comes back 401; open your Jira in a
   tab and the next tick recovers.
3. **The title is no longer ours.** A group renamed by hand is skipped by design
   — see above.
4. **The service worker was never started.** After editing anything under
   `extension/`, press *Reload* on the card in `chrome://extensions`.

## Known annoyances

- Chrome nags about developer-mode extensions. Escaping that needs a Web Store
  listing or an enterprise policy; Chrome stable refuses side-loaded CRX files.
- The control page is a real tab for roughly 200 ms before it closes itself.
  `task-tab` uses `open -g` so it never steals focus, which makes it easy to
  miss, but it is visible.
- `host_permissions` covers `*.atlassian.net`. A self-hosted Jira needs its host
  added to `extension/manifest.json`.
