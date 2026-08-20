# CV Rules — Final

The canonical statement of what a generated CV must be. `prompts/cv-rules.js`,
`prompts/scenarios.js`, `prompts/market.js`, `prompts/cv-sections.js` and
`utils/cv-validate.js` implement this document. It governs the cover letter too,
wherever a rule says so — `prompts/cover-letter.js` implements those. Where code and this document
disagree, this document is the authority.

## Invariants (cannot be overridden by any layer)

**T1 — Never fabricate.** No skill, tool, title, metric, employer, date, or certification may appear unless it exists in the master CV. Keyword matching is done by reframing evidenced experience, never by inserting the term.

A figure COMPUTED from real figures is fabricated too. "Grew billing from under $20k to over $100k" is the record; "a gain of over 400%", "a fivefold increase", "$1.2m a year" are not, however sound the arithmetic. The record states results, not the ratios between them, and a computed figure claims a precision the record does not carry — "under" and "over" are not endpoints anything can be divided by. The two real numbers already say it, and they say it better. The same reasoning bans a career total summed from role dates.

**T2 — Never falsify the record.** Titles, employers, and dates are reproduced as recorded. Strategic layers change emphasis, ordering, wording, and what is shown — never what is claimed. Omission is permitted; alteration is not. Normalising a date's FORMAT to MM/YYYY is required; changing a date is forbidden. Year-only dates are never used to soften a gap.

**T3 — No invented timeline entries.** Nothing appears in Work Experience that was not a role. Gaps are gaps.

**T4 — ATS parseability is a floor, not a priority tier.** Layer 1 structural rules bind all other layers. An override that would break parsing is invalid; find another expression of it.

Precedence for everything else: Layer 4 > Layer 3 > Layer 2, with Layer 1 as the floor beneath all three.

**Steering is in scope when the document is composed.** The candidate's own instructions — what to emphasise, what to play down — are held by the writer at the moment it decides what the document says, not handed to it after the decision was taken elsewhere. **Content the candidate demoted is not evidence**: it cannot be the hook, the lead, a top-three achievement or the proof offered for a requirement in the ad, however well it answers it, and where the record offers no other evidence for that requirement, the requirement goes unanswered rather than the instruction ignored. **Content the candidate emphasised leads and is proved** with the facts the record holds for it; an emphasis reduced to one passing clause has been ignored, not applied. Demotion is never deletion — the timeline keeps every role and date (T2), and demoted content may still appear once, late and plainly, where leaving it out would make the story incoherent. And steering never adds: it reorders, reframes and cuts real content only. Where it asks for something the record does not evidence, the closest evidenced thing is foregrounded and nothing more is said.

## What the CV IS (read this before any rule below)

**The CV exists to get this person shortlisted.** It is the record, and its
constraint is accuracy — but an accurate document nobody shortlists has failed
exactly as a fabricated one has. The invariants above are absolute; everything
else in this document earns its place by making a shortlist more likely.

**The layers are the specification of a finished CV, not the text of the writing
prompt.** Restating all of them to the writer produced, on the CV, the defect
measured on the cover letter on 2026-08-15: a prompt whose standing instructions
dwarf the candidate's own material, so every document reads the same. The CV
writing prompt therefore carries the record, the ad, the invariants, the
document's furniture (the section set, the date format, the markdown shape) and
the candidate's voice and steering — and nothing else. Layers 1–5 are enforced
downstream by Layer 6, deterministically, where a violation is caught rather than
merely asked against, and the single regeneration carries the specific failure
back to the writer.

**A rule returns to the writing prompt only after a run shows the CV is better
with it.** Same standard as the letter: a rule never compared with its own
absence is a guess. The comparison is `scripts/test-generate.mjs` against a real
record and a real ad, at least two samples, recorded in `COVER_LETTER_LOG.md`.

## What the cover letter IS (read this before any rule below)

**The letter exists to PERSUADE. Its single job is to make the reader decide to
call this person for an interview.** Everything else in this document about the
letter — every clause, every check, every ban — exists only insofar as it makes
that outcome more likely. A rule that makes a letter more compliant and less
persuasive is a defect in this document and is removed, not obeyed.

The letter is NOT a contract, a compliance artefact, or a record. The CV is the
record; its constraint is accuracy. The letter argues, and argument is the point.
Two consequences follow, and both were established by a real comparison:

- **Optimising against tells is not the same as optimising for persuasion.** A
  letter written for KUBO by a plain prompt — the master record, the ad, and
  "highlight what aligns, professional tone" — beat this pipeline's output
  decisively in Nik's reading, while breaking three of this document's rules
  (a boilerplate opener, a derived tenure claim, an identity epithet). The bans
  were removing what made letters land while the letters stayed unpersuasive.
  A rule earns its place by being shown to help a letter persuade; absent that,
  it goes.
- **The only limits that hold unconditionally are the invariants.** Never
  fabricate, never falsify, never claim a duration the record does not state.
  Those are not style rules — a letter that invents is worthless whatever it
  achieves. Everything else is subordinate to persuasion.

