/**
 * ThaiSonDriver: Driver hỗ trợ nhận diện và tra cứu HĐĐT Thái Sơn (einvoice.vn)
 * Cổng tra cứu: https://einvoice.vn/tra-cuu
 */

import { BaseInvoiceProviderDriver } from './InvoiceProviderDriver';
import { ExtractedInvoiceInfo, DownloadResult, DownloadOptions, DriverMetadata } from '../types';
import { detectProvider } from '../providerDetector';
import { GenericFallbackDriver } from './GenericFallbackDriver';
import { downloadOriginalThaiSonPdf } from '../../thaiSonInvoiceService';
import { OriginalInvoiceError } from '../OriginalInvoiceError';
import { extractLookupDetailsFromXml } from '../../../utils/xmlParser';
import { lookupPortalForSeller } from '../../../utils/providerIdentity';

export class ThaiSonDriver extends BaseInvoiceProviderDriver {
  readonly name = 'Thái Sơn E-Invoice Driver';
  readonly providerCode = 'THAISON';
  readonly metadata: DriverMetadata = {
    name: 'Thái Sơn E-Invoice Driver',
    providerCode: 'THAISON',
    description: 'Tra cứu & xử lý hóa đơn điện tử Thái Sơn (einvoice.vn) qua Mã tra cứu / MST bên bán',
    sampleUrl: 'https://einvoice.vn/tra-cuu',
    supportsCaptcha: true,
    requiredFields: ['lookupCode', 'sellerTaxCode']
  };

  private fallback = new GenericFallbackDriver();

  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    if (typeof xmlData !== 'string') {
      return xmlData.provider === 'THAISON';
    }
    return detectProvider(xmlData) === 'THAISON';
  }

  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    const sellerTaxCode = this.extractXmlTag(xmlData, 'MST') || this.extractXmlTag(xmlData, 'nbmst');
    const sellerName = this.extractXmlTag(xmlData, 'Ten') || this.extractXmlTag(xmlData, 'nbten');
    const invoiceNo = (this.extractXmlTag(xmlData, 'SHDon') || this.extractXmlTag(xmlData, 'shdon') || '1').padStart(7, '0');
    const invoiceSeries = this.extractXmlTag(xmlData, 'KHHDon') || this.extractXmlTag(xmlData, 'khhdon') || '1C24TTS';
    const templateCode = this.extractXmlTag(xmlData, 'KHMSHDon') || this.extractXmlTag(xmlData, 'khmshdon') || '1';
    const invoiceDate = this.extractXmlTag(xmlData, 'NLap') || this.extractXmlTag(xmlData, 'nlap') || new Date().toISOString();
    const cqtCode = this.extractXmlTag(xmlData, 'MCCQT') || this.extractXmlTag(xmlData, 'mhdon');

    const lookupDetails = extractLookupDetailsFromXml(xmlData);
    const lookupCode = this.extractXmlTag(xmlData, 'MaNhanHoaDon') ||
                     this.extractXmlTag(xmlData, 'MaNhanHDon') ||
                     this.extractCustomField(xmlData, ['Mã tra cứu', 'MaTraCuu', 'MTCuu', 'Mã nhận hóa đơn']) ||
                     this.extractXmlTag(xmlData, 'MTCuu') || 
                     this.extractXmlTag(xmlData, 'MaTraCuu') ||
                     lookupDetails.lookupCode;

    return {
      provider: this.providerCode,
      providerName: 'Thái Sơn E-Invoice',
      sellerTaxCode,
      sellerName,
      invoiceNo,
      invoiceSeries,
      templateCode,
      invoiceDate,
      cqtCode,
      lookupCode,
      lookupUrl: lookupDetails.lookupUrl || lookupPortalForSeller(sellerTaxCode) || '',
      rawXml: xmlData,
      additionalData: {
        msttcgp: '0101300842'
      }
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo, options?: DownloadOptions): Promise<DownloadResult> {
    const logs: string[] = [];
    this.createLog(`Khởi động xử lý HĐĐT Thái Sơn E-Invoice: Số ${info.invoiceNo}, Ký hiệu ${info.invoiceSeries}`, logs);

    if (info.lookupCode && info.lookupCode !== info.cqtCode && !options?.forceFallback) {
      try {
        this.createLog('Đã có Mã nhận hóa đơn Thái Sơn.', logs);
        // The shared einvoice.vn/tra-cuu portal is valid when supplied by
        // invoice XML; never guess it from the provider tax code alone.
        const portal = options?.customInfo?.lookupUrl || info.lookupUrl || lookupPortalForSeller(info.sellerTaxCode) || '';
        if (!portal) {
          throw new OriginalInvoiceError(
            'XML không chứa đường dẫn tra cứu Thái Sơn hợp lệ, không thể suy ra từ MSTTCGP.',
            this.providerCode, 'LOOKUP_PORTAL_UNKNOWN', 422
          );
        }
        this.createLog('Đang thử tải bản gốc từ cổng hóa đơn Thái Sơn: ' + new URL(portal).hostname, logs);
        const result = await downloadOriginalThaiSonPdf({
          portalUrl: portal,
          lookupCode: info.lookupCode,
          sellerTaxCode: info.sellerTaxCode,
          invoiceNo: info.invoiceNo,
          invoiceSeries: info.invoiceSeries,
          timeoutMs: options?.timeoutMs
        });

        this.createLog(`Đã tải bản ${result.contentType.startsWith('application/pdf') ? 'PDF gốc' : 'HTML hiển thị từ cổng phát hành'}: ${result.filename} (${result.pdfBuffer.length} bytes)`, logs);

        return {
          success: true,
          pdfBuffer: result.pdfBuffer,
          pdfBase64: result.pdfBase64,
          filename: result.filename,
          contentType: result.contentType,
          provider: this.providerCode,
          driverName: this.name,
          isFallback: false,
          captchaSolved: 'auto',
          sourceUrl: result.sourceUrl,
          executionLogs: logs
        };
      } catch (err: any) {
        throw err instanceof OriginalInvoiceError ? err : new OriginalInvoiceError(err.message, this.providerCode);
      }
    } else if (!options?.forceFallback && (!info.lookupCode || info.lookupCode === info.cqtCode)) {
      throw new OriginalInvoiceError('Thái Sơn thiếu Mã nhận hóa đơn. Mã cơ quan thuế không thay thế mã này.', this.providerCode, 'LOOKUP_DATA_MISSING', 422);
    }

    const fallbackRes = await this.fallback.fetchPdf(info, options);
    return {
      ...fallbackRes,
      provider: this.providerCode,
      driverName: this.name,
      executionLogs: [...logs, ...fallbackRes.executionLogs]
    };
  }
}
