// utils/formatting-util.js

export function formatAnalysisOutput(rawAnalysis) {
  // Deep clone to avoid mutating original
  const formatted = JSON.parse(JSON.stringify(rawAnalysis));

  // Apply formatting transformations
  formatBulletPoints(formatted);
  removeMarkdownSyntax(formatted);
  validateJSONStructure(formatted);

  return formatted;
}

function formatBulletPoints(obj) {
  if (typeof obj === 'string') {
    return formatStringBullets(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') {
        return formatStringBullets(item);
      }
      return formatBulletPoints(item);
    });
  }

  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      obj[key] = formatBulletPoints(obj[key]);
    }
  }

  return obj;
}

function formatStringBullets(str) {
  if (!str || typeof str !== 'string') return str;

  // Convert various bullet formats to consistent "•"
  let formatted = str
    // Replace markdown bullets
    .replace(/^\s*[-*+]\s+/gm, '• ')
    // Replace numbered lists
    .replace(/^\s*\d+\.\s+/gm, '• ')
    // Replace existing bullets with consistent format
    .replace(/^\s*[•▪▫▬►]\s*/gm, '• ')
    // Replace HTML bullets
    .replace(/^\s*&bull;\s*/gm, '• ')
    // Normalize whitespace around bullets
    .replace(/•\s+/g, '• ')
    // Ensure line breaks after bullets
    .replace(/•\s*([^•\n]+)(?=\s*•)/g, '• $1\n')
    // Clean up multiple line breaks
    .replace(/\n\s*\n/g, '\n')
    // Trim whitespace
    .trim();

  return formatted;
}

function removeMarkdownSyntax(obj) {
  if (typeof obj === 'string') {
    return cleanMarkdownFromString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') {
        return cleanMarkdownFromString(item);
      }
      return removeMarkdownSyntax(item);
    });
  }

  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      obj[key] = removeMarkdownSyntax(obj[key]);
    }
  }

  return obj;
}

function cleanMarkdownFromString(str) {
  if (!str || typeof str !== 'string') return str;

  return str
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Remove blockquotes
    .replace(/^>\s*/gm, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

function validateJSONStructure(obj) {
  // Ensure required top-level keys exist
  const requiredKeys = [
    'summary',
    'cv_data',
    'job_data',
    'jobs_extracted',
    'analysis',
    'job_match',
    'final_thought'
  ];

  requiredKeys.forEach(key => {
    if (!(key in obj)) {
      obj[key] = getDefaultValue(key);
    }
  });

  // Validate nested structures
  validateCVData(obj.cv_data);
  validateJobData(obj.job_data);
  validateAnalysis(obj.analysis);
  validateJobMatch(obj.job_match);
}

function getDefaultValue(key) {
  const defaults = {
    'summary': '',
    'cv_data': {
      'Name': 'n/a',
      'Seniority': 'n/a',
      'Industry': 'n/a',
      'Country': 'n/a'
    },
    'job_data': {
      'Position': 'n/a',
      'Seniority': 'n/a',
      'Company': 'n/a',
      'Industry': 'n/a',
      'Country': 'n/a',
      'HR Contact': 'n/a'
    },
    'jobs_extracted': [],
    'analysis': {},
    'job_match': {},
    'final_thought': ''
  };

  return defaults[key] || '';
}

function validateCVData(cvData) {
  const required = ['Name', 'Seniority', 'Industry', 'Country'];
  required.forEach(field => {
    if (!(field in cvData)) {
      cvData[field] = 'n/a';
    }
  });
}

function validateJobData(jobData) {
  const required = ['Position', 'Seniority', 'Company', 'Industry', 'Country', 'HR Contact'];
  required.forEach(field => {
    if (!(field in jobData)) {
      jobData[field] = 'n/a';
    }
  });
}

function validateAnalysis(analysis) {
  const requiredFields = [
    'overall_score',
    'ats_score',
    'scenario_tags',
    'cv_format_analysis',
    'cultural_fit',
    'red_flags',
    'overall_commentary',
    'suitable_positions',
    'career_arc',
    'parallel_experience',
    'transferable_skills',
    'style_wording',
    'ats_keywords',
    'action_items'
  ];

  requiredFields.forEach(field => {
    if (!(field in analysis)) {
      analysis[field] = getAnalysisDefault(field);
    }
  });

  // Validate action_items structure
  if (!analysis.action_items || typeof analysis.action_items !== 'object') {
    analysis.action_items = {};
  }

  if (!analysis.action_items.cv_changes) {
    analysis.action_items.cv_changes = {
      critical: [],
      advised: [],
      optional: []
    };
  }

  if (!analysis.action_items['Cover Letter']) {
    analysis.action_items['Cover Letter'] = {
      'Points to Address': [],
      'Narrative Flow': [],
      'Tone and Style': []
    };
  }
}

function getAnalysisDefault(field) {
  const defaults = {
    'overall_score': '0',
    'ats_score': '0',
    'scenario_tags': [],
    'cv_format_analysis': '',
    'cultural_fit': '',
    'red_flags': '',
    'overall_commentary': '',
    'suitable_positions': '',
    'career_arc': '',
    'parallel_experience': '',
    'transferable_skills': '',
    'style_wording': '',
    'ats_keywords': '',
    'action_items': {}
  };

  return defaults[field] || '';
}

function validateJobMatch(jobMatch) {
  const required = ['keyword_match', 'inferred_keywords', 'career_scenario', 'positioning_strategy'];
  required.forEach(field => {
    if (!(field in jobMatch)) {
      jobMatch[field] = 'n/a';
    }
  });
}

// Helper function for web output formatting
export function formatForWeb(analysis) {
  const webFormatted = formatAnalysisOutput(analysis);

  // Additional web-specific formatting
  webFormatted.summary = ensureWebSummary(webFormatted.summary);
  webFormatted.final_thought = ensureWebClosing(webFormatted.final_thought);

  return webFormatted;
}

function ensureWebSummary(summary) {
  if (!summary || summary.length < 50) {
    return 'Professional CV analysis revealing key insights and strategic recommendations for career advancement.';
  }

  // Ensure summary is engaging and concise
  if (summary.length > 300) {
    return summary.substring(0, 297) + '...';
  }

  return summary;
}

function ensureWebClosing(finalThought) {
  if (!finalThought || finalThought.length < 30) {
    return 'Your career trajectory shows strong potential. Focus on the recommended improvements to maximize your market positioning.';
  }

  return finalThought;
}

// Quality assurance function
export function validateOutput(analysis) {
  const issues = [];

  // Check for empty critical sections
  if (!analysis.summary || analysis.summary.trim().length < 20) {
    issues.push('Summary too short or missing');
  }

  if (!analysis.analysis?.overall_commentary || analysis.analysis.overall_commentary.trim().length < 50) {
    issues.push('Overall commentary missing or insufficient');
  }

  if (!analysis.analysis?.action_items?.cv_changes?.critical?.length) {
    issues.push('No critical CV changes identified');
  }

  // Check for placeholder values
  const placeholders = ['n/a', 'tbd', 'todo', 'placeholder'];
  const jsonStr = JSON.stringify(analysis).toLowerCase();
  const hasPlaceholders = placeholders.some(p => jsonStr.includes(p));

  if (hasPlaceholders) {
    issues.push('Contains placeholder values that should be filled');
  }

  return {
    isValid: issues.length === 0,
    issues: issues
  };
}
