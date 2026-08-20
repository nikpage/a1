# PRODUCT.md — a1 / mysuper.cv

Owner's page. Drafted 2026-08-20 from the code and the existing docs during the
onboarding sweep, so Nik has something to correct rather than a blank page.
**Blocks 3, 5 and 6 need his numbers — the placeholders marked NEEDS NIK are not
mine to invent.**

## 1. Who it's for

A job seeker applying to real vacancies in Europe, in English, Czech or Polish,
who already has a CV and is tailoring it per application. They are not a
recruiter, not a coach, not a company. They can write, but they cannot see their
own record the way a screener does.

## 2. The problem

Tailoring a CV and cover letter per job is slow, and doing it badly is worse than
not doing it: a generic letter reads as generic, a stuffed CV fails the interview
it won, and an AI-written one reads like an AI wrote it. The tools that exist
either template the output — so every applicant sends the same document — or
invent achievements the candidate then has to defend in a room.

## 3. Success

NEEDS NIK — the one number that matters, plus two or three guardrails, with dates.
What exists today instead of a number: the standing quality bar from the contract,
that the output must rival what a professional CV writer would ship and be good
enough that they would use it.

## 4. Non-goals

- **Not a CV hosting or job board product.** We do not store applications, track
  where they went, or list vacancies.
- **Not a multi-CV profile.** One user, one master record, refreshed by upload.
  There is no merge flow and no second profile.
- **Not a fact-checker of the human.** The candidate may overstate their own
  history; that is their claim and their interview. We police only what the AI
  writes, and the AI never fabricates.
- **Not voice on the CV.** Bullets are bullets; the constraint there is accuracy.
  Voice is the cover letter's.
- **No tone menu.** Only Formal is offered. The candidate's own voice profile
  owns the writing, so a tone that only changes mood no longer changes anything.

## 5. Constraints

- Monthly budget ceiling: **NEEDS NIK**. Measured AI spend is $9.50 per 30 days
  (`ONBOARDING_SWEEP.md` §2); Netlify, Supabase, Upstash and Sentry plans unknown.
- Deadlines: **NEEDS NIK**.
- Expected scale: **NEEDS NIK**.
- Legal: EU product, so GDPR — users delete their own account and all data via
  `DELETE /api/delete-account`, and a `/privacy` page states retention.
- Structural: Netlify caps ordinary functions at 10 seconds on this plan, which
  is why analysis and generation are background jobs the browser polls.

## 6. Current focus

**NEEDS NIK — one thing, and what shipped means for it.**

What the record shows the work has actually been on, most recent first:

- **Cover-letter quality.** The rule stack was removed on 2026-08-15 after a
  four-line prompt beat a 51,721-character one on the same record and ads. Since
  then the work has been keeping the letter on that prompt and giving it the
  candidate's real voice. Every experiment is logged in `COVER_LETTER_LOG.md`.
- **Trimming the analysis to what a candidate can act on.** The landing-page
  teaser, the document critique, `quick_wins` and `action_items` were removed on
  2026-08-16; one analysis pass now reads the master record.

Carried over from the old onboarding spec, and **built**: registration leads into
building the master CV — a four-step progress tracker, a screen that asks only the
ambiguities the model genuinely cannot settle (chiefly whether a role that sits
inside the person's own practice was client work or a salaried job), and the
answer editing the master record. Onboarding ends when the master is settled;
then normal use is upload job → generate → pay → download.

Carried over and **not built**: nothing outstanding from that spec that I can find
in the code.

## 7. Trade-off order

Quality first, then cost, then speed — the contract's default, and the way the
project has actually behaved: model and prompt choices are made by running them
and reading the output, and the cheapest model that clears the bar wins.

---

### Job stories

- When I find a vacancy I actually want, I need a CV that survives the screen and
  says the true thing about me in the terms this employer uses.
- When my history has a gap, an overlap, or a stretch of my own consulting, I need
  the record to state it plainly rather than paper over it or guess what it was.
- When I send a cover letter, I need it to read as though I wrote it for this job
  — answering what the ad says it is afraid of — not as though a model filled in
  a template.
- When I have been told what my own record says, I need to steer it — this
  matters, play that down — and have the document actually do it.
- When I am paying per document, I need to see what I am spending.
