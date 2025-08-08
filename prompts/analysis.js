// prompts/analysis.js

export function buildAnalysisPrompt(cvText, jobText, hasJobText) {
  const systemMessage = {
    role: 'system',
    content: `You are an expert HR strategist and storyteller. Your role is to analyze a CV and job description, crafting a narrative that is an honest critique and actionable roadmap. Feedback must be insightful, critical where necessary, but always empowering. Identify weaknesses but focus on a clear success strategy. All output, including in "cocky" tone, must match the CV's detected language (fallback to English if unclear). If the job ad is in a different language, prioritize CV language. Use only provided CV and job ad content—never invent information.

    NARRATIVE FLOW: Write sections as a story: summary as engaging TL;DR, cv_data introduces the candidate, job_data shows the target, analysis evaluates presentation, job_match shows fit, final_thought motivates. Each feels like a chapter.

    WRITING QUALITY: Reference specific CV phrases and experiences. Be specific, actionable, and avoid generic examples.`
  };

  const userMessage = {
    role: 'user',
    content: `
    // STEP 0: DETECT LANGUAGE
    Detect the CV's language. All output, including field labels, summaries, and commentary, must be in this language. If detection fails (e.g., ambiguous or mixed), default to English. If the job ad is in another language, CV language takes precedence.

    // STEP 1: EXTRACT JOBS WITH DATES
    Parse all employment experiences from the CV. For each job, extract:
    - Exact job title
    - Company name
    - Start date (parse from CV text)
    - End date (parse from CV text, or mark as "ongoing" if no end date, currently employed, or uses terms like "Present", "current", "now", etc. in any language)
    - Location if available
    - Key responsibilities/achievements

    List jobs in chronological order by start date (most recent first). Include ALL jobs, even if dates overlap. Mark overlapping roles clearly.

    // STEP 2: DETECT CAREER SCENARIO
    Classify the candidate's situation using these internal tags (do not output this section):
    - older_applicant: Over 50 or clear age indicators in CV.
    - career_start: Entry-level, <2 years experience.
    - returner: Returning after a career break.
    - gap: Unexplained employment gaps >6 months between jobs (based on extracted dates).
    - normal: Standard career progression.
    - pivot: Shifting to a new role/industry.
    - overqualified: Significantly more skills/experience than job requires.
    - extreme_pivot: Major career change (e.g., finance to fishing).
    - overlapping_roles: Multiple roles with concurrent date ranges.
    A candidate can have multiple tags. Use these to guide tone and analysis.

    // STEP 3: PERFORM STRATEGIC ANALYSIS
    Critically analyze the CV in context of the job (if provided). Be strategic, honest, and practical, like a top-tier HR consultant. Always provide critical action items, even for bad, mismatched, or extreme pivot profiles. Reference only real CV content—never invent or assume. Identify real employment gaps (>6 months) and overlapping roles from the extracted job list for analysis. As part of this, ensure the 'action_items' object becomes a comprehensive summary of ALL actionable advice from the entire analysis (including quick wins, positioning strategy, keywords, etc.) to be used for final document writing.

    // STEP 4: CREATE GENERATION FRAMEWORK
    Based on the strategic analysis in STEP 3, especially the 'action_items', create a generation framework. This framework is a machine-readable blueprint for the subsequent CV and cover letter writing prompts. It must be invisible to the end-user. Its purpose is to translate the strategic advice into a concrete, actionable plan to ensure the final documents are built exactly as recommended. The framework should specify the exact structure and content to be used.

    // STEP 5: OUTPUT STRICT JSON
    Return only a strict JSON object with these top-level keys: summary, cv_data, job_data, jobs_extracted, analysis, job_match, final_thought, generation_framework. Follow this structure exactly:

    {
      "summary": "1–2 sentence TL;DR that grabs attention, reflects the candidate's real situation, and encourages deeper reading.",
      "cv_data": {
        "Name": "Full name from CV",
        "Seniority": "Junior/Mid/Senior/etc.",
        "Industry": "Industry from CV",
        "Country": "Most relevant country based on recent work (prioritize CZ, PL, UE, HU, RO if mentioned)"
      },
      "job_data": {
        "Position": "${hasJobText ? 'Job title from job ad' : 'null'}",
        "Seniority": "${hasJobText ? 'Extracted seniority level' : 'null'}",
        "Company": "${hasJobText ? 'Company name from job ad' : 'null'}",
        "Industry": "${hasJobText ? 'Job ad industry' : 'null'}",
        "Country": "${hasJobText ? 'Country from job ad (CZ, PL, UE, HU, RO, DE, UK, US)' : 'null'}",
        "HR Contact": "${hasJobText ? 'Contact name from job ad if present, else null' : 'null'}"
      },
      "jobs_extracted": [
        {
          "title": "Job title from CV",
          "company": "Company name",
          "start_date": "Parsed start date",
          "end_date": "Parsed end date or 'ongoing'",
          "location": "Location if available",
          "is_current": true/false,
          "overlaps_with": ["list of other job titles if concurrent"],
          "key_points": ["main achievements/responsibilities"]
        }
      ],
      "analysis": {
        "overall_score": "0-10",
        "ats_score": "0-10",
        "scenario_tags": ["array of tags from Step 2"],
        "quick_wins": ["short list of easy, high-impact fixes"],
        "cv_format_analysis": "Evaluate CV length, structure, format for candidate's country (CZ, PL, UE, HU, RO). Include country-specific suggestions labeled as '[Country]:'.",
        "cultural_fit": "Assess fit for market norms in candidate's country (CZ, PL, UE, HU, RO) and suggest DE, UK, US norms if relevant. Label as '[Country]:'. Cover format, tone, gaps, overlapping roles, and local expectations.",
        "red_flags": ["clear risks, gaps, inconsistencies, or overlapping role issues—based only on CV"],
        "overall_commentary": "Detailed expert commentary—strengths, weaknesses, positioning",
        "suitable_positions": ["real roles this candidate could apply for"],
        "career_arc": "1–4 sentence flattering but honest summary of career story",
        "parallel_experience": "Side projects, speaking, teaching, certifications—use CV only",
        "transferable_skills": "Skills from past jobs supporting pivot/target—quote exact CV phrases",
        "style_wording": "Tone, professionalism, clarity—refer to CV wording directly",
        "ats_keywords": "Detect strong/missing ATS terms, prioritizing job ad terms if available—quote exact CV and job ad phrases",
        "action_items": {
          "master_plan": {
            "strategic_positioning": "Consolidate the positioning_strategy from job_match into a clear, actionable directive for the writer.",
            "quick_wins_to_implement": ["List of all quick_wins from the main analysis, framed as a checklist."],
            "keyword_integration_plan": ["Provide a specific plan for weaving the most important ats_keywords and inferred_keywords into the CV and cover letter."]
          },
          "cv_changes": {
            "critical": ["Must-fix issues—structure, length, missing info, overlapping role clarity; quote CV phrases"],
            "advised": ["Strongly suggested improvements for clarity/impact; quote CV phrases"],
            "optional": ["Minor fixes—design, layout, polish"]
          },
          "cover_letter_guidance": {
            "critical_points_to_address": ["Must-address points—gaps, pivots, red flags, overlapping roles. This must directly reflect the master_plan.strategic_positioning."],
            "suggested_narrative_flow": ["A brief outline for the cover letter story, explaining how to handle the critical points."],
            "tone_and_style": ["Specific advice on tone, drawn from style_wording analysis."]
          }
        }
      },
      "job_match": {
        "keyword_match": "${hasJobText ? 'Exact and near matches (e.g., "Frontend" vs "FE") between CV and job ad' : 'null'}",
        "inferred_keywords": "${hasJobText ? 'Keywords/synonyms to add/emphasize for better matching' : 'null'}",
        "career_scenario": "${hasJobText ? 'One of: normal, pivot, overqualified, extreme_pivot' : 'null'}",
        "positioning_strategy": "${hasJobText ? 'Specific strategy—emphasize/reframe/de-emphasize CV content; quote exact phrases' : 'null'}"
      },
      "final_thought": "Motivational closing—practical, optimistic, tailored to scenario",
      "generation_framework": {
        "cv_blueprint": {
          "target_length_pages": "Number based on analysis (e.g., 1 or 2)",
          "section_order": ["An array of strings defining the exact CV section order, e.g., 'summary', 'experience', 'projects', 'education', 'skills'. This must be derived from analysis.action_items.cv_changes.critical"],
          "job_selection": {
            "include_jobs": ["List of job titles from 'jobs_extracted' to include in the new CV"],
            "condense_jobs": [
              {
                "new_title": "New condensed role title",
                "jobs_to_combine": ["Job title 1", "Job title 2"],
                "new_key_points": ["A rewritten list of key points for the combined role"]
              }
            ],
            "rewrite_jobs": [
              {
                "original_title": "Job title to rewrite",
                "new_key_points": ["A rewritten list of key points to better align with the target job or strategy"]
              }
            ]
          },
          "summary_rewrite": "A rewritten professional summary based on analysis and career_arc.",
          "skills_to_highlight": ["List of specific skills/keywords to feature prominently, derived from ats_keywords and transferable_skills."]
        },
        "cover_letter_blueprint": {
          "tone_and_style": "Recommended tone, e.g., 'Confident and direct', 'Formal and respectful'",
          "key_points_to_address": ["An array of critical points that MUST be included, derived from action_items.cover_letter_guidance.critical_points_to_address. E.g., 'Explain the 8-month career gap between 2021-2022', 'Justify the pivot from Marketing to Data Science'"]
        }
      }
    }

    CV Content:
    ${cvText}

    ${hasJobText ? `
    Job Advertisement:
    ${jobText}
    ` : ''}
    `
  };

  return [systemMessage, userMessage];
}
