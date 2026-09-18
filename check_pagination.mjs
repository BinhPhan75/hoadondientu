import axios from 'axios';

async function checkPagination() {
  const res = await axios.get('http://0318443500hd.easyinvoice.com.vn/Content/js/BrowserDetectShare.js?v=1.5.5');
  const idx = res.data.indexOf('ProductNumberPagination');
  console.log('ProductNumberPagination idx:', idx);
  if (idx !== -1) {
    console.log(res.data.slice(idx - 100, idx + 2000));
  }
}

checkPagination().catch(console.error);
