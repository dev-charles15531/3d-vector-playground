// main.ts
import * as BABYLON from "@babylonjs/core";
import { GridMaterial } from "@babylonjs/materials/grid";

import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/loaders";

import { VectorRenderer } from "./VectorRenderer";
import { VectorEngine } from "./VectorEngine";
import { VectorOverlays } from "./VectorOverlays";
import { DragController } from "./DragController";
import { CameraController } from "./CameraController";
import { StateSerializer } from "./StateSerializer";
import { UI } from "./UI";
import { Lab } from "./Lab";

class Playground {
  public static CreateScene(
    engine: BABYLON.Engine,
    canvas: HTMLCanvasElement,
  ): BABYLON.Scene {
    // =========================================================
    // ENGINE QUALITY
    // =========================================================

    // Render at native device resolution — critical for line sharpness.
    engine.adaptToDeviceRatio = true;

    // Match hardware pixel density exactly so no resampling occurs.
    engine.setHardwareScalingLevel(1 / window.devicePixelRatio);

    // =========================================================
    // SCENE
    // =========================================================

    const scene = new BABYLON.Scene(engine);

    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

    // =========================================================
    // CAMERA
    // =========================================================

    const camera = new BABYLON.ArcRotateCamera(
      "camera1",
      -Math.PI / 2,
      Math.PI / 3,
      14,
      BABYLON.Vector3.Zero(),
      scene,
    );

    camera.upperBetaLimit = (Math.PI / 2) * 0.95;
    camera.lowerRadiusLimit = 3;
    camera.upperRadiusLimit = 80;

    // Slow, cinematic zoom feel.
    camera.wheelDeltaPercentage = 0.01;

    // Disable pointer-based panning — Ctrl is reserved for vector origin drag.
    camera.panningSensibility = 0;

    // Smooth deceleration — important for recording feel.
    camera.inertia = 0.92;

    camera.attachControl(canvas);

    // =========================================================
    // ANTIALIAS / POSTPROCESSING
    // =========================================================

    // Use native MSAA (hardware antialiasing) for the sharpest geometry edges.
    // This is superior to FXAA alone for thin lines/arrows recorded to video.
    // BabylonJS Engine constructor takes antialias=true which enables 4x MSAA
    // when the engine was created with it — we request it explicitly here via
    // a MSAA render target if available, otherwise fall back to FXAA only.

    const pipeline = new BABYLON.DefaultRenderingPipeline(
      "pipeline",
      true, // HDR = true gives better precision
      scene,
      [camera],
    );

    // FXAA smooths 3D geometry edges during recording.
    // The GUI layer bypasses this via layer.applyPostProcess=false (set in UI.ts)
    // so text and borders are never blurred by FXAA — only 3D geometry is affected.
    pipeline.fxaaEnabled = true;

    // Sharpening worsens grid aliasing and temporal crawling.
    pipeline.sharpenEnabled = false;

    // Bloom causes highlights to crawl on camera movement.
    pipeline.bloomEnabled = false;

    // pipeline.samples left at default (1) intentionally.
    // MSAA inside the pipeline also affects the GUI layer compositing step
    // and can re-blur text even after applyPostProcess=false.

    // =========================================================
    // LIGHTS
    // =========================================================

    const hemi = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene,
    );
    hemi.intensity = 0.6;

    const spot = new BABYLON.SpotLight(
      "splight",
      new BABYLON.Vector3(0, 10, 0),
      new BABYLON.Vector3(0, -1, 0),
      Math.PI / 2,
      2,
      scene,
    );
    spot.intensity = 0.8;

    // =========================================================
    // GROUND — RECORDING-OPTIMISED CINEMATIC VERSION
    // =========================================================

    // KEY INSIGHT: The #1 cause of grid shimmer in recordings is high grid
    // frequency (small gridRatio) combined with camera movement. We use:
    //   - Large gridRatio (very coarse cells)
    //   - Major lines only (no minor lines)
    //   - Very low opacity
    //   - Two-layer ground for depth fade without distant moiré

