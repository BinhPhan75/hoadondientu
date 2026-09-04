/**
 * Bộ nhận diện Nhà cung cấp Hóa đơn điện tử (Vietnamese E-Invoice Provider Detection)
 * 
 * Tuân thủ quy tắc kiểm tra nghiêm ngặt theo thứ tự ưu tiên:
 * 1. Ưu tiên 1: Regex quét Domain URL Tra cứu trong toàn bộ XML
 *    - "meinvoice.vn" -> 'MISA'
 *    - "sinvoice.viettel.vn" -> 'VIETTEL'
 *    - "vnpt-invoice" -> 'VNPT'
 *    - "inv.4si.vn" -> '4SI'
 *    - "easyinvoice" -> 'EASYINVOICE'
 *    - "bkav" -> 'BKAV'
 * 
 * 2. Ưu tiên 2: Đọc thẻ <Signature> / Chữ ký số
 *    - Đọc giá trị trong <X509IssuerName> hoặc thông tin Chữ ký số bên bán
 *    - Nhận diện đúng tên CA phát hành (MISA-CA, VIETTEL-CA, VNPT-CA, BKAV-CA, EASYCA, 4SI-CA)
 * 
 * 3. Fallback an toàn:
 *    - Trả về 'UNKNOWN' nếu không khớp bất kỳ điều kiện nào (tuyệt đối không đoán mò)
 *    - Cho phép hệ thống chuyển thẳng sang dùng Render HTML/CSS nội bộ
 */

export type DetectedInvoiceProvider = 
  | 'MISA' 
  | 'VIETTEL' 
  | 'VNPT' 
  | '4SI' 
  | 'EASYINVOICE' 
  | 'BKAV' 
  | 'THAISON'
  | 'CYBERBILL'
  | 'UNKNOWN';

export interface DetectionResultDetails {
  provider: DetectedInvoiceProvider;
  priority: 1 | 1.5 | 2 | 0; // 1: Domain URL, 1.5: Solution Provider MSTTCGP, 2: Digital Signature CA, 0: Unknown Fallback
  matchedPattern: string;
  sourceDescription: string;
}

/**
 * Hàm nhận diện nhà cung cấp HĐĐT từ chuỗi XML theo đúng thứ tự ưu tiên nghiêm ngặt
 * @param xmlString Chuỗi XML hóa đơn điện tử
 * @returns Mã nhà cung cấp
 */
export function detectProvider(xmlString: string | null | undefined): DetectedInvoiceProvider {
  return detectProviderWithDetails(xmlString).provider;
}

/**
 * Hàm nhận diện chi tiết kèm lý do và cấp độ ưu tiên (phục vụ hiển thị log chẩn đoán)
 */
