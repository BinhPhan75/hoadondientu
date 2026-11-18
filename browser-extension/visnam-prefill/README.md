# VIN-HOADON: điền mã tra cứu trên đúng trang `tracuuhd`

Tiện ích Chrome/Edge **cần cài một lần** nếu muốn HoangMySoft tự điền mã từ XML vào trang của nhà cung cấp. Trình duyệt không cho website HoangMySoft tự chỉnh form của một website khác.

1. Tải thư mục `browser-extension/visnam-prefill` (gồm `manifest.json` và `visnam-prefill.js`).
2. Mở `chrome://extensions` hoặc `edge://extensions`, bật Developer mode, chọn Load unpacked và chọn thư mục.
3. Từ HoangMySoft bấm **Tra cứu VIN-HOADON**. URL sẽ mở trang `https://tracuu.vin-hoadon.com/tracuuhoadon/tracuuxacthuc/tracuuhd` với mã tra cứu từ `QuanLy_SoBaoMat` trong fragment `#hms_visnam_code=...`.
4. Tiện ích chỉ điền ô mã tra cứu có thể xác định an toàn, không điền CAPTCHA. Nếu giao diện đổi hoặc không rõ ô mã, tiện ích không tự điền.

Không tự giải CAPTCHA, không bấm Tra cứu, không gửi thông tin sang máy chủ HoangMySoft và không tải PDF. Chức năng tải PDF tự động phải chờ xác minh giao thức tích hợp hợp lệ của nhà cung cấp.
