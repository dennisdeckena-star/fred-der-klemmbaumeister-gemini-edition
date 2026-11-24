import { CadModel } from '../cad';
import { BomReport, InstructionStep } from '../pdf/pdfExporter';
import { runValidationCenter } from '../validation/validationCenter';

export type FredUiAction =
  | { type: 'BUILD_TITANIC'; partCount: number }
  | { type: 'BUILD_GORCH_FOCK'; scaleLabel: string }
  | { type: 'BUILD_CUSTOM_MODEL'; title: string; prompt: string }
  | { type: 'SELECT_MODEL'; modelId: string }
  | { type: 'OPEN_CONCEPT_STUDIO'; prompt?: string }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; step: number }
  | { type: 'TOGGLE_EXPLOSION'; value?: boolean }
  | { type: 'OPEN_INSPECTOR' }
  | { type: 'EXPORT_PDF' };

export interface FredAgentContext {
  activeModel: CadModel;
  currentStep: number;
  totalSteps: number;
  steps: InstructionStep[];
  bom: BomReport;
  availableModels: CadModel[];
  pendingFollowUp?: FredUiAction | null;
}

export interface FredAgentDecision {
  replyText: string;
  imageUrl?: string;
  imageBadge?: string;
  action?: FredUiAction;
  nextPendingFollowUp?: FredUiAction | null;
  handledDirectly: boolean;
}

function extractRequestedTitle(raw: string): string {
  const cleaned = raw
    .replace(/^(hallo|hi|hey|moin)\s*(fred)?[,!\s]*/i, '')
    .replace(/^(ich\s+)?(würde\s+gerne|möchte|will|kannst\s+du|bau\s+mir|baue\s+mir|erstelle\s+mir)\s+/i, '')
    .replace(/^(die|der|das|eine|einen|ein)\s+/i, '')
    .replace(/\s+(bauen|erstellen|konstruieren|machen)[!.\s]*$/i, '')
    .trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 60) : raw.trim().slice(0, 60);
}

