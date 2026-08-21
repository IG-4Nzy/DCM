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

export async function exportHtmlToPdfBase64(htmlString: string, filename: string): Promise<string> {
  // Create a temporary hidden container element
  const container = document.createElement('div');
  
  // Set basic styles to ensure proper rendering context
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px'; // Set a standard page width (A4 equivalent)
  
  // Inject the HTML content
  container.innerHTML = htmlString;
  document.body.appendChild(container);

  try {
    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        letterRendering: true,
        windowWidth: 800
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    return await html2pdf().from(container).set(opt).outputPdf('datauristring');
  } finally {
    // Clean up
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
