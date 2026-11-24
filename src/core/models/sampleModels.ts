import { CadDocument, CadModel } from '../cad';
import { buildTitanic3000Model } from './titanicModel';
import { buildU99SubmarineModel } from './u99SubmarineModel';
import { buildNeuschwansteinProModel } from './neuschwansteinProModel';

/**
 * Phase 1.5 Machbarkeitsprobe:
 * Tragender Innenkern (Technic-Rahmen mit Pin-Verbindungen) + leichte Außenhaut (Plates/Bricks/Slopes/Tiles).
 * 100 % im 20-LDU-Noppenraster, 0 Kollisionen, 100 % verbunden.
 */
export function buildFeasibilityProbeModel(): CadModel {
  const doc = new CadDocument({
    id: 'model-feasibility-probe',
    name: 'Machbarkeitsprobe: Kern-Modul',
    description: 'Tragender Technic-Innenkern mit leichter farbiger Außenhaut und Noppen-/Pin-Verbindungen.',
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    assemblies: [
      { id: 'asm-core', name: 'Tragender Innenkern', parentId: null, stepOrder: 1 },
      { id: 'asm-shell', name: 'Leichte Außenhaut', parentId: 'asm-core', stepOrder: 2 },
      { id: 'asm-top', name: 'Deck & Abschluss', parentId: 'asm-core', stepOrder: 3 },
    ],
    parts: [],
    metadata: { category: 'Machbarkeitsprobe' },
  });

  // Schritt 1: Fundamentplatte 4x6 (120 x 8 x 80 LDU, centered at 0,0,0 -> studs at ±10, ±30, ±50 in X; ±10, ±30 in Z)
  doc.addPart({ partId: '3032.dat', colorCode: 71, positionLdu: [0, 0, 0], assemblyId: 'asm-core', step: 1 });

  // Schritt 2: Tragender Technic-Innenkern (zwei parallele 1x4 Technic-Steine + Verbindungs-Pins)
  doc.addPart({ partId: '3701.dat', colorCode: 72, positionLdu: [0, 8, -10], assemblyId: 'asm-core', step: 2 });
  doc.addPart({ partId: '3701.dat', colorCode: 72, positionLdu: [0, 8, 10], assemblyId: 'asm-core', step: 2 });
  doc.addPart({ partId: '2780.dat', colorCode: 0, positionLdu: [-20, 18, 0], assemblyId: 'asm-core', step: 2 });
  doc.addPart({ partId: '2780.dat', colorCode: 0, positionLdu: [20, 18, 0], assemblyId: 'asm-core', step: 2 });

  // Schritt 3: Leichte Außenhaut vorne, hinten & seitlich (alle exakt im 20-LDU-Noppenraster!)
  doc.addPart({ partId: '3010.dat', colorCode: 4, positionLdu: [0, 8, 30], assemblyId: 'asm-shell', step: 3 });
  doc.addPart({ partId: '3010.dat', colorCode: 4, positionLdu: [0, 8, -30], assemblyId: 'asm-shell', step: 3 });
  doc.addPart({ partId: '3004.dat', colorCode: 14, positionLdu: [-50, 8, 0], rotationDeg: [0, 90, 0], assemblyId: 'asm-shell', step: 3 });
  doc.addPart({ partId: '3004.dat', colorCode: 14, positionLdu: [50, 8, 0], rotationDeg: [0, 90, 0], assemblyId: 'asm-shell', step: 3 });

  // Schritt 4: Verklammerung (Plates 2x4 verbinden Innenkern mit Außenhaut)
  doc.addPart({ partId: '3020.dat', colorCode: 1, positionLdu: [0, 32, -20], assemblyId: 'asm-top', step: 4 });
  doc.addPart({ partId: '3020.dat', colorCode: 1, positionLdu: [0, 32, 20], assemblyId: 'asm-top', step: 4 });

  // Schritt 5: Glatte Außenhaut-Abdeckung (Tiles & Slopes)
  doc.addPart({ partId: '2431.dat', colorCode: 15, positionLdu: [0, 40, -30], assemblyId: 'asm-top', step: 5 });
  doc.addPart({ partId: '2431.dat', colorCode: 15, positionLdu: [0, 40, 30], assemblyId: 'asm-top', step: 5 });
  doc.addPart({ partId: '3039.dat', colorCode: 14, positionLdu: [-20, 40, 0], assemblyId: 'asm-top', step: 5 });
  doc.addPart({ partId: '3039.dat', colorCode: 14, positionLdu: [20, 40, 0], assemblyId: 'asm-top', step: 5 });

  return doc.getModel();
}

