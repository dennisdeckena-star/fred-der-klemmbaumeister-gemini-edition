import {
  LDrawLine,
  LDrawQuad,
  LDrawSubfileRef,
  LDrawTriangle,
  ParsedLDrawGeometry,
  Vec3,
} from './types';

function updateBounds(min: Vec3, max: Vec3, v: Vec3): void {
  if (v[0] < min[0]) min[0] = v[0];
  if (v[1] < min[1]) min[1] = v[1];
  if (v[2] < min[2]) min[2] = v[2];
  if (v[0] > max[0]) max[0] = v[0];
  if (v[1] > max[1]) max[1] = v[1];
  if (v[2] > max[2]) max[2] = v[2];
}

/**
 * Deterministic LDraw `.dat` / `.ldr` parser supporting Line Types 0-5.
 */
export function parseLDrawContent(content: string): ParsedLDrawGeometry {
  const headerComments: string[] = [];
  const subfiles: LDrawSubfileRef[] = [];
  const lines: LDrawLine[] = [];
  const triangles: LDrawTriangle[] = [];
  const quads: LDrawQuad[] = [];
  let optionalLinesCount = 0;

  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let hasVertices = false;

  const rawLines = content.split(/\r?\n/);
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/);
    const lineType = Number(parts[0]);

    switch (lineType) {
      case 0: {
        headerComments.push(trimmed.slice(1).trim());
        break;
      }
      case 1: {
        if (parts.length < 15) continue;
        const colorCode = Number(parts[1]);
        const nums = parts.slice(2, 14).map(Number);
        if (nums.some((n) => Number.isNaN(n))) continue;
        const file = parts.slice(14).join(' ');
        subfiles.push({
          colorCode,
          position: [nums[0], nums[1], nums[2]],
          matrix: [
            nums[3], nums[4], nums[5],
            nums[6], nums[7], nums[8],
            nums[9], nums[10], nums[11],
          ],
          file,
        });
        break;
      }
      case 2: {
        if (parts.length < 8) continue;
        const colorCode = Number(parts[1]);
        const coords = parts.slice(2, 8).map(Number);
        if (coords.some((n) => Number.isNaN(n))) continue;
        const start: Vec3 = [coords[0], coords[1], coords[2]];
        const end: Vec3 = [coords[3], coords[4], coords[5]];
        lines.push({ colorCode, start, end });
        updateBounds(min, max, start);
        updateBounds(min, max, end);
        hasVertices = true;
        break;
      }
      case 3: {
        if (parts.length < 11) continue;
        const colorCode = Number(parts[1]);
        const coords = parts.slice(2, 11).map(Number);
        if (coords.some((n) => Number.isNaN(n))) continue;
        const v1: Vec3 = [coords[0], coords[1], coords[2]];
        const v2: Vec3 = [coords[3], coords[4], coords[5]];
        const v3: Vec3 = [coords[6], coords[7], coords[8]];
        triangles.push({ colorCode, vertices: [v1, v2, v3] });
        updateBounds(min, max, v1);
        updateBounds(min, max, v2);
        updateBounds(min, max, v3);
        hasVertices = true;
        break;
      }
      case 4: {
        if (parts.length < 14) continue;
        const colorCode = Number(parts[1]);
        const coords = parts.slice(2, 14).map(Number);
        if (coords.some((n) => Number.isNaN(n))) continue;
        const v1: Vec3 = [coords[0], coords[1], coords[2]];
        const v2: Vec3 = [coords[3], coords[4], coords[5]];
        const v3: Vec3 = [coords[6], coords[7], coords[8]];
        const v4: Vec3 = [coords[9], coords[10], coords[11]];
        quads.push({ colorCode, vertices: [v1, v2, v3, v4] });
        updateBounds(min, max, v1);
        updateBounds(min, max, v2);
        updateBounds(min, max, v3);
        updateBounds(min, max, v4);
        hasVertices = true;
        break;
      }
      case 5: {
        optionalLinesCount += 1;
        break;
      }
      default:
        break;
    }
  }

  return {
    headerComments,
    subfiles,
    lines,
    triangles,
    quads,
    optionalLinesCount,
    boundingBox: hasVertices
      ? { min, max }
      : { min: [0, 0, 0], max: [0, 0, 0] },
  };
}
