/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar, CrawlerCredentials } from './components/Sidebar';
import { SearchFilterBar } from './components/SearchFilterBar';
import { TaxSummaryDashboard } from './components/TaxSummaryDashboard';
import { InvoiceTable } from './components/InvoiceTable';
import { ConsoleDock } from './components/ConsoleDock';
import { AccountConfigModal } from './components/AccountConfigModal';
import { BatchDownloadModal } from './components/BatchDownloadModal';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import { MultiMonthSyncModal } from './components/MultiMonthSyncModal';
import { FloatingSyncBadge } from './components/FloatingSyncBadge';
import { GDTAccountConfig, GDTInvoice, FilterParams, SeleniumLogEntry, MultiMonthSyncState, MonthSyncChunk } from './types';
import { generateGDTInvoiceXml } from './utils/xmlGenerator';
import { exportInvoicesToExcel, exportComprehensiveMultiMonthReport } from './utils/excelExporter';
import { ImportXmlModal } from './components/ImportXmlModal';
import { PosCaptchaModal } from './components/PosCaptchaModal';
import { isMultiMonthRange, generateMonthChunks, generateDayChunks } from './utils/dateChunker';
import { ensureInvoiceItems, hasGenuineItems } from './utils/xmlParser';
import { getInvoiceOriginalCacheKey } from './utils/invoiceOriginalCache';
import { resolveInvoiceProvider } from './utils/providerRouting';
import { loadOriginalInvoice } from './services/originalInvoiceLoader';
import { executeGdtLogin, executeGdtInvoiceQuery, executeGdtInvoiceDetail, executeGdtPosCaptcha, executeGdtPosCaptchaSolve } from './utils/gdtQueryClient';
import type { PosCaptchaResult, PosCaptchaSolveResult, QueryInvoicesResult } from './utils/gdtQueryClient';
import { RefreshCw } from 'lucide-react';
import { useNotification } from './context/NotificationContext';
import { installPmktBridge, PmktBridgeState, watchPmktBridgeRefresh } from './utils/pmktBridge';

