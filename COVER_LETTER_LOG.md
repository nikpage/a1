# Cover-letter quality — what has been tried

Why this file exists: git records what worked. Every failed experiment gets
reverted and leaves no trace, so the same idea gets tried again three weeks
later. This is the record of the dead ends.

**Rules for this file.** One entry per thing actually tried, with what it did to
the output — not what it was expected to do. An entry is only added after the
change was RUN against a real record and a real ad, never on reasoning alone.
Dead ends stay in the file forever; they are the point of it.

The standing goal: a CV and cover letter that read as though a good human writer
produced them, in the candidate's own voice, entirely true to the record.

---

## The test setup

Generation is run directly against a real user's stored master CV, voice profile
and analysis, and the letter is read. `utils/openai.js` `generateCoverLetter()`
is called from a throwaway script with `.env.local` plus `GEMINI_API_KEYS`
supplied by hand — Doppler holds the keys and its token on this machine expires.
Shape is printed alongside the letter (`coverShape` / `coverShapeFaults` in
`utils/cv-validate.js`).

Unit tests cannot judge this. They pin mechanism; only reading the letter judges
quality.

---

## 2026-08-14 — the letter reads mechanical despite a saved voice profile

Starting point. The user had three writing samples saved (11 List A
observations, 7 List B translations, stored 13 Aug — verified present in the
database, nothing had deleted them). The letter still read like a machine: four
paragraphs, every one 4–5 sentences, every sentence 15–30 words, no short
sentence anywhere, no single-sentence paragraph, closing on "How my experience
can contribute to Applifting's mission is a question I am eager to explore".

| # | Tried | Result | Verdict |
|---|---|---|---|
| 1 | **Span-patched voice pass** (the original design: `{quote, replacement}` applied by literal match) | Cannot split a paragraph, land a short sentence or move where the point arrives. It polished words inside a shape it could not touch, so the profile appeared to do nothing at all. | **DEAD.** Replaced by a full rewrite. Do not reintroduce span-patching for STYLE — it is still correct for the truth passes, where the blast radius matters. |
| 2 | **Full-letter rewrite in voice** (`prompts/voice-check.js`, `buildVoiceRewritePrompt`) | Shape metrics went from failing to passing (shortest sentence 14 words → 4, spread 4.1 → 6.9). | **KEPT.** Safe because it runs BEFORE the truth-verify pass, which then checks every fact in it. |
| 3 | **Writer temperature 0.4 → 0.85** | Verify corrections jumped from 2 to 13 (derived tenure, upgraded claims, invented facts). Prose no better. | **DEAD at 0.85.** Settled at 0.55. |
| 4 | **Rewrite forbidden to remove anything factual** (first version of the fact lock) | A draft that walked five employers stayed a walk of five employers — the pass could only reshape the dump. | **DEAD.** Cutting invents nothing; the fact lock now forbids ALTERING a kept fact and explicitly permits dropping evidence. |
| 5 | **Rewrite allowed to cut** | Better. Still named 5–6 employers in most runs. | **KEPT**, insufficient alone. |
| 6 | **Longer voice samples to both prompts** (excerpt 700 → 1400 chars for the writer, 1800 for the rewrite) | Cadence transfer improved; no downside seen. | **KEPT.** |
| 7 | **Split the analysis brief in two** (`coverBrief()` — the letter no longer sees ATS keywords, quick wins, career arc, transferable skills, `cv_changes` or `cv_blueprint`) | Real improvement. The letter stopped naming a keyword or a CV fix per sentence. The letter's brief now carries `candidate_core`, `positioning_strategy`, `cover_evidence`, `scenario_tags`, `red_flags` and its own action items. | **KEPT.** Knock-on: `coverLengthRule()` had to state the word target as a NUMBER, since the field it used to point at is no longer in the letter's brief. |
| 8 | **Depth over coverage** (Layer 3: go deep on two pieces of evidence, name the claim in the first paragraph) | The best single result of the day — opened on a real number, two verify corrections, readable rhythm. Obeyed inconsistently across runs. | **KEPT** (rule first, then code, as the law requires). |
| 9 | **Employer-count check feeding the rewrite** (`coverBreadthFault`) | Marginal. The letter still fragmented. | **KEPT**, marginal. |
| 10 | **Banned-phrase list grown** with tells seen in real output: "aligns directly with", "resonates with", "positions me to", "this ensures", "I am confident that I can", "I believe I can bring" | Removed by the existing repair pass. | **KEPT.** This is how that list is supposed to grow — a phrase actually seen, never an inferred family. |

### Where it stands after all ten

Measurably better: shape checks pass, the brief no longer floods the letter,
fabrications down from 13 corrections to 2. Still not shippable: the prose
fragments. Orphan one-line paragraphs, stub sentences, weak closings. Roughly
one run in four reads well; the rest read like an outline.

### The diagnosis after reading six real outputs

Two models write every letter. The first produces a career-summary draft; the
second reshapes it. Neither owns the letter, and reshaping another model's
outline is what produces fragments — a rewriter given a list writes a better
list, not an argument.

**Untried, and believed to be the actual fix:** one call that writes the letter
in the candidate's voice from the start, with the profile, the samples, the
evidence and the steering all in the writing prompt, and the rewrite demoted to
a fallback that fires only when the shape check fails.

