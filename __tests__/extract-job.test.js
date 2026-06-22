// __tests__/extract-job.test.js

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-extract-job-secret';
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { mockReqRes, authCookieFor } from './helpers.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));

const mockAnalyzeJobOnly = vi.hoisted(() => vi.fn());
vi.mock('../utils/openai', () => ({
  analyzeJobOnly: mockAnalyzeJobOnly,
}));

import handler from '../pages/api/extract-job.js';

const VALID_USER = 'user-extract-job-001';

const SAMPLE_EXTRACTION = {
  position_title: 'Backend Engineer',
  company: 'Acme Corp',
  hr_contact: '',
  location: 'Berlin',
  seniority: 'Senior',
  employment_type: 'Full-time',
  salary: '€80k–€100k',
  required_skills: ['Python', 'AWS'],
  desired_skills: ['Kubernetes'],
  must_have_requirements: ['5+ years experience'],
  nice_to_have: ['Terraform'],
  responsibilities: ['Build scalable APIs'],
  keywords_for_ats: ['python', 'aws', 'kubernetes'],
  language_requirements: ['English C1'],
};

beforeEach(() => {
  mockAnalyzeJobOnly.mockReset();
});

describe('POST /api/extract-job — auth gate', () => {
  test('no cookie → 401, analyzeJobOnly never called', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      cookies: {},
      body: { jobText: 'We are hiring a backend engineer...' },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(mockAnalyzeJobOnly).not.toHaveBeenCalled();
  });

  test('invalid/tampered token → 401, analyzeJobOnly never called', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      cookies: { 'auth-token': 'bad.jwt.garbage' },
      body: { jobText: 'We are hiring a backend engineer...' },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(mockAnalyzeJobOnly).not.toHaveBeenCalled();
  });
});

describe('POST /api/extract-job — input validation', () => {
  test('missing jobText → 400', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      cookies: { 'auth-token': authCookieFor(VALID_USER) },
      body: {},
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: expect.any(String) });
    expect(mockAnalyzeJobOnly).not.toHaveBeenCalled();
  });

  test('empty string jobText → 400', async () => {
    const { req, res } = mockReqRes({
      method: 'POST',
      cookies: { 'auth-token': authCookieFor(VALID_USER) },
      body: { jobText: '   ' },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(mockAnalyzeJobOnly).not.toHaveBeenCalled();
  });

  test('wrong method → 405', async () => {
    const { req, res } = mockReqRes({
      method: 'GET',
      cookies: { 'auth-token': authCookieFor(VALID_USER) },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

describe('POST /api/extract-job — happy path', () => {
  test('valid auth + jobText → 200 with parsed extraction object', async () => {
    mockAnalyzeJobOnly.mockResolvedValue({
      output: SAMPLE_EXTRACTION,
      gemini_usage: { label: 'extract job', costUsd: 0.0001 },
    });

    const { req, res } = mockReqRes({
      method: 'POST',
      cookies: { 'auth-token': authCookieFor(VALID_USER) },
      body: { jobText: 'We are hiring a Senior Backend Engineer with Python and AWS skills in Berlin.' },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();

    // extraction must be the parsed object, not a string
    expect(typeof data.extraction).toBe('object');
    expect(data.extraction).not.toBeNull();

    // all schema keys must be present
    expect(data.extraction).toHaveProperty('position_title');
    expect(data.extraction).toHaveProperty('company');
    expect(data.extraction).toHaveProperty('required_skills');
    expect(data.extraction).toHaveProperty('desired_skills');
    expect(data.extraction).toHaveProperty('must_have_requirements');
    expect(data.extraction).toHaveProperty('nice_to_have');
    expect(data.extraction).toHaveProperty('responsibilities');
    expect(data.extraction).toHaveProperty('keywords_for_ats');
    expect(data.extraction).toHaveProperty('language_requirements');

    // actual values from the mock
    expect(data.extraction.position_title).toBe('Backend Engineer');
    expect(data.extraction.required_skills).toContain('Python');

    // gemini_usage forwarded
    expect(data.gemini_usage).toBeDefined();

    // analyzeJobOnly called with the jobText from the body
    expect(mockAnalyzeJobOnly).toHaveBeenCalledWith(
      'We are hiring a Senior Backend Engineer with Python and AWS skills in Berlin.'
    );
  });

  test('analyzeJobOnly throws → 500 with error message', async () => {
    mockAnalyzeJobOnly.mockRejectedValue(new Error('Job extraction returned invalid JSON'));

    const { req, res } = mockReqRes({
      method: 'POST',
      cookies: { 'auth-token': authCookieFor(VALID_USER) },
      body: { jobText: 'Some job ad text here' },
    });
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toMatchObject({ error: expect.stringContaining('invalid JSON') });
  });
});
