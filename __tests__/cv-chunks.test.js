// __tests__/cv-chunks.test.js
//
// The chunker is the input side of retrieval: if a piece of the record cannot
// become a chunk, no ad can ever retrieve it, and the letter is written without
// it. These tests pin the two properties that failure would show up as.

import { describe, it, expect } from 'vitest';
import { chunkMaster, roleHeader } from '../utils/cv-chunks.js';

const master = {
  work_experience: [
    {
      company: 'Salsita',
      title: 'Head of Product',
      start_date: '03/2019',
      end_date: '06/2022',
      location: 'Prague',
      bullets: [
        'Turned the eBay account around after a failed delivery',
        'Grew the account from under $20k to over $100k'
      ],
      fractional_engagements: [
        {
          company: 'Invity',
          title: 'Product Consultant',
          start_date: '01/2021',
          end_date: '12/2021',
          bullets: ['Designed the crypto exchange onboarding flow']
        }
      ]
    }
  ],
  advisory_and_community: [
    {
      organization: 'Dezentrum',
      title: 'Advisor',
      start_date: '2018',
      end_date: '2019',
      bullets: ['Argued the case for blockchain governance in public forums']
    }
  ],
  speaking_and_lecturing: [
    {
      event: 'Charles University',
      role: 'Guest Lecturer',
      topic: 'Teaching product design to non-designers',
      location: 'Prague',
      year: '2017'
    }
  ],
  publications_and_patents: ['Patent: adaptive media search ranking']
};

describe('chunkMaster', () => {
  it('gives every bullet its own chunk carrying its employer and dates', () => {
    const chunks = chunkMaster(master);
    const ebay = chunks.find((c) => c.text.includes('eBay account around'));

    expect(ebay).toBeTruthy();
    // The header is the whole point: a bullet retrieved without it is an orphan
    // fact and T2 forbids guessing where it happened.
    expect(ebay.text).toContain('Head of Product at Salsita');
    expect(ebay.text).toContain('03/2019 - 06/2022');
    expect(ebay.kind).toBe('role');
  });

  it('retrieves a nested client engagement in its own right', () => {
    // The defect this prevents is in COVER_LETTER_LOG.md: a CV generated for a
    // Bitcoin company carried no crypto work, because the crypto engagements sat
    // nested under an umbrella entry and were collapsed away.
    const chunks = chunkMaster(master);
    const crypto = chunks.find((c) => c.text.includes('crypto exchange onboarding'));

    expect(crypto).toBeTruthy();
    expect(crypto.kind).toBe('engagement');
    expect(crypto.text).toContain('Invity');
    // It names its parent, so the letter can say where it sat.
    expect(crypto.source).toContain('Salsita');
  });

  it('chunks talks, advisory work and publications, not only employment', () => {
    const chunks = chunkMaster(master);
    const kinds = new Set(chunks.map((c) => c.kind));

    expect(kinds.has('speaking')).toBe(true);
    expect(kinds.has('advisory')).toBe(true);
    expect(kinds.has('publication')).toBe(true);

    const talk = chunks.find((c) => c.kind === 'speaking');
    expect(talk.text).toContain('Teaching product design to non-designers');
    expect(talk.text).toContain('Charles University');
  });

  it('invents nothing: every chunk is substrings of the record', () => {
    const chunks = chunkMaster(master);
    const source = JSON.stringify(master);

    for (const c of chunks) {
      // Every word of a chunk that is not punctuation or the joiner comes from
      // the master. Checked on the bullet body, which is the part that carries
      // claims.
      const body = c.text.split(' — ').slice(1).join(' — ');
      if (body) expect(source).toContain(body);
    }
  });

  it('is stable and deduplicated: same master in, same ids out, no repeats', () => {
    const a = chunkMaster(master);
    const b = chunkMaster(master);

    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(new Set(a.map((c) => c.id)).size).toBe(a.length);
  });

  it('returns nothing rather than guessing when the master is absent', () => {
    expect(chunkMaster(null)).toEqual([]);
    expect(chunkMaster({})).toEqual([]);
  });
});

describe('roleHeader', () => {
  it('omits what the record does not state instead of filling it in', () => {
    expect(roleHeader({ title: 'Advisor', company: 'Dezentrum' })).toBe('Advisor at Dezentrum');
    expect(roleHeader({ company: 'Salsita', start_date: '03/2019' })).toBe('Salsita (03/2019)');
    expect(roleHeader({})).toBe('');
  });
});
