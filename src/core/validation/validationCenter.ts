import {
  applyMatrixToPoint,
  CadModel,
  checkCollisions,
  computeWorldAABB,
  validateConnections,
} from '../cad';
import {
  computeBom,
  generateStepsForModel,
  validateInstructionsForModel,
} from '../cad/bomAndSteps';
import { getPartById, LDU_PER_PLATE, LDU_PER_STUD, Vec3 } from '../ldraw';

export type CheckStatus = 'PASS' | 'FAIL' | 'NOT_TESTED';

export interface ValidationCheckResult {
  id:
    | 'part_limit'
    | 'collisions'
    | 'stud_grid_physics'
    | 'connections'
    | 'overhangs'
    | 'bom_identity'
    | 'instructions_consistency'
    | 'physical_load_bearing';
  title: string;
  status: CheckStatus;
  details: string;
}

export interface ValidationCenterReport {
  modelId: string;
  modelName: string;
  checkedAt: string;
  deterministicStatus: 'PASS' | 'FAIL';
  checks: ValidationCheckResult[];
}

export interface ValidationOptions {
  maxParts?: number;
  maxOverhangRatio?: number;
}

/**
 * Verifies real interlocking-brick stud-grid physics:
 * - Every stud/tube must sit on a consistent 20-LDU pitch grid (10 + k*20) so parts
 *   never engage half-stud offset (which would physically bend/damage bricks).
 * - Every part's vertical bottom Y must sit on an exact 8-LDU plate increment (except Technic pins).
 */
