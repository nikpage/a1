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

  it('states how much of the speaking record was left out', () => {
    const cv = assembleCv(master, contentFor(skeleton), skeleton, { language: 'en' });
    expect(cv).toContain(`and ${master.speaking_and_lecturing.length - 1} others`);
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

  it('omits a section the model returned nothing for', () => {
    const cv = assembleCv(master, contentFor(skeleton, { publications: [], speaking: [] }), skeleton, { language: 'en' });
    expect(cv).not.toContain('Publications');
    expect(cv).not.toContain('Speaking');
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
