import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { WinInvoiceDriver, winInvoiceFields, findWinInvoiceDownloadLink, winInvoicePdfFromViewer } from '../src/services/invoice-engine/drivers/WinInvoiceDriver';
import { OriginalInvoiceError } from '../src/services/invoice-engine/OriginalInvoiceError';
import { detectProvider } from '../src/services/invoice-engine/providerDetector';
import { extractLookupDetailsFromXml } from '../src/utils/xmlParser';

const xml = '<HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>C26TTS</KHHDon>' +
  '<SHDon>14678</SHDon><MSTTCGP>0312303803</MSTTCGP></TTChung>' +
  '<NDHDon><NBan><MST>0312303803</MST></NBan></NDHDon>' +
  '<TTKhac><TTin Id="privateCode"><TTruong>Mã tra cứu hóa đơn</TTruong><DLieu>TESTCODE1234</DLieu></TTin>' +
  '<TTin Id="cmpnKey"><TTruong>Mã công ty</TTruong><DLieu>0312303803</DLieu></TTin></TTKhac>' +
  '</DLHDon></HDon>';
const driver = new WinInvoiceDriver();
const info = driver.extractInfo(xml);

test('WINinvoice reads solution MST and exact TTin Id fields', () => {
  assert.equal(detectProvider(xml), 'WININVOICE');
  assert.equal(driver.canHandle(xml), true);
  assert.deepEqual(winInvoiceFields(xml), {lookupCode:'TESTCODE1234', companyCode:'0312303803'});
  assert.equal(extractLookupDetailsFromXml(xml).lookupCode, 'TESTCODE1234');
  assert.equal(info.invoiceSeries,'C26TTS');
  assert.equal(info.invoiceNo,'14678');
  assert.equal(info.additionalData?.companyCode,'0312303803');
});

test('WINinvoice validates download link against invoice series and number', () => {
  const html = '<a href="/bill/view?name=C26TTS_00014678&amp;f=abc123">pdf</a>' +
    '<a href="/bill/view?name=C26TTS_00014679&amp;f=wrong">wrong</a>';
  assert.equal(findWinInvoiceDownloadLink(html, info),
    'https://tracuu.wininvoice.vn/bill/view?name=C26TTS_00014678&f=abc123&download=1');
  assert.equal(findWinInvoiceDownloadLink('<a href="https://evil.example/bill/view?name=C26TTS_00014678&f=abc">x</a>', info), undefined);
  assert.equal(findWinInvoiceDownloadLink('<a href="/bill/view?name=C26TTS_00014679&f=x">x</a>', info), undefined);
});

test('WINinvoice submits official x-www-form-urlencoded payload with fresh CSRF and session', async () => {
  const prev=globalThis.fetch;
  const requests: Array<{url:string;method:string;body:string;cookie:string}> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target=String(url), method=init?.method || 'GET';
    requests.push({url:target,method,body:String(init?.body||''),cookie:String(new Headers(init?.headers).get('cookie')||'')});
    if(requests.length===1) return new Response('<form><input name="phtcsrf_tkndf-tc" value="fresh_csrf_from_page"></form>', {
      status:200,headers:{'Content-Type':'text/html','Set-Cookie':'df-tcphtcsrf_coki_tkndf-tc=fresh_csrf_from_page; Path=/; HttpOnly'}
    });
    if(requests.length===2) return new Response('',{
      status:303, headers:{Location:'/bill/inv','Set-Cookie':'s_coki_ser22fdf-tc=test_session; Path=/; HttpOnly'}
    });
    if(requests.length===3) return new Response('<a href="/bill/view?name=C26TTS_00014678&amp;f=INV_ONLY">Tải</a>',{
      status:200,headers:{'Content-Type':'text/html'}
    });
    if(requests.length===4) return new Response('<html>not a PDF</html>',{
      status:200,headers:{'Content-Type':'text/html'}
    });
    throw Error('Unexpected network call');
  }) as typeof fetch;
  try {
    await assert.rejects(driver.fetchPdf(info), (e: unknown) =>
      e instanceof OriginalInvoiceError && e.message.includes('chỉ trả về trang xem HTML'));
    assert.deepEqual(requests.map(r=>[r.method,new URL(r.url).pathname]),[
      ['GET','/bill'],['POST','/bill'],['GET','/bill/inv'],['GET','/bill/view']
    ]);
    const posted=new URLSearchParams(requests[1].body);
    assert.deepEqual(Object.fromEntries(posted),{
      private_code:'TESTCODE1234', cmpn_key:'0312303803', action:'submit',
      'phtcsrf_tkndf-tc':'fresh_csrf_from_page',test:'1'
    });
    assert.match(requests[1].cookie,/df-tcphtcsrf_coki_tkndf-tc=fresh_csrf_from_page/);
    assert.match(requests[2].cookie,/s_coki_ser22fdf-tc=test_session/);
    assert.equal(new URL(requests[3].url).searchParams.get('download'),'1');
  } finally {globalThis.fetch=prev;}
});

