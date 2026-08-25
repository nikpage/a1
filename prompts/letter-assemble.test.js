import { describe, it, expect } from 'vitest';
import { assembleCover, salutation, letterDate } from './letter-assemble.js';
import { INSTANCES, DAY_TO_DAY, CLOSES, LANGUAGE_LINE, openingById } from './letter-library.js';

const master = {
  profile: {
    name: 'Nik Page',
    contact: {
      email: 'Me@Nik.Page',
      phone: '+420 731 647 707',
      linkedin: 'www.linkedin.com/in/nbpage'
    }
  }
};

const picked = {
  opening: 'ai-work-now',
  instances: ['ai-realty-assistant', 'ebay-berlin-trust'],
  day_to_day: 'hands-on-pm',
  close: 'coffee-talk'
};

const textOf = (id) => INSTANCES.find((i) => i.id === id).text;

describe('assembleCover', () => {
  it('prints BOTH instances whole, in the order picked', () => {
    const letter = assembleCover(master, picked);
    const first = letter.indexOf(textOf('ai-realty-assistant'));
    const second = letter.indexOf(textOf('ebay-berlin-trust'));
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
  });

  it('reproduces his paragraphs verbatim — nothing is smoothed or truncated', () => {
    const letter = assembleCover(master, picked);
    expect(letter).toContain(openingById('ai-work-now').text);
    expect(letter).toContain(DAY_TO_DAY.find((d) => d.id === 'hands-on-pm').text);
    expect(letter).toContain(CLOSES.find((c) => c.id === 'coffee-talk').text);
  });

  it('uses the model\'s opening only when opening is "custom"', () => {
    const custom = assembleCover(master, { ...picked, opening: 'custom', opening_text: 'Invity caught my eye.' });
    expect(custom).toContain('Invity caught my eye.');
    expect(custom).not.toContain(openingById('ai-work-now').text);

    const own = assembleCover(master, { ...picked, opening_text: 'Invity caught my eye.' });
    expect(own).not.toContain('Invity caught my eye.');
  });

  it('drops an unknown id instead of printing it', () => {
    const letter = assembleCover(master, { ...picked, instances: ['ai-realty-assistant', 'no-such-block'] });
    expect(letter).not.toContain('no-such-block');
    expect(letter).toContain(textOf('ai-realty-assistant'));
  });

  it('prints the contact details exactly once, in the signature block', () => {
    const letter = assembleCover(master, picked);
    expect(letter.match(/\+420 731 647 707/g)).toHaveLength(1);
    expect(letter.match(/Me@Nik\.Page/g)).toHaveLength(1);
    expect(letter.indexOf('+420 731 647 707')).toBeGreaterThan(letter.indexOf(textOf('ebay-berlin-trust')));
  });

  it('adds the Czech language line only when asked for', () => {
    expect(assembleCover(master, picked)).not.toContain(LANGUAGE_LINE);
    expect(assembleCover(master, { ...picked, language_line: true })).toContain(LANGUAGE_LINE);
  });

  it('names the contact only when the ad gave one, and never guesses', () => {
    expect(salutation('Zuz')).toBe('Dear Zuz,');
    expect(salutation('')).toBe('Dear Hiring Team,');
    expect(salutation('', 'cs')).toBe('Vážená paní, vážený pane,');
  });

  it('writes the date in his own format', () => {
    expect(letterDate(new Date(2026, 7, 24))).toBe('24.08.2026');
  });

  it('signs off in the letter\'s own language', () => {
    expect(assembleCover(master, picked, { language: 'cs' })).toContain('S pozdravem,');
    expect(assembleCover(master, picked)).toContain('Sincerely,');
  });
});
