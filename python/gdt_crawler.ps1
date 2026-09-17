<#
==============================================================================
TOOL TẢI HÓA ĐƠN ĐIỆN TỬ TỔNG CỤC THUẾ (BẢN WINDOWS POWERSHELL NATIVE V3.0)
Không cần cài đặt Python, không cần cài thư viện bên ngoài!
Tự động vượt tường lửa F5 BIG-IP WAF của Cổng Thuế bằng Session Cookie.
Chạy trực tiếp bằng Windows PowerShell có sẵn trên mọi máy Windows 10 & 11.
==============================================================================
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " TOOL TỰ ĐỘNG KẾT NỐI & TẢI HÓA ĐƠN ĐIỆN TỬ TỔNG CỤC THUẾ (GDT) " -ForegroundColor Yellow
Write-Host " Bản PowerShell Native V3.0 - Đã kích hoạt F5 WAF Security Bypass" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

$BaseUrl = "https://hoadondientu.gdt.gov.vn"
$Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# Thư mục lưu trữ
$DownloadDir = Join-Path $PSScriptRoot "downloads"
if (-not (Test-Path $DownloadDir)) {
    New-Item -ItemType Directory -Path $DownloadDir | Out-Null
}

# 1. Nhập thông tin tài khoản
$TaxCode = Read-Host "1. Nhập Mã số thuế (MST) Doanh nghiệp"
if ([string]::IsNullOrWhiteSpace($TaxCode)) {
    Write-Host "MST không được để trống!" -ForegroundColor Red
    Pause
    exit
}
$TaxCode = $TaxCode.Trim()

$Password = Read-Host "2. Nhập Mật khẩu Cổng Thuế cấp" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

Write-Host ""
Write-Host "3. Chọn loại hóa đơn cần tra cứu:" -ForegroundColor Yellow
Write-Host "   [1] Hóa đơn Mua vào (Chi phí đầu vào - Mặc định)"
Write-Host "   [2] Hóa đơn Bán ra (Doanh thu đầu ra)"
$TypeChoice = Read-Host "Nhập lựa chọn (1/2) [1]"
$InvType = "purchase"
if ($TypeChoice -eq "2") { $InvType = "sold" }

# BƯỚC QUAN TRỌNG: Khởi tạo phiên làm việc với trang chủ để nhận F5 Cookie TS0114b13e
Write-Host ""
Write-Host "[1/4] Đang khởi tạo phiên kết nối an toàn với Cổng Tổng cục Thuế..." -ForegroundColor Cyan
try {
    $HomeHeaders = @{
        "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        "Accept" = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        "Accept-Language" = "vi-VN,vi;q=0.9,en-US;q=0.8"
    }
    Invoke-WebRequest -Uri "$BaseUrl/" -Method Get -WebSession $Session -Headers $HomeHeaders -TimeoutSec 15 | Out-Null
    Write-Host "[OK] Đã thiết lập phiên kết nối bảo mật (F5 Cookie xác nhận)." -ForegroundColor Green
} catch {
    Write-Host "[CẢNH BÁO] Không thể tải trang chủ, tiếp tục thử gọi API..." -ForegroundColor Yellow
}

# 2. Lấy Captcha
Write-Host ""
Write-Host "[2/4] Đang kết nối Cổng Thuế để lấy mã Captcha..." -ForegroundColor Cyan

