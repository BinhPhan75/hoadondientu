import { MonthSyncChunk } from '../types';

/**
 * Split a date range into monthly calendar chunks (<= 31 days each)
 * to comply with Vietnam General Department of Taxation (GDT) single-query limits.
 */
export function generateMonthChunks(fromDateStr: string, toDateStr: string): MonthSyncChunk[] {
  const start = new Date(fromDateStr);
  const end = new Date(toDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [{
      id: `${fromDateStr}_${toDateStr}`,
      monthIndex: 0,
      totalMonths: 1,
      label: `Kỳ ${fromDateStr} - ${toDateStr}`,
      shortLabel: 'Kỳ tra cứu',
      fromDate: fromDateStr,
      toDate: toDateStr,
      status: 'pending',
      purchaseCount: 0,
      soldCount: 0,
      totalCount: 0,
      purchaseAmount: 0,
      purchaseTax: 0,
      soldAmount: 0,
      soldTax: 0,
      totalAmount: 0,
      totalTax: 0,
      totalPayment: 0
    }];
  }

  const rawChunks: Array<{ from: string; to: string; year: number; month: number }> = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const finalEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const pad = (n: number) => String(n).padStart(2, '0');

  while (cur <= finalEnd) {
    const year = cur.getFullYear();
    const month = cur.getMonth(); // 0-indexed

    // Last day of current month
    const endOfMonth = new Date(year, month + 1, 0);
    const chunkEnd = endOfMonth < finalEnd ? endOfMonth : finalEnd;

    const fromStr = `${year}-${pad(month + 1)}-${pad(cur.getDate())}`;
    const toStr = `${chunkEnd.getFullYear()}-${pad(chunkEnd.getMonth() + 1)}-${pad(chunkEnd.getDate())}`;

    rawChunks.push({
      from: fromStr,
      to: toStr,
      year,
      month: month + 1
    });

    // Advance to the 1st of next month
    cur = new Date(year, month + 1, 1);
  }

  const total = rawChunks.length;

  return rawChunks.map((rc, idx) => {
    const monthLabel = `Tháng ${pad(rc.month)}/${rc.year}`;
    const shortLabel = `T${pad(rc.month)}/${String(rc.year).slice(-2)}`;

    return {
      id: `${rc.year}-${pad(rc.month)}`,
      monthIndex: idx,
      totalMonths: total,
      label: monthLabel,
      shortLabel,
      fromDate: rc.from,
      toDate: rc.to,
      status: 'pending',
      purchaseCount: 0,
      soldCount: 0,
      totalCount: 0,
      purchaseAmount: 0,
      purchaseTax: 0,
      soldAmount: 0,
      soldTax: 0,
      totalAmount: 0,
      totalTax: 0,
      totalPayment: 0
    };
  });
}

/**
 * Check if the selected date range spans across more than 1 month or exceeds 31 days
 */
export function isMultiMonthRange(fromDateStr: string, toDateStr: string): boolean {
  if (!fromDateStr || !toDateStr) return false;
  const start = new Date(fromDateStr);
  const end = new Date(toDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

  // If different months or years
  if (start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth()) {
    return true;
  }

  // If day difference > 31 days
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > 31;
}
