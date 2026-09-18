import axios from 'axios';
import * as cheerio from 'cheerio';
import { solveEasyInvoiceCaptcha } from './src/services/easyInvoiceService.js';
import fs from 'fs';

async function run() {
  const domain = 'http://0318443500hd.easyinvoice.com.vn';
  const fkey = '3GEIE7PH3';

  for (let attempt = 1; attempt <= 5; attempt++) {
    console.log(`Attempt ${attempt}...`);
    const cRes = await axios.get(`${domain}/Captcha/Show`, { responseType: 'arraybuffer' });
    const cookie = cRes.headers['set-cookie'] ? cRes.headers['set-cookie'][0] : '';
    const { code } = await solveEasyInvoiceCaptcha(Buffer.from(cRes.data));
    console.log('Solved captcha:', code);

    const res = await axios.post(`${domain}/Search/Search`,
      `typeSearch=&FKey=${encodeURIComponent(fkey)}&Capcha=${encodeURIComponent(code)}`, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookie,
          'Referer': `${domain}/Search/Index?fkey=${fkey}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    const $ = cheerio.load(res.data);
    const msg = $('#msg').val();
    console.log('Msg:', msg);
    const invDataStr = $('#InvData').val();
    if (invDataStr && invDataStr !== "''" && invDataStr !== '""') {
      try {
        const invData = JSON.parse(invDataStr);
        console.log('Keys in invData:', Object.keys(invData));
        console.log('idInvoice:', invData.idInvoice, 'pattern:', invData.pattern, 'serial:', invData.serial);
        console.log('rowPerData:', invData.rowPerData, 'IsAutoRow:', invData.IsAutoRow);
        console.log('str length:', invData.str ? invData.str.length : 0);
        fs.writeFileSync('tkj_invoice_raw.html', invData.str || '');
        fs.writeFileSync('tkj_search_page.html', res.data);
        console.log('Saved raw files successfully!');
        break;
      } catch (err) {
        console.log('Parse error:', err.message);
      }
    }
  }
}

run().catch(console.error);
