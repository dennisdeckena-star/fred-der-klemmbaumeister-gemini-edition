import * as THREE from 'three';
import { getColorByCode, getPartById, parseLDrawContent } from '../../core/ldraw';
import { CadModel, PartInstance } from '../../core/cad';

export interface BuildMeshOptions {
  highlightNew?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  skipEdges?: boolean;
}

const geometryCache = new Map<string, { solid: THREE.BufferGeometry; edges: THREE.BufferGeometry }>();
const materialCache = new Map<string, THREE.MeshPhysicalMaterial>();

function getOrBuildPartGeometry(partId: string): { solid: THREE.BufferGeometry; edges: THREE.BufferGeometry } {
  const cached = geometryCache.get(partId);
  if (cached) return cached;

  const def = getPartById(partId);
  if (!def) {
    throw new Error(`LDraw-Teil nicht gefunden: ${partId}`);
  }

  const parsed = parseLDrawContent(def.datContent);
  const positions: number[] = [];

  for (const tri of parsed.triangles) {
    for (const v of tri.vertices) {
      positions.push(v[0], v[1], v[2]);
    }
  }
  for (const quad of parsed.quads) {
    const [v1, v2, v3, v4] = quad.vertices;
    positions.push(
      v1[0], v1[1], v1[2],
      v2[0], v2[1], v2[2],
      v3[0], v3[1], v3[2],
      v1[0], v1[1], v1[2],
      v3[0], v3[1], v3[2],
      v4[0], v4[1], v4[2],
    );
  }

  const solid = new THREE.BufferGeometry();
  solid.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  solid.computeVertexNormals();

  const edgePositions: number[] = [];
  for (const line of parsed.lines) {
    edgePositions.push(
      line.start[0], line.start[1], line.start[2],
      line.end[0], line.end[1], line.end[2],
    );
  }
  const edges = new THREE.BufferGeometry();
  edges.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));

  const entry = { solid, edges };
  geometryCache.set(partId, entry);
  return entry;
}

/**
 * Creates (and caches) a photorealistic ABS plastic MeshPhysicalMaterial with clearcoat and realistic specular highlights.
 */
export function createAbsMaterial(colorCode: number, opts: BuildMeshOptions = {}): THREE.MeshPhysicalMaterial {
  const key = `${colorCode}:${Boolean(opts.highlightNew)}:${Boolean(opts.selected)}:${Boolean(opts.dimmed)}`;
  const cached = materialCache.get(key);
  if (cached) return cached;

  const color = getColorByCode(colorCode);
  const isTransparent = color.finish === 'TRANSPARENT';

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color.hex),
    roughness: isTransparent ? 0.08 : 0.14,
    metalness: color.finish === 'METALLIC' ? 0.65 : 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    reflectivity: 0.72,
    transparent: isTransparent || Boolean(opts.dimmed),
    opacity: opts.dimmed ? 0.35 : color.alpha,
    emissive: opts.selected
      ? new THREE.Color('#2563eb')
      : opts.highlightNew
        ? new THREE.Color('#dc2626')
        : new THREE.Color('#000000'),
    emissiveIntensity: opts.selected ? 0.18 : opts.highlightNew ? 0.12 : 0,
  });

  materialCache.set(key, mat);
  return mat;
}

export function buildPartGroup(
  instance: PartInstance,
  opts: BuildMeshOptions = {},
  overridePosition?: [number, number, number],
): THREE.Group {
  const { solid, edges } = getOrBuildPartGeometry(instance.partId);
  const material = createAbsMaterial(instance.colorCode, opts);

  const group = new THREE.Group();
  group.name = instance.instanceId;
  group.userData = {
    instanceId: instance.instanceId,
    partId: instance.partId,
    colorCode: instance.colorCode,
    step: instance.step,
    assemblyId: instance.assemblyId,
  };

  const mesh = new THREE.Mesh(solid, material);
  mesh.castShadow = !opts.skipEdges;
  mesh.receiveShadow = true;
  mesh.userData = group.userData;
  group.add(mesh);

  if (!opts.skipEdges || opts.highlightNew || opts.selected) {
    const colorInfo = getColorByCode(instance.colorCode);
    const lineMat = new THREE.LineBasicMaterial({
      color: opts.highlightNew ? '#e11d48' : opts.selected ? '#1d4ed8' : colorInfo.edgeHex,
      transparent: true,
      opacity: opts.highlightNew ? 0.95 : 0.35,
    });
    const lineSegs = new THREE.LineSegments(edges, lineMat);
    group.add(lineSegs);
  }

  const pos = overridePosition ?? instance.transform.positionLdu;
  group.position.set(pos[0], pos[1], pos[2]);
  group.rotation.set(
    THREE.MathUtils.degToRad(instance.transform.rotationDeg[0]),
    THREE.MathUtils.degToRad(instance.transform.rotationDeg[1]),
    THREE.MathUtils.degToRad(instance.transform.rotationDeg[2]),
  );

  return group;
}

