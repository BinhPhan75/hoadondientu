const PORTALS: Record<string, string[]> = {
  MISA: ['meinvoice.vn', 'misa.vn'],
  THAISON: ['einvoice.vn', 'einvoice.com.vn', 'thaison.vn'],
  MINVOICE: ['minvoice.vn', 'minvoice.com.vn'],
  VIETTEL: ['sinvoice.viettel.vn', 'vinvoice.viettel.vn', 'sinvoice.vn'],
  VNPT: ['vnpt-invoice.com.vn', 'vnpt-invoice.vn', 'invoice.vnpt.vn'],
  EASYINVOICE: ['easyinvoice.vn', 'easyinvoice.com.vn', 'softdreams.vn'],
  BKAV: ['ehoadon.vn', 'ehoadon.bkav.com'],
  LCS: ['lcssoft.com.vn'], '4SI': ['4si.vn'], VNPAY: ['vnpayinvoice.vn', 'einvoice.vietcombank.com.vn'],
  CYBERBILL: ['cyberbill.vn'], FPT: ['hoadon.ftg.vn', 'hoadondientu.fpt.com.vn'],
};

export const SOLUTION_PROVIDERS: Record<string, string> = {
  '0101243150': 'MISA', '0101300842': 'THAISON', '0106026495': 'MINVOICE',
  '0100684378': 'VNPT', '0100686209': 'VNPT', '0100109106': 'VIETTEL',
  '0105987432': 'EASYINVOICE', '0315744883': '4SI', '0302999571': 'LCS',
  '0101360697': 'BKAV', '0102182292': 'VNPAY', '0104128565': 'FPT', '0107871301': 'CYBERBILL',
};

export function providerFromPortal(value: string): string | undefined {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    const host = url.hostname.toLowerCase();
    return Object.entries(PORTALS).find(([, domains]) =>
      domains.some(domain => host === domain || host.endsWith(`.${domain}`)))?.[0];
  } catch { return undefined; }
}

export function providerFromXmlPortal(xml: string): string | undefined {
  // Certificate issuers and contact email addresses are not invoice portals.
  const content = xml.replace(/<(?:\w+:)?(?:Signature|X509Certificate|X509IssuerName|X509SubjectName)\b[^>]*>[\s\S]*?<\/(?:\w+:)?(?:Signature|X509Certificate|X509IssuerName|X509SubjectName)>/gi, '');
  for (const url of content.match(/https?:\/\/[^\s<>"']+/gi) || []) {
    const provider = providerFromPortal(url.replace(/\]\]>.*$/, ''));
    if (provider) return provider;
  }
  return undefined;
}
