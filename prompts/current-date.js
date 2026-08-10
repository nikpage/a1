// prompts/current-date.js
//
// The single source of truth for "what day is it" inside every prompt.
//
// Without this block a model anchors "now" to its own training cutoff, so real
// PAST dates (a role that ended in January 2026 when today is August 2026) get
// read as FUTURE — corrupting every recency, gap, tenure and "current role"
// judgment the prose makes. The deterministic checks in utils/master-issues.js
// are unaffected; this only fixes the AI's sense of time.
//
// Provider-agnostic, no side effects, and the clock is a PARAMETER so tests can
// inject a fixed date. Every consumer imports this — never duplicate the string.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "10 August 2026" — long form, unambiguous in every locale.
export function formatLongDate(now = new Date()) {
  return `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

export function currentDateBlock(now = new Date()) {
  const today = formatLongDate(now);
  return `TODAY'S DATE IS ${today}. This is the real present moment — do NOT assume any other "now".
- Judge ALL recency, gaps, tenure length and what counts as "current"/"ongoing" against ${today}, never against your own sense of the present.
- Any date on or before ${today} is in the PAST and already happened: never describe or flag it as future, upcoming, forthcoming, or "not yet started".
- A role whose end date has passed is finished; a role marked "Present"/"Current" is ongoing as of ${today}, and the time since the most recent end date is measured up to ${today}.`;
}