/**
 * Piratenschiff (exakt im 20-LDU-Noppenraster, 0 Kollisionen, 0 Halbnoppen-Versatz, 100 % verbunden!).
 * Grundraster: X = -80..+80 (8 Noppen: ±10, ±30, ±50, ±70), Z = -60..+60 (6 Noppen: ±10, ±30, ±50).
 */
export function buildPirateShipModel(): CadModel {
  const doc = new CadDocument({
    id: 'model-pirate-ship',
    name: 'Piratenschiff',
    description: 'Dreimast-Segelschiff in Rot, Gelb und Blau mit weißen Segeln und roten Flaggen – 100 % rastertreu.',
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    assemblies: [
      { id: 'asm-keel', name: 'Kiel & Unterrumpf', parentId: null, stepOrder: 1 },
      { id: 'asm-hull', name: 'Bordwände & Deck', parentId: 'asm-keel', stepOrder: 2 },
      { id: 'asm-masts', name: 'Masten & Segel', parentId: 'asm-hull', stepOrder: 3 },
    ],
    parts: [],
    metadata: { icon: 'ship', favorite: true },
  });

  // Schritt 1: Blauer Unterkiel (6x8 Platte bei X=-80..+80, Z=-60..+60 + Bugspitze 2x2 Platte bei X=-120..-80 -> kein Overlap!)
  doc.addPart({ partId: '3036.dat', colorCode: 1, positionLdu: [0, 0, 0], assemblyId: 'asm-keel', step: 1 });
  doc.addPart({ partId: '3022.dat', colorCode: 1, positionLdu: [-100, 0, 0], assemblyId: 'asm-keel', step: 1 });

  // Schritt 2: Roter Rumpf (komplett bündig auf Y=8..32, kein Overlap!)
  doc.addPart({ partId: '3008.dat', colorCode: 4, positionLdu: [0, 8, -50], assemblyId: 'asm-hull', step: 2 }); // X:-80..80, Z:-60..-40
  doc.addPart({ partId: '3008.dat', colorCode: 4, positionLdu: [0, 8, 50], assemblyId: 'asm-hull', step: 2 });  // X:-80..80, Z:+40..+60
  doc.addPart({ partId: '3001.dat', colorCode: 4, positionLdu: [60, 8, 0], rotationDeg: [0, 90, 0], assemblyId: 'asm-hull', step: 2 }); // X:40..80, Z:-40..40
  doc.addPart({ partId: '3001.dat', colorCode: 4, positionLdu: [-80, 8, 0], assemblyId: 'asm-hull', step: 2 }); // Verklammert Kiel & Bugspitze (X:-120..-40, Z:-20..20)

  // Schritt 3: Gelbe Deckplatten (überbrücken beide roten Bordwände!) & blaues Mitteldeck (Y=32..48)
  doc.addPart({ partId: '3032.dat', colorCode: 14, positionLdu: [0, 32, 0], rotationDeg: [0, 90, 0], assemblyId: 'asm-hull', step: 3 }); // Plate 4x6 gedreht -> X:-40..40, Z:-60..60 (liegt fest auf beiden Bordwänden!)
  doc.addPart({ partId: '3020.dat', colorCode: 14, positionLdu: [-60, 32, 0], rotationDeg: [0, 90, 0], assemblyId: 'asm-hull', step: 3 }); // X:-80..-40, Z:-40..40 (liegt fest auf Bug-Stein!)
  doc.addPart({ partId: '3010.dat', colorCode: 14, positionLdu: [0, 40, -50], assemblyId: 'asm-hull', step: 3 }); // Reling links auf Deckplatte
  doc.addPart({ partId: '3010.dat', colorCode: 14, positionLdu: [0, 40, 50], assemblyId: 'asm-hull', step: 3 });  // Reling rechts auf Deckplatte
  doc.addPart({ partId: '3020.dat', colorCode: 1, positionLdu: [0, 40, -20], assemblyId: 'asm-hull', step: 3 });  // Blaues Mitteldeck
  doc.addPart({ partId: '3020.dat', colorCode: 1, positionLdu: [0, 40, 20], assemblyId: 'asm-hull', step: 3 });

  // Schritt 4: Heckkabine (Y=32..64 bei X=40..80 -> kein Overlap mit 3031 bei X=-40..40!)
  doc.addPart({ partId: '3001.dat', colorCode: 4, positionLdu: [60, 32, 0], rotationDeg: [0, 90, 0], assemblyId: 'asm-hull', step: 4 });
  doc.addPart({ partId: '3020.dat', colorCode: 14, positionLdu: [60, 56, 0], rotationDeg: [0, 90, 0], assemblyId: 'asm-hull', step: 4 });

  // Schritt 5: Drei braune Masten (Round 1x1 exakt auf Noppen-Koordinaten X=-50, -10, +50 und Z=-10)
  const mastConfigs = [
    { x: -50, baseY: 40 },
    { x: -10, baseY: 48 },
    { x: 50, baseY: 64 },
  ];
  for (const m of mastConfigs) {
    doc.addPart({ partId: '3062b.dat', colorCode: 70, positionLdu: [m.x, m.baseY, -10], assemblyId: 'asm-masts', step: 5 });
    doc.addPart({ partId: '3062b.dat', colorCode: 70, positionLdu: [m.x, m.baseY + 24, -10], assemblyId: 'asm-masts', step: 5 });
    doc.addPart({ partId: '3062b.dat', colorCode: 70, positionLdu: [m.x, m.baseY + 48, -10], assemblyId: 'asm-masts', step: 5 });
  }

  // Schritt 6: Weiße Segel & rote Mastflaggen (exakt auf Mast-Noppe Z=-10 bzw. 2x1 zentriert auf Z=0)
  doc.addPart({ partId: '3004.dat', colorCode: 15, positionLdu: [-50, 112, 0], rotationDeg: [0, 90, 0], assemblyId: 'asm-masts', step: 6 });
  doc.addPart({ partId: '3010.dat', colorCode: 15, positionLdu: [-10, 120, 0], rotationDeg: [0, 90, 0], assemblyId: 'asm-masts', step: 6 });
  doc.addPart({ partId: '3004.dat', colorCode: 15, positionLdu: [50, 136, 0], rotationDeg: [0, 90, 0], assemblyId: 'asm-masts', step: 6 });
  doc.addPart({ partId: '3023.dat', colorCode: 4, positionLdu: [-40, 136, -10], assemblyId: 'asm-masts', step: 6 });
  doc.addPart({ partId: '3023.dat', colorCode: 4, positionLdu: [0, 144, -10], assemblyId: 'asm-masts', step: 6 });
  doc.addPart({ partId: '3023.dat', colorCode: 4, positionLdu: [60, 160, -10], assemblyId: 'asm-masts', step: 6 });

  return doc.getModel();
}

