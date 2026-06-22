// prompts/cv-generator.js

import { toneInstructions } from './tone.js';
import { humanVoiceRules } from './voice.js';

export function buildCvPrompt(cv, analysis, tone, tweak = '', core = '') {
  const coreBlock = core && core.trim()
    ? `\n# Who this candidate is (steering)\nThe candidate describes the durable value they bring to any role as: "${core.trim()}"\nLet this guide what you foreground and how you frame their story — surface the real experience that backs it up. It is steering, not a fact source: never state or imply anything the CV doesn't actually prove.\n`
    : '';
  const tweakBlock = tweak && tweak.trim()
    ? `\n# The candidate's own instructions (HIGHEST PRIORITY)\nThe candidate asked for this specifically — follow it over any conflicting guidance above, but NEVER invent facts, roles, skills or numbers to satisfy it:\n"${tweak.trim()}"\n`
    : '';

  const systemMessage = {
    role: 'system',
    content: `You are an elite professional CV writer — the kind candidates pay hundreds for. You take a person's real experience and a strategist's blueprint and turn them into a CV that a senior recruiter cannot put down. You write with impact, precision and zero filler, and you output a finished CV only — never notes, never commentary.`
  };

  const userMessage = {
    role: 'user',
    content: `${tweakBlock}${coreBlock}
# How to work
The provided analysis is your strategic brief — treat its generation_framework blueprint as the plan and execute it. Read these before writing:
- Target length: generation_framework.cv_blueprint.target_length_pages
- Section order: generation_framework.cv_blueprint.section_order
- Job selection: generation_framework.cv_blueprint.job_selection (include_jobs / condense_jobs / rewrite_jobs)
- Summary draft: generation_framework.cv_blueprint.summary_draft
- Skills to highlight: generation_framework.cv_blueprint.skills_to_highlight
- Scenario: analysis.scenario_tags (this drives which experience to emphasise)

# What makes this CV impressive
- **Achievements, not duties.** Every bullet should show impact, not list responsibilities. Source bullets from the real roles in \`jobs_extracted\`, reframed as accomplishments. Lead with the result, then the action.
- **Quantify with what's there.** Where the CV gives numbers, scope or scale (team size, budget, %, volume, timeframe), put them up front. NEVER invent a number or a fact that isn't in the source CV.
- **Emphasis follows strategy.** Let \`analysis.scenario_tags\` and \`job_match.positioning_strategy\` decide what to foreground and what to play down. Use \`analysis.transferable_skills\` to choose which strengths to spotlight.
- **Red flags are handled, not advertised.** For each item in \`analysis.red_flags\`, neutralise it through smart framing and selection (de-emphasise, reframe, or simply don't draw the eye to it). Do NOT call attention to gaps or weaknesses on the CV itself — that work belongs in the cover letter.
- **Keywords, naturally.** Weave in the most relevant terms from \`analysis.ats_keywords_present\` and \`job_match.inferred_keywords\` where they fit the candidate's real experience. These are terms the candidate has genuinely earned — surface them confidently for the strongest honest ATS match. NEVER pull from \`analysis.ats_keywords_missing\`: those are skills the candidate has not demonstrated and must not appear. Never keyword-stuff or sacrifice readability — a human recruiter reads this too.
- **Varied bullets.** Do not make every bullet the same length. Within each role, mix at least one short, single-line bullet with longer ones — uniform bullet length is a dead giveaway that a machine wrote the CV.

${humanVoiceRules()}

# The summary
Write the Professional Summary by adapting \`generation_framework.cv_blueprint.summary_draft\` into the "${tone}" voice: keep its facts and impact, change the register to match the tone. 2-4 sentences, impact-first, no "Seeking to" / "Looking to" openers. Reflect \`analysis.career_arc\` and, where relevant, \`analysis.parallel_experience\`.

# Job history rules
- Use \`jobs_extracted\` as the definitive source for all employment; follow the blueprint's job_selection exactly.
- Show overlapping roles with concurrency clear; show ongoing roles as "[start_date] - Present".
- Never fabricate dates or create artificial gaps.

# Task & constraints
Generate a new CV in the "${tone}" tone, based ONLY on the provided CV and analysis. Do NOT invent facts, roles, skills or numbers. Output must match the CV's detected language (fall back to English if unclear); if the job ad is in another language, the CV language wins.

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
**[Optional tagline/headline if present in original CV]**
[Phone] | [Email] | [LinkedIn/Portfolio URLs]

</center>

---

## LEFT-ALIGNED SECTIONS (follow blueprint.section_order):

### **Professional Summary**
[The summary you wrote — adapted from summary_draft into the "${tone}" tone, 2-4 sentences, impact-first]

---

### **Key Skills**
<!-- BLOCK:START -->
[Prioritize blueprint.skills_to_highlight, format as a 2-column bullet list]

<div style="display: flex; flex-wrap: wrap;">
  <div style="width: 50%; padding-right: 10px;">
    <ul>
      <li>[Skill 1]</li>
      <li>[Skill 3]</li>
      <li>[Skill 5]</li>
    </ul>
  </div>
  <div style="width: 50%;">
    <ul>
      <li>[Skill 2]</li>
      <li>[Skill 4]</li>
      <li>[Skill 6]</li>
    </ul>
  </div>
</div>
<!-- BLOCK:END -->
---

### **Professional Experience**
[Apply job_selection rules from blueprint. For each role, emphasize job title FIRST]

<!-- BLOCK:START -->
#### **[Job Title]**
**[Company Name]** | [Start Date] - [End Date or Present] | [City, Country]
- [Achievement, result-first — weave in relevant keywords and the strengths from transferable_skills]
- [Achievement, result-first — quantify with real numbers from the source CV where available]
<!-- BLOCK:END -->

---

### **Education**
[Education content]
<!-- BLOCK:START -->
**[Degree/Diploma]** | [Institution] | [Year]
<!-- BLOCK:END -->

---

### **Certifications**
<!-- BLOCK:START -->
- [Certification 1]
- [Certification 2]
<!-- BLOCK:END -->

---

### **[Any Other Sections per blueprint.section_order]**
[Other content as needed]

# Inputs
## CV:
${cv}

## Analysis:
${JSON.stringify(analysis, null, 2)}

# Before you finish — check:
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
