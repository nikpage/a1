// components/TeaserDisplay.js
//
// The LANDING-PAGE teaser. This renders the design Nik supplied as HTML, wired to
// the model's teaser JSON so it works for ANY candidate (the supplied mock was
// hardcoded). Layout/styling are reproduced with scoped styled-jsx so nothing
// leaks into the rest of the app.
//
// Structure (matches the mock, with the agreed edits):
//   name + role + lead line
//   -> the two checks every CV faces, as two cards (the application software,
//      then a recruiter's first glance), with the recruiter's raw gut reaction
//      folded in beneath as a single teal quote block
//   -> what's getting buried (the model's positioning_strategy)
//   -> a couple of genuine questions
// The email / sign-up CTA lives in pages/index.js, as before.
//
// Edits applied vs the raw mock:
//   - opening line no longer says "gates" (internal jargon) -> i18n t('lead')
//   - first check labelled "The application software (ATS)"
//   - the separate "recruiter's eye snags" section is GONE; it's the same thing
//     as check 02, so it's one thought (the check's reason) + the teal quote
//   - a failed check shows its decisive reason the same way a passing one does
//   - "A couple of questions before the rewrite"
//   - all fixed chrome is localized (locales/*/teaserDisplay.json)
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

// Collapse near-duplicate questions so the same point never appears twice.
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
  const questions = dedupe((a.nuance_clarifications || []).filter((v) => !isEmpty(v)));

  const who = [cv.Seniority, cv.Industry].filter((x) => !isEmpty(x)).join(' · ');

  const verdict = (v) => {
    const s = String(v || '').trim().toLowerCase();
    return s === 'pass' || s === 'fail' ? s : null;
  };
  const atsPass = verdict(a.ats_verdict);
  const scanPass = verdict(a.scan_verdict);
  const hasChecks = atsPass || scanPass;

  // One card in the "two checks" row. Shows its decisive reason whether it passed
  // or failed — a failed ATS check explains itself just like the human one.
  const Gate = ({ label, seq, pass, reason }) => {
    if (!pass) return null;
    const ok = pass === 'pass';
    return (
      <div className={`gate ${ok ? 'pass' : 'fail'}`}>
        <div className="gate-top">
          <div className={`dot ${ok ? 'green' : 'red'}`} />
          <div className="gate-name">{label}</div>
          <div className="gate-seq">{seq}</div>
        </div>
        <div className="gate-verdict">{ok ? t('clearsIt') : t('stopsHere')}</div>
        {!isEmpty(reason) && <div className="gate-desc">{reason}</div>}
      </div>
    );
  };

  return (
    <div className="teaser">
      {/* header */}
      {(!isEmpty(cv.Name) || who || hasChecks) && (
        <div className="head">
          {!isEmpty(cv.Name) && <div className="cand-name">{cv.Name}</div>}
          {who && <div className="cand-role">{who}</div>}
          {hasChecks && <p className="lead">{t('lead')}</p>}
        </div>
      )}

      {/* the two checks + the recruiter's gut reaction (teal) folded in */}
      {hasChecks && (
        <div className="gates">
          <div className="gate-row">
            <Gate label={t('gate1')} seq="01" pass={atsPass} reason={a.ats_reason} />
            <Gate label={t('gate2')} seq="02" pass={scanPass} reason={a.scan_reason} />
          </div>
          {!isEmpty(a.hr_first_seconds) && (
            <div className="quote"><span className="q">“</span>{a.hr_first_seconds}”</div>
          )}
        </div>
      )}

      {/* what's getting buried */}
      {!isEmpty(positioning) && (
        <div className="block">
          <h2>{t('assetTitle')}</h2>
          <p className="asset-note">{positioning}</p>
        </div>
      )}

      {/* a couple of genuine questions */}
      {questions.length > 0 && (
        <div className="block">
          <h2>{questions.length === 1 ? t('questionsOne') : t('questionsMany')}</h2>
          <div className="q-list">
            {questions.map((q, i) => (
              <div className="q-item" key={i}>
                <div className="q-num">{i + 1}</div>
                <div className="q-text">{q}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .teaser {
          --navy:#1a2b4a; --teal:#16b8a6; --teal-dk:#0f9686; --ink:#2a3550;
          --muted:#6b7790; --line:#e6eaf0; --card:#ffffff; --green:#2bb673;
          --amber:#e9a13b; --red:#e25555; --red-bg:#fdf0f0; --green-bg:#eef9f3;
          --shadow:0 1px 3px rgba(26,43,74,.06),0 8px 24px rgba(26,43,74,.06);
          font-family:'Inter',system-ui,sans-serif; color:var(--ink); text-align:left;
        }
        .head { text-align:center; }
        .cand-name { font-family:'Poppins',sans-serif; font-weight:700; font-size:30px; color:var(--navy); letter-spacing:-.01em; }
        .cand-role { color:var(--muted); font-size:15px; margin-top:2px; }
        .lead { max-width:540px; margin:18px auto 0; color:var(--ink); font-size:16px; line-height:1.55; }

        .gates { margin-top:28px; }
        .gate-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        @media(max-width:560px){ .gate-row{ grid-template-columns:1fr; } }
        .gate { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:22px; box-shadow:var(--shadow); }
        .gate.fail { border-color:#f3d0d0; background:linear-gradient(180deg,var(--red-bg),#fff 60%); }
        .gate-top { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
        .dot { width:16px; height:16px; border-radius:50%; flex:none; position:relative; }
        .dot::after { content:""; position:absolute; inset:-5px; border-radius:50%; opacity:.18; }
        .dot.green { background:var(--green); } .dot.green::after { background:var(--green); }
        .dot.red { background:var(--red); } .dot.red::after { background:var(--red); }
        .gate-name { font-family:'Poppins',sans-serif; font-weight:600; font-size:15px; color:var(--navy); }
        .gate-seq { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--muted); margin-left:auto; }
        .gate-verdict { font-weight:600; font-size:14px; margin-bottom:4px; }
        .gate.pass .gate-verdict { color:var(--green); }
        .gate.fail .gate-verdict { color:var(--red); }
        .gate-desc { font-size:13.5px; color:var(--muted); line-height:1.5; }

        .quote { background:var(--teal); color:#f0fbf9; border-radius:14px; padding:22px 24px; margin-top:16px; font-size:16.5px; line-height:1.6; }
        .quote .q { color:#bff1ea; font-family:'Poppins',sans-serif; font-weight:700; font-size:30px; line-height:0; vertical-align:-12px; margin-right:4px; }

        .block { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:26px 28px; box-shadow:var(--shadow); margin-top:22px; }
        .block h2 { font-family:'Poppins',sans-serif; font-weight:600; font-size:18px; color:var(--navy); letter-spacing:-.01em; margin:0 0 12px; }
        .asset-note { color:var(--ink); font-size:15px; line-height:1.6; margin:0; }

        .q-list { display:flex; flex-direction:column; gap:14px; }
        .q-item { display:grid; grid-template-columns:auto 1fr; gap:14px; align-items:start; }
        .q-num { font-family:'Poppins',sans-serif; font-weight:600; font-size:14px; color:var(--teal-dk); background:var(--green-bg); border:1px solid #cfeede; border-radius:9px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; flex:none; }
        .q-text { font-size:15px; color:var(--ink); line-height:1.55; }
      `}</style>
    </div>
  );
}
