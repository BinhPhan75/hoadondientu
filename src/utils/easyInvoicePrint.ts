export const EASY_INVOICE_PRINT_STYLE_ID = 'easyinvoice-pagination-fix';

/**
 * Chuẩn hóa HTML của EasyInvoice để hỗ trợ ngắt trang (pagination) chuẩn A4
 * khi in ấn hoặc kết xuất PDF cho các hóa đơn có nhiều dòng hàng hóa.
 * 
 * Khắc phục triệt để lỗi bảng hàng hóa bị co cụm (squished) hoặc tràn trang:
 * - Gỡ bỏ triệt để giới hạn chiều cao cố định và overflow: hidden của container .VATTEMP, #container, div
 * - Đảm bảo thead lặp lại ở mỗi đầu trang (display: table-header-group)
 * - Tự động ngắt trang tự nhiên giữa các dòng hàng (break-inside: avoid trên tr)
 */
export function prepareEasyInvoiceHtml(html: string): string {
  if (!html) return html;

  // 1. Gỡ bỏ triệt để inline height, max-height và overflow:hidden trên bất kỳ thẻ div, table, section nào
  let processedHtml = html
    .replace(/style=["']([^"']*)["']/gi, (match, style) => {
      if (!/(?:height|overflow)/i.test(style)) return match;
      const cleanStyle = style
        .replace(/(?:max-)?height\s*:\s*\d+(?:\.\d+)?(?:px|pt|em|rem|vh|mm|cm)\s*!important;?/gi, 'height: auto !important;')
        .replace(/(?:max-)?height\s*:\s*\d+(?:\.\d+)?(?:px|pt|em|rem|vh|mm|cm);?/gi, 'height: auto !important;')
        .replace(/overflow(?:-[xy])?\s*:\s*(?:hidden|scroll|auto)\s*!important;?/gi, 'overflow: visible !important;')
        .replace(/overflow(?:-[xy])?\s*:\s*(?:hidden|scroll|auto);?/gi, 'overflow: visible !important;');
      return `style="${cleanStyle}"`;
    });

  if (new RegExp(`id=["']${EASY_INVOICE_PRINT_STYLE_ID}["']`, 'i').test(processedHtml)) {
    return processedHtml;
  }

  const style = `<style id="${EASY_INVOICE_PRINT_STYLE_ID}">
    @page { 
      size: A4 portrait; 
      margin: 8mm 6mm; 
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body { 
      height: auto !important; 
      min-height: 0 !important; 
      max-height: none !important; 
      overflow: visible !important; 
      background: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
      font-size: 13px;
    }
    .VATTEMP, .VATTEMP *, #container, #container *, .invtable, .invtable *,
    .main-page, .invoice-container, .invoice-content, .invoice-body, #invoice, #invoiceContent,
    .table-invoice, .tbl-custom, .inv-table, .container, .panel-body, div[style*="height"] {
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
    }
    .VATTEMP, #container, .main-page, .invoice-container {
      position: relative !important;
      margin: 0 auto !important;
      width: 100% !important;
      max-width: 820px !important;
      background: #ffffff !important;
    }
    table, .invtable, .tbl-custom, .table-invoice, .res-tb, #table-inv { 
      width: 100% !important; 
      max-width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: auto !important; 
      break-inside: auto !important; 
    }
    thead, .invtable thead, .tbl-custom thead { 
      display: table-header-group !important; 
    }
    tfoot, .invtable tfoot, .tbl-custom tfoot { 
      display: table-footer-group !important; 
    }
    tbody {
      display: table-row-group !important;
    }
    tr, .invtable tr, .prds tr, .data tr, tr.tr-item { 
      page-break-inside: avoid !important; 
      break-inside: avoid !important; 
    }
    td, th {
      word-break: break-word !important;
    }
    .ft-sign, #footer, .footer, .sign-dx, .nextpage { 
      page-break-inside: avoid !important; 
      break-inside: avoid !important; 
    }
    .page-break, .pageBreak, .invoice-page { 
      break-after: page !important; 
      page-break-after: always !important; 
    }
    @media print {
      html, body { 
        height: auto !important; 
        overflow: visible !important; 
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .VATTEMP, .VATTEMP .content, .VATTEMP #main-content, .VATTEMP .invtable,
      .main-page, .invoice-container, .invoice-content, .invoice-body, #invoice, #invoiceContent,
      #container, .container {
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
        border: none !important;
        box-shadow: none !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: none !important;
      }
      table, .invtable, .tbl-custom { 
        page-break-inside: auto !important; 
        break-inside: auto !important; 
      }
      thead, .invtable thead, .tbl-custom thead { 
        display: table-header-group !important; 
      }
      tfoot, .invtable tfoot, .tbl-custom tfoot { 
        display: table-footer-group !important; 
      }
      tr, .invtable tr, .prds tr, .data tr { 
        page-break-inside: avoid !important; 
        break-inside: avoid !important; 
      }
      .print-actions, #inbt, .no-print { 
        display: none !important; 
      }
    }
  </style>`;

  if (/<\/head>/i.test(processedHtml)) {
    return processedHtml.replace(/<\/head>/i, `${style}</head>`);
  }
  if (/<head(?:\s[^>]*)?>/i.test(processedHtml)) {
    return processedHtml.replace(/<head(?:\s[^>]*)?>/i, match => `${match}${style}`);
  }
  if (/<html(?:\s[^>]*)?>/i.test(processedHtml)) {
    return processedHtml.replace(/<html(?:\s[^>]*)?>/i, match => `${match}<head>${style}</head>`);
  }
  return `${style}${processedHtml}`;
}
