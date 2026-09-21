/**
 * Base Abstract Class for Invoice Provider Drivers
 * Implements the Adapter Pattern for Vietnamese E-Invoice Providers
 */

import { InvoiceProviderDriver, ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';

export abstract class BaseInvoiceProviderDriver implements InvoiceProviderDriver {
  abstract readonly name: string;
  abstract readonly providerCode: string;
  abstract readonly metadata: DriverMetadata;

  /**
   * Kiểm tra xem Driver này có thể xử lý dữ liệu XML được cung cấp hay không.
   */
  abstract canHandle(xmlData: string | ExtractedInvoiceInfo): Promise<boolean> | boolean;

  /**
   * Trích xuất thông tin cần thiết từ XML (Mã tra cứu, Mã bí mật, MST, Số HĐ...)
   */
  abstract extractInfo(xmlData: string): Promise<ExtractedInvoiceInfo> | ExtractedInvoiceInfo;

  /**
   * Thực hiện tra cứu và tải file PDF Hóa đơn gốc từ server của nhà cung cấp.
   */
  abstract fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult>;

  /**
   * Helper: Trích xuất giá trị một thẻ XML bất kỳ (hỗ trợ cả namespace & CDATA)
   */
  protected extractXmlTag(xml: string, tagName: string, defaultValue = ''): string {
    if (!xml) return defaultValue;
    const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, '');
    const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>`, 'i');
    const match = xml.match(regex);
    if (match && match[1]) {
      let val = match[1].trim();
      if (val.startsWith('<![CDATA[') && val.endsWith(']]>')) {
        val = val.substring(9, val.length - 3).trim();
      }
      return val;
    }
    return defaultValue;
  }

  /**
   * Helper: Trích xuất danh sách các block XML lặp lại
   */
  protected extractXmlBlocks(xml: string, tagName: string): string[] {
    if (!xml) return [];
    const cleanTag = tagName.replace(/[^a-zA-Z0-9_]/g, '');
    const regex = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${cleanTag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${cleanTag}>`, 'gi');
    const blocks: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(xml)) !== null) {
      if (m[1]) {
        blocks.push(m[1]);
      }
    }
    return blocks;
  }

  /**
   * Helper: Trích xuất trường dữ liệu trong thẻ <TTKhac> hoặc <TTin>
   * Nhiều nhà cung cấp HĐĐT (MISA, Viettel, 4Si, VNPT) để Mã tra cứu trong <TTin><TTruong>...</TTruong><DLieu>...</DLieu></TTin>
   */
  protected extractCustomField(xml: string, fieldKeywords: string[]): string {
    const blocks = [...this.extractXmlBlocks(xml, 'TTin'), ...this.extractXmlBlocks(xml, 'TTKhac')];
    const strip = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
    const wanted = fieldKeywords.map(strip);

    for (const block of blocks) {
      const truong = strip(this.extractXmlTag(block, 'TTruong') || this.extractXmlTag(block, 'TenTruong') || this.extractXmlTag(block, 'Name'));
      if (!truong) continue;
      for (const kw of wanted) {
        if (truong.includes(kw) || kw.includes(truong)) {
          const val = this.extractXmlTag(block, 'DLieu') || this.extractXmlTag(block, 'Data') || this.extractXmlTag(block, 'Value');
          if (val) return val;
        }
      }
    }
    return '';
  }

  /**
   * Helper: Tạo tên file PDF tiêu chuẩn
   */
  protected buildPdfFilename(info: ExtractedInvoiceInfo): string {
    const cleanSeries = (info.invoiceSeries || 'HD').replace(/[^a-zA-Z0-9]/g, '');
    const cleanNo = (info.invoiceNo || '0000001').padStart(7, '0');
    const cleanMst = (info.sellerTaxCode || 'MST').replace(/[^a-zA-Z0-9]/g, '');
    return `HD_${cleanSeries}_${cleanNo}_${cleanMst}_${this.providerCode}.pdf`;
  }

  /**
   * Helper: Ghi log thực thi
   */
  protected createLog(message: string, logs: string[]): void {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    const entry = `[${timestamp}] [${this.name}] ${message}`;
    logs.push(entry);
    console.log(entry);
  }
}
