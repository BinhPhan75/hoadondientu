# M-invoice: điền tự động MST và mã tra cứu

Tiện ích Chrome dùng để điền **hai ô trên trang chính thức của M-invoice** khi mở từ ứng dụng HoangMySoft. Tiện ích **không vượt reCAPTCHA**, **không tự nhấn Tra cứu**, và **không truy cập website khác**.

## Cài một lần trên Chrome/Edge
1. Tải thư mục `browser-extension/minvoice-prefill` về máy tính (có đủ `manifest.json` và `minvoice-prefill.js`).
2. Mở `chrome://extensions` (Edge: `edge://extensions`).
3. Bật **Chế độ dành cho nhà phát triển (Developer mode)** rồi chọn **Tải tiện ích đã giải nén (Load unpacked)**.
4. Chọn thư mục `minvoice-prefill`.

## Sử dụng
1. Trong phần mềm, mở hóa đơn thuộc nhà cung cấp **M-invoice**.
2. Chọn **Mở M-invoice - điền sẵn 2 ô**.
3. Tiện ích tự điền MST và mã tra cứu vào biểu mẫu thực trên M-invoice. Người dùng bấm **Tra cứu**.
4. Trên cổng M-invoice, chọn **PDF** để tải file thật về máy.
5. Quay lại phần mềm, chọn **Nhập PDF gốc vừa tải**. Phần mềm xác minh MST, ký hiệu, số hóa đơn và lưu bản PDF vào bộ nhớ cục bộ để mở lại.

**Lưu ý bảo mật:** Hai thông tin truyền từ phần mềm sang tiện ích trong đoạn `#` của URL (fragment, không gửi lên máy chủ M-invoice). Tiện ích xóa fragment ngay sau khi đọc. Chỉ cài tiện ích từ mã nguồn trong repository của chính bạn. Browser ứng dụng web không thể tự sửa DOM ở trang web khác nếu không có extension hoặc API được nhà cung cấp hỗ trợ.
