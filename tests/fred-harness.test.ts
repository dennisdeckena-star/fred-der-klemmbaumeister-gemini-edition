import { describe, expect, it } from 'vitest';
import {
  createNanoBananaMcpTools,
  GoogleImagePlugin,
  NANO_BANANA_PRIMARY_MODEL,
} from '../src/core/plugins/googleImagePlugin';
import { FredMcpBroker } from '../src/core/mcp/broker';
import { extractRequestedPartCount, FredAgentHarness } from '../src/core/agent/fredHarness';
import { FredGeminiClient } from '../src/core/ai/geminiClient';

describe('Fred 5-Schichten-Agent-Harness & Nano Banana Werkzeug (BMAD / PIV / Ralph-Loop)', () => {
  it('priorisiert Nano Banana (gemini-nano-banana-2.1) über ListModels als #1 und ignoriert abgeschaltete Imagen-Modelle', async () => {
    const plugin = new GoogleImagePlugin({ apiKey: 'AIzaSyTestKey12345678901234567890' });
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          models: [
            { name: 'models/imagen-3.0-generate-002', supportedGenerationMethods: ['predict'] },
            { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-3.1-flash-image', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-nano-banana-2.1', supportedGenerationMethods: ['generateContent'] },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

    const discovered = await plugin.discoverImageModels(mockFetch);
    expect(discovered[0]).toBe(NANO_BANANA_PRIMARY_MODEL);
    expect(discovered).toContain('gemini-3.1-flash-image');
    expect(discovered.some((m) => m.startsWith('imagen-'))).toBe(false);
  });

  it('registriert nano_banana.generate_image & nano_banana.edit_image fest im MCP-Broker inkl. Audit-Log', async () => {
    const plugin = new GoogleImagePlugin({ useOfflineAdapter: true });
    const broker = new FredMcpBroker();
    broker.registerCadTools(createNanoBananaMcpTools(plugin));

    const names = broker.listTools().map((t) => t.name);
    expect(names).toContain('nano_banana.generate_image');
    expect(names).toContain('nano_banana.edit_image');

    const res = await broker.invoke<{ imageDataUrl: string; modelUsed: string }>('nano_banana.generate_image', {
      prompt: 'Gorch Fock in 1:300',
      detailLevel: 'DISPLAY',
    });
    expect(res.imageDataUrl).toBe('./concepts/gorch-fock-concept.png');
    expect(broker.getAuditLog().some((a) => a.toolName === 'nano_banana.generate_image' && a.status === 'ALLOWED')).toBe(
      true,
    );
  });

  it('extrahiert gewünschte Teilezahlen („4000 Teile“) korrekt und ignoriert Maßstäbe („1:300“)', () => {
    expect(extractRequestedPartCount('hallo Fred ich würde mir wünschen das Brandenburger Tor mit 4000 Teilen zu bauen')).toBe(4000);
    expect(extractRequestedPartCount('Gorch Fock in 1:300')).toBeNull();
  });

  it('stoppt in Phase A strikt am Nutzer-Freigabe-Gate und baut das 3D-Modell erst nach Freigabe (Phase B)', async () => {
    const harness = new FredAgentHarness({
      geminiClient: new FredGeminiClient({ useOfflineAdapter: true }),
      imagePlugin: new GoogleImagePlugin({ useOfflineAdapter: true }),
    });

    const draft = await harness.prepareConcept('Gorch Fock in 1:300');
    expect(harness.getState()).toBe('AWAITING_USER_APPROVAL');
    expect(draft.imageUrl).toBe('./concepts/gorch-fock-concept.png');
    expect(draft.trace.some((t) => t.layer === 'KNOWLEDGE')).toBe(true);
    expect(draft.trace.some((t) => t.layer === 'RESEARCH')).toBe(true);
    expect(draft.trace.some((t) => t.layer === 'IMAGE_PLUGIN')).toBe(true);

    const built = await harness.buildApprovedConcept(draft);
    expect(harness.getState()).toBe('READY');
    expect(built.model.parts.length).toBeGreaterThan(400);
    expect(built.trace.some((t) => t.layer === 'CAD_ENGINE')).toBe(true);
    expect(built.trace.some((t) => t.layer === 'PHYSICS_QA' && t.status === 'OK')).toBe(true);
  });

  it('baut Schloss Neuschwanstein (2500 Teile) mit Slopes, Rundtürmen, SNOT & 100 % Verbundenheit (connections: PASS, overhangs: PASS)', async () => {
    const { runValidationCenter } = await import('../src/core/validation/validationCenter');
    const harness = new FredAgentHarness({
      geminiClient: new FredGeminiClient({ useOfflineAdapter: true }),
      imagePlugin: new GoogleImagePlugin({ useOfflineAdapter: true }),
    });

    const draft = await harness.prepareConcept(
      'Schloss Neuschwanstein als fotorealistisches Sammlermodell in 2500 Teilen Maßstab 1:400',
    );
    const built = await harness.buildApprovedConcept(draft);
    const report = runValidationCenter(built.model, { maxParts: 5000 });

    expect(built.model.name).toBe('Schloss Neuschwanstein (1:400)');
    expect(built.model.parts.some((p) => p.partId === '3941.dat')).toBe(true); // Runde Ecktürme
    expect(built.model.parts.some((p) => p.partId === '3039.dat')).toBe(true); // 45°-Slopes Satteldach
    expect(built.model.parts.some((p) => p.partId === '87087.dat')).toBe(true); // SNOT-Fassade
    expect(report.checks.find((c) => c.id === 'collisions')?.status).toBe('PASS');
    expect(report.checks.find((c) => c.id === 'stud_grid_physics')?.status).toBe('PASS');
    expect(report.checks.find((c) => c.id === 'connections')?.status).toBe('PASS');
    expect(report.checks.find((c) => c.id === 'overhangs')?.status).toBe('PASS');
  });
});
