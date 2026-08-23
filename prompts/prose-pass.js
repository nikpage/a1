// prompts/prose-pass.js
//
// THE COLD READ. The letter alone — no job ad, no career record, no plan, no
// analysis. Nothing but the words the employer will actually receive.
//
// Every other check in this repo reads the letter AGAINST something: the master
// (truth), the ad (relevance), the market (length), a phrase list (banned
// wording). All of them grade the match, and a letter can pass every one of them
// and still be the blandest thing a hiring manager reads that week — which is
// exactly what happened on 2026-08-20, when four consecutive letters cleared the
// whole stack and Nik called them the worst AI writing he had seen.
//
// So this pass is deliberately BLIND. It cannot be impressed by relevance,
// because it does not know what the job was. It answers the only question the
// reader actually asks: did a person write this, and would I remember them
// tomorrow.
//
// It REPORTS ONLY. It never rewrites and it never blocks delivery. A letter that
// reads generically almost always had nothing specific to say, which is a fault
// in the PLAN or the RECORD — fixing it by asking a second model to improve the
// first model's prose is the defect this repo already removed once (applyVoice,
// see CLAUDE.md). The right response to a bad cold read is upstream.
//
// The verdict is a judgement about prose, not a fact to be verified, so it is
// asked for with its evidence attached: every finding must quote the sentence
// that produced it. A finding with no quote is an opinion, and opinions about
// writing are what produced the rule stacks this repo keeps deleting.

const SYSTEM = `You are a hiring manager reading one cover letter from a stack of forty. You have never seen this person's CV, you do not know which job this is for, and you have no other information about them. You judge only what is on the page. You return JSON only.`;

const TASK = `Here is a cover letter. You do not know the job and you do not know the person.

Answer these, and quote the specific sentences that made you answer that way. A judgement with no quote behind it is worthless — do not offer one.

1. Did a person write this, or a model? Say which, and say what made you say so.
2. Which sentences could appear, unchanged, in a letter for a completely different job? Quote them. A sentence that would survive being pasted into someone else's application is doing no work here.
3. Which sentences assert a quality about the writer instead of evidencing it? Quote them.
4. Where does the rhythm go flat — stretches where every sentence is the same length and shape? Quote the stretch.
5. What did you learn about this person that you would still remember tomorrow? Be concrete. If the answer is nothing, say nothing — do not invent something to be kind.

Do not rewrite anything. Do not suggest replacement wording. You are reporting what you read, not fixing it.`;

const SHAPE = `Return VALID JSON only — no markdown fence, no commentary:

{
  "verdict": "human" or "model",
  "why": "one or two sentences, naming what decided it",
  "portable_sentences": ["exact sentences that would survive being pasted into a different application"],
  "asserted_qualities": ["exact sentences that claim a quality instead of showing it"],
  "flat_stretches": ["exact stretches where the rhythm goes uniform"],
  "remembered": "the concrete thing you would remember tomorrow, or an empty string if there is nothing"
}

Every string in the arrays is copied VERBATIM from the letter. Empty arrays where there is nothing to report — never pad the list to look thorough.`;

export function buildProsePassPrompt({ letter = '' } = {}) {
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `${TASK}\n\n${SHAPE}\n\nTHE LETTER:\n${letter}` },
  ];
}
