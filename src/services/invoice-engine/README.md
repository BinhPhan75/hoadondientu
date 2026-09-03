# Hệ Thống Tải File PDF Hóa Đơn Điện Tử Gốc (Multi-Provider Engine)

Hệ thống Node.js/TypeScript hướng đối tượng theo mô hình **Adapter Pattern** tích hợp module **OCR giải Captcha tự động** bằng `tesseract.js`, cho phép tải file PDF Hóa đơn điện tử gốc từ các nhà cung cấp phổ biến tại Việt Nam (MISA, Viettel Sinvoice, 4Si, VNPT...) dựa trên dữ liệu XML lấy từ Cổng Tổng cục Thuế (`hoadondientu.gdt.gov.vn`).

---

## 1. Kiến Trúc Adapter Driver Pattern

```text
                              ┌─────────────────────────────┐
                              │  InvoiceDownloaderManager   │  (Factory / Coordinator)
                              └──────────────┬──────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │                                           │
         ┌─────────────▼───────────────┐           ┌───────────────▼─────────────┐
         │    InvoiceProviderDriver    │           │        CaptchaSolver        │
         │         (Interface)         │           │        (Tesseract OCR)      │
         └─────────────┬───────────────┘           └─────────────────────────────┘
                       │
     ┌─────────────────┼─────────────────┬──────────────────┬─────────────────┐
     │                 │                 │                  │                 │
┌────▼───────┐  ┌──────▼──────┐  ┌───────▼──────┐    ┌──────▼───────┐  ┌──────▼──────────────┐
│ MisaDriver │  │ViettelDriver│  │ FourSiDriver │    │  VnptDriver  │  │GenericFallbackDriver│
│(meinvoice) │  │ (S-Invoice) │  │ (inv.4si.vn) │    │(vnpt-invoice)│  │ (Render nội bộ TT78)│
└────────────┘  └─────────────┘  └──────────────┘    └──────────────┘  └─────────────────────┘
```

### Các Thành Phần Cốt Lõi:
1. **`InvoiceProviderDriver` (Interface & Abstract Class)**:
   - `canHandle(xmlData)`: Nhận diện nhà cung cấp dựa trên MST tổ chức giải pháp (`MSTTCGP`), đường dẫn tra cứu, mẫu số hoặc chữ ký số.
   - `extractInfo(xmlData)`: Bóc tách mã tra cứu, mã bí mật, MST bên bán, số hóa đơn.
   - `fetchPdf(info, options)`: Thực hiện tra cứu, giải Captcha (nếu có) và tải file PDF gốc.
2. **`CaptchaSolver` (Module OCR)**:
   - Sử dụng `tesseract.js` cấu hình whitelist alphanumeric `[A-Za-z0-9]` và Page Segmentation Mode tối ưu cho Captcha.
   - Tự động chuyển đổi Buffer, Stream, Base64 URI và xử lý ảnh.
3. **`InvoiceDownloaderManager` (Factory / Singleton)**:
   - Quản lý danh sách các Driver đã đăng ký.
   - Tự động phát hiện và chọn Driver tương thích với từng file XML.
   - **Cơ chế Safeguard**: Khi việc crawl từ server bên bán gặp lỗi Captcha sai, WAF chặn hoặc Timeout, hệ thống **tự động chuyển sang `GenericFallbackDriver`** để biên soạn bản PDF/HTML nội bộ đạt chuẩn Nghị định 123/2020/NĐ-CP và Thông tư 78/2021/TT-BTC, **đảm bảo hệ thống không bao giờ bị gián đoạn**.

---

## 2. Hướng Dẫn Cài Đặt Thư Viện

Cài đặt các gói phụ thuộc cần thiết vào dự án:

```bash
npm install tesseract.js axios cheerio jspdf
npm install --save-dev @types/node typescript
```

---

## 3. Hướng Dẫn Sử Dụng Trong Node.js / TypeScript

### 3.1. Tải Hóa đơn tự động từ XML:

```typescript
import { invoiceManager } from './src/services/invoice-engine';
import fs from 'fs';

async function main() {
  // 1. Đọc nội dung file XML lấy từ Cổng Tổng cục Thuế hoặc email bên bán
  const xmlContent = fs.readFileSync('hoa_don_gdt.xml', 'utf-8');

  // 2. Gọi hàm điều phối chính
  const result = await invoiceManager.downloadInvoicePdf(xmlContent, {
    timeoutMs: 15000 // Tùy chọn thời gian chờ
  });

  console.log(`Nhà cung cấp: ${result.provider}`);
  console.log(`Driver đã xử lý: ${result.driverName}`);
  console.log(`Dùng bản dự phòng Fallback: ${result.isFallback}`);
  if (result.captchaSolved) {
    console.log(`Mã Captcha đã giải: ${result.captchaSolved}`);
  }

  // 3. Lưu file PDF kết quả
  fs.writeFileSync(result.filename, result.pdfBuffer);
  console.log(`Đã lưu file PDF: ${result.filename} (${result.pdfBuffer.length} bytes)`);

  // 4. Xem toàn bộ vết thực thi (Execution Logs)
  console.log('Vết thực thi từng bước:');
  result.executionLogs.forEach(log => console.log('  ' + log));
}

main().catch(console.error);
```

### 3.2. Giải Captcha độc lập bằng CaptchaSolver:

```typescript
import { CaptchaSolver } from './src/services/invoice-engine';
import fs from 'fs';

async function solveMyCaptcha() {
  const captchaBuffer = fs.readFileSync('captcha_sample.png');
  
  const text = await CaptchaSolver.solve(captchaBuffer, {
    whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    timeoutMs: 5000
  });

  console.log('Mã Captcha giải được:', text);
}
```

### 3.3. Đăng ký thêm Driver mới (Ví dụ: EasyInvoice):

```typescript
import { BaseInvoiceProviderDriver, invoiceManager, ExtractedInvoiceInfo, DownloadResult } from './src/services/invoice-engine';

class EasyInvoiceDriver extends BaseInvoiceProviderDriver {
  readonly name = 'EasyInvoice Driver';
  readonly providerCode = 'EASYINVOICE';
  readonly metadata = {
    name: 'EasyInvoice Driver',
    providerCode: 'EASYINVOICE',
    description: 'Tra cứu HĐĐT EasyInvoice (Softdreams)',
    supportsCaptcha: false,
    requiredFields: ['sellerTaxCode', 'lookupCode']
  };

  canHandle(xmlData: string | ExtractedInvoiceInfo): boolean {
    const xml = typeof xmlData === 'string' ? xmlData : xmlData.rawXml;
    return xml.includes('easyinvoice.vn') || xml.includes('softdreams.vn');
  }

  extractInfo(xmlData: string): ExtractedInvoiceInfo {
    return {
      provider: this.providerCode,
      sellerTaxCode: this.extractXmlTag(xmlData, 'MST'),
      invoiceNo: this.extractXmlTag(xmlData, 'SHDon'),
      invoiceSeries: this.extractXmlTag(xmlData, 'KHHDon'),
      templateCode: this.extractXmlTag(xmlData, 'KHMSHDon'),
      invoiceDate: this.extractXmlTag(xmlData, 'NLap'),
      lookupCode: this.extractCustomField(xmlData, ['Mã tra cứu', 'Ikey']),
      rawXml: xmlData
    };
  }

  async fetchPdf(info: ExtractedInvoiceInfo): Promise<DownloadResult> {
    // Gọi API EasyInvoice hoặc render PDF
    throw new Error('Chưa cấu hình API endpoint');
  }
}

// Đăng ký vào hệ thống:
invoiceManager.registerDriver(new EasyInvoiceDriver());
```

---

## 4. API Endpoints Tích Hợp Sẵn Trong Server

| Phương thức | Đường dẫn | Chức năng | Payload mẫu |
|---|---|---|---|
| `POST` | `/api/invoice-downloader/download` | Tải PDF Hóa đơn tự động qua Adapter Engine | `{"xml": "<HDon>...</HDon>", "forceFallback": false}` |
| `POST` | `/api/invoice-downloader/detect` | Nhận diện Driver và trích xuất Metadata từ XML | `{"xml": "<HDon>...</HDon>"}` |
| `POST` | `/api/invoice-downloader/solve-captcha` | Giải mã ảnh Captcha dạng Base64/URL bằng Tesseract OCR | `{"image": "data:image/png;base64,..."}` |
| `GET` | `/api/invoice-downloader/drivers` | Lấy danh sách Driver và trạng thái hỗ trợ Captcha | `{}` |
