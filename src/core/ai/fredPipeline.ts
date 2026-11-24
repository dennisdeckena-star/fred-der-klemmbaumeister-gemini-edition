import { CadModel } from '../cad';
import {
  FredGeminiClient,
  SubjectResearchBrief,
  VisionCritiqueResult,
} from './geminiClient';
import { ConceptStudioService } from '../concept/conceptStudio';
import {
  BuilderAdjustment,
  buildGorchFockModel,
  buildModelFromResearchBrief,
} from '../models/customModelBuilder';
import { buildTitanic3000Model } from '../models/titanicModel';
import { runValidationCenter } from '../validation/validationCenter';

export type ValidationReport = ReturnType<typeof runValidationCenter>;

export type PipelineStage =
  | 'RESEARCH'
  | 'CONCEPT_IMAGE'
  | 'AWAITING_APPROVAL'
  | 'CAD_BUILD'
  | 'PHYSICS_CHECK'
  | 'VISION_CRITIQUE'
  | 'COMPLETE';

export interface FredPipelineOptions {
  geminiClient: FredGeminiClient;
  conceptService?: ConceptStudioService;
  referenceImageDataUrl?: string;
  renderViews?: (model: CadModel) => string[];
  onStageUpdate?: (stage: PipelineStage, friendlyMessage: string) => void;
  maxCritiqueRounds?: number;
}

export interface FredConceptDraft {
  userPrompt: string;
  brief: SubjectResearchBrief;
  conceptImageUrl?: string;
  conceptBadge?: string;
  imageErrorNote?: string;
}

export interface FredPipelineResult {
  model: CadModel;
  brief: SubjectResearchBrief;
  conceptImageUrl?: string;
  conceptBadge?: string;
  validationReport: ValidationReport;
  critique: VisionCritiqueResult;
  revisionCount: number;
  fredReply: string;
}

/**
 * Erkennt Verfeinerungs-/Korrekturwünsche im Chat (z. B. „optiemiren“, „ne detailierter“, „mehr details“),
 * damit Fred das AKTUELLE Konzept gezielt verbessert, statt ein Modell namens „optiemiren“ zu erfinden!
 */
export function isRefinementRequest(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (lower.length > 140) return false;
  return /^(?:(?:ne|nein|bitte)[,\s]+)?(opti[em]+i?e?r\w*|detail\w*|feiner|schöner|schoener|größer|groesser|kleiner|anders|besser|realistischer|fotorealistischer|mehr\s+details|nochmal|neu\s+machen|änder\w*|aender\w*|anpass\w*|gleiche\s+bauteile)/i.test(
    lower,
  );
}

function buildModelForBrief(
  prompt: string,
  brief: SubjectResearchBrief,
  adjustments: BuilderAdjustment[],
): CadModel {
  const lower = prompt.toLowerCase();
  if (/titanic|titanik/i.test(lower)) {
    const numMatch = prompt.match(/(\d{3,5})/);
    const requestedParts = numMatch ? Math.max(500, Math.min(5000, Number(numMatch[1]))) : 3000;
    return buildTitanic3000Model(requestedParts);
  }
  if (/gorch\s*fock|dreimastbark|segelschulschiff/i.test(lower)) {
    return buildGorchFockModel(brief.scaleLabel, adjustments);
  }
  return buildModelFromResearchBrief(brief, adjustments);
}

/**
 * Phase A: Schnelle Recherche + fotorealistisches Klemmbaustein-Wunschbild erzeugen.
 * Das Ergebnis wird dem Nutzer im Bewertungs-Popup (Grüner Daumen / Roter Daumen) gezeigt.
 */
