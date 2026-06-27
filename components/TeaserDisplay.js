// components/TeaserDisplay.js
//
// The LANDING-PAGE teaser. This reproduces the HTML mock Nik supplied 1:1 —
// structure and CSS verbatim — with the per-candidate text swapped for the
// model's teaser JSON so it works for ANY candidate. Styling is scoped with
// styled-jsx so nothing leaks into the rest of the app.
//
// Sections (exactly the mock's order):
//   header: name + role + lead
//   gates:  two stacked check cards (ATS first, then the recruiter's quick sort).
//           A PASS card shows one brief sentence; a FAIL card carries its own
//           explanation inline — up to 3 walk-through points (raw CV fact in grey,
//           the problem it creates in bold), the blunt bottom-line "DING" reason,
//           and (recruiter gate only) the navy gut-reaction quote.
//   asset:  "And here's what they never reach" — buried-credential chips + note
//   questions: "A couple of questions before the rewrite"
// The email / sign-up CTA lives in pages/index.js, as before.
//
// IMPORTANT: every block of markup lives DIRECTLY in this component's return.
// styled-jsx only scopes `<style jsx>` to elements in this component's own
// render tree — markup lifted into a child component renders unstyled, which is
// the bug that made the gate cards appear as plain text. Do not extract pieces
// into sub-components.
//
// Reads only what the model returned; every block hides itself when empty.
import React from 'react';
import Head from 'next/head';
import { useTranslation } from 'react-i18next';

const NA = new Set(['', 'n/a', 'na', 'null', 'none', 'undefined', '0-10']);
function isEmpty(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.every(isEmpty);
  if (typeof v === 'object') return Object.values(v).every(isEmpty);
  return NA.has(String(v).trim().toLowerCase());
}

