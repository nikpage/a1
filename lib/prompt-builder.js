// Enhanced CV Prompt Builder with stronger scenario enforcement

export function buildCVPrompt(tone, jobDetails, originalCv = '', metadata = null, feedbackData = null) {
  // Detect career scenarios first
  const careerScenarios = detectCareerScenarios(jobDetails, metadata, originalCv);
  console.log('Detected scenarios:', careerScenarios); // For debugging

  let promptBase = `You are a professional CV writer specializing in career transitions and strategic positioning. `;

  // CRITICAL: Add scenario enforcement at the very beginning
  if (careerScenarios.length > 0) {
    promptBase += `🚨 CRITICAL SCENARIO INSTRUCTIONS - MUST FOLLOW:\n`;
    promptBase += `Detected scenarios: ${careerScenarios.join(', ')}\n`;
    promptBase += `These scenarios MUST be addressed in your CV rewrite. This is not optional.\n\n`;
  }

  // Build scenario-specific instructions with enforcement
  promptBase += buildScenarioInstructions(careerScenarios, jobDetails, metadata);

  // Add tone handling
  switch(tone) {
    case 'formal':
      promptBase += `TONE: Use formal, professional language with traditional formatting. Avoid contractions. `;
      break;
    case 'neutral':
      promptBase += `TONE: Use balanced, professional tone. `;
      break;
    case 'casual':
      promptBase += `TONE: Use conversational, approachable tone while maintaining professionalism. `;
      break;
    case 'cocky':
      promptBase += `TONE: Use confident, bold language. Terms like "exceptional," "outstanding," "game-changing" are encouraged. `;
      break;
  }

  // Handle career scenarios with specific instructions
  if (careerScenarios.includes('pivot')) {
    promptBase += handleCareerPivot(jobDetails, metadata);
  }
  if (careerScenarios.includes('recent_grad')) {
    promptBase += handleRecentGraduate(jobDetails, metadata);
  }
  if (careerScenarios.includes('career_returner')) {
    promptBase += handleCareerReturner(jobDetails, metadata);
  }
  if (careerScenarios.includes('older_applicant')) {
    promptBase += handleOlderApplicant(jobDetails, metadata);
  }
  if (careerScenarios.includes('overqualified')) {
    promptBase += handleOverqualified(jobDetails, metadata);
  }
  if (careerScenarios.length === 0) {
    promptBase += handleCareerProgression(jobDetails, metadata);
  }

  // Add concrete formatting requirements
  promptBase += `\n\n📋 MANDATORY FORMATTING REQUIREMENTS:\n`;
  promptBase += `1. Professional Summary (2-3 lines that address the detected scenarios)\n`;
  promptBase += `2. Work Experience (reverse chronological, with strategic emphasis based on scenarios)\n`;
  promptBase += `3. Education (positioned strategically based on scenarios)\n`;
  promptBase += `4. Skills (highlighted based on scenario requirements)\n`;
  promptBase += `5. Additional sections as needed for scenario optimization\n\n`;

  // Critical enforcement
  promptBase += `🚨 ENFORCEMENT CHECKLIST - Your CV rewrite MUST demonstrate:\n`;
  careerScenarios.forEach(scenario => {
    switch(scenario) {
      case 'pivot':
        promptBase += `✓ PIVOT: Transferable skills clearly highlighted, industry jargon removed, experience reframed for new field\n`;
        break;
      case 'recent_grad':
        promptBase += `✓ RECENT GRAD: Education prominently featured, internships/projects maximized, skills-based approach used\n`;
        break;
      case 'career_returner':
        promptBase += `✓ CAREER RETURNER: Gap addressed positively, retained skills emphasized, readiness demonstrated\n`;
        break;
      case 'older_applicant':
        promptBase += `✓ EXPERIENCED: Recent experience prioritized, modern relevance shown, 10-15 year focus maintained\n`;
        break;
      case 'overqualified':
        promptBase += `✓ OVERQUALIFIED: Experience right-sized, genuine interest shown, intimidation factor reduced\n`;
        break;
    }
  });

  // Add feedback integration if available
  if (feedbackData && feedbackData.structure_changes) {
    promptBase += `\n\n📝 FEEDBACK INTEGRATION:\n`;
    promptBase += `Apply these specific improvements from previous feedback:\n`;
    feedbackData.structure_changes.forEach(change => {
      promptBase += `• ${change}\n`;
    });
    if (feedbackData.content_additions) {
      promptBase += `\nContent to add:\n`;
      feedbackData.content_additions.forEach(addition => {
        promptBase += `• ${addition}\n`;
      });
    }
    if (feedbackData.keyword_placements) {
      promptBase += `\nKeyword optimization:\n`;
      feedbackData.keyword_placements.forEach(keyword => {
        promptBase += `• ${keyword}\n`;
      });
    }
  }

  // Strict content rules
  promptBase += `\n\n🔒 STRICT CONTENT RULES:\n`;
  promptBase += `• NEVER invent experience, names, companies, or achievements\n`;
  promptBase += `• If contact info is missing, OMIT it completely\n`;
  promptBase += `• Use ONLY the experience provided in the original CV\n`;
  promptBase += `• Reframe and reposition existing content strategically\n`;
  promptBase += `• Each bullet point must be achievement-focused with impact metrics where possible\n\n`;

  // Final output requirements
  promptBase += `📤 OUTPUT REQUIREMENTS:\n`;
  promptBase += `Return ONLY the complete CV. No commentary, no explanations, no notes.\n`;
  promptBase += `The CV must be immediately usable and professionally formatted.\n`;
  promptBase += `Demonstrate clear understanding of the detected scenarios through strategic positioning.\n\n`;

  if (originalCv?.trim()) {
    promptBase += `---\nORIGINAL CV CONTENT:\n${originalCv}\n---\n`;
    promptBase += `Transform this content according to the scenario requirements above. Reframe, don't invent.\n`;
  }

  return promptBase;
}

