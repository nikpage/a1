// __tests__/job-input-mode.test.js

import { describe, test, expect } from 'vitest';
import { detectJobInputMode } from '../utils/detectJobInputMode.js';

describe('detectJobInputMode', () => {
  test('https URL with path returns url', () => {
    expect(detectJobInputMode('https://example.com/job/123')).toBe('url');
  });

  test('http URL returns url', () => {
    expect(detectJobInputMode('http://x.io')).toBe('url');
  });

  test('plain pasted job ad text returns text', () => {
    expect(detectJobInputMode('We are looking for a Senior Software Engineer with 5+ years of experience in React and Node.js. The role is based in London.')).toBe('text');
  });

  test('text that contains a URL but has surrounding words returns text', () => {
    expect(detectJobInputMode('see https://x.io for more details')).toBe('text');
  });

  test('empty string returns text', () => {
    expect(detectJobInputMode('')).toBe('text');
  });

  test('whitespace-only string returns text', () => {
    expect(detectJobInputMode('   \n  ')).toBe('text');
  });

  test('URL with surrounding whitespace (trimmed) returns url', () => {
    expect(detectJobInputMode('  https://jobs.example.com/role/42  ')).toBe('url');
  });

  test('ftp:// scheme is not a URL (returns text)', () => {
    expect(detectJobInputMode('ftp://example.com/file')).toBe('text');
  });
});
