// utils/an-normalize.js
const logPrefix = '[normalizeInputs]';

export function normalizeInputs({ cvText, jobText }) {
  console.info(`${logPrefix} start`);
  const cv = normalizeText(String(cvText || ''));
  const job = normalizeText(typeof jobText === 'string' ? jobText : '');
  const language = detectLanguage(cv) || detectLanguage(job) || 'English';
  const countryHint = detectCountryHint(job) || detectCountryHint(cv) || null;
  console.info(
    `${logPrefix} done`,
    { language, countryHint, cvLen: cv.length, jobLen: job.length }
  );

  return { cv, job: job || null, language, countryHint };
}

function normalizeText(t) {
  return t
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\u200B/g, '')
    .replace(/[•◦▪]/g, '-');
}

function detectLanguage(t) {
  const samples = t.slice(0, 4000);
  const sets = [
    { lang: 'English', words: ['the', 'and', 'experience', 'education', 'summary'] },
    { lang: 'Czech', words: ['a', 'praxe', 'vzdělání', 'souhrn', 'dovednosti'] },
    { lang: 'Polish', words: ['oraz', 'doświadczenie', 'wykształcenie', 'umiejętności'] },
    { lang: 'Hungarian', words: ['és', 'tapasztalat', 'oktatás', 'készségek', 'összefoglaló'] },
    { lang: 'Romanian', words: ['și', 'experiență', 'educație', 'competențe', 'rezumat'] },
    { lang: 'German', words: ['und', 'erfahrung', 'ausbildung', 'fähigkeiten', 'zusammenfassung'] }
  ];
  let best = { lang: null, score: 0 };
  for (const s of sets) {
    let sc = 0;
    for (const w of s.words)
      sc += (samples.match(new RegExp(`\\b${w}\\b`, 'gi')) || []).length;
    if (sc > best.score) best = { lang: s.lang, score: sc };
  }
  return best.lang;
}

// A more reliable function to find the most likely country
function detectCountryHint(t) {
  const countryPatterns = {
    'Czech Republic': /(czech republic|česk[áý]|czechia|cz)/gi,
    'Poland': /(poland|polska|pl)/gi,
    'Hungary': /(hungary|magyarország|hu)/gi,
    'Romania': /(romania|românia|ro)/gi,
    'Germany': /(germany|deutschland|de)/gi,
    'United Kingdom': /(united kingdom|uk|england|scotland|wales|northern ireland)/gi,
    'United States': /(united states|usa|us)/gi
  };

  const scores = {};

  // Loop through each country and count its occurrences
  for (const country in countryPatterns) {
    const regex = countryPatterns[country];
    const matches = t.match(regex) || [];
    scores[country] = matches.length;
  }

  let bestCountry = null;
  let maxScore = 0;

  // Find the country with the highest score
  for (const country in scores) {
    if (scores[country] > maxScore) {
      maxScore = scores[country];
      bestCountry = country;
    }
  }

  return bestCountry;
}
