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
  const c = await get('https://portal.vnpayinvoice.vn/6850.bdc5e9266c121128.js');
  console.log('6850 len:', c.length);
  // Search for form controls, submit handlers, API calls
  console.log('--- START 6850 ---');
  console.log(c.slice(0, 3000));
}
run();