// Enhanced scenario instruction builder with more specific guidance
function buildScenarioInstructions(scenarios, jobDetails, metadata) {
  if (scenarios.length === 0) {
    return `📈 STANDARD CAREER PROGRESSION: Position for natural advancement.\n\n`;
  }

  let instructions = `🎯 CAREER SCENARIO STRATEGY (MUST IMPLEMENT):\n\n`;

  scenarios.forEach(scenario => {
    switch(scenario) {
      case 'pivot':
        instructions += `🔄 CAREER PIVOT DETECTED:\n`;
        instructions += `MANDATORY CHANGES:\n`;
        instructions += `• Rewrite job descriptions to emphasize transferable skills\n`;
        instructions += `• Remove industry-specific jargon that doesn't translate\n`;
        instructions += `• Add "Transitioning to [new field]" context in summary\n`;
        instructions += `• Reorganize experience to lead with most relevant roles\n`;
        if (jobDetails.title) instructions += `• Position ALL experience as relevant to ${jobDetails.title}\n`;
        instructions += `\n`;
        break;

      case 'recent_grad':
        instructions += `🎓 RECENT GRADUATE DETECTED:\n`;
        instructions += `MANDATORY CHANGES:\n`;
        instructions += `• Move Education section to top or second position\n`;
        instructions += `• Expand internships with full job-like descriptions\n`;
        instructions += `• Include relevant coursework, projects, thesis topics\n`;
        instructions += `• Lead with skills and potential rather than years of experience\n`;
        instructions += `• Add GPA if 3.5+ or Dean's List achievements\n`;
        instructions += `\n`;
        break;

      case 'career_returner':
        instructions += `↩️ CAREER RETURNER DETECTED:\n`;
        instructions += `MANDATORY CHANGES:\n`;
        instructions += `• Address employment gap directly but positively\n`;
        instructions += `• Emphasize skills that remained current during break\n`;
        instructions += `• Include any relevant activities during gap period\n`;
        instructions += `• Show enthusiasm for returning to workforce\n`;
        instructions += `• Lead with strongest pre-gap experience\n`;
        instructions += `\n`;
        break;

      case 'older_applicant':
        instructions += `👔 EXPERIENCED PROFESSIONAL DETECTED:\n`;
        instructions += `MANDATORY CHANGES:\n`;
        instructions += `• Focus on most recent 10-15 years of experience\n`;
        instructions += `• Emphasize current technology skills and modern approaches\n`;
        instructions += `• Remove or de-emphasize very old graduation dates\n`;
        instructions += `• Highlight mentorship and leadership capabilities\n`;
        instructions += `• Show continuous learning and adaptability\n`;
        instructions += `\n`;
        break;

      case 'overqualified':
        instructions += `⚡ OVERQUALIFIED CANDIDATE DETECTED:\n`;
        instructions += `MANDATORY CHANGES:\n`;
        instructions += `• Downplay highest-level responsibilities that exceed role requirements\n`;
        instructions += `• Focus on aspects of experience that match the target role level\n`;
        instructions += `• Include statement about genuine interest in this role/company\n`;
        instructions += `• Avoid mentioning very high-level titles or massive team sizes\n`;
        instructions += `• Emphasize hands-on skills over strategic/executive duties\n`;
        instructions += `\n`;
        break;
    }
  });

  instructions += `🔥 CRITICAL SUCCESS FACTORS:\n`;
  instructions += `• Every change must be visible and obvious in the final CV\n`;
  instructions += `• The scenarios must be clearly addressed, not just mentioned\n`;
  instructions += `• Use the candidate's real experience but reframe it strategically\n`;
  instructions += `• The hiring manager should immediately understand the candidate's fit\n\n`;

  return instructions;
}

