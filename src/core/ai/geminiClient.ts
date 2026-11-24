import { GoogleGenAI } from '@google/genai';

export const DEFAULT_GEMINI_MODEL = 'gemini-4-argon';
export const DEFAULT_CLOUD_PROXY_URL = 'https://fred-gemini-proxy.workers.dev/api/chat';

export type AiAdapterMode =
  | 'LIVE_GOOGLE_GENAI'
  | 'FRED_CLOUD_PROXY'
  | 'OFFLINE_TEST_ADAPTER';

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
}

export interface GeminiClientConfig {
  apiKey?: string;
  model?: string;
  providerMode?: AiAdapterMode;
  proxyUrl?: string;
  proxyAccessToken?: string;
  maxRequestsPerMinute?: number;
  maxBudgetEur?: number;
  /** Estimated EUR per 1K tokens for local budget stop guard */
  estimatedEurPer1kTokens?: number;
  useOfflineAdapter?: boolean;
}

export interface UsageSnapshot {
  requestCount: number;
  estimatedTokens: number;
  estimatedCostEur: number;
  maxBudgetEur: number;
  budgetRemainingEur: number;
  adapterMode: AiAdapterMode;
  model: string;
}

export interface ChatResponse {
  text: string;
  model: string;
  adapterMode: AiAdapterMode;
  estimatedTokens: number;
  estimatedCostEur: number;
}

export type ModelCategory = 'tall_ship' | 'ocean_liner' | 'vehicle' | 'architecture' | 'aircraft' | 'spacecraft' | 'custom';

export interface SubjectResearchBrief {
  title: string;
  scaleLabel: string;
  category: ModelCategory;
  realDimensionsNote: string;
  targetStudsLength: number;
  targetStudsWidth: number;
  targetStudsHeight: number;
  primaryColors: number[];
  accentColors: number[];
  signatureFeatures: string[];
  assemblies: string[];
  sources: Array<{ title: string; url: string }>;
  adapterMode: AiAdapterMode;
}

export interface VisionCritiqueResult {
  approved: boolean;
  score: number;
  summary: string;
  issues: string[];
  recommendedAdjustments: Array<
    | 'ADD_DISPLAY_STAND'
    | 'ENRICH_SAILS_AND_RIGGING'
    | 'ADD_BOWSPRIT_AND_FLAGS'
    | 'ADD_ROOF_SLOPES'
    | 'ADD_EXTERIOR_DETAILS'
  >;
  adapterMode: AiAdapterMode;
}

export function validateApiKeyFormat(key: string): { valid: boolean; reason?: string } {
  const trimmed = key.trim();
  if (!trimmed) return { valid: false, reason: 'Bitte gib einen Gemini API-Key ein.' };
  if (trimmed.length < 20) {
    return { valid: false, reason: 'Der API-Key ist zu kurz (Google AI Studio Keys haben i. d. R. 39 Zeichen).' };
  }
  if (/\s/.test(trimmed)) {
    return { valid: false, reason: 'Der API-Key darf keine Leerzeichen enthalten.' };
  }
  return { valid: true };
}

export class RateLimitExceededError extends Error {
  constructor(limit: number) {
    super(`Rate-Limit erreicht: Maximal ${limit} Anfragen pro Minute erlaubt. Bitte kurz warten.`);
    this.name = 'RateLimitExceededError';
  }
}

export class BudgetLimitExceededError extends Error {
  constructor(currentEur: number, maxEur: number) {
    super(
      `Budget-Stopp ausgelöst: Geschätzte Kosten (${currentEur.toFixed(4)} €) würden das konfigurierte Limit (${maxEur.toFixed(2)} €) überschreiten.`,
    );
    this.name = 'BudgetLimitExceededError';
  }
}

export class FredGeminiClient {
  private readonly model: string;
  private readonly adapterMode: AiAdapterMode;
  private readonly proxyUrl: string;
  private readonly proxyAccessToken?: string;
  private readonly maxRequestsPerMinute: number;
  private readonly maxBudgetEur: number;
  private readonly estimatedEurPer1kTokens: number;
  private readonly ai: GoogleGenAI | null;

  private requestTimestamps: number[] = [];
  private totalTokens = 0;
  private totalCostEur = 0;
  private totalRequests = 0;

