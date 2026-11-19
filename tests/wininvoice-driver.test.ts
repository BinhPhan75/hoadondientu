import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WinInvoiceDriver, winInvoiceFields, findWinInvoiceDownloadLink } from '../src/services/invoice-engine/drivers/WinInvoiceDriver';
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
      e instanceof OriginalInvoiceError && e.message.includes('không trả PDF'));
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
