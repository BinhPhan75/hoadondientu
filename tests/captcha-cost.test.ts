import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { solveCaptchaWithGemini, getCaptchaUsage, ALPHANUMERIC_CAPTCHA_PROMPT } from '../src/services/invoice-engine/captcha/geminiCaptchaSolver';
import { parseThaiSonForm, downloadOriginalThaiSonPdf } from '../src/services/thaiSonInvoiceService';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const aiResponse = (text: string) => new Response(JSON.stringify({
  candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
  usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 4, thoughtsTokenCount: 0 },
}), { headers: { 'Content-Type': 'application/json' } });

test('concurrent and repeated OCR of identical image makes only one AI request', async () => {
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.generationConfig.maxOutputTokens, 32);
    assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
    assert.equal(body.contents[0].parts[0].inlineData.mimeType, 'image/gif');
    return aiResponse('1234');
  };
  const run = () => solveCaptchaWithGemini(Buffer.from('GIF89a-unit-1'), undefined, { customApiKey: 'test-dedup' });
  assert.deepEqual(await Promise.all([run(), run(), run()]), ['1234', '1234', '1234']);
  assert.equal(await run(), '1234');
  assert.equal(calls, 1);
  assert.ok(getCaptchaUsage().cacheHits >= 3);
});

test('invalid OCR answer is not stripped into a different code or retried on another model', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return aiResponse('A1234B'); };
  const run = () => solveCaptchaWithGemini(Buffer.from('GIF89a-unit-invalid'), undefined, { customApiKey: 'test-invalid' });
  await assert.rejects(run(), /không hợp lệ/);
  await assert.rejects(run(), /không hợp lệ/);
  assert.equal(calls, 1);
  assert.equal(await solveCaptchaWithGemini(Buffer.from('GIF89a-unit-alnum'), ALPHANUMERIC_CAPTCHA_PROMPT, { customApiKey: 'test-alpha', alphanumeric: true }), 'A1234B');
});

test('quota errors do not trigger SDK retries or new paid calls for different images', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ error: { code: 429, message: 'quota exhausted', status: 'RESOURCE_EXHAUSTED' } }), { status: 429 });
  };
  const opts = { customApiKey: 'test-quota' };
  await assert.rejects(solveCaptchaWithGemini(Buffer.from('GIF89a-quota-1'), undefined, opts));
  await assert.rejects(solveCaptchaWithGemini(Buffer.from('GIF89a-quota-2'), undefined, opts), /tạm dừng/);
  assert.equal(calls, 1);
});

const form = (token: string, error = '') => `<form><input name="CaptchaDeText" value="wrong"><img id="CaptchaImage" src="/wrong"></form>
<form action="/tra-cuu"><input name="MaNhanHoaDon"><input name="CaptchaDeText" value="${token}"><img id="CaptchaImage" src="/DefaultCaptcha/Generate?t=${token}"><span class="text-danger">${error}</span></form>`;

test('Thai Son scopes captcha to invoice form and carries rotated cookies through PDF redirect', async () => {
  assert.equal(parseThaiSonForm(form('right')).token, 'right');
  let ocrCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const cookie = new Headers(init?.headers).get('Cookie');
    if (url.hostname === 'generativelanguage.googleapis.com') { ocrCalls++; return aiResponse('A123'); }
    assert.equal(url.hostname, 'einvoice.vn');
    if (url.pathname === '/DefaultCaptcha/Generate') {
      assert.equal(url.searchParams.get('t'), 'right');
      assert.match(cookie || '', /sid=page/);
      return new Response('GIF89a-thaison-success', { headers: { 'Content-Type': 'image/gif', 'Set-Cookie': 'sid=image; Path=/' } });
    }
    if (init?.method === 'POST') {
      assert.match(cookie || '', /sid=image/);
      const body = new URLSearchParams(String(init.body));
      assert.equal(body.get('CaptchaDeText'), 'right');
      assert.equal(body.get('CaptchaInputText'), 'A123');
      assert.equal(body.get('MaNhanHoaDon'), 'TEST-INVOICE');
      return new Response('<html>Invoice result</html>', { headers: { 'Set-Cookie': 'sid=result; Path=/' } });
    }
    if (url.pathname === '/tra-cuu/tai-hoa-don-dien-tu') {
      assert.match(cookie || '', /sid=result/);
      return new Response(null, { status: 302, headers: { Location: '/test-invoice.pdf', 'Set-Cookie': 'sid=pdf; Path=/' } });
    }
    if (url.pathname === '/test-invoice.pdf') {
      assert.match(cookie || '', /sid=pdf/);
      return new Response('%PDF-1.7\nfixture');
    }
    return new Response(form('right'), { headers: { 'Set-Cookie': 'sid=page; Path=/' } });
  };
  const result = await downloadOriginalThaiSonPdf({ lookupCode: 'TEST-INVOICE', customApiKey: 'test-thaison-success' });
  assert.equal(result.pdfBuffer.subarray(0, 5).toString(), '%PDF-');
  assert.equal(ocrCalls, 1);
});

test('Thai Son retries only a rejected CAPTCHA, at most twice', async () => {
  let pageCalls = 0, ocrCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === 'generativelanguage.googleapis.com') { ocrCalls++; return aiResponse('B234'); }
    if (url.pathname === '/DefaultCaptcha/Generate') return new Response('GIF89a-retry-' + pageCalls, { headers: { 'Content-Type': 'image/gif' } });
    if (init?.method === 'POST') return new Response(form('retry', 'Mã captcha không đúng'));
    pageCalls++;
    return new Response(form('retry'));
  };
  await assert.rejects(downloadOriginalThaiSonPdf({ lookupCode: 'TEST-RETRY', customApiKey: 'test-thaison-retry' }), { provider: 'THAISON' });
  assert.equal(pageCalls, 2);
  assert.equal(ocrCalls, 2);
});

test('Thai Son HTTP error never mentions MISA and stops before OCR', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('gateway timeout', { status: 504 }); };
  await assert.rejects(downloadOriginalThaiSonPdf({ lookupCode: 'TEST-HTTP', customApiKey: 'test-http' }), error => {
    assert.match((error as Error).message, /Thái Sơn.*HTTP 504/);
    assert.doesNotMatch((error as Error).message, /MISA/);
    return true;
  });
  assert.equal(calls, 1);
});
