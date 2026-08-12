// utils/cv-validate.test.js
//
// Layer 6 is the last thing between a broken CV and the user, so every check
// here is exercised against a real document string through the real validator —
// no mocks, and each test is built so it fails if the check stops working.

import { describe, it, expect } from 'vitest';
import { validateCv, validationFeedback, splitSections } from './cv-validate.js';

// Warnings are { code, params } pairs so the UI can translate them; these
// helpers keep the assertions about WHICH warning fired, not about wording.
const codes = (r) => r.warnings.map((w) => w.code);
const paramsFor = (r, code) => r.warnings.find((w) => w.code === code)?.params || {};

const MASTER = JSON.stringify({
  identity: { name: 'Jane Roe' },
  experience: [
    {
      company: 'Acme Ltd',
      role: 'Head of Delivery',
      dates: '03/2019 - 08/2022',
      achievements: [
        { text: 'Cut release cycle from 42 days to 9 days across 4 product teams', metric: '9 days' },
        { text: 'Ran a delivery org of 25 engineers', metric: '25' },
      ],
    },
    {
      company: 'Borealis',
      role: 'Delivery Manager',
      dates: '01/2015 - 02/2019',
      achievements: [{ text: 'Introduced CI pipelines using Jenkins', metric: '' }],
    },
  ],
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
    certifications: ['Certified Scrum Product Owner'],
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
