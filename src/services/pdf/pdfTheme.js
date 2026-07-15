'use strict';

/**
 * Colors mirror the CSS custom properties in public/css/style.css
 * exactly, so the PDF report looks like a natural extension of
 * the site rather than a separately-designed document.
 */
const colors = {
  blue900: '#12305C',
  blue700: '#1E5AA8',
  blue100: '#EAF2FC',
  blue50: '#F5F9FE',
  ink: '#16233D',
  inkMuted: '#5B6B82',
  border: '#E2E8F1',
  white: '#FFFFFF',
  success: '#1E8E5A',
  successBg: '#E9F7F0',
  warning: '#B3790F',
  warningBg: '#FBF1E0',
  danger: '#C74B4B',
  dangerBg: '#FBEAEA',
};

/**
 * PDFKit's built-in standard fonts — no external font files to
 * ship or license, keeping this dependency-free per the "no
 * unnecessary dependencies" rule.
 */
const fonts = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
};

const page = {
  size: 'A4',
  margin: 50,
};

/**
 * Badge color per chance bucket — mirrors CHANCE_BUCKET_META in
 * src/utils/constants.js and the .vn-badge-* CSS classes.
 */
const chanceColors = {
  veryHigh: { bg: colors.successBg, fg: colors.success, label: 'Very High' },
  high: { bg: colors.successBg, fg: colors.success, label: 'High' },
  moderate: { bg: colors.warningBg, fg: colors.warning, label: 'Moderate' },
  low: { bg: colors.dangerBg, fg: colors.danger, label: 'Low' },
};

module.exports = { colors, fonts, page, chanceColors };
