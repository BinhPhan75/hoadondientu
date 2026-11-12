export const EASY_INVOICE_PRINT_STYLE_ID = 'easyinvoice-pagination-fix';

/**
 * Chuẩn hóa HTML của EasyInvoice để hỗ trợ ngắt trang (pagination) chuẩn A4
 * khi in ấn hoặc kết xuất PDF cho các hóa đơn có nhiều dòng hàng hóa.
 * 
 * Khắc phục triệt để lỗi bảng hàng hóa bị co cụm (squished) hoặc tràn trang:
 * - Gỡ bỏ giới hạn chiều cao cố định và overflow: hidden của container .VATTEMP
 * - Đảm bảo thead lặp lại ở mỗi đầu trang (display: table-header-group)
 * - Tự động ngắt trang tự nhiên giữa các dòng hàng (break-inside: avoid trên tr)
 */
export function prepareEasyInvoiceHtml(html: string): string {
  if (!html) return html;

  // 1. Gỡ bỏ inline height và overflow:hidden trên thẻ .VATTEMP hoặc container
  let processedHtml = html
    .replace(/<div([^>]*class=["'][^"']*(?:VATTEMP|invtable|invoice-content|content)[^"']*["'][^>]*)style=["']([^"']*)["']/gi, (match, p1, style) => {
      const cleanStyle = style
        .replace(/(?:max-)?height\s*:\s*[^;]+;?/gi, 'height: auto !important;')
        .replace(/overflow\s*:\s*[^;]+;?/gi, 'overflow: visible !important;');
      return `<div${p1}style="${cleanStyle}"`;
    });

  if (new RegExp(`id=["']${EASY_INVOICE_PRINT_STYLE_ID}["']`, 'i').test(processedHtml)) {
    return processedHtml;
  }

  const style = `<style id="${EASY_INVOICE_PRINT_STYLE_ID}">
    @page { 
      size: A4 portrait; 
      margin: 8mm 6mm; 
    }
    html, body { 
      height: auto !important; 
      min-height: 0 !important; 
      max-height: none !important; 
      overflow: visible !important; 
      background: #ffffff !important;
    }
    .VATTEMP, .VATTEMP .content, .VATTEMP #main-content, .VATTEMP .invtable, .VATTEMP .invtable-content,
    .main-page, .invoice-container, .invoice-content, .invoice-body, #invoice, #invoiceContent,
    .table-invoice, .tbl-custom, .inv-table, .container, #container, .panel-body {
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
      position: relative !important;
    }
    table, .invtable, .table-invoice, .res-tb { 
      width: 100% !important; 
      page-break-inside: auto !important; 
      break-inside: auto !important; 
    }
    thead, .invtable thead { 
      display: table-header-group !important; 
    }
    tfoot, .invtable tfoot { 
      display: table-footer-group !important; 
    }
    tr, .invtable tr, .prds tr, .data { 
      page-break-inside: avoid !important; 
      break-inside: avoid !important; 
    }
    .ft-sign, #footer, .footer, .sign-dx, .nextpage { 
      page-break-inside: avoid !important; 
      break-inside: avoid !important; 
    }
    @media print {
      html, body { 
        height: auto !important; 
        overflow: visible !important; 
        background: #ffffff !important;
      }
      .VATTEMP, .VATTEMP .content, .VATTEMP #main-content, .VATTEMP .invtable,
      .main-page, .invoice-container, .invoice-content, .invoice-body, #invoice, #invoiceContent {
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow: visible !important;
      }
      table, .invtable { 
        page-break-inside: auto !important; 
        break-inside: auto !important; 
      }
      thead, .invtable thead { 
        display: table-header-group !important; 
      }
      tr, .invtable tr, .prds tr { 
        page-break-inside: avoid !important; 
        break-inside: avoid !important; 
      }
      .print-actions, #inbt { 
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
