// prompts/market.js
//
// Layer 5 — MARKET CONVENTIONS. Applied last, on top of every other layer.
// Which market applies is the JOB's country when there is a job ad, otherwise
// the candidate's own country from the CV. Nothing here ever generates a photo,
// a date of birth or a data-processing consent line: the rule is only ever
// "carry through what the candidate supplied", never "produce one".

// The cover letter's word budget is a market convention like any other (see
// CV_RULES.md, Layer 5): the Czech motivační dopis / Polish list motywacyjny is
// a short covering note, and a letter that runs past ~300 words there reads as
// padding rather than thoroughness. Anglo and DACH carry the longer letter.
const NEUTRAL_COVER = { min: 250, max: 350, target: 275 };

const MARKETS = {
  ANGLO: {
    codes: ['UK', 'GB', 'UNITED KINGDOM', 'GREAT BRITAIN', 'ENGLAND', 'SCOTLAND', 'WALES',
            'US', 'USA', 'UNITED STATES', 'IE', 'IRELAND'],
    rules: `- No photo, no date of birth, no marital status, no nationality — these are not shown in this market even if the master CV records them.
- 2 pages maximum; 1 page if the candidate has under roughly 5 years of experience.`,
  },
  DACH: {
    codes: ['DE', 'GERMANY', 'DEUTSCHLAND', 'AT', 'AUSTRIA', 'ÖSTERREICH', 'CH', 'SWITZERLAND', 'SCHWEIZ'],
    rules: `- A photo and structured personal details are conventional here: include them ONLY if the master CV actually supplies them, laid out as plain single-column labelled lines (never a table or a sidebar — Layer 1 still binds).
- If the master supplies none, write the CV without them and do not mention their absence.`,
  },
  CEE: {
    codes: ['CZ', 'CZECHIA', 'CZECH REPUBLIC', 'ČESKÁ REPUBLIKA', 'PL', 'POLAND', 'POLSKA'],
    cover: { min: 200, max: 300, target: 250 },
    rules: `- A photo is optional: include one only if the master CV supplies it.
- Include a data-processing consent line ONLY if the master CV supplies one, reproduced in the candidate's own recorded wording, as the final line of the CV.`,
  },
};

// Normalises whatever the analysis recorded ("Czech Republic", "cz", "n/a").
function marketFor(country) {
  const key = String(country || '').trim().toUpperCase();
  if (!key || key === 'N/A') return null;
  return Object.values(MARKETS).find((m) => m.codes.includes(key)) || null;
}

// The target market for this document: the job's country when a job ad exists,
// otherwise the candidate's own. Exported so callers/tests can assert the pick.
export function targetCountry(analysis) {
  const job = analysis?.job_data?.Country;
  if (job && String(job).trim().toUpperCase() !== 'N/A') return String(job).trim();
  const cv = analysis?.cv_data?.Country;
  if (cv && String(cv).trim().toUpperCase() !== 'N/A') return String(cv).trim();
  return '';
}

// Layer 5 block for the CV prompt. An unrecognised or absent country falls back
// to the universal half of the rule — never invent a convention for a market we
// do not know.
export function marketConventions(analysis) {
  const country = targetCountry(analysis);
  const market = marketFor(country);
  const specific = market
    ? market.rules
    : `- No market-specific convention is known for this target, so follow the neutral default: no photo, no date of birth, no marital status, no nationality, 2 pages maximum.`;

  return `# Layer 5 — Market conventions${country ? ` (target market: ${country})` : ''}
Applied last, on top of every other layer.
${specific}
- ABSOLUTE: never generate a photo, a date of birth, or a data-processing consent statement the candidate did not supply. Their absence is never explained on the CV.`;
}

// The letter's word band for this target market, with the neutral default for
// Anglo/DACH and for any country we do not recognise. Exported so the prompt and
// its tests read the same numbers.
export function coverWordBand(analysis) {
  const market = marketFor(targetCountry(analysis));
  return market?.cover || NEUTRAL_COVER;
}

// The LENGTH rule for the cover-letter prompt. The band is deterministic here
// (the analysis has already recorded the country), so the analysis's own
// target_cover_words is CLAMPED into it rather than trusted blind: that field is
// written by a pass that only guesses the market from the CV text.
export function coverLengthRule(analysis) {
  const { min, max, target } = coverWordBand(analysis);
  const country = targetCountry(analysis);
  return `- LENGTH (hard constraint): the letter body must be ${min}-${max} words total, in 3-4 short paragraphs, comfortably under one page${country ? ` — the convention for this target market (${country})` : ''}. This word budget does NOT include the date, salutation, or signature block. Use \`generation_framework.target_cover_words\` from the analysis when present, but only if it falls inside ${min}-${max}; if it is outside that range or absent, write to ~${target}. Before you return the letter, count the body against ${max} and cut if you are over. This is a CEILING, not a quota: a letter that finishes its argument in fewer words is finished — never pad to reach a number.`;
}
