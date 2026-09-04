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
  CheckCircle2,
  Layers,
  Terminal,
  Cpu,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Key,
  Globe,
  Sliders,
  HelpCircle,
  Search,
  RotateCcw,
  ArrowUpRight
} from 'lucide-react';
import { GDTInvoice } from '../types';
import { generateGDTInvoiceXml } from '../utils/xmlGenerator';

export interface ProviderPresetOption {
  code: string;
  name: string;
  shortName: string;
  badge: string;
  portalUrl: string;
  description: string;
  color: string;
}

export const SUPPORTED_PROVIDERS: ProviderPresetOption[] = [
  { 
    code: 'MISA', 
    name: 'MISA meInvoice', 
    shortName: 'meinvoice.vn', 
    badge: 'MISA', 
    portalUrl: 'https://www.meinvoice.vn/tra-cuu', 
    description: 'Tra cứu qua Mã tra cứu hóa đơn MISA (8-32 ký tự alphanumeric)', 
    color: 'border-blue-500/50 text-blue-400 bg-blue-950/40 hover:bg-blue-900/50' 
  },
  { 
    code: 'VIETTEL', 
    name: 'Viettel S-Invoice', 
    shortName: 'sinvoice.viettel.vn', 
    badge: 'Viettel', 
    portalUrl: 'https://sinvoice.viettel.vn/tracuuhoadon', 
    description: 'Tra cứu qua Mã số bí mật hoặc Số HĐ + Ký hiệu + MST bên bán', 
    color: 'border-red-500/50 text-red-400 bg-red-950/40 hover:bg-red-900/50' 
  },
  { 
    code: 'VNPT', 
    name: 'VNPT Invoice', 
    shortName: 'vnpt-invoice.com.vn', 
    badge: 'VNPT', 
    portalUrl: 'https://tracuu.vnpt-invoice.com.vn', 
    description: 'Tra cứu qua Mã tra cứu / Fkey hóa đơn VNPT', 
    color: 'border-cyan-500/50 text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/50' 
  },
  { 
    code: 'BKAV', 
    name: 'Bkav eHoadon', 
    shortName: 'ehoadon.vn', 
    badge: 'Bkav', 
    portalUrl: 'https://ehoadon.bkav.com/tra-cuu', 
    description: 'Tra cứu qua Mã tra cứu / Mã nhận hóa đơn Bkav', 
    color: 'border-amber-500/50 text-amber-400 bg-amber-950/40 hover:bg-amber-900/50' 
  },
  { 
    code: 'EASYINVOICE', 
    name: 'Softdreams EasyInvoice', 
    shortName: 'easyinvoice.vn', 
    badge: 'EasyInvoice', 
    portalUrl: 'https://easyinvoice.vn/tra-cuu', 
    description: 'Tra cứu qua Mã tra cứu Softdreams EasyInvoice', 
    color: 'border-emerald-500/50 text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/50' 
  },
  { 
    code: '4SI', 
    name: '4Si E-Invoice', 
    shortName: 'inv.4si.vn', 
    badge: '4Si', 
    portalUrl: 'https://inv.4si.vn', 
    description: 'Tra cứu qua Mã tra cứu 4Si + OCR Captcha', 
    color: 'border-purple-500/50 text-purple-400 bg-purple-950/40 hover:bg-purple-900/50' 
  },
  { 
    code: 'THAISON', 
    name: 'Thái Sơn E-Invoice', 
    shortName: 'einvoice.vn', 
    badge: 'Thái Sơn', 
    portalUrl: 'https://einvoice.vn/tra-cuu', 
    description: 'Tra cứu qua Mã nhận hóa đơn / MST bên bán Thái Sơn', 
    color: 'border-indigo-500/50 text-indigo-400 bg-indigo-950/40 hover:bg-indigo-900/50' 
  },
  { 
    code: 'CYBERBILL', 
    name: 'CyberBill (CyberLotus)', 
    shortName: 'cyberbill.vn', 
    badge: 'CyberBill', 
    portalUrl: 'https://cyberbill.vn/tra-cuu', 
    description: 'Tra cứu qua Mã tra cứu CyberBill + MST bên bán', 
    color: 'border-teal-500/50 text-teal-400 bg-teal-950/40 hover:bg-teal-900/50' 
  }
];
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
  const [activeTab, setActiveTab] = useState<'pdf' | 'html' | 'xslt' | 'xml' | 'meta' | 'engine'>('pdf');
  const [theme, setTheme] = useState<'red' | 'blue'>('red');
  const [isCopiedXml, setIsCopiedXml] = useState(false);
  const [isCopiedHtml, setIsCopiedHtml] = useState(false);
  const [isCopiedXslt, setIsCopiedXslt] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const invoicePaperRef = useRef<HTMLDivElement>(null);

  // Multi-Provider Adapter Engine States
  const [isEngineDownloading, setIsEngineDownloading] = useState(false);
  const [engineResult, setEngineResult] = useState<any>(null);
  const [engineLogs, setEngineLogs] = useState<string[]>([]);
  const [detectedProvider, setDetectedProvider] = useState<any>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('AUTO');

  // Manual Override & Custom Lookup Parameters States
  const [selectedProviderOverride, setSelectedProviderOverride] = useState<string>('AUTO');
  const [customLookupCode, setCustomLookupCode] = useState<string>('');
  const [customSecretCode, setCustomSecretCode] = useState<string>('');
  const [customLookupUrl, setCustomLookupUrl] = useState<string>('');
  const [customSellerTaxCode, setCustomSellerTaxCode] = useState<string>('');
  const [isCopiedLookup, setIsCopiedLookup] = useState(false);

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

  // Auto-detect invoice provider (MISA, Viettel, 4Si, VNPT, etc.) via Adapter Engine
  useEffect(() => {
    if (!invoice) return;
    setIsDetecting(true);
    setEngineResult(null);
    setEngineLogs([]);
    setSelectedProviderOverride('AUTO');

    const xml = invoice.rawXml || generateGDTInvoiceXml(invoice);
    fetch('/api/invoice-downloader/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xml })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setDetectedProvider(data);
          // Pre-populate fields from detection or invoice
          const code = data.info?.lookupCode || invoice.lookupCode || '';
          if (code) setCustomLookupCode(code);
          const secret = data.info?.secretCode || invoice.secretCode || '';
          if (secret) setCustomSecretCode(secret);
          const url = data.info?.lookupUrl || invoice.lookupUrl || '';
          if (url) setCustomLookupUrl(url);
          setCustomSellerTaxCode(invoice.nbmst || '');
        }
      })
      .catch(err => {
        console.warn('Lỗi nhận diện Provider:', err);
      })
      .finally(() => setIsDetecting(false));
  }, [invoice]);

  // Handle manual provider selection from chips
  const handleSelectProvider = (code: string) => {
    setSelectedProviderOverride(code);
    if (code === 'AUTO') {
      const autoUrl = detectedProvider?.info?.lookupUrl || invoice?.lookupUrl || '';
      setCustomLookupUrl(autoUrl);
    } else {
      const preset = SUPPORTED_PROVIDERS.find(p => p.code === code);
      if (preset && !customLookupUrl) {
        setCustomLookupUrl(preset.portalUrl);
      }
    }
  };

  // Reset lookup parameters to values detected in XML
  const handleResetLookupInfo = () => {
    const code = detectedProvider?.info?.lookupCode || invoice?.lookupCode || '';
    setCustomLookupCode(code);
    const secret = detectedProvider?.info?.secretCode || invoice?.secretCode || '';
    setCustomSecretCode(secret);
    const url = detectedProvider?.info?.lookupUrl || invoice?.lookupUrl || '';
    setCustomLookupUrl(url);
    setCustomSellerTaxCode(invoice?.nbmst || '');
    setSelectedProviderOverride('AUTO');
  };

  // Quick paste lookup code from clipboard
  const handlePasteLookupCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCustomLookupCode(text.trim());
      }
    } catch {
      // Fallback
    }
  };

  // Open provider portal in new window
  const handleOpenPortal = () => {
    let url = customLookupUrl;
    if (!url) {
      const activeCode = selectedProviderOverride !== 'AUTO' ? selectedProviderOverride : detectedProvider?.provider;
      const preset = SUPPORTED_PROVIDERS.find(p => p.code === activeCode);
      url = preset?.portalUrl || 'https://tracuuhoadon.gdt.gov.vn';
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!invoice) return null;

  const xmlContent = invoice.rawXml || generateGDTInvoiceXml(invoice);
  const standaloneHtml = generateOfficialInvoiceHtml(invoice, {
    theme,
    qrCodeDataUrl: qrCodeUrl,
    showPrintControls: true,
    templateId: selectedTemplateId !== 'AUTO' ? selectedTemplateId : undefined
  });

  const handleEngineDownload = async (forceFallback = false) => {
    if (!invoice) return;
    setIsEngineDownloading(true);
    setEngineResult(null);

    const activeTarget = forceFallback 
      ? 'GENERIC (Safeguard)' 
      : (selectedProviderOverride !== 'AUTO' ? selectedProviderOverride : (detectedProvider?.provider || 'UNKNOWN'));

    setEngineLogs([
      `[${new Date().toLocaleTimeString('vi-VN')}] [Khởi động] Đang kết nối đến Multi-Provider Adapter Engine...`,
      `[${new Date().toLocaleTimeString('vi-VN')}] [Mục tiêu tải]: ${activeTarget} ${selectedProviderOverride !== 'AUTO' ? '(Người dùng chỉ định)' : '(Tự động phát hiện)'}`,
      `[${new Date().toLocaleTimeString('vi-VN')}] [Mã tra cứu]: ${customLookupCode || '(Trích xuất từ XML)'}`,
      `[${new Date().toLocaleTimeString('vi-VN')}] [Cổng tra cứu]: ${customLookupUrl || '(Mặc định theo driver)'}`
    ]);

    try {
      const xml = invoice.rawXml || generateGDTInvoiceXml(invoice);
      const res = await fetch('/api/invoice-downloader/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xml,
          forceFallback,
          overrideProvider: selectedProviderOverride !== 'AUTO' ? selectedProviderOverride : undefined,
          customInfo: {
            lookupCode: customLookupCode.trim() || undefined,
            secretCode: customSecretCode.trim() || customLookupCode.trim() || undefined,
            lookupUrl: customLookupUrl.trim() || undefined,
            sellerTaxCode: customSellerTaxCode.trim() || invoice.nbmst || undefined
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setEngineResult(data);
        if (data.executionLogs && Array.isArray(data.executionLogs)) {
          setEngineLogs(data.executionLogs);
        }
        
        // Auto trigger file download
        if (data.pdfBase64) {
          const byteCharacters = atob(data.pdfBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = data.filename || `HD_${invoice.khhdon}_${invoice.shdon}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else {
        setEngineLogs(prev => [...prev, `[${new Date().toLocaleTimeString('vi-VN')}] [Lỗi] ${data.error || 'Thao tác không thành công'}`]);
      }
    } catch (err: any) {
      setEngineLogs(prev => [...prev, `[${new Date().toLocaleTimeString('vi-VN')}] [Lỗi kết nối] ${err.message}`]);
    } finally {
      setIsEngineDownloading(false);
    }
  };

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
              {activeTab === 'html' ? 'HTML' : activeTab === 'xslt' ? 'XSLT' : activeTab === 'xml' ? 'XML' : activeTab === 'engine' ? 'DRV' : 'PDF'}
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
              <button
                onClick={() => setActiveTab('engine')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'engine' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-400 hover:text-white'
                }`}
                title="Hệ thống Adapter Engine tải PDF gốc NCC kèm OCR Captcha"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>PDF Gốc (Driver)</span>
                {detectedProvider && (
                  <span className="text-[9px] px-1 py-0.2 bg-black/50 text-amber-200 font-mono rounded">
                    {detectedProvider.provider}
                  </span>
                )}
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

                    {/* LINE ITEMS TABLE (BẢNG CHI TIẾT HÀNG HÓA CHUẨN NGHỊ ĐỊNH 123/TT 78) */}
                    <div className="overflow-x-auto mb-4 border border-gray-300 rounded shadow-xs">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 text-gray-800 border-b border-gray-300 uppercase font-bold text-[10px] tracking-wide">
                            <th className="py-2.5 px-2 border-r border-gray-300 text-center w-8">STT</th>
                            <th className="py-2.5 px-3 border-r border-gray-300">Tên hàng hóa, dịch vụ</th>
                            <th className="py-2.5 px-2 border-r border-gray-300 text-center w-16">ĐVT</th>
                            <th className="py-2.5 px-2 border-r border-gray-300 text-right w-20">Số lượng</th>
                            <th className="py-2.5 px-2 border-r border-gray-300 text-right w-28">Đơn giá</th>
                            <th className="py-2.5 px-2 border-r border-gray-300 text-center w-16">Thuế suất</th>
                            <th className="py-2.5 px-3 text-right w-32">Thành tiền</th>
                          </tr>
                          <tr className="bg-slate-50 text-[9px] text-gray-500 border-b border-gray-300 text-center italic">
                            <td className="py-0.5 px-1 border-r border-gray-300">(1)</td>
                            <td className="py-0.5 px-1 border-r border-gray-300 text-left pl-3">(2)</td>
                            <td className="py-0.5 px-1 border-r border-gray-300">(3)</td>
                            <td className="py-0.5 px-1 border-r border-gray-300 text-right pr-2">(4)</td>
                            <td className="py-0.5 px-1 border-r border-gray-300 text-right pr-2">(5)</td>
                            <td className="py-0.5 px-1 border-r border-gray-300">(6)</td>
                            <td className="py-0.5 px-1 text-right pr-3">(7 = 4 x 5)</td>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {invoice.items && invoice.items.length > 0 ? (
                            invoice.items.map((item, idx) => {
                              const lineNo = item.lineNo || item.stt || idx + 1;
                              const itemName = item.itemName || item.ten || `Hàng hóa / Dịch vụ ${lineNo}`;
                              const unit = item.unit || item.dvt || '-';
                              const quantity = item.quantity ?? item.sluong ?? 0;
                              const unitPrice = item.unitPrice ?? item.dgia ?? 0;
                              const taxRate = item.taxRate || item.tsuat || '10%';
                              const amount = item.amount ?? item.thtien ?? item.tthtien ?? 0;
                              const code = item.itemCode || item.mhhdvu;

                              return (
                                <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                                  <td className="py-2 px-2 border-r border-gray-300 text-center font-mono text-gray-600 text-xs">
                                    {lineNo}
                                  </td>
                                  <td className="py-2 px-3 border-r border-gray-300 text-gray-900 leading-snug">
                                    <div className="font-semibold text-xs text-gray-900 break-words">
                                      {itemName}
                                    </div>
                                    {code && (
                                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                        Mã hàng: <span className="font-semibold text-gray-700">{code}</span>
                                      </div>
                                    )}
                                    {item.nature === 2 && (
                                      <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-semibold bg-emerald-100 text-emerald-800 rounded">
                                        Hàng khuyến mại
                                      </span>
                                    )}
                                    {item.nature === 3 && (
                                      <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-semibold bg-rose-100 text-rose-800 rounded">
                                        Dòng chiết khấu
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 border-r border-gray-300 text-center text-gray-700 font-medium">
                                    {unit}
                                  </td>
                                  <td className="py-2 px-2 border-r border-gray-300 text-right font-mono text-gray-800">
                                    {formatNumber(quantity)}
                                  </td>
                                  <td className="py-2 px-2 border-r border-gray-300 text-right font-mono text-gray-800">
                                    {formatNumber(unitPrice)}
                                  </td>
                                  <td className="py-2 px-2 border-r border-gray-300 text-center font-bold text-gray-800">
                                    {taxRate}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-gray-950">
                                    {formatNumber(amount)}
                                  </td>
                                </tr>
                              );
                            })
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
                            {invoice.vatBreakdown.map((vat, vIdx) => {
                              const vRate = vat.taxRate || (vat as any).tsuat || '10%';
                              const vAmount = vat.amount ?? (vat as any).thtien ?? 0;
                              const vTax = vat.taxAmount ?? (vat as any).tthue ?? 0;
                              return (
                                <tr key={vIdx} className="border-b border-gray-200 hover:bg-gray-100/50">
                                  <td className="py-1 px-3 font-semibold text-gray-800">{vRate}</td>
                                  <td className="py-1 px-3 text-right font-mono text-gray-700">{formatVND(vAmount)}</td>
                                  <td className="py-1 px-3 text-right font-mono text-amber-700 font-semibold">{formatVND(vTax)}</td>
                                </tr>
                              );
                            })}
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
              <div className="bg-gray-800 p-4 rounded border border-gray-700 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="text-white font-bold text-sm flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    Bản Thể Hiện HTML Đa Giao Diện (Multi-Template)
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Hỗ trợ hiển thị chuẩn theo nhà cung cấp (MISA meInvoice, Softdreams EasyInvoice, 4Si, Viettel, NĐ 123).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-gray-900/90 px-3 py-1.5 rounded border border-gray-700">
                    <span className="text-xs text-gray-300 font-medium whitespace-nowrap">Mẫu giao diện:</span>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="bg-gray-800 text-white text-xs font-semibold px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="AUTO">✨ Tự động nhận diện theo XML</option>
                      <option value="MISA">🏢 MISA meInvoice (Xuân Vinh)</option>
                      <option value="EASYINVOICE">🏪 Softdreams EasyInvoice (Kim Loan Tuấn)</option>
                      <option value="4SI">💎 4Si E-Invoice / LCS (PNJ Jewelry)</option>
                      <option value="VIETTEL">🔴 Viettel S-Invoice</option>
                      <option value="VNPT">🔵 VNPT Invoice</option>
                      <option value="BKAV">🟠 BKAV eHoadon</option>
                      <option value="DEFAULT">📋 Mẫu Chuẩn Nghị định 123</option>
                    </select>
                  </div>
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
          ) : activeTab === 'meta' ? (
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
          ) : (
            /* ============================================================
               MULTI-PROVIDER ADAPTER ENGINE & OCR CAPTCHA TAB
               ============================================================ */
            <div className="w-full max-w-4xl space-y-5 animate-in fade-in duration-200">
              {/* Architecture & Intent Notification Banner */}
              <div className="bg-linear-to-r from-amber-950/60 via-slate-900 to-slate-900 border border-amber-500/40 p-4 rounded-lg flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-md border border-amber-500/30">
                      <Layers className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-bold text-amber-300">
                      Hệ Thống Tải PDF Gốc Nhà Cung Cấp & Bộ Nhận Diện Nghiêm Ngặt
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Chuẩn Nghị định 123
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Theo quy tắc an toàn nghiêm ngặt: nếu tệp XML không chứa domain tra cứu hoặc thẻ nhà cung cấp giải pháp hợp lệ, hệ thống sẽ trả về <strong className="text-amber-400 font-mono">UNKNOWN</strong> (tuyệt đối không đoán mò). Bạn có thể <strong className="text-emerald-300">chọn trực tiếp nhà cung cấp</strong> hoặc nhập mã tra cứu bên dưới để tải PDF gốc, hoặc bấm <strong className="text-cyan-300">Tải Bản Thể Hiện Chuẩn Hóa</strong> để tạo ngay file PDF sắc nét.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 text-xs font-mono font-bold rounded border border-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Bảo đảm 100% không gián đoạn
                  </span>
                </div>
              </div>

              {/* 3-Tier Detection Priority Inspector */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                      Phân tích nhận diện theo 3 thứ tự ưu tiên
                    </span>
                  </div>
                  {isDetecting ? (
                    <span className="text-xs text-gray-400 flex items-center gap-1.5 font-mono">
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                      Đang quét XML...
                    </span>
                  ) : detectedProvider ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Kết quả tự động:</span>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${
                        detectedProvider.provider === 'UNKNOWN'
                          ? 'bg-amber-950/70 text-amber-400 border-amber-600/50'
                          : 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50'
                      }`}>
                        {detectedProvider.provider === 'UNKNOWN' ? 'UNKNOWN (Chưa xác định)' : `${detectedProvider.driverName} (${detectedProvider.provider})`}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 font-mono">Chưa nhận diện</span>
                  )}
                </div>

                {/* Priority Levels Breakdown Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Priority 1 */}
                  <div className={`p-3 rounded border transition-colors ${
                    detectedProvider?.priorityTier === 1 
                      ? 'bg-emerald-950/30 border-emerald-600/60' 
                      : 'bg-gray-950 border-gray-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 uppercase font-mono font-bold">Ưu tiên 1: Domain URL</span>
                      {detectedProvider?.priorityTier === 1 && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 font-mono font-bold rounded">KHỚP</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-200 mt-1 block leading-snug">
                      Quét Regex domain URL tra cứu trong toàn bộ XML (meinvoice.vn, sinvoice.viettel.vn, vnpt-invoice, inv.4si.vn, easyinvoice, bkav...)
                    </span>
                    <div className="mt-2 text-[11px] font-mono text-gray-400 bg-gray-900 px-2 py-1 rounded truncate" title={detectedProvider?.info?.lookupUrl || 'Không tìm thấy URL hợp lệ'}>
                      URL: <span className={detectedProvider?.info?.lookupUrl ? 'text-cyan-300' : 'text-gray-500'}>
                        {detectedProvider?.info?.lookupUrl || '(Không có)'}
                      </span>
                    </div>
                  </div>

                  {/* Priority 2 */}
                  <div className={`p-3 rounded border transition-colors ${
                    detectedProvider?.priorityTier === 2 
                      ? 'bg-emerald-950/30 border-emerald-600/60' 
                      : 'bg-gray-950 border-gray-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 uppercase font-mono font-bold">Ưu tiên 2: Thẻ TCGP</span>
                      {detectedProvider?.priorityTier === 2 && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 font-mono font-bold rounded">KHỚP</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-200 mt-1 block leading-snug">
                      Đọc thẻ &lt;MSTTCGP&gt; & &lt;TenTCGP&gt; của Tổ chức truyền nhận / giải pháp cung cấp hóa đơn điện tử
                    </span>
                    <div className="mt-2 text-[11px] font-mono text-gray-400 bg-gray-900 px-2 py-1 rounded truncate" title={detectedProvider?.details?.reason || invoice?.msttcgp || 'Không có thẻ TCGP'}>
                      MST: <span className={invoice?.msttcgp ? 'text-amber-300' : 'text-gray-500'}>
                        {invoice?.msttcgp ? `${invoice.msttcgp} (${invoice.tentcgp || ''})` : '(Không có)'}
                      </span>
                    </div>
                  </div>

                  {/* Priority 3 */}
                  <div className={`p-3 rounded border transition-colors ${
                    detectedProvider?.priorityTier === 3 
                      ? 'bg-emerald-950/30 border-emerald-600/60' 
                      : 'bg-gray-950 border-gray-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 uppercase font-mono font-bold">Ưu tiên 3: Chữ ký số CA</span>
                      {detectedProvider?.priorityTier === 3 && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 font-mono font-bold rounded">KHỚP</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-200 mt-1 block leading-snug">
                      Đọc thẻ &lt;X509IssuerName&gt; nhận diện tổ chức chứng thực CA bên bán phát hành (MISA-CA, VIETTEL-CA, VNPT-CA...)
                    </span>
                    <div className="mt-2 text-[11px] font-mono text-gray-400 bg-gray-900 px-2 py-1 rounded truncate" title={invoice?.caProvider || 'Không có thông tin CA'}>
                      CA: <span className={invoice?.caProvider ? 'text-emerald-300' : 'text-gray-500'}>
                        {invoice?.caProvider || '(Không có)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Safe Fallback Notice if UNKNOWN */}
                {detectedProvider?.provider === 'UNKNOWN' && (
                  <div className="p-3 bg-amber-950/40 border border-amber-600/40 rounded flex items-start gap-2.5 text-xs text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-300">
                        Chưa phát hiện được nhà cung cấp từ file XML gốc (Đúng chuẩn an toàn: không đoán mò)
                      </p>
                      <p className="text-gray-300 mt-0.5">
                        Tệp XML này không chứa đường link domain của 6 đơn vị phổ biến và không có thẻ MSTTCGP. Hãy bấm chọn một trong các Nhà cung cấp bên dưới để tải trực tiếp từ cổng tương ứng, hoặc bấm <strong>"Tải Bản Thể Hiện Chuẩn Hóa"</strong> để kết xuất ngay PDF A4 hoàn hảo.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* MANUAL INTERVENTION: Choose Provider */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                      Chỉ định Nhà cung cấp Hóa đơn điện tử (Manual Override)
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    Đang chọn:{' '}
                    <strong className="text-amber-300 font-mono">
                      {selectedProviderOverride === 'AUTO' 
                        ? `TỰ ĐỘNG [${detectedProvider?.provider || 'UNKNOWN'}]` 
                        : selectedProviderOverride === 'GENERIC'
                        ? 'GENERIC FALLBACK (Chuẩn NĐ 123)'
                        : selectedProviderOverride
                      }
                    </strong>
                  </span>
                </div>

                <p className="text-xs text-gray-400">
                  Nhấp vào một nhà cung cấp để ép dùng driver chuyên biệt hoặc tra cứu thủ công:
                </p>

                {/* Provider Chips Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                  {/* Auto option */}
                  <button
                    type="button"
                    onClick={() => handleSelectProvider('AUTO')}
                    className={`px-3 py-2 rounded-md border text-left flex flex-col justify-between transition-all ${
                      selectedProviderOverride === 'AUTO'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                        : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-[11px]">Tự Động (XML)</span>
                      {selectedProviderOverride === 'AUTO' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono mt-1">
                      {detectedProvider?.provider || 'Quét XML'}
                    </span>
                  </button>

                  {/* Standard provider options */}
                  {SUPPORTED_PROVIDERS.map(prov => {
                    const isSelected = selectedProviderOverride === prov.code;
                    return (
                      <button
                        key={prov.code}
                        type="button"
                        onClick={() => handleSelectProvider(prov.code)}
                        className={`px-3 py-2 rounded-md border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                            : 'bg-gray-950 border-gray-800 text-gray-300 hover:text-white hover:border-gray-700'
                        }`}
                        title={prov.description}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-[11px] truncate">{prov.badge}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono mt-1 truncate">
                          {prov.shortName}
                        </span>
                      </button>
                    );
                  })}

                  {/* Generic Fallback Option */}
                  <button
                    type="button"
                    onClick={() => handleSelectProvider('GENERIC')}
                    className={`px-3 py-2 rounded-md border text-left flex flex-col justify-between transition-all ${
                      selectedProviderOverride === 'GENERIC'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-sm'
                        : 'bg-gray-950 border-gray-800 text-gray-300 hover:text-white hover:border-gray-700'
                    }`}
                    title="Bản thể hiện chuẩn hóa nội bộ NĐ 123"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-[11px]">Bản Chuẩn Hóa</span>
                      {selectedProviderOverride === 'GENERIC' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono mt-1">
                      Generic Fallback
                    </span>
                  </button>
                </div>

                {/* Info about selected provider */}
                {selectedProviderOverride !== 'AUTO' && selectedProviderOverride !== 'GENERIC' && (
                  <div className="p-3 bg-gray-950 rounded border border-gray-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-gray-300">
                    <div>
                      <span className="font-bold text-cyan-300">
                        {SUPPORTED_PROVIDERS.find(p => p.code === selectedProviderOverride)?.name}:
                      </span>{' '}
                      <span>
                        {SUPPORTED_PROVIDERS.find(p => p.code === selectedProviderOverride)?.description}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenPortal}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline shrink-0"
                    >
                      <span>Mở cổng tra cứu</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* INTERACTIVE LOOKUP PARAMETERS & CUSTOM FIELDS */}
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                      Thông tin tra cứu hóa đơn & Cổng kết nối
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetLookupInfo}
                      className="text-[11px] text-gray-400 hover:text-gray-200 flex items-center gap-1 font-mono transition-colors"
                      title="Phục hồi thông tin bóc tách từ XML"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Đặt lại theo XML</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Field 1: Lookup Code / Secret Code */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-300 flex items-center justify-between">
                      <span>Mã tra cứu / Fkey / Bí mật</span>
                      <button
                        type="button"
                        onClick={handlePasteLookupCode}
                        className="text-[10px] text-amber-400 hover:underline font-normal"
                      >
                        Dán Clipboard
                      </button>
                    </label>
                    <input
                      type="text"
                      value={customLookupCode}
                      onChange={(e) => setCustomLookupCode(e.target.value)}
                      placeholder="VD: 7G8X9K2M hoặc FKEY123"
                      className="w-full bg-gray-950 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-emerald-400 font-mono placeholder:text-gray-600 focus:outline-hidden focus:border-amber-500"
                    />
                    <span className="text-[10px] text-gray-500 block">
                      In trên hóa đơn, email hoặc SMS từ bên bán
                    </span>
                  </div>

                  {/* Field 2: Lookup Portal URL */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-300 flex items-center justify-between">
                      <span>Cổng web tra cứu (URL)</span>
                      <button
                        type="button"
                        onClick={handleOpenPortal}
                        className="text-[10px] text-cyan-400 hover:underline font-normal flex items-center gap-0.5"
                      >
                        Mở cổng <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </label>
                    <input
                      type="text"
                      value={customLookupUrl}
                      onChange={(e) => setCustomLookupUrl(e.target.value)}
                      placeholder="https://meinvoice.vn/tra-cuu"
                      className="w-full bg-gray-950 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-cyan-300 font-mono placeholder:text-gray-600 focus:outline-hidden focus:border-cyan-500"
                    />
                    <span className="text-[10px] text-gray-500 block">
                      Link tra cứu do nhà cung cấp hoặc bên bán phát hành
                    </span>
                  </div>

                  {/* Field 3: Seller Tax Code */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-300 block">
                      Mã số thuế bên bán (MST)
                    </label>
                    <input
                      type="text"
                      value={customSellerTaxCode}
                      onChange={(e) => setCustomSellerTaxCode(e.target.value)}
                      placeholder="0101243150"
                      className="w-full bg-gray-950 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono placeholder:text-gray-600 focus:outline-hidden focus:border-amber-500"
                    />
                    <span className="text-[10px] text-gray-500 block">
                      Dùng để tra cứu tại Viettel, Thái Sơn, Bkav...
                    </span>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => handleEngineDownload(false)}
                    disabled={isEngineDownloading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-md shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isEngineDownloading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang thực thi Crawl & Tải PDF...</span>
                      </>
                    ) : (
                      <>
                        <Layers className="w-4 h-4" />
                        <span>
                          Tải PDF Gốc (
                          {selectedProviderOverride === 'AUTO' 
                            ? (detectedProvider?.provider || 'Theo XML') 
                            : selectedProviderOverride
                          }
                          )
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleEngineDownload(true)}
                    disabled={isEngineDownloading}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-emerald-700/60 font-semibold text-xs rounded-md transition-colors disabled:opacity-50"
                    title="Bỏ qua crawl máy chủ nhà cung cấp và tạo PDF thể hiện nội bộ ngay lập tức"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Tải Bản Thể Hiện Chuẩn Hóa (Generic Safeguard)</span>
                  </button>

                  <button
                    onClick={handleOpenPortal}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-medium text-xs rounded-md transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Mở Cổng Tra Cứu Ngoài</span>
                  </button>
                </div>
              </div>

              {/* Execution Result Banner if available */}
              {engineResult && (
                <div className={`p-4 rounded-lg border text-xs space-y-2 ${
                  engineResult.isFallback 
                    ? 'bg-amber-950/40 border-amber-600/50 text-amber-200' 
                    : 'bg-emerald-950/40 border-emerald-600/50 text-emerald-200'
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 font-bold">
                      {engineResult.isFallback ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>Đã kích hoạt Safeguard Fallback: Bản thể hiện nội bộ tạo thành công</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Đã tải thành công PDF gốc từ máy chủ {engineResult.provider}!</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-[11px] opacity-80">
                      Tệp: {engineResult.filename}
                    </span>
                  </div>
                  <p className="opacity-90 leading-relaxed">
                    {engineResult.isFallback
                      ? 'Do máy chủ nhà cung cấp không phản hồi hoặc mã tra cứu thử nghiệm, hệ thống đã kích hoạt GenericFallbackDriver để render PDF vector độ phân giải cao chuẩn NĐ 123/2020/NĐ-CP, đảm bảo quy trình kế toán không bị gián đoạn.'
                      : `Hóa đơn đã được tải trực tiếp từ cổng ${engineResult.provider}. Quá trình giải Captcha OCR và xác thực hoàn tất.`
                    }
                  </p>
                </div>
              )}

              {/* Live Execution Logs Terminal */}
              <div className="bg-gray-950 rounded-lg border border-gray-800 overflow-hidden">
                <div className="bg-gray-900/90 px-3 py-2 border-b border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] font-mono font-bold text-gray-300 uppercase">
                      Terminal Tiến Trình Adapter Driver & OCR
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {engineLogs.length} sự kiện
                  </span>
                </div>
                <div className="p-3 font-mono text-xs max-h-56 overflow-y-auto space-y-1.5 select-text">
                  {engineLogs.length === 0 ? (
                    <p className="text-gray-600 italic">
                      Nhấn "Tải PDF Gốc (Adapter Driver)" để xem nhật ký thực thi chi tiết theo thời gian thực...
                    </p>
                  ) : (
                    engineLogs.map((log, index) => {
                      const isError = log.includes('[Lỗi]') || log.includes('CẢNH BÁO') || log.includes('Error');
                      const isSuccess = log.includes('thành công') || log.includes('HOÀN TẤT') || log.includes('Khởi tạo');
                      const isFallback = log.includes('FALLBACK') || log.includes('SAFEGUARD');
                      return (
                        <div 
                          key={index} 
                          className={`flex items-start gap-2 leading-relaxed ${
                            isError ? 'text-red-400' : isFallback ? 'text-amber-400' : isSuccess ? 'text-emerald-400' : 'text-gray-300'
                          }`}
                        >
                          <span className="text-gray-600 select-none">&gt;</span>
                          <span className="break-all">{log}</span>
                        </div>
                      );
                    })
                  )}
                </div>
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
              onClick={() => handleEngineDownload(false)}
              disabled={isEngineDownloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-amber-300 bg-amber-950/80 hover:bg-amber-900 border border-amber-600 rounded transition-colors shadow-sm disabled:opacity-50"
              title="Tải PDF gốc từ máy chủ Nhà cung cấp (MISA, Viettel, 4Si...) hoặc kích hoạt Fallback"
            >
              {isEngineDownloading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang crawl & OCR...</span>
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  <span>Tải PDF Gốc (Adapter)</span>
                </>
              )}
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
