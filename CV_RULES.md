# CV Rules — Final

The canonical statement of what a generated CV must be. `prompts/cv-rules.js`,
`prompts/scenarios.js`, `prompts/market.js`, `prompts/cv-sections.js` and
`utils/cv-validate.js` implement this document. Where code and this document
disagree, this document is the authority.

## Invariants (cannot be overridden by any layer)

**T1 — Never fabricate.** No skill, tool, title, metric, employer, date, or certification may appear unless it exists in the master CV. Keyword matching is done by reframing evidenced experience, never by inserting the term.

**T2 — Never falsify the record.** Titles, employers, and dates are reproduced as recorded. Strategic layers change emphasis, ordering, wording, and what is shown — never what is claimed. Omission is permitted; alteration is not. Normalising a date's FORMAT to MM/YYYY is required; changing a date is forbidden. Year-only dates are never used to soften a gap.

**T3 — No invented timeline entries.** Nothing appears in Work Experience that was not a role. Gaps are gaps.

**T4 — ATS parseability is a floor, not a priority tier.** Layer 1 structural rules bind all other layers. An override that would break parsing is invalid; find another expression of it.

Precedence for everything else: Layer 4 > Layer 3 > Layer 2, with Layer 1 as the floor beneath all three.

## Layer 1 — Machine parseability

**Headers.** Standard names only, taken from the section-name registry for the CV's output language (en/cs/pl today). Each slot has one canonical name plus accepted market variants; a heading standard in any registered language is valid. Projects renders only when the Under-qualified or Career Pivot override is active, and only from evidenced master entries. No creative section names.

**Layout.** Single column. No text boxes, tables, graphics, icons, headers/footers carrying content, or columns.

**Titles.** Print the official title exactly. If it is non-standard, the industry-standard equivalent may be used in the skills/summary prose, never bolted onto the title line.

**Dates.** MM/YYYY on every dated entry, one format throughout. The "Earlier Career" line is the only permitted undated entry. Never switch to YYYY-only to hide anything. A month the master does not record is never invented: print the year as recorded and report the missing month to the user as a warning.

**Recency window.** Full detail for the last 10–15 years. Older roles collapse into one undated "Earlier Career" line — titles, employers, and the location where the location itself carries weight (a major market the candidate genuinely worked in). Employers are named individually; a category ("financial institutions and tech companies") is not a substitute for a name. No bullets on that line.

**Education contains only qualifications awarded to the candidate** — degrees, diplomas, certifications earned. An appointment to teach, lecture, guest-lecture or examine at an institution is employment, not a qualification, and belongs in Work Experience, nested under its umbrella entry if it was delivered through one.

**Education.** Retain graduation years by default. Strip them only when the Older Applicant scenario is active (defined in Layer 4), and then strip all of them, never selectively.

## Layer 2 — Human scannability

**Impact zone.** The first ~120 words must carry the target-facing headline, a 2–3 sentence value proposition, and up to three of the strongest evidenced achievements. The headline and value proposition are the Summary's opening prose; the achievements are up to three bullets immediately beneath, inside the Summary block. Print only as many as the master genuinely evidences — three is a ceiling, not a quota, exactly as role bullets are. They may restate a Work Experience bullet: the duplication is intentional, and each must carry the role name so it does not read as a floating claim. What is not permitted is restating it in the SAME WORDS. The top block is a compressed, re-angled statement of the achievement — the fact is identical, the sentence is not. A verbatim copy makes the reader feel they are reading the page twice and wastes the impact zone on words already spent. Checked by word count from the very top of the document — the name/contact block, the headline, the proposition and the bullets all count — not by rendered lines.

**Rendering.** The Summary prose is justified. The achievement bullets are standard left-aligned bullets in the same style as Work Experience bullets — never centered, never a distinct visual block.

**Openers name facts, not identities.** The Summary's first sentence states something the candidate did or built. Identity epithets — "veteran", "seasoned", "accomplished", "technology leader", "industry expert" and their equivalents — are banned in the CV and the cover letter: they assert a category instead of evidence, and under the Older Applicant override "veteran" actively re-emits the signal that override exists to manage.

