import axios from 'axios';
import * as cheerio from 'cheerio';
import { CaptchaSolver } from './invoice-engine/captcha/CaptchaSolver';

export interface VnptOriginalInvoiceParams {
  lookupCode: string;
  sellerTaxCode?: string;
  lookupUrl?: string;
}

export async function lookupOriginalVnptInvoice(params: VnptOriginalInvoiceParams): Promise<{ htmlContent: string }> {
  const lookupCode = params.lookupCode.trim();
  if (!lookupCode) throw new Error('Mã tra cứu VNPT không được để trống');

  const portal = (params.lookupUrl || (params.sellerTaxCode
    ? `https://${params.sellerTaxCode}-tt78.vnpt-invoice.com.vn`
    : 'https://4000344946-tt78.vnpt-invoice.com.vn')).replace(/\/+$/, '');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml'
  };

  const page = await axios.get(`${portal}/HomeNoLogin/SearchByFkey/`, {
    headers,
    timeout: 20000,
    validateStatus: status => status >= 200 && status < 400
  });
  const cookies = (page.headers['set-cookie'] || []).map(cookie => cookie.split(';')[0]).join('; ');
  const $ = cheerio.load(page.data);
  const token = $('input[name="__RequestVerificationToken"]').attr('value') || '';
  const captcha = await axios.get(`${portal}/Captcha/Show`, {
    headers: { ...headers, Referer: `${portal}/HomeNoLogin/SearchByFkey/`, Cookie: cookies },
    responseType: 'arraybuffer',
    timeout: 15000
  });
  const captchaCode = (await CaptchaSolver.solveWithDetails(Buffer.from(captcha.data))).code;

  const form = new URLSearchParams({
    __RequestVerificationToken: token,
    strFkey: lookupCode,
    captch: captchaCode,
    submit: ''
  });
  const result = await axios.post(`${portal}/HomeNoLogin/SearchByFkey`, form.toString(), {
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${portal}/HomeNoLogin/SearchByFkey/`,
      Cookie: cookies
    },
    maxRedirects: 5,
    timeout: 30000,
    responseType: 'text',
    validateStatus: status => status >= 200 && status < 400
  });

  const html = String(result.data || '');
  if (!html || /captcha|mã xác thực không đúng|sai mã xác thực/i.test(html) && !/invoice|hóa đơn|hoadon/i.test(html)) {
    throw new Error('VNPT từ chối mã Captcha hoặc không trả về bản gốc hóa đơn.');
  }
  return { htmlContent: html.replace(/<head([^>]*)>/i, `<head$1><base href="${portal}/">`) };
}