test('WINinvoice fails safely if server does not supply CSRF/session', async () => {
  const prev=globalThis.fetch;
  let count=0;
  globalThis.fetch=(async()=>{count++;return new Response('<form></form>',{headers:{'Content-Type':'text/html'}})}) as typeof fetch;
  try {
    await assert.rejects(driver.fetchPdf(info), (e:unknown) =>
      e instanceof OriginalInvoiceError && e.message.includes('CSRF'));
    assert.equal(count,1);
  } finally {globalThis.fetch=prev;}
});


test('WINinvoice follows temporary same-origin 307 downloads with session cookies', async () => {
  const previous = globalThis.fetch;
  const requests: Array<{url:string;cookie:string}> = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const uri = String(url);
    requests.push({url:uri,cookie:String(new Headers(init?.headers).get('cookie') || '')});
    switch (requests.length) {
      case 1: return new Response('<input name="phtcsrf_tkndf-tc" value="fresh_csrf_123456">', {
        headers: {'Content-Type':'text/html','Set-Cookie':'df-tcphtcsrf_coki_tkndf-tc=fresh_csrf_123456; Path=/'}
      });
      case 2: return new Response(null, {status:303,headers:{Location:'/bill/inv','Set-Cookie':'session=test-session; Path=/'}});
      case 3: return new Response('<a href="/bill/view?name=C26TTS_00014678&amp;f=temporary">Download</a>', {
        headers:{'Content-Type':'text/html'}
      });
      case 4: return new Response(null, {status:307,headers:{Location:'/bill/file?id=invoice'}});
      case 5: return new Response('NOT_A_PDF', {status:200,headers:{'Content-Type':'text/plain'}});
      default: throw Error('Unexpected network request');
    }
  }) as typeof fetch;
  try {
    await assert.rejects(driver.fetchPdf(info), (error:unknown) =>
      error instanceof OriginalInvoiceError && error.message.includes('trả về text/plain'));
    assert.equal(requests.length,5);
    assert.equal(new URL(requests[4].url).pathname,'/bill/file');
    assert.match(requests[4].cookie,/session=test-session/);
  } finally {globalThis.fetch=previous;}
});

test('WINinvoice refuses redirects outside its trusted origin', async () => {
  const previous=globalThis.fetch;
  let calls=0;
  globalThis.fetch=(async () => {
    calls++;
    if(calls===1) return new Response('<input name="phtcsrf_tkndf-tc" value="fresh_csrf_123456">',{
      headers:{'Content-Type':'text/html','Set-Cookie':'df-tcphtcsrf_coki_tkndf-tc=fresh_csrf_123456; Path=/'}
    });
    if(calls===2) return new Response(null,{status:303,headers:{Location:'/bill/inv'}});
    if(calls===3) return new Response('<a href="/bill/view?name=C26TTS_00014678&amp;f=abc">Download</a>',{
      headers:{'Content-Type':'text/html'}
    });
    if(calls===4) return new Response(null,{status:307,headers:{Location:'https://example.org/download'}});
    throw Error('Unexpected external fetch');
  }) as typeof fetch;
  try {
    await assert.rejects(driver.fetchPdf(info),(error:unknown) =>
      error instanceof OriginalInvoiceError && error.message.includes('ngoài cổng tra cứu'));
    assert.equal(calls,4);
  } finally {globalThis.fetch=previous;}
});


