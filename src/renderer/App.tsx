import React, { useEffect, useMemo, useState } from 'react';
import { CadModel } from '../core/cad';
import { getStarterBlueprints } from '../core/models/sampleModels';
import { computeBom, generateStepsForModel } from '../core/cad/bomAndSteps';
import { generateInstructionPdf } from '../core/pdf/pdfExporter';
import {
  renderModelStepSnapshots,
  renderMultiAngleReview,
} from './three/offscreenSnapshotRenderer';
import { FredGeminiClient } from '../core/ai/geminiClient';
import { FredUiAction, resolveFredAgentTurn } from '../core/ai/fredAgentActions';
import { runFredBuildPipeline } from '../core/ai/fredPipeline';
import { buildProBuilderSystemPrompt } from '../../plugins/fred-pro-builder/scripts/snot_engineering_rules';
import { buildTitanic3000Model } from '../core/models/titanicModel';
import { buildCustomModelFromPrompt, buildGorchFockModel } from '../core/models/customModelBuilder';
import { ConceptStudioService } from '../core/concept/conceptStudio';
import { Header } from './components/Header';
import { BlueprintSidebar, SavedPdfMeta } from './components/BlueprintSidebar';
import { Viewport3D } from './components/Viewport3D';
import { FredChatPanel, UiChatMessage } from './components/FredChatPanel';
import { SetupWizard } from './components/SetupWizard';
import { ConceptStudioModal } from './components/ConceptStudioModal';
import { InspectorModal } from './components/InspectorModal';

const PROGRESS_STORAGE_KEY = 'fred_gemini_build_progress_v1';

interface SavedProgress {
  activeModelId?: string;
  stepByModel?: Record<string, number>;
  favorites?: Record<string, boolean>;
}

function loadSavedProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedProgress) : {};
  } catch {
    return {};
  }
}

