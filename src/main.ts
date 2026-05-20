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
    // ── Scene setup ──────────────────────────────────────────────────────
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

    // ── Camera ────────────────────────────────────────────────────────────
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
    camera.attachControl(canvas);

    // ── Lights ────────────────────────────────────────────────────────────
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

    // ── Ground ────────────────────────────────────────────────────────────
    // Quiet floor — just enough to give spatial grounding without competing
    // with the vectors. Very low opacity, dark base, barely-visible lines.
    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: 200, height: 200 },
      scene,
    );
    const grid = new GridMaterial("grid", scene);
    grid.gridRatio = 1;
    grid.opacity = 0.28;
    grid.mainColor = new BABYLON.Color3(0.05, 0.06, 0.09);
    grid.lineColor = new BABYLON.Color3(0.18, 0.2, 0.28);
    grid.majorUnitFrequency = 5;
    grid.minorUnitVisibility = 0.2;
    ground.material = grid;

    // ── Lab ────────────────────────────────────────────────────────────────
    const labSize = 50;
    new Lab(scene, labSize, grid);

    // ── Origin marker ──────────────────────────────────────────────────────
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

    // ── Core systems ───────────────────────────────────────────────────────
    const vecEngine = new VectorEngine(defaultOriginHeight);
    const renderer = new VectorRenderer(scene, defaultOriginHeight);
    const overlays = new VectorOverlays(scene, defaultOriginHeight, renderer);
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

    // ── Engine → Renderer wiring ───────────────────────────────────────────
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
      updateOverlays(); // re-draw overlays at new rendered positions
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

    // ── High-contrast mode ────────────────────────────────────────────────
    // When enabled, boost emissive on all arrows for better recording visibility
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

      // Also make the scene background slightly lighter for contrast
      scene.clearColor = enabled
        ? new BABYLON.Color4(0.03, 0.05, 0.1, 1)
        : new BABYLON.Color4(0, 0, 0, 1);
    };

    // ── Load state from URL hash if present ───────────────────────────────
    const savedState = StateSerializer.decode();
    if (savedState && savedState.length > 0) {
      savedState.forEach((sv) => {
        vecEngine.addVector({
          key: sv.key,
          label: sv.label,
          type: sv.type,
          origin: new BABYLON.Vector3(sv.ox, sv.oy, sv.oz),
          value: new BABYLON.Vector3(sv.x, sv.y, sv.z),
          display: { color: BABYLON.Color3.FromHexString(sv.color) },
          vector: null,
        });
      });
    } else {
      // Default vectors
      vecEngine.addVector({
        label: "Vector-1",
        key: "Vector-1",
        origin: BABYLON.Vector3.Zero(),
        value: new BABYLON.Vector3(3, 4, 2),
        type: "base",
        display: { color: BABYLON.Color3.FromHexString("#FF6B6B") },
        vector: null,
      });
    }

    // ── UI ────────────────────────────────────────────────────────────────
    new UI(scene, vecEngine, dragController, cameraController);

    // ── Shared color generator (used by keyboard shortcuts below) ─────────
    let _lastHue: number | null = null;
    const randomLightColor3 = (minHueGap = 40): BABYLON.Color3 => {
      const pickHue = (): number => {
        const h = Math.floor(Math.random() * 360);
        if (_lastHue === null) return h;
        const diff = Math.abs(h - _lastHue);
        return diff >= minHueGap && Math.abs(diff - 360) >= minHueGap
          ? h
          : pickHue();
      };
      const h = pickHue();
      _lastHue = h;
      const s = 60 + Math.random() * 40;
      const l = 72 + Math.random() * 16;
      const hNorm = h / 360, sNorm = s / 100, lNorm = l / 100;
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      let r, g, b;
      if (sNorm === 0) {
        r = g = b = lNorm;
      } else {
        const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
        const p = 2 * lNorm - q;
        r = hue2rgb(p, q, hNorm + 1 / 3);
        g = hue2rgb(p, q, hNorm);
        b = hue2rgb(p, q, hNorm - 1 / 3);
      }
      return new BABYLON.Color3(r, g, b);
    };

    // ── Keyboard shortcuts ────────────────────────────────────────────────
    // F       → focus selected vector (animated zoom to arrow midpoint)
    // Esc     → deselect + reset view
    // Ctrl+D  → duplicate selected vector on same vertical axis (empty spot)
    // Ctrl+Shift+D (Ctrl+D uppercase) → duplicate selected vector anywhere
    // Ctrl+O  → duplicate selected vector (opposite direction) on same vertical axis
    // Ctrl+Shift+O (Ctrl+O uppercase) → duplicate opposite direction anywhere
    window.addEventListener("keydown", (e) => {
      // Don't fire when typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "f" || e.key === "F") {
        const key = vecEngine.getSelectedKey();
        if (!key) return;
        const arrow = vecEngine.getVector(key);
        if (!arrow) return;
        const renderedOrigin = renderer
          .getRenderedOrigin(key, arrow.origin)
          .add(new BABYLON.Vector3(0, defaultOriginHeight, 0));
        cameraController.focusVector(renderedOrigin, arrow.value);
      }

      if (e.key === "Escape") {
        vecEngine.selectVector(null);
        cameraController.resetView();
      }

      // ── Ctrl+d / Ctrl+D  →  duplicate ────────────────────────────────
      // e.key === "d"  when Ctrl+d (lowercase, same axis)
      // e.key === "D"  when Ctrl+Shift+D (uppercase, anywhere)
      if (e.ctrlKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        const sameAxis = e.key === "d"; // lowercase = same vertical axis
        vecEngine.duplicateSelected(sameAxis, randomLightColor3);
      }

      // ── Ctrl+o / Ctrl+O  →  duplicate opposite ────────────────────────
      // e.key === "o"  when Ctrl+o (lowercase, same axis)
      // e.key === "O"  when Ctrl+Shift+O (uppercase, anywhere)
      if (e.ctrlKey && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        const sameAxis = e.key === "o"; // lowercase = same vertical axis
        vecEngine.duplicateOppositeSelected(sameAxis, randomLightColor3);
      }
    });

    // ── Idle animation ────────────────────────────────────────────────────
    // Very slow camera orbit when nothing has happened for 8 seconds.
    // Stops the moment the user moves the mouse or touches a key.
    // The rotation is so slow (~3°/s) that it just gives the scene life
    // without making the axes or vectors hard to read.
    let lastInteraction = performance.now();
    let idleActive = false;
    const IDLE_DELAY_MS = 8000;
    const IDLE_SPEED = 0.001; // radians per frame at 60fps ≈ ~10°/s feels calm

    const resetIdleTimer = () => {
      lastInteraction = performance.now();
      if (idleActive) {
        idleActive = false;
        // Smoothly re-attach camera control
        camera.attachControl(canvas);
      }
    };

    window.addEventListener("pointermove", resetIdleTimer, { passive: true });
    window.addEventListener("pointerdown", resetIdleTimer, { passive: true });
    window.addEventListener("keydown", resetIdleTimer, { passive: true });
    window.addEventListener("wheel", resetIdleTimer, { passive: true });

    scene.onBeforeRenderObservable.add(() => {
      // Don't idle when frozen or when the toggle is off
      if (cameraController.isFrozen() || !cameraController.isIdleEnabled()) {
        // If idle was active but got disabled, re-attach control and reset flag
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
