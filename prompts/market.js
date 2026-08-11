// prompts/market.js
//
// Layer 5 — MARKET CONVENTIONS. Applied last, on top of every other layer.
// Which market applies is the JOB's country when there is a job ad, otherwise
// the candidate's own country from the CV. Nothing here ever generates a photo,
// a date of birth or a data-processing consent line: the rule is only ever
// "carry through what the candidate supplied", never "produce one".

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
