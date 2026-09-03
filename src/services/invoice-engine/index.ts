/**
 * Vietnamese E-Invoice Downloader Engine
 * Architecture: Adapter Pattern Multi-Provider Driver + Captcha OCR Solver
 */

export * from './types';
export * from './captcha/CaptchaSolver';
export * from './drivers/InvoiceProviderDriver';
export * from './drivers/MisaDriver';
export * from './drivers/ViettelDriver';
export * from './drivers/FourSiDriver';
export * from './drivers/VnptDriver';
export * from './drivers/GenericFallbackDriver';
export * from './InvoiceDownloaderManager';

import { InvoiceDownloaderManager } from './InvoiceDownloaderManager';

// Export default singleton instance for fast and simple usage
export const invoiceManager = InvoiceDownloaderManager.getInstance();
export default invoiceManager;
