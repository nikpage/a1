// __tests__/master-grounding.test.js
//
// Per-role deterministic grounding is the real SOT guard: a hard fact survives
// only if it appears in the source text of ITS OWN role's section. These pin the
// two cases the global-substring approach failed:
//   1. a location that exists in a DIFFERENT job's block does not ground Job X;
//   2. a title swapped to a word not in the role's block is removed.
// Plus: a true fact in its own block survives, a reformatted date survives, and
// a role whose employer is nowhere in the CV is pulled out. Nothing fabricated is
// kept; removed values are parked in needs_confirmation, not destroyed.
//
// Red before groundAtomicFactsPerRole existed (the invented location/title stood);
// green now.

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1';
  Math.random = () => 0;
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));

// Sacred prompt file — irrelevant to the deterministic grounding under test.
vi.mock('../prompts/master-cv.js', () => ({
  buildMasterCvPrompt: () => [{ role: 'user', content: 'build master' }],
  buildMasterVerifyPrompt: () => [{ role: 'user', content: 'verify master' }],
}));

import { verifyMaster } from '../utils/openai.js';

function geminiResp(content) {
  return {
    data: {
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      model: 'gemini-2.5-flash-lite',
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe('verifyMaster — per-role grounding', () => {
  test('grounds each fact against its own role block only', async () => {
    // Two real roles in the source. Note: "San Francisco" appears ONLY in the
    // Acme block; "Brno" and "Project Manager" appear ONLY in the Beta block.
    const source = [
      'Acme Corp - Product Lead, San Francisco. 2019-2021. Led the checkout redesign.',
      'Beta s.r.o. - Project Manager, Brno. March 2020 to 2022. Built reporting.',
    ].join('\n');

    const master = {
      experience: [
        // Fully true — must survive untouched.
        { company: 'Acme Corp', role: 'Product Lead', location: 'San Francisco', dates: '2019-2021', achievements: [] },
        // Real role, but: title swapped (Project->Product), location stolen from
        // Acme's block (San Francisco, not Brno), dates reformatted but true year.
        { company: 'Beta s.r.o.', role: 'Product Manager', location: 'San Francisco', dates: '2020', achievements: [] },
        // Employer appears nowhere in the CV — invented job.
        { company: 'Ghost Inc', role: 'CEO', location: '', dates: '', achievements: [] },
      ],
      voice_samples: [],
    };

    // AI verify pass returns no corrections — we are testing grounding alone.
    mockAxiosPost.mockResolvedValueOnce(geminiResp('{}'));

    const { master: out } = await verifyMaster(master, source);

    // Invented role gone; the two real employers remain, in order.
    expect(out.experience.map((r) => r.company)).toEqual(['Acme Corp', 'Beta s.r.o.']);

    const acme = out.experience.find((r) => r.company === 'Acme Corp');
    const beta = out.experience.find((r) => r.company === 'Beta s.r.o.');

    // Acme: every fact is in Acme's own block → untouched.
    expect(acme.role).toBe('Product Lead');
    expect(acme.location).toBe('San Francisco');
    expect(acme.dates).toBe('2019-2021');

    // Beta: title not in its block → blanked; location belongs to Acme's block,
    // not Beta's → blanked; the year 2020 IS in Beta's block → dates survive.
    expect(beta.role).toBe('');
    expect(beta.location).toBe('');
    expect(beta.dates).toBe('2020');

    // Nothing was destroyed silently — the removed values are parked for the user.
    const nc = out.needs_confirmation || [];
    expect(nc.some((e) => e.reason === 'company_not_in_source' && e.company === 'Ghost Inc')).toBe(true);
    expect(nc.some((e) => e.field === 'role' && e.value === 'Product Manager')).toBe(true);
    expect(nc.some((e) => e.field === 'location' && e.value === 'San Francisco' && e.role === 'Product Manager')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Regression: the block used to start AT the company name, so anything printed
// to its LEFT — the job title on the header line, the date range on the line
// above — fell into the PREVIOUS role's block and was blanked as ungrounded.
// On the most ordinary CV layouts that wiped every title and every date from
// the record. Red on the old boundaries, green on line-based ones.
// ---------------------------------------------------------------------------
describe('verifyMaster — grounding on ordinary CV layouts', () => {
  test('keeps titles printed before the employer and dates printed above it', async () => {
    const source = [
      '2019 - 2022',
      'Product Lead, Acme Corporation, Prague',
      'Led the checkout redesign.',
      '',
      '2015 - 2019',
      'Analyst, Beta Ltd, Brno',
      'Built reporting.',
    ].join('\n');

    const master = {
      experience: [
        { company: 'Acme Corporation', role: 'Product Lead', dates: '2019 - 2022', location: 'Prague', achievements: [] },
        { company: 'Beta Ltd', role: 'Analyst', dates: '2015 - 2019', location: 'Brno', achievements: [] },
      ],
      voice_samples: [],
    };

    mockAxiosPost.mockResolvedValueOnce(geminiResp('{}'));
    const { master: out } = await verifyMaster(master, source);

    expect(out.experience.map((r) => r.role)).toEqual(['Product Lead', 'Analyst']);
    expect(out.experience.map((r) => r.dates)).toEqual(['2019 - 2022', '2015 - 2019']);
    expect(out.experience.map((r) => r.location)).toEqual(['Prague', 'Brno']);
    expect(out.needs_confirmation || []).toEqual([]);
  });

  test('an employer name wrapped across two lines still anchors its role', async () => {
    const source = [
      'Senior Engineer, Northwind Trading',
      'Company, Prague',
      '2020 - 2024. Owned the deployment pipeline.',
    ].join('\n');

    const master = {
      experience: [
        { company: 'Northwind Trading Company', role: 'Senior Engineer', dates: '2020 - 2024', location: 'Prague', achievements: [] },
      ],
      voice_samples: [],
    };

    mockAxiosPost.mockResolvedValueOnce(geminiResp('{}'));
    const { master: out } = await verifyMaster(master, source);

    // The role survives — a line break inside the employer name is not evidence
    // that the job was invented.
    expect(out.experience).toHaveLength(1);
    expect(out.experience[0].role).toBe('Senior Engineer');
    expect(out.experience[0].dates).toBe('2020 - 2024');
  });

  test('the widened date window still does not reach into an earlier role', async () => {
    const source = [
      'Acme Corp - Product Lead, Prague',
      '2019 - 2021. Led the checkout redesign.',
      'More detail about the Acme years.',
      'Beta Ltd - Analyst, Brno',
      'Built reporting.',
    ].join('\n');

    const master = {
      experience: [
        { company: 'Acme Corp', role: 'Product Lead', dates: '2019 - 2021', location: 'Prague', achievements: [] },
        // Beta has no dates anywhere in its own block; 2019-2021 belongs to Acme
        // and sits three lines up, so it must NOT ground Beta.
        { company: 'Beta Ltd', role: 'Analyst', dates: '2019 - 2021', location: 'Brno', achievements: [] },
      ],
      voice_samples: [],
    };

    mockAxiosPost.mockResolvedValueOnce(geminiResp('{}'));
    const { master: out } = await verifyMaster(master, source);

    expect(out.experience[0].dates).toBe('2019 - 2021');
    expect(out.experience[1].dates).toBe('');
    expect((out.needs_confirmation || []).some((e) => e.field === 'dates' && e.company === 'Beta Ltd')).toBe(true);
  });
});
