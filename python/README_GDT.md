# Hướng Dẫn Tải Hóa Đơn Điện Tử Tổng Cục Thuế (GDT Desktop Tool)

Bộ công cụ chạy trực tiếp trên máy tính Windows tại Việt Nam, kết nối trực tiếp đến Cổng thông tin Hóa đơn điện tử - Tổng cục Thuế (`https://hoadondientu.gdt.gov.vn`).
**100% không bị chặn WAF 403**, tải hàng loạt tệp XML gốc và xuất bảng kê Excel chuẩn Thông tư 78 / Nghị định 123.

---

## 1. Cách Chạy Nhanh Nhất (Dành Cho Windows)

Trong thư mục đã giải nén, bạn có 2 lựa chọn:

### Lựa Chọn A: Chạy bằng Python (`run_windows.bat`)
- Máy tính của bạn đã có Python (ví dụ bản Python 3.9.11).
- Bạn chỉ cần nhấp đúp vào tệp: **`run_windows.bat`**
- Tool sẽ tự khởi động:
  1. Yêu cầu nhập MST (hoặc nhấn Enter lấy mặc định).
  2. Yêu cầu nhập Mật khẩu Cổng Thuế.
  3. Tự động tải mã Captcha, mở ảnh lên màn hình và gợi ý mã nhận diện. Bạn chỉ cần xem ảnh xác nhận hoặc nhấn Enter.
  4. Đăng nhập và tra cứu toàn bộ hóa đơn mua vào.
  5. Tự động tải tệp XML của từng hóa đơn và tạo bảng kê Excel UTF-8 BOM.
  6. Tự động mở thư mục chứa hóa đơn và giữ cửa sổ terminal (không bao giờ bị tự đóng).

### Lựa Chọn B: Chạy bằng PowerShell (`run_powershell.bat`)
- Nhấp đúp vào tệp: **`run_powershell.bat`**
- Chạy 100% bằng Windows PowerShell có sẵn, không cần cài bất kỳ thư viện nào!

---

## 2. Kết Quả Lưu Trữ

Sau khi hoàn tất, kết quả sẽ nằm tại thư mục:
```
downloads/
└── [Mã_Số_Thuế]/
    ├── HD_1C24TYY_0001234_0100123456.xml
    ├── HD_1C24TGT_0005678_0309876543.xml
    ├── ... (Toàn bộ tệp XML gốc của hóa đơn)
    └── Bang_Ke_Hoa_Don_PURCHASE_[MST].csv (Mở bằng Excel có dấu tiếng Việt chuẩn)
```

Ngoài ra, tệp **`token_gdt_moi_nhat.txt`** sẽ lưu mã Token phiên đăng nhập. Bạn có thể copy mã này dán vào giao diện Web App để xem bảng biểu, lọc tìm kiếm và tải lại bất cứ lúc nào!

---

## 3. Khắc Phục Lỗi Terminal Bị Tự Tắt
Phiên bản mới đã được cập nhật:
- Có lệnh dừng `input("Nhấn phím Enter để đóng cửa sổ...")` ở cuối chương trình để terminal luôn giữ nguyên.
- Tự động gọi trình mở thư mục `downloads` ngay khi tải xong.
- Có sẵn `pause` trong file `.bat`.
