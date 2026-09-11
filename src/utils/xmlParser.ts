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
    if ('getElementsByTagNameNS' in xmlOrElement) {
      try {
        const elNs = xmlOrElement.getElementsByTagNameNS('*', tagName)[0] || 
                     xmlOrElement.getElementsByTagNameNS('*', tagName.toLowerCase())[0];
        if (elNs && elNs.textContent) {
          const cleaned = cleanDetailedItemName(elNs.textContent);
          if (cleaned.length > 0) return cleaned;
        }
      } catch {}
    }

    const el = xmlOrElement.getElementsByTagName(tagName)[0] || 
               xmlOrElement.getElementsByTagName(tagName.toLowerCase())[0] ||
               xmlOrElement.getElementsByTagName(tagName.toUpperCase())[0];
    if (el && el.textContent) {
      const cleaned = cleanDetailedItemName(el.textContent);
      if (cleaned.length > 0) return cleaned;
    }

    // Direct children check
    const children = 'children' in xmlOrElement ? Array.from((xmlOrElement as any).children) : [];
    for (const ch of children as Element[]) {
      const local = (ch.localName || ch.nodeName || '').replace(/^[a-zA-Z0-9_]+:/, '').toLowerCase();
      if (local === tagName.toLowerCase()) {
        const cleaned = cleanDetailedItemName(ch.textContent || '');
        if (cleaned.length > 0) return cleaned;
      }
    }

    return defaultValue;
  }

  // Node.js Regex extraction
  const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, '');
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>`, 'i');
  const match = xmlOrElement.match(regex);
  if (match && match[1]) {
    return cleanDetailedItemName(match[1]);
  }
  return defaultValue;
}

/**
 * Universal multiple tag blocks extractor for lists like <HHDVu>...</HHDVu> or self-closing <Row ... />
 */
function extractTagBlocks(xml: string, tagName: string): string[] {
  const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, '');
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?(?:\\/>|>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>)`, 'gi');
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    if (m[0]) {
      blocks.push(m[0]);
    }
  }
  return blocks;
}

/**
 * Làm sạch và giải mã tên hàng hóa, dịch vụ chi tiết từ XML
 * - Loại bỏ toàn bộ các thẻ bao CDATA: <![CDATA[...]]>
 * - Giải mã ký tự HTML/XML entities (&amp;, &lt;, &gt;, &quot;, &#39;, &#039;, v.v.)
 * - Giữ nguyên tên chi tiết đầy đủ (mã quy cách, thông số, nhãn hiệu), không cắt bớt thành chuỗi tóm tắt
 */
export function cleanDetailedItemName(raw: string): string {
  if (!raw) return '';
  let str = String(raw).trim();

  // Xóa bỏ vỏ bọc CDATA (kể cả lồng nhau hoặc thừa ký tự)
  str = str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
  while (str.startsWith('<![CDATA[') && str.endsWith(']]>')) {
    str = str.substring(9, str.length - 3).trim();
  }

  // Bỏ thẻ HTML thông dụng nếu có trong tên hàng (ví dụ <br/>, <p>)
  str = str.replace(/<br\s*\/?>/gi, ' ');
  str = str.replace(/<\/?[a-zA-Z0-9_-]+(?:\s+[^>]*)?>/g, '');

  // Giải mã các thực thể ký tự XML/HTML đặc biệt
  const entityMap: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    '&nbsp;': ' ', '&#160;': ' ', '&copy;': '©', '&reg;': '®', '&trade;': '™',
    '&agrave;': 'à', '&aacute;': 'á', '&acirc;': 'â', '&atilde;': 'ã',
    '&egrave;': 'è', '&eacute;': 'é', '&ecirc;': 'ê',
    '&igrave;': 'ì', '&iacute;': 'í',
    '&ograve;': 'ò', '&oacute;': 'ó', '&ocirc;': 'ô', '&otilde;': 'õ',
    '&ugrave;': 'ù', '&uacute;': 'ú', '&ucirc;': 'û',
    '&yacute;': 'ý',
    '&Agrave;': 'À', '&Aacute;': 'Á', '&Acirc;': 'Â', '&Atilde;': 'Ã',
    '&Egrave;': 'È', '&Eacute;': 'É', '&Ecirc;': 'Ê',
    '&Igrave;': 'Ì', '&Iacute;': 'Í',
    '&Ograve;': 'Ò', '&Oacute;': 'Ó', '&Ocirc;': 'Ô', '&Otilde;': 'Õ',
    '&Ugrave;': 'Ù', '&Uacute;': 'Ú', '&Ucirc;': 'Û',
    '&Yacute;': 'Ý'
  };

  str = str
    .replace(/&[a-zA-Z]+;/g, m => entityMap[m] || entityMap[m.toLowerCase()] || m)
    .replace(/\u00A0/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return !isNaN(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return !isNaN(code) ? String.fromCharCode(code) : _;
    });

  // Lần 2 đề phòng trường hợp bị encode kép (&amp;quot; -> &quot; -> ")
  if (str.includes('&')) {
    str = str
      .replace(/&[a-zA-Z]+;/g, m => entityMap[m] || entityMap[m.toLowerCase()] || m)
      .replace(/&#39;/g, "'")
      .replace(/&#039;/g, "'");
  }

  return str.replace(/\r?\n|\r/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

/**
 * Chuyển đổi an toàn chuỗi số (số lượng, đơn giá, thành tiền) từ XML sang number.
 * Tương thích linh hoạt với cả quy ước phân cách số thập phân dấu chấm (.) và dấu phẩy (,).
 * Ngăn chặn tuyệt đối lỗi 1.000.000 bị parse nhầm thành 1.
 */
export function parseInvoiceNumber(val: any, defaultVal: number = 0): number {
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  if (!val || typeof val !== 'string') return defaultVal;
  let str = val.trim();
  if (!str) return defaultVal;

  // Bỏ khoảng trắng phân cách hàng nghìn nếu có
  str = str.replace(/\s+/g, '');

  // Kiểm tra số âm dạng -123 hoặc (123)
  const isNegative = str.startsWith('-') || (str.startsWith('(') && str.endsWith(')'));
  str = str.replace(/[()]/g, '').replace(/^-/, '');

  const dotCount = (str.match(/\./g) || []).length;
  const commaCount = (str.match(/,/g) || []).length;

  if (dotCount > 0 && commaCount > 0) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Định dạng VN: 1.000.000,50 -> bỏ dấu chấm, đổi dấu phẩy thành dấu chấm
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Định dạng US: 1,000,000.50 -> bỏ dấu phẩy
      str = str.replace(/,/g, '');
    }
  } else if (dotCount > 1) {
    // Nhiều hơn 1 dấu chấm: chắc chắn là phân cách hàng nghìn (1.000.000)
    str = str.replace(/\./g, '');
  } else if (commaCount > 1) {
    // Nhiều hơn 1 dấu phẩy: phân cách hàng nghìn kiểu US (1,000,000)
    str = str.replace(/,/g, '');
  } else if (commaCount === 1) {
    // 1 dấu phẩy: kiểu VN số thập phân (1,5 hoặc 1000,50)
    str = str.replace(',', '.');
  } else if (dotCount === 1) {
    // 1 dấu chấm: phân biệt số thập phân (1.5, 0.25) và phân cách hàng nghìn (100.000, 250.000)
    const parts = str.split('.');
    if (parts[1] === '000') {
      str = parts[0] + '000';
    }
  }

  // Lọc chỉ giữ chữ số và dấu chấm thập phân
  str = str.replace(/[^0-9.]/g, '');
  const num = parseFloat(str);
  if (isNaN(num)) return defaultVal;
  return isNegative ? -num : num;
}

/**
 * Lấy tên hàng hóa từ payload API của các cổng hóa đơn khác nhau.
 * Một số cổng trả đồng thời `THHDVu` (tên chuẩn) và `TenHH`/`ItemName`
 * (tên chi tiết). Nếu giá trị đầu tiên chỉ là placeholder thì phải tiếp tục
 * tìm ở các khóa còn lại, tránh làm mất tên thật của dòng hàng.
 */
function getPayloadValue(source: any, keys: string[]): any {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
  }
  const lowerKeys = Object.keys(source);
  const normalizedKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const key of keys) {
    const actualKey = lowerKeys.find(candidate => normalizedKey(candidate) === normalizedKey(key));
    if (actualKey && source[actualKey] !== undefined && source[actualKey] !== null && source[actualKey] !== '') {
      return source[actualKey];
    }
  }
  return undefined;
}

