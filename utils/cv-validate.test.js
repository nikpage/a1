// utils/cv-validate.test.js
//
// Layer 6 is the last thing between a broken CV and the user, so every check
// here is exercised against a real document string through the real validator —
// no mocks, and each test is built so it fails if the check stops working.

import { describe, it, expect } from 'vitest';
import { validateCv, validateCoverLetter, validationFeedback, splitSections, bannedPhraseHits } from './cv-validate.js';

// Warnings are { code, params } pairs so the UI can translate them; these
// helpers keep the assertions about WHICH warning fired, not about wording.
const codes = (r) => r.warnings.map((w) => w.code);
const paramsFor = (r, code) => r.warnings.find((w) => w.code === code)?.params || {};

const MASTER = JSON.stringify({
  profile: { name: 'Jane Roe', certifications: [] },
  work_experience: [
    {
      company: 'Acme Ltd',
      title: 'Head of Delivery',
      start_date: '03/2019',
      end_date: '08/2022',
      bullets: [
        'Cut release cycle from 42 days to 9 days across 4 product teams',
        'Ran a delivery org of 25 engineers',
      ],
      fractional_engagements: [],
    },
    {
      company: 'Borealis',
      title: 'Delivery Manager',
      start_date: '01/2015',
      end_date: '02/2019',
      bullets: ['Introduced CI pipelines using Jenkins'],
      fractional_engagements: [],
    },
  ],
  education: [],
});

// A document that satisfies every hard check, used as the baseline each test
// mutates one thing away from.
const GOOD = `<center>

# Jane Roe
**Head of Delivery | Platform Teams**
jane@example.com

</center>

---

### **Summary**
Delivery leader who rebuilt how Acme ships. Works close to the code and the customer.

- As Head of Delivery at Acme Ltd, cut release cycle from 42 days to 9 days
- As Head of Delivery at Acme Ltd, ran a delivery org of 25 engineers
- As Delivery Manager at Borealis, introduced CI pipelines using Jenkins

---

### **Work Experience**

#### **Head of Delivery**
**Acme Ltd** | 03/2019 - 08/2022 | London, United Kingdom
- Cut release cycle from 42 days to 9 days across four product teams and two platform squads
- Ran a delivery organisation of 25 engineers through a full replatforming programme and a staged rollout

#### **Delivery Manager**
**Borealis** | 01/2015 - 02/2019 | London, United Kingdom
- Introduced continuous integration pipelines using Jenkins across every product team in the group during the platform migration
`;

const ANALYSIS = {
  analysis: { scenario_tags: ['Standard Career Progression'], ats_keywords_missing: [] },
  generation_framework: { cv_blueprint: { section_order: ['Summary', 'Work Experience'] } },
};

describe('hard blocks (checks 1-4)', () => {
  it('passes a document that satisfies all four', () => {
    const r = validateCv(GOOD, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('blocks a number the master does not state', () => {
    const doc = GOOD.replace('25 engineers through a full', '80 engineers through a full');
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(false);
    expect(r.hard.join(' ')).toContain('"80"');
  });

  it('blocks a year-only date in Work Experience', () => {
    const doc = GOOD.replace('01/2015 - 02/2019', '2015 - 2019');
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard.join(' ')).toContain('MM/YYYY');
  });

  it('blocks a date whose year is absent from the master', () => {
    const doc = GOOD.replace('03/2019 - 08/2022', '03/2019 - 08/2024');
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard.join(' ')).toContain('08/2024');
  });

  it('blocks a Work Experience entry that is not a real role', () => {
    const doc = GOOD.replace(
      '#### **Delivery Manager**\n**Borealis**',
      '#### **Career Break**\n**Sabbatical**'
    );
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard.join(' ')).toContain('Career Break');
  });

  it('allows the undated Earlier Career line', () => {
    const doc = GOOD + '\n#### **Earlier Career**\n**Various delivery roles**\n';
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard).toEqual([]);
  });

  it('blocks layout HTML — the flattened Skills grid must not come back', () => {
    const doc = GOOD + '\n<div style="display: flex;"><ul><li>Delivery</li></ul></div>\n';
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard.join(' ')).toMatch(/layout HTML/);
    expect(r.hard.join(' ')).toContain('div');
  });

  it('blocks a section name the blueprint does not allow', () => {
    const doc = GOOD.replace('### **Work Experience**', '### **Where I Made Waves**');
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard.join(' ')).toContain('Where I Made Waves');
  });

  it('still catches a creative section name with no blueprint section_order', () => {
    const doc = GOOD.replace('### **Work Experience**', '### **Where I Made Waves**');
    const r = validateCv(doc, { master: MASTER, analysis: { analysis: { scenario_tags: [] } } });
    expect(r.hard.join(' ')).toContain('Where I Made Waves');
  });

  it('accepts Czech section names against an English blueprint', () => {
    const doc = GOOD
      .replace('### **Summary**', '### **Shrnutí**')
      .replace('### **Work Experience**', '### **Pracovní zkušenosti**');
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard).toEqual([]);
  });

  it('accepts Polish section names against an English blueprint', () => {
    const doc = GOOD
      .replace('### **Summary**', '### **Podsumowanie**')
      .replace('### **Work Experience**', '### **Doświadczenie zawodowe**');
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard).toEqual([]);
  });

  it('treats the Czech Earlier Career line as the undated exception', () => {
    const doc = GOOD + '\n#### **Dřívější kariéra**\n**Various delivery roles**\n';
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard).toEqual([]);
  });
});

