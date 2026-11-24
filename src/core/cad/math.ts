import { Vec3 } from '../ldraw';
import { Transform, WorldAABB } from './types';

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Composes a deterministic 4x4 row-major transformation matrix (Rz * Ry * Rx + Translation).
 */
export function createTransformMatrix(transform: Transform): number[] {
  const [tx, ty, tz] = transform.positionLdu;
  const rx = degToRad(transform.rotationDeg[0]);
  const ry = degToRad(transform.rotationDeg[1]);
  const rz = degToRad(transform.rotationDeg[2]);

  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

  // R = Rz * Ry * Rx
  const r00 = cz * cy;
  const r01 = cz * sy * sx - sz * cx;
  const r02 = cz * sy * cx + sz * sx;

  const r10 = sz * cy;
  const r11 = sz * sy * sx + cz * cx;
  const r12 = sz * sy * cx - cz * sx;

  const r20 = -sy;
  const r21 = cy * sx;
  const r22 = cy * cx;

  return [
    r00, r01, r02, tx,
    r10, r11, r12, ty,
    r20, r21, r22, tz,
    0, 0, 0, 1,
  ];
}

export function applyMatrixToPoint(m: number[], p: Vec3): Vec3 {
  const [x, y, z] = p;
  return [
    m[0] * x + m[1] * y + m[2] * z + m[3],
    m[4] * x + m[5] * y + m[6] * z + m[7],
    m[8] * x + m[9] * y + m[10] * z + m[11],
  ];
}

export function applyRotationToVector(m: number[], v: Vec3): Vec3 {
  const [x, y, z] = v;
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[4] * x + m[5] * y + m[6] * z,
    m[8] * x + m[9] * y + m[10] * z,
  ];
}

export function distanceVec3(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function dotVec3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Computes world-space axis-aligned bounding box of a part's main body
 * (excluding protruding studs which engage into tubes above).
 */
export function computeWorldAABB(dimensionsLdu: Vec3, matrix: number[]): WorldAABB {
  const [w, h, d] = dimensionsLdu;
  const hw = w / 2;
  const hd = d / 2;

  const localCorners: Vec3[] = [
    [-hw, 0, -hd],
    [hw, 0, -hd],
    [-hw, h, -hd],
    [hw, h, -hd],
    [-hw, 0, hd],
    [hw, 0, hd],
    [-hw, h, hd],
    [hw, h, hd],
  ];

  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];

  for (const c of localCorners) {
    const wc = applyMatrixToPoint(matrix, c);
    if (wc[0] < min[0]) min[0] = wc[0];
    if (wc[1] < min[1]) min[1] = wc[1];
    if (wc[2] < min[2]) min[2] = wc[2];
    if (wc[0] > max[0]) max[0] = wc[0];
    if (wc[1] > max[1]) max[1] = wc[1];
    if (wc[2] > max[2]) max[2] = wc[2];
  }

  return { min, max };
}
