// __tests__/cv-assembled-generation.test.js
//
// The wiring: generateCV with a structured master must ASSEMBLE the document in
// code and never take its shape from the model. The model here returns slot
// content and nothing that looks like a CV — no headings, no employers, no
// dates — and the finished document must still carry all three, in the record's
// own order, with the client engagements nested under their parent.
//
// Red on the old code: generateCV had no assembled path, so the document was
// whatever the model returned — here, nothing.

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const mockAxiosPost = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));

import { generateCV } from '../utils/openai.js';
import { buildCvSlotsPrompt } from '../prompts/cv-generator.js';
import { buildSkeleton, skeletonSlots } from '../prompts/cv-skeleton.js';

const master = JSON.parse(readFileSync(new URL('../scripts/fixtures/golden/master.json', import.meta.url), 'utf8'));
const analysis = { analysis: { scenario_tags: [] }, job_text: 'We need a product lead for AI discovery work.' };

// A document the old freeform path would produce. Answering the WRITE calls by
// what the prompt asks for, rather than by call order, keeps the mock honest
// when the pipeline adds or drops a call.
const DOC = '# Nik Page\n\n### **Summary**\nRan product discovery for banks.\n\n---\n\n### **Work Experience**\n\n#### **Role**\n**Acme** | 01/2020 - Present\n- Did the thing\n';

function resp(content) {
  return { data: { choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 20 }, model: 'gemini-3.6-flash' } };
}

function slotContent() {
  const bullets = {};
  for (const s of skeletonSlots(buildSkeleton(master))) bullets[s.key] = [`Delivered discovery work at ${s.company}`];
  return JSON.stringify({
    language: 'en',
    headline: 'Product Leader | Discovery, AI Delivery',
    highlights: 'Ran product discovery for banks and B2B platforms.',
    skills: ['Product Discovery', 'AI Discovery'],
    bullets,
    speaking: [], publications: [], recognition: ['Google Developer Expert: Product & UX'],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // First call is the writer; every later call is a checker, which is told
  // there is nothing to correct.
  mockAxiosPost.mockImplementation((_url, body) => (
    JSON.stringify(body).includes('Return ONE JSON object')
      ? Promise.resolve(resp(slotContent()))
      : Promise.resolve(resp('{"corrections": []}'))
  ));
});

describe('generateCV — assembled path', () => {
  test('writes the structure itself when the model returned none of it', async () => {
    const res = await generateCV({ cv: JSON.stringify(master), master, analysis, tone: 'Formal', language: 'en' });
    const skeleton = buildSkeleton(master);
    const parent = skeleton.recent.find((r) => r.engagements.length);

    expect(res.content).toContain('### **Work Experience**');
    expect(res.content).toContain(`**${parent.company}** | ${parent.dates}`);
    for (const e of parent.engagements) {
      expect(res.content).toContain(`##### **${e.title}** · ${e.company} | ${e.dates}`);
    }
    // The contact line the master carries under profile.contact.
    expect(res.content).toContain(master.profile.contact.email);
  });

  test('asks the model for JSON, never for a document', async () => {
    await generateCV({ cv: JSON.stringify(master), master, analysis, tone: 'Formal', language: 'en' });
    const sent = JSON.stringify(mockAxiosPost.mock.calls[0][1]);
    expect(sent).toContain('Return ONE JSON object');
    expect(sent).not.toContain('Output in Markdown with this exact structure');
  });

  test('falls back to the document prompt when the JSON will not parse', async () => {
    mockAxiosPost.mockReset();
    mockAxiosPost.mockImplementation((_url, body) => {
      const sent = JSON.stringify(body);
      if (sent.includes('Return ONE JSON object')) return Promise.resolve(resp('sorry, here is a CV instead'));
      if (sent.includes('Output in Markdown')) return Promise.resolve(resp(DOC));
      return Promise.resolve(resp('{"corrections": []}'));
    });
    const res = await generateCV({ cv: JSON.stringify(master), master, analysis, tone: 'Formal', language: 'en' });
    expect(res.content).toContain('Acme');
    // Both the failed slot call and the fallback's calls are billed.
    expect(res.gemini_usages.length).toBeGreaterThan(2);
  });

  test('keeps the draft when the retry answers with no bullets at all', async () => {
    // Red on the old code: an empty answer assembles into headings with nothing
    // under them, which trips FEWER hard checks than a full CV — so the emptier
    // document won the comparison and shipped.
    mockAxiosPost.mockReset();
    let writes = 0;
    mockAxiosPost.mockImplementation((_url, body) => {
      if (!JSON.stringify(body).includes('Return ONE JSON object')) return Promise.resolve(resp('{"corrections": []}'));
      writes += 1;
      if (writes === 1) {
        // A number the master does not carry — check 1 is a hard block, so this
        // draft is what triggers the retry.
        const draft = JSON.parse(slotContent());
        const firstKey = Object.keys(draft.bullets)[0];
        draft.bullets[firstKey] = ['Grew revenue by 4321% in six months'];
        return Promise.resolve(resp(JSON.stringify(draft)));
      }
      return Promise.resolve(resp('{"language":"en","headline":"","highlights":"","skills":[],"bullets":{},"speaking":[],"publications":[],"recognition":[]}'));
    });

    const res = await generateCV({ cv: JSON.stringify(master), master, analysis, tone: 'Formal', language: 'en' });
    expect(writes).toBe(2);
    expect(res.content).toContain('Delivered discovery work at');
    expect(res.content).toContain('### **Highlights**');
  });

  test('uses the document path when there is no structured master', async () => {
    mockAxiosPost.mockReset();
    mockAxiosPost.mockImplementation((_url, body) => (
      JSON.stringify(body).includes('Output in Markdown')
        ? Promise.resolve(resp(DOC))
        : Promise.resolve(resp('{"corrections": []}'))
    ));
    const res = await generateCV({ cv: 'plain prose record', master: null, analysis, tone: 'Formal', language: 'en' });
    const sent = JSON.stringify(mockAxiosPost.mock.calls[0][1]);
    expect(sent).not.toContain('Return ONE JSON object');
    expect(res.content).toContain('Acme');
  });
});

describe('buildCvSlotsPrompt', () => {
  const slots = skeletonSlots(buildSkeleton(master));
  const messages = buildCvSlotsPrompt(JSON.stringify(master), analysis, 'Formal', 'lead with the AI work', '', 'en', new Date('2026-08-25'), slots);
  const text = JSON.stringify(messages);

  test('lists every slot key the assembler will ask for', () => {
    for (const s of slots) expect(text).toContain(s.key);
  });

  test('carries the raw ad, not only the extraction', () => {
    expect(text).toContain('product lead for AI discovery');
  });

  test('carries the candidate steering', () => {
    expect(text).toContain('lead with the AI work');
  });

  test('shows no markdown document template', () => {
    expect(text).not.toContain('<center>');
    expect(text).not.toMatch(/### \\\*\\\*Work Experience\\\*\\\*/);
  });
});
