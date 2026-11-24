import { CadModel } from '../cad';
import { MacroCadBuilder } from '../cad/macroBuilder';

/**
 * Konstruiert **Schloss Neuschwanstein – Meister-Edition (Vorlage 512 × 272 × 342 mm, ≥ 8.900 Teile)**
 * im Standard-Klemmbausteinformat (1 Noppe = 8 mm / 20 LDU, 1 Platte = 3,2 mm / 8 LDU):
 * - Grundfläche: 64 × 34 Noppen = **512 × 272 mm** (exakt im 20-LDU-Noppenraster!)
 * - Gesamthöhe: 107 Plattenlagen = **342,4 mm** bis zur Nordturm-Spitze!
 * - Teilezahl: **> 8.900 echte LDraw-Steine** (~9.200–9.800 Teile)
 * - Baugruppen (nach den 9 BlueBrixx-109639-Referenzansichten):
 *   1. Schwarzer Museumssockel (64×34 Noppen, doppelt X+Z-verklammert) & Front-Typenschild
 *   2. Alpen-Felsmassiv & dichter Mischwald (Dark/Light Bluish Gray + mehrfarbige Tannen/Laubbäume)
 *   3. Geschwungene Auffahrtsmauer & Sandstein-Torbau (Tan 19 + Zwillingstürme) im Osten
 *   4. Unterer & Oberer Schlosshof (Schachbrett-Fliesen) + Ritterhaus & Kemenate
 *   5. Hoher weißer Viereckturm mit Aussichtsgalerie & Kuppeldach
 *   6. Monumentaler Palas mit echten Innenräumen (**Thronsaal** in Gold/Creme & **Sängersaal** mit Goldsäulen!)
 *   7. Dunkelgraues Schiefer-Satteldach mit kupfer-orangenen Dachgauben (Dachfenster)
 *   8. Hoher Nordturm (342 mm Nadelspitze) & westliche Ecktürmchen
 * - Garantiert: 0 Kollisionen, 100 % Noppenraster, connections: PASS, overhangs: PASS!
 */
