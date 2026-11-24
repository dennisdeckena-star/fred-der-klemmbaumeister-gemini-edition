import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CadDocument, checkCollisions, validateConnections } from '../src/core/cad';
import { buildModelGroup, createStudioLighting } from '../src/renderer/three/ldrawThreeBuilder';

describe('Phase 1.3: CAD-Engine, Kollision, Verbindungen, Undo/Redo & Three.js PBR', () => {
  it('unterstützt Baugruppenhierarchie, Transformationen, Explosionsansicht und Undo/Redo', () => {
    const doc = new CadDocument();
    const hull = doc.createAssembly('Rumpf', 'asm-root', 'asm-hull');
    expect(hull.parentId).toBe('asm-root');

    const p1 = doc.addPart({
      partId: '3001.dat',
      colorCode: 4,
      positionLdu: [0, 0, 0],
      assemblyId: 'asm-hull',
      step: 1,
    });
    const p2 = doc.addPart({
      partId: '3001.dat',
      colorCode: 14,
      positionLdu: [0, 24, 0],
      assemblyId: 'asm-hull',
      step: 2,
    });

    expect(doc.getModel().parts).toHaveLength(2);
    expect(doc.canUndo).toBe(true);

    const exploded = doc.computeExplodedPositions(1.0);
    expect(exploded[p2.instanceId][1]).toBeGreaterThan(p2.transform.positionLdu[1]);

    doc.undo();
    expect(doc.getModel().parts).toHaveLength(1);
    expect(doc.canRedo).toBe(true);

    doc.redo();
    expect(doc.getModel().parts).toHaveLength(2);

    doc.transformPart(p1.instanceId, { rotationDeg: [0, 90, 0] });
    const updated = doc.getModel().parts.find((p) => p.instanceId === p1.instanceId)!;
    expect(updated.transform.rotationDeg).toEqual([0, 90, 0]);
    expect(doc.toLdrString()).toContain('0 STEP');
  });

  it('erkennt echte Kollisionen deterministisch und erlaubt sauberes Stapeln sowie Technic-Pins', () => {
    const doc = new CadDocument();
    doc.addPart({ partId: '3001.dat', colorCode: 4, positionLdu: [0, 0, 0], step: 1 });
    doc.addPart({ partId: '3001.dat', colorCode: 14, positionLdu: [0, 24, 0], step: 2 });

    const cleanReport = checkCollisions(doc.getModel());
    expect(cleanReport.hasCollisions).toBe(false);

    const connReport = validateConnections(doc.getModel());
    expect(connReport.isFullyConnected).toBe(true);
    expect(connReport.edges.length).toBeGreaterThanOrEqual(1);

    // Add overlapping part -> must trigger collision
    doc.addPart({ partId: '3001.dat', colorCode: 1, positionLdu: [10, 0, 0], step: 3 });
    const badReport = checkCollisions(doc.getModel());
    expect(badReport.hasCollisions).toBe(true);
    expect(badReport.collisions.length).toBeGreaterThanOrEqual(1);
  });

  it('erkennt schwebende/unverbundene Teile im Verbindungsgraph', () => {
    const doc = new CadDocument();
    doc.addPart({ partId: '3001.dat', colorCode: 4, positionLdu: [0, 0, 0], step: 1 });
    doc.addPart({ partId: '3005.dat', colorCode: 1, positionLdu: [200, 100, 200], step: 2 });

    const conn = validateConnections(doc.getModel());
    expect(conn.isFullyConnected).toBe(false);
    expect(conn.unconnectedInstanceIds).toHaveLength(1);
  });

  it('baut Three.js-Meshes mit MeshPhysicalMaterial (ABS Clearcoat) und Studio-Beleuchtung', () => {
    const doc = new CadDocument();
    doc.addPart({ partId: '3001.dat', colorCode: 4, positionLdu: [0, 0, 0], step: 1 });
    const group = buildModelGroup(doc.getModel(), { highlightStep: 1 });
    expect(group.children).toHaveLength(1);

    const partGroup = group.children[0] as THREE.Group;
    const mesh = partGroup.children[0] as THREE.Mesh;
    expect(mesh.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    const mat = mesh.material as THREE.MeshPhysicalMaterial;
    expect(mat.clearcoat).toBeGreaterThan(0.5);

    const scene = new THREE.Scene();
    createStudioLighting(scene);
    expect(scene.children.length).toBeGreaterThanOrEqual(4);
  });
});
