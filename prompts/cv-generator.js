// prompts/cv-generator.js
//
// THE WRITING PROMPT FOR THE CV.
//
// This file used to restate Layers 1-3, the scenario mitigations, the human-voice
// rules and a nineteen-line final checklist to the writer, on top of the record,
// the ad and the blueprint. That is the same shape that was measured and beaten
// on the cover letter on 2026-08-15: standing instructions identical for every
// user and every job, crowding out the candidate's own material, so every
// document read the same. CV_RULES.md, "What the CV IS", states the conclusion
// that governs this file — the layers are the SPECIFICATION of a finished CV,
// not the text of the writing prompt.
//
// What remains here is the record, the ad, the blueprint, the invariants, the
// candidate's VOICE and STEERING, the output LANGUAGE, and the document's
// furniture (the section set, the date format, the markdown shape). Layers 1-5
// are enforced downstream by Layer 6 — utils/cv-validate.js — deterministically,
// where a violation is CAUGHT rather than merely asked against, and the single
// regeneration carries the specific failure back to the writer.
//
// **Do not restore a rule here without a run that shows the CV is better with
// it** (scripts/test-generate.mjs, two samples, logged in COVER_LETTER_LOG.md).

import { toneInstructions } from './tone.js';
import { languageInstruction } from './language.js';
import { targetJobBlock, rawAdBlock } from './job-target.js';
import { currentDateBlock, currentDateReminder } from './current-date.js';
import { cvInvariants } from './cv-rules.js';
import { bannedPhraseLine } from './voice.js';
import { marketConventions } from './market.js';
import { sectionNameBlock } from './cv-sections.js';
import { generationBrief } from './analysis-brief.js';
import { buildSkeleton, skeletonBlock } from './cv-skeleton.js';

