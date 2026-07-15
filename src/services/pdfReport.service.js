'use strict';

const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const predictionResultService = require('./predictionResult.service');
const predictionService = require('./prediction.service');
const userService = require('./user.service');
const examTypeRepository = require('../repositories/examType.repository');
const env = require('../config/env');
const { generateRoundCodes } = require('../utils/constants');
const { colors, fonts, page, chanceColors } = require('./pdf/pdfTheme');
const {
  contentWidth,
  drawWatermark,
  drawFooter,
  ensureSpace,
  drawSectionHeading,
  drawTitle,
  drawEyebrow,
  drawTable,
} = require('./pdf/pdfHelpers');

// Keeps the report a bounded, printable length even when a
// student's percentile puts most colleges in one bucket — the
// full list is always available on the website; the PDF is a
// portable summary, not a re-print of the entire dataset.
const MAX_ROWS_PER_BUCKET = 15;
const MAX_PREFERENCE_ROWS = 30;

const CHANCE_BUCKET_KEYS = ['veryHigh', 'high', 'moderate', 'low'];

function formatDifference(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function drawCoverPage(doc, { user, prediction, predictionDetails, qrBuffer, examName }) {
  // Logo — real aspect ratio (674x221, ~3.05:1) preserved by
  // specifying only width; PDFKit scales height proportionally
  // when just one dimension is given.
  const logoPath = path.join(__dirname, '../../public/images/logo.png');
  const logoWidth = 130;
  doc.image(logoPath, doc.page.margins.left, doc.page.margins.top, { width: logoWidth });

  doc.fillColor(colors.ink).font(fonts.bold).fontSize(13);
  doc.text('MCA | MBA College Predictor', doc.page.margins.left, doc.page.margins.top + 48);
  doc.fillColor(colors.inkMuted).font(fonts.regular).fontSize(9);
  doc.text('By VidyaNITI Education', doc.page.margins.left, doc.y + 1);
  doc.moveDown(0.6);

  drawEyebrow(doc, `${examName} CAP Admissions`);
  drawTitle(doc, 'Your Prediction Report');
  doc.fillColor(colors.inkMuted).font(fonts.regular).fontSize(10);
  doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, doc.page.margins.left, doc.y);
  doc.moveDown(1.2);

  // QR code, top-right of the cover page.
  const qrSize = 90;
  doc.image(qrBuffer, doc.page.width - doc.page.margins.right - qrSize, doc.page.margins.top, {
    width: qrSize,
    height: qrSize,
  });
  doc.fontSize(8).fillColor(colors.inkMuted);
  doc.text(env.appBaseUrl, doc.page.width - doc.page.margins.right - qrSize, doc.page.margins.top + qrSize + 4, {
    width: qrSize,
    align: 'center',
  });

  const summaryY = doc.page.margins.top + 90;
  doc.y = Math.max(doc.y, summaryY);
  doc.moveDown(0.5);

  drawSectionHeading(doc, 'Candidate Summary', colors.blue700);

  const rows = [
    ['Name', user.name],
    ['Mobile', user.mobile],
    ['Email', user.email],
    [`${examName} Percentile`, String(prediction.percentile)],
    ['Category', predictionDetails.categoryName || '\u2014'],
    ['Gender', prediction.gender],
    ['Home University', predictionDetails.homeUniversityName || '\u2014'],
    ['Admission University', predictionDetails.admissionUniversityName || '\u2014'],
    ['Dream College', predictionDetails.dreamCollegeName || 'Not specified'],
  ];

  const flags = [];
  if (prediction.is_tfws) flags.push('TFWS');
  if (prediction.is_ews) flags.push('EWS');
  if (prediction.is_minority) flags.push('Minority');
  if (prediction.is_defence) flags.push('Defence');
  if (prediction.is_pwd) flags.push('PwD');
  rows.push(['Reservations', flags.length ? flags.join(', ') : 'None']);

  doc.font(fonts.regular).fontSize(10);
  for (const [label, value] of rows) {
    ensureSpace(doc, 20);
    const startY = doc.y;
    doc.fillColor(colors.inkMuted).text(label, doc.page.margins.left, startY, { width: 160 });
    doc.fillColor(colors.ink).text(value, doc.page.margins.left + 170, startY, {
      width: contentWidth(doc) - 170,
    });
    doc.y = startY + 18;
  }

  doc.moveDown(1);
  ensureSpace(doc, 60);
  doc.rect(doc.page.margins.left, doc.y, contentWidth(doc), 50).fill(colors.blue50);
  doc.fillColor(colors.inkMuted).font(fonts.regular).fontSize(8);
  doc.text(
    'Predictions are estimates based on previous years\u2019 CAP cutoff trends and are not guarantees of admission. ' +
      'Always refer to the official DTE Maharashtra CAP process for final decisions.',
    doc.page.margins.left + 10,
    doc.y + 10,
    { width: contentWidth(doc) - 20 }
  );
  doc.y += 50;
}

