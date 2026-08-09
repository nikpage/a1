// utils/steering.test.js — the steering composition on the personal workbench.
//
// composeTweak feeds prompts/cv-generator.js's HIGHEST-PRIORITY tweak block, so
// what it emits is what the writer obeys. These call the real function.

import { describe, test, expect } from 'vitest';
import { composeTweak } from './steering';

describe('composeTweak', () => {
  test('an untouched form produces no tweak at all, so the prompt block stays absent', () => {
    expect(composeTweak({})).toBe('');
    expect(composeTweak({ emphasise: '  ', playDown: '\n', freeform: '' })).toBe('');
  });

  test('emphasise and play-down become explicit, separately labelled instructions', () => {
    expect(composeTweak({ emphasise: 'the AI work', playDown: 'the agency years' })).toBe(
      'Foreground and lead with: the AI work\nPlay down, condense or place late: the agency years'
    );
  });

  test('freeform text is passed through verbatim and lands last', () => {
    const out = composeTweak({ emphasise: 'product', freeform: 'Frame this as a deliberate pivot. One page.' });
    expect(out).toBe('Foreground and lead with: product\nFrame this as a deliberate pivot. One page.');
  });

  test('only the filled boxes appear — an empty box contributes no stray label', () => {
    expect(composeTweak({ playDown: 'early sales roles' })).toBe(
      'Play down, condense or place late: early sales roles'
    );
  });
});
