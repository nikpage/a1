// __tests__/download-token-check.test.js — the download credit is spent ONLY
// when the user actually receives their .docx.

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-download-secret';
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRequest, createResponse } from 'node-mocks-http';

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }));

const mockConsumeDownloadCredit = vi.hoisted(() => vi.fn());
const mockTopUpFreeGenerations  = vi.hoisted(() => vi.fn());

vi.mock('../utils/database', () => ({
  consumeDownloadCredit: mockConsumeDownloadCredit,
  topUpFreeGenerations: mockTopUpFreeGenerations,
}));

vi.mock('../lib/requireAuth', () => ({ default: (handler) => handler }));

// Real docx is used everywhere except where a test explicitly forces a build
// failure — the packer is the external boundary being stubbed.
const mockToBuffer = vi.hoisted(() => vi.fn());
vi.mock('docx', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Packer: { toBuffer: (...args) => mockToBuffer(...args) },
  };
});

import { Packer } from 'docx';
import handler from '../pages/api/download-token-check.js';

const FAKE_USER_ID = 'user-dl-123';

function makeReq(body = { type: 'cv', content: 'John Smith — Software Engineer' }) {
  const req = createRequest({ method: 'POST', body });
  req.user = { user_id: FAKE_USER_ID };
  return req;
}

beforeEach(async () => {
  vi.clearAllMocks();
  const actual = await vi.importActual('docx');
  mockToBuffer.mockImplementation((doc) => actual.Packer.toBuffer(doc));
  mockConsumeDownloadCredit.mockResolvedValue('free');
  mockTopUpFreeGenerations.mockResolvedValue();
});

describe('download-token-check ordering', () => {
  test('docx build failure returns 500 and never spends a credit', async () => {
    mockToBuffer.mockRejectedValue(new Error('packer exploded'));
    const req = makeReq();
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toEqual({ error: 'File generation failed.' });
    expect(mockConsumeDownloadCredit).not.toHaveBeenCalled();
    expect(mockTopUpFreeGenerations).not.toHaveBeenCalled();
  });

  test("credit 'none' returns 402 and sends no file", async () => {
    mockConsumeDownloadCredit.mockResolvedValue('none');
    const req = makeReq();
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(402);
    expect(res._getJSONData()).toEqual({ error: 'INSUFFICIENT_TOKENS' });
    expect(res.getHeader('Content-Disposition')).toBeUndefined();
    expect(mockTopUpFreeGenerations).not.toHaveBeenCalled();
  });

  test('happy path: 200 with real docx bytes, credit consumed exactly once', async () => {
    const req = makeReq();
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockConsumeDownloadCredit).toHaveBeenCalledTimes(1);
    expect(mockConsumeDownloadCredit).toHaveBeenCalledWith(FAKE_USER_ID);
    expect(res.getHeader('Content-Disposition')).toBe('attachment; filename="CV.docx"');

    const sent = res._getData();
    const bytes = Buffer.isBuffer(sent) ? sent : Buffer.from(sent);
    expect(bytes.length).toBeGreaterThan(0);
    // .docx is a zip — PK\x03\x04 magic bytes prove real document bytes went out.
    expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  });

  test('top-up failure is non-fatal: user still gets 200 and the file', async () => {
    mockTopUpFreeGenerations.mockRejectedValue(new Error('top_up_generations failed'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = makeReq();
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const bytes = Buffer.from(res._getData());
    expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(mockConsumeDownloadCredit).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
