// __tests__/analyse-background.test.js — Task 1.8: auth cookie gate on background function

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-bg-secret-99';
  process.env.NODE_ENV = 'test';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

const mockVerifyToken = vi.hoisted(() => vi.fn());
const mockAnalyzeCvJob = vi.hoisted(() => vi.fn());
const mockSaveGeneratedDoc = vi.hoisted(() => vi.fn());
const mockLogAiTransaction = vi.hoisted(() => vi.fn());
const mockSupabaseFrom = vi.hoisted(() => vi.fn());

vi.mock('../lib/auth.js', () => ({
  verifyToken: mockVerifyToken,
}));

vi.mock('../utils/openai.js', () => ({
  analyzeCvJob: mockAnalyzeCvJob,
}));

vi.mock('../utils/database.js', () => ({
  saveGeneratedDoc: mockSaveGeneratedDoc,
  logAiTransaction: mockLogAiTransaction,
  supabase: {
    from: mockSupabaseFrom,
  },
}));

import { handler } from '../netlify/functions/analyse-background.mjs';

function makeEvent({ cookieHeader = '', body = {} } = {}) {
  return {
    headers: { cookie: cookieHeader },
    body: JSON.stringify(body),
  };
}

describe('analyse-background — auth gate', () => {
  beforeEach(() => {
    mockVerifyToken.mockReset();
    mockAnalyzeCvJob.mockReset();
    mockSaveGeneratedDoc.mockReset();
    mockLogAiTransaction.mockReset();
    mockSupabaseFrom.mockReset();
  });

  test('no cookie → 401 and analyzeCvJob never called and nothing written', async () => {
    mockVerifyToken.mockResolvedValue(null);

    const result = await handler(makeEvent({ cookieHeader: '', body: { analysis_id: 'aid-1' } }));

    expect(result.statusCode).toBe(401);
    expect(mockAnalyzeCvJob).not.toHaveBeenCalled();
    expect(mockSaveGeneratedDoc).not.toHaveBeenCalled();
  });

  test('invalid/tampered token → 401 and nothing called', async () => {
    mockVerifyToken.mockResolvedValue(null);

    const result = await handler(makeEvent({
      cookieHeader: 'auth-token=bad.jwt.token',
      body: { analysis_id: 'aid-2' },
    }));

    expect(result.statusCode).toBe(401);
    expect(mockAnalyzeCvJob).not.toHaveBeenCalled();
    expect(mockSaveGeneratedDoc).not.toHaveBeenCalled();
  });

  test('valid cookie uses token user_id even when body contains a different user_id', async () => {
    const TOKEN_USER = 'user-from-token';
    const BODY_USER = 'user-from-body-attacker';

    mockVerifyToken.mockResolvedValue({ user_id: TOKEN_USER });

    // Stub supabase chain: return cv_data so the handler proceeds to analyzeCvJob
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ cv_data: 'CV text' }], error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    mockAnalyzeCvJob.mockResolvedValue({
      output: 'analysis result',
      gemini_usage: null,
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });
    mockSaveGeneratedDoc.mockResolvedValue(null);
    mockLogAiTransaction.mockResolvedValue(null);

    const result = await handler(makeEvent({
      cookieHeader: 'auth-token=valid.jwt.here',
      body: {
        user_id: BODY_USER,  // attacker-supplied — must be ignored
        analysis_id: 'aid-3',
        jobText: 'some job',
      },
    }));

    expect(result.statusCode).toBe(202);

    // saveGeneratedDoc must have been called with the TOKEN's user_id, not the body's
    expect(mockSaveGeneratedDoc).toHaveBeenCalled();
    const savedWith = mockSaveGeneratedDoc.mock.calls[0][0];
    expect(savedWith.user_id).toBe(TOKEN_USER);
    expect(savedWith.user_id).not.toBe(BODY_USER);

    // supabase.from query must have used the token's user_id
    expect(chain.eq).toHaveBeenCalledWith('user_id', TOKEN_USER);
    const eqCalls = chain.eq.mock.calls.map(c => c[1]);
    expect(eqCalls).not.toContain(BODY_USER);
  });
});

