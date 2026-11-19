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
import { easyInvoiceLookupPortals, easyInvoiceLookupUrl, lookupPortalForSeller, rememberThaiSonPortalForSeller } from '../utils/providerIdentity';
import { ensureInvoiceItems, hasGenuineItems, extractTagValue, parseGDTInvoiceXml } from '../utils/xmlParser';
import { resolveInvoiceProvider } from '../utils/providerRouting';
import { loadOriginalInvoice } from '../services/originalInvoiceLoader';
import { fetchVisnamCaptcha, fetchVisnamInvoicePdf, autoLookupVisnamInvoicePdf } from '../services/visnamClient';
import { VisnamCaptchaModal } from './VisnamCaptchaModal';
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
    if (!effectiveInvoice || isExportingPdf) return;
    setIsExportingPdf(true);
    toast.info('Đang xử lý hóa đơn...', 'Thông Báo');
    try {
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
      setVisnamCaptchaCode(captcha.autoSolvedCode || '');
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
    const MAX_VISNAM_AUTO_ATTEMPTS = 4;

    setIsDownloadingEasyInvoice(true);
    setOriginalLoadError(null);

    const identity = {
      sellerTaxCode: String(target.nbmst || extractTagValue(target.rawXml || '', 'MST') || '').trim(),
      invoiceSeries: String(target.khhdon || extractTagValue(target.rawXml || '', 'KHHDon') || '').trim(),
      invoiceNo: String(target.shdon || extractTagValue(target.rawXml || '', 'SHDon') || '').trim(),
    };

    let lastFallbackCaptcha: { key: string; image: string; autoSolvedCode?: string } | undefined;

    for (let attempt = 1; attempt <= MAX_VISNAM_AUTO_ATTEMPTS; attempt++) {
      if (openInvoiceIdRef.current !== target.id || originalLoadSequence.current !== sequence) return;

      setEasyInvoiceDownloadStatus(
        `Đang tự động giải CAPTCHA & tải PDF VIN-HOADON (lần ${attempt}/${MAX_VISNAM_AUTO_ATTEMPTS})...`
      );

      try {
        const result = await autoLookupVisnamInvoicePdf({
          lookupCode: code,
          identity,
        });

        if (openInvoiceIdRef.current !== target.id || originalLoadSequence.current !== sequence) return;

        const url = URL.createObjectURL(result.blob);
        setOriginalProviderPdfUrl(url);
        setIsVisnamCaptchaOpen(false);
        setVisnamCaptcha(null);
        setVisnamCaptchaCode('');
        setVisnamCaptchaError(null);
        setEasyInvoiceDownloadStatus('Đã tự động nhận diện CAPTCHA và tải PDF gốc VIN-HOADON thành công.');

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
        setIsDownloadingEasyInvoice(false);
        return;
      } catch (error: any) {
        if (openInvoiceIdRef.current !== target.id || originalLoadSequence.current !== sequence) return;
        if (error?.fallbackCaptcha) {
          lastFallbackCaptcha = error.fallbackCaptcha;
        }
        console.warn(`[Visnam] Lần thử ${attempt}/${MAX_VISNAM_AUTO_ATTEMPTS} chưa thành công, đổi CAPTCHA mới...`);
      }
    }

    // Hết số lần thử tự động -> mở modal nhập tay kèm ảnh CAPTCHA mới nhất
    setIsDownloadingEasyInvoice(false);
    setVisnamCaptcha(lastFallbackCaptcha || null);
    setVisnamCaptchaCode(lastFallbackCaptcha?.autoSolvedCode || '');
    setVisnamCaptchaError(null);
    setIsVisnamCaptchaOpen(true);
    if (!lastFallbackCaptcha) {
      await refreshVisnamCaptcha(target.id, sequence);
    }
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

  const handleViewOriginalProvider = async () => {
    if (!effectiveInvoice) return;
    const target = effectiveInvoice;
    const actualProvider = resolveInvoiceProvider(target);
    const extractedLookup = extractLookupDetails(target.rawXml);
    const sellerPortal = lookupPortalForSeller(target.nbmst);
    const recordedPortal = extractedLookup.lookupUrl || target.lookupUrl || '';
    const isGenericThaiSon = !recordedPortal || /^https?:\/\/(?:www\.)?einvoice\.vn(?:\/|$)/i.test(recordedPortal);
    const tenantUrl = sellerPortal && isGenericThaiSon ? sellerPortal : recordedPortal;
    const isSeparatePortal = actualProvider === 'IHOADON';
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
        const html = prepareEasyInvoiceHtml(await blob.text());
        if (!isCurrent()) return;
        setOriginalEasyInvoiceHtml(html);
      } else if (blob.type.includes('application/zip')) {
        const url = window.URL.createObjectURL(blob);
        setOriginalProviderZipUrl(url);
        try {
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(blob);
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
    if (!effectiveInvoice || provider === 'MISA' || provider === 'MINVOICE' || provider === 'VISNAM' || provider === 'MATBAO') return;
    if (provider === 'EASYINVOICE') {
      const code = effectiveInvoice.lookupCode || effectiveInvoice.mhdon;
      if (code) {
        void handleViewOriginalEasyInvoice(true);
      }
      return;
    }
    if (!effectiveInvoice?.rawXml) return;
    const xmlPortal = extractLookupDetails(effectiveInvoice.rawXml).lookupUrl || '';
    const knownPortal = lookupPortalForSeller(effectiveInvoice.nbmst) || '';
    const candidate = xmlPortal || knownPortal || effectiveInvoice.lookupUrl || '';
    if (provider === 'THAISON' && (!candidate ||
        /^https?:\/\/(?:www\.)?einvoice\.vn(?:\/|$)/i.test(candidate))) return;
    if (provider === 'IHOADON') return;
    void handleViewOriginalProvider();
  }, [effectiveInvoice?.id, effectiveInvoice?.rawXml, effectiveInvoice?.lookupCode, effectiveInvoice?.lookupUrl, effectiveInvoice?.provider, thaiSonPortalRevision]);

  if (!invoice || !effectiveInvoice) return null;

  let xmlContent = '';
  let autoDetectedProvider: InvoiceProviderId = 'DEFAULT' as InvoiceProviderId;
  let lookupDetails: { lookupCode?: string; lookupUrl?: string } = {};
  let safeItems: ReturnType<typeof ensureInvoiceItems> = [];
  let renderError: string | null = null;

  try {
    xmlContent = effectiveInvoice.rawXml || generateGDTInvoiceXml(effectiveInvoice);
    const detectedProvider = (resolveInvoiceProvider(effectiveInvoice)?.replace(/^LCS$/, 'LCS_SOFT') || 'DEFAULT') as InvoiceProviderId;
    const standardProviders = new Set<InvoiceProviderId>([
      'MISA', 'VIETTEL', 'VNPT', 'EASYINVOICE', 'BKAV', '4SI', 'LCS_SOFT',
      'VNPAY', 'FPT', 'MINVOICE', 'THAISON', 'CYBERBILL', 'DEFAULT'
    ]);
    autoDetectedProvider = standardProviders.has(detectedProvider)
      ? detectedProvider
      : 'DEFAULT';
    lookupDetails = extractLookupDetails(xmlContent);

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

    if (autoDetectedProvider === 'VNPT' && !lookupDetails.lookupUrl) {
      const tax = String(effectiveInvoice.nbmst || '').replace(/[^0-9-]/g, '');
      if (tax) lookupDetails.lookupUrl = `https://${tax}-tt78.vnpt-invoice.com.vn`;
    }
    if (autoDetectedProvider === 'MISA') lookupDetails.lookupUrl = 'https://www.meinvoice.vn/tra-cuu';
    if (autoDetectedProvider === 'MINVOICE') lookupDetails.lookupUrl = 'https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don';

    safeItems = ensureInvoiceItems(effectiveInvoice);
  } catch (err: any) {
    console.error('[InvoiceDetailModal] Lỗi khi xử lý dữ liệu hóa đơn:', err);
    renderError = err?.message || 'Không thể xử lý dữ liệu hóa đơn này.';
  }

  const resolvedTemplateId: InvoiceProviderId = (selectedTemplateId && selectedTemplateId !== 'AUTO')
    ? (selectedTemplateId as InvoiceProviderId)
    : autoDetectedProvider;

  const safeResolvedTemplateId: InvoiceProviderId =
    resolvedTemplateId === 'TKJ' && effectiveInvoice.nbmst !== '0318443500'
      ? 'DEFAULT'
      : resolvedTemplateId;

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
  const thaiSonIssuerPortal = isThaiSonInvoice && lookupDetails.lookupUrl &&
    !/^https?:\/\/(?:www\.)?einvoice\.vn(?:\/|$)/i.test(lookupDetails.lookupUrl)
    ? lookupDetails.lookupUrl : '';
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
            {allInvoices.length > 1 && (
              <div className="flex items-center bg-slate-900 rounded-
