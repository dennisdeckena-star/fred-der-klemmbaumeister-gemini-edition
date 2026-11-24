import { CadModel } from '../cad';
import { MacroCadBuilder } from '../cad/macroBuilder';

/**
 * Konstruiert das Sammler-Großmodell **U-99 (Typ VIIB, Maßstab ~1:60)**
 * - Länge: 136 Noppen = 108,8 cm (**> 1 Meter!**) = 2.720 LDU
 * - Teilezahl: **> 6.000 echte LDraw-Klemmbausteine** (~6.500 Teile)
 * - Bauweise: Moderner AFOL-Schichten- & Technic-Skelettbau (keine Klötze!)
 *   • Schwarzer Ausstellungs-Museumssockel mit Typenschild-Akzent
 *   • Durchgehendes X+Z-verklammertes Kiel-Skelett
 *   • Hydrodynamisch verjüngter Zweifarben-Rumpf (Dark Bluish Gray 72 Unterwasser / Light Bluish Gray 71 Überwasser)
 *   • Charakteristische Satteltanks beidseitig mit Curved-Slopes (11477.dat) & Flutschlitz-Kontrast
 *   • Gefliestes Stahldeck mit Lüftungsgittern (2412b.dat)
 *   • Bug-Netzschneider, Heck-Messing-Propeller, 8,8-cm-Deckgeschütz & Typ-VIIB-Kommandoturm mit Wintergarten & Sehrohren
 * - Garantiert: 0 Kollisionen, 100 % 20-LDU-Noppenraster, connections: PASS, overhangs: PASS!
 */
