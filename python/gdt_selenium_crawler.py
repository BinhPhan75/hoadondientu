#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==============================================================================
TOOL TỰ ĐỘNG HÓA TẢI HÓA ĐƠN ĐIỆN TỬ TỔNG CỤC THUẾ (GDT)
Website mục tiêu: https://hoadondientu.gdt.gov.vn
Tương thích: Python 3.8, 3.9 (bao gồm 3.9.11), 3.10, 3.11, 3.12+ (100% Native Standard Library)
Chạy trực tiếp không cần thư viện ngoài, vượt qua tường lửa F5 BIG-IP / WAF
==============================================================================
"""

import os
import sys
import time
import json
import csv
import re
import zipfile
import argparse
import datetime
import subprocess
import ssl
import uuid
import webbrowser
from urllib.parse import urlencode, quote
import urllib.request
import http.cookiejar

# Thiết lập bảng mã UTF-8 cho console Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def log_event(level, message, step_name=None, progress=None):
    """Xuất log có cấu trúc cho Web UI và hiển thị trực quan trên Terminal."""
    now_str = datetime.datetime.now().strftime("%H:%M:%S")
    payload = {
        "timestamp": now_str,
        "level": level,
        "message": message,
        "stepName": step_name,
        "progress": progress
    }
    # Machine-readable output for parent web processes
    print(f"__GDT_EVENT__:{json.dumps(payload, ensure_ascii=False)}", flush=True)
    
    # Human-readable output on terminal
    prefix = {
        "info": "[THÔNG TIN]",
        "success": "[THÀNH CÔNG]",
        "warning": "[CẢNH BÁO]",
        "error": "[LỖI NGHIÊM TRỌNG]"
    }.get(level, "[LOG]")
    print(f"[{now_str}] {prefix} {message}", flush=True)

class GDTCrawler:
    def __init__(self, tax_code, password, from_date=None, to_date=None, invoice_type="purchase", output_dir="./downloads"):
        self.tax_code = str(tax_code).strip()
        self.password = str(password).strip() if password else ""
        
        today = datetime.date.today()
        self.from_date = from_date or today.replace(day=1).strftime("%d/%m/%Y")
        self.to_date = to_date or today.strftime("%d/%m/%Y")
        self.invoice_type = invoice_type if invoice_type in ["purchase", "sold", "both"] else "purchase"
        
        self.output_dir = os.path.abspath(output_dir)
        os.makedirs(self.output_dir, exist_ok=True)
        
        self.base_url = "https://hoadondientu.gdt.gov.vn"
        self.token = None
        self.user_full_name = ""
        self.session_initialized = False
        
        # Thiết lập Cookie Jar và Opener của urllib với SSL bypass
        self.cookie_jar = http.cookiejar.CookieJar()
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookie_jar),
            urllib.request.HTTPSHandler(context=ctx)
        )
        
        # Header giả lập chuẩn Chrome 130 Windows (Chính xác như Next.js Web Client của GDT)
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            "Origin": self.base_url,
            "Referer": f"{self.base_url}/",
            "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin"
        }

    def init_session(self):
        """
        BƯỚC THEN CHỐT: Truy cập trang chủ GDT để nhận Cookie bảo mật F5 BIG-IP ASM (TS0114b13e)
        Nếu thiếu bước này, tường lửa GDT sẽ chặn 403: 'Hệ thống phát hiện hành vi không hợp lệ. Yêu cầu đã bị chặn.'
        """
        log_event("info", "Đang khởi tạo phiên kết nối an toàn với Cổng Tổng cục Thuế...", "INIT_SESSION", 10)
        try:
            req = urllib.request.Request(
                f"{self.base_url}/",
                headers={
                    "User-Agent": self.headers["User-Agent"],
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
                    "Sec-Ch-Ua": self.headers["sec-ch-ua"],
                    "Sec-Ch-Ua-Mobile": "?0",
                    "Sec-Ch-Ua-Platform": '"Windows"',
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Sec-Fetch-User": "?1",
                    "Upgrade-Insecure-Requests": "1"
                }
            )
            self.opener.open(req, timeout=20)
            self.session_initialized = True
            time.sleep(0.3)
            log_event("info", "Đã thiết lập phiên làm việc bảo mật (F5 WAF Cookie được chấp thuận).", "INIT_SUCCESS", 15)
            return True
        except Exception as e:
            log_event("warning", f"Không thể lấy cookie khởi tạo trang chủ: {e}", "INIT_WARNING", 15)
            return False

    def _request(self, url, method="GET", data=None, headers=None, timeout=30):
        if not self.session_initialized and not url.endswith(f"{self.base_url}/"):
            self.init_session()

        req_headers = dict(self.headers)
        
        # Thêm các Header bắt buộc từ Axios Interceptor của hệ thống GDT
        req_headers["request-id"] = str(uuid.uuid4())
        req_headers["End-Point"] = "/"
        req_headers["Action"] = ""
        
        if headers:
            req_headers.update(headers)
        if self.token:
            req_headers["Authorization"] = f"Bearer {self.token}" if not self.token.startswith("Bearer ") else self.token
            
        body = None
        if data is not None:
            if isinstance(data, (dict, list)):
                body = json.dumps(data, ensure_ascii=False).encode('utf-8')
                req_headers["Content-Type"] = "application/json;charset=UTF-8"
            elif isinstance(data, str):
                body = data.encode('utf-8')
                if "Content-Type" not in req_headers:
                    req_headers["Content-Type"] = "application/json;charset=UTF-8"
            elif isinstance(data, bytes):
                body = data
                
        req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
        return self.opener.open(req, timeout=timeout)

    def fetch_captcha(self):
        """Tải mã Captcha từ máy chủ Tổng cục Thuế và mở ảnh xem thuận tiện"""
        log_event("info", "Đang kết nối Cổng Thuế để lấy ảnh Captcha bảo mật...", "FETCH_CAPTCHA", 20)
        url = f"{self.base_url}/api/captcha"
        try:
            resp = self._request(url, method="GET")
            raw_text = resp.read().decode('utf-8')
            data = json.loads(raw_text)
            
            captcha_key = data.get("key", "")
            captcha_content = data.get("content", "")
            
            if not captcha_key or not captcha_content:
                raise ValueError("Không nhận được key hoặc nội dung Captcha từ Cổng Thuế.")
                
            # 1. Lưu tệp SVG
            temp_svg_path = os.path.join(self.output_dir, "captcha_temp.svg")
            with open(temp_svg_path, "w", encoding="utf-8") as f:
                f.write(captcha_content)
                
            # 2. Tạo một tệp HTML đẹp mắt để mở bằng trình duyệt mặc định (Edge/Chrome)
            # Điều này đảm bảo 100% mở được ngay cả khi máy tính chưa gán phần mềm xem SVG mặc định
            temp_html_path = os.path.join(self.output_dir, "captcha_view.html")
            html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mã Captcha Tổng cục Thuế</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 90vh;
            margin: 0;
            padding: 20px;
        }}
        .card {{
            background-color: #1e293b;
            border: 1px solid #334155;
            border-radius: 16px;
            padding: 32px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }}
        .badge {{
            display: inline-block;
            background-color: #0284c7;
            color: white;
            font-size: 13px;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 20px;
            margin-bottom: 16px;
        }}
        h2 {{
            margin: 0 0 12px 0;
            font-size: 22px;
            color: #ffffff;
        }}
        p {{
            color: #94a3b8;
            font-size: 14px;
            margin-bottom: 24px;
            line-height: 1.5;
        }}
        .captcha-box {{
            background: white;
            padding: 20px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px auto;
            border: 2px dashed #38bdf8;
        }}
        .captcha-box svg {{
            max-width: 100%;
            height: auto;
            display: block;
        }}
        .instruction {{
            background-color: #0f172a;
            border: 1px solid #38bdf8;
            border-radius: 8px;
            padding: 16px;
            font-size: 15px;
            font-weight: 600;
            color: #38bdf8;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">TỔNG CỤC THUẾ VIỆT NAM</div>
        <h2>MÃ CAPTCHA BẢO MẬT GDT</h2>
        <p>Hệ thống tự động hiển thị ảnh Captcha bên dưới. Vui lòng nhìn các ký tự và nhập lại vào cửa sổ <b>Terminal (màu đen)</b>.</p>
        <div class="captcha-box">
            {captcha_content}
        </div>
        <div class="instruction">
            👉 Quay lại cửa sổ Terminal đen để gõ các ký tự trên rồi nhấn Enter!
        </div>
    </div>
</body>
</html>"""
            with open(temp_html_path, "w", encoding="utf-8") as f:
                f.write(html_content)

            # Thử tự động bóc tách ký tự từ thẻ <text> nếu có sẵn text
            auto_code = ""
            text_matches = re.findall(r'<text[^>]*>(.*?)</text>', captcha_content, re.IGNORECASE | re.DOTALL)
            if text_matches:
                clean_text = "".join(re.sub(r'<[^>]+>', '', m).strip() for m in text_matches)
                clean_text = re.sub(r'[^A-Za-z0-9]', '', clean_text)
                if 4 <= len(clean_text) <= 6:
                    auto_code = clean_text
                    
            return captcha_key, captcha_content, auto_code, temp_html_path
            
        except Exception as e:
            log_event("error", f"Lỗi khi tải mã Captcha: {str(e)}", "CAPTCHA_ERROR", 25)
            return None, None, None, None

    def login(self, captcha_code, captcha_key):
        """
        Gửi yêu cầu đăng nhập lên Cổng Tổng cục Thuế với đầy đủ Cookie F5 và Header
        Trả về: (success: bool, message: str)
        """
        log_event("info", f"Đang gửi thông tin xác thực cho MST: {self.tax_code}...", "LOGIN", 45)
        
        login_endpoints = [
            f"{self.base_url}/api/security-taxpayer/authenticate",
            f"{self.base_url}/api/auth/authenticate"
        ]
        
        # Chuẩn hóa mã Captcha nhập vào
        cval = captcha_code.strip()
        
        payload = {
            "username": self.tax_code,
            "password": self.password,
            "cvalue": cval,
            "ckey": captcha_key
        }
        
        last_error = ""
        for endpoint in login_endpoints:
            try:
                resp = self._request(endpoint, method="POST", data=payload)
                raw_text = resp.read().decode('utf-8')
                res_data = json.loads(raw_text)
                
                token = res_data.get("token") or res_data.get("jwt") or res_data.get("access_token")
                if token:
                    self.token = token
                    user_info = res_data.get("user") or {}
                    self.user_full_name = user_info.get("fullName") or user_info.get("tenNnt") or res_data.get("fullName") or self.tax_code
                    
                    log_event("success", f"Đăng nhập thành công! Doanh nghiệp: {self.user_full_name}", "AUTH_SUCCESS", 60)
                    
                    # Lưu Token ra tệp để người dùng có thể dán vào Web App
                    token_path = os.path.join(self.output_dir, "token_gdt_moi_nhat.txt")
                    with open(token_path, "w", encoding="utf-8") as f:
                        f.write(self.token)
                    print(f"\n[THÀNH CÔNG]: Đã kết nối Cổng Thuế thành công!")
                    print(f"[MẸO HỮU ÍCH]: Mã Token đăng nhập đã được lưu tại: {token_path}")
                    print(f"-> Bạn có thể mở tệp này, copy Token và dán vào Web App để tra cứu giao diện web trực quan!\n")
                    
                    return True, "Đăng nhập thành công"
                else:
                    msg = res_data.get("message") or "Xác thực không thành công"
                    last_error = msg
            except urllib.error.HTTPError as he:
                try:
                    err_body = he.read().decode('utf-8')
                    err_json = json.loads(err_body)
                    last_error = err_json.get("message") or f"Mã lỗi HTTP {he.code}"
                except Exception:
                    last_error = f"Mã lỗi HTTP {he.code}: {he.reason}"
                    
                if he.code == 401:
                    # Mã Captcha sai hoặc tài khoản/mật khẩu không đúng
                    break
                elif he.code == 403:
                    # Cần làm mới session F5
                    self.session_initialized = False
                    self.init_session()
            except Exception as e:
                last_error = str(e)
                
        log_event("error", f"Đăng nhập thất bại: {last_error}", "AUTH_FAIL", 50)
        return False, last_error

    def query_invoices(self, inv_type="purchase"):
        """Tra cứu danh sách hóa đơn theo kỳ kê khai"""
        log_event("info", f"Bắt đầu tra cứu hóa đơn [{inv_type.upper()}] từ {self.from_date} đến {self.to_date}...", "QUERY_INVOICES", 70)
        
        gdt_from = f"{self.from_date}T00:00:00"
        gdt_to = f"{self.to_date}T23:59:59"
        search_str = f"tdlap=ge={gdt_from};tdlap=le={gdt_to}"
        
        query_params = {
            "sort": "tdlap:desc",
            "size": "100",
            "search": search_str
        }
        
        url = f"{self.base_url}/api/query/invoices/{inv_type}?{urlencode(query_params)}"
        try:
            resp = self._request(url, method="GET")
            raw_text = resp.read().decode('utf-8')
            data = json.loads(raw_text)
            
            invoices = data.get("datas") or data.get("invoices") or []
            log_event("success", f"Tìm thấy {len(invoices)} hóa đơn trong kỳ từ {self.from_date} đến {self.to_date}.", "FETCH_LIST", 80)
            return invoices
        except Exception as e:
            log_event("error", f"Lỗi khi tra cứu danh sách hóa đơn: {str(e)}", "QUERY_ERROR", 75)
            return []

    def download_invoice_xml(self, inv):
        """Tải tệp XML hóa đơn điện tử gốc có chữ ký số"""
        nbmst = inv.get("nbmst", "")
        khhdon = inv.get("khhdon", "")
        shdon = str(inv.get("shdon", "")).zfill(7)
        khmshdon = inv.get("khmshdon", "1")
        
        if not nbmst or not khhdon or not shdon:
            return None
            
        params = {
            "nbmst": nbmst,
            "khhdon": khhdon,
            "shdon": shdon,
            "khmshdon": khmshdon
        }
        url = f"{self.base_url}/api/query/invoices/export-xml?{urlencode(params)}"
        
        headers = {
            "Accept": "application/zip, application/xml, text/xml, */*",
            "End-Point": "/tra-cuu/tra-cuu-hoa-don",
            "Action": "Xuất hóa đơn"
        }
        
        try:
            resp = self._request(url, method="GET", headers=headers, timeout=25)
            content_bytes = resp.read()
            if not content_bytes:
                return None
                
            xml_text = None
            
            # Kiểm tra xem có phải file nén ZIP không
            if content_bytes[:2] == b'PK':
                import io
                with zipfile.ZipFile(io.BytesIO(content_bytes)) as z:
                    for filename in z.namelist():
                        if filename.lower().endswith('.xml'):
                            xml_text = z.read(filename).decode('utf-8', errors='ignore')
                            break
            else:
                text_candidate = content_bytes.decode('utf-8', errors='ignore')
                if "<HDon" in text_candidate or "<DLHDon" in text_candidate or "<?xml" in text_candidate:
                    xml_text = text_candidate
                    
            if xml_text:
                # Tên tệp rõ ràng: HD_KyHieu_SoHoaDon_MST.xml
                safe_kh = re.sub(r'[^A-Za-z0-9_-]', '_', khhdon)
                xml_filename = f"HD_{safe_kh}_{shdon}_{nbmst}.xml"
                xml_path = os.path.join(self.output_dir, xml_filename)
                with open(xml_path, "w", encoding="utf-8") as xf:
                    xf.write(xml_text)
                return xml_path
        except Exception:
            return None
        return None

    def export_excel_csv(self, invoices, filename="Bang_Ke_Hoa_Don_GDT.csv"):
        """Xuất danh sách bảng kê hóa đơn chuẩn UTF-8 có BOM để mở bằng Excel không bị lỗi font tiếng Việt"""
        if not invoices:
            return None, 0
            
        csv_path = os.path.join(self.output_dir, filename)
        fieldnames = [
            "STT",
            "Số Hóa Đơn",
            "Ký Hiệu",
            "Mẫu Số",
            "Ngày Lập",
            "MST Người Bán",
            "Tên Người Bán",
            "MST Người Mua",
            "Tên Người Mua",
            "Tổng Tiền Chưa Thuế",
            "Tiền Thuế GTGT",
            "Tổng Tiền Thanh Toán",
            "Trạng Thái",
            "Mã CQT Cấp"
        ]
        
        total_amount = 0.0
        try:
            with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(fieldnames)
                
                for idx, inv in enumerate(invoices, start=1):
                    shdon = str(inv.get("shdon") or "").zfill(7)
                    khhdon = inv.get("khhdon") or ""
                    khmshdon = inv.get("khmshdon") or "1"
                    
                    nlap = inv.get("tdlap") or inv.get("nlap") or ""
                    if "T" in nlap:
                        nlap = nlap.split("T")[0]
                        
                    nbmst = inv.get("nbmst") or ""
                    nbten = inv.get("nbten") or inv.get("nbtnnt") or ""
                    nmmst = inv.get("nmmst") or ""
                    nmten = inv.get("nmten") or inv.get("nmtnnt") or ""
                    
                    thtien = float(inv.get("tgtcthue") or inv.get("thtien") or 0)
                    thue = float(inv.get("tgtthue") or inv.get("thue") or 0)
                    tong = float(inv.get("tgtttbso") or inv.get("tongtien") or (thtien + thue))
                    total_amount += tong
                    
                    status = inv.get("tthai") or inv.get("ttxly") or "Hợp lệ"
                    macqt = inv.get("mhdon") or inv.get("mcqt") or ""
                    
                    writer.writerow([
                        idx,
                        f"'{shdon}",
                        khhdon,
                        khmshdon,
                        nlap,
                        f"'{nbmst}",
                        nbten,
                        f"'{nmmst}",
                        nmten,
                        f"{thtien:,.0f}",
                        f"{thue:,.0f}",
                        f"{tong:,.0f}",
                        status,
                        macqt
                    ])
            return csv_path, total_amount
        except Exception as e:
            print(f"Lỗi khi xuất bảng kê: {e}")
            return None, 0