---

## 2026-08-14, later — the writer owns the letter

The diagnosis above, tested. Voice moved into the WRITING prompt (at the top,
above the rules, with the candidate's own writing quoted there), and the rewrite
demoted to a fallback that fires only when the finished letter measures flat or
walks the career.

| # | Tried | Result | Verdict |
|---|---|---|---|
| 11 | **Writer composes in voice; rewrite demoted to fallback** | The fragments stopped. Coherent paragraphs, no orphan one-liners, keeps the strongest evidence. | **KEPT.** This was the right call. |
| 12 | **Breadth check fixed to read nested `contracts[]`** | It had never fired: this candidate's engagements (Salsita, wflow.com, SpecialAgents.pro) hang as children under one consultancy entry, so reading only the top level saw three employers where the letter had named five. Now fires correctly. | **KEPT.** |
| 13 | **Derived arithmetic added to the verify pass (2b)** | A run invented "a gain of over 400%" from two real numbers and every existing category let it through — nothing was fabricated, it was *computed*. Now flagged and cut. | **KEPT.** Also caught: "under $20k" and "over $100k" are not endpoints you can divide. |
| 14 | **Rewrite fallback OFF, writer alone** (temporary, for comparison) | Coherent, no false attribution, keeps the best number — but FLAT (shortest sentence 9 words) and the opening was brochure copy. | **Informative.** The two configurations fail in opposite directions. |
| 15 | **Shape targets stated in the WRITER's prompt** (one sentence ≤6 words, wide variation, no paragraph over ~90 words, no stub-chopping, open on a concrete thing done) | Best result of the session: spread 9.0, coherent, no rewrite needed at all. | **KEPT.** Fixing shape at the source beats repairing it afterwards. |

### Where it stands

Much better than the morning's baseline (four uniform slabs, no short sentence
anywhere, brochure closing). Now: coherent, varied, opens on a real fact, and
usually needs no second pass at all.

**Not fixed: variance.** Run to run the same inputs give a good letter or a
mediocre one — sometimes a stub fragment ("Ready to engage with diverse client
needs."), sometimes a fourth employer, sometimes filler ("a significant
increase"). One run in three or four still reads like an outline.

**Seen once and worth watching: a false attribution.** A rewrite moved
multinational user studies from Monster Worldwide to wflow.com — the fact was
real, the employer was not. No pass caught it. If the rewrite fallback stays,
this is the risk it carries, and it is a worse class of defect than flatness.

**Untried.** Generating two drafts and keeping the better one against the shape
metrics — the only remaining idea aimed squarely at variance rather than at the
average.

---

## 2026-08-14 — defects found by using it, not by testing it

| # | Found | Cause | Fix |
|---|---|---|---|
| 16 | **"The letter answers none of the 5 requirements"** on a letter that answered two | Check 19 looked for words from BOTH halves of a requirement→evidence pair. The requirement is quoted verbatim from the ad, in the AD's language; the letter is written in the candidate's. A Czech ad answered by an English letter shares no words with the requirement, so the check fired on every cross-language application — which, in an EU product, is most of them. | Match the EVIDENCE half only (it comes from the record, in the record's language), and stay silent where the letter shares no language with the record at all. Rule stated in `CV_RULES.md` check 19 first. Regression test is red on the old code. |
| 17 | **Tone barely lands.** Friendly reads identical to Formal; Cocky is louder but nowhere near the swagger its own definition demands | Untested — the voice block now sits at the top of the writer's prompt with the candidate's samples under it and owns register and attitude; the tone line sits far below and loses. The samples are one register, so every tone comes out in that register. | **OPEN.** `CV_RULES.md` says the tone decides attitude and the voice decides cadence, but nothing enforces the split now that the voice writes the whole letter. |
| 18 | **Cocky leaked "Over a decade in Prague"** — a derived tenure claim, and an unfinished sentence ("My UX leadership and AI product design experience isn't just a fit.") | The verify pass has a category for derived tenure (2a) and did not fire. Seen once, on the loudest tone. | **OPEN.** Watch for it. |

---

## Rules changed along the way

Every one of these went into `CV_RULES.md` FIRST and cascaded into code, per the
law in `CLAUDE.md`.

- **The letter is composed, not executed.** `cover_blueprint` (hook, three
  ordered pairs, chosen objection, close) replaced by `cover_evidence` — an
  unranked pool. The plan was written before the candidate typed any steering,
  so every user input downstream could only redress a decision already taken.
- **Steering is in scope when the document is composed** — there is no plan left
  for it to outrank. Check 19 no longer takes `tweak` and is never suspended.
- **Voice governs SHAPE, not only wording** (Layer 2), and how far it travels is
  judged against the JOB AD'S OWN REGISTER — a blog's manner is evidence of how
  someone writes, never proof it suits this application.
- **Invented scene-setting is banned, narrative is not** (Layer 3). The defect
  was never the story; it was that a story needs detail and a writer without
  detail invents it.
- **Depth, not coverage** (Layer 3) + the claim is named in the first paragraph.
- **Check 24 — the letter's measured shape**, repaired before delivery, never
  reported to the user. Code measures flatness; it does not judge quality, and
  nothing in the rules claims it does.
