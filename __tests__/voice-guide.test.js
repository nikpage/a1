// __tests__/voice-guide.test.js
//
// `voice_guide` is the user's OWN cover-letter style guide: user-authored prose
// that no AI pass emits. Three things must hold or it silently disappears:
//   - the master editor cannot overwrite it (it is carried from the stored record);
//   - saveMasterCv carries it forward when the incoming record lacks it — the
//     case that matters is a fresh CV upload, whose rebuilt master has no guide;
//   - a record that DOES state one is written as given (an update must land),
//     including an explicit empty one — the user clearing it on purpose;
//   - the cover-letter prompt actually tells the model to follow it.

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { normaliseMaster } from '../utils/master-schema.js';
import { buildCoverPrompt } from '../prompts/cover-letter.js';
import { humanScannability } from '../prompts/cv-rules.js';

const GUIDE = 'Open on a concrete scene. Short declarative, then one longer sentence.';

describe('normaliseMaster', () => {
  test('carries voice_guide from the stored record, ignoring a submitted one', () => {
    const out = normaliseMaster(
      { experience: [], voice_guide: 'I am an injected style guide.' },
      { experience: [], voice_guide: GUIDE }
    );
    expect(out.voice_guide).toBe(GUIDE);
  });

  test('omits voice_guide entirely when the stored record has none', () => {
    const out = normaliseMaster({ experience: [], voice_guide: 'injected' }, { experience: [] });
    expect(out.voice_guide).toBeUndefined();
  });
});

describe('saveMasterCv', () => {
  let upserted;

  function mockSupabase(storedGuide) {
    upserted = null;
    return {
      from() {
        return {
          // getMasterCv read path
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [{ master_cv: storedGuide ? { voice_guide: storedGuide } : {} }],
                    error: null,
                  }),
              }),
            }),
          }),
          // saveMasterCv write path
          upsert: (rows) => {
            upserted = rows[0];
            return { select: () => Promise.resolve({ data: [{ user_id: rows[0].user_id }], error: null }) };
          },
        };
      },
    };
  }

  beforeEach(() => {
    vi.resetModules();
  });

  test('carries the stored voice_guide onto a rebuilt master that lacks one', async () => {
    const client = mockSupabase(GUIDE);
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => client }));
    const { saveMasterCv } = await import('../utils/database.js');

    await saveMasterCv('user-1', { candidate_core: 'Rebuilt from a new upload.' });

    expect(upserted.master_cv.voice_guide).toBe(GUIDE);
    expect(upserted.master_cv.candidate_core).toBe('Rebuilt from a new upload.');
  });

  test('writes a new voice_guide as given instead of resurrecting the old one', async () => {
    const client = mockSupabase(GUIDE);
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => client }));
    const { saveMasterCv } = await import('../utils/database.js');

    await saveMasterCv('user-1', { voice_guide: 'A replacement guide.' });

    expect(upserted.master_cv.voice_guide).toBe('A replacement guide.');
  });

  // The carry-forward keys off the KEY being absent, not the value being empty:
  // a record that states voice_guide: '' is the user deleting their guide on
  // purpose, and resurrecting the old prose would make the field unclearable.
  test('honours an explicit empty voice_guide as a deliberate clear', async () => {
    const client = mockSupabase(GUIDE);
    vi.doMock('@supabase/supabase-js', () => ({ createClient: () => client }));
    const { saveMasterCv } = await import('../utils/database.js');

    await saveMasterCv('user-1', { candidate_core: 'Kept.', voice_guide: '' });

    expect(upserted.master_cv.voice_guide).toBe('');
    expect(upserted.master_cv.candidate_core).toBe('Kept.');
  });
});

describe('CV prompt (Layer 2)', () => {
  test('tells the generator to follow voice_guide, subordinate to the layer', () => {
    const block = humanScannability('en');
    expect(block).toContain('voice_guide');
    expect(block).toMatch(/never WHAT is said/);
    // It must not be handed to the writer as an override of the layer above it.
    expect(block).toMatch(/UNDER this layer/);
  });
});

describe('cover-letter prompt', () => {
  test('instructs the model to follow voice_guide and bars it from licensing facts', () => {
    const messages = buildCoverPrompt(
      JSON.stringify({ voice_guide: GUIDE }),
      { job_match: {} },
      'professional'
    );
    const user = messages.map((m) => m.content).join('\n');
    expect(user).toContain('voice_guide');
    expect(user).toMatch(/never WHAT is true/);
  });
});