try {
    $ReqId = [System.Guid]::NewGuid().ToString()
    $CaptchaUrl = "$BaseUrl/api/captcha"
    $CaptchaHeaders = @{
        "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        "Accept" = "application/json, text/plain, */*"
        "Origin" = $BaseUrl
        "Referer" = "$BaseUrl/"
        "request-id" = $ReqId
        "End-Point" = "/"
        "Action" = ""
    }
    $CaptchaResponse = Invoke-RestMethod -Uri $CaptchaUrl -Method Get -WebSession $Session -Headers $CaptchaHeaders

    $CaptchaKey = $CaptchaResponse.key
    $CaptchaContent = $CaptchaResponse.content

    if ([string]::IsNullOrWhiteSpace($CaptchaKey)) {
        Write-Host "Không nhận được Captcha Key từ Cổng Thuế. Vui lòng kiểm tra lại mạng!" -ForegroundColor Red
        Pause
        exit
    }

    # Tạo tệp HTML mở trên trình duyệt Edge/Chrome để xem ảnh Captcha rõ nét
    $CaptchaHtml = Join-Path $PSScriptRoot "captcha_view.html"
    $HtmlBody = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>Mã Captcha GDT</title>
    <style>
        body { font-family: sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; height: 90vh; }
        .box { background: #1e293b; padding: 30px; border-radius: 12px; text-align: center; }
        .svg { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class='box'>
        <h2>MÃ CAPTCHA BẢO MẬT GDT</h2>
        <div class='svg'>$CaptchaContent</div>
        <h3>👉 Nhìn các ký tự trên và gõ vào cửa sổ PowerShell</h3>
    </div>
</body>
</html>
"@
    [System.IO.File]::WriteAllText($CaptchaHtml, $HtmlBody, [System.Text.Encoding]::UTF8)

    Write-Host "[OK] Đã tải mã Captcha thành công!" -ForegroundColor Green
    Write-Host "Đang mở ảnh Captcha trên trình duyệt web..." -ForegroundColor Yellow
    Start-Process $CaptchaHtml

    Write-Host ""
    $CaptchaCode = Read-Host "Nhập mã Captcha hiển thị trên trình duyệt"
    $CaptchaCode = $CaptchaCode.Trim()

    Write-Host ""
    Write-Host "[3/4] Đang gửi yêu cầu đăng nhập đến Tổng cục Thuế..." -ForegroundColor Cyan

    $LoginBody = @{
        username = $TaxCode
        password = $PlainPassword
        cvalue   = $CaptchaCode
        ckey     = $CaptchaKey
    } | ConvertTo-Json

    $LoginReqId = [System.Guid]::NewGuid().ToString()
    $LoginHeaders = @{
        "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        "Accept" = "application/json, text/plain, */*"
        "Origin" = $BaseUrl
        "Referer" = "$BaseUrl/"
        "request-id" = $LoginReqId
        "End-Point" = "/"
        "Action" = ""
    }

    $LoginUrl = "$BaseUrl/api/security-taxpayer/authenticate"
    $LoginResponse = $null
    try {
        $LoginResponse = Invoke-RestMethod -Uri $LoginUrl -Method Post -Body $LoginBody -ContentType "application/json;charset=UTF-8" -WebSession $Session -Headers $LoginHeaders
    } catch {
        $ex = $_.Exception
        Write-Host "Lỗi phản hồi từ Cổng Thuế: $($ex.Message)" -ForegroundColor Red
        Pause
        exit
    }

    $Token = $LoginResponse.token
    if (-not $Token) { $Token = $LoginResponse.jwt }
    if (-not $Token) { $Token = $LoginResponse.access_token }

    if ([string]::IsNullOrWhiteSpace($Token)) {
        Write-Host "Đăng nhập thất bại: $($LoginResponse.message)" -ForegroundColor Red
        Pause
        exit
    }

    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host " ĐĂNG NHẬP THÀNH CÔNG VỚI CỔNG TỔNG CỤC THUẾ!" -ForegroundColor Green
    $NntName = $LoginResponse.user.fullName
    if (-not $NntName) { $NntName = $LoginResponse.fullName }
    Write-Host " Tên người nộp thuế: $NntName" -ForegroundColor White
    Write-Host "==================================================================" -ForegroundColor Green
    Write-Host ""

    # Lưu Token ra tệp
    $TokenFile = Join-Path $PSScriptRoot "token_gdt_moi_nhat.txt"
    $Token | Out-File -FilePath $TokenFile -Encoding utf8
    Write-Host "[MẸO HỮU ÍCH]: Token đã được lưu tại tệp: token_gdt_moi_nhat.txt" -ForegroundColor Yellow
    Write-Host "Bạn có thể copy Token này dán vào Web App để xem biểu đồ và giao diện trực quan!" -ForegroundColor Cyan
    Write-Host ""

    # Truy xuất danh sách hóa đơn
    Write-Host "[4/4] Đang tra cứu danh sách hóa đơn $InvType trong tháng..." -ForegroundColor Cyan
    $Today = Get-Date -Format "dd/MM/yyyy"
    $FirstDay = (Get-Date -Day 1).ToString("dd/MM/yyyy")

    $QueryReqId = [System.Guid]::NewGuid().ToString()
    $QueryUrl = "$BaseUrl/api/query/invoices/$InvType" + "?sort=tdlap:desc&size=50&search=tdlap=ge=$FirstDay" + "T00:00:00;tdlap=le=$Today" + "T23:59:59"
    
    $QueryHeaders = @{
        "Authorization" = "Bearer $Token"
        "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        "Origin" = $BaseUrl
        "Referer" = "$BaseUrl/"
        "request-id" = $QueryReqId
        "End-Point" = "/"
        "Action" = ""
    }

    $QueryResponse = Invoke-RestMethod -Uri $QueryUrl -Method Get -WebSession $Session -Headers $QueryHeaders
    $Invoices = $QueryResponse.datas
    if (-not $Invoices) { $Invoices = $QueryResponse.invoices }

    if (-not $Invoices -or $Invoices.Count -eq 0) {
        Write-Host "Không có hóa đơn nào trong khoảng từ $FirstDay đến $Today." -ForegroundColor Yellow
    } else {
        Write-Host "Tìm thấy $($Invoices.Count) hóa đơn! Đang tải các tệp XML gốc..." -ForegroundColor Green
        $XmlSuccess = 0

        foreach ($inv in $Invoices) {
            $shdon = ("" + $inv.shdon).PadLeft(7, '0')
            $khhdon = $inv.khhdon
            $nbmst = $inv.nbmst
            $khmshdon = if ($inv.khmshdon) { $inv.khmshdon } else { "1" }

            if ($shdon -and $khhdon -and $nbmst) {
                $XmlReqId = [System.Guid]::NewGuid().ToString()
                $XmlUrl = "$BaseUrl/api/query/invoices/export-xml?nbmst=$nbmst&khhdon=$khhdon&shdon=$shdon&khmshdon=$khmshdon"
                $XmlHeaders = @{
                    "Authorization" = "Bearer $Token"
                    "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    "request-id" = $XmlReqId
                    "End-Point" = "/tra-cuu/tra-cuu-hoa-don"
                    "Action" = "Xuất hóa đơn"
                }

                try {
                    $XmlBytes = Invoke-RestMethod -Uri $XmlUrl -Method Get -WebSession $Session -Headers $XmlHeaders
                    $SafeKh = $khhdon -replace '[^A-Za-z0-9_-]', '_'
                    $XmlPath = Join-Path $DownloadDir "HD_${SafeKh}_${shdon}_${nbmst}.xml"
                    
                    if ($XmlBytes -is [string]) {
                        [System.IO.File]::WriteAllText($XmlPath, $XmlBytes, [System.Text.Encoding]::UTF8)
                        $XmlSuccess++
                    }
                    Write-Host "  -> Đã lưu XML hóa đơn: $khhdon - $shdon" -ForegroundColor Gray
                } catch {
                    # Bỏ qua lỗi 1 hóa đơn riêng lẻ
                }
            }
        }
        Write-Host "[OK] Đã tải thành công $XmlSuccess tệp XML hóa đơn điện tử gốc!" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Cyan
    Write-Host " HOÀN TẤT! Đang tự động mở thư mục lưu trữ hóa đơn trên máy..." -ForegroundColor Yellow
    Write-Host "==================================================================" -ForegroundColor Cyan

    # Mở thư mục Explorer
    Invoke-Item $DownloadDir

} catch {
    Write-Host ""
    Write-Host "[LỖI]: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Nhấn phím Enter để đóng cửa sổ..." -ForegroundColor Yellow
Read-Host
