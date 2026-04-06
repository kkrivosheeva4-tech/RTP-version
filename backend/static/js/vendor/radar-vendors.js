const html2canvas =
  typeof window !== 'undefined' && typeof window.html2canvas === 'function'
    ? window.html2canvas
    : null;
const jsPDF =
  typeof window !== 'undefined' &&
  window.jspdf &&
  typeof window.jspdf.jsPDF === 'function'
    ? window.jspdf.jsPDF
    : null;

if (typeof window !== 'undefined') {
  if (html2canvas) {
    window.html2canvas = html2canvas;
  }
  if (jsPDF) {
    window.jspdf = { ...(window.jspdf || {}), jsPDF };
  }
}

export { html2canvas, jsPDF };
