import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  FileCode2, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight, 
  Code2, 
  Sparkles, 
  RefreshCw, 
  ExternalLink,
  FileText,
  Loader2
} from 'lucide-react';
import { GDTInvoice } from '../types';
import { generateGDTInvoiceXml } from '../utils/xmlGenerator';
import { 
  generateInvoiceQrCode, 
  exportInvoiceToPdfFile, 
  openInvoicePrintWindow, 
  downloadStandaloneHtmlFile 
} from '../utils/pdfExporter';
import { generateOfficialInvoiceHtml } from '../utils/officialInvoiceHtml';
import { 
  detectInvoiceProvider, 
  getProviderMeta, 
  extractLookupDetails, 
  InvoiceProviderId, 
  ProviderMeta 
} from '../utils/multiTemplateRenderer';
import { buildDirectLookupUrl } from '../templates/templateUtils';
import { ensureInvoiceItems, hasGenuineItems, extractTagValue } from '../utils/xmlParser';

interface InvoiceDetailModalProps {
  invoice: GDTInvoice | null;
  allInvoices?: GDTInvoice[];
  onSelectInvoice?: (invoice: GDTInvoice) => void;
  onClose: () => void;
  onDownloadXml: (invoice: GDTInvoice) => void;
  onUpdateInvoice?: (invoice: GDTInvoice) => void;
  token?: string;
  cookieHeader?: string;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  allInvoices = [],
  onSelectInvoice,
  onClose,
  onDownloadXml,
  onUpdateInvoice,
  token,
  cookieHeader
}) => {
  const [currentInvoice, setCurrentInvoice] = useState<GDTInvoice | null>(invoice);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  // Theo dõi hóa đơn đang thực sự được mở để bỏ qua kết quả tải chi tiết trả
  // về SAU KHI người dùng đã đóng modal hoặc chuyển sang xem hóa đơn khác -
  // tránh việc áp dữ liệu cũ/không khớp vào state và làm crash giao diện.
  const openInvoiceIdRef = useRef<string | null>(invoice?.id ?? null);

  useEffect(() => {
    setCurrentInvoice(invoice);
    setOriginalEasyInvoiceHtml(null);
    openInvoiceIdRef.current = invoice?.id ?? null;
  }, [invoice]);

  const effectiveInvoice = invoice
    ? (currentInvoice && currentInvoice.id === invoice.id ? currentInvoice : invoice)
    : null;

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [originalEasyInvoiceHtml, setOriginalEasyInvoiceHtml] = useState<string | null>(null);
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
      const data = await resp.json();
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

  if (!invoice || !effectiveInvoice) return null;

  // Dò tìm tự động nhà cung cấp HĐĐT từ XML hoặc dữ liệu bóc tách.
  // Bọc trong try/catch: nếu dữ liệu hóa đơn (ví dụ từ nguồn mới như hóa đơn
  // máy tính tiền) có định dạng bất thường khiến các hàm này ném lỗi, tránh
  // để lỗi văng ra ngoài render và làm crash toàn bộ trang (trang trắng).
  let xmlContent = '';
  let autoDetectedProvider: InvoiceProviderId = 'DEFAULT' as InvoiceProviderId;
  let lookupDetails: { lookupCode?: string; lookupUrl?: string } = {};
  let safeItems: ReturnType<typeof ensureInvoiceItems> = [];
  let standaloneHtml = '';
  let renderError: string | null = null;

  try {
    xmlContent = effectiveInvoice.rawXml || generateGDTInvoiceXml(effectiveInvoice);
    autoDetectedProvider = detectInvoiceProvider(xmlContent, effectiveInvoice);
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
        lookupDetails.lookupUrl = effectiveInvoice.lookupUrl || `https://${effectiveInvoice.nbmst || '4000344946'}-tt78.vnpt-invoice.com.vn`;
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

    safeItems = ensureInvoiceItems(effectiveInvoice);
  } catch (err: any) {
    console.error('[InvoiceDetailModal] Lỗi khi xử lý dữ liệu hóa đơn:', err);
    renderError = err?.message || 'Không thể xử lý dữ liệu hóa đơn này.';
  }

  // Template ID hiệu lực: Nếu người dùng chọn AUTO thì dùng kết quả dò tìm tự động
  const effectiveTemplateId: InvoiceProviderId = (selectedTemplateId && selectedTemplateId !== 'AUTO')
    ? (selectedTemplateId as InvoiceProviderId)
    : autoDetectedProvider;

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

  const isViettelInvoice = /sinvoice/i.test(directLookupUrl) || 
    effectiveTemplateId === 'VIETTEL' || 
    Boolean(effectiveInvoice?.caProvider?.includes('VIETTEL'));

  const isEasyInvoice = /easyinvoice/i.test(directLookupUrl) ||
    /easyinvoice/i.test(lookupDetails.lookupUrl || '') ||
    effectiveTemplateId === 'EASYINVOICE' || 
    effectiveTemplateId === 'BAO_DUY' || 
    effectiveTemplateId === 'KIM_LOAN_TUAN' || 
    effectiveTemplateId === 'TKJ' ||
    effectiveInvoice?.provider === 'EASYINVOICE' ||
    effectiveInvoice?.msttcgp === '0105987432' ||
    effectiveInvoice?.nbmst === '0318391940';

  if (!renderError) {
    try {
      // Tạo HTML chuẩn theo template của nhà cung cấp
      standaloneHtml = generateOfficialInvoiceHtml(effectiveInvoice, {
        theme,
        qrCodeDataUrl: qrCodeUrl,
        showPrintControls: false,
        templateId: effectiveTemplateId
      });
    } catch (err: any) {
      console.error('[InvoiceDetailModal] Lỗi khi tạo HTML hóa đơn:', err);
      renderError = err?.message || 'Không thể tạo bản xem trước hóa đơn này.';
    }
  }

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

  const handleDownloadPdfFile = async () => {
    setIsExportingPdf(true);
    try {
      await exportInvoiceToPdfFile(effectiveInvoice, null, undefined, theme, effectiveTemplateId);
    } catch (err) {
      console.error('Lỗi khi xuất PDF:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadHtmlFile = async () => {
    await downloadStandaloneHtmlFile(effectiveInvoice, theme, effectiveTemplateId);
  };

  const handlePrint = () => {
    openInvoicePrintWindow(effectiveInvoice, theme, effectiveTemplateId);
  };

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
      alert(`Không thể tự động tải hóa đơn từ Cổng EasyInvoice: ${err.message}\nBạn có thể nhấn nút "Mở Cổng" để tra cứu trực tiếp.`);
      setEasyInvoiceDownloadStatus(null);
    } finally {
      setIsDownloadingEasyInvoice(false);
    }
  };

  const isRed = theme === 'red';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#1e293b] rounded-xl max-w-6xl w-full shadow-2xl border border-gray-700 overflow-hidden max-h-[96vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Bar */}
        <div className="bg-[#0f172a] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-gray-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
              isRed ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
            }`}>
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-xs sm:text-sm font-mono uppercase tracking-wider text-white truncate">
                  {effectiveInvoice.thdon || 'HÓA ĐƠN ĐIỆN TỬ'}: {effectiveInvoice.khhdon} - SỐ {effectiveInvoice.shdon}
                </h3>
                {effectiveInvoice.loaiHdon === 'purchase' ? (
                  <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 text-[10px] font-bold border border-blue-700">
                    MUA VÀO
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-bold border border-emerald-700">
                    BÁN RA
                  </span>
                )}
                {effectiveInvoice.hsgcma && (
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-mono font-semibold border border-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    ĐÃ CẤP MÃ CQT
                  </span>
                )}
                {/* Provider Indicator Pill */}
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  NCC: {currentProviderMeta.shortName}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5">
                Bên bán: <span className="text-gray-200 font-medium">{effectiveInvoice.nbten}</span> (MST: <span className="text-amber-300 font-bold">{effectiveInvoice.nbmst}</span>)
              </p>
            </div>
          </div>

          {/* Center Navigation & Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Prev / Next buttons */}
            {allInvoices.length > 1 && (
              <div className="flex items-center bg-gray-900 rounded-lg border border-gray-700 p-0.5 text-xs text-gray-300">
                <button
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="p-1 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  title="Hóa đơn trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-[11px] font-mono text-gray-400">
                  {currentIndex + 1}/{allInvoices.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="p-1 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  title="Hóa đơn tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950 flex justify-center items-start">
          <div className="w-full flex flex-col items-center">
            {/* Paper A4 container */}
            <div 
              className="flex justify-center"
              style={{
                width: '820px',
                minHeight: '1160px',
              }}
            >
                <div className="w-[820px] min-h-[1160px] bg-white rounded shadow-2xl overflow-hidden border border-gray-300">
                  <iframe
                    ref={iframeRef}
                    srcDoc={originalEasyInvoiceHtml || standaloneHtml}
                    title={originalEasyInvoiceHtml ? 'Bản gốc EasyInvoice' : 'Bản Thể Hiện Hóa Đơn Điện Tử'}
                    className="w-full h-[1200px] border-0 bg-white"
                    sandbox="allow-same-origin allow-scripts allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-forms"
                  />
                </div>
              </div>

              {/* Item count status confirmation pill below */}
              <div className="mt-4 text-center text-xs text-gray-400 font-mono">
                {originalEasyInvoiceHtml ? (
                  <>Bản thể hiện <span className="text-emerald-400 font-bold">gốc từ EasyInvoice</span> • </>
                ) : (
                  <>Bản thể hiện mẫu <span className="text-emerald-400 font-bold">{currentProviderMeta.name}</span> • </>
                )}
                Đã nạp <span className="text-white font-bold">{safeItems.length}</span> dòng hàng hóa • 
                Ký hiệu: <span className="text-amber-400">{effectiveInvoice.khhdon}</span> • 
                Số HĐ: <span className="text-cyan-400">{effectiveInvoice.shdon}</span>
              </div>
            </div>
        </div>

        {/* Footer Actions Bar */}
        <div className="bg-[#0f172a] border-t border-gray-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>HĐĐT Chuẩn Tổng cục Thuế (NĐ 123/2020/NĐ-CP & TT 78/2021/TT-BTC)</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isEasyInvoice ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleViewOriginalEasyInvoice}
                  disabled={isDownloadingEasyInvoice}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border-emerald-600 hover:border-emerald-500 ring-1 ring-emerald-500/30 transition-all cursor-pointer shadow-xs disabled:opacity-60"
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
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white rounded-md border border-gray-700 transition-colors cursor-pointer"
                    title="Mở cổng tra cứu EasyInvoice (Đã dán sẵn mã FKey)"
                  >
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                    <span>Mở Cổng</span>
                  </a>
                )}
              </div>
            ) : directLookupUrl && (
              <a
                href={directLookupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border transition-all cursor-pointer shadow-xs ${
                  isMisaInvoice
                    ? 'text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border-emerald-600 hover:border-emerald-500 ring-1 ring-emerald-500/30'
                    : isViettelInvoice
                    ? 'text-red-300 bg-red-950/70 hover:bg-red-900 border-red-600 hover:border-red-500 ring-1 ring-red-500/30'
                    : 'text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-700'
                }`}
                title={isMisaInvoice 
                  ? `Tải hóa đơn gốc từ Cổng MISA meInvoice (Mã tra cứu: ${lookupDetails.lookupCode || ''})` 
                  : isViettelInvoice
                  ? `Tra cứu Viettel S-Invoice (Tự động điền MST người bán ${effectiveInvoice?.nbmst || ''} & Mã bí mật ${lookupDetails.lookupCode || ''})`
                  : `Mở cổng tra cứu hóa đơn trực tiếp (${currentProviderMeta.name})`}
              >
                <ExternalLink className={`w-3.5 h-3.5 ${isMisaInvoice ? 'text-emerald-400' : isViettelInvoice ? 'text-red-400' : 'text-cyan-400'}`} />
                <span>{isMisaInvoice ? 'Tải hóa đơn gốc' : isViettelInvoice ? 'Tra cứu Viettel S-Invoice' : 'Tra cứu Cổng NCC'}</span>
              </a>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 transition-colors cursor-pointer"
              title="In trực tiếp ra máy in hoặc Lưu dưới dạng PDF chuẩn trình duyệt (Ctrl + P)"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>In HĐ (Ctrl+P)</span>
            </button>

            <button
              onClick={handleDownloadHtmlFile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 rounded-md border border-emerald-700 transition-colors cursor-pointer"
              title="Tải tệp HTML độc lập về máy tính"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Tải File HTML (.html)</span>
            </button>

            <button
              onClick={() => onDownloadXml(effectiveInvoice)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 transition-colors cursor-pointer"
              title="Tải tệp XML gốc để kê khai thuế hoặc lưu trữ"
            >
              <FileCode2 className="w-3.5 h-3.5 text-[#ef4444]" />
              <span>Tải XML Gốc</span>
            </button>

            <button
              onClick={handleDownloadPdfFile}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#ef4444] hover:bg-red-600 rounded-md transition-colors shadow-md disabled:opacity-50 cursor-pointer"
              title={`Tải tệp PDF sắc nét theo mẫu ${currentProviderMeta.name}`}
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPdf ? 'Đang tạo PDF...' : `Tải File PDF (.pdf)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
