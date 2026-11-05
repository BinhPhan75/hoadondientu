/**
 * Service lưu trữ cục bộ Hóa đơn điện tử gốc trên máy người dùng (Client-Side IndexedDB).
 * 
 * - Key định danh duy nhất cho mỗi HĐ: {MST_Người_Bán}_{Ký_Hiệu_HĐ}_{Số_HĐ}_{Ngày_Lập}
 * - Lưu trữ file PDF gốc nhà cung cấp (Blob / Base64), XML gốc, và bản thể hiện GDT.
 * - Khi người dùng bấm xem hoặc tải về sau này: Tự động lấy trực tiếp từ bộ nhớ máy
 *   mà không cần kết nối lại cổng nhà cung cấp hay giải lại Captcha.
 */

import { GDTInvoice } from '../types';

export interface CachedOriginalInvoice {
  key: string;              // e.g. "0100109106_1C25TGT_0000001_20250115"
  sellerTaxCode: string;   // nbmst
  sellerName?: string;     // nbten
  invoiceSeries: string;   // khhdon
  invoiceNumber: string;   // shdon
  invoiceDate: string;     // tdlap (YYYY-MM-DD)
  provider: string;        // VNPT, VIETTEL, EASYINVOICE, MISA, 4SI, etc.
  driverName?: string;     // Tên driver đã tải
  isFallback: boolean;     // false = HĐ gốc nhà cung cấp, true = Mẫu chuẩn GDT
  captchaSolved?: string;  // Mã Captcha đã giải (nếu có)
  filename?: string;       // Tên file gốc (e.g. "HoaDon_VNPT_0000001.pdf")
  contentType?: string;    // 'application/pdf', 'text/html', etc.
  pdfBase64?: string;      // Chuỗi base64 của file PDF (hoặc HTML)
  pdfBlob?: Blob;          // Blob PDF lưu trong IndexedDB
  xmlContent?: string;     // Nội dung XML hóa đơn
  htmlContent?: string;    // Nội dung HTML thể hiện chuẩn Tổng cục Thuế
  fileSize: number;        // Kích thước tệp (bytes)
  savedAt: number;         // Timestamp lưu cục bộ
  lookupCode?: string;     // Mã tra cứu Fkey/bí mật
  sourceUrl?: string;      // Cổng tra cứu
}

const DB_NAME = 'GDT_INVOICE_LOCAL_STORAGE_V1';
const STORE_NAME = 'original_invoices';
const DB_VERSION = 1;

/**
 * Sinh key định danh duy nhất cho mỗi hóa đơn dựa vào MST, Ký hiệu, Số HĐ và Ngày lập
 */
export function getInvoiceStorageKey(inv: {
  nbmst?: string;
  khhdon?: string;
  shdon?: string | number;
  tdlap?: string;
}): string {
  const mst = (inv.nbmst || '').trim().toUpperCase();
  const series = (inv.khhdon || '').trim().toUpperCase();
  const no = String(inv.shdon || '').trim().padStart(7, '0');
  const rawDate = (inv.tdlap || '').slice(0, 10);
  const dateStr = rawDate.replace(/[^0-9]/g, '');
  return `${mst}_${series}_${no}_${dateStr}`;
}

/**
 * Mở kết nối IndexedDB (hoạt động hoàn toàn trên trình duyệt người dùng)
 */
function openInvoiceDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('Trình duyệt không hỗ trợ IndexedDB'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('sellerTaxCode', 'sellerTaxCode', { unique: false });
        store.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
        store.createIndex('invoiceDate', 'invoiceDate', { unique: false });
        store.createIndex('isFallback', 'isFallback', { unique: false });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Không thể mở cơ sở dữ liệu IndexedDB'));
    };
  });
}

/**
 * Lưu kết quả tìm kiếm / tải hóa đơn gốc vào local máy người dùng
 */
