import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';

applyPlugin(jsPDF);

if (typeof window !== 'undefined') {
  window.html2canvas = html2canvas;
  window.jspdf = { jsPDF };
}

export { html2canvas, jsPDF };