**How a letter persuades, concretely** (all four observed in the letter that
won, and absent from this pipeline's output):

1. **It answers what the ad says it does NOT want.** The KUBO ad asked for
   someone who builds relationships, explicitly "ne někoho, kdo celý den
   obvolává studené kontakty". The winning letter answered that directly — the
   same growth number reframed as "not through aggressive sales tactics, but by
   providing exceptional service". An ad's negative space states the employer's
   real fear, and answering it is the most persuasive move available. Read the
   ad for what it rejects, and answer it where the record can.
2. **It opens on the employer's problem, not the candidate's latest job.** The
   reader cares about their own mission first. A letter opening on the
   applicant's most recent role reads as a self-description that happens to have
   been posted to them. **The standing shape below states the opening in full
   and this clause does not restate it**: three rules ordering one paragraph is
   why the writer obeyed none of them.

   **But never in the ad's own words.** Opening by quoting or paraphrasing the
   employer's copy back at them — their mission statement, their phrasing for
   what they are building, the sentence they are proudest of — is not
   persuasion. It is the ad returned to sender, and it reads as a mail-merge:
   the one move that proves nobody thought about the job. The reader wrote that
   text; being shown it teaches them nothing. Understanding of the problem is
   demonstrated by naming something the candidate DID about a problem of that
   kind, in the candidate's own words, in the first sentence. Individually
   striking words from the ad ("choreography", "compounding", "handover") are
   the ad's fingerprints and do not belong in the letter at all; ordinary
   domain nouns the job cannot be discussed without are not borrowings.
3. **Relevance beats recency in choosing evidence.** The winning letter reached
   back nine years for a university lectureship because the ad is about
   presenting to educators, and left the newest AI work in a supporting role.
   Most recent is not most persuasive.
4. **The shape follows the ad.** Where an ad lists distinct asks, answering them
   under short labelled themes is clearer than prose and is permitted. Flowing
   paragraphs are a default, never a requirement.

## What the letter is ABOUT (owner spec, 2026-08-20)

Set by Nik and binding. It answers a question the clauses below do not: given
that the letter persuades, what is it persuading *with*?

**Its subject is what the candidate and the company have in common** — a shared
way of working, argued in language that persuades and reaches, where it can, for
inspiring. Not a narration of the CV. A letter that walks the reader through the
candidate's roles in prose has no reason to exist, because the CV is attached and
does that better. And **if necessary, and only if necessary, it handles one red
flag** (C2 governs how).

**The ad has a stance, and it is read separately from its requirements.** An ad's
prose states what the company is, what it believes and what it is reaching for —
the sentences built on *we're building*, *we believe*, *our goal is*, *we're
looking for* — and it marks what it cares about by repeating a word (Invity's ad
says "simple" twice) and by bolding. That stance is the raw material for common
ground. The requirements are a different thing and come from the labelled
sections ("What You'll Do", "About You", however the ad titles them); the
remaining prose is read for context.

**Three rules bind what the writer may do with the stance, and they are why the
extraction is separate from the writing:**

1. **Never echo their phrasing.** Their stance is understood, never returned.
   "Simple, automated investing" does not reappear as "simple and automated" in
   the letter. This is the existing no-borrowed-copy rule (point 2 above),
   applied to the stance lines specifically, where the temptation is strongest.
2. **Never claim their domain.** A licence, a regulation, a technology or a
   market the candidate's record does not evidence is context that tells the
   writer what kind of company this is — never material to write about. Invity's
   MiCA licence is the worked example: it is bolded, it describes where they are
   today rather than the job's future, and a letter that discusses it makes the
   candidate an authority on something they have never touched. Lecturing a
   reader about their own field is the fastest way to lose them. The existing
   rule that the ad is not a source for the candidate's background (Layer 6,
   check 23) is the same principle; this states it for stance as well as
   industry labels.
3. **Show the equivalent from the candidate's own record.** For a stance line
   worth answering, the move is to name what the candidate did that shows they
   work that way — their fact, their words. Common ground is demonstrated, not
   asserted.

## The cover letter's contract (four clauses, enforced in code)

Everything else about the letter is judgement. These four are not. They are the
things a letter must do to be a letter at all, and a letter that misses one is
not a weaker letter — it is the wrong document. They are therefore stated ONCE,
at the top of the writing prompt, and checked deterministically after the letter
is written (Layer 6, checks 26–30). A failure regenerates the letter with the
specific failure named, on the same mechanism as the market word band, which is
the one enforcement in this pipeline that demonstrably works.

They are stated once because repetition is not enforcement. The same requirement
restated in three blocks with three different emphases does not bind three times
harder; it dilutes, and it crowds out the room the writer needs to actually
compose. Guidance that repeats a contract clause is deleted, not softened.

**C1 — It answers the ad's requirements with the record's evidence.** Where there
is an ad and the record can answer at least one of its requirements, the letter
answers at least one, with an achievement the master evidences. Not the ad's
words restated, not an assertion of fit: the evidence. Where the record answers
nothing the ad asks, the clause is inert and the letter argues from what the
record does hold.

**C2 — It addresses a red flag when one exists, for every applicant.** If the
analysis records a concern a recruiter would raise and the record holds a fact
that answers it, the letter addresses it — once, flat, inside the argument, under
the Layer 4 rules for how (at most one, never the opening, never the close,
carrying a master fact, never restating the doubt). This applies to every
applicant, not only to the visibly difficult cases. A flag left unaddressed
because no upstream step pre-approved it is the letter failing silently: the
analysis names concerns, and the letter reads that list itself rather than
waiting to be handed a curated subset of it. The exceptions stay exactly as Layer
4 states them — a flag the letter cannot improve (age, salary, a bare seniority
mismatch) is left alone, and where the record holds no answering fact there is
nothing to address.

**C3 — It is in the candidate's voice, or in deliberately plain human prose.**
Where voice samples exist, the letter is composed in that voice from its first
sentence (Layer 2). Where none exist, the fallback is not the model's default
register: it is deliberately plain human prose — short words, varied sentence
lengths, the point first, no throat-clearing, no stock phrase. The absence of a
voice profile is not permission to write like a brochure.

**C4 — It obeys the steering, and it is in the requested language.** The
candidate's emphasise and play-down instructions bind as the invariants' steering
paragraph states: emphasised content leads — it is present in the FIRST
paragraph, proved with a master fact — and demoted content is absent from the
first paragraph entirely. And the letter is written in the language the candidate
requested; where they requested none, in the language the record and the ad
imply. A letter in the wrong language is not a quality defect, it is an
undeliverable document.

## The letter's standing shape (owner spec, 2026-08-19)

Set by Nik and binding. Where it collides with a rule elsewhere in this
document, this section wins and the other rule is edited to match, not
quietly obeyed alongside it.

**Address a named person wherever the ad gives one.** The HR contact or hiring
manager's name is read off `job_extraction.hr_contact` and used. Only where no
person survives that read does the letter fall back to the neutral form. A name
is never guessed.

**Establish alignment immediately.** The target role and the company are named
in the first paragraph, with why this applicant is going for this position and
their core value proposition, in one or two sentences.

**Target the ad's actual requirements.** Read the ad for its top terms, required
skills and core responsibilities, and work them into the letter naturally. A
pasted keyword list is not integration.

**Prove value with contextual proof.** Two or three targeted narrative bullets
or short paragraphs, each connecting a past achievement to a challenge this role
actually names. High-impact metrics — percentage, revenue, time saved — carried
with the brief context of how they were achieved. A number with no story behind
it is a statistic, not proof.

**Complement the CV, never copy it.** The letter carries what bullets cannot:
the background behind a major achievement, the reason for a transition, the
motivation for this application.

