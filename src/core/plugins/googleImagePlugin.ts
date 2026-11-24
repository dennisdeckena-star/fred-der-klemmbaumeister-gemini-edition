import { GoogleGenAI } from '@google/genai';

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
 * Offizielles Google-Gemini-Bilderzeugungs-Plugin (Schicht 3).
 * Nutzt die moderne Google Gemini / Nano-Banana Image API über `@google/genai`
 * (`ai.models.generateContent` mit `responseModalities: ['TEXT', 'IMAGE']`)
 * statt der abgeschalteten Legacy-Imagen-3/4-Endpunkte.
 * Ermittelt verfügbare Modelle dynamisch per `ModelService.ListModels` (gecacht).
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
   * Fragt einmalig die für diesen API-Key tatsächlich freigeschalteten Gemini-Bildmodelle ab.
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
              /(image|nano-banana)/i.test(m.name) &&
              !/^imagen-/i.test(m.name),
          )
          .sort((a, b) => {
            const rank = (n: string) => {
              let s = 0;
              if (n.includes('3.1-flash-image') && !n.includes('lite')) s += 30;
              if (n.includes('nano-banana')) s += 28;
              if (n.includes('3-pro-image')) s += 24;
              if (n.includes('3.1-flash-lite-image')) s += 20;
              if (n.includes('2.5-flash-image')) s += 15;
              if (n.includes('preview')) s -= 2;
              if (n.includes('exp')) s -= 8;
              return s;
            };
            return rank(b.name) - rank(a.name);
          });

        for (const item of scored) discovered.push(item.name);
      }
    } catch {
      // Fallback to curated 2026 Gemini image models below
    }

    const defaults = [
      'gemini-3.1-flash-image',
      'gemini-3.1-flash-image-preview',
      'gemini-nano-banana-2.1',
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
          modelUsed: 'offline-studio-preview',
          adapterMode: 'OFFLINE_FALLBACK',
          durationMs: Date.now() - start,
        };
      }
      if (/titanic|titanik/i.test(lower)) {
        return {
          imageDataUrl: './concepts/titanic-concept.png',
          modelUsed: 'offline-studio-preview',
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
    let lastReason = 'Kein aktives Gemini-Bildmodell für diesen API-Key gefunden.';

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
          lastReason = 'Google Gemini Bild-API Kontingent/Billing ist für diesen Key nicht aktiv.';
          break;
        }
        if (/API_KEY_INVALID|401|403|PERMISSION_DENIED/i.test(raw)) {
          lastReason = 'Der hinterlegte Google-API-Key hat keine Berechtigung für Gemini Image.';
          break;
        }
        lastReason = `Modell ${modelName} nicht verfügbar.`;
      }
    }

    throw new Error(lastReason);
  }
}
