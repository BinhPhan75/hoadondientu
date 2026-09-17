import { MonthSyncChunk } from '../types';

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Split a date range into monthly calendar chunks (<= 31 days each)
 * to comply with Vietnam General Department of Taxation (GDT) single-query limits.
 * Uses integer string parsing to avoid any UTC/local timezone shifts.
 */
export function generateMonthChunks(fromDateStr: string, toDateStr: string): MonthSyncChunk[] {
  if (!fromDateStr || !toDateStr) return [];

  const startParts = fromDateStr.split('-').map(Number);
  const endParts = toDateStr.split('-').map(Number);

  if (startParts.length !== 3 || endParts.length !== 3 || startParts.some(isNaN) || endParts.some(isNaN)) {
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

  const [startY, startM, startD] = startParts;
  const [endY, endM, endD] = endParts;

  // Validate start <= end
  if (startY > endY || (startY === endY && startM > endM) || (startY === endY && startM === endM && startD > endD)) {
    return [];
  }

  const rawChunks: Array<{ from: string; to: string; year: number; month: number }> = [];
  let curY = startY;
  let curM = startM;
  let curD = startD;

  while (curY < endY || (curY === endY && curM <= endM)) {
    const maxDays = getDaysInMonth(curY, curM);
    const chunkStartD = curD;
    let chunkEndD = maxDays;

    if (curY === endY && curM === endM) {
      chunkEndD = Math.min(maxDays, endD);
    }

    const chunkFrom = `${curY}-${pad(curM)}-${pad(chunkStartD)}`;
    const chunkTo = `${curY}-${pad(curM)}-${pad(chunkEndD)}`;

    rawChunks.push({
      from: chunkFrom,
      to: chunkTo,
      year: curY,
      month: curM
    });

    curD = 1;
    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
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
  const startParts = fromDateStr.split('-').map(Number);
  const endParts = toDateStr.split('-').map(Number);
  if (startParts.length !== 3 || endParts.length !== 3 || startParts.some(isNaN) || endParts.some(isNaN)) return false;

  const [startY, startM] = startParts;
  const [endY, endM] = endParts;

  // If different months or years, it spans multiple months
  return startY !== endY || startM !== endM;
}