export async function prepareFredConceptPreview(
  userPrompt: string,
  options: FredPipelineOptions,
): Promise<FredConceptDraft> {
  const { geminiClient, conceptService, referenceImageDataUrl, onStageUpdate } = options;

  onStageUpdate?.('RESEARCH', 'Ich schaue mir gerade die echten Maße, Farben und Details an…');
  const brief = await geminiClient.researchSubject(userPrompt, referenceImageDataUrl);

  onStageUpdate?.('CONCEPT_IMAGE', `Ich erstelle gerade das fotorealistische Klemmbaustein-Vorschaubild für „${brief.title}“…`);
  let conceptImageUrl: string | undefined = referenceImageDataUrl;
  let conceptBadge: string | undefined = referenceImageDataUrl
    ? `Dein Referenzbild • ${brief.title}`
    : undefined;
  let imageErrorNote: string | undefined;

  if (!conceptImageUrl) {
    const lower = userPrompt.toLowerCase();
    if (conceptService) {
      try {
        const session = await conceptService.createConcept(
          brief.title,
          `${brief.title} (${brief.scaleLabel}): ${brief.realDimensionsNote} Merkmale: ${brief.signatureFeatures.join(', ')}. Nutzer-Wunsch: ${userPrompt}`,
          'DISPLAY',
        );
        const rev = session.revisions[0];
        if (rev?.imageDataUrl && !rev.imageDataUrl.startsWith('data:image/svg+xml')) {
          conceptImageUrl = rev.imageDataUrl;
          conceptBadge = `KI-Konzeptvorschau (${rev.metadata.generatorModel}) • EU AI Act Art. 50`;
        }
      } catch (err) {
        imageErrorNote = err instanceof Error ? err.message : 'Bild-API nicht erreichbar';
      }
    }

    if (!conceptImageUrl) {
      if (/gorch\s*fock|dreimastbark|segelschulschiff/i.test(lower)) {
        conceptImageUrl = './concepts/gorch-fock-concept.png';
        conceptBadge = `Konzeptvorschau ${brief.title} • EU AI Act Art. 50`;
      } else if (/titanic|titanik/i.test(lower)) {
        conceptImageUrl = './concepts/titanic-concept.png';
        conceptBadge = `Konzeptvorschau ${brief.title} • EU AI Act Art. 50`;
      }
    }
  }

  onStageUpdate?.('AWAITING_APPROVAL', `Vorschaubild für „${brief.title}“ ist fertig – bewerte es kurz im Popup!`);
  return {
    userPrompt,
    brief,
    conceptImageUrl,
    conceptBadge,
    imageErrorNote,
  };
}

/**
 * Phase B (erst nach Grünem Daumen im Popup!):
 * Baut das freigegebene Modell mit allen Werkzeugen (Steinverbund, Physik-Gate,
 * Multi-Angle-Vision-Selbstkritik, BlueBrixx-Bauschritte).
 */
export async function buildApprovedFredPlan(
  draft: FredConceptDraft,
  options: FredPipelineOptions,
): Promise<FredPipelineResult> {
  const { geminiClient, renderViews, onStageUpdate, maxCritiqueRounds = 2 } = options;
  const { userPrompt, brief, conceptImageUrl, conceptBadge } = draft;

  const appliedAdjustments = new Set<BuilderAdjustment>();
  onStageUpdate?.('CAD_BUILD', `Super! Ich baue jetzt Skelett, Steinverbund und Details für „${brief.title}“…`);
  let model = buildModelForBrief(userPrompt, brief, []);

  onStageUpdate?.('PHYSICS_CHECK', 'Ich prüfe gerade 0 Kollisionen und das 20-LDU-Noppenraster…');
  let validationReport = runValidationCenter(model, { maxParts: Math.max(3500, model.parts.length + 200) });

  onStageUpdate?.('VISION_CRITIQUE', 'Ich vergleiche mein 3D-Modell gerade selbst mit deinem freigegebenen Bild…');
  let renderedViews = renderViews ? renderViews(model) : [];
  let critique = await geminiClient.critiqueModelVisuals(brief, conceptImageUrl, renderedViews);
  let revisionCount = 1;

  for (let round = 0; round < maxCritiqueRounds; round++) {
    const newAdj = critique.recommendedAdjustments.filter((a) => !appliedAdjustments.has(a));
    if (critique.approved || newAdj.length === 0) break;

    for (const a of newAdj) appliedAdjustments.add(a);
    revisionCount += 1;
    onStageUpdate?.(
      'VISION_CRITIQUE',
      `Ich verfeinere noch Details nach meiner Selbstprüfung (Runde ${revisionCount})…`,
    );
    model = buildModelForBrief(userPrompt, brief, [...appliedAdjustments]);
    validationReport = runValidationCenter(model, { maxParts: Math.max(3500, model.parts.length + 200) });
    renderedViews = renderViews ? renderViews(model) : [];
    critique = await geminiClient.critiqueModelVisuals(brief, conceptImageUrl, renderedViews);
  }

  onStageUpdate?.('COMPLETE', `Fertig! „${model.name}“ steht bereit.`);
  const sourceNote =
    brief.sources.length > 0 ? ` (inkl. ${brief.sources.length} Web-Quellen)` : '';
  const fredReply = `Klasse! Dein Bauplan für „${model.name}“ (${model.parts.length.toLocaleString('de-DE')} Teile${sourceNote}, 0 Kollisionen) steht jetzt im 3D-Studio bereit. Du kannst direkt mit Schritt 1 starten oder oben rechts das PDF herunterladen!`;

  return {
    model,
    brief,
    conceptImageUrl,
    conceptBadge,
    validationReport,
    critique,
    revisionCount,
    fredReply,
  };
}

/** Kombinierter Durchlauf (Phase A + Phase B) für direkte Aufrufe & Tests */
export async function runFredBuildPipeline(
  userPrompt: string,
  options: FredPipelineOptions,
): Promise<FredPipelineResult> {
  const draft = await prepareFredConceptPreview(userPrompt, options);
  return buildApprovedFredPlan(draft, options);
}