// Enhanced pivot handler with specific instructions
function handleCareerPivot(jobDetails, metadata) {
  let pivotText = `\n🔄 CAREER PIVOT - SPECIFIC IMPLEMENTATION:\n\n`;

  pivotText += `REQUIRED PIVOT TRANSFORMATIONS:\n`;
  pivotText += `1. REWRITE JOB DESCRIPTIONS: Transform each role description to emphasize skills that transfer to the new field\n`;
  pivotText += `2. SKILLS TRANSLATION: Create a "Core Competencies" section that bridges old and new industries\n`;
  pivotText += `3. SUMMARY STATEMENT: Must explicitly mention the transition and why it makes sense\n`;
  pivotText += `4. EXPERIENCE ORDERING: Lead with roles that have the most transferable elements\n`;
  pivotText += `5. LANGUAGE CLEANUP: Remove all industry-specific terms that won't resonate in the new field\n\n`;

  if (jobDetails.title && metadata?.current_industry && jobDetails.target_industry) {
    pivotText += `SPECIFIC CONTEXT:\n`;
    pivotText += `• Transitioning FROM: ${metadata.current_industry}\n`;
    pivotText += `• Transitioning TO: ${jobDetails.target_industry}\n`;
    pivotText += `• Target Role: ${jobDetails.title}\n`;
    pivotText += `• Make this transition obvious and compelling in the CV\n\n`;
  }

  pivotText += `PIVOT SUCCESS METRICS:\n`;
  pivotText += `• Hiring manager immediately sees the connection between past experience and new role\n`;
  pivotText += `• No confusion about why candidate is changing fields\n`;
  pivotText += `• Transferable skills are crystal clear\n`;
  pivotText += `• Candidate appears intentional, not desperate\n\n`;

  return pivotText;
}

// Enhanced recent graduate handler
function handleRecentGraduate(jobDetails, metadata) {
  let gradText = `\n🎓 RECENT GRADUATE - SPECIFIC IMPLEMENTATION:\n\n`;

  gradText += `REQUIRED GRAD TRANSFORMATIONS:\n`;
  gradText += `1. EDUCATION PROMINENCE: Move education to position 2 (after summary)\n`;
  gradText += `2. INTERNSHIP EXPANSION: Write full job descriptions for internships as if they were full roles\n`;
  gradText += `3. PROJECT SHOWCASE: Include relevant academic projects, thesis work, or capstone projects\n`;
  gradText += `4. SKILLS EMPHASIS: Lead with technical and soft skills rather than years of experience\n`;
  gradText += `5. ACADEMIC ACHIEVEMENTS: Include GPA (if 3.5+), honors, relevant coursework\n\n`;

  if (metadata?.graduation_year) {
    const currentYear = new Date().getFullYear();
    const yearsOut = currentYear - metadata.graduation_year;
    gradText += `GRADUATION CONTEXT: ${yearsOut} years since graduation (${metadata.graduation_year})\n`;
    gradText += `• Position as emerging professional with fresh perspective\n`;
    gradText += `• Emphasize learning agility and modern training\n\n`;
  }

  gradText += `RECENT GRAD SUCCESS METRICS:\n`;
  gradText += `• Education section provides substantial value and context\n`;
  gradText += `• Every experience (however brief) is maximized for impact\n`;
  gradText += `• Skills section demonstrates capability despite limited experience\n`;
  gradText += `• Candidate appears eager and prepared, not inexperienced\n\n`;

  return gradText;
}

