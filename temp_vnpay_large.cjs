const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });
}

async function run() {
  const largeFiles = [
    '58.b79a343c91a2c9f1.js',
    '1218.bc5625974f238021.js',
    '4650.278a8db390bf9652.js'
  ];
  for (const f of largeFiles) {
    const c = await get('https://portal.vnpayinvoice.vn/' + f);
    console.log(`\n=== FILE: ${f} (${c.length}) ===`);
    // Search for routing terms or endpoints
    const keywords = ['portal', 'tra-cuu', 'tracuu', 'api/v6', 'search', 'loadChildren'];
    for (const kw of keywords) {
      let count = 0;
      let idx = 0;
      while ((idx = c.indexOf(kw, idx)) !== -1) {
        count++;
        if (count <= 2) {
          console.log(`[${kw}]`, c.slice(Math.max(0, idx - 40), Math.min(c.length, idx + 100)));
        }
        idx += kw.length;
      }
      if (count > 2) console.log(`[${kw}] total occurrences: ${count}`);
    }
  }
}
run();
