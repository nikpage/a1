// prompts/generation-verify.js
//
// Targeted verify pass over a GENERATED document (CV or cover letter) — the
// same safety-net shape as buildMasterVerifyPrompt, one step later in the
// pipeline. Prompt rules alone do not stop a writing model from stretching real
// experience past what the record proves ("contributed to" → "led", a team of
// three → a department, a metric that never existed). This pass catches that.
//
// It NEVER rewrites the document. It returns a small list of exact offending
// spans, each with either a grounded replacement (drawn only from the master)
// or a delete instruction, which the caller applies deterministically by exact
// string match. Anything it reports that isn't literally in the document is
// discarded by the caller, so a hallucinating checker cannot damage the prose.

import { currentDateBlock, currentDateReminder } from './current-date.js';
import { bannedPhrases } from './voice.js';

// A NARROW second pass: the full verify already ran, and only stock phrasing
// survived it. Re-running all six rules to fix a phrase re-opens every judgement
// the first pass already made — and regenerating the whole document to remove
// one phrase reprints a page of good work to fix a clause. This prompt does one
// thing, over the exact spans that failed.
export function buildPhraseRepairPrompt({ docType = 'cv', document = '', hits = [], now = new Date() }) {
  const label = docType === 'cover' ? 'COVER LETTER' : 'CV';
  const system = `${currentDateBlock(now)}

You are repairing STOCK PHRASING in a generated ${label}. The document is otherwise finished and fact-checked — do not re-examine it, do not improve it, and do not touch anything except the phrases listed below.

THE PHRASES FOUND IN THIS DOCUMENT: ${hits.map((h) => `"${h}"`).join(', ')}.

For each one, return the smallest span that CONTAINS it and still reads as a unit — the clause or the sentence, not the phrase alone, because deleting words mid-sentence leaves wreckage. Replace that span with the same point said plainly and specifically, keeping every fact, number, employer and date exactly as the document has them. Where the phrase carries no claim at all ("I am writing to express my interest in this role"), the replacement is "" and the span is deleted.

ABSOLUTE: never add a fact, a number, a skill or a duration that is not already in the span you are replacing. A shorter, plainer document is the correct outcome. Do not rewrite neighbouring sentences, do not restyle, do not reorder.

Return VALID JSON only — no markdown fences, no commentary:
{
  "unsupported": [
    { "quote": "", "replacement": "", "reason": "stock phrase" }
  ]
}`;

  const user = `${label}:
${document}`;

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

export function buildGenerationVerifyPrompt({ docType = 'cv', document = '', master = '', language = 'auto', now = new Date() }) {
  const label = docType === 'cover' ? 'COVER LETTER' : 'CV';
  // Scoped to the document's language: Czech tells are their own set, and on
  // 'auto' every registered list applies because the writer picked the language
  // from the master, not from us.
  const phrases = bannedPhrases(language);

  const system = `${currentDateBlock(now)}

You are a strict, literal fact-checker for a generated job-application document. You are given the candidate's MASTER RECORD (their complete, verified career facts) and a ${label} written from it. Your ONLY job is to find claims the master record does not support, and report them. You never rewrite, restyle, shorten or "improve" the document.

A claim is UNSUPPORTED when the master record does not evidence it. The kinds that matter — the last of which is not about evidence at all, but about phrasing that marks the page as machine-written:
1. INVENTED FACT: an employer, role, tool, technology, qualification, client or responsibility that appears nowhere in the master record.
2. INVENTED NUMBER: any figure — %, headcount, budget, revenue, users, timespan — that the master record does not state. A number the master states is fine wherever it appears; a number the master does not state is never fine.
2a. DERIVED TENURE (a specific, common case of the above — check for it explicitly): any claim about HOW LONG the candidate has done something — "14 years of AI solution design", "a decade in fintech", "X+ years' experience", "over five years leading teams". This is unsupported unless the master record states that span for that exact thing. Adding up roles into a career total is inventing a number, even when the arithmetic is right; so is stretching a domain label across roles that were not in that domain. Report the whole claim, and replace it with the same sentence minus the duration (say what they did, not how long).
3. UPGRADED CLAIM: real work overstated. Ownership the master does not give ("led", "owned", "founded", "headed" where the master says contributed/supported/worked on), scope inflated (a team becomes a department, a project becomes a programme, a region becomes global), or exposure turned into expertise ("familiar with" → "expert in", "used" → "specialised in").
4. BORROWED REQUIREMENT: a skill or experience phrased to suggest the candidate has it when the master record shows no evidence — typically lifted from the job ad to cover a gap. Absence of hedging is the tell: "extensive Kubernetes experience" with nothing about Kubernetes in the master.
5. UNEARNED INTENSIFIER: a word that makes a FACT-SHAPED claim of degree the master does not state. This is NOT a licence to strip adjectives — strong, specific writing is the goal. Flag ONLY these three shapes:
   (a) TOTALITY or UNIQUENESS — "single-handedly", "completely transformed", "the first", "the only", "revolutionised", "unparalleled", "industry-leading". Each asserts something the master would have to state and usually does not.
   (b) SELF-ASSESSED EXPERTISE LEVEL — "expert in", "world-class", "renowned", "deep expertise in", "mastery of" — where the master shows ordinary use rather than that standing.
   (c) MAGNITUDE THAT OUTRUNS AN AVAILABLE NUMBER — "dramatically reduced costs" where the master records an 8% reduction. Only when the master HAS the number and the adjective overshoots it.
   Replacement is the same span with the offending word removed or the real number put in its place — never a rewrite of the sentence.
6. STOCK PHRASE: a phrase from the CLOSED LIST BELOW. This is the one rule that is not about truth — it is about a document that reads as machine-written, which costs the candidate the same interview a false claim does. The list is exact and literal; you are not asked to judge tone, and you must NOT flag anything that is not on it.
   THE LIST (match case-insensitively, in any inflection the phrase itself carries): ${phrases.map((p) => `"${p}"`).join(', ')}.
   Quote the smallest span that CONTAINS the phrase and still reads as a unit — the clause or sentence, not the two words alone, because deleting two words mid-sentence leaves wreckage. Replace it with the same claim said specifically, using ONLY what the master record already supports: "passionate about seamless delivery" becomes what they actually delivered. If the phrase is pure filler carrying no claim at all ("I am writing to express my interest in this role"), replacement is "" and the span is deleted. NEVER invent a fact to fill the space — a shorter, plainer document is the correct outcome when the record has nothing to put there.

NOT defects — do NOT flag these:
- Reframing, condensing, reordering or relabelling real content, including confident, punchy phrasing of work the master describes.
- Strong, specific action verbs — led, drove, built, launched, scaled, spearheaded, won, cut, grew. These are good CV writing, not inflation. Only flag a verb under rule 3, where the master gives weaker ownership.
- Evaluative words with no factual shape — "strong", "significant", "successful", "effective", "complex", "senior", "key", "hands-on". They are judgement, not claims, and rule 5 does NOT reach them.
- Vocabulary the document's chosen TONE deliberately calls for. A confident or cocky register is a style instruction the writer was given; it is never a defect.
- Tone, style, adjectives, enthusiasm, or claims of interest/motivation in the cover letter ("I'm drawn to this role") — these are not factual claims about experience.
- Contact details, dates, employers, locations and qualifications copied from the master record.
- A reasonable synonym for something the master does state.

Be conservative: when in doubt, do NOT flag. A false flag costs the candidate a true, hard-won achievement.

For each unsupported claim, report:
- "quote": the offending text copied EXACTLY, character for character, from the ${label} — the smallest span that contains the problem (one bullet, one sentence, or one clause). It MUST appear verbatim in the document or your report is discarded.
- "replacement": the same span rewritten so it says only what the master record supports — same shape, same voice, weaker claim. Use "" when nothing truthful remains, and the span will be deleted.
- "reason": one short phrase ("invented number", "upgraded to 'led'", "no evidence of Kubernetes", "unearned intensifier", "stock phrase").

Return VALID JSON only — no markdown fences, no commentary. Empty array when the document is clean:
{
  "unsupported": [
    { "quote": "", "replacement": "", "reason": "" }
  ]
}`;

  const user = `MASTER RECORD (the ONLY thing that counts as evidence):
${currentDateReminder(now)}
${master}

${label} TO CHECK:
${document}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