// The record reaches this prompt as text — JSON for a real master, raw CV text
// where the master build failed. Only the structured form can carry a skeleton;
// the fallback keeps the old freeform template.
function parseRecord(cv) {
  if (cv && typeof cv === 'object') return cv;
  try {
    const parsed = JSON.parse(String(cv));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function buildCvPrompt(cv, analysis, tone, tweak = '', core = '', language = 'auto', now = new Date()) {
  // Work Experience is STRUCTURED IN CODE (prompts/cv-skeleton.js) — see the
  // note there for the seven rounds of prompting that could not hold nesting,
  // MM/YYYY or the recency window by instruction alone.
  const record = parseRecord(cv);
  const skeleton = record ? skeletonBlock(buildSkeleton(record, { now })) : '';
  // The ad's extraction — the right input for the CV, which is a coverage and
  // ordering problem (CV_RULES.md, Layer 3).
  const jobBlock = targetJobBlock(analysis);
  const marketBlock = marketConventions(analysis);

  const coreBlock = core && core.trim()
    ? `\n# How the candidate describes their own durable value\n"${core.trim()}"\nLet it guide what you foreground — never state anything the record does not prove.\n`
    : '';

  // The candidate's own instructions. They outrank the blueprint, which was
  // written before they typed this. The one thing steering can never do is add
  // a fact.
  const tweakBlock = tweak && tweak.trim()
    ? `\n# The candidate's own instructions for this CV (HIGHEST PRIORITY — they outrank the blueprint itself)\n"${tweak.trim()}"\n\nThis is the candidate speaking about their own CV, after the blueprint was written.\n- **Demoted content is not the lead.** What they asked you to play down may not sit in the headline, the impact zone or a top achievement, however well it answers the ad. Use other real evidence; where there is none, that requirement simply goes unanswered.\n- **Demoted content is not deleted.** Roles stay in the timeline with their real dates (T2); they are condensed and placed by relevance.\n- **Emphasised content leads and is proved**, with the specific facts the record holds for it.\n- **Steering never adds a fact** — where they ask you to emphasise something the record does not evidence, foreground the closest thing it DOES evidence and say no more.\n`
    : '';

  const systemMessage = {
    role: 'system',
    content: `You are an elite professional CV writer — the kind candidates pay hundreds for. You take a person's real career record and a strategist's blueprint and turn them into a CV that a senior recruiter cannot put down. You write with impact, precision and zero filler, and you output a finished CV only — never notes, never commentary.`
  };

  const userMessage = {
    role: 'user',
    content: `Write a tailored CV using the career record and job description below.

Highlight the achievements and skills from the record that directly align with the requirements, responsibilities and qualifications in the job description. Lead each role with the result, then the action, and put the record's own numbers up front.

# What this CV is for
One job: a recruiter reads it and shortlists this person. A document that is accurate and gives them no reason to call has failed.

- **Name facts, not identities.** Never describe the candidate as a CATEGORY — "veteran", "seasoned", "accomplished", "industry expert", "technology leader" and their equivalents. They assert standing instead of evidence, and on a long career "veteran" broadcasts age in the exact spot the CV is managing it. Say what the person DID.
${bannedPhraseLine(language)}
- **Red flags are handled, not advertised.** Where the blueprint names a concern, neutralise it by framing and selection — never draw the reader's eye to a gap or a weakness. That work belongs in the cover letter.

${cvInvariants()}
${tweakBlock}${coreBlock}
${currentDateBlock(now)}
${jobBlock}
${marketBlock}

# The document's furniture
- ${languageInstruction(language)}
- Tone — "${tone}": ${toneInstructions(tone)}
- Every dated entry in Work Experience reads MM/YYYY, one format across the whole document, ongoing roles as "MM/YYYY - Present". Reproduce the record's own months and years: normalising the FORMAT is required, changing a date is forbidden. Where the record holds only a year, print that bare year — never invent a month to complete the pattern. Graduation years in Education are bare years.
- A \`voice_guide\` in the record, where one exists, is the candidate's OWN written statement of how they write: follow it for the summary's cadence, sentence shapes and vocabulary, and for the register of the bullets. Like \`voice_samples\` it describes HOW to write, never WHAT is true — neither can license a fact the record does not carry.
- The record's \`work_experience[]\` is the definitive source for all employment, including any nested \`fractional_engagements[]\` inside a parent entry. A parent with \`fractional_engagements[]\` renders as ONE top-level role, using the parent's own company, title and dates — its engagements are NEVER separate top-level jobs, and never counted as short tenures or job-hopping.
- **A nested engagement still keeps its own employer, title and dates.** It renders as a sub-entry beneath its parent, in the shape shown in the template below, and its bullets sit under it. Never dissolve an engagement into the parent's own bullets, never mention the client only inside a sentence, and never relabel a real employer as an unnamed "client". A decade spent delivering for named companies must not read as a decade of unexplained self-employment: the client names are among the strongest evidence the record holds, and they are exactly what this employer scans for.
- Choose WHICH engagements to print by what this job asks for, the same way full roles are chosen — an engagement that answers the ad earns its sub-entry even if it is old, and one the ad has no use for can be dropped. Dropping is selection; hiding a real employer inside prose is not.
- Single column throughout. No tables, text boxes, columns, icons or layout HTML.
- Show LinkedIn URLs without the "www." prefix. Standardise locations to "City, Country", in the CV's primary language.
- Replace every [placeholder] below with real content — the finished CV contains no unfilled [brackets], and no filler such as "Full career history available upon request".

${sectionNameBlock(language)}

The English names in the template below identify WHICH section is which; write each heading in the document's own language using the names above. Omit any section the record has nothing for, along with its divider.

# Formatting Requirements
Output in Markdown with this exact structure:

<center>

# [Full Name]
**[Headline — one short line, max ~8 words, no closing punctuation]**
[Phone] | [Email] | [LinkedIn/Portfolio URLs]

</center>

---

### **Summary**
[A 2-3 sentence value proposition, then up to three achievement bullets immediately beneath, each naming the role and employer it came from.]

---

### **Skills**
[Single-column bullet list, one skill per line.]

---

### **Work Experience**
${skeleton
  ? '[Reproduce the structure given under "The Work Experience section, already structured" exactly as written there — every heading, employer and date verbatim — and write only the bullets. Bullets only, no paragraphs.]'
  : `[Reverse-chronological. Job title first, then employer, dates and location. Bullets only — no paragraphs.]

#### **[Job Title — exactly as the record states it]**
**[Company Name]** | [MM/YYYY] - [MM/YYYY or Present] | [City, Country]
- [Achievement]

[A parent entry that has fractional_engagements[] prints each chosen engagement beneath it in this shape, keeping the engagement's OWN title, client and dates. Omit this block entirely for a role with no engagements.]
##### **[Engagement Title — exactly as the record states it]** · [Client Name] | [MM/YYYY] - [MM/YYYY or Present]
- [Achievement from that engagement]`}

---

### **Speaking & Lecturing**
[Only when the blueprint's section_order includes it. Print EXACTLY the entries named in the blueprint's evidence_from_speaking list and no others, most relevant to this job first, one line each, each a real entry from the record.]
- [Topic or role] — [Event], [Location] [Year]

---

### **Publications**
[Only when the blueprint's section_order includes it. Same rule: print the publications named in evidence_from_speaking, chosen by subject, and no others.]
- [Title]

---

### **Education**
**[Degree/Diploma]** | [Institution] | [Year]

---

### **Certifications**
- [Certification]

${skeleton}

# Inputs
## The career record (the candidate's complete, structured record — your sole factual source):
${currentDateReminder(now)}
${cv}

## The strategist's blueprint (material for the document you are composing, not a form to answer):
${JSON.stringify(generationBrief(analysis), null, 2)}

**cv_blueprint.required_evidence is the exception to "not a form to answer".** Every item on it appears in the finished document, named — and where an item is a client engagement under an umbrella practice, that client is named in the umbrella entry's bullets.

Return only the formatted CV in the exact Markdown structure above. No commentary.
`
  };

  return [systemMessage, userMessage];
}

// Headline-only regeneration: the same headline rules as the full CV prompt,
// asked in isolation so the user can re-roll the tagline without paying for a
// whole document. Returns ONE line of plain text, never markdown.
export function buildHeadlinePrompt(cv, analysis, tone, current = '', language = 'auto') {
  const draft = analysis?.generation_framework?.cv_blueprint?.headline_draft || '';
  const jobBlock = targetJobBlock(analysis);

  return [
    {
      role: 'system',
      content: `You are an elite professional CV writer. You write the single headline that sits under a candidate's name on their CV. You output that line and nothing else — no quotes, no markdown, no commentary.`
    },
    {
      role: 'user',
      content: `${jobBlock}
# Task
Write ONE headline for this candidate's CV, in the "${tone}" tone.

Tone — "${tone}": ${toneInstructions(tone)}

# Rules (absolute)
- Max ~8 words. Not a sentence. No closing punctuation.
- It states what this candidate IS — role/discipline, optionally one domain or specialism the master CV proves (e.g. "Senior Backend Engineer | Payments Platforms").
- NEVER a duration: no "X+ years", no "a decade of", no career total. Durations are facts and belong nowhere but the dated roles.
- NEVER a title, seniority, domain, tool or specialism the master CV does not evidence. The target job's requirements are NEVER evidence about this candidate.
- No slogans or adjective soup ("results-driven professional", "passionate about", "dynamic").
- ${languageInstruction(language)}
${draft ? `\n# The strategist's draft (adapt to the "${tone}" voice — keep the role label, change the register)\n${draft}\n` : ''}${current && current.trim() ? `\n# The headline currently on the CV (the candidate asked for a DIFFERENT one — do not repeat it)\n${current.trim()}\n` : ''}
# Master CV (your sole factual source)
${cv}

Return only the headline line.`
    }
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SLOT PROMPT — the CV as DATA, not as a document.
//
// buildCvPrompt above asks the model for a finished CV and states the structure
// in English. On 2026-08-25 that was measured against writing the structure out
// verbatim in the prompt, and against a four-line minimal prompt carrying the
// same skeleton: all three dissolved the client engagements into the parent's
// bullets, and the minimal one also dropped every heading, re-dated everything
// long-form and printed roles back to 1993 (runs/2026-08-25_*, and the round
// table in runs/2026-08-25_sudolabs_cv-minimal-TRACKER.md).
//
// So this prompt never shows the model a document. It asks for the CONTENT of
// each slot and prompts/cv-assemble.js writes the markdown. Dissolving an
// engagement is no longer a rule to disobey — there is no slot for it.
//
// What reaches the writer is the record, the ad, the invariants, the
// candidate's steering and durable value, the output language and the market's
// conventions. Layers 1-5 are structure, and structure is now code's job.
export function buildCvSlotsPrompt(cv, analysis, tone, tweak = '', core = '', language = 'auto', now = new Date(), slots = []) {
  const record = parseRecord(cv);
  const recordText = typeof cv === 'string' ? cv : JSON.stringify(record ?? cv, null, 2);

  // The RAW ad, which is what the winning run read. The extraction is the
  // fallback for records saved before analysis.job_text existed.
  const adBlock = rawAdBlock(analysis) || targetJobBlock(analysis);

  const coreBlock = core && core.trim()
    ? `\n# How the candidate describes their own durable value\n"${core.trim()}"\nLet it guide what you foreground — never state anything the record does not prove.\n`
    : '';

  const tweakBlock = tweak && tweak.trim()
    ? `\n# The candidate's own instructions for this CV (HIGHEST PRIORITY — they outrank everything below)\n"${tweak.trim()}"\n- **Demoted content is not the lead**, however well it answers the ad: use other real evidence, or leave that requirement unanswered.\n- **Demoted content is not deleted** — its slot still prints, condensed.\n- **Emphasised content leads and is proved** with the specific facts the record holds.\n- **Steering never adds a fact.**\n`
    : '';

  const slotLines = slots.map((s) => `  "${s.key}"   (${s.title})`).join('\n');

  const systemMessage = {
    role: 'system',
    content: 'You are an elite professional CV writer — the kind candidates pay hundreds for. You are given a person\'s real career record and a job ad, and you return the CONTENT of a tailored CV as JSON. You never invent. You output one JSON object and nothing else — no commentary, no code fence, no notes.',
  };

  const userMessage = {
    role: 'user',
    content: `You are writing the content of a tailored CV. Highlight the achievements and skills from the career record that directly align with the requirements, responsibilities and qualifications in the job description. Invent nothing: every claim comes from the record.

# What this CV is for
One job: a recruiter reads it and shortlists this person. A document that is accurate and gives them no reason to call has failed.

- **Name facts, not identities.** Never describe the candidate as a CATEGORY — "veteran", "seasoned", "accomplished", "industry expert", "technology leader" and their equivalents. Say what the person DID.
${bannedPhraseLine(language)}
- **Red flags are handled, not advertised.** Neutralise a concern by framing and selection; never draw the reader's eye to it.

${cvInvariants()}
${tweakBlock}${coreBlock}
- ${languageInstruction(language)}
- Tone — "${tone}": ${toneInstructions(tone)}
- A \`voice_guide\` in the record, where one exists, is the candidate's OWN statement of how they write: follow it for cadence, sentence shapes and vocabulary. Like \`voice_samples\` it describes HOW to write, never WHAT is true.
${currentDateBlock(now)}
${marketConventions(analysis)}

# Return ONE JSON object and nothing else, in this exact shape

{
  "language": "the ISO code of the language you wrote in — en, cs or pl",
  "headline": "role | two or three domains, max ~8 words",
  "highlights": "three to five sentences of prose",
  "skills": ["short ATS term", "..."],
  "bullets": { "<slot key>": ["bullet", "..."] },
  "speaking": ["Topic — Event, Location Year", "..."],
  "publications": ["Title", "..."],
  "recognition": ["Certification or award", "..."]
}

Rules for each field:

- "language": the code for the language every other field is written in. The section headings are added around your content in that language, so a wrong code puts English headings over Czech text.
- "headline" opens on what this person does, never on an adjective about them.
- "highlights" opens on something concrete they have done — never on "high-agency", "proven track record", "extensive experience" or their like. It works from what THIS job most needs and names the specific work that proves each. It is PROSE, not bullets: it is not a summary of the CV below it and does not walk through the roles in order.
- "skills": one to three words each, the words the job description itself uses, only where the record evidences them. Never a sentence, never a parenthetical, never a grouped phrase.
- "bullets": the keys are EXACTLY the slot keys listed below, and no others. Each bullet leads with the result, then the action, and uses only figures the record states. Give an entry the number of bullets this job justifies — one for an entry the job has no use for, more for the ones that answer it. Every key must be present.
- "speaking" and "publications": choose ONLY the entries whose SUBJECT answers this job, most relevant first. Not the whole list, not the most recent. Return an empty array if the record holds nothing on point.
- "recognition": certifications and awards from the record.

The slot keys, in document order — return a bullets array for every one of them:

${slotLines}

# Career record (the candidate's sole factual source)
${recordText}

# The job
${adBlock}`,
  };

  return [systemMessage, userMessage];
}
