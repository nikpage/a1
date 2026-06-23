// components/TeaserDisplay.js
//
// The LANDING-PAGE teaser, built to SELL — not the shared report layout that
// AnalysisDisplay renders for the paid full analysis. Same teaser JSON shape
// (cv_data / analysis.* / job_match.positioning_strategy / final_thought), but
// arranged as a conversion page: hook -> proof -> locked curiosity gap -> the
// two sharp questions. The CTA button lives in pages/index.js right below this.
//
// Reads only what the model returned; every block hides itself when empty, so a
// thin analysis never renders an empty heading.
import React from 'react';

const NA = new Set(['', 'n/a', 'na', 'null', 'none', 'undefined', '0-10']);
function isEmpty(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.every(isEmpty);
  if (typeof v === 'object') return Object.values(v).every(isEmpty);
  return NA.has(String(v).trim().toLowerCase());
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
  const scope = Object.values(a.scope || {}).filter((v) => !isEmpty(v));
  const flags = (a.red_flags || []).filter((v) => !isEmpty(v));
  const questions = (a.nuance_clarifications || []).filter((v) => !isEmpty(v));
  const rw = a.sample_rewrite || {};
  const hasRewrite = !isEmpty(rw.before) && !isEmpty(rw.after);

  const who = [cv.Seniority, cv.Industry].filter((x) => !isEmpty(x)).join(' · ');

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Who we read — small, proves we parsed the real CV */}
      {(!isEmpty(cv.Name) || who) && (
        <div className="text-center">
          {!isEmpty(cv.Name) && <div className="text-xl font-bold text-slate-800">{cv.Name}</div>}
          {who && <div className="text-sm text-slate-500">{who}</div>}
        </div>
      )}

      {/* Score as a gap, not a grade */}
      {!isEmpty(a.overall_score) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-4xl font-extrabold text-slate-800">{a.overall_score}<span className="text-2xl text-slate-400">/10</span></div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mt-1">Your CV today</div>
            </div>
            {!isEmpty(a.ats_score) && (
              <div className="text-center">
                <div className="text-4xl font-extrabold text-slate-800">{a.ats_score}<span className="text-2xl text-slate-400">/10</span></div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mt-1">ATS / parser score</div>
              </div>
            )}
          </div>
          {!isEmpty(data.final_thought) && (
            <div className="mt-4 text-center text-sm text-slate-700">{data.final_thought}</div>
          )}
        </div>
      )}

      {/* The hook — what's holding them back, in plain words */}
      {!isEmpty(a.overall_commentary) && (
        <div>
          <div className="text-base font-semibold text-slate-800 mb-1">What's holding your CV back</div>
          <p className="text-slate-700">{a.overall_commentary}</p>
        </div>
      )}

      {/* The proof — one real line, upgraded */}
      {hasRewrite && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-base font-semibold text-slate-800 mb-3">One line from your CV, rewritten</div>
          <div className="text-sm text-slate-500 mb-1"><span className="font-semibold">Before</span> · your CV</div>
          <p className="text-slate-600 mb-3">{rw.before}</p>
          <div className="text-sm text-emerald-700 mb-1"><span className="font-semibold">After</span> · what you'd get</div>
          <p className="text-slate-900 font-medium">{rw.after}</p>
          <div className="mt-3 text-sm italic text-slate-600">Every line in your CV gets this treatment.</div>
        </div>
      )}

      {/* The locked curiosity gap — what we found, fixes withheld */}
      {(flags.length > 0 || scope.length > 0) && (
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="text-base font-semibold text-slate-800 mb-3">
            What we found in your CV{flags.length + scope.length > 0 ? ` (${flags.length + scope.length})` : ''}
          </div>
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
          <div className="mt-3 text-sm text-slate-600">The fixes unlock when you continue.</div>
        </div>
      )}

      {/* Proof we read closely — the two sharp questions */}
      {questions.length > 0 && (
        <div>
          <div className="text-base font-semibold text-slate-800 mb-2">Two things only you can answer</div>
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
