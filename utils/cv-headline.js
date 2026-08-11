// utils/cv-headline.js
//
// The CV headline is the bold line directly under the "# Name" heading inside
// the centred header block (see the template in prompts/cv-generator.js). These
// helpers are the ONE place that knows where it lives, shared by the inline
// editor in the UI and the API route that persists the change — so the two can
// never drift apart on what a headline is.

// A line consisting solely of bold markdown, e.g. "**Senior Engineer**".
const BOLD_LINE = /^\s*\*\*(.+?)\*\*\s*$/;
const NAME_LINE = /^\s*#\s+\S/;

// Index of the "# Name" heading, or -1. The first level-1 heading is the name.
function nameLineIndex(lines) {
  return lines.findIndex((l) => NAME_LINE.test(l));
}

// Index of the headline line, or -1 when the CV has none. It is the first
// non-empty line after the name, and only counts when it is a bold-only line.
function headlineLineIndex(lines) {
  const nameIdx = nameLineIndex(lines);
  if (nameIdx === -1) return -1;
  for (let i = nameIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    return BOLD_LINE.test(lines[i]) ? i : -1;
  }
  return -1;
}

// The headline text (without the ** markers), or '' when there is none.
export function readHeadline(content) {
  if (typeof content !== 'string') return '';
  const lines = content.split('\n');
  const idx = headlineLineIndex(lines);
  if (idx === -1) return '';
  return lines[idx].match(BOLD_LINE)[1].trim();
}

// Return `content` with the headline replaced by `headline` — inserting it
// directly under the name when the CV currently has none. An empty/blank
// headline removes the line (same path as removeHeadline).
export function writeHeadline(content, headline) {
  if (typeof content !== 'string') return content;
  const text = (headline || '').replace(/\s+/g, ' ').trim();
  const lines = content.split('\n');
  const idx = headlineLineIndex(lines);

  if (!text) {
    if (idx === -1) return content;
    lines.splice(idx, 1);
    return lines.join('\n');
  }

  const line = `**${text}**`;
  if (idx !== -1) {
    lines[idx] = line;
    return lines.join('\n');
  }

  const nameIdx = nameLineIndex(lines);
  if (nameIdx === -1) return content;
  lines.splice(nameIdx + 1, 0, line);
  return lines.join('\n');
}

// Return `content` with the headline line removed (no-op when absent).
export function removeHeadline(content) {
  return writeHeadline(content, '');
}