// Enhanced career returner handler
function handleCareerReturner(jobDetails, metadata) {
  let returnerText = `\n↩️ CAREER RETURNER - SPECIFIC IMPLEMENTATION:\n\n`;

  returnerText += `REQUIRED RETURNER TRANSFORMATIONS:\n`;
  returnerText += `1. GAP ACKNOWLEDGMENT: Include brief, positive explanation of career break\n`;
  returnerText += `2. SKILLS RETENTION: Emphasize that core competencies remained strong\n`;
  returnerText += `3. BRIDGE ACTIVITIES: Include any freelance, volunteer, or project work during gap\n`;
  returnerText += `4. READINESS SIGNALS: Show current knowledge and enthusiasm for return\n`;
  returnerText += `5. PRE-GAP STRENGTH: Lead with strongest experience before the break\n\n`;

  if (metadata?.employment_gap_months) {
    const gapYears = Math.round(metadata.employment_gap_months / 12 * 10) / 10;
    returnerText += `GAP CONTEXT: ${gapYears} year gap detected\n`;
    if (metadata.career_break_reason) {
      returnerText += `• Reason: ${metadata.career_break_reason}\n`;
      returnerText += `• Frame this positively as valuable life experience\n`;
    }
    returnerText += `• Show how the gap has prepared them for strong return\n\n`;
  }

  returnerText += `CAREER RETURNER SUCCESS METRICS:\n`;
  returnerText += `• Gap is addressed confidently, not hidden or apologized for\n`;
  returnerText += `• Skills and experience before gap are prominently featured\n`;
  returnerText += `• Any gap activities are positioned as value-adds\n`;
  returnerText += `• Candidate appears refreshed and motivated, not rusty\n\n`;

  return returnerText;
}

// Enhanced older applicant handler
function handleOlderApplicant(jobDetails, metadata) {
  let olderText = `\n👔 EXPERIENCED PROFESSIONAL - SPECIFIC IMPLEMENTATION:\n\n`;

  olderText += `REQUIRED EXPERIENCE TRANSFORMATIONS:\n`;
  olderText += `1. TIMELINE FOCUS: Emphasize most recent 10-15 years prominently\n`;
  olderText += `2. MODERN RELEVANCE: Highlight current technology and contemporary approaches\n`;
  olderText += `3. DATE MANAGEMENT: Remove or minimize very old graduation dates\n`;
  olderText += `4. WISDOM VALUE: Emphasize mentorship, stability, and deep expertise\n`;
  olderText += `5. ENERGY DEMONSTRATION: Show ongoing learning and adaptability\n\n`;

  if (metadata?.years_experience) {
    olderText += `EXPERIENCE CONTEXT: ${metadata.years_experience} years of experience\n`;
    olderText += `• Position extensive experience as competitive advantage\n`;
    olderText += `• Focus on progression and continued growth\n`;
    olderText += `• Avoid age-related concerns through strategic presentation\n\n`;
  }

  olderText += `EXPERIENCED PROFESSIONAL SUCCESS METRICS:\n`;
  olderText += `• Candidate appears current and energetic, not outdated\n`;
  olderText += `• Deep expertise is valued without appearing overqualified\n`;
  olderText += `• Recent achievements and modern skills are prominent\n`;
  olderText += `• Hiring manager sees stability and wisdom as assets\n\n`;

  return olderText;
}

