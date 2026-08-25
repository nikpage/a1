// __tests__/export-docx-engagements.test.js
//
// The Word file is what the candidate actually sends. A nested client
// engagement ("##### **Head of Product** · SpecialAgents | 01/2026 - Present")
// must render as an indented sub-role underneath its parent.
//
// Red on the old code: the exporter matched "#### " for a role and then treated
// anything else starting with "###" as a SECTION. "##### x" does not start with
// "#### " but does start with "###", so every client engagement became a
// section header with a rule across the page — and because the section title
// was then the engagement's own text, the bullets under it stopped being read
// as job bullets.
//
// Only the docx library and the file save — the external boundaries — are stubbed.

import { describe, test, expect, vi, beforeEach } from 'vitest';

const captured = vi.hoisted(() => ({ paragraphs: [] }));

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('docx', () => {
  class Paragraph {
    constructor(opts = {}) {
      this.opts = opts;
      captured.paragraphs.push(opts);
    }
  }
  class TextRun {
    constructor(opts = {}) { this.opts = opts; }
  }
  return {
    Document: class { constructor(opts) { this.opts = opts; } },
    Packer: { toBlob: async () => 'blob' },
    Paragraph,
    TextRun,
    AlignmentType: { CENTER: 'center' },
    BorderStyle: { SINGLE: 'single' },
  };
});

import exportDocxFormatted from '../utils/exportDocxFormatted.js';

const CV = `<center>

# Nik Page
**Product Leader**
Prague | me@nik.page

</center>

---

### **Work Experience**

#### **Product Strategy & UX Leader**
**Nik Page Ltd.** | 08/2016 - Present | Prague, CZ
- Advised client executive teams on technical feasibility.

##### **Head of Product & Delivery** · SpecialAgents | 01/2026 - Present
- Delivered AI agentic solutions to small businesses.

---

### **Education**
**BS, Informatics** | Heald College
`;

const textOf = (p) => (p.children || []).map((c) => c.opts?.text || '').join('');

beforeEach(() => { captured.paragraphs.length = 0; });

describe('the DOCX export of a nested client engagement', () => {
  test('renders it as an indented sub-role, not a new section', async () => {
    await exportDocxFormatted({ markdownText: CV, user_id: 'u1' });

    const engagement = captured.paragraphs.find((p) => textOf(p).includes('SpecialAgents'));
    expect(engagement).toBeTruthy();
    expect(engagement.indent?.left).toBeGreaterThan(0);
    // A section header carries the divider border; a sub-role must not.
    expect(engagement.border).toBeUndefined();
  });

  test('the bullet after it is still a Work Experience bullet', async () => {
    await exportDocxFormatted({ markdownText: CV, user_id: 'u1' });

    const bullet = captured.paragraphs.find((p) => textOf(p).includes('AI agentic solutions'));
    expect(bullet).toBeTruthy();
    expect(textOf(bullet).startsWith('• ')).toBe(true);
    expect(bullet.indent?.hanging).toBe(360);
  });

  test('the real sections still render as sections', async () => {
    await exportDocxFormatted({ markdownText: CV, user_id: 'u1' });

    const dividers = captured.paragraphs.filter((p) => p.border);
    // Work Experience and Education, and nothing invented between them.
    expect(dividers).toHaveLength(2);
  });
});