**Structure.**
- Header: professional contact details, styled to match the CV.
- Salutation: a named individual wherever one exists.
- Opening: the position applied for, genuine enthusiasm, and the primary value
  hook.
- Body: qualifications aligned to the ad's requirements through specific
  achievements.
- Close: interest restated, a clear call to action about an interview, and a
  professional sign-off.

**Length and tone.** 250–350 words, one page maximum; the per-market band in
Layer 5 sets the exact figure where a market convention is shorter. Active,
confident, direct, and pitched to the target industry's culture.

## Layer 1 — Machine parseability

**Headers.** Standard names only, taken from the section-name registry for the CV's output language (en/cs/pl today). Each slot has one canonical name plus accepted market variants; a heading standard in any registered language is valid. Projects renders only when the Under-qualified or Career Pivot override is active, and only from evidenced master entries. No creative section names.

**Layout.** Single column. No text boxes, tables, graphics, icons, headers/footers carrying content, or columns.

**Titles.** Print the official title exactly. If it is non-standard, the industry-standard equivalent may be used in the skills/summary prose, never bolted onto the title line.

**Dates.** MM/YYYY on every dated entry, one format throughout. The "Earlier Career" section is the only permitted undated entry. Never switch to YYYY-only to hide anything. A month the master does not record is never invented: print the year as recorded and report the missing month to the user as a warning.

**Recency window.** Full detail for the last 10–15 years. Older roles collapse into an undated "Earlier Career" section — titles, employers, and the location where the location itself carries weight (a major market the candidate genuinely worked in). Employers are named individually; a category ("financial institutions and tech companies") is not a substitute for a name. Under the Older Applicant override the window is a hard boundary checked in code (Layer 6, check 10), not a preference the writer weighs against relevance: an old role that is genuinely relevant is served by its name in Earlier Career, and a full dated entry outside the window undoes the override whatever it says.

**Earlier Career form.** One bullet per role, reverse-chronological, each bullet `Title, Employer` plus ` — Location` where the location earns its place. No dates, no achievements, no prose: a bullet that describes what the role involved is a Work Experience entry smuggled past the recency window. **At most six bullets**, chosen for the strength of the name and the relevance of the title, not simply the six most recent — the section exists so a recognisable employer is not lost, and a longer list drags the reader backwards through a career the window is meant to close. Where more roles fall outside the window than the section prints, the remainder are simply omitted; no "and others" line, no count. These bullets are outside the Layer 2 bullet ceilings and the metric-fallback share, which govern Work Experience only. A location prints only where the master records it from the source — it is never inferred from the employer's name, however well known its home city.

**Education contains only qualifications awarded to the candidate** — degrees, diplomas, certifications earned. An appointment to teach, lecture, guest-lecture or examine at an institution is employment, not a qualification, and belongs in Work Experience, nested under its umbrella entry if it was delivered through one.

**Education.** Retain graduation years by default. Strip them only when the Older Applicant scenario is active (defined in Layer 4), and then strip all of them, never selectively.

## Layer 2 — Human scannability

**Impact zone.** The first ~120 words must carry the target-facing headline, a 2–3 sentence value proposition, and up to three of the strongest evidenced achievements. The headline and value proposition are the Summary's opening prose; the achievements are up to three bullets immediately beneath, inside the Summary block. Print only as many as the master genuinely evidences — three is a ceiling, not a quota, exactly as role bullets are. They may restate a Work Experience bullet: the duplication is intentional, and each must carry the role name so it does not read as a floating claim. What is not permitted is restating it in the SAME WORDS. The top block is a compressed, re-angled statement of the achievement — the fact is identical, the sentence is not. A verbatim copy makes the reader feel they are reading the page twice and wastes the impact zone on words already spent. Checked by word count from the very top of the document — the name/contact block, the headline, the proposition and the bullets all count — not by rendered lines.

**Rendering.** The Summary prose is justified. The achievement bullets are standard left-aligned bullets in the same style as Work Experience bullets — never centered, never a distinct visual block.

**Openers name facts, not identities.** The Summary's first sentence states something the candidate did or built. Identity epithets — "veteran", "seasoned", "accomplished", "technology leader", "industry expert" and their equivalents — are banned in the CV and the cover letter: they assert a category instead of evidence, and under the Older Applicant override "veteran" actively re-emits the signal that override exists to manage.

**Banned phrasing.** A closed list of stock phrases is barred from both documents: filler that states nothing ("results-driven", "proven track record", "passionate about", "dynamic", "synergy", "best-in-class", "seamless", "robust", "value-add", "in today's fast-paced world"), the boilerplate wrapper ("I am writing to express my interest", "I believe I would be a great fit", "as you can see from my CV", "I am excited about the opportunity", "please do not hesitate to contact me"), and the manufactured-significance verbs ("delve into", "underscore", "leverage my expertise", "spearheaded a paradigm shift", "a testament to"). These are not weak writing to be improved on request — they are the phrases that mark a document as machine-written on sight, and five of them undo a page of real evidence. The list is enforced in code (Layer 6) and repaired before delivery, because a rule the writer is merely asked to follow is a rule that is followed most of the time — and a defect in the app's own prose is fixed, never reported to the user as though it were theirs to solve. It is closed and exact rather than a judgement about tone: it grows by adding a phrase actually seen in output, never by inferring a family from one member. The chosen tone's deliberate vocabulary and ordinary strong verbs are outside it.

The list is **per language, and not a translation**. Czech stock phrasing is its own set — "v dnešní dynamické době", "proaktivní přístup", "týmový hráč", "s nadšením se ucházím o pozici", "v neposlední řadě" — and translating the English entries produces phrases no Czech writer uses while missing the ones they do. Each registered language holds its own list, on the same footing as the section names and the bullet band; a Czech document is judged on Czech tells only, and English filler inside it is a separate defect. Where the output language is left to the writer, every registered list applies, because the document is in one of them. An unregistered language is checked against nothing rather than against English assumptions.

**The candidate's own voice.** Where the master CV carries a `voice_guide` — the candidate's own written statement of how they write — it governs the CV's prose: the Summary's cadence, sentence shapes and vocabulary, and the register of the bullets. It sits under this layer, not above it: it never buys a longer bullet, a paragraph in Work Experience, a non-standard heading or a banned phrase, and it can never license a fact the master does not hold. It decides HOW the evidenced content reads, never WHAT is said. Absent a guide, the master's `voice_samples` serve the same purpose more weakly, and absent both the writing is neutral.

