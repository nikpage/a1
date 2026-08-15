// utils/steering.js
//
// Composes the workbench's three steering boxes (emphasise / play down / free
// instructions) into the single `tweak` string that prompts/cv-generator.js and
// prompts/cover-letter.js already treat as the candidate's HIGHEST-PRIORITY
// instructions. Steering only ever reframes, reorders or cuts real content — the
// prompts refuse to invent a fact to satisfy it, and nothing here changes that.
//
// An untouched form yields '' so the tweak block stays absent from the prompt
// entirely, exactly as it was before the workbench existed.

// The two prefixes composeTweak writes. They live here as constants because the
// contract checks (CV_RULES.md checks 29-30) have to read the emphasise and
// play-down halves back OUT of the composed string, and a second copy of these
// words in the validator would drift the first time this wording changes.
const EMPHASISE_PREFIX = 'Foreground and lead with: ';
const PLAY_DOWN_PREFIX = 'Play down, condense or place late: ';

export function composeTweak({ emphasise = '', playDown = '', freeform = '' } = {}) {
  const parts = [];
  if (emphasise.trim()) parts.push(`${EMPHASISE_PREFIX}${emphasise.trim()}`);
  if (playDown.trim()) parts.push(`${PLAY_DOWN_PREFIX}${playDown.trim()}`);
  if (freeform.trim()) parts.push(freeform.trim());
  return parts.join('\n');
}

// The inverse: the two steering halves recovered from a composed tweak, for the
// deterministic contract checks. Freeform instructions are deliberately NOT
// returned — they are prose in the candidate's own words with no stated
// direction, and code cannot tell what they ask for. A tweak that was not
// composed here (an older stored string, a hand-written one) simply yields
// empty halves, and the checks that read them report nothing rather than guess.
export function parseTweak(tweak = '') {
  const out = { emphasise: '', playDown: '' };
  for (const line of String(tweak || '').split('\n')) {
    if (line.startsWith(EMPHASISE_PREFIX)) out.emphasise = line.slice(EMPHASISE_PREFIX.length).trim();
    else if (line.startsWith(PLAY_DOWN_PREFIX)) out.playDown = line.slice(PLAY_DOWN_PREFIX.length).trim();
  }
  return out;
}