function pickItemName(source: any): string {
  const candidates = [
    getPayloadValue(source, ['itemName', 'ItemName']),
    getPayloadValue(source, ['ten', 'Ten']),
    getPayloadValue(source, ['tenhh', 'TenHH']),
    getPayloadValue(source, ['tensp', 'TenSP']),
    getPayloadValue(source, ['tenHHDVu', 'TenHHDVu']),
    getPayloadValue(source, ['thhdvu', 'THHDVu']),
    getPayloadValue(source, ['thhhdvu', 'THHHDVu', 'thhdv', 'THHDV', 'tenhhdv', 'TenHHDV']),
    getPayloadValue(source, ['tenhanghoadichvu', 'TenHangHoaDichVu']),
    getPayloadValue(source, ['tenhanghoa', 'TenHangHoa']),
    getPayloadValue(source, ['tenhang', 'TenHang']),
    getPayloadValue(source, ['tensanpham', 'TenSanPham']),
    getPayloadValue(source, ['tendichvu', 'TenDichVu', 'tendv', 'TenDV']),
    getPayloadValue(source, ['productName', 'ProductName']),
    getPayloadValue(source, ['serviceName', 'ServiceName']),
    getPayloadValue(source, ['goodsName', 'GoodsName']),
    getPayloadValue(source, ['goodsDescription', 'GoodsDescription']),
    getPayloadValue(source, ['itemDescription', 'ItemDescription']),
    getPayloadValue(source, ['diengiai', 'DienGiai', 'diengiaihh', 'DienGiaiHH']),
    getPayloadValue(source, ['noidung', 'NoiDung', 'noidunghh', 'NoiDungHH']),
    getPayloadValue(source, ['description', 'Description']),
    getPayloadValue(source, ['name', 'Name'])
  ];

  const cleaned = candidates
    .filter(value => value !== undefined && value !== null)
    .map(value => cleanDetailedItemName(String(value)))
    .filter(Boolean);

  return cleaned.find(value => !isPlaceholderItemName(value)) || cleaned[0] || '';
}

/**
 * Chuẩn hóa một dòng hàng từ dữ liệu danh sách hóa đơn của Cổng Thuế/API.
 * Dùng chung cho server và API serverless để hai đường lấy dữ liệu không lệch
 * tên hàng hóa.
 */
export function normalizeInvoiceItem(source: any, idx: number = 0): InvoiceItem {
  const lineNo = parseInt(String(getPayloadValue(source, ['lineNo', 'stt', 'STT', 'SoTT', 'Idx', 'LineNo']) ?? idx + 1), 10) || idx + 1;
  const itemName = pickItemName(source) || `Hàng hóa / Dịch vụ ${lineNo}`;
  const unit = cleanDetailedItemName(String(getPayloadValue(source, ['unit', 'dvtinh', 'dvt', 'DVTinh', 'DonViTinh', 'Unit']) ?? 'Cái')) || 'Cái';
  const quantity = parseInvoiceNumber(getPayloadValue(source, ['quantity', 'sluong', 'SLuong', 'SoLuong', 'Qty']), 1);
  const unitPrice = parseInvoiceNumber(getPayloadValue(source, ['unitPrice', 'dgia', 'DGia', 'DonGia', 'Price']), 0);
  const amount = parseInvoiceNumber(getPayloadValue(source, ['amount', 'thtien', 'ThTien', 'ThanhTien', 'Total']), quantity * unitPrice);
  const taxRate = cleanDetailedItemName(String(getPayloadValue(source, ['taxRate', 'tsuat', 'TSuat', 'ThueSuat', 'TaxRate']) ?? '10%')) || '10%';
  const taxRatePercent = /KCT|KKKNT/i.test(taxRate) ? 0 : (parseFloat(taxRate.replace(',', '.').replace(/[^0-9.]/g, '')) || 0);
  const taxAmount = parseInvoiceNumber(getPayloadValue(source, ['taxAmount', 'tthue', 'TThue', 'TienThue', 'TaxAmount']), (amount * taxRatePercent) / 100);
  const totalAmount = amount + taxAmount;

  const itemCode = cleanDetailedItemName(String(getPayloadValue(source, ['itemCode', 'mhhdvu', 'MHHDVu', 'MaHHDVu', 'MaHH', 'ProdCode']) ?? ''));
  const nature = parseInt(String(getPayloadValue(source, ['nature', 'tchat', 'TChat', 'TinhChat']) ?? 1), 10) || 1;

  return {
    id: getPayloadValue(source, ['id', 'ID']) || `item_${lineNo}_${Math.random().toString(36).substring(2, 7)}`,
    lineNo,
    itemName,
    unit,
    quantity,
    unitPrice,
    amount,
    taxRate,
    taxRatePercent,
    taxAmount,
    totalAmount,
    itemCode: itemCode || undefined,
    nature,
    stt: lineNo,
    ten: itemName,
    dvt: unit,
    sluong: quantity,
    dgia: unitPrice,
    thtien: amount,
    tthtien: amount,
    tsuat: taxRate,
    tthue: taxAmount,
    mhhdvu: itemCode || undefined,
    tchat: nature
  };
}

function cleanLookupValue(value: any): string {
  return cleanDetailedItemName(String(value ?? ''))
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

/**
 * Nhiều cổng HĐĐT (ví dụ EasyInvoice/SOFTDREAMS - thấy ở hóa đơn máy tính
 * tiền) không trả các trường như "Mã tra cứu"/"Trang tra cứu" như field
 * phẳng, mà bọc trong một mảng dạng [{ ttruong, kdlieu, dlieu }] (thường ở
 * khóa `ttkhac`, đôi khi `nbttkhac`/`nmttkhac`/`cttkhac`). Hàm này quét các
 * mảng đó và trả về `dlieu` của mục có `ttruong` khớp tên cần tìm.
 * Ví dụ thực tế: { ttruong: "Fkey", dlieu: "evliq2zrtmso" } chính là mã tra
 * cứu thật in trên hóa đơn, trong khi field phẳng `mtdtchieu` lại là một mã
 * nội bộ khác không khớp với mã in trên hóa đơn.
 */
function getFromStructuredArrays(source: any, fieldNames: string[]): string {
  if (!source || typeof source !== 'object') return '';
  const arrayKeys = ['ttkhac', 'TTKhac', 'nbttkhac', 'NBTTKhac', 'nmttkhac', 'NMTTKhac', 'cttkhac', 'CTTKhac'];
  const normalized = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = fieldNames.map(normalized);
  for (const arrKey of arrayKeys) {
    const arr = getPayloadValue(source, [arrKey]);
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      if (!entry || typeof entry !== 'object') continue;
      const label = getPayloadValue(entry, ['ttruong', 'TTruong', 'Ttruong']);
      if (!label) continue;
      if (wanted.includes(normalized(String(label)))) {
        const value = getPayloadValue(entry, ['dlieu', 'DLieu', 'Dlieu']);
        if (value !== undefined && value !== null && String(value).trim()) {
          return String(value).trim();
        }
      }
    }
  }
  return '';
}