export function detectProviderWithDetails(xmlString: string | null | undefined): DetectionResultDetails {
  if (!xmlString || typeof xmlString !== 'string' || !xmlString.trim()) {
    return {
      provider: 'UNKNOWN',
      priority: 0,
      matchedPattern: '',
      sourceDescription: 'Dữ liệu XML rỗng hoặc không hợp lệ'
    };
  }

  // =========================================================================
  // ƯU TIÊN 1: Regex quét Domain URL Tra cứu trong toàn bộ XML
  // =========================================================================

  // 1.1 meinvoice.vn / misa.vn -> 'MISA'
  if (/meinvoice\.vn|tracuu\.meinvoice|misa\.vn/i.test(xmlString)) {
    return {
      provider: 'MISA',
      priority: 1,
      matchedPattern: 'meinvoice.vn',
      sourceDescription: 'Phát hiện Domain tra cứu MISA meInvoice (meinvoice.vn)'
    };
  }

  // 1.2 sinvoice.viettel.vn / sinvoice.vn / viettel.vn/sinvoice -> 'VIETTEL'
  if (/sinvoice\.viettel\.vn|sinvoice\.vn|vinvoice\.viettel\.vn|viettel\.vn\/sinvoice/i.test(xmlString)) {
    return {
      provider: 'VIETTEL',
      priority: 1,
      matchedPattern: 'sinvoice.viettel.vn',
      sourceDescription: 'Phát hiện Domain tra cứu Viettel S-Invoice (sinvoice.viettel.vn)'
    };
  }

  // 1.3 vnpt-invoice / invoice.vnpt.vn -> 'VNPT'
  if (/vnpt-invoice|invoice\.vnpt\.vn|tracuu\.vnpt-invoice/i.test(xmlString)) {
    return {
      provider: 'VNPT',
      priority: 1,
      matchedPattern: 'vnpt-invoice',
      sourceDescription: 'Phát hiện Domain/Chuỗi tra cứu VNPT Invoice (vnpt-invoice)'
    };
  }

  // 1.4 inv.4si.vn / 4si.vn -> '4SI'
  if (/inv\.4si\.vn|4si\.vn/i.test(xmlString)) {
    return {
      provider: '4SI',
      priority: 1,
      matchedPattern: 'inv.4si.vn',
      sourceDescription: 'Phát hiện Domain tra cứu 4Si E-Invoice (inv.4si.vn)'
    };
  }

  // 1.5 easyinvoice / softdreams.vn -> 'EASYINVOICE'
  if (/easyinvoice|softdreams\.vn|tracuu\.easyinvoice/i.test(xmlString)) {
    return {
      provider: 'EASYINVOICE',
      priority: 1,
      matchedPattern: 'easyinvoice',
      sourceDescription: 'Phát hiện Domain/Chuỗi tra cứu Softdreams EasyInvoice (easyinvoice)'
    };
  }

  // 1.6 bkav / ehoadon.vn -> 'BKAV'
  if (/bkav|ehoadon\.vn|ehoadon\.bkav/i.test(xmlString)) {
    return {
      provider: 'BKAV',
      priority: 1,
      matchedPattern: 'bkav',
      sourceDescription: 'Phát hiện Domain/Chuỗi tra cứu Bkav eHoadon (bkav / ehoadon.vn)'
    };
  }

  // 1.7 einvoice.vn / thaison.vn -> 'THAISON'
  if (/einvoice\.vn|thaison\.vn/i.test(xmlString)) {
    return {
      provider: 'THAISON',
      priority: 1,
      matchedPattern: 'einvoice.vn',
      sourceDescription: 'Phát hiện Domain tra cứu Thái Sơn E-Invoice (einvoice.vn)'
    };
  }

  // 1.8 cyberbill.vn / cyberlotus -> 'CYBERBILL'
  if (/cyberbill\.vn|cyberlotus\.com/i.test(xmlString)) {
    return {
      provider: 'CYBERBILL',
      priority: 1,
      matchedPattern: 'cyberbill.vn',
      sourceDescription: 'Phát hiện Domain tra cứu CyberLotus CyberBill (cyberbill.vn)'
    };
  }

  // =========================================================================
  // ƯU TIÊN 1.5: Thẻ <MSTTCGP> & <TenTCGP> (Mã số thuế & Tên Tổ chức giải pháp)
  // Chuẩn pháp lý Quyết định 1450/QĐ-TCT và 1510/QĐ-TCT của Tổng cục Thuế
  // =========================================================================
  const msttcgpMatch = xmlString.match(/<(?:[a-zA-Z0-9_]+:)?MSTTCGP(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?MSTTCGP>/i);
  if (msttcgpMatch && msttcgpMatch[1]) {
    const msttcgp = msttcgpMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    if (msttcgp === '0101243150') {
      return {
        provider: 'MISA',
        priority: 1.5,
        matchedPattern: 'MSTTCGP: 0101243150',
        sourceDescription: 'Phát hiện Tổ chức giải pháp MISA meInvoice qua thẻ <MSTTCGP> (0101243150)'
      };
    }
    if (msttcgp === '0100109106') {
      return {
        provider: 'VIETTEL',
        priority: 1.5,
        matchedPattern: 'MSTTCGP: 0100109106',
        sourceDescription: 'Phát hiện Tổ chức giải pháp Viettel S-Invoice qua thẻ <MSTTCGP> (0100109106)'
      };
    }
    if (msttcgp === '0100684378') {
      return {
        provider: 'VNPT',
        priority: 1.5,
        matchedPattern: 'MSTTCGP: 0100684378',
        sourceDescription: 'Phát hiện Tổ chức giải pháp VNPT Invoice qua thẻ <MSTTCGP> (0100684378)'
      };
    }
    if (msttcgp === '0101360697') {
      return {
        provider: 'BKAV',
        priority: 1.5,
        matchedPattern: 'MSTTCGP: 0101360697',
        sourceDescription: 'Phát hiện Tổ chức giải pháp Bkav eHoadon qua thẻ <MSTTCGP> (0101360697)'
      };
    }
    if (msttcgp === '0105987432') {
      return {
        provider: 'EASYINVOICE',
        priority: 1.5,
        matchedPattern: 'MSTTCGP: 0105987432',
        sourceDescription: 'Phát hiện Tổ chức giải pháp Softdreams EasyInvoice qua thẻ <MSTTCGP> (0105987432)'
      };
    }
    if (msttcgp === '0315744883') {
      return {
        provider: '4SI',
        priority: 1.5,
        matchedPattern: 'MSTTCGP: 0315744883',
        sourceDescription: 'Phát hiện Tổ chức giải pháp 4Si E-Invoice qua thẻ <MSTTCGP> (0315744883)'
      };
    }
    if (msttcgp === '0101300842') {
      return {
        provider: 'THAISON',
        priority: 1.5,
        matchedPattern: 'MSTTCGP: 0101300842',
        sourceDescription: 'Phát hiện Tổ chức giải pháp Thái Sơn E-Invoice qua thẻ <MSTTCGP> (0101300842)'
      };
    }
    if (msttcgp === '0107871301') {
      return {
        provider: 'CYBERBILL',
        priority: 1.5,
        matchedPattern: 'MSTTCGP: 0107871301',
        sourceDescription: 'Phát hiện Tổ chức giải pháp CyberBill qua thẻ <MSTTCGP> (0107871301)'
      };
    }
  }

  // Quét thẻ tên tổ chức giải pháp <TenTCGP>, <TCGP>, <ToChucGiaiPhap>
  const tentcgpMatch = xmlString.match(/<(?:[a-zA-Z0-9_]+:)?(?:TenTCGP|TCGP|ToChucGiaiPhap)(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_]+:)?(?:TenTCGP|TCGP|ToChucGiaiPhap)>/i);
  if (tentcgpMatch && tentcgpMatch[1]) {
    const tentcgp = tentcgpMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim().toUpperCase();
    if (tentcgp.includes('MISA')) {
      return { provider: 'MISA', priority: 1.5, matchedPattern: 'TenTCGP: MISA', sourceDescription: 'Tổ chức giải pháp: MISA' };
    }
    if (tentcgp.includes('VIETTEL')) {
      return { provider: 'VIETTEL', priority: 1.5, matchedPattern: 'TenTCGP: VIETTEL', sourceDescription: 'Tổ chức giải pháp: Viettel' };
    }
    if (tentcgp.includes('VNPT')) {
      return { provider: 'VNPT', priority: 1.5, matchedPattern: 'TenTCGP: VNPT', sourceDescription: 'Tổ chức giải pháp: VNPT' };
    }
    if (tentcgp.includes('BKAV')) {
      return { provider: 'BKAV', priority: 1.5, matchedPattern: 'TenTCGP: BKAV', sourceDescription: 'Tổ chức giải pháp: BKAV' };
    }
    if (tentcgp.includes('SOFTDREAMS') || tentcgp.includes('EASYINVOICE')) {
      return { provider: 'EASYINVOICE', priority: 1.5, matchedPattern: 'TenTCGP: SOFTDREAMS', sourceDescription: 'Tổ chức giải pháp: Softdreams EasyInvoice' };
    }
    if (tentcgp.includes('4SI')) {
      return { provider: '4SI', priority: 1.5, matchedPattern: 'TenTCGP: 4SI', sourceDescription: 'Tổ chức giải pháp: 4Si' };
    }
    if (tentcgp.includes('THÁI SƠN') || tentcgp.includes('THAISON')) {
      return { provider: 'THAISON', priority: 1.5, matchedPattern: 'TenTCGP: THAISON', sourceDescription: 'Tổ chức giải pháp: Thái Sơn' };
    }
    if (tentcgp.includes('CYBERLOTUS') || tentcgp.includes('CYBERBILL')) {
      return { provider: 'CYBERBILL', priority: 1.5, matchedPattern: 'TenTCGP: CYBERBILL', sourceDescription: 'Tổ chức giải pháp: CyberBill' };
    }
  }

  // =========================================================================
  // ƯU TIÊN 2: Đọc thẻ <Signature> / Chữ ký số
  // Đọc giá trị trong <X509IssuerName> hoặc thông tin Chữ ký số bên bán
  // Nhận diện đúng tên CA phát hành (MISA-CA, VIETTEL-CA, VNPT-CA...)
  // =========================================================================

  const signatureIssuers = extractSignatureIssuers(xmlString);

  for (const issuerText of signatureIssuers) {
    const identified = matchCertificateAuthority(issuerText);
    if (identified) {
      return {
        provider: identified.provider,
        priority: 2,
        matchedPattern: identified.matchedName,
        sourceDescription: `Chữ ký số phát hành bởi ${identified.matchedName} (Issuer: "${issuerText.substring(0, 100)}")`
      };
    }
  }

  // =========================================================================
  // FALLBACK AN TOÀN: Tuyệt đối không đoán mò
  // Trả về 'UNKNOWN' để hệ thống chuyển thẳng sang Render HTML/CSS nội bộ
  // =========================================================================
  return {
    provider: 'UNKNOWN',
    priority: 0,
    matchedPattern: '',
    sourceDescription: 'Không phát hiện Domain tra cứu hoặc Chữ ký số đặc thù. Chuyển sang Render nội bộ.'
  };
}

