import axios from 'axios';
import * as cheerio from 'cheerio';

async function checkIndex() {
  const res = await axios.get('http://0318443500hd.easyinvoice.com.vn/Search/Index');
  const $ = cheerio.load(res.data);
  console.log('Modals in Index:');
  $('[id*="Modal"], [id*="modal"], [class*="modal"]').each((i, el) => {
    console.log($(el).prop('tagName'), 'id:', $(el).attr('id'), 'class:', $(el).attr('class'));
  });
  console.log('External scripts:');
  $('script[src]').each((i, el) => {
    console.log($(el).attr('src'));
  });
}

checkIndex().catch(console.error);
