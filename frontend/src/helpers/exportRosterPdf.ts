// @ts-nocheck
import html2pdf from 'html2pdf.js';

interface RosterPdfOptions {
  element: HTMLElement;
  filename: string;
}

export async function exportRosterPdf(options: RosterPdfOptions): Promise<string> {
  const { element, filename } = options;

  const opt = {
    margin:       [5, 5, 5, 5],
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { 
      scale: 2, 
      useCORS: true, 
      logging: false,
      letterRendering: true,
      windowWidth: element.scrollWidth
    },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  return await html2pdf().from(element).set(opt).outputPdf('datauristring');
}
