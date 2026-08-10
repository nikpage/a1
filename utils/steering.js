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

export function composeTweak({ emphasise = '', playDown = '', freeform = '' } = {}) {
  const parts = [];
  if (emphasise.trim()) parts.push(`Foreground and lead with: ${emphasise.trim()}`);
  if (playDown.trim()) parts.push(`Play down, condense or place late: ${playDown.trim()}`);
  if (freeform.trim()) parts.push(freeform.trim());
  return parts.join('\n');
}
