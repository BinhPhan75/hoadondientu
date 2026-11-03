import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  FileCode2, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  RefreshCw, 
  ExternalLink,
  FileText,
  Loader2,
  Eye,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { GDTInvoice } from '../types';
import { generateGDTInvoiceXml } from '../utils/xmlGenerator';
import { generateInvoiceQrCode, exportInvoiceToPdfFile } from '../utils/pdfExporter';
import { 
  detectInvoiceProvider, 
  getProviderMeta, 
  extractLookupDetails, 
  InvoiceProviderId, 
  ProviderMeta 
} from '../utils/multiTemplateRenderer';
import { buildDirectLookupUrl, openVnptDirectPortal } from '../templates/templateUtils';
import { ensureInvoiceItems, hasGenuineItems, extractTagValue } from '../utils/xmlParser';
import { getInvoiceOriginalCacheKey, readCachedOriginalPdf, writeCachedOriginalPdf } from '../utils/invoiceOriginalCache';
import { resolveInvoiceProvider } from '../utils/providerRouting';

interface InvoiceDetailModalProps {
  invoice: GDTInvoice | null;
  allInvoices?: GDTInvoice[];
  onSelectInvoice?: (invoice: GDTInvoice) => void;
  onClose: () => void;
  onDownloadXml?: (invoice: GDTInvoice) => void;
  onUpdateInvoice?: (invoice: GDTInvoice) => void;
  token?: string;
  cookieHeader?: string;
}

