// utils/formatting-util.js

export function formatAnalysisOutput(rawAnalysis) {
  // Deep clone to avoid mutating original
  const formatted = JSON.parse(JSON.stringify(rawAnalysis));

  // Only validate and set defaults (no heavy recursion)
  validateJSONStructure(formatted);

  return formatted;
}

function validateJSONStructure(obj) {
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

  validateCVData(obj.cv_data);
  validateJobData(obj.job_data);
  validateAnalysis(obj.analysis);
  validateJobMatch(obj.job_match);

  // Quick scan for forbidden artifacts (markdown/bullets) - early flag without full recursion
  const jsonStr = JSON.stringify(obj);
  if (jsonStr.match(/[*_~`#\[\]\(\)]|^\s*[-*+•]/m)) {
    console.warn('Detected potential markdown/bullets - consider LLM retry for clean output');
    // Optionally throw or handle - keeps quality high
  }
}

function getDefaultValue(key) {
  const defaults = {
    'summary': '',
    'cv_data': {
      'Name': '',
      'Seniority': '',
      'Industry': '',
      'Country': ''
    },
    'job_data': {
      'Position': '',
      'Seniority': '',
      'Company': '',
      'Industry': '',
      'Country': '',
      'HR Contact': ''
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
      cvData[field] = '';
    }
  });
}

function validateJobData(jobData) {
  const required = ['Position', 'Seniority', 'Company', 'Industry', 'Country', 'HR Contact'];
  required.forEach(field => {
    if (!(field in jobData)) {
      jobData[field] = '';
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
    'red_flags': [],
    'overall_commentary': '',
    'suitable_positions': [],
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
      jobMatch[field] = '';
    }
  });
}

export function formatForWeb(analysis) {
  const webFormatted = formatAnalysisOutput(analysis);

  webFormatted.summary = ensureWebSummary(webFormatted.summary);
  webFormatted.final_thought = ensureWebClosing(webFormatted.final_thought);

  return webFormatted;
}

function ensureWebSummary(summary) {
  if (!summary || summary.length < 50) {
    return 'Professional CV analysis revealing key insights and strategic recommendations for career advancement.';
  }

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

export function validateOutput(analysis) {
  const issues = [];

  if (!analysis.summary || analysis.summary.trim().length < 20) {
    issues.push('Summary too short or missing');
  }

  if (!analysis.analysis?.overall_commentary || analysis.analysis.overall_commentary.trim().length < 50) {
    issues.push('Overall commentary missing or insufficient');
  }

  if (!analysis.analysis?.action_items?.cv_changes?.critical?.length) {
    issues.push('No critical CV changes identified');
  }

  const forbiddenValues = ['tbd', 'todo', 'placeholder', 'n/a', 'na', 'unknown'];
  const jsonStr = JSON.stringify(analysis).toLowerCase();
  if (forbiddenValues.some(p => jsonStr.includes(p))) {
    issues.push('Contains forbidden placeholder-like values');
  }

  return {
    isValid: issues.length === 0,
    issues: issues
  };
}
