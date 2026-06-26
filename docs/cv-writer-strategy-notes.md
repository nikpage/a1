# Canvas — CV app as a human writer

## North star
Act like a skilled human CV writer: read candidate + job, make judgment calls
on emphasis/omission/framing for THIS task. No fixed formula. Never invent/lie.

## Settled
- Master CV = source of truth (facts only, gaps stay gaps)
- Analysis = strategy brain; Generation = execution
- Parse-safety (single-column, clean text) = UNIVERSAL default (see gauntlet)
- Keyword gap = surface honestly ("you're missing X"), never fabricate

## HONESTY RULE (restated precisely)
The rule is NOT "the CV must be honest." It is: **the AI must not fabricate.**
- AI never manufactures: no invented metrics, skills, titles, dates.
- The USER may overstate their own history — their claim, their risk, their
  interview to defend. We are NOT Morality Mom; we don't fact-check the human.
- We police only OUR output. Goal = limit AI fakery as much as possible.

## Rejected (too formulaic / junior-writer)
- 3-part bullet input forms
- Hard metric warnings on every bullet
- 1-click synonym swaps
- Company-size toggle (overlaps existing tone)
- Plain-text sandbox diagnostic (unneeded if we control generation)

## Scope of the CV ("the gauntlet" = INTERNAL term, never user-facing)
The CV has only 2 jobs:
  1. Survive the gauntlet (parse -> keyword -> 6s skim -> relevance) to win the
     FIRST INTERVIEW.
  2. Frame the conversation that interview will have.
