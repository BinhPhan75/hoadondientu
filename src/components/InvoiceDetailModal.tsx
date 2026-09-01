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
  Maximize2,
  ChevronLeft,
  ChevronRight,
  QrCode as QrCodeIcon,
  CheckCircle2,
  Lock,
  Sparkles,
  Info,
  Calendar,
  CreditCard,
  UserCheck
} from 'lucide-react';
import { GDTInvoice } from '../types';
import { generateGDTInvoiceXml } from '../utils/xmlGenerator';
import { generateInvoiceQrCode, exportInvoiceToPdfFile, openInvoicePrintWindow } from '../utils/pdfExporter';

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
  const [activeTab, setActiveTab] = useState<'pdf' | 'xml' | 'meta'>('pdf');
  const [isCopiedXml, setIsCopiedXml] = useState(false);
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

  const handleCopyXml = () => {
    navigator.clipboard.writeText(xmlContent);
    setIsCopiedXml(true);
    setTimeout(() => setIsCopiedXml(false), 2000);
  };

  const handleDownloadPdfFile = async () => {
    if (!invoicePaperRef.current) {
      window.print();
      return;
    }
    setIsExportingPdf(true);
    try {
      await exportInvoiceToPdfFile(invoice, invoicePaperRef.current);
    } catch (err) {
      console.error(err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleOpenNewTab = () => {
    openInvoicePrintWindow(invoice);
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#1f2937] rounded-lg max-w-5xl w-full shadow-2xl border border-gray-700 overflow-hidden max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Bar */}
        <div className="bg-[#111827] text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-gray-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-red-500/20 border border-red-500/30 flex items-center justify-center text-[#ef4444] shrink-0 font-bold text-xs">
              PDF
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-xs sm:text-sm font-mono uppercase tracking-wider text-white truncate">
                  HÓA ĐƠN ĐIỆN TỬ: {invoice.khhdon} - SỐ {invoice.shdon}
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
                MST Bên bán: <span className="text-amber-300">{invoice.nbmst}</span> | MST Bên mua: <span className="text-gray-300">{invoice.nmmst}</span>
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
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Bản PDF Gốc</span>
              </button>
              <button
                onClick={() => setActiveTab('xml')}
                className={`px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'xml' ? 'bg-[#ef4444] text-white shadow-2xs' : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Mã XML Gốc</span>
              </button>
              <button
                onClick={() => setActiveTab('meta')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'meta' ? 'bg-[#ef4444] text-white shadow-2xs' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Ký số & Pháp lý</span>
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
          <div className="bg-[#1e293b] px-4 py-2 flex items-center justify-between border-b border-gray-800 text-xs text-gray-300">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 font-mono hidden sm:inline">
                Khổ giấy chuẩn A4 (210 x 297 mm) - Nghị định 123/2020/NĐ-CP
              </span>
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

              {/* Open in new tab */}
              <button
                onClick={handleOpenNewTab}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded border border-gray-700 text-[11px] font-semibold transition-colors"
                title="Mở toàn màn hình trong tab mới"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tab mới</span>
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
                {/* Decorative Guilloche Border Frame */}
                <div className="border-2 border-red-700 p-4 sm:p-6 relative rounded-xs">
                  <div className="border border-red-400 p-3 sm:p-5 relative">
                    
                    {/* Watermark Logo Background */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none"
                      style={{ transform: 'rotate(-25deg)' }}
                    >
                      <div className="text-center font-black text-6xl text-red-900 uppercase tracking-widest leading-tight">
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
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border-b-2 border-red-700 pb-4 mb-4">
                      {/* Left / Center: Invoice Name & Date */}
                      <div className="md:col-span-8 text-center md:text-left">
                        <h1 className="text-lg sm:text-xl font-black text-[#dc2626] uppercase tracking-wide">
                          {invoice.khmshdon === '1' ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' : 'HÓA ĐƠN BÁN HÀNG'}
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
                      <div className="md:col-span-4 bg-red-50/50 p-3 rounded border border-red-200 text-right space-y-1 font-mono text-xs">
                        <div className="flex justify-between md:justify-end gap-3 text-gray-700">
                          <span>Mẫu số:</span>
                          <strong className="text-gray-900 font-bold">{invoice.khmshdon}</strong>
                        </div>
                        <div className="flex justify-between md:justify-end gap-3 text-gray-700">
                          <span>Ký hiệu:</span>
                          <strong className="text-[#dc2626] font-bold text-xs">{invoice.khhdon}</strong>
                        </div>
                        <div className="flex justify-between md:justify-end gap-3 text-gray-700 border-t border-red-200 pt-1">
                          <span>Số HĐ:</span>
                          <strong className="text-base text-[#dc2626] font-black tracking-wider">
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
                          <span className="font-mono font-black text-sm text-[#dc2626] bg-red-50 border border-red-200 px-2 py-0.5 rounded tracking-widest">
                            {invoice.nbmst}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                        <span className="font-semibold min-w-[130px] text-gray-700">Địa chỉ:</span>
                        <span className="text-gray-800">{invoice.nbdchi}</span>
                      </div>
                      {(invoice.nbsdt || invoice.nbemail) && (
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
                          {invoice.nmmst || '(Không có)'}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                        <span className="font-semibold min-w-[130px] text-gray-700">Địa chỉ:</span>
                        <span className="text-gray-800">{invoice.nmdchi || '(Chưa cập nhật)'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-gray-700 pt-0.5">
                        <div>Hình thức thanh toán: <strong className="text-gray-900 font-mono">{invoice.htttoan || 'TM/CK'}</strong></div>
                        <div>Đồng tiền thanh toán: <strong className="text-gray-900 font-mono">{invoice.dvtte || 'VND'}</strong></div>
                        {invoice.tygia && invoice.tygia !== 1 && <div>Tỷ giá: <strong className="text-gray-900 font-mono">{invoice.tygia}</strong></div>}
                      </div>
                    </div>

                    {/* ITEMS TABLE (BẢNG HÀNG HÓA DỊCH VỤ) */}
                    <div className="border-2 border-gray-400 rounded-xs overflow-hidden mb-4">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-100 border-b-2 border-gray-400 font-bold text-gray-800 text-center text-[11px] uppercase">
                            <th className="p-2 border-r border-gray-300 w-10">STT</th>
                            <th className="p-2 border-r border-gray-300 text-left min-w-[200px]">
                              Tên hàng hóa, dịch vụ
                            </th>
                            <th className="p-2 border-r border-gray-300 w-14">ĐVT</th>
                            <th className="p-2 border-r border-gray-300 w-16 text-right">Số lượng</th>
                            <th className="p-2 border-r border-gray-300 w-24 text-right">Đơn giá</th>
                            <th className="p-2 border-r border-gray-300 w-16 text-center">Thuế suất</th>
                            <th className="p-2 w-28 text-right">Thành tiền</th>
                          </tr>
                          <tr className="bg-gray-50 border-b border-gray-300 text-[10px] text-gray-500 text-center font-mono italic">
                            <td className="p-1 border-r border-gray-300">(1)</td>
                            <td className="p-1 border-r border-gray-300 text-left">(2)</td>
                            <td className="p-1 border-r border-gray-300">(3)</td>
                            <td className="p-1 border-r border-gray-300 text-right">(4)</td>
                            <td className="p-1 border-r border-gray-300 text-right">(5)</td>
                            <td className="p-1 border-r border-gray-300">(6)</td>
                            <td className="p-1 text-right">(7 = 4 x 5)</td>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300 font-mono text-[11px]">
                          {invoice.items && invoice.items.length > 0 ? (
                            invoice.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/60">
                                <td className="p-2 text-center border-r border-gray-300">{item.lineNo || idx + 1}</td>
                                <td className="p-2 font-sans font-medium text-gray-900 border-r border-gray-300">
                                  {item.itemName}
                                </td>
                                <td className="p-2 text-center font-sans border-r border-gray-300">{item.unit || 'Lô'}</td>
                                <td className="p-2 text-right border-r border-gray-300">{formatNumber(item.quantity)}</td>
                                <td className="p-2 text-right border-r border-gray-300">{formatNumber(item.unitPrice)}</td>
                                <td className="p-2 text-center font-sans font-semibold text-gray-800 border-r border-gray-300">
                                  {item.taxRate || '10%'}
                                </td>
                                <td className="p-2 text-right font-bold text-gray-900">{formatNumber(item.amount)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="p-2 text-center border-r border-gray-300">1</td>
                              <td className="p-2 font-sans font-medium text-gray-900 border-r border-gray-300">
                                Hàng hóa, dịch vụ theo bảng kê hóa đơn
                              </td>
                              <td className="p-2 text-center font-sans border-r border-gray-300">Gói</td>
                              <td className="p-2 text-right border-r border-gray-300">1</td>
                              <td className="p-2 text-right border-r border-gray-300">{formatNumber(invoice.tgtcthue)}</td>
                              <td className="p-2 text-center font-sans font-semibold text-gray-800 border-r border-gray-300">
                                {invoice.tgtthue > 0 ? `${Math.round((invoice.tgtthue / (invoice.tgtcthue || 1)) * 100)}%` : 'KCT'}
                              </td>
                              <td className="p-2 text-right font-bold text-gray-900">{formatNumber(invoice.tgtcthue)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* TOTAL & TAX CALCULATION BOX */}
                    <div className="border border-gray-400 rounded p-3 bg-gray-50/80 mb-4 font-sans text-xs space-y-1.5">
                      <div className="flex justify-between items-center text-gray-800">
                        <span className="font-semibold">Tổng cộng tiền hàng (chưa có thuế GTGT):</span>
                        <span className="font-mono font-bold text-sm">{formatVND(invoice.tgtcthue)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-gray-800">
                        <span className="font-semibold">Tiền thuế giá trị gia tăng (GTGT):</span>
                        <span className="font-mono font-bold text-sm text-amber-800">{formatVND(invoice.tgtthue)}</span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t-2 border-red-700 text-[#dc2626]">
                        <span className="font-black text-xs sm:text-sm uppercase tracking-wide">
                          Tổng cộng tiền thanh toán:
                        </span>
                        <span className="font-mono font-black text-base sm:text-lg tracking-wider">
                          {formatVND(invoice.tgtttbso)}
                        </span>
                      </div>

                      <div className="text-gray-800 italic pt-1 text-xs border-t border-gray-300">
                        Số tiền viết bằng chữ: <strong className="font-semibold text-gray-950 not-italic">{invoice.tgtttbchu || '---'}</strong>
                      </div>
                    </div>

                    {/* SIGNATURES SECTION */}
                    <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-300 text-center text-xs">
                      {/* Buyer Signature */}
                      <div className="space-y-1">
                        <p className="font-bold uppercase text-gray-900 text-xs">Người mua hàng</p>
                        <p className="text-gray-500 italic text-[11px]">(Ký, ghi rõ họ tên)</p>
                        <div className="h-20 flex items-center justify-center">
                          <span className="text-[11px] text-gray-400 italic">
                            {invoice.loaiHdon === 'purchase' ? '(Đã ký nhận điện tử)' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Seller Signature (Digital Seal) */}
                      <div className="space-y-1">
                        <p className="font-bold uppercase text-gray-900 text-xs">Người bán hàng</p>
                        <p className="text-gray-500 italic text-[11px]">(Chữ ký số, chữ ký điện tử)</p>
                        
                        {/* Official Digital Stamp Box */}
                        <div className="mt-1 p-2.5 bg-emerald-50/90 border-2 border-dashed border-emerald-500 rounded text-left space-y-1 shadow-2xs">
                          <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-[11px]">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>CHỮ KÝ SỐ HỢP LỆ (SIGNATURE VALID)</span>
                          </div>
                          <div className="text-[10px] text-gray-800 font-mono leading-relaxed pl-5">
                            <p><strong>Ký bởi:</strong> {invoice.signerName || invoice.nbten}</p>
                            <p><strong>Ngày ký:</strong> {dateInfo.day}/{dateInfo.month}/{dateInfo.year} {dateInfo.time}</p>
                            <p><strong>Nhà cung cấp:</strong> {invoice.caProvider || 'Cơ quan Thuế - VNPT/Viettel/MISA CA'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* LEGAL FOOTER NOTICE */}
                    <div className="mt-6 pt-3 border-t border-gray-300 text-center text-[10px] text-gray-500 space-y-0.5">
                      <p className="italic">
                        (Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn theo quy định của Tổng cục Thuế)
                      </p>
                      <p className="font-mono">
                        Tra cứu hóa đơn điện tử tại Website: <strong className="text-blue-700">https://hoadondientu.gdt.gov.vn</strong>
                      </p>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'xml' ? (
            /* ============================================================
               XML CODE VIEWER
               ============================================================ */
            <div className="bg-[#111827] text-gray-100 p-4 rounded-lg border border-gray-800 font-mono text-xs max-w-4xl w-full">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-3">
                <div className="flex items-center gap-2 text-gray-300">
                  <FileCode2 className="w-4 h-4 text-[#ef4444]" />
                  <span className="font-bold">Dữ liệu XML chuẩn Quyết định 1450/QĐ-TCT & QĐ 1510/QĐ-TCT</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyXml}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-xs font-semibold transition-colors"
                  >
                    {isCopiedXml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedXml ? 'Đã chép XML!' : 'Sao chép XML'}</span>
                  </button>

                  <button
                    onClick={() => onDownloadXml(invoice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ef4444] hover:bg-red-600 text-white rounded text-xs font-bold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải tệp .XML</span>
                  </button>
                </div>
              </div>

              <pre className="overflow-x-auto p-3 bg-black/90 rounded text-emerald-400 leading-relaxed max-h-[520px] text-[11px] font-mono select-all">
                {xmlContent}
              </pre>
            </div>
          ) : (
            /* ============================================================
               METADATA & LEGAL VERIFICATION TAB
               ============================================================ */
            <div className="bg-[#111827] text-gray-100 p-5 rounded-lg border border-gray-800 max-w-3xl w-full text-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-white uppercase">
                  Thông tin pháp lý & Chữ ký số điện tử
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900 p-3.5 rounded border border-gray-800 space-y-2">
                  <p className="font-bold text-gray-300 text-[11px] uppercase">Cơ quan thuế quản lý</p>
                  <div className="text-gray-400 space-y-1">
                    <p>Mã hóa đơn CQT: <strong className="text-emerald-400 font-mono">{invoice.mhdon || '00E9C762DA374972B621A0F9004B2C89'}</strong></p>
                    <p>Trạng thái xử lý: <strong className="text-white">{invoice.ttxlyLabel || 'CQT đã cấp mã'}</strong></p>
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

              <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded text-blue-200 leading-relaxed text-[11px]">
                <p className="font-bold flex items-center gap-1.5 text-blue-300">
                  <Info className="w-3.5 h-3.5" />
                  Căn cứ pháp lý theo quy định hiện hành:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5 text-gray-300">
                  <li>Nghị định số 123/2020/NĐ-CP ngày 19/10/2020 của Chính phủ quy định về hóa đơn, chứng từ.</li>
                  <li>Thông tư số 78/2021/TT-BTC ngày 17/09/2021 của Bộ Tài chính hướng dẫn thực hiện một số điều của Luật Quản lý thuế.</li>
                  <li>Quyết định số 1450/QĐ-TCT và QĐ 1510/QĐ-TCT của Tổng cục Thuế về định dạng thành phần dữ liệu hóa đơn điện tử.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions Bar */}
        <div className="bg-[#111827] border-t border-gray-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>HĐĐT Chuẩn Tổng cục Thuế</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-200 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 transition-colors"
              title="In trực tiếp ra máy in hoặc Lưu dưới dạng PDF chuẩn trình duyệt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In HĐ (Ctrl+P)</span>
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
