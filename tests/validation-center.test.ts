import { describe, expect, it } from 'vitest';
import { CadDocument } from '../src/core/cad';
import { buildFeasibilityProbeModel } from '../src/core/models/sampleModels';
import { runValidationCenter } from '../src/core/validation/validationCenter';

describe('Phase 3.3: Unabhängiges Validierungszentrum (PASS / FAIL / NOT_TESTED)', () => {
  it('prüft ein sauberes Modell deterministisch mit PASS und markiert physische Belastbarkeit als NOT_TESTED', () => {
    const model = buildFeasibilityProbeModel();
    const report = runValidationCenter(model, { maxParts: 100 });

    expect(report.deterministicStatus).toBe('PASS');
    const byId = new Map(report.checks.map((c) => [c.id, c]));
    expect(byId.get('part_limit')?.status).toBe('PASS');
    expect(byId.get('collisions')?.status).toBe('PASS');
    expect(byId.get('connections')?.status).toBe('PASS');
    expect(byId.get('overhangs')?.status).toBe('PASS');
    expect(byId.get('bom_identity')?.status).toBe('PASS');
    expect(byId.get('instructions_consistency')?.status).toBe('PASS');
    expect(byId.get('physical_load_bearing')?.status).toBe('NOT_TESTED');
  });

  it('erkennt Teilelimit-Überschreitung, Kollisionen, schwebende Teile und extreme Überhänge als FAIL', () => {
    const doc = new CadDocument();
    doc.addPart({ partId: '3005.dat', colorCode: 4, positionLdu: [0, 0, 0], step: 1 });
    // Severe overhang: 1x8 brick balanced on a single 1x1 brick at one end (only 12.5% supported!)
    doc.addPart({ partId: '3008.dat', colorCode: 14, positionLdu: [70, 24, 0], step: 2 });
    // Floating unconnected part
    doc.addPart({ partId: '3005.dat', colorCode: 1, positionLdu: [300, 80, 0], step: 3 });

    const report = runValidationCenter(doc.getModel(), { maxParts: 2 });
    expect(report.deterministicStatus).toBe('FAIL');

    const byId = new Map(report.checks.map((c) => [c.id, c]));
    expect(byId.get('part_limit')?.status).toBe('FAIL');
    expect(byId.get('connections')?.status).toBe('FAIL');
    expect(byId.get('overhangs')?.status).toBe('FAIL');
    expect(byId.get('physical_load_bearing')?.status).toBe('NOT_TESTED');
  });
});
