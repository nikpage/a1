// prompts/cv-generator.js

import { toneInstructions } from './tone.js';
import { humanVoiceRules } from './voice.js';
import { scenarioGenerationRules } from './scenarios.js';
import { languageInstruction } from './language.js';
import { targetJobBlock } from './job-target.js';
import { currentDateBlock, currentDateReminder } from './current-date.js';
import { cvRulesBlock } from './cv-rules.js';
import { marketConventions } from './market.js';
import { sectionNameBlock } from './cv-sections.js';
import { generationBrief } from './analysis-brief.js';

export function buildCvPrompt(cv, analysis, tone, tweak = '', core = '', language = 'auto', now = new Date()) {
  const tags = analysis?.analysis?.scenario_tags;
  const scenarioBlock = scenarioGenerationRules(tags);
  // The ad itself — stated plainly rather than left buried in the analysis JSON.
  const jobBlock = targetJobBlock(analysis);
  // Layers 0-3 come from the shared rule module; Layer 5 from the target market.
  const hasJobText = Boolean(jobBlock);
  const rulesBlock = cvRulesBlock(hasJobText, language);
  const marketBlock = marketConventions(analysis);
  const coreBlock = core && core.trim()
    ? `\n# Who this candidate is (steering)\nThe candidate describes the durable value they bring to any role as: "${core.trim()}"\nLet this guide what you foreground and how you frame their story — surface the real experience that backs it up. It is steering, not a fact source: never state or imply anything the CV doesn't actually prove.\n`
    : '';
  // The same precedence the letter states, for the same reason: the blueprint
  // and the target-job block were written before the candidate typed this, so
  // obeying them faithfully promotes the very experience they asked to bury.
  const tweakBlock = tweak && tweak.trim()
    ? `\n# The candidate's own instructions (HIGHEST PRIORITY — they outrank the blueprint itself)\n"${tweak.trim()}"\n\nThis is the candidate speaking about their own CV, after the blueprint below was written. It wins over every block that follows, including \`skills_to_highlight\`, \`top_three_achievements\` and the instruction to lead with evidence for each requirement in the ad. Apply it like this:\n- **Demoted content is not the lead.** Where they ask you to play something down, it may not sit in the impact zone, the headline or a top-three achievement — however well it answers the ad. Use other real evidence from the master; where there is none, that requirement simply goes unanswered.\n- **Demoted content is not deleted.** Roles stay in the timeline with their real dates (T2 is absolute); they are condensed and placed by relevance, not removed.\n- **Emphasised content leads and is proved**, with the specific facts the master records for it.\n- **NEVER invent facts, roles, skills or numbers to satisfy any of this.** Steering reorders, reframes and cuts real content — it never adds.\n`
    : '';

  const systemMessage = {
    role: 'system',
    content: `You are an elite professional CV writer — the kind candidates pay hundreds for. You take a person's real experience and a strategist's blueprint and turn them into a CV that a senior recruiter cannot put down. You write with impact, precision and zero filler, and you output a finished CV only — never notes, never commentary.`
  };

  const userMessage = {
    role: 'user',
    content: `${tweakBlock}${coreBlock}
${currentDateBlock(now)}
${jobBlock}
${rulesBlock}

# How to work
The provided analysis is your strategic brief — treat its generation_framework blueprint as the plan and execute it. Read these before writing:
- Target length: generation_framework.cv_blueprint.target_length_pages
- Section order: generation_framework.cv_blueprint.section_order
- Job selection: generation_framework.cv_blueprint.job_selection (include_jobs / condense_jobs / rewrite_jobs)
- Headline draft: generation_framework.cv_blueprint.headline_draft
- Summary draft: generation_framework.cv_blueprint.summary_draft
- Impact-zone achievements: generation_framework.cv_blueprint.top_three_achievements
- Skills to highlight: generation_framework.cv_blueprint.skills_to_highlight
- Scenario: analysis.scenario_tags (this drives which experience to emphasise)

# What makes this CV impressive
- **Achievements, not duties.** Every bullet should show impact, not list responsibilities. Source bullets from the real roles in the master CV's \`experience[]\` (each achievement carries its own \`metric\` and \`skills_utilized\`), reframed as accomplishments. Lead with the result, then the action.
- **Quantify with what's there.** Where the master CV gives numbers, scope or scale (team size, budget, %, volume, timeframe — in \`experience[].achievements[].metric\` or the achievement text), put them up front. NEVER invent a number or a fact that isn't in the master CV.
- **Never state a span of experience the record doesn't state.** No "14 years of AI solution design", no "a decade in fintech", no "X+ years" of anything — not in the summary, not in a bullet, not as a headline. A duration is a fact, and the only durations that exist are the ones written in \`experience[].dates\`. Do NOT add up roles to produce a career total, and do NOT stretch a domain label across roles that weren't in that domain. If the master states a span for a specific thing, you may use it exactly as stated; otherwise the CV says nothing about how long.
- **Every bullet traces to one achievement.** Before you write a bullet, fix in mind the specific \`experience[].achievements[]\` entry it comes from; the bullet may reframe, sharpen or shorten that entry, but everything it asserts — the verb, the scope, the number, the tools — must be in that entry (or elsewhere in the master CV). A bullet you cannot trace to a specific entry does not go on the CV. Two entries do not merge into one bigger-sounding claim.
- **Emphasis follows strategy.** Let \`analysis.scenario_tags\` and \`job_match.positioning_strategy\` decide what to foreground and what to play down. Use \`analysis.transferable_skills\` to choose which strengths to spotlight. The strategy, \`quick_wins\` and \`action_items\` steer EMPHASIS and FRAMING only — they tell you what real experience to lead with, not new facts to add. If any of them say to "add", "mention", "introduce" or "highlight" a skill, tool or achievement, do it ONLY when the master CV already proves it; otherwise ignore that instruction entirely. The target job's requirements are NEVER evidence about this candidate.
- **Red flags are handled, not advertised.** For each item in \`analysis.red_flags\`, neutralise it through smart framing and selection (de-emphasise, reframe, or simply don't draw the eye to it). Do NOT call attention to gaps or weaknesses on the CV itself — that work belongs in the cover letter.
- **Keywords, naturally.** Weave in the most relevant terms from \`analysis.ats_keywords_present\` where they fit the candidate's real experience. These are terms the candidate has genuinely earned — surface them confidently for the strongest honest ATS match. NEVER pull from \`analysis.ats_keywords_missing\`: those are skills the candidate has not demonstrated and must not appear. Never keyword-stuff or sacrifice readability — a human recruiter reads this too.
- **Varied bullets.** Do not make every bullet the same length. Within each role, mix at least one short, single-line bullet with longer ones — uniform bullet length is a dead giveaway that a machine wrote the CV.

${scenarioBlock}
${marketBlock}

${humanVoiceRules(language)}

# The headline
Every CV carries a headline: one short line directly under the name, before the contact line. Build it from \`generation_framework.cv_blueprint.headline_draft\`, adapted to the "${tone}" voice — keep the role label it names, change only the register. Max ~8 words, no full sentence, no closing punctuation. It states what this candidate IS (role/discipline, optionally one domain the master CV proves) — never a duration ("X+ years", "a decade of"), never a title or seniority the master CV does not evidence, never a slogan ("results-driven professional"). If headline_draft is absent or empty, use the candidate's most recent real job title from \`experience[]\`.

# The summary — and the impact zone inside it
The Summary section IS the impact zone (Layer 2). It has two parts:
1. **Value proposition** — 2-3 sentences, written by adapting \`generation_framework.cv_blueprint.summary_draft\` into the "${tone}" voice: keep its facts and impact, change the register. Impact-first, no "Seeking to" / "Looking to" openers. Reflect \`analysis.career_arc\` and, where relevant, \`analysis.parallel_experience\`. Open on a FACT — something this person did or built — never on what they are: "veteran", "seasoned", "accomplished", "industry expert" and the like are banned here.
2. **Up to three achievement bullets**, immediately beneath that prose and inside the Summary block, taken from \`generation_framework.cv_blueprint.top_three_achievements\`. Each NAMES the role and employer it came from ("As Head of Experience Design at Česká spořitelna, built..."), so it stands as evidence rather than a floating claim. It is fine — intended, in fact — that the same achievement appears again as a bullet under its own role: the recruiter who reads only the top block still sees the three strongest results. Write it DIFFERENTLY in the two places: here it is the compressed, re-angled version (shorter, leading on the outcome), under the role it is the fuller one with the scope and method. Copying the role's sentence up here word for word is a defect — the reader feels they are reading the page twice. Print only as many as the master genuinely evidences; three is a ceiling, not a quota, and one real achievement gets one bullet.

The headline, those 2-3 sentences and the achievement bullets together must fit inside the first ~120 words of the document. Count the words before you move on; if you are over, tighten the prose first — never drop an evidenced achievement to make room.

# Job history rules
- Use the master CV's \`experience[]\` as the definitive source for all employment (roles, companies, dates, locations, achievements) — this includes any nested \`contracts[]\` inside a merged parent entry, which carry real detail that must not be lost; follow the blueprint's job_selection exactly.
- Print every date as MM/YYYY (Layer 1), one format across the whole document, ongoing roles as "MM/YYYY - Present". Reproduce the master's real months and years — normalising the FORMAT is required; changing a date is forbidden.
- A merged parent entry (one with \`contracts[]\`) renders as ONE role on the CV, using the parent's company/role/dates. Its \`contracts[]\` appear as engagements nested beneath that single role (client names / project lines, no separate date lines of their own) — never as separate top-level jobs. This keeps concurrency honest and kills the false job-hopping signal.
- **Order the bullets inside each role by relevance, strongest first** — never by the order they happen to sit in \`experience[].achievements[]\`, and never chronologically. Relevance means: to the target job's stated priorities where there is a job ad, otherwise to \`job_match.positioning_strategy\` and the candidate's core. The achievement a recruiter most needs to see is the role's first bullet; the least relevant one goes last (or is cut). This is pure reordering of real content — no bullet is reworded, upgraded or invented to earn a higher place.
- Show overlapping roles with concurrency clear; show ongoing roles as "[start_date] - Present".
- Never fabricate dates or create artificial gaps.

# Task & constraints
Generate a new CV in the "${tone}" tone, based ONLY on the provided master CV and analysis. Do NOT invent facts, roles, skills or numbers. ${languageInstruction(language)}

Tone — "${tone}": ${toneInstructions(tone)}

- Output ONLY the candidate's CV — no notes, explanations or commentary.
- Never write "Full career history available upon request" or similar filler.
- Replace every [placeholder] in the template below with real content — the final CV must contain no unfilled [brackets].
- Show LinkedIn URLs without the "www." prefix (e.g. "linkedin.com/in/username").
- Standardise locations to "City, Country" (e.g. "Prague, Czech Republic"), in the CV's primary language.
- Format every list as bullet points, one item per line, prefixed with a dash (-).

# Formatting Requirements
Output in Markdown with this exact structure:

## CENTERED INTRO SECTION (use HTML center tags):
<center>

# [Full Name]
**[REQUIRED headline — the one you wrote from blueprint.headline_draft, adapted to the "${tone}" tone. Bold, on its own line, max ~8 words, no duration, no closing punctuation]**
[Phone] | [Email] | [LinkedIn/Portfolio URLs]

</center>

---

## LEFT-ALIGNED SECTIONS (order them per blueprint.section_order, but use ONLY the standard section names — Layer 1 permits no others):

${sectionNameBlock(language)}

The English names in the template below identify WHICH section is which; write each heading in the document's own language using the names above.

### **Summary**
[The 2-3 sentence value proposition you wrote — adapted from summary_draft into the "${tone}" tone, impact-first, opening on a FACT rather than on what the candidate IS.]
<!-- BLOCK:START -->
- [Achievement from top_three_achievements, naming the role and employer it came from — up to three, only as many as the master evidences]
<!-- BLOCK:END -->

---

### **Core Competencies**
[ONLY when the Career Pivot override is active — otherwise omit this section and its divider entirely. Single-column bullet list of transferable skills the master evidences.]
<!-- BLOCK:START -->
- [Transferable competency]
<!-- BLOCK:END -->

---

### **Skills**
[Prioritise blueprint.skills_to_highlight. SINGLE-COLUMN bullet list — one skill per line, no columns, no tables, no HTML.]
<!-- BLOCK:START -->
- [Skill 1]
- [Skill 2]
- [Skill 3]
<!-- BLOCK:END -->
---

### **Work Experience**
[Apply job_selection rules from blueprint. Reverse-chronological. Job title FIRST. Dates MM/YYYY. Bullets only — no paragraphs.]

<!-- BLOCK:START -->
#### **[Job Title — exactly as the master records it]**
**[Company Name]** | [MM/YYYY] - [MM/YYYY or Present] | [City, Country]
- [Action verb + scope/context + quantified outcome, 15-25 words]
- [Next achievement — same form; fall back to action verb + method/tool + concrete deliverable only where the master holds no number]
<!-- BLOCK:END -->

---

### **Projects**
[ONLY when the Under-qualified or Career Pivot override is active, and only from evidenced master entries — otherwise omit this section and its divider entirely.]
<!-- BLOCK:START -->
#### **[Project Name]**
- [What was built or delivered, and the outcome]
<!-- BLOCK:END -->

---

### **Education**
[Education content. Keep graduation years — strip them from ALL entries only when the Older Applicant override is active.]
<!-- BLOCK:START -->
**[Degree/Diploma]** | [Institution] | [Year]
<!-- BLOCK:END -->

---

### **Certifications**
<!-- BLOCK:START -->
- [Certification 1]
- [Certification 2]
<!-- BLOCK:END -->

# Inputs
## Master CV (the candidate's complete, structured career record — your sole factual source):
${currentDateReminder(now)}
${cv}

## Analysis (the strategic brief — the plan to execute, not a review to answer):
${JSON.stringify(generationBrief(analysis), null, 2)}

# Before you finish — check:
- Every hard noun on the page (skill, tool, employer, title, certification, number) traces to the master CV, and every date matches the master exactly.
- Nothing sits in Work Experience that was not a real role; gaps are left as gaps.
- Single column throughout, standard section names only, one date format (MM/YYYY) across every dated experience entry — the "Earlier Career" line, if present, is the only undated one.
- The first ~120 words carry the headline and the 2-4 sentence value proposition, as prose. The Summary has no bullets.
- No heading markers (#, ##, ###) appear anywhere inside a role's bullets. A role has one heading — its job title. Client work, engagements and projects under one employer are plain bullets, never sub-headings.
- No role exceeds its bullet ceiling (3-5 for the two most recent, 2-3 for the rest), and bullets sit in the 15-25 word band.
- Market rules are satisfied; no photo, date of birth or consent line was invented.
- A Projects section appears only if the Under-qualified or Career Pivot override is active; a Core Competencies block only if Career Pivot is.
- The headline is present under the name, in the "${tone}" voice, and asserts no title, seniority, domain or duration the master CV does not prove.
- Every must-have from the target job that the master CV genuinely evidences is visibly answered — and no requirement the master CV does NOT evidence has been hinted at, softened in, or covered with the ad's own wording.
- No claim was upgraded to fit the job: every scope, verb and number still matches what the master CV states.
- Summary reads in the "${tone}" voice and reflects analysis.career_arc.
- Bullets show impact and results, not duties; numbers from the CV are up front.
- The scenario from analysis.scenario_tags is reflected in what's emphasised.
- Red flags are quietly neutralised, never spotlighted.
- Relevant ats_keywords_present are woven in naturally, with no keyword-stuffing; nothing from ats_keywords_missing has leaked onto the CV.
- Bullet lengths vary (not all the same 1.5–2 line cadence); corporate/AI clichés are absent or rare and never clustered.
- No unfilled [placeholders] remain.

Return only the formatted CV in the exact Markdown structure above. No commentary.
`
  };

  return [systemMessage, userMessage];
}