export function App(): React.ReactElement {
  const initialProgress = useMemo(() => loadSavedProgress(), []);
  const [models, setModels] = useState<CadModel[]>(() => getStarterBlueprints());
  const [activeModelId, setActiveModelId] = useState<string>(
    () => initialProgress.activeModelId ?? getStarterBlueprints()[0].id,
  );
  const [favorites, setFavorites] = useState<Record<string, boolean>>(
    () =>
      initialProgress.favorites ?? {
        'model-pirate-ship': true,
        'model-castle': true,
      },
  );
  const [stepByModel, setStepByModel] = useState<Record<string, number>>(
    () => initialProgress.stepByModel ?? {},
  );
  const [savedPdfs, setSavedPdfs] = useState<Record<string, SavedPdfMeta>>({});
  const [exploded, setExploded] = useState(false);
  const [isolatedAssemblyId, setIsolatedAssemblyId] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [storageBackend, setStorageBackend] = useState(
    'Windows Credential Manager / Electron safeStorage',
  );
  const [showConceptStudio, setShowConceptStudio] = useState(false);
  const [showInspector, setShowInspector] = useState(false);

  const [geminiClient, setGeminiClient] = useState<FredGeminiClient>(
    () => new FredGeminiClient({ useOfflineAdapter: true }),
  );
  const [conceptStudio] = useState<ConceptStudioService>(
    () => new ConceptStudioService({ useOfflineAdapter: true }),
  );

  // First-Run API-Key Check via Electron safeStorage IPC
  useEffect(() => {
    const api = window.fredApi as
      | {
          getSecretStatus?: () => Promise<{ hasKey: boolean; backend: string }>;
          loadApiKey?: () => Promise<string | null>;
        }
      | undefined;

    if (!api?.getSecretStatus) return;
    void api.getSecretStatus().then(async (status) => {
      setStorageBackend(status.backend);
      if (!status.hasKey) {
        setShowSetupWizard(true);
      } else if (api.loadApiKey) {
        const key = await api.loadApiKey();
        if (key) {
          setGeminiClient(new FredGeminiClient({ apiKey: key, useOfflineAdapter: false }));
        }
      }
    });
  }, []);

  // Persist build progress automatically
  useEffect(() => {
    try {
      const payload: SavedProgress = { activeModelId, stepByModel, favorites };
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota issues
    }
  }, [activeModelId, stepByModel, favorites]);

  const [messages, setMessages] = useState<UiChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'fred',
      text: 'Hey! Brauchst du Hilfe beim Bauen? Frag mich einfach nach dem nächsten Schritt oder starte das Konzeptstudio!',
    },
  ]);
  const [sending, setSending] = useState(false);
  const [pendingFollowUp, setPendingFollowUp] = useState<FredUiAction | null>(null);

  const activeModel = useMemo(
    () => models.find((m) => m.id === activeModelId) ?? models[0],
    [models, activeModelId],
  );

  const steps = useMemo(() => generateStepsForModel(activeModel), [activeModel]);
  const totalSteps = Math.max(1, steps.length);
  const currentStep = Math.min(stepByModel[activeModel.id] ?? totalSteps, totalSteps);
  const bom = useMemo(() => computeBom(activeModel), [activeModel]);

  const setCurrentStep = (next: number) => {
    const clamped = Math.max(1, Math.min(totalSteps, next));
    setStepByModel((prev) => ({ ...prev, [activeModel.id]: clamped }));
  };

  const handleSelectModel = (id: string) => {
    setActiveModelId(id);
    setIsolatedAssemblyId(null);
    setExploded(false);
  };

  const handleExportPdf = async (targetModel: CadModel = activeModel) => {
    setExportingPdf(true);
    setStatusBanner(null);
    try {
      const targetSteps = generateStepsForModel(targetModel);
      const targetBom = computeBom(targetModel);
      const stepSnapshots = renderModelStepSnapshots(targetModel, targetSteps);
      const pdf = await generateInstructionPdf({
        model: targetModel,
        steps: targetSteps,
        bom: targetBom,
        stepSnapshots,
      });
      const blob = new Blob([new Uint8Array(pdf.bytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const fileName = `${targetModel.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Bauanleitung.pdf`;

      // Automatically save PDF entry into the blueprint library for instant re-download!
      setSavedPdfs((prev) => ({
        ...prev,
        [targetModel.id]: {
          modelId: targetModel.id,
          fileName,
          pageCount: pdf.pageCount,
          sha256: pdf.sha256,
          createdAt: new Date().toISOString(),
          objectUrl: url,
        },
      }));

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setStatusBanner(
        `BlueBrixx-Stil PDF erzeugt & in Bibliothek gespeichert (${pdf.pageCount} Seiten, SHA-256: ${pdf.sha256.slice(0, 10)}…).`,
      );
    } catch (err) {
      setStatusBanner(err instanceof Error ? err.message : 'PDF-Export fehlgeschlagen');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleDownloadSavedPdf = (modelId: string) => {
    const entry = savedPdfs[modelId];
    if (entry?.objectUrl) {
      const a = document.createElement('a');
      a.href = entry.objectUrl;
      a.download = entry.fileName;
      a.click();
      return;
    }
    const target = models.find((m) => m.id === modelId);
    if (target) {
      void handleExportPdf(target);
    }
  };

  const executeFredAction = (action: FredUiAction) => {
    switch (action.type) {
      case 'BUILD_TITANIC': {
        const titanic = buildTitanic3000Model(action.partCount);
        setModels((prev) => {
          const exists = prev.some((m) => m.id === titanic.id);
          return exists ? prev.map((m) => (m.id === titanic.id ? titanic : m)) : [titanic, ...prev];
        });
        setActiveModelId(titanic.id);
        setIsolatedAssemblyId(null);
        setExploded(false);
        setStatusBanner(
          `RMS Titanic (${titanic.parts.length.toLocaleString('de-DE')} Teile) geladen – 100 % im 20-LDU-Noppenraster.`,
        );
        break;
      }
      case 'BUILD_GORCH_FOCK': {
        const gf = buildGorchFockModel(action.scaleLabel);
        setModels((prev) => {
          const exists = prev.some((m) => m.id === gf.id);
          return exists ? prev.map((m) => (m.id === gf.id ? gf : m)) : [gf, ...prev];
        });
        setActiveModelId(gf.id);
        setIsolatedAssemblyId(null);
        setExploded(false);
        setStatusBanner(
          `Gorch Fock (${action.scaleLabel}, ${gf.parts.length} Teile) in 3D gebaut & in Bibliothek eingefügt.`,
        );
        break;
      }
      case 'BUILD_CUSTOM_MODEL': {
        const custom = buildCustomModelFromPrompt(action.title, action.prompt);
        setModels((prev) => [custom, ...prev]);
        setActiveModelId(custom.id);
        setIsolatedAssemblyId(null);
        setExploded(false);
        setStatusBanner(
          `Modell „${custom.name}“ (${custom.parts.length} Teile) in 3D gebaut & in Bibliothek eingefügt.`,
        );
        break;
      }
      case 'SELECT_MODEL':
        handleSelectModel(action.modelId);
        break;
      case 'OPEN_CONCEPT_STUDIO':
        setShowConceptStudio(true);
        break;
      case 'NEXT_STEP':
        setCurrentStep(currentStep + 1);
        break;
      case 'PREV_STEP':
        setCurrentStep(currentStep - 1);
        break;
      case 'GO_TO_STEP':
        setCurrentStep(action.step);
        break;
      case 'TOGGLE_EXPLOSION':
        setExploded((v) => (typeof action.value === 'boolean' ? action.value : !v));
        break;
      case 'OPEN_INSPECTOR':
        setShowInspector(true);
        break;
      case 'EXPORT_PDF':
        void handleExportPdf(activeModel);
        break;
    }
  };

  const handleSendMessage = async (text: string, referenceImageDataUrl?: string) => {
    const userMsg: UiChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      imageUrl: referenceImageDataUrl,
      imageBadge: referenceImageDataUrl ? 'Dein Referenzbild' : undefined,
    };
    const fredId = `f-${Date.now() + 1}`;
    setMessages((prev) => [...prev, userMsg, { id: fredId, sender: 'fred', text: 'Ich lege sofort los…' }]);
    setSending(true);

    try {
      // 1. Check deterministic Fred CAD/UI Agent actions first (works offline AND alongside Live Gemini!)
      const decision = resolveFredAgentTurn(text, {
        activeModel,
        currentStep,
        totalSteps,
        steps,
        bom,
        availableModels: models,
        pendingFollowUp,
      });

      const isPipelineBuild =
        Boolean(referenceImageDataUrl) ||
        decision.action?.type === 'BUILD_GORCH_FOCK' ||
        decision.action?.type === 'BUILD_TITANIC' ||
        decision.action?.type === 'BUILD_CUSTOM_MODEL';

      if (isPipelineBuild) {
        const result = await runFredBuildPipeline(text, {
          geminiClient,
          conceptService: conceptStudio,
          referenceImageDataUrl,
          renderViews: (modelToRender) => renderMultiAngleReview(modelToRender, 512, 340),
          onStageUpdate: (_stage, friendlyMessage) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === fredId ? { ...m, text: friendlyMessage } : m)),
            );
          },
        });

        setModels((prev) => {
          const exists = prev.some((m) => m.id === result.model.id);
          return exists
            ? prev.map((m) => (m.id === result.model.id ? result.model : m))
            : [result.model, ...prev];
        });
        setActiveModelId(result.model.id);
        setIsolatedAssemblyId(null);
        setExploded(false);
        setPendingFollowUp({ type: 'GO_TO_STEP', step: 1 });
        setStatusBanner(
          `${result.model.name} (${result.model.parts.length.toLocaleString('de-DE')} Teile, 0 Kollisionen) über die Fred-Pro-Pipeline gebaut & gespeichert.`,
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === fredId
              ? {
                  ...m,
                  text: result.fredReply,
                  imageUrl: result.conceptImageUrl ?? decision.imageUrl,
                  imageBadge: result.conceptBadge ?? decision.imageBadge,
                }
              : m,
          ),
        );
        return;
      }

      if (decision.handledDirectly) {
        if (decision.action) {
          executeFredAction(decision.action);
        }
        setPendingFollowUp(decision.nextPendingFollowUp ?? null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === fredId
              ? {
                  ...m,
                  text: decision.replyText,
                  imageUrl: decision.imageUrl,
                  imageBadge: decision.imageBadge,
                }
              : m,
          ),
        );
        return;
      }

      const stepInfo = steps[currentStep - 1];
      const stepSummary = stepInfo
        ? `Aktuelles Modell: ${activeModel.name}, Schritt ${currentStep} von ${totalSteps}, benötigte Teile: ${stepInfo.calloutParts
            .map((p) => `${p.quantity}x ${p.colorName} ${p.name}`)
            .join(', ')}.`
        : '';

      await geminiClient.streamChat(
        [
          {
            role: 'system',
            text: `${buildProBuilderSystemPrompt()}\nAntworte kurz und präzise auf Deutsch. ${stepSummary}`,
          },
          { role: 'user', text },
        ],
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === fredId ? { ...m, text: m.text + chunk } : m)),
          );
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fehler bei der KI-Antwort';
      setMessages((prev) =>
        prev.map((m) => (m.id === fredId ? { ...m, text: `Hinweis: ${msg}` } : m)),
      );
    } finally {
      setSending(false);
    }
  };

  const usage = geminiClient.getUsage();

  return (
    <div className="fred-shell">
      <Header
        onExportPdf={() => void handleExportPdf(activeModel)}
        exportingPdf={exportingPdf}
        onOpenConceptStudio={() => setShowConceptStudio(true)}
        onOpenInspector={() => setShowInspector((v) => !v)}
        onOpenSetupWizard={() => setShowSetupWizard(true)}
      />

      {statusBanner && (
        <div className="status-toast" role="status">
          <span>{statusBanner}</span>
          <button type="button" onClick={() => setStatusBanner(null)}>
            OK
          </button>
        </div>
      )}

      <main className="fred-three-col">
        <BlueprintSidebar
          models={models}
          activeModelId={activeModel.id}
          favorites={favorites}
          savedPdfs={savedPdfs}
          onSelectModel={handleSelectModel}
          onToggleFavorite={(id) =>
            setFavorites((prev) => ({ ...prev, [id]: !prev[id] }))
          }
          onDownloadSavedPdf={handleDownloadSavedPdf}
        />

        <Viewport3D
          model={activeModel}
          currentStep={currentStep}
          totalSteps={totalSteps}
          exploded={exploded}
          isolatedAssemblyId={isolatedAssemblyId}
          onPrevStep={() => setCurrentStep(currentStep - 1)}
          onNextStep={() => setCurrentStep(currentStep + 1)}
          onToggleExploded={() => setExploded((v) => !v)}
          onSelectAssembly={setIsolatedAssemblyId}
        />

        <FredChatPanel
          messages={messages}
          adapterLabel={
            usage.adapterMode === 'LIVE_GOOGLE_GENAI'
              ? `Gemini (${usage.model})`
              : usage.adapterMode === 'FRED_CLOUD_PROXY'
                ? `Fred Cloud (${usage.model})`
                : 'Offline-Modus'
          }
          sending={sending}
          onSendMessage={handleSendMessage}
        />
      </main>

      <InspectorModal
        isOpen={showInspector}
        model={activeModel}
        bom={bom}
        steps={steps}
        currentStep={currentStep}
        onJumpToStep={(step) => setCurrentStep(step)}
        onExportUserData={() => {
          const data = JSON.stringify(
            { exportedAt: new Date().toISOString(), activeModelId, stepByModel, favorites, models },
            null,
            2,
          );
          const blob = new Blob([data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'fred-lokale-daten-export.json';
          a.click();
          URL.revokeObjectURL(url);
          setStatusBanner('Lokale Nutzerdaten als JSON exportiert (DSGVO Art. 20).');
        }}
        onDeleteAllUserData={async () => {
          localStorage.removeItem(PROGRESS_STORAGE_KEY);
          const api = window.fredApi as { deleteApiKey?: () => Promise<boolean> } | undefined;
          await api?.deleteApiKey?.();
          setStepByModel({});
          setFavorites({});
          setGeminiClient(new FredGeminiClient({ useOfflineAdapter: true }));
          setShowInspector(false);
          setStatusBanner('Alle lokalen Fortschrittsdaten und gespeicherte API-Keys wurden gelöscht (DSGVO Art. 17).');
        }}
        onClose={() => setShowInspector(false)}
      />

      <SetupWizard
        isOpen={showSetupWizard}
        storageBackend={storageBackend}
        onClose={() => setShowSetupWizard(false)}
        onUseCloudProxy={(proxyUrl, accessToken, model) => {
          setGeminiClient(
            new FredGeminiClient({
              providerMode: 'FRED_CLOUD_PROXY',
              proxyUrl,
              proxyAccessToken: accessToken || undefined,
              model,
            }),
          );
          setShowSetupWizard(false);
          setStatusBanner(`Fred-Cloud-Proxy verbunden (${model}) – kein eigener API-Key nötig.`);
        }}
        onSaveKey={async (apiKey, budgetEur, model) => {
          const api = window.fredApi as
            | { saveApiKey?: (key: string) => Promise<{ saved: boolean }> }
            | undefined;
          if (api?.saveApiKey) {
            await api.saveApiKey(apiKey);
          }
          setGeminiClient(
            new FredGeminiClient({
              apiKey,
              model,
              maxBudgetEur: budgetEur,
              useOfflineAdapter: false,
            }),
          );
          setShowSetupWizard(false);
          setStatusBanner(`Gemini API-Key sicher gespeichert (Modell: ${model}, Budget-Stopp: ${budgetEur.toFixed(2)} €).`);
        }}
        onContinueOffline={(budgetEur) => {
          setGeminiClient(new FredGeminiClient({ maxBudgetEur: budgetEur, useOfflineAdapter: true }));
          setShowSetupWizard(false);
          setStatusBanner('Offline-Testadapter aktiv (keine externen API-Kosten).');
        }}
      />

      <ConceptStudioModal
        isOpen={showConceptStudio}
        studio={conceptStudio}
        onClose={() => setShowConceptStudio(false)}
        onModelApprovedAndBuilt={(newModel) => {
          setModels((prev) => [newModel, ...prev]);
          setActiveModelId(newModel.id);
          setStatusBanner(`Konzept freigegeben! 3D-Modell „${newModel.name}“ (${newModel.parts.length} Teile) deterministisch gebaut.`);
        }}
      />
    </div>
  );
}
