import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  CadDocument,
  CadModel,
  checkCollisions,
  validateConnections,
} from '../cad';
import {
  getColorByCode,
  getPartById,
  OrderStatus,
  PartCategory,
  searchParts,
} from '../ldraw';
import {
  BomItem,
  BomReport,
  generateInstructionPdf,
  InstructionStep,
} from '../pdf/pdfExporter';

const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export interface CadToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput) => Promise<TOutput> | TOutput;
}

export class CadWorkspaceStore {
  private docs = new Map<string, CadDocument>();
  public readonly storageDir: string;

  constructor(storageDir: string) {
    this.storageDir = storageDir;
  }

  public register(doc: CadDocument): CadModel {
    const m = doc.getModel();
    this.docs.set(m.id, doc);
    return m;
  }

  public getDoc(modelId: string): CadDocument {
    const doc = this.docs.get(modelId);
    if (!doc) {
      throw new Error(`Modell nicht im Workspace geladen: ${modelId}`);
    }
    return doc;
  }

  public listModelIds(): string[] {
    return Array.from(this.docs.keys());
  }
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

  const items = Array.from(map.values()).sort((a, b) =>
    a.partId.localeCompare(b.partId) || a.colorCode - b.colorCode,
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

export function validateInstructionsForModel(model: CadModel, steps: InstructionStep[]): {
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
      issues.push(`Schrittnummern nicht lückenlos: erwartet ${i + 1}, erhalten ${step.stepNumber}`);
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
  const bomMatchesSteps = bom.totalParts === totalCalloutParts && seenInstances.size === model.parts.length;
  if (!bomMatchesSteps) {
    issues.push(`BOM-Teilezahl (${bom.totalParts}) weicht von Anleitung (${totalCalloutParts}) ab`);
  }

  return {
    valid: issues.length === 0,
    issues,
    bomMatchesSteps,
  };
}

export function createCadTools(store: CadWorkspaceStore): Map<string, CadToolDefinition<any, any>> {
  const tools = new Map<string, CadToolDefinition<any, any>>();

  const register = <I, O>(def: CadToolDefinition<I, O>) => {
    tools.set(def.name, def);
  };

  register({
    name: 'catalog.search_parts',
    description: 'Durchsucht den LDraw-Teilekatalog nach Name, Kategorie, Farbe oder Bestellstatus.',
    inputSchema: z.object({
      query: z.string().optional(),
      category: z.enum(['Brick', 'Plate', 'Tile', 'Slope', 'Technic', 'Special']).optional(),
      status: z
        .enum([
          'CONFIRMED_GEOMETRY',
          'CONFIRMED_COLOR',
          'ORDERABLE',
          'OUT_OF_STOCK',
          'DISCONTINUED',
          'UNKNOWN',
        ])
        .optional(),
      colorCode: z.number().int().optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
    execute: (input) =>
      searchParts({
        query: input.query,
        category: input.category as PartCategory | undefined,
        status: input.status as OrderStatus | undefined,
        colorCode: input.colorCode,
        limit: input.limit,
      }).map((p) => ({
        partId: p.partId,
        name: p.name,
        category: p.category,
        dimensionsLdu: p.dimensionsLdu,
        statusFlags: p.statusFlags,
        connectorCount: p.connectors.length,
      })),
  });

  register({
    name: 'catalog.get_part',
    description: 'Liefert die vollständige LDraw-Teiledefinition inkl. .dat-Geometrie und Konnektoren.',
    inputSchema: z.object({ partId: z.string().min(1) }),
    execute: ({ partId }) => {
      const part = getPartById(partId);
      if (!part) throw new Error(`Teil nicht gefunden: ${partId}`);
      return part;
    },
  });

  register({
    name: 'model.create',
    description: 'Erzeugt ein neues leeres CAD-Modell im Workspace.',
    inputSchema: z.object({
      name: z.string().min(1).max(120),
      description: z.string().max(500).optional(),
    }),
    execute: ({ name, description }) => {
      const now = new Date().toISOString();
      const doc = new CadDocument({
        id: `model-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`,
        name,
        description: description ?? '',
        createdAt: now,
        updatedAt: now,
        assemblies: [{ id: 'asm-root', name: 'Hauptbaugruppe', parentId: null, stepOrder: 1 }],
        parts: [],
        metadata: {},
      });
      return store.register(doc);
    },
  });

  register({
    name: 'model.add_part',
    description: 'Fügt ein validiertes LDraw-Teil zu einem Modell hinzu.',
    inputSchema: z.object({
      modelId: z.string().min(1),
      partId: z.string().min(1),
      colorCode: z.number().int().min(0),
      positionLdu: Vec3Schema,
      rotationDeg: Vec3Schema.optional(),
      assemblyId: z.string().optional(),
      step: z.number().int().positive().optional(),
    }),
    execute: (input) => store.getDoc(input.modelId).addPart(input),
  });

  register({
    name: 'model.remove_part',
    description: 'Entfernt eine Teil-Instanz aus einem Modell.',
    inputSchema: z.object({
      modelId: z.string().min(1),
      instanceId: z.string().min(1),
    }),
    execute: ({ modelId, instanceId }) => ({
      removed: store.getDoc(modelId).removePart(instanceId),
      instanceId,
    }),
  });

  register({
    name: 'model.transform_part',
    description: 'Verschiebt oder dreht eine bestehende Teil-Instanz.',
    inputSchema: z.object({
      modelId: z.string().min(1),
      instanceId: z.string().min(1),
      positionLdu: Vec3Schema.optional(),
      rotationDeg: Vec3Schema.optional(),
    }),
    execute: ({ modelId, instanceId, positionLdu, rotationDeg }) =>
      store.getDoc(modelId).transformPart(instanceId, { positionLdu, rotationDeg }),
  });

  register({
    name: 'model.create_assembly',
    description: 'Legt eine neue Baugruppe in der Modellhierarchie an.',
    inputSchema: z.object({
      modelId: z.string().min(1),
      name: z.string().min(1).max(100),
      parentId: z.string().nullable().optional(),
      assemblyId: z.string().optional(),
    }),
    execute: ({ modelId, name, parentId, assemblyId }) =>
      store.getDoc(modelId).createAssembly(name, parentId ?? 'asm-root', assemblyId),
  });

  register({
    name: 'model.save',
    description: 'Speichert das Modell deterministisch als JSON und LDraw .ldr auf der Festplatte.',
    inputSchema: z.object({
      modelId: z.string().min(1),
      fileName: z.string().min(1).max(120).optional(),
    }),
    execute: ({ modelId, fileName }) => {
      const doc = store.getDoc(modelId);
      fs.mkdirSync(store.storageDir, { recursive: true });
      const base = (fileName ?? modelId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const jsonPath = path.join(store.storageDir, `${base}.fred.json`);
      const ldrPath = path.join(store.storageDir, `${base}.ldr`);
      fs.writeFileSync(jsonPath, doc.toJSON(), 'utf8');
      fs.writeFileSync(ldrPath, doc.toLdrString(), 'utf8');
      return { modelId, jsonPath, ldrPath, saved: true };
    },
  });

  register({
    name: 'model.load',
    description: 'Lädt ein gespeichertes Modell aus einer .fred.json-Datei in den Workspace.',
    inputSchema: z.object({
      filePath: z.string().min(1),
    }),
    execute: ({ filePath }) => {
      const raw = fs.readFileSync(filePath, 'utf8');
      const doc = CadDocument.fromJSON(raw);
      return store.register(doc);
    },
  });

  register({
    name: 'geometry.check_collisions',
    description: 'Prüft ein Modell deterministisch auf geometrische Volumenkollisionen.',
    inputSchema: z.object({ modelId: z.string().min(1) }),
    execute: ({ modelId }) => checkCollisions(store.getDoc(modelId).getModel()),
  });

  register({
    name: 'connections.validate',
    description: 'Prüft alle Noppen-, Tube- und Technic-Pin-Verbindungen im Modell.',
    inputSchema: z.object({ modelId: z.string().min(1) }),
    execute: ({ modelId }) => validateConnections(store.getDoc(modelId).getModel()),
  });

  register({
    name: 'model.validate',
    description: 'Führt eine vollständige deterministische Gesamtvalidierung (Kollisionen, Verbindungen, Anleitung) aus.',
    inputSchema: z.object({
      modelId: z.string().min(1),
      maxParts: z.number().int().positive().optional(),
    }),
    execute: ({ modelId, maxParts }) => {
      const model = store.getDoc(modelId).getModel();
      const collisions = checkCollisions(model);
      const connections = validateConnections(model);
      const steps = generateStepsForModel(model);
      const instructions = validateInstructionsForModel(model, steps);
      const withinLimit = typeof maxParts === 'number' ? model.parts.length <= maxParts : true;
      const passed =
        !collisions.hasCollisions &&
        connections.isFullyConnected &&
        instructions.valid &&
        withinLimit;

      return {
        modelId,
        status: passed ? 'PASS' : 'FAIL',
        partCount: model.parts.length,
        withinLimit,
        collisions,
        connections,
        instructions,
        physicalLoadTest: 'NOT_TESTED',
      };
    },
  });

  register({
    name: 'bom.generate',
    description: 'Berechnet die vollständige Stückliste (BOM) inkl. Farben, Gewicht und Bestellstatus.',
    inputSchema: z.object({ modelId: z.string().min(1) }),
    execute: ({ modelId }) => computeBom(store.getDoc(modelId).getModel()),
  });

  register({
    name: 'render.scene',
    description: 'Erzeugt deterministische Szenen-Renderdaten für die 3D-Ansicht oder einen Bauschritt.',
    inputSchema: z.object({
      modelId: z.string().min(1),
      step: z.number().int().positive().optional(),
      cameraAzimuthDeg: z.number().optional(),
      cameraElevationDeg: z.number().optional(),
    }),
    execute: ({ modelId, step, cameraAzimuthDeg, cameraElevationDeg }) => {
      const model = store.getDoc(modelId).getModel();
      const visibleParts =
        typeof step === 'number' ? model.parts.filter((p) => p.step <= step) : model.parts;
      return {
        modelId,
        step: step ?? null,
        visiblePartCount: visibleParts.length,
        camera: {
          azimuthDeg: cameraAzimuthDeg ?? 45,
          elevationDeg: cameraElevationDeg ?? 32,
        },
        lighting: 'STUDIO_ABS_PBR',
        renderedAt: new Date().toISOString(),
      };
    },
  });

  register({
    name: 'render.exploded_view',
    description: 'Berechnet eine deterministische Explosionsansicht für alle Teile des Modells.',
    inputSchema: z.object({
      modelId: z.string().min(1),
      factor: z.number().min(0).max(2).default(1.0),
    }),
    execute: ({ modelId, factor }) => ({
      modelId,
      factor: factor ?? 1.0,
      positions: store.getDoc(modelId).computeExplodedPositions(factor ?? 1.0),
    }),
  });

  register({
    name: 'instructions.generate_steps',
    description: 'Erzeugt die geordnete Schritt-für-Schritt-Bauanleitung aus dem Modell.',
    inputSchema: z.object({ modelId: z.string().min(1) }),
    execute: ({ modelId }) => generateStepsForModel(store.getDoc(modelId).getModel()),
  });

  register({
    name: 'instructions.validate',
    description: 'Prüft Konsistenz zwischen Bauanleitung, Modellteilen und BOM.',
    inputSchema: z.object({ modelId: z.string().min(1) }),
    execute: ({ modelId }) => {
      const model = store.getDoc(modelId).getModel();
      const steps = generateStepsForModel(model);
      return validateInstructionsForModel(model, steps);
    },
  });

  register({
    name: 'pdf.export',
    description: 'Exportiert eine deterministische, mehrseitige, farbige PDF-Bauanleitung inkl. BOM.',
    inputSchema: z.object({
      modelId: z.string().min(1),
      outputPath: z.string().min(1),
    }),
    execute: async ({ modelId, outputPath }) => {
      const model = store.getDoc(modelId).getModel();
      const steps = generateStepsForModel(model);
      const bom = computeBom(model);
      const pdf = await generateInstructionPdf({ model, steps, bom });
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, pdf.bytes);
      return {
        modelId,
        outputPath,
        pageCount: pdf.pageCount,
        stepCount: pdf.stepCount,
        byteLength: pdf.bytes.byteLength,
        sha256: pdf.sha256,
      };
    },
  });

  return tools;
}

export async function invokeCadTool(
  tools: Map<string, CadToolDefinition<any, any>>,
  name: string,
  rawInput: unknown,
): Promise<unknown> {
  const tool = tools.get(name);
  if (!tool) {
    throw new Error(`Unbekanntes CAD-Tool: ${name}`);
  }
  const parsed = tool.inputSchema.parse(rawInput);
  return await tool.execute(parsed);
}
