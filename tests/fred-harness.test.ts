import { describe, expect, it } from 'vitest';
import { GoogleImagePlugin } from '../src/core/plugins/googleImagePlugin';
import { extractRequestedPartCount, FredAgentHarness } from '../src/core/agent/fredHarness';
import { FredGeminiClient } from '../src/core/ai/geminiClient';

describe('Fred 5-Schichten-Agent-Harness & GoogleImagePlugin (BMAD / PIV / Ralph-Loop)', () => {
  it('erkennt über ListModels moderne Gemini/Nano-Banana-Bildmodelle und ignoriert abgeschaltete Imagen-Modelle', async () => {
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
    expect(discovered[0]).toBe('gemini-3.1-flash-image');
    expect(discovered).toContain('gemini-nano-banana-2.1');
    expect(discovered.some((m) => m.startsWith('imagen-'))).toBe(false);
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
});
