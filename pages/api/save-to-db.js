// Enhanced buildCVPrompt function with pivot detection and handling

export function buildCVPrompt(tone, jobDetails, originalCv = '', metadata = null, feedbackData = null) {
  let promptBase = `You are a professional CV writer. Create a strong CV based on the candidate's real information and experience. `;

  // Detect pivot scenarios
  const isPivot = detectCareerPivot(jobDetails, metadata);
  const isRecentGrad = detectRecentGraduate(metadata);

  switch(tone) {
    case 'formal':
      promptBase += `Use a formal, professional tone with traditional formatting. Avoid contractions and casual language. `;
      break;
    case 'neutral':
      promptBase += `Use a balanced, professional tone that is neither too formal nor too casual. `;
      break;
    case 'casual':
      promptBase += `Use a conversational, approachable tone while maintaining professionalism. Feel free to use contractions and show some personality. `;
      break;
    case 'cocky':
      promptBase += `Use a confident, bold tone bordering on arrogant. Don't be afraid to showcase impact. Use colloquialisms like "kick-ass", "rock-star", "shit-hot", "Badass","dope","sick","legend", "nails", "banging", "off the chain", etc`;
      break;
  }

  // Handle different career scenarios
  if (isPivot) {
    promptBase += handleCareerPivot(jobDetails, metadata);
  } else if (isRecentGrad) {
    promptBase += handleRecentGraduate(jobDetails, metadata);
  } else {
    promptBase += handleCareerProgression(jobDetails, metadata);
  }

  // Rest of the function remains the same...
  promptBase += `\n\nNEVER invent placeholder data. If name, email, phone, or location are missing, OMIT them. Do NOT use fake names like "John Doe" or addresses like "123 Main Street".`;

  promptBase += `\n\nFormat the CV with clear section headings and bullet points for readability. Include:
1. Professional Summary
2. Work Experience (reverse chronological)
3. Education
4. Skills
5. Any other relevant sections based on the candidate's real background

Keep the writing style consistent with a ${tone} tone. Human-sounding, concise, achievement-focused. Return only the CV — no commentary, no notes.`;

  if (originalCv?.trim()) {
    promptBase += `

---

Here is the candidate's original CV:
${originalCv}

---

Use only this content when writing the CV. Do not invent anything. Do not add any experience not found above.`;
  }

  return promptBase;
}

// Detect if this is a career pivot
function detectCareerPivot(jobDetails, metadata) {
  if (!jobDetails.title || !metadata?.industries) return false;

  const targetJob = jobDetails.title.toLowerCase();
  const currentIndustries = metadata.industries.map(i => i.toLowerCase());

  // Define industry clusters that are related
  const industryClusters = {
    'tech': ['technology', 'software', 'it', 'digital', 'fintech'],
    'finance': ['finance', 'banking', 'investment', 'fintech', 'accounting'],
    'legal': ['legal', 'law', 'compliance', 'regulatory'],
    'healthcare': ['healthcare', 'medical', 'pharmaceutical', 'biotech'],
    'creative': ['marketing', 'design', 'advertising', 'media', 'entertainment'],
    'physical': ['construction', 'manufacturing', 'logistics', 'fishing', 'agriculture'],
    'service': ['retail', 'hospitality', 'customer service', 'sales']
  };

  // Check if target job is in a completely different cluster
  const targetCluster = findJobCluster(targetJob, industryClusters);
  const currentCluster = findIndustryCluster(currentIndustries, industryClusters);

  return targetCluster && currentCluster && targetCluster !== currentCluster;
}

// Detect recent graduate (limited experience)
function detectRecentGraduate(metadata) {
  if (!metadata) return false;
  return metadata.years_experience <= 2 || metadata.seniority === 'Entry';
}