    // ---------------------------------------------------------
    // INNER GROUND — primary interaction area
    // ---------------------------------------------------------

    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: 60, height: 60 },
      scene,
    );

    // Tiny Y offset prevents z-fighting with overlaid meshes.
    ground.position.y = -0.001;

    const grid = new GridMaterial("grid", scene);

    // ── Critical anti-shimmer settings ──────────────────────
    // Very large cells: fewer lines = exponentially less aliasing.
    grid.gridRatio = 5;

    // Only major lines — halves the line count vs gridRatio alone.
    grid.majorUnitFrequency = 1;

    // No minor lines at all. This is the single biggest recording quality win.
    grid.minorUnitVisibility = 0;

    // Very faint — lines should be a hint, not a feature.
    grid.opacity = 0.09;

    // Near-black base to stay invisible between lines.
    grid.mainColor = new BABYLON.Color3(0.02, 0.03, 0.04);

    // Soft cool-grey lines — visible without glowing.
    grid.lineColor = new BABYLON.Color3(0.08, 0.09, 0.12);

    grid.backFaceCulling = false;
    ground.material = grid;

    // ---------------------------------------------------------
    // OUTER GROUND — cinematic distance fade
    // ---------------------------------------------------------

    const outerGround = BABYLON.MeshBuilder.CreateGround(
      "outer-ground",
      { width: 180, height: 180 },
      scene,
    );

    outerGround.position.y = -0.002;

    const outerGrid = new GridMaterial("outer-grid", scene);

    // Very coarse — avoids ALL aliasing at distance.
    outerGrid.gridRatio = 10;
    outerGrid.majorUnitFrequency = 1;
    outerGrid.minorUnitVisibility = 0;

    // Almost invisible — purely for spatial context.
    outerGrid.opacity = 0.025;

    outerGrid.mainColor = new BABYLON.Color3(0.01, 0.015, 0.02);
    outerGrid.lineColor = new BABYLON.Color3(0.04, 0.05, 0.06);
    outerGround.material = outerGrid;

    // =========================================================
    // LAB
    // =========================================================

    const labSize = 50;
    new Lab(scene, labSize, grid);

    // =========================================================
    // ORIGIN MARKER
    // =========================================================

    const defaultOriginHeight = labSize / 2;

    const origin = BABYLON.MeshBuilder.CreateSphere(
      "origin",
      { diameter: 0.35 },
      scene,
    );

    origin.position = new BABYLON.Vector3(0, defaultOriginHeight, 0);

    const originMat = new BABYLON.StandardMaterial("originMat", scene);
    originMat.emissiveColor = new BABYLON.Color3(0.6, 0.1, 0.8);
    origin.material = originMat;

    camera.setTarget(origin.position);

    // =========================================================
    // CORE SYSTEMS
    // =========================================================

    const vecEngine = new VectorEngine(defaultOriginHeight);

    const renderer = new VectorRenderer(scene, defaultOriginHeight);

    const overlays = new VectorOverlays(
      scene,
      defaultOriginHeight,
      renderer,
    );

    const cameraController = new CameraController(
      camera,
      scene,
      canvas,
      defaultOriginHeight,
    );

    const dragController = new DragController(
      scene,
      camera,
      canvas,
      vecEngine,
      renderer,
      defaultOriginHeight,
    );

    // =========================================================
    // ENGINE → RENDERER
    // =========================================================

    vecEngine.onVectorAdded = (v) => {
      renderer.add(v);
      renderer.refresh(vecEngine.getVectors());
      updateOverlays();
    };

    vecEngine.onVectorUpdated = (v) => {
      renderer.update(v);
      renderer.refresh(vecEngine.getVectors());
      updateOverlays();
    };

    vecEngine.onVectorRemoved = (v) => {
      renderer.remove(v);
      renderer.refresh(vecEngine.getVectors());
      updateOverlays();
    };

    vecEngine.onModeChanged = () => {
      renderer.setHeadToTail(vecEngine.getHeadToTail());
      renderer.refresh(vecEngine.getVectors());
      updateOverlays();
    };

    vecEngine.onSelectionChanged((key) => {
      renderer.highlight(key, vecEngine.getVectors());
      updateOverlays();
    });

    const updateOverlays = () => {
      overlays.updateForSelection(
        vecEngine.getSelectedKey(),
        vecEngine.getVectors(),
      );
    };

    // =========================================================
    // HIGH CONTRAST MODE
    // =========================================================

    cameraController.onHighContrastChanged = (enabled) => {
      vecEngine.getVectors().forEach((v) => {
        if (!v.vector) return;

        const meshes = v.vector.getMeshes();
        meshes.forEach((m) => {
          const mat = m.material as BABYLON.StandardMaterial;
          if (!mat) return;

          if (enabled) {
            mat.emissiveColor = mat.diffuseColor.scale(0.7);
            m.edgesWidth = 4;
          } else {
            mat.emissiveColor = BABYLON.Color3.Black();
          }
        });
      });

      scene.clearColor = enabled
        ? new BABYLON.Color4(0.03, 0.05, 0.1, 1)
        : new BABYLON.Color4(0, 0, 0, 1);
    };

    // =========================================================
    // LOAD STATE
    // =========================================================

    const savedState = StateSerializer.decode();

    if (savedState && savedState.length > 0) {
      savedState.forEach((sv) => {
        vecEngine.addVector({
          key: sv.key,
          label: sv.label,
          type: sv.type,
          origin: new BABYLON.Vector3(sv.ox, sv.oy, sv.oz),
          value: new BABYLON.Vector3(sv.x, sv.y, sv.z),
          display: {
            color: BABYLON.Color3.FromHexString(sv.color),
          },
          vector: null,
        });
      });
    } else {
      vecEngine.addVector({
        label: "Vector-1",
        key: "Vector-1",
        origin: BABYLON.Vector3.Zero(),
        value: new BABYLON.Vector3(3, 4, 2),
        type: "base",
        display: {
          color: BABYLON.Color3.FromHexString("#FF6B6B"),
        },
        vector: null,
      });
    }

    // =========================================================
    // UI
    // =========================================================

    new UI(scene, vecEngine, dragController, cameraController);

    // =========================================================
    // IDLE CAMERA — recording-safe orbit
    // =========================================================

    // Idle activates after 8 seconds of no interaction.
    // Speed is deliberately very slow — this is the key to shimmer-free
    // recordings. At 0.00015 rad/frame the grid never aliases temporally.

    let lastInteraction = performance.now();
    let idleActive = false;

    const IDLE_DELAY_MS = 8000;

    // Very slow rotation = zero temporal aliasing on the grid during recording.
    // This is slower than the previous value intentionally.
    const IDLE_SPEED = 0.00015;

    const resetIdleTimer = () => {
      lastInteraction = performance.now();

      if (idleActive) {
        idleActive = false;
        camera.attachControl(canvas);
      }
    };

    window.addEventListener("pointermove", resetIdleTimer, { passive: true });
    window.addEventListener("pointerdown", resetIdleTimer, { passive: true });
    window.addEventListener("keydown", resetIdleTimer, { passive: true });
    window.addEventListener("wheel", resetIdleTimer, { passive: true });

    scene.onBeforeRenderObservable.add(() => {
      if (
        cameraController.isFrozen() ||
        !cameraController.isIdleEnabled()
      ) {
        if (idleActive) {
          idleActive = false;
          camera.attachControl(canvas);
        }
        return;
      }

      const now = performance.now();
      const idle = now - lastInteraction > IDLE_DELAY_MS;

      if (idle && !idleActive) {
        idleActive = true;
        camera.detachControl();
      }

      if (idleActive) {
        camera.alpha += IDLE_SPEED;
      }
    });

    return scene;
  }
}

export { Playground };
