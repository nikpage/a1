// __tests__/master-verify-fabrication.test.js
//
// The master build runs on the cheap flash-lite pool and sometimes invents
// content. The verify pass used to police only skills + metrics, so a wholly
// fabricated achievement, a fabricated role, or an invented transferable_note
// sailed straight into the persisted master. These pin the extended verifier:
// when the AI fact-checker flags an invented achievement/role/note, the master
// has it deterministically removed; genuine, source-backed content survives.
//
// Red on the old code (applyVerifyCorrections only handled unsupported_skills /
// unsupported_metrics, so the fabrications were kept); green on the new
// achievement/role/note dropping.

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1';
  Math.random = () => 0;
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));

// Sacred prompt file — irrelevant to the deterministic apply logic under test.
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

describe('verifyMaster — drops fabricated content the fact-checker flags', () => {
  test('removes invented achievement, role and transferable_note; keeps the real ones', async () => {
    const master = {
      experience: [
        {
          company: 'Acme',
          role: 'PM',
          achievements: [
            { text: 'Led the checkout redesign', metric: '', skills_utilized: ['product'] },
            { text: 'Built a teleporter', metric: '', skills_utilized: ['teleportation'] },
          ],
        },
        { company: 'Ghost Corp', role: 'CEO', achievements: [] },
        // Real role, but source gave it no location and an invented one was filled in.
        { company: 'Beta', role: 'Engineer', location: 'Tokyo', dates: '2015-2018', achievements: [] },
      ],
      transferable_notes: [
        { observation: 'Calm under pressure', evidence: 'volunteer firefighter', useful_for: [] },
        { observation: 'Fluent in Klingon', evidence: 'none', useful_for: [] },
      ],
      voice_samples: [],
    };

    // The fact-checker (mocked) flags exactly the invented items.
    mockAxiosPost.mockResolvedValueOnce(
      geminiResp(
        JSON.stringify({
          country: '',
          remove_gaps: [],
          unsupported_skills: ['teleportation'],
          unsupported_metrics: [],
          unsupported_achievements: ['Built a teleporter'],
          unsupported_roles: [{ company: 'Ghost Corp', role: 'CEO' }],
          unsupported_notes: ['Fluent in Klingon'],
          invented_locations: [{ company: 'Beta', role: 'Engineer' }],
          invented_dates: [{ company: 'Beta', role: 'Engineer' }],
        })
      )
    );

    // Source mentions Acme and Beta (real employers) but never Ghost Corp, Tokyo,
    // 2015-2018, the teleporter or Klingon — so grounding keeps Acme/Beta, drops
    // Ghost, and the AI net handles the invented prose/skills.
    const source = 'Jane Roe is a PM at Acme and led the checkout redesign. She was an Engineer at Beta. Volunteer firefighter.';
    const { master: out } = await verifyMaster(master, source);

    // Fabricated role gone; the two real roles remain (Acme + Beta).
    expect(out.experience.map((r) => r.company)).toEqual(['Acme', 'Beta']);
    // Beta is a REAL role, so it stays — but its invented location/dates are blanked, not guessed.
    const beta = out.experience.find((r) => r.company === 'Beta');
    expect(beta.location).toBe('');
    expect(beta.dates).toBe('');
    // Fabricated achievement gone; the source-backed one survives.
    expect(out.experience[0].achievements.map((a) => a.text)).toEqual(['Led the checkout redesign']);
    // Invented skill stripped from the surviving achievement.
    expect(out.experience[0].achievements[0].skills_utilized).toEqual(['product']);
    // Invented transferable_note gone; the evidenced one survives.
    expect(out.transferable_notes.map((n) => n.observation)).toEqual(['Calm under pressure']);
  });
});

// A job title the CV states but the extraction dropped. The record then shows a
// dash where the role should be, and every CV generated from it inherits the
// hole. The verify pass fills it from the source, verbatim — and only into an
// entry that is actually empty, so it can never overwrite an extracted title.
describe('verifyMaster — restores a dropped job title', () => {
  // The source names both titles; the extraction dropped them.
  const SOURCE = [
    'Head of Experience Design',
    'Ceska sporitelna | 07/2014 - 08/2016 | Prague, Czechia',
    'UX Team Founder',
    'Ceska sporitelna | 10/2012 - 07/2014 | Prague, Czechia',
    'Delivery Manager',
    'Acme Ltd | 01/2010 - 09/2012 | London, UK',
  ].join('\n');

  const MASTER = {
    identity: { name: 'Nik Page', country: 'Czechia' },
    experience: [
      { company: 'Ceska sporitelna', role: '', dates: '07/2014 - 08/2016', location: 'Prague, Czechia', achievements: [] },
      { company: 'Ceska sporitelna', role: '', dates: '10/2012 - 07/2014', location: 'Prague, Czechia', achievements: [] },
      { company: 'Acme Ltd', role: 'Delivery Manager', dates: '01/2010 - 09/2012', location: 'London, UK', achievements: [] },
    ],
    gaps: [],
    transferable_notes: [],
  };

  test('fills an empty title from the source, matching on company AND dates', async () => {
    mockAxiosPost.mockResolvedValue(geminiResp(JSON.stringify({
      country: '',
      remove_gaps: [],
      unsupported_skills: [],
      unsupported_metrics: [],
      unsupported_achievements: [],
      unsupported_roles: [],
      unsupported_notes: [],
      invented_locations: [],
      invented_dates: [],
      missing_titles: [
        { company: 'Ceska sporitelna', dates: '07/2014 - 08/2016', role: 'Head of Experience Design' },
        { company: 'Ceska sporitelna', dates: '10/2012 - 07/2014', role: 'UX Team Founder' },
      ],
    })));

    const { master: output } = await verifyMaster(structuredClone(MASTER), SOURCE);

    // Two entries at the same employer are told apart by their dates.
    expect(output.experience[0].role).toBe('Head of Experience Design');
    expect(output.experience[1].role).toBe('UX Team Founder');
  });

  test('never overwrites a title that was extracted', async () => {
    mockAxiosPost.mockResolvedValue(geminiResp(JSON.stringify({
      country: '', remove_gaps: [], unsupported_skills: [], unsupported_metrics: [],
      unsupported_achievements: [], unsupported_roles: [], unsupported_notes: [],
      invented_locations: [], invented_dates: [],
      missing_titles: [{ company: 'Acme Ltd', dates: '01/2010 - 09/2012', role: 'Something Else' }],
    })));

    const { master: output } = await verifyMaster(structuredClone(MASTER), SOURCE);

    expect(output.experience[2].role).toBe('Delivery Manager');
  });

  test('an empty title stays empty when the checker offers no replacement', async () => {
    mockAxiosPost.mockResolvedValue(geminiResp(JSON.stringify({
      country: '', remove_gaps: [], unsupported_skills: [], unsupported_metrics: [],
      unsupported_achievements: [], unsupported_roles: [], unsupported_notes: [],
      invented_locations: [], invented_dates: [], missing_titles: [],
    })));

    const { master: output } = await verifyMaster(structuredClone(MASTER), SOURCE);

    expect(output.experience[0].role).toBe('');
  });
});
