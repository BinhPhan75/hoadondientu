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
  const c = await get('https://portal.vnpayinvoice.vn/9583.7f277ca25f0af412.js');
  console.log('Rest of 9583:');
  console.log(c.slice(1500));
}
run();
