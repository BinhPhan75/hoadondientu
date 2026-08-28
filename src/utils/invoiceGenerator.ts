import { GDTInvoice, InvoiceItem } from '../types';
import { numberToVietnameseWords } from './xmlParser';

interface SyncOptions {
  taxCode: string;
  taxpayerName?: string;
  address?: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  invoiceType: 'purchase' | 'sold' | 'both';
}

/**
 * Generates random or realistic dates strictly between fromDate and toDate
 */
function generateDatesBetween(fromDateStr: string, toDateStr: string, count: number): string[] {
  const from = new Date(fromDateStr || '2025-01-01');
  const to = new Date(toDateStr || '2025-03-31');

  // If invalid or from > to
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
    const today = new Date();
    return Array(count).fill(today.toISOString().substring(0, 19));
  }

  const diffMs = to.getTime() - from.getTime();
  const dates: string[] = [];

  for (let i = 0; i < count; i++) {
    // Distribute evenly with slight random hour offset
    const fraction = count === 1 ? 0.5 : (i + 0.5) / count;
    const targetMs = from.getTime() + diffMs * fraction;
    const d = new Date(targetMs);
    
    // Set realistic working hours (8:30 to 17:30)
    const hour = 8 + Math.floor((i * 1.5) % 9);
    const minute = (i * 17) % 60;
    const second = (i * 23) % 60;
    d.setHours(hour, minute, second, 0);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');

    dates.push(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
  }

  return dates.sort();
}

/**
 * Known Vietnamese Vendors for Purchase Invoices
 */
const VENDORS = [
  {
    mst: '0100109106',
    name: 'TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM (VNPT)',
    address: 'Số 57 phố Huỳnh Thúc Kháng, Phường Láng Hạ, Quận Đống Đa, TP Hà Nội',
    phone: '18001260',
    email: 'cskh@vnpt.vn',
    bankAccount: '110000001889 - VietinBank Hà Nội',
    caProvider: 'VNPT-CA',
    items: [
      { name: 'Cước dịch vụ Internet Cáp quang FiberVNN gói DN-300Mbps', unit: 'Tháng', qty: 1, price: 4500000, taxRate: '10%', taxPercent: 10 },
      { name: 'Thuê bao máy chủ đám mây VNPT SmartCloud 16 vCPU, 32GB RAM', unit: 'Tháng', qty: 1, price: 8000000, taxRate: '10%', taxPercent: 10 }
    ]
  },
  {
    mst: '0101243150',
    name: 'CÔNG TY CỔ PHẦN MISA',
    address: 'Tầng 9, Tòa nhà Technosoft, Phố Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, TP Hà Nội',
    phone: '02437957788',
    email: 'support@misa.com.vn',
    bankAccount: '0021000188299 - Vietcombank Thăng Long',
    caProvider: 'MISA-CA',
    items: [
      { name: 'Phần mềm kế toán doanh nghiệp MISA AMIS Kế toán (Gói Enterprise 1 năm)', unit: 'Gói', qty: 1, price: 15000000, taxRate: 'KCT', taxPercent: 0 },
      { name: 'Gói 5.000 số hóa đơn điện tử MISA meInvoice tích hợp AMIS', unit: 'Gói', qty: 1, price: 3900000, taxRate: '8%', taxPercent: 8 }
    ]
  },
  {
    mst: '0100773885',
    name: 'TẬP ĐOÀN XĂNG DẦU VIỆT NAM (PETROLIMEX)',
    address: 'Số 1 Khâm Thiên, Phường Khâm Thiên, Quận Đống Đa, TP Hà Nội',
    phone: '02438512603',
    email: 'petrolimex@petrolimex.com.vn',
    bankAccount: '111000002881 - BIDV Hà Nội',
    caProvider: 'VIETTEL-CA',
    items: [
      { name: 'Xăng RON 95-V phục vụ xe công tác điều hành', unit: 'Lít', qty: 218.48, price: 23800, taxRate: '10%', taxPercent: 10 }
    ]
  },
  {
    mst: '0303217354',
    name: 'CÔNG TY CỔ PHẦN THẾ GIỚI DI ĐỘNG',
    address: '128 Trần Quang Khải, Phường Tân Định, Quận 1, TP Hồ Chí Minh',
    phone: '18001060',
    email: 'cskh@thegioididong.com',
    bankAccount: '0071000889211 - Vietcombank TP.HCM',
    caProvider: 'FPT-CA',
    items: [
      { name: 'Máy tính xách tay Apple MacBook Pro 14 M3 18GB/512GB', unit: 'Chiếc', qty: 1, price: 48500000, taxRate: '8%', taxPercent: 8 },
      { name: 'Màn hình chuyên đồ họa Dell UltraSharp U2724D 27 inch 2K', unit: 'Chiếc', qty: 2, price: 10000000, taxRate: '8%', taxPercent: 8 }
    ]
  },
  {
    mst: '0101778163',
    name: 'CÔNG TY CỔ PHẦN VIỄN THÔNG FPT (FPT TELECOM)',
    address: 'Tòa nhà FPT, Phố Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, TP Hà Nội',
    phone: '19006600',
    email: 'hotrokhachhang@fpt.com.vn',
    bankAccount: '0011002233445 - TPBank Hà Nội',
    caProvider: 'FPT-CA',
    items: [
      { name: 'Dịch vụ Thuê chỗ đặt máy chủ Colocation Data Center Tier 3 Tân Thuận', unit: 'Tháng', qty: 2, price: 4600000, taxRate: '10%', taxPercent: 10 }
    ]
  },
  {
    mst: '0300951119',
    name: 'TỔNG CÔNG TY ĐIỆN LỰC TP. HỒ CHÍ MINH (EVNHCMC)',
    address: 'Số 35 Tôn Đức Thắng, Phường Bến Nghé, Quận 1, TP Hồ Chí Minh',
    phone: '1900545454',
    email: 'cskh@hcmpc.com.vn',
    bankAccount: '0071000012345 - Vietcombank TP.HCM',
    caProvider: 'VNPT-CA',
    items: [
      { name: 'Tiền điện văn phòng sản xuất kinh doanh', unit: 'kWh', qty: 4850, price: 3061.85, taxRate: '8%', taxPercent: 8 }
    ]
  }
];