test('WINinvoice parses provider-hosted PDF links from an HTML viewer', () => {
  const html = '<html><iframe src="/bill/download/pdf?id=123"></iframe>' +
    '<a href="https://outside.example/file.pdf">external</a>' +
    '<a href="/bill/file/456">Download</a></html>';
  const result = winInvoicePdfFromViewer(html, 'https://tracuu.wininvoice.vn/bill/view?name=C26TTS_00014678');
  assert.deepEqual(result.links, [
    'https://tracuu.wininvoice.vn/bill/download/pdf?id=123',
    'https://tracuu.wininvoice.vn/bill/file/456',
  ]);
  assert.equal(result.pdf,undefined);
});

test('WINinvoice accepts only embedded data URIs with a real PDF signature', () => {
  const pdf = Buffer.from('%PDF-1.7\n' + 'A'.repeat(130));
  const viewer = '<html><embed src="data:application/pdf;base64,' + pdf.toString('base64') + '"></html>';
  const result = winInvoicePdfFromViewer(viewer, 'https://tracuu.wininvoice.vn/bill/view?name=C26TTS_00014678');
  assert.deepEqual(result.pdf,pdf);
});


test('WINinvoice follows HTML viewer link to real PDF bytes and validates invoice identity', async () => {
  const prev=globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch=(async (url:string|URL|Request) => {
    urls.push(String(url));
    if(urls.length===1) return new Response('<input name="phtcsrf_tkndf-tc" value="fresh_csrf_123456">',{
      headers:{'Content-Type':'text/html','Set-Cookie':'df-tcphtcsrf_coki_tkndf-tc=fresh_csrf_123456; Path=/'}
    });
    if(urls.length===2) return new Response(null,{status:303,headers:{Location:'/bill/inv'}});
    if(urls.length===3) return new Response('<a href="/bill/view?name=C26TTS_00014678&amp;f=xyz">View</a>',{
      headers:{'Content-Type':'text/html'}
    });
    if(urls.length===4) return new Response('<html><iframe src="/bill/download/pdf?id=xyz"></iframe></html>',{
      headers:{'Content-Type':'text/html'}
    });
    if(urls.length===5) return new Response('%PDF-1.7\n'+'A'.repeat(120),{
      headers:{'Content-Type':'application/pdf'}
    });
    throw Error('Extra request');
  }) as typeof fetch;
  try {
    await assert.rejects(driver.fetchPdf(info),(err:unknown)=>
      err instanceof OriginalInvoiceError && err.message.includes('Không xác minh được danh tính PDF gốc'));
    assert.equal(urls.length,5);
    assert.equal(new URL(urls[4]).pathname,'/bill/download/pdf');
  } finally {globalThis.fetch=prev;}
});


test('WINinvoice returns provider ZIP with matching original invoice XML', async () => {
  const prev = globalThis.fetch;
  const zip = new JSZip();
  const originalXml = '<HDon><DLHDon><TTChung><KHHDon>C26TTS</KHHDon><SHDon>14678</SHDon></TTChung>' +
    '<NDHDon><NBan><MST>0312303803</MST></NBan></NDHDon></DLHDon></HDon>';
  zip.file('original.xml', originalXml);
  const archive = await zip.generateAsync({type:'nodebuffer'});
  let call = 0;
  globalThis.fetch = (async () => {
    call++;
    if(call===1) return new Response('<input name="phtcsrf_tkndf-tc" value="fresh_csrf_123456">',{
      headers:{'Content-Type':'text/html','Set-Cookie':'df-tcphtcsrf_coki_tkndf-tc=fresh_csrf_123456; Path=/'}
    });
    if(call===2) return new Response(null,{status:303,headers:{Location:'/bill/inv'}});
    if(call===3) return new Response('<a href="/bill/view?name=C26TTS_00014678&amp;f=valid">Download</a>',{
      headers:{'Content-Type':'text/html'}
    });
    if(call===4) return new Response(new Uint8Array(archive),{status:200,headers:{'Content-Type':'application/zip'}});
    throw new Error('Unexpected request');
  }) as typeof fetch;
  try {
    const result=await driver.fetchPdf(info);
    assert.equal(result.success,true);
    assert.equal(result.contentType,'application/zip');
    assert.match(result.filename,/\.zip$/);
    assert.deepEqual(result.pdfBuffer,archive);
    assert.equal(call,4);
  } finally {globalThis.fetch=prev;}
});
