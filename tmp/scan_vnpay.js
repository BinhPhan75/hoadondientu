const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) return resolve('');
      const ct = res.headers['content-type'] || '';
      if (!ct.includes('javascript')) return resolve('');
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });
}

async function main() {
  const mainJs = await get('https://portal.vnpayinvoice.vn/main.3c7976b0e22b29d7.js');
  const idx = mainJs.indexOf('__webpack_require__.u');
  const part = mainJs.substring(idx, idx + 6000);
  const startObj = part.indexOf('+".\"+{') + 6;
  const endObj = part.indexOf('}[l]+".js"');
  const rawObjStr = part.substring(startObj, endObj);
  const pairs = rawObjStr.split(',');
  console.log('Total chunk entries:', pairs.length);
  
  for (const pair of pairs) {
    const [rawKey, rawVal] = pair.split(':');
    if (!rawKey || !rawVal) continue;
    const key = rawKey.trim();
    const val = rawVal.replace(/["']/g, '').trim();
    const name = (key === '2214' ? 'polyfills-core-js' : key === '6748' ? 'polyfills-dom' : key === '8592' ? 'common' : key) + '.' + val + '.js';
    const js = await get('https://portal.vnpayinvoice.vn/' + name);
    if (js.length > 0) {
      if (js.includes('v6/invoices') || js.includes('/invoices') || js.includes('lookupCode')) {
        console.log('FOUND in', name, 'length:', js.length);
        const idxMatch = js.indexOf('v6/invoices');
        if (idxMatch !== -1) {
          console.log('Snippet around v6/invoices:', js.substring(Math.max(0, idxMatch - 200), idxMatch + 300));
        }
        const idxLc = js.indexOf('lookupCode');
        if (idxLc !== -1) {
          console.log('Snippet around lookupCode in', name, ':', js.substring(Math.max(0, idxLc - 100), idxLc + 200));
        }
      }
    }
  }
  console.log('Done scanning!');
}
main();
