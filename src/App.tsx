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
import { SAMPLE_PARTNER_INVOICES } from './data/samplePartnerInvoices';
import { ensureInvoiceItems, hasGenuineItems } from './utils/xmlParser';
import { executeGdtLogin, executeGdtInvoiceQuery, executeGdtInvoiceDetail } from './utils/gdtQueryClient';
import { RefreshCw } from 'lucide-react';

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
  const [invoices, setInvoices] = useState<GDTInvoice[]>(() => {
    const saved = localStorage.getItem('gdt_saved_invoices');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((inv: GDTInvoice) => {
            ensureInvoiceItems(inv);
            return inv;
          });
        }
      } catch (e) {}
    }
    return SAMPLE_PARTNER_INVOICES.map((inv: GDTInvoice) => {
      ensureInvoiceItems(inv);
      return inv;
    });
  });
  const [selectedInvoices, setSelectedInvoices] = useState<GDTInvoice[]>([]);
  const [dataSourceType, setDataSourceType] = useState<'live_gdt' | 'imported_xml'>('imported_xml');

  // Filter Parameters State
  const [filters, setFilters] = useState<FilterParams>({
    invoiceType: 'purchase',
    fromDate: '2025-01-01',
    toDate: '2026-12-31',
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

  // Automated sequential queue to retrieve item names & goods from GDT
  // Uses polite delays and sequential requests so GDT portal never throttles (429)
  const enqueueInvoicesForEnrichment = (newInvoices: GDTInvoice[], token: string, cookie: string) => {
    const toAdd = newInvoices.filter(inv => {
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

  // Multi-Month Sequential Execution
  const runMultiMonthQuery = async (activeToken: string, activeCookie: string, mst: string) => {
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
        const queryRes = await executeGdtInvoiceQuery({
          fromDate: chunk.fromDate,
          toDate: chunk.toDate,
          invoiceType: 'purchase',
          size: 50,
          token: activeToken,
          cookieHeader: activeCookie
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
      const queryRes = await executeGdtInvoiceQuery({
        fromDate: chunk.fromDate,
        toDate: chunk.toDate,
        invoiceType: 'purchase',
        size: 50,
        token: activeToken,
        cookieHeader: activeCookie
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
    setIsRefreshing(true);
    // A refresh starts a new result set immediately, including when login fails.
    setInvoices([]);
    setSelectedInvoices([]);
    setDataSourceType('live_gdt');
    try { localStorage.removeItem('gdt_saved_invoices'); } catch {}
    const mst = credentials?.taxCode?.trim() || account.taxCode?.trim() || '';
    const pwd = credentials?.password?.trim() || account.password?.trim() || '';

    if (!mst) {
      alert('Vui lòng nhập Mã số thuế để tra cứu.');
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

    if (needLogin && !hasCaptcha) {
      const message = 'Phiên Cổng Thuế đã mất hoặc hết hạn. Vui lòng nhập lại Captcha để đăng nhập lại trước khi tra cứu.';
      setAccount(prev => ({ ...prev, isRealGDT: false }));
      setConsoleLogs(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'warning',
        message: `[PHIÊN CỔNG THUẾ] ${message}`
      }]);
      setIsRefreshing(false);
      return { success: false, error: message };
    }

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
        const loginResult = await executeGdtLogin({
          taxCode: mst,
          password: pwd,
          captchaKey: credentials?.captchaKey,
          captchaCode: credentials?.captchaCode,
          captchaCookie: credentials?.captchaCookie
        });

        if (!loginResult.success || !loginResult.token) {
          const errMsg = loginResult.error || 'Xác thực thất bại từ Cổng Tổng cục Thuế. Vui lòng kiểm tra lại MST, Mật khẩu hoặc Captcha.';
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
      const queryRes = await executeGdtInvoiceQuery({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        invoiceType: 'purchase',
        size: 50,
        token: activeToken,
        cookieHeader: activeCookie
      });

      if (queryRes.success && Array.isArray(queryRes.invoices)) {
        setInvoices(queryRes.invoices);
        setSelectedInvoices([]);
        setDataSourceType('live_gdt');
        enqueueInvoicesForEnrichment(queryRes.invoices, activeToken, activeCookie);
        const sourceNotice = queryRes.source === 'direct_browser' ? ' (kết nối trực tiếp)' : '';
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'success',
            message: `[CỔNG THUẾ TRỰC TIẾP] Đã lấy thành công ${queryRes.invoices.length} hóa đơn thực tế từ hoadondientu.gdt.gov.vn${sourceNotice}!`
          }
        ]);
        return { success: true };
      } else if (queryRes.status === 401) {
        setAccount(prev => ({ ...prev, isRealGDT: false }));
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'warning',
            message: `[PHIÊN HẾT HẠN / CHƯA ĐĂNG NHẬP] ${queryRes.message || 'Vui lòng nhập mã Captcha ở bảng bên trái để kết nối Tổng cục Thuế.'}`
          }
        ]);
        return { success: false, error: queryRes.message };
      } else {
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
      invoiceType: 'purchase',
      fromDate: '2025-01-01',
      toDate: '2026-12-31',
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

  // Reset & load authentic partner invoices
  const handleResetToPartnerSamples = () => {
    const refreshed = SAMPLE_PARTNER_INVOICES.map(inv => {
      ensureInvoiceItems(inv);
      return inv;
    });
    setInvoices(refreshed);
    setSelectedInvoices([]);
    setDataSourceType('imported_xml');
    setFilters({
      invoiceType: 'purchase',
      fromDate: '2025-01-01',
      toDate: '2026-12-31',
      status: 'all',
      cqtCodeStatus: 'all',
      sellerTaxCode: '',
      buyerTaxCode: '',
      searchKeyword: '',
      taxRateFilter: 'all'
    });
    localStorage.setItem('gdt_saved_invoices', JSON.stringify(refreshed));
    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'success',
        message: '✓ Đã khôi phục 7 hóa đơn mẫu gốc chính xác của các đối tác chính (Bảo Duy, PNJ, Tài Trâm Anh, Xuân Vinh, Kim Loan Tuấn, TKJ, Nghĩa Sơn) với danh sách hàng hóa chi tiết thực tế.'
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
          onToggleSidebar={() => setIsMobileSidebarOpen(true)}
        />

        {/* Stats Bar */}
        <TaxSummaryDashboard invoices={filteredInvoices} />

        {/* Search & Filter Bar */}
        <SearchFilterBar
          filters={filters}
          onFilterChange={setFilters}
          onResetFilters={handleResetFilters}
          onResetToPartnerSamples={handleResetToPartnerSamples}
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
