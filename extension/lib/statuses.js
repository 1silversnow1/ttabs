// Jira status -> tab-group title prefix, and the colour of its stage.
//
// Adapting this to another workflow means editing STATUS_ABBREVIATIONS and
// PREFIX_COLORS and nothing else: a status missing from the maps still gets a
// prefix and a colour, so an unknown status degrades instead of breaking the sync.

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

// One colour per stage of the board, so the tab strip reads like its columns:
// grey before work starts, blue in development, purple in review, yellow in
// testing, green once it is through, red when it is stuck. Used only when the
// user switched colours to follow the status (`task-tab color-by status`).
const PREFIX_COLORS = {
  BL: 'grey',
  REQ: 'grey',
  RDEV: 'grey',
  TODO: 'grey',
  DEV: 'blue',
  REV: 'purple',
  RQA: 'yellow',
  QA: 'yellow',
  REL: 'green',
  RDY: 'green',
  DONE: 'green',
  HOLD: 'red',
};

// A status nobody mapped stands out instead of passing for one of the stages.
const UNKNOWN_STATUS_COLOR = 'cyan';

export const colorFor = (status) => PREFIX_COLORS[abbreviate(status)] ?? UNKNOWN_STATUS_COLOR;
