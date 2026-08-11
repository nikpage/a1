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

describe('warnings (checks 5-9)', () => {
  it('warns when the Summary carries fewer than three achievement bullets', () => {
    const doc = GOOD.replace('- As Delivery Manager at Borealis, introduced CI pipelines using Jenkins\n', '');
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(true);
    expect(codes(r)).toContain('impactZoneBullets');
    expect(paramsFor(r, 'impactZoneBullets').count).toBe(2);
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
