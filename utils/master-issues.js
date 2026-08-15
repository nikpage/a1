// utils/master-issues.js
//
// The open questions on the master record. There is exactly ONE kind, and it
// earns its place by changing the record the CV is written from:
//
//   - overlap : a role whose dates fall inside the span of the person's own
//               practice. Client work delivered under it, or a separate job
//               held at the same time? Dates cannot tell them apart and the
//               model guessed differently on consecutive runs of the same text,
//               so the person answers. "Client work" moves the role into the
//               umbrella's `fractional_engagements` — a different timeline, a
//               different CV.
//
// The pairs come from the build (`master.role_overlaps`, prompts/master-cv.js),
// never from date arithmetic here: the build read the source, this file has not.
//
// GAP and SHORT-TENURE questions were removed. They asked the person why a
// stint ended or what happened in a gap, stored the answer in a top-level
// `clarifications` array, and changed NOTHING downstream — the cover letter
// never read them, and on the CV they were forbidden to print. They cost the
// person a form to fill in and cost every prompt the tokens to carry them.
// Do not reintroduce a question without a path from the answer to the output.

import { roles } from './master-read.js';

// `role_overlaps` indexes into `master.work_experience`; a flag targets a
// position in the FLAT list `roles()` produces (umbrella entries and their
// nested engagements alike). This maps one to the other: a top-level entry sits
// after every engagement nested under the entries before it.
function flatIndexes(master) {
  const out = [];
  let flat = 0;
  const top = Array.isArray(master?.work_experience) ? master.work_experience : [];
  for (const entry of top) {
    out.push(flat);
    flat += 1 + (Array.isArray(entry?.fractional_engagements) ? entry.fractional_engagements.length : 0);
  }
  return out;
}

function roleLabel(entry) {
  const role = entry?.role || 'this role';
  const company = entry?.company ? ` at ${entry.company}` : '';
  return `${role}${company}`;
}

// The open questions for a master. Pure: no network, no AI, no clock.
// Answering one is applied by applyOverlapAnswer() (utils/master-schema) — the
// only thing in the app that nests a role — through /api/resolve-flag.
export function computeMasterIssues(master) {
  const experience = roles(master);
  const overlaps = Array.isArray(master?.role_overlaps) ? master.role_overlaps : [];
  const top = Array.isArray(master?.work_experience) ? master.work_experience : [];
  const flat = flatIndexes(master);

  const issues = [];
  overlaps.forEach((o, i) => {
    if (!o || o.answer) return; // answered questions are never asked again
    const role = top[o.role_index];
    const umbrella = top[o.umbrella_index];
    if (!role || !umbrella) return;
    const index = flat[o.role_index];
    const entry = experience[index];
    if (!entry) return;
    const practice = umbrella.company || 'your own practice';
    issues.push({
      id: `overlap-${i}`,
      type: 'overlap',
      kind: 'overlap',
      // Which `role_overlaps` question this is — what the server answers. The
      // client never sends indexes of its own; they are re-read from the record.
      question_index: i,
      target: { section: 'experience', index },
      question: `Your ${roleLabel(entry)} (${entry.dates}) ran while ${practice} was active. Was it client work delivered under ${practice}, or a separate job?`,
      options: [`Client work under ${practice}`, 'A separate job'],
      // What each option means to applyOverlapAnswer, in option order.
      answers: ['nested', 'separate'],
    });
  });

  return issues;
}