// Coerce a model value to displayable text. The teaser fields are meant to be
// strings, but a cheap model sometimes returns an object (e.g. nuance items
// shaped like { point, detail }) — rendering that object directly throws React
// error #31 and crashes the whole page, so flatten any object to its text.
function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    return [v.question, v.point, v.detail, v.text, v.label, v.value]
      .filter((x) => typeof x === 'string' && x.trim())
      .join(' — ');
  }
  return String(v);
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
  const questions = dedupe((a.nuance_clarifications || []).map(asText).filter((v) => !isEmpty(v)));
  const atsSnags = (a.ats_snags || []).filter((s) => s && !isEmpty(s.point));
  const scanSnags = (a.scan_snags || []).filter((s) => s && !isEmpty(s.point));
  const creds = (a.buried_credentials || []).filter((c) => c && !isEmpty(c.name));


  const verdict = (v) => {
    const s = String(v || '').trim().toLowerCase();
    return s === 'pass' || s === 'fail' ? s : null;
  };
  const atsPass = verdict(a.ats_verdict);
  const scanPass = verdict(a.scan_verdict);
  const hasChecks = atsPass || scanPass;

  // The two checks, rendered inline (see file header for why not a sub-component).
  // Each gate owns its own explanation: a PASS shows one brief sentence; a FAIL
  // shows up to 3 real walk-through points + the blunt bottom-line reason. Only
  // the recruiter gate carries the navy gut-reaction quote.
  const gates = [
    { title: t('gate1'), pass: atsPass, reason: a.ats_reason, snags: atsSnags, failHead: t('atsFailHead'), quote: null },
    { title: t('gate2'), pass: scanPass, reason: a.scan_reason, snags: scanSnags, failHead: t('scanFailHead'), quote: a.hr_first_seconds },
  ];

  const hasAsset = creds.length > 0;

  return (
    <div className="teaser">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      {/* header */}
      {(!isEmpty(cv.Name) || hasChecks) && (
        <div className="head">
          {!isEmpty(cv.Name) && <div className="cand-name">{cv.Name}</div>}
          {hasChecks && <p className="lead">{t('lead')}</p>}
        </div>
      )}

      {/* the two checks — stacked, ATS first; each card carries its own verdict */}
      {hasChecks && (
        <div className="gates">
          {gates.map((g, i) => {
            if (!g.pass) return null;
            const ok = g.pass === 'pass';
            return (
              <div className={`gate ${ok ? 'pass' : 'fail'}`} key={i}>
                <div className="gate-top">
                  <div className={`dot ${ok ? 'green' : 'red'}`} />
                  <div className="gate-name">{g.title}</div>
                </div>
                <div className="gate-verdict">{ok ? t('clearsIt') : t('stopsHere')}</div>

                {ok ? (
                  /* PASS: one brief sentence on what's good */
                  !isEmpty(g.reason) && <div className="gate-desc">{asText(g.reason)}</div>
                ) : (
                  /* FAIL: the explanation lives inside the card */
                  <div className="fail">
                    {g.snags.length > 0 && (
                      <>
                        <div className="fail-head">{g.failHead}</div>
                        <ul className="snag">
                          {g.snags.map((s, j) => (
                            <li key={j}>
                              <div className="step">{j + 1}</div>
                              <div>
                                <span className="data">{asText(s.point)}</span>
                                {!isEmpty(s.detail) && <b className="issue">{asText(s.detail)}</b>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {/* recruiter gate only: the raw gut-reaction quote */}
                    {!isEmpty(g.quote) && (
                      <div className="quote">
                        <span className="q">“</span>{asText(g.quote)}<span className="q qc">”</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* and here's what they never reach at all */}
      {hasAsset && (
        <div className="block">
          <h2 className="sm">{t('assetTitle')}</h2>
          {creds.length > 0 && (
            <div className="asset-row">
              {creds.map((c, i) => (
                <div className="chip" key={i}>
                  {!isEmpty(c.tag) && <span>{asText(c.tag)}</span>} {asText(c.name)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* a couple of questions before the rewrite */}
      {questions.length > 0 && (
        <div className="block">
          <h2 className="sm">{questions.length === 1 ? t('questionsOne') : t('questionsMany')}</h2>
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
        .lead { max-width:540px; margin:18px auto 0; color:var(--ink); font-size:16px; line-height:1.55; }

        .gates { margin-top:28px; display:flex; flex-direction:column; gap:16px; }
        .gate { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:22px 22px 20px; box-shadow:var(--shadow); position:relative; }
        .gate.fail { border-color:#f3d0d0; background:linear-gradient(180deg,var(--red-bg),#fff 55%); }
        .gate-top { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
        .dot { width:16px; height:16px; border-radius:50%; flex:none; position:relative; }
        .dot::after { content:""; position:absolute; inset:-5px; border-radius:50%; opacity:.18; }
        .dot.green { background:var(--green); } .dot.green::after { background:var(--green); }
        .dot.red { background:var(--red); } .dot.red::after { background:var(--red); }
        .gate-name { font-family:'Poppins',sans-serif; font-weight:600; font-size:15px; color:var(--navy); }
        .gate-verdict { font-weight:600; font-size:14px; margin-bottom:4px; }
        .gate.pass .gate-verdict { color:var(--green); }
        .gate.fail .gate-verdict { color:var(--red); }
        .gate-desc { font-size:13.5px; color:var(--muted); line-height:1.5; }

        /* fail block — lives inside the failing card; the gap is the blank line under the verdict */
        .fail { margin-top:20px; }
        .fail-head { font-family:'Poppins',sans-serif; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--red); margin:0 0 6px; }

        .snag { list-style:none; display:flex; flex-direction:column; gap:0; margin:0; padding:0; }
        .snag li { display:grid; grid-template-columns:auto 1fr; gap:14px; align-items:start; padding:13px 0; border-top:1px solid #f0d6d6; }
        .snag li:first-child { border-top:none; }
        .step { font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:500; color:#fff; background:var(--red); width:24px; height:24px; border-radius:7px; display:flex; align-items:center; justify-content:center; flex:none; margin-top:1px; }
        /* the raw CV fact is just the data point — small + grey; the PROBLEM it
           creates is the line that must be read, so it carries the weight. */
        .snag .data { display:block; color:var(--muted); font-size:13px; line-height:1.45; }
        .snag .issue { display:block; color:var(--navy); font-weight:700; font-size:15px; line-height:1.45; margin-top:3px; }

        .block { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:28px 30px; box-shadow:var(--shadow); margin-top:22px; }
        .block h2 { font-family:'Poppins',sans-serif; font-weight:600; font-size:20px; color:var(--navy); letter-spacing:-.01em; margin:0 0 14px; }
        .block h2.sm { font-size:18px; }

        .quote { background:var(--navy); color:#eaf0fa; border-radius:14px; padding:22px 24px; margin-top:18px; font-size:16.5px; line-height:1.6; position:relative; }
        .quote .q { color:var(--teal); font-family:'Poppins',sans-serif; font-weight:700; font-size:30px; line-height:0; vertical-align:-12px; }
        .quote .q:first-child { margin-right:4px; }
        .quote .qc { margin-left:4px; }

        .asset-row { display:flex; gap:14px; flex-wrap:wrap; margin:14px 0 4px; }
        .chip { background:var(--green-bg); border:1px solid #cfeede; color:var(--teal-dk); border-radius:999px; padding:7px 15px; font-weight:600; font-size:14px; display:flex; align-items:center; gap:8px; }
        .chip span { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--green); background:#fff; border-radius:5px; padding:2px 6px; }

        .q-list { display:flex; flex-direction:column; gap:14px; }
        .q-item { display:grid; grid-template-columns:auto 1fr; gap:14px; align-items:start; }
        .q-num { font-family:'Poppins',sans-serif; font-weight:600; font-size:14px; color:var(--teal-dk); background:var(--green-bg); border:1px solid #cfeede; border-radius:9px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; flex:none; }
        .q-text { font-size:15px; color:var(--ink); line-height:1.55; }
      `}</style>
    </div>
  );
}