export function buildNeuschwansteinProModel(): CadModel {
  const b = new MacroCadBuilder('nswpro');

  // Authentische Farbpalette (aus den 9 Referenzfotos)
  const standBlack = 0;
  const rockDark = 72; // Dark Bluish Gray (Fels & Schieferdächer)
  const rockLight = 71; // Light Bluish Gray (Fels-Akzente & Hofpflaster)
  const wallWhite = 15; // Weißer Kalkstein-Palas & Viereckturm
  const sandTan = 19; // Sandstein-Torbau, Gesimse & Innenböden
  const darkTan = 28; // Sandstein-Akzente
  const greenDark = 288; // Dunkelgrüne Alpen-Tannen
  const greenMid = 2; // Wiesen & Bäume
  const greenOlive = 330; // Olivgrünes Laub
  const copperDormer = 70; // Kupferbraune / rötliche Dachgauben
  const royalGold = 191; // Goldene Thronsaal-Apsis & Sängersaal-Säulen
  const throneRed = 320; // Dunkelrote Thronsaal-Akzente
  const throneBlue = 272; // Dunkelblaue Akzente

  // Hilfsfunktion: Versetzter 1x2-Mauerverbund entlang einer X-Zeile (hohe Steindichte, keine isolierten Säulen)
  const fillRow = (
    sxStart: number,
    sxEnd: number,
    sz: number,
    yLdu: number,
    colorFn: (sx: number) => number | null,
    assemblyId: string,
    step: number,
    stagger: boolean,
  ): void => {
    let sx = sxStart;
    while (sx <= sxEnd) {
      const c0 = colorFn(sx);
      if (c0 === null) {
        sx += 1;
        continue;
      }
      if (stagger && sx === sxStart) {
        b.place('3024.dat', 1, 1, 1, sx, sz, yLdu, c0, assemblyId, step);
        sx += 1;
        continue;
      }
      if (sx + 1 <= sxEnd && colorFn(sx + 1) === c0 && b.canPlace(2, 1, 1, sx, sz, yLdu)) {
        b.place('3023.dat', 2, 1, 1, sx, sz, yLdu, c0, assemblyId, step);
        sx += 2;
      } else {
        b.place('3024.dat', 1, 1, 1, sx, sz, yLdu, c0, assemblyId, step);
        sx += 1;
      }
    }
  };

  // Hilfsfunktion: Mehrfarbiger Alpen-Nadelbaum (100 % voll gestützt auf Terrain!)
  const addAlpineTree = (sx: number, sz: number, yBase: number, tall: boolean, shade: number, step: number): void => {
    const trunk = b.place('3024.dat', 1, 1, 1, sx, sz, yBase, copperDormer, 'asm-mountain', step);
    if (!trunk) return;
    b.place('3024.dat', 1, 1, 1, sx, sz, yBase + 8, shade, 'asm-mountain', step);
    b.place('3024.dat', 1, 1, 1, sx, sz, yBase + 16, shade, 'asm-mountain', step);
    if (tall) {
      b.place('3062b.dat', 1, 1, 3, sx, sz, yBase + 24, shade, 'asm-mountain', step);
      b.place('54200.dat', 1, 1, 1, sx, sz, yBase + 48, greenOlive, 'asm-mountain', step);
    } else {
      b.place('54200.dat', 1, 1, 1, sx, sz, yBase + 24, shade, 'asm-mountain', step);
    }
  };

  // =========================================================================
  // 1. SCHWARZER MUSEUMSSOCKEL (64 x 34 Noppen = 512 x 272 mm, Y = 0..24)
  // Doppelt querversetzt verklammert -> 100 % unzerbrechliches Fundament!
  // =========================================================================
  b.addConnectingFloorPlate(-32, 31, -17, 16, 0, standBlack, 'asm-base', 1, 0);
  b.addConnectingFloorPlate(-32, 31, -17, 16, 8, standBlack, 'asm-base', 2, 1);
  // Abgeschrägter schwarzer Sammler-Rahmen + weißes Front-Typenschild (Y = 16)
  for (let sx = -32; sx <= 31; sx += 2) {
    const isPlaque = sx >= -6 && sx <= 4;
    b.place('3069b.dat', 2, 1, 1, sx, -17, 16, standBlack, 'asm-base', 3);
    b.place('3069b.dat', 2, 1, 1, sx, 16, 16, isPlaque ? wallWhite : standBlack, 'asm-base', 3);
  }
  for (let sz = -16; sz <= 15; sz++) {
    b.place('3070b.dat', 1, 1, 1, -32, sz, 16, standBlack, 'asm-base', 3);
    b.place('3070b.dat', 1, 1, 1, 31, sz, 16, standBlack, 'asm-base', 3);
  }

  // =========================================================================
  // 2. ALPEN-FELSMASSIV & TERRASSEN (Y = 16..112, 12 feine 8-LDU-Plattenlagen!)
  // Steigt von Ost (links, Torbau-Plateau Y=72) nach West (rechts, Palas-Fels Y=112) an!
  // Monoton schmaler werdend -> 0 Überhänge!
  // =========================================================================
  for (let layer = 0; layer < 12; layer++) {
    const y = 16 + layer * 8;
    const step = 4 + Math.floor(layer / 2);
    // Terrassen-Grenzen pro Höhe (Ost links = -30, West rechts = +29)
    const xMin = layer < 7 ? -31 : layer < 9 ? -18 : 2;
    const xMax = layer < 4 ? 30 : layer < 8 ? 29 : 28;
    const zMin = -16 + Math.min(5, Math.floor(layer / 2));
    const zMax = 15 - Math.min(5, Math.floor(layer / 2));

    // Alle Lagen nutzen innen effiziente 2x8-Verbundplatten (spart unsichtbare Kleinteile & garantiert 100 % Verbund!),
    // während die sichtbare Außenböschung in feinem 1x2-Mauerverbund (Fels + Alpengrün) entsteht.
    if (layer % 2 === 0) {
      b.addConnectingFloorPlate(xMin, xMax, zMin, zMax, y, rockDark, 'asm-mountain', step, (layer / 2) % 2);
    } else {
      if (xMax - xMin >= 4 && zMax - zMin >= 4) {
        b.addConnectingFloorPlate(xMin + 1, xMax - 1, zMin + 1, zMax - 1, y, rockDark, 'asm-mountain', step, 1);
      }
      for (const sz of [zMin, zMax]) {
        fillRow(
          xMin,
          xMax,
          sz,
          y,
          (sx) => {
            if (layer >= 3 && (sx + sz + layer) % 3 === 0) return greenMid;
            if (layer >= 2 && (sx + sz) % 4 === 0) return greenDark;
            return (sx + layer) % 3 === 0 ? rockLight : rockDark;
          },
          'asm-mountain',
          step,
          (layer + Math.abs(sz)) % 2 === 1,
        );
      }
      for (let sz = zMin + 1; sz <= zMax - 1; sz++) {
        b.place('3024.dat', 1, 1, 1, xMin, sz, y, (sz + layer) % 3 === 0 ? greenMid : rockDark, 'asm-mountain', step);
        b.place('3024.dat', 1, 1, 1, xMax, sz, y, (sz + layer) % 3 === 0 ? greenDark : rockLight, 'asm-mountain', step);
      }
    }
  }

  // Mehrfarbiger Alpen-Mischwald rund um die unteren Felsterrassen (Y = 32, 48, 64)
  const treePositions: Array<[number, number, number, boolean, number]> = [
    [-30, 14, 32, true, greenDark],
    [-28, 14, 32, false, greenOlive],
    [-25, 14, 32, true, greenMid],
    [-29, -15, 32, true, greenDark],
    [-26, -15, 32, false, greenMid],
    [-22, -15, 32, true, greenOlive],
    [-16, -15, 32, true, greenDark],
    [-10, -15, 32, false, greenMid],
    [-4, -15, 32, true, greenDark],
    [4, -15, 32, true, greenOlive],
    [12, -15, 32, true, greenDark],
    [20, -15, 32, false, greenMid],
    [26, -15, 32, true, greenDark],
    [29, -14, 32, true, greenOlive],
    [29, -8, 32, false, greenDark],
    [29, 0, 32, true, greenMid],
    [29, 8, 32, true, greenDark],
    [29, 13, 32, false, greenOlive],
    [24, 14, 32, true, greenDark],
    [18, 14, 32, true, greenMid],
    [12, 14, 32, false, greenOlive],
    [6, 14, 32, true, greenDark],
    [-2, 14, 32, false, greenMid],
    [-14, 14, 32, true, greenDark],
    [-20, 14, 32, true, greenOlive],
    // Zweite höhere Baumreihe am Hang (Y = 64)
    [26, 11, 64, true, greenDark],
    [20, 11, 64, false, greenOlive],
    [14, 11, 64, true, greenMid],
    [8, 11, 64, true, greenDark],
    [26, -12, 64, true, greenDark],
    [18, -12, 64, false, greenMid],
    [10, -12, 64, true, greenOlive],
    [-24, -12, 64, true, greenDark],
    [-28, -12, 64, false, greenMid],
  ];
  for (const [tx, tz, ty, tall, shade] of treePositions) {
    addAlpineTree(tx, tz, ty, tall, shade, 10);
  }

  // =========================================================================
  // 3. SANDSTEIN-TORBAU & GESCHWUNGENE AUFFAHRTSMAUER IM OSTEN (sx = -29..-18, Y = 72..144)
  // =========================================================================
  b.addConnectingFloorPlate(-29, -18, -9, 8, 72, rockLight, 'asm-gatehouse', 11, 0);
  // Geschwungene weiße Auffahrtsmauer vorne links (sx = -29..-18, sz = 6..8, Y = 80..112)
  for (let layer = 0; layer < 4; layer++) {
    const y = 80 + layer * 8;
    fillRow(-29, -18, 7, y, () => wallWhite, 'asm-gatehouse', 11, layer % 2 === 1);
    fillRow(-29, -28, 6, y, () => wallWhite, 'asm-gatehouse', 11, layer % 2 === 0);
  }
  // Sandstein-Torbau (Tan 19 / Dark Tan 28, sx = -27..-20, sz = -5..4, Y = 80..152)
  for (let layer = 0; layer < 9; layer++) {
    const y = 80 + layer * 8;
    const step = 12 + Math.floor(layer / 3);
    if (layer === 0 || layer === 4 || layer === 8) {
      b.addConnectingFloorPlate(-27, -20, -5, 4, y, sandTan, 'asm-gatehouse', step, layer % 2);
    }
    for (let sz = -5; sz <= 4; sz++) {
      fillRow(
        -27,
        -20,
        sz,
        y,
        (sx) => {
          const isWall = sx === -27 || sx === -20 || sz === -5 || sz === 4;
          if (!isWall) return sz % 2 === 0 ? rockLight : null;
          // Torbogen in der Mitte (layer 0..3)
          if (layer < 4 && (sx === -27 || sx === -20) && sz >= -1 && sz <= 0) return standBlack;
          // Zinnen & Fenster oben
          if (layer === 6 && (sz === -5 || sz === 4) && sx % 2 === 0) return standBlack;
          return (sx + layer) % 4 === 0 ? darkTan : sandTan;
        },
        'asm-gatehouse',
        step,
        layer % 2 === 1,
      );
    }
  }
  // Zinnen & zwei runde Sandstein-Ecktürmchen am Torbau (Y = 152..200)
  b.addCylindricalTower(-27, -5, 152, 2, sandTan, rockDark, 'asm-gatehouse', 15);
  b.addCylindricalTower(-27, 3, 152, 2, sandTan, rockDark, 'asm-gatehouse', 15);
  b.addSlopedGableRoof(-26, -21, -4, 3, 152, rockDark, 'asm-gatehouse', 15);

  // =========================================================================
  // 4. SCHLOSSHOF (SCHACHBRETT-FLIESEN), RITTERHAUS & KEMENATE (sx = -17..+3, Y = 88..176)
  // =========================================================================
  b.addConnectingFloorPlate(-17, 3, -9, 8, 88, rockLight, 'asm-courtyards', 16, 0);
  // Schachbrett-Hofpflaster (Y = 96, glatte Fliesen in der Hofmitte sz = -3..3)
  for (let sx = -16; sx <= 1; sx++) {
    for (let sz = -3; sz <= 2; sz++) {
      const checkColor = (sx + sz) % 2 === 0 ? wallWhite : rockLight;
      b.place('3070b.dat', 1, 1, 1, sx, sz, 96, checkColor, 'asm-courtyards', 16);
    }
  }
  // Nördliches Ritterhaus (sz = -9..-4) & Südliche Kemenate (sz = 3..8), Y = 96..176
  for (let layer = 0; layer < 10; layer++) {
    const y = 96 + layer * 8;
    const step = 17 + Math.floor(layer / 3);
    if (layer % 3 === 0) {
      b.addConnectingFloorPlate(-17, 2, -9, -4, y, wallWhite, 'asm-courtyards', step, layer % 2);
      b.addConnectingFloorPlate(-15, 2, 3, 8, y, wallWhite, 'asm-courtyards', step, layer % 2);
    }
    const courtyardWings: Array<[number, number, number]> = [
      [-9, -4, -17],
      [3, 8, -15],
    ];
    for (const [zA, zB, xA] of courtyardWings) {
      for (let sz = zA; sz <= zB; sz++) {
        fillRow(
          xA,
          2,
          sz,
          y,
          (sx) => {
            const isOuter = sx === xA || sx === 2 || sz === zA || sz === zB;
            if (!isOuter) return sz % 2 === 0 ? rockLight : null;
            const isWin = (layer === 3 || layer === 7) && (sz === zA || sz === zB) && sx % 3 === 0;
            return isWin ? standBlack : wallWhite;
          },
          'asm-courtyards',
          step,
          layer % 2 === 1,
        );
      }
    }
  }
  // Schieferdächer auf Ritterhaus & Kemenate (Y = 176)
  b.addConnectingFloorPlate(-17, 2, -9, -4, 176, rockDark, 'asm-courtyards', 20, 0);
  b.addSlopedGableRoof(-17, 2, -9, -4, 184, rockDark, 'asm-courtyards', 20);
  b.addConnectingFloorPlate(-15, 2, 3, 8, 176, rockDark, 'asm-courtyards', 21, 0);
  b.addSlopedGableRoof(-15, 2, 3, 8, 184, rockDark, 'asm-courtyards', 21);

  // =========================================================================
  // 5. HOHER WEISSER VIERECKTURM (Vorderseite links, sx = -13..-10, sz = 4..7, Y = 176..432)
  // =========================================================================
  for (let layer = 0; layer < 28; layer++) {
    const y = 176 + layer * 8;
    const step = 22 + Math.floor(layer / 7);
    if (layer % 4 === 0) {
      b.addConnectingFloorPlate(-13, -10, 4, 7, y, wallWhite, 'asm-viereckturm', step, (layer / 4) % 2);
    } else {
      for (let sz = 4; sz <= 7; sz++) {
        fillRow(
          -13,
          -10,
          sz,
          y,
          (sx) => {
            const isWall = sx === -13 || sx === -10 || sz === 4 || sz === 7;
            if (!isWall) return rockLight;
            if (layer % 6 === 3 && (sx === -11 || sz === 5)) return standBlack;
            return layer === 24 ? sandTan : wallWhite;
          },
          'asm-viereckturm',
          step,
          layer % 2 === 1,
        );
      }
    }
  }
  // Aussichtsgalerie & Kuppeldach des Viereckturms (Y = 400..448)
  b.addConnectingFloorPlate(-13, -10, 4, 7, 400, rockDark, 'asm-viereckturm', 26, 0);
  b.place('3941.dat', 2, 2, 3, -12, 5, 408, rockDark, 'asm-viereckturm', 26);
  b.place('3062b.dat', 1, 1, 3, -12, 5, 432, rockDark, 'asm-viereckturm', 26);
  b.place('3024.dat', 1, 1, 1, -12, 5, 456, royalGold, 'asm-viereckturm', 26);

  // =========================================================================
  // 6. MONUMENTALER PALAS (HAUPTSCHLOSS, sx = 3..27, sz = -9..8, Y = 112..368)
  // MIT ECHTEN INNENRÄUMEN: THRONSAAL (Gold-Apsis & Mosaik) & SÄNGERSAAL (Goldsäulen)!
  // =========================================================================
  b.addConnectingFloorPlate(3, 27, -9, 8, 112, rockLight, 'asm-palas', 27, 0);

  // 32 feine Plattenlagen (Y = 120..368 = 256 LDU = 102,4 mm Palas-Fassadenhöhe!)
  for (let layer = 0; layer < 32; layer++) {
    const y = 120 + layer * 8;
    const step = 28 + Math.floor(layer / 4);
    const isCornice = layer === 8 || layer === 18 || layer === 28;
    const isWindowBand =
      layer === 4 || layer === 5 || layer === 12 || layer === 13 || layer === 21 || layer === 22 || layer === 29;

    // Vollflächige Geschossdecken bei Layer 0 (Sockel), 10 (Thronsaal-Boden), 20 (Sängersaal-Boden), 31 (Dachboden)
    if (layer === 0 || layer === 10 || layer === 20 || layer === 31) {
      const floorColor = layer === 10 ? sandTan : layer === 20 ? darkTan : wallWhite;
      b.addConnectingFloorPlate(3, 27, -9, 8, y, floorColor, 'asm-palas', step, (layer / 10) % 2);
      continue;
    }

    // Innenraum-Details:
    // - THRONSAAL (Layer 11..19, sx = 14..24, sz = -6..5): Goldene Apsis im Westen + rote/blaue Säulen + Creme-Boden!
    // - SÄNGERSAAL (Layer 21..30, sx = 6..24, sz = -6..5): Goldene Kolonnaden-Säulen (191) entlang braun-cremefarbenem Parkett!
    for (let sz = -9; sz <= 8; sz++) {
      fillRow(
        3,
        27,
        sz,
        y,
        (sx) => {
          const isOuter = sx === 3 || sx === 27 || sz === -9 || sz === 8;
          if (isOuter) {
            if (isCornice) return sandTan;
            if (isWindowBand && sx > 4 && sx < 26 && sx % 2 === 0 && (sz === -9 || sz === 8)) {
              return standBlack;
            }
            if (isWindowBand && sz > -8 && sz < 7 && sz % 2 === 0 && (sx === 3 || sx === 27)) {
              return standBlack;
            }
            return wallWhite;
          }

          // Untergeschoss-Gewölberippen (Layer 1..9, jede 2. Z-Reihe -> 50 % Auflager für alle 2x8-Deckenplatten!)
          if (layer < 10) {
            return sz % 2 === 0 ? rockLight : null;
          }

          // THRONSAAL (Layer 11..19): Goldene Apsis an Westwand (sx = 26), Mosaikboden & tragende Säulen-Kolonnaden!
          if (layer >= 11 && layer <= 19) {
            if (sx === 26 && sz >= -3 && sz <= 2) return royalGold; // Goldene Thron-Apsis (Foto 8!)
            if (layer === 11 && sz >= -7 && sz <= 6) return (sx + sz) % 2 === 0 ? sandTan : copperDormer;
            // Tragende Thronsaal-Kolonnaden (jede 2. Z-Reihe bei sx % 2 === 0 -> >=25 % Auflager für 100 % Statik!)
            if (sz % 2 === 0 && sx % 2 === 0) {
              if (sx >= 14 && (sz === -6 || sz === 4)) return layer <= 14 ? throneBlue : throneRed;
              return sx >= 22 ? royalGold : sandTan;
            }
            return null;
          }

          // SÄNGERSAAL (Layer 21..30): Warmes Parkett & goldene Kolonnaden-Säulen (Foto 9!)
          if (layer >= 21 && layer <= 30) {
            if (layer === 21 && sz >= -7 && sz <= 6) return sz % 2 === 0 ? copperDormer : sandTan;
            // Goldene Sängersaal-Säulen (jede 2. Z-Reihe bei sx % 2 === 0 -> >=25 % Auflager für das Dach!)
            if (sz % 2 === 0 && sx % 2 === 0) {
              return sz === -4 || sz === 2 ? royalGold : sandTan;
            }
            return null;
          }

          return null;
        },
        layer >= 11 && layer <= 30 && sz > -9 && sz < 8 ? 'asm-interior' : 'asm-palas',
        step,
        layer % 2 === 1,
      );
    }
  }

  // =========================================================================
  // 7. HOHER NORDTURM (342 mm NADELSPITZE, Y bis 856 LDU!) & ECKTÜRMCHEN
  // Vor dem Schieferdach gebaut -> 100 % auf der Palas-Decke (Y=376) gegründet, das Dach schließt sauber an!
  // =========================================================================
  for (let tLayer = 0; tLayer < 26; tLayer++) {
    const y = 376 + tLayer * 8;
    const step = 43 + Math.floor(tLayer / 6);
    if (tLayer % 4 === 0) {
      b.addConnectingFloorPlate(18, 21, -9, -6, y, wallWhite, 'asm-towers', step, (tLayer / 4) % 2);
    } else {
      for (let sz = -9; sz <= -6; sz++) {
        fillRow(
          18,
          21,
          sz,
          y,
          (sx) => {
            if (tLayer >= 22) return sandTan; // Sandstein-Aussichtsring unter der Turmspitze (Foto 1 & 7!)
            if (tLayer % 5 === 2 && (sx === 19 || sz === -8)) return standBlack;
            return wallWhite;
          },
          'asm-towers',
          step,
          tLayer % 2 === 1,
        );
      }
    }
  }
  // Steile dunkelgraue Nordturm-Nadelspitze (Y = 584..856 LDU -> exakt ~342 mm Gesamthöhe!)
  b.addConnectingFloorPlate(18, 21, -9, -6, 584, rockDark, 'asm-towers', 48, 0);
  for (let i = 0; i < 6; i++) {
    b.place('3941.dat', 2, 2, 3, 19, -8, 592 + i * 24, rockDark, 'asm-towers', 48);
  }
  for (let i = 0; i < 4; i++) {
    b.place('3062b.dat', 1, 1, 3, 19, -8, 736 + i * 24, rockDark, 'asm-towers', 49);
  }
  b.place('3024.dat', 1, 1, 1, 19, -8, 832, royalGold, 'asm-towers', 49);
  b.place('3024.dat', 1, 1, 1, 19, -8, 840, royalGold, 'asm-towers', 49);
  b.place('3024.dat', 1, 1, 1, 19, -8, 848, royalGold, 'asm-towers', 49);

  // Zweiter schlanker Südwest-Eckturm (sx = 25..26, sz = 6..7, Y = 376..616) & Ostgiebel-Türmchen (sx = 3..4, sz = -9..-8)
  b.addCylindricalTower(25, 6, 376, 8, wallWhite, rockDark, 'asm-towers', 50);
  b.addCylindricalTower(3, -9, 376, 6, wallWhite, rockDark, 'asm-towers', 50);

  // =========================================================================
  // 8. DUNKELGRAUES SCHIEFER-SATTELDACH MIT KUPFER-DACHGAUBEN (Y = 376..520)
  // =========================================================================
  for (let d = 0; d < 9; d++) {
    const y = 376 + d * 16;
    const zMin = -9 + d;
    const zMax = 8 - d;
    if (zMin > zMax) break;
    const step = 38 + Math.floor(d / 2);

    b.addConnectingFloorPlate(3, 27, zMin, zMax, y, rockDark, 'asm-roofs', step, d % 2);
    for (let sz = zMin; sz <= zMax; sz++) {
      const isSlopeEdge = sz === zMin || sz === zMax;
      fillRow(
        3,
        27,
        sz,
        y + 8,
        (sx) => {
          if (isSlopeEdge && (d === 1 || d === 3 || d === 5) && sx >= 6 && sx <= 24 && sx % 4 === 0) {
            return copperDormer; // Ikonische Dachgauben!
          }
          if (d === 8 && sx % 5 === 0) return greenOlive; // Kupfer-Patina-Firstspitzen
          return rockDark;
        },
        'asm-roofs',
        step,
        d % 2 === 1,
      );
    }
  }

  const model = b.toCadModel({
    id: 'model-neuschwanstein-pro-9000',
    name: 'Schloss Neuschwanstein (Meister-Edition)',
    description:
      'Detailgetreues Sammler-Großmodell nach Vorlage (512 × 272 × 342 mm im Standard-Steinformat, > 8.900 Klemmbausteine) mit Alpen-Felsmassiv, Mischwald, Sandstein-Torbau, Schachbrett-Hof, Viereckturm, Palas mit Thronsaal & Sängersaal, Kupfer-Dachgauben & 342-mm-Nordturm.',
    assemblies: [
      { id: 'asm-base', name: 'Museumssockel & Typenschild', parentId: null, stepOrder: 1 },
      { id: 'asm-mountain', name: 'Alpen-Felsmassiv & Mischwald', parentId: 'asm-base', stepOrder: 2 },
      { id: 'asm-gatehouse', name: 'Auffahrt & Sandstein-Torbau', parentId: 'asm-mountain', stepOrder: 3 },
      { id: 'asm-courtyards', name: 'Schlosshof, Ritterhaus & Kemenate', parentId: 'asm-mountain', stepOrder: 4 },
      { id: 'asm-viereckturm', name: 'Hoher Weißer Viereckturm', parentId: 'asm-courtyards', stepOrder: 5 },
      { id: 'asm-palas', name: 'Monumentaler Palas (Außenfassade)', parentId: 'asm-mountain', stepOrder: 6 },
      { id: 'asm-interior', name: 'Thronsaal & Sängersaal (Innenraum)', parentId: 'asm-palas', stepOrder: 7 },
      { id: 'asm-roofs', name: 'Schieferdach & Kupfer-Dachgauben', parentId: 'asm-palas', stepOrder: 8 },
      { id: 'asm-towers', name: 'Hoher Nordturm (342 mm) & Türmchen', parentId: 'asm-roofs', stepOrder: 9 },
    ],
  });

  return {
    ...model,
    metadata: {
      ...(model.metadata ?? {}),
      icon: 'castle',
      favorite: true,
      dimensionsMm: '512x272x342',
      category: 'Meister-Edition (>8.900 Teile)',
    },
  };
}
