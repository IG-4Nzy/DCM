import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ChecklistPdfOptions {
  title: string;
  date: string;
  time?: string;
  preparedBy: string;
  status: string;
  department?: string;
  completedBy?: string;
  columns: string[];
  rows: (string | number)[][];
  /** Optional category remarks map */
  categoryRemarks?: Record<string, string>;
  fileName?: string;
  includeDaySummary?: boolean;
}

import { fetchDaySummaryData } from './daySummary';
import dayjs from 'dayjs';

/**
 * Export checklist data as a professionally formatted PDF.
 */
export async function exportChecklistPdf(options: ChecklistPdfOptions) {
  const {
    title,
    date,
    time,
    preparedBy,
    status,
    department,
    completedBy,
    columns,
    rows,
    categoryRemarks,
    fileName,
  } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ─── Header ───
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 14);

  // (Status badge removed as requested)

  // ─── Meta info ───
  let metaY = 28;
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const metaItems: string[] = [];
  metaItems.push(`Date: ${date}`);
  if (time) metaItems.push(`Time: ${time}`);
  metaItems.push(`Prepared By: ${preparedBy}`);
  if (department) metaItems.push(`Department: ${department}`);
  if (completedBy) metaItems.push(`Completed By: ${completedBy}`);

  doc.text(metaItems.join('    |    '), 14, metaY);
  metaY += 4;

  // Thin divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, metaY, pageWidth - 14, metaY);
  metaY += 4;

  // ─── Table ───
  (autoTable as any)(doc, {
    startY: metaY,
    head: [columns],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249], // slate-100
      textColor: [30, 41, 59],    // slate-800
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    styles: {
      overflow: 'linebreak',
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data: any) => {
      // Footer on every page
      const pageCount = doc.getNumberOfPages();
      const currentPage = data.pageNumber;
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${currentPage} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 7,
        { align: 'center' }
      );
      doc.text(
        `Generated: ${new Date().toLocaleString()}`,
        14,
        doc.internal.pageSize.getHeight() - 7
      );
    },
  });

  // ─── Category Remarks (if any) ───
  if (categoryRemarks && Object.keys(categoryRemarks).length > 0) {
    const lastY = (doc as any).lastAutoTable?.finalY || metaY + 10;
    let remarkY = lastY + 8;

    const pageHeight = doc.internal.pageSize.getHeight();
    if (remarkY + 20 > pageHeight) {
      doc.addPage();
      remarkY = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Category Remarks', 14, remarkY);
    remarkY += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    Object.entries(categoryRemarks).forEach(([category, remark]) => {
      if (!remark) return;
      if (remarkY + 10 > pageHeight) {
        doc.addPage();
        remarkY = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`${category}:`, 14, remarkY);
      doc.setFont('helvetica', 'normal');
      const textLines = doc.splitTextToSize(remark, pageWidth - 60 - 14);
      doc.text(textLines, 60, remarkY);
      remarkY += textLines.length * 4 + 3;
    });
  }

  // ─── Day Summary (Observations & Visitors) ───
  if (options.includeDaySummary) {
    const { observations, visitors } = await fetchDaySummaryData(date);
    let summaryY = (doc as any).lastAutoTable?.finalY || 30;

    const pageHeight = doc.internal.pageSize.getHeight();

    if (observations.length > 0) {
      if (summaryY + 20 > pageHeight) {
        doc.addPage();
        summaryY = 20;
      } else {
        summaryY += 10;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Observations', 14, summaryY);
      summaryY += 5;

      const obsRows = observations.map(o => [
        o.observationId,
        o.description,
        o.category,
        o.status,
        o.loggedBy
      ]);

      (autoTable as any)(doc, {
        startY: summaryY,
        head: [['ID', 'Description', 'Category', 'Status', 'Logged By']],
        body: obsRows,
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { overflow: 'linebreak' },
        margin: { left: 14, right: 14 }
      });
      summaryY = (doc as any).lastAutoTable?.finalY || summaryY + 10;
    }

    if (visitors.length > 0) {
      if (summaryY + 20 > pageHeight) {
        doc.addPage();
        summaryY = 20;
      } else {
        summaryY += 10;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Visitor Logs', 14, summaryY);
      summaryY += 5;

      const visRows = visitors.map(v => [
        v.visitorName,
        v.division,
        v.purpose,
        dayjs(v.entryTime).format('HH:mm'),
        v.exitTime ? dayjs(v.exitTime).format('HH:mm') : '-'
      ]);

      (autoTable as any)(doc, {
        startY: summaryY,
        head: [['Visitor Name', 'Division', 'Purpose', 'Entry Time', 'Exit Time']],
        body: visRows,
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { overflow: 'linebreak' },
        margin: { left: 14, right: 14 }
      });
    }
  }

  // ─── Save ───
  const safeName = fileName || `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${date}`;
  doc.save(`${safeName}.pdf`);
}
