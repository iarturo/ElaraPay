process.env.GATEWAY_ADDRESS = process.env.GATEWAY_ADDRESS || '0x0000000000000000000000000000000000000001';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service-key';

const assert = require('node:assert/strict');
const test = require('node:test');

const { postMerchantWebhook } = require('./index');

test('postMerchantWebhook skips when no URL is configured', async () => {
    const result = await postMerchantWebhook({ orderId: 'ord_1' }, { webhookUrl: '' });

    assert.deepEqual(result, { delivered: false, skipped: true, attempts: 0 });
});

test('postMerchantWebhook sends the expected JSON payload', async () => {
    let request;
    const payload = {
        orderId: 'ord_1',
        amount: 42,
        buyer: '0xabc',
        txHash: '0xtx',
        timestamp: '2026-05-30T00:00:00.000Z',
    };

    const result = await postMerchantWebhook(payload, {
        webhookUrl: 'https://merchant.example/webhook',
        fetchImpl: async (url, options) => {
            request = { url, options };
            return { ok: true, status: 200 };
        },
    });

    assert.equal(result.delivered, true);
    assert.equal(result.attempts, 1);
    assert.equal(request.url, 'https://merchant.example/webhook');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers['content-type'], 'application/json');
    assert.deepEqual(JSON.parse(request.options.body), payload);
});

test('postMerchantWebhook retries failed deliveries with exponential backoff', async () => {
    let calls = 0;
    const sleeps = [];

    const result = await postMerchantWebhook({ orderId: 'ord_retry' }, {
        webhookUrl: 'https://merchant.example/webhook',
        sleep: async (ms) => sleeps.push(ms),
        fetchImpl: async () => {
            calls += 1;
            return calls < 3 ? { ok: false, status: 503 } : { ok: true, status: 200 };
        },
    });

    assert.equal(result.delivered, true);
    assert.equal(result.attempts, 3);
    assert.equal(calls, 3);
    assert.deepEqual(sleeps, [1000, 2000]);
});
