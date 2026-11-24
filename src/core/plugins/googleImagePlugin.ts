import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { CadToolDefinition } from '../tools';

export const NANO_BANANA_PRIMARY_MODEL = 'gemini-nano-banana-2.1';

export interface GoogleImagePluginResult {
  imageDataUrl: string;
  modelUsed: string;
  adapterMode: 'LIVE_GOOGLE_GEMINI_IMAGE' | 'OFFLINE_FALLBACK';
  durationMs: number;
}

export interface GoogleImageRequest {
  prompt: string;
  detailLevel?: 'COMPACT' | 'STANDARD' | 'DISPLAY';
  previousImageDataUrl?: string;
  refinementNote?: string;
}

/**
 * Festes Werkzeug: Google Nano Banana / Gemini Image Plugin (Schicht 3).
 * Priorisiert fest `gemini-nano-banana-2.1` (mit automatischem Fallback auf
 * `gemini-3.1-flash-image`, `gemini-3-pro-image`, `gemini-3.1-flash-lite-image`)
 * über die offizielle `@google/genai` API (`generateContent` + `responseModalities: ['TEXT', 'IMAGE']`).
 */
export class GoogleImagePlugin {
  private readonly apiKey?: string;
  private readonly useOfflineAdapter: boolean;
  private cachedModels: string[] | null = null;

  constructor(options: { apiKey?: string; useOfflineAdapter?: boolean } = {}) {
    this.apiKey = options.apiKey?.trim() || undefined;
    this.useOfflineAdapter = Boolean(options.useOfflineAdapter) || !this.apiKey;
  }

  public isLiveConfigured(): boolean {
    return !this.useOfflineAdapter && Boolean(this.apiKey);
  }

