// prompts/cv-generator.js

function toneInstructions(tone) {
  switch ((tone || '').toLowerCase()) {
    case 'formal':
      return "Use a professional, reserved style. Avoid slang. Clear and businesslike.";
    case 'friendly':
      return "Warm, approachable, positive. Slightly informal but still professional.";
    case 'confident':
      return "Assertive, self-promoting, positive, but not arrogant. Highlight strengths clearly.";
    case 'cocky':
      return "Borderline arrogant, punchy, use colloquialisms if relevant: 'shit-hot', 'kick-ass', 'rock star', 'BOOM!'. Walk the line between boldness and professionalism.";
    default:
      return "Professional default style.";
  }
}

export function buildCvPrompt(cv, analysis, tone) {
  const systemMessage = {
    role: 'system',
    content: 'You are an expert in writing professional CVs. Follow the generation framework blueprint exactly and never add commentary or notes.'
  };

  const userMessage = {
    role: 'user',
    content: `
# MANDATORY STEPS - DO THESE FIRST - THE ANALYSIS IS YOUR COMMAND

STEP 0 (Read Blueprint AND Analysis): The provided analysis is the strategic foundation for this rewrite. Extract and follow these blueprint specifications:
  - Target length: generation_framework.cv_blueprint.target_length_pages
  - Section order: generation_framework.cv_blueprint.section_order
  - Job selection: generation_framework.cv_blueprint.job_selection (include_jobs, condense_jobs, rewrite_jobs)
  - Summary rewrite: generation_framework.cv_blueprint.summary_rewrite
  - Skills to highlight: generation_framework.cv_blueprint.skills_to_highlight

STEP 1 (Apply Employment Intelligence - NON-NEGOTIABLE):
  - **TONE & STRUCTURE:** Let the \`analysis.scenario_tags\` dictate the CV's entire narrative structure, tone, and which experiences to emphasize most.
  - **SUMMARY:** The summary MUST be built by combining \`analysis.career_arc\` and the blueprint's \`summary_rewrite\`. Weave in \`analysis.parallel_experience\` and \`analysis.transferable_skills\` here.
  - **RED FLAGS:** You MUST explicitly address and mitigate EVERY single item listed in \`analysis.red_flags\` within the relevant job descriptions or summary. This is critical.
  - **CONTENT SOURCE:** The primary content for achievement bullets MUST come from \`analysis.transferable_skills\` and the original \`jobs_extracted\`. Use the exact phrasing from \`analysis.transferable_skills\` where possible.
  - **KEYWORDS:** Naturally integrate every relevant keyword from \`analysis.ats_keywords\` and \`job_match.inferred_keywords\` into the bullet points. Do not just list them.

STEP 2 (Strategic Positioning):
  - Weave in analysis.ats_keywords naturally throughout
  - Emphasize analysis.transferable_skills using exact quoted phrases
  - Apply job_match.positioning_strategy to job descriptions
  - Use analysis.suitable_positions context for role framing

STEP 3 (Job History Management):
  - Use jobs_extracted as definitive source for all employment
  - Follow blueprint job_selection rules exactly
  - For overlapping jobs: include all and indicate concurrency clearly
  - For ongoing jobs: show as "[start_date] - Present"
  - Never create artificial gaps between roles

# Task
Generate a new CV in the "${tone}" tone, based ONLY on the provided CV and analysis. Do NOT invent facts, roles, or skills. All claims must be fact-based. Output must match the CV's detected language (fallback to English if unclear). If the job ad is in another language, CV language takes precedence.

# Rules
- Follow generation_framework.cv_blueprint specifications exactly
- Write in "${tone}" tone: ${toneInstructions(tone)}
- Output ONLY the candidate's CV—no notes, explanations, or commentary
- Never include phrases like "Full career history available upon request"
- **Do not output square brackets [] anywhere in the entire CV.**
- For LinkedIn URLs, display them without the "www." prefix (e.g., show "linkedin.com/in/username").
- Standardize all locations to a "City, Country" format (e.g., "Prague, Czech Republic"). Use the CV's primary language for all location names.
- Format ALL lists (job achievements, responsibilities) as bullet points, each item on a new line prefixed with a dash (-).

# Formatting Requirements
Output in Markdown format with this exact structure:

## CENTERED INTRO SECTION (use HTML center tags):
<center>

# [Full Name]
**[Optional tagline/headline if present in original CV]**
[Phone] | [Email] | [LinkedIn/Portfolio URLs]

</center>

---

## LEFT-ALIGNED SECTIONS (follow blueprint.section_order):

### **Professional Summary**
[Use blueprint.summary_rewrite as base, enhanced with career_arc insights]

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
- [Achievement/responsibility - weave in ats_keywords and transferable_skills]
- [Achievement/responsibility - address red_flags if relevant to this role]
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

# Output & Validation
Before finalizing, validate your output against this checklist:
✅ The CV directly addresses the career scenario from \`analysis.scenario_tags\`.
✅ ALL \`analysis.red_flags\` have been mitigated in the relevant sections.
✅ The \`analysis.transferable_skills\` are prominently featured and woven into bullet points.
✅ The \`analysis.ats_keywords\` are naturally integrated throughout.
✅ The summary reflects the \`analysis.career_arc\` and \`analysis.parallel_experience\`.

Return only the formatted CV in the exact Markdown structure shown above. Follow the generation_framework blueprint precisely. No additional commentary, notes, or explanations.
`
  };

  return [systemMessage, userMessage];
}
