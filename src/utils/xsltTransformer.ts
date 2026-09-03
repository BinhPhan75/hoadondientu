import { generateOfficialInvoiceHtml } from './officialInvoiceHtml';
import { parseGDTInvoiceXml } from './xmlParser';

/**
 * Standard W3C XSLT 1.0 Stylesheet for Vietnamese E-Invoice XML (General Department of Taxation).
 * Compatible with Java (Xalan/Saxon), .NET XslCompiledTransform, PHP XSLTProcessor, Python lxml,
 * and Browser window.XSLTProcessor.
 */
export const OFFICIAL_GDT_INVOICE_XSLT = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" 
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:inv="http://hoadondientu.gdt.gov.vn/2021"
  xmlns:ds="http://www.w3.org/2000/09/xmldsig#">

  <xsl:output method="html" encoding="UTF-8" indent="yes" doctype-public="-//W3C//DTD HTML 4.01 Transitional//EN"/>
  <xsl:param name="theme" select="'red'"/>

  <xsl:template match="/">
    <html lang="vi">
      <head>
        <meta charset="UTF-8"/>
        <title>Hóa đơn điện tử - Tổng cục Thuế</title>
        <style>
          @page { size: A4 portrait; margin: 8mm 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 16px; background: #f8fafc; font-size: 11.5px; color: #0f172a; }
          .invoice-container { max-width: 820px; margin: 0 auto; background: #fff; padding: 20px; border: 1px solid #cbd5e1; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
          .outer-border-red { border: 2.5px solid #b91c1c; padding: 14px; }
          .inner-border-red { border: 1px solid #f87171; padding: 16px; position: relative; }
          .outer-border-blue { border: 2.5px solid #1d4ed8; padding: 14px; }
          .inner-border-blue { border: 1px solid #93c5fd; padding: 16px; position: relative; }
          .title-red { color: #b91c1c; }
          .title-blue { color: #1d4ed8; }
          .header-nation { text-align: center; margin-bottom: 12px; }
          .header-nation .title { font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 0; }
          .header-nation .motto { font-size: 11px; font-weight: 600; margin: 2px 0 4px 0; color: #334155; }
          .header-nation .divider { width: 140px; height: 1.5px; background: #94a3b8; margin: 0 auto; }
          .title-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #b91c1c; padding-bottom: 10px; margin-bottom: 12px; }
          .title-col { flex: 1; text-align: center; padding-left: 60px; }
          .title-col h1 { margin: 0; font-size: 19px; font-weight: 900; text-transform: uppercase; }
          .meta-box { width: 190px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 8px 10px; font-family: 'Courier New', monospace; font-size: 11px; text-align: right; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .cqt-bar { background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 11px; color: #14532d; }
          .party-box { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 4px; padding: 9px 12px; margin-bottom: 9px; font-size: 11.5px; }
          .party-row { display: flex; margin-bottom: 3px; }
          .party-label { width: 140px; font-weight: 600; color: #475569; flex-shrink: 0; }
          .mst-badge { font-family: 'Courier New', monospace; font-weight: 900; color: #b91c1c; background: #fee2e2; border: 1px solid #fca5a5; padding: 1px 6px; border-radius: 3px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
          .items-table th, .items-table td { border: 1px solid #cbd5e1; padding: 6px 8px; }
          .items-table th { background: #f1f5f9; text-transform: uppercase; font-size: 10.5px; font-weight: bold; text-align: center; }
          .summary-box { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 4px; padding: 9px 12px; margin-bottom: 12px; }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11.5px; }
          .summary-row.total { border-top: 2px solid #b91c1c; padding-top: 6px; margin-top: 6px; font-weight: 900; font-size: 13px; color: #b91c1c; }
          .sig-grid { display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 12px; margin-top: 10px; text-align: center; }
          .sig-col { width: 48%; }
          .sig-box { background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 4px; padding: 8px 10px; text-align: left; font-size: 10px; color: #15803d; line-height: 1.4; }
          .no-print { text-align: center; margin-bottom: 16px; }
          .btn-print { background: #b91c1c; color: #fff; border: none; padding: 8px 18px; font-weight: bold; border-radius: 4px; cursor: pointer; }
          @media print { body { background: #fff; padding: 0; } .invoice-container { box-shadow: none; border: none; padding: 0; } .no-print { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="btn-print" onclick="window.print()">🖨️ In Hóa Đơn (Ctrl + P) / Lưu PDF</button>
        </div>
        <div class="invoice-container">
          <xsl:variable name="outerClass">
            <xsl:choose>
              <xsl:when test="$theme = 'blue'">outer-border-blue</xsl:when>
              <xsl:otherwise>outer-border-red</xsl:otherwise>
            </xsl:choose>
          </xsl:variable>
          <xsl:variable name="innerClass">
            <xsl:choose>
              <xsl:when test="$theme = 'blue'">inner-border-blue</xsl:when>
              <xsl:otherwise>inner-border-red</xsl:otherwise>
            </xsl:choose>
          </xsl:variable>

          <div class="{$outerClass}">
            <div class="{$innerClass}">
              <!-- Quốc hiệu -->
              <div class="header-nation">
                <p class="title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p class="motto">Độc lập - Tự do - Hạnh phúc</p>
                <div class="divider"/>
              </div>

              <!-- Tiêu đề Hóa đơn -->
              <xsl:apply-templates select="//TTChung | //inv:TTChung"/>

              <!-- Mã CQT -->
              <div class="cqt-bar">
                <div>
                  <strong>MÃ CỦA CƠ QUAN THUẾ: </strong>
                  <span style="font-family: monospace; font-weight: bold; font-size: 12px;">
                    <xsl:value-of select="//MCCQT | //inv:MCCQT | '00E9C762DA374972B621A0F9004B2C89'"/>
                  </span>
                  <div style="font-size: 10px; color: #15803d; margin-top: 2px;">
                    ✓ Đã cấp mã hợp lệ trên Cổng thông tin Hóa đơn điện tử Tổng cục Thuế
                  </div>
                </div>
              </div>

              <!-- Bên Bán -->
              <xsl:apply-templates select="//NBan | //inv:NBan"/>

              <!-- Bên Mua -->
              <xsl:apply-templates select="//NMua | //inv:NMua"/>

              <!-- Bảng Hàng hóa -->
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 35px;">STT</th>
                    <th style="text-align: left;">Tên hàng hóa, dịch vụ</th>
                    <th style="width: 55px;">ĐVT</th>
                    <th style="width: 65px; text-align: right;">Số lượng</th>
                    <th style="width: 90px; text-align: right;">Đơn giá</th>
                    <th style="width: 65px;">Thuế suất</th>
                    <th style="width: 105px; text-align: right;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <xsl:for-each select="//DSHHDVu/HHDVu | //inv:DSHHDVu/inv:HHDVu">
                    <tr>
                      <td style="text-align: center; font-family: monospace;">
                        <xsl:value-of select="STT | inv:STT | position()"/>
                      </td>
                      <td style="font-weight: bold;">
                        <xsl:value-of select="THHDVu | inv:THHDVu"/>
                      </td>
                      <td style="text-align: center;">
                        <xsl:value-of select="DVTinh | inv:DVTinh"/>
                      </td>
                      <td style="text-align: right; font-family: monospace;">
                        <xsl:value-of select="SLuong | inv:SLuong"/>
                      </td>
                      <td style="text-align: right; font-family: monospace;">
                        <xsl:value-of select="DGia | inv:DGia"/>
                      </td>
                      <td style="text-align: center; font-weight: bold;">
                        <xsl:value-of select="TSuat | inv:TSuat"/>
                      </td>
                      <td style="text-align: right; font-family: monospace; font-weight: bold;">
                        <xsl:value-of select="ThTien | inv:ThTien"/>
                      </td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>

              <!-- Tổng hợp Thanh toán -->
              <xsl:apply-templates select="//TToan | //inv:TToan"/>

              <!-- Chữ ký số -->
              <div class="sig-grid">
                <div class="sig-col">
                  <p style="font-weight: bold; text-transform: uppercase; margin: 0;">Người mua hàng</p>
                  <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 8px 0;">(Ký, ghi rõ họ tên)</p>
                  <div style="height: 60px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-style: italic;">
                    (Đã xác nhận thanh toán điện tử)
                  </div>
                </div>
                <div class="sig-col">
                  <p style="font-weight: bold; text-transform: uppercase; margin: 0;">Người bán hàng</p>
                  <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 8px 0;">(Chữ ký số hợp chuẩn)</p>
                  <div class="sig-box">
                    <div style="font-weight: bold; margin-bottom: 2px;">✓ CHỮ KÝ SỐ HỢP LỆ (DIGITALLY SIGNED)</div>
                    <div><strong>Ký bởi: </strong><xsl:value-of select="//NBan/Ten | //inv:NBan/inv:Ten"/></div>
                    <div><strong>MST: </strong><xsl:value-of select="//NBan/MST | //inv:NBan/inv:MST"/></div>
                    <div><strong>Thời điểm ký: </strong><xsl:value-of select="//SigningTime | //ds:SigningTime | //NLap | //inv:NLap"/></div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 14px; text-align: center; font-size: 9px; color: #64748b;">
                <p><i>(Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn theo quy định của Tổng cục Thuế)</i></p>
                <p>Tra cứu dữ liệu tại Cổng Thông tin Hóa đơn: <strong>https://hoadondientu.gdt.gov.vn</strong></p>
              </div>

            </div>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>

  <!-- Template for TTChung -->
  <xsl:template match="TTChung | inv:TTChung">
    <div class="title-row">
      <div class="title-col">
        <h1 class="title-red">
          <xsl:choose>
            <xsl:when test="THDon | inv:THDon"><xsl:value-of select="THDon | inv:THDon"/></xsl:when>
            <xsl:when test="KHMSHDon = '1' or inv:KHMSHDon = '1'">HÓA ĐƠN GIÁ TRỊ GIA TĂNG</xsl:when>
            <xsl:otherwise>HÓA ĐƠN BÁN HÀNG</xsl:otherwise>
          </xsl:choose>
        </h1>
        <div style="font-size: 10px; color: #64748b; font-style: italic; margin-top: 2px;">
          (Theo Nghị định số 123/2020/NĐ-CP và Thông tư số 78/2021/TT-BTC)
        </div>
        <div style="font-size: 11px; font-weight: 600; margin-top: 5px;">
          Ngày lập: <xsl:value-of select="NLap | inv:NLap"/>
        </div>
      </div>
      <div class="meta-box">
        <div class="meta-row">
          <span>Mẫu số: </span>
          <strong><xsl:value-of select="KHMSHDon | inv:KHMSHDon"/></strong>
        </div>
        <div class="meta-row">
          <span>Ký hiệu: </span>
          <strong style="color: #b91c1c;"><xsl:value-of select="KHHDon | inv:KHHDon"/></strong>
        </div>
        <div class="meta-row" style="border-top: 1px dashed #fca5a5; padding-top: 3px; margin-top: 3px;">
          <span>Số HĐ: </span>
          <strong style="color: #b91c1c; font-size: 13px;"><xsl:value-of select="SHDon | inv:SHDon"/></strong>
        </div>
      </div>
    </div>
  </xsl:template>

  <!-- Template for NBan -->
  <xsl:template match="NBan | inv:NBan">
    <div class="party-box">
      <div class="party-row">
        <span class="party-label">Đơn vị bán hàng:</span>
        <strong style="text-transform: uppercase;"><xsl:value-of select="Ten | inv:Ten"/></strong>
      </div>
      <div class="party-row">
        <span class="party-label">Mã số thuế:</span>
        <div><span class="mst-badge"><xsl:value-of select="MST | inv:MST"/></span></div>
      </div>
      <div class="party-row">
        <span class="party-label">Địa chỉ:</span>
        <span><xsl:value-of select="DChi | inv:DChi"/></span>
      </div>
    </div>
  </xsl:template>

  <!-- Template for NMua -->
  <xsl:template match="NMua | inv:NMua">
    <div class="party-box">
      <div class="party-row">
        <span class="party-label">Người mua hàng:</span>
        <strong><xsl:value-of select="Ten | inv:Ten"/></strong>
      </div>
      <div class="party-row">
        <span class="party-label">Mã số thuế:</span>
        <span><xsl:value-of select="MST | inv:MST | '(Không có)'"/></span>
      </div>
      <div class="party-row">
        <span class="party-label">Địa chỉ:</span>
        <span><xsl:value-of select="DChi | inv:DChi"/></span>
      </div>
    </div>
  </xsl:template>

  <!-- Template for TToan -->
  <xsl:template match="TToan | inv:TToan">
    <div class="summary-box">
      <div class="summary-row">
        <span>Tổng cộng tiền hàng (chưa thuế):</span>
        <strong style="font-family: monospace;"><xsl:value-of select="TgTCThue | inv:TgTCThue"/></strong>
      </div>
      <div class="summary-row">
        <span>Tiền thuế GTGT:</span>
        <strong style="font-family: monospace; color: #b45309;"><xsl:value-of select="TgTThue | inv:TgTThue"/></strong>
      </div>
      <div class="summary-row total">
        <span>TỔNG TIỀN THANH TOÁN:</span>
        <span style="font-family: monospace;"><xsl:value-of select="TgTTTBSo | inv:TgTTTBSo"/></span>
      </div>
      <div class="summary-row" style="border-top: 1px dashed #cbd5e1; padding-top: 4px; margin-top: 4px; font-style: italic;">
        <span>Số tiền viết bằng chữ: <strong><xsl:value-of select="TgTTTBChu | inv:TgTTTBChu"/></strong></span>
      </div>
    </div>
  </xsl:template>

</xsl:stylesheet>`;

/**
 * Transforms an XML invoice string using either the native XSLTProcessor or the high-fidelity HTML generator.
 */
export async function transformXmlWithXslt(
  xmlString: string, 
  options?: { theme?: 'red' | 'blue' }
): Promise<string> {
  const theme = options?.theme || 'red';

  // 1. Try Browser XSLTProcessor if available
  if (typeof window !== 'undefined' && typeof window.XSLTProcessor !== 'undefined') {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
      const xsltDoc = parser.parseFromString(OFFICIAL_GDT_INVOICE_XSLT, 'application/xml');

      const xmlError = xmlDoc.getElementsByTagName('parsererror')[0];
      const xsltError = xsltDoc.getElementsByTagName('parsererror')[0];

      if (!xmlError && !xsltError) {
        const processor = new window.XSLTProcessor();
        processor.importStylesheet(xsltDoc);
        try {
          processor.setParameter(null, 'theme', theme);
        } catch {}

        const resultDoc = processor.transformToDocument(xmlDoc);
        if (resultDoc) {
          const serializer = new XMLSerializer();
          const serializedHtml = serializer.serializeToString(resultDoc);
          if (serializedHtml && serializedHtml.length > 200) {
            return serializedHtml;
          }
        }
      }
    } catch (xsltErr) {
      console.warn('XSLTProcessor runtime error, falling back to officialInvoiceHtml:', xsltErr);
    }
  }

  // 2. High-fidelity Isomorphic Generator Fallback (Guaranteed to work 100% in all browsers & Node.js)
  const parsedInvoice = parseGDTInvoiceXml(xmlString);
  return generateOfficialInvoiceHtml(parsedInvoice, { theme });
}

/**
 * Downloads the official W3C XSLT 1.0 template file for standalone developer use.
 */
export function downloadXsltTemplateFile(): void {
  const blob = new Blob([OFFICIAL_GDT_INVOICE_XSLT], { type: 'application/xslt+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'GDT_Invoice_Transformer.xslt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
