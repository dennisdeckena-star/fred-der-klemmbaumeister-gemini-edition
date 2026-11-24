import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FredGeminiClient, validateApiKeyFormat } from '../src/core/ai/geminiClient';
import { CadDocument } from '../src/core/cad';
import { ConceptStudioService } from '../src/core/concept/conceptStudio';
import { FredMcpBroker } from '../src/core/mcp/broker';
import { FredMemoryStore } from '../src/core/memory/memoryStore';
import { LocalRagStore } from '../src/core/rag/ragStore';
import { CadWorkspaceStore, createCadTools } from '../src/core/tools';
import { runValidationCenter } from '../src/core/validation/validationCenter';

describe('Phase 4.3: Finale Ende-zu-Ende-Abnahme (kompletter Workflow + Persistenz)', () => {
  it('durchläuft Projekt → Setup/API → Konzept → Korrektur → Freigabe → 3D → Validierung → BOM → Anleitung → PDF → Speichern → Schließen → Wiederöffnen', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fred-e2e-'));
    const memoryMd = path.join(projectDir, 'Memory.md');
    const memoryDb = path.join(projectDir, 'memory.sqlite');
    const ragDb = path.join(projectDir, 'rag.sqlite');

    // 1. Setup / API-Check
    expect(validateApiKeyFormat('AIzaSyDemoValidFormatKey1234567890').valid).toBe(true);
    const gemini = new FredGeminiClient({ useOfflineAdapter: true, maxBudgetEur: 5.0 });
    const chatReply = await gemini.streamChat([
      { role: 'user', text: 'Hallo Fred, wir bauen ein Modul mit tragendem Kern!' },
    ]);
    expect(chatReply.adapterMode).toBe('OFFLINE_TEST_ADAPTER');

    // 2. RAG & Memory persistieren
    const rag = new LocalRagStore(ragDb);
    rag.ingestPages('Bau-Richtlinie', ['Tragender Technic-Kern erhöht die Stabilität bei größeren Modellen.']);
    const ragHit = rag.query('Stabilität Technic-Kern');
    expect(ragHit.verified).toBe(true);
    rag.close();

    const memory = new FredMemoryStore(memoryMd, memoryDb);
    memory.addPreference('PREFERENCE', 'Weniger sichtbare Noppen – glatte Außenhaut', 'Dennis');
    memory.close();

    // 3. Konzeptstudio: Vorschau → Korrektur → Gate → Freigabe
    const studio = new ConceptStudioService({ useOfflineAdapter: true });
    const session = await studio.createConcept('E2E Kern-Modul', 'Kompaktes Modul mit Technic-Kern', 'STANDARD');
    await studio.reviseConcept(session.id, 'Außenhaut in Rot und Gelb mit glatten Tiles');
    expect(() => studio.buildDeterministicModelFromApprovedConcept(session.id)).toThrow(/CONCEPT_NOT_APPROVED/);
    studio.approveConcept(session.id, 'Dennis');

    // 4. Deterministisches 3D-Modell + MCP-Broker
    const model = studio.buildDeterministicModelFromApprovedConcept(session.id);
    const store1 = new CadWorkspaceStore(projectDir);
    store1.register(new CadDocument(model));
    const broker1 = new FredMcpBroker();
    broker1.registerCadTools(createCadTools(store1));

    // 5. Validierung, BOM, 3D-Anleitung
    const validation = runValidationCenter(model);
    expect(validation.deterministicStatus).toBe('PASS');
    expect(validation.checks.find((c) => c.id === 'physical_load_bearing')?.status).toBe('NOT_TESTED');

    const bom = (await broker1.invoke('bom.generate', { modelId: model.id })) as any;
    expect(bom.totalParts).toBe(model.parts.length);

    const steps = (await broker1.invoke('instructions.generate_steps', { modelId: model.id })) as any[];
    expect(steps.length).toBeGreaterThanOrEqual(4);

    const instrVal = (await broker1.invoke('instructions.validate', { modelId: model.id })) as any;
    expect(instrVal.valid).toBe(true);

    // 6. PDF-Export
    const pdfPath = path.join(projectDir, 'e2e-anleitung.pdf');
    const pdfRes = (await broker1.invoke('pdf.export', { modelId: model.id, outputPath: pdfPath })) as any;
    expect(fs.existsSync(pdfPath)).toBe(true);
    expect(pdfRes.pageCount).toBe(steps.length + 2);
    expect(fs.readFileSync(pdfPath).subarray(0, 4).toString('ascii')).toBe('%PDF');

    // 7. Speichern → Schließen (neue Instanzen) → Wiederöffnen
    const saveRes = (await broker1.invoke('model.save', { modelId: model.id, fileName: 'e2e_project' })) as any;
    expect(fs.existsSync(saveRes.jsonPath)).toBe(true);
    expect(fs.existsSync(saveRes.ldrPath)).toBe(true);

    // Reopen in brand new workspace & memory store (simulating app restart)
    const store2 = new CadWorkspaceStore(projectDir);
    const broker2 = new FredMcpBroker();
    broker2.registerCadTools(createCadTools(store2));

    const reopened = (await broker2.invoke('model.load', { filePath: saveRes.jsonPath })) as any;
    expect(reopened.id).toBe(model.id);
    expect(reopened.parts.length).toBe(model.parts.length);
    expect(reopened.assemblies.length).toBe(model.assemblies.length);

    const reopenedBom = (await broker2.invoke('bom.generate', { modelId: reopened.id })) as any;
    expect(reopenedBom.totalParts).toBe(bom.totalParts);
    expect(reopenedBom.totalWeightGrams).toBe(bom.totalWeightGrams);

    const memoryReopened = new FredMemoryStore(memoryMd, memoryDb);
    expect(memoryReopened.search('Noppen')).toHaveLength(1);
    memoryReopened.close();
  });
});
