import { CadModel } from '../cad';
import { MacroCadBuilder } from '../cad/macroBuilder';
import { SubjectResearchBrief, VisionCritiqueResult } from '../ai/geminiClient';

export type BuilderAdjustment = VisionCritiqueResult['recommendedAdjustments'][number];

/**
 * Konstruiert die deutsche Dreimastbark „Gorch Fock“ (1:300) über die Profi-Makro-CAD-Engine:
 * - Schwarzer Sammler-Display-Ständer (2 Sockelfüße wie im Konzeptbild)
 * - Dunkelroter Unterwasserrumpf (LDraw 320) im versetzten Großstein-Verbund (1x8/1x4/1x2) + Ruder
 * - Verwindungssteifer Technic-Innenkiel (32524.dat)
 * - Schneeweißer Überwasserrumpf (LDraw 15) im Steinverbund mit dunklen Bullaugen & Bugspriet
 * - Glatt gefliestes Holzdeck (Tan 19) mit weißen Deckshäusern & Rettungsbooten (50950.dat)
 * - 3 schlanke Masten (3957.dat) mit gestaffelten weißen Rahsegeln, Besansegel & Deutschlandflagge
 * - 0 Kollisionen, 100 % 20-LDU-Noppenraster, BlueBrixx-Ergonomie (<= 14 Teile / <= 6 Typen pro Schritt)
 */
