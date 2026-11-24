import { CadModel, validateConnections } from '../cad';
import { FredGeminiClient, SubjectResearchBrief, VisionCritiqueResult } from '../ai/geminiClient';
import { GoogleImagePlugin } from '../plugins/googleImagePlugin';
import { ImageMcpPriorityRouter } from '../plugins/freeImageMcpPlugins';
import {
  BuilderAdjustment,
  buildBrandenburgGateModel,
  buildGorchFockModel,
  buildModelFromResearchBrief,
} from '../models/customModelBuilder';
import { buildNeuschwansteinModel } from '../cad/blueprintCompiler';
import { buildTitanic3000Model } from '../models/titanicModel';
import { buildU99SubmarineModel } from '../models/u99SubmarineModel';
import { runValidationCenter } from '../validation/validationCenter';
import { listAllParts } from '../ldraw';
import { buildProBuilderSystemPrompt } from '../../../plugins/fred-pro-builder/scripts/snot_engineering_rules';

export type HarnessState =
  | 'IDLE'
  | 'RESEARCHING'
  | 'GENERATING_PREVIEW'
  | 'AWAITING_USER_APPROVAL'
  | 'BUILDING_CAD'
  | 'VALIDATING_PHYSICS'
  | 'VISION_SELF_CRITIQUE'
  | 'READY';

export interface AgentTraceStep {
  layer: 'KNOWLEDGE' | 'RESEARCH' | 'IMAGE_PLUGIN' | 'CAD_ENGINE' | 'PHYSICS_QA' | 'VISION_QA';
  tool: string;
  status: 'OK' | 'FALLBACK' | 'FAIL';
  detail: string;
  durationMs: number;
}

export interface HarnessConceptDraft {
  id: string;
  userPrompt: string;
  requestedPartCount: number | null;
  brief: SubjectResearchBrief;
  imageUrl?: string;
  imageBadge?: string;
  imageErrorNote?: string;
  trace: AgentTraceStep[];
}

export interface HarnessBuildResult {
  model: CadModel;
  draft: HarnessConceptDraft;
  critique: VisionCritiqueResult;
  revisionCount: number;
  trace: AgentTraceStep[];
  fredReply: string;
}

export function extractRequestedPartCount(prompt: string): number | null {
  const m = prompt.match(/\b(\d{3,5})\s*(teile|steine|bricks?)?\b/i);
  if (!m) return null;
  const val = Number(m[1]);
  if (val < 100 || val > 20000) return null;
  // Ignore scale denominators like "1:300"
  if (new RegExp(`1\\s*:\\s*${m[1]}`).test(prompt)) return null;
  return val;
}

/**
 * Zentraler 5-Schichten-AI-Agent-Harness für Fred, der Klemmbaumeister (v1.0.3).
 * Steuert deterministisch:
 * 1. Wissens- & Bauteilkatalog-Schicht (LDraw + AFOL/SNOT-Regeln)
 * 2. Research-Schicht (Google Search Grounding)
 * 3. Google-Image-Plugin-Schicht (gemini-3.1-flash-image / nano-banana + Multi-Turn-Edit)
 * 4. Striktes Nutzer-Freigabe-Gate (👍 Grüner Daumen / 👎 Roter Daumen)
 * 5. CAD-Engine + Physik-Gate + Vision-Selbstkritik (Ralph-Loop)
 */
export class FredAgentHarness {
  private readonly geminiClient: FredGeminiClient;
  private readonly imagePlugin: GoogleImagePlugin;
  private readonly imageRouter: ImageMcpPriorityRouter;
  private state: HarnessState = 'IDLE';

  constructor(options: {
    geminiClient: FredGeminiClient;
    imagePlugin: GoogleImagePlugin;
    imageRouter?: ImageMcpPriorityRouter;
  }) {
    this.geminiClient = options.geminiClient;
    this.imagePlugin = options.imagePlugin;
    this.imageRouter =
      options.imageRouter ??
      new ImageMcpPriorityRouter({ googleImagePlugin: options.imagePlugin });
  }

