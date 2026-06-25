// __tests__/origin-check.test.js — Task 1.6: utils/originCheck.js

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { isValidOrigin, getBaseUrl } from '../utils/originCheck.js';

describe('isValidOrigin', () => {
  let savedSiteUrl;
  let savedNodeEnv;

  beforeEach(() => {
    savedSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    savedNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (savedSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = savedSiteUrl;
    }
    process.env.NODE_ENV = savedNodeEnv;
  });

  test('allows the configured production site URL in production', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://mysuper.cv';
    process.env.NODE_ENV = 'production';
    expect(isValidOrigin('https://mysuper.cv')).toBe(true);
  });

  test('blocks a foreign origin in production', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://mysuper.cv';
    process.env.NODE_ENV = 'production';
    expect(isValidOrigin('https://evil.com')).toBe(false);
  });

  test('blocks old hardcoded netlify origin', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://mysuper.cv';
    process.env.NODE_ENV = 'production';
    expect(isValidOrigin('https://cv-pro.netlify.app')).toBe(false);
  });

  test('allows localhost in non-production', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://mysuper.cv';
    process.env.NODE_ENV = 'test';
    expect(isValidOrigin('http://localhost:3000')).toBe(true);
  });

  test('blocks localhost in production', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://mysuper.cv';
    process.env.NODE_ENV = 'production';
    expect(isValidOrigin('http://localhost:3000')).toBe(false);
  });

  test('returns false for null/undefined origin', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://mysuper.cv';
    process.env.NODE_ENV = 'production';
    expect(isValidOrigin(null)).toBe(false);
    expect(isValidOrigin(undefined)).toBe(false);
  });
});

describe('getBaseUrl', () => {
  let savedSiteUrl;

  beforeEach(() => { savedSiteUrl = process.env.NEXT_PUBLIC_SITE_URL; });
  afterEach(() => {
    if (savedSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = savedSiteUrl;
    }
  });

  test('returns NEXT_PUBLIC_SITE_URL when set', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://mysuper.cv';
    expect(getBaseUrl()).toBe('https://mysuper.cv');
  });

  test('falls back to localhost when env var is not set', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getBaseUrl()).toBe('http://localhost:3000');
  });
});
