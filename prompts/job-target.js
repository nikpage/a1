// prompts/job-target.js
//
// The TARGET JOB block — the job ad itself, in front of the generators.
//
// Both generators used to see the job only second-hand, through whatever the
// analysis blueprint happened to carry (summary_draft, skills_to_highlight,
// inferred_keywords). The ad's own requirements never reached the prompt, so
// the CV defaulted to generic-impressive instead of answering THIS job.
//
// The confirmed extraction is already stored on the analysis as
// `job_extraction` (written by netlify/functions/analyse-background.mjs), so
// this block needs no new plumbing: it lifts that object out of the JSON blob
// and states it plainly, where the model will actually act on it.
//
// Standalone reviews (no job ad) get an empty string — nothing to target.

// Render one labelled list, or '' when the ad was silent on it.
function labelledList(label, items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const lines = items
    .map((i) => (typeof i === 'string' ? i.trim() : ''))
    .filter(Boolean)
    .map((i) => `- ${i}`);
  return lines.length ? `\n${label}:\n${lines.join('\n')}` : '';
}

function labelledValue(label, value) {
  return value && String(value).trim() ? `\n${label}: ${String(value).trim()}` : '';
}

// THE AD ITSELF, verbatim — the letter's version of the target-job block.
//
// The extraction below is the right shape for the CV: a list of requirements to
// order and cover. It is the wrong shape for a LETTER. An ad has a register —
// "nebojí se computer science", "neexistuje žádný univerzální recept" — and a
// letter that reads as written for THIS job is a letter that answered that
// register. None of it survives extraction, which is why every letter read the
// same: every letter was written from the same de-natured bullet list.
//
// `analysis.job_text` is written by netlify/functions/analyse-background.mjs.
// Absent on older analyses and on standalone reviews; the caller then falls
// back to targetJobBlock(), exactly as before.
export function rawAdBlock(analysis) {
  const raw = typeof analysis?.job_text === 'string' ? analysis.job_text.trim() : '';
  if (!raw) return '';
  const job = analysis?.job_extraction || {};
  // The company on TWO records, because the extraction routinely leaves it
  // blank while the analysis's own job_data carries it — a real run applied to
  // KUBO with `job_extraction.company: ""`, so the one field naming the
  // employer was empty and the letter never named them.
  const company = String(job.company || analysis?.job_data?.Company || '').trim();
  const head =
    labelledValue('Position', job.position_title) +
    labelledValue('Company', company) +
    labelledValue('Location', job.location);

  return `
# The ad, exactly as the employer wrote it
This is the job. Read it the way a person would — what they are building, what they say they need, and HOW they say it. The letter you write is the answer to THIS text, not to a generic vacancy of this title.${head}

- **NAME THE EMPLOYER AND THE ROLE IN THE LETTER.**${company ? ` This application is to **${company}**` : ''}${job.position_title ? `, for the role of **${job.position_title}**` : ''}. A letter that never names who it is written to is a letter that was written to nobody, and it reads exactly like one — it is the single clearest tell that a document was generated rather than written. Name them early and naturally, in the prose; never as a header line, never as "I am writing to apply for the position of…".

"""
${raw}
"""

- It is the TARGET, never evidence about the candidate: nothing here is a fact about them until the master CV proves it.
- Answer its register as well as its requirements. A warm, informal, first-person ad is answered in kind; a terse corporate one is answered plainly. Never borrow its phrasing to cover experience the record does not hold.
- **DO NOT QUOTE IT AND DO NOT PARAPHRASE IT.** Not in the opening, not anywhere. Reciting the employer's own copy back at them — their mission line, their phrasing for what they are building, the sentence they are proudest of — is the plainest possible mail-merge tell: they wrote it, they know it, and being shown it tells them only that nobody thought about the job. Their striking words are their fingerprints; leave them here. Ordinary nouns the work cannot be described without are not borrowings.
- **The first sentence is something the candidate DID**, in the candidate's own words, that shows they have already handled a problem of this kind. That is what proves the ad was understood. An opening that describes the employer to the employer proves nothing.
`;
}

// The job the documents are being written FOR, as the ad itself stated it.
export function targetJobBlock(analysis) {
  const job = analysis?.job_extraction;
  if (!job || typeof job !== 'object') return '';

  const facts =
    labelledValue('Position', job.position_title) +
    labelledValue('Company', job.company) +
    labelledValue('Location', job.location) +
    labelledValue('Seniority', job.seniority) +
    labelledList('Must-have requirements', job.must_have_requirements) +
    labelledList('Required skills', job.required_skills) +
    labelledList('Responsibilities', job.responsibilities) +
    labelledList('Desired / nice-to-have', [...(job.desired_skills || []), ...(job.nice_to_have || [])]) +
    labelledList('Language requirements', job.language_requirements);

  if (!facts.trim()) return '';

  return `
# The target job (what this document is written FOR)
This is the ad, as the employer wrote it. It is the TARGET, never evidence about the candidate — nothing here is a fact about them until the master CV proves it.
${facts}

## How to use it
- Work requirement by requirement. For each must-have and required skill above, find the REAL evidence in the master CV's \`experience[]\` that answers it, and make that evidence visible and early — the strongest proof belongs where the reader hits it first, not buried at the bottom.
- Evidence the job asks for gets promoted; experience the job has no use for gets condensed or cut. That reordering IS the tailoring.
- **A requirement with no evidence stays unanswered.** Say nothing about it. Do NOT imply, hint at, adjacent-skill it, or borrow the ad's phrasing to cover a hole — an unclaimed gap is honest, a papered-over one is a lie.
- Never upgrade what the evidence says to make it fit better: "contributed to" does not become "led", a team of 3 does not become a department, exposure does not become expertise, and no number moves.
- **The candidate's own instructions, where this document carries them, outrank this block.** If they asked for something to be played down, it does NOT get promoted here no matter which requirement it answers: answer that requirement with other real evidence, or leave it unanswered. This block decides ordering only where the candidate has not already decided it.
- Use the ad's own vocabulary ONLY over experience the candidate genuinely has — matching their real work to the employer's words, never their words to work that isn't there.
`;
}