function drawPendingNotice(doc, snapshot) {
  drawSectionHeading(doc, 'Result Status', colors.blue700);
  doc.font(fonts.regular).fontSize(10).fillColor(colors.ink);
  doc.text(
    (snapshot && snapshot.note) ||
      'Official CAP cutoff data has not been loaded yet. Please check the website again soon \u2014 ' +
        'your details are already saved and results will appear automatically once data is available.',
    doc.page.margins.left,
    doc.y,
    { width: contentWidth(doc) }
  );
}

function drawPreferenceOrderSection(doc, recommendedPreferenceOrder) {
  drawEyebrow(doc, 'Use This For Your CAP Option Form');
  drawTitle(doc, 'Recommended Preference Order');

  if (!recommendedPreferenceOrder.length) {
    doc.font(fonts.regular).fontSize(10).fillColor(colors.inkMuted);
    doc.text('Not enough data yet to recommend a preference order.', doc.page.margins.left, doc.y);
    return;
  }

  const columns = [
    { label: '#', width: 30, align: 'left' },
    { label: 'College', width: 220, align: 'left' },
    { label: 'Basis', width: 130, align: 'left' },
    { label: 'Round 1 Chance', width: 115, align: 'left' },
  ];

  const truncated = recommendedPreferenceOrder.slice(0, MAX_PREFERENCE_ROWS);
  const rows = truncated.map((item) => [
    item.rank,
    item.collegeName,
    item.basis === 'dream_college' ? 'Dream College' : 'Best available chance',
    item.round1Chance ? chanceColors[item.round1Chance].label : '\u2014',
  ]);

  drawTable(doc, { columns, rows });

  if (recommendedPreferenceOrder.length > MAX_PREFERENCE_ROWS) {
    doc.font(fonts.regular).fontSize(9).fillColor(colors.inkMuted);
    doc.text(
      `+ ${recommendedPreferenceOrder.length - MAX_PREFERENCE_ROWS} more colleges \u2014 view your full list online at ${env.appBaseUrl}`,
      doc.page.margins.left,
      doc.y
    );
  }
}

