# Hướng dẫn Chạy Python Selenium Tự Động Tải Hóa Đơn Điện Tử Tổng Cục Thuế

Bộ công cụ tự động hóa kết nối **Cổng thông tin Hóa đơn điện tử - Tổng cục Thuế** (`https://hoadondientu.gdt.gov.vn`) phục vụ kế toán, doanh nghiệp và hộ kinh doanh tải hàng loạt hóa đơn điện tử XML gốc, xuất bảng kê Excel và lưu trữ hóa đơn theo chuẩn quy định tại **Nghị định 123/2020/NĐ-CP** và **Thông tư 78/2021/TT-BTC**.

---

## 1. Yêu Cầu Cài Đặt (Prerequisites)
- **Python**: Phiên bản 3.9 trở lên
- **Trình duyệt Google Chrome**: Đã cài đặt trên máy tính (Windows / macOS / Linux)

### Cài đặt thư viện Python:
```bash
pip install -r requirements.txt
```

---

## 2. Cách Chạy Script Độc Lập

### Tải hóa đơn Mua vào (Purchase):
```bash
python gdt_selenium_crawler.py --mst 0316892345 --password "MatKhauCuaBan" --type purchase --from-date 01/02/2025 --to-date 28/02/2025
```

### Tải hóa đơn Bán ra (Sold):
```bash
python gdt_selenium_crawler.py --mst 0316892345 --password "MatKhauCuaBan" --type sold --from-date 01/01/2025 --to-date 31/03/2025
```

### Tải cả hai loại & xem trình duyệt trực quan:
```bash
python gdt_selenium_crawler.py --mst 0316892345 --password "MatKhauCuaBan" --type both
```

---

## 3. Cấu Trúc Thư Mục Kết Quả Tải Về
Sau khi chạy, script sẽ tự động tạo thư mục và phân loại:
```
downloads/
├── 0316892345/
│   ├── 2025_Q1/
│   │   ├── Mua_Vao/
│   │   │   ├── HD_1C25TGT_0012480_VNPT.xml
│   │   │   ├── HD_1C25MYY_0045892_MISA.xml
│   │   │   └── ...
│   │   ├── Ban_Ra/
│   │   │   ├── HD_1C25TGT_0000101_NOVA.xml
│   │   │   └── ...
│   │   └── Bang_Ke_Hoa_Don_2025_Q1.xlsx
```

---

## 4. Bảo Mật Thông Tin
- Mật khẩu và tài khoản Tổng cục Thuế chỉ được truyền trực tiếp đến máy chủ Tổng cục Thuế (`hoadondientu.gdt.gov.vn`).
- Dữ liệu hóa đơn XML tải về được lưu trực tiếp trên máy của người dùng.
