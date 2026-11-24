import { CadModel } from './types';
import { getColorByCode, getPartById } from '../ldraw';
import { BomItem, BomReport, InstructionStep } from '../pdf/pdfExporter';

export interface HumanStepErgonomicsOptions {
  /** Measured from real BlueBrixx manuals (Viper, Stuntman Truck, Chernobyl): 2-16 parts/step */
  maxPartsPerStep?: number;
  /** Measured from real BlueBrixx parts callout boxes: 2-6 unique part types/box */
  maxUniqueTypesPerStep?: number;
}

/**
 * Rebalances a model's step assignments into human-buildable BlueBrixx-ergonomic steps:
 * - Strict bottom-up order (by assembly order -> Y height -> X -> Z spatial clustering)
 * - Max 14 parts per step & max 6 unique (partId, colorCode) types per step box
 */
export function rebalanceStepsForHumans(
  model: CadModel,
  options: HumanStepErgonomicsOptions = {},
): CadModel {
  const maxParts = options.maxPartsPerStep ?? 14;
  const maxTypes = options.maxUniqueTypesPerStep ?? 6;
  const asmOrder = new Map(model.assemblies.map((a, idx) => [a.id, a.stepOrder ?? idx + 1]));

  const sorted = [...model.parts].sort((a, b) => {
    const ao = asmOrder.get(a.assemblyId) ?? 99;
    const bo = asmOrder.get(b.assemblyId) ?? 99;
    if (ao !== bo) return ao - bo;
    const dy = a.transform.positionLdu[1] - b.transform.positionLdu[1];
    if (Math.abs(dy) > 1) return dy;
    const dx = a.transform.positionLdu[0] - b.transform.positionLdu[0];
    if (Math.abs(dx) > 1) return dx;
    return a.transform.positionLdu[2] - b.transform.positionLdu[2];
  });

  let currentStep = 1;
  let currentCount = 0;
  let currentAsm = sorted[0]?.assemblyId ?? 'asm-root';
  let currentTypes = new Set<string>();

  const reassigned = sorted.map((p) => {
    const typeKey = `${p.partId}::${p.colorCode}`;
    const wouldExceedParts = currentCount >= maxParts;
    const wouldExceedTypes = !currentTypes.has(typeKey) && currentTypes.size >= maxTypes;
    const assemblyChanged = p.assemblyId !== currentAsm && currentCount > 0;

    if (wouldExceedParts || wouldExceedTypes || assemblyChanged) {
      currentStep += 1;
      currentCount = 0;
      currentTypes = new Set<string>();
      currentAsm = p.assemblyId;
    }

    currentCount += 1;
    currentTypes.add(typeKey);
    return { ...p, step: currentStep };
  });

  return {
    ...model,
    parts: reassigned,
  };
}

export function computeBom(model: CadModel): BomReport {
  const map = new Map<string, BomItem>();
  let totalParts = 0;
  let totalWeightGrams = 0;

  for (const inst of model.parts) {
    const def = getPartById(inst.partId);
    const color = getColorByCode(inst.colorCode);
    const key = `${inst.partId}::${inst.colorCode}`;
    const unitWeight = def?.weightGrams ?? 1.0;

    totalParts += 1;
    totalWeightGrams += unitWeight;

    const existing = map.get(key);
    if (existing) {
      existing.quantity += 1;
      existing.totalWeightGrams = Number((existing.totalWeightGrams + unitWeight).toFixed(2));
    } else {
      map.set(key, {
        partId: inst.partId,
        name: def?.name ?? inst.partId,
        colorCode: inst.colorCode,
        colorName: color.name,
        colorHex: color.hex,
        quantity: 1,
        unitWeightGrams: unitWeight,
        totalWeightGrams: Number(unitWeight.toFixed(2)),
        statusFlags: def?.statusFlags ?? ['UNKNOWN'],
      });
    }
  }

  const items = Array.from(map.values()).sort(
    (a, b) => a.partId.localeCompare(b.partId) || a.colorCode - b.colorCode,
  );

  return {
    modelId: model.id,
    modelName: model.name,
    totalParts,
    uniqueLots: items.length,
    totalWeightGrams: Number(totalWeightGrams.toFixed(2)),
    items,
  };
}

export function generateStepsForModel(model: CadModel): InstructionStep[] {
  const stepNumbers = Array.from(new Set(model.parts.map((p) => p.step))).sort((a, b) => a - b);
  const asmNames = new Map(model.assemblies.map((a) => [a.id, a.name]));

  const steps: InstructionStep[] = [];
  let cumulative = 0;

  for (let i = 0; i < stepNumbers.length; i++) {
    const rawStep = stepNumbers[i];
    const partsInStep = model.parts.filter((p) => p.step === rawStep);
    cumulative += partsInStep.length;

    const calloutMap = new Map<string, InstructionStep['calloutParts'][number]>();
    for (const p of partsInStep) {
      const def = getPartById(p.partId);
      const color = getColorByCode(p.colorCode);
      const key = `${p.partId}::${p.colorCode}`;
      const existing = calloutMap.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        calloutMap.set(key, {
          partId: p.partId,
          name: def?.name ?? p.partId,
          colorCode: p.colorCode,
          colorName: color.name,
          colorHex: color.hex,
          quantity: 1,
        });
      }
    }

    const primaryAsmId = partsInStep[0]?.assemblyId ?? 'asm-root';
    steps.push({
      stepNumber: i + 1,
      assemblyId: primaryAsmId,
      assemblyName: asmNames.get(primaryAsmId) ?? primaryAsmId,
      newPartInstanceIds: partsInStep.map((p) => p.instanceId),
      calloutParts: Array.from(calloutMap.values()),
      cumulativePartCount: cumulative,
    });
  }

  return steps;
}

export function validateInstructionsForModel(
  model: CadModel,
  steps: InstructionStep[],
): {
  valid: boolean;
  issues: string[];
  bomMatchesSteps: boolean;
} {
  const issues: string[] = [];
  const seenInstances = new Set<string>();
  let totalCalloutParts = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.stepNumber !== i + 1) {
      issues.push(
        `Schrittnummern nicht lückenlos: erwartet ${i + 1}, erhalten ${step.stepNumber}`,
      );
    }
    for (const id of step.newPartInstanceIds) {
      if (seenInstances.has(id)) {
        issues.push(`Teil-Instanz doppelt in Anleitung: ${id}`);
      }
      seenInstances.add(id);
    }
    for (const c of step.calloutParts) {
      totalCalloutParts += c.quantity;
    }
  }

  for (const p of model.parts) {
    if (!seenInstances.has(p.instanceId)) {
      issues.push(`Teil fehlt in Bauanleitung: ${p.instanceId}`);
    }
  }

  const bom = computeBom(model);
  const bomMatchesSteps =
    bom.totalParts === totalCalloutParts && seenInstances.size === model.parts.length;
  if (!bomMatchesSteps) {
    issues.push(
      `BOM-Teilezahl (${bom.totalParts}) weicht von Anleitung (${totalCalloutParts}) ab`,
    );
  }

  return {
    valid: issues.length === 0,
    issues,
    bomMatchesSteps,
  };
}
