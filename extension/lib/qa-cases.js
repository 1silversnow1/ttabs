// The shape of a QA session, with no browser API in sight.
//
// The payload comes from a server this project does not own, so nothing here
// trusts it: a malformed case is dropped rather than allowed to reach the DOM.

export const UNGROUPED = 'other';

const STATUSES = new Set(['new', 'updated', 'unchanged', 'outdated']);
const COVERAGE_STATES = new Set(['full', 'partial', 'none']);
const EVIDENCE_TYPES = new Set(['test', 'drive', 'agent', 'manual', 'deferred']);

const normalizeCase = (raw) => ({
  id: raw.id,
  title: raw.title,
  steps: Array.isArray(raw.steps) ? raw.steps.filter((s) => typeof s === 'string') : [],
  expectedResult: typeof raw.expectedResult === 'string' ? raw.expectedResult : '',
  area: typeof raw.area === 'string' && raw.area.trim() ? raw.area.trim() : UNGROUPED,
  status: STATUSES.has(raw.status) ? raw.status : 'unchanged',
  passed: raw.passed === true,
  comment: typeof raw.comment === 'string' ? raw.comment : '',
  coveredBy: typeof raw.coveredBy === 'string' ? raw.coveredBy : '',
  coverage: COVERAGE_STATES.has(raw.coverage) ? raw.coverage : 'none',
});

const normalizeDiscrepancy = (raw) => ({
  id: raw.id,
  summary: typeof raw.summary === 'string' ? raw.summary : '',
  source: typeof raw.source === 'string' ? raw.source : '',
  implemented: typeof raw.implemented === 'string' ? raw.implemented : '',
});

const normalizeCriterion = (raw) => ({
  id: raw.id,
  text: typeof raw.text === 'string' ? raw.text : '',
  evidence: EVIDENCE_TYPES.has(raw.evidence) ? raw.evidence : '',
  reason: typeof raw.reason === 'string' ? raw.reason : '',
});

const usableCase = (raw) => raw && typeof raw.id === 'string' && typeof raw.title === 'string';

const usableCriterion = (raw) => raw && typeof raw.id === 'string' && typeof raw.text === 'string';

export const normalizeState = (raw) => {
  if (!raw || typeof raw.task !== 'string' || !Array.isArray(raw.cases)) return null;

  const discrepancies = Array.isArray(raw.discrepancies) ? raw.discrepancies : [];
  const criteria = Array.isArray(raw.criteria) ? raw.criteria : [];

  return {
    task: raw.task,
    cases: raw.cases.filter(usableCase).map(normalizeCase),
    discrepancies: discrepancies
      .filter((d) => d && typeof d.id === 'string')
      .map(normalizeDiscrepancy),
    criteria: criteria.filter(usableCriterion).map(normalizeCriterion),
  };
};

export const groupByArea = (cases) => {
  const byArea = new Map();
  for (const item of cases) {
    const group = byArea.get(item.area) ?? [];
    group.push(item);
    byArea.set(item.area, group);
  }
  return [...byArea].map(([area, grouped]) => ({ area, cases: grouped }));
};

export const uncheckedCount = (cases) => cases.filter((c) => !c.passed).length;

export const handsOnLeftCount = (cases) => cases.filter((c) => c.coverage !== 'full' && !c.passed).length;

export const applyPassed = (state, id, passed) => ({
  ...state,
  cases: state.cases.map((c) => (c.id === id ? { ...c, passed } : c)),
});

export const matchesTask = (state, key) => !!key && state?.task === key;

export const finishWarning = (cases) => {
  const left = uncheckedCount(cases);
  if (left === 0) return null;
  const noun = left === 1 ? 'case' : 'cases';
  return `${left} ${noun} not marked passed — finish anyway?`;
};
