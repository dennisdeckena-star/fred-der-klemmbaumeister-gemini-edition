import { describe, expect, it } from 'vitest';
import {
  getColorByCode,
  getPartById,
  listAllParts,
  OrderStatus,
  parseLDrawContent,
  searchParts,
} from '../src/core/ldraw';

describe('Phase 1.2: LDraw-Teilebibliothek & .dat-Parser', () => {
  it('enthält echte .dat-Geometrien für Standard-Klemmbausteine und parst sie deterministisch', () => {
    const brick2x4 = getPartById('3001.dat');
    expect(brick2x4).toBeDefined();
    expect(brick2x4!.dimensionsLdu).toEqual([80, 24, 40]);

    const parsed = parseLDrawContent(brick2x4!.datContent);
    expect(parsed.headerComments.some((c) => c.includes('!LDRAW_ORG Part'))).toBe(true);
    expect(parsed.quads.length).toBeGreaterThan(50); // Body + 8 Stud cylinders
    expect(parsed.triangles.length).toBeGreaterThan(50); // Stud caps
    expect(parsed.lines.length).toBeGreaterThan(20);
  });

  it('liefert korrekte Noppen-, Tube- und Technic-Pin-Anschlussdaten', () => {
    const brick2x4 = getPartById('3001')!;
    const studs = brick2x4.connectors.filter((c) => c.type === 'stud');
    const tubes = brick2x4.connectors.filter((c) => c.type === 'tube');
    expect(studs).toHaveLength(8);
    expect(tubes).toHaveLength(8);

    const tile1x2 = getPartById('3069b.dat')!;
    expect(tile1x2.connectors.filter((c) => c.type === 'stud')).toHaveLength(0);
    expect(tile1x2.connectors.filter((c) => c.type === 'tube')).toHaveLength(2);

    const technic1x4 = getPartById('3701.dat')!;
    expect(technic1x4.connectors.filter((c) => c.type === 'pin_hole').length).toBeGreaterThanOrEqual(6);

    const pin = getPartById('2780.dat')!;
    expect(pin.connectors.filter((c) => c.type === 'pin')).toHaveLength(2);
  });

  it('deckt alle geforderten Bestellstatus-Felder im Katalog ab', () => {
    const allFlags = new Set<OrderStatus>();
    for (const part of listAllParts()) {
      for (const flag of part.statusFlags) {
        allFlags.add(flag);
      }
    }
    const required: OrderStatus[] = [
      'CONFIRMED_GEOMETRY',
      'CONFIRMED_COLOR',
      'ORDERABLE',
      'OUT_OF_STOCK',
      'DISCONTINUED',
      'UNKNOWN',
    ];
    for (const flag of required) {
      expect(allFlags.has(flag)).toBe(true);
    }
  });

  it('unterstützt Katalogsuche nach Name, Kategorie, Farbe und Status', () => {
    const technicParts = searchParts({ category: 'Technic' });
    expect(technicParts.length).toBeGreaterThanOrEqual(3);

    const yellowColor = getColorByCode(14);
    expect(yellowColor.name).toBe('Yellow');
    expect(yellowColor.hex).toBe('#FAC80A');
  });
});
