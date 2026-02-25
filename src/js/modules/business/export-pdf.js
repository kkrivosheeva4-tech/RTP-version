// export-pdf.js
// Генерация PDF-отчёта: построение таблицы на canvas, jsPDF, сохранение файла.
// Вынесено из export.js для этапа 3 рефакторинга.

import { EXPORT_COLUMN_ORDER } from './export-fields-config.js';

'use strict';

  const margin = 14; // mm
  const DPI = 150;
  const pxPerMM = DPI / 25.4;

  function getColumnOrder() {
    return EXPORT_COLUMN_ORDER || ['company', 'blocks', 'functions', 'name'];
  }

  function prepareSelectedFieldsList(selectedFields) {
    const columnOrder = getColumnOrder();
    const selectedFieldsKeys = Object.keys(selectedFields).filter(f => selectedFields[f] === true);
    const selectedFieldsList = [];

    columnOrder.forEach(field => {
      if (selectedFieldsKeys.includes(field)) {
        selectedFieldsList.push(field);
      }
    });
    selectedFieldsKeys.forEach(field => {
      if (!columnOrder.includes(field)) {
        selectedFieldsList.push(field);
      }
    });

    if (selectedFieldsList.length === 0) {
      throw new Error('Не выбрано ни одного поля');
    }

    return selectedFieldsList;
  }

  function calculateColumnWidths(selectedFieldsList, previewData, companyFilterForDisplay) {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const tempFontSize = Math.round(12 * pxPerMM / 3.78);
    const tempFont = `${tempFontSize}px Segoe UI, Roboto, Arial, sans-serif`;
    const tempBoldFont = `bold ${tempFontSize}px Segoe UI, Roboto, Arial, sans-serif`;
    tempCtx.font = tempFont;

    return selectedFieldsList.map(field => {
      const label = (typeof window.getFieldLabel === 'function' ? window.getFieldLabel(field) : field);
      tempCtx.font = tempBoldFont;
      const labelWidthPx = tempCtx.measureText(label).width;
      tempCtx.font = tempFont;

      let maxContentWidthPx = labelWidthPx;
      (previewData || []).forEach(tech => {
        const value = typeof window.getFieldValue === 'function'
          ? window.getFieldValue(tech, field, { companyFilter: companyFilterForDisplay })
          : String(tech[field] || '');
        const valueStr = String(value || '');
        const words = valueStr.split(/\s+/);
        let line = '';
        words.forEach(word => {
          const testLine = line ? line + ' ' + word : word;
          const testWidth = tempCtx.measureText(testLine).width;
          if (testWidth > maxContentWidthPx) {
            maxContentWidthPx = testWidth;
          }
          if (testWidth > 200) {
            line = word;
          } else {
            line = testLine;
          }
        });
      });

      const cellPadding = 4;
      const minWidthPx = Math.max(labelWidthPx, maxContentWidthPx) + (cellPadding * 2) + 10;
      const minWidthMm = minWidthPx / pxPerMM;
      return Math.max(minWidthMm, 20);
    });
  }

  function determinePageOrientation(minColWidths, selectedFieldsList) {
    const cellPadding = 4;
    const cellPaddingMm = cellPadding / pxPerMM;
    const totalMinWidth = minColWidths.reduce((sum, w) => sum + w, 0) + (selectedFieldsList.length - 1) * cellPaddingMm;
    const availableWidthPortrait = 210 - (margin * 2);
    return totalMinWidth > availableWidthPortrait ? 'landscape' : 'portrait';
  }

  function mmToPx(mm) {
    return Math.round(mm * pxPerMM);
  }

  function wrapText(ctx, text, maxWidthPx) {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';

    function breakLongWord(word, maxWidth) {
      const result = [];
      let currentPart = '';

      for (let i = 0; i < word.length; i++) {
        const testPart = currentPart + word[i];
        const testWidth = ctx.measureText(testPart + '-').width;

        if (testWidth > maxWidth && currentPart.length > 1) {
          result.push(currentPart + '-');
          currentPart = word[i];
        } else {
          currentPart = testPart;
        }
      }

      if (currentPart) {
        result.push(currentPart);
      }

      return result;
    }

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const test = line ? line + ' ' + word : word;
      const w = ctx.measureText(test).width;

      if (w > maxWidthPx) {
        if (line) {
          lines.push(line);
          line = '';
        }

        const wordWidth = ctx.measureText(word).width;
        if (wordWidth > maxWidthPx) {
          const wordParts = breakLongWord(word, maxWidthPx);
          for (let j = 0; j < wordParts.length; j++) {
            if (j === wordParts.length - 1) {
              line = wordParts[j];
            } else {
              lines.push(wordParts[j]);
            }
          }
        } else {
          line = word;
        }
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /**
   * Генерирует и сохраняет PDF-отчёт.
   * @param {Array} sourceList - отфильтрованный список технологий
   * @param {string} enterpriseName - название предприятия для заголовка
   * @param {object} selectedFields - объект { fieldKey: true/false }
   * @param {Array|null} companyFilterForDisplay - фильтр предприятий для отображения в ячейках
   * @returns {{ enterpriseName: string, fieldsCount: number }}
   */
  async function generatePdf(sourceList, enterpriseName, selectedFields, companyFilterForDisplay) {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
      throw new Error('Библиотека jsPDF не загружена');
    }

    const hasSelectedFields = Object.values(selectedFields).some(v => v === true);
    if (!hasSelectedFields) {
      throw new Error('Выберите хотя бы одно поле для экспорта');
    }

    const selectedFieldsList = prepareSelectedFieldsList(selectedFields);
    const previewData = (sourceList && sourceList.length > 0) ? sourceList.slice(0, 10) : [];
    const minColWidths = calculateColumnWidths(selectedFieldsList, previewData, companyFilterForDisplay);
    const orientation = determinePageOrientation(minColWidths, selectedFieldsList);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const cw = mmToPx(pageWidth);
    const ch = mmToPx(pageHeight);
    const headerFont = `${Math.round(14 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;
    const normalFont = `${Math.round(12 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;
    const smallFont = `${Math.round(11 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;
    const boldFont = `bold ${Math.round(12 * pxPerMM / 3.78)}px Segoe UI, Roboto, Arial, sans-serif`;

    const marginPx = mmToPx(margin);
    const contentW = cw - marginPx * 2;
    const cellPadding = 4;
    const rowSpacing = 2;
    const baseHeaderHeight = 20;

    const nowStr = new Date().toLocaleString('ru-RU');

    async function renderPagesToImages() {
      const images = [];
      let canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      let ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);

      let y = marginPx;

      function newPage() {
        images.push(canvas.toDataURL('image/png'));
        canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const cctx = canvas.getContext('2d');
        cctx.fillStyle = '#ffffff';
        cctx.fillRect(0, 0, cw, ch);
        return cctx;
      }

      function drawHeader(cctx) {
        cctx.fillStyle = '#000';
        cctx.textBaseline = 'top';
        cctx.font = headerFont;
        const title = `Технологический отчёт: ${enterpriseName}`;
        const titleW = cctx.measureText(title).width;
        cctx.fillText(title, Math.round((cw - titleW) / 2), y);
        cctx.font = smallFont;
        cctx.fillText(`Дата формирования отчёта: ${nowStr}`, marginPx, y + Math.round(16 * pxPerMM / 3.78));
        y += Math.round(26 * pxPerMM / 3.78);
      }

      ctx.fillStyle = '#000';
      ctx.textBaseline = 'top';
      drawHeader(ctx);

      if (!sourceList || sourceList.length === 0) {
        ctx.font = normalFont;
        ctx.fillText('На предприятии не зарегистрировано технологий', marginPx, y + 6);
        images.push(canvas.toDataURL('image/png'));
        return images;
      }

      const numCols = selectedFieldsList.length;
      const totalPadding = (numCols - 1) * cellPadding;
      const availableWidthForCols = contentW - totalPadding;

      const minColWidthsPx = minColWidths.map(w => mmToPx(w));
      const totalMinWidthPx = minColWidthsPx.reduce((sum, w) => sum + w, 0);

      let colWidths;
      if (totalMinWidthPx > availableWidthForCols) {
        const scale = availableWidthForCols / totalMinWidthPx;
        colWidths = minColWidthsPx.map(w => Math.max(Math.floor(w * scale), 10));
      } else {
        const scale = availableWidthForCols / totalMinWidthPx;
        colWidths = minColWidthsPx.map(w => Math.floor(w * scale));
        colWidths = colWidths.map((w, idx) => Math.max(w, minColWidthsPx[idx]));
        const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
        if (totalWidth > availableWidthForCols) {
          const correction = availableWidthForCols / totalWidth;
          colWidths = colWidths.map(w => Math.max(Math.floor(w * correction), 10));
        }
      }

      let totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
      if (totalWidth > availableWidthForCols) {
        const finalCorrection = availableWidthForCols / totalWidth;
        colWidths = colWidths.map(w => Math.floor(w * finalCorrection));
      }

      const colWidth = Math.floor(availableWidthForCols / numCols);

      ctx.font = boldFont;
      let maxHeaderLines = 1;
      selectedFieldsList.forEach((field, idx) => {
        const label = typeof window.getFieldLabel === 'function' ? window.getFieldLabel(field) : field;
        const currentColWidth = colWidths[idx] || colWidth;
        const availableWidth = currentColWidth - cellPadding * 2;
        const headerLines = wrapText(ctx, label, availableWidth);
        maxHeaderLines = Math.max(maxHeaderLines, headerLines.length);
      });
      const headerHeight = Math.max(baseHeaderHeight, maxHeaderLines * Math.round(12 * pxPerMM / 3.78) + cellPadding * 2);

      const headerY = y;
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(marginPx, headerY, contentW, headerHeight);
      ctx.fillStyle = '#000';
      ctx.font = boldFont;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      let x = marginPx + cellPadding;
      selectedFieldsList.forEach((field, idx) => {
        const label = typeof window.getFieldLabel === 'function' ? window.getFieldLabel(field) : field;
        const currentColWidth = colWidths[idx] || colWidth;
        const availableWidth = currentColWidth - cellPadding * 2;

        ctx.font = boldFont;
        let headerLines = wrapText(ctx, label, availableWidth);
        const lineHeight = Math.round(12 * pxPerMM / 3.78);

        headerLines = headerLines.map(line => {
          let displayLine = line;
          if (ctx.measureText(displayLine).width > availableWidth) {
            while (displayLine.length > 0 && ctx.measureText(displayLine + '...').width > availableWidth) {
              displayLine = displayLine.slice(0, -1);
            }
            displayLine = displayLine + '...';
          }
          return displayLine;
        });

        const totalHeaderHeight = headerLines.length * lineHeight;
        const startY = headerY + Math.max(0, (headerHeight - totalHeaderHeight) / 2);

        headerLines.forEach((line, lineIdx) => {
          ctx.fillText(line, x, startY + lineIdx * lineHeight);
        });

        x += currentColWidth + cellPadding;
      });

      y += headerHeight + rowSpacing;

      for (let i = 0; i < sourceList.length; i++) {
        const tech = sourceList[i];
        const isEvenRow = i % 2 === 0;

        ctx.font = normalFont;
        let maxLines = 1;
        const cellValues = selectedFieldsList.map((field, idx) => {
          const value = typeof window.getFieldValue === 'function'
            ? window.getFieldValue(tech, field, { companyFilter: companyFilterForDisplay })
            : String(tech[field] || '');
          const currentColWidth = colWidths[idx] || colWidth;
          const lines = wrapText(ctx, value, currentColWidth - cellPadding * 2);
          maxLines = Math.max(maxLines, lines.length);
          return lines;
        });

        const rowHeight = Math.max(headerHeight, maxLines * Math.round(12 * pxPerMM / 3.78) + cellPadding * 2);

        if (y + rowHeight + marginPx > ch - marginPx) {
          const cctx = newPage();
          y = marginPx;
          drawHeader(cctx);
          const newHeaderY = y;
          cctx.fillStyle = '#e0e0e0';
          cctx.fillRect(marginPx, newHeaderY, contentW, headerHeight);
          cctx.fillStyle = '#000';
          cctx.font = boldFont;
          cctx.textBaseline = 'top';
          cctx.textAlign = 'left';
          let newX = marginPx + cellPadding;
          selectedFieldsList.forEach((field, idx) => {
            const label = typeof window.getFieldLabel === 'function' ? window.getFieldLabel(field) : field;
            const currentColWidth = colWidths[idx] || colWidth;
            const availableWidth = currentColWidth - cellPadding * 2;

            cctx.font = boldFont;
            let headerLines = wrapText(cctx, label, availableWidth);
            const lineHeight = Math.round(12 * pxPerMM / 3.78);

            headerLines = headerLines.map(line => {
              let displayLine = line;
              if (cctx.measureText(displayLine).width > availableWidth) {
                while (displayLine.length > 0 && cctx.measureText(displayLine + '...').width > availableWidth) {
                  displayLine = displayLine.slice(0, -1);
                }
                displayLine = displayLine + '...';
              }
              return displayLine;
            });

            const totalHeaderHeight = headerLines.length * lineHeight;
            const startY = newHeaderY + Math.max(0, (headerHeight - totalHeaderHeight) / 2);

            headerLines.forEach((line, lineIdx) => {
              cctx.fillText(line, newX, startY + lineIdx * lineHeight);
            });

            newX += currentColWidth + cellPadding;
          });
          y += headerHeight + rowSpacing;
          ctx = cctx;
        }

        if (isEvenRow) {
          ctx.fillStyle = '#f9f9f9';
          ctx.fillRect(marginPx, y, contentW, rowHeight);
        }

        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 0.5;
        x = marginPx;
        for (let col = 0; col <= numCols; col++) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + rowHeight);
          ctx.stroke();
          if (col < numCols) {
            const currentColWidth = colWidths[col] || colWidth;
            x += currentColWidth + cellPadding;
          }
        }
        ctx.beginPath();
        ctx.moveTo(marginPx, y);
        ctx.lineTo(marginPx + contentW, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(marginPx, y + rowHeight);
        ctx.lineTo(marginPx + contentW, y + rowHeight);
        ctx.stroke();

        ctx.font = normalFont;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        x = marginPx + cellPadding;
        selectedFieldsList.forEach((field, colIdx) => {
          const lines = cellValues[colIdx];
          const isNumeric = typeof window.isNumericField === 'function' ? window.isNumericField(field) : false;
          const currentColWidth = colWidths[colIdx] || colWidth;
          const availableTextWidth = currentColWidth - cellPadding * 2;
          const textX = isNumeric ? x + currentColWidth - cellPadding : x;
          ctx.textAlign = isNumeric ? 'right' : 'left';
          const lineHeight = Math.round(12 * pxPerMM / 3.78);

          ctx.fillStyle = '#000';

          lines.forEach((line, lineIdx) => {
            let displayLine = line;
            if (ctx.measureText(displayLine).width > availableTextWidth) {
              while (displayLine.length > 0 && ctx.measureText(displayLine + '...').width > availableTextWidth) {
                displayLine = displayLine.slice(0, -1);
              }
              displayLine = displayLine + '...';
            }
            ctx.fillText(displayLine, textX, y + cellPadding + lineIdx * lineHeight);
          });

          x += currentColWidth + cellPadding;
          ctx.textAlign = 'left';
        });

        y += rowHeight + rowSpacing;
      }

      images.push(canvas.toDataURL('image/png'));
      return images;
    }

    const imgs = await renderPagesToImages();
    if (!imgs || imgs.length === 0) {
      throw new Error('Не удалось подготовить страницы отчёта');
    }

    for (let i = 0; i < imgs.length; i++) {
      if (i > 0) pdf.addPage();
      pdf.addImage(imgs[i], 'PNG', 0, 0, pageWidth, pageHeight);
    }

    const filename = `Технологический_отчёт_${enterpriseName.replace(/\s+/g, '_')}.pdf`;
    pdf.save(filename);

    const fieldsCount = Object.values(selectedFields).filter(v => v === true).length;
    return { enterpriseName, fieldsCount };
  }

  const ExportPdf = {
    generatePdf,
    prepareSelectedFieldsList,
  };

  if (typeof window !== 'undefined') {
    window.ExportPdf = ExportPdf;
  }

  export default ExportPdf;
  export { generatePdf, prepareSelectedFieldsList };
