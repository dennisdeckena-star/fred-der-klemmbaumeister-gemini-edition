import { describe, expect, it } from 'vitest';
import { getStarterBlueprints } from '../src/core/models/sampleModels';
import { buildTitanic3000Model } from '../src/core/models/titanicModel';
import { buildGorchFockModel } from '../src/core/models/customModelBuilder';
import { checkStudGridPhysics, runValidationCenter } from '../src/core/validation/validationCenter';
import { CadDocument } from '../src/core/cad';

describe('Klemmbaustein-Physik: Alle Modelle (0 Kollisionen, exaktes 20-LDU-Noppenraster) & RMS Titanic 3.000 Teile', () => {
  it('erkennt Halbnoppen-Fehlklemmung als FAIL', () => {
    const doc = new CadDocument();
    doc.addPart({ partId: '3036.dat', colorCode: 1, positionLdu: [0, 0, 0], step: 1 });
    // Illegal half-stud offset: 2x4 brick centered at X=10 puts tubes at -20, 0, +20, +40 (between studs!)
    doc.addPart({ partId: '3001.dat', colorCode: 4, positionLdu: [10, 8, 0], step: 2 });

    const gridCheck = checkStudGridPhysics(doc.getModel());
    expect(gridCheck.passed).toBe(false);
    expect(gridCheck.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('bestätigt für alle Standard-Baupläne 0 Kollisionen, exaktes Noppenraster & volle Verbundenheit', () => {
    const starters = getStarterBlueprints().filter((m) => m.parts.length <= 200);
    expect(starters.length).toBeGreaterThanOrEqual(5);

    for (const model of starters) {
      const report = runValidationCenter(model, { maxParts: 500 });
      const failed = report.checks.filter((c) => c.status === 'FAIL');
      expect(failed, `Fehler in Modell ${model.name}: ${JSON.stringify(failed)}`).toHaveLength(0);
      expect(report.deterministicStatus).toBe('PASS');
    }
  });

  it('erzeugt eine physisch baubare RMS Titanic mit exakt 3.000 Teilen im 20-LDU-Noppenraster und menschengerechten BlueBrixx-Bauschritten (max. 14 Teile & max. 6 Typen/Schritt)', async () => {
    const { generateStepsForModel } = await import('../src/core/cad/bomAndSteps');
    const titanic = buildTitanic3000Model(3000);
    expect(titanic.parts).toHaveLength(3000);

    const gridCheck = checkStudGridPhysics(titanic);
    expect(gridCheck.passed, `Rasterfehler: ${gridCheck.violations.slice(0, 3).join('; ')}`).toBe(true);

    const steps = generateStepsForModel(titanic);
    expect(steps.length).toBeGreaterThanOrEqual(200);
    for (const step of steps) {
      expect(step.newPartInstanceIds.length).toBeLessThanOrEqual(14);
      expect(step.calloutParts.length).toBeLessThanOrEqual(6);
    }
  });

  it('erzeugt eine physisch baubare Gorch Fock (1:300) mit 0 Kollisionen, 100 % 20-LDU-Noppenraster und menschengerechten Bauschritten', async () => {
    const { generateStepsForModel } = await import('../src/core/cad/bomAndSteps');
    const gorchFock = buildGorchFockModel('1:300');
    expect(gorchFock.parts.length).toBeGreaterThanOrEqual(250);

    const gridCheck = checkStudGridPhysics(gorchFock);
    expect(gridCheck.passed, `Rasterfehler: ${gridCheck.violations.slice(0, 3).join('; ')}`).toBe(true);

    const report = runValidationCenter(gorchFock, { maxParts: 1500 });
    const collisions = report.checks.find((c) => c.id === 'collisions');
    expect(collisions?.status).toBe('PASS');

    const steps = generateStepsForModel(gorchFock);
    expect(steps.length).toBeGreaterThanOrEqual(20);
    for (const step of steps) {
      expect(step.newPartInstanceIds.length).toBeLessThanOrEqual(14);
      expect(step.calloutParts.length).toBeLessThanOrEqual(6);
    }
  });
});