**Voice governs SHAPE, not only wording.** What makes a document read as machine-written is structural before it is lexical: every sentence the same length, every paragraph the same weight, the point always arriving in the same position. A voice applied only to word choice cannot reach any of that, and a document corrected clause by clause keeps the shape it was born with — which is the shape that reads as a machine. So where a candidate's voice is recorded, it governs the document's shape as well: the spread of sentence lengths, how short the shortest sentence gets, how long a paragraph runs, whether the point lands first or last, and how the piece opens and closes. This binds the cover letter, whose prose is continuous, far more than the CV, whose bullets have their own form. It remains under this layer and under Layer 1: it never buys a banned phrase, a broken heading, an unparseable page or a fact the record lacks.

**How far the voice travels is judged against the target's own register.** A voice recorded from someone's blog, their email or their personal writing is evidence of how they write, not proof of what suits this application. The job ad is written in a register of its own, and that register decides how far the recorded voice is carried: a warm, informal, first-person ad earns the candidate's own narrative shape and their casual cadence; a terse, formal, corporate ad earns the same voice held closer in — the same rhythm and directness, less of the informality. The judgement is made from the ad's own wording, and it is the writer's to make. Where there is no ad, the target's conventional register applies. What never changes with register is the ban on invention: an informal ad does not license colour the record does not hold.

**Bullet form.** [Action verb] + [scope/context] + [quantified outcome].

**Metric fallback.** Where the master holds no number, use [Action verb] + [method/tool] + [concrete deliverable]. A deliverable is a thing that shipped or changed — not an adjective. Fallback bullets are permitted without limit where the master holds no metrics; the cap of one third of bullets per role applies only when metrics exist and were not used.

**Volume.** Bullets 15–25 words in English; 12–22 in Czech and Polish, which carry the same content in fewer words — no articles, heavy inflection. The band is set per language in the section-name registry; an unregistered language uses 15–25. 3–5 bullets for the two most recent roles, 2–3 for the rest. Bullet counts are ceilings, never quotas. If the master evidences fewer, print fewer. A role with one evidenced achievement gets one bullet.

**Density.** No paragraph blocks inside Work Experience.

**Skills — ordered by recency, clustered by domain.** Skills are listed in the order of the most recent role that evidences them: the current role's skills first, then the next role's, and so on. Within that order, skills belonging to the same domain sit adjacent — a domain is never split by an unrelated entry. Grouping is expressed by ORDER alone; the section stays a single flat bullet list with no sub-headings, labels or categories, because Layer 1 permits no heading below the section level.

A skill whose only evidence lies outside the recency window — in the "Earlier Career" line or older — is not listed at all. The Skills section describes the candidate now, not the whole career, and an old speciality listed alongside current ones both misdirects the recruiter and re-emits the age signal the recency window exists to manage. Every listed skill traces to the master AND to a role the CV actually shows.

## Layer 3 — Job matching (only with a job ad)

**Coverage, bounded.** Extract required hard skills, tools, and certifications from the ad. Use the ad's exact term only where the master evidences it. Unevidenced requirements are reported to the user as a gap — never quietly filled.

**Priority alignment.** Within each role, order bullets so those answering the ad's top three requirements come first. Role order stays reverse-chronological.

**Selection.** Bullets are chosen for relevance to this ad; irrelevant true achievements are dropped, not reworded into relevance.

**Cover letter — depth, not coverage.** The letter answers the ad's most important requirements with the candidate's strongest evidenced achievements, and it does so by going DEEP on two of them rather than touching five. Two pieces of evidence, argued properly — what the situation was, what the candidate did, what changed — beat a paragraph that names six employers, because the CV already lists everything and a letter that repeats it in prose is a career summary with a salutation on top. A third may appear where it genuinely earns its place; a fourth is the letter losing its argument. What is left out is not lost — it is on the CV. No claim in the letter that is absent from the CV.

**The claim is named in the first paragraph.** One sentence stating why this candidate and this role belong together. Everything after it is proof of that sentence. A letter whose claim has to be inferred from four paragraphs of history has not made one.

**The letter is composed, not executed.** The analysis supplies the letter with EVIDENCE, never with a plan: the ad's real requirements, the achievements in the record that answer each, the concerns a recruiter would raise, and the active scenario. What the letter then argues — the fact it opens on, which requirements it answers and in what order, whether it addresses a concern at all, what it asks for at the close — is decided when the letter is written, because that is the only moment at which the candidate's own steering, the chosen tone, their writing voice and the market's length are all in hand. A plan fixed during analysis is fixed before the candidate has spoken: it decides the four things that constitute a cover letter, leaves the writer arranging prose around a skeleton it did not choose, and produces the same letter for every candidate with different nouns in it. Where the analysis is missing or thin, the writer still composes — from the record, the ad and the steering directly. Analysis output that arrives phrased as an instruction, an ordering or a finished sentence is material and nothing more; the writer owes it no obedience and no line-by-line answer.

**The letter must not be handed the CV's plan.** The CV blueprint — section orders, bullet counts, rewrite notes — governs a document the letter is not writing. A letter given it answers it the only way it can, by narrating the CV back.

**The letter reads the ad ITSELF, in the employer's own words.** The extraction — position, requirements, responsibilities as a labelled list — is the right input for the CV, which is a coverage and ordering problem. It is the wrong input for the letter. An ad has a register, and a letter that reads as written for THIS job is one that answered that register: "nebojí se computer science", "neexistuje žádný univerzální recept" are the employer talking, and none of it survives extraction. Every letter written from the same de-natured list reads the same, which is precisely what happened. So the ad's raw text rides on the analysis record and reaches the writer verbatim; the extraction remains the fallback for records saved before this and for standalone reviews.

**The salutation is a fact, not a formula.** Where the ad names a person, the letter addresses that person. "Dear Hiring Manager" over a named contact is not neutral politeness — the name was on the page, and using it is the first evidence that the letter was written for this application. The name comes from the extracted job data; where the ad names no one, the neutral form is correct and no name is guessed at.

