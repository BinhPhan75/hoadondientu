import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  FileCode2, 
  FileText, 
  ShieldCheck, 
  Building2, 
  Copy, 
  Check, 
  ExternalLink 
} from 'lucide-react';
import { GDTInvoice } from '../types';
import { generateGDTInvoiceXml } from '../utils/xmlGenerator';

interface InvoiceDetailModalProps {
  invoice: GDTInvoice | null;
  onClose: () => void;
  onDownloadXml: (invoice: GDTInvoice) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  onClose,
  onDownloadXml
}) => {
  const [activeTab, setActiveTab] = useState<'visual' | 'xml'>('visual');
  const [isCopiedXml, setIsCopiedXml] = useState(false);

  if (!invoice) return null;

  const xmlContent = invoice.rawXml || generateGDTInvoiceXml(invoice);

  const handleCopyXml = () => {
    navigator.clipboard.writeText(xmlContent);
    setIsCopiedXml(true);
    setTimeout(() => setIsCopiedXml(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  const formatDate = (isoStr: string) => {
    try {
      const parts = isoStr.split('T');
      const dateParts = parts[0].split('-');
      return `Ngày ${dateParts[2]} tháng ${dateParts[1]} năm ${dateParts[0]}`;
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-2xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded max-w-4xl w-full shadow-2xl border border-[#d1d5db] overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="bg-[#111827] text-white px-5 py-3 flex items-center justify-between shrink-0 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#ef4444]" />
            <div>
              <h3 className="font-bold text-xs sm:text-sm font-mono uppercase tracking-wider">
                HÓA ĐƠN ĐIỆN TỬ: {invoice.khhdon} - SỐ {invoice.shdon}
              </h3>
              <p className="text-[11px] text-gray-400">
                Mã CQT: <span className="font-mono text-emerald-400">{invoice.mhdon || 'Chưa cấp mã'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="inline-flex p-0.5 bg-gray-950 rounded border border-gray-800 text-xs">
              <button
                onClick={() => setActiveTab('visual')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  activeTab === 'visual' ? 'bg-[#ef4444] text-white shadow-2xs' : 'text-gray-400 hover:text-white'
                }`}
              >
                Bản thể hiện
              </button>
              <button
                onClick={() => setActiveTab('xml')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  activeTab === 'xml' ? 'bg-[#ef4444] text-white shadow-2xs' : 'text-gray-400 hover:text-white'
                }`}
              >
                Mã XML gốc
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-gray-100">
          {activeTab === 'visual' ? (
            /* Visual Invoice Paper */
            <div className="bg-white p-5 sm:p-8 rounded border border-[#d1d5db] shadow-xs max-w-3xl mx-auto text-gray-900 text-xs font-sans print:shadow-none print:border-none">
              {/* Invoice Header */}
              <div className="border-b-2 border-[#ef4444] pb-3 mb-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#ef4444] tracking-wide uppercase">
                      {invoice.khmshdon === '1' ? 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG' : 'HÓA ĐƠN BÁN HÀNG'}
                    </h2>
                    <p className="text-[11px] text-gray-500 italic mt-0.5">
                      (Bản thể hiện của hóa đơn điện tử - Nghị định 123/2020/NĐ-CP)
                    </p>
                    <p className="text-xs font-semibold text-gray-800 mt-1">
                      {formatDate(invoice.tdlap)}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-2.5 rounded border border-[#d1d5db] text-right shrink-0 space-y-0.5 font-mono text-[11px]">
                    <div>Mẫu số: <strong>{invoice.khmshdon}</strong></div>
                    <div>Ký hiệu: <strong className="text-[#ef4444]">{invoice.khhdon}</strong></div>
                    <div>Số HĐ: <strong className="text-sm text-[#ef4444] font-black">{invoice.shdon}</strong></div>
                  </div>
                </div>

                {/* Tax Authority Code Box */}
                {invoice.mhdon && (
                  <div className="mt-2.5 p-1.5 bg-emerald-50 border border-emerald-200 rounded flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span><strong>Mã Cơ quan Thuế:</strong> <span className="font-mono">{invoice.mhdon}</span></span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">ĐÃ CẤP MÃ HỢP LỆ</span>
                  </div>
                )}
              </div>

              {/* Seller Information */}
              <div className="p-3 bg-gray-50 rounded border border-[#d1d5db] mb-3 space-y-1 leading-relaxed text-xs">
                <div className="flex items-start gap-2">
                  <span className="font-bold min-w-[120px] text-gray-600">Đơn vị bán hàng:</span>
                  <span className="font-bold text-gray-900 uppercase">{invoice.nbten}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold min-w-[120px] text-gray-600">Mã số thuế:</span>
                  <span className="font-mono font-bold text-[#ef4444] text-xs tracking-wider">{invoice.nbmst}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[120px] text-gray-600">Địa chỉ:</span>
                  <span>{invoice.nbdchi}</span>
                </div>
              </div>

              {/* Buyer Information */}
              <div className="p-3 bg-gray-50 rounded border border-[#d1d5db] mb-3 space-y-1 leading-relaxed text-xs">
                <div className="flex items-start gap-2">
                  <span className="font-bold min-w-[120px] text-gray-600">Tên người mua:</span>
                  <span className="font-bold text-gray-900">{invoice.nmten}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold min-w-[120px] text-gray-600">Mã số thuế:</span>
                  <span className="font-mono font-bold text-gray-900 text-xs tracking-wider">{invoice.nmmst}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[120px] text-gray-600">Địa chỉ:</span>
                  <span>{invoice.nmdchi}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-[#d1d5db] rounded overflow-hidden mb-3">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-[#d1d5db] font-bold text-gray-800 text-center text-[11px] uppercase">
                      <th className="p-2 border-r border-[#d1d5db] w-8">STT</th>
                      <th className="p-2 border-r border-[#d1d5db] text-left min-w-[180px]">Tên hàng hóa, dịch vụ</th>
                      <th className="p-2 border-r border-[#d1d5db] w-14">ĐVT</th>
                      <th className="p-2 border-r border-[#d1d5db] w-14 text-right">Số lượng</th>
                      <th className="p-2 border-r border-[#d1d5db] w-20 text-right">Đơn giá</th>
                      <th className="p-2 border-r border-[#d1d5db] w-16 text-center">Thuế</th>
                      <th className="p-2 w-24 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 font-mono text-[11px]">
                    {invoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="p-1.5 text-center border-r border-gray-200">{item.lineNo || idx + 1}</td>
                        <td className="p-1.5 font-sans font-medium text-gray-900 border-r border-gray-200">
                          {item.itemName}
                        </td>
                        <td className="p-1.5 text-center font-sans border-r border-gray-200">{item.unit || 'Cái'}</td>
                        <td className="p-1.5 text-right border-r border-gray-200">{item.quantity.toLocaleString()}</td>
                        <td className="p-1.5 text-right border-r border-gray-200">{item.unitPrice.toLocaleString()}</td>
                        <td className="p-1.5 text-center font-sans font-semibold text-gray-800 border-r border-gray-200">
                          {item.taxRate}
                        </td>
                        <td className="p-1.5 text-right font-bold text-gray-900">{item.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation Summary */}
              <div className="space-y-1 p-3 bg-gray-50 rounded border border-[#d1d5db] mb-3 font-sans text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Tổng tiền hàng (chưa thuế):</span>
                  <span className="font-mono font-bold">{formatVND(invoice.tgtcthue)}</span>
                </div>
                <div className="flex justify-between items-center text-amber-900">
                  <span className="font-semibold">Tiền thuế giá trị gia tăng (GTGT):</span>
                  <span className="font-mono font-bold">{formatVND(invoice.tgtthue)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-[#d1d5db] text-[#ef4444]">
                  <span className="font-bold text-xs uppercase">Tổng cộng tiền thanh toán:</span>
                  <span className="font-mono font-black text-sm">{formatVND(invoice.tgtttbso)}</span>
                </div>
                <div className="text-gray-500 italic pt-0.5 text-[11px]">
                  Số tiền viết bằng chữ: <strong>{invoice.tgtttbchu}</strong>
                </div>
              </div>

              {/* Signatures Area */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200 text-center">
                <div className="space-y-0.5">
                  <p className="font-bold uppercase text-gray-800 text-[11px]">Người mua hàng</p>
                  <p className="text-gray-500 italic text-[10px]">(Ký, ghi rõ họ tên)</p>
                </div>

                <div className="space-y-0.5">
                  <p className="font-bold uppercase text-gray-800 text-[11px]">Người bán hàng</p>
                  <div className="mt-2 p-2 bg-emerald-50 border border-emerald-300 rounded text-left space-y-0.5">
                    <div className="flex items-center gap-1 text-emerald-800 font-bold text-[10px]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>CHỮ KÝ SỐ HỢP LỆ</span>
                    </div>
                    <div className="text-[10px] text-gray-700 font-mono leading-tight">
                      <p>Ký bởi: {invoice.signerName || invoice.nbten}</p>
                      <p>Ngày: {invoice.signedDate || invoice.tdlap}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* XML Code Viewer */
            <div className="bg-[#111827] text-gray-100 p-3 rounded border border-gray-800 font-mono text-xs max-w-3xl mx-auto">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800 mb-2">
                <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                  <FileCode2 className="w-3.5 h-3.5 text-[#ef4444]" />
                  <span>Dữ liệu XML chuẩn Quyết định 1450/QĐ-TCT</span>
                </div>
                <button
                  onClick={handleCopyXml}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-[11px] font-semibold transition-colors"
                >
                  {isCopiedXml ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopiedXml ? 'Đã chép!' : 'Sao chép XML'}</span>
                </button>
              </div>

              <pre className="overflow-x-auto p-2.5 bg-black rounded text-[#10b981] leading-relaxed max-h-[480px] text-[11px]">
                {xmlContent}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t border-[#d1d5db] px-5 py-2.5 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-gray-500 font-mono">
            TT78/2021/TT-BTC & NĐ 123/2020/NĐ-CP
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In HĐ</span>
            </button>

            <button
              onClick={() => onDownloadXml(invoice)}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white bg-[#ef4444] hover:bg-red-600 rounded transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải XML Gốc</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
