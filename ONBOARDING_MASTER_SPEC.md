# Onboarding → Canonical Master CV — Build Spec

## Goal
After registration, the user completes their **master CV** — the truthful, canonical career record. This is NOT a usable CV; it is the private source-of-truth every future job-matched CV is built from. Onboarding ends when the master is settled. Then normal USE: upload job → generate → pay → download → repeat.

## Flow
Register → Build Master (onboarding) → [done] → Upload job & generate → Pay → Download → repeat.

## Progress tracker (top of onboarding)
Four steps, wired to real state:
1. **Raw Scan** ✓ (teaser already ran)
2. **Standardization & Restructuring** ✓ (background master build already ran)
3. **Resolve Open Questions** — active
4. **Generate Winner CV** — locked until USE

## Step 3 — Resolve Open Questions
The deep analysis already reads the whole CV: strengths, history, ambiguities. We surface ONLY the **ambiguities that need the user to decide** — strengths and clear facts flow into the master untouched, never shown as "problems."

Each open item is one of two kinds:
- **Single fix** — changes one field on one entry (a date, a title, a location normalization). AI writes a suggested value. UI: **Accept / Reject / Edit**, pre-filled.
- **Structural question** — changes the shape of the record (group these stints under the consulting business? is this span a gap or a role?). AI states the tension and asks. UI: **free-text answer**.

Routing is deterministic: `structural` → always ask; `single` with high confidence → pre-filled Accept/Reject/Edit; `single` low confidence → ask.

No Skip button. Nothing hard-blocks Step 4 — open items show as a count ("2 still open — your CVs are sharper once settled"). Resolved items collapse to a green checklist.

## On answer — EDIT the master (not additive; it changes the record)
When the user resolves an item, the master CV is **updated, edited, changed**:
- **Single fix** → correct that one fact in `cv_data.master_cv`.
- **Structural (merge/group)** → restructure: one canonical entry, with the original detail **nested underneath** it (the two jobs become long-term contracts under the consulting business — nothing deleted, never two competing histories of the same span).
- Then re-run the existing `verifyMaster()` safety pass and `saveMasterCv()`.
- `voice_samples` stay **verbatim**, untouched by edits.

The master holds the full honest truth (gaps, a year off, the hard parts) in the best fair light. The generator later decides what to surface per job; the master never falsifies.

## Build tasks
1. **Deep analysis (`prompts/analysis.js`)** — emit a list of open questions for Step 3. Each item: what it is, `type` (single|structural), `confidence`, `target` (which master entry/field), and a suggested value when single+confident. Everything else the deep pass produces stays as-is.
2. **Step 3 UI** — flag cards (Accept/Reject/Edit or free-text), green checklist, open-count, no Skip, no hard block.
3. **Master edit path (`utils/database.js` / `utils/openai.js`)** — apply a resolved item to the master: correct a fact OR restructure-with-nesting; re-run verify; save. Voice samples preserved.
4. **Progress tracker** — 4 steps wired to real state.
5. **Onboarding completion** — master settled ends onboarding; route to USE.

## Hard rules carried from CLAUDE.md
- Never fabricate: the master records only what the CV evidences; gaps stay gaps.
- Sacred files imported, never inlined.
- Every AI call logged in DB + console.
- Auth: `user_id` from `req.user`, never the body.
