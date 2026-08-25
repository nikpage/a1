import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { formatDate, dateRange, buildSkeleton, skeletonBlock, skeletonSlots, renderWorkExperience } from './cv-skeleton.js';

const master = JSON.parse(readFileSync(new URL('../scripts/fixtures/golden/master.json', import.meta.url), 'utf8'));
const NOW = new Date('2026-08-25T00:00:00Z');

describe('formatDate', () => {
  it('normalises a month-and-year to MM/YYYY', () => {
    expect(formatDate('August 2016')).toBe('08/2016');
    expect(formatDate('January 2026')).toBe('01/2026');
  });

  it('keeps a bare year bare — inventing a month would change the date', () => {
    expect(formatDate('1997')).toBe('1997');
  });

  it('passes Present through', () => {
    expect(formatDate('Present')).toBe('Present');
  });

  it('leaves an unrecognised value alone rather than guessing', () => {
    expect(formatDate('Summer 2016')).toBe('Summer 2016');
  });

  it('renders an open-ended range as Present', () => {
    expect(dateRange('August 2016', '')).toBe('08/2016 - Present');
  });
});

describe('buildSkeleton over the real record', () => {
  const skel = buildSkeleton(master, { now: NOW });

  it('keeps every role that ended inside the fifteen-year window, dated', () => {
    const names = skel.recent.map((r) => r.company);
    expect(names).toContain('Nik Page Ltd.');
    expect(names).toContain('Faculty of Arts, Charles University');
    expect(names).toContain('Česká spořitelna');
    expect(names).toContain('ČSOB');
    // Airbank ended 03/2011, more than fifteen years before 25/08/2026: the
    // window is measured as a date, so it falls to Earlier Career rather than
    // riding in on a bare-year comparison that was really sixteen years deep.
    expect(names).not.toContain('Airbank');
  });

  it('collapses everything older into Earlier Career', () => {
    expect(skel.recent.map((r) => r.company)).not.toContain('AVG');
    expect(skel.earlier.length).toBeGreaterThan(0);
  });

  it('caps Earlier Career at six, because the section is a name list not a history', () => {
    // CV_RULES.md Layer 1: a longer list drags the reader backwards through the
    // career the recency window exists to close.
    expect(skel.earlier.length).toBeLessThanOrEqual(6);
  });

  it('prints the analysis roster, in its order, not the most recent six', () => {
    // The roster is how Morgan Stanley and Wells Fargo survive a finance
    // application; recency alone printed three unknown employers instead.
    const withRoster = buildSkeleton(master, {
      now: NOW,
      roster: ['Systems Engineer, Morgan Stanley Online', 'QA Manager, Wells Fargo'],
    });
    expect(withRoster.earlier.map((e) => e.company)).toEqual(['Morgan Stanley Online', 'Wells Fargo']);
  });

  it('carries title, employer and location — no dates', () => {
    for (const e of skel.earlier) expect(Object.keys(e).sort()).toEqual(['company', 'location', 'title']);
  });

  it('keeps the client engagements nested under the practice, never promoted', () => {
    const practice = skel.recent.find((r) => r.company === 'Nik Page Ltd.');
    const clients = practice.engagements.map((e) => e.company);
    expect(clients).toEqual([
      'SpecialAgents',
      'Salsita Software',
      'wflow.com',
      'Blockchain4Humanity',
      'Aerum Blockchain Official',
      'BLOCKS',
    ]);
    // and none of them is a top-level role
    for (const c of clients) expect(skel.recent.map((r) => r.company)).not.toContain(c);
  });

  it('dates every entry MM/YYYY', () => {
    for (const r of skel.recent) {
      expect(r.dates).toMatch(/^(\d{2}\/\d{4}|\d{4}) - (\d{2}\/\d{4}|\d{4}|Present)$/);
      for (const e of r.engagements) {
        expect(e.dates).toMatch(/^(\d{2}\/\d{4}|\d{4}) - (\d{2}\/\d{4}|\d{4}|Present)$/);
      }
    }
  });
});

