import {jsPDF} from 'jspdf';
import type {Movement} from '../db';

type InventoryMovementType = 'MASUK' | 'KELUAR';

const formatDate = (value: string) => new Date(value).toLocaleString('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Builds a printable inventory movement report without touching transaction data. */
export function buildInventoryMovementPDF(
  movements: Movement[],
  type: InventoryMovementType,
  period: {from: string; to: string},
  money: (value: number) => string,
): jsPDF {
  const isIncoming = type === 'MASUK';
  const title = isIncoming ? 'LAPORAN BARANG MASUK' : 'LAPORAN BARANG KELUAR';
  const doc = new jsPDF({unit: 'mm', format: 'a4'});
  const left = 14;
  const right = 196;
  let y = 16;
  const totalQty = movements.reduce((sum, item) => sum + Math.abs(item.qty), 0);
  const grandTotal = movements.reduce((sum, item) => sum + Math.abs(item.qty) * item.unitCost, 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(24, 83, 58);
  doc.text('APOTEK NAUFAL FARMA', left, y);
  y += 7;
  doc.setFontSize(11);
  doc.text(title, left, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(65, 83, 72);
  doc.text('Periode: ' + (period.from || 'Awal') + ' s.d. ' + (period.to || 'Hari ini'), left, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Jumlah catatan: ' + movements.length, left, y);
  y += 5;
  doc.text('Total qty: ' + totalQty, left, y);
  y += 5;
  doc.text('Total nilai harga beli: ' + money(grandTotal), left, y);
  y += 8;

  const drawHeader = () => {
    doc.setFillColor(222, 239, 228);
    doc.setDrawColor(183, 211, 190);
    doc.roundedRect(left, y, 182, 8, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(32, 91, 62);
    doc.text('Nama barang', left + 2, y + 5);
    doc.text('Qty', left + 116, y + 5, {align: 'right'});
    doc.text('Harga beli', right - 38, y + 5, {align: 'right'});
    doc.text('Total', right - 2, y + 5, {align: 'right'});
    y += 11;
  };

  drawHeader();
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(54, 68, 59);
  for (const movement of movements) {
    const nameLines = doc.splitTextToSize(movement.name || movement.code, 94);
    const rowHeight = Math.max(7, nameLines.length * 4);
    if (y + rowHeight > 276) {
      doc.addPage();
      y = 16;
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(54, 68, 59);
    }
    const qty = Math.abs(movement.qty);
    const lineTotal = qty * movement.unitCost;
    doc.setFontSize(7.5);
    doc.text(nameLines, left + 2, y);
    doc.text(String(qty), left + 116, y, {align: 'right'});
    doc.text(money(movement.unitCost), right - 38, y, {align: 'right'});
    doc.text(money(lineTotal), right - 2, y, {align: 'right'});
    y += rowHeight + 2;
    doc.setDrawColor(222, 232, 224);
    doc.line(left, y - 1, right, y - 1);
  }

  if (y + 12 > 280) {
    doc.addPage();
    y = 18;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(24, 83, 58);
  doc.text('TOTAL KESELURUHAN', left, y + 5);
  doc.text(money(grandTotal), right - 2, y + 5, {align: 'right'});
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(105, 120, 109);
  doc.text('Dicetak: ' + formatDate(new Date().toISOString()), left, 288);

  return doc;
}
