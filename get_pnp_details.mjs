import axios from 'axios';

async function getPnp() {
  const res = await axios.get('http://0318443500hd.easyinvoice.com.vn/Content/js/main.js?v=1.0.3');
  const idx = res.data.indexOf('ProductNumberPagination: function');
  console.log(res.data.slice(idx, idx + 4000));
}

getPnp().catch(console.error);
