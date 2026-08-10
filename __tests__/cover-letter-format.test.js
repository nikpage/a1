// __tests__/cover-letter-format.test.js
//
// Two defects seen on a real downloaded letter:
//   1. TWO dates at the top — the model wrote "10 August 2026", the day-first
//      form the leading-date strip did not recognise, and the real date was
//      prepended above it.
//   2. The signature block rendered as ordinary body paragraphs, so "Sincerely,"
//      / name / phone / email / LinkedIn came out double-spaced and adrift.
//
// The date strip is exercised through the real generateCoverLetter (Gemini
// stubbed, the clock pinned); the signature rendering through the real docx
// exporter, whose paragraphs are inspected directly.

vi.hoisted(() => {
  process.env.GEMINI_API_KEYS = 'key1';
});

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const mockAxiosPost = vi.hoisted(() => vi.fn());
vi.mock('axios', () => ({ default: { post: mockAxiosPost } }));
vi.mock('../prompts/cover-letter.js', () => ({
  buildCoverPrompt: () => [{ role: 'user', content: 'write a cover letter' }],
}));

import { generateCoverLetter } from '../utils/openai.js';

function geminiResp(content, model = 'gemini-2.5-flash') {
  return {
    data: {
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      model,
    },
  };
}

const CLEAN_VERIFY = geminiResp('{"unsupported":[]}', 'gemini-2.5-flash-lite');

// The exporter's real date, so the assertions don't depend on today's date.
function todayDe() {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

beforeEach(() => vi.clearAllMocks());

describe('generateCoverLetter — exactly one date at the top', () => {
  const forms = [
    '10 August 2026',
    '10th August 2026',
    'August 10, 2026',
    'August 2026',
    '10.08.2026',
    '2026-08-10',
  ];

  test.each(forms)('strips a leading date written as "%s"', async (dateLine) => {
    mockAxiosPost
      .mockResolvedValueOnce(geminiResp(`${dateLine}\n\nDear Hiring Manager,\n\nBody text.\n\nSincerely,\n\nNik Page`))
      .mockResolvedValueOnce(CLEAN_VERIFY);

    const { content } = await generateCoverLetter({ cv: '{}', analysis: {}, tone: 'Formal' });

    const lines = content.split('\n').filter((l) => l.trim());
    // Line 1 is the app's own date; the model's date line is gone.
    expect(lines[0]).toBe(todayDe());
    expect(lines.slice(1).join('\n')).not.toContain(dateLine);
    expect(lines[1]).toBe('Dear Hiring Manager,');
  });

  test('a date inside the body is NOT stripped', async () => {
    mockAxiosPost
      .mockResolvedValueOnce(geminiResp('Dear Hiring Manager,\n\nI led the rollout in August 2024.\n\nSincerely,'))
      .mockResolvedValueOnce(CLEAN_VERIFY);

    const { content } = await generateCoverLetter({ cv: '{}', analysis: {}, tone: 'Formal' });
    expect(content).toContain('I led the rollout in August 2024.');
  });
});

// The docx library and file-saver are external boundaries, so they are stubbed
// with recorders: the exporter's REAL decisions (which text, which spacing,
// which style, in which order) are what the assertions read.
describe('exportDocxFormatted — signature block', () => {
  let paragraphs;

  beforeEach(async () => {
    vi.resetModules();
    paragraphs = [];
    vi.doMock('file-saver', () => ({ saveAs: vi.fn() }));
    const docx = await vi.importActual('docx');
    vi.doMock('docx', () => ({
      ...docx,
      TextRun: class {
        constructor(opts) { Object.assign(this, opts); }
      },
      Paragraph: class {
        constructor(opts = {}) {
          const text = (opts.children || []).map((c) => c.text || '').join('');
          const style = (opts.children || [])[0] || {};
          paragraphs.push({ text, spacing: opts.spacing || {}, bold: !!style.bold, color: style.color });
        }
      },
      Packer: { toBlob: async () => new Blob(['x']) },
    }));
  });

  afterEach(() => vi.doUnmock('docx'));

  test('renders the sign-off, name and contact lines as one tight block', async () => {
    const { default: exportDocxFormatted } = await import('../utils/exportDocxFormatted.js');

    await exportDocxFormatted({
      type: 'cover',
      user_id: 'u1',
      markdownText: [
        '10.08.2026',
        '',
        'Dear Hiring Manager,',
        '',
        'Body text goes here.',
        '',
        'Sincerely,',
        '',
        'Nik Page',
        '+420 731 647 707',
        'Me@Nik.Page',
        'linkedin.com/in/nbpage',
      ].join('\n'),
    });

    const at = (text) => paragraphs.find((p) => p.text === text);

    // The sign-off and every line under it are present, in order.
    const signOffIndex = paragraphs.findIndex((p) => p.text === 'Sincerely,');
    expect(signOffIndex).toBeGreaterThan(-1);
    expect(paragraphs.slice(signOffIndex + 1).map((p) => p.text)).toEqual([
      'Nik Page',
      '+420 731 647 707',
      'Me@Nik.Page',
      'linkedin.com/in/nbpage',
    ]);

    // Tight block: every line under the sign-off has zero after-spacing, unlike
    // the body paragraph above it.
    for (const p of paragraphs.slice(signOffIndex + 1)) {
      expect(p.spacing.after).toBe(0);
    }
    expect(at('Body text goes here.').spacing.after).toBe(200);

    // The name is bold; the contact lines are not.
    expect(at('Nik Page').bold).toBe(true);
    expect(at('Me@Nik.Page').bold).toBe(false);
  });
});
