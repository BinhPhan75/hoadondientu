import fs from 'fs';
import * as cheerio from 'cheerio';

const pageHtml = fs.readFileSync('tkj_search_page.html', 'utf8');
const $ = cheerio.load(pageHtml);

console.log('ResultModal HTML:');
console.log($('#ResultModal').html()?.slice(0, 1500));

console.log('--- Scripts containing showInv or ResultModal ---');
$('script').each((i, el) => {
  const text = $(el).html() || '';
  if (text.includes('ResultModal') || text.includes('InvData') || text.includes('showInv')) {
    console.log(`Script ${i}:`);
    console.log(text.slice(0, 1000));
  }
});
