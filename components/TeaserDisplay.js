// components/TeaserDisplay.js
//
// The LANDING-PAGE teaser, built to SELL — not the shared report layout that
// AnalysisDisplay renders for the paid full analysis. Same teaser JSON shape
// (cv_data / analysis.* / job_match.positioning_strategy / final_thought), but
// arranged as a conversion page around the GAUNTLET a real CV runs: gate 1 (the
// ATS machine screen) -> gate 2 (the ~7-second recruiter skim) -> a solid /
// needs-work branch (survives it = tune to each job next; needs work = we fix it,
// then tune) -> score -> proof rewrite -> locked curiosity gap -> the 1-4 sharp
// questions. The email / free-account CTA lives in pages/index.js right below this.
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

  // The two binary gates a CV runs before a human reads it properly. We only
  // claim a verdict when the model actually returned "pass"/"fail".
  const verdict = (v) => {
    const s = String(v || '').trim().toLowerCase();
    return s === 'pass' || s === 'fail' ? s : null;
  };
  const atsPass = verdict(a.ats_verdict);
  const scanPass = verdict(a.scan_verdict);
  // Solid only when the model says so; otherwise infer needs-work if either gate failed.
  const stateRaw = String(a.cv_state || '').trim().toLowerCase();
  const isSolid = stateRaw === 'solid' || (!stateRaw && atsPass === 'pass' && scanPass === 'pass' && flags.length === 0);

  // A single pass/fail gate row.
  const Gate = ({ title, pass, reason, detail }) => {
    if (!pass) return null;
    const ok = pass === 'pass';
    return (
      <div className={`rounded-xl border p-5 ${ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
        <div className="flex items-center justify-between gap-3 mb-1">
          <div className="text-base font-semibold text-slate-800">{title}</div>
          <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded ${ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
            {ok ? 'Pass' : 'Fail'}
          </span>
        </div>
        {!isEmpty(reason) && <p className="text-slate-700">{reason}</p>}
        {!isEmpty(detail) && <p className="text-slate-600 text-sm mt-2">{detail}</p>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Who we read — small, proves we parsed the real CV */}
      {(!isEmpty(cv.Name) || who) && (
        <div className="text-center">
          {!isEmpty(cv.Name) && <div className="text-xl font-bold text-slate-800">{cv.Name}</div>}
          {who && <div className="text-sm text-slate-500">{who}</div>}
        </div>
      )}

      {/* THE GAUNTLET — gate one (machine) and gate two (the 7-second human skim) */}
      <Gate title="Gate 1 · The ATS (machine screen)" pass={atsPass} reason={a.ats_reason} />
      <Gate
        title="Gate 2 · The 7-second recruiter skim"
        pass={scanPass}
        reason={a.scan_reason}
        detail={a.hr_first_seconds}
      />

      {/* The verdict-driven branch: solid → tune to the job; needs-work → fix first, then tune */}
      <div className={`rounded-xl border p-5 ${isSolid ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        {isSolid ? (
          <>
            <div className="text-base font-semibold text-slate-800 mb-1">Your CV survives the gauntlet</div>
            <p className="text-slate-700">
              It already clears the screens most CVs die at. The leverage now isn't fixing it — it's
              tuning it to each specific job so it gets shortlisted. That's exactly what we do next.
            </p>
          </>
        ) : (
          <>
            <div className="text-base font-semibold text-slate-800 mb-1">Your CV needs work before it competes</div>
            <p className="text-slate-700">
              Right now it stumbles at a gate above — the fixes are below. We rebuild it into a solid
              master CV, then tune that to each job you apply for so it gets shortlisted.
            </p>
          </>
        )}
      </div>

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
          <div className="text-base font-semibold text-slate-800 mb-2">
            {questions.length === 1 ? 'One thing only you can answer' : `${questions.length} things only you can answer`}
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
