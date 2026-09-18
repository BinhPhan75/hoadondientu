import fs from 'fs';

const pageHtml = fs.readFileSync('tkj_search_page.html', 'utf8');
const idx = pageHtml.indexOf('showInv(');
console.log('showInv call idx:', idx);
if (idx !== -1) {
  console.log(pageHtml.slice(idx - 100, idx + 400));
}
