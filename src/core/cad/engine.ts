import { getPartById, Vec3 } from '../ldraw';
import {
  applyMatrixToPoint,
  applyRotationToVector,
  computeWorldAABB,
  createTransformMatrix,
  distanceVec3,
  dotVec3,
} from './math';
import {
  AssemblyNode,
  CadModel,
  CollisionPair,
  CollisionReport,
  ConnectionEdge,
  ConnectionReport,
  PartInstance,
  Transform,
} from './types';

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

let idCounter = 1;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export class CadDocument {
  private model: CadModel;
  private undoStack: CadModel[] = [];
  private redoStack: CadModel[] = [];
  private selectedInstanceIds: Set<string> = new Set();

  constructor(initial?: CadModel) {
    if (initial) {
      this.model = deepClone(initial);
    } else {
      const now = new Date().toISOString();
      this.model = {
        id: nextId('model'),
        name: 'Neues Modell',
        description: '',
        createdAt: now,
        updatedAt: now,
        assemblies: [
          { id: 'asm-root', name: 'Hauptbaugruppe', parentId: null, stepOrder: 1 },
        ],
        parts: [],
        metadata: {},
      };
    }
  }

  private pushUndo(): void {
    this.undoStack.push(deepClone(this.model));
    if (this.undoStack.length > 100) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public getModel(): CadModel {
    return deepClone(this.model);
  }

  public get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.redoStack.push(deepClone(this.model));
    this.model = prev;
    return true;
  }

  public redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(deepClone(this.model));
    this.model = next;
    return true;
  }

  public selectPart(instanceId: string, additive = false): void {
    if (!additive) this.selectedInstanceIds.clear();
    if (this.model.parts.some((p) => p.instanceId === instanceId)) {
      this.selectedInstanceIds.add(instanceId);
    }
  }

  public clearSelection(): void {
    this.selectedInstanceIds.clear();
  }

  public getSelection(): string[] {
    return Array.from(this.selectedInstanceIds);
  }

  public createAssembly(name: string, parentId: string | null = 'asm-root', customId?: string): AssemblyNode {
    this.pushUndo();
    const node: AssemblyNode = {
      id: customId ?? nextId('asm'),
      name,
      parentId,
      stepOrder: this.model.assemblies.length + 1,
    };
    this.model.assemblies.push(node);
    this.model.updatedAt = new Date().toISOString();
    return deepClone(node);
  }

  public addPart(input: {
    partId: string;
    colorCode: number;
    positionLdu: Vec3;
    rotationDeg?: Vec3;
    assemblyId?: string;
    step?: number;
    instanceId?: string;
  }): PartInstance {
    const def = getPartById(input.partId);
    if (!def) {
      throw new Error(`Unbekanntes LDraw-Teil im Katalog: ${input.partId}`);
    }
    this.pushUndo();

    const transform: Transform = {
      positionLdu: [...input.positionLdu] as Vec3,
      rotationDeg: input.rotationDeg ? ([...input.rotationDeg] as Vec3) : [0, 0, 0],
    };

    const instance: PartInstance = {
      instanceId: input.instanceId ?? nextId('part'),
      partId: def.partId,
      colorCode: input.colorCode,
      assemblyId: input.assemblyId ?? 'asm-root',
      step: input.step ?? 1,
      transform,
      matrix: createTransformMatrix(transform),
    };

    this.model.parts.push(instance);
    this.model.updatedAt = new Date().toISOString();
    return deepClone(instance);
  }

  public removePart(instanceId: string): boolean {
    const idx = this.model.parts.findIndex((p) => p.instanceId === instanceId);
    if (idx === -1) return false;
    this.pushUndo();
    this.model.parts.splice(idx, 1);
    this.selectedInstanceIds.delete(instanceId);
    this.model.updatedAt = new Date().toISOString();
    return true;
  }

  public transformPart(instanceId: string, transform: Partial<Transform>): PartInstance {
    const part = this.model.parts.find((p) => p.instanceId === instanceId);
    if (!part) {
      throw new Error(`Teil-Instanz nicht gefunden: ${instanceId}`);
    }
    this.pushUndo();
    const nextTransform: Transform = {
      positionLdu: transform.positionLdu
        ? ([...transform.positionLdu] as Vec3)
        : ([...part.transform.positionLdu] as Vec3),
      rotationDeg: transform.rotationDeg
        ? ([...transform.rotationDeg] as Vec3)
        : ([...part.transform.rotationDeg] as Vec3),
    };
    part.transform = nextTransform;
    part.matrix = createTransformMatrix(nextTransform);
    this.model.updatedAt = new Date().toISOString();
    return deepClone(part);
  }

  public computeExplodedPositions(factor: number): Record<string, Vec3> {
    const clamped = Math.max(0, Math.min(2, factor));
    const result: Record<string, Vec3> = {};
    if (this.model.parts.length === 0) return result;

    // Centroid in XZ, explode upwards by step + radially from center
    let cx = 0;
    let cz = 0;
    for (const p of this.model.parts) {
      cx += p.transform.positionLdu[0];
      cz += p.transform.positionLdu[2];
    }
    cx /= this.model.parts.length;
    cz /= this.model.parts.length;

    const asmIndex = new Map<string, number>();
    this.model.assemblies.forEach((a, i) => asmIndex.set(a.id, i));

    for (const p of this.model.parts) {
      const [x, y, z] = p.transform.positionLdu;
      const asmOffset = (asmIndex.get(p.assemblyId) ?? 0) * 18 * clamped;
      const stepOffset = (p.step - 1) * 14 * clamped;
      const dx = (x - cx) * 0.35 * clamped;
      const dz = (z - cz) * 0.35 * clamped;
      result[p.instanceId] = [x + dx, y + stepOffset + asmOffset, z + dz];
    }
    return result;
  }

  public toLdrString(): string {
    const lines: string[] = [
      `0 ${this.model.name}`,
      `0 Name: ${this.model.id}.ldr`,
      `0 Author: Fred, der Klemmbaumeister (Gemini Edition)`,
    ];

    const maxStep = this.model.parts.reduce((acc, p) => Math.max(acc, p.step), 1);
    for (let s = 1; s <= maxStep; s++) {
      const stepParts = this.model.parts.filter((p) => p.step === s);
      if (stepParts.length === 0) continue;
      lines.push(`0 // Schritt ${s}`);
      for (const p of stepParts) {
        const m = p.matrix;
        lines.push(
          `1 ${p.colorCode} ${m[3]} ${m[7]} ${m[11]} ${m[0].toFixed(4)} ${m[1].toFixed(4)} ${m[2].toFixed(4)} ${m[4].toFixed(4)} ${m[5].toFixed(4)} ${m[6].toFixed(4)} ${m[8].toFixed(4)} ${m[9].toFixed(4)} ${m[10].toFixed(4)} ${p.partId}`,
        );
      }
      lines.push('0 STEP');
    }
    return lines.join('\n') + '\n';
  }

  public toJSON(): string {
    return JSON.stringify(this.model, null, 2);
  }

  public static fromJSON(raw: string): CadDocument {
    const parsed = JSON.parse(raw) as CadModel;
    return new CadDocument(parsed);
  }
}

