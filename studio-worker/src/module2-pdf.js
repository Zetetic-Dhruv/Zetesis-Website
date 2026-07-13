export function buildRecommendationPdfBytes(document = {}) {
  const report = document && typeof document === 'object' ? document : {};
  const pages = [];
  const left = 58;
  const right = 554;
  const width = right - left;
  const bottom = 66;
  let y = 712;

  const commands = () => pages[pages.length - 1].commands;
  const drawText = (text, x, baseline, font, size, color = '0.08 0.08 0.08') => {
    commands().push(`q ${color} rg BT /${font} ${size} Tf ${x} ${baseline} Td (${escapePdf(text)}) Tj ET Q`);
  };
  const drawRect = (x, baseline, w, h, color) => {
    commands().push(`q ${color} rg ${x} ${baseline} ${w} ${h} re f Q`);
  };
  const addPage = (continued = false) => {
    pages.push({ commands: [] });
    y = 712;
    if (continued) {
      drawText(pdfSafe(report.title || 'Bethany House Recommendation Brief'), left, 746, 'F2', 8, '0.38 0.38 0.38');
      drawText('ZETESIS LABS', 484, 746, 'F2', 7.2, '0.42 0.42 0.42');
      y = 704;
    }
  };
  const ensure = (height) => {
    if (!pages.length) addPage(false);
    if (y - height < bottom) addPage(true);
  };
  const linesFor = (text, size = 10, indent = 0, font = 'F1') => wrapPdfText(pdfSafe(text), width - indent, size, font);
  const addText = (text, options = {}) => {
    if (!meaningful(text)) return;
    const font = options.font || (options.bold ? 'F2' : 'F1');
    const size = options.size || 9.6;
    const leading = options.leading || size * 1.34;
    const indent = options.indent || 0;
    const lines = linesFor(text, size, indent, font);
    const before = options.before || 0;
    const after = options.after || 0;
    ensure(before + lines.length * leading + after);
    y -= before;
    for (const line of lines) {
      drawText(line, left + indent, y, font, size, options.color || '0.08 0.08 0.08');
      y -= leading;
    }
    y -= after;
  };
  const addSection = (title) => {
    ensure(36);
    addText(String(title || '').toUpperCase(), { bold: true, size: 8.2, leading: 10.5, color: '0.36 0.36 0.36', before: 18, after: 8 });
  };
  const addLabelValue = (label, value, options = {}) => {
    if (!meaningful(value)) return;
    ensure(34);
    addText(label, { bold: true, size: 8.1, leading: 10.2, color: '0.31 0.31 0.31', before: options.before ?? 5, after: 1, indent: options.indent || 0 });
    addText(value, { font: options.font || 'F1', size: options.size || 9.4, leading: options.leading || 12.4, indent: options.indent || 0, after: options.after ?? 2 });
  };
  const addCallout = (label, heading, body) => {
    const labelLines = linesFor(label, 7.8, 18, 'F2');
    const headingLines = linesFor(heading, 15, 18, 'F4');
    const bodyLines = linesFor(body, 10, 18, 'F3');
    const height = 22 + labelLines.length * 10 + headingLines.length * 19 + bodyLines.length * 13.5 + 14;
    ensure(height + 8);
    y -= 8;
    drawRect(left, y - height + 10, width, height, '0.955 0.958 0.948');
    commands().push(`q 0.12 0.26 0.31 rg ${left} ${y - height + 10} 4 ${height} re f Q`);
    y -= 15;
    for (const line of labelLines) {
      drawText(line, left + 18, y, 'F2', 7.8, '0.36 0.36 0.36');
      y -= 10;
    }
    y -= 6;
    for (const line of headingLines) {
      drawText(line, left + 18, y, 'F4', 15, '0.07 0.13 0.15');
      y -= 19;
    }
    y -= 3;
    for (const line of bodyLines) {
      drawText(line, left + 18, y, 'F3', 10, '0.13 0.17 0.18');
      y -= 13.5;
    }
    y -= 12;
  };
  const addBullet = (text, options = {}) => {
    const lineText = pdfSafe(text);
    if (!lineText) return;
    const indent = options.indent || 16;
    ensure(26);
    addText(`- ${lineText}`, { size: options.size || 9.2, leading: options.leading || 12.2, indent, before: options.before || 2, after: options.after || 1, color: options.color || '0.12 0.12 0.12' });
  };

  addPage(false);
  drawText('ZETESIS LABS', left, 744, 'F2', 7.5, '0.40 0.40 0.40');
  drawText('Decision Engineering', 470, 744, 'F1', 7.5, '0.40 0.40 0.40');
  y = 690;
  addText(report.title || 'Bethany House Recommendation Brief', { font: 'F4', size: 22, leading: 27, after: 3 });
  addText(report.subtitle, { font: 'F3', size: 11, leading: 14, color: '0.20 0.20 0.20', after: 5 });
  addText([report.client, report.preparedFor].filter(Boolean).join(' | '), { size: 8.4, leading: 11, color: '0.38 0.38 0.38', after: 11 });
  addText(report.executiveFraming, { font: 'F3', size: 10.6, leading: 14.2, after: 7 });

  addSection('Decision frame');
  addText(report.decisionFrame, { font: 'F3', size: 11.2, leading: 15, after: 3 });

  const recommendation = report.recommendation || {};
  addCallout('RECOMMENDATION', recommendation.name || '', recommendation.summary || recommendation.description || '');
  addLabelValue('What this changes', recommendation.description, { size: 9.8, leading: 13 });
  addLabelValue('Why this recommendation currently leads', recommendation.rationale, { size: 9.8, leading: 13 });
  addLabelValue('Current decision position', report.currentPositionStatement, { font: 'F3', size: 9.8, leading: 13, after: 4 });

  addSection('Candidate field');
  for (const candidate of report.candidates || []) {
    ensure(94);
    addText(`${candidate.position}. ${candidate.name}`, { font: 'F4', size: 12.2, leading: 15.8, before: 13, after: 2 });
    addText(candidate.status, { bold: true, size: 7.7, leading: 9.8, color: candidate.status === 'Recommended' ? '0.12 0.34 0.24' : '0.42 0.42 0.42', after: 4 });
    addText(candidate.description, { size: 9.5, leading: 12.7, after: 2 });
    addLabelValue('Case for keeping it live', candidate.rationale, { indent: 12 });
    addLabelValue('Position in the comparison', candidate.comparisonReason, { indent: 12 });
    addLabelValue('What makes it distinct', candidate.distinction, { indent: 12 });
    if ((candidate.supportingEvidence || []).length) {
      ensure(64);
      addText('Supporting evidence', { bold: true, size: 8.2, leading: 10.5, color: '0.31 0.31 0.31', before: 7, after: 2, indent: 12 });
      for (const item of candidate.supportingEvidence) addBullet(`${item.text} [${item.basis}]`, { indent: 20 });
    }
    if ((candidate.evidenceAgainst || []).length) {
      ensure(64);
      addText('Evidence against', { bold: true, size: 8.2, leading: 10.5, color: '0.31 0.31 0.31', before: 7, after: 2, indent: 12 });
      for (const item of candidate.evidenceAgainst) addBullet(`${item.text} [${item.severity}; ${item.basis}]`, { indent: 20 });
    }
    if ((candidate.tripwires || []).length) {
      ensure(64);
      addText('Tripwires', { bold: true, size: 8.2, leading: 10.5, color: '0.31 0.31 0.31', before: 7, after: 2, indent: 12 });
      for (const item of candidate.tripwires) addBullet(`${item.text} [${item.consequence}; ${item.testStatus}]`, { indent: 20 });
    }
    if ((candidate.decisionCriteria || []).length) {
      ensure(80);
      addText('Decision criteria', { bold: true, size: 8.2, leading: 10.5, color: '0.31 0.31 0.31', before: 7, after: 2, indent: 12 });
      for (const item of candidate.decisionCriteria) {
        addBullet(`${item.criterion}: ${item.assessment}`, { indent: 20, after: 0 });
        addText(item.reason, { size: 8.8, leading: 11.6, indent: 28, after: 2, color: '0.22 0.22 0.22' });
      }
    }
  }

  ensure(300);
  addSection('Decision commitments');
  addLabelValue('Who absorbs the loss if this fails', report.lossBearer);
  addLabelValue('Where accountability sits', report.accountabilityLocation);
  addLabelValue('Reversibility', report.reversibility);
  addLabelValue('What makes it so', report.reversibilityNote);

  if ((report.heldConstants || []).length) {
    addSection('Held constant for this recommendation');
    for (const item of report.heldConstants) addBullet(item, { indent: 12 });
  }

  if (meaningful(report.closingNote)) {
    addSection('When to reopen the decision');
    addText(report.closingNote, { font: 'F3', size: 10.2, leading: 13.8, after: 3 });
  }

  return assemblePdf(pages, report.title || 'Bethany House Recommendation Brief');
}

