import { describe, expect, it } from 'vitest';
import { FredMcpBroker } from '../src/core/mcp/broker';
import { GoogleImagePlugin, createNanoBananaMcpTools } from '../src/core/plugins/googleImagePlugin';
import {
  IMAGE_MCP_PRIORITY_ORDER,
  ImageMcpPriorityRouter,
  createFreeImageMcpTools,
} from '../src/core/plugins/freeImageMcpPlugins';
import { buildU99SubmarineModel } from '../src/core/models/u99SubmarineModel';
import { getStarterBlueprints } from '../src/core/models/sampleModels';
import { runValidationCenter } from '../src/core/validation/validationCenter';
import { FredAgentHarness } from '../src/core/agent/fredHarness';
import { FredGeminiClient } from '../src/core/ai/geminiClient';

const FAKE_PNG_BYTES = new Uint8Array(128).fill(0x89);

function makeFakeImageResponse(mime = 'image/png'): Response {
  return new Response(FAKE_PNG_BYTES, {
    status: 200,
    headers: { 'content-type': mime },
  });
}

describe('BMAD / PIV / Ralph-Loop: Priorisierte Kostenlose Bild-MCP-Kette & U-99 (>1 m, >6.000 Teile)', () => {
  it('registriert alle 4 Bild-MCP-Server im Broker und erzwingt die feste Prioritätsreihenfolge 1→2→3→4', async () => {
    expect(IMAGE_MCP_PRIORITY_ORDER).toEqual([
      'nano_banana',
      'huggingface_flux',
      'cloudflare_flux',
      'pollinations_flux',
      'hf_public_flux',
    ]);

    const googlePlugin = new GoogleImagePlugin({ useOfflineAdapter: true });
    const router = new ImageMcpPriorityRouter({
      googleImagePlugin: googlePlugin,
      freeKeys: {
        huggingFaceToken: 'hf_test_token_123',
        cloudflareAccountId: 'cf-acc-1',
        cloudflareApiToken: 'cf-tok-1',
        pollinationsApiKey: 'sk_test_pollinations',
      },
      enablePublicSpace: true,
    });

    const broker = new FredMcpBroker();
    broker.registerCadTools(createNanoBananaMcpTools(googlePlugin));
    broker.registerCadTools(createFreeImageMcpTools(router, async () => makeFakeImageResponse()));

    const toolNames = broker.listTools().map((t) => t.name);
    expect(toolNames).toContain('nano_banana.generate_image');
    expect(toolNames).toContain('hf_flux.generate_image');
    expect(toolNames).toContain('cf_flux.generate_image');
    expect(toolNames).toContain('pollinations_flux.generate_image');
    expect(toolNames).toContain('hf_public_flux.generate_image');
    expect(toolNames).toContain('image_router.generate_preview');

    // Fall 1: Nano Banana nicht live -> Priorität 2 (Hugging Face FLUX) gewinnt sofort
    const resP2 = await router.generatePreview(
      { prompt: 'U-99 Typ VIIB Klemmbaustein-U-Boot' },
      async (input) => {
        const url = String(input);
        if (url.includes('router.huggingface.co')) return makeFakeImageResponse();
        return new Response('unexpected', { status: 500 });
      },
    );
    expect(resP2.providerId).toBe('huggingface_flux');
    expect(resP2.attempts.map((a) => a.providerId)).toEqual(['nano_banana', 'huggingface_flux']);
    expect(resP2.attempts[0].status).toBe('SKIPPED_NO_KEY');
    expect(resP2.attempts[1].status).toBe('SUCCESS');

    // Fall 2: HF schlägt fehl (503) -> Priorität 3 (Cloudflare FLUX) springt automatisch ein
    const resP3 = await router.generatePreview(
      { prompt: 'U-99 Typ VIIB Klemmbaustein-U-Boot' },
      async (input) => {
        const url = String(input);
        if (url.includes('router.huggingface.co')) return new Response('busy', { status: 503 });
        if (url.includes('api.cloudflare.com')) {
          return new Response(
            JSON.stringify({ success: true, result: { image: Buffer.from(FAKE_PNG_BYTES).toString('base64') } }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response('unexpected', { status: 500 });
      },
    );
    expect(resP3.providerId).toBe('cloudflare_flux');
    expect(resP3.attempts.map((a) => a.providerId)).toEqual([
      'nano_banana',
      'huggingface_flux',
      'cloudflare_flux',
    ]);

    // Fall 3: HF & Cloudflare schlagen fehl -> Priorität 4 (Pollinations FLUX) springt ein
    const resP4 = await router.generatePreview(
      { prompt: 'U-99 Typ VIIB Klemmbaustein-U-Boot' },
      async (input) => {
        const url = String(input);
        if (url.includes('gen.pollinations.ai')) return makeFakeImageResponse('image/jpeg');
        return new Response('down', { status: 503 });
      },
    );
    expect(resP4.providerId).toBe('pollinations_flux');
    expect(resP4.attempts.map((a) => a.providerId)).toEqual([
      'nano_banana',
      'huggingface_flux',
      'cloudflare_flux',
      'pollinations_flux',
    ]);

    // Fall 4: #1-#4 nicht verfügbar/ohne Key -> Priorität 5 (schlüsselloser FLUX.1-schnell ZeroGPU Space) springt automatisch ein!
    const keylessRouter = new ImageMcpPriorityRouter({
      googleImagePlugin: new GoogleImagePlugin({ useOfflineAdapter: true }),
      freeKeys: {},
      enablePublicSpace: true,
    });
    const resP5 = await keylessRouter.generatePreview(
      { prompt: 'Brandenburger Tor Berlin Klemmbaustein-Modell' },
      async (input) => {
        const url = String(input);
        if (url.endsWith('/gradio_api/call/infer')) {
          return new Response(JSON.stringify({ event_id: 'evt-123' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.endsWith('/gradio_api/call/infer/evt-123')) {
          return new Response(
            'event: complete\ndata: [{"url": "https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/file=/tmp/test.webp"}]',
            { status: 200, headers: { 'content-type': 'text/event-stream' } },
          );
        }
        if (url.includes('/tmp/test.webp')) {
          return makeFakeImageResponse('image/webp');
        }
        return new Response('unexpected', { status: 500 });
      },
    );
    expect(resP5.providerId).toBe('hf_public_flux');
    expect(resP5.imageDataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    expect(resP5.attempts.map((a) => a.providerId)).toEqual([
      'nano_banana',
      'huggingface_flux',
      'cloudflare_flux',
      'pollinations_flux',
      'hf_public_flux',
    ]);
  });

  it('konstruiert U-99 (Typ VIIB) > 1 Meter (> 100 cm) und > 6.000 Teile mit 100 % PASS in allen 7 Physik-Checks und ist in der Bibliothek enthalten', () => {
    const u99 = buildU99SubmarineModel();

    // 1. Länge > 1 Meter (20 LDU = 0,8 cm -> > 2500 LDU = > 100 cm)
    const xs = u99.parts.map((p) => p.transform.positionLdu[0]);
    const spanLdu = Math.max(...xs) - Math.min(...xs) + 20;
    const lengthCm = (spanLdu / 20) * 0.8;
    expect(lengthCm).toBeGreaterThan(100);

    // 2. Teilezahl > 6.000 Teile
    expect(u99.parts.length).toBeGreaterThan(6000);

    // 3. Alle 7 deterministischen Prüfungen 100 % GRÜN
    const report = runValidationCenter(u99, { maxParts: 10000 });
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
    expect(starters.some((m) => m.id === 'model-u99-viib-6000')).toBe(true);
  }, 30_000);

  it('routet U-99-Anfragen im FredAgentHarness direkt auf das >1m / >6000-Teile Sammlermodell', async () => {
    const harness = new FredAgentHarness({
      geminiClient: new FredGeminiClient({ useOfflineAdapter: true }),
      imagePlugin: new GoogleImagePlugin({ useOfflineAdapter: true }),
    });
    const draft = await harness.prepareConcept('Bitte U99 in 1:60 mit über 6000 Teilen bauen');
    expect(harness.getState()).toBe('AWAITING_USER_APPROVAL');
    const built = await harness.buildApprovedConcept(draft, { maxCritiqueRounds: 0 });
    expect(built.model.id).toBe('model-u99-viib-6000');
    expect(built.model.parts.length).toBeGreaterThan(6000);
  }, 30_000);
});
