import { z } from 'zod';
import { CadToolDefinition } from '../tools';
import { GoogleImagePlugin, GoogleImageRequest } from './googleImagePlugin';

export type ImageMcpProviderId =
  | 'nano_banana'
  | 'huggingface_flux'
  | 'cloudflare_flux'
  | 'pollinations_flux';

/**
 * Feste, deterministische Auswahl-Reihenfolge der Bild-MCP-Server:
 * 1. Google Nano Banana (höchste Qualität & Multi-Turn-Edit)
 * 2. Hugging Face FLUX MCP (kostenlos mit HF_TOKEN, ZeroGPU / Inference Router)
 * 3. Cloudflare Workers AI FLUX MCP (kostenloser Free-Tier, 10.000 Neurons/Tag)
 * 4. Pollinations.ai FLUX MCP (kostenlos mit sk_-Key)
 */
export const IMAGE_MCP_PRIORITY_ORDER: readonly ImageMcpProviderId[] = [
  'nano_banana',
  'huggingface_flux',
  'cloudflare_flux',
  'pollinations_flux',
] as const;

export interface FreeImageMcpKeys {
  huggingFaceToken?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  pollinationsApiKey?: string;
}

export interface ImageMcpAttempt {
  priority: number;
  providerId: ImageMcpProviderId;
  toolName: string;
  status: 'SUCCESS' | 'SKIPPED_NO_KEY' | 'FAILED';
  reason?: string;
  durationMs: number;
}

export interface ImageRouterResult {
  imageDataUrl: string;
  providerId: ImageMcpProviderId;
  providerLabel: string;
  modelUsed: string;
  adapterMode: 'LIVE_GOOGLE_GEMINI_IMAGE' | 'LIVE_FREE_MCP_FLUX' | 'OFFLINE_FALLBACK';
  durationMs: number;
  attempts: ImageMcpAttempt[];
}

export const FREE_IMAGE_MCP_STORAGE_KEY = 'fred_free_image_mcp_keys_v1';

export function loadFreeImageMcpKeys(): FreeImageMcpKeys {
  try {
    const raw = localStorage.getItem(FREE_IMAGE_MCP_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FreeImageMcpKeys) : {};
  } catch {
    return {};
  }
}