/**
 * Trích xuất các chuỗi thông tin Nhà cung cấp chứng thực số (CA) từ khối Chữ ký số
 * Hỗ trợ bóc tách:
 * - Khối chữ ký bên bán: <NBan><Signature>...</Signature></NBan> hoặc <NBKy>
 * - Tất cả thẻ <X509IssuerName> (hỗ trợ namespace ds:, cdata, hoa thường)
 * - Các thẻ mở rộng: <CAProvider>, <TenToChucChungThuc>, <NhaCungCapChungThuSo>
 */
function extractSignatureIssuers(xml: string): string[] {
  const issuers: string[] = [];

  // Helper bóc tách nội dung một thẻ XML bất kỳ
  const extractTags = (content: string, tagName: string): string[] => {
    const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, '');
    const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>`, 'gi');
    const list: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        let val = match[1].trim();
        if (val.startsWith('<![CDATA[') && val.endsWith(']]>')) {
          val = val.substring(9, val.length - 3).trim();
        }
        if (val) list.push(val);
      }
    }
    return list;
  };

  // 1. Quét ưu tiên trong khối Chữ ký số bên bán (NBan / NBKy / SellerSignature)
  const sellerWrappers = [
    ...extractTags(xml, 'NBan'),
    ...extractTags(xml, 'NBKy'),
    ...extractTags(xml, 'SellerSignature')
  ];

  for (const sellerBlock of sellerWrappers) {
    const sellerIssuers = extractTags(sellerBlock, 'X509IssuerName');
    issuers.push(...sellerIssuers);

    // Thẻ mở rộng bên bán
    for (const tag of ['CAProvider', 'TenToChucChungThuc', 'NhaCungCapChungThuSo', 'ToChucChungThuc']) {
      const vals = extractTags(sellerBlock, tag);
      issuers.push(...vals);
    }
  }

  // 2. Quét toàn bộ thẻ <X509IssuerName> trong tài liệu
  const allDocIssuers = extractTags(xml, 'X509IssuerName');
  for (const item of allDocIssuers) {
    if (!issuers.includes(item)) {
      issuers.push(item);
    }
  }

  // 3. Nếu chưa có, quét thêm bên trong mọi khối <Signature>
  if (issuers.length === 0) {
    const sigBlocks = extractTags(xml, 'Signature');
    for (const sig of sigBlocks) {
      const sigIssuers = extractTags(sig, 'X509IssuerName');
      issuers.push(...sigIssuers);

      // Nếu không có IssuerName nhưng có SubjectName hoặc KeyInfo
      const keyInfos = extractTags(sig, 'KeyInfo');
      for (const ki of keyInfos) {
        issuers.push(ki);
      }
    }
  }

  // 4. Các thẻ CA độc lập ở cấp Root / TTin / TTKhac
  for (const tag of ['CAProvider', 'TenToChucChungThuc', 'NhaCungCapChungThuSo', 'ToChucChungThuc']) {
    const vals = extractTags(xml, tag);
    for (const v of vals) {
      if (!issuers.includes(v)) {
        issuers.push(v);
      }
    }
  }

  return issuers;
}

/**
 * Nhận diện chính xác tên CA phát hành chứng thư số bên bán
 */
function matchCertificateAuthority(issuerText: string): { provider: DetectedInvoiceProvider; matchedName: string } | null {
  if (!issuerText) return null;

  const upper = issuerText.toUpperCase();

  // Bỏ qua chứng thư của Cơ quan thuế / Ban Cơ yếu Chính phủ nếu không có CA nhà cung cấp
  const isTaxAuthorityOnly = (
    upper.includes('BAN CƠ YẾU') || 
    upper.includes('BAN CO YEU') || 
    upper.includes('TỔNG CỤC THUẾ') || 
    upper.includes('TONG CUC THUE') ||
    upper.includes('CỤC THUẾ')
  ) && !/MISA|VIETTEL|VNPT|BKAV|EASY|SOFTDREAMS|4SI/i.test(upper);

  if (isTaxAuthorityOnly) {
    return null;
  }

  // 2.1 MISA-CA
  if (
    upper.includes('MISA-CA') || 
    upper.includes('MISA CA') || 
    /\bMISA-?CA\b/i.test(issuerText) ||
    (upper.includes('MISA') && (upper.includes('CN=MISA') || upper.includes('O=MISA') || upper.includes('CÔNG TY CỔ PHẦN MISA')))
  ) {
    return { provider: 'MISA', matchedName: 'MISA-CA' };
  }

  // 2.2 VIETTEL-CA
  if (
    upper.includes('VIETTEL-CA') || 
    upper.includes('VIETTEL CA') || 
    /\bVIETTEL-?CA\b/i.test(issuerText) ||
    (upper.includes('VIETTEL') && (upper.includes('CN=VIETTEL') || upper.includes('O=VIETTEL') || upper.includes('TẬP ĐOÀN CÔNG NGHIỆP - VIỄN THÔNG QUÂN ĐỘI')))
  ) {
    return { provider: 'VIETTEL', matchedName: 'VIETTEL-CA' };
  }

  // 2.3 VNPT-CA
  if (
    upper.includes('VNPT-CA') || 
    upper.includes('VNPT CA') || 
    /\bVNPT-?CA\b/i.test(issuerText) ||
    (upper.includes('VNPT') && (upper.includes('CN=VNPT') || upper.includes('O=VNPT') || upper.includes('TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM')))
  ) {
    return { provider: 'VNPT', matchedName: 'VNPT-CA' };
  }

  // 2.4 BKAV-CA
  if (
    upper.includes('BKAV-CA') || 
    upper.includes('BKAV CA') || 
    /\bBKAV-?CA\b/i.test(issuerText) ||
    (upper.includes('BKAV') && (upper.includes('CN=BKAV') || upper.includes('O=BKAV') || upper.includes('CÔNG TY CỔ PHẦN PHẦN MỀM BKAV')))
  ) {
    return { provider: 'BKAV', matchedName: 'BKAV-CA' };
  }

  // 2.5 EASYINVOICE (Softdreams / EasyCA)
  if (
    upper.includes('EASYCA') || 
    upper.includes('EASY-CA') || 
    upper.includes('EASY CA') ||
    upper.includes('SOFTDREAMS') || 
    upper.includes('EASYINVOICE')
  ) {
    return { provider: 'EASYINVOICE', matchedName: 'EasyCA (Softdreams)' };
  }

  // 2.6 4SI-CA
  if (
    upper.includes('4SI-CA') || 
    upper.includes('4SI CA') || 
    upper.includes('4-SI') ||
    /\b4SI-?CA\b/i.test(issuerText) ||
    (upper.includes('4SI') && (upper.includes('CN=4SI') || upper.includes('O=4SI') || upper.includes('GIẢI PHÁP 4SI')))
  ) {
    return { provider: '4SI', matchedName: '4SI-CA' };
  }

  // Các CA khác (FPT-CA, CA2, SMART-CA, NEW-CA, SAFE-CA...) không khớp với các nhà cung cấp trên
  return null;
}
