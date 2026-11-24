export type OrderStatus =
  | 'CONFIRMED_GEOMETRY'
  | 'CONFIRMED_COLOR'
  | 'ORDERABLE'
  | 'OUT_OF_STOCK'
  | 'DISCONTINUED'
  | 'UNKNOWN';

export type ConnectorType =
  | 'stud'
  | 'tube'
  | 'pin_hole'
  | 'pin'
  | 'axle_hole'
  | 'clip'
  | 'bar';

export type Vec3 = [number, number, number];

export interface ConnectorPoint {
  id: string;
  type: ConnectorType;
  positionLdu: Vec3;
  direction: Vec3;
}

export type MaterialFinish = 'ABS_GLOSS' | 'TRANSPARENT' | 'METALLIC' | 'RUBBER';

export interface LDrawColor {
  code: number;
  name: string;
  hex: string;
  edgeHex: string;
  alpha: number;
  finish: MaterialFinish;
}

export type PartCategory =
  | 'Brick'
  | 'Plate'
  | 'Tile'
  | 'Slope'
  | 'Technic'
  | 'Special';

export interface LDrawPartDefinition {
  partId: string;
  name: string;
  category: PartCategory;
  studsX: number;
  studsZ: number;
  heightPlates: number;
  dimensionsLdu: Vec3;
  datContent: string;
  connectors: ConnectorPoint[];
  statusFlags: OrderStatus[];
  availableColors: number[];
  weightGrams: number;
  isSlope?: boolean;
  isRound?: boolean;
  hasPinHoles?: boolean;
}

export interface LDrawTriangle {
  colorCode: number;
  vertices: [Vec3, Vec3, Vec3];
}

export interface LDrawQuad {
  colorCode: number;
  vertices: [Vec3, Vec3, Vec3, Vec3];
}

export interface LDrawLine {
  colorCode: number;
  start: Vec3;
  end: Vec3;
}

export interface LDrawSubfileRef {
  colorCode: number;
  position: Vec3;
  matrix: [number, number, number, number, number, number, number, number, number];
  file: string;
}

export interface ParsedLDrawGeometry {
  headerComments: string[];
  subfiles: LDrawSubfileRef[];
  lines: LDrawLine[];
  triangles: LDrawTriangle[];
  quads: LDrawQuad[];
  optionalLinesCount: number;
  boundingBox: {
    min: Vec3;
    max: Vec3;
  };
}

export const LDU_PER_STUD = 20;
export const LDU_PER_PLATE = 8;
export const LDU_PER_BRICK = 24;
export const STUD_HEIGHT_LDU = 4;
export const STUD_RADIUS_LDU = 6;