**And the name is DECLINED into the salutation's own language.** This is an EU product and Czech and Polish salutations take the vocative: *Vážený pane Nováku,* — never *Vážený pane Novák,* — *Vážená paní Nováková,*, *Szanowny Panie Kowalski,*. A nominative name in that slot is a grammatical error in the first line of the document, visible to every native reader, and it undoes the credit that using the name at all was meant to buy. Where the gender or declension is genuinely unclear, the neutral form for that language is correct — a wrong ending is worse than no name. The honorific (*pane* / *paní*, *Panie* / *Pani*) is part of the salutation, not a title, and is required. Check 20 compares the name and the salutation on their diacritic-folded stems, and on EITHER name part, because Czech addresses the surname where English addresses the given name.

**The close is the candidate speaking, and the opening is never a general truth.** The last line is first-person and asks for the next step; what it asks for is the writer's call. A THIRD-PERSON MAXIM about the role or the industry — "Managing a recommendation engine requires a product leader who can ground algorithmic complexity in human behaviour" — is barred at BOTH ends of the letter. It is a thesis about the job rather than a fact about the applicant, it would open or close fifty other candidates' letters for the same ad, and the reader learns nothing from it. Banned at the close only, it simply migrates to the opening; it is banned in both positions for that reason.

**The letter opens on something real.** The opening rests on a fact the record holds — something the candidate did, built or ran that this role needs. What is banned is the opening that rests on nothing: the act of applying ("I am writing to apply"), an identity asserted in place of evidence ("As a seasoned leader"), and **invented scene-setting** — a remembered scene, a mood, a moment of realisation, any colour the master does not record. That last one is the real defect behind the anecdote: not that a letter tells a story, but that a story needs detail, and a writer with no detail invents it. "I remember one of my first projects…" and "It was 2019 when…" are barred where the record holds no such project and no such year.

Where the candidate's recorded voice builds to its point rather than leading with it, the letter may open the same way — provided every sentence it builds on is a fact from the record, and provided the ad's own register carries it (Layer 2). The opening is the sentence with the least competition for attention in either document. Spent on a real thing done, in this candidate's own manner, it is doing its job; spent on the act of applying, on an epithet, or on colour nobody can verify, it is spent on nothing.

**A capability the candidate lacks is not argued around.** A requirement the master does not evidence may appear in the letter only as forward-looking interest, in the candidate's own words, and never as a claim of present ability. It is reported to the user as a gap by the same rule that governs the CV.

**The letter makes one argument.** A cover letter is a single claim about why this candidate and this role belong together, proved in three or four paragraphs. Every paragraph advances that claim or is cut. This is what separates a letter from a list, and it is the rule most easily lost: the letter is fed a strategy, evidence for the ad's requirements, red flags, an active override and a body of guidance, and a model satisfying each in turn produces one sentence per instruction — a document with no through-line, where the seams between the instructions are visible to any reader. Guidance is raw material, never a running order. Several items may be answered by one paragraph, and an item with nothing to add to the argument is dropped. Nothing that reaches the writer is copy to be transcribed: sentences drafted upstream are rewritten in the candidate's own recorded voice, at the length the letter has room for, or not used. The argument decides what is said and in what order — not the shape of the guidance that informed it.

**Check 24 — a requirement the record cannot answer, asserted anyway.** The analysis already computes which of the ad's terms the record does NOT evidence (`ats_keywords_missing`) and shows them to the candidate as advice. Nothing enforced it, and a shipped letter claimed CRM work over a record with no CRM in it while that same analysis listed CRM as missing twice. The AI verify pass's borrowed-requirement category did not fire, because the claim arrived as routine habit ("I use them to evaluate data in the CRM") rather than as the loud "extensive CRM experience" its rule describes — and casual phrasing makes a false claim MORE credible, not less. So the check is deterministic code over the list the pipeline already produced, and it matches short acronyms WHOLE: the stem machinery behind check 23 discards anything under four characters, which made CRM, SQL, SAP and ERP structurally invisible to it. The master stays the only evidence — a term the record supports is never cut, however stale the missing-list. The list is written by a model for a human to read, so its entries drift between a bare term and a phrase ("CRM software administration"): from a phrase only the ACRONYMS are taken, because a named system or standard is checkable while the ordinary words around it ("software", "outreach", "metrics") are too common to carry a claim and cutting one would damage a true sentence. And a term the document only DISCLAIMS — "nenabízím profil klasického B2B obchodníka" — is not a claim at all, is often the most persuasive sentence on the page, and is left alone; that judgement belongs to the repair pass, which is the layer that can read the sentence. Like checks 17 and 23 it does not warn: the app wrote the claim, so the app removes it before delivery.

**The deny-list is computed from the ad, not taken from the model.** `ats_keywords_missing` was check 24's only source until 2026-08-16, and it is written by the same call that writes `ats_keywords_present`, under a prompt telling that call to be GENEROUS about what counts as present. A term the model wrongly reads as earned is by construction absent from the missing list, so the deny-list is empty in exactly the case that leaks: on the KUBO run it caught CRM and missed "B2B", "Account Management" and "onboarding", each of which had been laundered through `ats_keywords_present` behind a proof quote nothing verified. The ad's own acronyms are therefore read straight off the raw ad text (`analysis.job_text`), and the missing list is one input rather than the source. The employer's name and the advertised job title are exempt: an ad is a source of facts about the employer, and naming them asserts nothing about the applicant.

**Every "present" keyword carries a proof quote, and the quote is checked against the record.** `analysis.ats_keywords_present` is the one list that is both safe to put on the CV — it is the source of `skills_to_highlight` — and, by counting as present, excluded from `ats_keywords_missing`, the deny-list checks 24 and 26 enforce. So a term the model merely BELIEVES is earned leaks past every layer at once, which is exactly what "B2B", "Account Management" and "onboarding" did. The analysis therefore returns each entry as a term plus the phrase from the record that proves it, and the proof is verified deterministically at the point the analysis is produced: it passes if it appears in the record, or if every content word of it is present by stem — so inflection and word form (Manager / management, CZ and PL endings) never cause a false drop, and a concept expressed in DIFFERENT WORDS still passes, because what is checked is the quote, not the term. A term whose proof the record does not carry, or which arrives with no proof at all, leaves the present list and becomes a gap reported to the candidate. No synonym matching, no second model, no additional spend.

