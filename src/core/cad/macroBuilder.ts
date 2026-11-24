import { CadModel, createTransformMatrix, PartInstance } from './index';
import { rebalanceStepsForHumans } from './bomAndSteps';
import { getPartById } from '../ldraw';

export type BrickKind = 'brick' | 'plate' | 'tile';

const PART_BY_KIND_AND_WIDTH: Record<BrickKind, Array<{ w: number; partId: string; hPlates: number }>> = {
  brick: [
    { w: 8, partId: '3008.dat', hPlates: 3 },
    { w: 4, partId: '3010.dat', hPlates: 3 },
    { w: 3, partId: '3622.dat', hPlates: 3 },
    { w: 2, partId: '3004.dat', hPlates: 3 },
    { w: 1, partId: '3005.dat', hPlates: 3 },
  ],
  plate: [
    { w: 4, partId: '3710.dat', hPlates: 1 },
    { w: 2, partId: '3023.dat', hPlates: 1 },
    { w: 1, partId: '3024.dat', hPlates: 1 },
  ],
  tile: [
    { w: 4, partId: '2431.dat', hPlates: 1 },
    { w: 2, partId: '3069b.dat', hPlates: 1 },
    { w: 1, partId: '3070b.dat', hPlates: 1 },
  ],
};

/**
 * Profi-Makro-CAD-Engine für AFOL-/Sammlermodelle.
 * Garantiert:
 * - 0 Kollisionen (exakte Voxel-Belegung auf 20-LDU-Noppenraster × 8-LDU-Plattenraster)
 * - Echter Mauerverbund (brick interlocking) mit Großsteinen (1x8, 1x4, 1x2) statt 1x1-Stapeln
 * - Versetzte Stoßfugen je Schicht (stagger) für reale Stabilität
 */
export class MacroCadBuilder {
  private readonly parts: PartInstance[] = [];
  private readonly occupied = new Set<string>();
  private readonly idPrefix: string;
  private count = 0;

  constructor(idPrefix = 'mc') {
    this.idPrefix = idPrefix;
  }

  public getPartCount(): number {
    return this.parts.length;
  }

  public canPlace(w: number, d: number, hPlates: number, sx: number, sz: number, yLdu: number): boolean {
    for (let yy = yLdu; yy < yLdu + hPlates * 8; yy += 8) {
      for (let dx = 0; dx < w; dx++) {
        for (let dz = 0; dz < d; dz++) {
          if (this.occupied.has(`${yy}:${sx + dx}:${sz + dz}`)) return false;
        }
      }
    }
    return true;
  }

  public place(
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
    rotationYDeg = 0,
  ): boolean {
    const def = getPartById(partId);
    const realW = def ? def.studsX : w;
    const realD = def ? def.studsZ : d;
    const realH = def ? def.heightPlates : hPlates;
    const effW = rotationYDeg % 180 === 0 ? realW : realD;
    const effD = rotationYDeg % 180 === 0 ? realD : realW;
    if (!this.canPlace(effW, effD, realH, sx, sz, yLdu)) return false;

    for (let yy = yLdu; yy < yLdu + realH * 8; yy += 8) {
      for (let dx = 0; dx < effW; dx++) {
        for (let dz = 0; dz < effD; dz++) {
          this.occupied.add(`${yy}:${sx + dx}:${sz + dz}`);
        }
      }
    }

    const cx = (sx + effW / 2) * 20;
    const cz = (sz + effD / 2) * 20;
    const transform = {
      positionLdu: [cx, yLdu, cz] as [number, number, number],
      rotationDeg: [0, rotationYDeg, 0] as [number, number, number],
    };
    this.count += 1;
    this.parts.push({
      instanceId: `${this.idPrefix}-${this.count}`,
      partId,
      colorCode,
      assemblyId,
      step,
      transform,
      matrix: createTransformMatrix(transform),
    });
    return true;
  }