It CANNOT get the job. The interview wins the job.
Implications:
  - Every emphasis = a promise the candidate must defend in the room.
    Over-framing sets them up to fail live. Honesty = strategy, not just ethics.
  - Caps optimization: a stuffed/over-framed CV that wins screen but collapses
    in interview is a WORSE product than an honest one.
  - Liability handling (#15): CV need not RESOLVE a gap, only avoid the filter
    and set up the candidate to address it live. Lower, more honest bar.
PRINCIPLE: get them in the room with the strongest agenda they can DEFEND. Don't oversell.

## GAUNTLET SPEC (per-stage pass-requirements) — our biggest value-add
A good CV can be trashed BEFORE its goodness is seen. Clearing each stage with
TRUE material (surface gaps, never invent) = the core win. NOT size-gated anymore:
cheap SaaS ATS + LLM/AI screeners are accessible to any employer with 5 CVs.

STAGE 1 — Machine parse (assume it ALWAYS happens)
  Universal default, not large-company-only. Asymmetric risk: parse-safe when no
  ATS = ~zero cost (also skims better for humans); not parse-safe when there IS
  one = fatal (trashed unseen). So always buy the insurance.
  Pass = clean text extraction: single-column, linear order, standard section
  headings, real text (NO critical info in images/tables/text-boxes/headers/
  footers), standard fonts, machine-readable dates.

STAGE 2 — Keyword / screen filter  (nature is shifting)
  Old ATS = dumb boolean string match -> exact keywords brittle + essential.
  New LLM screener = SEMANTIC (understands Sales ~= Client Acquisition) AND
  judges relevance/liabilities like a human -> Stage 2 BLURS into 3-4.
  Our approach = BOTH, don't drop literal:
    - keep literal exact strings for must-have skills/tools/certs (dumb ATS still
      out there) — from the user's REAL history;
    - ADD semantic phrasing so LLM screeners match meaning, not just tokens.
  Stuffing degrades: smart filters see through it and increasingly penalize it.

STAGE 3 — 6-second human skim (L / F-pattern)
  Eye runs ACROSS the top (name -> headline/title) then DOWN the left margin
  (titles, companies, dates), fixating only where something catches.
  Pass requirements that follow:
    - Top third STATES THE CASE — headline/summary makes relevance instant.
    - Left margin CARRIES THE STORY — title/company/dates do the work (don't
      bury the title after the company); that's the vertical the eye tracks.
    - Bold anchors on first few words of bullets + key metrics = fixation hooks.
    - Lead bullets with outcomes; tech stack visible at a glance; no dense prose.

STAGE 4 — Relevance judgment (recruiter: interview y/n)
  Pass = obvious fit to the 3-4 deciding things (#6); liabilities not screaming.
  Where strategy/framing (#14-15) cashes out.

CEE weighting: Stages 1-2 bite most for large/intl employers; in CZ/PL SMEs the
human stages 3-4 are where most CVs live or die -> L-scan = highest leverage here.
TAILWIND: the smarter/cheaper filtering gets, the more it rewards a genuinely good,
honestly framed CV and punishes gaming. Our honesty strategy is the future-proof one.

## STAGED FUNNEL (accumulates into master — never recompute)
Business goal: maximize conversion to the NEXT step, through to paid.
Technical goal: build the master CV as SOT. Same motion — each stage deposits
into the master; the next stage reads it, never redoes it.

Stage 1 — FREE teaser (no signup)
  - Gives REAL value: a sharp, honest DIAGNOSIS of positioning. No clickbait
    ("6 secrets", "3 fatal errors"). Show quality; withhold the cure.
  - Diagnosis free, fix paid -> hunger comes from the read being real.
  - Builds: partial master from the CV.
Stage 2 — (MAYBE) FREE, behind email / no-fee CC-wall
  - More DEPTH (fuller read, optionally job-matched). Still free.
  - We capture the email; cost risk = free AND deeper, so keep it lean.
  - Builds: enriches master.
Stage 3 — PAID: full interactive AI interview
  - The richest master-builder; probes liabilities/gaps directly.
  - Builds: completes the master.

Model spend rule: cheapest model that clears the QUALITY bar per stage; pay up
(flash / sonnet) ONLY where the model's benefit justifies the cost. Latency alone
(e.g. 300ms) never justifies a pricier model.

## Method (settling)
- Checklist = AI's PRIVATE reasoning scaffold, not a user-facing form.
- AI decides per item: applies / augments / replaces. Senior judgment, not pipeline.
- Forms only where truth needs user input (keyword/liability gaps).
- Lives in ANALYSIS / intake step — BEFORE any writing.

## Intake = honest understanding of history (good AND bad)
Two passes before strategy:
1. Strengths — genuinely strong for THIS job.
2. Liabilities — what a sharp recruiter flags (gaps, job-hopping, downward move,
   missing must-have, seniority mismatch). Named plainly, internally. Not hidden.
Strategy = play strengths + handle liabilities WITHOUT inventing.

## Inputs (vary in trust / completeness)
- Current CV — curated, may hide gaps.
- LI profile — fuller history/dates, thin on impact.
- AI-user chat (TO BUILD) — richest; the "writer's interview" that probes
  liabilities directly and fills master honestly.

## RESOLUTION STATES (the core discipline of the analysis)
The checklist is a self-AUDIT, not a to-do list. Every item must be CLOSED OUT
to one of three states before writing. Silent skip is BANNED.
  [ANSWERED]  resolved from evidence (CV/LI/chat) + state the basis.
  [N/A]       genuinely doesn't apply + WHY (a reason, never "no data").
  [UNKNOWN]   not in the inputs -> route to user (chat/form). Honest gap only.
Rules:
  - "Missing" is NOT a resolution. Every item lands ANSWERED / N/A / UNKNOWN.
  - N/A needs a RATIONALE, and where checkable it rests on a DETERMINISTIC check
    (timeline reconciles, claimed skill present in master) — reuse verify pattern.
  - UNKNOWN is honest, not lazy: only for truths literally absent from inputs.
    Don't dump judgeable items on the user to dodge deciding.
  - This is the calibration we CAN control: a weak read becomes VISIBLE
    (UNKNOWN->ask) instead of a confident hallucination. We don't solve
    detection; we forbid it from failing silently.

## PRIVATE INTAKE CHECKLIST (AI asks itself; not user-facing)
Each item resolves to [ANSWERED <basis> | N/A <reason> | UNKNOWN -> ask].
A. Read the candidate (honest history)
  1. Real career arc — direction, momentum, level?
  2. Genuine strengths (evidenced, not claimed)?
  3. Liabilities a sharp recruiter flags (gaps, short tenures, downward/lateral
     moves, seniority mismatch, stale skills, pivot)?
  4. Missing vs hidden? (data gap != career gap)
  5. Strongest TRUE proof points (metrics/scope/outcomes); where thin?
B. Read the job (what it rewards)
  6. The 3-4 things that decide the hire?
  7. Hard requirements vs nice-to-haves?
  8. Employer's real pain/context (size, stage, why role exists)?
  9. Job's vocabulary (for honest mirroring, not stuffing)?
C. Match (judgment layer)
  10. Where strengths meet needs (case to lead with)?
  11. Genuine gaps (must-have candidate lacks)?
  12. Which liabilities matter FOR THIS JOB vs irrelevant here?  <- senior move
  13. Strong fit / stretch / mismatch — honestly?
A'. Demographic signal management (private; the "illegal-but-real" bias)
  Minimize INVOLUNTARY signals of protected traits — truthfully, by editing
  what the CV volunteers. Not lying; controlling signals.
  Levers (all honest): omit photo, DOB/age, marital status/kids, grad years;
  lead with most relevant ~10-15 yrs & summarize older roles (age signal).
  Targets: age, sex, maternity risk, ethnicity, nationality, marital status.
  NUANCE 1 (region): app serves en/cs/pl. CZ/PL norms often EXPECT photo+DOB
    -> not one rule; judge per market + target employer.
  NUANCE 2 (tone): reasoning stays PRIVATE. Never surface UI copy like
    "hiding your maternity risk." Output is just a cleaner CV.

## MARKET: CZ-first -> PL/CEE next. US/UK possible, NOT main.
This makes gauntlet + signal rules MARKET-RELATIVE. US-centric advice = wrong default.
  - Demographic default = LOCAL CONVENTION (photo/DOB/marital often expected),
    NOT Western anonymization. Strip-everything = judged exception, not rule.
  - Age/maternity levers become a TRADE-OFF the AI weighs (norm-fit vs bias-signal),
    per #12 — not an auto-applied default.
  - ATS penetration lower in CEE (esp. SMEs): parse/keyword matters for large/intl
    employers, but 6s skim + local-norm fit weigh RELATIVELY MORE than US keyword-ATS.
  - Language choice (cz vs en) per target = a strategy decision, not just UI locale.
NOTE: market is DEFINED (CZ). "AI weighs per market" = a DEFERRAL, not a method.
  Open work = ENCODE concrete CZ/PL rules (photo+DOB norm, language defaults, etc)
  as applied defaults, not "AI decides fresh each time". Deterministic rails for
  geography. NOT writing these rules yet — parked as next, see Next section.

D. Strategy (intake output, before writing)
  14. Lead / emphasize / downplay / cut?
  15. Handle each relevant liability w/o inventing (reframe/contextualize/accept)?
  16. Where we NEED the user (real gap) vs decide ourselves?  <- only honest form

Design notes:
- #12 = judge, don't flag uniformly. Same weakness fatal for one job, irrelevant for another.
- #16 = only honest path to user forms: surface gap, never auto-fill.
- #16 is essentially the UNKNOWN bucket made actionable: items the audit couldn't
  close from evidence become the (short, surgical) user questions — not a long interview.

## Parked (future, NOT this layer)
- App-level calibration / outcome feedback loop. Per-CV rejection is unusable
  signal (confounders: internal hire, frozen role; ranking margin; no
  counterfactual). No control group ever -> can't prove delivery. Out of scope here.

## Open questions
- Where does current output fall short of a human writer? (TBD)

## Next
- Pressure-test checklist; decide what's analysis-step vs chat-step
- Encode CEE per-market rules (CZ/PL norms, language defaults) — replace
  "AI weighs it" deferral with actual rules
