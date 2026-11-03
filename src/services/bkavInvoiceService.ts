/** Download the provider PDF exposed by the public Bkav eHoadon lookup page. */
export async function downloadOriginalBkavPdf(params: {
  lookupCode: string;
  timeoutMs?: number;
}): Promise<{ data: Buffer; filename: string; contentType: string }> {
  const lookupCode = String(params.lookupCode || '').trim();
  if (!lookupCode) throw new Error('Mã tra cứu Bkav eHoadon không được để trống.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs || 20000);
  try {
    const pageUrl = `https://van.ehoadon.vn/TCHD?MTC=${encodeURIComponent(lookupCode)}`;
    const page = await fetch(pageUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'
      },
      signal: controller.signal
    });
    if (!page.ok) throw new Error(`Cổng Bkav trả về HTTP ${page.status}.`);
    const html = await page.text();

    const candidates = [...html.matchAll(/(?:href|src)=["']([^"']*Invoice_View[^"']+\.pdf[^"']*)["']/gi)]
      .map(match => match[1].replace(/&amp;/g, '&'));
    const relative = candidates[0];
    if (!relative) {
      if (/mã tra cứu.*không đúng|không tìm thấy|không tồn tại/i.test(html)) {
        throw new Error('Bkav không tìm thấy hóa đơn với mã tra cứu này.');
      }
      throw new Error('Bkav chưa trả về liên kết PDF gốc cho mã tra cứu này.');
    }

    const pdfUrl = new URL(relative, pageUrl).toString();
    const pdf = await fetch(pdfUrl, {
      headers: {
        Accept: 'application/pdf,application/octet-stream,*/*',
        Referer: pageUrl,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'
      },
      signal: controller.signal
    });
    if (!pdf.ok) throw new Error(`Không tải được PDF Bkav: HTTP ${pdf.status}.`);
    const data = Buffer.from(await pdf.arrayBuffer());
    if (data.length < 500 || !data.subarray(0, 10).toString('latin1').includes('%PDF')) {
      throw new Error('Bkav không trả về tệp PDF hợp lệ.');
    }
    return {
      data,
      filename: `HoaDon_Bkav_${lookupCode}.pdf`,
      contentType: 'application/pdf'
    };
  } finally {
    clearTimeout(timer);
  }
}
