import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { CadModel, computeWorldAABB, PartInstance } from '../cad';
import { getColorByCode, getPartById, OrderStatus } from '../ldraw';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface BomItem {
  partId: string;
  name: string;
  colorCode: number;
  colorName: string;
  colorHex: string;
  quantity: number;
  unitWeightGrams: number;
  totalWeightGrams: number;
  statusFlags: OrderStatus[];
}

export interface BomReport {
  modelId: string;
  modelName: string;
  totalParts: number;
  uniqueLots: number;
  totalWeightGrams: number;
  items: BomItem[];
}

export interface InstructionStep {
  stepNumber: number;
  assemblyId: string;
  assemblyName: string;
  newPartInstanceIds: string[];
  calloutParts: Array<{
    partId: string;
    name: string;
    colorCode: number;
    colorName: string;
    colorHex: string;
    quantity: number;
  }>;
  cumulativePartCount: number;
}

export interface PdfExportOptions {
  model: CadModel;
  steps: InstructionStep[];
  bom: BomReport;
  /** Optional high-resolution Three.js offscreen PNG snapshots keyed by step number (0 = cover) */
  stepSnapshots?: Record<number, Uint8Array>;
}

export interface PdfExportResult {
  bytes: Uint8Array;
  pageCount: number;
  stepCount: number;
  sha256: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

function sanitizePdfText(text: string): string {
  return text.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

function projectIso(x: number, y: number, z: number): { u: number; v: number } {
  const cos30 = 0.8660254;
  const sin30 = 0.5;
  return {
    u: (x - z) * cos30,
    v: y + (x + z) * sin30 * 0.62,
  };
}

/**
 * Draws the BlueBrixx-inspired crisp page frame around the A4 landscape sheet.
 */
function drawPageFrame(page: PDFPage, width: number, height: number): void {
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
  // Signature outer frame (Fred warm amber-orange / blue accent like BlueBrixx/Modbrix)
  const border = 7;
  const frameColor = rgb(0.95, 0.63, 0.08);
  page.drawRectangle({ x: 0, y: 0, width, height: border, color: frameColor });
  page.drawRectangle({ x: 0, y: height - border, width, height: border, color: frameColor });
  page.drawRectangle({ x: 0, y: 0, width: border, height, color: frameColor });
  page.drawRectangle({ x: width - border, y: 0, width: border, height, color: frameColor });
}

/**
 * Draws a crisp mini isometric brick icon inside the BlueBrixx light-blue parts callout box.
 */
function drawMiniBrickIcon(
  page: PDFPage,
  cx: number,
  cy: number,
  partId: string,
  colorHex: string,
): void {
  const def = getPartById(partId);
  const studsX = Math.min(def?.studsX ?? 2, 4);
  const heightPlates = def?.heightPlates ?? 3;
  const isTile = def?.category === 'Tile';
  const base = hexToRgb(colorHex);

  const w = 14 + studsX * 6;
  const h = heightPlates <= 1 ? 8 : 16;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;

  const topCol = rgb(Math.min(1, base.r * 1.12), Math.min(1, base.g * 1.12), Math.min(1, base.b * 1.12));
  const frontCol = rgb(base.r * 0.88, base.g * 0.88, base.b * 0.88);
  const outlineCol = rgb(0.15, 0.18, 0.22);

  // Brick body
  page.drawRectangle({
    x: x0,
    y: y0,
    width: w,
    height: h,
    color: frontCol,
    borderColor: outlineCol,
    borderWidth: 0.9,
  });

  // Top bevel strip
  page.drawRectangle({
    x: x0 + 1,
    y: y0 + h - 3.5,
    width: Math.max(2, w - 2),
    height: 3,
    color: topCol,
  });

  // Top studs (unless Tile)
  if (!isTile) {
    const studCount = Math.min(studsX, 4);
    const step = w / (studCount + 0.5);
    for (let i = 0; i < studCount; i++) {
      const sx = x0 + step * (i + 0.4);
      page.drawRectangle({
        x: sx,
        y: y0 + h,
        width: Math.max(3, step * 0.55),
        height: 3.2,
        color: topCol,
        borderColor: outlineCol,
        borderWidth: 0.7,
      });
    }
  }
}

function drawIsometricModel(
  page: PDFPage,
  parts: PartInstance[],
  highlightStep: number | null,
  box: { x: number; y: number; width: number; height: number },
): void {
  if (parts.length === 0) return;

  const enriched = parts.map((p) => {
    const def = getPartById(p.partId);
    const dims = def ? def.dimensionsLdu : ([20, 24, 20] as [number, number, number]);
    const aabb = computeWorldAABB(dims, p.matrix);
    return { p, aabb };
  });

  enriched.sort((a, b) => {
    const depthA = (a.aabb.min[0] + a.aabb.max[0]) / 2 + (a.aabb.min[2] + a.aabb.max[2]) / 2;
    const depthB = (b.aabb.min[0] + b.aabb.max[0]) / 2 + (b.aabb.min[2] + b.aabb.max[2]) / 2;
    if (Math.abs(a.aabb.min[1] - b.aabb.min[1]) > 1) {
      return a.aabb.min[1] - b.aabb.min[1];
    }
    return depthA - depthB;
  });

  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const { aabb } of enriched) {
    const xs = [aabb.min[0], aabb.max[0]];
    const ys = [aabb.min[1], aabb.max[1]];
    const zs = [aabb.min[2], aabb.max[2]];
    for (const x of xs) {
      for (const y of ys) {
        for (const z of zs) {
          const pt = projectIso(x, y, z);
          if (pt.u < minU) minU = pt.u;
          if (pt.u > maxU) maxU = pt.u;
          if (pt.v < minV) minV = pt.v;
          if (pt.v > maxV) maxV = pt.v;
        }
      }
    }
  }

  const spanU = Math.max(1, maxU - minU);
  const spanV = Math.max(1, maxV - minV);
  const pad = 24;
  const scale = Math.min((box.width - pad * 2) / spanU, (box.height - pad * 2) / spanV, 2.5);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const midU = (minU + maxU) / 2;
  const midV = (minV + maxV) / 2;

  const toPage = (x: number, y: number, z: number) => {
    const pt = projectIso(x, y, z);
    return {
      x: cx + (pt.u - midU) * scale,
      y: cy + (pt.v - midV) * scale,
    };
  };

  for (const { p, aabb } of enriched) {
    const color = getColorByCode(p.colorCode);
    const baseRgb = hexToRgb(color.hex);
    const isNew = highlightStep !== null && p.step === highlightStep;

    const p000 = toPage(aabb.min[0], aabb.min[1], aabb.min[2]);
    const p100 = toPage(aabb.max[0], aabb.min[1], aabb.min[2]);
    const p101 = toPage(aabb.max[0], aabb.min[1], aabb.max[2]);
    const p001 = toPage(aabb.min[0], aabb.min[1], aabb.max[2]);
    const p010 = toPage(aabb.min[0], aabb.max[1], aabb.min[2]);
    const p110 = toPage(aabb.max[0], aabb.max[1], aabb.min[2]);
    const p111 = toPage(aabb.max[0], aabb.max[1], aabb.max[2]);
    const p011 = toPage(aabb.min[0], aabb.max[1], aabb.max[2]);

    const borderCol = isNew ? rgb(0.88, 0.11, 0.16) : rgb(0.18, 0.2, 0.24);
    const borderW = isNew ? 1.8 : 0.65;

    const topColor = rgb(
      Math.min(1, baseRgb.r * 1.08),
      Math.min(1, baseRgb.g * 1.08),
      Math.min(1, baseRgb.b * 1.08),
    );
    const sideColor = rgb(baseRgb.r * 0.82, baseRgb.g * 0.82, baseRgb.b * 0.82);

    const minPx = Math.min(p000.x, p100.x, p101.x, p001.x, p010.x, p110.x, p111.x, p011.x);
    const maxPx = Math.max(p000.x, p100.x, p101.x, p001.x, p010.x, p110.x, p111.x, p011.x);
    const minPy = Math.min(p000.y, p100.y, p101.y, p001.y, p010.y, p110.y, p111.y, p011.y);
    const maxPy = Math.max(p000.y, p100.y, p101.y, p001.y, p010.y, p110.y, p111.y, p011.y);

    page.drawRectangle({
      x: minPx,
      y: minPy,
      width: Math.max(2, maxPx - minPx),
      height: Math.max(2, (maxPy - minPy) * 0.65),
      color: sideColor,
      borderColor: borderCol,
      borderWidth: borderW,
    });

    page.drawRectangle({
      x: minPx + (maxPx - minPx) * 0.08,
      y: minPy + (maxPy - minPy) * 0.52,
      width: Math.max(2, (maxPx - minPx) * 0.84),
      height: Math.max(2, (maxPy - minPy) * 0.44),
      color: topColor,
      borderColor: borderCol,
      borderWidth: borderW,
    });

    if (isNew) {
      page.drawRectangle({
        x: minPx - 2.2,
        y: minPy - 2.2,
        width: Math.max(6, maxPx - minPx + 4.4),
        height: Math.max(6, maxPy - minPy + 4.4),
        borderColor: rgb(0.92, 0.1, 0.14),
        borderWidth: 2.0,
      });
    }
  }
}

/**
 * Generates a BlueBrixx-inspired A4 Landscape instruction PDF:
 * - Clean white pages with signature outer frame
 * - Full-size studio cover render
 * - Each step page: large bold step number top-left + horizontal light-blue (#d8eeff)
 *   parts callout box with visual brick icons & quantities + full-width 3D build stage
 *   with crisp red contours around newly added parts
 * - Complete color-coded BOM page at the end
 */
export async function generateInstructionPdf(options: PdfExportOptions): Promise<PdfExportResult> {
  const { model, steps, bom, stepSnapshots } = options;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Bauanleitung: ${model.name}`);
  pdfDoc.setAuthor('Fred, der Klemmbaumeister – Gemini Edition');
  pdfDoc.setCreator('Fred Deterministic CAD-to-PDF Engine (BlueBrixx-Style Layout)');

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 841.89; // A4 Landscape (matching BlueBrixx 842x596 pt)
  const pageHeight = 595.28;
  const totalPages = steps.length + 2;

  // 1. Cover Page (BlueBrixx-Style: full clean white page, large 3D model, crisp title top-right)
  const cover = pdfDoc.addPage([pageWidth, pageHeight]);
  drawPageFrame(cover, pageWidth, pageHeight);

  cover.drawText('FRED - GEMINI EDITION', {
    x: 42,
    y: pageHeight - 54,
    size: 28,
    font: fontBold,
    color: rgb(0.14, 0.25, 0.44),
  });
  cover.drawText(sanitizePdfText(model.name), {
    x: 42,
    y: pageHeight - 86,
    size: 20,
    font: fontBold,
    color: rgb(0.18, 0.2, 0.25),
  });
  cover.drawText(
    sanitizePdfText(
      `${bom.totalParts} Teile  |  ${steps.length} Bauschritte  |  ${bom.totalWeightGrams.toFixed(1)} g  |  20-LDU-Standard`,
    ),
    {
      x: 42,
      y: pageHeight - 108,
      size: 11.5,
      font: fontRegular,
      color: rgb(0.38, 0.42, 0.48),
    },
  );

  const coverBox = { x: 32, y: 34, width: pageWidth - 64, height: pageHeight - 160 };
  if (stepSnapshots?.[0]) {
    const img = await pdfDoc.embedPng(stepSnapshots[0]);
    const dims = img.scaleToFit(coverBox.width, coverBox.height);
    cover.drawImage(img, {
      x: coverBox.x + (coverBox.width - dims.width) / 2,
      y: coverBox.y + (coverBox.height - dims.height) / 2,
      width: dims.width,
      height: dims.height,
    });
  } else {
    drawIsometricModel(cover, model.parts, null, coverBox);
  }

  // 2. Step Pages (BlueBrixx-Style: Bold Step Number top-left + Horizontal Light-Blue Parts Box + Full-Width 3D Stage!)
  for (const step of steps) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    drawPageFrame(page, pageWidth, pageHeight);

    // Big bold step number top-left (like BlueBrixx "1", "5", "19")
    const stepStr = String(step.stepNumber);
    page.drawText(stepStr, {
      x: 28,
      y: pageHeight - 66,
      size: 42,
      font: fontBold,
      color: rgb(0.08, 0.1, 0.14),
    });

    // Horizontal light-blue BlueBrixx parts box directly next to the step number
    const displayedCallouts = step.calloutParts.slice(0, 8);
    const slotW = 82;
    const calloutBoxW = Math.min(pageWidth - 135, Math.max(140, displayedCallouts.length * slotW + 24));
    const calloutBoxH = 82;
    const calloutBoxX = 96;
    const calloutBoxY = pageHeight - 104;

    page.drawRectangle({
      x: calloutBoxX,
      y: calloutBoxY,
      width: calloutBoxW,
      height: calloutBoxH,
      color: rgb(0.84, 0.93, 1.0), // BlueBrixx iconic #d6edff light blue
      borderColor: rgb(0.08, 0.1, 0.14),
      borderWidth: 1.5,
    });

    displayedCallouts.forEach((item, idx) => {
      const slotCenterX = calloutBoxX + 12 + idx * slotW + slotW / 2;
      drawMiniBrickIcon(page, slotCenterX, calloutBoxY + 50, item.partId, item.colorHex);
      page.drawText(sanitizePdfText(`${item.quantity}x`), {
        x: slotCenterX - 24,
        y: calloutBoxY + 12,
        size: 11,
        font: fontBold,
        color: rgb(0.08, 0.1, 0.14),
      });
      page.drawText(sanitizePdfText(item.partId.replace('.dat', '')), {
        x: slotCenterX - 2,
        y: calloutBoxY + 12,
        size: 8,
        font: fontRegular,
        color: rgb(0.28, 0.33, 0.4),
      });
    });

    // Full-width 3D Stage below the parts box (maximum visual clarity!)
    const stageBox = { x: 26, y: 34, width: pageWidth - 52, height: pageHeight - 152 };

    if (stepSnapshots?.[step.stepNumber]) {
      const img = await pdfDoc.embedPng(stepSnapshots[step.stepNumber]);
      const dims = img.scaleToFit(stageBox.width, stageBox.height);
      page.drawImage(img, {
        x: stageBox.x + (stageBox.width - dims.width) / 2,
        y: stageBox.y + (stageBox.height - dims.height) / 2,
        width: dims.width,
        height: dims.height,
      });
    } else {
      const visibleParts = model.parts.filter((p) => p.step <= step.stepNumber);
      drawIsometricModel(page, visibleParts, step.stepNumber, stageBox);
    }

    // Subtle footer with assembly name & page counter
    page.drawText(
      sanitizePdfText(`${model.name}  |  ${step.assemblyName}  |  Neue Teile rot umrandet`),
      {
        x: 26,
        y: 14,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.42, 0.46, 0.52),
      },
    );
    page.drawText(sanitizePdfText(`Seite ${step.stepNumber + 1} / ${totalPages}`), {
      x: pageWidth - 96,
      y: 14,
      size: 8.5,
      font: fontBold,
      color: rgb(0.25, 0.29, 0.35),
    });
  }

  // 3. BOM (Stückliste) Page in matching clean BlueBrixx style
  const bomPage = pdfDoc.addPage([pageWidth, pageHeight]);
  drawPageFrame(bomPage, pageWidth, pageHeight);

  bomPage.drawText(sanitizePdfText(`STUECKLISTE (BOM) - ${model.name}`), {
    x: 30,
    y: pageHeight - 46,
    size: 20,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.24),
  });
  bomPage.drawText(
    sanitizePdfText(
      `Gesamtteile: ${bom.totalParts}  |  Positionen: ${bom.uniqueLots}  |  Gesamtgewicht: ${bom.totalWeightGrams.toFixed(1)} g`,
    ),
    {
      x: 30,
      y: pageHeight - 66,
      size: 10.5,
      font: fontRegular,
      color: rgb(0.35, 0.4, 0.48),
    },
  );

  // Light-blue header strip
  bomPage.drawRectangle({
    x: 28,
    y: pageHeight - 100,
    width: pageWidth - 56,
    height: 22,
    color: rgb(0.84, 0.93, 1.0),
    borderColor: rgb(0.15, 0.2, 0.28),
    borderWidth: 1,
  });
  bomPage.drawText('Teil    Menge   LDraw-ID      Bezeichnung                         Farbe              Bestellstatus', {
    x: 36,
    y: pageHeight - 93,
    size: 9.5,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.24),
  });

  let rowY = pageHeight - 120;
  for (const item of bom.items.slice(0, 20)) {
    drawMiniBrickIcon(bomPage, 46, rowY + 4, item.partId, item.colorHex);
    bomPage.drawText(
      sanitizePdfText(
        `${String(item.quantity).padStart(4, ' ')}x   ${item.partId.padEnd(12, ' ')}  ${item.name.slice(0, 32).padEnd(34, ' ')}  ${item.colorName.slice(0, 16).padEnd(18, ' ')} ${item.statusFlags.join(', ')}`,
      ),
      {
        x: 72,
        y: rowY,
        size: 9,
        font: fontRegular,
        color: rgb(0.16, 0.2, 0.26),
      },
    );
    rowY -= 22;
  }

  bomPage.drawText(sanitizePdfText(`Seite ${totalPages} / ${totalPages}`), {
    x: pageWidth - 96,
    y: 14,
    size: 8.5,
    font: fontBold,
    color: rgb(0.25, 0.29, 0.35),
  });

  const bytes = await pdfDoc.save();
  const sha256 = await sha256Hex(bytes);

  return {
    bytes,
    pageCount: pdfDoc.getPageCount(),
    stepCount: steps.length,
    sha256,
  };
}
