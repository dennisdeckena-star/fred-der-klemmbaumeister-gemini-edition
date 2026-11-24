import { GoogleGenAI } from '@google/genai';
import { CadModel } from '../cad';
import {
  buildAirplaneModel,
  buildCastleModel,
  buildFeasibilityProbeModel,
  buildPirateShipModel,
  buildSpaceRoverModel,
} from '../models/sampleModels';

export const DEFAULT_IMAGEN_MODEL = 'imagen-3.0-generate-002';

export type DetailLevel = 'COMPACT' | 'STANDARD' | 'DISPLAY';

export interface ConceptRecommendation {
  detailLevel: DetailLevel;
  estimatedParts: number;
  estimatedBuildMinutes: number;
  summary: string;
}

export interface SyntheticImageMetadata {
  ai_generated: true;
  eu_ai_act_art50: 'SYNTHETIC_CONCEPT_PREVIEW';
  isConceptOnlyNotCadModel: true;
  generatorModel: string;
  adapterMode: 'LIVE_GOOGLE_IMAGEN' | 'OFFLINE_TEST_ADAPTER';
  createdAt: string;
  revision: number;
}

export interface ConceptRevision {
  revision: number;
  prompt: string;
  changeRequest?: string;
  detailLevel: DetailLevel;
  imageDataUrl: string;
  metadata: SyntheticImageMetadata;
  recommendations: ConceptRecommendation[];
}

export interface ConceptSession {
  id: string;
  title: string;
  status: 'PENDING_APPROVAL' | 'APPROVED';
  approvedRevision: number | null;
  approvedAt: string | null;
  approvedBy: string | null;
  revisions: ConceptRevision[];
}

function buildRecommendations(prompt: string): ConceptRecommendation[] {
  const isLarge = /titanic|schiff|burg|schloss|stadt/i.test(prompt);
  return [
    {
      detailLevel: 'COMPACT',
      estimatedParts: isLarge ? 65 : 35,
      estimatedBuildMinutes: 15,
      summary: 'Kompaktes Spielmodell: robust, wenige Spezialteile, ideal für schnellen Aufbau.',
    },
    {
      detailLevel: 'STANDARD',
      estimatedParts: isLarge ? 160 : 85,
      estimatedBuildMinutes: 35,
      summary: 'Ausgewogene Detailtiefe: klare Proportionen, stabile Innenverstrebung und saubere Außenhaut.',
    },
    {
      detailLevel: 'DISPLAY',
      estimatedParts: isLarge ? 380 : 210,
      estimatedBuildMinutes: 90,
      summary: 'Hohe Vitrinen-Detailtiefe: viele glatte Tiles, feine Konturen, höherer Teilebedarf.',
    },
  ];
}

