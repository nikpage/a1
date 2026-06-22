// __tests__/uploadAndAnalyze.test.js

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
});

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// uploadAndAnalyze reads localStorage; stub the global
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

import { uploadAndAnalyze } from '../utils/uploadAndAnalyze.js';

const SAMPLE_EXTRACTION = {
  position_title: 'Engineer',
  company: 'Acme',
  hr_contact: '',
  location: 'Berlin',
  seniority: 'Mid',
  employment_type: 'Full-time',
  salary: '',
  required_skills: ['Python'],
  desired_skills: [],
  must_have_requirements: [],
  nice_to_have: [],
  responsibilities: [],
  keywords_for_ats: [],
  language_requirements: [],
};

function makeFetchStub(calls) {
  // calls: array of {url, response} to match in order per URL
  const counters = {};
  return vi.fn((url) => {
    const key = typeof url === 'string' ? url : url.toString();
    counters[key] = (counters[key] || 0) + 1;
    const match = calls.find(c => key.includes(c.url));
    if (!match) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    if (match.response instanceof Error) return Promise.reject(match.response);
    return Promise.resolve(match.response);
  });
}

beforeEach(() => {
  localStorageMock.clear();
  localStorageMock.setItem('user_id', 'user-upload-test');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadAndAnalyze — cancel path', () => {
  test('onJobExtracted returns null → analyse-background never called', async () => {
    const fetchStub = makeFetchStub([
      {
        url: '/api/extract-job',
        response: {
          ok: true,
          status: 200,
          json: async () => ({ extraction: SAMPLE_EXTRACTION, gemini_usage: null }),
        },
      },
      // /.netlify/functions/analyse-background should NOT be reached
    ]);
    vi.stubGlobal('fetch', fetchStub);

    await expect(
      uploadAndAnalyze({
        file: null,
        jobText: 'We are hiring a Python engineer in Berlin.',
        user_id: 'user-upload-test',
        onJobExtracted: async () => null,
      })
    ).rejects.toMatchObject({ cancelled: true });

    const calls = fetchStub.mock.calls.map(c => c[0]);
    expect(calls.some(u => u.includes('analyse-background'))).toBe(false);
  });

  test('onJobExtracted throws → analyse-background never called', async () => {
    const fetchStub = makeFetchStub([
      {
        url: '/api/extract-job',
        response: {
          ok: true,
          status: 200,
          json: async () => ({ extraction: SAMPLE_EXTRACTION, gemini_usage: null }),
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    const cancelErr = new Error('user hit cancel');
    cancelErr.cancelled = true;

    await expect(
      uploadAndAnalyze({
        file: null,
        jobText: 'Some job ad text',
        user_id: 'user-upload-test',
        onJobExtracted: async () => { throw cancelErr; },
      })
    ).rejects.toMatchObject({ cancelled: true });

    const calls = fetchStub.mock.calls.map(c => c[0]);
    expect(calls.some(u => u.includes('analyse-background'))).toBe(false);
  });
});

describe('uploadAndAnalyze — no-jobText path', () => {
  test('no jobText → /api/extract-job not called, analyse-background called directly', async () => {
    const fetchStub = makeFetchStub([
      {
        url: '/.netlify/functions/analyse-background',
        response: { ok: true, status: 202, json: async () => ({}) },
      },
      {
        url: '/api/get-analysis-status',
        response: {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'done',
            analysis: JSON.stringify({ cv_data: {}, job_data: {}, job_match: {} }),
            gemini_usage: null,
          }),
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    const result = await uploadAndAnalyze({
      file: null,
      jobText: '',
      user_id: 'user-upload-test',
    });

    const calls = fetchStub.mock.calls.map(c => c[0]);
    expect(calls.some(u => u.includes('extract-job'))).toBe(false);
    expect(calls.some(u => u.includes('analyse-background'))).toBe(true);
    expect(result).toHaveProperty('analysis');
  });

  test('undefined jobText → /api/extract-job not called', async () => {
    const fetchStub = makeFetchStub([
      {
        url: '/.netlify/functions/analyse-background',
        response: { ok: true, status: 202, json: async () => ({}) },
      },
      {
        url: '/api/get-analysis-status',
        response: {
          ok: true,
          status: 200,
          json: async () => ({
            status: 'done',
            analysis: JSON.stringify({ cv_data: {} }),
            gemini_usage: null,
          }),
        },
      },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    await uploadAndAnalyze({
      file: null,
      user_id: 'user-upload-test',
    });

    const calls = fetchStub.mock.calls.map(c => c[0]);
    expect(calls.some(u => u.includes('extract-job'))).toBe(false);
  });
});

describe('uploadAndAnalyze — with jobText and onJobExtracted confirm', () => {
  test('confirmed job flows through to analyse-background body', async () => {
    const confirmedJob = { ...SAMPLE_EXTRACTION, company: 'Confirmed Corp' };

    let backgroundBody;
    const fetchStub = vi.fn(async (url, opts) => {
      if (url.includes('extract-job')) {
        return { ok: true, status: 200, json: async () => ({ extraction: SAMPLE_EXTRACTION, gemini_usage: null }) };
      }
      if (url.includes('analyse-background')) {
        backgroundBody = JSON.parse(opts.body);
        return { ok: true, status: 202, json: async () => ({}) };
      }
      if (url.includes('get-analysis-status')) {
        return {
          ok: true, status: 200,
          json: async () => ({ status: 'done', analysis: JSON.stringify({ cv_data: {} }), gemini_usage: null }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchStub);

    await uploadAndAnalyze({
      file: null,
      jobText: 'We are hiring a Python engineer.',
      user_id: 'user-upload-test',
      onJobExtracted: async () => confirmedJob,
    });

    expect(backgroundBody).toBeDefined();
    expect(backgroundBody.confirmedJob).toMatchObject({ company: 'Confirmed Corp' });
  });
});