export function buildModelGroup(
  model: CadModel,
  options: {
    maxStep?: number;
    highlightStep?: number;
    selectedIds?: string[];
    isolatedAssemblyId?: string | null;
    explodedPositions?: Record<string, [number, number, number]>;
  } = {},
): THREE.Group {
  const root = new THREE.Group();
  root.name = model.id;
  const selectedSet = new Set(options.selectedIds ?? []);

  const visibleParts = model.parts.filter(
    (p) => typeof options.maxStep !== 'number' || p.step <= options.maxStep,
  );

  // For large Display models (> 300 parts, e.g. 3000-part Titanic), batch identical (partId, colorCode, state)
  // into THREE.InstancedMesh for smooth 60 FPS WebGL rendering!
  if (visibleParts.length > 300) {
    const buckets = new Map<string, { partId: string; colorCode: number; opts: BuildMeshOptions; items: PartInstance[] }>();
    for (const part of visibleParts) {
      const dimmed =
        Boolean(options.isolatedAssemblyId) && part.assemblyId !== options.isolatedAssemblyId;
      const highlightNew =
        typeof options.highlightStep === 'number' && part.step === options.highlightStep;
      const selected = selectedSet.has(part.instanceId);
      const key = `${part.partId}|${part.colorCode}|${highlightNew}|${selected}|${dimmed}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          partId: part.partId,
          colorCode: part.colorCode,
          opts: { highlightNew, selected, dimmed, skipEdges: true },
          items: [],
        };
        buckets.set(key, bucket);
      }
      bucket.items.push(part);
    }

    const dummy = new THREE.Object3D();
    for (const bucket of buckets.values()) {
      const { solid } = getOrBuildPartGeometry(bucket.partId);
      const mat = createAbsMaterial(bucket.colorCode, bucket.opts);
      const instMesh = new THREE.InstancedMesh(solid, mat, bucket.items.length);
      instMesh.castShadow = true;
      instMesh.receiveShadow = true;
      bucket.items.forEach((p, idx) => {
        const pos = options.explodedPositions?.[p.instanceId] ?? p.transform.positionLdu;
        dummy.position.set(pos[0], pos[1], pos[2]);
        dummy.rotation.set(
          THREE.MathUtils.degToRad(p.transform.rotationDeg[0]),
          THREE.MathUtils.degToRad(p.transform.rotationDeg[1]),
          THREE.MathUtils.degToRad(p.transform.rotationDeg[2]),
        );
        dummy.updateMatrix();
        instMesh.setMatrixAt(idx, dummy.matrix);
      });
      instMesh.instanceMatrix.needsUpdate = true;
      root.add(instMesh);
    }
    return root;
  }

  for (const part of visibleParts) {
    const dimmed =
      Boolean(options.isolatedAssemblyId) && part.assemblyId !== options.isolatedAssemblyId;
    const highlightNew =
      typeof options.highlightStep === 'number' && part.step === options.highlightStep;

    const partGroup = buildPartGroup(
      part,
      {
        highlightNew,
        selected: selectedSet.has(part.instanceId),
        dimmed,
      },
      options.explodedPositions?.[part.instanceId],
    );
    root.add(partGroup);
  }

  return root;
}

export function createStudioLighting(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight('#ffffff', '#dbe4f0', 0.95);
  hemi.position.set(0, 500, 0);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight('#fffdf8', 1.45);
  keyLight.position.set(320, 480, 360);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 20;
  keyLight.shadow.camera.far = 2200;
  const d = 750;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#e6f0ff', 0.6);
  fillLight.position.set(-320, 240, -220);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight('#ffffff', 0.45);
  rimLight.position.set(0, 200, -380);
  scene.add(rimLight);
}
