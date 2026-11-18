export interface VisnamCaptcha {
  key: string;
  image: string;
}

export interface VisnamInvoiceIdentity {
  sellerTaxCode: string;
  invoiceSeries: string;
  invoiceNo: string;
}

export interface VisnamInvoicePdf {
  blob: Blob;
  filename: string;
}

async function readSuccessPayload(response: Response, fallback: string): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(fallback);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(fallback);
  }

  const record = payload as Record<string, unknown>;
  if (!response.ok || record.success !== true) {
    throw new Error(typeof record.error === 'string' ? record.error : fallback);
  }
  return record;
}

export async function fetchVisnamCaptcha(): Promise<VisnamCaptcha> {
  const response = await fetch('/api/visnam/captcha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: '{}',
  });
  const payload = await readSuccessPayload(response, 'Không lấy được CAPTCHA VIN-HOADON.');
  if (typeof payload.key !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.key) ||
      typeof payload.image !== 'string' || !payload.image.startsWith('data:image/png;base64,') ||
      payload.image.length > 350_000) {
    throw new Error('Dữ liệu CAPTCHA VIN-HOADON không hợp lệ.');
  }
  return { key: payload.key, image: payload.image };
}

export async function fetchVisnamInvoicePdf(params: {
  key: string;
  captcha: string;
  lookupCode: string;
  identity: VisnamInvoiceIdentity;
}): Promise<VisnamInvoicePdf> {
  const response = await fetch('/api/visnam/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      key: params.key,
      captcha: params.captcha.trim(),
      maSoBiMat: params.lookupCode.trim(),
      identity: params.identity,
    }),
  });
  const payload = await readSuccessPayload(response, 'Không tải được PDF VIN-HOADON.');
  if (typeof payload.pdfBase64 !== 'string' ||
      payload.pdfBase64.length > Math.ceil(18_000_000 * 4 / 3) + 16) {
    throw new Error('VIN-HOADON không trả về PDF hợp lệ.');
  }

  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(payload.pdfBase64), character => character.charCodeAt(0));
  } catch {
    throw new Error('Dữ liệu PDF VIN-HOADON bị lỗi.');
  }
  if (bytes.length < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
    throw new Error('VIN-HOADON không trả về tệp PDF hợp lệ.');
  }

  const filename = typeof payload.filename === 'string' &&
    /^[A-Za-z0-9._-]{1,120}\.pdf$/i.test(payload.filename)
    ? payload.filename
    : 'HoaDon_VIN-HOADON.pdf';
  return { blob: new Blob([bytes], { type: 'application/pdf' }), filename };
}
