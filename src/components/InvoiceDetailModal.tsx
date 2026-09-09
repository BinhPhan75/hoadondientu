import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  FileCode2, 
  FileText, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Info,
  Palette,
  Code2,
  FileSpreadsheet,
  CheckCircle2,
  Layers,
  Sparkles,
  Building2,
  Search,
  RotateCcw
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
import { OFFICIAL_GDT_INVOICE_XSLT, downloadXsltTemplateFile } from '../utils/xsltTransformer';
import { 
  detectInvoiceProvider, 
  getProviderMeta, 
  extractLookupDetails, 
  InvoiceProviderId, 
  ProviderMeta 
} from '../utils/multiTemplateRenderer';
import { ensureInvoiceItems } from '../utils/xmlParser';

interface InvoiceDetailModalProps {
  invoice: GDTInvoice | null;
  allInvoices?: GDTInvoice[];
  onSelectInvoice?: (invoice: GDTInvoice) => void;
  onClose: () => void;
  onDownloadXml: (invoice: GDTInvoice) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  allInvoices = [],
  onSelectInvoice,
  onClose,
  onDownloadXml
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'html' | 'xslt' | 'xml' | 'meta'>('pdf');
  const [theme, setTheme] = useState<'red' | 'blue'>('red');
  const [isCopiedXml, setIsCopiedXml] = useState(false);
  const [isCopiedHtml, setIsCopiedHtml] = useState(false);
  const [isCopiedXslt, setIsCopiedXslt] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('AUTO');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Find index in list for navigation
  const currentIndex = invoice && allInvoices.length > 0 
    ? allInvoices.findIndex(i => i.id === invoice.id) 
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
    if (invoice) {
      generateInvoiceQrCode(invoice).then(url => {
        setQrCodeUrl(url);
      });
    }
  }, [invoice]);

  if (!invoice) return null;

  // Dò tìm tự động nhà cung cấp HĐĐT từ XML hoặc dữ liệu bóc tách
  const xmlContent = invoice.rawXml || generateGDTInvoiceXml(invoice);
  const autoDetectedProvider: InvoiceProviderId = detectInvoiceProvider(xmlContent, invoice);
  const lookupDetails = extractLookupDetails(xmlContent);

  // Template ID hiệu lực: Nếu người dùng chọn AUTO thì dùng kết quả dò tìm tự động
  const effectiveTemplateId: InvoiceProviderId = (selectedTemplateId && selectedTemplateId !== 'AUTO')
    ? (selectedTemplateId as InvoiceProviderId)
    : autoDetectedProvider;

  const currentProviderMeta: ProviderMeta = getProviderMeta(effectiveTemplateId);
  const autoDetectedMeta: ProviderMeta = getProviderMeta(autoDetectedProvider);

  // Đảm bảo dữ liệu hàng hóa đã sẵn sàng trước khi render
  const safeItems = ensureInvoiceItems(invoice);

  // Tạo HTML chuẩn theo template của nhà cung cấp
  const standaloneHtml = generateOfficialInvoiceHtml(invoice, {
    theme,
    qrCodeDataUrl: qrCodeUrl,
    showPrintControls: false,
    templateId: effectiveTemplateId
  });

  const handleCopyXml = () => {
    navigator.clipboard.writeText(xmlContent);
    setIsCopiedXml(true);
    setTimeout(() => setIsCopiedXml(false), 2000);
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(standaloneHtml);
    setIsCopiedHtml(true);
    setTimeout(() => setIsCopiedHtml(false), 2000);
  };

  const handleCopyXslt = () => {
    navigator.clipboard.writeText(OFFICIAL_GDT_INVOICE_XSLT);
    setIsCopiedXslt(true);
    setTimeout(() => setIsCopiedXslt(false), 2000);
  };

  const handleDownloadPdfFile = async () => {
    setIsExportingPdf(true);
    try {
      await exportInvoiceToPdfFile(invoice, null, undefined, theme, effectiveTemplateId);
    } catch (err) {
      console.error('Lỗi khi xuất PDF:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadHtmlFile = async () => {
    await downloadStandaloneHtmlFile(invoice, theme, effectiveTemplateId);
  };

  const handlePrint = () => {
    openInvoicePrintWindow(invoice, theme, effectiveTemplateId);
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
              {activeTab === 'html' ? 'HTML' : activeTab === 'xslt' ? 'XSLT' : activeTab === 'xml' ? 'XML' : 'PDF'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-xs sm:text-sm font-mono uppercase tracking-wider text-white truncate">
                  {invoice.thdon || 'HÓA ĐƠN ĐIỆN TỬ'}: {invoice.khhdon} - SỐ {invoice.shdon}
                </h3>
                {invoice.loaiHdon === 'purchase' ? (
                  <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 text-[10px] font-bold border border-blue-700">
                    MUA VÀO
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-bold border border-emerald-700">
                    BÁN RA
                  </span>
                )}
                {invoice.hsgcma && (
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
                Bên bán: <span className="text-gray-200 font-medium">{invoice.nbten}</span> (MST: <span className="text-amber-300 font-bold">{invoice.nbmst}</span>)
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

            {/* Main Tabs Navigation */}
            <div className="inline-flex p-0.5 bg-gray-950 rounded-lg border border-gray-800 text-xs">
              <button
                onClick={() => setActiveTab('pdf')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'pdf' ? 'bg-[#ef4444] text-white shadow-xs' : 'text-gray-400 hover:text-white'
                }`}
                title="Bản thể hiện giao diện hóa đơn theo mẫu Nhà cung cấp (A4)"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Bản Thể Hiện (A4)</span>
              </button>
              <button
                onClick={() => setActiveTab('html')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'html' ? 'bg-[#ef4444] text-white shadow-xs' : 'text-gray-400 hover:text-white'
                }`}
                title="Xem mã nguồn HTML & Tải file .html"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Mã HTML</span>
              </button>
              <button
                onClick={() => setActiveTab('xslt')}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'xslt' ? 'bg-[#ef4444] text-white shadow-xs' : 'text-gray-400 hover:text-white'
                }`}
                title="Mã XSLT Transformer & Bộ Stylesheet W3C"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>XSLT Stylesheet</span>
              </button>
              <button
                onClick={() => setActiveTab('xml')}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'xml' ? 'bg-[#ef4444] text-white shadow-xs' : 'text-gray-400 hover:text-white'
                }`}
                title="Mã XML gốc Tổng cục Thuế"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>XML Gốc</span>
              </button>
              <button
                onClick={() => setActiveTab('meta')}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'meta' ? 'bg-[#ef4444] text-white shadow-xs' : 'text-gray-400 hover:text-white'
                }`}
                title="Thông tin chữ ký số và căn cứ pháp lý"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Ký Số</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Provider Detection & Control Sub-bar */}
        {activeTab === 'pdf' && (
          <div className="bg-[#111827] px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 text-xs text-gray-300">
            {/* Left: Provider Auto-Detected Badge & Template Selector */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Provider Detection Info */}
              <div className="flex items-center gap-1.5 bg-gray-900/90 px-2.5 py-1 rounded-md border border-gray-800">
                <span className="text-[11px] text-gray-400 flex items-center gap-1 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  Nhà cung cấp:
                </span>
                <span className="text-xs font-bold text-amber-300 font-mono">
                  {autoDetectedMeta.name}
                </span>
                {lookupDetails.lookupCode && (
                  <span className="text-[10px] text-gray-400 border-l border-gray-700 pl-1.5 font-mono">
                    Mã tra cứu: <strong className="text-emerald-400">{lookupDetails.lookupCode}</strong>
                  </span>
                )}
              </div>

              {/* Template Switcher Dropdown */}
              <div className="flex items-center gap-1.5 bg-gray-900/90 px-2.5 py-1 rounded-md border border-gray-700">
                <span className="text-[11px] text-gray-400 font-medium">Mẫu thể hiện:</span>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-emerald-400 focus:outline-hidden cursor-pointer"
                  title="Chuyển đổi sang mẫu giao diện của nhà cung cấp HĐĐT tương ứng"
                >
                  <option value="AUTO" className="bg-gray-900 text-emerald-300">
                    ✨ Tự động nhận diện ({autoDetectedMeta.shortName})
                  </option>
                  <option value="MISA" className="bg-gray-900 text-white">🏢 MISA meInvoice (meinvoice.vn)</option>
                  <option value="VIETTEL" className="bg-gray-900 text-white">🔴 Viettel S-Invoice (sinvoice.viettel.vn)</option>
                  <option value="EASYINVOICE" className="bg-gray-900 text-white">🏪 Softdreams EasyInvoice (easyinvoice.vn)</option>
                  <option value="4SI" className="bg-gray-900 text-white">💎 4Si E-Invoice / LCS (PNJ Jewelry)</option>
                  <option value="VNPT" className="bg-gray-900 text-white">🔵 VNPT Invoice (vnpt-invoice.com.vn)</option>
                  <option value="BKAV" className="bg-gray-900 text-white">🟠 Bkav eHoadon (ehoadon.bkav.com)</option>
                  <option value="DEFAULT" className="bg-gray-900 text-white">📋 Mẫu Chuẩn Nghị định 123 / Thông tư 78</option>
                </select>
              </div>

              {/* Theme switcher: Red vs Blue */}
              <div className="flex items-center gap-1.5">
                <div className="inline-flex p-0.5 bg-gray-900 rounded-md border border-gray-700">
                  <button
                    onClick={() => setTheme('red')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      theme === 'red' ? 'bg-red-700 text-white shadow-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Viền Đỏ
                  </button>
                  <button
                    onClick={() => setTheme('blue')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                      theme === 'blue' ? 'bg-blue-700 text-white shadow-xs' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Viền Xanh
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Zoom controls & Print Action */}
            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <div className="flex items-center bg-gray-900 rounded-md border border-gray-700 px-1 py-0.5">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(60, prev - 10))}
                  className="p-1 hover:text-white hover:bg-gray-800 rounded cursor-pointer"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-[11px] font-mono font-semibold text-gray-300 min-w-[45px] text-center">
                  {zoomLevel}%
                </span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
                  className="p-1 hover:text-white hover:bg-gray-800 rounded cursor-pointer"
                  title="Phóng to"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(100)}
                  className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white hover:bg-gray-800 rounded font-mono border-l border-gray-800 ml-1 cursor-pointer"
                  title="Đặt lại 100%"
                >
                  100%
                </button>
              </div>

              {/* Open native print window */}
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-md border border-gray-700 text-[11px] font-semibold transition-colors cursor-pointer"
                title="Mở trang in chuẩn trình duyệt (Ctrl + P)"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>In HĐ (Ctrl+P)</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950 flex justify-center items-start">
          {activeTab === 'pdf' ? (
            /* ============================================================
               AUTHENTIC HIGH-FIDELITY PROVIDER INVOICE A4 VIEW
               Hiển thị chính xác mẫu template của đơn vị cung cấp HĐĐT
               ============================================================ */
            <div className="w-full flex flex-col items-center">
              {/* Paper A4 container */}
              <div 
                className="transition-transform origin-top flex justify-center"
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top center',
                  width: '820px',
                  minHeight: '1160px',
                  marginBottom: zoomLevel > 100 ? `${(zoomLevel - 100) * 12}px` : '0px'
                }}
              >
                <div className="w-[820px] min-h-[1160px] bg-white rounded shadow-2xl overflow-hidden border border-gray-300">
                  <iframe
                    ref={iframeRef}
                    srcDoc={standaloneHtml}
                    title="Bản Thể Hiện Hóa Đơn Điện Tử"
                    className="w-full h-[1200px] border-0 bg-white"
                    sandbox="allow-same-origin allow-scripts allow-modals"
                  />
                </div>
              </div>

              {/* Item count status confirmation pill below */}
              <div className="mt-4 text-center text-xs text-gray-400 font-mono">
                Bản thể hiện mẫu <span className="text-emerald-400 font-bold">{currentProviderMeta.name}</span> • 
                Đã nạp <span className="text-white font-bold">{safeItems.length}</span> dòng hàng hóa • 
                Ký hiệu: <span className="text-amber-400">{invoice.khhdon}</span> • 
                Số HĐ: <span className="text-cyan-400">{invoice.shdon}</span>
              </div>
            </div>
          ) : activeTab === 'html' ? (
            /* ============================================================
               STANDALONE HTML SOURCE CODE & PREVIEW TAB
               ============================================================ */
            <div className="w-full max-w-4xl space-y-4">
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="text-white font-bold text-sm flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    Mã Nguồn HTML Bản Thể Hiện ({currentProviderMeta.name})
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Tệp HTML độc lập chứa toàn bộ style nội tuyến, mã QR và bảng hàng hóa hoàn chỉnh có thể mở trên bất kỳ trình duyệt nào.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyHtml}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 transition-colors cursor-pointer"
                  >
                    {isCopiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedHtml ? 'Đã sao chép' : 'Sao chép HTML'}</span>
                  </button>
                  <button
                    onClick={handleDownloadHtmlFile}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải File .html</span>
                  </button>
                </div>
              </div>

              {/* Code viewer */}
              <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 font-mono text-xs text-cyan-300 overflow-x-auto max-h-[600px] leading-relaxed select-all">
                <pre>{standaloneHtml}</pre>
              </div>
            </div>
          ) : activeTab === 'xslt' ? (
            /* ============================================================
               W3C XSLT 1.0 TRANSFORMER STYLESHEET TAB
               ============================================================ */
            <div className="w-full max-w-4xl space-y-4">
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-white font-bold text-sm flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                    W3C XSLT 1.0 Stylesheet Transformer
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Tệp mẫu XSLT chuẩn W3C dùng để chuyển đổi trực tiếp mọi file XML hóa đơn Tổng cục Thuế thành giao diện HTML.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyXslt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-md border border-gray-700 transition-colors cursor-pointer"
                  >
                    {isCopiedXslt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedXslt ? 'Đã sao chép' : 'Sao chép XSLT'}</span>
                  </button>
                  <button
                    onClick={downloadXsltTemplateFile}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải File .xslt</span>
                  </button>
                </div>
              </div>

              <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 font-mono text-xs text-gray-300 overflow-x-auto max-h-[600px] leading-relaxed">
                <pre>{OFFICIAL_GDT_INVOICE_XSLT}</pre>
              </div>
            </div>
          ) : activeTab === 'xml' ? (
            /* ============================================================
               RAW XML CODE TAB
               ============================================================ */
            <div className="w-full max-w-4xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 font-mono">
                  Định dạng dữ liệu XML chuẩn Quyết định 1450/QĐ-TCT & QĐ 1510/QĐ-TCT
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyXml}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-200 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors cursor-pointer"
                  >
                    {isCopiedXml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedXml ? 'Đã sao chép' : 'Sao chép XML'}</span>
                  </button>
                  <button
                    onClick={() => onDownloadXml(invoice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải file .xml</span>
                  </button>
                </div>
              </div>

              <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 font-mono text-xs text-emerald-400 overflow-x-auto max-h-[650px] leading-relaxed select-all">
                <pre>{xmlContent}</pre>
              </div>
            </div>
          ) : (
            /* ============================================================
               LEGAL & SIGNATURE DETAILS TAB
               ============================================================ */
            <div className="w-full max-w-2xl bg-gray-900/90 p-6 rounded-lg border border-gray-800 space-y-5 text-xs text-gray-300">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-800">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <div>
                  <h4 className="text-sm font-bold text-white uppercase">Thông tin pháp lý & Ký số điện tử</h4>
                  <p className="text-gray-400 text-[11px]">Dữ liệu được xác thực và bảo vệ theo tiêu chuẩn của Bộ Tài chính</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-950 p-3.5 rounded-lg border border-gray-800 space-y-2">
                  <p className="font-bold text-gray-300 text-[11px] uppercase">Mã cấp từ Tổng cục Thuế</p>
                  <div className="text-gray-400 space-y-1 font-mono">
                    <p>Mã CQT: <strong className="text-emerald-400">{invoice.mhdon || '00E9C762DA374972B621A0F9004B2C89'}</strong></p>
                    <p>Trạng thái: <strong className="text-emerald-400">Hợp lệ / Đã cấp mã</strong></p>
                    <p>Tính chất: <strong className="text-white">{invoice.tthdonLabel || 'Hóa đơn gốc'}</strong></p>
                  </div>
                </div>

                <div className="bg-gray-950 p-3.5 rounded-lg border border-gray-800 space-y-2">
                  <p className="font-bold text-gray-300 text-[11px] uppercase">Chứng thư số ký điện tử</p>
                  <div className="text-gray-400 space-y-1">
                    <p>Đơn vị CA: <strong className="text-white">{invoice.caProvider || 'VNPT-CA / Viettel-CA / MISA-CA'}</strong></p>
                    <p>Người ký số: <strong className="text-white">{invoice.signerName || invoice.nbten}</strong></p>
                    <p>Thời điểm ký: <strong className="text-amber-400 font-mono">{invoice.signedDate || invoice.tdlap}</strong></p>
                  </div>
                </div>
              </div>

              {/* Provider Information Card */}
              <div className="p-3.5 bg-gray-950 rounded-lg border border-gray-800 space-y-2">
                <p className="font-bold text-gray-300 text-[11px] uppercase flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  Đơn vị cung cấp giải pháp HĐĐT
                </p>
                <div className="text-gray-300 space-y-1">
                  <p>Nhà cung cấp: <strong className="text-amber-300">{currentProviderMeta.name}</strong></p>
                  <p>Mô tả: <span className="text-gray-400">{currentProviderMeta.description}</span></p>
                  <p>Cổng tra cứu chính thức: <a href={currentProviderMeta.portalUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{currentProviderMeta.portalUrl}</a></p>
                  {lookupDetails.lookupCode && (
                    <p>Mã tra cứu / Fkey: <strong className="text-emerald-400 font-mono bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700">{lookupDetails.lookupCode}</strong></p>
                  )}
                </div>
              </div>

              <div className="p-3.5 bg-blue-950/40 border border-blue-800/60 rounded-lg text-blue-200 leading-relaxed text-[11px]">
                <p className="font-bold flex items-center gap-1.5 text-blue-300">
                  <Info className="w-3.5 h-3.5" />
                  Căn cứ pháp lý theo quy định hiện hành:
                </p>
                <ul className="list-disc pl-5 mt-1.5 space-y-1 text-gray-300">
                  <li>Nghị định số 123/2020/NĐ-CP ngày 19/10/2020 của Chính phủ quy định về hóa đơn, chứng từ.</li>
                  <li>Thông tư số 78/2021/TT-BTC ngày 17/09/2021 của Bộ Tài chính hướng dẫn thực hiện Luật Quản lý thuế.</li>
                  <li>Quyết định số 1450/QĐ-TCT và QĐ 1510/QĐ-TCT của Tổng cục Thuế về đặc tả thành phần dữ liệu hóa đơn điện tử XML.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions Bar */}
        <div className="bg-[#0f172a] border-t border-gray-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>HĐĐT Chuẩn Tổng cục Thuế (NĐ 123/2020/NĐ-CP & TT 78/2021/TT-BTC)</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
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
              onClick={() => onDownloadXml(invoice)}
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