describe('hard block: heading depth', () => {
  // The delivered .docx printed "## Client Engagement: ..." literally, because
  // the exporter parses only ### and ####. A sub-heading inside a role is a hard
  // failure, not a matter of taste.
  it('rejects a ## sub-heading invented inside a role', () => {
    const doc = GOOD.replace(
      '#### **Head of Delivery**',
      '#### **Head of Delivery**\n\n## Client Engagement: Enterprise Discovery'
    );
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(false);
    expect(r.hard.some((h) => h.includes('hash marks'))).toBe(true);
  });

  it('rejects a # sub-heading inside a role', () => {
    const doc = GOOD.replace('#### **Head of Delivery**', '# Head of Delivery');
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(false);
    expect(r.hard.some((h) => h.includes('hash marks'))).toBe(true);
  });

  it('leaves the name block above the first section alone', () => {
    const r = validateCv(GOOD, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard).toEqual([]);
  });
});

describe('warnings (checks 5-9)', () => {
  // The impact zone carries the achievements. Their duplication under the roles
  // is deliberate: a recruiter who reads only the top block still sees them.
  it('accepts three role-naming achievement bullets in the Summary', () => {
    const r = validateCv(GOOD, { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(true);
    expect(codes(r)).not.toContain('summaryNoAchievements');
    expect(codes(r)).not.toContain('summaryAchievementNoRole');
    expect(codes(r)).not.toContain('summaryTooManyAchievements');
  });

  it('warns when the Summary carries no achievements at all', () => {
    const doc = GOOD.split('\n').filter((l) => !l.startsWith('- As ')).join('\n');
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('summaryNoAchievements');
  });

  it('warns when the Summary lists more than three achievements', () => {
    const doc = GOOD.replace(
      '- As Delivery Manager at Borealis, introduced CI pipelines using Jenkins',
      '- As Delivery Manager at Borealis, introduced CI pipelines using Jenkins\n- As Head of Delivery at Acme Ltd, ran a delivery org of 25 engineers'
    );
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('summaryTooManyAchievements');
    expect(paramsFor(r, 'summaryTooManyAchievements').count).toBe(4);
  });

  it('warns when a Summary achievement names no role or employer', () => {
    const doc = GOOD.replace(
      '- As Head of Delivery at Acme Ltd, ran a delivery org of 25 engineers',
      '- Ran a delivery org of 25 engineers'
    );
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('summaryAchievementNoRole');
    expect(paramsFor(r, 'summaryAchievementNoRole').count).toBe(1);
  });

  it('warns when the impact zone runs past 120 words', () => {
    const filler = ' padding words that push the impact zone well past its ceiling'.repeat(12);
    const doc = GOOD.replace('Works close to the code and the customer.', `Works close to the code.${filler}`);
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('impactZoneWords');
    expect(paramsFor(r, 'impactZoneWords').count).toBeGreaterThan(120);
  });

  // The repeat is deliberate; repeating the SENTENCE is not. This pair is taken
  // from a shipped CV, where the Summary copied the role bullet word for word.
  it('warns when a Summary achievement copies its role bullet verbatim', () => {
    const r = validateCv(GOOD, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('summaryVerbatimCopy');
    expect(paramsFor(r, 'summaryVerbatimCopy').count).toBe(1);
  });

  it('stays silent when the Summary re-angles the same achievement', () => {
    const doc = GOOD.replace(
      '- As Head of Delivery at Acme Ltd, cut release cycle from 42 days to 9 days',
      '- Took Acme Ltd from 42-day releases to 9, as Head of Delivery'
    );
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).not.toContain('summaryVerbatimCopy');
  });

  // The zone is what the recruiter reads first, and the name block plus headline
  // sit above the Summary heading. Counting only the Summary section let a long
  // header spend the budget invisibly.
  it('counts the impact zone from the very top of the document, headline included', () => {
    const filler = ' padding words above the summary heading that spend the zone'.repeat(12);
    const doc = GOOD.replace('**Head of Delivery | Platform Teams**', `**Head of Delivery${filler}**`);
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('impactZoneWords');
    expect(paramsFor(r, 'impactZoneWords').count).toBeGreaterThan(120);
  });

  it('leaves the two most recent roles their five-bullet ceiling', () => {
    const bullet = '- Introduced continuous integration pipelines using Jenkins across every product team in the group during the platform migration\n';
    const doc = GOOD + bullet.repeat(2);
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).not.toContain('bulletCeiling');
    expect(r.hard.join(' ')).not.toContain('bullets; the ceiling');
  });

  it('warns about a date of birth the master never supplied', () => {
    const doc = GOOD + '\nDate of birth: 12/1981\n';
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('dobInvented');
  });

  it('reports unevidenced job requirements as gaps', () => {
    const analysis = { ...ANALYSIS, analysis: { ...ANALYSIS.analysis, ats_keywords_missing: ['Kubernetes', 'Terraform'] } };
    const r = validateCv(GOOD, { master: MASTER, analysis });
    expect(codes(r)).toContain('gaps');
    expect(paramsFor(r, 'gaps').list).toContain('Kubernetes');
  });

  it('warns when a Projects section appears with no qualifying override', () => {
    const analysis = {
      ...ANALYSIS,
      generation_framework: { cv_blueprint: { section_order: ['Summary', 'Work Experience', 'Projects'] } },
    };
    const doc = GOOD + '\n### **Projects**\n- Something\n';
    const r = validateCv(doc, { master: MASTER, analysis });
    expect(codes(r)).toContain('projectsNoOverride');
  });

  it('accepts a Projects section under a Career Pivot override', () => {
    const analysis = {
      analysis: { scenario_tags: ['Career Pivot'], ats_keywords_missing: [] },
      generation_framework: { cv_blueprint: { section_order: ['Summary', 'Work Experience', 'Projects'] } },
    };
    const doc = GOOD + '\n### **Projects**\n- Something\n';
    const r = validateCv(doc, { master: MASTER, analysis });
    expect(codes(r)).not.toContain('projectsNoOverride');
  });
});

// Check 10 is HARD because it is pure arithmetic: the override is active or it
// is not, and a stray graduation year undoes the whole mitigation.
describe('check 1b — certifications trace to the master (hard)', () => {
  const MASTER_WITH_CERT = JSON.stringify({
    ...JSON.parse(MASTER),
    profile: { ...JSON.parse(MASTER).profile, certifications: ['Certified Scrum Product Owner'] },
  });
  const withCerts = (entry) => `${GOOD}\n### **Certifications**\n- ${entry}\n`;
  const ANALYSIS_CERTS = {
    analysis: { scenario_tags: ['Standard Career Progression'], ats_keywords_missing: [] },
    generation_framework: { cv_blueprint: { section_order: ['Summary', 'Work Experience', 'Certifications'] } },
  };

  it('blocks a certification the master does not hold', () => {
    const r = validateCv(withCerts('AWS Certified Solutions Architect'), { master: MASTER_WITH_CERT, analysis: ANALYSIS_CERTS });
    expect(r.ok).toBe(false);
    expect(r.hard.join(' ')).toContain('AWS Certified Solutions Architect');
  });

  it('passes a certification the master holds', () => {
    const r = validateCv(withCerts('Certified Scrum Product Owner'), { master: MASTER_WITH_CERT, analysis: ANALYSIS_CERTS });
    expect(r.ok).toBe(true);
  });
});

// Red on the old code, which reported the ceiling as a warning and shipped the
// over-long role: a count with nothing to weigh belongs in the retry, not on a
// banner telling the candidate about the app's own failure.
describe('check 6 — bullet ceiling (hard)', () => {
  const bullet = '- Introduced continuous integration pipelines using Jenkins across every product team in the group during the platform migration\n';

  it('blocks a third-or-later role that exceeds its three-bullet ceiling', () => {
    const doc = `${GOOD}\n#### **Earlier Delivery Manager**\n**Borealis** | 01/2015 - 02/2019 | London, United Kingdom\n${bullet.repeat(4)}`;
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(false);
    expect(r.hard.some((h) => h.includes('Earlier Delivery Manager') && h.includes('4 bullets') && h.includes('ceiling for its position is 3'))).toBe(true);
    // It is a block now, so it must not ALSO be reported to the candidate.
    expect(codes(r)).not.toContain('bulletCeiling');
  });

  it('blocks a recent role that exceeds its five-bullet ceiling', () => {
    // GOOD's second role already carries one bullet, so five more makes six.
    const doc = GOOD + bullet.repeat(5);
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard.some((h) => h.includes('6 bullets') && h.includes('ceiling for its position is 5'))).toBe(true);
  });

  // The band is a count too, so it blocks on the same reasoning as the ceiling.
  // Red on the old code, which reported it and shipped the bullet.
  it('blocks a bullet under the word band', () => {
    const doc = `${GOOD}\n#### **Third Role**\n**Borealis** | 01/2015 - 02/2019 | London, United Kingdom\n- Shipped it\n`;
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(false);
    expect(r.hard.some((h) => h.includes('Third Role') && h.includes('2 words') && h.includes('15-25'))).toBe(true);
    expect(codes(r)).not.toContain('bulletBand');
  });

  it('blocks a bullet over the word band', () => {
    const long = `- ${'delivered '.repeat(30).trim()}\n`;
    const doc = `${GOOD}\n#### **Third Role**\n**Borealis** | 01/2015 - 02/2019 | London, United Kingdom\n${long}`;
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard.some((h) => h.includes('30 words') && h.includes('Cut it to length'))).toBe(true);
  });

  it('leaves a bullet inside the band alone', () => {
    const r = validateCv(GOOD, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard.join(' ')).not.toContain('the band for this document');
  });
});

