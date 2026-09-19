import axios from 'axios';
import * as cheerio from 'cheerio';

async function checkScripts() {
  const portal = 'https://4000344946-tt78.vnpt-invoice.com.vn';
  const page = await axios.get(`${portal}/HomeNoLogin/SearchByFkey/`);
  const $ = cheerio.load(page.data);

  console.log('--- Checking all script tags ---');
  $('script').each((i, el) => {
    const src = $(el).attr('src');
    const text = $(el).html() || '';
    if (src) console.log('Script src:', src);
    if (text.includes('ajxCall4Portal')) {
      console.log('Found in inline script:', text);
    }
  });

  // Let's check external scripts
  const scripts = $('script[src]').map((i, el) => $(el).attr('src')).get();
  for (const s of scripts) {
    const fullUrl = s.startsWith('http') ? s : `${portal}${s}`;
    try {
      const res = await axios.get(fullUrl);
      if (res.data.includes('ajxCall4Portal')) {
        console.log('Found ajxCall4Portal in:', fullUrl);
        // Find definition
        const idx = res.data.indexOf('ajxCall4Portal');
        console.log(res.data.slice(Math.max(0, idx - 50), idx + 1000));
      }
    } catch (e) {
      // ignore
    }
  }
}

checkScripts().catch(console.error);
