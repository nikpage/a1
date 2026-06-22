// __tests__/fetch-job-url.test.js

vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-fetch-job-url-secret';
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
});

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockReqRes, authCookieFor } from './helpers.js';

// Stub supabase-js so database.js can import without network calls
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));

import handler from '../pages/api/fetch-job-url.js';

const VALID_USER = 'user-fetch-test-001';

function makeFetchMock(opts = {}) {
  const {
    contentType = 'text/html; charset=utf-8',
    body = '<html><head><title>Test</title></head><body><h1>Senior Engineer</h1><p>We are hiring a backend engineer. Requirements: Python, AWS, 5+ years. Responsibilities include building scalable APIs and mentoring junior devs. We offer competitive salary and remote work.</p></body></html>',
    throws = null,
  } = opts;

  if (throws) return vi.fn().mockRejectedValue(throws);

  return vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: (name) => name === 'content-type' ? contentType : null },
    text: async () => body,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/fetch-job-url', () => {
  describe('method guard', () => {
    test('GET (authenticated) → 405', async () => {
      // requireAuth passes; the handler's own method guard must return 405
      const { req, res } = mockReqRes({
        method: 'GET',
        cookies: { 'auth-token': authCookieFor(VALID_USER) },
      });
      await handler(req, res);
      expect(res.statusCode).toBe(405);
      expect(res._getJSONData()).toMatchObject({ error: expect.any(String) });
    });
  });

  describe('no auth required (public route)', () => {
    test('no cookie → handler runs, fetch is called', async () => {
      const mockFetch = makeFetchMock();
      vi.stubGlobal('fetch', mockFetch);

      const { req, res } = mockReqRes({ method: 'POST', cookies: {}, body: { url: 'https://example.com/job' } });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });

    test('invalid token → handler runs, fetch is called', async () => {
      const mockFetch = makeFetchMock();
      vi.stubGlobal('fetch', mockFetch);

      const { req, res } = mockReqRes({
        method: 'POST',
        cookies: { 'auth-token': 'bad.jwt.token' },
        body: { url: 'https://example.com/job' },
      });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('SSRF guard (authenticated)', () => {
    const ssrfCases = [
      ['localhost', 'http://localhost/admin'],
      ['127.0.0.1', 'http://127.0.0.1/secret'],
      ['169.254.169.254 (metadata)', 'http://169.254.169.254/latest/meta-data/'],
      ['192.168.0.1 (private)', 'http://192.168.0.1/'],
      ['[::1] IPv6 loopback (bracket notation)', 'http://[::1]/secret'],
    ];

    ssrfCases.forEach(([label, url]) => {
      test(`${label} → 400, fetch never called`, async () => {
        const mockFetch = makeFetchMock();
        vi.stubGlobal('fetch', mockFetch);

        const { req, res } = mockReqRes({
          method: 'POST',
          cookies: { 'auth-token': authCookieFor(VALID_USER) },
          body: { url },
        });
        await handler(req, res);

        expect(res.statusCode).toBe(400);
        expect(res._getJSONData()).toMatchObject({ error: expect.stringContaining('not allowed') });
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    test('file:// scheme → 400, fetch never called', async () => {
      const mockFetch = makeFetchMock();
      vi.stubGlobal('fetch', mockFetch);

      const { req, res } = mockReqRes({
        method: 'POST',
        cookies: { 'auth-token': authCookieFor(VALID_USER) },
        body: { url: 'file:///etc/passwd' },
      });
      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    test('valid public URL → 200 with stripped text containing visible content', async () => {
      vi.stubGlobal('fetch', makeFetchMock());

      const { req, res } = mockReqRes({
        method: 'POST',
        cookies: { 'auth-token': authCookieFor(VALID_USER) },
        body: { url: 'https://jobs.example.com/role/123' },
      });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(typeof data.text).toBe('string');
      // Contains visible body text
      expect(data.text).toContain('Senior Engineer');
      expect(data.text).toContain('Python');
      // Does not contain HTML tags
      expect(data.text).not.toMatch(/<[^>]+>/);
      // Does not contain script/style block contents (none in this mock, but structure is correct)
      expect(data.text.length).toBeGreaterThan(50);
    });

    test('HTML with script and style blocks — stripped text excludes their contents', async () => {
      const htmlWithNoise = `<html>
        <head><title>Job</title><style>.hidden{display:none}</style></head>
        <body>
          <nav>Menu stuff</nav>
          <header>Site header</header>
          <main>
            <h1>Backend Engineer</h1>
            <p>Join our team. You will work with Go, Kubernetes, and PostgreSQL. Must have 3+ years experience. We offer €80k-€100k salary and 30 days holiday plus remote work options available immediately.</p>
          </main>
          <script>trackUser()</script>
          <footer>Footer content</footer>
        </body>
      </html>`;

      vi.stubGlobal('fetch', makeFetchMock({ body: htmlWithNoise }));

      const { req, res } = mockReqRes({
        method: 'POST',
        cookies: { 'auth-token': authCookieFor(VALID_USER) },
        body: { url: 'https://jobs.example.com/be' },
      });
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const { text } = res._getJSONData();
      expect(text).toContain('Backend Engineer');
      expect(text).toContain('Go');
      // Script content removed
      expect(text).not.toContain('trackUser');
      // Style content removed
      expect(text).not.toContain('display:none');
      // Nav/header/footer removed
      expect(text).not.toContain('Menu stuff');
      expect(text).not.toContain('Site header');
      expect(text).not.toContain('Footer content');
    });
  });

  describe('bot wall / tiny response', () => {
    test('page with < 200 chars of text → 422', async () => {
      vi.stubGlobal('fetch', makeFetchMock({ body: '<html><body>Access denied. Please enable JavaScript.</body></html>' }));

      const { req, res } = mockReqRes({
        method: 'POST',
        cookies: { 'auth-token': authCookieFor(VALID_USER) },
        body: { url: 'https://jobs.example.com/blocked' },
      });
      await handler(req, res);

      expect(res.statusCode).toBe(422);
      expect(res._getJSONData()).toMatchObject({ error: expect.stringContaining('bot wall') });
    });
  });

  describe('network failures', () => {
    test('fetch timeout (AbortError) → 504 with error, no uncaught throw', async () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      vi.stubGlobal('fetch', makeFetchMock({ throws: abortErr }));

      const { req, res } = mockReqRes({
        method: 'POST',
        cookies: { 'auth-token': authCookieFor(VALID_USER) },
        body: { url: 'https://slow.example.com/job' },
      });
      await expect(handler(req, res)).resolves.not.toThrow();

      expect(res.statusCode).toBe(504);
      expect(res._getJSONData()).toMatchObject({ error: expect.stringContaining('timed out') });
    });

    test('fetch throws non-abort error → 502 with error, no uncaught throw', async () => {
      vi.stubGlobal('fetch', makeFetchMock({ throws: new Error('ECONNREFUSED') }));

      const { req, res } = mockReqRes({
        method: 'POST',
        cookies: { 'auth-token': authCookieFor(VALID_USER) },
        body: { url: 'https://unreachable.example.com/' },
      });
      await expect(handler(req, res)).resolves.not.toThrow();

      expect(res.statusCode).toBe(502);
      expect(res._getJSONData()).toMatchObject({ error: expect.any(String) });
    });

    test('non-HTML content-type → 400', async () => {
      vi.stubGlobal('fetch', makeFetchMock({ contentType: 'application/json' }));

      const { req, res } = mockReqRes({
        method: 'POST',
        cookies: { 'auth-token': authCookieFor(VALID_USER) },
        body: { url: 'https://api.example.com/job.json' },
      });
      await handler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData()).toMatchObject({ error: expect.stringContaining('HTML') });
    });
  });
});
