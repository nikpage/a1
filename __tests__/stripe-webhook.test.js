// __tests__/stripe-webhook.test.js — Task 1.4: Stripe webhook idempotency + RPC credit

vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
  process.env.NODE_ENV = 'test';
});

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRequest, createResponse } from 'node-mocks-http';

const mockConstructEvent = vi.hoisted(() => vi.fn());
const mockRedisSet = vi.hoisted(() => vi.fn());
const mockRedisDel = vi.hoisted(() => vi.fn());
const mockAddTokens = vi.hoisted(() => vi.fn());

vi.mock('stripe', () => ({
  default: class {
    constructor() {
      this.webhooks = { constructEvent: mockConstructEvent };
    }
  },
}));

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: () => ({ set: mockRedisSet, del: mockRedisDel }),
  },
}));

vi.mock('../utils/database.js', () => ({
  addTokens: mockAddTokens,
  supabase: {},
}));

vi.mock('micro', () => ({
  buffer: vi.fn(async () => Buffer.from('fake-stripe-payload')),
}));

import handler from '../pages/api/stripe/webhook.js';

const FAKE_EVENT = {
  id: 'evt_test_abc123',
  type: 'checkout.session.completed',
  data: {
    object: {
      metadata: { user_id: 'user-abc', quantity: '3' },
    },
  },
};

describe('stripe webhook — money path', () => {
  beforeEach(() => {
    mockConstructEvent.mockReset();
    mockRedisSet.mockReset();
    mockRedisDel.mockReset();
    mockAddTokens.mockReset();
  });

  test('valid first-time event → addTokens called once with correct args, responds 200', async () => {
    mockConstructEvent.mockReturnValue(FAKE_EVENT);
    mockRedisSet.mockResolvedValue('OK');
    mockAddTokens.mockResolvedValue(undefined);

    const req = createRequest({ method: 'POST', headers: { 'stripe-signature': 'sig_fake' } });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockAddTokens).toHaveBeenCalledOnce();
    expect(mockAddTokens).toHaveBeenCalledWith('user-abc', 3);
  });

  test('replayed event (redis.set returns null) → addTokens not called, 200 with duplicate:true', async () => {
    mockConstructEvent.mockReturnValue(FAKE_EVENT);
    mockRedisSet.mockResolvedValue(null); // already set — not first time

    const req = createRequest({ method: 'POST', headers: { 'stripe-signature': 'sig_fake' } });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().duplicate).toBe(true);
    expect(mockAddTokens).not.toHaveBeenCalled();
  });

  test('bad Stripe signature → 400, addTokens never called', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload.');
    });

    const req = createRequest({ method: 'POST', headers: { 'stripe-signature': 'bad_sig' } });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(mockAddTokens).not.toHaveBeenCalled();
  });

  test('addTokens throws → redis.del called with the idempotency key and response is 500', async () => {
    mockConstructEvent.mockReturnValue(FAKE_EVENT);
    mockRedisSet.mockResolvedValue('OK');
    mockAddTokens.mockRejectedValue(new Error('Supabase RPC error'));
    mockRedisDel.mockResolvedValue(1);

    const req = createRequest({ method: 'POST', headers: { 'stripe-signature': 'sig_fake' } });
    const res = createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(mockRedisDel).toHaveBeenCalledOnce();
    expect(mockRedisDel).toHaveBeenCalledWith(`stripe_evt:${FAKE_EVENT.id}`);
  });
});
