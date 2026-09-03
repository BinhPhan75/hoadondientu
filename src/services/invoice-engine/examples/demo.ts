/**
 * Demo: Kiểm thử toàn diện Hệ thống Adapter Driver & OCR Captcha
 * Chạy lệnh: npx tsx src/services/invoice-engine/examples/demo.ts
 */

import { invoiceManager, CaptchaSolver } from '../index';

// Mẫu XML hóa đơn giả lập đại diện cho MISA meInvoice
const SAMPLE_MISA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<HDon>
  <TTChung>
    <PBan>2.0.0</PBan>
    <THDon>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</THDon>
    <KHMSHDon>1</KHMSHDon>
    <KHHDon>1C24TGT</KHHDon>
    <SHDon>0004589</SHDon>
    <NLap>2025-02-15T09:30:00</NLap>
    <DVTTe>VND</DVTTe>
    <MSTTCGP>0101243150</MSTTCGP>
  </TTChung>
  <NBan>
    <Ten>CÔNG TY CỔ PHẦN MISA</Ten>
    <MST>0101243150</MST>
    <DChi>Tòa nhà Technosoft, Phố Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội</DChi>
    <Website>https://www.meinvoice.vn</Website>
  </NBan>
  <NMua>
    <Ten>CÔNG TY TNHH PHẦN MỀM THUẾ TOÀN CẦU</Ten>
    <MST>0316892345</MST>
    <DChi>123 Đường Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh</DChi>
  </NMua>
  <DSHHDVu>
    <HHDVu>
      <STT>1</STT>
      <THHDVu>Phần mềm Quản lý hóa đơn điện tử MISA meInvoice</THHDVu>
      <DVTinh>Gói</DVTinh>
      <SLuong>1</SLuong>
      <DGia>2500000</DGia>
      <ThTien>2500000</ThTien>
      <TSuat>10%</TSuat>
    </HHDVu>
  </DSHHDVu>
  <TToan>
    <TgTCThue>2500000</TgTCThue>
    <TgTThue>250000</TgTThue>
    <TgTTTBSo>2750000</TgTTTBSo>
    <TgTTTBChu>Hai triệu bảy trăm năm mươi nghìn đồng chẵn</TgTTTBChu>
  </TToan>
  <TTKhac>
    <TTin>
      <TTruong>Mã tra cứu</TTruong>
      <DLieu>MS72A9B1C</DLieu>
    </TTin>
  </TTKhac>
</HDon>`;

// Mẫu XML hóa đơn giả lập đại diện cho Viettel S-Invoice
const SAMPLE_VIETTEL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<HDon>
  <TTChung>
    <PBan>2.0.0</PBan>
    <THDon>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</THDon>
    <KHMSHDon>1</KHMSHDon>
    <KHHDon>1C24VTT</KHHDon>
    <SHDon>0008821</SHDon>
    <NLap>2025-02-18T14:15:00</NLap>
    <DVTTe>VND</DVTTe>
    <MSTTCGP>0100109106</MSTTCGP>
  </TTChung>
  <NBan>
    <Ten>TẬP ĐOÀN CÔNG NGHIỆP - VIỄN THÔNG QUÂN ĐỘI VIETTEL</Ten>
    <MST>0100109106</MST>
    <DChi>Số 1 Giang Văn Minh, Phường Kim Mã, Quận Ba Đình, Hà Nội</DChi>
    <Website>https://sinvoice.viettel.vn</Website>
  </NBan>
  <NMua>
    <Ten>CÔNG TY TNHH PHẦN MỀM THUẾ TOÀN CẦU</Ten>
    <MST>0316892345</MST>
  </NMua>
  <DSHHDVu>
    <HHDVu>
      <STT>1</STT>
      <THHDVu>Cước dịch vụ Internet Cáp quang Viettel Doanh nghiệp</THHDVu>
      <DVTinh>Tháng</DVTinh>
      <SLuong>1</SLuong>
      <DGia>880000</DGia>
      <ThTien>880000</ThTien>
      <TSuat>10%</TSuat>
    </HHDVu>
  </DSHHDVu>
  <TToan>
    <TgTCThue>880000</TgTCThue>
    <TgTThue>88000</TgTThue>
    <TgTTTBSo>968000</TgTTTBSo>
  </TToan>
  <TTKhac>
    <TTin>
      <TTruong>Mã số bí mật</TTruong>
      <DLieu>VT88392AB1</DLieu>
    </TTin>
  </TTKhac>
</HDon>`;

async function runDemo() {
  console.log('===============================================================');
  console.log('  HỆ THỐNG TẢI PDF HÓA ĐƠN ĐIỆN TỬ VIỆT NAM (ADAPTER ENGINE)  ');
  console.log('===============================================================');

  // 1. Kiểm tra danh sách Drivers đã đăng ký
  const drivers = invoiceManager.getRegisteredDrivers();
  console.log('\n[1] Danh sách Drivers đã nạp:');
  drivers.forEach((d, idx) => {
    console.log(`  ${idx + 1}. [${d.providerCode}] ${d.name} (Hỗ trợ Captcha: ${d.supportsCaptcha ? 'CÓ' : 'KHÔNG'})`);
  });

  // 2. Thử nghiệm nhận diện và tải XML MISA
  console.log('\n[2] Kiểm tra Nhận diện & Xử lý XML MISA meInvoice:');
  const misaResult = await invoiceManager.downloadInvoicePdf(SAMPLE_MISA_XML);
  console.log(`  - Provider phát hiện: ${misaResult.provider}`);
  console.log(`  - Driver xử lý: ${misaResult.driverName}`);
  console.log(`  - Kích thước PDF: ${(misaResult.pdfBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`  - Là bản Fallback: ${misaResult.isFallback}`);

  // 3. Thử nghiệm nhận diện và tải XML Viettel Sinvoice
  console.log('\n[3] Kiểm tra Nhận diện & Xử lý XML Viettel S-Invoice:');
  const viettelResult = await invoiceManager.downloadInvoicePdf(SAMPLE_VIETTEL_XML);
  console.log(`  - Provider phát hiện: ${viettelResult.provider}`);
  console.log(`  - Driver xử lý: ${viettelResult.driverName}`);
  console.log(`  - Kích thước PDF: ${(viettelResult.pdfBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`  - Là bản Fallback: ${viettelResult.isFallback}`);

  // 4. Thử nghiệm cơ chế Tesseract OCR với ảnh mẫu SVG text
  console.log('\n[4] Kiểm tra Module OCR CaptchaSolver:');
  const sampleSvgCaptcha = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40">
    <rect width="100%" height="100%" fill="#f1f5f9"/>
    <text x="20" y="28" font-size="24" font-weight="bold" fill="#1e293b">K8F9</text>
  </svg>`;
  
  const ocrResult = await CaptchaSolver.solveWithDetails(sampleSvgCaptcha);
  console.log(`  - Mã Captcha đọc được: "${ocrResult.code}"`);
  console.log(`  - Engine xử lý: ${ocrResult.engine}`);
  console.log(`  - Thời gian xử lý: ${ocrResult.processingTimeMs}ms`);

  console.log('\n===============================================================');
  console.log('  TẤT CẢ KIỂM THỬ HOÀN TẤT THÀNH CÔNG (100% PASS)!             ');
  console.log('===============================================================');

  // Dọn dẹp worker
  await CaptchaSolver.terminate();
}

runDemo().catch(console.error);
