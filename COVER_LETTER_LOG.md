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

---

## 2026-08-15 (later) — the rule stack was the problem

**The comparison that settled it.** Nik ran his own prompt against the same
record and the same ad, outside this app:

> Write a tailored cover letter in English (250–400 words) using the job
> history and job description provided below. Highlight the key achievements
> and skills from my history that directly align with the core requirements,
> responsibilities, and qualifications listed in the job description. Maintain
> a professional tone.

Four lines. It beat this pipeline's 51,721-character prompt decisively, in his
reading, on the KUBO ad. `scripts/minimal-cover.mjs` reproduces that control
experiment — same model, same record, same ad, no rule stack — so the two can
be compared directly, with `--voice`, `--emphasise`, `--play-down` and
`--check` (the real truth passes run over the result).

**What his letter did that ours never did:**

1. **Answered the ad's NEGATIVE SPACE.** KUBO asked for a partner to schools,
   "ne někoho, kdo celý den obvolává studené kontakty". His letter: "not
   through aggressive sales tactics, but by providing exceptional service" —
   the same $20k→$100k number turned from a sales brag into proof of exactly
   what they asked for. Nothing in 33k characters of rules mentioned that an
   ad's negative space is where the employer states its fear.
2. **Opened on the employer's mission**, not on his most recent job.
3. **Chose relevance over recency** — a 2017 Charles University lectureship
   led, because the job is presenting to educators; the newest AI work
   supported.
4. **Used labelled themes** matching the ad's three asks.

