// The grammar of a tab-group title: how a task key and a status become one
// string, how the key is read back out, and which titles the sync may rewrite.

import { KNOWN_PREFIXES, abbreviate } from './statuses.js';

const SEPARATOR = '|';

// Deliberately unanchored: a group the user renamed to "ACME-261 [2]" is still
// that task's group, and anchoring the key to the end of the title made such a
// group invisible — `task-tab add` then built a second one beside it. Whatever
// the user writes around the key is decoration; the leftmost key is the task.
//
// The second alternative covers release version tags (`v2026.08.31.01`), which
// don't start with an uppercase letter — without it, a group titled exactly
// with the tag still didn't read back as carrying that key, so every
// `task-tab add` for the same release built a fresh group instead of reusing it.
const KEY_PATTERN = /([A-Z][A-Z0-9]*-\d+|v\d{4}\.\d{2}\.\d{2}\.\d{2})/;

export const keyFromTitle = (title) => title.match(KEY_PATTERN)?.[1] ?? null;

// The part before the separator, whatever it is — "DEV" for "DEV|ACME-1", null
// for a title with no separator at all.
export const prefixOf = (title) => {
  const separatorAt = title.indexOf(SEPARATOR);
  return separatorAt < 0 ? null : title.slice(0, separatorAt);
};

export const titleFor = (key, status) => `${abbreviate(status)}${SEPARATOR}${key}`;

// A title the user typed themselves ("[1] ACME-2261") is theirs to keep — the
// sync only ever overwrites a bare key, one of its own prefixes, or the exact
// string it wrote last time. That last case is what keeps a fallback prefix for
// an unmapped status updating, since such a prefix is not in KNOWN_PREFIXES.
export const isOurTitle = (title, key, lastWritten) => {
  if (title === key) return true;
  if (lastWritten && title === lastWritten) return true;

  const separatorAt = title.indexOf(SEPARATOR);
  if (separatorAt < 0) return false;

  const prefix = title.slice(0, separatorAt);
  const rest = title.slice(separatorAt + SEPARATOR.length);
  return rest === key && KNOWN_PREFIXES.has(prefix);
};
