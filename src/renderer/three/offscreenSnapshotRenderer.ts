import * as THREE from 'three';
import { CadModel } from '../../core/cad';
import { InstructionStep } from '../../core/pdf/pdfExporter';
import { buildModelGroup, createStudioLighting } from './ldrawThreeBuilder';

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Renders real high-resolution offscreen Three.js WebGL studio snapshots
 * (Cover + each instruction step with newly added parts highlighted in red)
 * for BlueBrixx-quality PDF instruction manuals.
 */
export function renderModelStepSnapshots(
  model: CadModel,
  steps: InstructionStep[],
  width = 1120,
  height = 680,
): Record<number, Uint8Array> {
  const snapshots: Record<number, Uint8Array> = {};
  if (typeof document === 'undefined') return snapshots;

  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#ffffff');
    createStudioLighting(scene);

    const camera = new THREE.PerspectiveCamera(34, width / height, 1, 6000);
    const holder = new THREE.Group();
    scene.add(holder);

    // Measure full model once so camera stays rock-steady across every step (like BlueBrixx!)
    const fullGroup = buildModelGroup(model);
    holder.add(fullGroup);
    const box = new THREE.Box3().setFromObject(fullGroup);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 160);
    const dist = maxDim * 1.48;
    camera.position.set(center.x + dist * 0.72, center.y + dist * 0.58, center.z + dist * 0.84);
    camera.lookAt(center);

    // Step 0 = Full model studio cover render
    renderer.render(scene, camera);
    snapshots[0] = dataUrlToUint8Array(renderer.domElement.toDataURL('image/png'));

    // Render each build step with newly added parts highlighted in crisp red
    for (const step of steps) {
      holder.clear();
      const stepGroup = buildModelGroup(model, {
        maxStep: step.stepNumber,
        highlightStep: step.stepNumber,
      });
      holder.add(stepGroup);
      renderer.render(scene, camera);
      snapshots[step.stepNumber] = dataUrlToUint8Array(renderer.domElement.toDataURL('image/png'));
    }

    renderer.dispose();
  } catch {
    // Graceful fallback to vector isometric renderer if WebGL context is unavailable
  }

  return snapshots;
}

/**
 * Rendert 3 Studio-Ansichten (Isometrie, Seitenansicht, Frontansicht) als PNG-Data-URLs
 * für Freds visuelle Selbstkritik (Stufe 5 der Fred-Pro-Pipeline: 3D-Render vs. Zielbild).
 */
export function renderMultiAngleReview(
  model: CadModel,
  width = 640,
  height = 420,
): string[] {
  if (typeof document === 'undefined') return [];
  const views: string[] = [];

  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e8edf3');
    createStudioLighting(scene);

    const group = buildModelGroup(model);
    scene.add(group);

    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 160);
    const dist = maxDim * 1.45;
    const camera = new THREE.PerspectiveCamera(34, width / height, 1, 6000);

    const angles: Array<[number, number, number]> = [
      [center.x + dist * 0.72, center.y + dist * 0.52, center.z + dist * 0.84], // 3/4 Isometrie
      [center.x, center.y + dist * 0.18, center.z + dist * 1.15],               // Seitenansicht
      [center.x - dist * 1.15, center.y + dist * 0.25, center.z],               // Front-/Bugansicht
    ];

    for (const [cx, cy, cz] of angles) {
      camera.position.set(cx, cy, cz);
      camera.lookAt(center);
      renderer.render(scene, camera);
      views.push(renderer.domElement.toDataURL('image/png'));
    }

    renderer.dispose();
  } catch {
    // Graceful fallback if WebGL is unavailable (e.g. headless Node unit tests)
  }

  return views;
}