/**
 * Deterministic pairwise AABB collision check with 0.5 LDU seam tolerance.
 * Technic Pins (`2780.dat`) engaging into Technic bricks with pin holes are permitted.
 */
export function checkCollisions(model: CadModel): CollisionReport {
  const collisions: CollisionPair[] = [];
  const tol = 0.5;
  let checkedPairs = 0;

  const boxes = model.parts.map((part) => {
    const def = getPartById(part.partId);
    const dims: Vec3 = def ? def.dimensionsLdu : [20, 24, 20];
    return {
      part,
      def,
      aabb: computeWorldAABB(dims, part.matrix),
    };
  });

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      checkedPairs += 1;
      const a = boxes[i];
      const b = boxes[j];

      // Allow Technic Pin engaging into a Technic Brick with pin holes
      const isPinEngagement =
        (a.def?.partId === '2780.dat' && b.def?.hasPinHoles) ||
        (b.def?.partId === '2780.dat' && a.def?.hasPinHoles);
      if (isPinEngagement) continue;

      const ox = Math.min(a.aabb.max[0], b.aabb.max[0]) - Math.max(a.aabb.min[0], b.aabb.min[0]);
      const oy = Math.min(a.aabb.max[1], b.aabb.max[1]) - Math.max(a.aabb.min[1], b.aabb.min[1]);
      const oz = Math.min(a.aabb.max[2], b.aabb.max[2]) - Math.max(a.aabb.min[2], b.aabb.min[2]);

      if (ox > tol && oy > tol && oz > tol) {
        collisions.push({
          instanceA: a.part.instanceId,
          instanceB: b.part.instanceId,
          overlapLdu: [Number(ox.toFixed(2)), Number(oy.toFixed(2)), Number(oz.toFixed(2))],
        });
      }
    }
  }

  return {
    hasCollisions: collisions.length > 0,
    collisions,
    checkedPairs,
  };
}

