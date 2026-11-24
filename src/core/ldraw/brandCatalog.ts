import { listAllParts } from './catalog';
import { BomReport } from '../pdf/pdfExporter';

export type BrickBrand =
  | 'LEGO'
  | 'GOBRICKS_PANTASY'
  | 'XINGBAO'
  | 'BLUEBRIXX'
  | 'CADA'
  | 'COBI';

export interface BrandCatalogSource {
  brand: BrickBrand;
  displayName: string;
  publicCatalogAvailable: boolean;
  standardCompatibility: 'LDRAW_100_PERCENT' | 'LDRAW_STANDARD_PLUS_PROPRIETARY';
  orderChannel: string;
  notes: string;
}

export const BRAND_CATALOG_SOURCES: BrandCatalogSource[] = [
  {
    brand: 'LEGO',
    displayName: 'LEGO (Offizieller LDraw- & Rebrickable-Standard)',
    publicCatalogAvailable: true,
    standardCompatibility: 'LDRAW_100_PERCENT',
    orderChannel: 'Pick a Brick / BrickLink / Rebrickable CSV',
    notes: 'Vollständige öffentliche Design-IDs über LDraw.org (20.000+ .dat) & Rebrickable CSV (parts.csv.gz).',
  },
  {
    brand: 'GOBRICKS_PANTASY',
    displayName: 'GoBricks (Pantasy, Mould King, Lumibricks / Wobrick / Webrick)',
    publicCatalogAvailable: true,
    standardCompatibility: 'LDRAW_100_PERCENT',
    orderChannel: 'Webrick / Wobrick Bulk-CSV-Upload',
    notes: 'Höchste Klemmkraft-Qualität unter Alternativherstellern; direkte Zuordnung über LDraw-/Rebrickable-IDs.',
  },
  {
    brand: 'XINGBAO',
    displayName: 'Xingbao (Standard-System & Technic)',
    publicCatalogAvailable: false,
    standardCompatibility: 'LDRAW_STANDARD_PLUS_PROPRIETARY',
    orderChannel: 'BlueBrixx Part Packs / Drittanbieter',
    notes: 'Kein öffentlicher offizieller 3D-Katalog; Standard-System- und Technic-Steine 1:1 zu LDraw kompatibel.',
  },
  {
    brand: 'BLUEBRIXX',
    displayName: 'BlueBrixx (Part Packs & Specials)',
    publicCatalogAvailable: false,
    standardCompatibility: 'LDRAW_STANDARD_PLUS_PROPRIETARY',
    orderChannel: 'BlueBrixx Part Packs / Mega Brick Bars',
    notes: 'Keine öffentliche 3D-Datenbank; nutzt Standard-LDraw-Geometrien plus herstellerspezifische Sonderformen.',
  },
  {
    brand: 'CADA',
    displayName: 'CaDA (Technic & System)',
    publicCatalogAvailable: false,
    standardCompatibility: 'LDRAW_STANDARD_PLUS_PROPRIETARY',
    orderChannel: 'CaDA Store / Rebrickable-Inventare',
    notes: 'Technic-Liftarme, Rahmen und Systemsteine weitgehend 1:1 zu LDraw-Design-IDs kompatibel.',
  },
  {
    brand: 'COBI',
    displayName: 'COBI (Display-Modelle & Spezialformen)',
    publicCatalogAvailable: false,
    standardCompatibility: 'LDRAW_STANDARD_PLUS_PROPRIETARY',
    orderChannel: 'COBI Einzelteil-Shop / cobi.club',
    notes: 'Kein offizieller LDraw-3D-Katalog für COBI-exklusive Spezialformen (Schiffsrümpfe/Geschütze); Standardsteine kompatibel.',
  },
];

export interface ExternalCatalogPart {
  partNum: string;
  name: string;
  partCatId: string;
  source: 'REBRICKABLE_CSV';
}

/**
 * Parses official Rebrickable `parts.csv` lines (`part_num,name,part_cat_id,...`)
 * so Fred can import tens of thousands of verified real brick IDs locally.
 */
export function parseRebrickablePartsCsv(csvText: string): ExternalCatalogPart[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const parts: ExternalCatalogPart[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Simple RFC-4180 aware split for quoted names
    const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)|(?<=,)(?=,)/g);
    if (!row || row.length < 3) continue;
    const partNum = row[0].replace(/^"|"$/g, '').trim();
    const name = row[1].replace(/^"|"$/g, '').trim();
    const partCatId = row[2].replace(/^"|"$/g, '').trim();
    if (!partNum || !name) continue;
    parts.push({ partNum, name, partCatId, source: 'REBRICKABLE_CSV' });
  }
  return parts;
}

/**
 * Checks which brands supply a given LDraw part from Fred's active catalog.
 */
export function getCompatibleBrandsForPart(partId: string): BrickBrand[] {
  const clean = partId.toLowerCase();
  if (clean === '99999.dat') return []; // Prototype placeholder
  if (clean === '3009.dat') return ['LEGO', 'BLUEBRIXX', 'XINGBAO'];
  return ['LEGO', 'GOBRICKS_PANTASY', 'XINGBAO', 'BLUEBRIXX', 'CADA', 'COBI'];
}

export function listPartsByBrand(brand: BrickBrand) {
  return listAllParts().filter((p) => getCompatibleBrandsForPart(p.partId).includes(brand));
}

/**
 * Exports a Fred BOM into a ready-to-upload Bulk Order CSV for Webrick / Wobrick (GoBricks/Pantasy)
 * or Rebrickable (`Part,Color,Quantity,Is Spare`).
 */
export function exportBomToOrderCsv(
  bom: BomReport,
  format: 'REBRICKABLE_WEBRICK_CSV' = 'REBRICKABLE_WEBRICK_CSV',
): { format: string; filename: string; csv: string } {
  const header = 'Part,Color,Quantity,Is Spare';
  const rows = bom.items.map((item) => {
    const designId = item.partId.replace(/\.dat$/i, '');
    return `${designId},${item.colorCode},${item.quantity},False`;
  });
  return {
    format,
    filename: `${bom.modelName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Webrick_GoBricks_BOM.csv`,
    csv: [header, ...rows].join('\n') + '\n',
  };
}
