// __tests__/helpers.js — shared test helpers for route tests

import { createRequest, createResponse } from 'node-mocks-http';

// JWT_SECRET must be set by the test before importing auth; helpers work with whatever is set
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-helper-secret';

import { mintSessionToken } from '../lib/auth.js';

/**
 * Build a node-mocks-http req/res pair.
 * cookies is an object of name → value (string values, pre-signed by caller).
 */
export function mockReqRes({ method = 'GET', cookies = {}, body = {}, query = {} } = {}) {
  const req = createRequest({ method, cookies, body, query });
  const res = createResponse();
  return { req, res };
}

/**
 * Chainable fake Supabase client.
 *
 * tables: { tableName: { rows: [...], insertError: null, updateError: null, rpcResult: any } }
 *
 * Tracks inserts and updates for assertion:
 *   mock.inserts['tableName']  → array of inserted rows
 *   mock.updates['tableName']  → array of { values, eq: [field, value] }
 */
export function makeSupabaseMock(tables = {}) {
  const inserts = {};
  const updates = {};

  function makeChain(tableName) {
    const tableConf = tables[tableName] || { rows: [] };
    let filteredRows = [...(tableConf.rows || [])];
    let eqFilters = [];

    const chain = {
      select(/* _cols */) { return chain; },
      eq(field, value) {
        eqFilters.push([field, value]);
        filteredRows = filteredRows.filter(r => r[field] === value);
        return chain;
      },
      maybeSingle() {
        return Promise.resolve({ data: filteredRows[0] ?? null, error: null });
      },
      single() {
        const data = filteredRows[0] ?? null;
        const error = data ? null : { message: 'no rows' };
        return Promise.resolve({ data, error });
      },
      limit(/* n */) { return chain; },
      order(/* col, opts */) { return chain; },
      in(field, values) {
        filteredRows = filteredRows.filter(r => values.includes(r[field]));
        return chain;
      },
      insert(rows) {
        inserts[tableName] = inserts[tableName] || [];
        const arr = Array.isArray(rows) ? rows : [rows];
        inserts[tableName].push(...arr);
        return Promise.resolve({ data: arr, error: tableConf.insertError ?? null });
      },
      upsert(rows) {
        inserts[tableName] = inserts[tableName] || [];
        const arr = Array.isArray(rows) ? rows : [rows];
        inserts[tableName].push(...arr);
        return Promise.resolve({ data: arr, error: tableConf.insertError ?? null });
      },
      update(values) {
        updates[tableName] = updates[tableName] || [];
        const entry = { values, eq: null };
        updates[tableName].push(entry);
        // return a sub-chain so .eq() after update() is recorded
        return {
          eq(field, value) {
            entry.eq = [field, value];
            return Promise.resolve({ data: null, error: tableConf.updateError ?? null });
          },
        };
      },
    };
    return chain;
  }

  const client = {
    inserts,
    updates,
    from(tableName) { return makeChain(tableName); },
    rpc(name, params) {
      const tableConf = tables[`rpc:${name}`];
      if (tableConf) return Promise.resolve({ data: tableConf.result ?? null, error: tableConf.error ?? null });
      return Promise.resolve({ data: null, error: null });
    },
  };

  return client;
}

/**
 * Returns a valid signed auth-token cookie value for the given user_id.
 * Relies on JWT_SECRET being set (set above or by the test).
 */
export function authCookieFor(user_id, email = null) {
  return mintSessionToken({ user_id, email });
}
