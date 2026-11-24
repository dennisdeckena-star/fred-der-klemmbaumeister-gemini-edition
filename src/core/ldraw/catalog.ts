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

  // === ERWEITERTER MODERNER AFOL-KATALOG (CC BY 4.0 / LDraw Standard: Clips, Flügel-Slopes, Kacheln, SNOT, Technic-Skelett, Bögen) ===
  // Zusätzliche glatte Kacheln ohne Noppen (Tiles)
  { partId: '63864.dat', name: 'Tile 1 x 3 Smooth', category: 'Tile', studsX: 3, studsZ: 1, heightPlates: 1, weightGrams: 0.46, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '6636.dat', name: 'Tile 1 x 6 Smooth', category: 'Tile', studsX: 6, studsZ: 1, heightPlates: 1, weightGrams: 0.92, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '4162.dat', name: 'Tile 1 x 8 Smooth', category: 'Tile', studsX: 8, studsZ: 1, heightPlates: 1, weightGrams: 1.24, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '26603.dat', name: 'Tile 2 x 3 Smooth', category: 'Tile', studsX: 3, studsZ: 2, heightPlates: 1, weightGrams: 0.85, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '87079.dat', name: 'Tile 2 x 4 Smooth', category: 'Tile', studsX: 4, studsZ: 2, heightPlates: 1, weightGrams: 1.12, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '69729.dat', name: 'Tile 2 x 6 Smooth', category: 'Tile', studsX: 6, studsZ: 2, heightPlates: 1, weightGrams: 1.68, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '98138.dat', name: 'Tile 1 x 1 Round Smooth', category: 'Tile', studsX: 1, studsZ: 1, heightPlates: 1, weightGrams: 0.12, hasTopStuds: false, isRound: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '14769.dat', name: 'Tile 2 x 2 Round Smooth', category: 'Tile', studsX: 2, studsZ: 2, heightPlates: 1, weightGrams: 0.44, hasTopStuds: false, isRound: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '24246.dat', name: 'Tile 1 x 1 Half Circle Smooth', category: 'Tile', studsX: 1, studsZ: 1, heightPlates: 1, weightGrams: 0.14, hasTopStuds: false, isRound: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '35787.dat', name: 'Tile 2 x 2 Triangular Smooth', category: 'Tile', studsX: 2, studsZ: 2, heightPlates: 1, weightGrams: 0.32, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '22385.dat', name: 'Tile 2 x 3 Pentagonal Shield Smooth', category: 'Tile', studsX: 3, studsZ: 2, heightPlates: 1, weightGrams: 0.65, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '2412b.dat', name: 'Tile 1 x 2 Grille Radiator', category: 'Tile', studsX: 2, studsZ: 1, heightPlates: 1, weightGrams: 0.28, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },

  // Moderne Curved Slopes, Cheese Slopes & Schräg-/Flügel-Slopes (Wedges)
  { partId: '54200.dat', name: 'Slope 30 1 x 1 x 2/3 (Cheese Slope)', category: 'Slope', studsX: 1, studsZ: 1, heightPlates: 2, weightGrams: 0.22, hasTopStuds: false, isSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '85984.dat', name: 'Slope 30 1 x 2 x 2/3 (Cheese Slope)', category: 'Slope', studsX: 2, studsZ: 1, heightPlates: 2, weightGrams: 0.42, hasTopStuds: false, isSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '11477.dat', name: 'Slope Curved 2 x 1 No Studs', category: 'Slope', studsX: 2, studsZ: 1, heightPlates: 2, weightGrams: 0.39, hasTopStuds: false, isCurvedSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '15068.dat', name: 'Slope Curved 2 x 2 No Studs', category: 'Slope', studsX: 2, studsZ: 2, heightPlates: 2, weightGrams: 0.74, hasTopStuds: false, isCurvedSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '93273.dat', name: 'Slope Curved 4 x 1 Double No Studs', category: 'Slope', studsX: 4, studsZ: 1, heightPlates: 2, weightGrams: 0.82, hasTopStuds: false, isCurvedSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '24201.dat', name: 'Slope Curved Inverted 2 x 1', category: 'Slope', studsX: 2, studsZ: 1, heightPlates: 2, weightGrams: 0.38, isInvertedSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3298.dat', name: 'Slope 33 3 x 2', category: 'Slope', studsX: 3, studsZ: 2, heightPlates: 3, weightGrams: 1.52, isSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '4286.dat', name: 'Slope 33 3 x 1', category: 'Slope', studsX: 3, studsZ: 1, heightPlates: 3, weightGrams: 0.88, isSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '43722.dat', name: 'Wedge Plate 3 x 2 Right (Flügel-Slope)', category: 'Plate', studsX: 3, studsZ: 2, heightPlates: 1, weightGrams: 0.68, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '43723.dat', name: 'Wedge Plate 3 x 2 Left (Flügel-Slope)', category: 'Plate', studsX: 3, studsZ: 2, heightPlates: 1, weightGrams: 0.68, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '41769.dat', name: 'Wedge Plate 4 x 2 Right (Flügel-Slope)', category: 'Plate', studsX: 4, studsZ: 2, heightPlates: 1, weightGrams: 0.94, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '41770.dat', name: 'Wedge Plate 4 x 2 Left (Flügel-Slope)', category: 'Plate', studsX: 4, studsZ: 2, heightPlates: 1, weightGrams: 0.94, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '54383.dat', name: 'Wing Plate 6 x 3 Right (Flügel-Slope)', category: 'Plate', studsX: 6, studsZ: 3, heightPlates: 1, weightGrams: 1.75, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '54384.dat', name: 'Wing Plate 6 x 3 Left (Flügel-Slope)', category: 'Plate', studsX: 6, studsZ: 3, heightPlates: 1, weightGrams: 1.75, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '43719.dat', name: 'Wedge Plate 4 x 4 Cut Corner', category: 'Plate', studsX: 4, studsZ: 4, heightPlates: 1, weightGrams: 1.82, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '47753.dat', name: 'Wedge Slope 4 x 4 No Studs (Rumpf/Flügel)', category: 'Slope', studsX: 4, studsZ: 4, heightPlates: 2, weightGrams: 2.15, hasTopStuds: false, isCurvedSlope: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '2420.dat', name: 'Plate 2 x 2 Corner', category: 'Plate', studsX: 2, studsZ: 2, heightPlates: 1, weightGrams: 0.44, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },

  // Clips, Bars & Scharniere (Hinges) für Winkel, Klappen, Takelage & Hüllen
  { partId: '4085d.dat', name: 'Plate 1 x 1 with Vertical Clip', category: 'Special', studsX: 1, studsZ: 1, heightPlates: 1, weightGrams: 0.24, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '6019.dat', name: 'Plate 1 x 1 with Horizontal Clip', category: 'Special', studsX: 1, studsZ: 1, heightPlates: 1, weightGrams: 0.25, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '60470b.dat', name: 'Plate 1 x 2 with 2 Horizontal Clips', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 1, weightGrams: 0.42, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '48336.dat', name: 'Plate 1 x 2 with Handle Bar', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 1, weightGrams: 0.41, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '60478.dat', name: 'Plate 1 x 2 with Bar Handle on End', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 1, weightGrams: 0.39, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '30237b.dat', name: 'Brick 1 x 2 with Vertical Clip', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 3, weightGrams: 0.86, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3937.dat', name: 'Hinge Brick 1 x 2 Base (Scharnier)', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 3, weightGrams: 0.72, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3938.dat', name: 'Hinge Brick 1 x 2 Top Plate (Scharnier)', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 1, weightGrams: 0.34, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '44302.dat', name: 'Hinge Plate 1 x 2 Locking (Winkel-Hülle)', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 1, weightGrams: 0.36, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '30374.dat', name: 'Bar 4L (Takelage / Antenne / Griff)', category: 'Special', studsX: 1, studsZ: 1, heightPlates: 4, weightGrams: 0.26, hasTopStuds: false, isMastPole: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },

  // Erweiterte SNOT-Brackets & Modified Bricks (für noppenfreie Außenhüllen!)
  { partId: '99780.dat', name: 'Bracket 1 x 2 - 1 x 2 Up (SNOT Cladding)', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 2, weightGrams: 0.54, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '44728.dat', name: 'Bracket 1 x 2 - 2 x 2 (SNOT Cladding)', category: 'Special', studsX: 2, studsZ: 2, heightPlates: 2, weightGrams: 0.76, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '4733.dat', name: 'Brick 1 x 1 with Studs on 4 Sides (SNOT Core)', category: 'Special', studsX: 1, studsZ: 1, heightPlates: 3, weightGrams: 0.52, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '4070.dat', name: 'Brick 1 x 1 Headlight / Erling (SNOT)', category: 'Special', studsX: 1, studsZ: 1, heightPlates: 3, weightGrams: 0.46, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '22885.dat', name: 'Brick 1 x 2 x 3 with Studs on Side (SNOT)', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 5, weightGrams: 1.45, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '87580.dat', name: 'Plate Modified 2 x 2 with 1 Stud (Jumper)', category: 'Plate', studsX: 2, studsZ: 2, heightPlates: 1, weightGrams: 0.52, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },

  // Erweiterte Technic-Skelett-Teile (für verwindungssteife Großmodelle!)
  { partId: '64178.dat', name: 'Technic Liftarm Frame 5 x 11 Open Center', category: 'Technic', studsX: 11, studsZ: 5, heightPlates: 3, weightGrams: 7.4, hasTopStuds: false, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 71, 72] },
  { partId: '40490.dat', name: 'Technic Liftarm 1 x 9 Thick', category: 'Technic', studsX: 9, studsZ: 1, heightPlates: 3, weightGrams: 2.1, hasTopStuds: false, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 4, 14, 71, 72] },
  { partId: '32525.dat', name: 'Technic Liftarm 1 x 11 Thick', category: 'Technic', studsX: 11, studsZ: 1, heightPlates: 3, weightGrams: 2.55, hasTopStuds: false, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 4, 14, 71, 72] },
  { partId: '41239.dat', name: 'Technic Liftarm 1 x 13 Thick', category: 'Technic', studsX: 13, studsZ: 1, heightPlates: 3, weightGrams: 3.02, hasTopStuds: false, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 71, 72] },
  { partId: '32278.dat', name: 'Technic Liftarm 1 x 15 Thick', category: 'Technic', studsX: 15, studsZ: 1, heightPlates: 3, weightGrams: 3.48, hasTopStuds: false, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 71, 72] },
  { partId: '3702.dat', name: 'Technic Brick 1 x 8 with Holes', category: 'Technic', studsX: 8, studsZ: 1, heightPlates: 3, weightGrams: 3.05, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 1, 4, 14, 15, 71, 72] },
  { partId: '3895.dat', name: 'Technic Brick 1 x 12 with Holes', category: 'Technic', studsX: 12, studsZ: 1, heightPlates: 3, weightGrams: 4.55, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 71, 72] },
  { partId: '3703.dat', name: 'Technic Brick 1 x 16 with Holes', category: 'Technic', studsX: 16, studsZ: 1, heightPlates: 3, weightGrams: 6.1, hasPinHoles: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 71, 72] },
  { partId: '6558.dat', name: 'Technic Pin 3L Long with Friction', category: 'Technic', studsX: 1, studsZ: 3, heightPlates: 1, weightGrams: 0.28, isPin: true, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 1, 72] },
  { partId: '3705.dat', name: 'Technic Axle 4L', category: 'Technic', studsX: 4, studsZ: 1, heightPlates: 1, weightGrams: 0.42, isPin: true, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 72] },
  { partId: '3706.dat', name: 'Technic Axle 6L', category: 'Technic', studsX: 6, studsZ: 1, heightPlates: 1, weightGrams: 0.64, isPin: true, hasTopStuds: false, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: [0, 72] },

  // Bögen, Fenster & Architektur-Elemente
  { partId: '3659.dat', name: 'Arch 1 x 4 (Bogen)', category: 'Special', studsX: 4, studsZ: 1, heightPlates: 3, weightGrams: 1.05, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '6182.dat', name: 'Arch 1 x 4 x 2 (Torbogen)', category: 'Special', studsX: 4, studsZ: 1, heightPlates: 6, weightGrams: 1.85, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '3307.dat', name: 'Arch 1 x 6 (Großbogen)', category: 'Special', studsX: 6, studsZ: 1, heightPlates: 3, weightGrams: 1.62, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '60592.dat', name: 'Window 1 x 2 x 2 Frame', category: 'Special', studsX: 2, studsZ: 1, heightPlates: 6, weightGrams: 1.15, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '60594.dat', name: 'Window 1 x 4 x 3 Frame', category: 'Special', studsX: 4, studsZ: 1, heightPlates: 9, weightGrams: 2.35, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
  { partId: '43898.dat', name: 'Dish 3 x 3 Inverted (Kuppel/Radar)', category: 'Special', studsX: 3, studsZ: 3, heightPlates: 1, weightGrams: 0.84, hasTopStuds: false, isRound: true, statusFlags: ['CONFIRMED_GEOMETRY', 'CONFIRMED_COLOR', 'ORDERABLE'], availableColors: STANDARD_COLORS },
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