export function buildCastleModel(): CadModel {
  const doc = new CadDocument({
    id: 'model-castle',
    name: 'Burg',
    description: 'Klassische Ritterburg mit vier Ecktürmen, Burgtor und bunten Fahnen – 100 % rastertreu.',
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
    assemblies: [
      { id: 'asm-base', name: 'Burghof', parentId: null, stepOrder: 1 },
      { id: 'asm-walls', name: 'Mauern & Türme', parentId: 'asm-base', stepOrder: 2 },
    ],
    parts: [],
    metadata: { icon: 'castle', favorite: true },
  });

  doc.addPart({ partId: '3036.dat', colorCode: 71, positionLdu: [0, 0, 0], assemblyId: 'asm-base', step: 1 });
  doc.addPart({ partId: '3003.dat', colorCode: 71, positionLdu: [-60, 8, -40], assemblyId: 'asm-walls', step: 2 });
  doc.addPart({ partId: '3003.dat', colorCode: 71, positionLdu: [60, 8, -40], assemblyId: 'asm-walls', step: 2 });
  doc.addPart({ partId: '3003.dat', colorCode: 71, positionLdu: [-60, 8, 40], assemblyId: 'asm-walls', step: 2 });
  doc.addPart({ partId: '3003.dat', colorCode: 71, positionLdu: [60, 8, 40], assemblyId: 'asm-walls', step: 2 });
  doc.addPart({ partId: '3010.dat', colorCode: 72, positionLdu: [0, 8, -50], assemblyId: 'asm-walls', step: 3 });
  doc.addPart({ partId: '3003.dat', colorCode: 71, positionLdu: [-60, 32, -40], assemblyId: 'asm-walls', step: 3 });
  doc.addPart({ partId: '3003.dat', colorCode: 71, positionLdu: [60, 32, -40], assemblyId: 'asm-walls', step: 3 });
  doc.addPart({ partId: '3039.dat', colorCode: 4, positionLdu: [-60, 56, -40], assemblyId: 'asm-walls', step: 4 });
  doc.addPart({ partId: '3039.dat', colorCode: 1, positionLdu: [60, 56, -40], assemblyId: 'asm-walls', step: 4 });

  return doc.getModel();
}

