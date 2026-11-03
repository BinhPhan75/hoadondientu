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
  const c1 = await get('https://portal.vnpayinvoice.vn/main.3c7976b0e22b29d7.js');
  const c2 = await get('https://portal.vnpayinvoice.vn/common.24ec31669c9e83ed.js');
  
  for (const [name, content] of [['main', c1], ['common', c2]]) {
    const idx = content.indexOf('26556:');
    if (idx !== -1) {
      console.log(`Found 26556 in ${name} at ${idx}`);
      console.log(content.slice(idx, idx + 400));
    }
  }
}
run();