describe('analyse-background — confirmed job override', () => {
  beforeEach(() => {
    mockVerifyToken.mockReset();
    mockAnalyzeCvJob.mockReset();
    mockSaveGeneratedDoc.mockReset();
    mockLogAiTransaction.mockReset();
    mockSupabaseFrom.mockReset();
  });

  // This test MUST fail on old code (before confirmedJob override was added) and
  // pass after: it asserts that the saved content carries the user's edited
  // job_extraction values, not whatever the AI emitted in the analysis output.
  test('confirmedJob overrides AI-emitted job_extraction in the saved doc', async () => {
    const USER = 'user-confirmed-job-test';
    mockVerifyToken.mockResolvedValue({ user_id: USER });

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ cv_data: 'CV text here' }], error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    // AI emits its own job_extraction (with wrong company the user corrected)
    const aiEmittedAnalysis = JSON.stringify({
      job_match: { score: 85 },
      job_extraction: {
        position_title: 'Engineer',
        company: 'WRONG Corp',       // AI got this wrong
        required_skills: ['Python'],
      },
    });

    mockAnalyzeCvJob.mockResolvedValue({
      output: aiEmittedAnalysis,
      gemini_usage: { label: 'analyze CV+job', model: 'gemini-3.5-flash', costUsd: 0.001 },
      usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
    });
    mockSaveGeneratedDoc.mockResolvedValue(null);
    mockLogAiTransaction.mockResolvedValue(null);

    const confirmedJob = {
      position_title: 'Senior Engineer',
      company: 'Correct Corp',       // user corrected this
      hr_contact: '',
      location: 'Berlin',
      seniority: 'Senior',
      employment_type: 'Full-time',
      salary: '€90k',
      required_skills: ['Python', 'AWS'],
      desired_skills: [],
      must_have_requirements: [],
      nice_to_have: [],
      responsibilities: [],
      keywords_for_ats: [],
      language_requirements: [],
    };

    const result = await handler(makeEvent({
      cookieHeader: 'auth-token=valid.jwt.here',
      body: {
        analysis_id: 'aid-override-1',
        confirmedJob,
      },
    }));

    expect(result.statusCode).toBe(202);
    expect(mockSaveGeneratedDoc).toHaveBeenCalled();

    const savedContent = mockSaveGeneratedDoc.mock.calls[0][0].content;
    const parsed = JSON.parse(savedContent);

    // job_extraction must reflect the user's confirmed values, not the AI's
    expect(parsed.job_extraction.company).toBe('Correct Corp');
    expect(parsed.job_extraction.company).not.toBe('WRONG Corp');
    expect(parsed.job_extraction.position_title).toBe('Senior Engineer');
    expect(parsed.job_extraction.required_skills).toContain('AWS');

    // company/job_title metadata on the saved doc must also use confirmed values
    const savedMeta = mockSaveGeneratedDoc.mock.calls[0][0];
    expect(savedMeta.company).toBe('Correct Corp');
    expect(savedMeta.job_title).toBe('Senior Engineer');
  });

  test('no confirmedJob → AI-emitted job_extraction is preserved as-is', async () => {
    const USER = 'user-no-confirmed-test';
    mockVerifyToken.mockResolvedValue({ user_id: USER });

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ cv_data: 'CV text' }], error: null }),
    };
    mockSupabaseFrom.mockReturnValue(chain);

    const aiEmittedAnalysis = JSON.stringify({
      job_extraction: { company: 'AI Corp', position_title: 'Dev' },
    });

    mockAnalyzeCvJob.mockResolvedValue({
      output: aiEmittedAnalysis,
      gemini_usage: null,
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });
    mockSaveGeneratedDoc.mockResolvedValue(null);
    mockLogAiTransaction.mockResolvedValue(null);

    await handler(makeEvent({
      cookieHeader: 'auth-token=valid.jwt.here',
      body: { analysis_id: 'aid-no-override', jobText: 'some job ad' },
    }));

    const savedContent = mockSaveGeneratedDoc.mock.calls[0][0].content;
    const parsed = JSON.parse(savedContent);
    // AI's extraction is kept when there is no confirmedJob
    expect(parsed.job_extraction.company).toBe('AI Corp');
  });
});
