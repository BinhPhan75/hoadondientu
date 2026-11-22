/**
 * Minvoice Client: Hỗ trợ tự động điền, tra cứu và tải hóa đơn gốc M-Invoice (minvoice.vn / minvoice.com.vn)
 * Cổng tra cứu: https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don
 */

const RECAPTCHA_SITE_KEY = '6LeM4QEuAAAAAMOqp_s37R43k8LVesV-8oLWm3Gs';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

let recaptchaScriptPromise: Promise<void> | null = null;

export async function loadMinvoiceRecaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.grecaptcha) return;

  if (recaptchaScriptPromise) return recaptchaScriptPromise;

  recaptchaScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('google-recaptcha-minvoice');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Không tải được script reCAPTCHA.')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-recaptcha-minvoice';
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không thể tải Google reCAPTCHA từ máy chủ.'));
    document.head.appendChild(script);
  });

  return recaptchaScriptPromise;
}

export async function getMinvoiceRecaptchaToken(): Promise<string> {
  if (typeof window === 'undefined') return '';
  await loadMinvoiceRecaptchaScript();

  return new Promise((resolve, reject) => {
    if (!window.grecaptcha) {
      reject(new Error('Google reCAPTCHA chưa sẵn sàng'));
      return;
    }
    window.grecaptcha.ready(async () => {
      try {
        const token = await window.grecaptcha!.execute(RECAPTCHA_SITE_KEY, { action: 'search_invoice' });
        resolve(token);
      } catch (err) {
        reject(err);
      }
    });
  });
}

export interface MinvoiceDownloadParams {
  sellerTaxCode: string;
  lookupCode: string;
  invoiceNo?: string;
  invoiceSeries?: string;
  recaptchaToken?: string;
}

export async function fetchMinvoiceInvoicePdf(params: MinvoiceDownloadParams): Promise<{ blob: Blob; filename: string }> {
  const sellerTaxCode = params.sellerTaxCode.trim();
  const lookupCode = params.lookupCode.trim();

  if (!sellerTaxCode || !lookupCode) {
    throw new Error('Thiếu Mã số thuế bên bán hoặc Số bảo mật để tra cứu M-Invoice.');
  }

  // Thử tự động lấy token nếu chưa truyền vào
  let token = params.recaptchaToken;
  if (!token) {
    try {
      token = await getMinvoiceRecaptchaToken();
    } catch (e: any) {
      console.warn('[Minvoice] Không lấy được reCAPTCHA token tự động:', e?.message);
    }
  }

  const response = await fetch('/api/minvoice/download-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, application/pdf'
    },
    body: JSON.stringify({
      sellerTaxCode,
      lookupCode,
      invoiceNo: params.invoiceNo,
      invoiceSeries: params.invoiceSeries,
      recaptchaToken: token || undefined,
      format: 'json'
    })
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || `Lỗi tải hóa đơn M-Invoice (HTTP ${response.status})`);
    }

    if (!data.pdfBase64) {
      throw new Error('Dữ liệu PDF từ M-Invoice không hợp lệ.');
    }

    const binaryString = atob(data.pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: 'application/pdf' });
    return {
      blob,
      filename: data.filename || `HoaDon_MInvoice_${sellerTaxCode}_${lookupCode}.pdf`
    };
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `Lỗi từ máy chủ M-Invoice (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  if (blob.size < 500) {
    throw new Error('Dữ liệu trả về không phải tệp PDF hợp lệ.');
  }

  const disposition = response.headers.get('content-disposition');
  let filename = `HoaDon_MInvoice_${sellerTaxCode}_${lookupCode}.pdf`;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename=["']?([^"']+)["']?/);
    if (match && match[1]) filename = decodeURIComponent(match[1]);
  }

  return { blob, filename };
}
