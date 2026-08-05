// utils/user-identity.test.js
//
// One account per email, and no write ever blanks an account that already
// exists. These pin the real behaviour of the users-table helpers against a
// stubbed Supabase client (the external boundary — the helpers themselves are
// the units under test).

import { describe, test, expect, beforeEach, vi } from 'vitest';

const calls = vi.hoisted(() => ({ upsert: [], update: [], insert: [], eq: [] }));
const results = vi.hoisted(() => ({ update: null, insert: null, select: null }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      upsert: (rows, opts) => {
        calls.upsert.push({ rows, opts });
        return { select: () => ({ data: rows, error: null }) };
      },
      update: (payload) => {
        calls.update.push(payload);
        return {
          eq: (col, val) => {
            calls.eq.push({ col, val });
            // Awaited directly by callers that don't .select(), so it must
            // carry { error } itself as the real client does.
            return { select: () => results.update, error: results.update?.error ?? null };
          },
        };
      },
      insert: (rows) => {
        calls.insert.push(rows);
        return {
          select: () => ({
            maybeSingle: () => results.insert,
            ...results.insert,
          }),
        };
      },
      select: () => ({
        eq: () => ({ order: () => ({ limit: () => results.select }) }),
      }),
    }),
  }),
}));

import { upsertUser, updateUserEmail, createUserWithEmail, resetFreeGenerations } from './database.js';

beforeEach(() => {
  calls.upsert.length = 0;
  calls.update.length = 0;
  calls.insert.length = 0;
  calls.eq.length = 0;
  results.update = { data: [], error: null };
  results.insert = { data: null, error: null };
  results.select = { data: [], error: null };
});

describe('upsertUser — never blanks an existing account', () => {
  test('a CV upload (user_id only) does NOT write email or phone_hash', async () => {
    await upsertUser('user-1');

    expect(calls.upsert).toHaveLength(1);
    const row = calls.upsert[0].rows[0];
    expect(row).toEqual({ user_id: 'user-1' });
    // The regression: sending email:null upserted a null over the stored email.
    expect('email' in row).toBe(false);
    expect('phone_hash' in row).toBe(false);
  });

  test('supplied fields ARE written, and email is normalised', async () => {
    await upsertUser('user-2', 'hash-abc', '  CV48@Nik.Page ');

    const row = calls.upsert[0].rows[0];
    expect(row.user_id).toBe('user-2');
    expect(row.phone_hash).toBe('hash-abc');
    expect(row.email).toBe('cv48@nik.page');
  });

  test('conflicts on user_id so an upload never mints a second row', async () => {
    await upsertUser('user-3');
    expect(calls.upsert[0].opts).toEqual({ onConflict: 'user_id' });
  });
});

describe('updateUserEmail — the write must actually land', () => {
  test('normalises and returns the updated row', async () => {
    results.update = { data: [{ user_id: 'user-1', email: 'cv48@nik.page' }], error: null };

    const row = await updateUserEmail('user-1', 'CV48@Nik.Page');

    expect(calls.update[0]).toEqual({ email: 'cv48@nik.page' });
    expect(calls.eq[0]).toEqual({ col: 'user_id', val: 'user-1' });
    expect(row).toEqual({ user_id: 'user-1', email: 'cv48@nik.page' });
    expect(calls.insert).toHaveLength(0);
  });

  test('a user_id with no row is created instead of silently dropping the email', async () => {
    // Supabase reports NO error when an UPDATE matches zero rows — the old code
    // returned happily and the account never existed.
    results.update = { data: [], error: null };
    results.insert = { data: { user_id: 'ghost', email: 'cv48@nik.page' }, error: null };

    const row = await updateUserEmail('ghost', 'cv48@nik.page');

    expect(calls.insert).toHaveLength(1);
    expect(calls.insert[0][0]).toEqual({ user_id: 'ghost', email: 'cv48@nik.page' });
    expect(row).toEqual({ user_id: 'ghost', email: 'cv48@nik.page' });
  });

  test('a real update error is surfaced, not swallowed', async () => {
    results.update = { data: null, error: { message: 'boom' } };
    await expect(updateUserEmail('user-1', 'a@b.com')).rejects.toBeTruthy();
  });
});

describe('resetFreeGenerations — a blocked refill must not pass silently', () => {
  test('writes the allowance for that user', async () => {
    results.update = { data: [{ user_id: 'user-1' }], error: null };

    await resetFreeGenerations('user-1', 3);

    expect(calls.update[0]).toEqual({ generations_left: 3 });
    expect(calls.eq[0]).toEqual({ col: 'user_id', val: 'user-1' });
  });

  test('throws when the write is rejected', async () => {
    // The old call site wrapped an anon-client update in try/catch, but Supabase
    // RESOLVES with { error } rather than throwing — so the catch never ran and
    // the user silently never got their generations back.
    results.update = { data: null, error: { message: 'permission denied' } };

    await expect(resetFreeGenerations('user-1', 3)).rejects.toThrow(/permission denied/);
  });
});

describe('createUserWithEmail — one account per email', () => {
  test('stores the normalised address', async () => {
    results.insert = { data: { user_id: 'new-1' }, error: null };

    const created = await createUserWithEmail('  CV48@Nik.Page ');

    expect(calls.insert[0][0].email).toBe('cv48@nik.page');
    expect(created.user_id).toBe('new-1');
  });

  test('a unique-violation race adopts the existing account instead of duplicating', async () => {
    results.insert = { data: null, error: { code: '23505', message: 'duplicate key' } };
    results.select = { data: [{ user_id: 'original', email: 'cv48@nik.page' }], error: null };

    const created = await createUserWithEmail('cv48@nik.page');

    expect(created).toEqual({ user_id: 'original' });
  });

  test('any other insert error still throws', async () => {
    results.insert = { data: null, error: { code: '42501', message: 'denied' } };
    await expect(createUserWithEmail('a@b.com')).rejects.toThrow(/denied/);
  });
});