// Keep the provider's own HTML pagination when it is displayed inside the modal.
// This is especially important for EasyInvoice invoices with many line items.
const prepareOriginalInvoiceHtml = (html: string): string => {
  if (!html || /id=["']gdt-original-page-style["']/i.test(html)) return html;
  const style = `<style id="gdt-original-page-style">
    @page { size: A4; margin: 0; }
    html, body { margin: 0 !important; padding: 0 !important; background: #fff; }
    table { max-width: 100%; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr, img, .invoice-row, .invoice-item { break-inside: avoid; page-break-inside: avoid; }
    .page-break, .pageBreak, .invoice-page { break-after: page; page-break-after: always; }
    @media print { body { background: #fff; } }
  </style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}</head>`);
  return `${style}${html}`;
};

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  allInvoices = [],
  onSelectInvoice,
  onClose,
  onDownloadXml: _onDownloadXml,
  onUpdateInvoice,
  token,
  cookieHeader
}) => {
  const [currentInvoice, setCurrentInvoice] = useState<GDTInvoice | null>(invoice);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  // Theo dõi hóa đơn đang thực sự được mở để bỏ qua kết quả tải chi tiết trả
  // về SAU KHI người dùng đã đóng modal hoặc chuyển sang xem hóa đơn khác -
  // tránh việc áp dữ liệu cũ/không khớp vào state và làm crash giao diện.
  const openInvoiceIdRef = useRef<string | null>(invoice?.id ?? null);

  useEffect(() => {
    setCurrentInvoice(invoice);
    setOriginalEasyInvoiceHtml(null);
    if (originalProviderPdfUrl) {
      window.URL.revokeObjectURL(originalProviderPdfUrl);
      setOriginalProviderPdfUrl(null);
    }
    setOriginalMisaPdfUrl(null);
    setOriginalVnptHtml(null);
    setVnptCheckCode(null);
    setVnptPortalUrl(null);
    if (originalViettelPdfUrl) {
      window.URL.revokeObjectURL(originalViettelPdfUrl);
      setOriginalViettelPdfUrl(null);
    }
    if (originalFourSiPdfUrl) {
      window.URL.revokeObjectURL(originalFourSiPdfUrl);
      setOriginalFourSiPdfUrl(null);
    }
    openInvoiceIdRef.current = invoice?.id ?? null;
  }, [invoice]);

  const effectiveInvoice = invoice
    ? (currentInvoice && currentInvoice.id === invoice.id ? currentInvoice : invoice)
    : null;

  const [originalEasyInvoiceHtml, setOriginalEasyInvoiceHtml] = useState<string | null>(null);
  const [originalMisaPdfUrl, setOriginalMisaPdfUrl] = useState<string | null>(null);
  const [originalProviderPdfUrl, setOriginalProviderPdfUrl] = useState<string | null>(null);
  const [originalVnptHtml, setOriginalVnptHtml] = useState<string | null>(null);
  const [vnptCheckCode, setVnptCheckCode] = useState<string | null>(null);
  const [vnptPortalUrl, setVnptPortalUrl] = useState<string | null>(null);
  const [isLoadingVnptOriginal, setIsLoadingVnptOriginal] = useState(false);
  const [isDownloadingVnptPdf, setIsDownloadingVnptPdf] = useState(false);
  const [originalViettelPdfUrl, setOriginalViettelPdfUrl] = useState<string | null>(null);
  const [isLoadingViettelOriginal, setIsLoadingViettelOriginal] = useState(false);
  const [isDownloadingViettelPdf, setIsDownloadingViettelPdf] = useState(false);
  const [isDownloadingViettelZip, setIsDownloadingViettelZip] = useState(false);
  const [originalFourSiPdfUrl, setOriginalFourSiPdfUrl] = useState<string | null>(null);
  const [isLoadingFourSiOriginal, setIsLoadingFourSiOriginal] = useState(false);
  const [isDownloadingFourSiPdf, setIsDownloadingFourSiPdf] = useState(false);
  const [fourSiNotice, setFourSiNotice] = useState<string | null>(null);
  const [fourSiError, setFourSiError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const theme = 'red';
  const selectedTemplateId = 'AUTO';

  // Automatic & manual on-demand invoice detail retrieval directly from GDT
  const loadInvoiceDetail = async (targetInv: GDTInvoice, force = false) => {
    if (!targetInv) return;
    if (!force && targetInv.sourceCompleteness === 'detail' && hasGenuineItems(targetInv.items)) {
      return;
    }
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const response = await fetch('/api/gdt/invoice-detail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': token } : {}),
          ...(cookieHeader ? { 'x-gdt-cookie': cookieHeader } : {})
        },
        body: JSON.stringify({
          invoice: targetInv,
          token,
          cookieHeader
        })
      });
      const data = await response.json();
      // Bỏ qua nếu người dùng đã đóng modal hoặc đã chuyển sang xem hóa đơn
      // khác trong lúc request này đang chạy (tránh áp dữ liệu lạc vào state
      // sau khi đóng, nguyên nhân từng gây crash/trang trắng khi đóng modal).
      if (openInvoiceIdRef.current !== targetInv.id) {
        return;
      }
      if (data.success && data.invoice) {
        const enriched = data.invoice as GDTInvoice;
        setCurrentInvoice(enriched);
        onUpdateInvoice?.(enriched);
      } else {
        setDetailError(data.message || 'Cổng Thuế chưa phản hồi chi tiết mặt hàng.');
      }
    } catch (err: any) {
      if (openInvoiceIdRef.current !== targetInv.id) return;
      setDetailError(err.message || 'Lỗi mạng khi kết nối tải chi tiết.');
    } finally {
      if (openInvoiceIdRef.current === targetInv.id) {
        setIsLoadingDetail(false);
      }
    }
  };

  const handleViewOriginalVnpt = async () => {
    if (!effectiveInvoice) return;
    const lookupCode = lookupDetails.lookupCode || effectiveInvoice.lookupCode;
    if (!lookupCode) {
      alert('Hóa đơn VNPT không có mã tra cứu để tra cứu bản gốc.');
      return;
    }
    setIsLoadingVnptOriginal(true);
    try {
      const resp = await fetch('/api/vnpt/view-original', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lookupCode: lookupCode.trim(),
          sellerTaxCode: effectiveInvoice.nbmst,
          lookupUrl: lookupDetails.lookupUrl || currentProviderMeta.portalUrl
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success || !data.htmlContent) {
        throw new Error(data.error || 'Không nhận được bản thể hiện gốc từ VNPT.');
      }
      setOriginalVnptHtml(data.htmlContent);
      if (data.checkCode) setVnptCheckCode(data.checkCode);
      if (data.portalUrl) setVnptPortalUrl(data.portalUrl);
    } catch (err: any) {
      console.error('[InvoiceDetailModal] Lỗi xem VNPT gốc:', err);
      alert(`Không thể hiển thị bản gốc VNPT: ${err.message}`);
    } finally {
      setIsLoadingVnptOriginal(false);
    }
  };

  const handleDownloadVnptPdf = async () => {
    if (!effectiveInvoice) return;
    const lookupCode = lookupDetails.lookupCode || effectiveInvoice.lookupCode;
    if (!lookupCode) {
      alert('Hóa đơn VNPT không có mã tra cứu để tải PDF gốc.');
      return;
    }
    setIsDownloadingVnptPdf(true);
    try {
      const portal = vnptPortalUrl || lookupDetails.lookupUrl || currentProviderMeta.portalUrl;
      const cleanCheckCode = (vnptCheckCode && vnptCheckCode !== 'undefined' && vnptCheckCode !== 'null') ? vnptCheckCode : undefined;
      
      const resp = await fetch('/api/vnpt/download-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lookupCode: lookupCode.trim(),
          sellerTaxCode: effectiveInvoice.nbmst,
          portalUrl: portal,
          checkCode: cleanCheckCode,
          invoiceNumber: effectiveInvoice.shdon
        })
      });

      if (!resp.ok) {
        let errorMsg = 'Không thể tải file PDF gốc từ cổng VNPT.';
        try {
          const errJson = await resp.json();
          if (errJson.error) errorMsg = errJson.error;
        } catch {}
        throw new Error(errorMsg);
      }

      const blob = await resp.blob();
      if (!blob || blob.size < 500) {
        throw new Error('Dữ liệu PDF nhận được từ cổng VNPT bị rỗng hoặc không hợp lệ.');
      }

      const cleanShd = effectiveInvoice.shdon ? String(effectiveInvoice.shdon).padStart(7, '0') : lookupCode.slice(0, 8);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `HoaDon_VNPT_${cleanShd}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (err: any) {
      console.error('[InvoiceDetailModal] Lỗi tải PDF gốc VNPT:', err);
      alert(`Không thể tải PDF gốc từ cổng VNPT: ${err.message}`);
    } finally {
      setIsDownloadingVnptPdf(false);
    }
  };

  const handleDownloadViettelPdf = async () => {
    if (!effectiveInvoice) return;
    const reservationCode = lookupDetails.lookupCode || effectiveInvoice.lookupCode;
    const supplierTaxCode = effectiveInvoice.nbmst;

    if (!supplierTaxCode || !reservationCode) {
      alert('Hóa đơn Viettel thiếu Mã số thuế bên bán hoặc Mã bí mật để tải PDF gốc.');
      return;
    }

    setIsDownloadingViettelPdf(true);
    try {
      const resp = await fetch('/api/viettel/download-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierTaxCode: supplierTaxCode.trim(),
          reservationCode: reservationCode.trim(),
          invoiceNo: effectiveInvoice.shdon,
          invoiceSeries: effectiveInvoice.khhdon
        })
      });

      if (!resp.ok) {
        let errMsg = 'Không thể tải file PDF gốc từ cổng Viettel.';
        try {
          const errJson = await resp.json();
          if (errJson.error) errMsg = errJson.error;
        } catch {}
        throw new Error(errMsg);
      }

      const blob = await resp.blob();
      if (!blob || blob.size < 500) {
        throw new Error('Dữ liệu PDF nhận được từ Viettel bị rỗng.');
      }

      const cleanShd = effectiveInvoice.shdon ? String(effectiveInvoice.shdon).padStart(7, '0') : '0000000';
      const cleanKhhdon = (effectiveInvoice.khhdon || '').replace(/[^a-zA-Z0-9]/g, '');
      const filename = `HoaDon_Viettel_${supplierTaxCode}_${cleanKhhdon ? cleanKhhdon + '_' : ''}${cleanShd}_${reservationCode}.pdf`;

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
    } catch (err: any) {
      console.error('[InvoiceDetailModal] Lỗi tải PDF Viettel:', err);
      alert(`Không thể tải PDF gốc từ cổng Viettel: ${err.message}`);
    } finally {
      setIsDownloadingViettelPdf(false);
    }
  };

  const handleDownloadPdfFile = async () => {
    if (!effectiveInvoice) return;
    setIsExportingPdf(true);
    try {
      // The fallback must never auto-select a supplier template. Supplier
      // templates are only used for genuine provider originals above.
      await exportInvoiceToPdfFile(effectiveInvoice, null, undefined, 'red', 'DEFAULT');
    } catch (err: any) {
      alert(`Không thể tạo bản PDF dự phòng: ${err?.message || String(err)}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleViewOriginalViettel = async () => {
    if (!effectiveInvoice) return;
    const reservationCode = lookupDetails.lookupCode || effectiveInvoice.lookupCode;
    const supplierTaxCode = effectiveInvoice.nbmst;

    if (!supplierTaxCode || !reservationCode) {
      alert('Hóa đơn Viettel thiếu Mã số thuế bên bán hoặc Mã bí mật.');
      return;
    }

    setIsLoadingViettelOriginal(true);
    try {
      const resp = await fetch('/api/viettel/download-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierTaxCode: supplierTaxCode.trim(),
          reservationCode: reservationCode.trim(),
          invoiceNo: effectiveInvoice.shdon,
          invoiceSeries: effectiveInvoice.khhdon
        })
      });

      if (!resp.ok) {
        let errMsg = 'Không thể tải bản gốc từ Viettel.';
        try {
          const errJson = await resp.json();
          if (errJson.error) errMsg = errJson.error;
        } catch {}
        throw new Error(errMsg);
      }

      const blob = await resp.blob();
      if (!blob || blob.size < 500) {
        throw new Error('Dữ liệu PDF từ Viettel bị rỗng.');
      }

      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(pdfBlob);
      if (originalViettelPdfUrl) {
        window.URL.revokeObjectURL(originalViettelPdfUrl);
      }
      setOriginalViettelPdfUrl(blobUrl);
    } catch (err: any) {
      console.error('[InvoiceDetailModal] Lỗi xem PDF Viettel:', err);
      alert(`Không thể hiển thị bản gốc Viettel: ${err.message}`);
    } finally {
      setIsLoadingViettelOriginal(false);
    }
  };

  const handleDownloadViettelZip = async () => {
    if (!effectiveInvoice) return;
    const reservationCode = lookupDetails.lookupCode || effectiveInvoice.lookupCode;
    const supplierTaxCode = effectiveInvoice.nbmst;

    if (!supplierTaxCode || !reservationCode) {
      alert('Hóa đơn Viettel thiếu Mã số thuế bên bán hoặc Mã bí mật.');
      return;
    }

    setIsDownloadingViettelZip(true);
    try {
      const resp = await fetch('/api/viettel/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierTaxCode: supplierTaxCode.trim(),
          reservationCode: reservationCode.trim(),
          invoiceNo: effectiveInvoice.shdon
        })
      });

      if (!resp.ok) {
        let errMsg = 'Không thể tải tệp ZIP từ Viettel.';
        try {
          const errJson = await resp.json();
          if (errJson.error) errMsg = errJson.error;
        } catch {}
        throw new Error(errMsg);
      }

      const blob = await resp.blob();
      const cleanShd = effectiveInvoice.shdon ? String(effectiveInvoice.shdon).padStart(7, '0') : '0000000';
      const filename = `HoaDon_Viettel_${supplierTaxCode}_${cleanShd}_${reservationCode}.zip`;

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
    } catch (err: any) {
      alert(`Không thể tải ZIP Viettel: ${err.message}`);
    } finally {
      setIsDownloadingViettelZip(false);
    }
  };

  const fetchFourSiPdfBlob = async (): Promise<Blob> => {
    if (!effectiveInvoice) throw new Error('Không có dữ liệu hóa đơn.');
    const xmlToUse = effectiveInvoice.rawXml || generateGDTInvoiceXml(effectiveInvoice);
    const resp = await fetch('/api/foursi/download-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        xml: xmlToUse,
        invoice: effectiveInvoice
      })
    });

    if (!resp.ok) {
      let errMsg = 'Cổng LCS Soft chưa thể tạo được bản thể hiện PDF từ XML này.';
      try {
        const errJson = await resp.json();
        if (errJson.error) errMsg = errJson.error;
      } catch {}
      throw new Error(errMsg);
    }

    const blob = await resp.blob();
    if (!blob || blob.size < 100) {
      throw new Error('Dữ liệu PDF nhận được từ cổng LCS Soft không hợp lệ.');
    }
    return blob;
  };

  const handleViewFourSiPdf = async () => {
    if (!effectiveInvoice) return;
    if (originalFourSiPdfUrl) {
      // Đã nạp sẵn bản thể hiện đang hiển thị
      return;
    }
    setIsLoadingFourSiOriginal(true);
    setFourSiError(null);
    try {
      const blob = await fetchFourSiPdfBlob();
      const blobUrl = window.URL.createObjectURL(blob);
      setOriginalFourSiPdfUrl(blobUrl);
      setFourSiNotice('Đã nạp bản thể hiện 4Si từ cổng LCS Soft thành công.');
      setTimeout(() => setFourSiNotice(null), 4000);
    } catch (err: any) {
      console.error('[InvoiceDetailModal] Lỗi xem PDF 4Si qua LCS Soft:', err);
      setFourSiError(`Không thể hiển thị bản thể hiện 4Si từ LCS Soft: ${err.message}`);
    } finally {
      setIsLoadingFourSiOriginal(false);
    }
  };

  const handleDownloadFourSiPdf = async () => {
    if (!effectiveInvoice) return;
    setIsDownloadingFourSiPdf(true);
    setFourSiError(null);
    try {
      const cleanShd = effectiveInvoice.shdon ? String(effectiveInvoice.shdon).padStart(7, '0') : '0000000';
      const cleanKhh = effectiveInvoice.khhdon || '4SI';
      const filename = `HoaDon_4SI_LCS_${cleanKhh}_${cleanShd}.pdf`;

      let blobUrl = originalFourSiPdfUrl;

      if (!blobUrl) {
        const blob = await fetchFourSiPdfBlob();
        blobUrl = window.URL.createObjectURL(blob);
        // Lưu lại để có thể xem trực tiếp ngay mà không cần fetch lại
        setOriginalFourSiPdfUrl(blobUrl);
      }

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setFourSiNotice(`Đã tải tệp ${filename} thành công!`);
      setTimeout(() => setFourSiNotice(null), 4000);
    } catch (err: any) {
      setFourSiError(`Không thể tải PDF 4Si từ LCS Soft: ${err.message}`);
    } finally {
      setIsDownloadingFourSiPdf(false);
    }
  };

  const handleViewOriginalEasyInvoice = async () => {
    if (!effectiveInvoice) return;
    const lookupCode = lookupDetails.lookupCode || effectiveInvoice.lookupCode;
    if (!lookupCode) {
      alert('Hóa đơn này không có mã tra cứu (FKey) để tra cứu bản gốc.');
      return;
    }

    setIsDownloadingEasyInvoice(true);
    setEasyInvoiceDownloadStatus('Đang nhập mã tra cứu và giải Captcha...');
    try {
      const resp = await fetch('/api/easyinvoice/download?format=view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lookupCode: lookupCode.trim(),
          sellerTaxCode: effectiveInvoice.nbmst,
          lookupUrl: lookupDetails.lookupUrl || currentProviderMeta.portalUrl,
          khhdon: effectiveInvoice.khhdon,
          shdon: effectiveInvoice.shdon,
          viewOnly: true
        })
      });
      const responseText = await resp.text();
      let data: { success?: boolean; htmlContent?: string; error?: string } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        throw new Error(
          resp.status === 504
            ? 'Máy chủ tra cứu hết thời gian chờ. Vui lòng thử lại sau vài giây.'
            : `Máy chủ trả về lỗi không hợp lệ (HTTP ${resp.status}).`
        );
      }
      if (!resp.ok || !data.success || !data.htmlContent) {
        throw new Error(data.error || 'Không nhận được bản HTML gốc từ EasyInvoice.');
      }
      setOriginalEasyInvoiceHtml(data.htmlContent);
      setEasyInvoiceDownloadStatus('Đã tải bản thể hiện gốc.');
    } catch (err: any) {
      console.error('[InvoiceDetailModal] Lỗi xem EasyInvoice gốc:', err);
      alert(`Không thể hiển thị bản gốc EasyInvoice: ${err.message}`);
      setEasyInvoiceDownloadStatus(null);
    } finally {
      setIsDownloadingEasyInvoice(false);
    }
  };

  const handleViewOriginalMisa = async () => {
    if (!effectiveInvoice) return;
    const lookupCode = lookupDetails.lookupCode || effectiveInvoice.lookupCode || effectiveInvoice.mhdon;
    if (!lookupCode || !effectiveInvoice.rawXml) {
      alert('Hóa đơn chưa có mã tra cứu hoặc XML chi tiết để tải bản gốc.');
      return;
    }

    const cacheKey = getInvoiceOriginalCacheKey(effectiveInvoice);
    try {
      const cached = await readCachedOriginalPdf(cacheKey);
      if (cached) {
        const cachedUrl = window.URL.createObjectURL(cached);
        setOriginalProviderPdfUrl(cachedUrl);
        if (isMisaInvoice) setOriginalMisaPdfUrl(cachedUrl);
        setEasyInvoiceDownloadStatus('Đã mở PDF gốc đã lưu trên máy này.');
        return;
      }
    } catch (cacheError) {
      console.warn('[InvoiceDetailModal] Không đọc được cache PDF MISA:', cacheError);
    }

    setIsDownloadingEasyInvoice(true);
    setEasyInvoiceDownloadStatus('Đang tải PDF gốc từ nhà cung cấp...');
    try {
      const resp = await fetch('/api/invoice-downloader/download?format=binary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xml: effectiveInvoice.rawXml,
          timeoutMs: 20000,
          overrideProvider: resolveInvoiceProvider(effectiveInvoice),
          customInfo: {
            lookupCode: lookupCode.trim(),
            sellerTaxCode: effectiveInvoice.nbmst,
            lookupUrl: lookupDetails.lookupUrl || effectiveInvoice.lookupUrl,
            invoiceNo: effectiveInvoice.shdon,
            invoiceSeries: effectiveInvoice.khhdon
          }
        })
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || `Máy chủ MISA trả về HTTP ${resp.status}.`);
      }
      const blob = await resp.blob();
      if (!blob.size || (blob.type && !blob.type.includes('pdf'))) {
        throw new Error('Nhà cung cấp không trả về file PDF hợp lệ.');
      }
      await writeCachedOriginalPdf(cacheKey, blob);
      const pdfUrl = window.URL.createObjectURL(blob);
      if (originalProviderPdfUrl) window.URL.revokeObjectURL(originalProviderPdfUrl);
      setOriginalProviderPdfUrl(pdfUrl);
      if (isMisaInvoice) setOriginalMisaPdfUrl(pdfUrl);
      setEasyInvoiceDownloadStatus('Đã tải bản PDF gốc từ nhà cung cấp.');
    } catch (err: any) {
      console.error('[InvoiceDetailModal] Lỗi xem bản gốc nhà cung cấp:', err);
      alert(`Không thể hiển thị bản gốc nhà cung cấp: ${err.message}`);
      setEasyInvoiceDownloadStatus(null);
    } finally {
      setIsDownloadingEasyInvoice(false);
    }
  };

  // Trigger automatic load immediately when an invoice without genuine items is opened
  useEffect(() => {
    if (invoice && (!hasGenuineItems(invoice.items) || invoice.sourceCompleteness !== 'detail')) {
      loadInvoiceDetail(invoice);
    }
  }, [invoice?.id]);

  // Find index in list for navigation
  const currentIndex = effectiveInvoice && allInvoices.length > 0 
    ? allInvoices.findIndex(i => i.id === effectiveInvoice.id) 
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allInvoices.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectInvoice) {
      onSelectInvoice(allInvoices[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectInvoice) {
      onSelectInvoice(allInvoices[currentIndex + 1]);
    }
  };

  // Generate real QR code for the invoice
  useEffect(() => {
    if (effectiveInvoice) {
      generateInvoiceQrCode(effectiveInvoice).then(url => {
        setQrCodeUrl(url);
      });
    }
  }, [effectiveInvoice]);

  // Tự động nạp sẵn dữ liệu hóa đơn gốc VNPT trong nền (HTML + PDF) để khi người dùng bấm Xem hoặc Tải PDF thì có ngay lập tức
  useEffect(() => {
    if (!effectiveInvoice) return;
    const isVnpt =
      effectiveInvoice.provider === 'VNPT' ||
      effectiveInvoice.msttcgp === '0100684378' ||
      effectiveInvoice.nbmst === '4000344946' ||
      /vnpt/i.test(effectiveInvoice.lookupUrl || '');

    const code = effectiveInvoice.mhdon || effectiveInvoice.lookupCode;
    if (isVnpt && code && !originalVnptHtml) {
      const cleanCode = code.trim().replace(/^(mã\s*tra\s*cứu|mtc|mtcuu|mã\s*tc|code|fkey)[\s:=-]*/i, '').trim();
      fetch('/api/vnpt/view-original', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lookupCode: cleanCode,
          sellerTaxCode: effectiveInvoice.nbmst,
          lookupUrl: effectiveInvoice.lookupUrl
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success) {
            if (data.checkCode) setVnptCheckCode(data.checkCode);
            if (data.portalUrl) setVnptPortalUrl(data.portalUrl);
          }
        })
        .catch(() => {});
    }
  }, [effectiveInvoice?.id, effectiveInvoice?.shdon, effectiveInvoice?.mhdon, effectiveInvoice?.lookupCode]);

  // Tự tải bản gốc cho mọi nhà cung cấp đã có driver và mã tra cứu.
  useEffect(() => {
    if (!effectiveInvoice || originalEasyInvoiceHtml || originalProviderPdfUrl || isDownloadingEasyInvoice) return;
    const provider = resolveInvoiceProvider(effectiveInvoice);
    const hasProviderDriver = Boolean(
      (provider && provider !== 'DEFAULT' && provider !== 'UNKNOWN' && provider !== 'GENERIC') ||
      effectiveInvoice.msttcgp ||
      effectiveInvoice.lookupUrl
    );
    const code = effectiveInvoice.lookupCode || effectiveInvoice.mhdon;
    if (hasProviderDriver && code) {
      if (provider === 'EASYINVOICE') {
        void handleViewOriginalEasyInvoice();
      } else {
        void handleViewOriginalMisa();
      }
    }
  }, [effectiveInvoice?.id, effectiveInvoice?.lookupCode, effectiveInvoice?.provider, effectiveInvoice?.msttcgp]);

  if (!invoice || !effectiveInvoice) return null;

  // Dò tìm tự động nhà cung cấp HĐĐT từ XML hoặc dữ liệu bóc tách.
  // Bọc trong try/catch: nếu dữ liệu hóa đơn (ví dụ từ nguồn mới như hóa đơn
  // máy tính tiền) có định dạng bất thường khiến các hàm này ném lỗi, tránh
  // để lỗi văng ra ngoài render và làm crash toàn bộ trang (trang trắng).
  let xmlContent = '';
  let autoDetectedProvider: InvoiceProviderId = 'DEFAULT' as InvoiceProviderId;
  let lookupDetails: { lookupCode?: string; lookupUrl?: string } = {};
  let safeItems: ReturnType<typeof ensureInvoiceItems> = [];
  let renderError: string | null = null;

  try {
    xmlContent = effectiveInvoice.rawXml || generateGDTInvoiceXml(effectiveInvoice);
    const detectedProvider = detectInvoiceProvider(xmlContent, effectiveInvoice);
    // Never expose partner-specific template names. The provider badge is
    // based only on the actual invoice solution provider, otherwise a seller
    // can be mislabeled as a different partner template.
    const standardProviders = new Set<InvoiceProviderId>([
      'MISA', 'VIETTEL', 'VNPT', 'EASYINVOICE', 'BKAV', '4SI', 'LCS_SOFT',
      'VNPAY', 'FPT', 'MINVOICE', 'THAISON', 'CYBERBILL', 'DEFAULT'
    ]);
    autoDetectedProvider = standardProviders.has(detectedProvider)
      ? detectedProvider
      : 'DEFAULT';
    lookupDetails = extractLookupDetails(xmlContent);

    // Ưu tiên mã tra cứu và URL có sẵn từ invoice nếu chưa trích xuất được từ XML
    if (!lookupDetails.lookupCode && effectiveInvoice.lookupCode) {
      lookupDetails.lookupCode = effectiveInvoice.lookupCode;
    }
    if (!lookupDetails.lookupUrl && effectiveInvoice.lookupUrl) {
      lookupDetails.lookupUrl = effectiveInvoice.lookupUrl;
    }

    // Đối với hóa đơn VNPT như Nghĩa Sơn: nếu chưa có mã tra cứu thì dùng mã CQT cấp cho từng hóa đơn
    const isVnptInvoice = 
      effectiveInvoice.provider === 'VNPT' ||
      effectiveInvoice.nbmst === '4000344946' ||
      effectiveInvoice.msttcgp === '0100684378' ||
      (effectiveInvoice.nbten && /NGHĨA SƠN|NGHIA SON/i.test(effectiveInvoice.nbten)) ||
      autoDetectedProvider === 'NGHIA_SON' ||
      autoDetectedProvider === 'VNPT';

    if (isVnptInvoice) {
      if (!lookupDetails.lookupCode) {
        const cqt = effectiveInvoice.mhdon || extractTagValue(xmlContent, 'MCCQT') || extractTagValue(xmlContent, 'mhdon');
        if (cqt) {
          lookupDetails.lookupCode = cqt;
        }
      }
      if (!lookupDetails.lookupUrl) {
        const cleanTaxCode = (effectiveInvoice.nbmst || '').trim().replace(/[^0-9\-]/g, '');
        lookupDetails.lookupUrl = effectiveInvoice.lookupUrl || `https://${cleanTaxCode || '1801660803-001'}-tt78.vnpt-invoice.com.vn`;
      }
    }

    // Đối với hóa đơn MISA meInvoice (Xuân Vinh, Tài Trâm Anh, Tân Thanh Danh, Báo Đại Đoàn Kết...):
    // Cổng tra cứu chuẩn luôn là https://www.meinvoice.vn/tra-cuu (không lấy website người bán như daidoanket.vn)
    const isMisaInvoice =
      effectiveInvoice.provider === 'MISA' ||
      effectiveInvoice.msttcgp === '0101243150' ||
      effectiveInvoice.nbmst === '0317978711' || // Tân Thanh Danh
      effectiveInvoice.nbmst === '0312105174' || // Tài Trâm Anh
      effectiveInvoice.nbmst === '0400557356' || // Xuân Vinh
      autoDetectedProvider === 'MISA' ||
      autoDetectedProvider === 'TAN_THANH_DANH' ||
      autoDetectedProvider === 'TAI_TRAM_ANH' ||
      autoDetectedProvider === 'XUAN_VINH' ||
      (effectiveInvoice.nbten && /TÂN THANH DANH|XUÂN VINH|TÀI TRÂM ANH|ĐẠI ĐOÀN KẾT/i.test(effectiveInvoice.nbten));

    if (isMisaInvoice) {
      lookupDetails.lookupUrl = 'https://www.meinvoice.vn/tra-cuu';
    }

    // Đối với nhà cung cấp 4si và 1 số nhà cung cấp chưa lấy được mã tra cứu thì để trống mã tra cứu
    const is4SiInvoice =
      effectiveInvoice.provider === '4SI' ||
      effectiveInvoice.msttcgp === '0302999571' ||
      effectiveInvoice.msttcgp === '0315744883' ||
      effectiveInvoice.nbmst === '0315018466' || // PNJ
      autoDetectedProvider === 'PNJ' ||
      autoDetectedProvider === '4SI';

    if (is4SiInvoice) {
      lookupDetails.lookupUrl = 'https://inv.4si.vn/tra-cuu-hoa-don';
      // Không gán mã CQT làm mã tra cứu cho 4SI, để trống nếu chưa có
    }

    // Đối với hóa đơn Viettel S-Invoice / vInvoice (SUNTALENT: 0402307168...):
    const cleanMstModal = (effectiveInvoice.nbmst || '').replace(/\D/g, '');
    const isViettelModalCheck =
      effectiveInvoice.provider === 'VIETTEL' ||
      effectiveInvoice.msttcgp === '0100109106' ||
      cleanMstModal === '0402307168' ||
      (effectiveInvoice.nbten && /SUNTALENT/i.test(effectiveInvoice.nbten)) ||
      autoDetectedProvider === 'VIETTEL';

    if (isViettelModalCheck) {
      if (!lookupDetails.lookupUrl) {
        lookupDetails.lookupUrl = 'https://vinvoice.viettel.vn/utilities/invoice-search';
      }
    }

    const isVnpayModalCheck =
      effectiveInvoice.provider === 'VNPAY' ||
      effectiveInvoice.msttcgp === '0102182292' ||
      effectiveInvoice.nbmst === '0100112437' ||
      autoDetectedProvider === 'VNPAY' ||
      Boolean(effectiveInvoice.nbten && /VIETCOMBANK/i.test(effectiveInvoice.nbten));

    if (isVnpayModalCheck) {
      const isVcb = effectiveInvoice.nbmst === '0100112437' || Boolean(effectiveInvoice.nbten && /VIETCOMBANK/i.test(effectiveInvoice.nbten));
      if (!lookupDetails.lookupUrl) {
        lookupDetails.lookupUrl = isVcb ? 'https://einvoice.vietcombank.com.vn/' : 'https://portal.vnpayinvoice.vn/';
      }
      const isInvalidCode = (code?: string) => !code || 
        code.toLowerCase() === 'vietcombank' || 
        /^[VTMB]\d{10,14}[A-Za-z0-9]{16,}$/i.test(code.trim()) ||
        (code.includes('0102182292') && code.length > 20);

      if (isInvalidCode(lookupDetails.lookupCode)) {
        lookupDetails.lookupCode = '';
      }
      // VNPAY chỉ tra cứu theo Số bảo mật in trên hóa đơn, không dùng mã CQT cấp (mhdon)
    }

    // BKAV eHoadon: nhận diện chắc chắn theo MST phát hành và dùng đúng cổng BKAV.
    if (effectiveInvoice.nbmst === '0314222123' || effectiveInvoice.provider === 'BKAV' || autoDetectedProvider === 'BKAV') {
      lookupDetails.lookupUrl = 'https://ehoadon.bkav.com/tra-cuu';
      if (!lookupDetails.lookupCode) {
        lookupDetails.lookupCode = effectiveInvoice.lookupCode || effectiveInvoice.mhdon || '';
      }
    }

    safeItems = ensureInvoiceItems(effectiveInvoice);
  } catch (err: any) {
    console.error('[InvoiceDetailModal] Lỗi khi xử lý dữ liệu hóa đơn:', err);
    renderError = err?.message || 'Không thể xử lý dữ liệu hóa đơn này.';
  }

  // Template ID hiệu lực: Nếu người dùng chọn AUTO thì dùng kết quả dò tìm tự động
  const resolvedTemplateId: InvoiceProviderId = (selectedTemplateId && selectedTemplateId !== 'AUTO')
    ? (selectedTemplateId as InvoiceProviderId)
    : autoDetectedProvider;

  // Chỉ gán template TKJ cho đúng MST TKJ. MSTTCGP là MST của tổ chức cung cấp
  // giải pháp, không phải căn cứ để kết luận người bán là TKJ.
  const safeResolvedTemplateId: InvoiceProviderId =
    resolvedTemplateId === 'TKJ' && effectiveInvoice.nbmst !== '0318443500'
      ? 'DEFAULT'
      : resolvedTemplateId;

  // Hóa đơn VNPAY & Vietcombank: Không có mã tra cứu trong XML GDT,
  // theo chỉ đạo của người dùng: Luôn sử dụng mẫu chuẩn Tổng cục Thuế (DEFAULT) để thông tin người bán và người mua chính xác 100%.
  const effectiveTemplateId: InvoiceProviderId = (safeResolvedTemplateId === 'VNPAY')
    ? 'DEFAULT'
    : safeResolvedTemplateId;

  const currentProviderMeta: ProviderMeta = getProviderMeta(effectiveTemplateId);

  const directLookupUrl = effectiveInvoice ? buildDirectLookupUrl(
    lookupDetails.lookupUrl || currentProviderMeta.portalUrl,
    lookupDetails.lookupCode,
    effectiveTemplateId,
    effectiveInvoice.nbmst
  ) : '';

  const isMisaInvoice = /meinvoice\.vn/i.test(directLookupUrl) || 
    effectiveTemplateId === 'MISA' || 
    effectiveTemplateId === 'TAI_TRAM_ANH' || 
    effectiveTemplateId === 'XUAN_VINH' || 
    effectiveTemplateId === 'TAN_THANH_DANH' ||
    effectiveInvoice?.nbmst === '0101243150';

  const isVnptInvoice =
    /vnpt-invoice|portaltool-miennam/i.test(directLookupUrl) ||
    effectiveTemplateId === 'VNPT' ||
    effectiveTemplateId === 'NGHIA_SON' ||
    effectiveInvoice?.provider === 'VNPT' ||
    effectiveInvoice?.msttcgp === '0100684378' ||
    effectiveInvoice?.nbmst === '4000344946';

  const isViettelInvoice = /vinvoice|sinvoice|viettel-invoice/i.test(directLookupUrl) || 
    /vinvoice|sinvoice|viettel-invoice/i.test(lookupDetails.lookupUrl || '') ||
    effectiveTemplateId === 'VIETTEL' || 
    effectiveInvoice?.provider === 'VIETTEL' ||
    effectiveInvoice?.msttcgp === '0100109106' ||
    effectiveInvoice?.nbmst === '0402307168' ||
    (effectiveInvoice?.nbmst && effectiveInvoice.nbmst.replace(/\D/g, '') === '0402307168') ||
    Boolean(effectiveInvoice?.nbten && /SUNTALENT/i.test(effectiveInvoice.nbten)) ||
    Boolean(effectiveInvoice?.caProvider?.toUpperCase().includes('VIETTEL')) ||
    (Boolean(lookupDetails.lookupCode) && (lookupDetails.lookupUrl?.includes('viettel') || effectiveInvoice?.nbmst === '049163008476'));

  const isEasyInvoice = /easyinvoice/i.test(directLookupUrl) ||
    /easyinvoice/i.test(lookupDetails.lookupUrl || '') ||
    effectiveTemplateId === 'EASYINVOICE' || 
    effectiveTemplateId === 'BAO_DUY' || 
    effectiveTemplateId === 'KIM_LOAN_TUAN' || 
    effectiveTemplateId === 'TKJ' ||
    effectiveInvoice?.provider === 'EASYINVOICE' ||
    effectiveInvoice?.msttcgp === '0105987432' ||
    effectiveInvoice?.nbmst === '0318391940';

  const isVnpayInvoice = /vnpayinvoice/i.test(directLookupUrl) ||
    /vnpayinvoice/i.test(lookupDetails.lookupUrl || '') ||
    /vietcombank\.com\.vn/i.test(directLookupUrl) ||
    /vietcombank\.com\.vn/i.test(lookupDetails.lookupUrl || '') ||
    effectiveTemplateId === 'VNPAY' ||
    effectiveInvoice?.provider === 'VNPAY' ||
    effectiveInvoice?.msttcgp === '0102182292' ||
    effectiveInvoice?.nbmst === '0100112437' ||
    Boolean(effectiveInvoice?.nbten && /VIETCOMBANK/i.test(effectiveInvoice?.nbten || ''));

  const isVietcombankInvoice = effectiveInvoice?.nbmst === '0100112437' ||
    Boolean(effectiveInvoice?.nbten && /VIETCOMBANK/i.test(effectiveInvoice?.nbten || ''));

  const is4SiInvoice =
    /4si\.vn|lcssoft\.com\.vn|dochoadon\.lcssoft\.com\.vn/i.test(directLookupUrl) ||
    /4si\.vn|lcssoft\.com\.vn|dochoadon\.lcssoft\.com\.vn/i.test(lookupDetails.lookupUrl || '') ||
    effectiveTemplateId === '4SI' ||
    effectiveTemplateId === 'PNJ' ||
    effectiveTemplateId === 'LCS_SOFT' ||
    effectiveInvoice?.provider === '4SI' ||
    effectiveInvoice?.provider === 'LCS_SOFT' ||
    effectiveInvoice?.msttcgp === '0315744883' ||
    effectiveInvoice?.msttcgp === '0302999571' ||
    effectiveInvoice?.nbmst === '0315018466' ||
    Boolean(effectiveInvoice?.caProvider?.toUpperCase().includes('4SI')) ||
    Boolean(effectiveInvoice?.caProvider?.toUpperCase().includes('LCS'));

  if (renderError) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
          <h3 className="text-lg font-bold text-red-600 mb-2">Không thể hiển thị hóa đơn</h3>
          <p className="text-sm text-gray-600 mb-4">{renderError}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-gray-700"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const [isDownloadingEasyInvoice, setIsDownloadingEasyInvoice] = useState(false);
  const [easyInvoiceDownloadStatus, setEasyInvoiceDownloadStatus] = useState<string | null>(null);

  const handleDownloadEasyInvoice = async () => {
    if (!effectiveInvoice) return;
    const lookupCode = lookupDetails.lookupCode || effectiveInvoice.lookupCode;
    if (!lookupCode) {
      alert('Hóa đơn này không có mã tra cứu (FKey) để tải từ cổng EasyInvoice.');
      return;
    }

    setIsDownloadingEasyInvoice(true);
    setEasyInvoiceDownloadStatus('Đang giải mã Captcha & tải HĐ...');
    try {
      const resp = await fetch('/api/easyinvoice/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lookupCode: lookupCode.trim(),
          sellerTaxCode: effectiveInvoice.nbmst,
          lookupUrl: lookupDetails.lookupUrl || currentProviderMeta.portalUrl,
          khhdon: effectiveInvoice.khhdon,
          shdon: effectiveInvoice.shdon
        })
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Tải hóa đơn từ EasyInvoice thất bại.');
      }

      // Tải file về máy
      const filename = data.filename || `HOADON_${effectiveInvoice.khhdon}_${effectiveInvoice.shdon}.pdf`;
      const contentType = data.contentType || 'application/pdf';
      const byteCharacters = atob(data.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      setEasyInvoiceDownloadStatus('Đã tải thành công!');
      setTimeout(() => setEasyInvoiceDownloadStatus(null), 3000);
    } catch (err: any) {
      console.error('[InvoiceDetailModal] Lỗi tải EasyInvoice:', err);
      alert(`Không thể tự động tải hóa đơn từ Cổng EasyInvoice: ${err.message}\nBạn có thể nhấn nút "Tra link gốc" để tra cứu trực tiếp.`);
      setEasyInvoiceDownloadStatus(null);
    } finally {
      setIsDownloadingEasyInvoice(false);
    }
  };

  const isRed = theme === 'red';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-900 rounded-xl max-w-6xl w-full shadow-2xl border border-slate-800 overflow-hidden max-h-[96vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Bar */}
        <div className="bg-slate-950 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs bg-blue-500/15 border border-blue-500/25 text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                  {effectiveInvoice.thdon || 'Hóa đơn điện tử'}: {effectiveInvoice.khhdon} - Số {effectiveInvoice.shdon}
                </h3>
                {effectiveInvoice.loaiHdon === 'purchase' ? (
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 text-[10px] font-semibold border border-blue-500/25">
                    MUA VÀO
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold border border-emerald-500/25">
                    BÁN RA
                  </span>
                )}
                {effectiveInvoice.hsgcma && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 text-[10px] font-mono font-medium border border-emerald-800/80 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    ĐÃ CẤP MÃ CQT
                  </span>
                )}
                {/* Provider Indicator Pill */}
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[10px] font-medium border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  NCC: {currentProviderMeta.shortName}
                </span>
                {is4SiInvoice && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-900/40 text-purple-300 text-[10px] font-mono font-medium border border-purple-700/50 flex items-center gap-1" title="Hóa đơn 4Si của Công ty L.C.S (lcssoft.com.vn) - Hỗ trợ đọc qua dochoadon.lcssoft.com.vn">
                    <span>LCS Soft / 4Si</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Bên bán: <span className="text-slate-200 font-medium">{effectiveInvoice.nbten}</span> (MST: <span className="text-slate-200 font-mono font-semibold">{effectiveInvoice.nbmst}</span>)
              </p>
            </div>
          </div>

          {/* Center Navigation & Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Prev / Next buttons */}
            {allInvoices.length > 1 && (
              <div className="flex items-center bg-slate-900 rounded-lg border border-slate-700 p-0.5 text-xs text-slate-300">
                <button
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="p-1 hover:text-white hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  title="Hóa đơn trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-[11px] font-mono text-slate-400">
                  {currentIndex + 1}/{allInvoices.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="p-1 hover:text-white hover:bg-slate-800 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  title="Hóa đơn tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950 flex justify-center items-start">
          <div className="w-full flex flex-col items-center">
            {/* 4Si Error Banner */}
            {fourSiError && (
              <div className="w-full max-w-[820px] mb-3 px-4 py-2.5 bg-red-950/90 border border-red-700/60 rounded-lg text-xs text-red-200 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{fourSiError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFourSiError(null)}
                  className="text-red-400 hover:text-white p-1 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 4Si Notice Banner */}
            {fourSiNotice && (
              <div className="w-full max-w-[820px] mb-3 px-4 py-2 bg-amber-950/90 border border-amber-600/60 rounded-lg text-xs text-amber-200 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{fourSiNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFourSiNotice(null)}
                  className="text-amber-400 hover:text-white p-1 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isDownloadingEasyInvoice && !originalProviderPdfUrl && (
              <div className="w-full max-w-[820px] mb-3 px-4 py-3 bg-emerald-950/80 border border-emerald-600/60 rounded-lg text-sm text-emerald-200 flex items-center gap-3 shadow-md">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                <span><strong>Hóa đơn gốc đang được tải về máy...</strong> Khung xem sẽ tự cập nhật khi tải xong.</span>
              </div>
            )}

            {/* 4Si Active Preview Banner */}
            {originalFourSiPdfUrl && (
              <div className="w-full max-w-[820px] mb-3 px-4 py-2 bg-amber-950/80 border border-amber-700/50 rounded-lg text-xs text-amber-200 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span>
                    Đang xem <strong>Bản thể hiện mẫu 4Si (LCS Soft)</strong> — tạo bởi dochoadon.lcssoft.com.vn (gần giống bản gốc, dùng tham khảo).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (originalFourSiPdfUrl) window.URL.revokeObjectURL(originalFourSiPdfUrl);
                    setOriginalFourSiPdfUrl(null);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-700 rounded transition-colors cursor-pointer shrink-0"
                >
                  Quay lại Mẫu chuẩn GDT
                </button>
              </div>
            )}

            {/* Paper A4 container */}
            <div 
              className="flex justify-center"
              style={{
                width: originalVnptHtml ? '890px' : '820px',
                minHeight: '1160px',
              }}
            >
                <div className={`${originalVnptHtml ? 'w-[890px]' : 'w-[820px]'} min-h-[1160px] bg-white rounded shadow-2xl overflow-hidden border border-gray-300`}>
                  {originalViettelPdfUrl ? (
                    <iframe
                      src={originalViettelPdfUrl}
                      title="Bản gốc PDF Viettel vInvoice"
                      className="w-full h-[1200px] border-0 bg-white"
                    />
                  ) : originalFourSiPdfUrl ? (
                    <iframe
                      src={originalFourSiPdfUrl}
                      title="Bản thể hiện mẫu 4Si từ dochoadon.lcssoft.com.vn"
                      className="w-full h-[1200px] border-0 bg-white"
                    />
                  ) : originalProviderPdfUrl ? (
                    <iframe
                      src={originalProviderPdfUrl}
                      title="Bản PDF gốc từ nhà cung cấp"
                      className="w-full h-[1200px] border-0 bg-white"
                    />
                  ) : originalEasyInvoiceHtml || originalVnptHtml ? (
                    <iframe
                      ref={iframeRef}
                      srcDoc={prepareOriginalInvoiceHtml(originalEasyInvoiceHtml || originalVnptHtml || '')}
                      title={originalEasyInvoiceHtml ? 'Bản gốc EasyInvoice' : originalVnptHtml ? 'Bản gốc VNPT' : 'Bản Thể Hiện Hóa Đơn Điện Tử'}
                      className="w-full h-[1200px] border-0 bg-white"
                      sandbox="allow-same-origin allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-forms"
                    />
                  ) : (
                    <div className="min-h-[1160px] bg-white p-6 text-slate-800">
                      <div className="mx-auto mt-6 max-w-3xl">
                        <h3 className="mb-3 text-base font-semibold">Dữ liệu hóa đơn từ Cổng Thuế</h3>
                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <div>MST bên bán: <strong>{effectiveInvoice.nbmst || '---'}</strong></div>
                          <div>Tên bên bán: <strong>{effectiveInvoice.nbten || '---'}</strong></div>
                          <div>Ký hiệu: <strong>{effectiveInvoice.khhdon || '---'}</strong></div>
                          <div>Số hóa đơn: <strong>{effectiveInvoice.shdon || '---'}</strong></div>
                        </div>
                        <div className="mt-5 overflow-x-auto border border-slate-300">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-100"><tr><th className="p-2">STT</th><th className="p-2">Tên hàng hóa, dịch vụ</th><th className="p-2">ĐVT</th><th className="p-2">SL</th><th className="p-2">Thành tiền</th></tr></thead>
                            <tbody>{safeItems.map((item, index) => {
                              const itemName = item.itemName || item.ten || (item as any).name || '';
                              return <tr key={`${index}-${itemName}`} className="border-t border-slate-200"><td className="p-2">{index + 1}</td><td className="p-2">{itemName || '---'}</td><td className="p-2">{item.unit || item.dvt || '---'}</td><td className="p-2">{item.quantity ?? item.sluong ?? '---'}</td><td className="p-2">{item.amount ?? item.thtien ?? '---'}</td></tr>;
                            })}</tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Item count status confirmation pill below */}
              <div className="mt-4 text-center text-xs text-gray-400 font-mono">
                {originalEasyInvoiceHtml ? (
                  <>Bản thể hiện <span className="text-emerald-400 font-bold">gốc từ EasyInvoice</span> • </>
                ) : originalVnptHtml ? (
                  <>Bản thể hiện <span className="text-cyan-400 font-bold">gốc từ VNPT Invoice</span> • </>
                ) : originalViettelPdfUrl ? (
                  <>Bản thể hiện PDF <span className="text-red-400 font-bold">gốc từ Viettel vInvoice</span> • </>
                ) : originalFourSiPdfUrl ? (
                  <>Bản thể hiện <span className="text-amber-400 font-bold">mẫu 4Si từ dochoadon.lcssoft.com.vn (bản thể hiện hiển thị, chưa phải bản gốc có CKS)</span> • </>
                ) : originalProviderPdfUrl ? (
                  <>Bản PDF <span className="text-emerald-400 font-bold">gốc từ nhà cung cấp</span> • </>
                ) : (
                  <>Chưa tải bản gốc • </>
                )}
                Đã nạp <span className="text-white font-bold">{safeItems.length}</span> dòng hàng hóa • 
                Ký hiệu: <span className="text-amber-400">{effectiveInvoice.khhdon}</span> • 
                Số HĐ: <span className="text-cyan-400">{effectiveInvoice.shdon}</span>
              </div>
            </div>
        </div>

        {/* Footer Actions Bar */}
        <div className="bg-slate-950 border-t border-slate-800 px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>HĐĐT Chuẩn Tổng cục Thuế (NĐ 123/2020/NĐ-CP & TT 78/2021/TT-BTC)</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isMisaInvoice ? (
              <div className="inline-flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleViewOriginalMisa}
                  disabled={isDownloadingEasyInvoice}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border-emerald-600 disabled:opacity-60"
                  title={`Tải PDF gốc MISA bằng FKey/TransactionID: ${lookupDetails.lookupCode || ''}`}
                >
                  {isDownloadingEasyInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>{isDownloadingEasyInvoice ? (easyInvoiceDownloadStatus || 'Đang tải...') : originalMisaPdfUrl ? 'Đang xem PDF gốc MISA' : 'Xem hóa đơn gốc MISA'}</span>
                </button>
                {directLookupUrl && (
                  <a href={directLookupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700">
                    <ExternalLink className="w-3 h-3" />
                    <span>Tra link gốc</span>
                  </a>
                )}
              </div>
            ) : isEasyInvoice ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleViewOriginalEasyInvoice}
                  disabled={isDownloadingEasyInvoice}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border-emerald-600 hover:border-emerald-500 ring-1 ring-emerald-500/30 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                  title={`Tra cứu mã FKey và hiển thị bản thể hiện gốc EasyInvoice (Mã tra cứu: ${lookupDetails.lookupCode || ''})`}
                >
                  {isDownloadingEasyInvoice ? (
                    <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{isDownloadingEasyInvoice ? (easyInvoiceDownloadStatus || 'Đang tra cứu...') : 'Xem hóa đơn gốc'}</span>
                </button>
                {directLookupUrl && (
                  <a
                    href={directLookupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    title="Mở cổng tra cứu EasyInvoice (Đã dán sẵn mã FKey)"
                  >
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                    <span>Tra link gốc</span>
                  </a>
                )}
              </div>
            ) : isVnptInvoice ? (
              <div className="inline-flex items-center gap-1.5 flex-wrap">
                {/* 1. Nút Xem hóa đơn gốc VNPT trong ứng dụng (tự động nạp bản thể hiện từ VNPT) */}
                <button
                  type="button"
                  onClick={handleViewOriginalVnpt}
                  disabled={isLoadingVnptOriginal}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-xs disabled:opacity-60 ${
                    originalVnptHtml
                      ? 'text-cyan-200 bg-cyan-900 border-cyan-400 ring-1 ring-cyan-400/40'
                      : 'text-cyan-300 bg-cyan-950/70 hover:bg-cyan-900 border-cyan-600'
                  }`}
                  title={`Tự động nhập mã tra cứu, giải Captcha và hiển thị bản thể hiện gốc VNPT (${lookupDetails.lookupCode || ''})`}
                >
                  {isLoadingVnptOriginal ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>{isLoadingVnptOriginal ? 'Đang nạp HĐ gốc...' : originalVnptHtml ? 'Đang xem bản gốc VNPT' : 'Xem hóa đơn gốc VNPT'}</span>
                </button>

                {/* 2. Nút chuyển về xem mẫu nội bộ nếu đang xem bản thể hiện VNPT */}
                {originalVnptHtml && (
                  <button
                    type="button"
                    onClick={() => setOriginalVnptHtml(null)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    title="Chuyển về xem mẫu thể hiện nội bộ"
                  >
                    <span>Mẫu nội bộ</span>
                  </button>
                )}

                {/* 3. Nút tải file PDF gốc VNPT */}
                <button
                  type="button"
                  onClick={handleDownloadVnptPdf}
                  disabled={isDownloadingVnptPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-blue-300 bg-blue-950/70 hover:bg-blue-900 border-blue-600 hover:border-blue-500 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                  title="Tải trực tiếp file PDF hóa đơn gốc đã ký số từ cổng VNPT (mục Tải file)"
                >
                  {isDownloadingVnptPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span>{isDownloadingVnptPdf ? 'Đang tải PDF...' : 'Tải PDF gốc VNPT'}</span>
                </button>

                {/* 4. Nút mở trực tiếp Cổng tra cứu VNPT và tự gán mã vào ô tra cứu */}
                <button
                  type="button"
                  onClick={() => {
                    const code = lookupDetails.lookupCode || effectiveInvoice?.mhdon || '';
                    openVnptDirectPortal(effectiveInvoice?.nbmst, code, lookupDetails.lookupUrl);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-sky-300 bg-sky-950/70 hover:bg-sky-900 border-sky-700 hover:border-sky-600 transition-all cursor-pointer shadow-xs"
                  title={`Mở trực tiếp Cổng tra cứu VNPT (${effectiveInvoice?.nbmst || ''}) trên tab mới và tự gán mã tra cứu vào ô tìm kiếm (chỉ cần gõ Captcha)`}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                  <span>Tra link gốc</span>
                </button>

              </div>
            ) : isViettelInvoice ? (
              <div className="inline-flex items-center gap-1.5 flex-wrap">
                {/* 1. Nút Xem PDF gốc Viettel */}
                <button
                  type="button"
                  onClick={handleViewOriginalViettel}
                  disabled={isLoadingViettelOriginal}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-xs disabled:opacity-60 ${
                    originalViettelPdfUrl
                      ? 'text-rose-200 bg-rose-950 border-rose-500 ring-1 ring-rose-500/40'
                      : 'text-rose-300 bg-rose-950/70 hover:bg-rose-900 border-rose-700'
                  }`}
                  title={`Tải và xem trực tiếp bản PDF gốc ký số từ Viettel (Mã bí mật: ${lookupDetails.lookupCode || ''})`}
                >
                  {isLoadingViettelOriginal ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>{isLoadingViettelOriginal ? 'Đang mở HĐ gốc...' : originalViettelPdfUrl ? 'Đang xem PDF gốc Viettel' : 'Xem PDF gốc Viettel'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadViettelPdf}
                  disabled={isDownloadingViettelPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-rose-300 bg-rose-950/70 hover:bg-rose-900 border-rose-700 hover:border-rose-600 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                  title="Tải trực tiếp file PDF hóa đơn gốc đã ký số từ máy chủ Viettel (1-click tải)"
                >
                  {isDownloadingViettelPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>{isDownloadingViettelPdf ? 'Đang tải PDF...' : 'Tải PDF gốc Viettel'}</span>
                </button>

              </div>
            ) : isVietcombankInvoice ? (
              <div className="inline-flex items-center gap-1.5">
                <a
                  href="https://einvoice.vietcombank.com.vn/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border-emerald-600 hover:border-emerald-500 ring-1 ring-emerald-500/30 transition-all cursor-pointer shadow-xs"
                  title="Mở tra cứu hóa đơn điện tử Vietcombank (einvoice.vietcombank.com.vn)"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cổng Vietcombank</span>
                </a>
                {directLookupUrl && !directLookupUrl.includes('vietcombank.com.vn') && (
                  <a
                    href={directLookupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border text-indigo-300 bg-indigo-950/70 hover:bg-indigo-900 border-indigo-600 hover:border-indigo-500 ring-1 ring-indigo-500/30 transition-all cursor-pointer shadow-xs"
                    title={`Tra cứu hóa đơn Cổng VNPAY Invoice (Tự động điền MST ${effectiveInvoice?.nbmst || ''} & Mã tra cứu ${lookupDetails.lookupCode || ''})`}
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Cổng VNPAY</span>
                  </a>
                )}
              </div>
            ) : (directLookupUrl && (!isVnpayInvoice || Boolean(lookupDetails.lookupCode))) ? (
              <a
                href={directLookupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border transition-all cursor-pointer shadow-xs ${
                  isMisaInvoice
                    ? 'text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border-emerald-600 hover:border-emerald-500 ring-1 ring-emerald-500/30'
                    : isVnpayInvoice
                    ? 'text-indigo-300 bg-indigo-950/70 hover:bg-indigo-900 border-indigo-600 hover:border-indigo-500 ring-1 ring-indigo-500/30'
                    : 'text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-700'
                }`}
                title={isMisaInvoice 
                  ? `Tải hóa đơn gốc từ Cổng MISA meInvoice (Mã tra cứu: ${lookupDetails.lookupCode || ''})` 
                  : isVnpayInvoice
                  ? `Tra cứu hóa đơn Cổng VNPAY Invoice (Tự động điền MST ${effectiveInvoice?.nbmst || ''} & Mã tra cứu ${lookupDetails.lookupCode || ''})`
                  : `Mở cổng tra cứu hóa đơn trực tiếp (${currentProviderMeta.name})`}
              >
                <ExternalLink className={`w-3.5 h-3.5 ${isMisaInvoice ? 'text-emerald-400' : isVnpayInvoice ? 'text-indigo-400' : 'text-cyan-400'}`} />
                <span>{isMisaInvoice ? 'Tải hóa đơn gốc' : isVnpayInvoice ? 'Tra cứu VNPAY' : 'Tra cứu Cổng NCC'}</span>
              </a>
            ) : null}

            {/* Generic fallback from CQT data; never use a supplier template here. */}
            <button
              type="button"
              onClick={handleDownloadPdfFile}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              title="Tạo bản thể hiện dự phòng từ dữ liệu Cổng Thuế"
            >
              <Download className="h-3.5 w-3.5" />
              {isExportingPdf ? 'Đang tạo PDF...' : 'Tải bản thể hiện dự phòng GDT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
