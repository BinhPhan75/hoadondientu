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
import { PythonSeleniumModal } from './components/PythonSeleniumModal';
import { MultiMonthSyncModal } from './components/MultiMonthSyncModal';
import { FloatingSyncBadge } from './components/FloatingSyncBadge';
import { GDTAccountConfig, GDTInvoice, FilterParams, SeleniumLogEntry, MultiMonthSyncState, MonthSyncChunk } from './types';
import { generateGDTInvoiceXml } from './utils/xmlGenerator';
import { exportInvoicesToExcel, exportComprehensiveMultiMonthReport } from './utils/excelExporter';
import { ImportXmlModal } from './components/ImportXmlModal';
import { isMultiMonthRange, generateMonthChunks } from './utils/dateChunker';

export default function App() {
  // Account Configuration State (from localStorage or default)
  const [account, setAccount] = useState<GDTAccountConfig>(() => {
    const saved = localStorage.getItem('gdt_account_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return {
      taxCode: '',
      password: '',
      taxpayerName: 'Chưa đăng nhập CQT',
      address: '',
      rememberMe: true,
      autoSaveSession: true,
      useHeadlessBrowser: true,
      isRealGDT: false
    };
  });

  // Master Invoices State (Real Data from Live GDT or Imported XML)
  const [invoices, setInvoices] = useState<GDTInvoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<GDTInvoice[]>([]);
  const [dataSourceType, setDataSourceType] = useState<'live_gdt' | 'imported_xml'>('live_gdt');

  // Filter Parameters State
  const [filters, setFilters] = useState<FilterParams>({
    invoiceType: 'both',
    fromDate: '2025-01-01',
    toDate: '2025-12-31',
    status: 'all',
    cqtCodeStatus: 'all',
    sellerTaxCode: '',
    buyerTaxCode: '',
    searchKeyword: '',
    taxRateFilter: 'all'
  });

  // Modals Visibility State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isBatchDownloadModalOpen, setIsBatchDownloadModalOpen] = useState(false);
  const [isSeleniumModalOpen, setIsSeleniumModalOpen] = useState(false);
  const [isImportXmlModalOpen, setIsImportXmlModalOpen] = useState(false);
  const [isMultiMonthModalOpen, setIsMultiMonthModalOpen] = useState(false);
  const [showFloatingBadge, setShowFloatingBadge] = useState(false);
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<GDTInvoice | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
    totalPayment: 0
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
      message: `Đã nạp hồ sơ MST: ${account.taxCode || '0316892345'} - Tự động nhận diện chứng thư số CQT.`
    }
  ]);

  // Save account to localStorage if rememberMe is enabled
  useEffect(() => {
    if (account.rememberMe) {
      localStorage.setItem('gdt_account_config', JSON.stringify(account));
    } else {
      localStorage.removeItem('gdt_account_config');
    }
  }, [account]);

  // Filter Invoices according to all criteria
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Invoice Type Filter (Purchase / Sold / Both)
      if (filters.invoiceType !== 'both' && inv.loaiHdon !== filters.invoiceType) {
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

  // Download / View PDF
  const handleDownloadPdf = (invoice: GDTInvoice) => {
    setSelectedInvoiceForDetail(invoice);
  };

  // Export Excel
  const handleExportExcel = (targetInvoices?: GDTInvoice[]) => {
    const listToExport = targetInvoices && targetInvoices.length > 0 ? targetInvoices : filteredInvoices;
    if (listToExport.length === 0) {
      alert('Không có dữ liệu hóa đơn nào để xuất Excel.');
      return;
    }
    exportInvoicesToExcel(listToExport, `Bang_Ke_Hoa_Don_GDT_${account.taxCode}`);
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

  // Download Standalone Python Package
  const handleDownloadPythonScript = () => {
    window.location.href = '/api/gdt/download-python-package';
  };

  // Multi-Month Sequential Execution
  const runMultiMonthQuery = async (activeToken: string, activeCookie: string, mst: string) => {
    const chunks = generateMonthChunks(filters.fromDate, filters.toDate);
    if (chunks.length === 0) return { success: false, error: 'Khoảng thời gian không hợp lệ' };

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
      totalPayment: 0
    });

    setIsMultiMonthModalOpen(true);
    setShowFloatingBadge(true);

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
        const res = await fetch('/api/gdt/query-invoices', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': activeToken,
            'x-gdt-cookie': activeCookie
          },
          body: JSON.stringify({
            fromDate: chunk.fromDate,
            toDate: chunk.toDate,
            invoiceType: filters.invoiceType,
            size: 50,
            token: activeToken,
            cookieHeader: activeCookie
          })
        });

        const rawText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { success: false, message: `Lỗi phân tích máy chủ HTTP ${res.status}` };
        }

        if (res.ok && Array.isArray(data.invoices)) {
          const monthInvoices: GDTInvoice[] = data.invoices;
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

          setConsoleLogs(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              level: 'success',
              message: `✓ [HOÀN TẤT ${chunk.label}] Thu được ${monthInvoices.length} HĐ (${purchases.length} mua vào, ${solds.length} bán ra). Tổng lũy kế: ${runningTotalInvoices} HĐ.`
            }
          ]);
        } else if (res.status === 401) {
          hasEncounteredError = true;
          setAccount(prev => ({ ...prev, isRealGDT: false }));
          setSyncState(prev => ({
            ...prev,
            hasErrors: true,
            chunks: prev.chunks.map((c, idx) => idx === i ? { ...c, status: 'failed' as const, errorMessage: 'Phiên Cổng Thuế hết hạn, cần nhập Captcha' } : c)
          }));
          setConsoleLogs(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substring(2, 9),
              timestamp: new Date().toLocaleTimeString('vi-VN'),
              level: 'error',
              message: `[PHIÊN HẾT HẠN] Phiên làm việc Cổng Thuế hết hạn khi đang tra cứu ${chunk.label}. Vui lòng nhập Captcha mới và bấm Thử lại.`
            }
          ]);
          break;
        } else {
          hasEncounteredError = true;
          const msg = data.message || `Lỗi máy chủ (${res.status})`;
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

    setSyncState(prev => ({
      ...prev,
      isActive: false,
      isCompleted: true,
      hasErrors: hasEncounteredError
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
      const res = await fetch('/api/gdt/query-invoices', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': activeToken,
          'x-gdt-cookie': activeCookie
        },
        body: JSON.stringify({
          fromDate: chunk.fromDate,
          toDate: chunk.toDate,
          invoiceType: filters.invoiceType,
          size: 50,
          token: activeToken,
          cookieHeader: activeCookie
        })
      });

      const data = await res.json().catch(() => ({ success: false }));

      if (res.ok && Array.isArray(data.invoices)) {
        const monthInvoices: GDTInvoice[] = data.invoices;
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
            message: `✓ [THỬ LẠI THÀNH CÔNG] Đã lấy thành công ${monthInvoices.length} hóa đơn của ${chunk.label}!`
          }
        ]);
      } else {
        const errMsg = data.message || `Lỗi HTTP ${res.status}`;
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
    setIsRefreshing(true);
    const mst = credentials?.taxCode?.trim() || account.taxCode?.trim() || '';
    const pwd = credentials?.password?.trim() || account.password?.trim() || '';

    if (!mst) {
      alert('Vui lòng nhập Mã số thuế để tra cứu.');
      setIsRefreshing(false);
      return { success: false, error: 'Chưa có Mã số thuế' };
    }

    // Step 1: Check if we need to authenticate with GDT
    const hasCaptcha = Boolean(credentials?.captchaCode?.trim());
    const needLogin = !account.isRealGDT || (credentials && credentials.taxCode !== account.taxCode) || hasCaptcha;

    let activeToken = gdtSession?.token || '';
    let activeCookie = gdtSession?.cookieHeader || '';

    if (needLogin && hasCaptcha) {
      setConsoleLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'step',
          message: `[XÁC THỰC CỔNG THUẾ] Đang gửi thông tin đăng nhập và Captcha cho MST ${mst}...`
        }
      ]);

      try {
        const loginRes = await fetch('/api/gdt/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taxCode: mst,
            password: pwd,
            captchaKey: credentials?.captchaKey,
            captchaCode: credentials?.captchaCode,
            captchaCookie: credentials?.captchaCookie
          })
        });

        const rawLoginText = await loginRes.text();
        let loginData: any = {};
        try {
          loginData = JSON.parse(rawLoginText);
        } catch {
          loginData = {
            success: false,
            message: `Máy chủ phản hồi mã ${loginRes.status}. Vui lòng thử lại.`
          };
        }

        if (!loginRes.ok || !loginData.success) {
          const errMsg = loginData.message || 'Xác thực thất bại từ Cổng Tổng cục Thuế. Vui lòng kiểm tra lại MST, Mật khẩu hoặc Captcha.';
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
        if (loginData.session?.token) {
          activeToken = loginData.session.token;
          activeCookie = loginData.session.cookieHeader || '';
          const newSession = { token: activeToken, cookieHeader: activeCookie };
          setGdtSession(newSession);
          try {
            sessionStorage.setItem('gdt_session_tokens', JSON.stringify(newSession));
          } catch {}
        }

        setAccount(prev => ({
          ...prev,
          taxCode: mst,
          password: pwd,
          isRealGDT: true,
          taxpayerName: loginData.session?.taxpayerName || prev.taxpayerName,
          address: loginData.session?.address || prev.address
        }));

        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'success',
            message: `[ĐĂNG NHẬP THÀNH CÔNG] Đã xác thực thành công với Cổng Tổng cục Thuế cho MST ${mst} (${loginData.session?.taxpayerName || mst}).`
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

    // Step 2: Check if multi-month range is requested (> 1 month)
    if (isMultiMonthRange(filters.fromDate, filters.toDate)) {
      return await runMultiMonthQuery(activeToken, activeCookie, mst);
    }

    // Step 3: Single-month Query from GDT
    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'step',
        message: `[KẾT NỐI TỔNG CỤC THUẾ] Bắt đầu tra cứu hóa đơn thực tế cho MST ${mst} (Kỳ: ${filters.fromDate} -> ${filters.toDate})...`
      }
    ]);

    try {
      const res = await fetch('/api/gdt/query-invoices', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': activeToken,
          'x-gdt-cookie': activeCookie
        },
        body: JSON.stringify({
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          invoiceType: filters.invoiceType,
          size: 50,
          token: activeToken,
          cookieHeader: activeCookie
        })
      });

      const rawQueryText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawQueryText);
      } catch {
        data = { success: false, message: `Máy chủ phản hồi mã ${res.status}` };
      }

      if (res.ok && Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
        setSelectedInvoices([]);
        setDataSourceType('live_gdt');
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'success',
            message: `[CỔNG THUẾ TRỰC TIẾP] Đã lấy thành công ${data.invoices.length} hóa đơn thực tế từ hoadondientu.gdt.gov.vn!`
          }
        ]);
        return { success: true };
      } else if (res.status === 401) {
        setAccount(prev => ({ ...prev, isRealGDT: false }));
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'warning',
            message: `[PHIÊN HẾT HẠN / CHƯA ĐĂNG NHẬP] ${data.message || 'Vui lòng nhập mã Captcha ở bảng bên trái để kết nối Tổng cục Thuế.'}`
          }
        ]);
        return { success: false, error: data.message };
      } else {
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'error',
            message: `[TRA CỨU THẤT BẠI] ${data.message || 'Không thể lấy dữ liệu từ Cổng Thuế'}`
          }
        ]);
        return { success: false, error: data.message };
      }
    } catch (err: any) {
      console.error('Error querying GDT invoices:', err);
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
          invoiceType: 'both'
        }));
      }
    }

    setDataSourceType('imported_xml');
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

  // Reset Filters
  const handleResetFilters = () => {
    setFilters({
      invoiceType: 'both',
      fromDate: '2025-01-01',
      toDate: '2025-12-31',
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
        message: 'Đã đặt lại các điều kiện lọc về mặc định cả năm 2025.'
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
      setIsConfigModalOpen(true);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f3f4f6] text-[#1f2937]">
      {/* 1. Left Sidebar (High Density Dark Theme) */}
      <div className="hidden lg:block h-full">
        <Sidebar
          account={account}
          filters={filters}
          onFilterChange={setFilters}
          onUpdateAccount={setAccount}
          onRunCrawler={handleRunCrawler}
          isLoading={isRefreshing}
          onOpenConfigModal={() => setIsConfigModalOpen(true)}
          onOpenPythonRunner={() => setIsSeleniumModalOpen(true)}
          onDownloadPackage={handleDownloadPythonScript}
          onOpenImportXml={() => setIsImportXmlModalOpen(true)}
        />
      </div>

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
              onOpenPythonRunner={() => {
                setIsSeleniumModalOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              onDownloadPackage={handleDownloadPythonScript}
              onOpenImportXml={() => {
                setIsImportXmlModalOpen(true);
                setIsMobileSidebarOpen(false);
              }}
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
          onOpenSeleniumModal={() => setIsSeleniumModalOpen(true)}
          onDownloadPythonScript={handleDownloadPythonScript}
          onRefreshData={handleRunCrawler}
          onOpenImportXml={() => setIsImportXmlModalOpen(true)}
          onOpenMonthlyReport={() => setIsMultiMonthModalOpen(true)}
          isMultiMonthActive={syncState.isActive}
          isRefreshing={isRefreshing}
          onLogout={handleLogout}
          onToggleSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Stats Bar */}
        <TaxSummaryDashboard invoices={filteredInvoices} />

        {/* Search & Filter Bar */}
        <SearchFilterBar
          filters={filters}
          onFilterChange={setFilters}
          onResetFilters={handleResetFilters}
          onRunSelenium={handleRunCrawler}
          isLoading={isRefreshing}
          totalFilteredCount={filteredInvoices.length}
          onOpenImportXml={() => setIsImportXmlModalOpen(true)}
          onOpenMonthlyReport={() => setIsMultiMonthModalOpen(true)}
        />

        {/* Data Source Notice Banner */}
        <div className="px-4 py-1.5 bg-gray-50 border-b border-[#d1d5db] text-xs flex items-center justify-between gap-2">
          {dataSourceType === 'live_gdt' ? (
            <div className="flex items-center gap-2 text-emerald-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span><strong>KẾT NỐI TRỰC TIẾP CỔNG THUẾ:</strong> {account.isRealGDT ? `Đang kết nối phiên làm việc Tổng cục Thuế (MST: ${account.taxCode || '---'})` : 'Chưa kết nối phiên Tổng cục Thuế. Vui lòng nhập Captcha ở bảng bên trái.'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-blue-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span><strong>TỆP XML THỰC TẾ:</strong> Đang hiển thị dữ liệu gốc trích xuất từ tệp XML/ZIP hóa đơn Tổng cục Thuế.</span>
            </div>
          )}

          <div className="text-[11px] text-gray-500 font-mono hidden md:block">
            {filteredInvoices.length} hóa đơn trong kỳ ({filters.fromDate} → {filters.toDate})
          </div>
        </div>

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
            onOpenImportXml={() => setIsImportXmlModalOpen(true)}
            currentDateRange={{ from: filters.fromDate, to: filters.toDate }}
            currentMst={account.taxCode}
          />
        </div>

        {/* Live Bottom Console Dock */}
        <ConsoleDock
          logs={consoleLogs}
          isRunning={isRefreshing}
          onClearLogs={() => setConsoleLogs([])}
          onRunCrawler={handleRunCrawler}
          taxCode={account.taxCode}
        />
      </div>

      {/* 3. Modals */}
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
      <InvoiceDetailModal
        invoice={selectedInvoiceForDetail}
        allInvoices={filteredInvoices}
        onSelectInvoice={(inv) => setSelectedInvoiceForDetail(inv)}
        onClose={() => setSelectedInvoiceForDetail(null)}
        onDownloadXml={handleDownloadXml}
      />

      {/* Python Selenium Execution Modal */}
      <PythonSeleniumModal
        isOpen={isSeleniumModalOpen}
        account={account}
        onClose={() => setIsSeleniumModalOpen(false)}
        onDownloadPackage={handleDownloadPythonScript}
      />

      {/* Import Real XML / ZIP Modal */}
      <ImportXmlModal
        isOpen={isImportXmlModalOpen}
        onClose={() => setIsImportXmlModalOpen(false)}
        onImportSuccess={handleImportXmlSuccess}
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
