import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// A prompt file that does not parse takes the whole pipeline down, and nothing
// caught it: an unescaped quote inside a template literal shipped to production
// because no test in the suite imported that module. Every prompt module must
// load, and must export something — the cheapest possible guard against the
// most expensive possible failure.
const dir = join(process.cwd(), 'prompts');
const files = readdirSync(dir).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'));

describe('every prompt module loads', () => {
  it('finds prompt modules to check', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(`${file} parses and exports`, async () => {
      const mod = await import(join(dir, file));
      expect(Object.keys(mod).length).toBeGreaterThan(0);
    });
  }
});
