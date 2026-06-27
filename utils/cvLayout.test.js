// utils/cvLayout.test.js
import { describe, it, expect } from 'vitest';
import {
  extractDateStrings,
  dateFormatShapes,
  detectColumns,
  formatLayoutForPrompt,
} from './cvLayout.js';

// Synthetic page-item helpers (PDF user-space units). pageWidth = 600.
const cols1 = () => Array.from({ length: 20 }, () => ({ x: 72, w: 400 }));
const cols2 = () => [
  ...Array.from({ length: 20 }, () => ({ x: 72, w: 200 })),   // left column
  ...Array.from({ length: 20 }, () => ({ x: 330, w: 200 })),  // right column, gutter ~270–330
];

describe('detectColumns', () => {
  it('reports a single column when text fills the middle of the page', () => {
    expect(detectColumns(cols1(), 600)).toBe(1);
  });

  it('detects two columns from the empty central gutter', () => {
    expect(detectColumns(cols2(), 600)).toBe(2);
  });

  it('does not claim columns when one side is nearly empty', () => {
    const lopsided = [
      ...Array.from({ length: 20 }, () => ({ x: 72, w: 200 })),
      { x: 330, w: 200 }, // a single stray item on the right is not a column
    ];
    expect(detectColumns(lopsided, 600)).toBe(1);
  });

  it('is conservative with too little data', () => {
    expect(detectColumns([{ x: 72, w: 200 }, { x: 330, w: 200 }], 600)).toBe(1);
    expect(detectColumns(cols2(), 0)).toBe(1);
  });
});

describe('extractDateStrings', () => {
  it('captures verbatim ranges, present-spans and numeric dates, deduped', () => {
    const text = [
      'Senior PM, Nov 2022 – Oct 2023',
      'Consultant, 2018-Present',
      'Analyst, 03/2015 - 06/2017',
      'Repeat, Nov 2022 – Oct 2023',
    ].join('\n');
    const dates = extractDateStrings(text);
    expect(dates).toContain('Nov 2022 – Oct 2023');
    expect(dates).toContain('2018-Present');
    expect(dates).toContain('03/2015 - 06/2017');
    // deduped — the repeated range appears once
    expect(dates.filter((d) => d === 'Nov 2022 – Oct 2023')).toHaveLength(1);
  });

  it('returns [] when there are no dates', () => {
    expect(extractDateStrings('No dates here at all')).toEqual([]);
  });
});

describe('dateFormatShapes', () => {
  it('flags mixed formats as more than one shape', () => {
    const shapes = dateFormatShapes(['Nov 2022 – Oct 2023', '2018-Present', '03/2015 - 06/2017']);
    expect(shapes.length).toBeGreaterThan(1);
  });

  it('collapses same-shaped dates to one shape', () => {
    const shapes = dateFormatShapes(['Jan 2019', 'Mar 2021', 'Dec 2020']);
    expect(shapes).toHaveLength(1);
  });
});

describe('formatLayoutForPrompt', () => {
  it('returns empty string for no layout', () => {
    expect(formatLayoutForPrompt(null)).toBe('');
    expect(formatLayoutForPrompt(undefined)).toBe('');
  });

  it('warns about a multi-column scramble', () => {
    const note = formatLayoutForPrompt({ format: 'pdf', pages: 1, columns: 2, multi_column: true });
    expect(note).toMatch(/2-column/);
    expect(note).toMatch(/scramble/i);
  });

  it('warns about a scanned / image CV', () => {
    const note = formatLayoutForPrompt({ format: 'pdf', pages: 2, likely_scanned: true });
    expect(note).toMatch(/scanned/i);
    expect(note).toMatch(/NO/);
  });

  it('quotes the verbatim date strings and flags mixed formats', () => {
    const note = formatLayoutForPrompt({
      format: 'pdf',
      pages: 1,
      date_formats: ['Nov 2022 – Oct 2023', '2018-Present'],
      mixed_date_formats: true,
    });
    expect(note).toContain('"Nov 2022 – Oct 2023"');
    expect(note).toMatch(/MIXED/);
  });

  it('describes docx tables as an out-of-order hazard', () => {
    const note = formatLayoutForPrompt({ format: 'docx', multi_column: true, has_tables: true });
    expect(note).toMatch(/TABLES/);
    expect(note).toMatch(/out of order/i);
  });
});
