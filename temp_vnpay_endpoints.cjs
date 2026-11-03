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
  const common = await get('https://portal.vnpayinvoice.vn/common.24ec31669c9e83ed.js');
  // Find all occurrences of download-pdf or download-xml or /pdf or /xml or /view
  const endpoints = common.match(/["'](\/[^"']*(?:pdf|xml|view|detail|invoices|print)[^"']*)["']/gi) || [];
  console.log('Endpoints in common:', [...new Set(endpoints)]);

  // Let's also check result component in 44428
  // Let's find chunk with 44428
  const main = await get('https://portal.vnpayinvoice.vn/main.3c7976b0e22b29d7.js');
  const idx = main.indexOf('44428');
  if (idx !== -1) {
    console.log('Chunk for 44428:', main.slice(Math.max(0, idx - 100), idx + 200));
  }
}
run();
