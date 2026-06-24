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
  // Builds an admin client whose update().eq().select() chain resolves to the
  // given { data, error }. Records the table and the values passed to update().
  function makeUpdateMock({ data, error = null }) {
    const calls = {};
    const builder = {
      update(values) { calls.values = values; return builder; },
      eq(field, value) { calls.eq = [field, value]; return builder; },
      select() { return Promise.resolve({ data, error }); },
    };
    const fromSpy = vi.fn((table) => { calls.table = table; return builder; });
    return { client: { from: fromSpy }, calls };
  }

  test('throws when the update matches no row (the silent no-op that leaves master_cv null)', async () => {
    const { client, calls } = makeUpdateMock({ data: [] });
    _adminMock = client;
    const { saveMasterCv } = await import('../utils/database.js');

    await expect(saveMasterCv('uid-1', { candidate_core: 'x' })).rejects.toThrow(/saved nothing/);
    // It still aimed the write at the right place — the bug is zero rows, not a bad query.
    expect(calls.table).toBe('cv_data');
    expect(calls.values).toEqual({ master_cv: { candidate_core: 'x' } });
    expect(calls.eq).toEqual(['user_id', 'uid-1']);
  });

  test('persists and returns the updated row when one matches', async () => {
    const { client, calls } = makeUpdateMock({ data: [{ user_id: 'uid-1' }] });
    _adminMock = client;
    const { saveMasterCv } = await import('../utils/database.js');

    const res = await saveMasterCv('uid-1', { voice_samples: ['real quote'] });

    expect(res).toEqual([{ user_id: 'uid-1' }]);
    expect(calls.values).toEqual({ master_cv: { voice_samples: ['real quote'] } });
  });

  test('throws when Supabase returns an error', async () => {
    const { client } = makeUpdateMock({ data: null, error: { message: 'boom' } });
    _adminMock = client;
    const { saveMasterCv } = await import('../utils/database.js');

    await expect(saveMasterCv('uid-1', {})).rejects.toThrow(/saveMasterCv failed: boom/);
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