export function checkStudGridPhysics(model: CadModel): {
  passed: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const tol = 0.25;

  for (const part of model.parts) {
    const def = getPartById(part.partId);
    if (!def) continue;
    if (def.partId === '2780.dat') continue; // Technic pins sit at hole center (14 LDU offset)

    // 1. Vertical plate grid check (Y must be multiple of 8 LDU)
    const yMod = Math.abs(part.transform.positionLdu[1] % LDU_PER_PLATE);
    if (yMod > tol && Math.abs(yMod - LDU_PER_PLATE) > tol) {
      violations.push(
        `${part.instanceId} (${part.partId}): Ungültige Höhe Y=${part.transform.positionLdu[1]} LDU (kein Vielfaches von 8 LDU).`,
      );
    }

    // 2. Horizontal stud-grid alignment check: every tube/stud must sit at (10 + k*20) in X and Z
    const firstTube = def.connectors.find((c) => c.type === 'tube');
    if (firstTube) {
      const worldPos = applyMatrixToPoint(part.matrix, firstTube.positionLdu);
      const xShift = Math.abs((((worldPos[0] - 10) % LDU_PER_STUD) + LDU_PER_STUD) % LDU_PER_STUD);
      const zShift = Math.abs((((worldPos[2] - 10) % LDU_PER_STUD) + LDU_PER_STUD) % LDU_PER_STUD);
      const xOk = xShift <= tol || Math.abs(xShift - LDU_PER_STUD) <= tol;
      const zOk = zShift <= tol || Math.abs(zShift - LDU_PER_STUD) <= tol;
      if (!xOk || !zOk) {
        violations.push(
          `${part.instanceId} (${part.partId}): Halbnoppen-Versatz bei (${worldPos[0].toFixed(1)}, ${worldPos[2].toFixed(1)}) – physisch nicht spannungsfrei klemmbar.`,
        );
      }
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

function checkOverhangs(
  model: CadModel,
  maxOverhangRatio = 0.78,
): {
  passed: boolean;
  unsupportedIds: string[];
} {
  if (model.parts.length <= 1) return { passed: true, unsupportedIds: [] };

  const boxes = model.parts.map((part) => {
    const def = getPartById(part.partId);
    const dims: Vec3 = def ? def.dimensionsLdu : [20, 24, 20];
    return { part, def, aabb: computeWorldAABB(dims, part.matrix) };
  });

  // Spatial bucket by maxY for O(N) performance even at 3000+ parts
  const byTopY = new Map<number, typeof boxes>();
  for (const b of boxes) {
    const key = Math.round(b.aabb.max[1]);
    const list = byTopY.get(key) ?? [];
    list.push(b);
    byTopY.set(key, list);
  }

  const minGlobalY = Math.min(...boxes.map((b) => b.aabb.min[1]));
  const unsupportedIds: string[] = [];

  for (const item of boxes) {
    if (item.aabb.min[1] <= minGlobalY + 1.0) continue;
    if (item.def?.partId === '2780.dat') continue;

    const area =
      Math.max(1, item.aabb.max[0] - item.aabb.min[0]) *
      Math.max(1, item.aabb.max[2] - item.aabb.min[2]);

    let supportedArea = 0;
    const targetY = Math.round(item.aabb.min[1]);
    const candidates = [
      ...(byTopY.get(targetY) ?? []),
      ...(byTopY.get(targetY - 1) ?? []),
      ...(byTopY.get(targetY + 1) ?? []),
    ];

    for (const below of candidates) {
      if (below.part.instanceId === item.part.instanceId) continue;
      const ox = Math.max(
        0,
        Math.min(item.aabb.max[0], below.aabb.max[0]) - Math.max(item.aabb.min[0], below.aabb.min[0]),
      );
      const oz = Math.max(
        0,
        Math.min(item.aabb.max[2], below.aabb.max[2]) - Math.max(item.aabb.min[2], below.aabb.min[2]),
      );
      supportedArea += ox * oz;
    }

    const supportRatio = Math.min(1, supportedArea / area);
    const overhangRatio = 1 - supportRatio;
    if (overhangRatio > maxOverhangRatio) {
      unsupportedIds.push(item.part.instanceId);
    }
  }

  return {
    passed: unsupportedIds.length === 0,
    unsupportedIds,
  };
}

export function runValidationCenter(
  model: CadModel,
  options: ValidationOptions = {},
): ValidationCenterReport {
  const maxParts = options.maxParts ?? 12000;
  const maxOverhangRatio = options.maxOverhangRatio ?? 0.78;
  const checks: ValidationCheckResult[] = [];

  // 1. Teilelimit
  const withinLimit = model.parts.length <= maxParts;
  checks.push({
    id: 'part_limit',
    title: 'Teilelimit',
    status: withinLimit ? 'PASS' : 'FAIL',
    details: `${model.parts.length} von max. ${maxParts} Teilen verwendet.`,
  });

  // 2. Kollisionen
  const collisions = checkCollisions(model);
  checks.push({
    id: 'collisions',
    title: 'Geometrische Kollisionen',
    status: collisions.hasCollisions ? 'FAIL' : 'PASS',
    details: collisions.hasCollisions
      ? `${collisions.collisions.length} Überschneidung(en) erkannt.`
      : `0 Kollisionen bei ${collisions.checkedPairs} geprüften Teilepaaren.`,
  });

  // 3. Noppen-Raster & Klemm-Physik (keine Halbnoppen-Fehlklemme!)
  const studGrid = checkStudGridPhysics(model);
  checks.push({
    id: 'stud_grid_physics',
    title: 'Noppen-Raster & Klemm-Physik (20-LDU-Grid)',
    status: studGrid.passed ? 'PASS' : 'FAIL',
    details: studGrid.passed
      ? 'Alle Teile sitzen exakt im 20-LDU-Noppen- und 8-LDU-Plattenraster (spannungsfrei baubar).'
      : `${studGrid.violations.length} Raster-/Klemmverstoß: ${studGrid.violations[0]}`,
  });

  // 4. Unverbundene Teile
  const connections = validateConnections(model);
  checks.push({
    id: 'connections',
    title: 'Verbindungsgraph (Noppen & Pins)',
    status: connections.isFullyConnected ? 'PASS' : 'FAIL',
    details: connections.isFullyConnected
      ? `Alle Teile verbunden (${connections.edges.length} Verbindungen).`
      : `${connections.unconnectedInstanceIds.length} unverbundene(s) Teil(e) erkannt.`,
  });

  // 5. Überhänge
  const overhangs = checkOverhangs(model, maxOverhangRatio);
  checks.push({
    id: 'overhangs',
    title: 'Überhang- & Auflagerprüfung',
    status: overhangs.passed ? 'PASS' : 'FAIL',
    details: overhangs.passed
      ? 'Keine unzulässigen ungestützten Überhänge.'
      : `${overhangs.unsupportedIds.length} Teil(e) mit kritischem Überhang ohne Auflager.`,
  });

  // 6. BOM-Identität
  const bom = computeBom(model);
  const unknownCatalogParts = model.parts.filter((p) => !getPartById(p.partId));
  const bomOk = bom.totalParts === model.parts.length && unknownCatalogParts.length === 0;
  checks.push({
    id: 'bom_identity',
    title: 'Stücklisten-Identität (BOM)',
    status: bomOk ? 'PASS' : 'FAIL',
    details: bomOk
      ? `BOM-Summe (${bom.totalParts}) identisch mit Modell, ${bom.uniqueLots} eindeutige Positionen.`
      : `Abweichung oder unbekannte Katalogteile (${unknownCatalogParts.length}).`,
  });

  // 7. Anleitungskonsistenz
  const steps = generateStepsForModel(model);
  const instr = validateInstructionsForModel(model, steps);
  checks.push({
    id: 'instructions_consistency',
    title: 'Bauanleitungs-Konsistenz',
    status: instr.valid ? 'PASS' : 'FAIL',
    details: instr.valid
      ? `${steps.length} lückenlose Schritte, 100 % Deckung mit Modell & BOM.`
      : instr.issues.join(' | '),
  });

  // 8. Physische Belastbarkeit (ohne Probebau IMMER NOT_TESTED!)
  checks.push({
    id: 'physical_load_bearing',
    title: 'Physische Belastbarkeit (Probebau)',
    status: 'NOT_TESTED',
    details: 'Ohne realen physischen Probebau nicht deterministisch verifizierbar (ehrlich als NOT_TESTED markiert).',
  });

  const deterministicFailed = checks.some((c) => c.status === 'FAIL');

  return {
    modelId: model.id,
    modelName: model.name,
    checkedAt: new Date().toISOString(),
    deterministicStatus: deterministicFailed ? 'FAIL' : 'PASS',
    checks,
  };
}