function buildOfflineConceptSvgDataUrl(
  prompt: string,
  revision: number,
  detailLevel: DetailLevel,
  meta: SyntheticImageMetadata,
): string {
  const safePrompt = prompt.replace(/[<>&"]/g, '').slice(0, 64);
  const metaJson = JSON.stringify(meta).replace(/--/g, '-');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <!-- EU_AI_ACT_ART50_METADATA: ${metaJson} -->
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#bg)"/>
  <rect x="40" y="290" width="560" height="36" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="190" y="190" width="260" height="90" rx="8" fill="#e11d48" stroke="#9f1239" stroke-width="3"/>
  <rect x="210" y="140" width="220" height="54" rx="6" fill="#facc15" stroke="#ca8a04" stroke-width="3"/>
  <rect x="270" y="80" width="100" height="62" rx="6" fill="#2563eb" stroke="#1e40af" stroke-width="3"/>
  <circle cx="240" cy="134" r="10" fill="#facc15"/>
  <circle cx="300" cy="74" r="10" fill="#2563eb"/>
  <circle cx="340" cy="74" r="10" fill="#2563eb"/>
  <circle cx="400" cy="134" r="10" fill="#facc15"/>
  <rect x="16" y="16" width="330" height="32" rx="16" fill="#0f172a" fill-opacity="0.82"/>
  <text x="30" y="37" fill="#ffffff" font-family="Segoe UI, sans-serif" font-size="13" font-weight="700">KI-KONZEPTBILD (EU AI Act Art. 50) • Rev. ${revision}</text>
  <text x="40" y="356" fill="#334155" font-family="Segoe UI, sans-serif" font-size="14" font-weight="700">${safePrompt}</text>
  <text x="40" y="378" fill="#64748b" font-family="Segoe UI, sans-serif" font-size="12">Detailstufe: ${detailLevel} • Hinweis: Konzeptvorschau ≠ 3D-CAD-Modell (Offline-Testadapter)</text>
</svg>`;
  const encoded = typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${encoded}`;
}

export class ConceptStudioService {
  private readonly sessions = new Map<string, ConceptSession>();
  private readonly apiKey?: string;
  private readonly imagenModel: string;
  private readonly useOfflineAdapter: boolean;
  private cachedImageModels: Array<{ name: string; method: 'predict' | 'generateContent' }> | null = null;

  constructor(options: { apiKey?: string; imagenModel?: string; useOfflineAdapter?: boolean } = {}) {
    this.apiKey = options.apiKey;
    this.imagenModel = options.imagenModel ?? DEFAULT_IMAGEN_MODEL;
    this.useOfflineAdapter = options.useOfflineAdapter || !options.apiKey;
  }

  /**
   * Fragt einmalig (gecacht) über Google ModelService.ListModels ab, welche Bildmodelle
   * für diesen API-Key tatsächlich freigeschaltet sind – vermeidet langsame 404-Fehlversuche!
   */
  private async discoverAvailableImageModels(): Promise<
    Array<{ name: string; method: 'predict' | 'generateContent' }>
  > {
    if (this.cachedImageModels) return this.cachedImageModels;
    if (!this.apiKey) return [];

    const discovered: Array<{ name: string; method: 'predict' | 'generateContent' }> = [];
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(this.apiKey)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
        };
        const rawModels = data.models ?? [];

        // 1. Prefer fast & modern Imagen models (predict)
        for (const m of rawModels) {
          const shortName = (m.name ?? '').replace(/^models\//, '');
          const methods = m.supportedGenerationMethods ?? [];
          if (/imagen/i.test(shortName) && methods.includes('predict')) {
            discovered.push({ name: shortName, method: 'predict' });
          }
        }
        // Sort so fast / v4 models come first
        discovered.sort((a, b) => {
          const score = (n: string) =>
            (n.includes('fast') ? 10 : 0) + (n.includes('4.0') ? 5 : n.includes('3.0') ? 3 : 0);
          return score(b.name) - score(a.name);
        });

        // 2. Also include native Gemini image generation models (generateContent)
        const geminiImg = rawModels
          .map((m) => ({
            name: (m.name ?? '').replace(/^models\//, ''),
            methods: m.supportedGenerationMethods ?? [],
          }))
          .filter(
            (m) =>
              /image/i.test(m.name) &&
              !/imagen/i.test(m.name) &&
              m.methods.includes('generateContent'),
          )
          .sort((a, b) => {
            const score = (n: string) =>
              (n.includes('2.5-flash') ? 10 : n.includes('3-') ? 8 : 2) -
              (n.includes('exp') ? 3 : 0);
            return score(b.name) - score(a.name);
          });

        for (const gm of geminiImg) {
          discovered.push({ name: gm.name, method: 'generateContent' });
        }
      }
    } catch {
      // Fall back to curated defaults if ListModels call fails
    }

    if (discovered.length === 0) {
      discovered.push(
        { name: 'imagen-4.0-fast-generate-001', method: 'predict' },
        { name: 'imagen-4.0-generate-001', method: 'predict' },
        { name: 'imagen-3.0-generate-002', method: 'predict' },
        { name: 'gemini-2.5-flash-image', method: 'generateContent' },
      );
    }

    this.cachedImageModels = discovered;
    return discovered;
  }

  private async renderPreviewImage(
    prompt: string,
    revision: number,
    detailLevel: DetailLevel,
  ): Promise<{ imageDataUrl: string; metadata: SyntheticImageMetadata }> {
    const metadata: SyntheticImageMetadata = {
      ai_generated: true,
      eu_ai_act_art50: 'SYNTHETIC_CONCEPT_PREVIEW',
      isConceptOnlyNotCadModel: true,
      generatorModel: this.imagenModel,
      adapterMode: this.useOfflineAdapter ? 'OFFLINE_TEST_ADAPTER' : 'LIVE_GOOGLE_IMAGEN',
      createdAt: new Date().toISOString(),
      revision,
    };

    if (this.useOfflineAdapter || !this.apiKey) {
      if (/gorch\s*fock|dreimastbark|segelschulschiff/i.test(prompt)) {
        return { imageDataUrl: './concepts/gorch-fock-concept.png', metadata };
      }
      if (/titanic|titanik/i.test(prompt)) {
        return { imageDataUrl: './concepts/titanic-concept.png', metadata };
      }
      return {
        imageDataUrl: buildOfflineConceptSvgDataUrl(prompt, revision, detailLevel, metadata),
        metadata,
      };
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const styledPrompt = `Photorealistic 3/4 isometric studio product photograph of a high-detail adult collector interlocking plastic brick (AFOL MOC, ${detailLevel} detail) model of: ${prompt}. Realistic ABS plastic sheen, visible interlocking bricks, smooth tiles, slopes and fine details, bright studio tabletop, no text, no watermark.`;

    const candidates = await this.discoverAvailableImageModels();
    let lastErrorMessage = 'Kein Bildmodell für diesen API-Key verfügbar.';

    for (const candidate of candidates) {
      try {
        if (candidate.method === 'predict') {
          const res = await ai.models.generateImages({
            model: candidate.name,
            prompt: styledPrompt,
            config: { numberOfImages: 1, aspectRatio: '16:9' },
          });
          const b64 = res.generatedImages?.[0]?.image?.imageBytes;
          if (b64) {
            return {
              imageDataUrl: `data:image/png;base64,${b64}`,
              metadata: { ...metadata, generatorModel: candidate.name, adapterMode: 'LIVE_GOOGLE_IMAGEN' },
            };
          }
        } else {
          const res = await ai.models.generateContent({
            model: candidate.name,
            contents: styledPrompt,
            config: { responseModalities: ['IMAGE', 'TEXT'] },
          });
          const parts = res.candidates?.[0]?.content?.parts ?? [];
          for (const p of parts) {
            const inline = (p as { inlineData?: { mimeType?: string; data?: string } }).inlineData;
            if (inline?.data) {
              const mime = inline.mimeType || 'image/png';
              return {
                imageDataUrl: `data:${mime};base64,${inline.data}`,
                metadata: { ...metadata, generatorModel: candidate.name, adapterMode: 'LIVE_GOOGLE_IMAGEN' },
              };
            }
          }
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        if (/billing|quota|limit|429|RESOURCE_EXHAUSTED/i.test(raw)) {
          lastErrorMessage = 'Google Bild-API Kontingent/Billing für diesen Key nicht aktiv.';
        } else if (/API_KEY_INVALID|401|403|PERMISSION_DENIED/i.test(raw)) {
          lastErrorMessage = 'API-Key hat keine Berechtigung für die Google Bilderzeugung.';
        } else {
          lastErrorMessage = `Modell ${candidate.name} nicht verfügbar.`;
        }
      }
    }

    throw new Error(lastErrorMessage);
  }

  public async createConcept(
    title: string,
    prompt: string,
    detailLevel: DetailLevel = 'STANDARD',
  ): Promise<ConceptSession> {
    const id = `concept-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const { imageDataUrl, metadata } = await this.renderPreviewImage(prompt, 1, detailLevel);

    const session: ConceptSession = {
      id,
      title,
      status: 'PENDING_APPROVAL',
      approvedRevision: null,
      approvedAt: null,
      approvedBy: null,
      revisions: [
        {
          revision: 1,
          prompt,
          detailLevel,
          imageDataUrl,
          metadata,
          recommendations: buildRecommendations(prompt),
        },
      ],
    };

    this.sessions.set(id, session);
    return session;
  }

  public async reviseConcept(
    sessionId: string,
    changeRequest: string,
    detailLevel?: DetailLevel,
  ): Promise<ConceptSession> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Konzept-Sitzung nicht gefunden: ${sessionId}`);

    const last = session.revisions[session.revisions.length - 1];
    const nextRev = last.revision + 1;
    const nextDetail = detailLevel ?? last.detailLevel;
    const combinedPrompt = `${last.prompt} | Änderung Rev. ${nextRev}: ${changeRequest}`;
    const { imageDataUrl, metadata } = await this.renderPreviewImage(combinedPrompt, nextRev, nextDetail);

    session.revisions.push({
      revision: nextRev,
      prompt: combinedPrompt,
      changeRequest,
      detailLevel: nextDetail,
      imageDataUrl,
      metadata,
      recommendations: buildRecommendations(combinedPrompt),
    });

    // Any revision invalidates prior approval -> Freigabe-Gate must be re-confirmed!
    session.status = 'PENDING_APPROVAL';
    session.approvedRevision = null;
    session.approvedAt = null;
    session.approvedBy = null;

    return session;
  }

  public approveConcept(sessionId: string, approvedBy = 'user'): ConceptSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Konzept-Sitzung nicht gefunden: ${sessionId}`);
    const latest = session.revisions[session.revisions.length - 1];
    session.status = 'APPROVED';
    session.approvedRevision = latest.revision;
    session.approvedAt = new Date().toISOString();
    session.approvedBy = approvedBy;
    return session;
  }

  public getSession(sessionId: string): ConceptSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Strict Approval Gate: deterministic 3D CAD construction is ONLY permitted after explicit approval.
   */
  public assertApprovedForCad(sessionId: string): ConceptSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`CONCEPT_NOT_APPROVED: Konzept-Sitzung '${sessionId}' existiert nicht.`);
    }
    const latest = session.revisions[session.revisions.length - 1];
    if (session.status !== 'APPROVED' || session.approvedRevision !== latest.revision) {
      throw new Error(
        `CONCEPT_NOT_APPROVED: Konzeptbild (Rev. ${latest.revision}) ist noch nicht freigegeben. Bild ≠ 3D-Modell – erst nach expliziter Freigabe darf die 3D-Konstruktion starten.`,
      );
    }
    return session;
  }

  public buildDeterministicModelFromApprovedConcept(sessionId: string): CadModel {
    const session = this.assertApprovedForCad(sessionId);
    const latest = session.revisions[session.revisions.length - 1];
    const text = `${session.title} ${latest.prompt}`.toLowerCase();

    let model: CadModel;
    if (text.includes('burg') || text.includes('schloss')) {
      model = buildCastleModel();
    } else if (text.includes('rover') || text.includes('weltraum') || text.includes('mars')) {
      model = buildSpaceRoverModel();
    } else if (text.includes('flugzeug') || text.includes('jet') || text.includes('flieger')) {
      model = buildAirplaneModel();
    } else if (text.includes('schiff') || text.includes('titanic') || text.includes('pirat')) {
      model = buildPirateShipModel();
    } else {
      model = buildFeasibilityProbeModel();
    }

    return {
      ...model,
      id: `model-from-${session.id}`,
      name: session.title,
      description: `Deterministisches 3D-CAD-Modell aus freigegebenem Konzept (Rev. ${latest.revision}).`,
      metadata: {
        ...model.metadata,
        approvedConceptId: session.id,
        approvedRevision: session.approvedRevision,
        approvedAt: session.approvedAt,
      },
    };
  }
}