function normalizeLookupLabel(value: string): string {
  return cleanLookupValue(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function isLookupCodeCandidate(value: string): boolean {
  if (!value || value.length < 4 || value.length > 120) return false;
  // Lookup codes are machine identifiers. A sentence, whitespace-separated
  // text, or markup from a generic TTin field must never become a code merely
  // because its label happens to mention "tra cứu".
  return !/^https?:\/\//i.test(value)
    && /^[A-Za-z0-9][A-Za-z0-9._-]{3,119}$/.test(value);
}

/** Lấy mã tra cứu từ payload JSON của Cổng Thuế/API. */
export function getLookupCodeFromPayload(source: any): string {
  const values = [
    getPayloadValue(source, ['lookupCode', 'LookupCode']),
    getPayloadValue(source, ['lookup_code']),
    getPayloadValue(source, ['mtcuu', 'MTCuu']),
    getPayloadValue(source, ['maTraCuu', 'MaTraCuu', 'matracuu']),
    // Cấu trúc mảng { ttruong: "Fkey", dlieu: "..." } - đã xác nhận đây là
    // mã tra cứu THẬT in trên hóa đơn (kiểm chứng với hóa đơn máy tính tiền
    // thật), nên ưu tiên trước các field phẳng bên dưới có thể không khớp.
    getFromStructuredArrays(source, ['Fkey', 'FKey', 'MaTraCuu', 'LookupCode']),
    getPayloadValue(source, ['fkey', 'FKey']),
    getPayloadValue(source, ['invoiceLookupCode', 'InvoiceLookupCode']),
    // MISA meInvoice: mã tra cứu THẬT in trên hóa đơn nằm trong mảng cttkhac
    // với ttruong = "TransactionID" (đã kiểm chứng khớp 100% với PDF gốc,
    // ví dụ hóa đơn Tài Trâm Anh C26TTA-273: TransactionID="JXFEULBJM7G7"
    // == "Mã tra cứu hóa đơn" in trên PDF).
    getFromStructuredArrays(source, ['TransactionID']),
    // Field phẳng "mtdtchieu" - chỉ dùng khi không có nguồn nào ở trên,
    // vì đã có trường hợp thực tế field này KHÔNG khớp mã tra cứu in trên
    // hóa đơn (nó có thể là một mã đối chiếu nội bộ khác).
    getPayloadValue(source, ['mtdtchieu', 'MTDTCChieu', 'maDoiChieu', 'MaDoiChieu'])
  ];
  return values.map(cleanLookupValue).find(isLookupCodeCandidate) || '';
}

export function getLookupUrlFromPayload(source: any): string {
  const structured = getFromStructuredArrays(source, ['PortalLink', 'LinkTraCuu', 'WebsiteTraCuu', 'WebTraCuu']);
  const value = cleanLookupValue(structured || String(getPayloadValue(source, [
    'lookupUrl', 'LookupUrl', 'lookup_url', 'linkTraCuu', 'LinkTraCuu',
    'websiteTraCuu', 'WebsiteTraCuu', 'webTraCuu', 'WebTraCuu'
  ]) ?? ''));
  return /^https?:\/\//i.test(value) ? value : '';
}

/** Chọn đúng danh sách dòng hàng dù API trả mảng hay bọc trong object. */
export function getInvoiceItemListFromPayload(source: any): any[] {
  const candidates = [
    getPayloadValue(source, ['hdhhdvus', 'HDHHDVUs']),
    getPayloadValue(source, ['hdhhdvu', 'HDHHDVu']),
    getPayloadValue(source, ['items', 'Items']),
    getPayloadValue(source, ['invoiceItems', 'InvoiceItems']),
    getPayloadValue(source, ['products', 'Products']),
    getPayloadValue(source, ['details', 'Details']),
    getPayloadValue(source, ['hangHoa', 'HangHoa'])
  ];
  const collections: any[][] = [];
  const addCollection = (candidate: any) => {
    if (Array.isArray(candidate) && candidate.length) collections.push(candidate);
    else if (candidate && typeof candidate === 'object') collections.push([candidate]);
  };

  // The detail endpoint has changed wrappers several times (data -> result ->
  // invoice -> hdhhdvus, for example). Walk only fields that semantically mean
  // "line items"; never treat a general data/results array as invoice lines.
  const collectionKeys = [
    'hdhhdvus', 'hdhhdvu', 'hhdvus', 'hhdvu', 'items', 'item',
    'invoiceitems', 'invoiceitem', 'products', 'product', 'details', 'detail',
    'hanghoa', 'hanghoadichvu', 'goods', 'goodsitems', 'rows'
  ];
  const wrapperKeys = ['data', 'result', 'invoice', 'content', 'response', 'payload'];
  const seen = new Set<any>();
  const visit = (node: any, depth: number) => {
    if (!node || typeof node !== 'object' || seen.has(node) || depth > 7) return;
    seen.add(node);
    for (const key of collectionKeys) {
      const collection = getPayloadValue(node, [key]);
      addCollection(collection);
      // Some versions return { hdhhdvus: { hdhhdvu: [...] } }.
      if (collection && typeof collection === 'object' && !Array.isArray(collection)) visit(collection, depth + 1);
    }
    for (const key of wrapperKeys) visit(getPayloadValue(node, [key]), depth + 1);
  };

  candidates.forEach(addCollection);
  visit(source, 0);
  if (!collections.length) return [];

  // Prefer the collection containing actual descriptions. This is important
  // when a response includes both a summary row and the full HHDVu list.
  const score = (items: any[]) => items.reduce((total, item, index) => {
    const name = normalizeInvoiceItem(item, index).itemName;
    return total + (name && !isPlaceholderItemName(name) ? 100 : 0) + 1;
  }, 0);
  return collections.sort((a, b) => score(b) - score(a))[0];
}

export function getSellerFromPayload(source: any): { name: string; taxCode: string; address: string } {
  const name = cleanDetailedItemName(String(getPayloadValue(source, [
    'nbten', 'nbtnnt', 'nbtlhdon', 'sellerName', 'supplierName', 'tenNguoiBan', 'tenNban'
  ]) ?? ''));
  const taxCode = cleanDetailedItemName(String(getPayloadValue(source, [
    'nbmst', 'sellerTaxCode', 'taxCodeNguoiBan', 'mstNguoiBan'
  ]) ?? ''));
  const address = cleanDetailedItemName(String(getPayloadValue(source, [
    'nbdchi', 'sellerAddress', 'supplierAddress', 'diaChiNguoiBan'
  ]) ?? ''));
  return { name, taxCode, address };
}

/**
 * Trích xuất chính xác mã/URL tra cứu từ XML. Chỉ nhận các thẻ có ngữ nghĩa
 * tra cứu hoặc trường TTin tương ứng; không dùng SecretCode, MCCQT hay URL
 * đầu tiên trong tài liệu làm mã tra cứu.
 */
export function extractLookupDetailsFromXml(rawXml?: string): { lookupCode: string; lookupUrl: string } {
  if (!rawXml) return { lookupCode: '', lookupUrl: '' };

  const tagValue = (tagNames: string[]): string => {
    for (const tag of tagNames) {
      const value = extractTagValue(rawXml, tag, '');
      if (value) return cleanLookupValue(value);
    }
    return '';
  };

  const codeTags = ['MTCuu', 'MaTraCuu', 'Matracuu', 'FKey', 'Fkey', 'LookupCode', 'InvoiceLookupCode'];
  let lookupCode = tagValue(codeTags);

  if (!lookupCode) {
    const textMatch = rawXml.match(/(?:Mã\s+tra\s+cứu|Ma\s+tra\s+cuu|Mã\s+nhận\s+hóa\s+đơn|Ma\s+nhan\s+hoa\s+don)\s*[:：=]\s*([A-Za-z0-9._-]+)/i);
    if (textMatch?.[1]) lookupCode = cleanLookupValue(textMatch[1]);
  }

  const ttinBlocks = [...extractTagBlocks(rawXml, 'TTin'), ...extractTagBlocks(rawXml, 'TTKhac')];
  for (const block of ttinBlocks) {
    const label = normalizeLookupLabel(
      extractTagValue(block, 'TTruong') || extractTagValue(block, 'TenTruong') || extractTagValue(block, 'Name')
    );
    if (!label || label.includes('bi mat') || label.includes('secret')) continue;
    const isExplicitLookupLabel = /(?:^|\s)(?:ma\s*)?tra\s*cuu(?:\s|$)|^(?:matracuu|fkey|lookupcode)$/i.test(label);
    // An explicit XML tag has higher authority than an auxiliary field.
    if (!lookupCode && isExplicitLookupLabel) {
      const value = cleanLookupValue(extractTagValue(block, 'DLieu') || extractTagValue(block, 'Data') || extractTagValue(block, 'Value'));
      if (isLookupCodeCandidate(value)) {
        lookupCode = value;
        break;
      }
    }
  }

  if (lookupCode && /^https?:\/\//i.test(lookupCode)) {
    try {
      const url = new URL(lookupCode);
      lookupCode = cleanLookupValue(url.searchParams.get('code') || url.searchParams.get('c') || url.searchParams.get('fkey') || '');
    } catch {
      lookupCode = '';
    }
  }

  const urlTags = ['LinkTraCuu', 'WebsiteTraCuu', 'WebTraCuu', 'PortalUrl', 'Website'];
  let lookupUrl = tagValue(urlTags);
  if (!/^https?:\/\//i.test(lookupUrl)) {
    lookupUrl = '';
  }
  if (!lookupUrl) {
    const urlMatch = rawXml.match(/https?:\/\/[^\s<"']+/gi)?.map(cleanLookupValue)
      .find(value => !/w3\.org|schema\.org/i.test(value) && /tra[-_]?cuu|invoice|einvoice|sinvoice|easyinvoice|4si/i.test(value));
    lookupUrl = urlMatch || '';
  }

  return { lookupCode: isLookupCodeCandidate(lookupCode) ? lookupCode : '', lookupUrl };
}

/**
 * Tìm thẻ XML theo danh sách tên thẻ (hỗ trợ namespace, không phân biệt hoa thường)
 */
function findXmlTagElement(parent: Element | Document, tagNames: string[]): Element | null {
  if (!parent) return null;
  const children = 'children' in parent ? Array.from(parent.children) : [];

  for (const tag of tagNames) {
    const lower = tag.toLowerCase();

    // 1. Kiểm tra trực tiếp các thẻ con trước để đảm bảo cấu trúc phân cấp
    for (const child of children) {
      const local = (child.localName || child.nodeName || '').replace(/^[a-zA-Z0-9_]+:/, '').toLowerCase();
      if (local === lower) {
        return child;
      }
    }

    // 2. Sử dụng getElementsByTagName
    const list = parent.getElementsByTagName(tag);
    if (list && list.length > 0) return list[0];

    const listLower = parent.getElementsByTagName(lower);
    if (listLower && listLower.length > 0) return listLower[0];

    // 3. Sử dụng getElementsByTagNameNS với wildcard namespace
    if ('getElementsByTagNameNS' in parent) {
      try {
        const nsList = parent.getElementsByTagNameNS('*', tag);
        if (nsList && nsList.length > 0) return nsList[0];
      } catch {}
    }
  }
  return null;
}

/**
 * Lấy nội dung chuỗi của thẻ XML từ danh sách tên thẻ ưu tiên
 * Hỗ trợ: thuộc tính XML (attributes), thẻ con trực tiếp, namespaces, và hậu duệ
 */
function getXmlTagText(parent: Element, tagNames: string[]): string {
  if (!parent) return '';

  // 1. Kiểm tra thuộc tính (attributes) của thẻ parent trước
  if (parent.attributes && parent.attributes.length > 0) {
    for (const tag of tagNames) {
      const lower = tag.toLowerCase();
      for (let i = 0; i < parent.attributes.length; i++) {
        const attr = parent.attributes[i];
        const aName = attr.name.toLowerCase().replace(/^[a-z0-9_]+:/, '');
        if (aName === lower) {
          const cleaned = cleanDetailedItemName(attr.value || '');
          if (cleaned.length > 0) return cleaned;
        }
      }
    }
  }

  const children = Array.from(parent.children);

  for (const tag of tagNames) {
    const lower = tag.toLowerCase();

    // 2. Kiểm tra con trực tiếp trước (nhanh nhất và chuẩn nhất)
    for (const child of children) {
      const local = (child.localName || child.nodeName || '').replace(/^[a-zA-Z0-9_]+:/, '').toLowerCase();
      if (local === lower) {
        const txt = child.textContent || '';
        const cleaned = cleanDetailedItemName(txt);
        if (cleaned.length > 0) return cleaned;
      }
    }

    // 3. Sử dụng getElementsByTagNameNS với wildcard namespace
    if ('getElementsByTagNameNS' in parent) {
      try {
        const nsList = parent.getElementsByTagNameNS('*', tag);
        if (nsList && nsList.length > 0 && nsList[0].textContent) {
          const cleaned = cleanDetailedItemName(nsList[0].textContent);
          if (cleaned.length > 0) return cleaned;
        }
        const nsListLower = parent.getElementsByTagNameNS('*', lower);
        if (nsListLower && nsListLower.length > 0 && nsListLower[0].textContent) {
          const cleaned = cleanDetailedItemName(nsListLower[0].textContent);
          if (cleaned.length > 0) return cleaned;
        }
      } catch {}
    }

    // 4. Sử dụng getElementsByTagName
    const el = parent.getElementsByTagName(tag)[0] || parent.getElementsByTagName(lower)[0];
    if (el && el.textContent) {
      const cleaned = cleanDetailedItemName(el.textContent);
      if (cleaned.length > 0) return cleaned;
    }
  }

  // 5. Nếu vẫn không thấy, duyệt tất cả con cháu và so sánh localName
  if (parent.querySelectorAll) {
    try {
      const allDescendants = Array.from(parent.querySelectorAll('*'));
      for (const desc of allDescendants) {
        const dLocal = (desc.localName || desc.nodeName || '').replace(/^[a-zA-Z0-9_]+:/, '').toLowerCase();
        for (const tag of tagNames) {
          if (dLocal === tag.toLowerCase()) {
            const cleaned = cleanDetailedItemName(desc.textContent || '');
            if (cleaned.length > 0) return cleaned;
          }
        }
      }
    } catch {}
  }

  return '';
}

/**
 * Trích xuất khối XML theo tên thẻ bằng biểu thức chính quy (Regex)
 */
function extractTaggedBlock(source: string, tagName: string): string | null {
  if (!source) return null;
  const clean = tagName.replace(/[^a-zA-Z0-9_]/g, '');
  const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${clean}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${clean}>`, 'i');
  const match = source.match(regex);
  return match ? match[1] : null;
}

/**
 * Lấy giá trị chuỗi của một thẻ từ khối XML qua mảng các tên thẻ ưu tiên
 * Hỗ trợ cả thẻ con <Tag>value</Tag> và thuộc tính Tag="value"
 */
function extractTagValueByKeys(block: string, tagNames: string[], defaultValue: string = ''): string {
  for (const tag of tagNames) {
    const val = extractTagValue(block, tag, '');
    if (val) {
      return cleanDetailedItemName(val);
    }
    // Tìm thuộc tính dạng tag="value" hoặc tag='value'
    const clean = tag.replace(/[^a-zA-Z0-9_]/g, '');
    const attrRegex = new RegExp(`(?:^|\\s)(?:[a-zA-Z0-9_]+:)?${clean}\\s*=\\s*["']([^"']*)["']`, 'i');
    const attrMatch = block.match(attrRegex);
    if (attrMatch && attrMatch[1]) {
      const cleaned = cleanDetailedItemName(attrMatch[1]);
      if (cleaned.length > 0) return cleaned;
    }
  }
  return defaultValue;
}

const COMMON_ITEM_NAME_TAGS = [
  'THHDVu', 'thhdvu', 'TenHHDVu', 'tenhhdvu', 'TenHH', 'tenhh', 'Ten', 'ten',
  'ProdName', 'prodname', 'ItemName', 'itemname', 'TenHang', 'tenhang',
  'TenHangHoa', 'tenhanghoa', 'TenSP', 'tensp', 'TSPH', 'tsph',
  'TenDichVu', 'tendichvu', 'TenDV', 'tendv', 'ProductName', 'productname',
  'ServiceName', 'servicename', 'GoodsName', 'goodsname', 'GoodsDescription',
  'goodsdescription', 'ItemDescription', 'itemdescription',
  'DienGiai', 'diengiai', 'DienGiaiHH', 'diengiaihh', 'NoiDung', 'noidung',
  'Description', 'description', 'Name', 'name'
];

/**
 * Trích xuất toàn bộ các trường của một thẻ <HHDVu> từ DOM Element
 */
function parseHHDVuFromElement(el: Element, idx: number): InvoiceItem {
  // <STT>: Số thứ tự
  const rawStt = getXmlTagText(el, ['STT', 'stt', 'SoTT', 'sott', 'Idx', 'idx', 'Order', 'order', 'LineNo', 'lineno']);
  const lineNo = parseInt(rawStt, 10) || (idx + 1);

  // <THHDVu>: Tên hàng hóa, dịch vụ
  let itemName = '';
  for (const tag of COMMON_ITEM_NAME_TAGS) {
    const val = getXmlTagText(el, [tag]);
    if (val && !isPlaceholderItemName(val)) {
      itemName = val;
      break;
    }
  }
  if (!itemName) {
    for (const tag of COMMON_ITEM_NAME_TAGS) {
      const val = getXmlTagText(el, [tag]);
      if (val) {
        itemName = val;
        break;
      }
    }
  }
  const itemCode = getXmlTagText(el, ['MHHDVu', 'mhhdvu', 'MaHHDVu', 'mahhdvu', 'MaHH', 'mahh', 'Ma', 'ma', 'ProdCode', 'prodcode', 'ItemCode', 'itemcode']);
  if (!itemName) {
    itemName = itemCode ? `Hàng hóa (${itemCode})` : `Hàng hóa / Dịch vụ ${lineNo}`;
  }

  // <DVTinh>: Đơn vị tính
  const rawUnit = getXmlTagText(el, ['DVTinh', 'dvtinh', 'DVT', 'dvt', 'DonViTinh', 'donvitinh', 'ProdUnit', 'produnit', 'Unit', 'unit']);
  const unit = rawUnit || 'Cái';

  // <SLuong>: Số lượng
  const rawQty = getXmlTagText(el, ['SLuong', 'sluong', 'SoLuong', 'soluong', 'ProdQuantity', 'prodquantity', 'Quantity', 'quantity', 'Weight', 'TotalWeight', 'Qty', 'qty']);
  const quantity = parseInvoiceNumber(rawQty, 1);

  // <DGia>: Đơn giá
  const rawPrice = getXmlTagText(el, ['DGia', 'dgia', 'DonGia', 'dongia', 'ProdPrice', 'prodprice', 'Price', 'price', 'UnitPrice', 'unitprice']);
  let unitPrice = parseInvoiceNumber(rawPrice, 0);

  // <TTHTien> / <ThTien>: Thành tiền
  const rawAmount = getXmlTagText(el, ['TTHTien', 'tthtien', 'ThTien', 'thtien', 'THTien', 'ThanhTien', 'thanhtien', 'Amount', 'amount', 'Total', 'total']);
  let amount = parseInvoiceNumber(rawAmount, 0);
  if (amount === 0 && quantity > 0 && unitPrice > 0) {
    amount = Math.round(quantity * unitPrice);
  }

  // Tự động kiểm tra tỷ lệ đơn giá / thành tiền nếu bị phân cách nghìn/thập phân
  if (amount > 0 && quantity > 0 && unitPrice > 0) {
    if (Math.round(amount / (quantity * unitPrice)) === 1000) {
      unitPrice = unitPrice * 1000;
    }
  } else if (unitPrice === 0 && quantity > 0 && amount > 0) {
    unitPrice = Math.round((amount / quantity) * 100) / 100;
  }

  // <TSuat>: Thuế suất GTGT
  const rawRate = getXmlTagText(el, ['TSuat', 'tsuat', 'ThueSuat', 'thuesuat', 'VATRate', 'vatrate', 'TaxRate', 'taxrate']);
  const taxRate = rawRate || '10%';
  let taxPercent = 10;
  const upperRate = taxRate.toUpperCase();
  if (upperRate.includes('8')) taxPercent = 8;
  else if (upperRate.includes('5')) taxPercent = 5;
  else if (upperRate.includes('0')) taxPercent = 0;
  else if (upperRate.includes('KCT') || upperRate.includes('KKKNT')) taxPercent = 0;
  else {
    const match = taxRate.match(/(\d+)/);
    if (match) taxPercent = parseInvoiceNumber(match[1], 10);
  }

  // Các trường bổ trợ theo chuẩn NĐ 123
  const rawNature = getXmlTagText(el, ['TChat', 'tchat', 'TinhChat', 'Nature', 'nature']);
  const nature = parseInt(rawNature, 10) || 1;

  const rawTax = getXmlTagText(el, ['TThue', 'tthue', 'TienThue', 'tienthue', 'VATAmount', 'vatamount', 'TaxAmount', 'taxamount']);
  let taxAmount = parseInvoiceNumber(rawTax, 0);
  if (taxAmount === 0 && taxPercent > 0 && amount > 0) {
    taxAmount = Math.round((amount * taxPercent) / 100);
  }

  const discountAmount = parseInvoiceNumber(getXmlTagText(el, ['STCKhau', 'stckhau', 'DiscountAmount']), 0);
  const discountRate = parseInvoiceNumber(getXmlTagText(el, ['TLCKhau', 'tlckhau', 'DiscountRate']), 0);
  const totalAmount = amount + taxAmount;

  return {
    id: `item_${lineNo}_${Math.random().toString(36).substring(2, 7)}`,
    lineNo,
    itemName,
    unit,
    quantity,
    unitPrice,
    amount,
    taxRate,
    taxRatePercent: taxPercent,
    taxAmount,
    totalAmount,
    itemCode: itemCode || undefined,
    nature,
    discountAmount: discountAmount || undefined,
    discountRate: discountRate || undefined,
    // Thuộc tính tương thích tiếng Việt
    stt: lineNo,
    ten: itemName,
    dvt: unit,
    sluong: quantity,
    dgia: unitPrice,
    thtien: amount,
    tthtien: amount,
    tsuat: taxRate,
    tthue: taxAmount,
    mhhdvu: itemCode || undefined,
    tchat: nature,
    stckhau: discountAmount || undefined,
    tlckhau: discountRate || undefined
  };
}

/**
 * Trích xuất toàn bộ các trường của một thẻ <HHDVu> từ Regex String Block
 */
function parseHHDVuFromBlock(block: string, idx: number): InvoiceItem {
  // <STT>: Số thứ tự
  const rawStt = extractTagValueByKeys(block, ['STT', 'stt', 'SoTT', 'sott', 'Idx', 'idx', 'Order', 'order', 'LineNo', 'lineno']);
  const lineNo = parseInt(rawStt, 10) || (idx + 1);

  // <THHDVu>: Tên hàng hóa, dịch vụ
  let itemName = '';
  for (const tag of COMMON_ITEM_NAME_TAGS) {
    const val = extractTagValueByKeys(block, [tag]);
    if (val && !isPlaceholderItemName(val)) {
      itemName = val;
      break;
    }
  }
  if (!itemName) {
    for (const tag of COMMON_ITEM_NAME_TAGS) {
      const val = extractTagValueByKeys(block, [tag]);
      if (val) {
        itemName = val;
        break;
      }
    }
  }
  const itemCode = extractTagValueByKeys(block, ['MHHDVu', 'mhhdvu', 'MaHHDVu', 'mahhdvu', 'MaHH', 'mahh', 'Ma', 'ma', 'ProdCode', 'prodcode', 'ItemCode', 'itemcode']);
  if (!itemName) {
    itemName = itemCode ? `Hàng hóa (${itemCode})` : `Hàng hóa / Dịch vụ ${lineNo}`;
  }

  // <DVTinh>: Đơn vị tính
  const rawUnit = extractTagValueByKeys(block, ['DVTinh', 'dvtinh', 'DVT', 'dvt', 'DonViTinh', 'donvitinh', 'ProdUnit', 'produnit', 'Unit', 'unit']);
  const unit = rawUnit || 'Cái';

  // <SLuong>: Số lượng
  const rawQty = extractTagValueByKeys(block, ['SLuong', 'sluong', 'SoLuong', 'soluong', 'ProdQuantity', 'prodquantity', 'Quantity', 'quantity', 'Weight', 'TotalWeight', 'Qty', 'qty']);
  const quantity = parseInvoiceNumber(rawQty, 1);

  // <DGia>: Đơn giá
  const rawPrice = extractTagValueByKeys(block, ['DGia', 'dgia', 'DonGia', 'dongia', 'ProdPrice', 'prodprice', 'Price', 'price', 'UnitPrice', 'unitprice']);
  let unitPrice = parseInvoiceNumber(rawPrice, 0);

  // <TTHTien> / <ThTien>: Thành tiền
  const rawAmount = extractTagValueByKeys(block, ['TTHTien', 'tthtien', 'ThTien', 'thtien', 'THTien', 'ThanhTien', 'thanhtien', 'Amount', 'amount', 'Total', 'total']);
  let amount = parseInvoiceNumber(rawAmount, 0);
  if (amount === 0 && quantity > 0 && unitPrice > 0) {
    amount = Math.round(quantity * unitPrice);
  }

  // Tự động kiểm tra tỷ lệ đơn giá / thành tiền nếu bị phân cách nghìn/thập phân
  if (amount > 0 && quantity > 0 && unitPrice > 0) {
    if (Math.round(amount / (quantity * unitPrice)) === 1000) {
      unitPrice = unitPrice * 1000;
    }
  } else if (unitPrice === 0 && quantity > 0 && amount > 0) {
    unitPrice = Math.round((amount / quantity) * 100) / 100;
  }

  // <TSuat>: Thuế suất GTGT
  const rawRate = extractTagValueByKeys(block, ['TSuat', 'tsuat', 'ThueSuat', 'thuesuat', 'VATRate', 'vatrate', 'TaxRate', 'taxrate']);
  const taxRate = rawRate || '10%';
  let taxPercent = 10;
  const upperRate = taxRate.toUpperCase();
  if (upperRate.includes('8')) taxPercent = 8;
  else if (upperRate.includes('5')) taxPercent = 5;
  else if (upperRate.includes('0')) taxPercent = 0;
  else if (upperRate.includes('KCT') || upperRate.includes('KKKNT')) taxPercent = 0;
  else {
    const match = taxRate.match(/(\d+)/);
    if (match) taxPercent = parseInvoiceNumber(match[1], 10);
  }

  // Các trường bổ trợ theo chuẩn NĐ 123
  const rawNature = extractTagValueByKeys(block, ['TChat', 'tchat', 'TinhChat', 'Nature', 'nature']);
  const nature = parseInt(rawNature, 10) || 1;

  const rawTax = extractTagValueByKeys(block, ['TThue', 'tthue', 'TienThue', 'tienthue', 'VATAmount', 'vatamount', 'TaxAmount', 'taxamount']);
  let taxAmount = parseInvoiceNumber(rawTax, 0);
  if (taxAmount === 0 && taxPercent > 0 && amount > 0) {
    taxAmount = Math.round((amount * taxPercent) / 100);
  }

  const discountAmount = parseInvoiceNumber(extractTagValueByKeys(block, ['STCKhau', 'stckhau', 'DiscountAmount']), 0);
  const discountRate = parseInvoiceNumber(extractTagValueByKeys(block, ['TLCKhau', 'tlckhau', 'DiscountRate']), 0);
  const totalAmount = amount + taxAmount;

  return {
    id: `item_${lineNo}_${Math.random().toString(36).substring(2, 7)}`,
    lineNo,
    itemName,
    unit,
    quantity,
    unitPrice,
    amount,
    taxRate,
    taxRatePercent: taxPercent,
    taxAmount,
    totalAmount,
    itemCode: itemCode || undefined,
    nature,
    discountAmount: discountAmount || undefined,
    discountRate: discountRate || undefined,
    // Thuộc tính tương thích tiếng Việt
    stt: lineNo,
    ten: itemName,
    dvt: unit,
    sluong: quantity,
    dgia: unitPrice,
    thtien: amount,
    tthtien: amount,
    tsuat: taxRate,
    tthue: taxAmount,
    mhhdvu: itemCode || undefined,
    tchat: nature,
    stckhau: discountAmount || undefined,
    tlckhau: discountRate || undefined
  };
}

/**
 * HÀM BÓC TÁCH DỮ LIỆU DANH SÁCH HÀNG HÓA TỪ FILE XML GỐC
 * (Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC)
 *
 * Hỗ trợ bóc tách linh hoạt:
 * - Chuẩn TCT NĐ123: <DLHDon> -> <NDHDon> -> <DSHHDVu> -> <HHDVu>
 * - Chuẩn các nhà cung cấp (VNPT, Viettel, MISA, Softdreams, EasyInvoice, BKAV):
 *   <Products> -> <Product>, <Items> -> <Item>, <DSHangHoa> -> <HangHoa>, <Details> -> <Detail>
 */
export function extractInvoiceItemsFromXml(xmlSource: string | Document): InvoiceItem[] {
  if (!xmlSource) return [];

  const isBrowser = typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined';
  let domDoc: Document | null = null;
  let rawXmlString = '';

  if (typeof xmlSource === 'string') {
    rawXmlString = xmlSource;
    if (isBrowser) {
      try {
        const parser = new DOMParser();
        const parsed = parser.parseFromString(xmlSource, 'application/xml');
        if (!parsed.getElementsByTagName('parsererror')[0]) {
          domDoc = parsed;
        }
      } catch {
        domDoc = null;
      }
    }
  } else {
    domDoc = xmlSource;
  }

  // =========================================================================
  // PHƯƠNG THỨC 1: DOM TREE NAVIGATION
  // =========================================================================
  if (domDoc) {
    try {
      const containerTagCandidates = [
        'DSHHDVu', 'dshhdvu',
        'Products', 'products',
        'Items', 'items',
        'DSHangHoa', 'dshanghoa',
        'Details', 'details',
        'ListProduct', 'listproduct',
        'InvoiceDetails', 'invoicedetails',
        'InvoiceItems', 'invoiceitems',
        'GoodsDetails', 'goodsdetails',
        'DSHHDV', 'dshhdv',
        'ChiTiet', 'chitiet',
        'CTietHHDVu', 'ctiethhdvu',
        'InvDetails', 'invdetails',
        'Rows', 'rows'
      ];

      const itemTagCandidates = [
        'hhdvu', 'product', 'item', 'hanghoa', 'detail', 'row',
        'invoicedetail', 'invoiceitem', 'productdetail', 'goods',
        'goodsitem', 'chitiethanghoa', 'ctiet', 'line', 'invdetail'
      ];

      // 1. Thẻ <DLHDon> (Dữ liệu hóa đơn)
      const dlhdonNode = findXmlTagElement(domDoc, ['DLHDon', 'dlhdon']) || domDoc.documentElement;
      const ndhdonNode = dlhdonNode ? findXmlTagElement(dlhdonNode, ['NDHDon', 'ndhdon']) : null;
      const parentOfDshhdvu = ndhdonNode || dlhdonNode || domDoc;

      const dshhdvuNode = findXmlTagElement(parentOfDshhdvu, containerTagCandidates);

      if (dshhdvuNode) {
        let hhdvuList: Element[] = [];
        const dshChildren = Array.from(dshhdvuNode.children);
        for (const ch of dshChildren) {
          const local = (ch.localName || ch.nodeName || '').replace(/^[a-zA-Z0-9_]+:/, '').toLowerCase();
          if (itemTagCandidates.includes(local)) {
            hhdvuList.push(ch);
          }
        }

        if (hhdvuList.length === 0) {
          for (const cand of ['HHDVu', 'Product', 'Item', 'HangHoa', 'Detail', 'Row', 'InvoiceDetail', 'InvoiceItem', 'ProductDetail', 'GoodsItem', 'Line', 'InvDetail']) {
            const tagged = dshhdvuNode.getElementsByTagName(cand);
            if (tagged && tagged.length > 0) {
              hhdvuList = Array.from(tagged);
              break;
            }
          }
        }

        // Nếu thẻ chứa danh sách có các thẻ con trực tiếp (bất kể tên thẻ), coi tất cả là các dòng hàng
        if (hhdvuList.length === 0 && dshChildren.length > 0) {
          hhdvuList = dshChildren.filter(ch => ch.children.length > 0 || (ch.attributes && ch.attributes.length > 0));
        }

        if (hhdvuList.length > 0) {
          return hhdvuList.map((el, idx) => parseHHDVuFromElement(el, idx));
        }
      }

      // Fallback quét toàn bộ DOM doc cho các thẻ item
      for (const cand of ['HHDVu', 'Product', 'Item', 'HangHoa', 'Detail', 'InvoiceDetail', 'InvoiceItem', 'ProductDetail', 'GoodsItem', 'Line', 'InvDetail']) {
        const allItems = domDoc.getElementsByTagName(cand);
        if (allItems && allItems.length > 0) {
          return Array.from(allItems).map((el, idx) => parseHHDVuFromElement(el, idx));
        }
      }
    } catch (err) {
      console.warn('Lỗi khi phân tích DOM DSHHDVu, tiếp tục với bộ phân tích Regex:', err);
    }
  }

  // =========================================================================
  // PHƯƠNG THỨC 2: REGEX HIERARCHY PARSER (Dành cho Node.js hoặc fallback)
  // =========================================================================
  const xmlText = rawXmlString || (domDoc ? new XMLSerializer().serializeToString(domDoc) : '');
  if (!xmlText) return [];

  const containerRegexes = ['DSHHDVu', 'Products', 'Items', 'DSHangHoa', 'Details', 'InvoiceDetails', 'InvoiceItems', 'GoodsDetails', 'DSHHDV', 'ChiTiet', 'CTietHHDVu', 'InvDetails', 'Rows'];
  const itemTagNames = ['HHDVu', 'Product', 'Item', 'HangHoa', 'Detail', 'Row', 'InvoiceDetail', 'InvoiceItem', 'ProductDetail', 'GoodsItem', 'Line', 'InvDetail'];

  // Thử tìm trong từng container
  for (const cTag of containerRegexes) {
    const cBlock = extractTaggedBlock(xmlText, cTag);
    if (cBlock) {
      for (const iTag of itemTagNames) {
        const blocks = extractTagBlocks(cBlock, iTag);
        if (blocks.length > 0) {
          return blocks.map((block, idx) => parseHHDVuFromBlock(block, idx));
        }
      }
      // Quét các thẻ con trực tiếp bên trong container nếu tên thẻ không chuẩn
      const genericChildMatches = [...cBlock.matchAll(/<([a-zA-Z0-9_]+)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi)];
      if (genericChildMatches.length > 0) {
        const childBlocks = genericChildMatches
          .map(m => m[0])
          .filter(b => /(?:THHDVu|Ten|ProdName|ItemName|SLuong|DGia|ThTien|TTHTien)/i.test(b));
        if (childBlocks.length > 0) {
          return childBlocks.map((block, idx) => parseHHDVuFromBlock(block, idx));
        }
      }
    }
  }

  // Fallback toàn văn bản
  for (const iTag of itemTagNames) {
    const blocks = extractTagBlocks(xmlText, iTag);
    if (blocks.length > 0) {
      return blocks.map((block, idx) => parseHHDVuFromBlock(block, idx));
    }
  }

  return [];
}

/**
 * Kiểm tra xem một tên hàng hóa có phải là placeholder/chuỗi rỗng hay không
 */
export function isPlaceholderItemName(name?: string): boolean {
  if (!name) return true;
  const s = String(name).toLowerCase().trim();
  if (s.length === 0) return true;
  return (
    s === 'chưa có thông tin hàng hóa' ||
    s === 'không có dữ liệu' ||
    s === 'n/a' ||
    s === 'null' ||
    s === 'undefined' ||
    s === 'hàng hóa, dịch vụ theo hóa đơn' ||
    s === 'hàng hóa dịch vụ theo hóa đơn' ||
    s === 'hàng hóa / dịch vụ' ||
    s === 'hàng hóa/dịch vụ' ||
    s === 'hàng hóa' ||
    s === 'dịch vụ' ||
    s === 'hàng hóa dịch vụ' ||
    s === 'hàng hóa, dịch vụ'
  );
}

/**
 * Kiểm tra xem danh sách items có ít nhất một dòng hàng hóa thực tế hay không
 */
export function hasGenuineItems(items?: InvoiceItem[]): boolean {
  if (!items || !Array.isArray(items) || items.length === 0) return false;
  return items.some(it => {
    const n = (it.itemName || it.ten || '').trim();
    return n.length > 0 && !isPlaceholderItemName(n);
  });
}

/**
 * Đảm bảo các dòng hàng hóa được trích xuất từ dữ liệu hóa đơn gốc
 */
export function ensureInvoiceItems(invoice: GDTInvoice): InvoiceItem[] {
  if (!invoice) return [];

  // 1. Giữ nguyên danh sách đã có tên hợp lệ
  if (invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
    if (hasGenuineItems(invoice.items)) return invoice.items;
  }

  // 2. Thử bóc tách từ rawXml nếu có
  if (invoice.rawXml) {
    try {
      const parsed = extractInvoiceItemsFromXml(invoice.rawXml);
      if (parsed && parsed.length > 0) {
        invoice.items = parsed;
        return parsed;
      }
    } catch (err) {
      console.warn('Lỗi khi bóc tách items từ rawXml trong ensureInvoiceItems:', err);
    }
  }

  return invoice.items || [];
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
  const tygia = parseInvoiceNumber(getTag(domDoc || xmlSource, 'TGia') || getTag(domDoc || xmlSource, 'tygia') || '1', 1);
  const htttoan = getTag(domDoc || xmlSource, 'HTTToan') || getTag(domDoc || xmlSource, 'htttoan') || 'TM/CK';

  // 2. NBan (Seller Info)
  let nbanSource: any = domDoc
    ? (findXmlTagElement(domDoc, ['NBan', 'Seller', 'Supplier', 'NguoiBan']) || domDoc)
    : xmlSource;
  if (typeof nbanSource === 'string') {
    const nbanBlock = ['NBan', 'Seller', 'Supplier', 'NguoiBan']
      .map(tag => extractTagBlocks(xmlSource, tag)[0])
      .find(Boolean);
    if (nbanBlock) nbanSource = nbanBlock;
  }
  const nbten = getTag(nbanSource, 'Ten') || getTag(nbanSource, 'TenNBan') || getTag(nbanSource, 'TenNguoiBan') || getTag(domDoc || xmlSource, 'nbten') || '';
  const nbmst = getTag(nbanSource, 'MST') || getTag(nbanSource, 'MSTNBan') || getTag(nbanSource, 'MSTNguoiBan') || getTag(domDoc || xmlSource, 'nbmst') || '';
  const nbdchi = getTag(nbanSource, 'DChi') || getTag(nbanSource, 'DiaChi') || getTag(domDoc || xmlSource, 'nbdchi') || '';
  const nbsdt = getTag(nbanSource, 'SDThoai') || getTag(nbanSource, 'SDT') || getTag(nbanSource, 'sdt') || '';
  const nbemail = getTag(nbanSource, 'DCTDTu') || getTag(nbanSource, 'Email') || getTag(nbanSource, 'email') || '';
  const nbstk = getTag(nbanSource, 'STKNHang') || getTag(nbanSource, 'STK') || getTag(nbanSource, 'stk') || '';
  const nbnhang = getTag(nbanSource, 'TNHang') || getTag(nbanSource, 'TenNH') || getTag(nbanSource, 'nhang') || '';

  // 3. NMua (Buyer Info)
  let nmuaSource: any = domDoc
    ? (findXmlTagElement(domDoc, ['NMua', 'Buyer', 'Customer', 'NguoiMua']) || domDoc)
    : xmlSource;
  if (typeof nmuaSource === 'string') {
    const nmuaBlock = ['NMua', 'Buyer', 'Customer', 'NguoiMua']
      .map(tag => extractTagBlocks(xmlSource, tag)[0])
      .find(Boolean);
    if (nmuaBlock) nmuaSource = nmuaBlock;
  }
  const nmten = getTag(nmuaSource, 'Ten') || getTag(nmuaSource, 'TenNMua') || getTag(nmuaSource, 'TenNguoiMua') || getTag(domDoc || xmlSource, 'nmten') || 'NGƯỜI MUA HÀNG';
  const nmmst = getTag(nmuaSource, 'MST') || getTag(nmuaSource, 'MSTNMua') || getTag(domDoc || xmlSource, 'nmmst') || '';
  const nmdchi = getTag(nmuaSource, 'DChi') || getTag(nmuaSource, 'DiaChi') || getTag(domDoc || xmlSource, 'nmdchi') || '';
  const nmsdt = getTag(nmuaSource, 'SDThoai') || getTag(nmuaSource, 'SDT') || '';
  const nmemail = getTag(nmuaSource, 'DCTDTu') || getTag(nmuaSource, 'Email') || '';

  // 4. DSHHDVu (Invoice Items List) - Bóc tách chuẩn Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC
  // Đường dẫn: <DLHDon> -> <NDHDon> -> <DSHHDVu> -> <HHDVu>
  let items: InvoiceItem[] = extractInvoiceItemsFromXml(domDoc || xmlSource);
  if (items.length === 0 && typeof xmlSource === 'string') {
    // Fallback thử bóc tách trực tiếp chuỗi XML nếu DOM ban đầu không đủ context
    items = extractInvoiceItemsFromXml(xmlSource);
  }

  // 5. TToan (Totals and Tax Summary)
  const tgtcthue = parseInvoiceNumber(getTag(domDoc || xmlSource, 'TgTCThue'), items.reduce((s, it) => s + (it.amount || 0), 0));
  const tgtthue = parseInvoiceNumber(getTag(domDoc || xmlSource, 'TgTThue'), items.reduce((s, it) => s + (it.taxAmount || 0), 0));
  const tgtttbso = parseInvoiceNumber(getTag(domDoc || xmlSource, 'TgTTTBSo'), (tgtcthue + tgtthue));
  let tgtttbchu = getTag(domDoc || xmlSource, 'TgTTTBChu') || '';
  if (!tgtttbchu) {
    tgtttbchu = numberToVietnameseWords(tgtttbso);
  }

  // Tax Breakdown (THTTLTSuat)
  const vatBreakdown: Array<{ taxRate: string; amount: number; taxAmount: number; tsuat?: string; thtien?: number; tthue?: number }> = [];
  const ltSuatBlocks = extractTagBlocks(xmlSource, 'LTSuat');
  if (ltSuatBlocks.length > 0) {
    for (const b of ltSuatBlocks) {
      const r = extractTagValue(b, 'TSuat') || '10%';
      const a = parseInvoiceNumber(extractTagValue(b, 'TTHTien') || extractTagValue(b, 'ThTien'), 0);
      const t = parseInvoiceNumber(extractTagValue(b, 'TThue'), 0);
      vatBreakdown.push({
        taxRate: r,
        amount: a,
        taxAmount: t,
        tsuat: r,
        thtien: a,
        tthue: t
      });
    }
  } else if (items.length > 0) {
    const mapRates = new Map<string, { amount: number; taxAmount: number }>();
    items.forEach(it => {
      const r = it.taxRate || '10%';
      const curr = mapRates.get(r) || { amount: 0, taxAmount: 0 };
      curr.amount += (it.amount || 0);
      curr.taxAmount += (it.taxAmount || 0);
      mapRates.set(r, curr);
    });
    mapRates.forEach((val, key) => {
      vatBreakdown.push({
        taxRate: key,
        amount: val.amount,
        taxAmount: val.taxAmount,
        tsuat: key,
        thtien: val.amount,
        tthue: val.taxAmount
      });
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

  const { lookupCode, lookupUrl } = extractLookupDetailsFromXml(xmlSource);

  const id = `XML_${khhdon}_${shdon}_${nbmst}_${Date.now()}`;

  const draftInvoice: GDTInvoice = {
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
    mhdon: mhdon || undefined,
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
    items: [],
    rawXml: xmlString
  };

  const finalItems = items.length > 0
    ? items
    : ensureInvoiceItems(draftInvoice);

  draftInvoice.items = finalItems;
  return draftInvoice;
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