  private parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) return null;
    return { mimeType: m[1], data: m[2] };
  }

  /**
   * Fragt einmalig (gecacht) über ModelService.ListModels ab, welche Nano-Banana- / Gemini-Bildmodelle
   * für diesen API-Key aktiv sind. Priorität #1 ist immer `gemini-nano-banana-2.1`.
   */
  public async discoverImageModels(fetchImpl: typeof fetch = globalThis.fetch): Promise<string[]> {
    if (this.cachedModels) return this.cachedModels;
    if (!this.apiKey) return [];

    const discovered: string[] = [];
    try {
      const res = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(this.apiKey)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
        };
        const scored = (data.models ?? [])
          .map((m) => ({
            name: (m.name ?? '').replace(/^models\//, ''),
            methods: m.supportedGenerationMethods ?? [],
          }))
          .filter(
            (m) =>
              m.methods.includes('generateContent') &&
              /(nano-banana|image)/i.test(m.name) &&
              !/^imagen-/i.test(m.name),
          )
          .sort((a, b) => {
            const rank = (n: string) => {
              let s = 0;
              if (n === NANO_BANANA_PRIMARY_MODEL) s += 50;
              if (n.includes('nano-banana')) s += 40;
              if (n.includes('3.1-flash-image') && !n.includes('lite')) s += 32;
              if (n.includes('3-pro-image')) s += 26;
              if (n.includes('3.1-flash-lite-image')) s += 20;
              if (n.includes('2.5-flash-image')) s += 14;
              if (n.includes('preview')) s -= 2;
              if (n.includes('exp')) s -= 8;
              return s;
            };
            return rank(b.name) - rank(a.name);
          });

        for (const item of scored) discovered.push(item.name);
      }
    } catch {
      // Fall back to curated defaults
    }

    const defaults = [
      NANO_BANANA_PRIMARY_MODEL,
      'gemini-3.1-flash-image',
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image',
      'gemini-3-pro-image-preview',
      'gemini-3.1-flash-lite-image',
      'gemini-2.5-flash-image',
    ];
    for (const d of defaults) {
      if (!discovered.includes(d)) discovered.push(d);
    }

    this.cachedModels = discovered;
    return discovered;
  }

  /**
   * 1-Klick-Verbindungstest für das API-Setup: prüft live per ListModels,
   * ob Nano Banana / Gemini Image für den eingegebenen Key verfügbar ist.
   */
  public async testConnection(
    fetchImpl: typeof fetch = globalThis.fetch,
  ): Promise<{ ok: boolean; primaryModel: string; detectedModels: string[]; message: string }> {
    if (!this.apiKey) {
      return {
        ok: false,
        primaryModel: NANO_BANANA_PRIMARY_MODEL,
        detectedModels: [],
        message: 'Bitte zuerst einen Google Gemini API-Key eingeben.',
      };
    }

    try {
      const res = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(this.apiKey)}`,
      );
      if (!res.ok) {
        return {
          ok: false,
          primaryModel: NANO_BANANA_PRIMARY_MODEL,
          detectedModels: [],
          message: `Google API meldete HTTP ${res.status} (bitte Key prüfen).`,
        };
      }
      this.cachedModels = null;
      const models = await this.discoverImageModels(fetchImpl);
      return {
        ok: true,
        primaryModel: models[0] ?? NANO_BANANA_PRIMARY_MODEL,
        detectedModels: models.slice(0, 4),
        message: `Nano Banana bereit! Primär-Werkzeug: ${models[0] ?? NANO_BANANA_PRIMARY_MODEL}`,
      };
    } catch (err) {
      return {
        ok: false,
        primaryModel: NANO_BANANA_PRIMARY_MODEL,
        detectedModels: [],
        message: err instanceof Error ? err.message : 'Verbindungstest fehlgeschlagen.',
      };
    }
  }

  public async generateBrickConceptImage(
    req: GoogleImageRequest,
    fetchImpl: typeof fetch = globalThis.fetch,
  ): Promise<GoogleImagePluginResult> {
    const start = Date.now();
    const detail = req.detailLevel ?? 'DISPLAY';

    if (!this.isLiveConfigured() || !this.apiKey) {
      const lower = req.prompt.toLowerCase();
      if (/gorch\s*fock|dreimastbark|segelschulschiff/i.test(lower)) {
        return {
          imageDataUrl: './concepts/gorch-fock-concept.png',
          modelUsed: 'nano-banana-offline-preview',
          adapterMode: 'OFFLINE_FALLBACK',
          durationMs: Date.now() - start,
        };
      }
      if (/titanic|titanik/i.test(lower)) {
        return {
          imageDataUrl: './concepts/titanic-concept.png',
          modelUsed: 'nano-banana-offline-preview',
          adapterMode: 'OFFLINE_FALLBACK',
          durationMs: Date.now() - start,
        };
      }
      throw new Error('Kein aktiver Google-Gemini-API-Key verbunden.');
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const basePrompt = [
      `Photorealistic 3/4 isometric studio product photograph of a high-detail adult collector interlocking plastic brick (AFOL MOC, ${detail} display grade) model of: ${req.prompt}.`,
      'Constructed exclusively from realistic glossy ABS interlocking bricks, smooth tiles, curved slopes, SNOT cladding and fine architectural/mechanical details.',
      'Bright neutral light-grey studio tabletop, soft studio shadows, crisp specular ABS highlights, no text, no watermark, no brand logos.',
    ].join(' ');

    const fullPrompt = req.refinementNote
      ? `${basePrompt} Apply user refinement: ${req.refinementNote}.`
      : basePrompt;

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
      { text: fullPrompt },
    ];
    if (req.previousImageDataUrl) {
      const parsed = this.parseDataUrl(req.previousImageDataUrl);
      if (parsed) parts.push({ inlineData: parsed });
    }

    const models = await this.discoverImageModels(fetchImpl);
    let lastReason = 'Kein aktives Nano-Banana-/Gemini-Bildmodell für diesen API-Key gefunden.';

    for (const modelName of models.slice(0, 5)) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts }],
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        });

        const responseParts = response.candidates?.[0]?.content?.parts ?? [];
        for (const p of responseParts) {
          const inline = (p as { inlineData?: { mimeType?: string; data?: string } }).inlineData;
          if (inline?.data) {
            const mime = inline.mimeType || 'image/png';
            return {
              imageDataUrl: `data:${mime};base64,${inline.data}`,
              modelUsed: modelName,
              adapterMode: 'LIVE_GOOGLE_GEMINI_IMAGE',
              durationMs: Date.now() - start,
            };
          }
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        if (/billing|quota|429|RESOURCE_EXHAUSTED/i.test(raw)) {
          lastReason = 'Google Nano Banana / Bild-API Kontingent oder Billing ist für diesen Key nicht aktiv.';
          break;
        }
        if (/API_KEY_INVALID|401|403|PERMISSION_DENIED/i.test(raw)) {
          lastReason = 'Der hinterlegte Google-API-Key hat keine Berechtigung für Nano Banana.';
          break;
        }
        lastReason = `Modell ${modelName} nicht verfügbar.`;
      }
    }

    throw new Error(lastReason);
  }
}

const GenerateImageSchema = z.object({
  prompt: z.string().min(2),
  detailLevel: z.enum(['COMPACT', 'STANDARD', 'DISPLAY']).optional(),
});

const EditImageSchema = z.object({
  prompt: z.string().min(2),
  previousImageDataUrl: z.string().min(10),
  refinementNote: z.string().min(2),
  detailLevel: z.enum(['COMPACT', 'STANDARD', 'DISPLAY']).optional(),
});

/**
 * Erzeugt die zwei festen Nano-Banana-Werkzeuge für den MCP-Broker & Fred-Agent-Harness:
 * - `nano_banana.generate_image`
 * - `nano_banana.edit_image`
 */
export function createNanoBananaMcpTools(
  plugin: GoogleImagePlugin,
): Map<string, CadToolDefinition<any, any>> {
  const tools = new Map<string, CadToolDefinition<any, any>>();

  tools.set('nano_banana.generate_image', {
    name: 'nano_banana.generate_image',
    description:
      'Festes Google Nano Banana Bild-Werkzeug (gemini-nano-banana-2.1 / gemini-3.1-flash-image): erzeugt ein fotorealistisches Klemmbaustein-Wunschbild.',
    inputSchema: GenerateImageSchema,
    execute: async (args: z.infer<typeof GenerateImageSchema>) =>
      plugin.generateBrickConceptImage({
        prompt: args.prompt,
        detailLevel: args.detailLevel ?? 'DISPLAY',
      }),
  });

  tools.set('nano_banana.edit_image', {
    name: 'nano_banana.edit_image',
    description:
      'Festes Google Nano Banana Multi-Turn-Edit-Werkzeug: verfeinert ein bestehendes Klemmbaustein-Vorschaubild nach Nutzer-Feedback (Roter Daumen).',
    inputSchema: EditImageSchema,
    execute: async (args: z.infer<typeof EditImageSchema>) =>
      plugin.generateBrickConceptImage({
        prompt: args.prompt,
        previousImageDataUrl: args.previousImageDataUrl,
        refinementNote: args.refinementNote,
        detailLevel: args.detailLevel ?? 'DISPLAY',
      }),
  });

  return tools;
}