**Check 26 — the same borrowed requirement, on the CV.** Check 24 runs on the letter alone and the CV leaks identically; the same run printed "B2B Client Relations" and "Account Management" under Skills and "B2B Account Manager & Tech Enablement Specialist" as the headline, over a record that says none of them. Severity is by SLOT, because the slot resolves the ambiguity a term list cannot: a Skills entry and a headline are bare assertions with no surrounding prose to make them innocent, so a borrowed term there is always a claim about the candidate and fails HARD, triggering the one regeneration. Prose can carry an ad word without asserting it — naming the employer's world, restating the requirement being answered — and is left to the AI verify pass, which reads the sentence rather than the word. Check 14 cannot cover this: it matches five-letter stems against the master as one flat string, so "B2B Client Relations" clears on "client" and "relations" from a 2003 role, and short terms are invisible to it entirely.

**Check 25 — the same sentence printed twice.** In a 250–350 word letter an exact repeat is never intentional; it is the writer restating itself, or span surgery leaving a clause that already existed elsewhere. Only exact repeats are cut (case, spacing and punctuation folded), only the later one, and nothing under six words — a short line may be a deliberate echo, and cutting a real one costs more than leaving it. Deterministic, no second AI call.

## Layer 4 — Situational overrides

Maximum two active at once. Every rule below reframes, reorders, relabels or cuts real content; none inserts a fact.

**The overrides reach the cover letter too.** The scenario that shapes the CV shapes the letter, but not with the same instructions: a letter has no sections to reorder, no dates to format and no bullets to cap, so a CV mitigation transplanted into it is noise. Each override therefore carries a second, letter-specific rule governing what the letter leads on, what it may address in the candidate's own recorded words, and what it must not claim. The same cap of two applies, and the invariants and Layer 3's requirement-answering still outrank it. Where an override forbids a fact on the CV — a cumulative career total under Older Applicant, years of experience under Under-qualified — it is forbidden in the letter as well; the letter is not a place to say what the CV was not allowed to.

**Red flags are defused in the letter, at most one, and only where silence costs more.** The analysis names the concerns a recruiter would raise; the letter addresses at most one of them, or none, and none is a common and legitimate answer. Only a flag a recruiter will otherwise resolve against the candidate qualifies: a gap over six months, the permanence question under a standing consultancy, a location or relocation mismatch, a required capability the candidate has a genuine adjacent answer to. A flag the letter cannot improve is left alone — age, salary, a seniority mismatch with no answer behind it. Naming those introduces the objection to a reader who had not yet raised it, and the CV's own overrides already do what can be done about them.

**The letter reads the flag list itself.** The concerns available to the letter are the ones the analysis recorded, in full — not only those an upstream step pre-selected and paired with an answer. A curated subset that comes back empty means no red flag is ever addressed for that applicant, which turns C2 into a rule that fires only when something else happened to permit it. So the letter is handed the analysis's own red flags alongside any pre-paired concerns, and it decides — under the qualifying test above and the invariants — which one, if any, it answers. Deciding to answer none remains legitimate; never having been offered the choice does not.

One flag, one clause, once — inside the body of the argument, never the opening and never the close, stated flat and then passed. Two defences read as a defence and three read as an admission. The clause carries a fact from the master or it is cut: reassurance that the candidate is confident, adaptable or a fast learner defuses nothing, and where the record holds no evidence the flag is not addressed at all. It is never restated in the concern's own language — the letter states the positive fact that makes it a non-issue rather than repeating the doubt first — and it carries no apology and no explanation of motive the master does not record, which the invariants forbid in any case.

**Recent grad.** Lead with education, internships, projects and demonstrable skills rather than a thin work history. Never pad or invent experience to fill space.

**Career pivot.** Target-facing headline at the top. A Core Competencies block directly under the summary, populated only with transferable skills the master evidences. Past titles unchanged; bullets reordered to lead with transferable work.

**Major pivot.** Foreground the few genuine bridges; the rest is cover-letter narrative, not CV content. Do not pretend the distance is small.

**Under-qualified / stretch.** Weight projects, certifications, and rate-of-progression above total years. Do not state years of experience anywhere.

**Over-qualified.** Reframe strategic phrasing toward hands-on delivery. Titles unchanged. Optionally drop the most senior-signalling bullets, never the role.

**Standard career progression.** Reinforce the clean trajectory and growing scope. The leverage is sharpening impact and matching the ad's exact language, not repositioning.

**Senior portfolio / independent consultant.** A standing independent practice whose dates span or overlap one or more shorter corporate roles. The candidate was never between jobs — the practice ran throughout, so there is no real gap and no string of short jobs. Optionally fold the overlapping corporate roles into the consultancy window as concurrent engagements, so the timeline reads as one unbroken practice with engagements inside it. That fold is a recommendation the analysis makes case by case, never a default: keep a marquee employer distinct where its name is the stronger asset. Either way, every corporate role keeps its real employer, title and dates; never relabel an employer as a client of the practice.

**Older applicant.** Apply the 10–15 year window strictly, strip all graduation years, and never state a career total.

What is banned is the *cumulative* number — "25+ years' experience", "over two decades in banking", "a decade of expertise". That is a single figure the screening sort can act on before it reads anything, and it prices and dates the candidate in seconds.

What stays legal is duration scoped to one role, project or engagement — "five years running the Prague platform team", "twelve years at Deutsche Bank". Depth does not live in the total; it lives in scope, marquee employers and long tenures inside the visible window. Banning those would strip out the evidence the override exists to protect. Suppressing the total changes the order the fact is learned in, not whether it is known: by the interview the decision to consider the candidate is already made.

Roles that explicitly buy the decades — board, advisory, expert witness, some executive search — are the exception, and that is a judgement the analysis makes case by case, never a default in this override.

The ban binds the analysis, not only the two documents. Any strategy, action item or example sentence the analysis hands the writer is held to it: a total banned on the page cannot be smuggled in as guidance that tells the writer to put it there. The same holds for every restriction an active override imposes.

Trigger: the earliest evidenced role begins more than 15 years before the most recent role's end date. That trigger is computed in code from the master's dates, not chosen by the model, and it is inserted ahead of the two-override cap so a co-occurring scenario cannot displace it. The master keeps every role and date intact — this is selection, not editing.

**Employment gap.** Dates stay MM/YYYY throughout; the gap is simply visible. Under 6 months: nothing. Over 6 months: no timeline entry, no summary apology — one neutral line is permitted only if the master records what happened (study, caregiving, illness, relocation) and only in the candidate's own recorded words. Otherwise silent.