export function saveFreeImageMcpKeys(keys: FreeImageMcpKeys): void {
  try {
    const sanitized: FreeImageMcpKeys = {
      huggingFaceToken: keys.huggingFaceToken?.trim() || undefined,
      cloudflareAccountId: keys.cloudflareAccountId?.trim() || undefined,
      cloudflareApiToken: keys.cloudflareApiToken?.trim() || undefined,
      pollinationsApiKey: keys.pollinationsApiKey?.trim() || undefined,
    };
    localStorage.setItem(FREE_IMAGE_MCP_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore storage errors
  }
}

function buildBrickFluxPrompt(req: GoogleImageRequest): string {
  const detail = req.detailLevel ?? 'DISPLAY';
  const base = [
    `Photorealistic 3/4 isometric studio product photograph of a high-detail adult collector interlocking plastic brick (AFOL MOC, ${detail} grade) model of: ${req.prompt}.`,
    'Built exclusively from realistic glossy ABS interlocking bricks, smooth tiles, curved slopes, SNOT cladding and fine mechanical details.',
    'Bright neutral light-grey studio tabletop, soft studio lighting, crisp ABS reflections, no text, no watermark, no logos.',
  ].join(' ');
  return req.refinementNote ? `${base} Apply refinement: ${req.refinementNote}.` : base;
}

async function blobOrBufferToBase64(res: Response): Promise<{ base64: string; mimeType: string }> {
  const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 =
    typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return { base64, mimeType };
}

/**
 * MCP-Server #2: Hugging Face FLUX (FLUX.1-schnell / FLUX.1-dev)
 * Kostenlos nutzbar mit eigenem kostenlosem Hugging-Face-Token (hf_...).
 */
export class HuggingFaceFluxMcpPlugin {
  private readonly token?: string;
  public static readonly MODELS = [
    'black-forest-labs/FLUX.1-schnell',
    'black-forest-labs/FLUX.1-dev',
  ] as const;

  constructor(token?: string) {
    this.token = token?.trim() || undefined;
  }

  public isConfigured(): boolean {
    return Boolean(this.token);
  }

  public async generateImage(
    req: GoogleImageRequest,
    fetchImpl: typeof fetch = globalThis.fetch,
  ): Promise<{ imageDataUrl: string; modelUsed: string; durationMs: number }> {
    const start = Date.now();
    if (!this.token) {
      throw new Error('Kein Hugging-Face-Token (HF_TOKEN) hinterlegt.');
    }

    const prompt = buildBrickFluxPrompt(req);
    let lastError = 'Hugging Face FLUX derzeit nicht erreichbar.';

    for (const model of HuggingFaceFluxMcpPlugin.MODELS) {
      try {
        const res = await fetchImpl(
          `https://router.huggingface.co/hf-inference/models/${model}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.token}`,
              'Content-Type': 'application/json',
              Accept: 'image/png',
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: { width: 1024, height: 768 },
            }),
          },
        );

        if (!res.ok) {
          lastError = `Hugging Face ${model} meldete HTTP ${res.status}.`;
          if (res.status === 401 || res.status === 403) break;
          continue;
        }

        const { base64, mimeType } = await blobOrBufferToBase64(res);
        if (base64.length < 64) {
          lastError = `Hugging Face ${model} lieferte leere Bilddaten.`;
          continue;
        }
        return {
          imageDataUrl: `data:${mimeType};base64,${base64}`,
          modelUsed: model,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    throw new Error(lastError);
  }
}

/**
 * MCP-Server #3: Cloudflare Workers AI FLUX (@cf/black-forest-labs/flux-1-schnell)
 * Kostenloser Free-Tier (10.000 Neurons/Tag) mit Cloudflare Account ID + API Token.
 */
export class CloudflareFluxMcpPlugin {
  private readonly accountId?: string;
  private readonly apiToken?: string;
  public static readonly MODEL = '@cf/black-forest-labs/flux-1-schnell';

  constructor(accountId?: string, apiToken?: string) {
    this.accountId = accountId?.trim() || undefined;
    this.apiToken = apiToken?.trim() || undefined;
  }

  public isConfigured(): boolean {
    return Boolean(this.accountId && this.apiToken);
  }

  public async generateImage(
    req: GoogleImageRequest,
    fetchImpl: typeof fetch = globalThis.fetch,
  ): Promise<{ imageDataUrl: string; modelUsed: string; durationMs: number }> {
    const start = Date.now();
    if (!this.accountId || !this.apiToken) {
      throw new Error('Keine Cloudflare Workers AI Zugangsdaten hinterlegt.');
    }

    const prompt = buildBrickFluxPrompt(req);
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.accountId)}/ai/run/${CloudflareFluxMcpPlugin.MODEL}`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, num_steps: 4 }),
    });

    if (!res.ok) {
      throw new Error(`Cloudflare Workers AI meldete HTTP ${res.status}.`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const json = (await res.json()) as { result?: { image?: string }; success?: boolean };
      const b64 = json.result?.image;
      if (!b64) throw new Error('Cloudflare Workers AI lieferte kein Bild in result.image.');
      return {
        imageDataUrl: `data:image/png;base64,${b64}`,
        modelUsed: CloudflareFluxMcpPlugin.MODEL,
        durationMs: Date.now() - start,
      };
    }

    const { base64, mimeType } = await blobOrBufferToBase64(res);
    return {
      imageDataUrl: `data:${mimeType};base64,${base64}`,
      modelUsed: CloudflareFluxMcpPlugin.MODEL,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * MCP-Server #4: Pollinations.ai FLUX (`gen.pollinations.ai`)
 * Kostenlos mit eigenem Pollinations-API-Key (`sk_...` über enter.pollinations.ai).
 */
export class PollinationsFluxMcpPlugin {
  private readonly apiKey?: string;
  public static readonly MODEL = 'flux';

  constructor(apiKey?: string) {
    this.apiKey = apiKey?.trim() || undefined;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  public async generateImage(
    req: GoogleImageRequest,
    fetchImpl: typeof fetch = globalThis.fetch,
  ): Promise<{ imageDataUrl: string; modelUsed: string; durationMs: number }> {
    const start = Date.now();
    if (!this.apiKey) {
      throw new Error('Kein Pollinations API-Key (sk_...) hinterlegt.');
    }

    const prompt = buildBrickFluxPrompt(req);
    const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${PollinationsFluxMcpPlugin.MODEL}&width=1024&height=768&nologo=true`;
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'image/png,image/jpeg',
      },
    });

    if (!res.ok) {
      throw new Error(`Pollinations FLUX meldete HTTP ${res.status}.`);
    }

    const { base64, mimeType } = await blobOrBufferToBase64(res);
    if (base64.length < 64) {
      throw new Error('Pollinations FLUX lieferte leere Bilddaten.');
    }
    return {
      imageDataUrl: `data:${mimeType};base64,${base64}`,
      modelUsed: `pollinations/${PollinationsFluxMcpPlugin.MODEL}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Zentraler Bild-MCP-Priority-Router:
 * Prüft alle MCP-Bildserver streng in deterministischer Prioritätsreihenfolge:
 *   1. nano_banana (Google Gemini Image)
 *   2. huggingface_flux (Hugging Face FLUX.1-schnell / dev)
 *   3. cloudflare_flux (Cloudflare Workers AI FLUX.1-schnell)
 *   4. pollinations_flux (Pollinations.ai FLUX)
 */
export class ImageMcpPriorityRouter {
  public readonly nanoBanana: GoogleImagePlugin;
  public readonly huggingFace: HuggingFaceFluxMcpPlugin;
  public readonly cloudflare: CloudflareFluxMcpPlugin;
  public readonly pollinations: PollinationsFluxMcpPlugin;

  constructor(options: {
    googleImagePlugin?: GoogleImagePlugin;
    freeKeys?: FreeImageMcpKeys;
  } = {}) {
    this.nanoBanana = options.googleImagePlugin ?? new GoogleImagePlugin({ useOfflineAdapter: true });
    const keys = options.freeKeys ?? {};
    this.huggingFace = new HuggingFaceFluxMcpPlugin(keys.huggingFaceToken);
    this.cloudflare = new CloudflareFluxMcpPlugin(keys.cloudflareAccountId, keys.cloudflareApiToken);
    this.pollinations = new PollinationsFluxMcpPlugin(keys.pollinationsApiKey);
  }

  public getConfiguredPriorityChain(): Array<{
    priority: number;
    providerId: ImageMcpProviderId;
    label: string;
    toolName: string;
    configured: boolean;
  }> {
    return [
      {
        priority: 1,
        providerId: 'nano_banana',
        label: 'Google Nano Banana (Primär)',
        toolName: 'nano_banana.generate_image',
        configured: this.nanoBanana.isLiveConfigured(),
      },
      {
        priority: 2,
        providerId: 'huggingface_flux',
        label: 'Hugging Face FLUX MCP (Kostenlos)',
        toolName: 'hf_flux.generate_image',
        configured: this.huggingFace.isConfigured(),
      },
      {
        priority: 3,
        providerId: 'cloudflare_flux',
        label: 'Cloudflare Workers AI FLUX MCP (Kostenlos)',
        toolName: 'cf_flux.generate_image',
        configured: this.cloudflare.isConfigured(),
      },
      {
        priority: 4,
        providerId: 'pollinations_flux',
        label: 'Pollinations FLUX MCP (Kostenlos)',
        toolName: 'pollinations_flux.generate_image',
        configured: this.pollinations.isConfigured(),
      },
    ];
  }

  public async generatePreview(
    req: GoogleImageRequest,
    fetchImpl: typeof fetch = globalThis.fetch,
  ): Promise<ImageRouterResult> {
    const totalStart = Date.now();
    const attempts: ImageMcpAttempt[] = [];

    for (let idx = 0; idx < IMAGE_MCP_PRIORITY_ORDER.length; idx++) {
      const providerId = IMAGE_MCP_PRIORITY_ORDER[idx];
      const priority = idx + 1;
      const stepStart = Date.now();

      if (providerId === 'nano_banana') {
        const toolName = req.previousImageDataUrl
          ? 'nano_banana.edit_image'
          : 'nano_banana.generate_image';
        if (!this.nanoBanana.isLiveConfigured()) {
          // Prüfe, ob ein kuratiertes lokales Offline-Konzeptbild existiert (nur wenn kein kostenloser MCP-Key aktiv ist)
          const anyFreeLive =
            this.huggingFace.isConfigured() ||
            this.cloudflare.isConfigured() ||
            this.pollinations.isConfigured();
          if (!anyFreeLive) {
            try {
              const offlineRes = await this.nanoBanana.generateBrickConceptImage(req, fetchImpl);
              attempts.push({
                priority,
                providerId,
                toolName,
                status: 'SUCCESS',
                reason: 'Offline-Konzeptvorschau',
                durationMs: Date.now() - stepStart,
              });
              return {
                imageDataUrl: offlineRes.imageDataUrl,
                providerId,
                providerLabel: 'Nano Banana (Offline-Vorschau)',
                modelUsed: offlineRes.modelUsed,
                adapterMode: 'OFFLINE_FALLBACK',
                durationMs: Date.now() - totalStart,
                attempts,
              };
            } catch {
              // continue to record SKIPPED_NO_KEY
            }
          }
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'SKIPPED_NO_KEY',
            reason: 'Kein Google Gemini API-Key verbunden.',
            durationMs: Date.now() - stepStart,
          });
          continue;
        }

        try {
          const res = await this.nanoBanana.generateBrickConceptImage(req, fetchImpl);
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'SUCCESS',
            durationMs: Date.now() - stepStart,
          });
          return {
            imageDataUrl: res.imageDataUrl,
            providerId,
            providerLabel: 'Google Nano Banana',
            modelUsed: res.modelUsed,
            adapterMode: res.adapterMode,
            durationMs: Date.now() - totalStart,
            attempts,
          };
        } catch (err) {
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'FAILED',
            reason: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - stepStart,
          });
          continue;
        }
      }

      if (providerId === 'huggingface_flux') {
        const toolName = 'hf_flux.generate_image';
        if (!this.huggingFace.isConfigured()) {
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'SKIPPED_NO_KEY',
            reason: 'Kein kostenloser Hugging-Face-Token (HF_TOKEN) hinterlegt.',
            durationMs: Date.now() - stepStart,
          });
          continue;
        }
        try {
          const res = await this.huggingFace.generateImage(req, fetchImpl);
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'SUCCESS',
            durationMs: Date.now() - stepStart,
          });
          return {
            imageDataUrl: res.imageDataUrl,
            providerId,
            providerLabel: 'Hugging Face FLUX MCP',
            modelUsed: res.modelUsed,
            adapterMode: 'LIVE_FREE_MCP_FLUX',
            durationMs: Date.now() - totalStart,
            attempts,
          };
        } catch (err) {
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'FAILED',
            reason: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - stepStart,
          });
          continue;
        }
      }

      if (providerId === 'cloudflare_flux') {
        const toolName = 'cf_flux.generate_image';
        if (!this.cloudflare.isConfigured()) {
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'SKIPPED_NO_KEY',
            reason: 'Keine Cloudflare Workers AI Zugangsdaten hinterlegt.',
            durationMs: Date.now() - stepStart,
          });
          continue;
        }
        try {
          const res = await this.cloudflare.generateImage(req, fetchImpl);
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'SUCCESS',
            durationMs: Date.now() - stepStart,
          });
          return {
            imageDataUrl: res.imageDataUrl,
            providerId,
            providerLabel: 'Cloudflare Workers AI FLUX MCP',
            modelUsed: res.modelUsed,
            adapterMode: 'LIVE_FREE_MCP_FLUX',
            durationMs: Date.now() - totalStart,
            attempts,
          };
        } catch (err) {
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'FAILED',
            reason: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - stepStart,
          });
          continue;
        }
      }

      if (providerId === 'pollinations_flux') {
        const toolName = 'pollinations_flux.generate_image';
        if (!this.pollinations.isConfigured()) {
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'SKIPPED_NO_KEY',
            reason: 'Kein Pollinations API-Key (sk_...) hinterlegt.',
            durationMs: Date.now() - stepStart,
          });
          continue;
        }
        try {
          const res = await this.pollinations.generateImage(req, fetchImpl);
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'SUCCESS',
            durationMs: Date.now() - stepStart,
          });
          return {
            imageDataUrl: res.imageDataUrl,
            providerId,
            providerLabel: 'Pollinations FLUX MCP',
            modelUsed: res.modelUsed,
            adapterMode: 'LIVE_FREE_MCP_FLUX',
            durationMs: Date.now() - totalStart,
            attempts,
          };
        } catch (err) {
          attempts.push({
            priority,
            providerId,
            toolName,
            status: 'FAILED',
            reason: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - stepStart,
          });
        }
      }
    }

    const summary = attempts
      .filter((a) => a.status === 'FAILED')
      .map((a) => `#${a.priority} ${a.providerId}: ${a.reason}`)
      .join(' | ');
    throw new Error(
      summary ||
        'Kein aktiver Bild-MCP-Server konfiguriert. Hinterlege im API-Setup einen kostenlosen Hugging-Face-Token (HF_TOKEN), Cloudflare-Token oder aktiviere Nano Banana Billing.',
    );
  }
}