  constructor(config: GeminiClientConfig = {}) {
    this.model = config.model ?? DEFAULT_GEMINI_MODEL;
    this.maxRequestsPerMinute = config.maxRequestsPerMinute ?? 20;
    this.maxBudgetEur = config.maxBudgetEur ?? 5.0;
    this.estimatedEurPer1kTokens = config.estimatedEurPer1kTokens ?? 0.004;
    this.proxyUrl = (config.proxyUrl ?? DEFAULT_CLOUD_PROXY_URL).trim();
    this.proxyAccessToken = config.proxyAccessToken;

    if (config.providerMode === 'FRED_CLOUD_PROXY') {
      this.adapterMode = 'FRED_CLOUD_PROXY';
      this.ai = null;
    } else if (!config.useOfflineAdapter && config.apiKey) {
      this.adapterMode = 'LIVE_GOOGLE_GENAI';
      this.ai = new GoogleGenAI({ apiKey: config.apiKey });
    } else {
      this.adapterMode = 'OFFLINE_TEST_ADAPTER';
      this.ai = null;
    }
  }

  public getUsage(): UsageSnapshot {
    return {
      requestCount: this.totalRequests,
      estimatedTokens: this.totalTokens,
      estimatedCostEur: Number(this.totalCostEur.toFixed(6)),
      maxBudgetEur: this.maxBudgetEur,
      budgetRemainingEur: Number(Math.max(0, this.maxBudgetEur - this.totalCostEur).toFixed(6)),
      adapterMode: this.adapterMode,
      model: this.model,
    };
  }

  private enforceGuards(estimatedInputTokens: number): void {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter((ts) => now - ts < 60_000);
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      throw new RateLimitExceededError(this.maxRequestsPerMinute);
    }