**Banned phrasing.** A closed list of stock phrases is barred from both documents: filler that states nothing ("results-driven", "proven track record", "passionate about", "dynamic", "synergy", "best-in-class", "seamless", "robust", "value-add", "in today's fast-paced world"), the boilerplate wrapper ("I am writing to express my interest", "I believe I would be a great fit", "as you can see from my CV", "I am excited about the opportunity", "please do not hesitate to contact me"), and the manufactured-significance verbs ("delve into", "underscore", "leverage my expertise", "spearheaded a paradigm shift", "a testament to"). These are not weak writing to be improved on request — they are the phrases that mark a document as machine-written on sight, and five of them undo a page of real evidence. The list is enforced in code (Layer 6), because a rule the writer is merely asked to follow is a rule that is followed most of the time. It is closed and exact rather than a judgement about tone: it grows by adding a phrase actually seen in output, never by inferring a family from one member. The chosen tone's deliberate vocabulary and ordinary strong verbs are outside it.

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

**Cover letter.** Three matched pairs — the ad's top three requirements against the candidate's three strongest evidenced achievements. No claim in the letter that is absent from the CV.

**The letter makes one argument.** A cover letter is a single claim about why this candidate and this role belong together, proved in three or four paragraphs. Every paragraph advances that claim or is cut. This is what separates a letter from a list, and it is the rule most easily lost: the letter is fed a strategy, matched pairs, red flags to defuse, an active override and a body of guidance, and a model satisfying each in turn produces one sentence per instruction — a document with no through-line, where the seams between the instructions are visible to any reader. Guidance is raw material, never a running order. Several items may be answered by one paragraph, and an item with nothing to add to the argument is dropped. Nothing that reaches the writer is copy to be transcribed: sentences drafted upstream are rewritten in the candidate's own recorded voice, at the length the letter has room for, or not used. The argument decides what is said and in what order — not the shape of the guidance that informed it.

## Layer 4 — Situational overrides

Maximum two active at once. Every rule below reframes, reorders, relabels or cuts real content; none inserts a fact.

**The overrides reach the cover letter too.** The scenario that shapes the CV shapes the letter, but not with the same instructions: a letter has no sections to reorder, no dates to format and no bullets to cap, so a CV mitigation transplanted into it is noise. Each override therefore carries a second, letter-specific rule governing what the letter leads on, what it may address in the candidate's own recorded words, and what it must not claim. The same cap of two applies, and the invariants and Layer 3's matched pairs still outrank it. Where an override forbids a fact on the CV — a cumulative career total under Older Applicant, years of experience under Under-qualified — it is forbidden in the letter as well; the letter is not a place to say what the CV was not allowed to.

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
4. Single column, standard headers, one date format across all dated entries (the "Earlier Career" line is exempt, as is a year-only entry permitted by check 13).
5. Impact zone within 120 words and contains headline + proposition + the evidenced achievements, up to three, each naming its role, and none of them a word-for-word copy of the Work Experience bullet it restates.
6. No role exceeds its bullet ceiling; fallback bullets within the one-third limit where metrics exist.
7. Market rules satisfied; no photo/DOB/consent invented.
8. With a job ad: unevidenced requirements are listed to the user as gaps.
9. Projects section present ⇒ a qualifying override is active.
10. When the Older Applicant override is active: no Education entry carries a graduation year, and no cumulative career total appears anywhere ("X+ years' experience", "over two decades in the field"). A duration scoped to a single role, project or engagement is not a total and does not fail this check.
11. An Earlier Career line names at least one real employer from the master.
12. No banned identity epithet in the Summary or headline.
13. A dated entry whose master record holds no month prints the year alone and is reported to the user as a missing month — never completed with an invented one.
14. Every entry in Skills and Core Competencies traces to the master, on the same basis as a certification: the section is a plain list, so each entry either appears in the record or it does not.
15. A listed skill whose only evidence lies in roles the CV does not show is reported to the user, per the Layer 2 recency rule.
16. A role printed on the CV whose master record holds no number anywhere is reported to the user, so the candidate can supply the metrics. The CV never invents them.

17. No phrase from the banned-phrasing list (Layer 2) appears in the document. Checked on the CV and, by the same list, on the cover letter — the letter is prose, so it is where the boilerplate wrapper actually lands.

A failure at 1–4, 10 and 14 is a hard block. 5–9, 11–13 and 15–17 are warnings surfaced to the user.

A check whose evidence is missing (no parseable master, no section order) reports nothing rather than guessing.
