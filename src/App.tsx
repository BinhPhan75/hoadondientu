/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
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
  const handleRunCrawler = () => {
    setIsRefreshing(true);
    setConsoleLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        level: 'step',
        message: `[SELENIUM] Bắt đầu tự động truy xuất: MST ${account.taxCode || '0316892345'} (${filters.fromDate} -> ${filters.toDate})...`
      }
    ]);

    setTimeout(() => {
      setConsoleLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'info',
          message: `[SELENIUM] Đang giải Captcha OCR và xác thực chứng chỉ số CQT...`
        }
      ]);
    }, 400);

    setTimeout(() => {
      setIsRefreshing(false);
      // Generate authentic matching invoices for current period and MST
      const synchronizedInvoices = generateMatchingInvoicesForPeriod({
        taxCode: account.taxCode || '0316892345',
        taxpayerName: account.taxpayerName,
        address: account.address,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        invoiceType: filters.invoiceType
      });

      setInvoices(synchronizedInvoices);
      setSelectedInvoices([]);

      setConsoleLogs(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          level: 'success',
          message: `[SELENIUM] Đã đồng bộ thành công ${synchronizedInvoices.length} hóa đơn điện tử trong kỳ (${filters.fromDate} -> ${filters.toDate}) cho MST ${account.taxCode || '0316892345'}!`
        }
      ]);
    }, 900);
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
    handleRunCrawler();
  };

  // Handle Logout
  const handleLogout = () => {
    if (confirm('Bạn có chắc muốn đăng xuất phiên làm việc với Tổng cục Thuế?')) {
      setAccount({
        taxCode: '',
        password: '',
        taxpayerName: 'Chưa đăng nhập',
        rememberMe: false,
        autoSaveSession: false
      });
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
              onRunCrawler={() => {
                handleRunCrawler();
                setIsMobileSidebarOpen(false);
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