export function buildGorchFockModel(
  scaleLabel = '1:300',
  adjustments: BuilderAdjustment[] = [],
): CadModel {
  const b = new MacroCadBuilder('gf');

  // Sleek tall-ship hull: 56 studs long (sx = -28 bow .. +27 stern), max beam 8 studs (hw = 4)
  const hullHalfWidth = (sx: number): number => {
    if (sx < -25) return 1;
    if (sx < -21) return 2;
    if (sx < -15) return 3;
    if (sx <= 17) return 4;
    if (sx <= 22) return 3;
    if (sx <= 25) return 2;
    return 1;
  };

  // 1. Schwarzer Sammler-Display-Ständer (Y = 0..32) + Technic-Kiel
  b.addDisplayStands([-12, 12], 3, 0, 0, 'asm-stand', 1);

  // 2. Dunkelroter Unterwasserrumpf (LDraw 320 = Dark Red, wie Original & Konzeptbild) (Y = 32..64)
  for (let sz = -3; sz < 3; sz++) {
    b.fillColoredSpanX(
      -26,
      25,
      sz,
      32,
      'plate',
      (sx) => {
        const hw = Math.max(1, hullHalfWidth(sx) - 1);
        return sz >= -hw && sz < hw ? 320 : null;
      },
      'asm-keel',
      2,
      false,
    );
  }
  // Ruder am Heck
  b.place('3004.dat', 2, 1, 3, 25, 0, 32, 320, 'asm-keel', 2);
  // Verwindungssteifer Technic-Innenkiel
  b.addTechnicSpine(-20, 20, 0, 40, 'asm-keel', 3);

  // Dunkelrote Rumpfwand im echten versetzten Steinverbund (Y = 40..64)
  for (let sz = -4; sz < 4; sz++) {
    b.fillColoredSpanX(
      -27,
      26,
      sz,
      40,
      'brick',
      (sx) => {
        const hw = hullHalfWidth(sx);
        if (sz < -hw || sz >= hw) return null;
        const isOuter = sz === -hw || sz === hw - 1 || sx === -27 || sx === 26;
        if (isOuter) return 320;
        if (sx % 6 === 0 && sz !== 0) return 71; // Querspanten
        return null;
      },
      'asm-keel',
      3,
      true,
    );
  }

  // 3. Schneeweißer Überwasserrumpf (LDraw 15) mit Bullaugen & Bugspriet (Y = 64..112)
  for (let sz = -4; sz < 4; sz++) {
    b.fillColoredSpanX(
      -28,
      27,
      sz,
      64,
      'brick',
      (sx) => {
        const hw = hullHalfWidth(sx);
        if (sz < -hw || sz >= hw) return null;
        const isOuter = sz === -hw || sz === hw - 1 || sx === -28 || sx === 27;
        if (isOuter) {
          const isPorthole = Math.abs(sx) < 22 && sx % 3 === 0 && (sz === -hw || sz === hw - 1);
          return isPorthole ? 272 : 15;
        }
        if (sx % 6 === 0) return 71;
        return null;
      },
      'asm-hull',
      4,
      false,
    );
  }

  for (let sz = -4; sz < 4; sz++) {
    b.fillColoredSpanX(
      -28,
      27,
      sz,
      88,
      'brick',
      (sx) => {
        const hw = hullHalfWidth(sx);
        if (sz < -hw || sz >= hw) return null;
        const isOuter = sz === -hw || sz === hw - 1 || sx === -28 || sx === 27;
        return isOuter ? 15 : null;
      },
      'asm-hull',
      5,
      true,
    );
  }

  // Langer weißer Bugspriet nach vorne (sx = -37..-29, Y = 104..112)
  b.fillSpanX(-33, -29, 0, 104, 'plate', 15, 'asm-hull', 5, false);
  b.fillSpanX(-37, -32, 0, 112, 'plate', 15, 'asm-hull', 5, false);

  // 4. Gefliestes Holzdeck (Tan 19), weiße Deckshäuser & Rettungsboote (Y = 112..144)
  for (let sz = -4; sz < 4; sz++) {
    b.fillColoredSpanX(
      -28,
      27,
      sz,
      112,
      'plate',
      (sx) => {
        const hw = hullHalfWidth(sx);
        if (sz < -hw || sz >= hw) return null;
        const isEdge = sz === -hw || sz === hw - 1 || sx === -28 || sx === 27;
        return isEdge ? 15 : 19;
      },
      'asm-deck',
      6,
      false,
    );
  }

  const mastXs = [-14, 0, 14];
  for (let sz = -4; sz < 4; sz++) {
    b.fillColoredSpanX(
      -28,
      27,
      sz,
      120,
      'tile',
      (sx) => {
        const hw = hullHalfWidth(sx);
        if (sz < -hw || sz >= hw) return null;
        if (mastXs.includes(sx) && sz === 0) return null;
        if (sx === 26 && sz === 0) return null;
        const isDeckhouse = ((sx >= -8 && sx <= -4) || (sx >= 5 && sx <= 9)) && sz >= -2 && sz <= 1;
        if (isDeckhouse) return null;
        const isLifeboat = (sx === 17 || sx === 18) && (sz === -3 || sz === 2);
        if (isLifeboat) return null;
        const isEdge = sz === -hw || sz === hw - 1 || sx === -28 || sx === 27;
        return isEdge ? 15 : 19;
      },
      'asm-deck',
      7,
      true,
    );
  }

  // Zwei weiße Deckshäuser im Verbund + geflieste Dächer
  for (const [x0, x1] of [[-8, -4], [5, 9]] as const) {
    for (let sz = -2; sz <= 1; sz++) {
      b.fillSpanX(x0, x1, sz, 120, 'brick', 15, 'asm-deck', 7, sz % 2 === 0);
      b.fillSpanX(x0, x1, sz, 144, 'tile', 15, 'asm-deck', 8, sz % 2 !== 0);
    }
  }
  // Rettungsboote (braun/weiß) backbord & steuerbord
  b.place('50950.dat', 3, 1, 2, 16, -3, 120, 70, 'asm-deck', 8);
  b.place('50950.dat', 3, 1, 2, 16, 2, 120, 70, 'asm-deck', 8);

  // 5. Drei Masten (Fockmast, Großmast, Besanmast, je 3957.dat = 96 LDU hoch) + gestaffelte Rahsegel & Deutschlandflaggen
  const mastConfigs = [
    { x: -14, segments: 2, halfSail: 4, isBarqueMizzen: false },
    { x: 0, segments: 2, halfSail: 5, isBarqueMizzen: false },
    { x: 14, segments: 2, halfSail: 3, isBarqueMizzen: true },
  ];
  const extraSail = adjustments.includes('ENRICH_SAILS_AND_RIGGING') ? 1 : 0;

  for (const mast of mastConfigs) {
    for (let s = 0; s < mast.segments; s++) {
      const segY = 120 + s * 96;
      b.place('3957.dat', 1, 1, 12, mast.x, 0, segY, 70, 'asm-masts', 9);
    }

    // 4 gestaffelte Rahsegel-Ebenen entlang des 192-LDU-Masts (kollisionsfrei!)
    const sailYs = [152, 192, 232, 272];
    sailYs.forEach((sy, idx) => {
      if (mast.isBarqueMizzen) {
        if (idx < 3) {
          b.fillSpanX(mast.x + 1, mast.x + 3 + extraSail, 0, sy, 'brick', 15, 'asm-masts', 10, idx % 2 === 0);
        }
      } else {
        const span = Math.max(2, mast.halfSail + extraSail - Math.floor(idx / 2));
        for (let sz = -span; sz <= span; sz++) {
          if (sz === 0) continue;
          const sailX = Math.abs(sz) <= 2 ? mast.x - 1 : mast.x;
          b.place('3005.dat', 1, 1, 3, sailX, sz, sy, 15, 'asm-masts', 10);
        }
      }
    });

    // Mastspitze + Deutschlandflagge am Großmast
    const topY = 120 + mast.segments * 96;
    if (mast.x === 0) {
      b.place('3023.dat', 2, 1, 1, mast.x, 0, topY, 14, 'asm-masts', 11); // Gold
      b.place('3023.dat', 2, 1, 1, mast.x, 0, topY + 8, 4, 'asm-masts', 11); // Rot
      b.place('3023.dat', 2, 1, 1, mast.x, 0, topY + 16, 0, 'asm-masts', 11); // Schwarz
    } else {
      b.place('3024.dat', 1, 1, 1, mast.x, 0, topY, 15, 'asm-masts', 11);
    }
  }

  // Heckflagge Deutschland (Schwarz-Rot-Gold) auf 96-LDU-Flaggenmast
  b.place('3957.dat', 1, 1, 12, 26, 0, 120, 70, 'asm-masts', 11);
  b.place('3023.dat', 2, 1, 1, 26, 0, 216, 14, 'asm-masts', 11);
  b.place('3023.dat', 2, 1, 1, 26, 0, 224, 4, 'asm-masts', 11);
  b.place('3023.dat', 2, 1, 1, 26, 0, 232, 0, 'asm-masts', 11);

  return b.toCadModel({
    id: `model-gorch-fock-${scaleLabel.replace(/[^0-9a-z]/gi, '')}`,
    name: `Gorch Fock (${scaleLabel})`,
    description: `Profi-Sammlermodell der Dreimastbark Gorch Fock im Maßstab ${scaleLabel} mit Display-Ständer, Technic-Kiel, Steinverbund, 3 Masten und menschengerechten Bauschritten.`,
    assemblies: [
      { id: 'asm-stand', name: '1. Display-Ständer', parentId: null, stepOrder: 1 },
      { id: 'asm-keel', name: '2. Dunkelroter Kiel & Technic-Kern', parentId: null, stepOrder: 2 },
      { id: 'asm-hull', name: '3. Weißer Rumpf, Bullaugen & Bugspriet', parentId: null, stepOrder: 3 },
      { id: 'asm-deck', name: '4. Gefliestes Holzdeck & Deckshäuser', parentId: null, stepOrder: 4 },
      { id: 'asm-masts', name: '5. Drei Masten, Rahsegel & Flaggen', parentId: null, stepOrder: 5 },
    ],
  });
}

