import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { assembleCv, contactLine } from '../prompts/cv-assemble.js';
import { buildSkeleton, skeletonSlots, entryKey } from '../prompts/cv-skeleton.js';
import { standardHeadings } from '../prompts/cv-sections.js';

const master = JSON.parse(readFileSync(new URL('../scripts/fixtures/golden/master.json', import.meta.url), 'utf8'));
const NOW = new Date('2026-08-25T00:00:00Z');

// One bullet per slot, so every heading the skeleton produces is exercised.
function contentFor(skeleton, over = {}) {
  const bullets = {};
  for (const s of skeletonSlots(skeleton)) bullets[s.key] = [`did the work at ${s.company}`];
  return {
    headline: 'Product Leader | Discovery, B2B Platforms',
    highlights: 'Led end-to-end product discovery across banking and B2B platforms.',
    skills: ['Product Discovery', 'Solution Design'],
    bullets,
    speaking: ['Judge in Product Design: Product Design — Dev Challenge X, Kyiv, Ukraine, 2024'],
    publications: ['UX Strategy – It Is All About The Experience'],
    recognition: ['Google Developer Expert: Product & UX'],
    ...over,
  };
}

describe('assembleCv', () => {
  const skeleton = buildSkeleton(master, { now: NOW });

  it('prints the contact details the master stores under profile.contact', () => {
    // Red on the old code: the script read profile.phone / profile.email, which
    // the master does not carry, so every assembled CV shipped with no contact
    // line at all — unsendable.
    const cv = assembleCv(master, contentFor(skeleton), skeleton, { language: 'en' });
    expect(cv).toContain('+420 731 647 707');
    expect(cv).toContain('Me@Nik.Page');
    expect(cv).toContain('www.linkedin.com/in/nbpage');
  });

  it('reads a flat contact shape too, and never repeats a value', () => {
    expect(contactLine({ email: 'a@b.c', phone: '123' })).toBe('123 | a@b.c');
    expect(contactLine({ email: 'a@b.c', contact: { email: 'a@b.c' } })).toBe('a@b.c');
  });

  it('keeps every engagement nested under its parent, with its own dates', () => {
    const cv = assembleCv(master, contentFor(skeleton), skeleton, { language: 'en' });
    const parent = skeleton.recent.find((r) => r.engagements.length);
    expect(parent).toBeTruthy();
    for (const e of parent.engagements) {
      expect(cv).toContain(`##### **${e.title}** · ${e.company} | ${e.dates}`);
    }
  });

  it('prints the analysis roster and states how much was left out', () => {
    // Speaking is the analysis's pick, by subject — the writer given a free
    // choice reached for the record's most recent talks instead.
    const pick = master.speaking_and_lecturing[3];
    const roster = [`${pick.topic} — ${pick.event}`];
    const cv = assembleCv(master, contentFor(skeleton), skeleton, { language: 'en', roster });
    expect(cv).toContain(pick.topic);
    expect(cv).toContain(`and ${master.speaking_and_lecturing.length - 1} others`);
  });

  it('prints no Speaking section when the analysis picked nothing', () => {
    const cv = assembleCv(master, contentFor(skeleton), skeleton, { language: 'en', roster: [] });
    expect(cv).not.toContain('Speaking');
  });

  it('prints every education entry under one heading', () => {
    const two = { ...master, education: [...master.education, { institution: 'VŠE', qualification: 'MBA', dates: '2001 - 2003' }] };
    const cv = assembleCv(two, contentFor(skeleton), skeleton, { language: 'en' });
    expect(cv.match(/### \*\*Education\*\*/g)).toHaveLength(1);
    expect(cv).toContain('Heald College');
    expect(cv).toContain('VŠE');
  });

  it('strips graduation years from every education entry under the Older Applicant override', () => {
    const cv = assembleCv(master, contentFor(skeleton), skeleton, { language: 'en', olderApplicant: true });
    expect(cv).not.toContain('1992');
    expect(cv).toContain('Heald College');
  });

  it('uses only headings the section registry accepts', () => {
    const cv = assembleCv(master, contentFor(skeleton), skeleton, { language: 'en' });
    const accepted = standardHeadings();
    const used = [...cv.matchAll(/^### \*\*(.+?)\*\*$/gm)].map((m) => m[1].toLowerCase());
    expect(used.length).toBeGreaterThan(4);
    for (const h of used) expect(accepted.has(h)).toBe(true);
  });

  it('writes Czech headings for a Czech CV', () => {
    const cv = assembleCv(master, contentFor(skeleton), skeleton, { language: 'cs' });
    expect(cv).toContain('### **Pracovní zkušenosti**');
    expect(cv).toContain('### **Vzdělání**');
    expect(cv).not.toContain('### **Highlights**');
  });

  it('omits a section there is nothing for', () => {
    const cv = assembleCv(master, contentFor(skeleton, { recognition: [] }), skeleton, { language: 'en', roster: [] });
    expect(cv).not.toContain('Publications');
    expect(cv).not.toContain('Speaking');
    expect(cv).not.toContain('Recognition');
  });

  it('prints a slot heading even when the model sent no bullets for it', () => {
    const content = contentFor(skeleton);
    const slot = skeletonSlots(skeleton)[1];
    delete content.bullets[slot.key];
    const cv = assembleCv(master, content, skeleton, { language: 'en' });
    expect(cv).toContain(slot.company);
    expect(entryKey(slot.company, slot.dates)).toBe(slot.key);
  });
});

// ── the bullet ceiling, enforced rather than requested ───────────────────────
//
// Red on the old code: the renderer printed whatever the writer returned, and
// on 2026-08-25 it returned 14 bullets for a role whose ceiling is 5.
describe('the bullet ceiling', () => {
  const skeleton = buildSkeleton(master, { now: NOW });

  it('drops the surplus past the ceiling instead of shipping it', () => {
    const bullets = {};
    for (const s of skeletonSlots(skeleton)) {
      bullets[s.key] = Array.from({ length: 14 }, (_, i) => `bullet number ${i + 1}`);
    }
    const cv = assembleCv(master, contentFor(skeleton, { bullets }), skeleton, { language: 'en' });
    const work = cv.slice(cv.indexOf('### **Work Experience**'));
    // The first two roles keep five, the rest three — Layer 6 check 6.
    const blocks = work.split(/^#### /m).slice(1);
    blocks.slice(0, 2).forEach((b) => {
      const own = b.split(/^##### /m)[0];
      expect(own.split('\n').filter((l) => l.startsWith('- ')).length).toBeLessThanOrEqual(5);
    });
    expect(work).not.toContain('bullet number 6\n');
  });

  it('tells the writer each slot ceiling, so the drop is a backstop not a surprise', () => {
    for (const s of skeletonSlots(skeleton)) expect(s.max).toBeGreaterThan(0);
  });
});
