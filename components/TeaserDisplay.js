// components/TeaserDisplay.js
//
// The LANDING-PAGE teaser, built to SELL — not the shared report layout that
// AnalysisDisplay renders for the paid full analysis. Same teaser JSON shape
// (cv_data / analysis.* / job_match.positioning_strategy / final_thought).
//
// It reads as ONE story, told in plain language for any reader (nurse, teacher,
// engineer — we don't know who):
//   who we see -> the two checks every CV faces before a person reads it (the
//   application software, then a recruiter's first glance), with the recruiter's
//   raw gut reaction shown verbatim -> what's getting buried -> the closer read
//   -> proof we can fix it -> what else is inside -> a couple of genuine
//   questions. The email / free-account CTA lives in pages/index.js.
//
// Hard rules learned the hard way:
//  - No internal jargon ("gate", "gauntlet", "screen") ever reaches the user.
//    All visible copy lives in locales/*/teaserDisplay.json (i18n), never the
//    model's job — the model returns the per-candidate prose already in the CV's
//    language; we only translate the fixed chrome around it.
//  - The copy must never contradict the verdicts it just showed: if both checks
//    pass, we do NOT say the CV "needs work before it competes". Passing them
//    means it gets through the door; the remaining work is the closer read and
//    per-job tailoring.
//  - Every section covers DIFFERENT ground — no restating the same finding.
//
// Reads only what the model returned; every block hides itself when empty.
import React from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('teaserDisplay');

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
  const positioning = data.job_match?.positioning_strategy;
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
  const hasChecks = atsPass || scanPass;
  const anyFail = atsPass === 'fail' || scanPass === 'fail';
  // "Through the door" the moment nothing failed — independent of how many
  // polish items remain. This is what keeps the copy from contradicting itself.
  const throughTheDoor = hasChecks && !anyFail;

  // One card: the machine check, then the recruiter check. We show the decisive
  // reason for BOTH outcomes (a clear pass and a clear fail get the same detail),
  // so a failed ATS check explains itself just as the human one does.
  const CheckCard = ({ label, seq, pass, reason }) => {
    if (!pass) return null;
    const ok = pass === 'pass';
    return (
      <div className={`rounded-2xl border bg-white p-5 ${ok ? 'border-slate-200' : 'border-rose-200'}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className={`w-3.5 h-3.5 rounded-full flex-none ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden />
          <span className="font-semibold text-slate-800">{label}</span>
          <span className="ml-auto text-xs font-mono text-slate-400">{seq}</span>
        </div>
        <div className={`text-sm font-semibold mb-1 ${ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {ok ? t('clearsIt') : t('stopsHere')}
        </div>
        {!isEmpty(reason) && <p className="text-sm text-slate-500 leading-relaxed">{reason}</p>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 text-left">
      {/* Who we read — proves we parsed the real CV — plus the framing line */}
      {(!isEmpty(cv.Name) || who || hasChecks) && (
        <div className="text-center">
          {!isEmpty(cv.Name) && <div className="text-2xl font-bold text-slate-800">{cv.Name}</div>}
          {who && <div className="text-sm text-slate-500 mt-0.5">{who}</div>}
          {hasChecks && (
            <p className="max-w-xl mx-auto mt-4 text-slate-700">{t('lead')}</p>
          )}
        </div>
      )}

      {/* The two checks every CV faces before a person reads it — as one unit.
          The recruiter's raw gut reaction sits right beneath, in their voice. */}
      {hasChecks && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CheckCard label={t('gate1')} seq="01" pass={atsPass} reason={a.ats_reason} />
            <CheckCard label={t('gate2')} seq="02" pass={scanPass} reason={a.scan_reason} />
          </div>
          {!isEmpty(a.hr_first_seconds) && (
            <div className="rounded-2xl bg-teal-600 p-5 text-teal-50">
              <p className="text-base leading-relaxed">
                <span className="align-[-0.25em] mr-1 text-2xl font-bold text-teal-200">“</span>
                {a.hr_first_seconds}”
              </p>
            </div>
          )}
        </div>
      )}

      {/* What's getting buried — real strengths positioned where they won't be seen */}
      {!isEmpty(positioning) && (
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="text-base font-semibold text-slate-800 mb-1">{t('assetTitle')}</div>
          <p className="text-slate-700">{positioning}</p>
        </div>
      )}

      {/* The closer read — opens with a bridge that AGREES with the checks above */}
      {!isEmpty(a.overall_commentary) && (
        <div>
          <div className="text-base font-semibold text-slate-800 mb-1">
            {throughTheDoor ? t('closerThrough') : t('closerStalls')}
          </div>
          <p className="text-slate-700">
            {throughTheDoor ? t('bridgeThrough') : t('bridgeStalls')}
            {a.overall_commentary}
          </p>
        </div>
      )}

      {/* Proof we can fix it — one real line, lifted and upgraded */}
      {hasRewrite && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-base font-semibold text-slate-800 mb-1">{t('rewriteTitle')}</div>
          <p className="text-sm text-slate-500 mb-3">{t('rewriteSub')}</p>
          <div className="text-sm text-slate-500 mb-1">{t('yourWording')}</div>
          <p className="text-slate-600 mb-3">{rw.before}</p>
          <div className="text-sm text-emerald-700 mb-1">{t('rewritten')}</div>
          <p className="text-slate-900 font-medium">{rw.after}</p>
          <div className="mt-3 text-sm italic text-slate-600">{t('everyLine')}</div>
        </div>
      )}

      {/* What else is inside — distinct from everything above, fixes withheld */}
      {(flags.length > 0 || scope.length > 0) && (
        <div className="rounded-xl border border-slate-200 p-5">
          <div className="text-base font-semibold text-slate-800 mb-3">{t('whatElseTitle')}</div>
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
          <div className="mt-3 text-sm text-slate-600">{t('fixesNote')}</div>
        </div>
      )}

      {/* A couple of genuine questions — consultation, not a growth hook */}
      {questions.length > 0 && (
        <div>
          <div className="text-base font-semibold text-slate-800 mb-2">
            {questions.length === 1 ? t('questionsOne') : t('questionsMany')}
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
