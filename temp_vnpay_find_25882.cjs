const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(''));
  });
}

const validChunks = [
  "7.2f3957884fb5b3ad.js", "12.d2266aac3cadd9d0.js", "53.b3cd336063bdd9f1.js",
  "58.b79a343c91a2c9f1.js", "153.674dd208e85709e9.js", "269.f46784c182702f6c.js",
  "387.06406f44a0933ca0.js", "388.ecac2aa0324d489d.js", "438.779f9fd113e4f441.js",
  "529.ad6ee94b8817d45b.js", "657.d53796c33e3267d8.js", "834.7db2a367cc98205e.js",
  "958.f2c92d00ed2d2597.js", "1033.f4f66c0b8a92a6b4.js", "1118.831b7ff7befc2d7e.js",
  "1157.595543efa22d0df4.js", "1217.a0994b1435c67eeb.js", "1218.bc5625974f238021.js",
  "1281.c01ca2b6bbf8a7a8.js", "1481.839e21c5aba12dbf.js", "1536.5c31cf7fab1a6f06.js",
  "1548.00ca4e9d8a38cd1b.js", "1634.26c2d72d2195d792.js", "1709.0a3a263381c2c60a.js",
  "1764.c882671d2fcf7521.js", "1811.10282b6b276ce133.js", "1935.3edcb78c45943b57.js",
  "1971.94814ebd8d9c741d.js", "2073.6f26d713988e7de2.js", "2122.9be3bd57240eeefe.js",
  "2349.86d3217b67f84e58.js", "2382.51042e4539479ae4.js", "2527.b7f59918a1ae715f.js",
  "2539.a5335928f4ae02f2.js", "2577.6fcee3bd90a61ccd.js", "2658.ca3eefeb8ef46022.js",
  "2687.e004cdc73c5f21a5.js", "2773.1f6998937138af69.js", "2933.bfda009ae59c8959.js",
  "3187.ed18410151a5ec5b.js", "3303.f4f9c85b05b757bf.js", "3325.533aad4e9517763f.js",
  "3326.37efeffca86f7e9e.js", "3353.dd7240517f9a58e7.js", "3414.0ff973de01e09857.js",
  "3488.369309354b983126.js", "3583.429833375bed7a49.js", "3648.d566a5f63bbf3fce.js",
  "3679.939c3517255bbdbd.js", "3804.db0ca8871718bd1c.js", "4006.dc1fab7897035727.js",
  "4045.ad29b6019e1d771b.js", "4080.1d83dd30fb383c00.js", "4174.f0bef5edd0a91021.js",
  "4326.524b6fd74bb3d68e.js", "4330.209583a48558fa5f.js", "4376.fffe46eedc9d65cb.js",
  "4432.af8a68ecc36d7f7c.js", "4609.89d3a8c8b9a84189.js", "4650.278a8db390bf9652.js",
  "4685.4df8b284e5866246.js", "4711.dc95dc4e665bceb0.js", "4753.a382e640d1ef3ad5.js",
  "4788.344e95e8d9b76be6.js", "4793.b83a6f04b9283411.js", "4908.033251909cb3e970.js",
  "4934.2c8953bda8779f31.js", "4959.1a6a12b6a1e434a1.js", "4968.c178382bf5660aaf.js",
  "5001.a9b3b2cf80697a14.js", "5141.a5807ad6b35ed2a0.js", "5168.ff7161e0cbe0ccfc.js",
  "5192.09e3389910edd938.js", "5226.33a14a0b62416f4f.js", "5349.8e8c958af30c8fe3.js",
  "5452.50e0abcbf8e17ca0.js", "5469.4705927b232c5ce2.js", "5474.bc5c76aa8dfb2ffb.js",
  "5652.a1f0aee37d28eab0.js", "5655.2df64cd28e1d69cc.js", "5715.cf850fe66b6e00c2.js",
  "5733.b9d286243be1f468.js", "5836.c2b206534624293c.js", "5841.3cfdfb2dc3943adf.js",
  "5851.26c8e2d4906a57fe.js", "6111.5159e5904345e242.js", "6120.506f61819b72255c.js",
  "6198.ca876af22dee1a17.js", "6560.9c074aaef97592dc.js", "6616.61f4ba0b10bb4207.js",
  "6704.364ce680352b2797.js", "6754.78fb701cac706694.js", "6821.75fcb546a6ee91b8.js",
  "6850.bdc5e9266c121128.js", "6881.bc8ec627b37070cd.js", "6895.251c59d39e396232.js",
  "6903.8ee7ea18cbc67bfa.js", "7052.cd54fcdc8783feda.js", "7180.97350475d575260e.js",
  "7206.480ef9fab826b2bf.js", "7305.2a8a7ad730bceca5.js", "7340.b38288d4e259d2e3.js",
  "7544.0ad9a90d49e32c09.js", "7559.b0e8d6e5b57b9578.js", "7570.b8c851fb77362e72.js",
  "7582.2ab119c13f486505.js", "7602.748d0a232b9745d8.js", "7678.c9e068a374e82767.js",
  "7700.10dd71fa493f168e.js", "7830.48aa5452bec55352.js", "8034.3147055184c17772.js",
  "8094.c0b5905d0273d87c.js", "8136.27bb9c9ebc9dff23.js", "8160.339f44a359055faa.js",
  "8184.c4852ac24e1e0f82.js", "8231.601c981c42ab71c6.js", "8284.b05a69e4c0d20b4b.js",
  "common.24ec31669c9e83ed.js",
  "8618.eeef555e5af499ca.js", "8628.9853cf8722e500ff.js", "8746.08bf323500c9c4ee.js",
  "8777.e15022d181468452.js", "8932.b4a918e820f68cb4.js", "8939.b47265eda02c32e2.js",
  "9016.39b357a5f7b7a092.js", "9230.9bf471277ecf6f5a.js", "9291.5d7255e345f6fddb.js",
  "9325.99eec086c2622c03.js", "9383.0c3eb7e9c65f3ab1.js", "9434.3ff3dcc04be06703.js",
  "9521.d2787b87a790ac56.js", "9536.79d2ab3b985ae139.js", "9541.d6bea2e556784451.js",
  "9562.912bcaf15eff5643.js", "9583.7f277ca25f0af412.js", "9590.eff96621474c53e9.js",
  "9643.a29556cb1ed300e1.js", "9654.cfc521e6edefa7c9.js", "9824.7ab5fccbfa56d506.js",
  "9922.1938bec3aa55ad3e.js", "9958.f778caf84af6d1fe.js"
];

async function run() {
  for (const f of validChunks) {
    const c = await get('https://portal.vnpayinvoice.vn/' + f);
    if (c.includes('25882:')) {
      console.log(`Found 25882 in ${f}`);
      const idx = c.indexOf('25882:');
      console.log(c.slice(idx, idx + 1500));
    }
  }
}
run();
