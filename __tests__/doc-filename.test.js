// __tests__/doc-filename.test.js
//
// The download filename is [doc]-[FirstLast]_[Company], e.g. cv-NikPage_Xco.docx.
// Two layers are covered: docFileName's real derivation from an analysis payload,
// and exportDocxFormatted actually handing that name to file-saver (the only
// stubbed thing being the external boundaries — docx and file-saver).

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { docFileName } from '../utils/doc-filename.js';

const analysis = (cvData, jobData) => JSON.stringify({
  cv_data: { Name: 'Nik Page', ...cvData },
  job_data: { Position: 'Head of Product', Company: 'Xco', ...jobData },
});

describe('docFileName', () => {
  test('names the file [doc]-[FirstLast]_[Company]', () => {
    expect(docFileName('cv', analysis())).toBe('cv-NikPage_Xco');
    expect(docFileName('cover', analysis())).toBe('cover-NikPage_Xco');
  });

  test('accepts an already-parsed analysis object', () => {
    expect(docFileName('cv', JSON.parse(analysis()))).toBe('cv-NikPage_Xco');
  });

  test('reads through a fenced JSON payload', () => {
    expect(docFileName('cv', '```json\n' + analysis() + '\n```')).toBe('cv-NikPage_Xco');
  });

  test('strips accents and punctuation rather than putting them in a filename', () => {
    const a = analysis({ Name: 'Jiří Nový-Šimek' }, { Company: 'Acme, s.r.o.' });
    expect(docFileName('cv', a)).toBe('cv-JiriNovySimek_AcmeSRO');
  });

  test('drops the company for a standalone review instead of writing "n/a"', () => {
    expect(docFileName('cv', analysis({}, { Position: 'n/a', Company: 'n/a' }))).toBe('cv-NikPage');
  });

  test('drops a missing name instead of guessing one', () => {
    expect(docFileName('cover', analysis({ Name: '' }))).toBe('cover_Xco');
    expect(docFileName('cv', analysis({ Name: 'n/a' }, { Company: 'n/a' }))).toBe('cv');
  });

  test('unparseable or absent analysis degrades to the bare type', () => {
    expect(docFileName('cv', 'not json at all')).toBe('cv');
    expect(docFileName('cv', null)).toBe('cv');
  });
});

describe('exportDocxFormatted — download filename', () => {
  let saveAs;

  beforeEach(async () => {
    vi.resetModules();
    saveAs = vi.fn();
    vi.doMock('file-saver', () => ({ saveAs }));
    const docx = await vi.importActual('docx');
    vi.doMock('docx', () => ({
      ...docx,
      TextRun: class { constructor(opts) { Object.assign(this, opts); } },
      Paragraph: class { constructor() {} },
      Packer: { toBlob: async () => new Blob(['x']) },
    }));
  });

  afterEach(() => {
    vi.doUnmock('docx');
    vi.doUnmock('file-saver');
  });

  test('saves as [doc]-[FirstLast]_[Company].docx when an analysis is supplied', async () => {
    const { default: exportDocxFormatted } = await import('../utils/exportDocxFormatted.js');
    await exportDocxFormatted({
      type: 'cv',
      user_id: 'u1',
      markdownText: '# Nik Page\n\nSummary line.',
      analysis: analysis(),
    });
    expect(saveAs.mock.calls[0][1]).toBe('cv-NikPage_Xco.docx');
  });

  test('falls back to the user id when there is no analysis to name from', async () => {
    const { default: exportDocxFormatted } = await import('../utils/exportDocxFormatted.js');
    await exportDocxFormatted({
      type: 'cover',
      user_id: 'u1',
      markdownText: 'Dear Hiring Manager,\n\nBody.',
    });
    expect(saveAs.mock.calls[0][1]).toBe('cover-u1.docx');
  });
});
