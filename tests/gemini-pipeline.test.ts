import { describe, expect, it } from 'vitest';
import { FredGeminiClient } from '../src/core/ai/geminiClient';
import { runFredBuildPipeline, PipelineStage } from '../src/core/ai/fredPipeline';
import { buildGorchFockModel, buildCustomModelFromPrompt } from '../src/core/models/customModelBuilder';
import { checkStudGridPhysics, runValidationCenter } from '../src/core/validation/validationCenter';

describe('Fred Pro-Pipeline (AP 1–4): Internet-Research, Makro-Steinverbund & Vision-Selbstkritik', () => {
  it('recherchiert via Fred-Cloud-Proxy (Google Search Grounding) echte Maße & Quellen', async () => {
    const client = new FredGeminiClient({
      providerMode: 'FRED_CLOUD_PROXY',
      proxyUrl: 'https://proxy.example.test/api/chat',
    });

    let capturedMode = '';
    const mockFetch: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { mode?: string };
      capturedMode = body.mode ?? '';
      return new Response(
        JSON.stringify({
          text: JSON.stringify({
            title: 'Gorch Fock (1:300)',
            scaleLabel: '1:300',
            category: 'tall_ship',
            realDimensionsNote: '89,3 m Länge ü. A., Dreimastbark der Deutschen Marine',
            targetStudsLength: 56,
            targetStudsWidth: 8,
            targetStudsHeight: 28,
            primaryColors: [15, 320, 19],
            accentColors: [0, 14, 4],
            signatureFeatures: ['Display-Ständer', '3 Masten', 'Weißer Rumpf'],
            assemblies: ['1. Ständer', '2. Rumpf', '3. Masten'],
          }),
          sources: [{ title: 'Wikipedia – Gorch Fock (1958)', url: 'https://de.wikipedia.org/wiki/Gorch_Fock_(Schiff,_1958)' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const brief = await client.researchSubject('Gorch Fock in 1:300', undefined, mockFetch);
    expect(capturedMode).toBe('research');
    expect(brief.title).toContain('Gorch Fock');
    expect(brief.sources).toHaveLength(1);
    expect(brief.sources[0].url).toContain('wikipedia.org');
  });

  it('baut die Gorch Fock im echten Großstein-Verbund (mit Display-Ständer, Technic-Kiel & deutlich weniger 1x1-Steinen)', () => {
    const gf = buildGorchFockModel('1:300');
    const oneByOneCount = gf.parts.filter((p) => p.partId === '3005.dat' || p.partId === '3024.dat').length;
    const multiStudCount = gf.parts.filter((p) =>
      ['3008.dat', '3010.dat', '3004.dat', '3460.dat', '3710.dat', '3023.dat', '2431.dat', '3069b.dat', '32524.dat'].includes(
        p.partId,
      ),
    ).length;

    expect(multiStudCount).toBeGreaterThan(oneByOneCount);
    expect(gf.parts.some((p) => p.partId === '32524.dat')).toBe(true); // Technic-Innenkiel
    expect(gf.assemblies.some((a) => a.id === 'asm-stand')).toBe(true); // Sammler-Display-Ständer

    const grid = checkStudGridPhysics(gf);
    expect(grid.passed).toBe(true);
    const val = runValidationCenter(gf, { maxParts: 2000 });
    expect(val.checks.find((c) => c.id === 'collisions')?.status).toBe('PASS');
  });

  it('baut beliebige neue Kategorien (Sportwagen & Leuchtturm) kollisionsfrei im 20-LDU-Raster', () => {
    for (const [title, prompt] of [
      ['Porsche 911', 'bau mir einen Porsche 911 Sportwagen'],
      ['Leuchtturm', 'bau mir einen rot-weißen Leuchtturm'],
    ]) {
      const model = buildCustomModelFromPrompt(title, prompt);
      expect(model.parts.length).toBeGreaterThan(30);
      expect(checkStudGridPhysics(model).passed).toBe(true);
      const val = runValidationCenter(model, { maxParts: 2000 });
      expect(val.checks.find((c) => c.id === 'collisions')?.status).toBe('PASS');
    }
  });

  it('durchläuft alle 6 Pipeline-Stufen und führt bei Vision-Kritik automatisch eine Nachbesserungsrunde aus', async () => {
    const client = new FredGeminiClient({ useOfflineAdapter: true });
    let critiqueCalls = 0;
    // Simuliere Live-Vision-Selbstkritik: Runde 1 meldet "Segel noch verstärken", Runde 2 gibt frei!
    client.critiqueModelVisuals = async () => {
      critiqueCalls += 1;
      if (critiqueCalls === 1) {
        return {
          approved: false,
          score: 76,
          summary: 'Segelfläche am Großmast kann noch etwas voller wirken.',
          issues: ['Segel etwas schmal'],
          recommendedAdjustments: ['ENRICH_SAILS_AND_RIGGING'],
          adapterMode: 'LIVE_GOOGLE_GENAI',
        };
      }
      return {
        approved: true,
        score: 95,
        summary: 'Nach Korrektur stimmen Segel, Display-Ständer und Proportionen perfekt.',
        issues: [],
        recommendedAdjustments: [],
        adapterMode: 'LIVE_GOOGLE_GENAI',
      };
    };

    const stages: PipelineStage[] = [];
    const result = await runFredBuildPipeline('hallo fred ich würde gerne die Gorch Fock in 1:300 bauen', {
      geminiClient: client,
      renderViews: () => ['data:image/png;base64,iVBORw0KGgo='],
      onStageUpdate: (stage) => stages.push(stage),
    });

    expect(stages).toContain('RESEARCH');
    expect(stages).toContain('CONCEPT_IMAGE');
    expect(stages).toContain('CAD_BUILD');
    expect(stages).toContain('PHYSICS_CHECK');
    expect(stages).toContain('VISION_CRITIQUE');
    expect(stages).toContain('COMPLETE');
    expect(result.revisionCount).toBe(2);
    expect(result.critique.approved).toBe(true);
    expect(result.conceptImageUrl).toBe('./concepts/gorch-fock-concept.png');
    expect(result.validationReport.checks.find((c) => c.id === 'collisions')?.status).toBe('PASS');
  });
});
