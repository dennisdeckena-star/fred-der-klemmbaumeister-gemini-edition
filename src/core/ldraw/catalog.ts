import { generatePartDat } from './datGenerator';
import {
  ConnectorPoint,
  LDrawPartDefinition,
  LDU_PER_PLATE,
  LDU_PER_STUD,
  OrderStatus,
  PartCategory,
} from './types';

function buildConnectors(
  studsX: number,
  studsZ: number,
  heightPlates: number,
  options: {
    hasTopStuds?: boolean;
    isSlope?: boolean;
    hasPinHoles?: boolean;
    isPin?: boolean;
  } = {},
): ConnectorPoint[] {
  const connectors: ConnectorPoint[] = [];
  const halfW = (studsX * LDU_PER_STUD) / 2;
  const halfD = (studsZ * LDU_PER_STUD) / 2;
  const height = heightPlates * LDU_PER_PLATE;

  if (options.isPin) {
    connectors.push(
      { id: 'pin-front', type: 'pin', positionLdu: [0, height / 2, 10], direction: [0, 0, 1] },
      { id: 'pin-back', type: 'pin', positionLdu: [0, height / 2, -10], direction: [0, 0, -1] },
    );
    return connectors;
  }

  // Bottom tubes (receiving sockets) at Y = 0
  for (let sx = 0; sx < studsX; sx++) {
    for (let sz = 0; sz < studsZ; sz++) {
      const cx = -halfW + (sx + 0.5) * LDU_PER_STUD;
      const cz = -halfD + (sz + 0.5) * LDU_PER_STUD;
      connectors.push({
        id: `tube-${sx}-${sz}`,
        type: 'tube',
        positionLdu: [cx, 0, cz],
        direction: [0, -1, 0],
      });
    }
  }

  // Top studs at Y = height
  if (options.hasTopStuds !== false) {
    const maxZ = options.isSlope ? 1 : studsZ;
    for (let sx = 0; sx < studsX; sx++) {
      for (let sz = 0; sz < maxZ; sz++) {
        const cx = -halfW + (sx + 0.5) * LDU_PER_STUD;
        const cz = -halfD + (sz + 0.5) * LDU_PER_STUD;
        connectors.push({
          id: `stud-${sx}-${sz}`,
          type: 'stud',
          positionLdu: [cx, height, cz],
          direction: [0, 1, 0],
        });
      }
    }
  }

  // Technic pin holes along X face (centered at Y = 14 LDU in a 24 LDU brick)
  if (options.hasPinHoles) {
    const holeCount = Math.max(1, studsX - 1);
    for (let i = 0; i < holeCount; i++) {
      const cx = -halfW + (i + 1) * LDU_PER_STUD;
      connectors.push(
        { id: `pinhole-f-${i}`, type: 'pin_hole', positionLdu: [cx, 14, halfD], direction: [0, 0, 1] },
        { id: `pinhole-b-${i}`, type: 'pin_hole', positionLdu: [cx, 14, -halfD], direction: [0, 0, -1] },
      );
    }
  }

  return connectors;
}

interface PartSpec {
  partId: string;
  name: string;
  category: PartCategory;
  studsX: number;
  studsZ: number;
  heightPlates: number;
  weightGrams: number;
  statusFlags: OrderStatus[];
  availableColors: number[];
  hasTopStuds?: boolean;
  isSlope?: boolean;
  isInvertedSlope?: boolean;
  isCurvedSlope?: boolean;
  isRound?: boolean;
  isMastPole?: boolean;
  hasPinHoles?: boolean;
  isPin?: boolean;
}

const STANDARD_COLORS = [0, 1, 2, 4, 6, 7, 10, 14, 15, 19, 25, 70, 71, 72, 73, 272, 320];

