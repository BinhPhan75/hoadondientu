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
  const idx = c.indexOf('Dt=');
  if (idx !== -1) {
    console.log('Dt definition:');
    console.log(c.slice(Math.max(0, idx - 100), Math.min(c.length, idx + 800)));
  } else {
    // Search for AppRoutingModule or RouterModule.forRoot
    const forRoot = c.indexOf('forRoot(');
    console.log('forRoot:', c.slice(Math.max(0, forRoot - 50), Math.min(c.length, forRoot + 600)));
  }
}
run();
