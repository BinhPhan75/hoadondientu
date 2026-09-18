import fs from 'fs';
import * as cheerio from 'cheerio';

const rawHtml = fs.readFileSync('tkj_invoice_raw.html', 'utf8');
const $ = cheerio.load(rawHtml);
console.log('Title:', $('title').text());
console.log('Head styles count:', $('style').length);
console.log('Images count:', $('img').length);
$('img').each((i, el) => {
  const src = $(el).attr('src') || '';
  console.log(`Img ${i}: src starts with ${src.slice(0, 30)} (len: ${src.length})`);
});
console.log('Tables count:', $('table').length);
$('table').each((i, el) => {
  console.log(`Table ${i} class: "${$(el).attr('class') || ''}", id: "${$(el).attr('id') || ''}", rows: ${$(el).find('tr').length}`);
});
console.log('Headings:', $('h1, h2, h3, h4').map((i, el) => $(el).text().replace(/\s+/g, ' ').trim()).get());
