import { CadModel, createTransformMatrix, PartInstance } from '../cad';
import { rebalanceStepsForHumans } from '../cad/bomAndSteps';

/**
 * Ingenieur-Konstruktion der RMS Titanic (COBI 1:450 / LEGO-Display-Standard):
 * - Echte Verbundbauweise mit Langsteinen & Langplatten (1x8, 1x4, 1x2, 1x1) und glatten Tiles (1x4, 1x2, 1x1)
 * - 90 Noppen Länge (9:1-Verhältnis), roter Unterwasserkiel mit Ruder, schwarzer Hochrumpf mit Bullaugen,
 *   weiße Relinglinie, erhöhte Back (Bug), Welldecks, hohe weiße Promenadendecks, Kommandobrücken-Nocken,
 *   16 weiße Rettungsboote, 4 runde ocker-schwarze Schornsteine, 2 schlanke Masten mit Krähennestern & Flaggen.
 * - Garantierte Vollständigkeit: Außenhaut, Decks, Rettungsboote, 4 Schornsteine und 2 Masten werden ZUERST
 *   komplett konstruiert; danach wird der innere Ballast-/Spantenkern sauber auf die Zielteilezahl ergänzt.
 */
export function buildTitanic3000Model(targetParts = 3000): CadModel {
  const parts: PartInstance[] = [];
  const occupied = new Set<string>();
  let count = 0;

  const canPlace = (w: number, d: number, hPlates: number, sx: number, sz: number, yLdu: number): boolean => {
    for (let yy = yLdu; yy < yLdu + hPlates * 8; yy += 8) {
      for (let dx = 0; dx < w; dx++) {
        for (let dz = 0; dz < d; dz++) {
          if (occupied.has(`${yy}:${sx + dx}:${sz + dz}`)) return false;
        }
      }
    }
    return true;
  };

  const place = (
    partId: string,
    w: number,
    d: number,
    hPlates: number,
    sx: number,
    sz: number,
    yLdu: number,
    colorCode: number,
    assemblyId: string,
    step: number,
    rotationDeg: [number, number, number] = [0, 0, 0],
  ): boolean => {
    if (!canPlace(w, d, hPlates, sx, sz, yLdu)) return false;

    for (let yy = yLdu; yy < yLdu + hPlates * 8; yy += 8) {
      for (let dx = 0; dx < w; dx++) {
        for (let dz = 0; dz < d; dz++) {
          occupied.add(`${yy}:${sx + dx}:${sz + dz}`);
        }
      }
    }

    const cx = (sx + w / 2) * 20;
    const cz = (sz + d / 2) * 20;
    const transform = {
      positionLdu: [cx, yLdu, cz] as [number, number, number],
      rotationDeg,
    };
    count += 1;
    parts.push({
      instanceId: `titanic-eng-${count}`,
      partId,
      colorCode,
      assemblyId,
      step,
      transform,
      matrix: createTransformMatrix(transform),
    });
    return true;
  };

  /**
   * Greedy horizontal brick/plate/tile span builder along X:
   * Automatically picks 1x8, 1x4, 1x2, or 1x1 parts of matching color (just like a real LEGO/COBI engineer!).
   */
  const placeRunX = (
    kind: 'BRICK' | 'PLATE' | 'TILE',
    yLdu: number,
    sz: number,
    sxStart: number,
    sxEnd: number,
    colorFn: (sx: number) => number | null,
    assemblyId: string,
    step: number,
  ) => {
    const hPlates = kind === 'BRICK' ? 3 : 1;
    const lengths =
      kind === 'BRICK'
        ? [
            { len: 8, id: '3008.dat' },
            { len: 4, id: '3010.dat' },
            { len: 2, id: '3004.dat' },
            { len: 1, id: '3005.dat' },
          ]
        : kind === 'PLATE'
          ? [
              { len: 4, id: '3710.dat' },
              { len: 2, id: '3023.dat' },
              { len: 1, id: '3024.dat' },
            ]
          : [
              { len: 4, id: '2431.dat' },
              { len: 2, id: '3069b.dat' },
              { len: 1, id: '3070b.dat' },
            ];

    let sx = sxStart;
    while (sx <= sxEnd) {
      const col = colorFn(sx);
      if (col === null) {
        sx += 1;
        continue;
      }
      let placed = false;
      for (const opt of lengths) {
        if (sx + opt.len - 1 > sxEnd) continue;
        let sameCol = true;
        for (let k = 0; k < opt.len; k++) {
          if (colorFn(sx + k) !== col) {
            sameCol = false;
            break;
          }
        }
        if (!sameCol) continue;
        if (place(opt.id, opt.len, 1, hPlates, sx, sz, yLdu, col, assemblyId, step)) {
          sx += opt.len;
          placed = true;
          break;
        }
      }
      if (!placed) sx += 1;
    }
  };

  // Sleek 9:1 hull half-width profile (90 studs long: sx = -45 bow .. +44 stern, max beam 10 studs)
  const hullHalfWidth = (sx: number): number => {
    if (sx < -42) return 1;
    if (sx < -38) return 2;
    if (sx < -33) return 3;
    if (sx < -27) return 4;
    if (sx <= 29) return 5;
    if (sx <= 35) return 4;
    if (sx <= 40) return 3;
    if (sx <= 42) return 2;
    return 1;
  };

  // === SCHRITT 1–3: ROTER UNTERWASSERKIEL & RUDER (Y = 0..32) ===
  for (let sz = -4; sz <= 3; sz++) {
    placeRunX('PLATE', 0, sz, -42, 41, (sx) => {
      const hw = Math.max(1, hullHalfWidth(sx) - 1);
      return sz >= -hw && sz < hw ? 4 : null;
    }, 'asm-keel', 1);
  }
  // Ruder am Heck
  place('3004.dat', 2, 1, 3, 41, 0, 0, 4, 'asm-keel', 1);

  for (let sz = -5; sz <= 4; sz++) {
    placeRunX('BRICK', 8, sz, -44, 42, (sx) => {
      const hw = hullHalfWidth(sx);
      if (sz < -hw || sz >= hw) return null;
      const isOuter = sz === -hw || sz === hw - 1 || sx === -44 || sx === 42;
      return isOuter ? 4 : sx % 6 === 0 ? 71 : null;
    }, 'asm-keel', 2);
  }

  // === SCHRITT 4–6: SCHWARZER HOCHRUMPF MIT BULLAUGEN (Y = 32..80) ===
  for (let sz = -5; sz <= 4; sz++) {
    placeRunX('BRICK', 32, sz, -45, 44, (sx) => {
      const hw = hullHalfWidth(sx);
      if (sz < -hw || sz >= hw) return null;
      const isOuter = sz === -hw || sz === hw - 1 || sx === -45 || sx === 44;
      return isOuter ? 0 : sx % 6 === 0 ? 72 : null;
    }, 'asm-hull', 3);
  }

  for (let sz = -5; sz <= 4; sz++) {
    placeRunX('BRICK', 56, sz, -45, 44, (sx) => {
      const hw = hullHalfWidth(sx);
      if (sz < -hw || sz >= hw) return null;
      const isOuter = sz === -hw || sz === hw - 1 || sx === -45 || sx === 44;
      if (!isOuter) return sx % 6 === 0 ? 72 : null;
      const isPorthole = Math.abs(sx) < 38 && sx % 3 === 0 && (sz === -hw || sz === hw - 1);
      return isPorthole ? 71 : 0;
    }, 'asm-hull', 4);
  }

  // Hauptdeck-Platte mit weißer Wasserpass-/Relingkante (Y = 80..88)
  for (let sz = -5; sz <= 4; sz++) {
    placeRunX('PLATE', 80, sz, -45, 44, (sx) => {
      const hw = hullHalfWidth(sx);
      if (sz < -hw || sz >= hw) return null;
      const isEdge = sz === -hw || sz === hw - 1 || sx === -45 || sx === 44;
      return isEdge || (sx >= -24 && sx <= 25) ? 15 : 19;
    }, 'asm-decks', 5);
  }

  // === SCHRITT 6: GLATT GEFLIESTE BUG-BACK, WELLDECKS & HECK-POOPDECK (Y = 88..96) ===
  for (let sz = -5; sz <= 4; sz++) {
    placeRunX('TILE', 88, sz, -45, -25, (sx) => {
      const hw = hullHalfWidth(sx);
      if (sz < -hw || sz >= hw) return null;
      if (sx === -29 && sz === 0) return null; // Bug-Mast
      const isEdge = sz === -hw || sz === hw - 1 || sx === -45;
      return isEdge ? 15 : 19;
    }, 'asm-decks', 6);
  }
  for (let sz = -5; sz <= 4; sz++) {
    placeRunX('TILE', 88, sz, 26, 44, (sx) => {
      const hw = hullHalfWidth(sx);
      if (sz < -hw || sz >= hw) return null;
      if ((sx === 29 || sx === 43) && sz === 0) return null; // Heck-Mast & Flagge
      const isEdge = sz === -hw || sz === hw - 1 || sx === 44;
      return isEdge ? 15 : 19;
    }, 'asm-decks', 6);
  }

  // === SCHRITT 7–8: WEISSES PROMENADENDECK & BOOTSDECK MIT BRÜCKENNOCKEN (Y = 88..120) ===
  for (let sz = -5; sz <= 4; sz++) {
    placeRunX('BRICK', 88, sz, -24, 25, (sx) => {
      const isOuter = sz === -5 || sz === 4 || sx === -24 || sx === 25;
      if (!isOuter) return sx % 8 === 0 ? 71 : null;
      const isWindow = (sz === -5 || sz === 4) && sx % 2 === 0 && sx > -24 && sx < 25;
      return isWindow ? 272 : 15;
    }, 'asm-decks', 7);
  }

  for (let sz = -5; sz <= 4; sz++) {
    placeRunX('PLATE', 112, sz, -24, 25, () => (sz === -5 || sz === 4 ? 19 : 15), 'asm-decks', 8);
  }
  // Kommandobrücken-Nocken links & rechts
  place('3069b.dat', 2, 1, 1, -22, -6, 112, 15, 'asm-decks', 8);
  place('3069b.dat', 2, 1, 1, -22, 5, 112, 15, 'asm-decks', 8);

  // === SCHRITT 9: 16 GESCHWUNGENE WEISSE RETTUNGSBOOTE (Curved Slope 3x1) & OBERES DECKHAUS / BRÜCKE ===
  const lifeboatXs = [-19, -15, -11, -7, 7, 11, 15, 19];
  for (const lx of lifeboatXs) {
    place('50950.dat', 3, 1, 2, lx, -5, 120, 15, 'asm-decks', 9);
    place('50950.dat', 3, 1, 2, lx, 4, 120, 15, 'asm-decks', 9);
  }

  for (let sz = -3; sz <= 2; sz++) {
    placeRunX('BRICK', 120, sz, -22, 20, (sx) => {
      const isOuter = sz === -3 || sz === 2 || sx === -22 || sx === 20;
      if (!isOuter) return sx % 7 === 0 ? 71 : null;
      return sx === -22 && sz >= -2 && sz <= 1 ? 272 : 15;
    }, 'asm-decks', 9);
  }

  for (let sz = -3; sz <= 2; sz++) {
    placeRunX('PLATE', 144, sz, -22, 20, () => 15, 'asm-decks', 10);
  }

  // === SCHRITT 11: VIER ECHTE ZYLINDRISCHE OCKER-SCHWARZE SCHORNSTEINE (3941.dat 2x2 Round) & GLATTES DACH ===
  const funnelXs = [-15, -5, 5, 15];
  const funnelFootprints = new Set<string>();
  for (const fx of funnelXs) {
    for (let dx = 0; dx < 2; dx++) {
      for (let dz = -1; dz <= 0; dz++) {
        funnelFootprints.add(`${fx + dx}:${dz}`);
      }
    }
    // Sockelplatte 2x2 hellgrau
    place('3022.dat', 2, 2, 1, fx, -1, 152, 71, 'asm-funnels', 11);
    // 4 Lagen echter 2x2-Rundzylinder (3941.dat) in Titanic-Ocker (25) + 2 Lagen Schwarz (0) oben!
    for (let lvl = 0; lvl < 6; lvl++) {
      const y = 160 + lvl * 24;
      const col = lvl >= 4 ? 0 : 25;
      place('3941.dat', 2, 2, 3, fx, -1, y, col, 'asm-funnels', 11);
    }
  }

  // Glatte Fliesen auf dem gesamten Oberdeck rund um die Schornsteine
  for (let sz = -3; sz <= 2; sz++) {
    placeRunX('TILE', 152, sz, -22, 20, (sx) => {
      if (funnelFootprints.has(`${sx}:${sz}`)) return null;
      const isSkylight = (sx === -10 || sx === 0 || sx === 10) && (sz === -1 || sz === 0);
      return isSkylight ? 71 : 15;
    }, 'asm-funnels', 11);
  }

  // === SCHRITT 12: ZWEI SCHLANKE MASTEN (3957.dat Mast Pole) MIT KRÄHENNEST & HECKFLAGGE ===
  for (const mx of [-29, 29]) {
    place('3957.dat', 1, 1, 12, mx, 0, 88, 70, 'asm-funnels', 12);
    place('3062b.dat', 1, 1, 3, mx, 0, 184, 15, 'asm-funnels', 12); // Weißes Krähennest
    place('3957.dat', 1, 1, 12, mx, 0, 208, 70, 'asm-funnels', 12);
    place('3023.dat', 2, 1, 1, mx, 0, 304, 4, 'asm-funnels', 12);  // Rote Mastflagge
  }
  // Blaue Heckflagge
  place('3957.dat', 1, 1, 12, 43, 0, 88, 70, 'asm-funnels', 12);
  place('3023.dat', 2, 1, 1, 43, 0, 184, 1, 'asm-funnels', 12);

  // === SCHRITT 13–15: TRAGENDER INNENKERN (füllt sauber & kollisionsfrei auf exakt `targetParts` auf) ===
  for (let yy = 8; yy <= 72 && count < targetParts; yy += 8) {
    const step = yy < 32 ? 13 : yy < 56 ? 14 : 15;
    for (let sx = -42; sx <= 40 && count < targetParts; sx++) {
      const hw = hullHalfWidth(sx);
      for (let sz = -hw + 1; sz < hw - 1 && count < targetParts; sz++) {
        if (occupied.has(`${yy}:${sx}:${sz}`)) continue;
        if (!occupied.has(`${yy - 8}:${sx}:${sz}`)) continue;
        place('3024.dat', 1, 1, 1, sx, sz, yy, 71, 'asm-hull', step);
      }
    }
  }

  return rebalanceStepsForHumans(
    {
      id: 'model-rms-titanic-3000',
      name: `RMS Titanic (${parts.length.toLocaleString('de-DE')} Teile)`,
      description:
        'Ingenieur-Displaymodell der RMS Titanic im 9:1-Verhältnis: Langstein-Verbundbauweise, glatt geflieste Decks, 16 Rettungsboote, Brückennocken, 4 runde ocker-schwarze Schornsteine & 2 Masten – aufgeteilt in menschengerechte BlueBrixx-Schritte (max. 14 Teile/Schritt).',
      createdAt: '2026-11-24T00:00:00.000Z',
      updatedAt: '2026-11-24T09:00:00.000Z',
      assemblies: [
        { id: 'asm-keel', name: '1. Roter Unterwasserkiel & Ruder', parentId: null, stepOrder: 1 },
        { id: 'asm-hull', name: '2. Schwarzer Hochrumpf & Innenkern', parentId: 'asm-keel', stepOrder: 2 },
        { id: 'asm-decks', name: '3. Promenadendecks, Brücke & Rettungsboote', parentId: 'asm-hull', stepOrder: 3 },
        { id: 'asm-funnels', name: '4. Vier Schornsteine, Masten & Fliesen', parentId: 'asm-decks', stepOrder: 4 },
      ],
      parts,
      metadata: { icon: 'ship', favorite: true, scale: 'DISPLAY_3000' },
    },
    { maxPartsPerStep: 14, maxUniqueTypesPerStep: 6 },
  );
}
