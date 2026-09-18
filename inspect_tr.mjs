import fs from 'fs';
import * as cheerio from 'cheerio';

const rawHtml = fs.readFileSync('tkj_invoice_raw.html', 'utf8');
const $ = cheerio.load(rawHtml);

console.log('Thead rows:', $('.invtable thead tr').length);
console.log('Tbody rows:', $('.invtable tbody tr').length);
console.log('Classes on tbody trs:');
const classes = new Set();
$('.invtable tbody tr').each((i, el) => {
  classes.add($(el).attr('class') || '(none)');
});
console.log('Unique classes:', Array.from(classes));

console.log('Sample tr 0:', $('.invtable tbody tr').first().html()?.slice(0, 150));
console.log('Sample tr 1:', $('.invtable tbody tr').eq(1).html()?.slice(0, 150));
