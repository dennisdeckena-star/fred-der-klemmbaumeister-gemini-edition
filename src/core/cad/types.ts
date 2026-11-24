import { Vec3 } from '../ldraw';

export interface Transform {
  positionLdu: Vec3;
  rotationDeg: Vec3;
}

export interface AssemblyNode {
  id: string;
  name: string;
  parentId: string | null;
  stepOrder: number;
}

export interface PartInstance {
  instanceId: string;
  partId: string;
  colorCode: number;
  assemblyId: string;
  step: number;
  transform: Transform;
  /** 16-element row-major 4x4 transformation matrix in LDU */
  matrix: number[];
}

export interface CadModel {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  assemblies: AssemblyNode[];
  parts: PartInstance[];
  metadata: Record<string, unknown>;
}

export interface WorldAABB {
  min: Vec3;
  max: Vec3;
}

export interface CollisionPair {
  instanceA: string;
  instanceB: string;
  overlapLdu: Vec3;
}

export interface CollisionReport {
  hasCollisions: boolean;
  collisions: CollisionPair[];
  checkedPairs: number;
}

export interface ConnectionEdge {
  fromInstanceId: string;
  fromConnectorId: string;
  toInstanceId: string;
  toConnectorId: string;
  connectionType: 'stud-tube' | 'pin-hole';
  distanceLdu: number;
}

export interface ConnectionReport {
  isFullyConnected: boolean;
  edges: ConnectionEdge[];
  connectedComponents: string[][];
  unconnectedInstanceIds: string[];
}