// Enhanced overqualified handler
function handleOverqualified(jobDetails, metadata) {
  let overqualText = `\n⚡ OVERQUALIFIED CANDIDATE - SPECIFIC IMPLEMENTATION:\n\n`;

  overqualText += `REQUIRED RIGHT-SIZING TRANSFORMATIONS:\n`;
  overqualText += `1. RESPONSIBILITY SCALING: Downplay highest-level duties that exceed role requirements\n`;
  overqualText += `2. GENUINE INTEREST: Include statement about why this role appeals to them\n`;
  overqualText += `3. HANDS-ON FOCUS: Emphasize practical skills over strategic/executive responsibilities\n`;
  overqualText += `4. CULTURAL FIT: Show alignment with company values and role-specific requirements\n`;
  overqualText += `5. FLIGHT RISK MITIGATION: Address concerns about staying in a lower-level role\n\n`;

  if (metadata?.seniority && jobDetails.seniority) {
    overqualText += `SENIORITY CONTEXT:\n`;
    overqualText += `• Candidate Level: ${metadata.seniority}\n`;
    overqualText += `• Target Role Level: ${jobDetails.seniority}\n`;
    overqualText += `• Emphasize aspects of experience that match target level\n`;
    overqualText += `• Downplay executive/strategic elements that might intimidate\n\n`;
  }

  overqualText += `OVERQUALIFIED SUCCESS METRICS:\n`;
  overqualText += `• Candidate appears genuinely interested in the role level\n`;
  overqualText += `• Experience is relevant without being overwhelming\n`;
  overqualified += `• Hiring manager feels confident candidate will stay and be happy\n`;
  overqualText += `• No concerns about candidate being a flight risk or demanding\n\n`;

  return overqualText;
}

// Enhanced career progression handler
function handleCareerProgression(jobDetails, metadata) {
  let progressText = `\n📈 CAREER PROGRESSION - OPTIMIZATION:\n\n`;

  progressText += `STANDARD PROGRESSION ENHANCEMENTS:\n`;
  progressText += `1. LOGICAL NARRATIVE: Show clear career growth and skill development\n`;
  progressText += `2. ACHIEVEMENT FOCUS: Quantify impact and results wherever possible\n`;
  progressText += `3. KEYWORD OPTIMIZATION: Strategically incorporate target role requirements\n`;
  progressText += `4. ROLE ALIGNMENT: Position current level for natural next step\n`;
  progressText += `5. VALUE PROPOSITION: Make unique value and fit immediately obvious\n\n`;

  if (jobDetails.title || jobDetails.company) {
    progressText += `TARGET ROLE CONTEXT:\n`;
    if (jobDetails.title) progressText += `• Position: ${jobDetails.title}\n`;
    if (jobDetails.company) progressText += `• Company: ${jobDetails.company}\n`;
    if (jobDetails.keywords?.length > 0) {
      progressText += `• Key Skills: ${jobDetails.keywords.join(', ')}\n`;
      progressText += `• Weave these keywords naturally throughout the CV\n`;
    }
    progressText += `\n`;
  }

  if (metadata?.career_arcs_summary) {
    progressText += `CAREER NARRATIVE:\n`;
    progressText += `• ${metadata.career_arcs_summary}\n`;
    progressText += `• Use this progression to show logical next step\n\n`;
  }

  progressText += `CAREER PROGRESSION SUCCESS METRICS:\n`;
  progressText += `• Clear trajectory showing readiness for target role\n`;
  progressText += `• Achievements demonstrate increasing responsibility and impact\n`;
  progressText += `• Skills and experience align perfectly with job requirements\n`;
  progressText += `• Candidate appears as natural fit for the next level\n\n`;

  return progressText;
}

// All other existing functions remain the same...
function detectCareerScenarios(jobDetails, metadata, originalCv) {
  const scenarios = [];

  if (detectRecentGraduate(metadata)) scenarios.push('recent_grad');
  if (detectCareerReturner(metadata)) scenarios.push('career_returner');
  if (detectCareerPivot(jobDetails, metadata, originalCv)) scenarios.push('pivot');
  if (detectOlderApplicant(metadata)) scenarios.push('older_applicant');
  if (detectOverqualified(jobDetails, metadata)) scenarios.push('overqualified');

  return scenarios;
}

function detectCareerPivot(jobDetails, metadata, originalCv) {
  if (!jobDetails) return false;

  if (metadata?.current_industry && jobDetails.target_industry) {
    if (metadata.current_industry !== jobDetails.target_industry) return true;
  }

  if (metadata?.current_role_type && jobDetails.role_type) {
    if (metadata.current_role_type !== jobDetails.role_type) return true;
  }

  const pivotKeywords = ['transition', 'career change', 'switching to', 'moving into', 'pivot'];
  const jobText = `${jobDetails.title || ''} ${jobDetails.description || ''}`.toLowerCase();
  if (pivotKeywords.some(keyword => jobText.includes(keyword))) return true;

  if (Array.isArray(jobDetails.keywords) && Array.isArray(metadata?.primary_skills)) {
    try {
      const jobSkills = jobDetails.keywords.map(k => String(k).toLowerCase());
      const candidateSkills = metadata.primary_skills.map(s => String(s).toLowerCase());
      const overlap = jobSkills.filter(skill => candidateSkills.includes(skill));

      if (jobSkills.length > 0 && overlap.length / jobSkills.length < 0.3) return true;
    } catch (e) {
      // Skip skill analysis if data is malformed
    }
  }

  return false;
}