export function resolveFredAgentTurn(
  userText: string,
  ctx: FredAgentContext,
): FredAgentDecision {
  const raw = userText.trim();
  const lower = raw.toLowerCase();

  // 1. Confirmation ("ok", "ja", "passt", "freigeben", "bauen", "los") -> execute pending proposal!
  if (/^(ok|okay|ja|jup|klar|gerne|los|mach das|weiter|passt|freigeben|bauen|starten)[!.\s]*$/i.test(raw)) {
    if (ctx.pendingFollowUp) {
      const act = ctx.pendingFollowUp;
      if (act.type === 'BUILD_TITANIC') {
        return {
          handledDirectly: true,
          action: act,
          nextPendingFollowUp: { type: 'GO_TO_STEP', step: 1 },
          replyText: `Freigegeben! Deine RMS Titanic (${act.partCount.toLocaleString('de-DE')} Teile) ist jetzt in 3D gebaut. Schreib „ok“ für Schritt 1.`,
        };
      }
      if (act.type === 'BUILD_GORCH_FOCK') {
        return {
          handledDirectly: true,
          action: act,
          nextPendingFollowUp: { type: 'GO_TO_STEP', step: 1 },
          replyText: `Freigegeben! Deine Gorch Fock (${act.scaleLabel}) steht jetzt in 3D bereit (weißer Rumpf, 3 Masten, Segel). Schreib „ok“ für Schritt 1.`,
        };
      }
      if (act.type === 'BUILD_CUSTOM_MODEL') {
        return {
          handledDirectly: true,
          action: act,
          nextPendingFollowUp: { type: 'GO_TO_STEP', step: 1 },
          replyText: `Freigegeben! „${act.title}“ ist jetzt in 3D gebaut und in deiner Bibliothek gespeichert. Schreib „ok“ für Schritt 1.`,
        };
      }
      if (act.type === 'EXPORT_PDF') {
        return {
          handledDirectly: true,
          action: act,
          nextPendingFollowUp: null,
          replyText: 'BlueBrixx-Stil PDF wird erstellt und links in der Bibliothek gespeichert.',
        };
      }
      if (act.type === 'GO_TO_STEP') {
        return {
          handledDirectly: true,
          action: act,
          nextPendingFollowUp: { type: 'NEXT_STEP' },
          replyText: `Schritt ${act.step} von ${ctx.totalSteps} ist offen. Die neuen Teile sind rot markiert.`,
        };
      }
      if (act.type === 'NEXT_STEP') {
        const nextStep = Math.min(ctx.totalSteps, ctx.currentStep + 1);
        return {
          handledDirectly: true,
          action: { type: 'NEXT_STEP' },
          nextPendingFollowUp: nextStep < ctx.totalSteps ? { type: 'NEXT_STEP' } : { type: 'EXPORT_PDF' },
          replyText:
            nextStep > ctx.currentStep
              ? `Schritt ${nextStep} von ${ctx.totalSteps}.`
              : `Fertig! Soll ich das PDF erstellen?`,
        };
      }
    }
    return {
      handledDirectly: true,
      nextPendingFollowUp: null,
      replyText: 'Alles klar! Schreib mir einfach den Namen des Modells, das wir bauen sollen.',
    };
  }

  // 2. Pure Greeting OR General Question ("was kannst du für mich tun?", "hilfe", "welche bauteile hast du?")
  // NEVER build a 3D brick block when the user is just asking a question!
  if (/^(hallo|hi|hey|moin|servus|guten\s+(morgen|tag|abend))(\s+fred)?[!.,\s]*$/i.test(raw)) {
    return {
      handledDirectly: true,
      nextPendingFollowUp: null,
      replyText: 'Hallo! Schön, dass du da bist – was wollen wir heute Tolles bauen?',
    };
  }
  const hasBuildVerb = /\b(bau|baue|bauen|erstell|konstruier|mach\s+mir|vorschaubild|teile|maßstab|1\s*:\s*\d+)\b/i.test(lower);
  if (
    !hasBuildVerb &&
    (/was\s+kannst\s+du|wer\s+bist\s+du|wie\s+funktionier|hilfe|was\s+machst\s+du|welche\s+(bauteile|teile|steine)\s+hast\s+du/i.test(lower) ||
      (raw.endsWith('?') && raw.length < 80))
  ) {
    return {
      handledDirectly: true,
      nextPendingFollowUp: null,
      replyText:
        'Ich bin Fred, dein Klemmbaustein-Ingenieur! Nenn mir einfach dein Wunschmotiv (z. B. „Krusenstern 4-Master“, „Schloss Neuschwanstein“ oder „Brandenburger Tor“) – ich recherchiere die Maße, erzeuge per Nano Banana dein fotorealistisches Vorschaubild und baue nach deinem grünen Daumen den 3D-Bauplan inkl. PDF!',
    };
  }

  // 3. Gorch Fock / Großsegler (Krusenstern, Fünfmaster, Viermaster, Dreimastbark) -> Pipeline!
  if (/gorch\s*fock|krusenstern|preußen|preussen|fünf\s*master|fuenf\s*master|vier\s*master|dreimastbark|segelschulschiff|großsegler|grosssegler/i.test(lower)) {
    const scaleMatch = raw.match(/1\s*:\s*(\d{2,4})/);
    const scaleLabel = scaleMatch ? `1:${scaleMatch[1]}` : '1:300';
    return {
      handledDirectly: true,
      imageUrl: './concepts/gorch-fock-concept.png',
      imageBadge: `Nano Banana Vorschau (${scaleLabel}) • EU AI Act Art. 50`,
      action: { type: 'BUILD_GORCH_FOCK', scaleLabel },
      nextPendingFollowUp: { type: 'GO_TO_STEP', step: 1 },
      replyText: `Oh, ein Großsegler (${scaleLabel}) – was für ein wunderschönes Projekt! Ich starte sofort Research & Nano Banana Vorschau für dich.`,
    };
  }

  // 4. Titanic -> IMMEDIATELY show photorealistic preview AND start building 3D model!
  if (lower.includes('titanic') || lower.includes('titanik')) {
    const numMatch = raw.match(/(\d{3,5})/);
    const requestedParts = numMatch ? Math.max(500, Math.min(5000, Number(numMatch[1]))) : 3000;
    return {
      handledDirectly: true,
      imageUrl: './concepts/titanic-concept.png',
      imageBadge: 'Konzeptvorschau RMS Titanic • EU AI Act Art. 50',
      action: { type: 'BUILD_TITANIC', partCount: requestedParts },
      nextPendingFollowUp: { type: 'GO_TO_STEP', step: 1 },
      replyText: `Was für ein großartiges Projekt! Ich habe dir das Vorschaubild für deine RMS Titanic (${requestedParts.toLocaleString('de-DE')} Teile) erstellt und sie direkt im 3D-Studio aufgebaut. Sag einfach „ok“ für Schritt 1!`,
    };
  }

  // 5. Built-in starter models (STRICT word boundaries so "Brandenburger Tor" NEVER triggers "Burg"!)
  const wantsCustomScaleOrPreview =
    /\b(\d{3,5})\s*(teile|steine|bricks?)\b/i.test(lower) ||
    /vorschaubild|bild|foto|brandenburg|hamburg|augsburg|freiburg|regensburg|wartburg|neuschwanstein|1\s*:\s*\d+/i.test(lower);

  if (!wantsCustomScaleOrPreview && /\b(burg|ritterburg)\b/i.test(lower)) {
    return {
      handledDirectly: true,
      action: { type: 'SELECT_MODEL', modelId: 'model-castle' },
      nextPendingFollowUp: { type: 'GO_TO_STEP', step: 1 },
      replyText: 'Super Wahl! Ich habe dir die Burg direkt ins 3D-Studio gestellt – schreib „ok“ für Schritt 1!',
    };
  }
  if (!wantsCustomScaleOrPreview && /\b(rover|weltraum-rover)\b/i.test(lower)) {
    return {
      handledDirectly: true,
      action: { type: 'SELECT_MODEL', modelId: 'model-space-rover' },
      nextPendingFollowUp: { type: 'GO_TO_STEP', step: 1 },
      replyText: 'Klasse Idee! Dein Weltraum-Rover steht schon im 3D-Studio bereit – schreib „ok“ für Schritt 1!',
    };
  }
  if (!wantsCustomScaleOrPreview && /\b(flugzeug|flieger)\b/i.test(lower)) {
    return {
      handledDirectly: true,
      action: { type: 'SELECT_MODEL', modelId: 'model-airplane' },
      nextPendingFollowUp: { type: 'GO_TO_STEP', step: 1 },
      replyText: 'Auf in die Lüfte! Ich habe das Flugzeug direkt für dich geladen – schreib „ok“ für Schritt 1!',
    };
  }
  if (!wantsCustomScaleOrPreview && /\b(piratenschiff)\b/i.test(lower)) {
    return {
      handledDirectly: true,
      action: { type: 'SELECT_MODEL', modelId: 'model-pirate-ship' },
      nextPendingFollowUp: { type: 'GO_TO_STEP', step: 1 },
      replyText: 'Ahoi! Dein Piratenschiff steht schon bereit – schreib einfach „ok“ für Schritt 1!',
    };
  }

  // 6. Controls: Explosion, Steps, Validation, PDF
  if (lower.includes('explosion') || lower.includes('auseinander')) {
    return {
      handledDirectly: true,
      action: { type: 'TOGGLE_EXPLOSION' },
      nextPendingFollowUp: null,
      replyText: 'Schon erledigt – ich habe die Explosionsansicht für dich umgeschaltet!',
    };
  }
  const stepJump = lower.match(/schritt\s+(\d+)/);
  if (stepJump) {
    const target = Math.max(1, Math.min(ctx.totalSteps, Number(stepJump[1])));
    return {
      handledDirectly: true,
      action: { type: 'GO_TO_STEP', step: target },
      nextPendingFollowUp: { type: 'NEXT_STEP' },
      replyText: `Gerne! Hier ist Schritt ${target} von ${ctx.totalSteps} – die neuen Steine sind rot markiert.`,
    };
  }
  if (lower.includes('nächst') || lower.includes('naechst') || lower.includes('welche steine')) {
    const info = ctx.steps[ctx.currentStep - 1];
    const partsTxt = info
      ? info.calloutParts.slice(0, 3).map((p) => `${p.quantity}x ${p.colorName} ${p.name}`).join(', ')
      : 'die rot markierten Teile';
    return {
      handledDirectly: true,
      action: lower.includes('welche steine') ? undefined : { type: 'NEXT_STEP' },
      nextPendingFollowUp: { type: 'NEXT_STEP' },
      replyText: `Du machst das super! Als Nächstes brauchst du: ${partsTxt}. Ich habe sie dir rot markiert!`,
    };
  }
  if (lower.includes('zurück') || lower.includes('zurueck') || lower.includes('vorherig')) {
    return {
      handledDirectly: true,
      action: { type: 'PREV_STEP' },
      nextPendingFollowUp: null,
      replyText: `Kein Problem! Wir sind wieder bei Schritt ${Math.max(1, ctx.currentStep - 1)} von ${ctx.totalSteps}.`,
    };
  }
  if (lower.includes('prüf') || lower.includes('pruef') || lower.includes('validier') || lower.includes('kollision') || lower.includes('physik')) {
    const report = runValidationCenter(ctx.activeModel);
    const failed = report.checks.filter((c) => c.status === 'FAIL');
    return {
      handledDirectly: true,
      action: { type: 'OPEN_INSPECTOR' },
      nextPendingFollowUp: null,
      replyText:
        failed.length === 0
          ? 'Alles tipptopp! 0 Kollisionen und 100 % sauber im 20-LDU-Noppenraster!'
          : `Ich habe ${failed.length} kleine Stelle(n) entdeckt und dir das Prüfzentrum geöffnet – das kriegen wir sofort hin!`,
    };
  }
  if (lower.includes('pdf') || lower.includes('anleitung') || lower.includes('download')) {
    return {
      handledDirectly: true,
      action: { type: 'EXPORT_PDF' },
      nextPendingFollowUp: null,
      replyText: 'Sehr gerne! Ich erstelle dir sofort deine PDF-Bauanleitung und lege sie links in deiner Bibliothek ab!',
    };
  }

  // 7. UNIVERSAL BUILD-REQUEST HANDLER: ANY other model request -> IMMEDIATELY start building, warm & motivating, NEVER ask technical setup questions!
  const title = extractRequestedTitle(raw);
  return {
    handledDirectly: true,
    action: { type: 'BUILD_CUSTOM_MODEL', title, prompt: raw },
    nextPendingFollowUp: { type: 'GO_TO_STEP', step: 1 },
    replyText: `Was für eine tolle Idee – „${title}“ bauen wir sehr gerne! Ich habe direkt losgelegt und dir den 3D-Entwurf schon ins Studio gestellt. Sag mir einfach, was wir noch verfeinern sollen, oder schreib „ok“ für Schritt 1!`,
  };
}