**Job returner.** Same as gap, plus: lead the summary with current capability rather than history.

## Layer 5 — Market conventions

Set per target market, applied last. Market rules key off the job ad's country when there is one, otherwise the candidate's own. An unrecognised country falls back to the neutral default rather than to UK/US assumptions. Output language and target market are independent — a Czech-language CV may target a foreign market.

**UK/US/IE.** No photo, no date of birth, no marital status, no nationality. 2 pages max (1 for under ~5 years' experience).

**DE/AT/CH.** Photo and structured personal details are conventional; follow local norm if the user supplies them.

**CZ/PL.** Photo optional; include a data-processing consent line if the user supplies one.

Never generate a photo, a date of birth, or a consent statement the user did not provide.

**Cover letter length is a market convention too.** The letter's word budget belongs here rather than as one global number, because the norm genuinely differs: in CZ/PL the *motivační dopis* / *list motywacyjny* is a short covering note of roughly 200–300 words that stays well inside one A4, and a letter that runs past it reads as padding, not thoroughness. The Anglo and DACH markets carry the longer letter comfortably. Each market therefore sets a band and a default within it: CZ/PL 200–300, default 250; every other market 250–350, default 275; an unrecognised country takes the neutral 250–350. The band is a ceiling to cut against, never a quota to fill — the letter makes its argument and stops, and a letter that lands under its band because the argument is finished is correct.

## Layer 6 — Output validation (must pass before delivery)

1. Every hard noun in the output (skill, tool, employer, title, certification, number) traces to the master. Any that does not → block.
2. Dates in the output match the master exactly.
3. No Work Experience entry that is not a real role.
4. Single column, standard headers, one date format across all dated entries (the "Earlier Career" section is exempt, as is a year-only entry permitted by check 13).
5. Impact zone within 120 words and contains headline + proposition + the evidenced achievements, up to three, each naming its role, and none of them a word-for-word copy of the Work Experience bullet it restates.
6. No role exceeds its bullet ceiling → block. The ceiling is a count, not a judgement: 3–5 bullets for the two most recent roles, 2–3 for the rest, and a role that prints six has broken a rule nothing about this candidate's record can justify. Reporting it instead of blocking it shipped the over-long role and told the candidate about it, which is the app's own failure handed to the user to solve. **The bullet word band blocks on the same reasoning.** A bullet at 42 words where the band tops out at 25, or at 12 where it starts at 15, is a count and not a judgement — the first is a paragraph wearing a bullet's clothes and the second is too thin to carry an achievement. Reporting them printed the broken bullet and told the candidate about it, which is the app's own writing failing handed back to the person who cannot fix it. The band is the one set per language in the section-name registry, so a Czech bullet is judged on the Czech band and never on English assumptions. **Fallback bullets over the one-third limit where the record HOLDS metrics blocks too.** The figures are already in the master; a bullet written without them is the app leaving the strongest evidence on the table and then telling the candidate about numbers they had already supplied. Distinct from check 16, which reports a role the master holds no numbers for at all — that one is genuinely the candidate's to fix, and the CV never invents a figure to fill it.
7. Market rules satisfied; no photo/DOB/consent invented.
8. With a job ad: unevidenced requirements are listed to the user as gaps.
9. Projects section present ⇒ a qualifying override is active.
10. When the Older Applicant override is active: no Education entry carries a graduation year, and no cumulative career total appears anywhere ("X+ years' experience", "over two decades in the field"). A duration scoped to a single role, project or engagement is not a total and does not fail this check.

    **And the recency window is enforced, not merely asked for → block.** No dated Work Experience entry may end more than 15 years before the most recent role ends; a role older than that belongs in the undated "Earlier Career" section (Layer 1) and nowhere else. This is the override's whole purpose and it was the one part of it no check covered: graduation years and career totals were blocked while a role dated 2004 printed in full, with its dates and its bullets, and the age signal the override exists to manage reached the page intact. The test is arithmetic over the master's own dates — the same calculation that raises the override — so nothing is judged and nothing can be argued: a year is inside the window or it is not. The failure names the offending roles and the retry collapses them into Earlier Career, which is selection of what to show, never falsification: the master keeps every role and every date (T2), and a date that IS printed is printed exactly as recorded.
11. An Earlier Career section names at least one real employer from the master, prints at most six bullets, carries no dates, and states no location the master does not record.
12. No banned identity epithet, and no TRAIT CLAIM, in the Summary or headline → block. The list was nouns only, so "High-agency Senior Product Manager" passed it and reached the top line of a delivered CV — the first words a recruiter reads, spent on a quality nobody can check and no ad asked for. A trait asserted about the candidate is a category asserted in place of evidence whatever part of speech carries it, so the two are one check. It blocks rather than reports because it is the app's own writing failing in the single most valuable position on the page. The list is closed and exact, like the banned-phrasing list: it grows by adding a term actually seen in output, never by inferring a family from one member — and it deliberately excludes the stock filler already on that list ("results-driven" and its family), which is repaired in place rather than regenerated. One defect, one owner.
13. A dated entry whose master record holds no month prints the year alone and is reported to the user as a missing month — never completed with an invented one.
14. Every entry in Skills and Core Competencies traces to the master, on the same basis as a certification: the section is a plain list, so each entry either appears in the record or it does not.
15. A listed skill whose only evidence lies in roles the CV does not show → block, per the Layer 2 recency rule, which says such a skill is "not listed at all". Listing it is the app breaking its own rule and then reporting the breach to the candidate, who cannot act on it: the role that evidenced it was collapsed by the recency window, which is the app's decision and not theirs.
16. A role printed on the CV whose master record holds no number anywhere is reported to the user, so the candidate can supply the metrics. The CV never invents them.

17. No phrase from the banned-phrasing list (Layer 2) appears in the document. It is neither a block nor a warning: it is the app's own writing failing, so the user never sees it, and it is repaired rather than reported. The AI verify pass rewrites the clause into what the record supports — or deletes it where it carries no claim — and anything that survives goes to one narrow second pass over those exact spans. Regenerating the document is not the remedy: reprinting a finished page to fix a clause reopens every judgement the draft already got right, and costs a full generation to remove five words. The repair adds no fact; where the record has nothing to put in the space, the shorter, plainer sentence is the correct outcome.

18. The cover letter's word count sits inside its market band (Layer 5). Over the band is a block; under it is neither, since a finished argument is allowed to stop early.
19. With a job ad: each of the ad's top requirements that the record can answer is answered in the letter, by an achievement the master evidences. A requirement left unanswered while the record holds evidence for it is reported to the user; a requirement the record cannot answer, or one whose evidence the candidate's steering demoted, is not a failure and is not reported.

    **The evidence is what is matched, never the requirement.** This is an EU product and the two are routinely in different languages: the requirement is quoted verbatim from the ad ("facilitujeme pětidenní design sprinty") while the letter is written in the candidate's own ("I am a Certified Google Design Sprint Master"). Looking for the requirement's words in the letter therefore finds nothing on every cross-language application, and a check that fires on every Czech ad answered in English teaches the candidate to ignore the banner. Only the evidence half — drawn from the record, in the record's language — can be looked for. And where the letter shares no language with the record at all, the check reports nothing rather than a verdict it cannot support.
20. The salutation addresses the contact the job data names, where it names one.
21. At most one red-flag clause appears in the letter, and it carries a fact traceable to the master.
22. No claim in the letter that the CV does not also support, where both documents were generated in the same run.
23. An industry or domain the cover letter names appears in the job ad or in the master. A label the letter introduces from neither source — "fintech" over an ad asking for financial advisory — is repaired before delivery and never reported to the user, on the same reasoning as check 17: an invented domain is the app's own writing failing, not the candidate's to solve. The repair is the narrow span pass, which says what the candidate actually did and lets the sentence carry no domain label at all; it never substitutes a different industry, because it has no source for one either. The list of labels is closed and exact, on the same reasoning as the banned-phrasing list: judging every word by whether the sources used it flags ordinary prose, since a verb the ad happens not to contain is not an invention. It grows by adding a term actually seen invented in output, never by inferring a family from one member. Matching is by normalised, truncated stems, so an inflected form counts as its root. The check catches an invented domain, not invented meaning, which remains the AI verify pass's work.

24. Where a voice profile exists, the cover letter carries that voice's SHAPE and not merely its wording (Layer 2). Flatness is the measurable part and it is measured: the spread of sentence lengths across the letter, the length of its shortest sentence, and the length of its longest paragraph. A letter whose sentences all land within a narrow band, or which never once goes short, or which runs every paragraph to the same weight, has the machine's shape whatever its words say — and that is the shape a reader recognises before they have read a line. It is repaired before delivery and never reported to the user, on the same reasoning as checks 17 and 23: the app's writing failed, not the candidate's.

**The shape is the writer's job, and this check is the fallback.** The letter is composed in the candidate's voice from its first sentence — voice is not a coat of paint applied at the end, and a second model restyling the first one's draft produces fragments: orphan one-line paragraphs, stub sentences, one thought chopped into three. So the writer is given these measurements as targets before it writes, and this check exists for the letter that misses them anyway. A letter that arrives with its shape already right is the normal case and no repair runs.

The repair, when it does run, is a full rewrite of the letter in the recorded voice, not a patch over clauses. A shape defect cannot be fixed inside a clause — splitting a paragraph, landing a four-word sentence, moving where the point arrives are all changes no span replacement can make, which is why a clause-level style pass leaves the machine shape exactly as it found it. The rewrite is bound absolutely by the invariants and it changes no fact, no number, no name and no date; it runs BEFORE the truth passes, never after, so every fact in it is checked afterwards exactly as a first draft's would be.

Code measures the shape; it does not judge the writing. The metrics catch a letter that is obviously flat. They cannot tell whether the letter is good, and no check in this document claims to.

25. The cover letter names at most THREE of the candidate's employers (Layer 3, depth not coverage). Counted against the master, so the company being written TO is not counted, and counted through nested engagements — a standing consultancy carries its clients as children of one entry, and those are exactly the names a letter walks. Over the limit is repaired by the same rewrite as check 24, by cutting: dropping an employer invents nothing, and every one dropped is still on the CV. Where the master itself records three employers or fewer there is nothing to measure and the check reports nothing.

### The contract checks (26–30)

These five implement the four contract clauses above. Each is computed from the
analysis, the master and the finished letter — no AI call, no judgement of
quality, only the presence or absence of the thing the contract requires. Each
failure is a hard block that regenerates the letter ONCE with that specific
failure named, exactly as the word band does; the retry is kept only if it fails
no more checks than the draft it replaces. A check whose evidence is missing
reports nothing rather than guessing, as everywhere else in this document.

26. **Language (C4).** The letter is in the language the candidate requested.
    Where they requested `auto`, the check reports nothing — there is no stated
    target to measure against. Measured on the letter's body prose, not the
    salutation or the signature block, and by the letter's own script and
    function words rather than by any single word, so a company name or a job
    title quoted from the ad in another language does not fail it.

27. **At least one evidenced requirement answered (C1).** With a job ad and at
    least one requirement the record can answer, the letter carries the evidence
    for at least one of them. Matched on the EVIDENCE half only, for the reason
    check 19 states, and silent where the letter shares no language with the
    record. Check 19 remains the warning for the requirements left unanswered
    beyond the first; this check is the floor beneath it, and the floor blocks.

28. **A red flag is addressed when one exists (C2).** Where the analysis records
    at least one qualifying concern that the master holds an answering fact for,
    the letter carries that answering fact. Where the analysis records no
    concern, where every recorded concern is one Layer 4 says to leave alone, or
    where the record holds no fact that answers any of them, the check reports
    nothing — the letter is correct to say nothing, and a check that demanded a
    clause anyway would force the letter to invent one.

29. **Emphasised content leads (C4).** Where the candidate's steering names
    something to emphasise, the letter's FIRST paragraph carries it. Matched
    against the master's own words for the emphasised content, not the
    candidate's phrasing of the instruction, since the two are routinely
    different words for the same thing.

30. **Demoted content is out of the first paragraph (C4).** Where the steering
    names something to play down, the letter's first paragraph does not name it.
    Later, plain, single mention stays permitted by the invariants — this check
    governs the opening only, which is the position that contradicts a demotion
    outright.

A failure at 1–4, 10, 14, 18 and 26–30 is a hard block. 5–9, 11–13, 15, 16 and 19–22 are warnings surfaced to the user. 17, 23, 24 and 25 are neither: they are the app's own writing, repaired before delivery.

A check whose evidence is missing (no parseable master, no section order) reports nothing rather than guessing.