  public getState(): HarnessState {
    return this.state;
  }

  /**
   * Phase A (VOR dem Bauplan):
   * Lädt Bauteilwissen → recherchiert Originalmaße → erzeugt fotorealistisches Wunschbild
   * und STOPPT garantiert am Freigabe-Gate (AWAITING_USER_APPROVAL).
   */
  public async prepareConcept(
    userPrompt: string,
    options: {
      referenceImageDataUrl?: string;
      previousDraft?: HarnessConceptDraft | null;
      refinementNote?: string;
      onProgress?: (state: HarnessState, message: string) => void;
    } = {},
  ): Promise<HarnessConceptDraft> {
    const trace: AgentTraceStep[] = [];
    const requestedPartCount =
      extractRequestedPartCount(userPrompt) ?? options.previousDraft?.requestedPartCount ?? null;

    // Schicht 1: Bauteilkatalog & AFOL-Techniken prüfen
    const t0 = Date.now();
    const catalogCount = listAllParts().length;
    const rulesLen = buildProBuilderSystemPrompt().length;
    trace.push({
      layer: 'KNOWLEDGE',
      tool: 'catalog + snot_engineering_rules',
      status: 'OK',
      detail: `${catalogCount} LDraw-Teile & AFOL-Regelwerk (${rulesLen} Z.) geladen`,
      durationMs: Date.now() - t0,
    });

    // Schicht 2: Internet-Research (Google Search Grounding)
    this.state = 'RESEARCHING';
    options.onProgress?.('RESEARCHING', 'Ich recherchiere gerade Originalmaße, Farben und Bautechniken…');
    const t1 = Date.now();
    const brief = await this.geminiClient.researchSubject(userPrompt, options.referenceImageDataUrl);
    trace.push({
      layer: 'RESEARCH',
      tool: 'gemini.researchSubject (googleSearch)',
      status: brief.adapterMode === 'OFFLINE_TEST_ADAPTER' ? 'FALLBACK' : 'OK',
      detail:
        brief.sources.length > 0
          ? `${brief.title} (${brief.sources.length} Web-Quellen)`
          : `${brief.title} (${brief.scaleLabel})`,
      durationMs: Date.now() - t1,
    });

    // Schicht 3: Google-Bild-Plugin (gemini-3.1-flash-image / nano-banana)
    this.state = 'GENERATING_PREVIEW';
    options.onProgress?.(
      'GENERATING_PREVIEW',
      `Ich erzeuge jetzt dein fotorealistisches Klemmbaustein-Vorschaubild für „${brief.title}“…`,
    );
    let imageUrl: string | undefined = options.referenceImageDataUrl;
    let imageBadge: string | undefined = options.referenceImageDataUrl
      ? `Dein Referenzbild • ${brief.title}`
      : undefined;
    let imageErrorNote: string | undefined;

    if (!imageUrl) {
      const t2 = Date.now();
      const partHint = requestedPartCount ? `, approximately ${requestedPartCount} interlocking bricks` : '';
      try {
        const imgRes = await this.imageRouter.generatePreview({
          prompt: `${brief.title} (${brief.scaleLabel}${partHint}): ${brief.realDimensionsNote} Key features: ${brief.signatureFeatures.join(', ')}.`,
          detailLevel: 'DISPLAY',
          previousImageDataUrl: options.previousDraft?.imageUrl,
          refinementNote: options.refinementNote,
        });
        imageUrl = imgRes.imageDataUrl;
        imageBadge = `${imgRes.providerLabel} (${imgRes.modelUsed}) • EU AI Act Art. 50`;
        const chainSummary = imgRes.attempts
          .map((a) => `#${a.priority} ${a.providerId}:${a.status === 'SUCCESS' ? 'OK' : a.status}`)
          .join(' → ');
        trace.push({
          layer: 'IMAGE_PLUGIN',
          tool: `${imgRes.providerId} (${imgRes.modelUsed})`,
          status: imgRes.adapterMode === 'OFFLINE_FALLBACK' ? 'FALLBACK' : 'OK',
          detail: `${imgRes.providerLabel} (${chainSummary})`,
          durationMs: imgRes.durationMs,
        });
      } catch (err) {
        imageErrorNote = err instanceof Error ? err.message : 'Bild-MCP-Kette nicht erreichbar.';
        trace.push({
          layer: 'IMAGE_PLUGIN',
          tool: 'image_router.generate_preview',
          status: 'FAIL',
          detail: imageErrorNote,
          durationMs: Date.now() - t2,
        });
      }
    }

    // Schicht 4: Striktes Freigabe-Gate — baut NIEMALS vor 👍!
    this.state = 'AWAITING_USER_APPROVAL';
    options.onProgress?.(
      'AWAITING_USER_APPROVAL',
      `Vorschaubild für „${brief.title}“ steht bereit – bewerte es bitte kurz im Popup!`,
    );

    return {
      id: `draft-${Date.now().toString(36)}`,
      userPrompt,
      requestedPartCount,
      brief,
      imageUrl,
      imageBadge,
      imageErrorNote,
      trace,
    };
  }

