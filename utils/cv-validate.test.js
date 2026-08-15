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
- Ran a delivery organisation of 25 engineers through a full replatforming programme and rollout

#### **Delivery Manager**
**Borealis** | 01/2015 - 02/2019 | London, United Kingdom
- Introduced continuous integration pipelines using Jenkins across every product team in the group
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

  it('warns when a third-or-later role exceeds its three-bullet ceiling', () => {
    const bullet = '- Introduced continuous integration pipelines using Jenkins across every product team in the group\n';
    const doc = `${GOOD}\n#### **Earlier Delivery Manager**\n**Borealis** | 01/2015 - 02/2019 | London, United Kingdom\n${bullet.repeat(4)}`;
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('bulletCeiling');
    expect(paramsFor(r, 'bulletCeiling').ceiling).toBe(3);
  });

  it('leaves the two most recent roles their five-bullet ceiling', () => {
    const bullet = '- Introduced continuous integration pipelines using Jenkins across every product team in the group\n';
    const doc = GOOD + bullet.repeat(2);
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).not.toContain('bulletCeiling');
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

  it('warns about a skill whose only evidence is a role the CV drops', () => {
    const doc = `${RECENT_ONLY}\n### **Skills**\n- Jenkins\n`;
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('skillOutsideWindow');
    expect(paramsFor(r, 'skillOutsideWindow').list).toBe('Jenkins');
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
  it('warns when the Summary opens on what the candidate IS', () => {
    const r = validateCv(GOOD.replace('Delivery leader who rebuilt', 'A veteran delivery leader who rebuilt'), { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('identityEpithet');
    expect(paramsFor(r, 'identityEpithet').list).toContain('veteran');
  });

  it('catches an epithet in the headline above the first section', () => {
    const r = validateCv(GOOD.replace('**Head of Delivery | Platform Teams**', '**Seasoned Head of Delivery**'), { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).toContain('identityEpithet');
  });

  it('stays silent on a fact-led opening', () => {
    const r = validateCv(GOOD, { master: MASTER, analysis: ANALYSIS });
    expect(codes(r)).not.toContain('identityEpithet');
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

  it('uses the Czech bullet band, not the English one', () => {
    const en = validateCv(doc, { master: MASTER, analysis: ANALYSIS, language: 'en' });
    const cs = validateCv(doc, { master: MASTER, analysis: ANALYSIS, language: 'cs' });
    expect(en.warnings.map((w) => w.code)).toContain('bulletBand');
    expect(cs.warnings.map((w) => w.code)).not.toContain('bulletBand');
  });

  it('reports the band it actually applied', () => {
    const cs = validateCv(doc.replace(shortBullet, '- Krátká\n'), { master: MASTER, analysis: ANALYSIS, language: 'cs' });
    const band = cs.warnings.find((w) => w.code === 'bulletBand').params;
    expect([band.min, band.max]).toEqual([12, 22]);
  });

  it('falls back to the default band for an unregistered language', () => {
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS, language: 'hu' });
    expect(r.warnings.find((w) => w.code === 'bulletBand').params.min).toBe(15);
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
    const { warnings } = validateCv('# Jane Roe\n**A seasoned technology leader**\n\n### Summary\nBuilt payments.');
    expect(warnings.find((x) => x.code === 'identityEpithet')).toBeTruthy();
  });

  it('passes a clean letter and never blocks', () => {
    const res = validateCoverLetter('Dear Hiring Manager,\n\nI cut fulfilment cost 18% at Acme across three warehouses.\n\nSincerely,');
    expect(res.ok).toBe(true);
    expect(res.hard).toEqual([]);
    expect(res.warnings).toEqual([]);
  });
});

describe('banned phrases are language-scoped', () => {
  it('finds Czech tells in a Czech document', () => {
    const hits = bannedPhraseHits('Proaktivní přístup a komplexní řešení, týmový hráč.', 'cs');
    expect(hits).toContain('proaktivní přístup');
    expect(hits).toContain('komplexní řešení');
    expect(hits).toContain('týmový hráč');
  });

  it('does not judge a Czech document on English phrases', () => {
    expect(bannedPhraseHits('Snížil náklady o 18 % v Acme.', 'cs')).toEqual([]);
  });

  it('applies every registered language on auto', () => {
    const hits = bannedPhraseHits('Týmový hráč with a proven track record.', 'auto');
    expect(hits).toContain('týmový hráč');
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