describe('check 10 — Older Applicant (hard)', () => {
  const OLDER = {
    analysis: { scenario_tags: ['Older Applicant'], ats_keywords_missing: [] },
    generation_framework: { cv_blueprint: { section_order: ['Summary', 'Work Experience', 'Education'] } },
  };
  const withEducation = (entry) => `${GOOD}\n### **Education**\n${entry}\n`;

  it('blocks a graduation year while the override is active', () => {
    const r = validateCv(withEducation('**BSc Computing | Leeds University | 1994**'), { master: MASTER, analysis: OLDER });
    expect(r.ok).toBe(false);
    // Specifically check 10, not check 1 also objecting to an untraced number.
    expect(r.hard.some((h) => /Older Applicant override strips graduation years/.test(h) && h.includes('1994'))).toBe(true);
  });

  it('passes the same Education entry with the year stripped', () => {
    const r = validateCv(withEducation('**BSc Computing | Leeds University**'), { master: MASTER, analysis: OLDER });
    expect(r.ok).toBe(true);
  });

  // Without the override the year is legitimate, so check 10 must say nothing
  // about it. (Check 1 still blocks it as an untraceable number — that is a
  // different rule, and the assertion is deliberately about check 10 only.)
  it('leaves graduation years alone when the override is NOT active', () => {
    const r = validateCv(withEducation('**BSc Computing | Leeds University | 1994**'), { master: MASTER, analysis: ANALYSIS });
    expect(r.hard.join(' ')).not.toContain('Older Applicant');
  });

  // The gap this whole change exists to close: the override blocked graduation
  // years and career totals while a role two decades old printed in full, with
  // its dates and its bullets, so the age signal reached the page regardless.
  // Red on the old code — nothing checked the window at all.
  describe('the recency window', () => {
    // Ends 2002, against a most-recent role ending 2022: 20 years outside.
    const ancient = `${GOOD}\n#### **Junior Developer**\n**Northwind Systems** | 06/1998 - 04/2002 | Leeds, United Kingdom\n- Built internal reporting tools used across the finance and operations departments\n`;

    it('blocks a dated role that ended more than 15 years before the most recent one', () => {
      const r = validateCv(ancient, { master: MASTER, analysis: OLDER });
      expect(r.ok).toBe(false);
      expect(r.hard.some((h) => h.includes('Junior Developer') && h.includes('2002') && /Earlier Career/.test(h))).toBe(true);
    });

    it('leaves the same role alone when the override is NOT active', () => {
      const r = validateCv(ancient, { master: MASTER, analysis: ANALYSIS });
      expect(r.hard.join(' ')).not.toContain('more than 15 years before');
    });

    it('does not touch a role inside the window', () => {
      const r = validateCv(GOOD, { master: MASTER, analysis: OLDER });
      expect(r.hard.join(' ')).not.toContain('more than 15 years before');
    });

    // The Earlier Career section is exactly where an out-of-window role is
    // SUPPOSED to end up, so the check must never fire on it.
    it('exempts the Earlier Career section', () => {
      const collapsed = `${GOOD}\n#### **Earlier Career**\n- Junior Developer, Northwind Systems\n`;
      const r = validateCv(collapsed, { master: MASTER, analysis: OLDER });
      expect(r.hard.join(' ')).not.toContain('more than 15 years before');
    });
  });

  it('blocks a stated career total', () => {
    const r = validateCv(GOOD.replace('Delivery leader who rebuilt', 'Delivery leader with 20+ years who rebuilt'), { master: MASTER, analysis: OLDER });
    expect(r.ok).toBe(false);
    expect(r.hard.join(' ')).toMatch(/20\+?\s*years/);
  });

  it('blocks the prose forms of the same total', () => {
    for (const phrase of ['over two decades in banking', 'a decade of expertise', '25 years of experience']) {
      const r = validateCv(GOOD.replace('Delivery leader who rebuilt', `Delivery leader, ${phrase}, who rebuilt`), { master: MASTER, analysis: OLDER });
      expect(r.hard.join(' '), phrase).toMatch(/cumulative career total/);
    }
  });

  // The old catch-all regex matched any "N years" and hard-blocked this — a
  // duration scoped to one role, which is the depth the override exists to keep.
  it('allows a duration scoped to a single role', () => {
    for (const phrase of ['five years running the Acme delivery org', 'four years at Borealis']) {
      const doc = GOOD.replace('Works close to the code and the customer.', `Spent ${phrase}.`);
      const r = validateCv(doc, { master: MASTER, analysis: OLDER });
      expect(r.hard.join(' '), phrase).not.toMatch(/career total/);
    }
  });
});

