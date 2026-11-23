import React, { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2, Printer, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

interface InvoicePdfViewerProps {
  pdfUrl: string;
  title?: string;
  filename?: string;
  className?: string;
}

export const InvoicePdfViewer: React.FC<InvoicePdfViewerProps> = ({
  pdfUrl,
  title = 'Bản PDF gốc hóa đơn',
  filename = 'HoaDonDienTu.pdf',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.25);
  const [rotation, setRotation] = useState<number>(0);

  useEffect(() => {
    let isCancelled = false;
    let currentPdfDoc: any = null;

    async function renderPdf() {
      if (!pdfUrl) return;
      setIsLoading(true);
      setLoadError(null);

      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        if (typeof window !== 'undefined') {
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        }

        // Tải dữ liệu PDF từ URL (blob hoặc HTTP)
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error(`Không tải được tệp PDF (HTTP ${response.status})`);
        const arrayBuffer = await response.arrayBuffer();

        if (isCancelled) return;

        const loadingTask = pdfjs.getDocument({
          data: arrayBuffer,
          useSystemFonts: true,
          disableFontFace: false,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/cmaps/',
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) {
          doc.destroy();
          return;
        }

        currentPdfDoc = doc;
        setNumPages(doc.numPages);
        setIsLoading(false);

        // Đợi DOM render các canvas container
        setTimeout(async () => {
          if (isCancelled || !containerRef.current) return;
          const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

          for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
            if (isCancelled) break;
            try {
              const page = await doc.getPage(pageNum);
              const canvas = containerRef.current?.querySelector<HTMLCanvasElement>(`#pdf-page-${pageNum}`);
              if (!canvas) continue;

              const baseViewport = page.getViewport({ scale: 1, rotation });
              const scale = zoom * dpr;
              const viewport = page.getViewport({ scale, rotation });

              canvas.width = Math.floor(viewport.width);
              canvas.height = Math.floor(viewport.height);
              canvas.style.width = `${Math.floor(baseViewport.width * zoom)}px`;
              canvas.style.height = `${Math.floor(baseViewport.height * zoom)}px`;

              const ctx = canvas.getContext('2d', { alpha: false });
              if (!ctx) continue;

              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';

              await page.render({
                canvasContext: ctx,
                viewport,
                canvas,
              }).promise;
            } catch (pageErr: any) {
              console.warn(`[InvoicePdfViewer] Lỗi render trang ${pageNum}:`, pageErr?.message);
            }
          }
        }, 50);
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('[InvoicePdfViewer] Lỗi nạp PDF.js, sử dụng fallback iframe:', err?.message);
          setLoadError(err?.message || 'Không thể hiển thị PDF qua PDF.js');
          setIsLoading(false);
        }
      }
    }

    renderPdf();

    return () => {
      isCancelled = true;
      if (currentPdfDoc) {
        currentPdfDoc.destroy();
      }
    };
  }, [pdfUrl, zoom, rotation]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => setZoom(1.25);
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handlePrint = () => {
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <div className={`flex flex-col bg-slate-100 rounded-lg overflow-hidden border border-slate-300 ${className}`}>
      {/* Thanh điều khiển tiện ích trên bản PDF */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-800 text-white border-b border-slate-700 text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">{title}</span>
          {numPages > 0 && (
            <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-[11px]">
              {numPages} trang
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 0.75}
            className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-0.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-[11px] transition-colors"
            title="Đặt lại kích thước chuẩn"
          >
            {Math.round(zoom * 80)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 2.5}
            className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors ml-1"
            title="Xoay 90 độ"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-600 mx-1" />

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
            title="In hóa đơn PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">In</span>
          </button>

          <a
            href={pdfUrl}
            download={filename}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-semibold transition-colors shadow-sm"
            title="Tải tệp PDF về máy"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải về</span>
          </a>

          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Mở trong tab mới"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Vùng hiển thị nội dung PDF */}
      <div
        ref={containerRef}
        className="flex-1 w-full overflow-auto bg-slate-200/90 p-4 sm:p-6 flex flex-col items-center gap-6 min-h-[800px]"
      >
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-600">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <span className="text-sm font-medium">Đang tải và hiển thị bản thể hiện PDF...</span>
          </div>
        )}

        {loadError && (
          <div className="w-full h-[900px] flex flex-col items-center justify-center bg-white rounded-lg shadow-sm border border-slate-300 p-4">
            <div className="mb-3 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded border border-amber-200">
              Chuyển sang chế độ hiển thị nhúng trình duyệt (Native PDF Embed)
            </div>
            <iframe
              src={pdfUrl}
              title={title}
              className="w-full h-full border-0 rounded"
            />
          </div>
        )}

        {!isLoading && !loadError && numPages > 0 && (
          Array.from({ length: numPages }).map((_, i) => (
            <div
              key={i + 1}
              className="bg-white shadow-xl rounded-sm border border-slate-300 overflow-hidden transition-transform duration-150"
            >
              <canvas
                id={`pdf-page-${i + 1}`}
                className="block mx-auto"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