  /**
   * Füllt eine zusammenhängende X-Reihe im echten Mauerverbund (brick interlocking).
   * Bei stagger=true beginnt die Reihe mit einem kürzeren Versatzstein (1x2 oder 1x1),
   * sodass Stoßfugen gegenüber der darunterliegenden Lage versetzt sind!
   */
  public fillSpanX(
    sxStart: number,
    sxEndInclusive: number,
    sz: number,
    yLdu: number,
    kind: BrickKind,
    colorCode: number,
    assemblyId: string,
    step: number,
    stagger = false,
  ): void {
    const options = PART_BY_KIND_AND_WIDTH[kind];
    let x = sxStart;

    if (stagger && sxEndInclusive - sxStart >= 2) {
      const lead = options.find((o) => o.w === 2) ?? options[options.length - 1];
      if (this.place(lead.partId, lead.w, 1, lead.hPlates, x, sz, yLdu, colorCode, assemblyId, step)) {
        x += lead.w;
      }
    }

    while (x <= sxEndInclusive) {
      const rem = sxEndInclusive - x + 1;
      let placed = false;
      for (const opt of options) {
        if (opt.w <= rem && this.canPlace(opt.w, 1, opt.hPlates, x, sz, yLdu)) {
          this.place(opt.partId, opt.w, 1, opt.hPlates, x, sz, yLdu, colorCode, assemblyId, step);
          x += opt.w;
          placed = true;
          break;
        }
      }
      if (!placed) x += 1;
    }
  }

  /**
   * Füllt eine X-Reihe, respektiert aber einzelne Sonderfarben (z. B. Bullaugen oder Fenster),
   * indem normale Abschnitte automatisch als Großsteine im Verbund zusammengefasst werden.
   */
  public fillColoredSpanX(
    sxStart: number,
    sxEndInclusive: number,
    sz: number,
    yLdu: number,
    kind: BrickKind,
    colorFn: (sx: number) => number | null,
    assemblyId: string,
    step: number,
    stagger = false,
  ): void {
    let runStart: number | null = null;
    let runColor: number | null = null;

    const flush = (endX: number) => {
      if (runStart !== null && runColor !== null) {
        this.fillSpanX(runStart, endX, sz, yLdu, kind, runColor, assemblyId, step, stagger);
      }
      runStart = null;
      runColor = null;
    };

    for (let sx = sxStart; sx <= sxEndInclusive; sx++) {
      const c = colorFn(sx);
      if (c === null) {
        flush(sx - 1);
      } else if (c !== runColor) {
        flush(sx - 1);
        runStart = sx;
        runColor = c;
      }
    }
    flush(sxEndInclusive);
  }

  /**
   * Baut zwei schwarze Sammler-Display-Ständer (wie bei COBI / BlueBrixx Vitrinenmodellen).
   */
  public addDisplayStands(
    xCenters: number[],
    zHalfWidth: number,
    yBase: number,
    colorCode: number,
    assemblyId: string,
    step: number,
  ): void {
    for (const xc of xCenters) {
      for (let sz = -zHalfWidth; sz < zHalfWidth; sz++) {
        this.fillSpanX(xc - 2, xc + 1, sz, yBase, 'plate', colorCode, assemblyId, step, false);
      }
      for (let sz = -Math.max(1, zHalfWidth - 1); sz < Math.max(1, zHalfWidth - 1); sz++) {
        this.fillSpanX(xc - 1, xc, sz, yBase + 8, 'brick', colorCode, assemblyId, step, true);
      }
    }
  }

  /**
   * Baut einen verwindungssteifen Technic-/Verbund-Innenkiel entlang der X-Achse.
   */
  public addTechnicSpine(
    sxStart: number,
    sxEndInclusive: number,
    sz: number,
    yLdu: number,
    assemblyId: string,
    step: number,
  ): void {
    for (let sx = sxStart + 2; sx <= sxEndInclusive - 7; sx += 9) {
      this.place('32524.dat', 7, 1, 3, sx, sz, yLdu, 72, assemblyId, step);
    }
  }

  public toCadModel(meta: {
    id: string;
    name: string;
    description: string;
    assemblies: CadModel['assemblies'];
  }): CadModel {
    const rawModel: CadModel = {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assemblies: meta.assemblies,
      parts: this.parts,
      metadata: {
        generator: 'Fred MacroCadBuilder',
        interlocking: true,
      },
    };
    return rebalanceStepsForHumans(rawModel);
  }
}