// 13. A month the master does not record is never invented — the bare year
//     stands and the candidate is told which one is incomplete.
describe('check 13 — missing month', () => {
  const YEAR_ONLY_MASTER = JSON.stringify({
    work_experience: [
      { company: 'Acme Ltd', title: 'Head of Delivery', start_date: '2019', end_date: '2022', bullets: ['Cut release cycle from 42 days to 9 days'], fractional_engagements: [] },
    ],
  });
  const doc = `### **Summary**\nDelivery leader who rebuilt how Acme ships.\n\n- As Head of Delivery at Acme Ltd, cut release cycle from 42 days to 9 days\n\n### **Work Experience**\n\n#### **Head of Delivery**\n**Acme Ltd** | 2019 - 2022 | London, United Kingdom\n- Cut release cycle from 42 days to 9 days across four product teams and two platform squads\n`;

  it('permits the bare year when the master holds no month, and warns instead', () => {
    const r = validateCv(doc, { master: YEAR_ONLY_MASTER, analysis: ANALYSIS });
    expect(r.hard.join(' ')).not.toMatch(/MM\/YYYY/);
    expect(codes(r)).toContain('missingMonth');
    expect(paramsFor(r, 'missingMonth').list).toBe('2019, 2022');
  });

  it('still blocks a bare year the master DOES give a month for', () => {
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(false);
    expect(r.hard.join(' ')).toMatch(/without a month, but the master records a month/);
    expect(codes(r)).not.toContain('missingMonth');
  });
});

// The hole that let "Value Proposition Modeling" onto a shipped CV: the Skills
// section is the same shape of list as Certifications and was checked by nothing.
describe('check 14 — skills trace to the master (hard)', () => {
  const withSkills = (...skills) => `${GOOD}\n### **Skills**\n${skills.map((s) => `- ${s}`).join('\n')}\n`;

  it('blocks a skill the master does not evidence', () => {
    const r = validateCv(withSkills('Value Proposition Modeling'), { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(false);
    expect(r.hard.join(' ')).toContain('Value Proposition Modeling');
  });

  it('passes skills the master evidences', () => {
    const r = validateCv(withSkills('Delivery Management', 'Jenkins'), { master: MASTER, analysis: ANALYSIS });
    expect(r.hard.join(' ')).not.toContain('Skill "');
  });

  it('checks Core Competencies on the same basis', () => {
    const doc = `${GOOD}\n### **Core Competencies**\n- Quantum Cryptography Governance\n`;
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.hard.join(' ')).toContain('Quantum Cryptography Governance');
  });
});

describe('check 15 — skills evidenced only by work the CV does not show', () => {
  // Borealis is in the master but absent from this document, so a skill only
  // Borealis evidences is describing a career the reader cannot see.
  const RECENT_ONLY = GOOD.split('#### **Delivery Manager**')[0];

  // Layer 2 says the skill "is not listed at all", so listing it is the app
  // breaking its own rule. The candidate cannot act on it either — the role it
  // came from was collapsed by the recency window, which is the app's call.
  // Red on the old code, which reported it and shipped the stale skill.
  it('blocks a skill whose only evidence is a role the CV drops', () => {
    const doc = `${RECENT_ONLY}\n### **Skills**\n- Jenkins\n`;
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(false);
    expect(r.hard.some((h) => h.includes('Jenkins') && /no longer shows in full/.test(h))).toBe(true);
    expect(codes(r)).not.toContain('skillOutsideWindow');
  });

  it('stays silent when the skill is evidenced by a role the CV shows', () => {
    // Acme is the role this CV shows, and its record evidences both words.
    const doc = `${RECENT_ONLY}\n### **Skills**\n- Engineering Delivery\n`;
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).not.toContain('skillOutsideWindow');
  });
});

