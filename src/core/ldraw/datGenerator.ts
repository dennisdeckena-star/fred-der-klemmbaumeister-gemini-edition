import {
  LDU_PER_PLATE,
  LDU_PER_STUD,
  STUD_HEIGHT_LDU,
  STUD_RADIUS_LDU,
} from './types';

function fmt(n: number): string {
  const rounded = Math.abs(n) < 1e-6 ? 0 : Number(n.toFixed(4));
  return String(rounded);
}

function addQuad(
  lines: string[],
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  x3: number, y3: number, z3: number,
  x4: number, y4: number, z4: number,
  color = 16,
): void {
  lines.push(
    `4 ${color} ${fmt(x1)} ${fmt(y1)} ${fmt(z1)} ${fmt(x2)} ${fmt(y2)} ${fmt(z2)} ${fmt(x3)} ${fmt(y3)} ${fmt(z3)} ${fmt(x4)} ${fmt(y4)} ${fmt(z4)}`,
  );
}

function addTri(
  lines: string[],
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  x3: number, y3: number, z3: number,
  color = 16,
): void {
  lines.push(
    `3 ${color} ${fmt(x1)} ${fmt(y1)} ${fmt(z1)} ${fmt(x2)} ${fmt(y2)} ${fmt(z2)} ${fmt(x3)} ${fmt(y3)} ${fmt(z3)}`,
  );
}

function addEdge(
  lines: string[],
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
): void {
  lines.push(`2 24 ${fmt(x1)} ${fmt(y1)} ${fmt(z1)} ${fmt(x2)} ${fmt(y2)} ${fmt(z2)}`);
}

function addCylinderY(
  lines: string[],
  cx: number,
  cz: number,
  yBottom: number,
  yTop: number,
  radius: number,
  segments = 12,
  capTop = true,
  capBottom = false,
): void {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * radius;
    const z0 = cz + Math.sin(a0) * radius;
    const x1 = cx + Math.cos(a1) * radius;
    const z1 = cz + Math.sin(a1) * radius;

    addQuad(lines, x0, yBottom, z0, x1, yBottom, z1, x1, yTop, z1, x0, yTop, z0);
    if (capTop) {
      addTri(lines, cx, yTop, cz, x1, yTop, z1, x0, yTop, z0);
    }
    if (capBottom) {
      addTri(lines, cx, yBottom, cz, x0, yBottom, z0, x1, yBottom, z1);
    }
    addEdge(lines, x0, yTop, z0, x1, yTop, z1);
  }
}

export interface BrickDatOptions {
  partId: string;
  name: string;
  studsX: number;
  studsZ: number;
  heightPlates: number;
  hasTopStuds?: boolean;
  isSlope?: boolean;
  isInvertedSlope?: boolean;
  isCurvedSlope?: boolean;
  isRound?: boolean;
  isMastPole?: boolean;
  isPin?: boolean;
}

/**
 * Generates authentic LDraw `.dat` geometry (LDraw coordinate system:
 * +Y points down in classic LDraw, here normalized consistently with
 * Y=0 at bottom face and Y=+height at top face for deterministic CAD math).
 */
