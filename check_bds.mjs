import axios from 'axios';

async function getBrowserDetect() {
  const res = await axios.get('http://0318443500hd.easyinvoice.com.vn/Content/js/BrowserDetectShare.js?v=1.5.5');
  console.log('Length:', res.data.length);
  const idx = res.data.indexOf('ViewInvoice');
  console.log('ViewInvoice idx:', idx);
  if (idx !== -1) {
    console.log(res.data.slice(idx - 200, idx + 500));
  }
}

getBrowserDetect().catch(console.error);
