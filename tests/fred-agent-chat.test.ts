import { describe, expect, it } from 'vitest';
import { resolveFredAgentTurn } from '../src/core/ai/fredAgentActions';
import { computeBom, generateStepsForModel } from '../src/core/cad/bomAndSteps';
import { getStarterBlueprints } from '../src/core/models/sampleModels';

describe('Fred Chat-Agent: Super lieb, motivierend & fängt sofort mit Bild + 3D-Bau an', () => {
  const models = getStarterBlueprints();
  const activeModel = models[0];
  const steps = generateStepsForModel(activeModel);
  const bom = computeBom(activeModel);

  const baseCtx = {
    activeModel,
    currentStep: steps.length,
    totalSteps: steps.length,
    steps,
    bom,
    availableModels: models,
    pendingFollowUp: null,
  };

  it('antwortet auf „hallo“ herzlich, kurz und motivierend ohne Textwüste', () => {
    const res = resolveFredAgentTurn('hallo', baseCtx);
    expect(res.handledDirectly).toBe(true);
    expect(res.replyText.length).toBeLessThan(90);
    expect(res.replyText).toContain('Hallo!');
  });

  it('erkennt „hallo fred ich würde gerne die Gorch Fock in 1:300 bauen“ sofort, zeigt das Vorschaubild UND startet direkt den 3D-Bau', () => {
    const res = resolveFredAgentTurn('hallo fred ich würde gerne die Gorch Fock in 1:300 bauen', baseCtx);
    expect(res.handledDirectly).toBe(true);
    expect(res.imageUrl).toBe('./concepts/gorch-fock-concept.png');
    expect(res.action).toEqual({ type: 'BUILD_GORCH_FOCK', scaleLabel: '1:300' });
    expect(res.nextPendingFollowUp).toEqual({ type: 'GO_TO_STEP', step: 1 });
    expect(res.replyText).not.toMatch(/API-Setup|Proxy|Gemini-Key/i);
  });

  it('zeigt auf „ich möchte die Titanik in 3000 teile“ sofort das Vorschaubild UND startet direkt den 3D-Bau', () => {
    const res = resolveFredAgentTurn('ich möchte die Titanik in 3000 teile', baseCtx);
    expect(res.handledDirectly).toBe(true);
    expect(res.imageUrl).toBe('./concepts/titanic-concept.png');
    expect(res.action).toEqual({ type: 'BUILD_TITANIC', partCount: 3000 });
    expect(res.nextPendingFollowUp).toEqual({ type: 'GO_TO_STEP', step: 1 });
  });

  it('fängt bei jedem beliebigen Bauwunsch („Porsche 911“) sofort an, ohne Technik-Rückfragen', () => {
    const res = resolveFredAgentTurn('ich möchte einen Porsche 911 bauen', baseCtx);
    expect(res.handledDirectly).toBe(true);
    expect(res.action?.type).toBe('BUILD_CUSTOM_MODEL');
    expect(res.replyText).not.toMatch(/API-Setup|Proxy|Gemini-Key/i);
  });

  it('verwechselt „das Brandenburgertor in 3000 teile“ oder „Brandeburger tors“ NIEMALS mit der Starter-Burg', () => {
    for (const phrase of [
      'das Brandenburgertor in 3000 teile',
      'bitte erzeuge mir ein Fotorealistisches vorschaubild des Brandeburger tors',
    ]) {
      const res = resolveFredAgentTurn(phrase, baseCtx);
      expect(res.handledDirectly).toBe(true);
      expect(res.action?.type).toBe('BUILD_CUSTOM_MODEL');
      expect(res.action).not.toEqual({ type: 'SELECT_MODEL', modelId: 'model-castle' });
    }
  });

  it('baut auf eine normale Frage („hallo Fred was kannst du für mich tun?“) KEIN Klotz-Modell und erkennt „fünf master krusenstern“ als Großsegler', async () => {
    const { listAllParts } = await import('../src/core/ldraw');
    const q = resolveFredAgentTurn('hallo Fred was kannst du für mich tun?', baseCtx);
    expect(q.handledDirectly).toBe(true);
    expect(q.action).toBeUndefined();

    const ship = resolveFredAgentTurn('einen fünf master krusenstern 6000 teile', baseCtx);
    expect(ship.action?.type).toBe('BUILD_GORCH_FOCK');

    // Erweiterter moderner AFOL-Katalog: > 100 lizenzfreie LDraw-Bauteile inkl. Clips, Flügel-Slopes & Kacheln!
    const parts = listAllParts();
    expect(parts.length).toBeGreaterThanOrEqual(100);
    expect(parts.some((p) => p.partId === '4085d.dat')).toBe(true); // Clip
    expect(parts.some((p) => p.partId === '54383.dat')).toBe(true); // Flügel-Slope
    expect(parts.some((p) => p.partId === '87079.dat')).toBe(true); // Kachel 2x4
    expect(parts.some((p) => p.partId === '64178.dat')).toBe(true); // Technic-Rahmen 5x11
  });
});