// Headline-only regeneration: the same headline rules as the full CV prompt,
// asked in isolation so the user can re-roll the tagline without paying for a
// whole document. Returns ONE line of plain text, never markdown.
export function buildHeadlinePrompt(cv, analysis, tone, current = '', language = 'auto') {
  const draft = analysis?.generation_framework?.cv_blueprint?.headline_draft || '';
  const jobBlock = targetJobBlock(analysis);

  return [
    {
      role: 'system',
      content: `You are an elite professional CV writer. You write the single headline that sits under a candidate's name on their CV. You output that line and nothing else — no quotes, no markdown, no commentary.`
    },
    {
      role: 'user',
      content: `${jobBlock}
# Task
Write ONE headline for this candidate's CV, in the "${tone}" tone.

Tone — "${tone}": ${toneInstructions(tone)}

# Rules (absolute)
- Max ~8 words. Not a sentence. No closing punctuation.
- It states what this candidate IS — role/discipline, optionally one domain or specialism the master CV proves (e.g. "Senior Backend Engineer | Payments Platforms").
- NEVER a duration: no "X+ years", no "a decade of", no career total. Durations are facts and belong nowhere but the dated roles.
- NEVER a title, seniority, domain, tool or specialism the master CV does not evidence. The target job's requirements are NEVER evidence about this candidate.
- No slogans or adjective soup ("results-driven professional", "passionate about", "dynamic").
- ${languageInstruction(language)}
${draft ? `\n# The strategist's draft (adapt to the "${tone}" voice — keep the role label, change the register)\n${draft}\n` : ''}${current && current.trim() ? `\n# The headline currently on the CV (the candidate asked for a DIFFERENT one — do not repeat it)\n${current.trim()}\n` : ''}
# Master CV (your sole factual source)
${cv}

Return only the headline line.`
    }
  ];
}
