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
  // Search for the component class definition
  const idx = c.indexOf('class B{');
  if (idx !== -1) {
    console.log(c.slice(idx, idx + 4000));
  } else {
    // search for constructor or onSubmit or search
    const idx2 = c.indexOf('SearchComponent');
    console.log(c.slice(Math.max(0, idx2 - 500), idx2 + 2500));
  }
}
run();
