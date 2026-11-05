export class OriginalInvoiceError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code = 'ORIGINAL_DOWNLOAD_FAILED',
    public readonly status = 502,
    public readonly lookupUrl?: string,
  ) { super(message); this.name = 'OriginalInvoiceError'; }
}