export function buildSpaceRoverModel(): CadModel {
  const doc = new CadDocument({
    id: 'model-space-rover',
    name: 'Weltraum-Rover',
    description: 'Forschungsfahrzeug mit weißer Kabine, roten Akzenten und Kamera-Mast – 100 % rastertreu.',
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    assemblies: [
      { id: 'asm-chassis', name: 'Fahrwerk', parentId: null, stepOrder: 1 },
      { id: 'asm-cabin', name: 'Sensormodul', parentId: 'asm-chassis', stepOrder: 2 },
    ],
    parts: [],
    metadata: { icon: 'rover', favorite: false },
  });

  doc.addPart({ partId: '3032.dat', colorCode: 72, positionLdu: [0, 0, 0], assemblyId: 'asm-chassis', step: 1 });
  doc.addPart({ partId: '3001.dat', colorCode: 15, positionLdu: [0, 8, 0], assemblyId: 'asm-cabin', step: 2 });
  doc.addPart({ partId: '3020.dat', colorCode: 4, positionLdu: [0, 32, 0], assemblyId: 'asm-cabin', step: 3 });
  // 1x1 Round mast & 1x1 sensor brick MUST sit on odd-10 stud coordinate (-10, -10)!
  doc.addPart({ partId: '3062b.dat', colorCode: 71, positionLdu: [-10, 40, -10], assemblyId: 'asm-cabin', step: 4 });
  doc.addPart({ partId: '3005.dat', colorCode: 1, positionLdu: [-10, 64, -10], assemblyId: 'asm-cabin', step: 4 });

  return doc.getModel();
}

export function buildAirplaneModel(): CadModel {
  const doc = new CadDocument({
    id: 'model-airplane',
    name: 'Flugzeug',
    description: 'Blaues Sportflugzeug mit breiten Tragflächen und weißem Seitenleitwerk – 100 % rastertreu.',
    createdAt: '2026-11-23T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
    assemblies: [
      { id: 'asm-wings', name: 'Tragflächen', parentId: null, stepOrder: 1 },
      { id: 'asm-fuselage', name: 'Rumpf & Leitwerk', parentId: 'asm-wings', stepOrder: 2 },
    ],
    parts: [],
    metadata: { icon: 'plane', favorite: false },
  });

  // 3034.dat (2x8 rotated 90 deg -> X:-20..20, Z:-80..80)
  doc.addPart({ partId: '3034.dat', colorCode: 1, positionLdu: [0, 0, 0], rotationDeg: [0, 90, 0], assemblyId: 'asm-wings', step: 1 });
  // 3008.dat (1x8 along X -> needs Z=-10 to sit on stud grid!)
  doc.addPart({ partId: '3008.dat', colorCode: 1, positionLdu: [0, 8, -10], assemblyId: 'asm-fuselage', step: 2 });
  // Cockpit slope 2x2 centered at (-20, 32, 0) -> X:-40..0, Z:-20..20 (sits on 3008 & wing!)
  doc.addPart({ partId: '3039.dat', colorCode: 73, positionLdu: [-20, 32, 0], assemblyId: 'asm-fuselage', step: 3 });
  // Tail fin 1x1 at (+70, 32, -10) -> exact stud coordinate!
  doc.addPart({ partId: '3005.dat', colorCode: 15, positionLdu: [70, 32, -10], assemblyId: 'asm-fuselage', step: 4 });

  return doc.getModel();
}

export function getStarterBlueprints(): CadModel[] {
  return [
    buildNeuschwansteinProModel(),
    buildU99SubmarineModel(),
    buildPirateShipModel(),
    buildTitanic3000Model(3000),
    buildCastleModel(),
    buildSpaceRoverModel(),
    buildAirplaneModel(),
    buildFeasibilityProbeModel(),
  ];
}