interface WorldConnector {
  instanceId: string;
  connectorId: string;
  type: string;
  pos: Vec3;
  dir: Vec3;
}

/**
 * Deterministic connector graph validation (Stud<->Tube and Pin<->PinHole).
 */
export function validateConnections(model: CadModel): ConnectionReport {
  const allConnectors: WorldConnector[] = [];

  for (const part of model.parts) {
    const def = getPartById(part.partId);
    if (!def) continue;
    for (const c of def.connectors) {
      allConnectors.push({
        instanceId: part.instanceId,
        connectorId: c.id,
        type: c.type,
        pos: applyMatrixToPoint(part.matrix, c.positionLdu),
        dir: applyRotationToVector(part.matrix, c.direction),
      });
    }
  }

  const edges: ConnectionEdge[] = [];
  const adj = new Map<string, Set<string>>();
  for (const p of model.parts) {
    adj.set(p.instanceId, new Set());
  }

  const studs = allConnectors.filter((c) => c.type === 'stud');
  const tubes = allConnectors.filter((c) => c.type === 'tube');
  const pins = allConnectors.filter((c) => c.type === 'pin');
  const pinHoles = allConnectors.filter((c) => c.type === 'pin_hole');

  const recordedPairs = new Set<string>();

  for (const s of studs) {
    for (const t of tubes) {
      if (s.instanceId === t.instanceId) continue;
      const dist = distanceVec3(s.pos, t.pos);
      const facing = dotVec3(s.dir, t.dir);
      if (dist <= 1.5 && facing < -0.8) {
        const pairKey = [s.instanceId, t.instanceId].sort().join('::');
        if (!recordedPairs.has(pairKey)) {
          recordedPairs.add(pairKey);
          edges.push({
            fromInstanceId: s.instanceId,
            fromConnectorId: s.connectorId,
            toInstanceId: t.instanceId,
            toConnectorId: t.connectorId,
            connectionType: 'stud-tube',
            distanceLdu: Number(dist.toFixed(3)),
          });
          adj.get(s.instanceId)?.add(t.instanceId);
          adj.get(t.instanceId)?.add(s.instanceId);
        }
      }
    }
  }

  for (const p of pins) {
    for (const h of pinHoles) {
      if (p.instanceId === h.instanceId) continue;
      const dist = distanceVec3(p.pos, h.pos);
      if (dist <= 12.0) {
        const pairKey = [p.instanceId, h.instanceId].sort().join('::');
        if (!recordedPairs.has(pairKey)) {
          recordedPairs.add(pairKey);
          edges.push({
            fromInstanceId: p.instanceId,
            fromConnectorId: p.connectorId,
            toInstanceId: h.instanceId,
            toConnectorId: h.connectorId,
            connectionType: 'pin-hole',
            distanceLdu: Number(dist.toFixed(3)),
          });
          adj.get(p.instanceId)?.add(h.instanceId);
          adj.get(h.instanceId)?.add(p.instanceId);
        }
      }
    }
  }

  // BFS for connected components
  const visited = new Set<string>();
  const connectedComponents: string[][] = [];
  for (const p of model.parts) {
    if (visited.has(p.instanceId)) continue;
    const comp: string[] = [];
    const queue = [p.instanceId];
    visited.add(p.instanceId);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      comp.push(cur);
      for (const nb of adj.get(cur) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    connectedComponents.push(comp);
  }

  connectedComponents.sort((a, b) => b.length - a.length);
  const unconnectedInstanceIds =
    connectedComponents.length <= 1
      ? []
      : connectedComponents.slice(1).flat();

  return {
    isFullyConnected: model.parts.length <= 1 || connectedComponents.length === 1,
    edges,
    connectedComponents,
    unconnectedInstanceIds,
  };
}
