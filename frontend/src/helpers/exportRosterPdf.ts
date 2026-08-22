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
  // Create a temporary same-origin iframe for rendering isolation
  const iframe = document.createElement('iframe');
  
  // Style the iframe so it's in-viewport (enabling paint) but hidden from the user
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '800px';
  iframe.style.height = '1200px';
  iframe.style.zIndex = '-9999';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = 'none';
  iframe.style.visibility = 'visible';
  iframe.style.opacity = '1';
  
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      throw new Error("Could not access iframe document context");
    }

    // Write the full HTML document to the iframe
    doc.open();
    doc.write(htmlString);
    doc.close();

    // Force a synchronous layout/reflow pass in the iframe
    const _forceReflow = doc.body.offsetHeight;

    // Wait a brief period to ensure browser layout and painting are complete
    await new Promise((resolve) => setTimeout(resolve, 200));

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

    return await html2pdf().from(doc.body).set(opt).outputPdf('datauristring');
  } finally {
    // Clean up the temporary iframe
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}
