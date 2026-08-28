import { GDTInvoice, InvoiceItem } from '../types';
import JSZip from 'jszip';

/**
 * Reads a number to Vietnamese words
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
  // Capitalize first letter
  str = str.charAt(0).toUpperCase() + str.slice(1) + ' đồng chẵn';
  return str.replace(/\s+/g, ' ');
}

/**
 * Helper to safely extract XML tag text
 */
function getTagText(xmlDoc: Document | Element, tagName: string, defaultValue: string = ''): string {
  const el = xmlDoc.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || defaultValue;
}

/**
 * Parses a single Vietnamese E-Invoice XML string into a structured GDTInvoice object.
 * Conforming to Decree 123/2020/ND-CP, Circular 78/2021/TT-BTC and popular providers.
 */
export function parseGDTInvoiceXml(xmlString: string, filename?: string): GDTInvoice {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  // Check parsing error
  const parserError = doc.getElementsByTagName('parsererror')[0];
  if (parserError) {
    throw new Error('Tệp XML không đúng định dạng: ' + parserError.textContent);
  }

  // 1. TTChung (General Info)
  const khmshdon = getTagText(doc, 'KHMSHDon') || getTagText(doc, 'khmshdon') || '1';
  const khhdon = getTagText(doc, 'KHHDon') || getTagText(doc, 'khhdon') || '1C25TGT';
  const shdon = getTagText(doc, 'SHDon') || getTagText(doc, 'shdon') || '0000001';
  
  let nlap = getTagText(doc, 'NLap') || getTagText(doc, 'nlap') || getTagText(doc, 'SigningTime') || '';
  if (nlap && !nlap.includes('T')) {
    // Format YYYY-MM-DD to ISO
    nlap = `${nlap}T09:00:00`;
  }
  if (!nlap) {
    nlap = new Date().toISOString().substring(0, 19);
  }

  const dvtte = getTagText(doc, 'DVTTe') || getTagText(doc, 'dvtte') || 'VND';
  const tygia = parseFloat(getTagText(doc, 'TGia') || getTagText(doc, 'tygia') || '1') || 1;
  const htttoan = getTagText(doc, 'HTTToan') || getTagText(doc, 'htttoan') || 'TM/CK';

  // 2. NBan (Seller)
  const nbanEl = doc.getElementsByTagName('NBan')[0] || doc.getElementsByTagName('nban')[0] || doc;
  const nbten = getTagText(nbanEl, 'Ten') || getTagText(nbanEl, 'nbten') || getTagText(doc, 'nbten') || 'CÔNG TY TNHH BÁN HÀNG';
  const nbmst = getTagText(nbanEl, 'MST') || getTagText(nbanEl, 'nbmst') || getTagText(doc, 'nbmst') || '0100109106';
  const nbdchi = getTagText(nbanEl, 'DChi') || getTagText(nbanEl, 'nbdchi') || getTagText(doc, 'nbdchi') || '';
  const nbsdt = getTagText(nbanEl, 'SDThoai') || getTagText(nbanEl, 'nbsdt') || '';
  const nbemail = getTagText(nbanEl, 'DCTDTu') || getTagText(nbanEl, 'nbemail') || '';
  const nbstk = getTagText(nbanEl, 'STKNHang') || getTagText(nbanEl, 'nbstk') || '';
  const nbnhang = getTagText(nbanEl, 'TNHang') || getTagText(nbanEl, 'nbnhang') || '';

  // 3. NMua (Buyer)
  const nmuaEl = doc.getElementsByTagName('NMua')[0] || doc.getElementsByTagName('nmua')[0] || doc;
  const nmten = getTagText(nmuaEl, 'Ten') || getTagText(nmuaEl, 'nmten') || getTagText(doc, 'nmten') || 'NGƯỜI MUA HÀNG';
  const nmmst = getTagText(nmuaEl, 'MST') || getTagText(nmuaEl, 'nmmst') || getTagText(doc, 'nmmst') || '';
  const nmdchi = getTagText(nmuaEl, 'DChi') || getTagText(nmuaEl, 'nmdchi') || getTagText(doc, 'nmdchi') || '';
  const nmsdt = getTagText(nmuaEl, 'SDThoai') || getTagText(nmuaEl, 'nmsdt') || '';
  const nmemail = getTagText(nmuaEl, 'DCTDTu') || getTagText(nmuaEl, 'nmemail') || '';

  // 4. Items (DSHHDVu)
  const items: InvoiceItem[] = [];
  const itemNodes = doc.getElementsByTagName('HHDVu');
  
  if (itemNodes.length > 0) {
    for (let i = 0; i < itemNodes.length; i++) {
      const node = itemNodes[i];
      const lineNo = parseInt(getTagText(node, 'STT') || `${i + 1}`, 10) || i + 1;
      const itemName = getTagText(node, 'THHDVu') || getTagText(node, 'ten') || 'Hàng hóa / Dịch vụ';
      const unit = getTagText(node, 'DVTinh') || getTagText(node, 'dvt') || 'Cái';
      const quantity = parseFloat(getTagText(node, 'SLuong') || '1') || 1;
      const unitPrice = parseFloat(getTagText(node, 'DGia') || '0') || 0;
      const amount = parseFloat(getTagText(node, 'ThTien') || '0') || (quantity * unitPrice);
      const taxRate = getTagText(node, 'TSuat') || '10%';
      
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
  }

  // 5. TToan (Totals)
  const tgtcthue = parseFloat(getTagText(doc, 'TgTCThue') || getTagText(doc, 'tgtcthue') || '0') || items.reduce((s, it) => s + it.amount, 0);
  const tgtthue = parseFloat(getTagText(doc, 'TgTThue') || getTagText(doc, 'tgtthue') || '0') || items.reduce((s, it) => s + it.taxAmount, 0);
  const tgtttbso = parseFloat(getTagText(doc, 'TgTTTBSo') || getTagText(doc, 'tgtttbso') || '0') || (tgtcthue + tgtthue);
  let tgtttbchu = getTagText(doc, 'TgTTTBChu') || getTagText(doc, 'tgtttbchu') || '';
  if (!tgtttbchu) {
    tgtttbchu = numberToVietnameseWords(tgtttbso);
  }

  // 6. CQT Code
  let mhdon = getTagText(doc, 'DLieu') || getTagText(doc, 'mhdon') || getTagText(doc, 'MCCQT') || '';
  if (!mhdon) {
    // Check in TTKhac
    const ttinNodes = doc.getElementsByTagName('TTin');
    for (let i = 0; i < ttinNodes.length; i++) {
      const truong = getTagText(ttinNodes[i], 'TTruong');
      if (truong.toLowerCase().includes('macqt') || truong.toLowerCase().includes('mccqt')) {
        mhdon = getTagText(ttinNodes[i], 'DLieu');
        break;
      }
    }
  }
  const hsgcma = !!mhdon || khmshdon.startsWith('1C') || khhdon.startsWith('1C');

  // 7. Signature Info
  const signerName = getTagText(doc, 'X509SubjectName') || nbten;
  const caProvider = getTagText(doc, 'X509IssuerName') || 'VNPT-CA';
  const signedDate = getTagText(doc, 'SigningTime') || nlap;
  const hasDigitalSignature = doc.getElementsByTagName('Signature').length > 0;

  // Determine invoice type: default to purchase
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
    tthdon: 1,
    tthdonLabel: 'Hóa đơn gốc',
    ttxly: hsgcma ? 1 : 2,
    ttxlyLabel: hsgcma ? 'Đã cấp mã CQT' : 'Không mã CQT',
    mhdon: mhdon || (hsgcma ? '00' + Math.random().toString(16).toUpperCase().substring(2, 32) : undefined),
    hsgcma,
    loaiHdon: 'purchase',
    hasDigitalSignature,
    signerName: signerName.includes('CN=') ? signerName.split('CN=')[1].split(',')[0] : signerName,
    signedDate,
    caProvider: caProvider.includes('O=') ? caProvider.split('O=')[1].split(',')[0] : 'VNPT-CA',
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
