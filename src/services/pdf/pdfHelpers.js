'use strict';

const { colors, fonts, page } = require('./pdfTheme');

/**
 * Content width available for tables/text, accounting for
 * left+right margins.
 */
function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

/**
 * A single, subtle diagonal watermark centered on the page.
 * Drawn first (before content) at low opacity so it never
 * interferes with readability. Restores the cursor position
 * afterward so it never disturbs normal content flow.
 */
function drawWatermark(doc, text) {
  const { width, height } = doc.page;
  const savedX = doc.x;
  const savedY = doc.y;

  doc.save();
  doc.rotate(-45, { origin: [width / 2, height / 2] });
  doc.fillOpacity(0.06);
  doc.fillColor(colors.blue700);
  doc.font(fonts.bold).fontSize(72);
  // No `width`/`align` options here — those route through PDFKit's
  // LineWrapper, which does page-overflow bookkeeping that doesn't
  // account for the rotated coordinate system and causes infinite
  // addPage->pageAdded->addPage recursion. Centering computed
  // manually instead, using the simple positioned-text path.
  const textWidth = doc.widthOfString(text);
  doc.text(text, (width - textWidth) / 2, height / 2 - 36, { lineBreak: false });
  doc.restore();

  doc.fillOpacity(1);
  doc.x = savedX;
  doc.y = savedY;
}

/**
 * Footer line at the bottom of every page: brand + site URL on
 * the left, page number on the right. Restores cursor position
 * afterward for the same reason as the watermark.
 */
function drawFooter(doc, { brandName, siteUrl, pageNumber }) {
  const savedX = doc.x;
  const savedY = doc.y;

  const y = doc.page.height - doc.page.margins.bottom + 15;
  doc.fillOpacity(1);
  doc.font(fonts.regular).fontSize(8).fillColor(colors.inkMuted);
  doc.text(`${brandName} \u00b7 ${siteUrl}`, doc.page.margins.left, y, { lineBreak: false });

  // Right-aligned page number — computed manually (no width/align
  // options) for the same reason as the watermark above: this y is
  // below the bottom margin, and PDFKit's width/align text path
  // triggers page-overflow bookkeeping there, causing infinite
  // recursion via the 'pageAdded' event.
  const pageLabel = `Page ${pageNumber}`;
  const labelWidth = doc.widthOfString(pageLabel);
  doc.text(pageLabel, doc.page.width - doc.page.margins.right - labelWidth, y, { lineBreak: false });

  doc.x = savedX;
  doc.y = savedY;
}

/**
 * Ensures there's enough vertical room left on the page for the
 * next block of content; starts a new page if not. Callers use
 * this before drawing a heading or the next table row so nothing
 * gets awkwardly split right at a page edge.
 */
function ensureSpace(doc, neededHeight) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) {
    doc.addPage();
  }
}

/**
 * A colored section heading — a small colored square plus bold
 * label — used for chance-bucket headings ("Very High Chance
 * Colleges") so the color coding from the website carries over
 * without needing per-row colored badges in the table below.
 */
function drawSectionHeading(doc, text, color) {
  ensureSpace(doc, 30);
  const startY = doc.y;
  doc.rect(doc.page.margins.left, startY + 3, 10, 10).fill(color);
  doc.fillColor(colors.ink).font(fonts.bold).fontSize(12);
  doc.text(text, doc.page.margins.left + 18, startY, { continued: false });
  doc.moveDown(0.6);
}

/**
 * A larger page/document title.
 */
function drawTitle(doc, text) {
  doc.fillColor(colors.blue900).font(fonts.bold).fontSize(18);
  doc.text(text, doc.page.margins.left, doc.y);
  doc.moveDown(0.4);
}

function drawEyebrow(doc, text) {
  doc.fillColor(colors.blue700).font(fonts.bold).fontSize(9);
  doc.text(text.toUpperCase(), doc.page.margins.left, doc.y, { characterSpacing: 0.5 });
  doc.moveDown(0.2);
}

/**
 * A simple paginated table. Redraws the header row automatically
 * whenever it needs to continue onto a new page. `columns` is an
 * array of { label, width, align }. `rows` is an array of arrays
 * of already-formatted strings, matching column order.
 */
function drawTable(doc, { columns, rows }) {
  const rowHeight = 22;
  const headerHeight = 24;

  function drawHeader() {
    const startY = doc.y;
    doc.rect(doc.page.margins.left, startY, contentWidth(doc), headerHeight).fill(colors.blue700);
    let x = doc.page.margins.left;
    doc.font(fonts.bold).fontSize(9).fillColor(colors.white);
    for (const col of columns) {
      doc.text(col.label, x + 6, startY + 7, {
        width: col.width - 12,
        align: col.align || 'left',
        lineBreak: false,
      });
      x += col.width;
    }
    doc.y = startY + headerHeight;
  }

  ensureSpace(doc, headerHeight + rowHeight);
  drawHeader();

  rows.forEach((row, index) => {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }

    const startY = doc.y;
    if (index % 2 === 1) {
      doc.rect(doc.page.margins.left, startY, contentWidth(doc), rowHeight).fill(colors.blue50);
    }

    let x = doc.page.margins.left;
    doc.font(fonts.regular).fontSize(9).fillColor(colors.ink);
    row.forEach((cell, colIndex) => {
      const col = columns[colIndex];
      doc.text(String(cell), x + 6, startY + 6, {
        width: col.width - 12,
        align: col.align || 'left',
        lineBreak: false,
      });
      x += col.width;
    });
    doc.y = startY + rowHeight;
  });

  doc.moveDown(0.5);
}

module.exports = {
  contentWidth,
  drawWatermark,
  drawFooter,
  ensureSpace,
  drawSectionHeading,
  drawTitle,
  drawEyebrow,
  drawTable,
};
