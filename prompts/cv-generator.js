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
# MANDATORY STEPS - DO THESE FIRST

STEP 0 (Read Blueprint): Extract and follow these blueprint specifications:
  - Target length: generation_framework.cv_blueprint.target_length_pages
  - Section order: generation_framework.cv_blueprint.section_order
  - Job selection: generation_framework.cv_blueprint.job_selection (include_jobs, condense_jobs, rewrite_jobs)
  - Summary rewrite: generation_framework.cv_blueprint.summary_rewrite
  - Skills to highlight: generation_framework.cv_blueprint.skills_to_highlight

STEP 1 (Apply Employment Intelligence):
  - Use analysis.scenario_tags to adjust tone and approach
  - Build summary from analysis.career_arc and blueprint summary_rewrite
  - Address EVERY item in analysis.red_flags specifically
  - Apply analysis.quick_wins directly to relevant sections

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
- Format ALL lists (skills, job achievements, responsibilities) as bullet points, each item on a new line prefixed with a dash (-). Do NOT output any brackets, commas, or array syntax within text.

# Formatting Requirements
Output in Markdown format with this exact structure:

## CENTERED INTRO SECTION (use HTML center tags):
<center>

### **[Full Name]**
[Optional tagline/headline if present in original CV]
[Phone] | [Email] | [LinkedIn/Portfolio URLs]

</center>

---

## LEFT-ALIGNED SECTIONS (follow blueprint.section_order):

### **Professional Summary**
[Use blueprint.summary_rewrite as base, enhanced with career_arc insights]

---

### **Key Skills**
[Prioritize blueprint.skills_to_highlight, format as a 2-column bullet list without brackets; each skill as "- Skill"]

<div style="display: flex; flex-wrap: wrap;">
  <div style="width: 50%; padding-right: 10px;">
- [Skill 1]
- [Skill 3]
- [Skill 5]
  </div>
  <div style="width: 50%;">
- [Skill 2]
- [Skill 4]
- [Skill 6]
  </div>
</div>

---

### **Professional Experience**
[Apply job_selection rules from blueprint. For each role, emphasize job title FIRST]

#### **[Job Title]**
**[Company Name]** | [Start Date] - [End Date or Present] | [Location]
- [Achievement/responsibility - weave in ats_keywords and transferable_skills, no brackets]
- [Achievement/responsibility - address red_flags if relevant to this role, no brackets]

---

### **Education**
[Education content, no brackets]

---

### **[Any Other Sections per blueprint.section_order]**
[Other content as needed, formatted without brackets]

# Inputs
## CV:
${cv}

## Analysis:
${JSON.stringify(analysis, null, 2)}

# Output
Return only the formatted CV in the exact Markdown structure shown above. Follow the generation_framework blueprint precisely. No additional commentary, notes, or explanations.
`
  };

  return [systemMessage, userMessage];
}
