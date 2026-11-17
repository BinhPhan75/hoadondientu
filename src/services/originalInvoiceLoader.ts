import type { GDTInvoice } from '../types';
import { getInvoiceOriginalCacheKey, readCachedOriginalPdf, writeCachedOriginalPdf } from '../utils/invoiceOriginalCache';
import { resolveInvoiceProvider } from '../utils/providerRouting';
import { extractLookupDetailsFromXml } from '../utils/xmlParser';
import { lookupPortalForSeller, normalizeThaiSonPortalUrl } from '../utils/providerIdentity';

const pending = new Map<string, Promise<Blob>>();
const failures = new Map<string, { expires: number; error: Error }>();
let active = 0;
const waiting: Array<() => void> = [];

async function withDownloadSlot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve));
  else active++;
  try { return await work(); }
  finally {
    const next = waiting.shift();
    if (next) next(); else active--;
  }
}

export async function loadOriginalInvoice(invoice: GDTInvoice): Promise<Blob> {
  const baseCacheKey = getInvoiceOriginalCacheKey(invoice);
  const provider = resolveInvoiceProvider(invoice);
  // Both providers historically cached unrelated PDFs (e.g. a seller's
  // "HƯỚNG DẪN" document) under an invoice key. Never reuse those blobs.
  const cacheKey = provider === 'MINVOICE'
    ? baseCacheKey + '|minvoice-pdf-only-v2'
    : provider === 'THAISON' || provider === 'MISA'
      ? baseCacheKey + '|verified-original-v5'
      : baseCacheKey;
  const xmlLookup = invoice.rawXml ? extractLookupDetailsFromXml(invoice.rawXml) : { lookupCode: '', lookupUrl: '' };
  const sellerPortal = provider === 'THAISON' ? lookupPortalForSeller(invoice.nbmst) : undefined;
  const originalUrl = provider === 'THAISON'
    ? (normalizeThaiSonPortalUrl(xmlLookup.lookupUrl || invoice.lookupUrl) || xmlLookup.lookupUrl || invoice.lookupUrl || '')
    : (xmlLookup.lookupUrl || invoice.lookupUrl || '');
  const isGenericThaiSon = !originalUrl || /^https?:\/\/(?:www\.)?einvoice\.vn(?:\/|$)/i.test(originalUrl);
  // A generic solution-provider page is not evidence of the seller's tenant.
  // Never submit a seller-specific lookup code to an unverified generic portal.
  const resolvedPortal = provider === 'THAISON'
    ? (isGenericThaiSon ? (sellerPortal || '') : originalUrl)
    : originalUrl;
  const resolvedCode = xmlLookup.lookupCode || invoice.lookupCode;
  const requestKey = JSON.stringify([cacheKey, provider, resolvedCode, resolvedPortal]);
  const inFlight = pending.get(requestKey);
  if (inFlight) return inFlight;
  const task = (async () => {
    const legacyKey = [invoice.nbmst || '', invoice.khhdon || '', String(invoice.shdon || '')].join('|').replace(/[^a-zA-Z0-9|_-]/g, '_');
    const hasPoisonedLegacyCache = provider === 'THAISON' || provider === 'MISA' || provider === 'MINVOICE';
    const cached = await readCachedOriginalPdf(cacheKey).catch(() => null)
      || (!hasPoisonedLegacyCache ? await readCachedOriginalPdf(legacyKey).catch(() => null) : null);
    if (cached) return cached;
    const failed = failures.get(requestKey);
    if (failed && failed.expires > Date.now()) throw failed.error;
    if (!invoice.rawXml) throw new Error('Chưa có XML chi tiết để tải bản gốc.');
    return withDownloadSlot(async () => {
      const response = await fetch('/api/invoice-downloader/download?format=binary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(55000),
        body: JSON.stringify({
          xml: invoice.rawXml, timeoutMs: 45000, overrideProvider: provider,
          customInfo: {
            lookupCode: resolvedCode, sellerTaxCode: invoice.nbmst,
            lookupUrl: resolvedPortal, invoiceNo: invoice.shdon, invoiceSeries: invoice.khhdon,
            msttcgp: invoice.msttcgp, tentcgp: invoice.tentcgp,
          },
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Máy chủ tải hóa đơn ${provider || ''} trả về HTTP ${response.status}.`);
      }
      const blob = await response.blob();
      const head = await blob.slice(0, 256).text();
      const isPdf = head.startsWith('%PDF-');
      if (provider === 'MINVOICE' && !isPdf) {
        throw new Error('M-invoice không trả về PDF gốc; không thay bằng XML hoặc ZIP.');
      }
      const isZip = blob.type.includes('application/zip') ||
        head.startsWith('PK\\x03\\x04');
      const isXml = /^(application|text)\/xml/i.test(blob.type) &&
        /^(?:<\?xml\b|<HDon(?:\s|>))/i.test(head.replace(/^\uFEFF/, '').trimStart());
      const isHtml = blob.type.includes('text/html') && /<(!doctype|html|head|div|style)/i.test(head);
      if (!isPdf && !isHtml && !isZip && !isXml) throw new Error('Nhà cung cấp không trả về bản gốc hợp lệ.');
      const original = new Blob([blob], {
        type: isPdf ? 'application/pdf' : isZip ? 'application/zip'
          : isXml ? 'application/xml' : 'text/html'
      });
      // Storage quota errors must not trigger another paid provider lookup.
      await writeCachedOriginalPdf(cacheKey, original).catch(error => console.warn('[Original cache]', error));
      return original;
    });
  })();
  pending.set(requestKey, task);
  try { return await task; }
  catch (error: any) {
    for (const [key, failed] of failures) if (failed.expires <= Date.now()) failures.delete(key);
    if (failures.size >= 256) failures.delete(failures.keys().next().value!);
    failures.set(requestKey, { expires: Date.now() + 60000, error });
    throw error;
  } finally { pending.delete(requestKey); }
}
