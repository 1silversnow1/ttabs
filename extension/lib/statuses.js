// Jira status -> tab-group title prefix.
//
// Adapting this to another workflow means editing STATUS_ABBREVIATIONS and
// STAGE_ORDER and nothing else: a status missing from them still gets a prefix
// and a place at the end, so an unknown status degrades instead of breaking the
// sync.

const STATUS_ABBREVIATIONS = {
  'backlog': 'BL',
  'requirements': 'REQ',
  // Ready is the board's last column, after the release — the task is done.
  // Waiting for development is 'ready for dev'.
  'ready': 'RDY',
  'ready for dev': 'RDEV',
  'to do': 'TODO',
  'in dev': 'DEV',
  'in progress': 'DEV',
  'on review': 'REV',
  'in review': 'REV',
  'ready for test': 'RQA',
  'in test': 'QA',
  'ready for release': 'REL',
  'on hold': 'HOLD',
  'blocked': 'HOLD',
  'closed': 'DONE',
  'done': 'DONE',
};

export const KNOWN_PREFIXES = new Set(Object.values(STATUS_ABBREVIATIONS));

export const abbreviate = (status) => {
  const normalised = status.trim();
  return STATUS_ABBREVIATIONS[normalised.toLowerCase()] ?? normalised.toUpperCase().slice(0, 4);
};

// The board's columns, left to right — the order groups line up in when
// `task-tab sort on` is set. A prefix not listed here sorts after all of them.
export const STAGE_ORDER = [
  'BL', 'REQ', 'RDEV', 'TODO', 'DEV', 'REV', 'RQA', 'QA', 'REL', 'RDY', 'DONE', 'HOLD',
];