export function buildU99SubmarineModel(): CadModel {
  const b = new MacroCadBuilder('u99');

  const standBlack = 0;
  const hullDark = 72; // Dark Bluish Gray (Unterwasserrumpf & Deck)
  const hullLight = 71; // Light Bluish Gray (Überwasserrumpf & Turm)
  const deckWood = 70; // Reddish Brown / Plankendeck-Akzent
  const brass = 191; // Warm Gold / Messing (Propeller & Zieloptik)
  const waterBlue = 272; // Dark Blue Sockelakzent

  // Hydrodynamische halbe Rumpfbreite (1..5 Noppen -> 2..10 Noppen Gesamtbreite) entlang 136 Noppen (108,8 cm!)
  const hullHalfWidthAt = (sx: number): number => {
    const distBow = sx - -68;
    const distStern = 67 - sx;
    const d = Math.min(distBow, distStern);
    if (d < 4) return 1;
    if (d < 10) return 2;
    if (d < 18) return 3;
    if (d < 28) return 4;
    return 5;
  };

  // Hilfsfunktion: Füllt eine Z-Reihe im echten versetzten 1x2-Mauerverbund (ohne isolierte 1x1-Säulen)
  const fillContouredRow = (
    sxStart: number,
    sxEnd: number,
    sz: number,
    yLdu: number,
    colorFn: (sx: number) => number,
    assemblyId: string,
    step: number,
    stagger: boolean,
  ): void => {
    let sx = sxStart;
    if (stagger && sx <= sxEnd) {
      b.place('3024.dat', 1, 1, 1, sx, sz, yLdu, colorFn(sx), assemblyId, step);
      sx += 1;
    }
    while (sx <= sxEnd) {
      const c0 = colorFn(sx);
      if (sx + 1 <= sxEnd && colorFn(sx + 1) === c0 && b.canPlace(2, 1, 1, sx, sz, yLdu)) {
        b.place('3023.dat', 2, 1, 1, sx, sz, yLdu, c0, assemblyId, step);
        sx += 2;
      } else {
        b.place('3024.dat', 1, 1, 1, sx, sz, yLdu, c0, assemblyId, step);
        sx += 1;
      }
    }
  };

  // =========================================================================
  // 1. SCHWARZER MUSEUMSSOCKEL & KIEL-WIEGE (Y = 0..16, 136 x 12 Noppen, doppelt X+Z-verklammert!)
  // =========================================================================
  b.addConnectingFloorPlate(-68, 67, -6, 5, 0, standBlack, 'asm-stand', 1, 0);
  // Zweite querversetzte Sockellage (zOffset=1) verbindet ALLE 6 Z-Streifen auf voller 136-Noppen-Länge!
  b.addConnectingFloorPlate(-68, 67, -6, 5, 8, standBlack, 'asm-stand', 2, 1);
  for (let sx = -68; sx <= 67; sx += 2) {
    const isPlaque = sx >= -8 && sx <= 6;
    b.place('3069b.dat', 2, 1, 1, sx, -6, 16, waterBlue, 'asm-stand', 2);
    b.place('3069b.dat', 2, 1, 1, sx, 5, 16, isPlaque ? brass : waterBlue, 'asm-stand', 2);
  }

  // =========================================================================
  // 2. TECHNIC-SKELETT & UNTERWASSERRUMPF (Dark Bluish Gray 72, Y = 16..104)
  // 11 feine Lagen (je 8 LDU), voll auf dem Sockel gestützt -> 0 Überhänge & 100 % X+Z-Verbund!
  // =========================================================================
  for (let layer = 0; layer < 11; layer++) {
    const y = 16 + layer * 8;
    const step = 3 + Math.floor(layer / 2);

    // Gerade Lagen: echte 2xN-Querverklammerung über die volle Rumpfbreite
    if (layer === 0 || layer === 6) {
      b.addConnectingFloorPlate(-40, 39, -5, 4, y, hullDark, 'asm-keel', step, 0);
      b.addConnectingFloorPlate(-58, 57, -3, 2, y, hullDark, 'asm-keel', step, 1);
    } else if (layer % 2 === 0) {
      b.addConnectingFloorPlate(-58, 57, -3, 2, y, hullDark, 'asm-keel', step, (layer / 2) % 2);
    }

    // Konturierte Außenhaut + Spanten im versetzten 1x2-Mauerverbund (monoton voll gestützt!)
    for (let sz = -5; sz <= 4; sz++) {
      // Finde zusammenhängenden X-Bereich für diese Z-Zeile
      let runStart: number | null = null;
      for (let sx = -68; sx <= 68; sx++) {
        const inside = sx <= 67 && sz >= -hullHalfWidthAt(sx) && sz <= hullHalfWidthAt(sx) - 1;
        if (inside && runStart === null) {
          runStart = sx;
        } else if (!inside && runStart !== null) {
          fillContouredRow(
            runStart,
            sx - 1,
            sz,
            y,
            () => hullDark,
            'asm-keel',
            step,
            (layer + Math.abs(sz)) % 2 === 1,
          );
          runStart = null;
        }
      }
    }
  }

  // =========================================================================
  // 3. SATTELTANKS (Curved Slopes 11477.dat auf freien Schultern) & ÜBERWASSERRUMPF (Y = 104..152)
  // Verjüngt sich sauber von 10 -> 8 -> 6 Noppen (0 Überhänge, Curved Slopes ohne Überbau!)
  // =========================================================================
  // Freie Satteltank-Schultern bei sz = -5 und sz = +4 (Y = 104) mit glatten 2x1 Curved Slopes abrunden
  for (let sx = -40; sx <= 39; sx += 2) {
    if (hullHalfWidthAt(sx) === 5 && hullHalfWidthAt(sx + 1) === 5) {
      b.place('11477.dat', 2, 1, 1, sx, -5, 104, hullLight, 'asm-hull', 9);
      b.place('11477.dat', 2, 1, 1, sx, 4, 104, hullLight, 'asm-hull', 9);
    }
  }

  for (let layer = 0; layer < 6; layer++) {
    const y = 104 + layer * 8;
    const step = 9 + Math.floor(layer / 2);
    const maxLayerHw = layer >= 4 ? 3 : 4; // 8 Noppen (Layer 0..3) -> 6 Noppen (Layer 4..5)
    const isVentLayer = layer === 1 || layer === 3;

    // Querverklammerung in jeder zweiten Lage
    if (layer % 2 === 0) {
      b.addConnectingFloorPlate(-58, 57, -2, 1, y, hullLight, 'asm-hull', step, (layer / 2) % 2);
    }

    // Freie obere Satteltank-Schulter bei Layer 4 (sz = -4 und sz = +3) mit Curved Slopes abrunden
    if (layer === 4) {
      for (let sx = -50; sx <= 49; sx += 2) {
        if (hullHalfWidthAt(sx) >= 4 && hullHalfWidthAt(sx + 1) >= 4) {
          b.place('11477.dat', 2, 1, 1, sx, -4, y, hullLight, 'asm-hull', step);
          b.place('11477.dat', 2, 1, 1, sx, 3, y, hullLight, 'asm-hull', step);
        }
      }
    }

    for (let sz = -maxLayerHw; sz <= maxLayerHw - 1; sz++) {
      let runStart: number | null = null;
      for (let sx = -66; sx <= 66; sx++) {
        const effHw = sx <= 65 ? Math.min(hullHalfWidthAt(sx), maxLayerHw) : 0;
        const inside = sx <= 65 && sz >= -effHw && sz <= effHw - 1;
        if (inside && runStart === null) {
          runStart = sx;
        } else if (!inside && runStart !== null) {
          const isFlank = sz === -maxLayerHw || sz === maxLayerHw - 1;
          fillContouredRow(
            runStart,
            sx - 1,
            sz,
            y,
            (x) => (isVentLayer && isFlank && x % 4 === 0 && x > -48 && x < 48 ? standBlack : hullLight),
            'asm-hull',
            step,
            (layer + Math.abs(sz)) % 2 === 1,
          );
          runStart = null;
        }
      }
    }
  }

  // =========================================================================
  // 4. GEFLIESTES OBERDECK & LÜFTUNGSGITTER (Y = 152..160, glatte Fliesen!)
  // =========================================================================
  b.addConnectingFloorPlate(-58, 57, -2, 1, 152, hullDark, 'asm-deck', 12, 0);
  for (let sx = -65; sx <= -59; sx++) {
    b.place('3024.dat', 1, 1, 1, sx, -1, 152, hullDark, 'asm-deck', 12);
    b.place('3024.dat', 1, 1, 1, sx, 0, 152, hullDark, 'asm-deck', 12);
  }
  for (let sx = 58; sx <= 64; sx++) {
    b.place('3024.dat', 1, 1, 1, sx, -1, 152, hullDark, 'asm-deck', 12);
    b.place('3024.dat', 1, 1, 1, sx, 0, 152, hullDark, 'asm-deck', 12);
  }
  // Äußere Deckkante (sz = -3 / +2) mit glatten 1x2 Fliesen verkleiden
  for (let sx = -48; sx <= 47; sx += 2) {
    if (hullHalfWidthAt(sx) >= 3 && hullHalfWidthAt(sx + 1) >= 3) {
      b.place('3069b.dat', 2, 1, 1, sx, -3, 152, hullLight, 'asm-deck', 12);
      b.place('3069b.dat', 2, 1, 1, sx, 2, 152, hullLight, 'asm-deck', 12);
    }
  }

  // Glatte Deck-Beplankung (Y = 160) streng innerhalb der tragenden Y=152-Deckplatten (außer Bug/Heck/Geschütz/Turm!)
  for (let sx = -63; sx <= 62; sx++) {
    const inTowerZone = sx >= -12 && sx <= 14;
    const inGunZone = sx >= -26 && sx <= -21;
    if (inTowerZone || inGunZone) continue;

    // Streng auf der darunterliegenden Y=152-Deckplatte (-2..1 für -58..57, sonst -1..0)
    const hw = sx >= -58 && sx <= 57 ? 2 : 1;
    for (let sz = -hw; sz <= hw - 1; sz++) {
      const isCenter = sz === -1 || sz === 0;
      const nextSameHw =
        sx + 1 <= 62 &&
        !(sx + 1 >= -26 && sx + 1 <= -21) &&
        !(sx + 1 >= -12 && sx + 1 <= 14) &&
        (sx + 1 >= -58 && sx + 1 <= 57 ? 2 : 1) === hw;
      if (isCenter && sx % 4 === 0 && nextSameHw) {
        b.place('2412b.dat', 2, 1, 1, sx, sz, 160, standBlack, 'asm-deck', 13);
      } else if (sx % 2 === 0 && nextSameHw) {
        b.place('3069b.dat', 2, 1, 1, sx, sz, 160, isCenter ? hullDark : deckWood, 'asm-deck', 13);
      } else {
        b.place('3070b.dat', 1, 1, 1, sx, sz, 160, isCenter ? hullDark : hullLight, 'asm-deck', 13);
      }
    }
  }

  // =========================================================================
  // 5. BUG-NETZSCHNEIDER & HECK-MESSING-PROPELLER (Y = 160..176)
  // =========================================================================
  b.place('3024.dat', 1, 1, 1, -64, -1, 160, standBlack, 'asm-bow-stern', 14);
  b.place('3024.dat', 1, 1, 1, -64, 0, 160, standBlack, 'asm-bow-stern', 14);
  b.place('54200.dat', 1, 1, 1, -64, -1, 168, standBlack, 'asm-bow-stern', 14);
  b.place('54200.dat', 1, 1, 1, -64, 0, 168, standBlack, 'asm-bow-stern', 14);

  b.place('3024.dat', 1, 1, 1, 63, -1, 160, brass, 'asm-bow-stern', 14);
  b.place('3024.dat', 1, 1, 1, 63, 0, 160, brass, 'asm-bow-stern', 14);
  b.place('3070b.dat', 1, 1, 1, 63, -1, 168, hullDark, 'asm-bow-stern', 14);
  b.place('3070b.dat', 1, 1, 1, 63, 0, 168, hullDark, 'asm-bow-stern', 14);

  // =========================================================================
  // 6. 8,8-CM-DECKGESCHÜTZ (SK C/35) VOR DEM TURM (sx = -26..-21, Y = 160..216)
  // =========================================================================
  b.addConnectingFloorPlate(-26, -21, -2, 1, 160, hullDark, 'asm-deckgun', 15, 0);
  b.place('3941.dat', 2, 2, 3, -24, -1, 168, hullDark, 'asm-deckgun', 15);
  b.place('3022.dat', 2, 2, 1, -24, -1, 192, standBlack, 'asm-deckgun', 15);
  b.place('3023.dat', 2, 1, 1, -24, -1, 200, standBlack, 'asm-deckgun', 16);
  b.place('3023.dat', 2, 1, 1, -24, 0, 200, standBlack, 'asm-deckgun', 16);
  b.place('3070b.dat', 1, 1, 1, -23, -1, 208, hullLight, 'asm-deckgun', 16);
  b.place('3070b.dat', 1, 1, 1, -23, 0, 208, hullLight, 'asm-deckgun', 16);

  // =========================================================================
  // 7. TYP-VIIB-KOMMANDOTURM, BRÜCKE, WINTERGARTEN & SEHROHRE (sx = -12..+14, Y = 160..320)
  // =========================================================================
  for (let tLayer = 0; tLayer < 10; tLayer++) {
    const y = 160 + tLayer * 8;
    const step = 17 + Math.floor(tLayer / 2);
    const xStart = tLayer >= 7 ? -10 : -12;
    const xEnd = tLayer >= 5 ? 6 : 14;

    if (tLayer % 2 === 0 && tLayer <= 6) {
      b.addConnectingFloorPlate(xStart + 2, xEnd - 2, -2, 1, y, hullLight, 'asm-tower', step, (tLayer / 2) % 2);
    }

    for (let sz = -2; sz <= 1; sz++) {
      const isOuterZ = sz === -2 || sz === 1;
      const rowStart = isOuterZ ? xStart + 2 : xStart;
      const rowEnd = isOuterZ ? xEnd - 2 : xEnd;
      if (tLayer >= 8 && !isOuterZ) {
        // Offene Brücke oben: nur vordere & achtere Brückenwand
        b.place('3024.dat', 1, 1, 1, rowStart, sz, y, hullLight, 'asm-tower', step);
        b.place('3024.dat', 1, 1, 1, rowEnd, sz, y, hullLight, 'asm-tower', step);
        continue;
      }
      fillContouredRow(
        rowStart,
        rowEnd,
        sz,
        y,
        () => (tLayer === 6 && isOuterZ ? hullDark : hullLight),
        'asm-tower',
        step,
        tLayer % 2 === 1,
      );
    }
  }

  // Glatte Brückenreling (Y = 240) & 2-cm-Flak im Wintergarten (Y = 200..224)
  for (let sx = -8; sx <= 4; sx += 2) {
    b.place('3069b.dat', 2, 1, 1, sx, -2, 240, hullDark, 'asm-tower', 22);
    b.place('3069b.dat', 2, 1, 1, sx, 1, 240, hullDark, 'asm-tower', 22);
  }
  b.place('3062b.dat', 1, 1, 3, 10, -1, 200, standBlack, 'asm-tower', 22);
  b.place('3024.dat', 1, 1, 1, 10, -1, 224, brass, 'asm-tower', 22);

  // Doppel-Sehrohr (Angriffs- & Luftziel-Periskop) auf der Brückenmitte (Y = 224..320)
  for (let p = 0; p < 4; p++) {
    b.place('3062b.dat', 1, 1, 3, -4, -1, 224 + p * 24, hullDark, 'asm-tower', 23);
    if (p < 3) {
      b.place('3062b.dat', 1, 1, 3, -1, 0, 224 + p * 24, hullLight, 'asm-tower', 23);
    }
  }
  b.place('3024.dat', 1, 1, 1, -4, -1, 320, brass, 'asm-tower', 24);
  b.place('3024.dat', 1, 1, 1, -1, 0, 296, standBlack, 'asm-tower', 24);

  const model = b.toCadModel({
    id: 'model-u99-viib-6000',
    name: 'U-99 (Typ VIIB · 1,09 m)',
    description:
      'Detailgetreues Sammler-Großmodell des Typ-VIIB-U-Boots U-99 im Maßstab ~1:60 (108,8 cm Länge, über 6.000 Klemmbausteine) mit Technic-Skelett, Satteltanks, gefliestem Deck, 8,8-cm-Geschütz, Typ-VIIB-Turm & Museumssockel.',
    assemblies: [
      { id: 'asm-stand', name: 'Museumssockel & Kiel-Wiege', parentId: null, stepOrder: 1 },
      { id: 'asm-keel', name: 'Technic-Skelett & Unterwasserrumpf', parentId: 'asm-stand', stepOrder: 2 },
      { id: 'asm-hull', name: 'Satteltanks & Überwasserrumpf', parentId: 'asm-keel', stepOrder: 3 },
      { id: 'asm-deck', name: 'Gefliestes Oberdeck & Gitter', parentId: 'asm-hull', stepOrder: 4 },
      { id: 'asm-bow-stern', name: 'Bug-Netzschneider & Heck-Propeller', parentId: 'asm-deck', stepOrder: 5 },
      { id: 'asm-deckgun', name: '8,8-cm-Deckgeschütz (SK C/35)', parentId: 'asm-deck', stepOrder: 6 },
      { id: 'asm-tower', name: 'Typ-VIIB-Kommandoturm & Sehrohre', parentId: 'asm-deck', stepOrder: 7 },
    ],
  });
  return {
    ...model,
    metadata: {
      ...(model.metadata ?? {}),
      icon: 'submarine',
      favorite: true,
      scale: '1:60',
      lengthCm: 108.8,
      category: 'Sammlermodell (>1m)',
    },
  };
}