describe('skeletonBlock', () => {
  const block = skeletonBlock(buildSkeleton(master, { now: NOW }));

  it('prints each engagement as a sub-entry with its own employer and dates', () => {
    expect(block).toContain('##### **Head of Product & Delivery** · SpecialAgents | 01/2026 - Present');
    expect(block).toContain('##### **Sr. Product & Account Manager** · Salsita Software | 11/2022 - 10/2023');
  });

  it('prints Earlier Career as undated "Title, Employer" lines', () => {
    expect(block).toContain('#### **Earlier Career**');
    const earlier = block.slice(block.indexOf('#### **Earlier Career**'));
    // Every bullet names a title AND an employer, and none carries a date.
    const bullets = earlier.split('\n').filter((l) => l.startsWith('- '));
    expect(bullets.length).toBeGreaterThan(0);
    for (const b of bullets) expect(b).toMatch(/^- .+, .+/);
    expect(earlier).not.toMatch(/\d{2}\/\d{4}/);
  });

  it('never emits a client as a top-level role', () => {
    // line-anchored: "##### " legitimately contains "#### " as a substring
    const topLevel = block.split('\n').filter((l) => /^#### \*\*/.test(l));
    expect(topLevel).not.toContain('#### **Sr. Product & Account Manager**');
    expect(topLevel).toContain('#### **Product Strategy & UX Leader | Custom AI Solutions | Educator, Mentor, Coach**');
  });

  it('returns nothing for a record with no roles', () => {
    expect(skeletonBlock(buildSkeleton({}, { now: NOW }))).toBe('');
  });
});

describe('renderWorkExperience — the section assembled in code', () => {
  const skel = buildSkeleton(master, { now: NOW });
  const slots = skeletonSlots(skel);

  it('lists every entry the writer must fill, parents and engagements alike', () => {
    const keys = slots.map((s) => s.key);
    expect(keys).toContain('Nik Page Ltd. | 08/2016 - Present');
    expect(keys).toContain('SpecialAgents | 01/2026 - Present');
    expect(keys).toContain('Salsita Software | 11/2022 - 10/2023');
    expect(keys).not.toContain('AVG | 03/2010 - 12/2010');
  });

  it('puts the writer bullets under the slot they belong to, engagements nested', () => {
    const doc = renderWorkExperience(skel, {
      'Nik Page Ltd. | 08/2016 - Present': ['Ran the practice.'],
      'SpecialAgents | 01/2026 - Present': ['Built RAG search.', 'Shipped a CRM chatbot.'],
    });
    expect(doc).toContain('#### **Product Strategy & UX Leader | Custom AI Solutions | Educator, Mentor, Coach**');
    expect(doc).toContain('**Nik Page Ltd.** | 08/2016 - Present | Prague, CZ');
    expect(doc).toContain('- Ran the practice.');
    expect(doc).toContain('##### **Head of Product & Delivery** · SpecialAgents | 01/2026 - Present');
    expect(doc).toContain('- Built RAG search.');
  });

  it('cannot dissolve an engagement into its parent, whatever the writer returns', () => {
    // the writer tries to put the client inside the parent's bullet, as both
    // real runs on 2026-08-25 did
    const doc = renderWorkExperience(skel, {
      'Nik Page Ltd. | 08/2016 - Present': ['**SpecialAgents:** delivered AI agents.'],
    });
    const topLevel = doc.split('\n').filter((l) => /^#### \*\*/.test(l));
    const subs = doc.split('\n').filter((l) => /^##### \*\*/.test(l));
    // the engagement's own heading is emitted regardless
    expect(subs.some((l) => l.includes('SpecialAgents | 01/2026 - Present'))).toBe(true);
    // and it never becomes a top-level job
    expect(topLevel.some((l) => l.includes('Head of Product & Delivery'))).toBe(false);
  });

  it('prints a heading for a slot the writer gave no bullets', () => {
    const doc = renderWorkExperience(skel, {});
    expect(doc).toContain('**ČSOB** | 08/2011 - 10/2011 | Prague, CZ');
    expect(doc).toContain('#### **Earlier Career**');
  });

  it('never dates an Earlier Career entry, whatever is passed in', () => {
    const doc = renderWorkExperience(skel, { 'AVG | 03/2010 - 12/2010': ['ignored'] });
    const earlier = doc.slice(doc.indexOf('#### **Earlier Career**'));
    expect(earlier).not.toMatch(/\d{2}\/\d{4}/);
    expect(earlier).not.toContain('ignored');
  });
});