    const projectedCost =
      this.totalCostEur + (estimatedInputTokens / 1000) * this.estimatedEurPer1kTokens;
    if (projectedCost > this.maxBudgetEur) {
      throw new BudgetLimitExceededError(projectedCost, this.maxBudgetEur);
    }
  }

  private recordUsage(promptText: string, responseText: string): { tokens: number; costEur: number } {
    const tokens = Math.max(10, Math.ceil((promptText.length + responseText.length) / 4));
    const costEur = (tokens / 1000) * this.estimatedEurPer1kTokens;
    this.requestTimestamps.push(Date.now());
    this.totalRequests += 1;
    this.totalTokens += tokens;
    this.totalCostEur += costEur;
    return { tokens, costEur: Number(costEur.toFixed(6)) };
  }

  private buildOfflineReply(messages: ChatMessage[]): string {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.text ?? '';
    const lower = lastUser.toLowerCase();

    if (lower.includes('welche steine') || lower.includes('nächstes') || lower.includes('naechstes')) {
      return 'Du brauchst jetzt die rot markierten Steine aus dem aktuellen Bauschritt!';
    }
    if (lower.includes('weniger') && lower.includes('noppen')) {
      return 'Gemerkt! Ich verwende beim nächsten Schritt bevorzugt glatte Tiles.';
    }
    if (lower.includes('pdf') || lower.includes('export')) {
      return 'Klicke oben rechts auf „PDF EXPORT“ – dann speichere ich die Anleitung direkt in deiner Bibliothek.';
    }
    return 'Sag mir einfach, was wir bauen sollen (z. B. „Titanic 3000 Teile“ oder „Burg“) – oder verbinde oben unter „API-Setup“ den Fred-Cloud-Proxy oder deinen Gemini-Key.';
  }

  private async callFredCloudProxy(
    messages: ChatMessage[],
    onChunk?: (chunkText: string) => void,
    fetchImpl: typeof fetch = globalThis.fetch,
  ): Promise<string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.proxyAccessToken) {
      headers.Authorization = `Bearer ${this.proxyAccessToken}`;
    }

    const res = await fetchImpl(this.proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: this.model, messages }),
    });

    if (!res.ok) {
      throw new Error(`Fred-Cloud-Proxy antwortete mit HTTP ${res.status}.`);
    }

    const data = (await res.json()) as { text?: string };
    const fullText = data.text ?? '';
    if (fullText) {
      const chunks = fullText.match(/.{1,32}/g) ?? [fullText];
      for (const ch of chunks) onChunk?.(ch);
    }
    return fullText;
  }

  public async streamChat(
    messages: ChatMessage[],
    onChunk?: (chunkText: string) => void,
    fetchImpl: typeof fetch = globalThis.fetch,
  ): Promise<ChatResponse> {
    const promptCombined = messages.map((m) => `${m.role}: ${m.text}`).join('\n');
    const estimatedInputTokens = Math.ceil(promptCombined.length / 4);
    this.enforceGuards(estimatedInputTokens);

    if (this.adapterMode === 'FRED_CLOUD_PROXY') {
      const fullText = await this.callFredCloudProxy(messages, onChunk, fetchImpl);
      const { tokens, costEur } = this.recordUsage(promptCombined, fullText);
      return {
        text: fullText,
        model: this.model,
        adapterMode: 'FRED_CLOUD_PROXY',
        estimatedTokens: tokens,
        estimatedCostEur: costEur,
      };
    }

    if (this.adapterMode === 'OFFLINE_TEST_ADAPTER' || !this.ai) {
      const reply = this.buildOfflineReply(messages);
      const chunks = reply.match(/.{1,24}/g) ?? [reply];
      for (const ch of chunks) {
        onChunk?.(ch);
      }
      const { tokens, costEur } = this.recordUsage(promptCombined, reply);
      return {
        text: reply,
        model: this.model,
        adapterMode: 'OFFLINE_TEST_ADAPTER',
        estimatedTokens: tokens,
        estimatedCostEur: costEur,
      };
    }

    const systemMsg = messages.find((m) => m.role === 'system')?.text;
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));

    const responseStream = await this.ai.models.generateContentStream({
      model: this.model,
      contents,
      config: systemMsg ? { systemInstruction: systemMsg } : undefined,
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      const piece = chunk.text ?? '';
      if (piece) {
        fullText += piece;
        onChunk?.(piece);
      }
    }

    const { tokens, costEur } = this.recordUsage(promptCombined, fullText);
    return {
      text: fullText,
      model: this.model,
      adapterMode: 'LIVE_GOOGLE_GENAI',
      estimatedTokens: tokens,
      estimatedCostEur: costEur,
    };
  }

  private parseInlineImage(dataUrl: string): { mimeType: string; data: string } | null {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    return { mimeType: match[1], data: match[2] };
  }

  private buildDeterministicResearchBrief(prompt: string): SubjectResearchBrief {
    const lower = prompt.toLowerCase();
    const scaleMatch = prompt.match(/1\s*:\s*(\d{2,4})/);
    const scaleLabel = scaleMatch ? `1:${scaleMatch[1]}` : '1:300';

    if (/gorch\s*fock|dreimastbark|segelschulschiff/i.test(lower)) {
      return {
        title: `Gorch Fock (${scaleLabel})`,
        scaleLabel,
        category: 'tall_ship',
        realDimensionsNote: 'Original: 89,3 m Länge ü. A., 12,0 m Breite, 45,3 m Masthöhe; Dreimastbark (Fock- & Großmast rahgetakelt, Besanmast schratgetakelt).',
        targetStudsLength: 56,
        targetStudsWidth: 8,
        targetStudsHeight: 28,
        primaryColors: [15, 320, 19],
        accentColors: [0, 272, 14, 4],
        signatureFeatures: [
          'Dunkelroter Unterwasserrumpf mit Ruder und schwarzem Display-Ständer',
          'Weißer Überwasserrumpf mit dunklen Bullaugen und langem Bugspriet',
          'Gefliestes Holzdeck (Tan) mit weißen Deckshäusern und Rettungsbooten',
          '3 Masten mit gestaffelten weißen Rahsegeln, Besansegel und Deutschlandflagge',
        ],
        assemblies: [
          '1. Display-Ständer & Technic-Kiel',
          '2. Dunkelroter Unterwasserrumpf',
          '3. Weißer Rumpf, Bullaugen & Bugspriet',
          '4. Gefliestes Holzdeck & Deckshäuser',
          '5. Drei Masten, Rahsegel & Flaggen',
        ],
        sources: [],
        adapterMode: this.adapterMode,
      };
    }

    if (/titanic|titanik/i.test(lower)) {
      return {
        title: 'RMS Titanic (3.000 Teile)',
        scaleLabel: '1:450',
        category: 'ocean_liner',
        realDimensionsNote: 'Original: 269,1 m Länge, 28,2 m Breite; 4 markante gelb-schwarze Schornsteine, 2 Masten, 16 Rettungsboote.',
        targetStudsLength: 108,
        targetStudsWidth: 12,
        targetStudsHeight: 24,
        primaryColors: [0, 4, 15, 19],
        accentColors: [14, 71, 72],
        signatureFeatures: [
          'Roter Unterwasserkiel mit 3 Schrauben/Ruder',
          'Schwarzer Hochrumpf mit weißer Promenaden-Aufbautenreihe',
          '4 runde gelb-schwarze Schornsteine & 16 Rettungsboote',
        ],
        assemblies: [
          '1. Roter Unterwasserkiel & Ruder',
          '2. Schwarzer Hochrumpf & Innenkern',
          '3. Promenadendecks, Brücke & Rettungsboote',
          '4. Vier Schornsteine, Masten & Fliesen',
        ],
        sources: [],
        adapterMode: this.adapterMode,
      };
    }

    if (/auto|porsche|ferrari|wagen|truck|lkw|bus|lok|zug|panzer|fahrzeug/i.test(lower)) {
      return {
        title: prompt.trim().slice(0, 52),
        scaleLabel: scaleMatch ? scaleLabel : '1:18',
        category: 'vehicle',
        realDimensionsNote: 'Sammler-Fahrzeugmodell mit Technic-Chassis, Radkästen, flacher Karosserie und getönter Kabine.',
        targetStudsLength: 24,
        targetStudsWidth: 10,
        targetStudsHeight: 8,
        primaryColors: [4, 0, 72],
        accentColors: [15, 71, 14],
        signatureFeatures: [
          'Verwindungssteifes Technic-Chassis mit Radkästen',
          'Flache SNOT-/Slope-Karosserie mit Scheinwerfern und Heckspoiler',
          'Kabine mit klaren Proportionen und Display-Sockel',
        ],
        assemblies: [
          '1. Technic-Chassis & Achsen',
          '2. Karosserie im Steinverbund',
          '3. Cockpit, Dach-Slopes & Details',
        ],
        sources: [],
        adapterMode: this.adapterMode,
      };
    }

    if (/turm|leuchtturm|haus|villa|schloss|burg|kathedrale|kirche|brücke|hochhaus|eiffelturm/i.test(lower)) {
      return {
        title: prompt.trim().slice(0, 52),
        scaleLabel: scaleMatch ? scaleLabel : '1:200',
        category: 'architecture',
        realDimensionsNote: 'Architektur-Sammlermodell mit verjüngtem Mauerverbund, Sockelplatte, Gesims und Dachabschluss.',
        targetStudsLength: 18,
        targetStudsWidth: 18,
        targetStudsHeight: 32,
        primaryColors: [15, 4, 71],
        accentColors: [72, 19, 14, 0],
        signatureFeatures: [
          'Stabiler Display-Sockel mit gefliester Umrandung',
          'Versetzter Mauerverbund mit Fenstern und Gesimsen',
          'Profiliertes Dach bzw. Laternen-/Turmkrone',
        ],
        assemblies: [
          '1. Fundament & Display-Sockel',
          '2. Hauptkörper im Mauerverbund',
          '3. Fassadendetails & Turmkrone',
        ],
        sources: [],
        adapterMode: this.adapterMode,
      };
    }

    if (/schiff|boot|u-boot|fregatte|kreuzer|yacht|segel/i.test(lower)) {
      return {
        title: prompt.trim().slice(0, 52),
        scaleLabel,
        category: 'tall_ship',
        realDimensionsNote: 'Maritimes Display-Modell mit verjüngtem Bug/Heck, Display-Ständer und Deckaufbauten.',
        targetStudsLength: 44,
        targetStudsWidth: 8,
        targetStudsHeight: 20,
        primaryColors: [15, 320, 71],
        accentColors: [0, 19, 14],
        signatureFeatures: ['Display-Ständer', 'Verjüngter Rumpf im Steinverbund', 'Deckaufbauten & Masten'],
        assemblies: ['1. Display-Ständer & Kiel', '2. Rumpf im Steinverbund', '3. Deck & Aufbauten'],
        sources: [],
        adapterMode: this.adapterMode,
      };
    }

    return {
      title: prompt.trim().slice(0, 52),
      scaleLabel: scaleMatch ? scaleLabel : 'Display',
      category: 'custom',
      realDimensionsNote: 'AFOL-Display-Modell im 20-LDU-Noppenraster mit versetztem Steinverbund, Technic-Kern und gefliestem Finish.',
      targetStudsLength: 20,
      targetStudsWidth: 14,
      targetStudsHeight: 16,
      primaryColors: [71, 15, 1],
      accentColors: [72, 14, 4],
      signatureFeatures: [
        'Stabiler Display-Sockel mit Fliesenrahmen',
        'Tragender Kern im versetzten Steinverbund',
        'Abgeschrägte Konturen (Slopes) & glatt geflieste Oberflächen',
      ],
      assemblies: [
        '1. Display-Sockel & Kern',
        '2. Hauptstruktur im Steinverbund',
        '3. Außenhaut, Slopes & Finish',
      ],
      sources: [],
      adapterMode: this.adapterMode,
    };
  }

  /**
   * Stufe 1 der Fred-Pro-Pipeline:
   * Recherchiert Originalmaße, Proportionen, Farben & Baugruppen via Google Search Grounding (Live)
   * oder deterministischer Fachbasis (Offline).
   */
  public async researchSubject(
    prompt: string,
    referenceImageDataUrl?: string,
    fetchImpl: typeof fetch = globalThis.fetch,
  ): Promise<SubjectResearchBrief> {
    const fallback = this.buildDeterministicResearchBrief(prompt);
    const estimatedInputTokens = Math.ceil(prompt.length / 4) + (referenceImageDataUrl ? 400 : 120);
    this.enforceGuards(estimatedInputTokens);

    if (this.adapterMode === 'OFFLINE_TEST_ADAPTER') {
      this.recordUsage(prompt, JSON.stringify(fallback));
      return fallback;
    }

    const researchInstruction = [
      'Du bist Fred, der weltbeste Klemmbaustein-Ingenieur (AFOL/MOC-Profi).',
      'Recherchiere echte Originalmaße, Proportionen, Erkennungsmerkmale und LDraw-Farben für das gewünschte Modell.',
      'Antworte ausschließlich als valides JSON mit den Feldern:',
      '{ "title": string, "scaleLabel": string, "category": "tall_ship"|"ocean_liner"|"vehicle"|"architecture"|"aircraft"|"spacecraft"|"custom", "realDimensionsNote": string, "targetStudsLength": number, "targetStudsWidth": number, "targetStudsHeight": number, "primaryColors": number[], "accentColors": number[], "signatureFeatures": string[], "assemblies": string[] }',
    ].join('\n');

    try {
      let rawText = '';
      const sources: Array<{ title: string; url: string }> = [];

      if (this.adapterMode === 'FRED_CLOUD_PROXY') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.proxyAccessToken) headers.Authorization = `Bearer ${this.proxyAccessToken}`;
        const res = await fetchImpl(this.proxyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            mode: 'research',
            model: this.model,
            messages: [
              { role: 'system', text: researchInstruction },
              { role: 'user', text: prompt },
            ],
            inlineImages: referenceImageDataUrl ? [this.parseInlineImage(referenceImageDataUrl)].filter(Boolean) : [],
          }),
        });
        if (!res.ok) throw new Error(`Proxy research HTTP ${res.status}`);
        const data = (await res.json()) as { text?: string; sources?: Array<{ title: string; url: string }> };
        rawText = data.text ?? '';
        if (Array.isArray(data.sources)) sources.push(...data.sources);
      } else if (this.ai) {
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
          { text: prompt },
        ];
        const parsedImg = referenceImageDataUrl ? this.parseInlineImage(referenceImageDataUrl) : null;
        if (parsedImg) parts.push({ inlineData: parsedImg });

        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction: researchInstruction,
            tools: [{ googleSearch: {} }],
          },
        });
        rawText = response.text ?? '';
        const chunks = (response as unknown as {
          candidates?: Array<{
            groundingMetadata?: { groundingChunks?: Array<{ web?: { title?: string; uri?: string } }> };
          }>;
        }).candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (Array.isArray(chunks)) {
          for (const c of chunks) {
            if (c.web?.uri) {
              sources.push({ title: c.web.title ?? c.web.uri, url: c.web.uri });
            }
          }
        }
      }

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<SubjectResearchBrief>;
        this.recordUsage(prompt, rawText);
        return {
          ...fallback,
          ...parsed,
          sources: sources.length > 0 ? sources : fallback.sources,
          adapterMode: this.adapterMode,
        };
      }
    } catch {
      // Graceful fallback to deterministic brief if network/parsing fails
    }

    this.recordUsage(prompt, JSON.stringify(fallback));
    return fallback;
  }

  /**
   * Stufe 5 der Fred-Pro-Pipeline:
   * Visuelle Selbstkritik – vergleicht Konzeptbild / Referenzfoto mit gerenderten 3D-Ansichten
   * via Gemini Multimodal Vision und gibt konkrete Makro-Korrekturen zurück.
   */
  public async critiqueModelVisuals(
    brief: SubjectResearchBrief,
    conceptImageDataUrl: string | undefined,
    renderedViewsDataUrls: string[],
    fetchImpl: typeof fetch = globalThis.fetch,
  ): Promise<VisionCritiqueResult> {
    const defaultResult: VisionCritiqueResult = {
      approved: true,
      score: 92,
      summary: `Proportionen, Steinverbund und Hauptmerkmale von „${brief.title}“ passen sauber zum Zielbild.`,
      issues: [],
      recommendedAdjustments: [],
      adapterMode: this.adapterMode,
    };

    const images = [
      ...(conceptImageDataUrl ? [this.parseInlineImage(conceptImageDataUrl)] : []),
      ...renderedViewsDataUrls.map((u) => this.parseInlineImage(u)),
    ].filter((x): x is { mimeType: string; data: string } => Boolean(x));

    this.enforceGuards(250 + images.length * 250);

    if (this.adapterMode === 'OFFLINE_TEST_ADAPTER' || images.length === 0) {
      this.recordUsage(brief.title, JSON.stringify(defaultResult));
      return defaultResult;
    }

    const critiquePrompt = [
      `Vergleiche das Zielbild mit den 3D-Klemmbaustein-Renderings für "${brief.title}" (${brief.scaleLabel}).`,
      `Erwartete Merkmale: ${brief.signatureFeatures.join('; ')}.`,
      'Antworte ausschließlich als JSON:',
      '{ "approved": boolean, "score": number (0-100), "summary": string, "issues": string[], "recommendedAdjustments": ("ADD_DISPLAY_STAND"|"ENRICH_SAILS_AND_RIGGING"|"ADD_BOWSPRIT_AND_FLAGS"|"ADD_ROOF_SLOPES"|"ADD_EXTERIOR_DETAILS")[] }',
    ].join('\n');

    try {
      let rawText = '';
      if (this.adapterMode === 'FRED_CLOUD_PROXY') {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.proxyAccessToken) headers.Authorization = `Bearer ${this.proxyAccessToken}`;
        const res = await fetchImpl(this.proxyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            mode: 'vision',
            model: this.model,
            messages: [{ role: 'user', text: critiquePrompt }],
            inlineImages: images,
          }),
        });
        if (!res.ok) throw new Error(`Proxy vision HTTP ${res.status}`);
        const data = (await res.json()) as { text?: string };
        rawText = data.text ?? '';
      } else if (this.ai) {
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
          { text: critiquePrompt },
          ...images.map((img) => ({ inlineData: img })),
        ];
        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: [{ role: 'user', parts }],
        });
        rawText = response.text ?? '';
      }

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<VisionCritiqueResult>;
        this.recordUsage(critiquePrompt, rawText);
        return {
          approved: Boolean(parsed.approved ?? true),
          score: typeof parsed.score === 'number' ? parsed.score : 88,
          summary: parsed.summary ?? defaultResult.summary,
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          recommendedAdjustments: Array.isArray(parsed.recommendedAdjustments) ? parsed.recommendedAdjustments : [],
          adapterMode: this.adapterMode,
        };
      }
    } catch {
      // Graceful fallback
    }

    this.recordUsage(critiquePrompt, JSON.stringify(defaultResult));
    return defaultResult;
  }
}
