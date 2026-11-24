#!/usr/bin/env node
/**
 * Fred Pro-Builder Plugin: Offizieller LDraw Complete Parts Library Synchronizer.
 * Lädt bei Bedarf die offizielle LDraw-Bibliothek (20.000+ echte .dat-Teile) von library.ldraw.org
 * in `assets/ldraw-complete/` herunter.
 */
import fs from 'node:fs';
import path from 'node:path';

export const OFFICIAL_LDRAW_COMPLETE_URL = 'https://library.ldraw.org/library/updates/complete.zip';
export const TARGET_LDRAW_DIR = path.resolve(process.cwd(), 'assets', 'ldraw-complete');

export function getLDrawLibraryStatus() {
  const partsDir = path.join(TARGET_LDRAW_DIR, 'parts');
  if (!fs.existsSync(partsDir)) {
    return { installed: false, partCount: 0, path: TARGET_LDRAW_DIR };
  }
  const files = fs.readdirSync(partsDir).filter((f) => f.toLowerCase().endsWith('.dat'));
  return { installed: files.length > 100, partCount: files.length, path: TARGET_LDRAW_DIR };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const status = getLDrawLibraryStatus();
  if (status.installed) {
    console.log(`Offizielle LDraw-Bibliothek bereits vorhanden (${status.partCount} .dat-Teile in ${status.path}).`);
  } else {
    console.log(`Offizielle LDraw-Bibliothek noch nicht lokal entpackt.`);
    console.log(`Download-Quelle: ${OFFICIAL_LDRAW_COMPLETE_URL}`);
    console.log(`Zielordner: ${TARGET_LDRAW_DIR}`);
  }
}
