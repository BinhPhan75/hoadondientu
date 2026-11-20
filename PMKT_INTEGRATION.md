# Tích hợp tra cứu mua vào với PMKT

Mở ứng dụng trong iframe với `?pmkt=purchase` để hiện toolbar `PmktPurchaseTransfer` phía trên bảng hóa đơn. Đăng nhập và tra cứu GDT giữ nguyên luồng độc lập.

- Chọn 1–20 hóa đơn mua vào đã tải `rawXml`; toolbar lấy bản mới nhất từ `invoices` để không dùng selection cũ trước khi tải chi tiết xong.
- **Tải XML đã chọn** tạo ZIP từ XML gốc. Không sử dụng XML dựng lại nếu chưa tải được XML gốc.
- **Chuyển hóa đơn đã chọn sang PMKT** gửi `{type:'PMKT_PURCHASE_XML_V1',files:[{name,xml}]}` bằng postMessage đến origin được cấu hình bằng biến môi trường `VITE_PMKT_ORIGIN` (không ghi cứng URL vào mã nguồn).
- Giới hạn 4 Mi ký tự/file, tổng 10 Mi ký tự. Không truyền token, mật khẩu hay cookie.
- PMKT kiểm tra origin `https://hddt.nghiatingold.com` và cửa sổ iframe, hiện danh sách và yêu cầu bấm tự động nhập kho. Thông báo gửi thành công ở đây không đồng nghĩa chứng từ đã được lưu. Kết quả từng hóa đơn nằm ở PMKT.
- Ứng dụng mở độc lập không hiện toolbar này. Các chức năng tải hóa đơn hiện có giữ nguyên.

Hai repo cần được triển khai đồng thời: `BinhPhan75/hoadondientu` và `BinhPhan75/PMKT_V2`. Khi triển khai, cấu hình `VITE_PMKT_ORIGIN` trong môi trường Production của ứng dụng tải hóa đơn với đúng origin HTTPS của PMKT (không có dấu `/` cuối), rồi build lại. Nếu thiếu hoặc không hợp lệ, toolbar không hiện. Khi thay tên miền, cập nhật biến môi trường và chính sách origin của cả hai phía. Không mở origin wildcard để chuyển XML.