def main():
    parser = argparse.ArgumentParser(description="Tool tự động hóa tải hóa đơn Tổng cục Thuế (GDT)")
    parser.add_argument("--mst", help="Mã số thuế doanh nghiệp")
    parser.add_argument("--password", help="Mật khẩu Cổng Thuế")
    parser.add_argument("--from-date", help="Từ ngày (DD/MM/YYYY)")
    parser.add_argument("--to-date", help="Đến ngày (DD/MM/YYYY)")
    parser.add_argument("--type", choices=["purchase", "sold", "both"], default="purchase", help="Loại hóa đơn: purchase (mua vào) hoặc sold (bán ra)")
    parser.add_argument("--output", default="./downloads", help="Thư mục lưu trữ hóa đơn")
    args = parser.parse_args()

    print("=" * 75)
    print("  TOOL TỰ ĐỘNG TẢI HÓA ĐƠN ĐIỆN TỬ TỔNG CỤC THUẾ (GDT NATIVE V3.0)")
    print("  Tương thích: Mọi phiên bản Python (Python 3.9.11, 3.10, 3.11, 3.12+)")
    print("  Đã kích hoạt chế độ vượt tường lửa F5 BIG-IP WAF của Cổng Thuế")
    print("=" * 75)
    print("")

    # Nhập thông tin nếu chưa truyền qua tham số
    mst = args.mst
    if not mst:
        while not mst:
            try:
                mst = input("1. Nhập Mã số thuế (MST) Doanh nghiệp: ").strip()
            except (KeyboardInterrupt, EOFError):
                return
            if not mst:
                print("Mã số thuế không được để trống!")

    password = args.password
    if not password:
        while not password:
            try:
                password = input("2. Nhập Mật khẩu Cổng Thuế cấp: ").strip()
            except (KeyboardInterrupt, EOFError):
                return
            if not password:
                print("Mật khẩu không được để trống!")

    today = datetime.date.today()
    default_from = today.replace(day=1).strftime("%d/%m/%Y")
    default_to = today.strftime("%d/%m/%Y")

    from_date = args.from_date
    if not from_date:
        try:
            val = input(f"3. Từ ngày (Định dạng DD/MM/YYYY) [Mặc định: {default_from}]: ").strip()
            from_date = val if val else default_from
        except (KeyboardInterrupt, EOFError):
            return

    to_date = args.to_date
    if not to_date:
        try:
            val = input(f"4. Đến ngày (Định dạng DD/MM/YYYY) [Mặc định: {default_to}]: ").strip()
            to_date = val if val else default_to
        except (KeyboardInterrupt, EOFError):
            return

    inv_type = args.type
    if not args.mst: # Nếu chạy interactive
        print("\n5. Chọn loại hóa đơn cần tải:")
        print("   [1] Hóa đơn Mua vào (Chi phí đầu vào - Mặc định)")
        print("   [2] Hóa đơn Bán ra (Doanh thu đầu ra)")
        print("   [3] Tải cả 2 loại (Mua vào & Bán ra)")
        try:
            t_choice = input("Nhập lựa chọn (1/2/3) [1]: ").strip()
            if t_choice == "2":
                inv_type = "sold"
            elif t_choice == "3":
                inv_type = "both"
            else:
                inv_type = "purchase"
        except (KeyboardInterrupt, EOFError):
            return

    output_dir = args.output
    crawler = GDTCrawler(
        tax_code=mst,
        password=password,
        from_date=from_date,
        to_date=to_date,
        invoice_type=inv_type,
        output_dir=output_dir
    )

    # 1. Khởi tạo phiên làm việc với Cổng Thuế (F5 WAF)
    crawler.init_session()

    # 2. Vòng lặp lấy Captcha và Đăng nhập
    max_captcha_tries = 5
    login_success = False

    for try_idx in range(1, max_captcha_tries + 1):
        print(f"\n--- [LẦN THỬ {try_idx}/{max_captcha_tries}] TẢI VÀ NHẬN DIỆN MÃ CAPTCHA ---")
        ckey, ccontent, auto_code, html_view_path = crawler.fetch_captcha()
        
        if not ckey:
            print("[LỖI]: Không thể lấy mã Captcha từ Tổng cục Thuế. Đang thử lại...")
            time.sleep(1)
            continue
            
        print("[OK] Đã tải mã Captcha thành công từ máy chủ Cổng Thuế!")
        
        # Mở trình duyệt hiển thị mã Captcha to rõ
        try:
            webbrowser.open(f"file://{html_view_path}")
            print(f"-> Đã mở trang hiển thị mã Captcha trong trình duyệt web của bạn.")
        except Exception:
            print(f"-> Bạn có thể mở tệp: {html_view_path} để xem mã Captcha.")
            
        user_captcha = ""
        if auto_code:
            print(f"[GỢI Ý]: Hệ thống phát hiện mã có thể là: '{auto_code}'")
            try:
                ans = input(f"Nhập mã Captcha (Enter để dùng '{auto_code}'): ").strip()
                user_captcha = ans if ans else auto_code
            except (KeyboardInterrupt, EOFError):
                return
        else:
            try:
                user_captcha = input("Nhìn ảnh trên trình duyệt và NHẬP MÃ CAPTCHA: ").strip()
            except (KeyboardInterrupt, EOFError):
                return
                
        if not user_captcha:
            print("Mã Captcha không được để trống!")
            continue
            
        # Gửi đăng nhập với Session F5 WAF
        ok, msg = crawler.login(user_captcha, ckey)
        if ok:
            login_success = True
            break
        else:
            print(f"\n[THÔNG BÁO]: {msg}")
            if "tài khoản" in msg.lower() or "mật khẩu" in msg.lower():
                print("[LỖI THÔNG TIN]: Tên đăng nhập hoặc Mật khẩu không đúng. Vui lòng kiểm tra lại mật khẩu do CQT cấp.")
                break
            print("Đang tải lại mã Captcha mới để bạn nhập lại...\n")
            time.sleep(1)

    if not login_success:
        print("\n" + "!" * 75)
        print("  [KẾT QUẢ]: KHÔNG THỂ ĐĂNG NHẬP VÀO CỔNG TỔNG CỤC THUẾ")
        print("  Nguyên nhân thường gặp:")
        print("  1. Mã số thuế hoặc Mật khẩu Cổng Thuế cấp bị gõ sai.")
        print("  2. Nhập sai ký tự Captcha nhiều lần.")
        print("!" * 75)
        return

    # 3. Tiến hành tải hóa đơn theo loại đã chọn
    types_to_fetch = [inv_type] if inv_type != "both" else ["purchase", "sold"]
    
    total_downloaded_all = 0
    for cur_type in types_to_fetch:
        type_title = "HÓA ĐƠN MUA VÀO" if cur_type == "purchase" else "HÓA ĐƠN BÁN RA"
        print(f"\n{'=' * 30} {type_title} {'=' * 30}")
        
        invoices = crawler.query_invoices(cur_type)
        if not invoices:
            print(f"[THÔNG BÁO]: Không tìm thấy hóa đơn {type_title} nào trong kỳ từ {from_date} đến {to_date}.")
            continue
            
        print(f"\n>>> Tìm thấy {len(invoices)} hóa đơn. Bắt đầu tải tệp XML hóa đơn điện tử gốc...")
        xml_success_count = 0
        for i, inv in enumerate(invoices, start=1):
            shdon = str(inv.get("shdon") or "").zfill(7)
            khhdon = inv.get("khhdon") or ""
            nbten = inv.get("nbten") or inv.get("nbtnnt") or "Bên bán"
            amount = float(inv.get("tgtttbso") or inv.get("tongtien") or 0)
            
            print(f"  [{i}/{len(invoices)}] Đang tải XML: HĐ số {shdon} ({khhdon}) - {nbten[:25]}... ({amount:,.0f} đ)", end="\r")
            xml_file = crawler.download_invoice_xml(inv)
            if xml_file:
                xml_success_count += 1
            time.sleep(0.1)
            
        print(f"\n[OK] Đã tải thành công {xml_success_count}/{len(invoices)} tệp XML hóa đơn điện tử gốc!")
        total_downloaded_all += xml_success_count
        
        # Xuất bảng kê Excel / CSV
        csv_name = f"Bang_Ke_Hoa_Don_{cur_type.upper()}_{mst}_{datetime.date.today().strftime('%Y%m%d')}.csv"
        csv_path, total_amount = crawler.export_excel_csv(invoices, filename=csv_name)
        
        print("\n" + "-" * 75)
        print(f"  * Tổng số hóa đơn {type_title} : {len(invoices)} hóa đơn")
        print(f"  * Số tệp XML gốc đã lưu        : {xml_success_count} tệp XML")
        print(f"  * Tổng số tiền thanh toán       : {total_amount:,.0f} VNĐ")
        print(f"  * Tệp bảng kê Excel/CSV        : {csv_path}")
        print("-" * 75)

    # 4. Báo cáo tổng kết và mở thư mục
    print("\n" + "=" * 75)
    print("                    HOÀN TẤT QUÁ TRÌNH TẢI HÓA ĐƠN")
    print("=" * 75)
    print(f"  * Thư mục lưu trữ: {output_dir}")
    print(f"  * Tổng số tệp XML đã tải về máy: {total_downloaded_all} tệp XML")
    print("=" * 75)
    
    # Tự động mở thư mục chứa hóa đơn trên Windows Explorer
    if sys.platform == "win32":
        try:
            os.startfile(output_dir)
        except Exception:
            try:
                subprocess.Popen(['explorer', output_dir])
            except Exception:
                pass

if __name__ == "__main__":
    is_help = any(arg in sys.argv for arg in ["-h", "--help"])
    try:
        main()
    except SystemExit:
        pass
    except Exception as e:
        print(f"\n[LỖI CHƯƠNG TRÌNH]: {str(e)}")
    finally:
        if not is_help and sys.stdin and sys.stdin.isatty():
            # BẢO VỆ TUYỆT ĐỐI: Không bao giờ tự động đóng cửa sổ Terminal!
            print("\n" + "=" * 75)
            print("  [CHÚ Ý]: Quá trình chạy đã dừng. Cửa sổ này được giữ nguyên để bạn xem kết quả.")
            print("=" * 75)
            try:
                input("\n>>> Nhấn phím Enter để đóng cửa sổ terminal...")
            except Exception:
                pass