/**
 * Known Vietnamese Clients for Sold Invoices
 */
const BUYERS = [
  {
    mst: '0301446522',
    name: 'CÔNG TY CỔ PHẦN TẬP ĐOÀN ĐẦU TƯ ĐỊA ỐC NO VA',
    address: '315 Nam Kỳ Khởi Nghĩa, Phường Võ Thị Sáu, Quận 3, TP Hồ Chí Minh',
    phone: '02839301234',
    email: 'contact@novaland.com.vn',
    items: [
      { name: 'Hợp đồng phát triển hệ thống ERP quản lý dự án Bất Động Sản (Giai đoạn 1)', unit: 'Hợp đồng', qty: 1, price: 150000000, taxRate: '10%', taxPercent: 10 }
    ]
  },
  {
    mst: '0304998271',
    name: 'CÔNG TY CỔ PHẦN TẬP ĐOÀN VÀNG BẠC ĐÁ QUÝ DOJI',
    address: 'Số 5 Lê Duẩn, Phường Điện Biên, Quận Ba Đình, TP Hà Nội',
    phone: '02439308888',
    email: 'info@doji.vn',
    items: [
      { name: 'Dịch vụ tư vấn giải pháp Chuyển đổi số & Tích hợp Cổng thanh toán trực tuyến', unit: 'Gói', qty: 1, price: 85000000, taxRate: '10%', taxPercent: 10 }
    ]
  },
  {
    mst: '0100109106',
    name: 'TẬP ĐOÀN BƯU CHÍNH VIỄN THÔNG VIỆT NAM (VNPT)',
    address: 'Số 57 phố Huỳnh Thúc Kháng, Phường Láng Hạ, Quận Đống Đa, TP Hà Nội',
    phone: '18001260',
    email: 'cskh@vnpt.vn',
    items: [
      { name: 'Dịch vụ phát triển Module AI OCR nhận dạng biên lai & hóa đơn', unit: 'Gói', qty: 1, price: 65000000, taxRate: '10%', taxPercent: 10 }
    ]
  }
];

/**
 * Synchronizes or dynamically generates invoices for the specified MST and date range.
 * Guarantees that generated invoice dates fall strictly inside [fromDate, toDate].
 */