function drawRoundSection(doc, roundCode, roundIndex, snapshot) {
  drawEyebrow(doc, `CAP Round ${roundIndex + 1}`);
  drawTitle(doc, `Round ${roundIndex + 1} Results`);

  const dreamCollege = snapshot.dreamCollege;
  if (dreamCollege) {
    const roundInfo = dreamCollege.rounds[roundCode];
    doc.font(fonts.bold).fontSize(10).fillColor(colors.ink);
    doc.text(`Dream College: ${dreamCollege.collegeName}`, doc.page.margins.left, doc.y);
    doc.font(fonts.regular).fontSize(9).fillColor(colors.inkMuted);
    if (roundInfo) {
      doc.text(
        `Chance: ${chanceColors[roundInfo.chance].label}  \u00b7  Previous Cutoff: ${roundInfo.cutoffPercentile}  \u00b7  Difference: ${formatDifference(roundInfo.difference)}`,
        doc.page.margins.left,
        doc.y
      );
    } else {
      doc.text('No cutoff data available for this round.', doc.page.margins.left, doc.y);
    }
    doc.moveDown(1);
  }

  const roundData = snapshot.rounds[roundCode];

  for (const bucketKey of CHANCE_BUCKET_KEYS) {
    const meta = chanceColors[bucketKey];
    const list = roundData[bucketKey];

    drawSectionHeading(doc, `${meta.label} Chance Colleges (${list.length})`, meta.fg);

    if (list.length === 0) {
      doc.font(fonts.regular).fontSize(9).fillColor(colors.inkMuted);
      doc.text('No colleges in this band for this round.', doc.page.margins.left, doc.y);
      doc.moveDown(0.8);
      continue;
    }

    const columns = [
      { label: 'College', width: 210, align: 'left' },
      { label: 'City', width: 100, align: 'left' },
      { label: 'Previous Cutoff', width: 100, align: 'left' },
      { label: 'Difference', width: 85, align: 'left' },
    ];

    const truncated = list.slice(0, MAX_ROWS_PER_BUCKET);
    const rows = truncated.map((entry) => [
      entry.collegeName,
      entry.city || '\u2014',
      entry.cutoffPercentile,
      formatDifference(entry.difference),
    ]);

    drawTable(doc, { columns, rows });

    if (list.length > MAX_ROWS_PER_BUCKET) {
      doc.font(fonts.regular).fontSize(9).fillColor(colors.inkMuted);
      doc.text(
        `+ ${list.length - MAX_ROWS_PER_BUCKET} more \u2014 view the full list online at ${env.appBaseUrl}`,
        doc.page.margins.left,
        doc.y
      );
      doc.moveDown(0.5);
    }
  }
}

/**
 * Generates the full PDF report for a prediction and returns it
 * as a Buffer. Returns null if the prediction doesn't exist.
 * Generated fresh on every call — no caching/storage, per
 * product decision (simplicity over the marginal speed gain of
 * caching, given reports are cheap to regenerate).
 */
async function generateReportBuffer(predictionId) {
  const resultView = await predictionResultService.buildResultView(predictionId);
  if (!resultView) {
    return null;
  }

  const [predictionDetails, user, examType, qrBuffer] = await Promise.all([
    predictionService.getPredictionWithDetails(predictionId),
    userService.findUserById(resultView.prediction.user_id),
    examTypeRepository.findById(resultView.prediction.exam_type_id),
    QRCode.toBuffer(env.appBaseUrl, {
      width: 200,
      margin: 1,
      color: { dark: colors.blue900, light: '#FFFFFF' },
    }),
  ]);

  const doc = new PDFDocument({ size: page.size, margin: page.margin, bufferPages: true });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  let pageNumber = 1;
  const decoratePage = () => {
    drawWatermark(doc, env.pdf.watermarkText);
    drawFooter(doc, { brandName: env.pdf.brandName, siteUrl: env.appBaseUrl, pageNumber });
  };
  decoratePage(); // first page — 'pageAdded' doesn't fire for it
  doc.on('pageAdded', () => {
    pageNumber += 1;
    decoratePage();
  });

  drawCoverPage(doc, {
    user,
    prediction: resultView.prediction,
    predictionDetails,
    qrBuffer,
    examName: examType ? examType.name : 'MCA CET',
  });

  const snapshot = resultView.snapshot;
  if (snapshot && snapshot.totalCollegesEvaluated > 0) {
    doc.addPage();
    drawPreferenceOrderSection(doc, snapshot.recommendedPreferenceOrder);

    // Round codes come from the snapshot itself (set by the
    // engine at computation time) rather than a hardcoded
    // constant — could be 4 rounds (MCA CET), 3 (MBA CET), etc.
    // Predictions computed before this field existed fall back
    // to 4, matching what the engine always produced at the time.
    const roundCodes = snapshot.roundCodes || generateRoundCodes(4);

    roundCodes.forEach((roundCode, roundIndex) => {
      doc.addPage();
      drawRoundSection(doc, roundCode, roundIndex, snapshot);
    });
  } else {
    doc.addPage();
    drawPendingNotice(doc, snapshot);
  }

  doc.end();
  return finished;
}

module.exports = { generateReportBuffer };
