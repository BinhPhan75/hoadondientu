import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './src/App';
import { InvoiceTable } from './src/components/InvoiceTable';
import { TaxSummaryDashboard } from './src/components/TaxSummaryDashboard';
import { SearchFilterBar } from './src/components/SearchFilterBar';
import { Header } from './src/components/Header';
import { GDTInvoice } from './src/types';

// Mock window and browser globals
(globalThis as any).window = {
  location: { href: '', reload: () => {} },
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  open: () => null,
  print: () => {}
};
(globalThis as any).document = {
  createElement: () => ({ appendChild: () => {}, setAttribute: () => {}, click: () => {} }),
  body: { appendChild: () => {}, removeChild: () => {} }
};
(globalThis as any).sessionStorage = {
  getItem: () => null,
  setItem: () => {}
};
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

async function test() {
  console.log('--- Test 2: Invoices with edge cases / missing fields ---');
  const edgeCaseInvoices: any[] = [
    {}, // completely empty
    { id: '1' },
    { id: '2', shdon: '123' },
    { id: '3', shdon: '123', khhdon: '1K24TAA', nbmst: '0123456789' },
    { id: '4', shdon: '123', items: null },
    { id: '5', shdon: '123', items: [null, undefined, {}] },
    { id: '6', shdon: '123', items: [{ itemName: undefined }] },
    { id: '7', tdlap: null },
    { id: '8', tdlap: 'invalid-date' },
    { id: '9', tgtttbso: null, tgtcthue: undefined, tgtthue: NaN },
  ];

  for (let i = 0; i < edgeCaseInvoices.length; i++) {
    const inv = edgeCaseInvoices[i];
    try {
      renderToString(
        <InvoiceTable
          invoices={[inv]}
          selectedInvoices={[]}
          onToggleSelect={() => {}}
          onToggleSelectAll={() => {}}
          onViewDetail={() => {}}
          onDownloadXml={() => {}}
          onDownloadPdf={() => {}}
          onBatchDownloadSelected={() => {}}
          onExportExcelSelected={() => {}}
        />
      );
      renderToString(<TaxSummaryDashboard invoices={[inv]} />);
      console.log(`Case ${i} passed`);
    } catch (err: any) {
      console.error(`Case ${i} FAILED:`, err.message);
    }
  }
}

test();
