import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { GDTInvoice } from '../types';
import { generateOfficialInvoiceHtml } from './officialInvoiceHtml';

/**
 * Generates an authentic QR Code Data URL for the invoice
 * containing GDT lookup parameters and CQT verification code.
 */
export async function generateInvoiceQrCode(invoice: GDTInvoice): Promise<string> {
  try {
    const maCqt = invoice.mhdon || '';
    const qrData = `https://hoadondientu.gdt.gov.vn/tra-cuu?mst=${invoice.nbmst}&kh=${invoice.khhdon}&so=${invoice.shdon}&tong=${invoice.tgtttbso}&cqt=${maCqt}`;
    return await QRCode.toDataURL(qrData, {
      width: 160,
      margin: 1,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.warn('Cannot generate QR code:', err);
    return '';
  }
}

/**
 * Downloads a high-resolution, vector-accurate A4 PDF from the invoice DOM element or creates one directly.
 */
export async function exportInvoiceToPdfFile(
  invoice: GDTInvoice, 
  element?: HTMLElement | null,
  fileName?: string,
  theme: 'red' | 'blue' = 'red',
  templateId?: string
): Promise<boolean> {
  try {
    const cleanShd = String(invoice.shdon).padStart(7, '0');
    const defaultFileName = fileName || `HD_${invoice.khhdon}_${cleanShd}_${invoice.nbmst}.pdf`;

    let targetElement = element;
    let tempContainer: HTMLDivElement | null = null;

    if (!targetElement) {
      // Create offscreen container with official invoice HTML based on provider template
      const qrCode = await generateInvoiceQrCode(invoice);
      const htmlString = generateOfficialInvoiceHtml(invoice, {
        theme,
        qrCodeDataUrl: qrCode,
        showPrintControls: false,
        templateId: (templateId && templateId !== 'AUTO') ? templateId as any : undefined
      });
      
      // Use DOMParser to safely parse HTML and strip any script elements before DOM insertion
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(htmlString, 'text/html');
      parsedDoc.querySelectorAll('script').forEach(s => s.remove());

      tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '820px';
      tempContainer.style.background = '#ffffff';
      // Giữ nguyên toàn bộ mã CSS trong <head> để giao diện chuẩn xác 100% như mẫu Tổng cục Thuế
      tempContainer.innerHTML = (parsedDoc.head ? parsedDoc.head.innerHTML : '') + parsedDoc.body.innerHTML;
      document.body.appendChild(tempContainer);
      targetElement = tempContainer.querySelector('.main-page, .invoice-container, .print-page') as HTMLElement || tempContainer;
    }

    // Optimized canvas options for fast rendering while retaining sharp text & borders
    const canvas = await html2canvas(targetElement, {
      scale: 1.8,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 820,
      imageTimeout: 3000,
      removeContainer: true
    });

    if (tempContainer) {
      document.body.removeChild(tempContainer);
      tempContainer = null;
    }

    // Standard A4 dimensions in mm: 210 x 297
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Standard page margins: 8mm
    const margin = 8;
    const contentWidth = pdfWidth - margin * 2;
    const pageContentHeight = pdfHeight - margin * 2;
    const pixelsPerMm = canvas.width / contentWidth;
    const pageHeightPx = Math.max(1, Math.floor(pageContentHeight * pixelsPerMm));
    const pageCount = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

    // Slice the rendered invoice into A4 pages with fast JPEG encoding
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      if (pageIndex > 0) {
        await new Promise(r => setTimeout(r, 0));
      }
      const sourceY = pageIndex * pageHeightPx;
      const sourceHeight = Math.min(pageHeightPx, canvas.height - sourceY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      const pageContext = pageCanvas.getContext('2d');
      if (!pageContext) {
        throw new Error('Không thể tạo canvas phân trang PDF.');
      }
      pageContext.fillStyle = '#ffffff';
      pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sourceHeight,
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );

      if (pageIndex > 0) {
        pdf.addPage();
      }
      const pageImageHeight = sourceHeight / pixelsPerMm;
      pdf.addImage(
        pageCanvas.toDataURL('image/jpeg', 0.88),
        'JPEG',
        margin,
        margin,
        contentWidth,
        pageImageHeight,
        undefined,
        'FAST'
      );
    }

    pdf.save(defaultFileName);

    return true;
  } catch (error) {
    console.error('Error generating PDF with jsPDF:', error);
    return false;
  }
}

/**
 * Sinh trực tiếp mảng byte (Uint8Array) của tệp PDF Mẫu Chuẩn Tổng Cục Thuế
 * phục vụ đóng gói tệp ZIP tải hàng loạt khi nhà cung cấp không hỗ trợ tải trực tiếp.
 */
export async function generateGdtPdfBytes(
  invoice: GDTInvoice,
  theme: 'red' | 'blue' = 'red'
): Promise<Uint8Array | null> {
  let tempContainer: HTMLDivElement | null = null;
  try {
    const qrCode = await generateInvoiceQrCode(invoice);
    const htmlString = generateOfficialInvoiceHtml(invoice, {
      theme,
      qrCodeDataUrl: qrCode,
      showPrintControls: false,
      templateId: 'DEFAULT'
    });

    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(htmlString, 'text/html');
    parsedDoc.querySelectorAll('script').forEach(s => s.remove());

    tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '820px';
    tempContainer.style.background = '#ffffff';
    tempContainer.innerHTML = (parsedDoc.head ? parsedDoc.head.innerHTML : '') + parsedDoc.body.innerHTML;
    document.body.appendChild(tempContainer);

    const targetElement = (tempContainer.querySelector('.main-page, .invoice-container, .print-page') as HTMLElement) || tempContainer;

    const canvas = await html2canvas(targetElement, {
      scale: 1.8,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 820,
      imageTimeout: 3000,
      removeContainer: true
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const contentWidth = pdfWidth - margin * 2;
    const pageContentHeight = pdfHeight - margin * 2;
    const pixelsPerMm = canvas.width / contentWidth;
    const pageHeightPx = Math.max(1, Math.floor(pageContentHeight * pixelsPerMm));
    const pageCount = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      if (pageIndex > 0) {
        await new Promise(r => setTimeout(r, 0));
      }
      const sourceY = pageIndex * pageHeightPx;
      const sourceHeight = Math.min(pageHeightPx, canvas.height - sourceY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      const pageContext = pageCanvas.getContext('2d');
      if (!pageContext) continue;
      
      pageContext.fillStyle = '#ffffff';
      pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sourceHeight,
        0,
        0,
        pageCanvas.width,
        pageCanvas.height
      );

      if (pageIndex > 0) {
        pdf.addPage();
      }
      const pageImageHeight = sourceHeight / pixelsPerMm;
      pdf.addImage(
        pageCanvas.toDataURL('image/jpeg', 0.88),
        'JPEG',
        margin,
        margin,
        contentWidth,
        pageImageHeight,
        undefined,
        'FAST'
      );
    }

    const arrayBuffer = pdf.output('arraybuffer');
    return new Uint8Array(arrayBuffer);
  } catch (err) {
    console.error('[generateGdtPdfBytes] Lỗi xuất PDF chuẩn GDT:', err);
    return null;
  } finally {
    if (tempContainer && document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer);
    }
  }
}

/**
 * Downloads a standalone, offline-viewable HTML file of the invoice.
 */
export async function downloadStandaloneHtmlFile(
  invoice: GDTInvoice,
  theme: 'red' | 'blue' = 'red',
  templateId?: string
): Promise<void> {
  const qrCode = await generateInvoiceQrCode(invoice);
  const htmlContent = generateOfficialInvoiceHtml(invoice, {
    theme,
    qrCodeDataUrl: qrCode,
    showPrintControls: true,
    templateId: (templateId && templateId !== 'AUTO') ? templateId as any : undefined
  });

  const cleanShd = String(invoice.shdon).padStart(7, '0');
  const fileName = `HoaDon_${invoice.khhdon}_${cleanShd}_${invoice.nbmst}.html`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens a clean, dedicated print window for instant native printing or saving as PDF
 */
export async function openInvoicePrintWindow(
  invoice: GDTInvoice,
  theme: 'red' | 'blue' = 'red',
  templateId?: string
): Promise<void> {
  const qrCode = await generateInvoiceQrCode(invoice);
  const invoiceHtmlContent = generateOfficialInvoiceHtml(invoice, {
    theme,
    qrCodeDataUrl: qrCode,
    showPrintControls: true,
    templateId: (templateId && templateId !== 'AUTO') ? templateId as any : undefined
  });

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(invoiceHtmlContent);
  printWindow.document.close();

  printWindow.onload = function() {
    setTimeout(function() {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };
}