const PART_SPECS: PartSpec[] = [
  // Bricks
  { partId: '3005.dat', name: 'Brick 1 x 1', category: 'Brick', studsX: 1, studsZ: 1, heightPlates: 3, weightGrams: 0.44, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3004.dat', name: 'Brick 1 x 2', category: 'Brick', studsX: 2, studsZ: 1, heightPlates: 3, weightGrams: 0.82, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3622.dat', name: 'Brick 1 x 3', category: 'Brick', studsX: 3, studsZ: 1, heightPlates: 3, weightGrams: 1.21, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3010.dat', name: 'Brick 1 x 4', category: 'Brick', studsX: 4, studsZ: 1, heightPlates: 3, weightGrams: 1.59, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3008.dat', name: 'Brick 1 x 8', category: 'Brick', studsX: 8, studsZ: 1, heightPlates: 3, weightGrams: 3.12, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3003.dat', name: 'Brick 2 x 2', category: 'Brick', studsX: 2, studsZ: 2, heightPlates: 3, weightGrams: 1.15, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3002.dat', name: 'Brick 2 x 3', category: 'Brick', studsX: 3, studsZ: 2, heightPlates: 3, weightGrams: 1.72, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3001.dat', name: 'Brick 2 x 4', category: 'Brick', studsX: 4, studsZ: 2, heightPlates: 3, weightGrams: 2.32, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },

  // Plates
  { partId: '3024.dat', name: 'Plate 1 x 1', category: 'Plate', studsX: 1, studsZ: 1, heightPlates: 1, weightGrams: 0.18, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3023.dat', name: 'Plate 1 x 2', category: 'Plate', studsX: 2, studsZ: 1, heightPlates: 1, weightGrams: 0.36, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3710.dat', name: 'Plate 1 x 4', category: 'Plate', studsX: 4, studsZ: 1, heightPlates: 1, weightGrams: 0.72, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3022.dat', name: 'Plate 2 x 2', category: 'Plate', studsX: 2, studsZ: 2, heightPlates: 1, weightGrams: 0.56, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3020.dat', name: 'Plate 2 x 4', category: 'Plate', studsX: 4, studsZ: 2, heightPlates: 1, weightGrams: 1.12, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3034.dat', name: 'Plate 2 x 8', category: 'Plate', studsX: 8, studsZ: 2, heightPlates: 1, weightGrams: 2.24, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3031.dat', name: 'Plate 4 x 4', category: 'Plate', studsX: 4, studsZ: 4, heightPlates: 1, weightGrams: 2.15, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3032.dat', name: 'Plate 4 x 6', category: 'Plate', studsX: 6, studsZ: 4, heightPlates: 1, weightGrams: 3.21, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3036.dat', name: 'Plate 6 x 8', category: 'Plate', studsX: 8, studsZ: 6, heightPlates: 1, weightGrams: 6.4, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 1, 2, 14, 15, 71, 72] },

  // Tiles (smooth, no top studs)
  { partId: '3070b.dat', name: 'Tile 1 x 1 with Groove', category: 'Tile', studsX: 1, studsZ: 1, heightPlates: 1, weightGrams: 0.16, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3069b.dat', name: 'Tile 1 x 2 with Groove', category: 'Tile', studsX: 2, studsZ: 1, heightPlates: 1, weightGrams: 0.31, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '2431.dat', name: 'Tile 1 x 4', category: 'Tile', studsX: 4, studsZ: 1, heightPlates: 1, weightGrams: 0.61, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3068b.dat', name: 'Tile 2 x 2 with Groove', category: 'Tile', studsX: 2, studsZ: 2, heightPlates: 1, weightGrams: 0.52, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },

  // Slopes
  { partId: '3040b.dat', name: 'Slope Brick 45 2 x 1', category: 'Slope', studsX: 1, studsZ: 2, heightPlates: 3, weightGrams: 0.65, isSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3039.dat', name: 'Slope Brick 45 2 x 2', category: 'Slope', studsX: 2, studsZ: 2, heightPlates: 3, weightGrams: 1.18, isSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3037.dat', name: 'Slope Brick 45 2 x 4', category: 'Slope', studsX: 4, studsZ: 2, heightPlates: 3, weightGrams: 2.1, isSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'OUT_OF_STOCK'], availableColors: [0, 1, 4, 14, 15, 71, 72] },

  // Technic & SNOT Structural Skeleton + Cladding Connectors
  { partId: '3700.dat', name: 'Technic Brick 1 x 2 with Hole', category: 'Technic', studsX: 2, studsZ: 1, heightPlates: 3, weightGrams: 0.78, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 1, 4, 14, 15, 71, 72] },
  { partId: '3701.dat', name: 'Technic Brick 1 x 4 with Holes', category: 'Technic', studsX: 4, studsZ: 1, heightPlates: 3, weightGrams: 1.54, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 1, 4, 14, 15, 71, 72] },
  { partId: '2780.dat', name: 'Technic Pin with Friction Ridges', category: 'Technic', studsX: 1, studsZ: 2, heightPlates: 1, weightGrams: 0.21, isPin: true, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 1, 72] },
  { partId: '64179.dat', name: 'Technic Liftarm Frame 5 x 7 Open Center', category: 'Technic', studsX: 7, studsZ: 5, heightPlates: 3, weightGrams: 4.8, hasTopStuds: false, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 71, 72] },
  { partId: '32524.dat', name: 'Technic Liftarm 1 x 7 Thick', category: 'Technic', studsX: 7, studsZ: 1, heightPlates: 3, weightGrams: 1.65, hasTopStuds: false, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 4, 14, 71, 72] },
  { partId: '4274.dat', name: 'Technic Pin 1/2 with Stud (Skeleton-to-Cladding Adapter)', category: 'Technic', studsX: 1, studsZ: 1, heightPlates: 1, weightGrams: 0.19, isPin: true, hasTopStuds: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [1, 71, 72] },
  { partId: '99781.dat', name: 'Bracket 1 x 2 - 1 x 2 Inverted (SNOT Cladding)', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 2, weightGrams: 0.54, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '87087.dat', name: 'Brick 1 x 1 with Stud on 1 Side (SNOT)', category: 'Special', studsX: 1, studsZ: 1, heightPlates: 3, weightGrams: 0.48, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '15573.dat', name: 'Plate Modified 1 x 2 with 1 Stud (Jumper Plate)', category: 'Plate', studsX: 2, studsZ: 1, heightPlates: 1, weightGrams: 0.34, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },

  // Special (Round / Cylindrical Funnels / Inverted Slopes / Curved Lifeboats / Slender Masts)
  { partId: '3062b.dat', name: 'Brick 1 x 1 Round', category: 'Special', studsX: 1, studsZ: 1, heightPlates: 3, weightGrams: 0.35, isRound: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3941.dat', name: 'Brick 2 x 2 Round (Smooth Cylinder)', category: 'Special', studsX: 2, studsZ: 2, heightPlates: 3, weightGrams: 1.05, isRound: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3660.dat', name: 'Slope Brick 45 2 x 2 Inverted', category: 'Slope', studsX: 2, studsZ: 2, heightPlates: 3, weightGrams: 1.12, isInvertedSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3665.dat', name: 'Slope Brick 45 2 x 1 Inverted', category: 'Slope', studsX: 1, studsZ: 2, heightPlates: 3, weightGrams: 0.62, isInvertedSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '50950.dat', name: 'Slope Curved 3 x 1 (Lifeboat / Fairing)', category: 'Slope', studsX: 3, studsZ: 1, heightPlates: 2, weightGrams: 0.58, hasTopStuds: false, isCurvedSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3957.dat', name: 'Slender Mast Pole 1 x 1 x 4', category: 'Special', studsX: 1, studsZ: 1, heightPlates: 12, weightGrams: 0.42, hasTopStuds: false, isMastPole: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3009.dat', name: 'Brick 1 x 6 (Legacy Color Run)', category: 'Brick', studsX: 6, studsZ: 1, heightPlates: 3, weightGrams: 2.38, statusFlags: ['CONFIRMED_GEOMETRY', 'DISCONTINUED'], availableColors: [7] },
  { partId: '99999.dat', name: 'Custom Prototype Connector 1 x 2', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 1, weightGrams: 0.35, statusFlags: ['UNKNOWN'], availableColors: [71] },
];

