// components/TeaserDisplay.js
//
// The LANDING-PAGE teaser, built to SELL — not the shared report layout that
// AnalysisDisplay renders for the paid full analysis. Same teaser JSON shape
// (cv_data / analysis.* / job_match.positioning_strategy / final_thought).
//
// It reads as ONE story, told in plain language for any reader (nurse, teacher,
// engineer — we don't know who):
//   who we see -> where you stand (score) -> how it clears the two screens every
//   CV faces (software, then a recruiter's first glance) -> what a person thinks
//   on the closer read -> proof we can fix it -> what else is inside -> a couple
//   of genuine questions. The email / free-account CTA lives in pages/index.js.
//
// Hard rules learned the hard way:
//  - No internal jargon ("gate", "gauntlet") ever reaches the user.
//  - The copy must never contradict the verdicts it just showed: if both screens
//    pass, we do NOT say the CV "needs work before it competes". Passing the
//    screens means it gets through the door; the remaining work is the closer
//    read and per-job tailoring.
//  - Every section covers DIFFERENT ground — no restating the same finding.
//
// Reads only what the model returned; every block hides itself when empty.
import React from 'react';

const NA = new Set(['', 'n/a', 'na', 'null', 'none', 'undefined', '0-10']);
function isEmpty(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.every(isEmpty);
  if (typeof v === 'object') return Object.values(v).every(isEmpty);
  return NA.has(String(v).trim().toLowerCase());
}

// Collapse near-duplicate findings so the same issue never appears twice. We
// compare on a normalized signature (lowercased words, no punctuation); if two
// lines share most of their meaningful words, we keep only the first.
function dedupe(lines) {
  const seen = [];
  const out = [];
  for (const line of lines) {
    const words = new Set(
      String(line).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3)
    );
    const isDup = seen.some((prev) => {
      if (words.size === 0) return false;
      let shared = 0;
      for (const w of words) if (prev.has(w)) shared++;
      return shared / words.size >= 0.6;
    });
    if (!isDup) { seen.push(words); out.push(line); }
  }
  return out;
}