const PromptSchema = z.object({
  prompt: z.string().min(2),
  detailLevel: z.enum(['COMPACT', 'STANDARD', 'DISPLAY']).optional(),
  refinementNote: z.string().optional(),
});

/**
 * Registriert alle kostenlosen Bild-MCP-Server sowie den zentralen Priority-Router
 * als feste Werkzeuge im FredMcpBroker.
 */
export function createFreeImageMcpTools(
  router: ImageMcpPriorityRouter,
  fetchImpl: typeof fetch = globalThis.fetch,
): Map<string, CadToolDefinition<any, any>> {
  const tools = new Map<string, CadToolDefinition<any, any>>();

  tools.set('image_router.generate_preview', {
    name: 'image_router.generate_preview',
    description:
      'Priorisierter Bild-MCP-Router (1. Nano Banana → 2. Hugging Face FLUX → 3. Cloudflare FLUX → 4. Pollinations FLUX).',
    inputSchema: PromptSchema,
    execute: async (args: z.infer<typeof PromptSchema>) =>
      router.generatePreview(
        {
          prompt: args.prompt,
          detailLevel: args.detailLevel ?? 'DISPLAY',
          refinementNote: args.refinementNote,
        },
        fetchImpl,
      ),
  });

  tools.set('hf_flux.generate_image', {
    name: 'hf_flux.generate_image',
    description:
      'Kostenloser Hugging Face FLUX MCP-Server (FLUX.1-schnell / FLUX.1-dev) für fotorealistische Klemmbaustein-Vorschaubilder.',
    inputSchema: PromptSchema,
    execute: async (args: z.infer<typeof PromptSchema>) =>
      router.huggingFace.generateImage(args, fetchImpl),
  });

  tools.set('cf_flux.generate_image', {
    name: 'cf_flux.generate_image',
    description:
      'Kostenloser Cloudflare Workers AI FLUX MCP-Server (@cf/black-forest-labs/flux-1-schnell).',
    inputSchema: PromptSchema,
    execute: async (args: z.infer<typeof PromptSchema>) =>
      router.cloudflare.generateImage(args, fetchImpl),
  });

  tools.set('pollinations_flux.generate_image', {
    name: 'pollinations_flux.generate_image',
    description:
      'Kostenloser Pollinations.ai FLUX MCP-Server (gen.pollinations.ai) für Klemmbaustein-Vorschaubilder.',
    inputSchema: PromptSchema,
    execute: async (args: z.infer<typeof PromptSchema>) =>
      router.pollinations.generateImage(args, fetchImpl),
  });

  return tools;
}
