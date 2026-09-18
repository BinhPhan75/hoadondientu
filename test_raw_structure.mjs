import fs from 'fs';
import * as cheerio from 'cheerio';

const rawHtml = fs.readFileSync('tkj_invoice_raw.html', 'utf8');
const $ = cheerio.load(rawHtml);

console.log('HTML structure:');
console.log('Has <style>?', $('style').length);
console.log('Has <div class="VATTEMP">?', $('.VATTEMP').length);
console.log('Has .invtable?', $('.invtable').length);
console.log('Table rows:', $('.invtable tr').length);
console.log('Header text:', $('.VATTEMP #header, .VATTEMP .header-title').text().trim().replace(/\s+/g, ' '));
console.log('Footer text:', $('.VATTEMP #footer, .VATTEMP .fl-r').text().trim().replace(/\s+/g, ' '));