function detectRecentGraduate(metadata) {
  if (!metadata) return false;

  const yearsExp = Number(metadata.years_experience) || 0;
  if (yearsExp <= 2 || metadata.seniority === 'Entry') return true;

  if (metadata.graduation_year) {
    try {
      const currentYear = new Date().getFullYear();
      const gradYear = Number(metadata.graduation_year);
      if (!isNaN(gradYear) && currentYear - gradYear <= 2) return true;
    } catch (e) {
      // Skip graduation year analysis if invalid
    }
  }

  const internshipCount = Number(metadata.internship_count) || 0;
  const fullTimeRoles = Number(metadata.full_time_roles) || 0;
  if (internshipCount >= 2 && fullTimeRoles <= 1) return true;

  if (metadata.career_start_year) {
    try {
      const currentYear = new Date().getFullYear();
      const startYear = Number(metadata.career_start_year);
      if (!isNaN(startYear) && currentYear - startYear <= 3) return true;
    } catch (e) {
      // Skip if invalid
    }
  }

  return false;
}

function detectCareerReturner(metadata) {
  if (!metadata) return false;

  const gapMonths = Number(metadata.employment_gap_months) || 0;
  if (gapMonths >= 12) return true;

  if (metadata.career_break_reason) {
    try {
      const breakReasons = ['parental leave', 'family care', 'education', 'personal reasons', 'maternity', 'paternity', 'sabbatical'];
      const reason = String(metadata.career_break_reason).toLowerCase();
      if (breakReasons.some(br => reason.includes(br))) return true;
    } catch (e) {
      // Skip if invalid
    }
  }

  return false;
}

function detectOlderApplicant(metadata) {
  if (!metadata) return false;

  const yearsExp = Number(metadata.years_experience) || 0;
  if (yearsExp >= 20) return true;

  const age = Number(metadata.age) || 0;
  if (age >= 50) return true;

  if (metadata.career_start_year) {
    try {
      const currentYear = new Date().getFullYear();
      const startYear = Number(metadata.career_start_year);
      if (!isNaN(startYear) && currentYear - startYear >= 20) return true;
    } catch (e) {
      // Skip if invalid
    }
  }

  if (metadata.education_start_year || metadata.graduation_year) {
    try {
      const currentYear = new Date().getFullYear();
      const educationYear = Number(metadata.education_start_year || metadata.graduation_year);
      if (!isNaN(educationYear)) {
        const estimatedAge = currentYear - educationYear + 22;
        if (estimatedAge >= 50) return true;
      }
    } catch (e) {
      // Skip if invalid
    }
  }

  const seniorRoleCount = Number(metadata.senior_role_count) || 0;
  if (seniorRoleCount >= 3) return true;

  return false;
}

function detectOverqualified(jobDetails, metadata) {
  if (!jobDetails || !metadata) return false;

  if (jobDetails.seniority && metadata.seniority) {
    try {
      const seniorityLevels = ['Entry', 'Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Director', 'VP', 'C-Level'];
      const targetLevel = seniorityLevels.indexOf(String(jobDetails.seniority));
      const candidateLevel = seniorityLevels.indexOf(String(metadata.seniority));

      if (targetLevel >= 0 && candidateLevel >= 0 && candidateLevel - targetLevel >= 2) {
        return true;
      }
    } catch (e) {
      // Skip seniority analysis if invalid
    }
  }

  if (metadata.has_management_experience === true && jobDetails.requires_management === false) {
    return true;
  }

  const yearsExp = Number(metadata.years_experience) || 0;
  const typicalYears = Number(jobDetails.typical_years_experience) || 0;
  if (typicalYears > 0 && yearsExp > typicalYears * 1.5) return true;

  return false;
}
