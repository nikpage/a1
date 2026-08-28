// prompts/retrieved-evidence.js
//
// The retrieved evidence, rendered for a prompt.
//
// Pure string assembly, and it lives on the PROMPT side deliberately: the
// prompts must not import utils/cv-retrieval.js, which imports utils/openai.js,
// which imports the prompts — a cycle that resolves today only because of
// hoisting and would break the moment any of the three grew a top-level
// statement.
//
// Grouped BY REQUIREMENT, because that pairing is the thing a whole-master dump
// could never express: this is what they asked for, and this is the real work
// that answers it.

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);

/**
 * The retrieved evidence, rendered for a prompt.
 *
 * Grouped BY REQUIREMENT, because that is the pairing the writer needs and the
 * thing the whole-master dump could never express: this is what they asked for,
 * and this is the real work that answers it. Provenance (`source`) rides along
 * so a claim can be traced back.
 */
export function retrievedEvidenceBlock(groups) {
  const list = arr(groups).filter((g) => str(g?.requirement) && arr(g?.chunks).length);
  if (!list.length) return '';

  const lines = list.map((g) => {
    const evidence = g.chunks.map((c) => `    - ${str(c.text)}`).join('\n');
    return `- THEY ASK: ${str(g.requirement)}\n  THE RECORD ANSWERS:\n${evidence}`;
  });

  return `
# What this employer asked for, and the real work in this candidate's record that answers it

These are pulled from the candidate's own record by matching it against this ad. They are VERBATIM record — facts, not phrasing to reuse. An ask that appears here with nothing under it, or that is missing entirely, is one the record does not answer: say nothing about it at all.

${lines.join('\n')}
`;
}