export default function TeaserDisplay({ analysis }) {
  let data;
  try {
    let raw = analysis;
    if (typeof raw === 'string') raw = raw.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!data) return null;

  const a = data.analysis || {};
  const cv = data.cv_data || {};
  const flags = dedupe((a.red_flags || []).filter((v) => !isEmpty(v)));
  // The locked "what else is inside" list, deduped against itself AND against the
  // red flags above so we never tease a fix for something already shown.
  const scopeAll = dedupe(Object.values(a.scope || {}).filter((v) => !isEmpty(v)));
  const scope = dedupe([...flags, ...scopeAll]).filter((s) => !flags.includes(s)).slice(0, 4);
  // Questions must not echo anything already surfaced above.
  const questions = dedupe([...flags, ...scope, ...(a.nuance_clarifications || []).filter((v) => !isEmpty(v))])
    .filter((q) => !flags.includes(q) && !scope.includes(q));
  const rw = a.sample_rewrite || {};
  const hasRewrite = !isEmpty(rw.before) && !isEmpty(rw.after);

  const who = [cv.Seniority, cv.Industry].filter((x) => !isEmpty(x)).join(' · ');

  const verdict = (v) => {
    const s = String(v || '').trim().toLowerCase();
    return s === 'pass' || s === 'fail' ? s : null;
  };
  const atsPass = verdict(a.ats_verdict);
  const scanPass = verdict(a.scan_verdict);
  const hasScreens = atsPass || scanPass;
  const anyFail = atsPass === 'fail' || scanPass === 'fail';
  // "Through the door" the moment nothing failed — independent of how many
  // polish items remain. This is what keeps the copy from contradicting itself.
  const throughTheDoor = hasScreens && !anyFail;

  // One row inside the "two screens" card.
  const ScreenRow = ({ label, pass, reason, quote }) => {
    if (!pass) return null;
    const ok = pass === 'pass';
    return (
      <div className="py-3 first:pt-0 last:pb-0">
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="font-semibold text-slate-800">{label}</div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {ok ? 'Clears it' : 'Gets stopped'}
          </span>
        </div>
        {!isEmpty(reason) && <p className="text-slate-700 text-sm">{reason}</p>}
        {!isEmpty(quote) && (
          <p className="text-slate-600 text-sm italic mt-2 border-l-2 border-slate-200 pl-3">
            Their gut reaction: “{quote}”
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Who we read — proves we parsed the real CV */}
      {(!isEmpty(cv.Name) || who) && (
        <div className="text-center">
          {!isEmpty(cv.Name) && <div className="text-xl font-bold text-slate-800">{cv.Name}</div>}
          {who && <div className="text-sm text-slate-500">{who}</div>}
        </div>
      )}

      {/* Where you stand — the number as the headline, with the single change that moves it */}
      {!isEmpty(a.overall_score) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-4xl font-extrabold text-slate-800">{a.overall_score}<span className="text-2xl text-slate-400">/10</span></div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mt-1">Your CV overall</div>
            </div>
            {!isEmpty(a.ats_score) && (
              <div className="text-center">
                <div className="text-4xl font-extrabold text-slate-800">{a.ats_score}<span className="text-2xl text-slate-400">/10</span></div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mt-1">Reads cleanly to software</div>
              </div>
            )}
          </div>
          {!isEmpty(data.final_thought) && (
            <div className="mt-4 text-center text-sm text-slate-700">{data.final_thought}</div>
          )}
        </div>
      )}

      {/* The two screens every CV faces before a person reads it — as one unit */}
      {hasScreens && (
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="text-base font-semibold text-slate-800 mb-1">Before anyone reads it, your CV passes two screens</div>
          <p className="text-sm text-slate-500 mb-3">First the application software, then a recruiter's few-second glance.</p>
          <div className="divide-y divide-slate-100">
            <ScreenRow label="The application software" pass={atsPass} reason={a.ats_reason} />
            <ScreenRow label="A recruiter's first glance" pass={scanPass} reason={a.scan_reason} quote={a.hr_first_seconds} />
          </div>
        </div>
      )}

      {/* The closer read — opens with a bridge that AGREES with the screens above */}
      {!isEmpty(a.overall_commentary) && (
        <div>
          <div className="text-base font-semibold text-slate-800 mb-1">
            {throughTheDoor ? 'Once someone reads it properly' : 'Why it stalls before someone reads it'}
          </div>
          <p className="text-slate-700">
            {throughTheDoor
              ? 'Both screens let your CV through — further than most get. What wins the interview now is the closer read, and how well the CV is shaped to each specific job. On that closer read: '
              : 'Your CV is getting filtered out before a person properly reads it — so that comes first. Here is what a closer read also turns up: '}
            {a.overall_commentary}
          </p>
        </div>
      )}

      {/* Proof we can fix it — one real line, lifted and upgraded */}
      {hasRewrite && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-base font-semibold text-slate-800 mb-1">What that fix looks like</div>
          <p className="text-sm text-slate-500 mb-3">One real line from your CV, rewritten:</p>
          <div className="text-sm text-slate-500 mb-1">Your wording</div>
          <p className="text-slate-600 mb-3">{rw.before}</p>
          <div className="text-sm text-emerald-700 mb-1">Rewritten</div>
          <p className="text-slate-900 font-medium">{rw.after}</p>
          <div className="mt-3 text-sm italic text-slate-600">Every line gets this treatment.</div>
        </div>
      )}

      {/* What else is inside — distinct from everything above, fixes withheld */}
      {(flags.length > 0 || scope.length > 0) && (
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="text-base font-semibold text-slate-800 mb-3">What else we found</div>
          {flags.length > 0 && (
            <ul className="mb-3 space-y-1">
              {flags.map((f, i) => (
                <li key={`f${i}`} className="text-slate-700 flex gap-2"><span className="text-amber-500">▲</span><span>{f}</span></li>
              ))}
            </ul>
          )}
          {scope.length > 0 && (
            <ul className="space-y-1">
              {scope.map((s, i) => (
                <li key={`s${i}`} className="text-slate-500 flex gap-2"><span aria-hidden>🔒</span><span>{s}</span></li>
              ))}
            </ul>
          )}
          <div className="mt-3 text-sm text-slate-600">The fixes come with the full rewrite.</div>
        </div>
      )}

      {/* A couple of genuine questions — consultation, not a growth hook */}
      {questions.length > 0 && (
        <div>
          <div className="text-base font-semibold text-slate-800 mb-2">
            {questions.length === 1 ? 'One thing we’d check with you first' : 'A couple of things we’d check with you first'}
          </div>
          <ul className="space-y-2">
            {questions.map((q, i) => (
              <li key={i} className="text-slate-700 flex gap-2"><span className="text-slate-400">{i + 1}.</span><span>{q}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
