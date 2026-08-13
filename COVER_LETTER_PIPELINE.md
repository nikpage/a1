# Cover-letter generation — technical description

A factual description of how one cover letter is produced in this codebase, written
for external technical review. Every claim below is traceable to a named file and
function. Nothing is aspirational: where behaviour is a prompt instruction rather
than an enforced constraint, it says so.

**Stack:** Next.js 16 (Pages Router, JS), Netlify functions, Supabase (Postgres),
Upstash Redis, Gemini via its OpenAI-compatible endpoint.

---

## 1. Data the letter is written from

Two persisted objects, both per user, both in Postgres (`cv_data`):

- **`master_cv`** (JSONB) — a structured career record built once from the user's
  uploaded CV by a pure-extraction prompt (`prompts/master-cv.js`), then checked by
  a verify pass. It holds `experience[]` (title, company, dates, location,
  achievements), education, skills, plus verbatim `voice_samples`. It is the only
  permitted source of facts about the candidate.
- **`voice_profile`** (JSONB, optional) — prose observations about how the user
  writes, extracted from samples of their own writing. Stored separately from the
  master *by design*, so voice text can never be mistaken for evidence of a fact.

Plus, per application, an **analysis** blob (`gen_data`) produced earlier by a
separate background function. The parts that matter here:

- `job_extraction` — the job ad, extracted into fields (title, company,
  must-haves, responsibilities, keywords). Prompt-bound to literal quotation.
- `generation_framework.cover_blueprint` — **the plan for this letter**:
  a salutation target, a hook angle, exactly three `matched_pairs`
  (`{requirement, evidence}`), one optional `objection_to_defuse`, a close.
- `analysis.scenario_tags`, `red_flags`, `action_items`, `positioning_strategy`.

**Timing, which matters:** the analysis (and therefore the blueprint) is computed
when the ad is submitted — *before* the user types any steering instructions.

---

## 2. Transport

Browser (`pages/me.js`) → `utils/generateDocuments.js` →
`POST /.netlify/functions/generate-background` → `utils/run-generation.js`.

Asynchronous because the run exceeds Netlify's 10-second synchronous limit. Status
is polled from a Postgres row, not Redis (Upstash is not reachable from the Next
server runtime in this deployment). `user_id` comes from a verified session cookie,
never the request body. A per-user Redis lock (`NX`, 600s) blocks double
submissions. One token is decremented, after both AI documents succeed.

---

## 3. The prompt

`prompts/cover-letter.js` assembles one system message and one large user message
from these blocks, in this order:

| Block | Source | Content |
|---|---|---|
| User steering | `utils/steering.js` | "emphasise / play down / free text", composed into one string, labelled highest priority |
| Current date | `prompts/current-date.js` | |
| Target job | `prompts/job-target.js` | the extracted ad + instructions to answer each must-have with real evidence, early |
| Invariants | `prompts/cv-rules.js` | never fabricate, never falsify titles/employers/dates |
| Task + writing rules | inline | one argument, open on a fact, no invented durations |
| Matched-pairs rule | `prompts/cv-rules.js` | prove three requirement→evidence pairs |
| Opening rules | `prompts/cv-rules.js` | salutation, banned openings |
| Red-flag rule | `prompts/cv-rules.js` | at most one objection, chosen upstream |
| The blueprint | `prompts/cover-blueprint.js` | the plan above, rendered |
| Scenario rules | `prompts/scenarios.js` | max two career-scenario overrides |
| Voice rules | `prompts/voice.js` | banned stock phrasing |
| Length rule | `prompts/market.js` | market word band (CZ/PL 200–300, else 250–350) |
| Tone | `prompts/tone.js` | |
| Voice profile | `prompts/voice-profile.js` | style observations + 1–2 short excerpts of the user's writing |
| Master CV | — | the full JSON record |
| Analysis brief | `prompts/analysis-brief.js` | a filtered slice of the analysis |

Roughly fifteen instruction blocks, several of which can pull in opposite
directions — see §6.

---

## 4. The pipeline (`generateCoverLetter` in `utils/openai.js`)

