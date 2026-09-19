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
  const content = await get('https://portal.vnpayinvoice.vn/5851.26c8e2d4906a57fe.js');
  console.log('5851 content len:', content.length);
  // Find all occurrences of "http", "/api", "portal", "search", "exportPDF", "taxCode"
  const lines = content.match(/[^;]{20,200}(?:search|exportPDF|exportXML|taxCode|secretCode|captcha|portal)[^;]{20,200}/gi) || [];
  console.log('Matches count:', lines.length);
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    console.log(`[${i}]:`, lines[i].trim());
  }
}
run();
