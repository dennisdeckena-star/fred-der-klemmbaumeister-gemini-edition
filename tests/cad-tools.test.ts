import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CadWorkspaceStore, createCadTools, invokeCadTool } from '../src/core/tools';

const EXPECTED_TOOLS = [
  'catalog.search_parts',
  'catalog.get_part',
  'model.create',
  'model.add_part',
  'model.remove_part',
  'model.transform_part',
  'model.create_assembly',
  'model.save',
  'model.load',
  'geometry.check_collisions',
  'connections.validate',
  'model.validate',
  'bom.generate',
  'render.scene',
  'render.exploded_view',
  'instructions.generate_steps',
  'instructions.validate',
  'pdf.export',
];

describe('Phase 1.4: CAD-Toolschicht (alle 18 Tools mit strengem Zod-Schema)', () => {
  it('registriert alle 18 geforderten CAD-Tools und lehnt ungültige Eingaben ab', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fred-tools-'));
    const store = new CadWorkspaceStore(tmpDir);
    const tools = createCadTools(store);

    for (const name of EXPECTED_TOOLS) {
      expect(tools.has(name)).toBe(true);
    }
    expect(tools.size).toBe(18);

    // Invalid schema must throw
    await expect(invokeCadTool(tools, 'model.create', { name: '' })).rejects.toThrow();
    await expect(invokeCadTool(tools, 'model.add_part', { modelId: 'x' })).rejects.toThrow();

    // Full exercise of all 18 tools
    const searchRes = (await invokeCadTool(tools, 'catalog.search_parts', { query: 'Brick 2 x 4' })) as any[];
    expect(searchRes.length).toBeGreaterThanOrEqual(1);

    const partRes = (await invokeCadTool(tools, 'catalog.get_part', { partId: '3001.dat' })) as any;
    expect(partRes.partId).toBe('3001.dat');

    const created = (await invokeCadTool(tools, 'model.create', {
      name: 'Tool-Test-Modell',
      description: 'Validierung aller 18 Werkzeuge',
    })) as any;
    const modelId = created.id as string;

    const asm = (await invokeCadTool(tools, 'model.create_assembly', {
      modelId,
      name: 'Basis',
      assemblyId: 'asm-base',
    })) as any;
    expect(asm.id).toBe('asm-base');

    const p1 = (await invokeCadTool(tools, 'model.add_part', {
      modelId,
      partId: '3001.dat',
      colorCode: 4,
      positionLdu: [0, 0, 0],
      assemblyId: 'asm-base',
      step: 1,
    })) as any;

    const p2 = (await invokeCadTool(tools, 'model.add_part', {
      modelId,
      partId: '3001.dat',
      colorCode: 14,
      positionLdu: [0, 24, 0],
      assemblyId: 'asm-base',
      step: 2,
    })) as any;

    const pTemp = (await invokeCadTool(tools, 'model.add_part', {
      modelId,
      partId: '3005.dat',
      colorCode: 1,
      positionLdu: [200, 0, 0],
      step: 3,
    })) as any;

    const removed = (await invokeCadTool(tools, 'model.remove_part', {
      modelId,
      instanceId: pTemp.instanceId,
    })) as any;
    expect(removed.removed).toBe(true);

    const transformed = (await invokeCadTool(tools, 'model.transform_part', {
      modelId,
      instanceId: p2.instanceId,
      positionLdu: [0, 24, 0],
      rotationDeg: [0, 0, 0],
    })) as any;
    expect(transformed.instanceId).toBe(p2.instanceId);

    const saveRes = (await invokeCadTool(tools, 'model.save', { modelId })) as any;
    expect(fs.existsSync(saveRes.jsonPath)).toBe(true);
    expect(fs.existsSync(saveRes.ldrPath)).toBe(true);

    const loaded = (await invokeCadTool(tools, 'model.load', { filePath: saveRes.jsonPath })) as any;
    expect(loaded.id).toBe(modelId);

    const col = (await invokeCadTool(tools, 'geometry.check_collisions', { modelId })) as any;
    expect(col.hasCollisions).toBe(false);

    const conn = (await invokeCadTool(tools, 'connections.validate', { modelId })) as any;
    expect(conn.isFullyConnected).toBe(true);

    const val = (await invokeCadTool(tools, 'model.validate', { modelId, maxParts: 10 })) as any;
    expect(val.status).toBe('PASS');
    expect(val.physicalLoadTest).toBe('NOT_TESTED');

    const bom = (await invokeCadTool(tools, 'bom.generate', { modelId })) as any;
    expect(bom.totalParts).toBe(2);

    const scene = (await invokeCadTool(tools, 'render.scene', { modelId, step: 1 })) as any;
    expect(scene.visiblePartCount).toBe(1);

    const exploded = (await invokeCadTool(tools, 'render.exploded_view', { modelId, factor: 1.0 })) as any;
    expect(exploded.positions[p2.instanceId][1]).toBeGreaterThan(24);

    const steps = (await invokeCadTool(tools, 'instructions.generate_steps', { modelId })) as any[];
    expect(steps).toHaveLength(2);

    const instrVal = (await invokeCadTool(tools, 'instructions.validate', { modelId })) as any;
    expect(instrVal.valid).toBe(true);

    const pdfPath = path.join(tmpDir, 'tool-test.pdf');
    const pdfRes = (await invokeCadTool(tools, 'pdf.export', { modelId, outputPath: pdfPath })) as any;
    expect(pdfRes.pageCount).toBe(4); // Cover + 2 Steps + BOM
    expect(fs.existsSync(pdfPath)).toBe(true);
    expect(fs.readFileSync(pdfPath).subarray(0, 4).toString('ascii')).toBe('%PDF');

    expect(p1.instanceId).toBeDefined();
  });
});
