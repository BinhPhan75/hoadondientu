import axios from 'axios';
import fs from 'fs';

async function getFullPnp() {
  const res = await axios.get('http://0318443500hd.easyinvoice.com.vn/Content/js/main.js?v=1.0.3');
  const idx = res.data.indexOf('ProductNumberPagination: function');
  const endIdx = res.data.indexOf('})(jQuery);', idx);
  console.log('Idx:', idx, 'EndIdx:', endIdx);
  fs.writeFileSync('pnp_code.js', res.data.slice(idx, endIdx !== -1 ? endIdx : idx + 8000));
}

getFullPnp().catch(console.error);
