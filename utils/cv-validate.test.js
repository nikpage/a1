// utils/cv-validate.test.js
//
// Layer 6 is the last thing between a broken CV and the user, so every check
// here is exercised against a real document string through the real validator —
// no mocks, and each test is built so it fails if the check stops working.

import { describe, it, expect } from 'vitest';
import { validateCv, validationFeedback, splitSections } from './cv-validate.js';

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

  it('skips the section-name check when the blueprint gives no section_order', () => {
    const doc = GOOD.replace('### **Work Experience**', '### **Where I Made Waves**');
    const r = validateCv(doc, { master: MASTER, analysis: { analysis: { scenario_tags: [] } } });
    expect(r.hard.join(' ')).not.toContain('Where I Made Waves');
  });
});

describe('warnings (checks 5-9)', () => {
  it('warns when the Summary carries fewer than three achievement bullets', () => {
    const doc = GOOD.replace('- As Delivery Manager at Borealis, introduced CI pipelines using Jenkins\n', '');
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toContain('impact zone needs three');
  });

  it('warns when the impact zone runs past 120 words', () => {
    const filler = ' padding words that push the impact zone well past its ceiling'.repeat(12);
    const doc = GOOD.replace('Works close to the code and the customer.', `Works close to the code.${filler}`);
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.warnings.join(' ')).toMatch(/Impact zone runs to \d+ words/);
  });

  it('warns when a third-or-later role exceeds its three-bullet ceiling', () => {
    const bullet = '- Introduced continuous integration pipelines using Jenkins across every product team in the group\n';
    const doc = `${GOOD}\n#### **Earlier Delivery Manager**\n**Borealis** | 01/2015 - 02/2019 | London, United Kingdom\n${bullet.repeat(4)}`;
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.warnings.join(' ')).toContain('ceiling for this position is 3');
  });

  it('leaves the two most recent roles their five-bullet ceiling', () => {
    const bullet = '- Introduced continuous integration pipelines using Jenkins across every product team in the group\n';
    const doc = GOOD + bullet.repeat(2);
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.warnings.join(' ')).not.toContain('ceiling for this position is');
  });

  it('warns about a date of birth the master never supplied', () => {
    const doc = GOOD + '\nDate of birth: 12/1981\n';
    const r = validateCv(doc, { master: MASTER, analysis: ANALYSIS });
    expect(r.warnings.join(' ')).toContain('a date of birth');
  });

  it('reports unevidenced job requirements as gaps', () => {
    const analysis = { ...ANALYSIS, analysis: { ...ANALYSIS.analysis, ats_keywords_missing: ['Kubernetes', 'Terraform'] } };
    const r = validateCv(GOOD, { master: MASTER, analysis });
    expect(r.warnings.join(' ')).toContain('Kubernetes');
  });

  it('warns when a Projects section appears with no qualifying override', () => {
    const analysis = {
      ...ANALYSIS,
      generation_framework: { cv_blueprint: { section_order: ['Summary', 'Work Experience', 'Projects'] } },
    };
    const doc = GOOD + '\n### **Projects**\n- Something\n';
    const r = validateCv(doc, { master: MASTER, analysis });
    expect(r.warnings.join(' ')).toContain('Projects section is present without');
  });

  it('accepts a Projects section under a Career Pivot override', () => {
    const analysis = {
      analysis: { scenario_tags: ['Career Pivot'], ats_keywords_missing: [] },
      generation_framework: { cv_blueprint: { section_order: ['Summary', 'Work Experience', 'Projects'] } },
    };
    const doc = GOOD + '\n### **Projects**\n- Something\n';
    const r = validateCv(doc, { master: MASTER, analysis });
    expect(r.warnings.join(' ')).not.toContain('Projects section is present without');
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