**And it broke three of our rules while doing it:** a boilerplate opener ("I am
writing to express…"), a derived tenure claim ("my 25-year career"), and an
identity epithet ("As an experienced product leader"). Our stack would have
blocked or stripped the parts of the better letter.

**The control run, measured** (KUBO, gemini-3.6-flash, same record):

| | minimal prompt | the pipeline |
|---|---|---|
| opens on | KUBO's mission | the candidate's Salsita job |
| negative space answered | yes | weakly |
| names KUBO | 4× | 2×, one the raw headline including the emoji |
| prompt size | 12,445 chars | 51,721 chars |

With `--voice on` the minimal prompt kept every voice trait (em-dashes,
single-sentence pivots, "School principals and teachers do not need a sales
pitch."), and with steering it led on teaching and demoted RAG to a late
clause — **with no code enforcement at all**. The truth passes then ran clean
over it: one "proven" cut as an unearned intensifier, no banned phrases, no
unsourced domains, `validateCoverLetter` ok.

**What was rebuilt.** `prompts/cover-letter.js` is now Nik's prompt + purpose +
voice + steering + language + furniture. Removed: the contract block, the
opener bans, the matching rule, the evidence block's usage rules, the scenario
block, the red-flag rule, the analysis brief. Result on KUBO with steering and
voice: opens "KUBO does not need a cold-calling salesperson", leads on
teaching, demotes AI, carries his voice ("True account management is not about
aggressive pitching. It is about trust."). On Seznam: opens on THEIR problem
("inferring what millions of daily visitors want without relying on explicit
feedback"), disarms the depth objection honestly ("I am not a machine learning
researcher who invents fundamental algorithms from scratch"), one call, $0.018.

**Two rules retired outright:**

- **Check 12 on the letter.** Identity epithets are ordinary persuasive English
  in a letter. Kept on the CV.
- **Derived arithmetic where the inputs are bounds.** "under $20k to over
  $100k" is strictly MORE than fivefold, so "fivefold" is accurate and
  conservative. The rule was flagging a true, understated number.

**Trap for the next person:** every rule in that stack was individually
plausible and none of them was tested against an alternative. A rule that has
never been compared with its own absence is not a rule, it is a guess with a
comment above it. The comparison costs $0.02.

**Open after this entry:** 22 tests still pin the removed rules and are red on
purpose; a Czech-language run with a named contact is untested against the new
prompt; the `produkt` / DOMAIN_TERMS collision stands; the CV path still ships
hard failures.

---

## 2026-08-16 — the same treatment applied to the CV

The letter's rule stack was removed on 2026-08-15 and measured better without
it. The CV prompt had never been compared with its own absence, so it still
restated Layers 1-3, the scenario mitigations, the 3.9k human-voice block, a
"How to work" reading list, a "What makes this CV impressive" list and a
nineteen-line closing checklist on top of the record, the ad and the blueprint.

**What was removed**, leaving the record, the ad extraction, the blueprint, the
invariants (T1-T4), market conventions, steering, `voice_guide`, language, tone,
the date format, contracts-nesting, the epithet ban, the banned-phrase list, the
red-flag line and the markdown template:

| | old | new |
|---|---|---|
| prompt size (identical inputs) | 33,480 chars | **12,138 chars** |

The four rules kept in the prompt were kept deliberately: the epithet ban and
the banned-phrase list are only WARNINGS at Layer 6, so dropping them would have
degraded the document silently; contracts-nesting and the red-flag line describe
how to read the record and the brief, which no downstream check can supply.

**The run** (through the deployed app, so every call is metered: analysis
$0.1211 + $0.1609, CV $0.0624 over 4 calls). Nik's real record, 19 roles, against
the KUBO Account Manager ad — the same ad the minimal-prompt comparison used for
the letter.

- Headline came out job-aware and clean: *"Senior Account Manager & Technology
  Adoption Leader"* — no duration, no epithet, nothing the record lacks.
- **Relevance beat recency without a rule telling it to.** The 2017 Charles
  University lectureship is in Work Experience, which is the right proof for a
  job about presenting to school directors. That behaviour used to be the CV's
  weakest point and no removed rule was producing it.
- Summary leads on client-facing account work with achievement bullets naming
  their employers (the eBay account under Salsita).
- Dates MM/YYYY throughout, real months, every role kept.
- Requirements the record cannot answer (*vztahy se školami, vzdělávání, školy,
  knihovny, rodiny*) were left off and reported as gaps — not faked.
- **`validateCv`: no hard failures.** Six warnings: opening 127 words against
  the ~120 impact zone, two 13-word bullets under the band, one skill evidenced
  only by work the CV no longer shows.

**The finding.** The layer detail the writer no longer reads is exactly what the
warnings now report — the checks still bind, they simply bind where a violation
is caught rather than merely asked against. A prompt two thirds smaller did not
cost parseability, dates, truthfulness or targeting on this run.

**Open after this entry:** one ad, one sample — the letter's own lesson says
read at least two before trusting a direction. The impact zone runs slightly
long (127 words) and the bullet band is missed in places now that neither is
stated to the writer; if that repeats across runs, the fix is a furniture line
about length, not the return of Layer 2. An English-language CV only; a Czech
generation is untested against the new prompt.

---

## 2026-08-25 — Lessons from the CV assembler, and what transfers to the letter

Eleven paid runs against the Sudolabs ad and three against Invity / Seznam /
FaceUp, all read. The work was on the CV, not the letter, so nothing here is a
letter result — it is the method, and where the method does and does not carry
across. `scripts/assemble-cv.mjs`, `prompts/cv-skeleton.js`, run log in
`runs/2026-08-25_*`.

**1. A structure stated in a prompt is a structure that gets ignored, three
ways.** The production prompt states nesting, MM/YYYY dates and the recency
window in plain English. The app dissolved all six client engagements into the
parent's bullets. Writing the exact structure out verbatim in the prompt as a
skeleton did not change it. Writing it verbatim in a four-line minimal prompt
made it worse — no markdown headings at all, long-form dates, roles printed back
to 1993. Only assembling the document in code fixed it: the model returns
`{ "<employer> | <dates>": ["bullet", …] }` and the renderer writes the markdown.
Dissolving an engagement stopped being a rule to disobey; there is no slot for it.

*Transfer to the letter, with the limit stated:* this applies to the letter's
FURNITURE — date, salutation, signature block, and the paragraph the record
supplies — not to its argument. A letter chopped into code-assembled slots is
the stub-chopping defect this file already records from `applyVoice()`: a
five-word orphan paragraph, two owners for one document. The argument stays one
model writing one continuous letter. **Do not assemble the body.**

**2. Instructing a model out of its default shape does not work; removing the
affordance does.** The Summary bullets walked the roles one per employer in
career order. Three separate instructions failed: "not by career order, not one
per employer" (failed), "one bullet per need, the unit is the need never the
role" (failed), "do not label a bullet with its role" (obeyed the label, kept
the walk). Deleting the bullets and asking for prose fixed it in one run.

*Transfer:* when the letter does something structural we do not want — answering
the ad's bullets in the ad's order, one paragraph per requirement — do not add a
line telling it not to. Remove whatever makes the shape available.

**3. Verify the change is IN the prompt before judging the output.** Two runs
were reported here as "the writer ignored the skeleton". The skeleton was empty
in both: `getGenerationSource()` returns the master as PROSE, and the parse that
built the skeleton returned null. Roughly $0.30 of runs judged a change that was
never in the prompt. One `console.log` of the built prompt would have caught it.

**4. The validation retry is the most expensive call in the run and it did not
work.** Full pipeline, one CV: analysis $0.0540, write $0.0361, verify $0.0030,
repair $0.0009, **retry write $0.0533**, verify $0.0026. The retry cost more than
the first write — 10,921 thinking tokens against 5,958 — and shipped a document
still carrying three hard failures. A third of the run bought nothing. The same
retry exists on the letter path and has never been measured there.

**5. One call at $0.015 versus six at $0.15.** The assembler needs no analysis
pass because the structure comes from the record and the selection judgement is
inside the one writing call. Whether the letter needs its analysis pass is a
separate question with a separate answer — the letter's evidence pairs and the
raw ad text are doing work the CV's blueprint was not.

**6. Track defects per round in a file, not in the chat.** Seven rounds in, the
owner could not tell which defects were new, which were regressions and which had
been there since round one. A table of defect × round found that the typo, the
untargeted Speaking roster and the misfiled lectureship were all present in
round one and had simply not been noticed — and that the skills list got WORSE
at round seven while looking fine. `runs/2026-08-25_sudolabs_cv-minimal-TRACKER.md`.

**7. Tell the reader the size of what was left out.** The Speaking section prints
five entries chosen by subject and ends with "and 24 others". A selection of five
from twenty-eight reads as a thin record unless the remainder is stated.

**Not tested here:** any of this on a letter. Items 1 and 5 are explicitly
*claims about the CV* until someone runs the letter and reads it.

---

## 2026-08-25 (later) — the letter became a template, on Nik's decision

**The decision, in his words:** "a template is hardcoded text plus a bit
[that] pretends it's custom. I tried for weeks to get you to write one well.
But you simply refused." Five weeks of levers — the rule stack, the minimal
prompt, the plan pass, three hand-written exemplars shown as register targets —
produced accurate, well-evidenced letters that still read as a machine's. So
the model stops writing the letter.

**What it is now.** `prompts/letter-library.js` holds his own paragraphs,
copied verbatim off his three hand-written letters: five INSTANCES (the realty
AI assistant, eBay Berlin, the Salsita/eBay turnaround, the Česká spořitelna UX
practice, the Dezentrum/Blockchain4Humanity advocacy), two OPENINGS, three
DAY-TO-DAY lines, three CLOSES, and his Czech language line. Two edits were made
and they are the only two: a typo ("intruduce"), and one pronoun in the crypto
block so it stands without the Invity-specific sentence that preceded it.
`prompts/letter-assemble.js` writes the document in code — date, salutation,
opening, TWO instances, day-to-day line, close, signature block, contact details
exactly once. `scripts/assemble-cover.mjs` makes ONE Gemini call that returns
only ids plus, where none of his openings fits, an opening it writes itself.

**Read off the three letters before building it** — the shared skeleton is
stance, instance A told with its mechanism, instance B ALSO told out, then how
he works day to day plus the ask and the CV line. The production prompt says
"one piece of work carries the letter… make one other point in a few sentences",
and that split is what made ours read as a good paragraph stapled to filler. All
three of his tell both instances out.

**Runs (three, all read):**

| ad | opening | instances picked | result |
|---|---|---|---|
| Invity (v1) | model wrote one | crypto-ux, cs-ux-practice | Opening was résumé prose — "I've spent years leading product strategy and user experience across fintech and blockchain projects". The one generated paragraph was the worst one in the letter. Signature block came out empty: contact lives at `profile.contact`, not `profile.phone`. |
| Invity (v2) | model wrote one | same | With his own Invity opener shown as the register for a custom opening and the career-summary sentence banned by name, the opening landed. Not a fair test — the exemplar shown IS the Invity letter. |
| Sudolabs | **his own** (`ai-work-now`) | ai-realty-assistant, ebay-berlin-trust | Reconstructed his hand-written Sudolabs letter almost exactly: same opening, same two instances, same order, 380 words. Nothing generated at all. |

**The finding.** On an ad his library covers, the model picks correctly and
writes nothing — the letter is 100% his prose and reads like it, because it is.
The failure mode moved: it is no longer bad writing, it is COVERAGE. An ad his
paragraphs do not answer gets the closest ones plus a generated opening, and
that opening is measurably the weakest text in the document.

**What this costs.** One call, ~19-23k chars of prompt, no analysis pass, no
verify pass, no validation retry. Against the production path's six calls.

**Open:** the library holds five instances, all from three letters. It grows
when HE writes another paragraph — a generated one is the thing this replaced.
Nothing is wired into the app yet: this is `scripts/assemble-cover.mjs` only.
The `crypto-ux` block opens on "I've pushed that", which needs a preceding
paragraph to give "that" an antecedent; it resolved on both Invity runs but it
is fragile. Tests: `prompts/letter-assemble.test.js` (9, all green) pin that
both instances print whole, that his text is never smoothed, that a generated
opening only appears when `opening` is "custom", and that contact details appear
exactly once.

---

## 2026-08-25 (later) — the assembler wired into the app, and what the validator did not know

`generateCV` now assembles the CV in code when a structured master exists. Four
paid runs against the Sudolabs ad, all read. Every remaining hard failure after
the wiring was a check that had never seen a nested client engagement, because
until today the writer always flattened them:

- **The DOCX exporter turned each engagement into a section break.** It matched
  `#### ` for a role and then anything else starting with `###` as a section —
  `##### x` is not `#### ` but is `###`. On screen the CV was right; in the file
  the candidate sends, every client became a section header with a rule across
  the page and the bullets under it stopped being job bullets.
- **The bullet ceiling counted six engagements' bullets as the parent's** — 21
  against a ceiling of 5, which no document could pass.
- **`and 24 others` failed the number trace.** It is arithmetic over the master,
  so the master can never contain it.
- **"Managed four concurrent projects" counted as a bullet with no metric.** The
  check tested for digits.

*The pattern:* a structure that was always requested and never delivered leaves
every downstream check untested against it. Guaranteeing the structure in code
is what finally ran those paths.

Also moved from the writer to code, on the same reasoning as the skeleton: the
Earlier Career roster and the Speaking/Publications selection. Both are the
analysis's picks, both were being re-decided by the writer, and both had Layer 6
checks failing the result.

**Untested here:** any of this on the letter.
