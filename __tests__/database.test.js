// __tests__/database.test.js
// Uses vi.resetModules() + dynamic import per test to bypass the admin-client singleton.

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake.supabase';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';

// We use doMock (not vi.mock) so we can set _adminMock before the mock factory runs.
// vi.resetModules() before each test ensures a fresh module (clearing the singleton).

let _adminMock = null;

beforeEach(() => {
  vi.resetModules();
  _adminMock = null;
  vi.doMock('@supabase/supabase-js', () => ({
    createClient: () => _adminMock,
  }));
});

function makeDeleteMock({ failOn = null } = {}) {
  const calledTables = [];
  const mock = {
    _calledTables: calledTables,
    from(table) {
      return {
        delete() {
          return {
            eq(field, value) {
              calledTables.push(table);
              if (failOn === table) {
                return Promise.resolve({ error: { message: `${table} failed` } });
              }
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return mock;
}

describe('deleteUserData', () => {
  test('happy path: deletes from all five tables in correct order', async () => {
    const adminMock = makeDeleteMock();
    _adminMock = adminMock;
    const { deleteUserData } = await import('../utils/database.js');

    await deleteUserData('uid-123');

    expect(adminMock._calledTables).toEqual(['gen_data', 'cv_data', 'magic_tokens', 'transactions', 'users']);
  });

  test('error on first table (gen_data) propagates and remaining deletes are NOT called', async () => {
    const adminMock = makeDeleteMock({ failOn: 'gen_data' });
    _adminMock = adminMock;
    const { deleteUserData } = await import('../utils/database.js');

    await expect(deleteUserData('uid-123')).rejects.toThrow('gen_data delete failed');
    expect(adminMock._calledTables).toEqual(['gen_data']);
  });
});

describe('saveMasterCv', () => {
  // Builds an admin client whose upsert().select() chain resolves to the given
  // { data, error }. Records the table, the payload, and the conflict options so
  // we can prove the write is an upsert on the user_id PK (cannot silently miss),
  // not a bare update that no-ops when no row matches.
  function makeUpsertMock({ data, error = null }) {
    const calls = {};
    const builder = {
      upsert(rows, opts) { calls.rows = rows; calls.opts = opts; return builder; },
      select() { return Promise.resolve({ data, error }); },
    };
    const fromSpy = vi.fn((table) => { calls.table = table; return builder; });
    return { client: { from: fromSpy }, calls };
  }

  test('writes via upsert on the user_id PK — only user_id + master_cv, so cv_data text is untouched', async () => {
    const { client, calls } = makeUpsertMock({ data: [{ user_id: 'uid-1' }] });
    _adminMock = client;
    const { saveMasterCv } = await import('../utils/database.js');

    const res = await saveMasterCv('uid-1', { voice_samples: ['real quote'] });

    expect(calls.table).toBe('cv_data');
    expect(calls.rows).toEqual([{ user_id: 'uid-1', master_cv: { voice_samples: ['real quote'] } }]);
    expect(calls.opts).toEqual({ onConflict: ['user_id'] });
    expect(res).toEqual([{ user_id: 'uid-1' }]);
  });

  test('throws when the write returns no row (guards against a silent no-op write)', async () => {
    const { client } = makeUpsertMock({ data: [] });
    _adminMock = client;
    const { saveMasterCv } = await import('../utils/database.js');

    await expect(saveMasterCv('uid-1', { candidate_core: 'x' })).rejects.toThrow(/saved nothing/);
  });

  test('throws when Supabase returns an error', async () => {
    const { client } = makeUpsertMock({ data: null, error: { message: 'boom' } });
    _adminMock = client;
    const { saveMasterCv } = await import('../utils/database.js');

    await expect(saveMasterCv('uid-1', {})).rejects.toThrow(/saveMasterCv failed: boom/);
  });
});

describe('upsertCV', () => {
  // upsertCV awaits the upsert directly (no .select()), so the builder's upsert
  // resolves to { data, error }.
  function makeUpsertCVMock({ data = [{ user_id: 'uid-1' }], error = null } = {}) {
    const calls = {};
    const builder = {
      upsert(rows, opts) {
        calls.rows = rows;
        calls.opts = opts;
        return Promise.resolve({ data, error });
      },
    };
    const fromSpy = vi.fn((table) => { calls.table = table; return builder; });
    return { client: { from: fromSpy }, calls };
  }

  test('a new upload nulls master_cv so the stale master is rebuilt from this CV', async () => {
    const { client, calls } = makeUpsertCVMock({});
    _adminMock = client;
    const { upsertCV } = await import('../utils/database.js');

    await upsertCV('uid-1', 'NEW CV TEXT');

    expect(calls.table).toBe('cv_data');
    // The decisive assertion: master_cv is explicitly cleared. Old code wrote
    // only { user_id, cv_data } and left a stale (cleaned/merged) master behind.
    expect(calls.rows).toEqual([{ user_id: 'uid-1', cv_data: 'NEW CV TEXT', master_cv: null }]);
    expect(calls.opts).toEqual({ onConflict: ['user_id'] });
  });

  test('throws when Supabase returns an error', async () => {
    const { client } = makeUpsertCVMock({ data: null, error: { message: 'boom' } });
    _adminMock = client;
    const { upsertCV } = await import('../utils/database.js');

    await expect(upsertCV('uid-1', 'x')).rejects.toThrow(/UpsertCV failed: boom/);
  });
});

describe('getLatestAnalysis', () => {
  test('calls .from(gen_data) with correct user_id and returns content', async () => {
    const fromSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { content: '{"score":90}' }, error: null }),
    });
    _adminMock = { from: fromSpy };
    const { getLatestAnalysis } = await import('../utils/database.js');

    const result = await getLatestAnalysis('uid-xyz');

    expect(fromSpy).toHaveBeenCalledWith('gen_data');
    expect(result).toEqual({ content: '{"score":90}' });
  });
});

// getGeneratedDocs feeds the viewer's version history on reload. It used to
// return only the newest CV and cover, so a refresh silently discarded every
// earlier version the user had not downloaded — this pins the full list, and
// the oldest-first order the version arrays are built in.
describe('getGeneratedDocs', () => {
  function makeSelectMock(rows) {
    const calls = {};
    const chain = {
      select() { return chain; },
      eq(field, value) { calls.eq = [field, value]; return chain; },
      in(field, values) { calls.in = [field, values]; return chain; },
      order(field, opts) { calls.order = [field, opts]; return chain; },
      limit(n) { calls.limit = n; return Promise.resolve({ data: rows, error: null }); },
    };
    return {
      _calls: calls,
      from(table) { calls.table = table; return chain; },
    };
  }

  test('returns every CV and cover, oldest first, scoped to the user', async () => {
    // The query asks newest-first; the helper flips it.
    _adminMock = makeSelectMock([
      { type: 'cv', content: 'cv v2', created_at: '2026-08-13T10:00:00Z' },
      { type: 'cover', content: 'cover v1', created_at: '2026-08-13T09:00:00Z' },
      { type: 'cv', content: 'cv v1', created_at: '2026-08-13T08:00:00Z' },
    ]);
    const { getGeneratedDocs } = await import('../utils/database.js');

    const docs = await getGeneratedDocs('user-1');

    expect(docs.map((d) => d.content)).toEqual(['cv v1', 'cover v1', 'cv v2']);
    expect(_adminMock._calls.table).toBe('gen_data');
    expect(_adminMock._calls.eq).toEqual(['user_id', 'user-1']);
    expect(_adminMock._calls.in).toEqual(['type', ['cv', 'cover']]);
  });

  test('an empty history is an empty list, not a throw', async () => {
    _adminMock = makeSelectMock(null);
    const { getGeneratedDocs } = await import('../utils/database.js');
    await expect(getGeneratedDocs('user-1')).resolves.toEqual([]);
  });
});