const CATALOG_MAP: Map<string, LDrawPartDefinition> = new Map();

for (const spec of PART_SPECS) {
  const datContent = generatePartDat({
    partId: spec.partId,
    name: spec.name,
    studsX: spec.studsX,
    studsZ: spec.studsZ,
    heightPlates: spec.heightPlates,
    hasTopStuds: spec.hasTopStuds,
    isSlope: spec.isSlope,
    isInvertedSlope: spec.isInvertedSlope,
    isCurvedSlope: spec.isCurvedSlope,
    isRound: spec.isRound,
    isMastPole: spec.isMastPole,
    isPin: spec.isPin,
  });

  const def: LDrawPartDefinition = {
    partId: spec.partId,
    name: spec.name,
    category: spec.category,
    studsX: spec.studsX,
    studsZ: spec.studsZ,
    heightPlates: spec.heightPlates,
    dimensionsLdu: [
      spec.studsX * LDU_PER_STUD,
      spec.heightPlates * LDU_PER_PLATE,
      spec.studsZ * LDU_PER_STUD,
    ],
    datContent,
    connectors: buildConnectors(spec.studsX, spec.studsZ, spec.heightPlates, {
      hasTopStuds: spec.hasTopStuds,
      isSlope: spec.isSlope,
      hasPinHoles: spec.hasPinHoles,
      isPin: spec.isPin,
    }),
    statusFlags: spec.statusFlags,
    availableColors: spec.availableColors,
    weightGrams: spec.weightGrams,
    isSlope: spec.isSlope,
    isRound: spec.isRound,
    hasPinHoles: spec.hasPinHoles,
  };

  CATALOG_MAP.set(spec.partId.toLowerCase(), def);
}

export function getPartById(partId: string): LDrawPartDefinition | undefined {
  const normalized = partId.toLowerCase().endsWith('.dat')
    ? partId.toLowerCase()
    : `${partId.toLowerCase()}.dat`;
  return CATALOG_MAP.get(normalized);
}

export function listAllParts(): LDrawPartDefinition[] {
  return Array.from(CATALOG_MAP.values());
}

export interface PartSearchQuery {
  query?: string;
  category?: PartCategory;
  status?: OrderStatus;
  colorCode?: number;
  limit?: number;
}

export function searchParts(params: PartSearchQuery = {}): LDrawPartDefinition[] {
  const q = params.query?.trim().toLowerCase() ?? '';
  let results = listAllParts();

  if (q) {
    results = results.filter(
      (p) =>
        p.partId.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }
  if (params.category) {
    results = results.filter((p) => p.category === params.category);
  }
  if (params.status) {
    results = results.filter((p) => p.statusFlags.includes(params.status!));
  }
  if (typeof params.colorCode === 'number') {
    results = results.filter((p) => p.availableColors.includes(params.colorCode!));
  }
  if (typeof params.limit === 'number' && params.limit > 0) {
    results = results.slice(0, params.limit);
  }
  return results;
}