describe('check 16 — a printed role whose record holds no numbers', () => {
  const NO_METRICS = JSON.stringify({
    work_experience: [
      { company: 'Acme Ltd', title: 'Head of Delivery', start_date: '03/2019', end_date: '08/2022', bullets: ['Built the delivery organisation'], fractional_engagements: [] },
    ],
  });

  it('warns so the candidate can supply the real figures', () => {
    const doc = '### **Summary**\nDelivery leader.\n\n- As Head of Delivery at Acme Ltd, built the delivery organisation\n\n### **Work Experience**\n\n#### **Head of Delivery**\n**Acme Ltd** | 03/2019 - 08/2022 | London\n- Built the delivery organisation across four product teams and two platform squads\n';
    const r = validateCv(doc, { master: NO_METRICS, analysis: ANALYSIS });
    expect(codes(r)).toContain('noMetricsInRecord');
    expect(paramsFor(r, 'noMetricsInRecord').list).toBe('Head of Delivery');
  });

  // Acme's record holds numbers, Borealis's holds none — so exactly one role is
  // named, and a role with metrics is never reported.
  it('names only the roles whose record is bare', () => {
    const r = validateCv(GOOD, { master: MASTER, analysis: ANALYSIS });
    expect(paramsFor(r, 'noMetricsInRecord').list).toBe('Delivery Manager');
  });
});

