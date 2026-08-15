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

| 19 | **Tone moved above the voice block**, with the voice/tone split stated (voice = manner and fixed; tone = the mood chosen for THIS letter and not to be softened) | Cocky improved slightly — "We are shipping real AI automation. We are delivering." — but nowhere near its own definition. It also wrote "I speak Czech fluently" where the record says working proficiency, and that upgrade got past the verify pass. | **NOT ENOUGH.** |
| 20 | **Hid Friendly, Enthusiastic and Cocky** (`OFFERED_TONES` in `prompts/tone.js`, imported by both UIs) | Only Formal is offered. Definitions kept so an older document regenerates in its own tone. | **DONE.** A tone that changes nothing must not be offered. Re-offer only after a real run shows a real difference. |

### The tone finding

Tone loses to voice, and the cause is structural rather than a prompt-ordering
accident: the voice profile is built from this person's actual prose and now owns
the writing prompt, so a line asking for a different mood cannot move it far. Any
future attempt has to reckon with that, not just move the tone block again.

Also seen on the Cocky runs and NOT fixed: an upgraded language level ("fluent"
where the record says working proficiency) and a derived tenure claim ("Over a
decade in Prague"), both past the verify pass.

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

---

## 2026-08-15 — the writer never saw the ad

**Complaint:** three days of changes and every letter still read like a form
letter, with no visible influence from the job ad, the steering or the voice
profile.

**How it was found:** by RUNNING it, which none of the preceding attempts had
done. `scripts/test-generate.mjs` was stale — raw CV text, no master, no
teaser, no voice profile, no steering — so it reproduced nothing. It was
rebuilt to run the real path against the stored record and now prints a
verification digest (source, voice profile, tweak verbatim, `cover_evidence`,
red flags, the full validation object, per-call cost). Every finding below was
read off its output.

**What the first real run showed** (Nik's record, the Seznam.cz
recommendation-systems ad, voice on, no steering):

- The letter was **121 words** and `validation.ok` was `true` — the word band
  is a CEILING only. A stub passes every check we have.
- The analysis gathered **4** requirement pairs; the letter used **2**. Check
  27 passed anyway: it fires only when ZERO are answered.
- `"Data must drive the algorithm."` — a five-word orphan paragraph, produced
  by the voice-rewrite fallback satisfying the shape rule literally.
- The verify pass had deleted 3 spans and nothing rebuilt the argument.

**The measurement that explained it.** The prompt was **51,721 characters**:
master 10,317, voice description 4,708, the candidate's own writing 3,065, and
**41,404 of instructions — ~33,000 of them byte-identical on every run for
every user and every job**. The ad and the steering were a few hundred
characters each, buried inside that. The candidate's material was a fifth of
what the writer read. That is the sameness: not the model, not the plumbing,
not the contract.

**What was wrong with the input, not the rules.** The writer never saw the ad
— only `job_extraction`, a labelled bullet list. The Seznam ad says *"nebojí se
computer science"* and *"neexistuje žádný univerzální recept"*; a letter
written for THAT ad answers its register, and none of it survives extraction.
The evidence pairs had the same problem in reverse: flat strings like
*"introduced big-data-driven user research methodologies and developer
experience (API UX) frameworks"*, CV-speak with the story removed.

**Changes, and what each actually did to the output:**

- **The ad reaches the writer verbatim.** Letter went from 2 of 4 pairs to all
  4, and the answers became specific: *"KPIs and testing strategies that prove
  whether a recommendation model improves user retention"* against the ad's
  *"navrhovat metriky"* and A/B testing.
- **Evidence pairs relabelled as pointers into the master**, not sentences to
  assemble.
- **One argument, one only THIS candidate could make for THIS ad.**
- **The voice-rewrite call deleted.** It was the orphan-paragraph source.
- **A close rule** (first person, an ask). The next run moved the maxim to the
  OPENING, so maxims are now barred at both ends — worth knowing before anyone
  bans a shape in one position only.
- **Czech vocative in the salutation.** *"Vážený pane Sládku,"* on a live run.
  Check 20 had to change with it: `String.includes` reported every correctly
  declined Czech salutation as generic, since *Nováku* is not *Novák*.

**Models, measured rather than assumed:**

| | writing | verify |
|---|---|---|
| was | 2.5-flash | 2.5-flash-lite |
| now | **3.6-flash** | **3.5-flash-lite** |
| effect | better letters, **a third of the cost** ($0.021 vs $0.063 a write); 3 corrections where 3.5-flash took 9 | on the CV: 7 specific corrections instead of **18 blanket "invented claim"** verdicts; duplicated bullets and de-bulleted lines gone; consultancy sub-roles correctly nested |

3.5-flash and 3.6-flash were both tried on the letter. 3.6 is better AND
cheaper; 3.5-flash's one sample produced a welded sentence and a close with no
ask. `gemini-3.5-pro` and `gemini-3.6-pro` do not exist on the API (404).

**Dead ends and traps recorded for the next person:**

- A single sample per model proves nothing. The first 3.6 letter was WORSE
  than 3.5's; the second was clearly better. Read at least two.
- Banning a bad shape in one position moves it, it does not remove it (the
  maxim went from close to opening in one run).
- Post-processing was doing visible damage that no test covered: deletions ate
  sentence terminators (*"...group of twelve Earlier, at Česká spořitelna"*),
  left orphaned punctuation (*"...experience design, ."*), and the prompt
  template's `<!-- BLOCK:START -->` scaffolding was reaching the page. All three
  are now deterministic cleanups with red-on-old regression tests.

**Still open after this entry:**

- CV hard failures survive the retry and ship anyway (a stray `1`, skills the
  master does not evidence, year-only dates against Layer 1).
- `DOMAIN_TERMS` matches 6-character folded stems, so the ordinary Czech word
  **produkt** collides with a domain label and the repair errors on every
  Czech run.
- Analysis is still on 3.5-flash and untested against 3.6.
