# PRODUCT.md — a1 / mysuper.cv

Owner's page. Written by Nik on 2026-08-20, block by block. This is the why and
the what; CLAUDE.md is the how.

## 1. Who it's for

A person applying for real jobs in Europe, in English or Czech, who already has
a CV. For each application they want a professional-level CV and cover letter
pair, matched to that specific job.

## 2. The problem

Tailoring a CV and cover letter per job is tedious, and most applicants lack the
skills it actually takes: knowing which keywords matter, understanding how HR
processes, ATS filters and human screeners really read a document, writing
persuasively, and assessing their own strengths and weaknesses against a
specific role. Human experts do it well and charge $20-100 per document pair.
The tools that exist are templates, so every letter reads like the same mad-lib.
The result is that getting documents good enough to open doors in a
hyper-professional market is daunting.

## 3. Success

**The bar.** Every document pair reads as written by a human professional, not an
AI. If the user supplies writing samples, it is in their voice; if not, it is
human-sounding and persuasive. The CV is optimised for that specific job. The
cover letter addresses the job's needs and the user's strengths, and only if
necessary the single biggest red flag, as a structured persuasive narrative of
250-350 words. Everything in both documents is truthful.

**The number.** Interview invitations from applications sent using the tool. The
product is working when that rate is materially above what Nik got writing them
by hand.

**Guardrails.** The bar above never drops. No application goes out with anything
untrue in it.

Commercial goals are deliberately out of scope until Nik has a job. This app is
for Nik's own job search; productising it is a later decision, not a current one.

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
- **Not a business yet.** No pricing, no marketing, no multi-user features, no
  onboarding for strangers. Productising is a later decision.
- **Not for people working on someone else's CV.** No coaches, CV writers,
  recruiters acting for clients, or companies. One person, their own record.
  This is "not now", not "never" - CV writers are a real later market, and
  serving them changes the shape of the app.

## 5. Constraints

There is no monthly budget ceiling. Nik spends what the work takes. The
constraint is on how tokens are spent, not how many.

- No exploratory work without a stated purpose that moves the product forward.
  Experiments that turn into rabbit holes are the failure mode; a recent one
  cost $5 and produced nothing usable.
- Every non-trivial task carries an up-front size and cost estimate. If reality
  passes it by roughly 2x, stop and report before continuing.
- Cheap models do the grunt work - locating files, running commands. Judgement
  work only on the expensive one.
- Re-reading, recaps and padding are pure waste and are billed to Nik.

Scale: one user. Deadline: none fixed, but Nik is job-hunting now, so sooner is
worth more.

## 6. Current focus

**Now.** The cover writer produces letters that meet the bar in section 3.
Shipped means three letters on three real job ads, each judged good by Nik, with
those outputs captured as tests so the letter cannot regress a fourth time.

**Next.** Fix the analysis. Likely two stages, to be confirmed once we look: one
analysis of the master CV, which does not change because it is the user's record,
and a separate one for how to build the job-specific CV and cover letter.

**Done means.** The analysis makes sense, and CVs and cover letters both pass the
three-job test.

Nik expects each stage to take about 30 minutes, not a day. That is an
expectation, not a cap: if a stage runs well past it, stop and report rather than
continuing silently.

## 7. Trade-off order

**Quality first, then speed, then cost.**

This ranks how the app gets built, not what the documents are. Document quality
is fixed by the bar in section 3 and is never traded against anything.

- Quality beats speed. A faster route that produces worse code or worse output
  loses, every time.
- Speed beats cost. Nik is job-hunting now, so a result today is worth more than
  a cheaper result next week. Spend the tokens.
- Cost is last but not ignored: of two options that clear the bar equally, the
  cheaper one wins, and grunt work runs on cheap models.

---

### Job stories

- When I find a vacancy I actually want, I need a CV that survives the screen and
  says the true thing about me in the terms this employer uses.
- When my history has a gap, an overlap, or a stretch of my own consulting, I need
  the record to state it plainly rather than paper over it or guess what it was.
- When I send a cover letter, I need it to read as though I wrote it for this job
  - addressing the specific concerns the ad raises - not as though a model
  filled in a template.
- When I have been told what my own record says, I need to steer it — this
  matters, play that down — and have the document actually do it.
- When a prompt or a model starts costing more, I need to see it in the AI cost
  ledger. That view is Nik's alone; no real user ever sees AI costs.
