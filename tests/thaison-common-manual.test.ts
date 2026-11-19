import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createThaiSonCommonManualCaptcha, submitThaiSonCommonManualLookup } from '../src/services/thaiSonCommonManualService';

test('Thai Son shared manual CAPTCHA keeps same session and never calls AI', async () => {
  const previous = globalThis.fetch;
  const calls: Array<{url:string,method:string,cookie:string,body:string}> = [];
  globalThis.fetch = (async (url:string|URL|Request, init?:RequestInit) => {
    const path=String(url);
    const method=String(init?.method || 'GET');
    calls.push({url:path,method,cookie:new Headers(init?.headers).get('cookie') || '',body:String(init?.body||'')});
    if(calls.length===1)return new Response(
      '<form action="/tra-cuu" method="POST">' +
      '<input name="MA_NHAN_HOA_DON"><input name="CaptchaInputText">' +
      '<input type="hidden" name="__RequestVerificationToken" value="fresh_token">' +
      '<img src="/Captcha/Show"></form>',
      {headers:{'Content-Type':'text/html','Set-Cookie':'session=test-session; Path=/'}}
    );
    if(calls.length===2)return new Response(new Uint8Array(100).fill(1),{
      headers:{'Content-Type':'image/png'}
    });
    if(calls.length===3)return new Response(
      '<form action="/tra-cuu"><input name="MA_NHAN_HOA_DON"><input name="CaptchaInputText"></form>',
      {headers:{'Content-Type':'text/html'}
    });
    throw Error('Unexpected request');
  }) as typeof fetch;
  try {
    const challenge=await createThaiSonCommonManualCaptcha('A46EKFYXHKM');
    assert.match(challenge.image,/^data:image\/png;base64,/);
    assert.ok(challenge.state.length > 0);
    await assert.rejects(submitThaiSonCommonManualLookup({
      state: challenge.state, lookupCode:'A46EKFYXHKM',captcha:'ABCD',
      sellerTaxCode:'0401515239',invoiceNo:'603',invoiceSeries:'C26MMR',
    }),/tra cứu|hóa đơn|CAPTCHA/i);
    assert.deepEqual(calls.map(c=>[new URL(c.url).pathname,c.method]),[
      ['/tra-cuu','GET'],['/Captcha/Show','GET'],['/tra-cuu','POST']
    ]);
    assert.match(calls[2].cookie,/session=test-session/);
    const form = new URLSearchParams(calls[2].body);
    assert.equal(form.get('MA_NHAN_HOA_DON'),'A46EKFYXHKM');
    assert.equal(form.get('CaptchaInputText'),'ABCD');
    assert.equal(form.get('__RequestVerificationToken'),'fresh_token');
  } finally {
    globalThis.fetch=previous;
  }
});

test('Thai Son shared CAPTCHA binds challenge to lookup code', async () => {
  const previous=globalThis.fetch;
  let count=0;
  globalThis.fetch=(async ()=>{
    count++;
    if(count===1)return new Response('<form action="/tra-cuu"><input name="MA_NHAN_HOA_DON">' +
      '<input name="CaptchaInputText"><img src="/captcha.png"></form>',
      {headers:{'Set-Cookie':'session=abc; Path=/'}
    });
    return new Response(new Uint8Array(100).fill(2),{headers:{'Content-Type':'image/png'}});
  }) as typeof fetch;
  try {
    const challenge=await createThaiSonCommonManualCaptcha('A46EKFYXHKM');
    await assert.rejects(submitThaiSonCommonManualLookup({
      state:challenge.state,lookupCode:'SOMEOTHER123',captcha:'1234',
      sellerTaxCode:'0401515239',invoiceNo:'603',invoiceSeries:'C26MMR'
    }),/không khớp mã nhận hóa đơn/i);
    assert.equal(count,2);
  } finally {globalThis.fetch=previous;}
});


test('Thai Son manual search sends clicked submit button and retains action query', async () => {
  const prev=globalThis.fetch;
  const requests: Array<{url:string,body:string}>=[];
  globalThis.fetch=(async (url:string|URL|Request,init?:RequestInit) => {
    requests.push({url:String(url),body:String(init?.body || '')});
    if(requests.length===1) return new Response(
      '<form method="POST" action="/tra-cuu?mode=lookup">' +
      '<input name="MA_NHAN_HOA_DON"><input name="CaptchaInputText">' +
      '<button type="submit" name="searchAction" value="lookup">Tra cứu hóa đơn</button>' +
      '<img src="/Captcha/Show"></form>',{
        headers:{'Content-Type':'text/html','Set-Cookie':'session=example; Path=/'}
      });
    if(requests.length===2) return new Response(new Uint8Array(101).fill(5),{
      headers:{'Content-Type':'image/png'}
    });
    if(requests.length===3) return new Response('<html><body>Chưa có hóa đơn</body></html>',{
      headers:{'Content-Type':'text/html'}
    });
    throw Error('Unexpected fetch');
  }) as typeof fetch;
  try {
    const session=await createThaiSonCommonManualCaptcha('A46EKFYXHKM');
    await assert.rejects(submitThaiSonCommonManualLookup({
      state:session.state, lookupCode:'A46EKFYXHKM',captcha:'EIVJ',
      sellerTaxCode:'0401515239',invoiceNo:'603',invoiceSeries:'C26MMR'
    }));
    assert.equal(requests.length,3);
    assert.equal(new URL(requests[2].url).searchParams.get('mode'),'lookup');
    assert.equal(new URLSearchParams(requests[2].body).get('searchAction'),'lookup');
    assert.equal(new URLSearchParams(requests[2].body).get('CaptchaInputText'),'EIVJ');
  }finally{globalThis.fetch=prev;}
});
