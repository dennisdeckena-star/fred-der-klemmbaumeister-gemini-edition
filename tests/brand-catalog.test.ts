import { describe, expect, it } from 'vitest';
import {
  BRAND_CATALOG_SOURCES,
  exportBomToOrderCsv,
  listPartsByBrand,
  parseRebrickablePartsCsv,
} from '../src/core/ldraw/brandCatalog';
import { computeBom } from '../src/core/cad/bomAndSteps';
import { buildFeasibilityProbeModel } from '../src/core/models/sampleModels';

describe('Multi-Hersteller-Teilekatalog (LEGO, GoBricks/Pantasy, Xingbao, BlueBrixx, CaDA, COBI)', () => {
  it('führt ehrliche Katalog-Quellen für alle 6 Hersteller und filtert kompatible Teile', () => {
    expect(BRAND_CATALOG_SOURCES.map((b) => b.brand)).toEqual([
      'LEGO',
      'GOBRICKS_PANTASY',
      'XINGBAO',
      'BLUEBRIXX',
      'CADA',
      'COBI',
    ]);

    const gobricksParts = listPartsByBrand('GOBRICKS_PANTASY');
    expect(gobricksParts.length).toBeGreaterThanOrEqual(35);
    expect(gobricksParts.some((p) => p.partId === '64179.dat')).toBe(true);
  });

  it('parst offizielle Rebrickable parts.csv Dumps und exportiert fertige Webrick/GoBricks-Bestell-CSV', () => {
    const sampleCsv = [
      'part_num,name,part_cat_id,part_material',
      '3001,"Brick 2 x 4",11,Plastic',
      '64179,"Technic Pin Connector Frame 5 x 7 Open Center",51,Plastic',
    ].join('\n');

    const imported = parseRebrickablePartsCsv(sampleCsv);
    expect(imported).toHaveLength(2);
    expect(imported[0].partNum).toBe('3001');
    expect(imported[1].partNum).toBe('64179');

    const bom = computeBom(buildFeasibilityProbeModel());
    const orderCsv = exportBomToOrderCsv(bom);
    expect(orderCsv.csv).toContain('Part,Color,Quantity,Is Spare');
    expect(orderCsv.csv).toContain('3701,72,2,False');
  });
});
