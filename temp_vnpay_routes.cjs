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
  const c = await get('https://portal.vnpayinvoice.vn/main.3c7976b0e22b29d7.js');
  // Find route definitions
  const routeMatches = c.match(/\{path:\s*["'][^"']*["'],(?:loadChildren|component)[^\}]+\}/g) || [];
  console.log('Routes count:', routeMatches.length);
  for (const r of routeMatches) {
    console.log(r);
  }

  // Also look for "path:"
  const allPaths = c.match(/path:\s*["'][^"']+["']/g) || [];
  console.log('Paths:', [...new Set(allPaths)]);
}
run();
