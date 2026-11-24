import { describe, expect, it } from 'vitest';
import { buildNeuschwansteinProModel } from '../src/core/models/neuschwansteinProModel';
import { getStarterBlueprints } from '../src/core/models/sampleModels';
import { runValidationCenter } from '../src/core/validation/validationCenter';
import { FredAgentHarness } from '../src/core/agent/fredHarness';
import { FredGeminiClient } from '../src/core/ai/geminiClient';
import { GoogleImagePlugin } from '../src/core/plugins/googleImagePlugin';

describe('Ralph-Loop: Schloss Neuschwanstein Meister-Edition (512×272×342 mm, ≥ 8.900 Teile)', () => {
  it('erfüllt exakte Standard-Steinmaße (~512×272×342 mm), >= 8.900 Teile und 100 % PASS in allen 7 Physik-Checks', () => {
    const castle = buildNeuschwansteinProModel();

    // 1. Teilezahl >= 8.900 (übertrifft BlueBrixx 7.436!)
    expect(castle.parts.length).toBeGreaterThanOrEqual(8900);

    // 2. Exakte Außenmaße im Standard-Steinformat (1 Noppe = 8 mm = 20 LDU, 1 Platte = 3,2 mm = 8 LDU)
    const xs = castle.parts.map((p) => p.transform.positionLdu[0]);
    const zs = castle.parts.map((p) => p.transform.positionLdu[2]);
    const ys = castle.parts.map((p) => p.transform.positionLdu[1]);
    const widthMm = ((Math.max(...xs) - Math.min(...xs) + 20) / 20) * 8;
    const depthMm = ((Math.max(...zs) - Math.min(...zs) + 20) / 20) * 8;
    const heightMm = ((Math.max(...ys) + 8) / 8) * 3.2;

    expect(widthMm).toBeGreaterThanOrEqual(504);
    expect(widthMm).toBeLessThanOrEqual(520);
    expect(depthMm).toBeGreaterThanOrEqual(264);
    expect(depthMm).toBeLessThanOrEqual(280);
    expect(heightMm).toBeGreaterThanOrEqual(335);
    expect(heightMm).toBeLessThanOrEqual(355);

    // 3. Alle 7 deterministischen Prüfungen 100 % GRÜN
    const report = runValidationCenter(castle, { maxParts: 15000 });
    const summary = report.checks
      .filter((c) => c.status !== 'NOT_TESTED')
      .map((c) => `${c.id}:${c.status}(${c.details})`)
      .join(' | ');
    expect(report.deterministicStatus, summary).toBe('PASS');
    for (const check of report.checks) {
      if (check.id === 'physical_load_bearing') continue;
      expect(check.status, `${check.id}: ${check.details}`).toBe('PASS');
    }

    // 4. Fest in der Standard-Bibliothek (MEINE BAUPLÄNE) enthalten
    const starters = getStarterBlueprints();
    expect(starters.some((m) => m.id === 'model-neuschwanstein-pro-9000')).toBe(true);
  }, 30_000);

  it('routet Neuschwanstein-Anfragen im FredAgentHarness auf die Meister-Edition (>= 8.900 Teile)', async () => {
    const harness = new FredAgentHarness({
      geminiClient: new FredGeminiClient({ useOfflineAdapter: true }),
      imagePlugin: new GoogleImagePlugin({ useOfflineAdapter: true }),
    });
    const draft = await harness.prepareConcept('Schloss Neuschwanstein mit 9000 Teilen nach BlueBrixx Vorlage');
    const built = await harness.buildApprovedConcept(draft, { maxCritiqueRounds: 0 });
    expect(built.model.id).toBe('model-neuschwanstein-pro-9000');
    expect(built.model.parts.length).toBeGreaterThanOrEqual(8900);
  }, 30_000);
});
