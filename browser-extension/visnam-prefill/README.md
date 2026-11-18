# VIN-HOADON: điền mã tra cứu

Tiện ích Chrome/Edge **tùy chọn**. Bật tại `chrome://extensions` -> Developer mode -> Load unpacked, chọn thư mục `browser-extension/visnam-prefill`.

Khi mở link tra cứu VIN-HOADON từ HoangMySoft, mã nằm trong fragment `#hms_visnam_code=...`. Tiện ích chỉ điền vào một ô duy nhất có nhãn đúng nghĩa mã bảo mật/mã tra cứu và xóa fragment khỏi thanh địa chỉ. Nếu trang thay đổi bố cục hoặc không xác định chắc chắn ô nhập, tiện ích không điền.

**Giới hạn:** không giải CAPTCHA, không tự nhấn tra cứu, không tải hóa đơn. Người dùng thực hiện mã xác thực của nhà cung cấp theo quy trình bình thường. Khi có API tải PDF chính thức được kiểm chứng mới tích hợp bước tải về phần mềm.
