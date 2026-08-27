// __tests__/cv-retrieval.test.js
//
// Only the two external boundaries are stubbed — Gemini (embedTexts) and
// Supabase (saveCvChunks / matchCvChunks). Everything asserted here is the real
// module's own logic: what it stores, how it groups, how it de-duplicates, and
// what it does when a boundary fails.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const embedTexts = vi.fn();
const saveCvChunks = vi.fn();
const matchCvChunks = vi.fn();

vi.mock('../utils/openai.js', () => ({ embedTexts: (...a) => embedTexts(...a) }));
vi.mock('../utils/database.js', () => ({
  saveCvChunks: (...a) => saveCvChunks(...a),
  matchCvChunks: (...a) => matchCvChunks(...a)
}));

const { indexMaster, retrieveForRequirements, retrievedEvidenceBlock } =
  await import('../utils/cv-retrieval.js');

const master = {
  work_experience: [
    {
      company: 'Salsita',
      title: 'Head of Product',
      start_date: '03/2019',
      end_date: '06/2022',
      bullets: ['Turned the eBay account around', 'Grew it from under $20k to over $100k']
    }
  ]
};

const row = (id, text, similarity) => ({
  chunk_id: id,
  kind: 'role',
  source: 'Salsita',
  header: 'Head of Product at Salsita',
  text,
  similarity
});

beforeEach(() => {
  embedTexts.mockReset();
  saveCvChunks.mockReset();
  matchCvChunks.mockReset();
});

describe('indexMaster', () => {
  it('embeds every chunk and stores each vector against its own chunk', async () => {
    embedTexts.mockResolvedValue({
      vectors: [[0.1], [0.2], [0.3]],
      gemini_usage: { costUsd: 0.0001 }
    });
    saveCvChunks.mockResolvedValue([]);

    const res = await indexMaster('user-1', master);

    const [, stored] = saveCvChunks.mock.calls[0];
    const [texts] = embedTexts.mock.calls[0];

    expect(stored).toHaveLength(texts.length);
    // The vector must land on the chunk whose text produced it. Getting this
    // pairing wrong attaches one role's evidence to another's and no downstream
    // check could see it.
    stored.forEach((c, i) => {
      expect(c.text).toBe(texts[i]);
      expect(c.embedding).toEqual([[0.1], [0.2], [0.3]][i]);
    });
    expect(res.count).toBe(3);
  });

  it('spends nothing when the record has no chunks', async () => {
    const res = await indexMaster('user-1', null);

    expect(embedTexts).not.toHaveBeenCalled();
    expect(saveCvChunks).not.toHaveBeenCalled();
    expect(res).toEqual({ count: 0, gemini_usage: null });
  });

  it('stores a chunk whose vector failed, without a vector, rather than dropping it', async () => {
    embedTexts.mockResolvedValue({ vectors: [[0.1], null, [0.3]], gemini_usage: null });
    saveCvChunks.mockResolvedValue([]);

    const res = await indexMaster('user-1', master);
    const [, stored] = saveCvChunks.mock.calls[0];

    expect(stored).toHaveLength(3);
    expect(stored[1].embedding).toBeNull();
    expect(res.count).toBe(2); // two are searchable, and the count says so
  });
});

describe('retrieveForRequirements', () => {
  it('pairs each requirement with the record that answers it', async () => {
    embedTexts.mockResolvedValue({ vectors: [[1], [2]], gemini_usage: null });
    matchCvChunks
      .mockResolvedValueOnce([row('a', 'Turned the eBay account around', 0.8)])
      .mockResolvedValueOnce([row('b', 'Grew it from under $20k to over $100k', 0.7)]);

    const { groups } = await retrieveForRequirements('user-1', [
      'account management',
      'revenue growth'
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].requirement).toBe('account management');
    expect(groups[0].chunks[0].text).toContain('eBay account');
    expect(groups[1].chunks[0].text).toContain('$100k');
  });

  it('hands the same piece of work over once, at its best score', async () => {
    embedTexts.mockResolvedValue({ vectors: [[1], [2]], gemini_usage: null });
    matchCvChunks
      .mockResolvedValueOnce([row('a', 'Turned the eBay account around', 0.6)])
      .mockResolvedValueOnce([row('a', 'Turned the eBay account around', 0.9)]);

    const { chunks } = await retrieveForRequirements('user-1', ['one', 'two']);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].similarity).toBe(0.9);
  });

  it('returns no group for a requirement the record cannot answer', async () => {
    embedTexts.mockResolvedValue({ vectors: [[1], [2]], gemini_usage: null });
    matchCvChunks
      .mockResolvedValueOnce([row('a', 'Turned the eBay account around', 0.8)])
      .mockResolvedValueOnce([]);

    const { groups } = await retrieveForRequirements('user-1', ['answerable', 'unanswerable']);

    expect(groups).toHaveLength(1);
    expect(groups[0].requirement).toBe('answerable');
  });

  it('drops a match below the similarity floor instead of offering a near-miss as evidence', async () => {
    embedTexts.mockResolvedValue({ vectors: [[1]], gemini_usage: null });
    matchCvChunks.mockResolvedValue([
      row('a', 'Turned the eBay account around', 0.9),
      row('b', 'Something unrelated', 0.05)
    ]);

    const { chunks } = await retrieveForRequirements('user-1', ['account management']);

    expect(chunks.map((c) => c.id)).toEqual(['a']);
  });

  it('degrades to no retrieval when embedding fails — it never throws into a paid run', async () => {
    embedTexts.mockRejectedValue(new Error('Gemini 503'));

    const res = await retrieveForRequirements('user-1', ['account management']);

    expect(res).toEqual({ groups: [], chunks: [], gemini_usage: null });
    expect(matchCvChunks).not.toHaveBeenCalled();
  });

  it('spends nothing without a user or without requirements', async () => {
    expect(await retrieveForRequirements('', ['x'])).toEqual({ groups: [], chunks: [], gemini_usage: null });
    expect(await retrieveForRequirements('user-1', [])).toEqual({ groups: [], chunks: [], gemini_usage: null });
    expect(embedTexts).not.toHaveBeenCalled();
  });
});

describe('retrievedEvidenceBlock', () => {
  it('renders each ask with the record under it, verbatim', () => {
    const block = retrievedEvidenceBlock([
      { requirement: 'account management', chunks: [{ text: 'Head of Product at Salsita — Turned the eBay account around' }] }
    ]);

    expect(block).toContain('THEY ASK: account management');
    expect(block).toContain('Turned the eBay account around');
    expect(block).toContain('Head of Product at Salsita');
  });

  it('renders nothing at all when retrieval found nothing', () => {
    // An empty scaffold in front of the writer is worse than no block: it invites
    // the letter to answer an ask with nothing behind it.
    expect(retrievedEvidenceBlock([])).toBe('');
    expect(retrievedEvidenceBlock([{ requirement: 'x', chunks: [] }])).toBe('');
    expect(retrievedEvidenceBlock(null)).toBe('');
  });
});
