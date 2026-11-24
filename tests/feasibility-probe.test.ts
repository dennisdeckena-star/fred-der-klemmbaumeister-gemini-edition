import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCollisions, validateConnections } from '../src/core/cad';
import { buildFeasibilityProbeModel } from '../src/core/models/sampleModels';
import { generateInstructionPdf } from '../src/core/pdf/pdfExporter';
import {
  computeBom,
  generateStepsForModel,
  validateInstructionsForModel,
} from '../src/core/tools';

describe('Phase 1.5: Machbarkeitsprobe (Innenkern + Außenhaut + BOM + farbiges PDF)', () => {
  it('erzeugt ein kollisionsfreies, voll verbundenes Modell mit Noppen- und Pin-Verbindungen sowie mehrseitigem PDF', async () => {
    const model = buildFeasibilityProbeModel();

    expect(model.assemblies.length).toBeGreaterThanOrEqual(3);
    expect(model.parts.length).toBeGreaterThanOrEqual(12);

    const collisions = checkCollisions(model);
    expect(collisions.hasCollisions).toBe(false);

    const connections = validateConnections(model);
    expect(connections.isFullyConnected).toBe(true);
    expect(connections.edges.some((e) => e.connectionType === 'stud-tube')).toBe(true);
    expect(connections.edges.some((e) => e.connectionType === 'pin-hole')).toBe(true);

    const bom = computeBom(model);
    expect(bom.totalParts).toBe(model.parts.length);
    expect(bom.totalWeightGrams).toBeGreaterThan(10);

    const steps = generateStepsForModel(model);
    expect(steps.length).toBe(5);

    const instrValidation = validateInstructionsForModel(model, steps);
    expect(instrValidation.valid).toBe(true);
    expect(instrValidation.bomMatchesSteps).toBe(true);

    const pdf = await generateInstructionPdf({ model, steps, bom });
    expect(pdf.pageCount).toBe(7); // Cover + 5 Schritte + BOM
    expect(pdf.bytes.byteLength).toBeGreaterThan(2000);
    expect(Buffer.from(pdf.bytes.subarray(0, 4)).toString('ascii')).toBe('%PDF');

    const outPath = path.resolve(__dirname, '..', 'artifacts', 'feasibility-probe.pdf');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, pdf.bytes);
    expect(fs.existsSync(outPath)).toBe(true);
  });
});
