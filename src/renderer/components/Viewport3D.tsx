import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ChevronLeft, ChevronRight, Expand, Layers, RotateCcw } from 'lucide-react';
import { CadDocument, CadModel } from '../../core/cad';
import { buildModelGroup, createStudioLighting } from '../three/ldrawThreeBuilder';
import { CornerBricks } from './CornerBricks';

export interface Viewport3DProps {
  model: CadModel;
  currentStep: number;
  totalSteps: number;
  exploded: boolean;
  isolatedAssemblyId: string | null;
  onPrevStep: () => void;
  onNextStep: () => void;
  onToggleExploded: () => void;
  onSelectAssembly: (assemblyId: string | null) => void;
}

export function Viewport3D({
  model,
  currentStep,
  totalSteps,
  exploded,
  isolatedAssemblyId,
  onPrevStep,
  onNextStep,
  onToggleExploded,
  onSelectAssembly,
}: Viewport3DProps): React.ReactElement {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);
  const pedestalRef = useRef<THREE.Mesh | null>(null);
  const lastModelIdRef = useRef<string | null>(null);

  const explodedPositions = useMemo(() => {
    if (!exploded) return undefined;
    return new CadDocument(model).computeExplodedPositions(0.85);
  }, [model, exploded]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e6ecf3');

    const camera = new THREE.PerspectiveCamera(
      36,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      1,
      6000,
    );
    camera.position.set(275, 245, 325);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Photorealistic Studio Softbox Environment Map for genuine ABS plastic specular reflections!
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    createStudioLighting(scene);

    // Subtle studio display baseplate pedestal for strong contrast even on white models
    const pedestalGeo = new THREE.BoxGeometry(280, 10, 220);
    const pedestalMat = new THREE.MeshPhysicalMaterial({
      color: '#f8fafc',
      roughness: 0.35,
      clearcoat: 0.25,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.set(0, -5.5, 0);
    pedestal.receiveShadow = true;
    scene.add(pedestal);
    pedestalRef.current = pedestal;

    const holder = new THREE.Group();
    scene.add(holder);
    modelRootRef.current = holder;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 62, 0);
    controls.update();
    controlsRef.current = controls;

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Rebuild model meshes whenever model, step, exploded or assembly filter changes
  useEffect(() => {
    const holder = modelRootRef.current;
    if (!holder) return;
    holder.clear();

    const group = buildModelGroup(model, {
      maxStep: currentStep,
      highlightStep: currentStep,
      isolatedAssemblyId,
      explodedPositions,
    });
    holder.add(group);

    // Auto-fit pedestal & camera from the FULL model bounds (never clipped to step 1!)
    if (lastModelIdRef.current !== model.id) {
      lastModelIdRef.current = model.id;
      const fullBoundsGroup = buildModelGroup(model);
      const box = new THREE.Box3().setFromObject(fullBoundsGroup);
      if (!box.isEmpty()) {
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        if (pedestalRef.current) {
          const sx = Math.max(1, (size.x + 80) / 280);
          const sz = Math.max(1, (size.z + 80) / 220);
          pedestalRef.current.scale.set(sx, 1, sz);
          pedestalRef.current.position.set(center.x, -5.5, center.z);
        }

        if (cameraRef.current && controlsRef.current) {
          const maxDim = Math.max(size.x, size.y, size.z, 180);
          const dist = maxDim * 1.18;
          cameraRef.current.position.set(center.x + dist * 0.65, center.y + dist * 0.48, center.z + dist * 0.78);
          controlsRef.current.target.set(center.x, center.y, center.z);
          controlsRef.current.update();
        }
      }
    }
  }, [model, currentStep, isolatedAssemblyId, explodedPositions]);

  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(275, 245, 325);
      controlsRef.current.target.set(0, 62, 0);
      controlsRef.current.update();
    }
  };

  const progressPct = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 100;

  return (
    <section className="stage-center" aria-label="3D Bauplan Bühne">
      <CornerBricks />

      {/* Compact studio controls top-left of 3D stage */}
      <div className="stage-toolbar">
        <button
          type="button"
          className={`stage-chip ${exploded ? 'active' : ''}`}
          onClick={onToggleExploded}
          title="Explosionsansicht umschalten"
        >
          <Expand size={14} /> Explosion
        </button>

        <div className="stage-chip-group">
          <Layers size={14} />
          <select
            aria-label="Baugruppe isolieren"
            value={isolatedAssemblyId ?? ''}
            onChange={(e) => onSelectAssembly(e.target.value || null)}
            className="assembly-select"
          >
            <option value="">Alle Baugruppen</option>
            {model.assemblies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="stage-chip"
          onClick={handleResetCamera}
          title="Kamera zurücksetzen"
        >
          <RotateCcw size={14} /> Ansicht
        </button>
      </div>

      {/* Three.js Canvas */}
      <div ref={mountRef} className="three-canvas-host" />

      {/* Left / Right Step Arrows matching ui-vorlage.png */}
      <button
        type="button"
        className="step-arrow-btn arrow-left"
        onClick={onPrevStep}
        disabled={currentStep <= 1}
        aria-label="Vorheriger Bauschritt"
      >
        <ChevronLeft size={30} strokeWidth={3} />
      </button>

      <button
        type="button"
        className="step-arrow-btn arrow-right"
        onClick={onNextStep}
        disabled={currentStep >= totalSteps}
        aria-label="Nächster Bauschritt"
      >
        <ChevronRight size={30} strokeWidth={3} />
      </button>

      {/* Bottom Step Indicator Card matching ui-vorlage.png */}
      <div className="step-pill-card">
        <div className="step-pill-label">
          SCHRITT {currentStep} von {totalSteps}
        </div>
        <div className="step-progress-track">
          <div className="step-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    </section>
  );
}
