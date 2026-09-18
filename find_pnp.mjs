import axios from 'axios';

async function findFunction() {
  const scripts = [
    '/Content/js/app/app-ajax.js',
    '/Content/js/main.js?v=1.0.3',
    '/Content/js/scripts.js'
  ];
  for (const s of scripts) {
    try {
      const res = await axios.get(`http://0318443500hd.easyinvoice.com.vn${s}`);
      console.log(s, 'length:', res.data.length, 'has ProductNumberPagination:', res.data.includes('ProductNumberPagination'));
      if (res.data.includes('ProductNumberPagination')) {
        const idx = res.data.indexOf('ProductNumberPagination');
        console.log(res.data.slice(idx - 50, idx + 1500));
      }
    } catch (e) {
      console.log(s, 'error:', e.message);
    }
  }
}

findFunction().catch(console.error);
