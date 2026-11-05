const DB_NAME = 'gdt-invoice-originals';
const STORE_NAME = 'pdfs';
const DB_VERSION = 1;

export function getInvoiceOriginalCacheKey(invoice: {
  nbmst?: string;
  khhdon?: string;
  shdon?: string | number;
  khmshdon?: string | number;
}): string {
  return [String(invoice.nbmst || '').replace(/\D/g, ''),
    String(invoice.khmshdon || ''), String(invoice.khhdon || '').trim().toUpperCase(),
    String(invoice.shdon ?? '').trim().replace(/^0+(?=\d)/, '')].join('|');
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt không hỗ trợ bộ nhớ cục bộ IndexedDB.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error || new Error('Không mở được bộ nhớ hóa đơn cục bộ.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function readCachedOriginalPdf(key: string): Promise<Blob | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onerror = () => { db.close(); reject(request.error); };
    request.onsuccess = () => { db.close(); resolve(request.result instanceof Blob ? request.result : null); };
  });
}

export async function writeCachedOriginalPdf(key: string, blob: Blob): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(blob, key);
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
    transaction.oncomplete = () => { db.close(); resolve(); };
  });
}
