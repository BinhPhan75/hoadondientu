import fs from 'fs';
import * as cheerio from 'cheerio';

const pageHtml = fs.readFileSync('tkj_search_page.html', 'utf8');
const $ = cheerio.load(pageHtml);
console.log('Modals in page:');
$('.modal').each((i, el) => {
  console.log(`Modal ${i} id: "${$(el).attr('id')}", class: "${$(el).attr('class')}"`);
});

const viewInvoiceModal = $('#ViewInvoice');
if (viewInvoiceModal.length) {
  console.log('Found #ViewInvoice modal!');
  console.log(viewInvoiceModal.html().slice(0, 1000));
} else {
  console.log('Search for view invoice elements...');
  $('[id*="inv"], [id*="Inv"], [class*="inv"], [class*="Inv"]').each((i, el) => {
    console.log(`el ${i} tag: ${el.tagName} id: ${$(el).attr('id')} class: ${$(el).attr('class')}`);
  });
}