function assemblePdf(pages, title) {
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };
  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesId = addObject('');
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const serifFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');
  const serifBoldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>');
  const pageIds = [];
  pages.forEach((page, index) => {
    const footer = [
      `q 0.42 0.42 0.42 rg BT /F1 7.2 Tf 58 34 Td (${escapePdf(pdfSafe(title))}) Tj ET Q`,
      `q 0.42 0.42 0.42 rg BT /F1 7.2 Tf 510 34 Td (${index + 1} / ${pages.length}) Tj ET Q`,
    ];
    const stream = [...page.commands, ...footer].join('\n');
    const contentId = addObject(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R /F3 ${serifFontId} 0 R /F4 ${serifBoldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function wrapPdfText(text, maxWidth, size, font) {
  const value = pdfSafe(text);
  if (!value) return [];
  const averageWidth = size * (font === 'F3' || font === 'F4' ? 0.48 : 0.52);
  const maxChars = Math.max(18, Math.floor(maxWidth / averageWidth));
  const lines = [];
  for (const paragraph of value.split(/\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      if (word.length > maxChars) {
        if (line) lines.push(line);
        for (let index = 0; index < word.length; index += maxChars) lines.push(word.slice(index, index + maxChars));
        line = '';
        continue;
      }
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [' '];
}

export function pdfSafe(value) {
  return String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u25cf\u25aa]/g, '-')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function escapePdf(value) {
  return pdfSafe(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

function meaningful(value) {
  return Boolean(String(value ?? '').trim());
}