describe('check 11 — Earlier Career names a real employer', () => {
  const earlier = (subtitle) => `${GOOD}\n#### **Earlier Career**\n**${subtitle}**\n`;

  it('warns when every employer is dissolved into a category', () => {
    const r = validateCv(earlier('Senior QA Engineer and UX Manager at financial institutions and tech companies'), { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('earlierCareerNoEmployer');
  });

  it('stays silent when the line names an employer from the master', () => {
    const r = validateCv(earlier('Senior QA Engineer and UX Manager — Borealis, Acme Ltd'), { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).not.toContain('earlierCareerNoEmployer');
  });

  // The section became a bulleted list, so the remaining three clauses of the
  // check all read the bullets rather than the subtitle.
  const bullets = (lines) =>
    `${GOOD}\n#### **Earlier Career**\n**Acme Ltd**\n${lines.map((l) => `- ${l}`).join('\n')}\n`;

  it('warns when the section prints more than six roles', () => {
    const seven = [
      'Delivery Manager, Acme Ltd',
      'QA Lead, Borealis',
      'QA Engineer, Corvus',
      'Analyst, Dunlin',
      'Tester, Egret',
      'Engineer, Falcon',
      'Junior Engineer, Grebe',
    ];
    const r = validateCv(bullets(seven), { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('earlierCareerTooManyBullets');
    expect(paramsFor(r, 'earlierCareerTooManyBullets')).toEqual({ count: 7, max: 6 });
  });

  it('accepts exactly six', () => {
    const six = [
      'Delivery Manager, Acme Ltd',
      'QA Lead, Borealis',
      'QA Engineer, Corvus',
      'Analyst, Dunlin',
      'Tester, Egret',
      'Engineer, Falcon',
    ];
    const r = validateCv(bullets(six), { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).not.toContain('earlierCareerTooManyBullets');
  });

  it('warns when a year survives into the undated section', () => {
    const r = validateCv(
      bullets(['Delivery Manager, Acme Ltd', 'QA Lead, Borealis (2003)']),
      { master: MASTER, analysis: ANALYSIS },
    );
    expect(codes(r)).toContain('earlierCareerDated');
    expect(paramsFor(r, 'earlierCareerDated').count).toBe(1);
  });

  it('stays silent when no bullet carries a year', () => {
    const r = validateCv(
      bullets(['Delivery Manager, Acme Ltd', 'QA Lead, Borealis']),
      { master: MASTER, analysis: ANALYSIS },
    );
    expect(codes(r)).not.toContain('earlierCareerDated');
  });

  // The real defect this came from: the extractor filled a missing location
  // from what it knew about the employer, so the CV printed a city the record
  // never held.
  it('warns when a bullet states a location the master does not record', () => {
    const r = validateCv(
      bullets(['Delivery Manager, Acme Ltd — San Francisco']),
      { master: MASTER, analysis: ANALYSIS },
    );
    expect(codes(r)).toContain('earlierCareerLocation');
    expect(paramsFor(r, 'earlierCareerLocation').location).toBe('San Francisco');
  });

  it('accepts a location the master does record', () => {
    const withLocation = JSON.stringify({
      profile: { name: 'Jane Roe' },
      work_experience: [
        { company: 'Acme Ltd', title: 'Head of Delivery', start_date: '03/2019', end_date: '08/2022', location: 'San Francisco, USA', bullets: [], fractional_engagements: [] },
      ],
    });
    const r = validateCv(
      bullets(['Delivery Manager, Acme Ltd — San Francisco']),
      { master: withLocation, analysis: ANALYSIS },
    );
    expect(codes(r)).not.toContain('earlierCareerLocation');
  });
});

describe('check 12 — identity epithets', () => {
  const epithetFault = (r) => r.hard.find((h) => /asserts an identity or trait/.test(h));

  it('blocks when the Summary opens on what the candidate IS', () => {
    const r = validateCv(GOOD.replace('Delivery leader who rebuilt', 'A veteran delivery leader who rebuilt'), { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(false);
    expect(epithetFault(r)).toContain('veteran');
    expect(codes(r)).not.toContain('identityEpithet');
  });

  it('blocks an epithet in the headline above the first section', () => {
    const r = validateCv(GOOD.replace('**Head of Delivery | Platform Teams**', '**Seasoned Head of Delivery**'), { master: MASTER, analysis: ANALYSIS });
    expect(epithetFault(r)).toContain('seasoned');
  });

  // The line that reached a delivered CV: a trait nobody can check, spent on
  // the first words a recruiter reads. The old noun-only list passed it.
  // Red on the old code.
  it('blocks a trait claim in the headline, not just a noun epithet', () => {
    const r = validateCv(GOOD.replace('**Head of Delivery | Platform Teams**', '**High-agency Senior Product Manager**'), { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(false);
    expect(epithetFault(r)).toContain('high-agency');
  });

  it('matches the trait however it is hyphenated', () => {
    const r = validateCv(GOOD.replace('**Head of Delivery | Platform Teams**', '**High agency Senior Product Manager**'), { master: MASTER, analysis: ANALYSIS });
    expect(epithetFault(r)).toBeTruthy();
  });

  // "results-driven" is on the banned-phrasing list, which repairs the span
  // rather than regenerating the page. One defect, one owner.
  it('leaves banned-phrase filler to the repair pass', () => {
    const r = validateCv(GOOD.replace('Delivery leader who rebuilt', 'A results-driven leader who rebuilt'), { master: MASTER, analysis: ANALYSIS });
    expect(epithetFault(r)).toBeUndefined();
  });

  it('stays silent on a fact-led opening', () => {
    const r = validateCv(GOOD, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).not.toContain('identityEpithet');
    expect(epithetFault(r)).toBeUndefined();
  });
});

describe('helpers', () => {
  it('splits the document into its ### sections', () => {
    const headings = splitSections(GOOD).map((s) => s.heading);
    expect(headings).toEqual(['Summary', 'Work Experience']);
  });

  it('feeds the exact failures back to the generator', () => {
    const note = validationFeedback(['Number "80" appears in the CV but not in the master record.']);
    expect(note).toContain('Number "80"');
    expect(note).toContain('WITHOUT inventing anything');
  });
});

describe('language', () => {
  // Czech and Polish carry the same content in fewer words, so an English band
  // would flag good bullets as too short.
  const shortBullet = '- Zavedl kontinuální integraci napříč všemi produktovými týmy skupiny a zkrátil dobu nasazení výrazně\n';
  const doc = `### **Pracovní zkušenosti**\n\n#### **Head of Delivery**\n**Acme Ltd** | 03/2019 - 08/2022 | Praha, Czech Republic\n${shortBullet}`;

  // The band blocks now, so the language question is which band the BLOCK
  // applied — a Czech bullet judged on English assumptions would fail a
  // perfectly good document rather than merely nag about it.
  const bandFault = (r) => r.hard.find((h) => h.includes('the band for this document'));

  it('uses the Czech bullet band, not the English one', () => {
    const en = validateCv(doc, { master: MASTER, analysis: ANALYSIS, language: 'en' });
    const cs = validateCv(doc, { master: MASTER, analysis: ANALYSIS, language: 'cs' });
    expect(bandFault(en)).toBeTruthy();
    expect(bandFault(cs)).toBeUndefined();
  });

  it('states the band it actually applied', () => {
    const cs = validateCv(doc.replace(shortBullet, '- Krátká\n'), { master: MASTER, analysis: ANALYSIS, language: 'cs' });
    expect(bandFault(cs)).toContain('12-22');
  });

  it('falls back to the default band for an unregistered language', () => {
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS, language: 'hu' });
    expect(bandFault(r)).toContain('15-25');
  });
});

describe('check 17 — banned phrasing', () => {
  const master = JSON.stringify({
    work_experience: [{ title: 'Head of Ops', company: 'Acme', start_date: '01/2019', end_date: '12/2024', bullets: ['Cut fulfilment cost 18%'], fractional_engagements: [] }],
  });

  it('finds every stock phrase, through markdown emphasis', () => {
    const doc = '### Summary\nA **results-driven** leader with a proven track record, passionate about seamless delivery.';
    const hits = bannedPhraseHits(doc, 'en');
    expect(hits).toContain('results-driven');
    expect(hits).toContain('proven track record');
    expect(hits).toContain('passionate about');
    expect(hits).toContain('seamless');
  });

  it('never blocks or warns — the caller repairs it instead', () => {
    const doc = '### Summary\nA results-driven leader.';
    const { ok, hard, warnings } = validateCv(doc, { master, language: 'en' });
    expect(ok).toBe(true);
    expect(hard.find((h) => /stock phrasing/i.test(h))).toBeUndefined();
    expect(warnings.find((w) => w.code === 'bannedPhrase')).toBeUndefined();
  });

  it('stays silent on specific, evidenced writing', () => {
    expect(bannedPhraseHits('Cut fulfilment cost 18% across three warehouses', 'en')).toEqual([]);
  });

  it('does not fire inside a longer word', () => {
    // "synergy" is banned; "Synergybank" as an employer name is not a hit.
    expect(bannedPhraseHits('Built the payments team at Synergybank.', 'en')).toEqual([]);
  });
});

describe('validateCoverLetter', () => {
  // Check 12 governs the CV only. In a letter these are ordinary persuasive
  // English: "As an experienced product leader, I…" opened the letter Nik judged
  // far better than this pipeline's output, and warning on it taught nothing.
  // The letter exists to persuade (CV_RULES.md, "What the cover letter IS").
  it('leaves an identity epithet in the letter alone — it is the CV that bans them', () => {
    const { warnings, ok } = validateCoverLetter('Dear Hiring Manager,\n\nA seasoned technology leader writes to you.');
    expect(warnings.find((x) => x.code === 'identityEpithet')).toBeFalsy();
    expect(ok).toBe(true);
  });

  it('still bans the same epithet on the CV', () => {
    const { hard } = validateCv('# Jane Roe\n**A seasoned technology leader**\n\n### Summary\nBuilt payments.');
    expect(hard.some((h) => /asserts an identity or trait/.test(h))).toBe(true);
  });

  it('passes a clean letter and never blocks', () => {
    const res = validateCoverLetter('Dear Hiring Manager,\n\nI cut fulfilment cost 18% at Acme across three warehouses.\n\nSincerely,');
    expect(res.ok).toBe(true);
    expect(res.hard).toEqual([]);
    expect(res.warnings).toEqual([]);
  });
});

describe('banned phrases are language-scoped', () => {
  // Hits come back AS THE DOCUMENT WROTE THEM, capitalisation and inflection
  // intact, because the repair pass replaces literal spans: handing back the
  // list's own lower-case citation form would replace nothing.
  it('finds Czech tells in a Czech document', () => {
    const hits = bannedPhraseHits('Proaktivní přístup a komplexní řešení, týmový hráč.', 'cs');
    expect(hits).toContain('Proaktivní přístup');
    expect(hits).toContain('komplexní řešení');
    expect(hits).toContain('týmový hráč');
  });

  it('does not judge a Czech document on English phrases', () => {
    expect(bannedPhraseHits('Snížil náklady o 18 % v Acme.', 'cs')).toEqual([]);
  });

  it('applies every registered language on auto', () => {
    const hits = bannedPhraseHits('Týmový hráč with a proven track record.', 'auto');
    expect(hits).toContain('Týmový hráč');
    expect(hits).toContain('proven track record');
  });

  it('checks an unregistered language against nothing', () => {
    expect(bannedPhraseHits('Ein ergebnisorientierter results-driven Leader.', 'de')).toEqual([]);
  });
});

// A real title can carry "|" as an internal separator ("Product Strategy & UX
// Leader | Custom AI Solutions | Coach"). plain() strips that character out of
// the printed heading, so comparing against the master's raw copy failed and the
// candidate's own job title was reported as a role they never held.
describe('check 3 — a multi-part job title is not an invented role', () => {
  const PIPED = JSON.stringify({
    work_experience: [
      { company: 'Nik Page Ltd.', title: 'Product Strategy & UX Leader | Custom AI Solutions | Coach', start_date: '08/2016', end_date: 'Present', bullets: ['Built AI tooling for clients'], fractional_engagements: [] },
    ],
  });
  const doc = '### **Summary**\nProduct leader.\n\n- As Product Strategy & UX Leader at Nik Page Ltd., built AI tooling\n\n### **Work Experience**\n\n#### **Product Strategy & UX Leader | Custom AI Solutions | Coach**\n**Nik Page Ltd.** | 08/2016 - Present | Prague\n- Built AI tooling for clients across enterprise and startup environments today\n';

  it('accepts the role instead of hard-failing it', () => {
    const r = validateCv(doc, { master: PIPED, analysis: ANALYSIS });
    expect(r.hard.join(' ')).not.toMatch(/matches no role/);
  });

  it('still hard-fails a title the master really does not hold', () => {
    const invented = doc.replace('Product Strategy & UX Leader | Custom AI Solutions | Coach', 'Chief Revenue Officer');
    const r = validateCv(invented, { master: PIPED, analysis: ANALYSIS });
    expect(r.hard.join(' ')).toMatch(/matches no role/);
  });
});

// A digit with letters on both sides belongs to a word — "B2B", "Web3", "S3" —
// and is not a claim about a quantity. Counting the 2 in "B2B SaaS" as an
// unsourced metric hard-failed a real CV over a product category, and a hard
// failure buys a full regeneration.
describe('check 1 — a digit inside a word is not a number claim', () => {
  const M = JSON.stringify({
    work_experience: [
      { company: 'wflow.com', title: 'Head of Product', start_date: '01/2022', end_date: '10/2022', bullets: ['Built market intelligence methods'], fractional_engagements: [] },
    ],
  });
  const doc = (bullet) => `### **Summary**\nProduct leader.\n\n- As Head of Product at wflow.com, built market intelligence methods\n\n### **Work Experience**\n\n#### **Head of Product**\n**wflow.com** | 01/2022 - 10/2022 | Prague\n- ${bullet}\n`;

  it('does not fail on B2B', () => {
    const r = validateCv(doc('Formalised product management processes for B2B SaaS platforms and teams'), { master: M, analysis: ANALYSIS });
    expect(r.hard.join(' ')).not.toMatch(/Number "2"/);
  });

  it('still fails a real number the master does not hold', () => {
    const r = validateCv(doc('Formalised product management processes and cut churn by 40% across accounts'), { master: M, analysis: ANALYSIS });
    expect(r.hard.join(' ')).toMatch(/Number "40"/);
  });
});

// The consultant-speak added on 2026-08-19 from a real Sudolabs letter. Every
// phrase here was in a letter the candidate read and rejected; each is an
// abstraction standing where a fact belongs, or a stock hinge between two
// paragraphs. Red on the previous revision, where none of them was on the list
// and the checker returned no hits for this paragraph.
describe('check 17 — the consultant-speak seen in the Sudolabs letter', () => {
  const SEEN = [
    'In this capacity, I have built and deployed RAG-based search.',
    'My strength lies in understanding human motivation.',
    'My current work centers on building production AI tools.',
    'Across previous leadership roles, I have facilitated workshops.',
    'Moving at that pace requires closing the distance between discovery and delivery.',
    'I bring strategic positioning to every engagement.',
    'an industry often bogged down in internal politics',
    'how we might work together on Sudolabs client transformations',
    'I would be glad to schedule a brief virtual meeting.',
  ];

  it.each(SEEN)('catches %s', (sentence) => {
    expect(bannedPhraseHits(sentence, 'en').length).toBeGreaterThan(0);
  });

  it('does not fire on the real achievements from the same letter', () => {
    const real =
      'I built and deployed RAG-based semantic image search and an expert chatbot ' +
      'integrated with client CRMs, founded the internal UX practice at Česká ' +
      'spořitelna, and directed concurrent client software initiatives including eBay.';
    expect(bannedPhraseHits(real, 'en')).toEqual([]);
  });
});

// The Czech half of the same fix. The registry's rule is that Czech tells are
// their own set rather than the English list translated, so these are the
// phrases a Czech letter actually uses in those slots. Red on the previous
// revision. The final assertion is the one that matters most: the checker must
// not fire on ordinary Czech describing real work.
describe('check 17 — the same consultant-speak in Czech', () => {
  const SEEN_CS = [
    'V této pozici jsem vedl tým čtyř produktových manažerů.',
    'Mou silnou stránkou je porozumění lidské motivaci.',
    'V současné době se zaměřuji na vývoj produkčních AI nástrojů.',
    'V rámci předchozích rolí jsem vedl produktové workshopy.',
    'Rád bych si s vámi domluvil krátkou online schůzku.',
    'Těším se na osobní setkání.',
    'Přináším strategické směřování každému projektu.',
  ];

  it.each(SEEN_CS)('catches %s', (sentence) => {
    expect(bannedPhraseHits(sentence, 'cs').length).toBeGreaterThan(0);
  });

  it('does not fire on real Czech achievements', () => {
    const real =
      'V České spořitelně jsem založil interní UX praxi a vedl výzkum produktu ve ' +
      'wflow.com. Nasadil jsem sémantické vyhledávání obrázků postavené na RAG a ' +
      'chatbota napojeného na CRM klienta.';
    expect(bannedPhraseHits(real, 'cs')).toEqual([]);
  });

  it('applies both lists on auto, so a letter of unknown language is still checked', () => {
    expect(bannedPhraseHits('Mou silnou stránkou je porozumění.', 'auto').length).toBeGreaterThan(0);
    expect(bannedPhraseHits('In this capacity, I led the team.', 'auto').length).toBeGreaterThan(0);
  });
});

// THE POINT OF STEM MATCHING. The list was exact strings, so a Czech letter got
// round it by declining the noun — "mou silnou stránkou je" was caught and
// "mojí silnou stránkou zůstává" was not, which in an inflected language means
// the list caught roughly one form in six. Every case here is red on the exact-
// string matcher and green now.
describe('check 17 — inflection does not get round the list', () => {
  const CZECH_FORMS = [
    'Mou silnou stránkou je porozumění lidské motivaci.',
    'Mojí silnou stránkou zůstává porozumění lidské motivaci.',
    'Jeho silná stránka byla vždy porozumění motivaci.',
    'Silnými stránkami jsou porozumění a strategie.',
    'V současné době se zaměřuji na vývoj AI nástrojů.',
    'Dlouhodobě se zaměřuji na vývoj AI nástrojů.',
    'Rád bych si s vámi domluvil krátkou online schůzku.',
    'Nabízím krátkou online schůzku.',
    'Vedl jsem komplexní transformaci celého oddělení.',
  ];

  it.each(CZECH_FORMS)('catches %s', (sentence) => {
    expect(bannedPhraseHits(sentence, 'cs').length).toBeGreaterThan(0);
  });

  it('hands the repair pass the inflected span, not the citation form', () => {
    const hits = bannedPhraseHits('Mojí silnou stránkou zůstává empatie.', 'cs');
    // The repair replaces literal text. "silnou stránkou" is what is on the
    // page here; a hit reading "silná stránka" would replace nothing.
    expect(hits).toContain('silnou stránkou');
  });

  it('still refuses to fire inside an unrelated longer word', () => {
    // Shares a stem with "synergies" and is an employer's name.
    expect(bannedPhraseHits('Built the payments team at Synergybank.', 'en')).toEqual([]);
    // Shares a stem with "transformace" and is ordinary Czech about real work.
    expect(bannedPhraseHits('Pracoval jsem na transformátorech.', 'cs')).toEqual([]);
  });

  it('leaves real Czech achievements alone', () => {
    const real =
      'V České spořitelně jsem založil interní UX praxi a vedl výzkum produktu. ' +
      'Nasadil jsem sémantické vyhledávání obrázků a chatbota napojeného na CRM.';
    expect(bannedPhraseHits(real, 'cs')).toEqual([]);
  });
});