export function generateMatchingInvoicesForPeriod(options: SyncOptions): GDTInvoice[] {
  const { taxCode, taxpayerName, address, fromDate, toDate, invoiceType } = options;
  const userMst = (taxCode || '0316892345').trim();
  const userName = taxpayerName || (userMst === '0316892345' ? 'CÔNG TY TNHH CÔNG NGHỆ VÀ TRUYỀN THÔNG ĐÔNG NAM Á' : `DOANH NGHIỆP NỘP THUẾ (MST: ${userMst})`);
  const userAddress = address || 'Số 142 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP Hồ Chí Minh';

  const results: GDTInvoice[] = [];

  // Determine how many purchase and sold invoices to generate
  let purchaseCount = 0;
  let soldCount = 0;

  if (invoiceType === 'purchase') {
    purchaseCount = 6;
    soldCount = 0;
  } else if (invoiceType === 'sold') {
    purchaseCount = 0;
    soldCount = 3;
  } else {
    purchaseCount = 6;
    soldCount = 3;
  }

  const totalCount = purchaseCount + soldCount;
  const generatedDates = generateDatesBetween(fromDate, toDate, totalCount);

  let dateIdx = 0;
  const currentYearSuffix = (fromDate ? fromDate.substring(2, 4) : '25');

  // 1. Generate Purchase Invoices (User is Buyer)
  for (let i = 0; i < purchaseCount; i++) {
    const vendor = VENDORS[i % VENDORS.length];
    const tdlap = generatedDates[dateIdx++];
    const shdon = String(1000 + i * 4521 + 12).padStart(7, '0');
    const khhdon = `1C${currentYearSuffix}T${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 3) % 26))}`;

    const items: InvoiceItem[] = vendor.items.map((item, idx) => {
      const amount = Math.round(item.qty * item.price);
      const taxAmount = Math.round((amount * item.taxPercent) / 100);
      return {
        id: `item_p_${i}_${idx}`,
        lineNo: idx + 1,
        itemName: item.name,
        unit: item.unit,
        quantity: item.qty,
        unitPrice: item.price,
        amount,
        taxRate: item.taxRate,
        taxRatePercent: item.taxPercent,
        taxAmount,
        totalAmount: amount + taxAmount
      };
    });

    const tgtcthue = items.reduce((s, it) => s + it.amount, 0);
    const tgtthue = items.reduce((s, it) => s + it.taxAmount, 0);
    const tgtttbso = tgtcthue + tgtthue;
    const tgtttbchu = numberToVietnameseWords(tgtttbso);

    results.push({
      id: `SYNC_P_${userMst}_${shdon}_${i}`,
      khmshdon: '1',
      khhdon,
      shdon,
      tdlap,
      nbmst: vendor.mst,
      nbten: vendor.name,
      nbdchi: vendor.address,
      nbsdt: vendor.phone,
      nbemail: vendor.email,
      nmmst: userMst,
      nmten: userName,
      nmdchi: userAddress,
      tgtcthue,
      tgtthue,
      tgtttbso,
      tgtttbchu,
      htttoan: 'Chuyển khoản',
      dvtte: 'VND',
      tygia: 1,
      tthdon: 1,
      tthdonLabel: 'Hóa đơn gốc',
      ttxly: 1,
      ttxlyLabel: 'Đã cấp mã CQT',
      mhdon: `00${Math.random().toString(16).toUpperCase().substring(2, 32)}`,
      hsgcma: true,
      loaiHdon: 'purchase',
      hasDigitalSignature: true,
      signerName: vendor.name,
      signedDate: tdlap,
      caProvider: vendor.caProvider,
      items
    });
  }

  // 2. Generate Sold Invoices (User is Seller)
  for (let i = 0; i < soldCount; i++) {
    const buyer = BUYERS[i % BUYERS.length];
    const tdlap = generatedDates[dateIdx++];
    const shdon = String(100 + i + 1).padStart(7, '0');
    const khhdon = `1C${currentYearSuffix}TGT`;

    const items: InvoiceItem[] = buyer.items.map((item, idx) => {
      const amount = Math.round(item.qty * item.price);
      const taxAmount = Math.round((amount * item.taxPercent) / 100);
      return {
        id: `item_s_${i}_${idx}`,
        lineNo: idx + 1,
        itemName: item.name,
        unit: item.unit,
        quantity: item.qty,
        unitPrice: item.price,
        amount,
        taxRate: item.taxRate,
        taxRatePercent: item.taxPercent,
        taxAmount,
        totalAmount: amount + taxAmount
      };
    });

    const tgtcthue = items.reduce((s, it) => s + it.amount, 0);
    const tgtthue = items.reduce((s, it) => s + it.taxAmount, 0);
    const tgtttbso = tgtcthue + tgtthue;
    const tgtttbchu = numberToVietnameseWords(tgtttbso);

    results.push({
      id: `SYNC_S_${userMst}_${shdon}_${i}`,
      khmshdon: '1',
      khhdon,
      shdon,
      tdlap,
      nbmst: userMst,
      nbten: userName,
      nbdchi: userAddress,
      nbsdt: '02839301234',
      nbemail: 'billing@enterprise.vn',
      nmmst: buyer.mst,
      nmten: buyer.name,
      nmdchi: buyer.address,
      tgtcthue,
      tgtthue,
      tgtttbso,
      tgtttbchu,
      htttoan: 'Chuyển khoản',
      dvtte: 'VND',
      tygia: 1,
      tthdon: i === 2 ? 3 : 1,
      tthdonLabel: i === 2 ? 'Hóa đơn Điều chỉnh' : 'Hóa đơn gốc',
      ttxly: 1,
      ttxlyLabel: 'Đã cấp mã CQT',
      mhdon: `00${Math.random().toString(16).toUpperCase().substring(2, 32)}`,
      hsgcma: true,
      loaiHdon: 'sold',
      hasDigitalSignature: true,
      signerName: userName,
      signedDate: tdlap,
      caProvider: 'VIETTEL-CA',
      items
    });
  }

  return results;
}
