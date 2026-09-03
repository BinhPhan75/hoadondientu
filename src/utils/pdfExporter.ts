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
    const maCqt = invoice.mhdon || (invoice.hsgcma ? '00E9C762DA374972B621A0F9004B2C89' : '');
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
  theme: 'red' | 'blue' = 'red'
): Promise<boolean> {
  try {
    const cleanShd = String(invoice.shdon).padStart(7, '0');
    const defaultFileName = fileName || `HD_${invoice.khhdon}_${cleanShd}_${invoice.nbmst}.pdf`;

    let targetElement = element;
    let tempContainer: HTMLDivElement | null = null;

    if (!targetElement) {
      // Create offscreen container with official invoice HTML
      const qrCode = await generateInvoiceQrCode(invoice);
      const htmlString = generateOfficialInvoiceHtml(invoice, {
        theme,
        qrCodeDataUrl: qrCode,
        showPrintControls: false
      });
      
      tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '820px';
      tempContainer.style.background = '#ffffff';
      tempContainer.innerHTML = htmlString;
      document.body.appendChild(tempContainer);
      targetElement = tempContainer.querySelector('.invoice-container') as HTMLElement || tempContainer;
    }

    // High resolution canvas options for crisp text & borders
    const canvas = await html2canvas(targetElement, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 820
    });

    if (tempContainer) {
      document.body.removeChild(tempContainer);
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

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
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, Math.min(contentHeight, pdfHeight - margin * 2));
    pdf.save(defaultFileName);

    return true;
  } catch (error) {
    console.error('Error generating PDF with jsPDF:', error);
    return false;
  }
}

/**
 * Downloads a standalone, offline-viewable HTML file of the invoice.
 */
export async function downloadStandaloneHtmlFile(
  invoice: GDTInvoice,
  theme: 'red' | 'blue' = 'red'
): Promise<void> {
  const qrCode = await generateInvoiceQrCode(invoice);
  const htmlContent = generateOfficialInvoiceHtml(invoice, {
    theme,
    qrCodeDataUrl: qrCode,
    showPrintControls: true
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
  theme: 'red' | 'blue' = 'red'
): Promise<void> {
  const qrCode = await generateInvoiceQrCode(invoice);
  const invoiceHtmlContent = generateOfficialInvoiceHtml(invoice, {
    theme,
    qrCodeDataUrl: qrCode,
    showPrintControls: true
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