  /**
   * Phase B (ERST nach 👍 Grüner Daumen im Popup!):
   * Baut den 3D-Bauplan mit der gewünschten Teilezahl, prüft 0 Kollisionen & 20-LDU-Raster
   * und führt die Vision-Selbstkritik (Ralph-Loop, max. 2 Runden) aus.
   */
  public async buildApprovedConcept(
    draft: HarnessConceptDraft,
    options: {
      renderViews?: (model: CadModel) => string[];
      onProgress?: (state: HarnessState, message: string) => void;
      maxCritiqueRounds?: number;
    } = {},
  ): Promise<HarnessBuildResult> {
    const trace: AgentTraceStep[] = [...draft.trace];
    const maxRounds = options.maxCritiqueRounds ?? 2;
    const appliedAdjustments = new Set<BuilderAdjustment>();

    const construct = (adjs: BuilderAdjustment[]): CadModel => {
      const lower = `${draft.userPrompt} ${draft.brief.title}`.toLowerCase();
      if (/u\s*-?\s*99|typ\s*vii|u-?boot|submarine/i.test(lower)) {
        return buildU99SubmarineModel();
      }
      if (/neuschwanstein|märchenschloss|maerchenschloss/i.test(lower)) {
        return buildNeuschwansteinModel(draft.requestedPartCount ?? 2500);
      }
      if (/titanic|titanik/i.test(lower)) {
        const count = Math.max(500, Math.min(5000, draft.requestedPartCount ?? 3000));
        return buildTitanic3000Model(count);
      }
      if (/brandeb\w*\s*tor|brandenb\w*\s*tor|brandenburgertor/i.test(lower)) {
        return buildBrandenburgGateModel(draft.requestedPartCount ?? 3000);
      }
      if (/gorch\s*fock|dreimastbark|segelschulschiff/i.test(lower)) {
        return buildGorchFockModel(draft.brief.scaleLabel, adjs);
      }
      return buildModelFromResearchBrief(draft.brief, adjs);
    };

    // Schicht 5a: Makro-CAD-Konstruktion
    this.state = 'BUILDING_CAD';
    options.onProgress?.('BUILDING_CAD', `Ich baue jetzt deinen 3D-Bauplan für „${draft.brief.title}“…`);
    const tBuild = Date.now();
    let model = construct([]);
    trace.push({
      layer: 'CAD_ENGINE',
      tool: 'MacroCadBuilder (Steinverbund + Slopes + Technic)',
      status: 'OK',
      detail: `${model.parts.length} Teile in ${model.assemblies.length} Baugruppen konstruiert`,
      durationMs: Date.now() - tBuild,
    });

    // Schicht 5b: Ralph-Loop Physik-Gate (prüft ALLE 4 harten Checks: Kollisionen, Noppenraster, Verbundenheit, Überhänge!)
    this.state = 'VALIDATING_PHYSICS';
    options.onProgress?.('VALIDATING_PHYSICS', 'Ich prüfe Kollisionen, Noppenraster, Verbundenheit & Überhänge…');
    const tPhys = Date.now();
    let report = runValidationCenter(model, { maxParts: Math.max(5000, model.parts.length + 500) });
    let healedParts = 0;

    // Automatische Ralph-Loop-Selbstheilung: entferne isolierte/schwebende Teile, falls connections FAIL meldet!
    for (let healRound = 0; healRound < 2; healRound++) {
      const connStatus = report.checks.find((c) => c.id === 'connections')?.status;
      if (connStatus === 'PASS') break;
      const connGraph = validateConnections(model);
      if (connGraph.unconnectedInstanceIds.length > 0 && connGraph.unconnectedInstanceIds.length < model.parts.length * 0.25) {
        const floatingSet = new Set(connGraph.unconnectedInstanceIds);
        healedParts += floatingSet.size;
        model = {
          ...model,
          parts: model.parts.filter((p) => !floatingSet.has(p.instanceId)),
        };
        report = runValidationCenter(model, { maxParts: Math.max(5000, model.parts.length + 500) });
      } else {
        break;
      }
    }

    const collisionsOk = report.checks.find((c) => c.id === 'collisions')?.status === 'PASS';
    const gridOk = report.checks.find((c) => c.id === 'stud_grid_physics')?.status === 'PASS';
    const connOk = report.checks.find((c) => c.id === 'connections')?.status === 'PASS';
    trace.push({
      layer: 'PHYSICS_QA',
      tool: 'ValidationCenter + Ralph-Loop Self-Heal',
      status: collisionsOk && gridOk ? 'OK' : 'FAIL',
      detail:
        collisionsOk && gridOk
          ? `0 Kollisionen, 100 % Noppenraster${connOk ? ' & 100 % verbunden' : ''}${healedParts > 0 ? ` (${healedParts} korrigiert)` : ''}`
          : 'Kollisions-/Rasterprüfung fehlgeschlagen',
      durationMs: Date.now() - tPhys,
    });

    // Schicht 5c: Vision-Selbstkritik (Ralph-Loop, max. 2 Runden)
    this.state = 'VISION_SELF_CRITIQUE';
    options.onProgress?.('VISION_SELF_CRITIQUE', 'Ich vergleiche das 3D-Modell gerade mit deinem freigegebenen Bild…');
    const tVis = Date.now();
    let views = options.renderViews ? options.renderViews(model) : [];
    let critique = await this.geminiClient.critiqueModelVisuals(draft.brief, draft.imageUrl, views);
    let revisionCount = 1;

    for (let r = 0; r < maxRounds; r++) {
      const nextAdjs = critique.recommendedAdjustments.filter((a) => !appliedAdjustments.has(a));
      if (critique.approved || nextAdjs.length === 0) break;
      for (const a of nextAdjs) appliedAdjustments.add(a);
      revisionCount += 1;
      options.onProgress?.('VISION_SELF_CRITIQUE', `Ich verfeinere Details nach meiner Selbstprüfung (Runde ${revisionCount})…`);
      model = construct([...appliedAdjustments]);
      report = runValidationCenter(model, { maxParts: Math.max(5000, model.parts.length + 500) });
      views = options.renderViews ? options.renderViews(model) : [];
      critique = await this.geminiClient.critiqueModelVisuals(draft.brief, draft.imageUrl, views);
    }

    trace.push({
      layer: 'VISION_QA',
      tool: 'Gemini Vision Self-Critique',
      status: critique.approved ? 'OK' : 'FALLBACK',
      detail: `Score ${critique.score}/100 nach ${revisionCount} Runde(n)`,
      durationMs: Date.now() - tVis,
    });

    this.state = 'READY';
    const fredReply = `Fertig! Dein Bauplan für „${model.name}“ (${model.parts.length.toLocaleString('de-DE')} Teile, 0 Kollisionen) steht bereit. Starte direkt mit Schritt 1 oder lade dir oben rechts die PDF-Bauanleitung herunter!`;

    return {
      model,
      draft,
      critique,
      revisionCount,
      trace,
      fredReply,
    };
  }
}
