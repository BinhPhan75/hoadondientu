import React from 'react';
import { createRoot } from 'react-dom/client';
import { InvoiceDetailModal } from '../../src/components/InvoiceDetailModal';
import { loadOriginalInvoice } from '../../src/services/originalInvoiceLoader';
import '../../src/index.css';

const root = createRoot(document.getElementById('root'));
const invoice = (id, provider = 'MISA') => ({
  id, provider, nbmst: '0123456789', nbten: 'Test Supplier', khmshdon: '1',
  khhdon: 'C26TAA', shdon: id, tdlap: '2026-07-01', loaiHdon: 'purchase',
  sourceCompleteness: 'detail', lookupCode: 'TEST' + id,
  rawXml: '<HDon><MSTTCGP>' + (provider === 'MINVOICE' ? '0106026495' : '0101243150') + '</MSTTCGP></HDon>',
  items: [{ ten: 'Test item', itemName: 'Test item', unit: 'Cai', quantity: 1, amount: 100 }],
});
window.showInvoice = (id, provider) => root.render(
  <InvoiceDetailModal invoice={id ? invoice(id, provider) : null} onClose={() => window.showInvoice(null)} />,
);
window.prefetch = (id, provider) => loadOriginalInvoice(invoice(id, provider));
window.ready = true;