export function generatePartDat(opts: BrickDatOptions): string {
  const lines: string[] = [
    `0 ${opts.name}`,
    `0 Name: ${opts.partId}`,
    `0 Author: Fred LDraw Catalog`,
    `0 !LDRAW_ORG Part UPDATE 2026-01`,
    `0 !LICENSE Redistributable under CCAL version 2.0`,
    `0 BFC CERTIFY CCW`,
  ];

  const width = opts.studsX * LDU_PER_STUD;
  const depth = opts.studsZ * LDU_PER_STUD;
  const height = opts.heightPlates * LDU_PER_PLATE;
  const halfW = width / 2;
  const halfD = depth / 2;
  const tol = 0.2; // realistic 0.2 LDU brick seam tolerance

  if (opts.isPin) {
    // Technic Pin oriented along Z axis (length 40 LDU, radius 4.8 LDU)
    const segs = 12;
    const r = 4.8;
    const halfLen = 20;
    const cy = height / 2;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const x0 = Math.cos(a0) * r;
      const y0 = cy + Math.sin(a0) * r;
      const x1 = Math.cos(a1) * r;
      const y1 = cy + Math.sin(a1) * r;
      addQuad(lines, x0, y0, -halfLen, x1, y1, -halfLen, x1, y1, halfLen, x0, y0, halfLen);
      addTri(lines, 0, cy, halfLen, x0, y0, halfLen, x1, y1, halfLen);
      addTri(lines, 0, cy, -halfLen, x1, y1, -halfLen, x0, y0, -halfLen);
    }
    return lines.join('\n') + '\n';
  }

  if (opts.isMastPole) {
    // Slender ocean-liner mast pole: 1x1 base plate + thin 3.8 LDU radius tapered shaft
    addCylinderY(lines, 0, 0, 0, 8, 9.6, 16, true, true);
    addCylinderY(lines, 0, 0, 8, height, 3.6, 14, true, false);
    return lines.join('\n') + '\n';
  }

  if (opts.isRound) {
    const segs = opts.studsX >= 2 ? 28 : 16;
    addCylinderY(lines, 0, 0, 0, height, halfW - tol, segs, true, true);
    if (opts.hasTopStuds !== false) {
      for (let sx = 0; sx < opts.studsX; sx++) {
        for (let sz = 0; sz < opts.studsZ; sz++) {
          const cx = -halfW + (sx + 0.5) * LDU_PER_STUD;
          const cz = -halfD + (sz + 0.5) * LDU_PER_STUD;
          addCylinderY(lines, cx, cz, height, height + STUD_HEIGHT_LDU, STUD_RADIUS_LDU, 12, true, false);
        }
      }
    }
    return lines.join('\n') + '\n';
  }

  const x0 = -halfW + tol;
  const x1 = halfW - tol;
  const z0 = -halfD + tol;
  const z1 = halfD - tol;

  if (opts.isInvertedSlope) {
    // Inverted 45-degree slope: full top width, bottom tapers inward (for sweeping bow/stern hull flare!)
    const baseEndZ = z0 + LDU_PER_STUD;
    const lipY = height - 4;
    // Top face (full footprint)
    addQuad(lines, x0, height, z0, x0, height, z1, x1, height, z1, x1, height, z0);
    // Bottom face (rear 1 stud)
    addQuad(lines, x0, 0, z0, x1, 0, z0, x1, 0, baseEndZ, x0, 0, baseEndZ);
    // Back vertical face
    addQuad(lines, x1, 0, z0, x0, 0, z0, x0, height, z0, x1, height, z0);
    // Front lip
    addQuad(lines, x0, lipY, z1, x1, lipY, z1, x1, height, z1, x0, height, z1);
    // Inverted sloped underside
    addQuad(lines, x0, 0, baseEndZ, x1, 0, baseEndZ, x1, lipY, z1, x0, lipY, z1);
    // Left & right sides
    addQuad(lines, x0, 0, z0, x0, 0, baseEndZ, x0, height, baseEndZ, x0, height, z0);
    addQuad(lines, x0, 0, baseEndZ, x0, lipY, z1, x0, height, z1, x0, height, baseEndZ);
    addQuad(lines, x1, 0, z0, x1, height, z0, x1, height, baseEndZ, x1, 0, baseEndZ);
    addQuad(lines, x1, 0, baseEndZ, x1, height, baseEndZ, x1, height, z1, x1, lipY, z1);
    // Top studs across entire top
    for (let sx = 0; sx < opts.studsX; sx++) {
      for (let sz = 0; sz < opts.studsZ; sz++) {
        const cx = -halfW + (sx + 0.5) * LDU_PER_STUD;
        const cz = -halfD + (sz + 0.5) * LDU_PER_STUD;
        addCylinderY(lines, cx, cz, height, height + STUD_HEIGHT_LDU, STUD_RADIUS_LDU, 12, true, false);
      }
    }
    return lines.join('\n') + '\n';
  }

  if (opts.isCurvedSlope) {
    // Smooth 5-segment curved arch/slope along X (ideal for sleek lifeboats, curved roofs & bow fairings!)
    const segs = 5;
    addQuad(lines, x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1); // Bottom
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const px0 = x0 + (x1 - x0) * t0;
      const px1 = x0 + (x1 - x0) * t1;
      const py0 = 2.5 + Math.sin(t0 * Math.PI) * (height - 2.5);
      const py1 = 2.5 + Math.sin(t1 * Math.PI) * (height - 2.5);
      // Curved top strip
      addQuad(lines, px0, py0, z0, px0, py0, z1, px1, py1, z1, px1, py1, z0);
      // Front & back curved walls
      addQuad(lines, px0, 0, z1, px1, 0, z1, px1, py1, z1, px0, py0, z1);
      addQuad(lines, px1, 0, z0, px0, 0, z0, px0, py0, z0, px1, py1, z0);
    }
    addQuad(lines, x0, 0, z0, x0, 0, z1, x0, 2.5, z1, x0, 2.5, z0);
    addQuad(lines, x1, 0, z1, x1, 0, z0, x1, 2.5, z0, x1, 2.5, z1);
    return lines.join('\n') + '\n';
  }

  if (opts.isSlope) {
    // 45-degree slope: rear 1 stud flat at full height, front slopes down to 4 LDU lip
    const lipH = 4;
    const flatZ = z0 + LDU_PER_STUD;
    // Bottom
    addQuad(lines, x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1);
    // Back
    addQuad(lines, x0, 0, z0, x0, height, z0, x1, height, z0, x1, 0, z0);
    // Front lip
    addQuad(lines, x0, 0, z1, x1, 0, z1, x1, lipH, z1, x0, lipH, z1);
    // Top flat strip
    addQuad(lines, x0, height, z0, x0, height, flatZ, x1, height, flatZ, x1, height, z0);
    // Sloped face
    addQuad(lines, x0, height, flatZ, x0, lipH, z1, x1, lipH, z1, x1, height, flatZ);
    // Left side (quad + tri)
    addQuad(lines, x0, 0, z0, x0, 0, flatZ, x0, height, flatZ, x0, height, z0);
    addQuad(lines, x0, 0, flatZ, x0, 0, z1, x0, lipH, z1, x0, height, flatZ);
    // Right side
    addQuad(lines, x1, 0, z0, x1, height, z0, x1, height, flatZ, x1, 0, flatZ);
    addQuad(lines, x1, 0, flatZ, x1, height, flatZ, x1, lipH, z1, x1, 0, z1);
    // Edges
    addEdge(lines, x0, height, z0, x1, height, z0);
    addEdge(lines, x0, height, flatZ, x1, height, flatZ);
    addEdge(lines, x0, lipH, z1, x1, lipH, z1);

    // Top studs on the flat rear row
    for (let sx = 0; sx < opts.studsX; sx++) {
      const cx = -halfW + (sx + 0.5) * LDU_PER_STUD;
      const cz = -halfD + 0.5 * LDU_PER_STUD;
      addCylinderY(lines, cx, cz, height, height + STUD_HEIGHT_LDU, STUD_RADIUS_LDU, 12, true, false);
    }
    return lines.join('\n') + '\n';
  }

  // Standard rectangular brick / plate / tile body
  // Bottom face (Y = 0)
  addQuad(lines, x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1);
  // Top face (Y = height)
  addQuad(lines, x0, height, z0, x0, height, z1, x1, height, z1, x1, height, z0);
  // Front face (Z = z1)
  addQuad(lines, x0, 0, z1, x1, 0, z1, x1, height, z1, x0, height, z1);
  // Back face (Z = z0)
  addQuad(lines, x1, 0, z0, x0, 0, z0, x0, height, z0, x1, height, z0);
  // Left face (X = x0)
  addQuad(lines, x0, 0, z0, x0, 0, z1, x0, height, z1, x0, height, z0);
  // Right face (X = x1)
  addQuad(lines, x1, 0, z1, x1, 0, z0, x1, height, z0, x1, height, z1);

  // Outer edges for crisp CAD outlines
  addEdge(lines, x0, 0, z0, x1, 0, z0);
  addEdge(lines, x1, 0, z0, x1, 0, z1);
  addEdge(lines, x1, 0, z1, x0, 0, z1);
  addEdge(lines, x0, 0, z1, x0, 0, z0);
  addEdge(lines, x0, height, z0, x1, height, z0);
  addEdge(lines, x1, height, z0, x1, height, z1);
  addEdge(lines, x1, height, z1, x0, height, z1);
  addEdge(lines, x0, height, z1, x0, height, z0);
  addEdge(lines, x0, 0, z0, x0, height, z0);
  addEdge(lines, x1, 0, z0, x1, height, z0);
  addEdge(lines, x1, 0, z1, x1, height, z1);
  addEdge(lines, x0, 0, z1, x0, height, z1);

  // Top studs (omitted for Tiles)
  if (opts.hasTopStuds !== false) {
    for (let sx = 0; sx < opts.studsX; sx++) {
      for (let sz = 0; sz < opts.studsZ; sz++) {
        const cx = -halfW + (sx + 0.5) * LDU_PER_STUD;
        const cz = -halfD + (sz + 0.5) * LDU_PER_STUD;
        addCylinderY(lines, cx, cz, height, height + STUD_HEIGHT_LDU, STUD_RADIUS_LDU, 12, true, false);
      }
    }
  }

  return lines.join('\n') + '\n';
}