export default function App() {
  const { toast, showAlert } = useNotification();
  const [bridgeState, setBridgeState] = useState<PmktBridgeState>({
    status: 'checking',
    message: 'Đang kiểm tra kết nối PMKT.'
  });

  // Account Configuration State (from localStorage or default)
  const [account, setAccount] = useState<GDTAccountConfig>(() => {
    const saved = localStorage.getItem('gdt_account_config');
    let parsed: any = null;
    if (saved) {
      try {
        parsed = JSON.parse(saved);
        const safeConfig = { ...parsed, taxCode: '', password: '' };
        if (safeConfig.rememberMe === false) {
          localStorage.removeItem('gdt_account_config');
        } else {
          localStorage.setItem('gdt_account_config', JSON.stringify(safeConfig));
        }
      } catch {
        localStorage.removeItem('gdt_account_config');
      }
    }
    const hasActiveSession = Boolean(sessionStorage.getItem('gdt_session_tokens'));
    return {
      taxCode: '',
      password: '',
      customApiKey: parsed?.customApiKey || '',
      taxpayerName: parsed?.taxpayerName || 'Chưa đăng nhập CQT',
      address: parsed?.address || '',
      rememberMe: parsed?.rememberMe ?? true,
      autoSaveSession: parsed?.autoSaveSession ?? true,
      useHeadlessBrowser: parsed?.useHeadlessBrowser ?? true,
      includeElectronicInvoices: parsed?.includeElectronicInvoices ?? true,
      includePosInvoices: parsed?.includePosInvoices ?? true,
      isRealGDT: hasActiveSession ? Boolean(parsed?.isRealGDT) : false
    };
  });

  // Master Invoices State (Real Data from Live GDT or Imported XML)
  // Xóa dữ liệu kết quả cũ khi mở lại app/reload web, hiển thị trang trống, chỉ xuất hiện khi tra cứu
  const [invoices, setInvoices] = useState<GDTInvoice[]>(() => {
    try {
      localStorage.removeItem('gdt_saved_invoices');
    } catch {}
    return [];
  });
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedInvoices, setSelectedInvoices] = useState<GDTInvoice[]>([]);
  const [dataSourceType, setDataSourceType] = useState<'live_gdt' | 'imported_xml'>('live_gdt');

  // Filter Parameters State - Mặc định năm hiện tại
  const [filters, setFilters] = useState<FilterParams>(() => {
    const currentYear = new Date().getFullYear();
    return {
      invoiceType: 'purchase',
      fromDate: `${currentYear}-01-01`,
      toDate: `${currentYear}-12-31`,
      status: 'all',
      cqtCodeStatus: 'all',
      sellerTaxCode: '',
      buyerTaxCode: '',
      searchKeyword: '',
      taxRateFilter: 'all'
    };
  });

  // Modals Visibility State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isBatchDownloadModalOpen, setIsBatchDownloadModalOpen] = useState(false);
  const [isImportXmlModalOpen, setIsImportXmlModalOpen] = useState(false);
  const [isMultiMonthModalOpen, setIsMultiMonthModalOpen] = useState(false);
  const [pendingPosCaptcha, setPendingPosCaptcha] = useState<{
    captcha: PosCaptchaResult;
    rangeLabel: string;
    resolve: (code: string | null) => void;
  } | null>(null);
  const [showFloatingBadge, setShowFloatingBadge] = useState(false);
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<GDTInvoice | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  // Keep the GDT credential form visible when the module first opens.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const stopBridge = installPmktBridge((state) => {
      setBridgeState(state);
      if (state.taxpayer) {
        setAccount(prev => ({
          ...prev,
          taxCode: state.taxpayer!.taxCode,
          password: state.taxpayer!.password,
          taxpayerName: `DOANH NGHIỆP NỘP THUẾ (MST: ${state.taxpayer!.taxCode})`,
          isRealGDT: false
        }));
      }
    });
    const stopRefreshWatcher = watchPmktBridgeRefresh(setBridgeState);
    return () => {
      stopBridge();
      stopRefreshWatcher();
    };
  }, []);

  const collapseLeftMenu = () => {
    setIsSidebarCollapsed(true);
    setIsMobileSidebarOpen(false);
  };

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsMobileSidebarOpen(prev => !prev);
    } else {
      setIsSidebarCollapsed(prev => !prev);
    }
  };

  // Live Console Collapse State
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState(false);
  const consoleCollapseTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const autoCollapseConsole = (delay = 1200) => {
    if (consoleCollapseTimeoutRef.current) {
      clearTimeout(consoleCollapseTimeoutRef.current);
    }
    consoleCollapseTimeoutRef.current = setTimeout(() => {
      setIsConsoleCollapsed(true);
    }, delay);
  };

  const handleToggleConsole = () => {
    if (consoleCollapseTimeoutRef.current) {
      clearTimeout(consoleCollapseTimeoutRef.current);
    }
    setIsConsoleCollapsed(prev => !prev);
  };

  // Multi-Month Orchestration State
  const [syncState, setSyncState] = useState<MultiMonthSyncState>({
    isActive: false,
    isPaused: false,
    isCompleted: false,
    hasErrors: false,
    totalMonths: 0,
    completedMonths: 0,
    currentMonthIndex: 0,
    currentMonthLabel: '',
    progressPercent: 0,
    chunks: [],
    totalInvoicesFound: 0,
    totalPurchaseFound: 0,
    totalSoldFound: 0,
    totalBeforeTax: 0,
    totalTax: 0,
    totalPayment: 0,
    isPosPhase: false,
    posTotalChunks: 0,
    posCompletedChunks: 0,
    posInvoiceCount: 0,
    posCurrentRange: '',
    posLastStatus: ''
  });

  const isSyncPausedRef = React.useRef(false);
  const isSyncCancelledRef = React.useRef(false);

  // Stateless GDT Session tokens (for Vercel compatibility)
  const [gdtSession, setGdtSession] = useState<{ token: string; cookieHeader: string } | null>(() => {
    try {
      const saved = sessionStorage.getItem('gdt_session_tokens');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Live Console Logs
  const [consoleLogs, setConsoleLogs] = useState<SeleniumLogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      level: 'info',
      message: 'Khởi tạo hệ thống GDT Invoice Trawler v2.5...'
    },
    {
      id: 'init-2',
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      level: 'step',
      message: account.taxCode ? `Đã nạp hồ sơ MST: ${account.taxCode} - Tự động nhận diện chứng thư số CQT.` : 'Hệ thống sẵn sàng tra cứu hóa đơn điện tử Cổng Tổng Cục Thuế.'
    }
  ]);

  // Save account to localStorage if rememberMe is enabled
  useEffect(() => {
    if (account.rememberMe) {
      localStorage.setItem('gdt_account_config', JSON.stringify({
        ...account,
        taxCode: '',
        password: ''
      }));
    } else {
      localStorage.removeItem('gdt_account_config');
    }
  }, [account]);

  // Xóa trắng toàn bộ danh sách hóa đơn khi reload trang hoặc mở mới, loại bỏ dữ liệu cũ/giả lập
  useEffect(() => {
    setInvoices([]);
    setSelectedInvoices([]);
    setHasSearched(false);
    try {
      localStorage.removeItem('gdt_saved_invoices');
      localStorage.removeItem('gdt_sidebar_collapsed');
    } catch {}
    // Bắt buộc mở menu bên trái khi khách hàng mở webapp để nhập thông tin đăng nhập
    setIsSidebarCollapsed(false);
    if (window.innerWidth < 1024 && !account.isRealGDT) {
      setIsMobileSidebarOpen(true);
    }
  }, []);

  // Tự động tắt thông báo "hoàn tất đồng bộ toàn kỳ" sau khi tải đủ hóa đơn về
  useEffect(() => {
    if (syncState.isCompleted) {
      const timer = setTimeout(() => {
        setShowFloatingBadge(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [syncState.isCompleted]);

  // Filter Invoices according to all criteria (Strictly Purchase Invoices Only)
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Strictly Purchase Invoices Only as required
      if (inv.loaiHdon !== 'purchase') {
        return false;
      }

      // 2. Date Range Filter
      const invDate = inv.tdlap.substring(0, 10);
      if (filters.fromDate && invDate < filters.fromDate) return false;
      if (filters.toDate && invDate > filters.toDate) return false;

      // 3. Invoice Status Filter (1: Gốc, 2: Thay thế, 3: Điều chỉnh, 4: Hủy)
      if (filters.status !== 'all' && String(inv.tthdon) !== filters.status) {
        return false;
      }

      // 4. Tax Authority Code Status
      if (filters.cqtCodeStatus === 'with_code' && !inv.hsgcma) return false;
      if (filters.cqtCodeStatus === 'without_code' && inv.hsgcma) return false;

      // 5. Tax Rate Filter (0%, 5%, 8%, 10%, kct)
      if (filters.taxRateFilter !== 'all') {
        const matchTax = inv.items.some((it) => {
          if (filters.taxRateFilter === 'kct') {
            return it.taxRate.toUpperCase().includes('KCT') || it.taxRatePercent === 0;
          }
          return it.taxRate.includes(filters.taxRateFilter);
        });
        if (!matchTax) return false;
      }

      // 6. Search Keyword (in Invoice number, seller name, buyer name, tax code, items)
      if (filters.searchKeyword.trim()) {
        const kw = filters.searchKeyword.toLowerCase().trim();
        const inInvoiceNo = inv.shdon.toLowerCase().includes(kw);
        const inSymbol = inv.khhdon.toLowerCase().includes(kw);
        const inSeller = inv.nbten.toLowerCase().includes(kw) || inv.nbmst.includes(kw);
        const inBuyer = inv.nmten.toLowerCase().includes(kw) || inv.nmmst.includes(kw);
        const inItems = inv.items.some((it) => it.itemName.toLowerCase().includes(kw));
        const inCqtCode = (inv.mhdon || '').toLowerCase().includes(kw);

        if (!inInvoiceNo && !inSymbol && !inSeller && !inBuyer && !inItems && !inCqtCode) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, filters]);

  // Handlers for Row Selection
  const handleToggleSelect = (invoice: GDTInvoice) => {
    setSelectedInvoices((prev) => {
      const exists = prev.some((i) => i.id === invoice.id);
      if (exists) {
        return prev.filter((i) => i.id !== invoice.id);
      } else {
        return [...prev, invoice];
      }
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices([...filteredInvoices]);
    }
  };

  // Download Single XML File
  const handleDownloadXml = (invoice: GDTInvoice) => {
    const xmlContent = invoice.rawXml || generateGDTInvoiceXml(invoice);
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HD_${invoice.khhdon}_${invoice.shdon}_${invoice.nbmst}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'success',
        message: `Đã xuất tệp XML gốc HĐ số ${invoice.shdon} (${invoice.khhdon}) - Bên bán MST: ${invoice.nbmst}`
      }
    ]);
  };

  // Không dựng PDF nội bộ: mở chi tiết để người dùng xem/tải bản gốc từ cổng NCC.
  const handleDownloadPdf = (invoice: GDTInvoice) => setSelectedInvoiceForDetail(invoice);

  // Export Excel
  const handleExportExcel = (targetInvoices?: GDTInvoice[]) => {
    const listToExport = targetInvoices && targetInvoices.length > 0 ? targetInvoices : filteredInvoices;
    if (listToExport.length === 0) {
      toast.warning('Không có dữ liệu hóa đơn nào để xuất Excel.', 'Chưa Có Dữ Liệu');
      return;
    }
    exportInvoicesToExcel(listToExport, `Bang_Ke_Hoa_Don_GDT_${account.taxCode}`);
    autoCollapseConsole(1200);
    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'success',
        message: `Đã xuất Bảng kê Excel gồm ${listToExport.length} hóa đơn chuẩn Thông tư 78.`
      }
    ]);
  };

  // Automated background enrichment status for goods/services line items
  const [enrichStatus, setEnrichStatus] = useState<{
    total: number;
    completed: number;
    currentInvoice: string;
    isEnriching: boolean;
  }>({
    total: 0,
    completed: 0,
    currentInvoice: '',
    isEnriching: false
  });

  const enrichQueueRef = React.useRef<GDTInvoice[]>([]);
  const isEnrichingRef = React.useRef<boolean>(false);
  const originalPrefetchRef = React.useRef<Set<string>>(new Set());

  const getInvoiceCacheKey = (invoice: GDTInvoice) =>
    `gdt_invoice_detail_${invoice.loaiHdon || 'purchase'}_${invoice.nbmst}_${invoice.khhdon}_${invoice.shdon}`;

  const readCachedInvoice = (invoice: GDTInvoice): GDTInvoice | null => {
    try {
      const raw = localStorage.getItem(getInvoiceCacheKey(invoice));
      if (!raw) return null;
      const cached = JSON.parse(raw) as GDTInvoice;
      return cached?.sourceCompleteness === 'detail' && hasGenuineItems(cached.items) ? cached : null;
    } catch {
      return null;
    }
  };

  const writeCachedInvoice = (invoice: GDTInvoice) => {
    try {
      localStorage.setItem(getInvoiceCacheKey(invoice), JSON.stringify(invoice));
    } catch (error) {
      console.warn('[Local invoice cache] Không lưu được dữ liệu chi tiết:', error);
    }
  };

  const prefetchOriginalPdf = async (invoice: GDTInvoice) => {
    const provider = resolveInvoiceProvider(invoice);
    if (!invoice.rawXml || !provider) return;
    // MISA accepts the buyer's browser session but rejects the cloud backend.
    // Do not repeatedly prefetch an error for every table update.
    if (provider === 'MISA') return;
    const cacheKey = getInvoiceOriginalCacheKey(invoice);
    if (originalPrefetchRef.current.has(cacheKey)) return;
    originalPrefetchRef.current.add(cacheKey);
    try { await loadOriginalInvoice(invoice); }
    catch (error) { console.info('[Original invoice prefetch]', error); }
  };

  // Automated sequential queue to retrieve item names & goods from GDT
  // Uses polite delays and sequential requests so GDT portal never throttles (429)
  const enqueueInvoicesForEnrichment = (newInvoices: GDTInvoice[], token: string, cookie: string) => {
    const toAdd = newInvoices.filter(inv => {
      const cached = readCachedInvoice(inv);
      if (cached) {
        void prefetchOriginalPdf(cached);
        setInvoices(prev => {
          const index = prev.findIndex(item => item.id === inv.id);
          if (index < 0) return prev;
          const updated = [...prev];
          updated[index] = cached;
          return updated;
        });
        return false;
      }
      const isAlreadyInQueue = enrichQueueRef.current.some(q => q.id === inv.id);
      return !isAlreadyInQueue && (!hasGenuineItems(inv.items) || inv.sourceCompleteness !== 'detail');
    });
    if (toAdd.length === 0) return;

    enrichQueueRef.current.push(...toAdd);
    setEnrichStatus(prev => ({
      ...prev,
      total: prev.total + toAdd.length,
      isEnriching: true
    }));

    if (!isEnrichingRef.current) {
      void processEnrichQueue(token, cookie);
    }
  };

  const processEnrichQueue = async (token: string, cookie: string) => {
    if (isEnrichingRef.current) return;
    isEnrichingRef.current = true;
    setEnrichStatus(prev => ({ ...prev, isEnriching: true }));

    while (enrichQueueRef.current.length > 0) {
      const invoice = enrichQueueRef.current.shift();
      if (!invoice) continue;

      setEnrichStatus(prev => ({
        ...prev,
        currentInvoice: `HĐ ${invoice.shdon || ''} (${invoice.khhdon || ''})`
      }));

      try {
        const enriched = await executeGdtInvoiceDetail(invoice, token, cookie);
        if (enriched) {
          writeCachedInvoice(enriched);
          void prefetchOriginalPdf(enriched);
          setInvoices(prev => {
            const index = prev.findIndex(item => item.id === enriched.id);
            if (index === -1) return prev;
            const updated = [...prev];
            updated[index] = enriched;
            return updated;
          });
          setSelectedInvoiceForDetail(prev => {
            if (!prev || prev.id !== enriched.id) return prev;
            return enriched;
          });
        }
      } catch (err) {
        console.warn('Enrichment error for invoice:', invoice.shdon, err);
      }

      setEnrichStatus(prev => ({
        ...prev,
        completed: prev.completed + 1
      }));

      // Polite 250ms spacing between GDT calls to respect rate limits
      await new Promise(r => setTimeout(r, 250));
    }

    isEnrichingRef.current = false;
    setEnrichStatus(prev => ({
      ...prev,
      isEnriching: false,
      currentInvoice: ''
    }));
  };

  // Start original-PDF downloads as soon as detail/XML enrichment produces
  // the provider code and real lookup key. The ref inside prefetchOriginalPdf
  // keeps this effect idempotent across table updates.
  useEffect(() => {
    invoices.forEach(invoice => {
      void prefetchOriginalPdf(invoice);
    });
  }, [invoices]);

  // Tự động tải lại CAPTCHA mới để đăng nhập nếu hết phiên làm việc Cổng Thuế
  const reloginGdtSession = async (reason = 'Phiên làm việc Cổng Thuế đã hết hạn'): Promise<{ success: boolean; token?: string; cookieHeader?: string }> => {
    const mst = account.taxCode?.trim();
    const pwd = account.password?.trim();

    if (!mst || !pwd) {
      setConsoleLogs(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'warning',
        message: `⚠️ [CẦN ĐĂNG NHẬP LẠI] ${reason}. Chưa có đủ MST hoặc Mật khẩu để tự động kết nối lại. Vui lòng nhập thông tin trên thanh bên trái.`
      }]);
      setAccount(prev => ({ ...prev, isRealGDT: false }));
      return { success: false };
    }

    setConsoleLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      level: 'warning',
      message: `⚠️ [HẾT PHIÊN CỔNG THUẾ] ${reason}. Hệ thống đang tự động tải CAPTCHA mới để đăng nhập kết nối lại Cổng Tổng cục Thuế...`
    }]);

    try {
      const loginRes = await executeGdtLogin({
        taxCode: mst,
        password: pwd,
        vietnamProxy: account.vietnamProxy,
        customApiKey: account.customApiKey
      });

      if (loginRes.success && loginRes.token) {
        const newSession = {
          token: loginRes.token,
          cookieHeader: loginRes.cookieHeader || ''
        };
        setGdtSession(newSession);
        try {
          sessionStorage.setItem('gdt_session_tokens', JSON.stringify(newSession));
        } catch {}

        setAccount(prev => ({
          ...prev,
          taxCode: mst,
          taxpayerName: loginRes.taxpayerName || prev.taxpayerName,
          address: loginRes.address || prev.address,
          isRealGDT: true
        }));

        setConsoleLogs(prev => [...prev, {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'success',
          message: `✓ [TỰ ĐỘNG ĐĂNG NHẬP LẠI THÀNH CÔNG] Đã cấp mới phiên làm việc Cổng Thuế cho MST ${mst}. Tiếp tục thực hiện yêu cầu...`
        }]);

        return { success: true, token: loginRes.token, cookieHeader: loginRes.cookieHeader };
      }

      setConsoleLogs(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'error',
        message: `❌ [TỰ ĐỘNG ĐĂNG NHẬP LẠI THẤT BẠI] ${loginRes.error || 'Chưa vượt được Captcha tự động'}. Vui lòng nhập mã Captcha thủ công ở menu bên trái.`
      }]);
      setAccount(prev => ({ ...prev, isRealGDT: false }));
      return { success: false };
    } catch (err: any) {
      setConsoleLogs(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'error',
        message: `❌ [LỖI TÁI KẾT NỐI] ${err.message}. Vui lòng thử lại thủ công.`
      }]);
      setAccount(prev => ({ ...prev, isRealGDT: false }));
      return { success: false };
    }
  };

  // Multi-Month Sequential Execution
  const runPosPhase = async (activeToken: string, activeCookie: string) => {
    const posChunks = generateDayChunks(filters.fromDate, filters.toDate, 5);
    if (posChunks.length === 0) return { total: 0, failed: 0 };

    setConsoleLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      level: 'step',
      message: `[HÓA ĐƠN MÁY TÍNH TIỀN] Chuyển sang tra cứu ${posChunks.length} đợt, mỗi đợt tối đa 5 ngày. Mỗi đợt sẽ lấy CAPTCHA mới.`
    }]);

    let total = 0;
    let failed = 0;
    setSyncState(prev => ({
      ...prev,
      isPosPhase: true,
      posTotalChunks: posChunks.length,
      posCompletedChunks: 0,
      posInvoiceCount: 0,
      posCurrentRange: `${posChunks[0].from} -> ${posChunks[0].to}`,
      posLastStatus: 'Đang chuẩn bị CAPTCHA'
    }));
    for (let i = 0; i < posChunks.length; i++) {
      if (isSyncCancelledRef.current) break;
      const chunk = posChunks[i];
      setSyncState(prev => ({
        ...prev,
        isPosPhase: true,
        posCurrentRange: `${chunk.from} -> ${chunk.to}`,
        posLastStatus: `Đang lấy CAPTCHA lần lượt cho đợt ${i + 1}/${posChunks.length}`
      }));
      let queryRes: Awaited<ReturnType<typeof executeGdtInvoiceQuery>> | null = null;
      const MAX_POS_AUTO_ATTEMPTS = 3;
      let chunkSuccess = false;

      // Vòng lặp tự động nhận diện và gửi CAPTCHA (tối đa 3 lần theo yêu cầu)
      for (let captchaAttempt = 1; captchaAttempt <= MAX_POS_AUTO_ATTEMPTS; captchaAttempt++) {
        if (isSyncCancelledRef.current) break;

        const captcha = await executeGdtPosCaptcha({
          token: activeToken,
          cookieHeader: activeCookie,
          vietnamProxy: account.vietnamProxy,
        });

        if (!captcha.success || !captcha.captchaImage) {
          setConsoleLogs(prev => [...prev, {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'warning',
            message: `⚠️ [MÁY TÍNH TIỀN ${i + 1}/${posChunks.length}] Không tải được CAPTCHA từ Cổng Thuế (${captcha.error || 'Lỗi mạng'}). Đang tự động tải lại (lần ${captchaAttempt}/${MAX_POS_AUTO_ATTEMPTS})...`
          }]);
          if (captchaAttempt < MAX_POS_AUTO_ATTEMPTS) {
            await new Promise(r => setTimeout(r, 600));
            continue;
          }
          break;
        }

        // Nhận diện bằng OCR Cục bộ (Template Matching client + Local Tesseract, KHÔNG DÙNG GEMINI)
        const solverResult: PosCaptchaSolveResult = await executeGdtPosCaptchaSolve({
          captchaImage: captcha.captchaImage,
          captchaKey: captcha.captchaKey,
          rawSvg: captcha.rawSvg,
        });

        const captchaCode = solverResult.success ? (solverResult.code || '').trim().toUpperCase() : '';

        // Nếu OCR cục bộ không đọc được mã (thất bại):
        if (!captchaCode || captchaCode.length < 4) {
          if (captchaAttempt < MAX_POS_AUTO_ATTEMPTS) {
            setConsoleLogs(prev => [...prev, {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              level: 'warning',
              message: `⚠️ [MÁY TÍNH TIỀN ${i + 1}/${posChunks.length}] OCR cục bộ chưa nhận diện được mã (lần ${captchaAttempt}/${MAX_POS_AUTO_ATTEMPTS}). Đang tự động tải lại CAPTCHA mới từ Cổng Thuế...`,
            }]);
            await new Promise(r => setTimeout(r, 600));
            continue; // TỰ ĐỘNG TẢI LẠI CAPTCHA MỚI
          } else {
            setConsoleLogs(prev => [...prev, {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              level: 'warning',
              message: `⚠️ [MÁY TÍNH TIỀN ${i + 1}/${posChunks.length}] Đã tự động thử lại ${MAX_POS_AUTO_ATTEMPTS} lần chưa đọc được mã. Chuyển sang yêu cầu nhập tay cho đợt này.`,
            }]);
            break; // Thoát ra luồng nhập tay bên dưới
          }
        }

        const engineLabel = solverResult.engine === 'tesseract-local' ? 'Tesseract cục bộ' : 'Bộ nhận diện cục bộ';
        setConsoleLogs(prev => [...prev, {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'step',
          message: `✓ [MÁY TÍNH TIỀN ${i + 1}/${posChunks.length}] Đã đọc được mã CAPTCHA bằng ${engineLabel}: "${captchaCode}" (lần ${captchaAttempt}/${MAX_POS_AUTO_ATTEMPTS}). Đang tra cứu hóa đơn máy tính tiền...`,
        }]);

        queryRes = await executeGdtInvoiceQuery({
          fromDate: chunk.from,
          toDate: chunk.to,
          invoiceType: 'purchase',
          size: 50,
          token: activeToken,
          cookieHeader: activeCookie,
          includePos: true,
          posOnly: true,
          posCaptcha: { key: captcha.captchaKey, code: captchaCode, cookie: captcha.captchaCookie },
        });

        // Kiểm tra xem Cổng Thuế có báo hết phiên (401) trong lúc tải POS không
        if (queryRes.status === 401) {
          const relogin = await reloginGdtSession(`Hết phiên khi tra cứu hóa đơn máy tính tiền đợt ${i + 1}/${posChunks.length}`);
          if (relogin.success && relogin.token) {
            activeToken = relogin.token;
            activeCookie = relogin.cookieHeader || activeCookie;
            captchaAttempt--; // Thử lại lần này với phiên mới
            continue;
          }
        }

        const diagnostic = queryRes.posDiagnostics?.find(item => item.from === chunk.from && item.to === chunk.to);
        const isCaptchaRejected = /từ chối CAPTCHA|tu choi CAPTCHA|CAPTCHA_INVALID/i.test(diagnostic?.status || '') || queryRes.error === 'CAPTCHA_INVALID';

        if (!isCaptchaRejected) {
          chunkSuccess = true;
          break; // Thành công!
        }

        // Nếu Cổng Thuế từ chối CAPTCHA: Tự động tải lại CAPTCHA mới để đọc lại (tối đa 3 lần)
        if (captchaAttempt < MAX_POS_AUTO_ATTEMPTS) {
          setConsoleLogs(prev => [...prev, {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'warning',
            message: `⚠️ [MÁY TÍNH TIỀN ${i + 1}/${posChunks.length}] Cổng Thuế từ chối mã CAPTCHA "${captchaCode}" (lần ${captchaAttempt}/${MAX_POS_AUTO_ATTEMPTS}). Đang tự động tải lại CAPTCHA mới để đọc lại...`,
          }]);
          await new Promise(r => setTimeout(r, 600));
        } else {
          setConsoleLogs(prev => [...prev, {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'warning',
            message: `⚠️ [MÁY TÍNH TIỀN ${i + 1}/${posChunks.length}] Đã tự động thử lại ${MAX_POS_AUTO_ATTEMPTS} lần nhưng Cổng Thuế từ chối mã. Chuyển sang yêu cầu nhập tay cho đợt này.`,
          }]);
        }
      }

      // NẾU TỰ ĐỘNG 3 LẦN THẤT BẠI: Chuyển sang luồng nhập tay (PosCaptchaModal)
      if (!chunkSuccess && !isSyncCancelledRef.current) {
        const manualCaptcha = await executeGdtPosCaptcha({
          token: activeToken,
          cookieHeader: activeCookie,
          vietnamProxy: account.vietnamProxy,
        });

        if (manualCaptcha.success) {
          const manualCode = await new Promise<string | null>(resolve => {
            setPendingPosCaptcha({ captcha: manualCaptcha, rangeLabel: `${chunk.from} -> ${chunk.to}`, resolve });
          });

          if (manualCode) {
            setConsoleLogs(prev => [...prev, {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              level: 'step',
              message: `✓ [MÁY TÍNH TIỀN ${i + 1}/${posChunks.length}] Đã nhận mã xác nhận từ người dùng: "${manualCode}". Đang tra cứu hóa đơn máy tính tiền...`,
            }]);

            queryRes = await executeGdtInvoiceQuery({
              fromDate: chunk.from,
              toDate: chunk.to,
              invoiceType: 'purchase',
              size: 50,
              token: activeToken,
              cookieHeader: activeCookie,
              includePos: true,
              posOnly: true,
              posCaptcha: { key: manualCaptcha.captchaKey, code: manualCode, cookie: manualCaptcha.captchaCookie },
            });
          } else {
            queryRes = { success: false, invoices: [], message: 'Người dùng đã bỏ qua CAPTCHA của đợt này.' };
          }
        }
      }
      if (!queryRes) continue;

      if (queryRes.success && Array.isArray(queryRes.invoices)) {
        const posInvoices = queryRes.invoices;
        total += posInvoices.length;
        const diagnostic = queryRes.posDiagnostics?.find(item => item.from === chunk.from && item.to === chunk.to);
        const posRequestFailed = Boolean(diagnostic?.status && (
          diagnostic.status.includes('từ chối CAPTCHA') ||
          diagnostic.status.includes('Không lấy') ||
          diagnostic.status.includes('lỗi')
        ));
        if (posRequestFailed) failed++;
        setInvoices(prev => {
          const map = new Map<string, GDTInvoice>();
          prev.forEach(item => map.set(item.id, item));
          posInvoices.forEach(item => map.set(item.id, item));
          return Array.from(map.values());
        });
        enqueueInvoicesForEnrichment(posInvoices, activeToken, activeCookie);
        setConsoleLogs(prev => [...prev, {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: posRequestFailed ? 'warning' : (posInvoices.length > 0 ? 'success' : 'warning'),
          message: `${posRequestFailed || posInvoices.length === 0 ? '⚠️' : '✓'} [MÁY TÍNH TIỀN ${i + 1}/${posChunks.length}] ${chunk.from} -> ${chunk.to}: nhận ${posInvoices.length} hóa đơn${diagnostic?.status ? ` (${diagnostic.status})` : ''}.`
        }]);
        setSyncState(prev => ({
          ...prev,
          posCompletedChunks: i + 1,
          posInvoiceCount: total,
          posLastStatus: `Đã nhận ${posInvoices.length} hóa đơn; CAPTCHA ${diagnostic?.attempts || 1} lần`
        }));
      } else {
        failed++;
        const diagnostic = queryRes.posDiagnostics?.find(item => item.from === chunk.from && item.to === chunk.to);
        const detail = diagnostic?.status || queryRes.message || 'Không lấy được dữ liệu';
        setConsoleLogs(prev => [...prev, {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'warning',
          message: `⚠️ [MÁY TÍNH TIỀN ${i + 1}/${posChunks.length}] ${chunk.from} -> ${chunk.to}: ${detail}.`
        }]);
        setSyncState(prev => ({
          ...prev,
          posCompletedChunks: i + 1,
          posInvoiceCount: total,
          posLastStatus: `Đợt lỗi: ${detail}`
        }));
      }
      if (i < posChunks.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    return { total, failed };
  };

  const runMultiMonthQuery = async (
    activeToken: string,
    activeCookie: string,
    mst: string,
    includeElectronicInvoices: boolean,
    includePosInvoices: boolean,
  ) => {
    const chunks = generateMonthChunks(filters.fromDate, filters.toDate);
    if (chunks.length === 0) return { success: false, error: 'Khoảng thời gian không hợp lệ' };

    // A live query must never retain sample or previous-session invoices.
    setInvoices([]);
    setSelectedInvoices([]);
    setDataSourceType('live_gdt');

    isSyncPausedRef.current = false;
    isSyncCancelledRef.current = false;

    setSyncState({
      isActive: true,
      isPaused: false,
      isCompleted: false,
      hasErrors: false,
      totalMonths: chunks.length,
      completedMonths: 0,
      currentMonthIndex: 0,
      currentMonthLabel: chunks[0]?.label || '',
      progressPercent: 0,
      chunks: chunks,
      totalInvoicesFound: 0,
      totalPurchaseFound: 0,
      totalSoldFound: 0,
      totalBeforeTax: 0,
      totalTax: 0,
      totalPayment: 0,
      isPosPhase: false,
      posTotalChunks: 0,
      posCompletedChunks: 0,
      posInvoiceCount: 0,
      posCurrentRange: '',
      posLastStatus: ''
    });

    setIsMultiMonthModalOpen(true);
    setShowFloatingBadge(true);
    // Tự động ẩn menu bên trái để mở rộng không gian nhìn gọn màn hình
    collapseLeftMenu();

    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'step',
        message: `[KỲ DÀI HƠN 1 THÁNG] Đã chia thành ${chunks.length} tháng (${filters.fromDate} -> ${filters.toDate}). Bắt đầu tra cứu tự động lần lượt từng tháng...`
      }
    ]);

    let runningTotalInvoices = 0;
    let runningPurchases = 0;
    let runningSolds = 0;
    let runningBeforeTax = 0;
    let runningTax = 0;
    let runningPayment = 0;
    let hasEncounteredError = false;

    for (let i = 0; i < chunks.length; i++) {
      if (isSyncCancelledRef.current) {
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'warning',
            message: `[ĐÃ DỪNG] Người dùng đã dừng quá trình tra cứu đa tháng.`
          }
        ]);
        break;
      }

      // Check if paused
      while (isSyncPausedRef.current) {
        await new Promise(r => setTimeout(r, 250));
        if (isSyncCancelledRef.current) break;
      }
      if (isSyncCancelledRef.current) break;

      const chunk = chunks[i];

      if (!includeElectronicInvoices) {
        setSyncState(prev => ({
          ...prev,
          currentMonthIndex: i,
          currentMonthLabel: chunk.label,
          completedMonths: i + 1,
          progressPercent: Math.round(((i + 1) / chunks.length) * 100),
          chunks: prev.chunks.map((c, idx) => idx === i ? { ...c, status: 'skipped' as const } : c)
        }));
        continue;
      }

      // Mark current chunk as running
      setSyncState(prev => ({
        ...prev,
        currentMonthIndex: i,
        currentMonthLabel: chunk.label,
        chunks: prev.chunks.map((c, idx) => idx === i ? { ...c, status: 'running' as const } : c)
      }));

      setConsoleLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'step',
          message: `[TIẾN TRÌNH THÁNG ${i + 1}/${chunks.length}] Đang truy xuất ${chunk.label} (từ ${chunk.fromDate} đến ${chunk.toDate})...`
        }
      ]);

      try {
        const queryRes = await executeGdtInvoiceQuery({
          fromDate: chunk.fromDate,
          toDate: chunk.toDate,
          invoiceType: 'purchase',
          size: 50,
          token: activeToken,
          cookieHeader: activeCookie,
          includePos: false,
          posOnly: false
        });

        if (queryRes.success && Array.isArray(queryRes.invoices)) {
          const monthInvoices: GDTInvoice[] = queryRes.invoices;
          const purchases = monthInvoices.filter(inv => inv.loaiHdon === 'purchase');
          const solds = monthInvoices.filter(inv => inv.loaiHdon === 'sold');
          
          const pAmount = purchases.reduce((sum, inv) => sum + (inv.tgtcthue || 0), 0);
          const pTax = purchases.reduce((sum, inv) => sum + (inv.tgtthue || 0), 0);
          const sAmount = solds.reduce((sum, inv) => sum + (inv.tgtcthue || 0), 0);
          const sTax = solds.reduce((sum, inv) => sum + (inv.tgtthue || 0), 0);
          const mAmount = pAmount + sAmount;
          const mTax = pTax + sTax;
          const mPayment = mAmount + mTax;

          runningTotalInvoices += monthInvoices.length;
          runningPurchases += purchases.length;
          runningSolds += solds.length;
          runningBeforeTax += mAmount;
          runningTax += mTax;
          runningPayment += mPayment;

          // Merge into master invoices (avoid duplicates by ID)
          setInvoices(prev => {
            const map = new Map<string, GDTInvoice>();
            prev.forEach(item => map.set(item.id, item));
            monthInvoices.forEach(item => map.set(item.id, item));
            return Array.from(map.values());
          });
          setDataSourceType('live_gdt');
          enqueueInvoicesForEnrichment(monthInvoices, activeToken, activeCookie);

          // Update syncState chunk
          setSyncState(prev => {
            const completedCount = i + 1;
            const updatedChunks = prev.chunks.map((c, idx) => {
              if (idx === i) {
                return {
                  ...c,
                  status: 'completed' as const,
                  totalInvoices: monthInvoices.length,
                  purchaseCount: purchases.length,
                  soldCount: solds.length,
                  purchaseAmount: pAmount,
                  purchaseTax: pTax,
                  soldAmount: sAmount,
                  soldTax: sTax,
                  totalAmount: mAmount,
                  totalTax: mTax,
                  totalPayment: mPayment,
                  invoices: monthInvoices
                };
              }
              return c;
            });

            return {
              ...prev,
              completedMonths: completedCount,
              progressPercent: Math.round((completedCount / chunks.length) * 100),
              chunks: updatedChunks,
              totalInvoicesFound: runningTotalInvoices,
              totalPurchaseFound: runningPurchases,
              totalSoldFound: runningSolds,
              totalBeforeTax: runningBeforeTax,
              totalTax: runningTax,
              totalPayment: runningPayment
            };
          });

          const sourceTag = queryRes.source === 'direct_browser' ? ' (kết nối trực tiếp)' : '';
          setConsoleLogs(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              level: 'success',
              message: `✓ [HOÀN TẤT ${chunk.label}] Thu được ${monthInvoices.length} HĐ (${purchases.length} mua vào, ${solds.length} bán ra)${sourceTag}. Tổng lũy kế: ${runningTotalInvoices} HĐ.`
            }
          ]);
        } else if (queryRes.status === 401) {
          const relogin = await reloginGdtSession(`Hết phiên khi tra cứu ${chunk.label}`);
          if (relogin.success && relogin.token) {
            activeToken = relogin.token;
            activeCookie = relogin.cookieHeader || activeCookie;
            i--; // Thử lại tháng này với phiên kết nối mới!
            continue;
          }
          hasEncounteredError = true;
          setSyncState(prev => ({
            ...prev,
            hasErrors: true,
            chunks: prev.chunks.map((c, idx) => idx === i ? { ...c, status: 'failed' as const, errorMessage: 'Phiên Cổng Thuế cần xác thực Captcha' } : c)
          }));
          setConsoleLogs(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              level: 'warning',
              message: `[CẦN XÁC THỰC LẠI] Khi tra cứu ${chunk.label}: Cổng Thuế yêu cầu xác thực lại. Vui lòng kiểm tra lại thông tin đăng nhập.`
            }
          ]);
          break;
        } else {
          hasEncounteredError = true;
          const msg = queryRes.message || 'Lỗi tra cứu Cổng Thuế';
          setSyncState(prev => ({
            ...prev,
            hasErrors: true,
            chunks: prev.chunks.map((c, idx) => idx === i ? { ...c, status: 'failed' as const, errorMessage: msg } : c)
          }));
          setConsoleLogs(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              level: 'warning',
              message: `⚠️ [LỖI THÁNG ${chunk.label}] ${msg}. Bạn có thể bấm Thử lại tháng này trên bảng tiến trình.`
            }
          ]);
        }
      } catch (err: any) {
        hasEncounteredError = true;
        setSyncState(prev => ({
          ...prev,
          hasErrors: true,
          chunks: prev.chunks.map((c, idx) => idx === i ? { ...c, status: 'failed' as const, errorMessage: err.message } : c)
        }));
      }

      // Small pacing delay to prevent 429
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 400));
      }
    }

    // POS invoices use a separate GDT endpoint and a fresh CAPTCHA per 5-day window.
    if (includePosInvoices && !isSyncCancelledRef.current && !hasEncounteredError) {
      setSyncState(prev => ({ ...prev, currentMonthLabel: 'Hóa đơn máy tính tiền (5 ngày/lần)' }));
      const posResult = await runPosPhase(activeToken, activeCookie);
      runningTotalInvoices += posResult.total;
      runningPurchases += posResult.total;
      hasEncounteredError = hasEncounteredError || posResult.failed > 0;
      setSyncState(prev => ({
        ...prev,
        totalInvoicesFound: runningTotalInvoices,
        totalPurchaseFound: runningPurchases,
        hasErrors: hasEncounteredError
      }));
    }

    setSyncState(prev => ({
      ...prev,
      isActive: false,
      isCompleted: true,
      hasErrors: hasEncounteredError,
      isPosPhase: false
    }));

    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'success',
        message: `🎉 [HOÀN THÀNH TRA CỨU KỲ] Đã hoàn tất đồng bộ ${chunks.length} tháng (${filters.fromDate} -> ${filters.toDate}). Thu thập tổng cộng ${runningTotalInvoices} hóa đơn.`
      }
    ]);

    setIsRefreshing(false);
    // Tự động thu gọn thanh LIVE SELENIUM CONSOLE xuống dưới sau khi chạy kết xuất thành công dữ liệu
    autoCollapseConsole(1200);
    return { success: true };
  };

  // Retry single chunk
  const handleRetryChunk = async (chunkIndex: number) => {
    const chunk = syncState.chunks[chunkIndex];
    if (!chunk) return;

    let activeToken = gdtSession?.token || '';
    let activeCookie = gdtSession?.cookieHeader || '';

    setSyncState(prev => ({
      ...prev,
      chunks: prev.chunks.map((c, idx) => idx === chunkIndex ? { ...c, status: 'running' as const, errorMessage: undefined } : c)
    }));

    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'step',
        message: `[THỬ LẠI RIÊNG] Đang thử lấy lại dữ liệu ${chunk.label} (${chunk.fromDate} -> ${chunk.toDate})...`
      }
    ]);

    try {
      const queryRes = await executeGdtInvoiceQuery({
        fromDate: chunk.fromDate,
        toDate: chunk.toDate,
        invoiceType: 'purchase',
        size: 50,
        token: activeToken,
        cookieHeader: activeCookie,
        includePos: false,
        posOnly: false
      });

      if (queryRes.success && Array.isArray(queryRes.invoices)) {
        const monthInvoices: GDTInvoice[] = queryRes.invoices;
        const purchases = monthInvoices.filter(inv => inv.loaiHdon === 'purchase');
        const solds = monthInvoices.filter(inv => inv.loaiHdon === 'sold');
        const pAmount = purchases.reduce((sum, inv) => sum + (inv.tgtcthue || 0), 0);
        const pTax = purchases.reduce((sum, inv) => sum + (inv.tgtthue || 0), 0);
        const sAmount = solds.reduce((sum, inv) => sum + (inv.tgtcthue || 0), 0);
        const sTax = solds.reduce((sum, inv) => sum + (inv.tgtthue || 0), 0);
        const mAmount = pAmount + sAmount;
        const mTax = pTax + sTax;
        const mPayment = mAmount + mTax;

        setInvoices(prev => {
          const map = new Map<string, GDTInvoice>();
          prev.forEach(item => map.set(item.id, item));
          monthInvoices.forEach(item => map.set(item.id, item));
          return Array.from(map.values());
        });
        enqueueInvoicesForEnrichment(monthInvoices, activeToken, activeCookie);

        setSyncState(prev => {
          const updatedChunks = prev.chunks.map((c, idx) => {
            if (idx === chunkIndex) {
              return {
                ...c,
                status: 'completed' as const,
                totalInvoices: monthInvoices.length,
                purchaseCount: purchases.length,
                soldCount: solds.length,
                purchaseAmount: pAmount,
                purchaseTax: pTax,
                soldAmount: sAmount,
                soldTax: sTax,
                totalAmount: mAmount,
                totalTax: mTax,
                totalPayment: mPayment,
                invoices: monthInvoices
              };
            }
            return c;
          });

          return {
            ...prev,
            chunks: updatedChunks
          };
        });

        const sourceTag = queryRes.source === 'direct_browser' ? ' (kết nối trực tiếp)' : '';
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'success',
            message: `✓ [THỬ LẠI THÀNH CÔNG] Đã lấy thành công ${monthInvoices.length} hóa đơn của ${chunk.label}${sourceTag}!`
          }
        ]);
      } else if (queryRes.status === 401) {
        const relogin = await reloginGdtSession(`Hết phiên khi thử lại ${chunk.label}`);
        if (relogin.success && relogin.token) {
          activeToken = relogin.token;
          activeCookie = relogin.cookieHeader || activeCookie;
          const retryRes = await executeGdtInvoiceQuery({
            fromDate: chunk.fromDate,
            toDate: chunk.toDate,
            invoiceType: 'purchase',
            size: 50,
            token: activeToken,
            cookieHeader: activeCookie,
            includePos: false,
            posOnly: false
          });
          if (retryRes.success && Array.isArray(retryRes.invoices)) {
            const monthInvoices: GDTInvoice[] = retryRes.invoices;
            const purchases = monthInvoices.filter(inv => inv.loaiHdon === 'purchase');
            const solds = monthInvoices.filter(inv => inv.loaiHdon === 'sold');
            const pAmount = purchases.reduce((sum, inv) => sum + (inv.tgtcthue || 0), 0);
            const pTax = purchases.reduce((sum, inv) => sum + (inv.tgtthue || 0), 0);
            const sAmount = solds.reduce((sum, inv) => sum + (inv.tgtcthue || 0), 0);
            const sTax = solds.reduce((sum, inv) => sum + (inv.tgtthue || 0), 0);
            const mAmount = pAmount + sAmount;
            const mTax = pTax + sTax;
            const mPayment = mAmount + mTax;

            setInvoices(prev => {
              const map = new Map<string, GDTInvoice>();
              prev.forEach(item => map.set(item.id, item));
              monthInvoices.forEach(item => map.set(item.id, item));
              return Array.from(map.values());
            });
            enqueueInvoicesForEnrichment(monthInvoices, activeToken, activeCookie);

            setSyncState(prev => {
              const updatedChunks = prev.chunks.map((c, idx) => {
                if (idx === chunkIndex) {
                  return {
                    ...c,
                    status: 'completed' as const,
                    totalInvoices: monthInvoices.length,
                    purchaseCount: purchases.length,
                    soldCount: solds.length,
                    purchaseAmount: pAmount,
                    purchaseTax: pTax,
                    soldAmount: sAmount,
                    soldTax: sTax,
                    totalAmount: mAmount,
                    totalTax: mTax,
                    totalPayment: mPayment,
                    invoices: monthInvoices
                  };
                }
                return c;
              });

              return {
                ...prev,
                chunks: updatedChunks
              };
            });

            setConsoleLogs(prev => [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                timestamp: new Date().toLocaleTimeString('vi-VN'),
                level: 'success',
                message: `✓ [THỬ LẠI THÀNH CÔNG] Đã lấy thành công ${monthInvoices.length} hóa đơn của ${chunk.label} sau khi tự động kết nối lại!`
              }
            ]);
            return;
          }
        }
        const errMsg = 'Phiên làm việc Cổng Thuế cần xác thực Captcha';
        setSyncState(prev => ({
          ...prev,
          chunks: prev.chunks.map((c, idx) => idx === chunkIndex ? { ...c, status: 'failed' as const, errorMessage: errMsg } : c)
        }));
      } else {
        const errMsg = queryRes.message || 'Lỗi kết nối Cổng Thuế';
        setSyncState(prev => ({
          ...prev,
          chunks: prev.chunks.map((c, idx) => idx === chunkIndex ? { ...c, status: 'failed' as const, errorMessage: errMsg } : c)
        }));
      }
    } catch (err: any) {
      setSyncState(prev => ({
        ...prev,
        chunks: prev.chunks.map((c, idx) => idx === chunkIndex ? { ...c, status: 'failed' as const, errorMessage: err.message } : c)
      }));
    }
  };

  const handlePauseSync = () => {
    isSyncPausedRef.current = true;
    setSyncState(prev => ({ ...prev, isPaused: true }));
  };

  const handleResumeSync = () => {
    isSyncPausedRef.current = false;
    setSyncState(prev => ({ ...prev, isPaused: false }));
  };

  // Run Crawler / Query real invoices from GDT
  const handleRunCrawler = async (credentials?: CrawlerCredentials) => {
    const includeElectronicInvoices = account.includeElectronicInvoices ?? true;
    const includePosInvoices = account.includePosInvoices ?? true;
    if (!includeElectronicInvoices && !includePosInvoices) {
      toast.warning('Vui lòng chọn ít nhất một loại hóa đơn để tra cứu.', 'Chưa chọn loại hóa đơn');
      return { success: false, error: 'Chưa chọn loại hóa đơn' };
    }

    setIsRefreshing(true);
    if (consoleCollapseTimeoutRef.current) {
      clearTimeout(consoleCollapseTimeoutRef.current);
    }
    // Mở rộng console để người dùng theo dõi nhật ký thời gian thực
    setIsConsoleCollapsed(false);
    // A refresh starts a new result set immediately, including when login fails.
    setInvoices([]);
    setSelectedInvoices([]);
    setDataSourceType('live_gdt');
    try { localStorage.removeItem('gdt_saved_invoices'); } catch {}
    const mst = credentials?.taxCode?.trim() || account.taxCode?.trim() || '';
    const pwd = credentials?.password?.trim() || account.password?.trim() || '';

    if (!mst) {
      toast.warning('Vui lòng nhập Mã số thuế để tra cứu.', 'Thiếu Mã Số Thuế');
      setIsRefreshing(false);
      return { success: false, error: 'Chưa có Mã số thuế' };
    }

    // Step 1: Check if we need to authenticate with GDT
    const hasCaptcha = Boolean(credentials?.captchaCode?.trim());
    let activeToken = gdtSession?.token || '';
    let activeCookie = gdtSession?.cookieHeader || '';
    // localStorage may still say "connected" after sessionStorage was cleared.
    // Never query GDT with an empty or stale local session.
    const needLogin = !account.isRealGDT || !activeToken.trim() || (credentials && credentials.taxCode !== account.taxCode) || hasCaptcha;

    if (needLogin) {
      const attemptLabel = credentials?.attemptNumber && credentials.attemptNumber > 1
        ? ` (lần ${credentials.attemptNumber})`
        : '';
      const codeLabel = credentials?.captchaCode ? ` với mã "${credentials.captchaCode}"` : '';

      setConsoleLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'step',
          message: `[XÁC THỰC CỔNG THUẾ] Đang gửi thông tin đăng nhập cho MST ${mst}${codeLabel}${attemptLabel}...`
        }
      ]);

      try {
        const loginResult = await executeGdtLogin({
          taxCode: mst,
          password: pwd,
          captchaKey: credentials?.captchaKey,
          captchaCode: credentials?.captchaCode,
          captchaCookie: credentials?.captchaCookie,
          vietnamProxy: credentials?.vietnamProxy || account.vietnamProxy,
          customApiKey: credentials?.customApiKey || account.customApiKey
        });

        if (!loginResult.success || !loginResult.token) {
          const errMsg = loginResult.error || 'Xác thực thất bại từ Cổng Tổng cục Thuế. Vui lòng kiểm tra lại MST, Mật khẩu hoặc Captcha.';
          
          if (loginResult.isWafBlocked) {
            setConsoleLogs(prev => [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                timestamp: new Date().toLocaleTimeString('vi-VN'),
                level: 'error',
                message: `[CỔNG THUẾ TỪ CHỐI IP 403] Tường lửa Cổng Thuế phát hiện kết nối từ IP đám mây. Vui lòng thử lại sau giây lát.`
              }
            ]);
            setIsRefreshing(false);
            return { success: false, error: errMsg, isWafBlocked: true };
          }

          if (loginResult.needManualCaptcha) {
            setConsoleLogs(prev => [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                timestamp: new Date().toLocaleTimeString('vi-VN'),
                level: 'warning',
                message: `⚠️ [XÁC THỰC CỔNG THUẾ] Cổng Thuế từ chối mã Captcha "${credentials?.captchaCode || ''}". Đang tự động tải ảnh mới và nhận diện lại...`
              }
            ]);
            return { success: false, error: errMsg, needManualCaptcha: true };
          }

          setConsoleLogs(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              level: 'error',
              message: `[KẾT NỐI THẤT BẠI] ${errMsg}`
            }
          ]);
          setIsRefreshing(false);
          return { success: false, error: errMsg };
        }

        // Login success!
        activeToken = loginResult.token;
        activeCookie = loginResult.cookieHeader || '';
        const newSession = { token: activeToken, cookieHeader: activeCookie };
        setGdtSession(newSession);
        try {
          sessionStorage.setItem('gdt_session_tokens', JSON.stringify(newSession));
        } catch {}

        setAccount(prev => ({
          ...prev,
          taxCode: mst,
          password: pwd,
          isRealGDT: true,
          taxpayerName: loginResult.taxpayerName || prev.taxpayerName,
          address: loginResult.address || prev.address
        }));

        // Đã kết nối thành công với Cổng Tổng cục Thuế: tự động ẩn menu bên trái để mở rộng không gian nhìn gọn màn hình
        collapseLeftMenu();

        const sourceNotice = loginResult.source === 'direct_browser' ? ' (kết nối trực tiếp)' : '';

        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'success',
            message: `[ĐĂNG NHẬP THÀNH CÔNG] Đã xác thực thành công với Cổng Tổng cục Thuế cho MST ${mst} (${loginResult.taxpayerName || mst})${sourceNotice}.`
          }
        ]);
      } catch (authErr: any) {
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'error',
            message: `[LỖI KẾT NỐI MẠNG] Không thể kết nối tới máy chủ Tổng cục Thuế: ${authErr.message}`
          }
        ]);
        setIsRefreshing(false);
        return { success: false, error: `Lỗi kết nối: ${authErr.message}` };
      }
    }

    // Start every live search from a clean result set; never mix old/sample data.
    setInvoices([]);
    setSelectedInvoices([]);
    setDataSourceType('live_gdt');

    // Step 2: Check if multi-month range is requested (> 1 month)
    if (isMultiMonthRange(filters.fromDate, filters.toDate)) {
      return await runMultiMonthQuery(activeToken, activeCookie, mst, includeElectronicInvoices, includePosInvoices);
    }

    // Step 3: Single-month Query from GDT
    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'step',
        message: `[KẾT NỐI TỔNG CỤC THUẾ] Bắt đầu tra cứu ${[
          includeElectronicInvoices ? 'hóa đơn điện tử' : '',
          includePosInvoices ? 'hóa đơn máy tính tiền' : ''
        ].filter(Boolean).join(' và ')} cho MST ${mst} (Kỳ: ${filters.fromDate} -> ${filters.toDate})...`
      }
    ]);

    try {
      const queryRes: QueryInvoicesResult = includeElectronicInvoices ? await executeGdtInvoiceQuery({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        invoiceType: 'purchase',
        size: 50,
        token: activeToken,
        cookieHeader: activeCookie,
        includePos: false,
        posOnly: false
      }) : { success: true, invoices: [] as GDTInvoice[] };

      if (queryRes.success && Array.isArray(queryRes.invoices)) {
        // Tự động ẩn menu bên trái để gọn màn hình
        collapseLeftMenu();
        setInvoices(queryRes.invoices);
        setHasSearched(true);
        setSelectedInvoices([]);
        setDataSourceType('live_gdt');
        enqueueInvoicesForEnrichment(queryRes.invoices, activeToken, activeCookie);
        if (includePosInvoices) {
          const posResult = await runPosPhase(activeToken, activeCookie);
          setConsoleLogs(prev => [...prev, {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'success',
            message: `Đã hoàn tất pha hóa đơn máy tính tiền: nhận thêm ${posResult.total} hóa đơn (${posResult.failed} đợt lỗi).`
          }]);
        }
        const sourceNotice = queryRes.source === 'direct_browser' ? ' (kết nối trực tiếp)' : '';
        if (includeElectronicInvoices) {
          setConsoleLogs(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              level: 'success',
              message: `[CỔNG THUẾ TRỰC TIẾP] Đã lấy thành công ${queryRes.invoices.length} hóa đơn thực tế từ hoadondientu.gdt.gov.vn${sourceNotice}!`
            }
          ]);
        }
        // Tự động thu gọn thanh LIVE SELENIUM CONSOLE xuống dưới sau khi chạy kết xuất thành công dữ liệu
        autoCollapseConsole(1200);
        return { success: true };
      } else if (queryRes.status === 403) {
        setHasSearched(true);
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'warning',
            message: `[CỔNG THUẾ CHẶN IP 403] ${queryRes.message || 'Cổng Thuế chặn IP Cloud. Phiên đăng nhập của bạn vẫn còn hiệu lực.'}`
          }
        ]);
        return { success: false, error: queryRes.message };
      } else if (queryRes.status === 401) {
        const relogin = await reloginGdtSession('Phiên tra cứu Cổng Thuế đã hết hạn');
        if (relogin.success && relogin.token) {
          activeToken = relogin.token;
          activeCookie = relogin.cookieHeader || activeCookie;
          // Tự động thử lại tra cứu với phiên kết nối mới
          const retryRes: QueryInvoicesResult = includeElectronicInvoices ? await executeGdtInvoiceQuery({
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            invoiceType: 'purchase',
            size: 50,
            token: activeToken,
            cookieHeader: activeCookie,
            includePos: false,
            posOnly: false
          }) : { success: true, invoices: [] as GDTInvoice[] };

          if (retryRes.success && Array.isArray(retryRes.invoices)) {
            collapseLeftMenu();
            setInvoices(retryRes.invoices);
            setHasSearched(true);
            setSelectedInvoices([]);
            setDataSourceType('live_gdt');
            enqueueInvoicesForEnrichment(retryRes.invoices, activeToken, activeCookie);
            if (includePosInvoices) {
              const posResult = await runPosPhase(activeToken, activeCookie);
              setConsoleLogs(prev => [...prev, {
                id: Math.random().toString(36).substring(2, 9),
                timestamp: new Date().toLocaleTimeString('vi-VN'),
                level: 'success',
                message: `Đã hoàn tất pha hóa đơn máy tính tiền: nhận thêm ${posResult.total} hóa đơn (${posResult.failed} đợt lỗi).`
              }]);
            }
            if (includeElectronicInvoices) {
              setConsoleLogs(prev => [
                ...prev,
                {
                  id: Math.random().toString(36).substring(2, 9),
                  timestamp: new Date().toLocaleTimeString('vi-VN'),
                  level: 'success',
                  message: `[CỔNG THUẾ TRỰC TIẾP] Đã lấy thành công ${retryRes.invoices.length} hóa đơn thực tế sau khi tự động đăng nhập lại!`
                }
              ]);
            }
            autoCollapseConsole(1200);
            return { success: true };
          }
        }

        setHasSearched(true);
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'warning',
            message: `[YÊU CẦU XÁC THỰC LẠI] ${queryRes.message || 'Phiên làm việc cần làm mới mã Captcha.'}`
          }
        ]);
        return { success: false, error: queryRes.message };
      } else {
        setHasSearched(true);
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'error',
            message: `[TRA CỨU THẤT BẠI] ${queryRes.message || 'Không thể lấy dữ liệu từ Cổng Thuế'}`
          }
        ]);
        return { success: false, error: queryRes.message };
      }
    } catch (err: any) {
      console.error('Error querying GDT invoices:', err);
      setHasSearched(true);
      setConsoleLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'error',
          message: `[LỖI KẾT NỐI] ${err.message}`
        }
      ]);
      return { success: false, error: err.message };
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle Import XML/ZIP
  const handleImportXmlSuccess = (imported: GDTInvoice[]) => {
    if (imported.length === 0) return;

    // Find min and max date among imported invoices to adjust filter if needed
    const dates = imported.map(i => i.tdlap.substring(0, 10)).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    if (minDate && maxDate) {
      if (minDate < filters.fromDate || maxDate > filters.toDate) {
        setFilters(prev => ({
          ...prev,
          fromDate: minDate < prev.fromDate ? minDate : prev.fromDate,
          toDate: maxDate > prev.toDate ? maxDate : prev.toDate,
          invoiceType: 'purchase'
        }));
      }
    }

    setDataSourceType('imported_xml');
    setHasSearched(true);
    autoCollapseConsole(1200);
    setInvoices(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const filteredNew = imported.filter(i => !existingIds.has(i.id));
      return [...filteredNew, ...prev];
    });

    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'success',
        message: `Đã nạp thành công ${imported.length} hóa đơn XML thực tế từ Cổng Tổng cục Thuế vào hệ thống!`
      }
    ]);
  };

  // Reset Filters - Mặc định năm hiện tại
  const handleResetFilters = () => {
    const currentYear = new Date().getFullYear();
    setFilters({
      invoiceType: 'purchase',
      fromDate: `${currentYear}-01-01`,
      toDate: `${currentYear}-12-31`,
      status: 'all',
      cqtCodeStatus: 'all',
      sellerTaxCode: '',
      buyerTaxCode: '',
      searchKeyword: '',
      taxRateFilter: 'all'
    });
    setSelectedInvoices([]);
    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'info',
        message: `Đã đặt lại các điều kiện lọc về mặc định năm hiện tại (${currentYear}).`
      }
    ]);
  };

  // Handle Save Account Config
  const handleSaveAccountConfig = (newConfig: GDTAccountConfig) => {
    setAccount(newConfig);
    if (newConfig.isRealGDT) {
      setDataSourceType('live_gdt');
    }
    handleRunCrawler();
  };

  // Handle Logout
  const handleLogout = async () => {
    if (confirm('Bạn có chắc muốn đăng xuất phiên làm việc với Tổng cục Thuế?')) {
      try {
        await fetch('/api/gdt/logout', { method: 'POST' });
      } catch (e) {
        // ignore
      }
      setAccount({
        taxCode: '',
        password: '',
        taxpayerName: 'Chưa đăng nhập',
        rememberMe: false,
        autoSaveSession: false,
        isRealGDT: false
      });
      setInvoices([]);
      setSelectedInvoices([]);
      setHasSearched(false);
      try {
        localStorage.removeItem('gdt_saved_invoices');
        sessionStorage.removeItem('gdt_session_tokens');
        localStorage.removeItem('gdt_sidebar_collapsed');
      } catch {}
      // Mở lại menu bên trái để người dùng đăng nhập tài khoản khác
      setIsSidebarCollapsed(false);
      setIsConfigModalOpen(true);
    }
  };

  if (bridgeState.status !== 'connected' && bridgeState.status !== 'refreshing') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
        <div className={`w-10 h-10 border-3 rounded-full mb-4 ${bridgeState.status === 'awaiting' || bridgeState.status === 'checking' ? 'border-cyan-400 border-t-transparent animate-spin' : 'border-amber-400'}`} />
        <div className="text-base font-semibold text-white">Tích hợp phần mềm PMKT</div>
        <div className="max-w-xl text-center text-sm text-slate-300 mt-3">{bridgeState.message}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f3f4f6] text-[#1f2937]">
      {/* 1. Left Sidebar (High Density Dark Theme) */}
      {!isSidebarCollapsed && (
        <div className="hidden lg:block h-full shrink-0">
          <Sidebar
            account={account}
            filters={filters}
            onFilterChange={setFilters}
            onUpdateAccount={setAccount}
            onRunCrawler={handleRunCrawler}
            isLoading={isRefreshing}
            onOpenConfigModal={() => setIsConfigModalOpen(true)}
            onCollapseSidebar={collapseLeftMenu}
          />
        </div>
      )}

      {/* Mobile Drawer Sidebar */}
      {isMobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-2xs"
            onClick={() => setIsMobileSidebarOpen(false)}
          ></div>
          <div className="relative z-50 w-80 h-full">
            <Sidebar
              account={account}
              filters={filters}
              onFilterChange={setFilters}
              onUpdateAccount={setAccount}
              onRunCrawler={async (credentials) => {
                const res = await handleRunCrawler(credentials);
                if (res && res.success) {
                  setIsMobileSidebarOpen(false);
                }
                return res;
              }}
              isLoading={isRefreshing}
              onOpenConfigModal={() => {
                setIsConfigModalOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              onCollapseSidebar={collapseLeftMenu}
              onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          account={account}
          selectedInvoices={selectedInvoices}
          totalInvoicesCount={filteredInvoices.length}
          dataSourceType={dataSourceType}
          onOpenConfig={() => setIsConfigModalOpen(true)}
          onOpenBatchDownload={() => setIsBatchDownloadModalOpen(true)}
          onExportExcel={() => handleExportExcel(selectedInvoices.length > 0 ? selectedInvoices : filteredInvoices)}
          onRefreshData={handleRunCrawler}
          isRefreshing={isRefreshing}
          onLogout={handleLogout}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
        />

        {bridgeState.status === 'refreshing' && (
          <div className="bg-amber-100 text-amber-950 px-4 py-2 text-xs font-medium border-b border-amber-200">
            {bridgeState.message}
          </div>
        )}

        {/* Stats Bar */}
        <TaxSummaryDashboard invoices={filteredInvoices} />

        {/* Search & Filter Bar */}
        <SearchFilterBar
          filters={filters}
          onFilterChange={setFilters}
          onResetFilters={handleResetFilters}
          totalFilteredCount={filteredInvoices.length}
        />

        {/* Background Item & Service Enrichment Indicator */}
        {enrichStatus.isEnriching && (
          <div className="bg-emerald-50 border-y border-emerald-200 px-4 py-2 flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-emerald-950">
                  Đang tự động lấy tên hàng hóa, dịch vụ và XML từ Tổng cục Thuế:
                </span>
                <span className="bg-emerald-200/90 text-emerald-900 px-2 py-0.5 rounded text-[11px] font-bold font-mono">
                  {enrichStatus.completed} / {enrichStatus.total} hóa đơn
                </span>
                {enrichStatus.currentInvoice && (
                  <span className="text-emerald-700 text-[11px] font-mono">
                    ({enrichStatus.currentInvoice})
                  </span>
                )}
              </div>
            </div>
            <div className="text-[11px] text-emerald-700 hidden md:block">
              (Dữ liệu cập nhật trực tiếp vào danh sách và xuất Excel chuẩn)
            </div>
          </div>
        )}

        {/* High Density Scrollable Data Grid Container */}
        <div className="flex-1 overflow-y-auto bg-[#f9fafb]">
          <InvoiceTable
            invoices={filteredInvoices}
            selectedInvoices={selectedInvoices}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onViewDetail={(inv) => setSelectedInvoiceForDetail(inv)}
            onDownloadXml={handleDownloadXml}
            onDownloadPdf={handleDownloadPdf}
            onBatchDownloadSelected={() => setIsBatchDownloadModalOpen(true)}
            onExportExcelSelected={() => handleExportExcel(selectedInvoices)}
            onQuickSyncPeriod={handleRunCrawler}
            onQuickResetPeriod={handleResetFilters}
            currentDateRange={{ from: filters.fromDate, to: filters.toDate }}
            currentMst={account.taxCode}
            hasSearched={hasSearched}
          />
        </div>

        {/* Live Bottom Console Dock */}
        <ConsoleDock
          logs={consoleLogs}
          isRunning={isRefreshing}
          onClearLogs={() => setConsoleLogs([])}
          onRunCrawler={handleRunCrawler}
          taxCode={account.taxCode}
          isCollapsed={isConsoleCollapsed}
          onToggleCollapse={handleToggleConsole}
        />
      </div>

      {/* 3. Modals */}
      <PosCaptchaModal
        isOpen={Boolean(pendingPosCaptcha)}
        captchaImage={pendingPosCaptcha?.captcha.captchaImage || ''}
        rangeLabel={pendingPosCaptcha?.rangeLabel || ''}
        onCancel={() => {
          pendingPosCaptcha?.resolve(null);
          setPendingPosCaptcha(null);
        }}
        onSubmit={(code) => {
          pendingPosCaptcha?.resolve(code);
          setPendingPosCaptcha(null);
        }}
      />

      {/* Account Configuration Modal */}
      <AccountConfigModal
        isOpen={isConfigModalOpen}
        currentConfig={account}
        onSave={handleSaveAccountConfig}
        onClose={() => setIsConfigModalOpen(false)}
      />

      {/* Batch Download Modal */}
      <BatchDownloadModal
        isOpen={isBatchDownloadModalOpen}
        invoices={selectedInvoices.length > 0 ? selectedInvoices : filteredInvoices}
        onClose={() => setIsBatchDownloadModalOpen(false)}
      />

      {/* Invoice Detail & Visual Original PDF Modal */}
      {selectedInvoiceForDetail && (
        <InvoiceDetailModal
          invoice={selectedInvoiceForDetail}
          allInvoices={filteredInvoices}
          onSelectInvoice={(inv) => setSelectedInvoiceForDetail(inv)}
          onClose={() => setSelectedInvoiceForDetail(null)}
          onDownloadXml={handleDownloadXml}
          onUpdateInvoice={(enriched) => {
            setInvoices(prev => prev.map(inv => inv.id === enriched.id ? enriched : inv));
            // Chỉ cập nhật hóa đơn đang xem nếu modal vẫn đang mở đúng hóa đơn
            // đó - tránh việc dữ liệu tải về muộn (sau khi người dùng đã đóng
            // modal) vô tình mở lại modal.
            setSelectedInvoiceForDetail(prev => (prev && prev.id === enriched.id ? enriched : prev));
          }}
          token={gdtSession?.token}
          cookieHeader={gdtSession?.cookieHeader}
        />
      )}

      {/* Import Real XML / ZIP Modal */}
      <ImportXmlModal
        isOpen={isImportXmlModalOpen}
        onClose={() => setIsImportXmlModalOpen(false)}
        onImportSuccess={handleImportXmlSuccess}
        onViewInvoice={(inv) => {
          setSelectedInvoiceForDetail(inv);
        }}
      />

      {/* Multi-Month Sync Progress & Report Modal */}
      <MultiMonthSyncModal
        isOpen={isMultiMonthModalOpen}
        onClose={() => setIsMultiMonthModalOpen(false)}
        syncState={syncState}
        account={account}
        allInvoices={invoices}
        onPauseSync={handlePauseSync}
        onResumeSync={handleResumeSync}
        onRetryChunk={handleRetryChunk}
        onStartSync={() => handleRunCrawler()}
      />

      {/* Persistent Floating Progress Badge */}
      {showFloatingBadge && !isMultiMonthModalOpen && (
        <FloatingSyncBadge
          syncState={syncState}
          onOpenModal={() => setIsMultiMonthModalOpen(true)}
          onDismiss={() => setShowFloatingBadge(false)}
        />
      )}
    </div>
  );
}
