import axios from 'axios';
import * as cheerio from 'cheerio';
import { solveCaptchaWithGemini } from './src/services/invoice-engine/captcha/geminiCaptchaSolver.ts';

async function test() {
  const portal = 'https://4000344946-tt78.vnpt-invoice.com.vn';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  const page = await axios.get(`${portal}/HomeNoLogin/SearchByFkey/`, { headers });
  const cookies = (page.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  const $ = cheerio.load(page.data);
  const token = $('input[name="__RequestVerificationToken"]').val() || '';

  const captcha = await axios.get(`${portal}/Captcha/Show?t=${Date.now()}`, {
    headers: { ...headers, Cookie: cookies, Referer: `${portal}/HomeNoLogin/SearchByFkey/` },
    responseType: 'arraybuffer'
  });
  const captchaCookies = (captcha.headers['set-cookie'] || []).map(c => c.split(';')[0]);
  const sessionCookie = [...cookies.split('; '), ...captchaCookies].join('; ');

  const code = await solveCaptchaWithGemini(Buffer.from(captcha.data));
  console.log('Captcha solved:', code);

  const form = new URLSearchParams({
    __RequestVerificationToken: String(token),
    strFkey: '00D1160375D3404C7E8F23B83EB7D92E63',
    captch: code,
    submit: ''
  });

  const res = await axios.post(`${portal}/HomeNoLogin/SearchByFkey`, form.toString(), {
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
      Cookie: sessionCookie
    }
  });

  const html = res.data;
  console.log('Returned HTML length:', html.length);
  const $res = cheerio.load(html);

  console.log('=== Table rows ===');
  $res('table tr').each((i, el) => {
    console.log(`Row ${i}:`, $res(el).html());
  });

  console.log('=== Scripts in returned HTML ===');
  $res('script').each((i, el) => {
    const text = $res(el).html() || '';
    if (text.trim()) {
      console.log(`Script ${i}:`, text);
    }
  });
}

test().catch(e => console.error(e));
