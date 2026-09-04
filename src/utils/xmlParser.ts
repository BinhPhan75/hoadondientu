import { GDTInvoice, InvoiceItem } from '../types';
import JSZip from 'jszip';
import { detectProvider } from '../services/invoice-engine/providerDetector';

/**
 * Reads a number to Vietnamese currency words according to standard Vietnamese accounting rules.
 */
export function numberToVietnameseWords(num: number): string {
  if (num === 0) return 'Không đồng';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  function readGroup(group: number): string {
    const hundred = Math.floor(group / 100);
    const ten = Math.floor((group % 100) / 10);
    const unit = group % 10;
    let result = '';

    if (hundred > 0 || group >= 100) {
      result += units[hundred] + ' trăm ';
      if (ten === 0 && unit > 0) result += 'lẻ ';
    }

    if (ten > 1) {
      result += units[ten] + ' mươi ';
      if (unit === 1) result += 'mốt ';
      else if (unit === 5) result += 'lăm ';
      else if (unit > 0) result += units[unit] + ' ';
    } else if (ten === 1) {
      result += 'mười ';
      if (unit === 1) result += 'một ';
      else if (unit === 5) result += 'lăm ';
      else if (unit > 0) result += units[unit] + ' ';
    } else if (unit > 0) {
      result += units[unit] + ' ';
    }

    return result.trim();
  }

  let str = '';
  let n = Math.abs(Math.round(num));
  let scaleIdx = 0;

  while (n > 0) {
    const group = n % 1000;
    if (group > 0) {
      const groupStr = readGroup(group);
      str = groupStr + ' ' + scales[scaleIdx] + ' ' + str;
    }
    n = Math.floor(n / 1000);
    scaleIdx++;
  }

  str = str.trim();
  if (!str) return 'Không đồng';
  // Capitalize first letter and append 'đồng chẵn'
  str = str.charAt(0).toUpperCase() + str.slice(1) + ' đồng chẵn';
  return str.replace(/\s+/g, ' ');
}

/**
 * Universal tag extraction helper that works in both Browser (DOM) and Node.js (Regex Fallback).
 */
function extractTagValue(xmlOrElement: string | Element | Document, tagName: string, defaultValue: string = ''): string {
  if (typeof xmlOrElement !== 'string') {
    // Browser DOM element
    const el = xmlOrElement.getElementsByTagName(tagName)[0] || 
               xmlOrElement.getElementsByTagName(tagName.toLowerCase())[0] ||
               xmlOrElement.getElementsByTagName(tagName.toUpperCase())[0];
    if (el && el.textContent) {
      return el.textContent.trim();
    }
    // Try namespace query
    if ('getElementsByTagNameNS' in xmlOrElement) {
      const elNs = xmlOrElement.getElementsByTagNameNS('*', tagName)[0];
      if (elNs && elNs.textContent) return elNs.textContent.trim();
    }
    return defaultValue;
  }

  // Node.js Regex extraction
  const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, '');
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>`, 'i');
  const match = xmlOrElement.match(regex);
  if (match && match[1]) {
    let val = match[1].trim();
    // Handle CDATA wrapper
    if (val.startsWith('<![CDATA[') && val.endsWith(']]>')) {
      val = val.substring(9, val.length - 3).trim();
    }
    return val;
  }
  return defaultValue;
}

/**
 * Universal multiple tag blocks extractor for lists like <HHDVu>...</HHDVu>
 */
function extractTagBlocks(xml: string, tagName: string): string[] {
  const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, '');
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>`, 'gi');
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    if (m[1]) {
      blocks.push(m[1]);
    }
  }
  return blocks;
}

/**
 * Parses an entire Vietnamese E-Invoice XML file according to:
 * - Decision 1450/QĐ-TCT & 1510/QĐ-TCT
 * - Decree 123/2020/ND-CP & Circular 78/2021/TT-BTC
 * Works identically in both Browser and Node.js environments.
 */