| # | Stage | Kind | Model | Always? |
|---|---|---|---|---|
| 1 | Write the letter | AI | `gemini-2.5-flash`, temp 0.4 | yes |
| 2 | `dressLetter` — strip the model's own date line, prepend the real date, remove placeholders | code | — | yes |
| 3 | `applyVoice` — find where the draft diverges from the voice profile | AI | `gemini-2.5-flash` | only if a voice profile exists |
| 4 | `verifyGeneratedDoc` — fact-check against the master | AI | `gemini-2.5-flash-lite` | yes |
| 5 | `repairStockPhrases` — remove banned stock phrasing | AI | `gemini-2.5-flash-lite` | only if the code-side hit list is non-empty |
| 6 | `repairUnsourcedDomains` — remove an industry label the master does not evidence | AI | `gemini-2.5-flash-lite` | only if hits |
| 7 | `validateCoverLetter` — deterministic checks | code | — | yes |
| 8 | On a hard failure only: regenerate once, then repeat 4–7 | AI | | rarely |

**Typical run: 2–4 AI calls. Worst case with a retry: 9.**

Stages 3–6 never rewrite the document. Each returns `{quote, replacement}` spans,
applied by `applyGenerationCorrections()` using literal string matching — a span
not found verbatim is discarded. This bounds the blast radius: a style or repair
pass structurally cannot rewrite the whole letter.

Every AI call is cost-logged to a `transactions` row and to the browser console
(model, input/output/thinking tokens, USD).

---

## 5. What is enforced in code vs. asked of the model

This distinction is the point of the review.

**Deterministic (`utils/cv-validate.js`, `validateCoverLetter`):**

- Word count against the market band — the only *hard* failure, triggers the one retry.
- Every number in the letter traces to a number in the master.
- Banned stock phrases — detected in code, removed by stage 5.
- Invented industry labels — detected in code against a **closed list** of
  ~55 domain terms (`fintech`, `bankovnictví`, `blockchain`, …), matched by
  diacritic-folded 6-character stems so Czech/Polish inflection resolves to one
  root, compared against the master only. Removed by stage 6.
- Warnings, non-blocking: missing matched pairs, wrong salutation, more than one
  objection defused, identity epithets.

**Prompt instruction only — not enforced anywhere:**

- Which experience leads, and the whole of the user's steering.
- The one-argument structure, opening on a fact, no anecdote opening.
- The three matched pairs actually being argued.
- Not borrowing the ad's requirements as implied capability.
- Tone and voice adherence.

An AI verify pass (stage 4) covers five claim categories: invented fact, invented
number (incl. derived tenure), upgraded claim, borrowed requirement, unearned
intensifier. It is deliberately conservative — it does not flag when unsure.

---

## 6. Known structural weaknesses (observed, not theoretical)

1. **The plan is computed before the user speaks.** `cover_blueprint.matched_pairs`
   is chosen during analysis. If the ad asks for banking experience, the pairs will
   name the candidate's banking work. A user who then types "play down all the
   banks" is contradicted by: the blueprint, the target-job block ("make evidence
   for each requirement visible and early"), and a validator warning if a planned
   pair is missing. Observed result: the letter led with three banks despite the
   instruction. The current mitigation is prompt text telling the writer that
   steering deletes a pair — an instruction, not a constraint.

2. **A domain noun is not a claim.** The verify pass looks for claims. "My fintech
   background" carries no number, no date and no upgraded verb, so it passed every
   AI check. It required a separate deterministic pass with a hand-maintained word
   list — which only catches terms on that list.

3. **Pass accretion.** Stages 5 and 6 exist because stage 4 misses those classes.
   Each new failure mode has tended to produce a new pass rather than a change to
   an existing one.

4. **Language coverage regressions.** The product ships in EN/CS/PL. Logic written
   and tested in English has repeatedly failed on Czech input — most recently a
   date-stripping regex whose month names were English only, producing two dates on
   a Czech letter.

---

## 7. Test position

~690 unit tests (vitest). The repo's testing rules forbid mocking the unit under
test and require every bug fix to ship with a regression test that fails on the old
code. Coverage is strongest where behaviour is deterministic (validation, prompt
assembly, date handling) and structurally absent where behaviour is a prompt
instruction — no test can prove a model obeys an instruction.

---

## Questions worth an outside opinion

1. Is a 15-block prompt with an upstream plan the right shape, or should the plan
   be computed *after* user input — or dropped, letting one call reason from the
   master, the ad and the steering directly?
2. Is a chain of narrow span-based repair passes sound, or an anti-pattern that
   should collapse into one verification stage?
3. Where instructions conflict (user steering vs. an ad-derived plan), should
   precedence be expressed in prose to a model at all, or resolved before the
   prompt is built?
4. Is a hand-maintained closed list the right tool for detecting invented domain
   claims, or is there a general method that does not need curation?
