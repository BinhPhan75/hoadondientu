export const EASY_INVOICE_PRINT_STYLE_ID = 'easyinvoice-pagination-fix';

export function prepareEasyInvoiceHtml(html: string): string {
  if (!html || new RegExp(`id=["']${EASY_INVOICE_PRINT_STYLE_ID}["']`, 'i').test(html)) {
    return html;
  }

  const style = `<style id="${EASY_INVOICE_PRINT_STYLE_ID}">
    @page { size: A4 portrait; margin: 8mm; }
    html, body { height: auto !important; min-height: 0 !important; max-height: none !important; overflow: visible !important; }
    .main-page, .invoice-container, .invoice-content, .invoice-body, #invoice, #invoiceContent {
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
    }
    table { width: 100%; page-break-inside: auto !important; break-inside: auto !important; }
    thead { display: table-header-group !important; }
    tfoot { display: table-footer-group !important; }
    tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    @media print {
      html, body { height: auto !important; overflow: visible !important; }
      .main-page, .invoice-container, .invoice-content, .invoice-body, #invoice, #invoiceContent {
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
      }
      table { page-break-inside: auto !important; break-inside: auto !important; }
      thead { display: table-header-group !important; }
      tr { page-break-inside: avoid !important; break-inside: avoid !important; }
    }
  </style>`;

  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${style}</head>`);
  if (/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, match => `${match}${style}`);
  return html.replace(/<html(?:\s[^>]*)?>/i, match => `${match}<head>${style}</head>`);
}