export async function saveCachedInvoice(invoiceData: Partial<CachedOriginalInvoice> & {
  sellerTaxCode: string;
  invoiceSeries: string;
  invoiceNumber: string | number;
  invoiceDate: string;
}): Promise<void> {
  try {
    const key = invoiceData.key || getInvoiceStorageKey({
      nbmst: invoiceData.sellerTaxCode,
      khhdon: invoiceData.invoiceSeries,
      shdon: invoiceData.invoiceNumber,
      tdlap: invoiceData.invoiceDate
    });

    const record: CachedOriginalInvoice = {
      key,
      sellerTaxCode: invoiceData.sellerTaxCode.trim(),
      sellerName: invoiceData.sellerName,
      invoiceSeries: invoiceData.invoiceSeries.trim(),
      invoiceNumber: String(invoiceData.invoiceNumber).trim().padStart(7, '0'),
      invoiceDate: invoiceData.invoiceDate.slice(0, 10),
      provider: invoiceData.provider || 'UNKNOWN',
      driverName: invoiceData.driverName,
      isFallback: invoiceData.isFallback ?? false,
      captchaSolved: invoiceData.captchaSolved,
      filename: invoiceData.filename,
      contentType: invoiceData.contentType || 'application/pdf',
      pdfBase64: invoiceData.pdfBase64,
      pdfBlob: invoiceData.pdfBlob,
      xmlContent: invoiceData.xmlContent,
      htmlContent: invoiceData.htmlContent,
      fileSize: invoiceData.fileSize || (invoiceData.pdfBase64 ? Math.round((invoiceData.pdfBase64.length * 3) / 4) : 0),
      savedAt: invoiceData.savedAt || Date.now(),
      lookupCode: invoiceData.lookupCode,
      sourceUrl: invoiceData.sourceUrl
    };

    const db = await openInvoiceDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[InvoiceStorage] Lỗi khi lưu vào IndexedDB:', err);
  }
}

/**
 * Lấy hóa đơn gốc từ local máy người dùng
 */
export async function getCachedInvoice(
  target: string | { nbmst?: string; khhdon?: string; shdon?: string | number; tdlap?: string }
): Promise<CachedOriginalInvoice | null> {
  try {
    const key = typeof target === 'string' ? target : getInvoiceStorageKey(target);
    const db = await openInvoiceDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Kiểm tra xem hóa đơn đã được tải và lưu trong máy hay chưa
 */
export async function hasCachedInvoice(
  target: string | { nbmst?: string; khhdon?: string; shdon?: string | number; tdlap?: string }
): Promise<boolean> {
  const cached = await getCachedInvoice(target);
  return Boolean(cached && (cached.pdfBase64 || cached.pdfBlob));
}

/**
 * Lấy toàn bộ danh sách key hóa đơn đã lưu để highlight trạng thái trong bảng
 */
export async function getAllCachedInvoiceKeys(): Promise<Set<string>> {
  try {
    const db = await openInvoiceDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const keys = new Set<string>((request.result as string[]) || []);
        resolve(keys);
      };
      request.onerror = () => {
        resolve(new Set());
      };
    });
  } catch {
    return new Set();
  }
}

/**
 * Lấy toàn bộ hóa đơn đã lưu trữ trong máy
 */
export async function getAllCachedInvoices(): Promise<CachedOriginalInvoice[]> {
  try {
    const db = await openInvoiceDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as CachedOriginalInvoice[]) || []);
      };
      request.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Xóa một hóa đơn khỏi bộ nhớ cục bộ
 */
export async function deleteCachedInvoice(key: string): Promise<void> {
  try {
    const db = await openInvoiceDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[InvoiceStorage] Lỗi khi xóa HĐ khỏi IndexedDB:', err);
  }
}

/**
 * Xóa toàn bộ hóa đơn đã lưu trong bộ nhớ máy
 */
export async function clearAllCachedInvoices(): Promise<void> {
  try {
    const db = await openInvoiceDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[InvoiceStorage] Lỗi khi làm trống IndexedDB:', err);
  }
}

/**
 * Thống kê dung lượng và số lượng HĐ gốc đã lưu trong máy
 */
export async function getCachedStorageStats(): Promise<{
  totalCount: number;
  originalCount: number;
  fallbackCount: number;
  totalBytes: number;
}> {
  try {
    const all = await getAllCachedInvoices();
    let originalCount = 0;
    let fallbackCount = 0;
    let totalBytes = 0;

    for (const inv of all) {
      if (inv.isFallback) {
        fallbackCount++;
      } else {
        originalCount++;
      }
      totalBytes += inv.fileSize || 0;
    }

    return {
      totalCount: all.length,
      originalCount,
      fallbackCount,
      totalBytes
    };
  } catch {
    return { totalCount: 0, originalCount: 0, fallbackCount: 0, totalBytes: 0 };
  }
}