export function parseGDTInvoiceXml(xmlString: string, filename?: string): GDTInvoice {
  if (!xmlString || typeof xmlString !== 'string') {
    throw new Error('Dữ liệu XML rỗng hoặc không hợp lệ.');
  }

  let domDoc: Document | null = null;
  const isBrowser = typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined';

  if (isBrowser) {
    try {
      const parser = new DOMParser();
      domDoc = parser.parseFromString(xmlString, 'application/xml');
      const parseError = domDoc.getElementsByTagName('parsererror')[0];
      if (parseError) {
        domDoc = null; // Fallback to regex parser
      }
    } catch {
      domDoc = null;
    }
  }

  const getTag = (context: Document | Element | string, tag: string, fallback: string = ''): string => {
    return extractTagValue(context, tag, fallback);
  };

  const xmlSource = xmlString;

  // 1. TTChung (General Invoice Information)
  const pban = getTag(domDoc || xmlSource, 'PBan') || '2.0.0';
  const thdon = getTag(domDoc || xmlSource, 'THDon') || 
                (getTag(domDoc || xmlSource, 'KHMSHDon') === '1' ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' : 'HÓA ĐƠN BÁN HÀNG');
  const khmshdon = getTag(domDoc || xmlSource, 'KHMSHDon') || getTag(domDoc || xmlSource, 'khmshdon') || '1';
  const khhdon = getTag(domDoc || xmlSource, 'KHHDon') || getTag(domDoc || xmlSource, 'khhdon') || '1C25TGT';
  const shdonRaw = getTag(domDoc || xmlSource, 'SHDon') || getTag(domDoc || xmlSource, 'shdon') || '1';
  const shdon = shdonRaw ? String(parseInt(shdonRaw, 10) || shdonRaw).padStart(7, '0') : '0000001';

  let nlap = getTag(domDoc || xmlSource, 'NLap') || getTag(domDoc || xmlSource, 'nlap') || '';
  if (!nlap) {
    nlap = getTag(domDoc || xmlSource, 'SigningTime') || '';
  }
  if (nlap && !nlap.includes('T')) {
    nlap = `${nlap}T09:00:00`;
  }
  if (!nlap) {
    nlap = new Date().toISOString().substring(0, 19);
  }

  const dvtte = getTag(domDoc || xmlSource, 'DVTTe') || getTag(domDoc || xmlSource, 'dvtte') || 'VND';
  const tygia = parseFloat(getTag(domDoc || xmlSource, 'TGia') || getTag(domDoc || xmlSource, 'tygia') || '1') || 1;
  const htttoan = getTag(domDoc || xmlSource, 'HTTToan') || getTag(domDoc || xmlSource, 'htttoan') || 'TM/CK';

  // 2. NBan (Seller Info)
  let nbanSource: any = domDoc ? (domDoc.getElementsByTagName('NBan')[0] || domDoc) : xmlSource;
  if (typeof nbanSource === 'string') {
    const nbanBlock = extractTagBlocks(xmlSource, 'NBan')[0];
    if (nbanBlock) nbanSource = nbanBlock;
  }
  const nbten = getTag(nbanSource, 'Ten') || getTag(domDoc || xmlSource, 'nbten') || 'CÔNG TY TNHH BÁN HÀNG';
  const nbmst = getTag(nbanSource, 'MST') || getTag(domDoc || xmlSource, 'nbmst') || '0100109106';
  const nbdchi = getTag(nbanSource, 'DChi') || getTag(domDoc || xmlSource, 'nbdchi') || '';
  const nbsdt = getTag(nbanSource, 'SDThoai') || getTag(nbanSource, 'sdt') || '';
  const nbemail = getTag(nbanSource, 'DCTDTu') || getTag(nbanSource, 'email') || '';
  const nbstk = getTag(nbanSource, 'STKNHang') || getTag(nbanSource, 'stk') || '';
  const nbnhang = getTag(nbanSource, 'TNHang') || getTag(nbanSource, 'nhang') || '';

  // 3. NMua (Buyer Info)
  let nmuaSource: any = domDoc ? (domDoc.getElementsByTagName('NMua')[0] || domDoc) : xmlSource;
  if (typeof nmuaSource === 'string') {
    const nmuaBlock = extractTagBlocks(xmlSource, 'NMua')[0];
    if (nmuaBlock) nmuaSource = nmuaBlock;
  }
  const nmten = getTag(nmuaSource, 'Ten') || getTag(domDoc || xmlSource, 'nmten') || 'NGƯỜI MUA HÀNG';
  const nmmst = getTag(nmuaSource, 'MST') || getTag(domDoc || xmlSource, 'nmmst') || '';
  const nmdchi = getTag(nmuaSource, 'DChi') || getTag(domDoc || xmlSource, 'nmdchi') || '';
  const nmsdt = getTag(nmuaSource, 'SDThoai') || '';
  const nmemail = getTag(nmuaSource, 'DCTDTu') || '';

  // 4. DSHHDVu (Invoice Items List)
  const items: InvoiceItem[] = [];
  if (domDoc) {
    const hhdvuNodes = domDoc.getElementsByTagName('HHDVu');
    for (let i = 0; i < hhdvuNodes.length; i++) {
      const node = hhdvuNodes[i];
      const lineNo = parseInt(getTag(node, 'STT') || `${i + 1}`, 10) || i + 1;
      const itemName = getTag(node, 'THHDVu') || getTag(node, 'ten') || `Hàng hóa / Dịch vụ ${i + 1}`;
      const unit = getTag(node, 'DVTinh') || getTag(node, 'dvt') || 'Cái';
      const quantity = parseFloat(getTag(node, 'SLuong') || '1') || 1;
      const unitPrice = parseFloat(getTag(node, 'DGia') || '0') || 0;
      const amount = parseFloat(getTag(node, 'ThTien') || '0') || (quantity * unitPrice);
      const taxRate = getTag(node, 'TSuat') || '10%';
      
      let taxPercent = 10;
      if (taxRate.includes('8')) taxPercent = 8;
      else if (taxRate.includes('5')) taxPercent = 5;
      else if (taxRate.includes('0')) taxPercent = 0;
      else if (taxRate.toUpperCase().includes('KCT') || taxRate.toUpperCase().includes('KKKNT')) taxPercent = 0;

      const taxAmount = Math.round((amount * taxPercent) / 100);
      const totalAmount = amount + taxAmount;

      items.push({
        id: `item_${i + 1}`,
        lineNo,
        itemName,
        unit,
        quantity,
        unitPrice,
        amount,
        taxRate,
        taxRatePercent: taxPercent,
        taxAmount,
        totalAmount
      });
    }
  } else {
    // Regex item blocks extraction
    const itemBlocks = extractTagBlocks(xmlSource, 'HHDVu');
    itemBlocks.forEach((block, idx) => {
      const lineNo = parseInt(extractTagValue(block, 'STT', `${idx + 1}`), 10) || idx + 1;
      const itemName = extractTagValue(block, 'THHDVu') || `Hàng hóa / Dịch vụ ${idx + 1}`;
      const unit = extractTagValue(block, 'DVTinh') || 'Cái';
      const quantity = parseFloat(extractTagValue(block, 'SLuong', '1')) || 1;
      const unitPrice = parseFloat(extractTagValue(block, 'DGia', '0')) || 0;
      const amount = parseFloat(extractTagValue(block, 'ThTien', '0')) || (quantity * unitPrice);
      const taxRate = extractTagValue(block, 'TSuat') || '10%';

      let taxPercent = 10;
      if (taxRate.includes('8')) taxPercent = 8;
      else if (taxRate.includes('5')) taxPercent = 5;
      else if (taxRate.includes('0')) taxPercent = 0;
      else if (taxRate.toUpperCase().includes('KCT') || taxRate.toUpperCase().includes('KKKNT')) taxPercent = 0;

      const taxAmount = Math.round((amount * taxPercent) / 100);
      const totalAmount = amount + taxAmount;

      items.push({
        id: `item_${idx + 1}`,
        lineNo,
        itemName,
        unit,
        quantity,
        unitPrice,
        amount,
        taxRate,
        taxRatePercent: taxPercent,
        taxAmount,
        totalAmount
      });
    });
  }

  // 5. TToan (Totals and Tax Summary)
  const tgtcthue = parseFloat(getTag(domDoc || xmlSource, 'TgTCThue') || '0') || items.reduce((s, it) => s + it.amount, 0);
  const tgtthue = parseFloat(getTag(domDoc || xmlSource, 'TgTThue') || '0') || items.reduce((s, it) => s + it.taxAmount, 0);
  const tgtttbso = parseFloat(getTag(domDoc || xmlSource, 'TgTTTBSo') || '0') || (tgtcthue + tgtthue);
  let tgtttbchu = getTag(domDoc || xmlSource, 'TgTTTBChu') || '';
  if (!tgtttbchu) {
    tgtttbchu = numberToVietnameseWords(tgtttbso);
  }

  // Tax Breakdown (THTTLTSuat)
  const vatBreakdown: Array<{ taxRate: string; amount: number; taxAmount: number }> = [];
  const ltSuatBlocks = extractTagBlocks(xmlSource, 'LTSuat');
  if (ltSuatBlocks.length > 0) {
    for (const b of ltSuatBlocks) {
      const r = extractTagValue(b, 'TSuat') || '10%';
      const a = parseFloat(extractTagValue(b, 'ThTien') || '0') || 0;
      const t = parseFloat(extractTagValue(b, 'TThue') || '0') || 0;
      vatBreakdown.push({ taxRate: r, amount: a, taxAmount: t });
    }
  } else if (items.length > 0) {
    const mapRates = new Map<string, { amount: number; taxAmount: number }>();
    items.forEach(it => {
      const r = it.taxRate || '10%';
      const curr = mapRates.get(r) || { amount: 0, taxAmount: 0 };
      curr.amount += it.amount;
      curr.taxAmount += it.taxAmount;
      mapRates.set(r, curr);
    });
    mapRates.forEach((val, key) => {
      vatBreakdown.push({ taxRate: key, amount: val.amount, taxAmount: val.taxAmount });
    });
  }

  // 6. Tax Authority Code (MCCQT)
  let mhdon = getTag(domDoc || xmlSource, 'MCCQT') || getTag(domDoc || xmlSource, 'mhdon') || '';
  if (!mhdon) {
    // Check in TTKhac or TTin
    const ttinBlocks = extractTagBlocks(xmlSource, 'TTin');
    for (const block of ttinBlocks) {
      const truong = extractTagValue(block, 'TTruong');
      if (truong.toLowerCase().includes('macqt') || truong.toLowerCase().includes('mccqt')) {
        mhdon = extractTagValue(block, 'DLieu');
        break;
      }
    }
  }
  const hsgcma = !!mhdon || khmshdon.startsWith('1C') || khhdon.startsWith('1C');

  // 7. Digital Signature (DSCKS)
  let signerName = getTag(domDoc || xmlSource, 'X509SubjectName') || nbten;
  let rawIssuer = getTag(domDoc || xmlSource, 'X509IssuerName') || '';
  const signedDate = getTag(domDoc || xmlSource, 'SigningTime') || nlap;
  const hasDigitalSignature = xmlSource.includes('Signature') || xmlSource.includes('X509Certificate');
  let caProvider = rawIssuer || (hasDigitalSignature ? 'Chữ ký số hợp lệ' : 'Chưa ký số');

  if (signerName.includes('CN=')) {
    const cnMatch = signerName.match(/CN=([^,]+)/i);
    if (cnMatch && cnMatch[1]) signerName = cnMatch[1].trim();
  }
  if (caProvider.includes('O=')) {
    const oMatch = caProvider.match(/O=([^,]+)/i);
    if (oMatch && oMatch[1]) caProvider = oMatch[1].trim();
  }

  // Buyer signature
  let buyerSignerName = '';
  let buyerSignedDate = '';
  const buyerSigBlock = extractTagBlocks(xmlSource, 'NMua')[1]; // check if signature under NMua
  if (buyerSigBlock && buyerSigBlock.includes('Signature')) {
    buyerSignerName = extractTagValue(buyerSigBlock, 'X509SubjectName') || nmten;
    buyerSignedDate = extractTagValue(buyerSigBlock, 'SigningTime') || nlap;
  }

  // 8. Provider & Lookup Details (Nhà cung cấp giải pháp & Mã tra cứu)
  const provider = detectProvider(xmlSource);
  const msttcgp = getTag(domDoc || xmlSource, 'MSTTCGP') || '';
  const tentcgp = getTag(domDoc || xmlSource, 'TenTCGP') || getTag(domDoc || xmlSource, 'TCGP') || '';

  // Bóc tách mã tra cứu từ <MTCuu>, <MaTraCuu>, <TTin>
  let lookupCode = getTag(domDoc || xmlSource, 'MTCuu') || getTag(domDoc || xmlSource, 'MaTraCuu') || '';
  let lookupUrl = getTag(domDoc || xmlSource, 'Website') || getTag(domDoc || xmlSource, 'WebTraCuu') || '';

  if (!lookupCode || !lookupUrl) {
    const ttinBlocks = extractTagBlocks(xmlSource, 'TTin');
    for (const block of ttinBlocks) {
      const truong = extractTagValue(block, 'TTruong').toLowerCase();
      const dlieu = extractTagValue(block, 'DLieu');
      if (!lookupCode && (truong.includes('tra cuu') || truong.includes('tracuu') || truong.includes('matracuu') || truong.includes('fkey') || truong.includes('mã tra cứu'))) {
        lookupCode = dlieu;
      }
      if (!lookupUrl && (truong.includes('link') || truong.includes('url') || truong.includes('website') || truong.includes('cổng tra cứu') || dlieu.startsWith('http'))) {
        lookupUrl = dlieu;
      }
    }
  }

  // Nếu lookupUrl chưa có, trích xuất URL http/https bất kỳ trong XML
  if (!lookupUrl) {
    const urlMatch = xmlSource.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<"']*)?/i);
    if (urlMatch && urlMatch[0] && !urlMatch[0].includes('w3.org')) {
      lookupUrl = urlMatch[0];
    }
  }

  const id = `XML_${khhdon}_${shdon}_${nbmst}_${Date.now()}`;

  return {
    id,
    khmshdon,
    khhdon,
    shdon,
    tdlap: nlap,
    nbmst,
    nbten,
    nbdchi,
    nbsdt,
    nbemail,
    nbstk,
    nbnhang,
    nmmst,
    nmten,
    nmdchi,
    nmsdt,
    nmemail,
    tgtcthue,
    tgtthue,
    tgtttbso,
    tgtttbchu,
    htttoan,
    dvtte,
    tygia,
    thdon,
    vatBreakdown,
    tthdon: 1,
    tthdonLabel: 'Hóa đơn gốc',
    ttxly: hsgcma ? 1 : 2,
    ttxlyLabel: hsgcma ? 'Đã cấp mã CQT' : 'Không mã CQT',
    mhdon: mhdon || (hsgcma ? '00E9C762DA374972B621A0F9004B2C89' : undefined),
    hsgcma,
    loaiHdon: 'purchase',
    hasDigitalSignature,
    signerName,
    signedDate,
    caProvider,
    buyerSignerName,
    buyerSignedDate,
    provider,
    msttcgp,
    tentcgp,
    lookupCode,
    lookupUrl,
    items: items.length > 0 ? items : [
      {
        lineNo: 1,
        itemName: 'Hàng hóa, dịch vụ theo hóa đơn gốc ' + shdon,
        unit: 'Gói',
        quantity: 1,
        unitPrice: tgtcthue,
        amount: tgtcthue,
        taxRate: '10%',
        taxRatePercent: 10,
        taxAmount: tgtthue,
        totalAmount: tgtttbso
      }
    ],
    rawXml: xmlString
  };
}

/**
 * Extracts and parses all XML invoices from a ZIP file buffer
 */
export async function parseInvoicesFromZip(zipBuffer: ArrayBuffer | Blob): Promise<GDTInvoice[]> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipBuffer);
  const parsedInvoices: GDTInvoice[] = [];

  const entries = Object.keys(loadedZip.files);
  for (const filename of entries) {
    const file = loadedZip.files[filename];
    if (!file.dir && (filename.toLowerCase().endsWith('.xml') || filename.toLowerCase().endsWith('.inv'))) {
      try {
        const content = await file.async('string');
        const invoice = parseGDTInvoiceXml(content, filename);
        parsedInvoices.push(invoice);
      } catch (err) {
        console.warn(`Không thể phân tích tệp XML ${filename}:`, err);
      }
    }
  }

  return parsedInvoices;
}