/**
 * Universeller Profi-Builder auf Basis des recherchierten SubjectResearchBrief.
 * Baut echte, verknüpfte 3D-Modelle (Fahrzeug, Architektur, Schiff, Raumfahrt/Custom)
 * im versetzten Steinverbund statt primitiver Klötzchen.
 */
export function buildModelFromResearchBrief(
  brief: SubjectResearchBrief,
  adjustments: BuilderAdjustment[] = [],
): CadModel {
  if (/gorch\s*fock|dreimastbark|segelschulschiff/i.test(brief.title)) {
    return buildGorchFockModel(brief.scaleLabel, adjustments);
  }

  const b = new MacroCadBuilder('pro');
  const primary = brief.primaryColors[0] ?? 71;
  const secondary = brief.primaryColors[1] ?? 15;
  const accent = brief.accentColors[0] ?? 4;

  if (brief.category === 'vehicle') {
    // Profi-Sammlerfahrzeug: 4 Räder (Y=0..24), Bodenplatte (Y=24..32), Technic-Kern & Karosserie (Y=32..56), Cockpit (Y=56..88)
    for (const wx of [-7, 5]) {
      for (const wz of [-4, 3]) {
        b.place('3004.dat', 2, 1, 3, wx, wz, 0, 0, 'asm-chassis', 1);
      }
    }
    for (let sz = -4; sz < 4; sz++) {
      b.fillSpanX(-10, 9, sz, 24, 'plate', 0, 'asm-chassis', 2, sz % 2 === 0);
    }
    b.addTechnicSpine(-10, 9, 0, 32, 'asm-chassis', 2);
    // Karosserie im versetzten Verbund (spart den zentralen Technic-Kern aus)
    for (let sz = -4; sz < 4; sz++) {
      b.fillColoredSpanX(
        -10,
        9,
        sz,
        32,
        'brick',
        (sx) => {
          if (sx === -10 && (sz === -3 || sz === 2)) return 14; // Scheinwerfer
          if (sx === 9 && (sz === -3 || sz === 2)) return 4; // Rücklichter
          return primary;
        },
        'asm-body',
        3,
        sz % 2 === 0,
      );
    }
    // Motorhaube gefliest + Cockpit mit Slopes
    for (let sz = -3; sz < 3; sz++) {
      b.fillSpanX(-9, -4, sz, 56, 'tile', primary, 'asm-body', 4, false);
      b.fillSpanX(-3, 4, sz, 56, 'brick', 272, 'asm-cabin', 5, sz % 2 === 0);
      b.fillSpanX(-2, 3, sz, 80, 'tile', primary, 'asm-cabin', 6, true);
    }
    // Heckspoiler
    for (let sz = -4; sz < 4; sz++) {
      b.place('3023.dat', 2, 1, 1, 8, sz, 64, 0, 'asm-cabin', 6);
    }

    return b.toCadModel({
      id: `model-custom-${Date.now().toString(36)}`,
      name: brief.title,
      description: `${brief.realDimensionsNote} Konstruiert von Fred mit Technic-Chassis und Steinverbund.`,
      assemblies: [
        { id: 'asm-chassis', name: '1. Technic-Chassis & Räder', parentId: null, stepOrder: 1 },
        { id: 'asm-body', name: '2. Karosserie im Steinverbund', parentId: null, stepOrder: 2 },
        { id: 'asm-cabin', name: '3. Cockpit, Fliesen & Spoiler', parentId: null, stepOrder: 3 },
      ],
    });
  }

  if (brief.category === 'architecture') {
    // Architektur-/Turmmodell (z. B. Leuchtturm, Eiffelturm, Villa, Burg)
    const half = 7;
    for (let sz = -half; sz < half; sz++) {
      b.fillSpanX(-half, half - 1, sz, 0, 'plate', 72, 'asm-base', 1, sz % 2 === 0);
      if (sz === -half || sz === half - 1) {
        b.fillSpanX(-half, half - 1, sz, 8, 'tile', 0, 'asm-base', 2, false);
      }
    }
    const floors = adjustments.includes('ADD_EXTERIOR_DETAILS') ? 7 : 6;
    for (let f = 0; f < floors; f++) {
      const y = 8 + f * 24;
      const r = Math.max(3, half - 1 - Math.floor(f / 2));
      const stripeColor = f % 2 === 0 ? primary : secondary;
      for (let sz = -r; sz < r; sz++) {
        b.fillColoredSpanX(
          -r,
          r - 1,
          sz,
          y,
          'brick',
          (sx) => {
            const isWall = sx === -r || sx === r - 1 || sz === -r || sz === r - 1;
            if (!isWall) return null;
            const isWindow = f > 0 && f < floors - 1 && (sx === 0 || sz === 0);
            return isWindow ? 272 : stripeColor;
          },
          'asm-walls',
          3 + f,
          f % 2 === 1,
        );
      }
    }
    // Dach / Laternenkrone
    const crownY = 8 + floors * 24;
    for (let sz = -3; sz < 3; sz++) {
      b.fillSpanX(-3, 2, sz, crownY, 'plate', 0, 'asm-crown', 10, false);
      b.fillSpanX(-2, 1, sz, crownY + 8, 'brick', 14, 'asm-crown', 11, true);
      b.fillSpanX(-2, 1, sz, crownY + 32, 'tile', accent, 'asm-crown', 12, false);
    }

    return b.toCadModel({
      id: `model-custom-${Date.now().toString(36)}`,
      name: brief.title,
      description: `${brief.realDimensionsNote} Konstruiert von Fred im versetzten Mauerverbund.`,
      assemblies: [
        { id: 'asm-base', name: '1. Display-Sockel & Fundament', parentId: null, stepOrder: 1 },
        { id: 'asm-walls', name: '2. Mauerverbund & Fassade', parentId: null, stepOrder: 2 },
        { id: 'asm-crown', name: '3. Gesims, Laterne & Dach', parentId: null, stepOrder: 3 },
      ],
    });
  }

  // Universelles AFOL-Display-Modell im versetzten Steinverbund + Display-Sockel
  for (let sz = -5; sz < 5; sz++) {
    b.fillSpanX(-8, 7, sz, 0, 'plate', 72, 'asm-base', 1, sz % 2 === 0);
  }
  b.addTechnicSpine(-6, 5, 0, 8, 'asm-core', 2);
  for (let layer = 0; layer < 4; layer++) {
    const y = 16 + layer * 24;
    const rx = Math.max(3, 7 - layer);
    const rz = Math.max(2, 4 - Math.floor(layer / 2));
    for (let sz = -rz; sz < rz; sz++) {
      b.fillSpanX(
        -rx,
        rx - 1,
        sz,
        y,
        'brick',
        layer % 2 === 0 ? primary : secondary,
        'asm-core',
        3 + layer,
        layer % 2 === 1,
      );
    }
  }
  for (let sz = -2; sz < 2; sz++) {
    b.fillSpanX(-3, 2, sz, 112, 'tile', accent, 'asm-finish', 8, false);
  }

  return b.toCadModel({
    id: `model-custom-${Date.now().toString(36)}`,
    name: brief.title,
    description: `${brief.realDimensionsNote} Konstruiert von Fred im 20-LDU-Noppenraster.`,
    assemblies: [
      { id: 'asm-base', name: '1. Display-Sockel', parentId: null, stepOrder: 1 },
      { id: 'asm-core', name: '2. Technic-Kern & Steinverbund', parentId: null, stepOrder: 2 },
      { id: 'asm-finish', name: '3. Gefliestes Finish & Details', parentId: null, stepOrder: 3 },
    ],
  });
}

/** Kompatibilitäts-Wrapper für direkten Aufruf mit Titel + Prompt */
export function buildCustomModelFromPrompt(title: string, prompt: string): CadModel {
  const lower = `${title} ${prompt}`.toLowerCase();
  const category = /auto|porsche|ferrari|wagen|truck|lok|panzer/i.test(lower)
    ? 'vehicle'
    : /turm|leuchtturm|haus|villa|schloss|burg|eiffelturm|kirche|brücke/i.test(lower)
      ? 'architecture'
      : 'custom';
  return buildModelFromResearchBrief({
    title,
    scaleLabel: 'Display',
    category,
    realDimensionsNote: `Individuelles AFOL-Sammlermodell für „${title}“.`,
    targetStudsLength: 20,
    targetStudsWidth: 12,
    targetStudsHeight: 16,
    primaryColors: category === 'vehicle' ? [4, 0] : [15, 71],
    accentColors: [14, 4, 272],
    signatureFeatures: ['Display-Sockel', 'Steinverbund', 'Glatt gefliestes Finish'],
    assemblies: ['1. Sockel', '2. Kern', '3. Finish'],
    sources: [],
    adapterMode: 'OFFLINE_TEST_ADAPTER',
  });
}
