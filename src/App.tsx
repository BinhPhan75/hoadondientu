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
import { GDTAccountConfig, GDTInvoice, FilterParams, SeleniumLogEntry } from './types';
import { SAMPLE_GDT_INVOICES } from './data/sampleInvoices';
import { generateGDTInvoiceXml } from './utils/xmlGenerator';
import { exportInvoicesToExcel } from './utils/excelExporter';
import { generateMatchingInvoicesForPeriod } from './utils/invoiceGenerator';
import { ImportXmlModal } from './components/ImportXmlModal';

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
      taxCode: '0316892345',
      password: 'Gdt@Tax2025!',
      taxpayerName: 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG ĐÔNG NAM Á',
      address: 'Số 142 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP Hồ Chí Minh',
      rememberMe: true,
      autoSaveSession: true,
      useHeadlessBrowser: true
    };
  });

  // Master Invoices State
  const [invoices, setInvoices] = useState<GDTInvoice[]>(SAMPLE_GDT_INVOICES);
  const [selectedInvoices, setSelectedInvoices] = useState<GDTInvoice[]>([]);
  const [dataSourceType, setDataSourceType] = useState<'live_gdt' | 'imported_xml' | 'sample_demo'>(() => 
    account.isRealGDT ? 'live_gdt' : 'sample_demo'
  );

  // Filter Parameters State
  const [filters, setFilters] = useState<FilterParams>({
    invoiceType: 'both',
    fromDate: '2025-01-01',
    toDate: '2025-03-31',
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
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<GDTInvoice | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

  // Run Crawler / Sync matching invoices for current filter period
  const handleRunCrawler = async (credentials?: CrawlerCredentials) => {
    setIsRefreshing(true);
    const mst = credentials?.taxCode?.trim() || account.taxCode?.trim() || '0316892345';
    const pwd = credentials?.password?.trim() || account.password?.trim() || '';

    // If explicit Demo request
    if (credentials?.isDemo) {
      setAccount(prev => ({
        ...prev,
        taxCode: '0316892345',
        password: 'Gdt@Tax2025!',
        taxpayerName: 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG ĐÔNG NAM Á',
        isRealGDT: false
      }));
      const synchronizedInvoices = generateMatchingInvoicesForPeriod({
        taxCode: '0316892345',
        taxpayerName: 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG ĐÔNG NAM Á',
        address: account.address,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        invoiceType: filters.invoiceType
      });
      setInvoices(synchronizedInvoices);
      setSelectedInvoices([]);
      setDataSourceType('sample_demo');
      setConsoleLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'info',
          message: `[CHẾ ĐỘ MẪU] Đã nạp ${synchronizedInvoices.length} hóa đơn mẫu minh họa theo kỳ lọc (${filters.fromDate} -> ${filters.toDate}).`
        }
      ]);
      setIsRefreshing(false);
      return { success: true };
    }

    // Step 1: Check if we need to authenticate with GDT
    const hasCaptcha = Boolean(credentials?.captchaCode?.trim());
    const needLogin = !account.isRealGDT || (credentials && credentials.taxCode !== account.taxCode) || hasCaptcha;

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
            captchaCode: credentials?.captchaCode
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
        setAccount(prev => ({
          ...prev,
          taxCode: mst,
          password: pwd,
          isRealGDT: loginData.isRealGDT,
          taxpayerName: loginData.session?.taxpayerName || prev.taxpayerName,
          address: loginData.session?.address || prev.address
        }));

        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'success',
            message: `[ĐĂNG NHẬP THÀNH CÔNG] Đã xác thực với Cổng Thuế hoadondientu.gdt.gov.vn cho MST ${mst} (Người nộp thuế: ${loginData.session?.taxpayerName || mst}).`
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

    // Step 2: Query Invoices from GDT
    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'step',
        message: `[KẾT NỐI TỔNG CỤC THUẾ] Bắt đầu tra cứu cho MST ${mst} (Kỳ: ${filters.fromDate} -> ${filters.toDate})...`
      }
    ]);

    try {
      const res = await fetch('/api/gdt/query-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          invoiceType: filters.invoiceType,
          size: 50
        })
      });

      const rawQueryText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawQueryText);
      } catch {
        data = { success: false, message: `Máy chủ phản hồi mã ${res.status}` };
      }

      if (res.ok && data.isRealGDT && Array.isArray(data.invoices)) {
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
      } else if (res.status === 401 && data.isExpired) {
        setAccount(prev => ({ ...prev, isRealGDT: false }));
        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'warning',
            message: `[PHIÊN HẾT HẠN] ${data.message || 'Phiên làm việc đã hết hạn, vui lòng nhập mã Captcha mới.'}`
          }
        ]);
        return { success: false, error: data.message };
      } else {
        // In demo sandbox mode or user not logged in with GDT credentials
        const synchronizedInvoices = generateMatchingInvoicesForPeriod({
          taxCode: mst,
          taxpayerName: account.taxpayerName,
          address: account.address,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          invoiceType: filters.invoiceType
        });

        setInvoices(synchronizedInvoices);
        setSelectedInvoices([]);
        setDataSourceType('sample_demo');

        setConsoleLogs(prev => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            level: 'info',
            message: `[CHẾ ĐỘ MẪU] Đã hiển thị ${synchronizedInvoices.length} hóa đơn mẫu minh họa (${filters.fromDate} -> ${filters.toDate}). Để kết nối dữ liệu thật từ Tổng cục Thuế, hãy nhập mã Captcha trong thanh bên trái và bấm Bắt đầu truy xuất.`
          }
        ]);
        return { success: true };
      }
    } catch (err: any) {
      console.error('Error querying GDT invoices:', err);
      const synchronizedInvoices = generateMatchingInvoicesForPeriod({
        taxCode: mst,
        taxpayerName: account.taxpayerName,
        address: account.address,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        invoiceType: filters.invoiceType
      });
      setInvoices(synchronizedInvoices);
      setSelectedInvoices([]);
      setDataSourceType('sample_demo');
      setConsoleLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'warning',
          message: `Không thể kết nối máy chủ CQT (${err.message}). Đã chuyển sang chế độ dữ liệu thử nghiệm.`
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

  // Reset Filters to Sample Data Period (Q1/2025)
  const handleResetFilters = () => {
    setFilters({
      invoiceType: 'both',
      fromDate: '2025-01-01',
      toDate: '2025-03-31',
      status: 'all',
      cqtCodeStatus: 'all',
      sellerTaxCode: '',
      buyerTaxCode: '',
      searchKeyword: '',
      taxRateFilter: 'all'
    });
    setDataSourceType('sample_demo');
    setInvoices([...SAMPLE_GDT_INVOICES]);
    setSelectedInvoices([]);
    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'info',
        message: 'Đã đặt lại bộ lọc và nạp dữ liệu mẫu kỳ Quý 1/2025.'
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
      setDataSourceType('sample_demo');
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
        />

        {/* Data Source Notice Banner */}
        <div className="px-4 py-1.5 bg-gray-50 border-b border-[#d1d5db] text-xs flex items-center justify-between gap-2">
          {dataSourceType === 'live_gdt' ? (
            <div className="flex items-center gap-2 text-emerald-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span><strong>CỔNG THUẾ TRỰC TIẾP:</strong> Đang kết nối trực tiếp với <code>hoadondientu.gdt.gov.vn</code> (MST: <strong>{account.taxCode}</strong>).</span>
            </div>
          ) : dataSourceType === 'imported_xml' ? (
            <div className="flex items-center gap-2 text-blue-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span><strong>TỆP XML THỰC TẾ:</strong> Đang hiển thị dữ liệu gốc trích xuất từ file XML/ZIP Tổng cục Thuế.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-900">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span><strong>CHẾ ĐỘ MẪU (SANDBOX):</strong> Đang hiển thị dữ liệu mẫu minh họa. Để lấy hóa đơn thật từ Cổng Thuế, hãy</span>
              <button 
                onClick={() => setIsConfigModalOpen(true)} 
                className="font-bold underline text-[#ef4444] hover:text-red-700 cursor-pointer"
              >
                Đăng nhập tài khoản CQT
              </button>
              <span>hoặc</span>
              <button 
                onClick={() => setIsImportXmlModalOpen(true)} 
                className="font-bold underline text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                Nạp tệp XML/ZIP
              </button>
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

      {/* Invoice Detail & Visual Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoiceForDetail}
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
    </div>
  );
}
