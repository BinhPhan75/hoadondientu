const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function run() {
  const content = await get('https://portal.vnpayinvoice.vn/common.24ec31669c9e83ed.js');
  
  const keywords = ['pdfInvoicePortal', 'downloadRawXMLFile', 'download-xml', '/private/', '/public/', 'window.env', 'baseUrl'];
  for (const kw of keywords) {
    let idx = 0;
    console.log(`\n=== Keyword: ${kw} ===`);
    while ((idx = content.indexOf(kw, idx)) !== -1) {
      console.log(content.slice(Math.max(0, idx - 150), Math.min(content.length, idx + 250)));
      console.log('---');
      idx += kw.length;
      if (idx > 500000) break;
    }
  }
}
run();
