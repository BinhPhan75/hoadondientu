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
  getProviderMeta, 
  extractLookupDetails, 
  InvoiceProviderId, 
  ProviderMeta 
} from '../utils/multiTemplateRenderer';
import { buildDirectLookupUrl, openVnptDirectPortal } from '../templates/templateUtils';
import {
  easyInvoiceLookupPortals,
  easyInvoiceLookupUrl,
  isSaigonCoopPortalUrl,
  lookupPortalForSeller,
  rememberThaiSonPortalForSeller
} from '../utils/providerIdentity';
import { ensureInvoiceItems, hasGenuineItems, extractTagValue, parseGDTInvoiceXml } from '../utils/xmlParser';
import { resolveInvoiceProvider } from '../utils/providerRouting';
import { loadOriginalInvoice } from '../services/originalInvoiceLoader';
import { fetchVisnamCaptcha, fetchVisnamInvoicePdf } from '../services/visnamClient';
import { fetchSaigonCoopCaptcha, submitSaigonCoopLookup } from '../services/saigonCoopClient';
import { VisnamCaptchaModal } from './VisnamCaptchaModal';
import { SaigonCoopCaptchaModal } from './SaigonCoopCaptchaModal';
import { prepareEasyInvoiceHtml } from '../utils/easyInvoicePrint';
import { useNotification } from '../context/NotificationContext';

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
  if (!html) return html;

  // Gỡ bỏ inline height và overflow:hidden trên thẻ .VATTEMP hoặc container
  let processedHtml = html
    .replace(/<div([^>]*class=["'][^"']*(?:VATTEMP|invtable|invoice-content|content)[^"']*["'][^>]*)style=["']([^"']*)["']/gi, (match, p1, style) => {
      const cleanStyle = style
        .replace(/(?:max-)?height\s*:\s*[^;]+;?/gi, 'height: auto !important;')
        .replace(/overflow\s*:\s*[^;]+;?/gi, 'overflow: visible !important;');
      return `<div${p1}style="${cleanStyle}"`;
    });

  if (/id=["']gdt-original-page-style["']/i.test(processedHtml)) return processedHtml;
  const style = `<style id="gdt-original-page-style">
    @page { size: A4 portrait; margin: 8mm 6mm; }
    html, body { 
      margin: 0 !important; 
      padding: 0 !important; 
      background: #fff !important; 
      height: auto !important; 
      overflow: visible !important; 
    }
    .VATTEMP, .VATTEMP .content, .VATTEMP #main-content, .VATTEMP .invtable, .VATTEMP .invtable-content,
    .main-page, .invoice-container, .invoice-content, .invoice-body, #invoice, #invoiceContent,
    .table-invoice, .tbl-custom, .inv-table, .container, #container, .panel-body {
      height: auto !important; 
      min-height: 0 !important; 
      max-height: none !important; 
      overflow: visible !important; 
      position: relative !important;
    }
    table, .invtable, .table-invoice, .res-tb { 
      width: 100% !important; 
      max-width: 100%; 
      page-break-inside: auto !important; 
      break-inside: auto !important; 
    }
    thead, .invtable thead { display: table-header-group !important; }
    tfoot, .invtable tfoot { display: table-footer-group !important; }
    tr, .invtable tr, .prds tr, .data, img, .invoice-row, .invoice-item { 
      break-inside: avoid !important; 
      page-break-inside: avoid !important; 
    }
    .page-break, .pageBreak, .invoice-page { break-after: page; page-break-after: always; }
    .ft-sign, #footer, .footer, .sign-dx, .nextpage { 
      break-inside: avoid !important; 
      page-break-inside: avoid !important; 
    }
    @media print { 
      body { background: #fff !important; } 
      .print-actions, #inbt { display: none !important; }
    }
  </style>`;
  if (/<\/head>/i.test(processedHtml)) return processedHtml.replace(/<\/head>/i, `${style}</head>`);
  return `${style}${processedHtml}`;
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
  const { toast, showAlert } = useNotification();
  const [currentInvoice, setCurrentInvoice] = useState<GDTInvoice | null>(invoice);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  // Theo dõi hóa đơn đang thực sự được mở để bỏ qua kết quả tải chi tiết trả
  // về SAU KHI người dùng đã đóng modal hoặc chuyển sang xem hóa đơn khác -
  // tránh việc áp dữ liệu cũ/không khớp vào state và làm crash giao diện.
  const openInvoiceIdRef = useRef<string | null>(invoice?.id ?? null);
  const originalLoadSequence = useRef(0);
  // Avoid duplicate downloads if the invoice detail re-renders or is refreshed.
  const minvoiceDownloadedRef = useRef<Set<string>>(new Set());
  openInvoiceIdRef.current = invoice?.id ?? null;

  useEffect(() => { setCurrentInvoice(invoice); }, [invoice]);

  useEffect(() => {
    originalLoadSequence.current++;
    setCurrentInvoice(invoice);
    setOriginalLoadError(null);
    setIsDownloadingEasyInvoice(false);
    setOriginalEasyInvoiceHtml(null);
    setMisaPortalUrl(null);
    setOriginalProviderZipUrl(null);
    setIsVisnamCaptchaOpen(false);
    setVisnamCaptcha(null);
    setVisnamCaptchaCode('');
    setVisnamCaptchaError(null);
    setIsLoadingVisnamCaptcha(false);
    setIsSubmittingVisnamCaptcha(false);
    setIsSaigonCoopCaptchaOpen(false);
    setSaigonCoopCaptcha(null);
    setSaigonCoopCaptchaError(null);
    setIsLoadingSaigonCoopCaptcha(false);
    setIsSubmittingSaigonCoopCaptcha(false);
    if (originalProviderPdfUrl) {
      window.URL.revokeObjectURL(originalProviderPdfUrl);
      setOriginalProviderPdfUrl(null);
    }
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
  }, [invoice?.id]);

  const effectiveInvoice = invoice
    ? (currentInvoice && currentInvoice.id === invoice.id ? currentInvoice : invoice)
    : null;

  const [originalEasyInvoiceHtml, setOriginalEasyInvoiceHtml] = useState<string | null>(null);
  const [easyInvoiceViewMode, setEasyInvoiceViewMode] = useState<'pdf' | 'html'>('html');
  const [misaPortalUrl, setMisaPortalUrl] = useState<string | null>(null);
  const [originalProviderPdfUrl, setOriginalProviderPdfUrl] = useState<string | null>(null);
  const [originalProviderZipUrl, setOriginalProviderZipUrl] = useState<string | null>(null);
  const [isDownloadingEasyInvoice, setIsDownloadingEasyInvoice] = useState(false);
  const [isVisnamCaptchaOpen, setIsVisnamCaptchaOpen] = useState(false);
  const [visnamCaptcha, setVisnamCaptcha] = useState<{ key: string; image: string } | null>(null);
  const [visnamCaptchaCode, setVisnamCaptchaCode] = useState('');
  const [isLoadingVisnamCaptcha, setIsLoadingVisnamCaptcha] = useState(false);
  const [isSubmittingVisnamCaptcha, setIsSubmittingVisnamCaptcha] = useState(false);
  const [visnamCaptchaError, setVisnamCaptchaError] = useState<string | null>(null);
  const [isSaigonCoopCaptchaOpen, setIsSaigonCoopCaptchaOpen] = useState(false);
  const [isThaiSonSharedCaptcha, setIsThaiSonSharedCaptcha] = useState(false);
  const [saigonCoopCaptcha, setSaigonCoopCaptcha] = useState<{ state: string; image: string } | null>(null);
  const [saigonCoopCaptchaError, setSaigonCoopCaptchaError] = useState<string | null>(null);
  const [isLoadingSaigonCoopCaptcha, setIsLoadingSaigonCoopCaptcha] = useState(false);
  const [isSubmittingSaigonCoopCaptcha, setIsSubmittingSaigonCoopCaptcha] = useState(false);
  const [thaiSonPortalRevision, setThaiSonPortalRevision] = useState(0);
  const [easyInvoiceDownloadStatus, setEasyInvoiceDownloadStatus] = useState<string | null>(null);
  const [originalLoadError, setOriginalLoadError] = useState<string | null>(null);
  useEffect(() => () => {
    if (originalProviderPdfUrl) URL.revokeObjectURL(originalProviderPdfUrl);
  }, [originalProviderPdfUrl]);
  useEffect(() => () => {
    if (originalProviderZipUrl) URL.revokeObjectURL(originalProviderZipUrl);
  }, [originalProviderZipUrl]);
  useEffect(() => () => {
    openInvoiceIdRef.current = null;
    originalLoadSequence.current++;
  }, []);
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
    if (!force && targetInv.sourceCompleteness === 'detail' && hasGenuineItems(targetInv.items) && targetInv.rawXml) {
      return targetInv;
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
        return null;
      }
      if (data.success && data.invoice) {
        const enriched = data.invoice as GDTInvoice;
        const merged = { ...targetInv, ...enriched, rawXml: enriched.rawXml || targetInv.rawXml };
        setCurrentInvoice(merged);
        onUpdateInvoice?.(merged);
        return merged;
      } else {
        setDetailError(data.message || 'Cổng Thuế chưa phản hồi chi tiết mặt hàng.');
        return null;
      }
    } catch (err: any) {
      if (openInvoiceIdRef.current !== targetInv.id) return null;
      setDetailError(err.message || 'Lỗi mạng khi kết nối tải chi tiết.');
      return null;
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
    if (!effectiveInvoice || isExportingPdf) return;
    setIsExportingPdf(true);
    toast.info('Đang xử lý hóa đơn...', 'Thông Báo');
    try {
      // The fallback must never auto-select a supplier template. Supplier
      // templates are only used for genuine provider originals above.
      const success = await exportInvoiceToPdfFile(effectiveInvoice, null, undefined, 'red', 'DEFAULT');
      if (success) {
        toast.success('Đã tải PDF Tổng cục thuế thành công!');
      }
    } catch (err: any) {
      toast.error(`Không thể tạo bản PDF Tổng cục thuế: ${err?.message || String(err)}`);
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

  const handleViewOriginalEasyInvoice = async (silent = false) => {
    if (!effectiveInvoice) return;
    const lookupCode = lookupDetails.lookupCode || effectiveInvoice.lookupCode || effectiveInvoice.mhdon;
    if (!lookupCode) {
      if (!silent) alert('Hóa đơn này không có mã tra cứu (FKey) để tải từ cổng EasyInvoice.');
      return;
    }

    setIsDownloadingEasyInvoice(true);
    setEasyInvoiceDownloadStatus('Đang kết nối Cổng EasyInvoice & xử lý dữ liệu...');
    setOriginalLoadError(null);
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

      if (data.htmlContent) {
        const prepared = prepareEasyInvoiceHtml(data.htmlContent);
        setOriginalEasyInvoiceHtml(prepared);
        setEasyInvoiceViewMode('html');
      }

      if (data.pdfBase64) {
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.contentType || 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        setOriginalProviderPdfUrl(blobUrl);
      }

      setEasyInvoiceDownloadStatus('Đã nạp bản thể hiện EasyInvoice thành công!');
      setTimeout(() => setEasyInvoiceDownloadStatus(null), 3000);
    } catch (err: any) {
      console.warn('[InvoiceDetailModal] Thử nạp qua luồng dự phòng:', err.message);
      try {
        await handleViewOriginalProvider();
      } catch (fallbackErr: any) {
        if (!silent) {
          setOriginalLoadError(`Không thể tự động tải hóa đơn từ Cổng EasyInvoice: ${err.message || fallbackErr.message}`);
        }
      }
    } finally {
      setIsDownloadingEasyInvoice(false);
    }
  };

  const handlePrintHtml = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch (err) {
        console.warn('Không thể in trực tiếp qua iframe, dùng cửa sổ in dự phòng:', err);
      }
    }
    const htmlToPrint = originalEasyInvoiceHtml || originalVnptHtml;
    if (htmlToPrint) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(prepareOriginalInvoiceHtml(htmlToPrint));
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 400);
      }
    }
  };

  const refreshVisnamCaptcha = async (targetId: string, sequence: number) => {
    setIsLoadingVisnamCaptcha(true);
    setVisnamCaptchaError(null);
    try {
      const captcha = await fetchVisnamCaptcha();
      if (openInvoiceIdRef.current !== targetId || originalLoadSequence.current !== sequence) return;
      setVisnamCaptcha(captcha);
      setVisnamCaptchaCode('');
    } catch (error) {
      if (openInvoiceIdRef.current === targetId && originalLoadSequence.current === sequence) {
        setVisnamCaptcha(null);
        setVisnamCaptchaError(error instanceof Error ? error.message : 'Không lấy được CAPTCHA VIN-HOADON.');
      }
    } finally {
      if (openInvoiceIdRef.current === targetId && originalLoadSequence.current === sequence) {
        setIsLoadingVisnamCaptcha(false);
      }
    }
  };

  const handleVisnamDirectLookup = async () => {
    if (!effectiveInvoice) return;
    const target = effectiveInvoice;
    const code = String(extractLookupDetails(target.rawXml).lookupCode || target.lookupCode || '').trim();
    if (!code) {
      await showAlert({
        title: 'Thiếu mã tra cứu VIN-HOADON',
        message: 'Không tìm thấy mã số bí mật trong XML hóa đơn. Vui lòng kiểm tra dữ liệu hóa đơn.',
        type: 'warning', confirmText: 'OK'
      });
      return;
    }
    const sequence = ++originalLoadSequence.current;
    setVisnamCaptcha(null);
    setVisnamCaptchaCode('');
    setVisnamCaptchaError(null);
    setIsVisnamCaptchaOpen(true);
    await refreshVisnamCaptcha(target.id, sequence);
  };

  const handleVisnamCaptchaSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!effectiveInvoice || !visnamCaptcha || !visnamCaptchaCode.trim()) return;
    const target = effectiveInvoice;
    const sequence = originalLoadSequence.current;
    const lookupCode = String(extractLookupDetails(target.rawXml).lookupCode || target.lookupCode || '').trim();
    if (!lookupCode) {
      setVisnamCaptchaError('Không tìm thấy mã số bí mật trong XML hóa đơn.');
      return;
    }

    setIsSubmittingVisnamCaptcha(true);
    setIsDownloadingEasyInvoice(true);
    setOriginalLoadError(null);
    setEasyInvoiceDownloadStatus('Đang xác minh CAPTCHA và tải PDF gốc VIN-HOADON...');
    try {
      const result = await fetchVisnamInvoicePdf({
        key: visnamCaptcha.key,
        captcha: visnamCaptchaCode,
        lookupCode,
        identity: {
          sellerTaxCode: String(target.nbmst || extractTagValue(target.rawXml || '', 'MST') || '').trim(),
          invoiceSeries: String(target.khhdon || extractTagValue(target.rawXml || '', 'KHHDon') || '').trim(),
          invoiceNo: String(target.shdon || extractTagValue(target.rawXml || '', 'SHDon') || '').trim(),
        }
      });
      if (openInvoiceIdRef.current !== target.id || originalLoadSequence.current !== sequence) return;

      const url = URL.createObjectURL(result.blob);
      setOriginalProviderPdfUrl(url);
      setIsVisnamCaptchaOpen(false);
      setVisnamCaptcha(null);
      setVisnamCaptchaCode('');
      setVisnamCaptchaError(null);
      setEasyInvoiceDownloadStatus('Đã tải và xác minh PDF gốc VIN-HOADON.');

      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = result.filename;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      try {
        downloadLink.click();
      } finally {
        downloadLink.remove();
      }
    } catch (error) {
      if (openInvoiceIdRef.current === target.id && originalLoadSequence.current === sequence) {
        setVisnamCaptcha(null);
        setVisnamCaptchaCode('');
        setVisnamCaptchaError(error instanceof Error ? error.message : 'Không tải được PDF VIN-HOADON.');
      }
    } finally {
      if (openInvoiceIdRef.current === target.id && originalLoadSequence.current === sequence) {
        setIsSubmittingVisnamCaptcha(false);
        setIsDownloadingEasyInvoice(false);
      }
    }
  };

  const closeVisnamCaptcha = () => {
    originalLoadSequence.current++;
    setIsVisnamCaptchaOpen(false);
    setVisnamCaptcha(null);
    setVisnamCaptchaCode('');
    setVisnamCaptchaError(null);
    setIsLoadingVisnamCaptcha(false);
    setIsSubmittingVisnamCaptcha(false);
  };

  const saigonCoopLookupCode = (target: GDTInvoice) =>
    String(extractLookupDetails(target.rawXml).lookupCode || target.lookupCode || '').trim();

  const handleSaigonCoopCaptchaOpen = async (sharedThaiSon = false) => {
    if (!effectiveInvoice) return;
    const target = effectiveInvoice;
    const lookupCode = saigonCoopLookupCode(target);
    if (!lookupCode) {
      setOriginalLoadError('Không tìm thấy mã nhận hóa đơn trong XML.');
      return;
    }

    const sequence = ++originalLoadSequence.current;
    setOriginalLoadError(null);
    setOriginalEasyInvoiceHtml(null);
    setSaigonCoopCaptchaError(null);
    setSaigonCoopCaptcha(null);
    setIsSaigonCoopCaptchaOpen(true);
    setIsLoadingSaigonCoopCaptcha(true);
    try {
      const challenge = await fetchSaigonCoopCaptcha(lookupCode, sharedThaiSon);
      if (openInvoiceIdRef.current !== target.id || originalLoadSequence.current !== sequence) return;
      setSaigonCoopCaptcha(challenge);
    } catch (error) {
      if (openInvoiceIdRef.current === target.id && originalLoadSequence.current === sequence) {
        setSaigonCoopCaptchaError(error instanceof Error ? error.message : 'Không tải được CAPTCHA Saigon Co.op.');
      }
    } finally {
      if (openInvoiceIdRef.current === target.id && originalLoadSequence.current === sequence) {
        setIsLoadingSaigonCoopCaptcha(false);
      }
    }
  };

  const handleSaigonCoopCaptchaSubmit = async (captcha: string) => {
    if (!effectiveInvoice || !saigonCoopCaptcha || !captcha.trim()) return;
    const target = effectiveInvoice;
    const sequence = originalLoadSequence.current;
    const lookupCode = saigonCoopLookupCode(target);
    setSaigonCoopCaptchaError(null);
    setIsSubmittingSaigonCoopCaptcha(true);
    setIsDownloadingEasyInvoice(true);
    setEasyInvoiceDownloadStatus('Đang tra cứu hóa đơn Saigon Co.op...');
    try {
      const result = await submitSaigonCoopLookup({
        state: saigonCoopCaptcha.state,
        lookupCode,
        captcha,
        sellerTaxCode: String(target.nbmst || extractTagValue(target.rawXml || '', 'MST') || '').trim(),
        invoiceNo: String(target.shdon || extractTagValue(target.rawXml || '', 'SHDon') || '').trim(),
        invoiceSeries: String(target.khhdon || extractTagValue(target.rawXml || '', 'KHHDon') || '').trim(),
        sharedThaiSon: isThaiSonSharedCaptcha,
      });
      if (openInvoiceIdRef.current !== target.id || originalLoadSequence.current !== sequence) return;

      if (result.kind === 'html') {
        if (isThaiSonSharedCaptcha && /phan mem hoa don dien tu e-invoice|chuyen gia hoa don dien tu|dich vu truyen nhan va luu tru/i.test(
          result.html.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        )) {
          throw new Error('Cổng Thái Sơn trả trang giới thiệu thay vì bản hóa đơn MARU. Không thể xem hay lưu HTML này như hóa đơn gốc.');
        }
        setOriginalEasyInvoiceHtml(result.html);
        setEasyInvoiceViewMode('html');
      } else {
        setOriginalProviderPdfUrl(URL.createObjectURL(result.blob));
      }
      setIsSaigonCoopCaptchaOpen(false);
      setSaigonCoopCaptcha(null);
      setOriginalLoadError(null);
      setEasyInvoiceDownloadStatus(isThaiSonSharedCaptcha ? 'Đã xác minh hóa đơn Thái Sơn.' : 'Đã xác minh hóa đơn Saigon Co.op với dữ liệu XML.');
    } catch (error) {
      if (openInvoiceIdRef.current === target.id && originalLoadSequence.current === sequence) {
        if (isThaiSonSharedCaptcha) {
          // The common E-Invoice portal may require a browser-only JavaScript
          // search. Offer the verified official portal instead of asking for
          // repeated CAPTCHA attempts or uploading files manually.
          const code = String(extractLookupDetails(target.rawXml).lookupCode || target.lookupCode || lookupCode).trim();
          setIsSaigonCoopCaptchaOpen(false);
          setSaigonCoopCaptcha(null);
          setSaigonCoopCaptchaError(null);
          setOriginalLoadError(null);
          setIsSubmittingSaigonCoopCaptcha(false);
          setIsDownloadingEasyInvoice(false);
          let copied = false;
          try {
            await navigator.clipboard.writeText(code);
            copied = true;
          } catch {
            // Clipboard access may require a direct button click.
          }
          if (openInvoiceIdRef.current === target.id && originalLoadSequence.current === sequence) {
            await showAlert({
              title: copied ? 'Đã copy mã tra cứu Thái Sơn' : 'Tra cứu trực tiếp Thái Sơn',
              message: (copied
                ? 'Đã sao chép mã nhận hóa đơn. Bấm Xác nhận để mở cổng Thái Sơn, nhấn Ctrl + V vào ô Mã nhận hóa đơn, nhập CAPTCHA trên website rồi tải PDF/XML gốc.'
                : 'Chưa thể tự sao chép mã. Bấm Xác nhận để thử sao chép và mở cổng Thái Sơn, sau đó nhấn Ctrl + V vào ô Mã nhận hóa đơn, nhập CAPTCHA trên website rồi tải PDF/XML gốc.') +
                ' Mã nhận hóa đơn: ' + code,
              type: copied ? 'success' : 'warning',
              confirmText: 'Xác nhận - Mở cổng Thái Sơn',
              onConfirm: () => {
                // Retry copy within a user gesture when browser permissions
                // do not allow background clipboard writes.
                void navigator.clipboard.writeText(code).catch(() => {});
                window.open('https://einvoice.vn/tra-cuu', '_blank', 'noopener,noreferrer');
              },
            });
          }
        } else {
          setSaigonCoopCaptchaError(error instanceof Error ? error.message : 'Không tra cứu được hóa đơn Saigon Co.op.');
        }
      }
    } finally {
      if (openInvoiceIdRef.current === target.id && originalLoadSequence.current === sequence) {
        setIsSubmittingSaigonCoopCaptcha(false);
        setIsDownloadingEasyInvoice(false);
      }
    }
  };

  const closeSaigonCoopCaptcha = () => {
    originalLoadSequence.current++;
    setIsSaigonCoopCaptchaOpen(false);
    setSaigonCoopCaptcha(null);
    setSaigonCoopCaptchaError(null);
    setIsLoadingSaigonCoopCaptcha(false);
    setIsSubmittingSaigonCoopCaptcha(false);
  };

  const handleWinInvoiceLookup = async () => {
    if (!effectiveInvoice) return;
    const xml = String(effectiveInvoice.rawXml || '');
    const code = extractLookupDetails(xml).lookupCode;
    const companyBlock = xml.match(/<TTin\b[^>]*\bId=["']cmpnKey["'][^>]*>([\s\S]*?)<\/TTin>/i);
    const company = companyBlock ? extractTagValue(companyBlock[1], 'DLieu').trim() : '';
    if (!code || !/^\d{10}(?:-\d{3})?$/.test(company)) {
      await showAlert({
        title: 'Thiếu thông tin WINinvoice',
        message: 'Không tìm thấy privateCode hoặc cmpnKey hợp lệ trong XML hóa đơn.',
        type: 'warning', confirmText: 'OK',
      });
      return;
    }
    let copied = false;
    try { await navigator.clipboard.writeText(code); copied = true; } catch {}
    await showAlert({
      title: copied ? 'Đã copy mã tra cứu WINinvoice' : 'Tra cứu trực tiếp WINinvoice',
      message: copied
        ? 'Đã sao chép mã tra cứu. Dán Ctrl + V vào ô Mã tra cứu, nhập Mã công ty: ' + company + '. Bấm OK để mở https://tracuu.wininvoice.vn/ và tải hóa đơn gốc.'
        : 'Nhập Mã tra cứu: ' + code + ' và Mã công ty: ' + company + ' tại https://tracuu.wininvoice.vn/ để tải hóa đơn gốc.',
      type: copied ? 'success' : 'warning',
      confirmText: 'OK - Mở trang tra cứu',
      onConfirm: () => { window.open('https://tracuu.wininvoice.vn/', '_blank', 'noopener,noreferrer'); },
    });
  };

  const handleViewOriginalProvider = async () => {
    if (!effectiveInvoice) return;
    let target = effectiveInvoice;
    const actualProvider = resolveInvoiceProvider(target);
    // Some tax-authority list records have invoice items but no original XML.
    // WINinvoice needs signed XML for privateCode/cmpnKey; request it first.
    if ((actualProvider === 'WININVOICE' || actualProvider === 'THAISON') && !target.rawXml) {
      const refreshed = await loadInvoiceDetail(target, true);
      if (openInvoiceIdRef.current !== target.id) return;
      if (!refreshed?.rawXml) {
        setOriginalLoadError(actualProvider === 'WININVOICE'
          ? 'Hóa đơn WINinvoice chưa có XML gốc chứa privateCode và cmpnKey. ' +
            'Cổng Thuế chưa cung cấp XML chi tiết; vui lòng nhập XML gốc hoặc tra cứu tại https://tracuu.wininvoice.vn/.'
          : 'Chưa nhận được XML chi tiết Thái Sơn từ Cơ quan Thuế để lấy Mã TC và DC TC. ' +
            'Vui lòng nhập XML gốc vào phần mềm để tải hóa đơn từ cổng nhà cung cấp.');
        return;
      }
      target = refreshed;
    }
    const extractedLookup = extractLookupDetails(target.rawXml);
    const sellerPortal = lookupPortalForSeller(target.nbmst);
    const recordedPortal = extractedLookup.lookupUrl || target.lookupUrl || '';
    // Prefer the explicit XML portal (including the shared lookup page);
    // learned seller-specific portals are only a fallback.
    const tenantUrl = recordedPortal || sellerPortal || '';
    const isSeparatePortal = actualProvider === 'IHOADON';
    // AEON Viet Nam uses a Thai Son customer portal, not einvoice.vn.
    // The signed XML carries its "Mã TC" field without a lookup URL.
    if (actualProvider === 'THAISON' &&
        /^https:\/\/hddt\.aeon\.com\.vn\/?$/i.test(tenantUrl)) {
      const code = String(extractedLookup.lookupCode || '').trim();
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(code)) {
        await showAlert({
          title: 'Thiếu mã tra cứu AEON',
          message: 'XML không có mã tra cứu AEON hợp lệ. Vui lòng kiểm tra XML hóa đơn.',
          type: 'warning',
          confirmText: 'Đóng',
        });
        return;
      }
      let copied = false;
      try {
        await navigator.clipboard.writeText(code);
        copied = true;
      } catch {
        // Show the code for manual entry when clipboard access is denied.
      }
      if (openInvoiceIdRef.current !== target.id) return;
      await showAlert({
        title: copied ? 'Đã copy mã tra cứu AEON' : 'Tra cứu hóa đơn AEON',
        message: copied
          ? 'Đã sao chép mã tra cứu. Bấm Xác nhận để mở cổng AEON, chọn chi nhánh phù hợp, nhấn Ctrl + V vào ô Mã tra cứu hóa đơn và thực hiện các bước kiểm tra trên website để tải hóa đơn gốc.'
          : 'Chưa thể sao chép tự động. Mã tra cứu: ' + code +
            '. Bấm Xác nhận để mở cổng AEON, chọn chi nhánh rồi dán bằng Ctrl + V hoặc nhập mã trực tiếp.',
        type: copied ? 'success' : 'warning',
        confirmText: 'Xác nhận - Mở cổng AEON',
        onConfirm: () => {
          void navigator.clipboard.writeText(code).catch(() => {});
          window.open('https://hddt.aeon.com.vn/', '_blank', 'noopener,noreferrer');
        },
      });
      return;
    }
    // Thai Son tenant portals explicitly recorded in the issuer XML.
    // Copy the receipt code and let the user search on the actual provider site.
    // Keep all other Saigon Co.op branches on their existing in-app workflow.
    const thaiSonTenant = actualProvider === 'THAISON' ? (
      /^https:\/\/einvoice\.vifb\.vn\/?$/i.test(tenantUrl) &&
      /^0312065210-011$/.test(String(target.nbmst || ''))
        ? { name: 'Ý Tưởng Việt (VIFB)', url: 'https://einvoice.vifb.vn/' }
        : /^https:\/\/saigoncoop\.einvoice\.com\.vn\/?$/i.test(tenantUrl) &&
          /^0301175691-021$/.test(String(target.nbmst || ''))
          ? { name: 'Co.opmart Quảng Bình', url: 'https://saigoncoop.einvoice.com.vn/' }
          : null
    ) : null;
    if (thaiSonTenant) {
      const code = String(extractedLookup.lookupCode || target.lookupCode || '').trim();
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(code)) {
        await showAlert({
          title: 'Thiếu mã tra cứu ' + thaiSonTenant.name,
          message: 'Không tìm thấy mã tra cứu hợp lệ trong XML hóa đơn.',
          type: 'warning',
          confirmText: 'Đóng',
        });
        return;
      }
      let copied = false;
      try {
        await navigator.clipboard.writeText(code);
        copied = true;
      } catch {
        // If denied, show the code and retry from the confirmation click.
      }
      if (openInvoiceIdRef.current !== target.id) return;
      await showAlert({
        title: copied ? 'Đã copy mã tra cứu ' + thaiSonTenant.name : 'Tra cứu hóa đơn ' + thaiSonTenant.name,
        message: copied
          ? 'Đã sao chép mã tra cứu. Bấm Xác nhận để mở đúng cổng nhà cung cấp, nhấn Ctrl + V vào ô mã tra cứu và nhập CAPTCHA trên website (nếu được yêu cầu) để tải hóa đơn gốc.'
          : 'Trình duyệt chưa cho phép sao chép tự động. Mã tra cứu: ' + code +
            '. Bấm Xác nhận để mở cổng nhà cung cấp, dán bằng Ctrl + V hoặc nhập mã trực tiếp.',
        type: copied ? 'success' : 'warning',
        confirmText: 'Xác nhận - Mở cổng ' + thaiSonTenant.name,
        onConfirm: () => {
          void navigator.clipboard.writeText(code).catch(() => {});
          window.open(thaiSonTenant.url, '_blank', 'noopener,noreferrer');
        },
      });
      return;
    }
    // Central Retail uses its own Thai Son customer lookup website.
    // The receipt code [MaTC] is embedded in the signed invoice XML.
    if (actualProvider === 'THAISON' &&
        /^https:\/\/hddt\.centralretail\.com\.vn\/vi-vn\/tra-cuu-hoa-don-dien-tu\/?$/i.test(tenantUrl)) {
      const code = String(extractedLookup.lookupCode || '').trim();
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(code)) {
        await showAlert({
          title: 'Thiếu mã tra cứu Central Retail',
          message: 'Không tìm thấy mã MaTC hợp lệ trong XML hóa đơn Thái Sơn của Central Retail.',
          type: 'warning', confirmText: 'Đóng',
        });
        return;
      }
      let copied = false;
      try { await navigator.clipboard.writeText(code); copied = true; } catch {
        // Show the code explicitly if clipboard access is unavailable.
      }
      if (openInvoiceIdRef.current !== target.id) return;
      await showAlert({
        title: copied ? 'Đã copy mã tra cứu Central Retail' : 'Tra cứu hóa đơn Central Retail',
        message: copied
          ? 'Đã sao chép mã tra cứu. Bấm Xác nhận để mở cổng Central Retail, nhấn Ctrl + V vào ô mã tra cứu rồi thực hiện các bước trên website để xem hoặc tải hóa đơn gốc.'
          : 'Trình duyệt chưa cho phép sao chép. Mã tra cứu: ' + code +
            '. Bấm Xác nhận để mở cổng Central Retail và dán bằng Ctrl + V hoặc nhập mã trực tiếp.',
        type: copied ? 'success' : 'warning',
        confirmText: 'Xác nhận - Mở Central Retail',
        onConfirm: () => {
          void navigator.clipboard.writeText(code).catch(() => {});
          window.open('https://hddt.centralretail.com.vn/vi-vn/tra-cuu-hoa-don-dien-tu', '_blank', 'noopener,noreferrer');
        },
      });
      return;
    }
    if (actualProvider === 'THAISON' && /^https?:\/\/(?:www\.)?einvoice\.vn(?:\/|$)/i.test(tenantUrl)) {
      // Shared Thai Son portal: lookup is performed in the issuer's own
      // browser page. Do not open the in-app CAPTCHA workflow.
      const code = String(extractedLookup.lookupCode || target.lookupCode || '').trim();
      if (!code) {
        await showAlert({
          title: 'Thiếu mã tra cứu Thái Sơn',
          message: 'Không tìm thấy mã nhận hóa đơn trong XML. Vui lòng kiểm tra XML gốc.',
          type: 'warning',
          confirmText: 'Đóng',
        });
        return;
      }
      let copied = false;
      try {
        await navigator.clipboard.writeText(code);
        copied = true;
      } catch {
        // Clipboard writes may require a direct user gesture on confirmation.
      }
      if (openInvoiceIdRef.current !== target.id) return;
      await showAlert({
        title: copied ? 'Đã copy mã tra cứu Thái Sơn' : 'Mở cổng tra cứu Thái Sơn',
        message: copied
          ? 'Đã sao chép mã nhận hóa đơn. Bấm Xác nhận để mở trang Thái Sơn, nhấn Ctrl + V vào ô Mã nhận hóa đơn rồi nhập CAPTCHA trực tiếp để tải PDF/XML.'
          : 'Trình duyệt chưa cấp quyền sao chép mã. Bấm Xác nhận để thử sao chép lại và mở trang Thái Sơn. Mã nhận hóa đơn: ' + code + '. Dán bằng Ctrl + V hoặc nhập mã này, sau đó nhập CAPTCHA để tải PDF/XML.',
        type: copied ? 'success' : 'warning',
        confirmText: 'Xác nhận - Mở cổng Thái Sơn',
        onConfirm: () => {
          void navigator.clipboard.writeText(code).catch(() => {});
          window.open('https://einvoice.vn/tra-cuu', '_blank', 'noopener,noreferrer');
        },
      });
      return;
    }
    if (actualProvider === 'THAISON' && isSaigonCoopPortalUrl(tenantUrl)) {
      setIsThaiSonSharedCaptcha(false);
      void handleSaigonCoopCaptchaOpen();
      return;
    }
    // Open the actual issuer portal. No verified server-side PDF API exists
    // for every tenant; do not send these invoices to the generic Thai Son API.
    if (isSeparatePortal && /^https?:\/\//i.test(tenantUrl)) {
      window.open(
        buildDirectLookupUrl(tenantUrl, extractedLookup.lookupCode || target.lookupCode, actualProvider, target.nbmst),
        '_blank',
        'noopener,noreferrer'
      );
      return;
    }
    const sequence = ++originalLoadSequence.current;
    const isCurrent = () => openInvoiceIdRef.current === target.id && originalLoadSequence.current === sequence;
    setOriginalLoadError(null);
    setIsDownloadingEasyInvoice(true);
    setEasyInvoiceDownloadStatus('Đang tải dữ liệu và các dòng hàng hóa của hóa đơn...');
    try {
      const blob = await loadOriginalInvoice(target);
      if (!isCurrent()) return;
      if (actualProvider === 'MISA') setMisaPortalUrl(null);
      if (actualProvider === 'MINVOICE' && !blob.type.includes('application/pdf')) {
        throw new Error('M-invoice chỉ chấp nhận PDF gốc, không tải XML hoặc ZIP.');
      }
      if (blob.type.includes('text/html')) {
        if (actualProvider === 'THAISON') {
          throw new Error('Thái Sơn chưa trả PDF/ZIP gốc đã xác minh. Không hiển thị HTML website của nhà cung cấp.');
        }
        const html = prepareEasyInvoiceHtml(await blob.text());
        if (!isCurrent()) return;
        setOriginalEasyInvoiceHtml(html);
      } else if (blob.type.includes('application/zip')) {
        const url = window.URL.createObjectURL(blob);
        setOriginalProviderZipUrl(url);
        try {
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(blob);
          if (actualProvider === 'WININVOICE') {
            // Render the issuer PDF in the original ZIP while retaining the entire package.
            const series = String(target.khhdon || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const number = String(target.shdon || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
            const pdfFile = Object.values(zip.files).find(f => {
              if (f.dir || !/\.pdf$/i.test(f.name)) return false;
              const basename = f.name.split('/').pop() || '';
              const match = basename.match(/^([A-Za-z0-9]+)_(\d+).*\.pdf$/i);
              return !!match && match[1].toUpperCase() === series &&
                match[2].replace(/^0+(?=\d)/, '') === number;
            });
            if (pdfFile) {
              const pdfBytes = await pdfFile.async('uint8array');
              if (pdfBytes.length >= 100 && pdfBytes.length <= 18_000_000 &&
                  new TextDecoder('latin1').decode(pdfBytes.slice(0, 5)) === '%PDF-' && isCurrent()) {
                setOriginalProviderPdfUrl(URL.createObjectURL(
                  new Blob([pdfBytes], { type: 'application/pdf' })
                ));
              }
            }
          }
          const xmlFile = Object.values(zip.files).find(f => !f.dir && /\.xml$/i.test(f.name));
          if (xmlFile) {
            const xmlText = await xmlFile.async('string');
            if (xmlText && xmlText.includes('<HDon')) {
              const parsed = parseGDTInvoiceXml(xmlText);
              if (parsed && parsed.items && parsed.items.length > 0) {
                setCurrentInvoice(prev => prev && prev.id === target.id
                  ? ({ ...prev, ...parsed, id: prev.id, rawXml: xmlText, items: parsed.items })
                  : prev);
              }
            }
          }
        } catch (e) {
          console.warn('[InvoiceDetailModal] Error parsing XML from ZIP:', e);
        }
      } else {
        const url = window.URL.createObjectURL(blob);
        setOriginalProviderPdfUrl(url);
        // With M-invoice, looking up the invoice should also save the
        // verified issuer PDF to the user's Downloads folder. Browsers may
        // require permission for automatic downloads; retain the manual link.
        if (actualProvider === 'MINVOICE') {
          const saveKey = target.id + '|' + String(target.khhdon || '') + '|' +
            String(target.shdon || '') + '|' + String(target.nbmst || '');
          if (!minvoiceDownloadedRef.current.has(saveKey)) {
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            const series = String(target.khhdon || 'HD').replace(/[^A-Za-z0-9_-]/g, '');
            const number = String(target.shdon || '').replace(/[^0-9]/g, '').padStart(7, '0');
            downloadLink.download = 'HoaDon_MInvoice_' + series + '_' + number + '.pdf';
            downloadLink.style.display = 'none';
            document.body.appendChild(downloadLink);
            try {
              downloadLink.click();
              minvoiceDownloadedRef.current.add(saveKey);
            } finally {
              downloadLink.remove();
            }
          }
        }
      }
      setEasyInvoiceDownloadStatus(actualProvider === 'MINVOICE'
        ? 'Đã nhận PDF gốc M-invoice và gửi yêu cầu tải xuống máy. Nếu trình duyệt chặn tải tự động, dùng nút Tải PDF gốc đã lưu.'
        : 'Đã mở bản gốc lưu trên máy.');
    } catch (error: any) {
      if (!isCurrent()) return;
      const provider = resolveInvoiceProvider(target);
      const isMisaCloudDenied = provider === 'MISA' && /(?:HTTP\s*403|MISA.*403)/i.test(error?.message || '');
      setOriginalLoadError(isMisaCloudDenied
        ? 'Máy chủ ứng dụng nhận HTTP 403 từ MISA. Chưa thể kết luận mã tra cứu đúng hay sai. Hệ thống chưa tải được PDF gốc; có thể mở cổng MISA để tra cứu khi cần.'
        : (error.message || 'Không tải được hóa đơn gốc.'));
      setEasyInvoiceDownloadStatus(null);
    } finally {
      if (isCurrent()) setIsDownloadingEasyInvoice(false);
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

  // Background prefetch and the viewer share one cached/in-flight download.
  useEffect(() => {
    const provider = effectiveInvoice ? resolveInvoiceProvider(effectiveInvoice) : undefined;
    if (!effectiveInvoice || provider === 'MISA' || provider === 'MINVOICE' || provider === 'VISNAM' || provider === 'MATBAO' || provider === 'WININVOICE') return;
    if (provider === 'EASYINVOICE') {
      const code = effectiveInvoice.lookupCode || effectiveInvoice.mhdon;
      if (code) {
        void handleViewOriginalEasyInvoice(true);
      }
      return;
    }
    if (!effectiveInvoice?.rawXml) return;
    // No guessing of Thai Son seller portals; register a valid URL once if
    // neither the XML nor learned cache identifies the seller's portal.
    const xmlPortal = extractLookupDetails(effectiveInvoice.rawXml).lookupUrl || '';
    const knownPortal = lookupPortalForSeller(effectiveInvoice.nbmst) || '';
    const candidate = xmlPortal || knownPortal || effectiveInvoice.lookupUrl || '';
    // Shared Thai Son lookup may require CAPTCHA; run it on explicit user
    // action rather than consuming Gemini calls whenever the modal opens.
    if (provider === 'THAISON' && (!candidate ||
        /^https?:\/\/(?:www\.)?einvoice\.vn(?:\/|$)/i.test(candidate))) return;
    if (provider === 'THAISON' && isSaigonCoopPortalUrl(candidate)) return;
    // iHoaDon uses an independent provider workflow.
    // Thai Son tenant portals now use the original-document downloader.
    if (provider === 'IHOADON') return;
    void handleViewOriginalProvider();
  }, [effectiveInvoice?.id, effectiveInvoice?.rawXml, effectiveInvoice?.lookupCode, effectiveInvoice?.lookupUrl, effectiveInvoice?.provider, thaiSonPortalRevision]);

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
    const detectedProvider = (resolveInvoiceProvider(effectiveInvoice)?.replace(/^LCS$/, 'LCS_SOFT') || 'DEFAULT') as InvoiceProviderId;
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
    const sellerThaiSonPortal = lookupPortalForSeller(effectiveInvoice.nbmst);
    if (sellerThaiSonPortal && (!lookupDetails.lookupUrl ||
        /^https?:\/\/(?:www\.)?einvoice\.vn(?:\/|$)/i.test(lookupDetails.lookupUrl))) {
      lookupDetails.lookupUrl = sellerThaiSonPortal;
    }

    // Only solution metadata/portal evidence selects a provider, never the seller.
    if (autoDetectedProvider === 'VNPT' && !lookupDetails.lookupUrl) {
      const tax = String(effectiveInvoice.nbmst || '').replace(/[^0-9-]/g, '');
      if (tax) lookupDetails.lookupUrl = `https://${tax}-tt78.vnpt-invoice.com.vn`;
    }
    if (autoDetectedProvider === 'MISA') lookupDetails.lookupUrl = 'https://www.meinvoice.vn/tra-cuu';
    // Do not guess the issuer portal from the Thai Son software provider.
    // If the XML has no DCTC, use only an already learned URL for this seller.
    if (autoDetectedProvider === 'MINVOICE') lookupDetails.lookupUrl = 'https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don';

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

  const isThaiSonInvoice = autoDetectedProvider === 'THAISON';
  // The official shared einvoice.vn/tra-cuu URL from invoice XML is valid.
  // A GDT list row may not have rawXml yet; offer detail retrieval on click.
  const thaiSonIssuerPortal = isThaiSonInvoice
    ? (lookupDetails.lookupUrl || effectiveInvoice.lookupUrl || '') : '';
  const canTryThaiSonOriginal = isThaiSonInvoice &&
    (Boolean(thaiSonIssuerPortal) || !effectiveInvoice.rawXml);
  // Co.opmart Quảng Bình uses the copy-code portal handoff, not in-app CAPTCHA.
  // Keep the established Saigon Co.op CAPTCHA flow for other issuers.
  const isSaigonCoopPortal = isSaigonCoopPortalUrl(thaiSonIssuerPortal) &&
    String(effectiveInvoice.nbmst || '') !== '0301175691-021';
  const configureThaiSonPortal = () => {
    if (!effectiveInvoice?.nbmst) return;
    const proposed = window.prompt('Nhập URL cổng tra cứu hóa đơn chính thức của người bán (lưu dùng lại theo MST):', '');
    if (!proposed) return;
    if (!rememberThaiSonPortalForSeller(effectiveInvoice.nbmst, proposed)) {
      setOriginalLoadError('URL không hợp lệ. Chỉ chấp nhận địa chỉ HTTPS công khai.');
      return;
    }
    setOriginalLoadError(null);
    setThaiSonPortalRevision(revision => revision + 1);
  };

  const isMinvoiceInvoice = autoDetectedProvider === 'MINVOICE';
  const isMisaInvoice = autoDetectedProvider === 'MISA';
  const isVnptInvoice = autoDetectedProvider === 'VNPT';
  const isViettelInvoice = autoDetectedProvider === 'VIETTEL';
  const isEasyInvoice = autoDetectedProvider === 'EASYINVOICE';
  const isVnpayInvoice = autoDetectedProvider === 'VNPAY';
  const isVietcombankInvoice = isVnpayInvoice && /vietcombank\.com\.vn/i.test(directLookupUrl);
  const is4SiInvoice = autoDetectedProvider === '4SI' || autoDetectedProvider === 'LCS_SOFT';

  const easyInvoiceLookupCode = lookupDetails.lookupCode || effectiveInvoice?.lookupCode || effectiveInvoice?.mhdon || '';
  const easyInvoicePortals = React.useMemo(() => {
    return easyInvoiceLookupPortals(effectiveInvoice?.nbmst, lookupDetails.lookupUrl || effectiveInvoice?.lookupUrl);
  }, [lookupDetails.lookupUrl, effectiveInvoice?.lookupUrl, effectiveInvoice?.nbmst]);
  const easyInvoicePortalUrl = React.useMemo(() => {
    return easyInvoiceLookupUrl(effectiveInvoice?.nbmst, easyInvoiceLookupCode, lookupDetails.lookupUrl || effectiveInvoice?.lookupUrl);
  }, [lookupDetails.lookupUrl, effectiveInvoice?.lookupUrl, easyInvoiceLookupCode, effectiveInvoice?.nbmst]);
  const easyInvoiceCommonUrl = React.useMemo(() => {
    return easyInvoiceLookupUrl(undefined, easyInvoiceLookupCode, easyInvoicePortals.common);
  }, [easyInvoiceLookupCode, easyInvoicePortals.common]);
  const easyInvoiceSellerUrl = React.useMemo(() => (
    easyInvoicePortals.seller
      ? easyInvoiceLookupUrl(effectiveInvoice?.nbmst, easyInvoiceLookupCode, easyInvoicePortals.seller)
      : ''
  ), [effectiveInvoice?.nbmst, easyInvoiceLookupCode, easyInvoicePortals.seller]);

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
      {/* Thông báo đang xử lý tệp PDF dự phòng */}
      {isExportingPdf && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-blue-900/95 border-2 border-blue-400 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-semibold backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200">
          <Loader2 className="w-5 h-5 animate-spin text-blue-300 shrink-0" />
          <div>
            <p className="text-sm font-bold text-white">Hệ thống đang xử lý tạo bản PDF dự phòng...</p>
            <p className="text-[11px] text-blue-200 font-normal">Vui lòng chờ trong giây lát, hệ thống đang kết xuất trang in (không cần bấm lại).</p>
          </div>
        </div>
      )}

      <div className="bg-slate-900 rounded-xl max-w-6xl w-full shadow-2xl border border-slate-800 overflow-hidden h-[96dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
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
                {isEasyInvoice && easyInvoicePortalUrl && (
                  <a
                    href={easyInvoicePortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 text-[10px] font-semibold border border-amber-500/40 flex items-center gap-1 transition-colors cursor-pointer"
                    title={`Mở trực tiếp Cổng tra cứu EasyInvoice (${effectiveInvoice.nbmst || ''}) trên tab mới`}
                  >
                    <ExternalLink className="w-2.5 h-2.5 text-amber-400" />
                    <span>Mở link tra cứu EasyInvoice ↗</span>
                  </a>
                )}
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

            {isThaiSonInvoice && originalEasyInvoiceHtml && (
              <div role="status" className="w-full max-w-[820px] mb-3 px-4 py-2.5 border border-teal-600 bg-teal-950/80 rounded text-xs text-teal-200">
                Đang hiển thị bản HTML nhận từ cổng phát hành Thái Sơn. Đây không phải file PDF gốc có chữ ký số.
              </div>
            )}
            {originalProviderZipUrl && (
              <div role="status" className="w-full max-w-[820px] mb-3 px-4 py-2.5 border border-teal-600 bg-teal-950/80 rounded text-xs text-teal-200">
                Đã nhận tệp ZIP gốc từ cổng phát hành, có chứa hóa đơn XML. Có thể tải ZIP để lưu trữ; không hiển thị ZIP như PDF.
              </div>
            )}
            {originalLoadError && !originalProviderPdfUrl && (
              <div role="alert" className="w-full max-w-[820px] mb-3 px-4 py-3 bg-amber-950 border border-amber-700 rounded text-sm text-amber-100">
                {originalLoadError}
              </div>
            )}
            {isDownloadingEasyInvoice && (
              <div className="w-full max-w-[820px] mb-3 px-4 py-3.5 bg-emerald-950/90 border border-emerald-500 rounded-lg text-sm text-emerald-100 flex items-center gap-3.5 shadow-lg ring-1 ring-emerald-500/40">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>{easyInvoiceDownloadStatus || 'Đang tải hóa đơn gốc từ Cổng EasyInvoice...'}</span>
                    <span className="text-[11px] font-normal px-2 py-0.5 bg-emerald-800 text-emerald-200 rounded-full animate-pulse">Đang xử lý</span>
                  </div>
                  <div className="text-xs text-emerald-200 mt-1 leading-relaxed">
                    {isMinvoiceInvoice ? 'Đang tra cứu PDF bằng MST và mã tra cứu. Tệp khác PDF sẽ bị từ chối.' : 'Hệ thống đang xử lý hóa đơn từ cổng nhà cung cấp.'}
                  </div>
                </div>
              </div>
            )}
            {isLoadingDetail && (
              <div role="status" aria-live="polite" className="w-full max-w-[820px] mb-3 px-4 py-3.5 bg-blue-950/90 border border-blue-500 rounded-lg text-sm text-blue-100 flex items-center gap-3.5 shadow-lg ring-1 ring-blue-500/40">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>Đang tải dữ liệu chi tiết hóa đơn & các dòng hàng hóa từ Cổng Thuế...</span>
                    <span className="text-[11px] font-normal px-2 py-0.5 bg-blue-800 text-blue-200 rounded-full animate-pulse">Đang nạp</span>
                  </div>
                  <div className="text-xs text-blue-200 mt-1 leading-relaxed">
                    Hóa đơn có nhiều dòng hàng hóa (nhiều trang) cần thêm thời gian để giải mã và đồng bộ đủ danh mục mặt hàng. Khung xem sẽ tự động cập nhật ngay khi hoàn tất, vui lòng chờ trong giây lát...
                  </div>
                </div>
              </div>
            )}
            {isExportingPdf && (
              <div role="status" aria-live="polite" className="w-full max-w-[820px] mb-3 px-4 py-3 bg-cyan-950/80 border border-cyan-600/60 rounded-lg text-sm text-cyan-200 flex items-center gap-3 shadow-md">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                <span><strong>Đang tạo bản thể hiện PDF dự phòng theo mẫu Tổng cục Thuế...</strong> Hóa đơn nhiều dòng có thể cần thêm thời gian.</span>
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

            {/* Format toggle for EasyInvoice if HTML original is loaded */}
            {isEasyInvoice && originalEasyInvoiceHtml && (
              <div className="w-full max-w-[820px] mb-2 flex items-center justify-between flex-wrap gap-2 bg-slate-800/90 px-3.5 py-2 rounded-lg border border-slate-700 shadow-sm">
                <div className="text-xs text-slate-300 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Bản thể hiện EasyInvoice:</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setEasyInvoiceViewMode('html')}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                      easyInvoiceViewMode === 'html'
                        ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                    title="Xem bản thể hiện HTML đa trang chuẩn A4 (tất cả các dòng hiển thị đầy đủ, không bị co ép)"
                  >
                    Bản thể hiện HTML A4 (Đa trang chuẩn)
                  </button>
                  {originalProviderPdfUrl && (
                    <button
                      type="button"
                      onClick={() => setEasyInvoiceViewMode('pdf')}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                        easyInvoiceViewMode === 'pdf'
                          ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                      title="Xem file PDF từ máy chủ EasyInvoice (máy chủ EasyInvoice nén tất cả các dòng vào 1 trang)"
                    >
                      Bản PDF gốc EasyInvoice
                    </button>
                  )}
                  {easyInvoiceViewMode === 'html' && (
                    <button
                      type="button"
                      onClick={handlePrintHtml}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-700 hover:bg-emerald-600 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="In hóa đơn chuẩn A4 đa trang qua hộp thoại in trình duyệt"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>In A4</span>
                    </button>
                  )}
                  {easyInvoicePortalUrl && (
                    <a
                      href={easyInvoicePortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-600/50 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Mở link tra cứu trực tiếp trên Cổng EasyInvoice (Đã dán sẵn mã FKey)"
                    >
                      <ExternalLink className="w-3 h-3 text-amber-400" />
                      <span>Cổng EasyInvoice ↗</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Thông báo hướng dẫn khi đang xem PDF bị co 1 trang của EasyInvoice */}
            {isEasyInvoice && !originalEasyInvoiceHtml && originalProviderPdfUrl && (
              <div className="w-full max-w-[820px] mb-2 px-3.5 py-2.5 bg-amber-950/80 border border-amber-600/60 rounded-lg text-xs text-amber-200 flex items-center justify-between gap-3 shadow-md flex-wrap">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Bản PDF từ Cổng EasyInvoice bị nén dồn nhiều dòng vào 1 trang. Nhấn nút bên cạnh để xem bản thể hiện HTML phân trang chuẩn A4.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleViewOriginalEasyInvoice(false)}
                    disabled={isDownloadingEasyInvoice}
                    className="px-3 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    {isDownloadingEasyInvoice ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                    <span>Xem bản HTML đa trang</span>
                  </button>
                  {easyInvoicePortalUrl && (
                    <a
                      href={easyInvoicePortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-xs font-semibold text-amber-200 bg-amber-900 hover:bg-amber-800 border border-amber-600 rounded transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Mở link tra cứu</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {isEasyInvoice && originalEasyInvoiceHtml && easyInvoiceViewMode === 'pdf' && originalProviderPdfUrl && (
              <div className="w-full max-w-[820px] mb-2 px-3 py-1.5 bg-slate-800/90 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-center justify-between gap-2 flex-wrap">
                <span>
                  Đang xem file PDF nén từ EasyInvoice. Chuyển sang <strong>Bản thể hiện HTML A4</strong> để xem và in từng trang rõ ràng.
                </span>
                <button
                  type="button"
                  onClick={() => setEasyInvoiceViewMode('html')}
                  className="px-2.5 py-0.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded cursor-pointer"
                >
                  Xem bản HTML đa trang
                </button>
              </div>
            )}

            {/* Paper A4 container */}
            <div 
              className="flex justify-center"
              style={{
                width: '100%',
                maxWidth: originalVnptHtml || misaPortalUrl ? '890px' : '820px',
                minHeight: '1160px',
              }}
            >
                <div className="w-full min-h-[1160px] bg-white rounded shadow-2xl overflow-hidden border border-gray-300">
                  {misaPortalUrl ? (
                    <iframe
                      src={misaPortalUrl}
                      title="Cổng tra cứu MISA meInvoice"
                      className="w-full h-[1200px] border-0 bg-white"
                      allow="clipboard-read; clipboard-write"
                    />
                  ) : originalViettelPdfUrl ? (
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
                  ) : isEasyInvoice && easyInvoiceViewMode === 'html' && originalEasyInvoiceHtml ? (
                    <iframe
                      ref={iframeRef}
                      srcDoc={prepareOriginalInvoiceHtml(originalEasyInvoiceHtml)}
                      title={`Bản gốc HTML ${currentProviderMeta.name}`}
                      className="w-full h-[1200px] border-0 bg-white"
                      sandbox="allow-same-origin allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-forms"
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
                      title={`Bản gốc ${currentProviderMeta.name}`}
                      className="w-full h-[1200px] border-0 bg-white"
                      sandbox={isThaiSonInvoice
                        ? "allow-same-origin"
                        : "allow-same-origin allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-forms"}
                    />
                  ) : isLoadingDetail ? (
                    <div className="min-h-[600px] flex flex-col items-center justify-center p-8 text-center bg-white">
                      <div className="relative mb-4">
                        <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <FileText className="w-6 h-6 text-blue-600 absolute inset-0 m-auto" />
                      </div>
                      <h3 className="text-base font-bold text-slate-800">Đang tải dữ liệu chi tiết hóa đơn từ Cổng Thuế...</h3>
                      <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed">
                        Hệ thống đang tải toàn bộ danh mục sản phẩm, số lượng, đơn giá và thuế suất từ Tổng cục Thuế. Hóa đơn có nhiều dòng hàng hóa có thể mất từ 3 - 10 giây.
                      </p>
                      <div className="mt-4 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-200">
                        Đang đồng bộ HĐ {effectiveInvoice.shdon || ''} ({effectiveInvoice.khhdon || ''})
                      </div>
                    </div>
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
                {misaPortalUrl ? (
                  <>Đang xem <span className="text-emerald-400 font-bold">cổng MISA meInvoice</span> trong ứng dụng • </>
                ) : originalEasyInvoiceHtml ? (
                  <>Bản thể hiện <span className="text-emerald-400 font-bold">gốc từ {currentProviderMeta.name}</span> • </>
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

          <div className="ml-auto flex items-center gap-2.5 flex-wrap">
            {/* 1. Nếu có file PDF gốc đã nạp, hiển thị nút Tải PDF gốc đã lưu */}
            {originalProviderZipUrl && (
              <a href={originalProviderZipUrl}
                download={`HoaDon_${effectiveInvoice.khhdon || 'HD'}_${effectiveInvoice.shdon || ''}.zip`}
                className="inline-flex items-center gap-1.5 rounded-md border border-teal-600 bg-teal-950/80 hover:bg-teal-900 px-3 py-1.5 text-xs font-semibold text-teal-200">
                <Download className="h-3.5 w-3.5" />
                <span>Tải tệp ZIP gốc từ nhà cung cấp</span>
              </a>
            )}
            {originalProviderPdfUrl && (
              <a
                href={originalProviderPdfUrl}
                download={`HoaDon_${effectiveInvoice.khhdon || 'HD'}_${effectiveInvoice.shdon || ''}.pdf`}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-950/80 hover:bg-emerald-900 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors cursor-pointer shadow-xs"
                title="Tải tệp PDF nhận được từ nhà cung cấp"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Tải PDF gốc đã lưu</span>
              </a>
            )}

            {/* 2. Provider Actions - Luôn luôn hiển thị theo nhà cung cấp */}
            {isEasyInvoice ? (
              <div className="inline-flex items-center gap-1.5 flex-wrap">
                {/* Nút MỞ LINK TRA CỨU TRỰC TIẾP TỪ NHÀ CUNG CẤP EASYINVOICE */}
                {easyInvoicePortalUrl && (
                  <a
                    href={easyInvoicePortalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border text-amber-200 bg-amber-950/90 hover:bg-amber-900 border-amber-500 hover:border-amber-400 ring-2 ring-amber-500/40 transition-all cursor-pointer shadow-md"
                    title={`Mở trực tiếp Cổng tra cứu EasyInvoice (${effectiveInvoice.nbmst || ''}) trên tab mới (Đã dán sẵn mã FKey: ${easyInvoiceLookupCode || ''})`}
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    <span>Mở cổng EasyInvoice ưu tiên</span>
                  </a>
                )}
                {easyInvoiceSellerUrl && easyInvoiceSellerUrl !== easyInvoicePortalUrl && (
                  <a href={easyInvoiceSellerUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg border-sky-600 text-sky-200 bg-sky-950/70 hover:bg-sky-900">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Cổng riêng theo MST</span>
                  </a>
                )}
                {easyInvoiceCommonUrl !== easyInvoicePortalUrl && (
                  <a href={easyInvoiceCommonUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg border-teal-600 text-teal-200 bg-teal-950/70 hover:bg-teal-900">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Cổng tra cứu chung</span>
                  </a>
                )}

                {/* Nút In hóa đơn chuẩn A4 đa trang khi xem HTML */}
                {originalEasyInvoiceHtml && (
                  <button
                    type="button"
                    onClick={handlePrintHtml}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 border-emerald-600 hover:border-emerald-500 ring-1 ring-emerald-500/30 transition-all cursor-pointer shadow-xs"
                    title="In hóa đơn chuẩn A4 đa trang qua hộp thoại in của trình duyệt"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>In hóa đơn A4</span>
                  </button>
                )}

                {/* Nút nạp bản thể hiện HTML đa trang nếu chưa có HTML */}
                {!originalEasyInvoiceHtml && (
                  <button
                    type="button"
                    onClick={() => handleViewOriginalEasyInvoice(false)}
                    disabled={isDownloadingEasyInvoice}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border-emerald-600 hover:border-emerald-500 ring-1 ring-emerald-500/30 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                    title={`Tra cứu mã FKey và hiển thị bản thể hiện HTML đa trang từ EasyInvoice (Mã tra cứu: ${easyInvoiceLookupCode || ''})`}
                  >
                    {isDownloadingEasyInvoice ? (
                      <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{isDownloadingEasyInvoice ? (easyInvoiceDownloadStatus || 'Đang tải...') : 'Xem bản HTML đa trang'}</span>
                  </button>
                )}
              </div>
            ) : isMisaInvoice ? (
              <div className="inline-flex items-center gap-1.5 flex-wrap">
                {directLookupUrl && (
                  <button
                    type="button"
                    onClick={() => setMisaPortalUrl(directLookupUrl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border-emerald-600 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{misaPortalUrl ? 'Đang mở tra cứu MISA' : 'Mở tra cứu MISA'}</span>
                  </button>
                )}
                {directLookupUrl && (
                  <a href={directLookupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 cursor-pointer">
                    <ExternalLink className="w-3 h-3" />
                    <span>Mở cửa sổ riêng</span>
                  </a>
                )}
              </div>
            ) : isVnptInvoice ? (
              <div className="inline-flex items-center gap-1.5 flex-wrap">
                {!originalVnptHtml && (
                  <button
                    type="button"
                    onClick={handleViewOriginalProvider}
                    disabled={isDownloadingEasyInvoice}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-cyan-300 bg-cyan-950/70 hover:bg-cyan-900 border-cyan-600 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    {isLoadingVnptOriginal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isLoadingVnptOriginal ? 'Đang nạp HĐ gốc...' : 'Xem hóa đơn gốc VNPT'}</span>
                  </button>
                )}
                {originalVnptHtml && (
                  <button
                    type="button"
                    onClick={() => setOriginalVnptHtml(null)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors cursor-pointer"
                  >
                    <span>Mẫu nội bộ</span>
                  </button>
                )}
                {!originalProviderPdfUrl && (
                  <button
                    type="button"
                    onClick={handleViewOriginalProvider}
                    disabled={isDownloadingEasyInvoice}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-blue-300 bg-blue-950/70 hover:bg-blue-900 border-blue-600 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    {isDownloadingVnptPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <Download className="w-3.5 h-3.5 text-blue-400" />}
                    <span>{isDownloadingVnptPdf ? 'Đang tải PDF...' : 'Tải PDF gốc VNPT'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const code = lookupDetails.lookupCode || effectiveInvoice?.mhdon || '';
                    openVnptDirectPortal(effectiveInvoice?.nbmst, code, lookupDetails.lookupUrl);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-sky-300 bg-sky-950/70 hover:bg-sky-900 border-sky-700 hover:border-sky-600 transition-all cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                  <span>Tra link gốc VNPT</span>
                </button>
              </div>
            ) : isViettelInvoice ? (
              <div className="inline-flex items-center gap-1.5 flex-wrap">
                {!originalViettelPdfUrl && (
                  <button
                    type="button"
                    onClick={handleViewOriginalProvider}
                    disabled={isDownloadingEasyInvoice}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-rose-300 bg-rose-950/70 hover:bg-rose-900 border-rose-700 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    {isLoadingViettelOriginal ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Eye className="w-3.5 h-3.5 text-rose-400" />}
                    <span>{isLoadingViettelOriginal ? 'Đang mở HĐ gốc...' : 'Xem PDF gốc Viettel'}</span>
                  </button>
                )}
                {!originalProviderPdfUrl && (
                  <button
                    type="button"
                    onClick={handleViewOriginalProvider}
                    disabled={isDownloadingEasyInvoice}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border text-rose-300 bg-rose-950/70 hover:bg-rose-900 border-rose-700 transition-all cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    {isDownloadingViettelPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Download className="w-3.5 h-3.5 text-rose-400" />}
                    <span>{isDownloadingViettelPdf ? 'Đang tải PDF...' : 'Tải PDF gốc Viettel'}</span>
                  </button>
                )}
              </div>
            ) : isVietcombankInvoice ? (
              <div className="inline-flex items-center gap-1.5">
                <a
                  href="https://einvoice.vietcombank.com.vn/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border-emerald-600 transition-all cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cổng Vietcombank</span>
                </a>
              </div>
            ) : resolveInvoiceProvider(effectiveInvoice) === 'WININVOICE' ? (
              <div className="inline-flex items-center gap-2 flex-wrap">
                {!originalProviderPdfUrl && (
                  <button type="button" onClick={() => void handleViewOriginalProvider()}
                    disabled={isDownloadingEasyInvoice}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-emerald-700 text-emerald-200 hover:bg-emerald-950 disabled:opacity-60">
                    {isDownloadingEasyInvoice ? 'Đang tra cứu...' : 'Xem PDF / tải ZIP gốc WINinvoice'}
                  </button>
                )}
                <button type="button" onClick={() => void handleWinInvoiceLookup()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-cyan-700 text-cyan-200 hover:bg-cyan-950">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Tra cứu WINinvoice trực tiếp
                </button>
              </div>
            ) : resolveInvoiceProvider(effectiveInvoice) === 'MATBAO' ? (
              <div className="inline-flex items-center gap-2 flex-wrap">
                {!originalProviderPdfUrl && (
                  <button type="button" onClick={() => void handleViewOriginalProvider()}
                    disabled={isDownloadingEasyInvoice}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-emerald-700 text-emerald-200 hover:bg-emerald-950 disabled:opacity-60">
                    {isDownloadingEasyInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {isDownloadingEasyInvoice ? 'Đang lấy PDF gốc...' : 'Tải PDF gốc Mắt Bão'}
                  </button>
                )}
                <button type="button"
                  onClick={() => {
                    const xml = String(effectiveInvoice.rawXml || '').trim();
                    if (!xml) {
                      toast.warning('Không có XML gốc để tải lên trang Mắt Bão.');
                      return;
                    }
                    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'HD_' + String(effectiveInvoice.khhdon || '').replace(/[^A-Za-z0-9]/g, '') +
                      '_' + String(effectiveInvoice.shdon || '').replace(/[^0-9]/g, '') + '_MATBAO.xml';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-cyan-700 text-cyan-200 hover:bg-cyan-950">
                  <Download className="w-3.5 h-3.5" />
                  Tải XML gốc
                </button>
                <a href="https://matbao.in/tra-cuu-hoa-don"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800"
                  title="Tại cổng Mắt Bão, chọn Tra cứu dùng file XML và tải tệp XML gốc lên">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Tra cứu Mắt Bão (Upload XML)
                </a>
              </div>
            ) : resolveInvoiceProvider(effectiveInvoice) === 'VISNAM' ? (
              <div className="inline-flex items-center gap-2">
                {!originalProviderPdfUrl && (
                  <button type="button" onClick={() => void handleVisnamDirectLookup()}
                    disabled={isDownloadingEasyInvoice || isLoadingVisnamCaptcha}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-cyan-600 text-cyan-200 hover:bg-cyan-950 disabled:opacity-60">
                    {isDownloadingEasyInvoice || isLoadingVisnamCaptcha
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Download className="w-3.5 h-3.5" />}
                    {isDownloadingEasyInvoice ? 'Đang tải PDF VIN-HOADON...' : 'Tải PDF gốc VIN-HOADON'}
                  </button>
                )}
                <a href={`https://tracuu.vin-hoadon.com/tracuuhoadon/tracuuxacthuc/tracuuhd#hms_visnam_code=${encodeURIComponent(String(lookupDetails.lookupCode || effectiveInvoice.lookupCode || ''))}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-slate-700 text-slate-200 hover:bg-slate-800">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Mở cổng VIN-HOADON
                </a>
              </div>
            ) : isMinvoiceInvoice ? (
              <div className="inline-flex items-center gap-2 flex-wrap">
                <a href={buildDirectLookupUrl(
                    'https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don',
                    lookupDetails.lookupCode || effectiveInvoice.lookupCode,
                    'MINVOICE',
                    effectiveInvoice.nbmst
                  )}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Tra cứu M-invoice (MST + mã tra cứu)</span>
                </a>
              </div>
            ) : isThaiSonInvoice ? (
              <div className="inline-flex items-center gap-2 flex-wrap">
                {canTryThaiSonOriginal ? (
                  <>
                    {isSaigonCoopPortal ? (
                      !originalEasyInvoiceHtml && !originalProviderPdfUrl ? (
                        <button type="button" onClick={() => void handleSaigonCoopCaptchaOpen()}
                          disabled={isLoadingSaigonCoopCaptcha || isSubmittingSaigonCoopCaptcha}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border border-cyan-700 text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900 disabled:opacity-60">
                          {isLoadingSaigonCoopCaptcha || isSubmittingSaigonCoopCaptcha
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Eye className="w-3.5 h-3.5" />}
                          {isLoadingSaigonCoopCaptcha || isSubmittingSaigonCoopCaptcha
                            ? 'Đang tra cứu...'
                            : 'Tra cứu trong ứng dụng'}
                        </button>
                      ) : null
                    ) : !originalProviderPdfUrl && !originalEasyInvoiceHtml ? (
                      <button type="button" onClick={handleViewOriginalProvider}
                        disabled={isDownloadingEasyInvoice}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border border-cyan-700 text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900 disabled:opacity-60">
                        {isDownloadingEasyInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        <span>{isDownloadingEasyInvoice ? 'Đang tải bản gốc...' : /^https?:\/\/(?:www\.)?einvoice\.vn(?:\/|$)/i.test(thaiSonIssuerPortal)
                          ? 'Tra cứu và tải gốc Thái Sơn' : 'Tải bản gốc Thái Sơn'}</span>
                      </button>
                    ) : null}
                    {originalEasyInvoiceHtml && (
                      <button type="button" onClick={handlePrintHtml}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-teal-700 text-teal-200 hover:bg-teal-950/70">
                        <Printer className="w-3.5 h-3.5" />
                        <span>In / lưu PDF từ bản HTML</span>
                      </button>
                    )}
                    {originalLoadError && (
                      <a href={thaiSonIssuerPortal} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800">
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Kiểm tra cổng nhà cung cấp</span>
                      </a>
                    )}
                  </>
                ) : (
                  <button type="button" onClick={configureThaiSonPortal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-amber-700 text-amber-300 hover:bg-amber-950/60"
                    title="XML không có địa chỉ tra cứu; chỉ cần khai báo một lần cho người bán này">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Chưa có cổng tra cứu — Thiết lập theo MST</span>
                  </button>
                )}
              </div>
            ) : (!isSaigonCoopPortal && directLookupUrl &&
                (!isVnpayInvoice || Boolean(lookupDetails.lookupCode))) ? (
              <a
                href={directLookupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-700 transition-all cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isVnpayInvoice ? 'Tra cứu VNPAY' : 'Tra cứu Cổng NCC'}</span>
              </a>
            ) : null}

            {/* Nút Tải PDF Tổng cục thuế */}
            <button
              type="button"
              onClick={handleDownloadPdfFile}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
              title="Tải bản thể hiện PDF từ dữ liệu Cổng Tổng cục thuế"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-200" />
                  <span>Đang xử lý hóa đơn...</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải PDF Tổng cục thuế</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Thông báo giữa màn hình khi bấm Tải PDF Tổng cục thuế: "Đang xử lý hóa đơn" */}
      {isExportingPdf && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn pointer-events-auto">
          <div className="bg-slate-900 border border-blue-500/50 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3.5 max-w-sm mx-4 text-center ring-1 ring-white/10 animate-scaleUp">
            <div className="w-14 h-14 rounded-full bg-blue-600/20 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow-inner">
              <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">Đang xử lý hóa đơn</h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Hệ thống đang kết xuất bản thể hiện PDF Tổng cục thuế, vui lòng đợi trong giây lát...
              </p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
              <div className="bg-blue-500 h-full w-2/3 animate-pulse rounded-full"></div>
            </div>
          </div>
        </div>
      )}
      <VisnamCaptchaModal
        isOpen={isVisnamCaptchaOpen}
        image={visnamCaptcha?.image || ''}
        code={visnamCaptchaCode}
        error={visnamCaptchaError}
        isLoading={isLoadingVisnamCaptcha}
        isSubmitting={isSubmittingVisnamCaptcha}
        onCodeChange={value => setVisnamCaptchaCode(value.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase())}
        onRefresh={() => {
          if (effectiveInvoice) void refreshVisnamCaptcha(effectiveInvoice.id, originalLoadSequence.current);
        }}
        onCancel={closeVisnamCaptcha}
        onSubmit={handleVisnamCaptchaSubmit}
      />
      <SaigonCoopCaptchaModal
        title={isThaiSonSharedCaptcha ? 'Tra cứu Thái Sơn (CAPTCHA thủ công)' : 'Tra cứu hóa đơn Saigon Co.op'}
        isOpen={isSaigonCoopCaptchaOpen}
        lookupCode={effectiveInvoice ? saigonCoopLookupCode(effectiveInvoice) : ''}
        image={saigonCoopCaptcha?.image || ''}
        loading={isLoadingSaigonCoopCaptcha}
        submitting={isSubmittingSaigonCoopCaptcha}
        error={saigonCoopCaptchaError}
        onRefresh={() => void handleSaigonCoopCaptchaOpen(isThaiSonSharedCaptcha)}
        onSubmit={captcha => void handleSaigonCoopCaptchaSubmit(captcha)}
        onClose={closeSaigonCoopCaptcha}
      />
    </div>
  );
};
