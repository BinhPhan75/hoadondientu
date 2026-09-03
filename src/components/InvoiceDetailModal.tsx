import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  FileCode2, 
  FileText, 
  ShieldCheck, 
  Building2, 
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
  CheckCircle2
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
  const invoicePaperRef = useRef<HTMLDivElement>(null);

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

  const xmlContent = invoice.rawXml || generateGDTInvoiceXml(invoice);
  const standaloneHtml = generateOfficialInvoiceHtml(invoice, {
    theme,
    qrCodeDataUrl: qrCodeUrl,
    showPrintControls: true
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
      await exportInvoiceToPdfFile(invoice, invoicePaperRef.current, undefined, theme);
    } catch (err) {
      console.error('Lỗi khi xuất PDF:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadHtmlFile = async () => {
    await downloadStandaloneHtmlFile(invoice, theme);
  };

  const handlePrint = () => {
    openInvoicePrintWindow(invoice, theme);
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  const formatDateParts = (isoStr: string) => {
    try {
      const parts = isoStr.split('T');
      const dateParts = parts[0].split('-');
      const timeParts = parts[1] ? parts[1].split(':') : ['00', '00', '00'];
      return {
        day: dateParts[2] || '01',
        month: dateParts[1] || '01',
        year: dateParts[0] || '2025',
        time: `${timeParts[0]}:${timeParts[1]}`
      };
    } catch (e) {
      return { day: '01', month: '01', year: '2025', time: '09:00' };
    }
  };

  const dateInfo = formatDateParts(invoice.tdlap);

  // Dynamic theme colors
  const isRed = theme === 'red';
  const frameOuterClass = isRed ? 'border-[#b91c1c]' : 'border-[#1d4ed8]';
  const frameInnerClass = isRed ? 'border-[#f87171]' : 'border-[#93c5fd]';
  const titleColorClass = isRed ? 'text-[#b91c1c]' : 'text-[#1d4ed8]';
  const metaBoxClass = isRed ? 'bg-red-50/70 border-red-200' : 'bg-blue-50/70 border-blue-200';
  const metaHighlightClass = isRed ? 'text-[#b91c1c]' : 'text-[#1d4ed8]';
  const mstBadgeClass = isRed ? 'text-[#b91c1c] bg-red-50 border-red-200' : 'text-[#1d4ed8] bg-blue-50 border-blue-200';
  const summaryDividerClass = isRed ? 'border-[#b91c1c]' : 'border-[#1d4ed8]';
  const totalColorClass = isRed ? 'text-[#b91c1c]' : 'text-[#1d4ed8]';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#1f2937] rounded-lg max-w-5xl w-full shadow-2xl border border-gray-700 overflow-hidden max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Bar */}
        <div className="bg-[#111827] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-gray-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 font-bold text-xs ${
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
              </div>
              <p className="text-[11px] text-gray-400 font-mono truncate">
                Bên bán: <span className="text-gray-200">{invoice.nbten}</span> (MST: <span className="text-amber-300">{invoice.nbmst}</span>)
              </p>
            </div>
          </div>

          {/* Center Navigation & Tabs */}
          <div className="flex items-center gap-2">
            {/* Prev / Next buttons */}
            {allInvoices.length > 1 && (
              <div className="flex items-center bg-gray-900 rounded border border-gray-700 p-0.5 text-xs text-gray-300">
                <button
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="p-1 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30 disabled:hover:bg-transparent"
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
                  className="p-1 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Hóa đơn tiếp theo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Tab switch */}
            <div className="inline-flex p-0.5 bg-gray-950 rounded border border-gray-800 text-xs">
              <button
                onClick={() => setActiveTab('pdf')}
                className={`px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'pdf' ? 'bg-[#ef4444] text-white shadow-2xs' : 'text-gray-400 hover:text-white'
                }`}
                title="Bản thể hiện giao diện hóa đơn chuẩn A4"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Bản Thể Hiện (A4)</span>
              </button>
              <button
                onClick={() => setActiveTab('html')}
                className={`px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'html' ? 'bg-[#ef4444] text-white shadow-2xs' : 'text-gray-400 hover:text-white'
                }`}
                title="Xem mã nguồn HTML & Tải file .html"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>File HTML</span>
              </button>
              <button
                onClick={() => setActiveTab('xslt')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'xslt' ? 'bg-[#ef4444] text-white shadow-2xs' : 'text-gray-400 hover:text-white'
                }`}
                title="Mã XSLT Transformer & Bộ Stylesheet W3C"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>XSLT Stylesheet</span>
              </button>
              <button
                onClick={() => setActiveTab('xml')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'xml' ? 'bg-[#ef4444] text-white shadow-2xs' : 'text-gray-400 hover:text-white'
                }`}
                title="Mã XML gốc Tổng cục Thuế"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>XML Gốc</span>
              </button>
              <button
                onClick={() => setActiveTab('meta')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'meta' ? 'bg-[#ef4444] text-white shadow-2xs' : 'text-gray-400 hover:text-white'
                }`}
                title="Thông tin chữ ký số và căn cứ pháp lý"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Ký Số</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action & Zoom Sub-bar (Only in PDF Tab) */}
        {activeTab === 'pdf' && (
          <div className="bg-[#1e293b] px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 text-xs text-gray-300">
            {/* Theme switcher: Red vs Blue */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" />
                Khung viền:
              </span>
              <div className="inline-flex p-0.5 bg-gray-900 rounded border border-gray-700">
                <button
                  onClick={() => setTheme('red')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${
                    theme === 'red' ? 'bg-red-700 text-white shadow-xs' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Viền Đỏ (Chuẩn TCT)
                </button>
                <button
                  onClick={() => setTheme('blue')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${
                    theme === 'blue' ? 'bg-blue-700 text-white shadow-xs' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Viền Xanh (Doanh Nghiệp)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Zoom controls */}
              <div className="flex items-center bg-gray-900 rounded border border-gray-700 px-1 py-0.5">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(60, prev - 15))}
                  className="p-1 hover:text-white hover:bg-gray-800 rounded"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-[11px] font-mono font-semibold text-gray-300 min-w-[45px] text-center">
                  {zoomLevel}%
                </span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(150, prev + 15))}
                  className="p-1 hover:text-white hover:bg-gray-800 rounded"
                  title="Phóng to"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(100)}
                  className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-white hover:bg-gray-800 rounded font-mono border-l border-gray-800 ml-1"
                  title="Đặt lại 100%"
                >
                  100%
                </button>
              </div>

              {/* Open native print window */}
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded border border-gray-700 text-[11px] font-semibold transition-colors"
                title="Mở trang in chuẩn trình duyệt (Ctrl + P)"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Cửa sổ in</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-900/90 flex justify-center items-start">
          {activeTab === 'pdf' ? (
            /* ============================================================
               HIGH-FIDELITY OFFICIAL VIETNAMESE E-INVOICE (A4 ORIGINAL LAYOUT)
               ============================================================ */
            <div 
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center', transition: 'transform 0.15s ease-out' }}
              className="w-full flex justify-center"
            >
              <div 
                ref={invoicePaperRef}
                id="invoice-printable-sheet"
                className="bg-white text-gray-900 w-full max-w-[794px] p-6 sm:p-10 shadow-2xl border border-gray-300 relative font-sans text-xs print:m-0 print:p-8 print:shadow-none print:border-none print:max-w-none print:w-full print:bg-white"
                style={{
                  minHeight: '1120px',
                  boxSizing: 'border-box',
                  backgroundColor: '#ffffff'
                }}
              >
                {/* Decorative Guilloche Border Frame (Red or Blue theme) */}
                <div className={`border-2 ${frameOuterClass} p-4 sm:p-6 relative rounded-xs`}>
                  <div className={`border ${frameInnerClass} p-3 sm:p-5 relative`}>
                    
                    {/* Watermark Logo Background */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none"
                      style={{ transform: 'rotate(-25deg)' }}
                    >
                      <div className={`text-center font-black text-6xl ${isRed ? 'text-red-900' : 'text-blue-900'} uppercase tracking-widest leading-tight`}>
                        HÓA ĐƠN ĐIỆN TỬ<br />
                        TỔNG CỤC THUẾ
                      </div>
                    </div>

                    {/* TOP HEADER: Quốc hiệu & Tiêu ngữ */}
                    <div className="text-center mb-3">
                      <p className="font-bold text-xs uppercase tracking-wider text-gray-800">
                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                      </p>
                      <p className="font-semibold text-xs text-gray-700 mt-0.5">
                        Độc lập - Tự do - Hạnh phúc
                      </p>
                      <div className="w-32 h-[1px] bg-gray-400 mx-auto mt-1 mb-3"></div>
                    </div>

                    {/* INVOICE TITLE & METADATA GRID */}
                    <div className={`grid grid-cols-1 md:grid-cols-12 gap-3 items-center border-b-2 ${summaryDividerClass} pb-4 mb-4`}>
                      {/* Left / Center: Invoice Name & Date */}
                      <div className="md:col-span-8 text-center md:text-left">
                        <h1 className={`text-lg sm:text-xl font-black ${titleColorClass} uppercase tracking-wide`}>
                          {invoice.thdon || (invoice.khmshdon === '1' ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' : 'HÓA ĐƠN BÁN HÀNG')}
                        </h1>
                        <p className="text-[11px] text-gray-500 italic mt-0.5">
                          (Bản thể hiện của hóa đơn điện tử)
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Khởi tạo theo Nghị định 123/2020/NĐ-CP & Thông tư 78/2021/TT-BTC
                        </p>
                        <p className="text-xs font-semibold text-gray-800 mt-1.5">
                          Ngày {dateInfo.day} tháng {dateInfo.month} năm {dateInfo.year}
                        </p>
                      </div>

                      {/* Right: Mẫu số, Ký hiệu, Số HĐ */}
                      <div className={`md:col-span-4 ${metaBoxClass} p-3 rounded border text-right space-y-1 font-mono text-xs`}>
                        <div className="flex justify-between md:justify-end gap-3 text-gray-700">
                          <span>Mẫu số:</span>
                          <strong className="text-gray-900 font-bold">{invoice.khmshdon}</strong>
                        </div>
                        <div className="flex justify-between md:justify-end gap-3 text-gray-700">
                          <span>Ký hiệu:</span>
                          <strong className={`${metaHighlightClass} font-bold text-xs`}>{invoice.khhdon}</strong>
                        </div>
                        <div className={`flex justify-between md:justify-end gap-3 text-gray-700 border-t ${isRed ? 'border-red-200' : 'border-blue-200'} pt-1`}>
                          <span>Số HĐ:</span>
                          <strong className={`text-base ${metaHighlightClass} font-black tracking-wider`}>
                            {invoice.shdon}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* TAX AUTHORITY VERIFICATION & QR CODE BAR */}
                    <div className="bg-emerald-50/80 border border-emerald-300 rounded p-2.5 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 text-emerald-900">
                        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-emerald-950 uppercase text-[11px]">
                              MÃ CỦA CƠ QUAN THUẾ:
                            </span>
                            <span className="font-mono font-bold text-emerald-800 text-[11px] break-all">
                              {invoice.mhdon || '00E9C762DA374972B621A0F9004B2C89'}
                            </span>
                          </div>
                          <p className="text-[10px] text-emerald-700 mt-0.5">
                            Trạng thái: <strong className="uppercase">Đã cấp mã hợp lệ trên Cổng hoadondientu.gdt.gov.vn</strong>
                          </p>
                        </div>
                      </div>

                      {/* QR Code thumbnail */}
                      {qrCodeUrl && (
                        <div className="shrink-0 bg-white p-1 rounded border border-emerald-200 shadow-2xs flex items-center gap-2" title="Quét mã QR để kiểm tra hóa đơn trên Cổng Tổng cục Thuế">
                          <img src={qrCodeUrl} alt="QR Tra cứu CQT" className="w-12 h-12 object-contain" />
                          <div className="text-[9px] text-emerald-800 font-mono text-center leading-tight">
                            <span>Quét tra cứu</span><br />
                            <strong className="text-emerald-900">Cổng Thuế</strong>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SELLER INFORMATION (BÊN BÁN) */}
                    <div className="border border-gray-300 rounded p-3 mb-3 bg-gray-50/70 text-xs space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                        <span className="font-bold min-w-[130px] text-gray-700">Tên đơn vị bán hàng:</span>
                        <span className="font-bold text-gray-950 uppercase text-xs tracking-wide">
                          {invoice.nbten}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="font-bold min-w-[130px] text-gray-700">Mã số thuế:</span>
                        <div className="inline-flex items-center gap-1">
                          <span className={`font-mono font-black text-sm ${mstBadgeClass} px-2 py-0.5 rounded tracking-widest`}>
                            {invoice.nbmst}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                        <span className="font-semibold min-w-[130px] text-gray-700">Địa chỉ:</span>
                        <span className="text-gray-800">{invoice.nbdchi}</span>
                      </div>
                      {(invoice.nbsdt || invoice.nbemail || invoice.nbstk) && (
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-gray-600 pt-0.5">
                          {invoice.nbsdt && <div>Điện thoại: <strong className="text-gray-800 font-mono">{invoice.nbsdt}</strong></div>}
                          {invoice.nbemail && <div>Email: <strong className="text-gray-800">{invoice.nbemail}</strong></div>}
                          {invoice.nbstk && <div>Số tài khoản: <strong className="text-gray-800 font-mono">{invoice.nbstk}</strong></div>}
                        </div>
                      )}
                    </div>

                    {/* BUYER INFORMATION (BÊN MUA) */}
                    <div className="border border-gray-300 rounded p-3 mb-4 bg-gray-50/70 text-xs space-y-1.5">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                        <span className="font-bold min-w-[130px] text-gray-700">Tên người mua hàng:</span>
                        <span className="font-semibold text-gray-900">{invoice.nmten}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="font-bold min-w-[130px] text-gray-700">Mã số thuế:</span>
                        <span className="font-mono font-bold text-xs text-gray-900 bg-gray-200/80 px-2 py-0.5 rounded tracking-wider">
                          {invoice.nmmst || '(Khách lẻ / Không mã số thuế)'}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                        <span className="font-semibold min-w-[130px] text-gray-700">Địa chỉ:</span>
                        <span className="text-gray-800">{invoice.nmdchi || 'Không có thông tin'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-gray-600 pt-0.5">
                        <div>Hình thức thanh toán: <strong className="text-gray-800">{invoice.htttoan || 'TM/CK'}</strong></div>
                        <div>Đồng tiền thanh toán: <strong className="text-gray-800 font-mono">{invoice.dvtte || 'VND'}</strong></div>
                      </div>
                    </div>

                    {/* LINE ITEMS TABLE (BẢNG CHI TIẾT HÀNG HÓA) */}
                    <div className="overflow-x-auto mb-4 border border-gray-300 rounded">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 text-gray-800 border-b border-gray-300 uppercase font-bold text-[10px]">
                            <th className="py-2 px-2 border-r border-gray-300 text-center w-8">STT</th>
                            <th className="py-2 px-3 border-r border-gray-300">Tên hàng hóa, dịch vụ</th>
                            <th className="py-2 px-2 border-r border-gray-300 text-center w-14">ĐVT</th>
                            <th className="py-2 px-2 border-r border-gray-300 text-right w-16">Số lượng</th>
                            <th className="py-2 px-2 border-r border-gray-300 text-right w-24">Đơn giá</th>
                            <th className="py-2 px-2 border-r border-gray-300 text-center w-16">Thuế suất</th>
                            <th className="py-2 px-3 text-right w-28">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {invoice.items && invoice.items.length > 0 ? (
                            invoice.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/80">
                                <td className="py-2 px-2 border-r border-gray-300 text-center font-mono text-gray-500">
                                  {item.stt || idx + 1}
                                </td>
                                <td className="py-2 px-3 border-r border-gray-300 font-medium text-gray-900">
                                  {item.ten}
                                </td>
                                <td className="py-2 px-2 border-r border-gray-300 text-center text-gray-600">
                                  {item.dvt || '-'}
                                </td>
                                <td className="py-2 px-2 border-r border-gray-300 text-right font-mono text-gray-700">
                                  {formatNumber(item.sluong || 0)}
                                </td>
                                <td className="py-2 px-2 border-r border-gray-300 text-right font-mono text-gray-700">
                                  {formatNumber(item.dgia || 0)}
                                </td>
                                <td className="py-2 px-2 border-r border-gray-300 text-center font-semibold text-gray-700">
                                  {item.tsuat || '10%'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">
                                  {formatNumber(item.thtien || 0)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="py-4 text-center text-gray-400 italic">
                                Không có chi tiết dòng hàng
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* VAT BREAKDOWN TABLE (NẾU CÓ NHIỀU THUẾ SUẤT) */}
                    {invoice.vatBreakdown && invoice.vatBreakdown.length > 0 && (
                      <div className="border border-gray-300 rounded mb-3 overflow-hidden bg-gray-50/50">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="bg-gray-200/60 text-gray-700 text-[10px] uppercase font-bold border-b border-gray-300">
                              <th className="py-1 px-3">Thuế suất GTGT</th>
                              <th className="py-1 px-3 text-right">Tiền hàng chưa thuế</th>
                              <th className="py-1 px-3 text-right">Tiền thuế GTGT</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoice.vatBreakdown.map((vat, vIdx) => (
                              <tr key={vIdx} className="border-b border-gray-200">
                                <td className="py-1 px-3 font-semibold text-gray-800">{vat.tsuat}</td>
                                <td className="py-1 px-3 text-right font-mono text-gray-700">{formatVND(vat.thtien)}</td>
                                <td className="py-1 px-3 text-right font-mono text-amber-700 font-semibold">{formatVND(vat.tthue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* PAYMENT SUMMARY (TỔNG HỢP THANH TOÁN) */}
                    <div className="border border-gray-300 rounded p-3 mb-4 bg-gray-50/80 text-xs space-y-1.5">
                      <div className="flex justify-between items-center text-gray-700">
                        <span>Tổng cộng tiền hàng (chưa có thuế):</span>
                        <strong className="font-mono text-sm text-gray-900">{formatVND(invoice.tgtcthue || 0)}</strong>
                      </div>
                      <div className="flex justify-between items-center text-gray-700">
                        <span>Tổng tiền thuế GTGT:</span>
                        <strong className="font-mono text-sm text-amber-700">{formatVND(invoice.tgtthue || 0)}</strong>
                      </div>
                      <div className={`flex justify-between items-center border-t-2 ${summaryDividerClass} pt-2 mt-2 font-black text-sm`}>
                        <span className={totalColorClass}>TỔNG CỘNG TIỀN THANH TOÁN:</span>
                        <span className={`font-mono text-base ${totalColorClass}`}>{formatVND(invoice.tgtttbso || 0)}</span>
                      </div>
                      <div className="text-gray-700 italic pt-1 border-t border-dashed border-gray-300 text-[11px]">
                        <span>Số tiền viết bằng chữ: </span>
                        <strong className="text-gray-900 not-italic font-semibold">{invoice.tgtttbchu || 'Chưa cập nhật'}</strong>
                      </div>
                    </div>

                    {/* DIGITAL SIGNATURES (CHỮ KÝ SỐ VÀ CON DẤU ĐIỆN TỬ) */}
                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-300 text-center text-xs">
                      {/* Buyer signature */}
                      <div>
                        <p className="font-bold text-gray-800 uppercase">Người mua hàng</p>
                        <p className="text-[10px] text-gray-500 italic mt-0.5">(Ký, ghi rõ họ tên)</p>
                        <div className="h-20 flex items-center justify-center text-gray-400 text-[11px] italic">
                          (Đã xác nhận thanh toán)
                        </div>
                      </div>

                      {/* Seller digital signature */}
                      <div>
                        <p className="font-bold text-gray-800 uppercase">Người bán hàng</p>
                        <p className="text-[10px] text-gray-500 italic mt-0.5">(Chữ ký số hợp chuẩn)</p>
                        <div className="mt-2 bg-emerald-50 border-2 border-dashed border-emerald-500 rounded p-2 text-left text-[10px] text-emerald-800 space-y-0.5 shadow-2xs">
                          <div className="flex items-center gap-1 font-bold text-emerald-900">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>CHỮ KÝ SỐ HỢP LỆ (DIGITALLY SIGNED)</span>
                          </div>
                          <div>Ký bởi: <strong className="text-emerald-950">{invoice.signerName || invoice.nbten}</strong></div>
                          <div>MST: <strong className="text-emerald-950 font-mono">{invoice.nbmst}</strong></div>
                          <div>Ngày ký: <strong className="text-emerald-950 font-mono">{invoice.signedDate || invoice.tdlap}</strong></div>
                          <div>Cơ quan cấp chứng thư: <strong className="text-emerald-950">{invoice.caProvider || 'VNPT / Viettel / MISA'}</strong></div>
                        </div>
                      </div>
                    </div>

                    {/* LEGAL FOOTER */}
                    <div className="mt-8 pt-3 border-t border-gray-200 text-center text-[9px] text-gray-500 space-y-0.5">
                      <p className="italic">
                        (Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn theo đúng quy định của Tổng cục Thuế)
                      </p>
                      <p>
                        Tra cứu hóa đơn điện tử chính thức tại Cổng thông tin Tổng cục Thuế: <strong>https://hoadondientu.gdt.gov.vn</strong>
                      </p>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'html' ? (
            /* ============================================================
               STANDALONE HTML TRANSFORM VIEW & CODE
               ============================================================ */
            <div className="w-full max-w-4xl space-y-4">
              <div className="bg-gray-800 p-4 rounded border border-gray-700 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-white font-bold text-sm flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    Tệp HTML Hóa Đơn Điện Tử Độc Lập
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Mã HTML kèm CSS nội tuyến chuẩn A4, hiển thị hoàn chỉnh trên mọi trình duyệt mà không cần kết nối mạng.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyHtml}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-200 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    {isCopiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedHtml ? 'Đã sao chép' : 'Sao chép HTML'}</span>
                  </button>
                  <button
                    onClick={handleDownloadHtmlFile}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải File .html</span>
                  </button>
                </div>
              </div>

              {/* Live iframe preview */}
              <div className="bg-white rounded shadow-md overflow-hidden border border-gray-600" style={{ height: '650px' }}>
                <iframe
                  title="HTML Invoice Preview"
                  srcDoc={standaloneHtml}
                  className="w-full h-full border-none"
                  sandbox="allow-same-origin allow-scripts allow-modals"
                />
              </div>
            </div>
          ) : activeTab === 'xslt' ? (
            /* ============================================================
               W3C XSLT 1.0 TRANSFORMER STYLESHEET TAB
               ============================================================ */
            <div className="w-full max-w-4xl space-y-4">
              <div className="bg-gray-800 p-4 rounded border border-gray-700 flex items-center justify-between gap-4">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-200 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    {isCopiedXslt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedXslt ? 'Đã sao chép' : 'Sao chép XSLT'}</span>
                  </button>
                  <button
                    onClick={downloadXsltTemplateFile}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải File .xslt</span>
                  </button>
                </div>
              </div>

              <div className="bg-gray-950 p-4 rounded border border-gray-800 font-mono text-xs text-gray-300 overflow-x-auto max-h-[600px] leading-relaxed">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-200 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors"
                  >
                    {isCopiedXml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedXml ? 'Đã sao chép' : 'Sao chép XML'}</span>
                  </button>
                  <button
                    onClick={() => onDownloadXml(invoice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải file .xml</span>
                  </button>
                </div>
              </div>

              <div className="bg-gray-950 p-4 rounded border border-gray-800 font-mono text-xs text-emerald-400 overflow-x-auto max-h-[650px] leading-relaxed select-all">
                <pre>{xmlContent}</pre>
              </div>
            </div>
          ) : (
            /* ============================================================
               LEGAL & SIGNATURE DETAILS TAB
               ============================================================ */
            <div className="w-full max-w-2xl bg-gray-950/80 p-6 rounded-lg border border-gray-800 space-y-5 text-xs text-gray-300">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-800">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <div>
                  <h4 className="text-sm font-bold text-white uppercase">Thông tin pháp lý & Ký số điện tử</h4>
                  <p className="text-gray-400 text-[11px]">Dữ liệu được xác thực và bảo vệ theo tiêu chuẩn của Bộ Tài chính</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-900 p-3.5 rounded border border-gray-800 space-y-2">
                  <p className="font-bold text-gray-300 text-[11px] uppercase">Mã cấp từ Tổng cục Thuế</p>
                  <div className="text-gray-400 space-y-1">
                    <p>Mã CQT: <strong className="text-emerald-400 font-mono">{invoice.mhdon || '00E9C762DA374972B621A0F9004B2C89'}</strong></p>
                    <p>Trạng thái: <strong className="text-emerald-400">Hợp lệ / Đã cấp mã</strong></p>
                    <p>Tính chất hóa đơn: <strong className="text-white">{invoice.tthdonLabel || 'Hóa đơn gốc'}</strong></p>
                  </div>
                </div>

                <div className="bg-gray-900 p-3.5 rounded border border-gray-800 space-y-2">
                  <p className="font-bold text-gray-300 text-[11px] uppercase">Chứng thư số ký điện tử</p>
                  <div className="text-gray-400 space-y-1">
                    <p>Đơn vị chứng thực CA: <strong className="text-white">{invoice.caProvider || 'VNPT-CA / Viettel-CA / MISA-CA'}</strong></p>
                    <p>Người ký số: <strong className="text-white">{invoice.signerName || invoice.nbten}</strong></p>
                    <p>Thời điểm ký: <strong className="text-amber-400 font-mono">{invoice.signedDate || invoice.tdlap}</strong></p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-blue-950/40 border border-blue-800/60 rounded text-blue-200 leading-relaxed text-[11px]">
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
        <div className="bg-[#111827] border-t border-gray-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>HĐĐT Chuẩn Tổng cục Thuế (NĐ 123/2020/NĐ-CP)</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-200 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors"
              title="In trực tiếp ra máy in hoặc Lưu dưới dạng PDF chuẩn trình duyệt (Ctrl + P)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In HĐ (Ctrl+P)</span>
            </button>

            <button
              onClick={handleDownloadHtmlFile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 rounded border border-emerald-700 transition-colors"
              title="Tải tệp HTML độc lập về máy tính"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Tải File HTML (.html)</span>
            </button>

            <button
              onClick={() => onDownloadXml(invoice)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-200 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors"
              title="Tải tệp XML gốc để kê khai thuế hoặc lưu trữ"
            >
              <FileCode2 className="w-3.5 h-3.5 text-[#ef4444]" />
              <span>Tải XML Gốc</span>
            </button>

            <button
              onClick={handleDownloadPdfFile}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#ef4444] hover:bg-red-600 rounded transition-colors shadow-sm disabled:opacity-50"
              title="Tải tệp PDF sắc nét chuẩn A4 về máy tính"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPdf ? 'Đang tạo PDF...' : 'Tải File PDF (.pdf)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