// Handle career pivot scenario
function handleCareerPivot(jobDetails, metadata) {
  let pivotText = `\n\n🔄 CAREER PIVOT DETECTED: This candidate is transitioning from ${metadata?.industries?.join('/') || 'their current field'} to ${jobDetails.title}.\n\n`;

  pivotText += `CRITICAL PIVOT INSTRUCTIONS:
1. **Reframe Everything**: Don't just optimize - completely reframe their experience for the new field
2. **Transferable Skills Focus**: Lead with transferable skills, not industry-specific achievements
3. **New Professional Summary**: Write a summary that positions them as someone transitioning INTO this field, not continuing in their old one
4. **Experience Reframing**: For each role, emphasize aspects that transfer to the target role
5. **Skills Section**: Prioritize universal skills over industry-specific ones
6. **Remove Industry Jargon**: Avoid terminology that screams "old industry"

`;

  if (jobDetails.title || jobDetails.company) {
    pivotText += `Target Role Details:\n`;
    if (jobDetails.title) pivotText += `Position: ${jobDetails.title}\n`;
    if (jobDetails.company) pivotText += `Company: ${jobDetails.company}\n`;
  }

  if (metadata?.career_arcs_summary) {
    pivotText += `\nCandidate's Background: ${metadata.career_arcs_summary}\n`;
    pivotText += `Your job: Find the golden thread connecting their background to ${jobDetails.title}.\n`;
  }

  pivotText += `\nExample pivot approach:
- Lawyer → Fisherman: Emphasize attention to detail, working under pressure, early morning discipline, physical stamina from long court days
- Teacher → Sales: Focus on communication, presentation skills, relationship building, performance under observation
- Engineer → Restaurant: Highlight process optimization, problem-solving, working with tight deadlines and specifications\n`;

  return pivotText;
}

// Handle recent graduate
function handleRecentGraduate(jobDetails, metadata) {
  let gradText = `\n\n🎓 RECENT GRADUATE DETECTED: Limited professional experience.\n\n`;

  gradText += `RECENT GRAD INSTRUCTIONS:
1. **Education First**: Consider putting education before or alongside experience
2. **Maximize Everything**: Internships, projects, part-time work, volunteering - make it all count
3. **Skills-Based Approach**: Lead with what they can do, not years of experience
4. **Academic Achievements**: Include relevant coursework, projects, GPA if strong (3.5+)
5. **Potential Over Experience**: Focus on learning ability, fresh perspective, energy

`;

  if (jobDetails.title) {
    gradText += `Entry-level targeting for: ${jobDetails.title}\n`;
    gradText += `Show how their education and any experience (however limited) prepares them for this specific role.\n`;
  }

  return gradText;
}

// Handle normal career progression
function handleCareerProgression(jobDetails, metadata) {
  let progressText = `\n\nOptimize this CV for career progression:\n`;

  if (jobDetails.title || jobDetails.company || (jobDetails.keywords || []).length > 0) {
    if (jobDetails.title) progressText += `Position: ${jobDetails.title}\n`;
    if (jobDetails.company) progressText += `Company: ${jobDetails.company}\n`;
    if (jobDetails.seniority && metadata?.seniority) {
      progressText += `Target Role Level: ${jobDetails.seniority}\n`;
      progressText += `Candidate Current Level: ${metadata.seniority}\n`;
      if (jobDetails.seniority !== metadata.seniority) {
        progressText += `Position this candidate strategically for the level transition while staying truthful to their experience.\n`;
      }
    }
    if ((jobDetails.keywords || []).length > 0) {
      progressText += `Key skills to emphasize: ${jobDetails.keywords.join(', ')}\n`;
      progressText += `Strategically incorporate these key skills throughout the CV where relevant.\n`;
    }
  }

  // Add metadata-based enhancements
  if (metadata) {
    progressText += `\nCareer Narrative Context:\n`;
    if (metadata.career_arcs_summary) {
      progressText += `Career Arc: ${metadata.career_arcs_summary}\n`;
    }
    if (metadata.parallel_experiences_summary) {
      progressText += `Cross-functional Value: ${metadata.parallel_experiences_summary}\n`;
    }
    if (metadata.key_achievements?.length > 0) {
      progressText += `Key Achievements to Highlight: ${metadata.key_achievements.slice(0, 3).join(', ')}\n`;
    }
    progressText += `Use this career narrative to ensure the CV tells a coherent story of professional growth.\n`;
  }

  return progressText;
}

// Helper functions
function findJobCluster(jobTitle, clusters) {
  for (const [cluster, keywords] of Object.entries(clusters)) {
    if (keywords.some(keyword => jobTitle.includes(keyword))) {
      return cluster;
    }
  }
  return null;
}

function findIndustryCluster(industries, clusters) {
  for (const [cluster, keywords] of Object.entries(clusters)) {
    if (industries.some(industry =>
      keywords.some(keyword => industry.includes(keyword))
    )) {
      return cluster;
    }
  }
  return null;
}
