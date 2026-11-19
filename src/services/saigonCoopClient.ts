export interface SaigonCoopCaptchaChallenge {
  image: string;
  state: string;
}

export type SaigonCoopLookupResult =
  | { kind: 'html'; html: string }
  | { kind: 'pdf'; blob: Blob; filename: string };

async function errorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({}));
  return String(data?.error || `Cổng Saigon Co.op trả về HTTP ${response.status}.`);
}

export async function fetchSaigonCoopCaptcha(lookupCode: string): Promise<SaigonCoopCaptchaChallenge> {
  const response = await fetch('/api/saigoncoop/captcha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ lookupCode }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  const data = await response.json();
  if (data?.success !== true || typeof data.image !== 'string' ||
      !/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(data.image) ||
      data.image.length > 550_000 || typeof data.state !== 'string' ||
      data.state.length === 0 || data.state.length > 12_000) {
    throw new Error('Dữ liệu CAPTCHA Saigon Co.op không hợp lệ.');
  }
  return { image: data.image, state: data.state };
}

export async function submitSaigonCoopLookup(params: {
  state: string;
  lookupCode: string;
  captcha: string;
  sellerTaxCode: string;
  invoiceNo: string;
  invoiceSeries: string;
}): Promise<SaigonCoopLookupResult> {
  const response = await fetch('/api/saigoncoop/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(await errorMessage(response));

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/pdf')) {
    const blob = await response.blob();
    const signature = await blob.slice(0, 5).text();
    if (signature !== '%PDF-') throw new Error('Kết quả Saigon Co.op không phải PDF hợp lệ.');
    const encodedFilename = response.headers.get('x-invoice-filename') || '';
    let filename = 'HoaDon_SaigonCoop.pdf';
    try {
      if (encodedFilename) filename = decodeURIComponent(encodedFilename);
    } catch {
      throw new Error('Tên tệp PDF Saigon Co.op không hợp lệ.');
    }
    return { kind: 'pdf', blob, filename };
  }

  const data = await response.json();
  if (data?.success !== true || data.kind !== 'html' ||
      typeof data.html !== 'string' || data.html.length > 2_000_000) {
    throw new Error(String(data?.error || 'Cổng Saigon Co.op không trả về hóa đơn hợp lệ.'));
  }
  return { kind: 'html', html: data.html };
}
