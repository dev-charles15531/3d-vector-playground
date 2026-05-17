// CameraController.ts
// Provides:
//   - Preset camera views: Top (XZ), Front (XY), Side (YZ)
//   - Smooth animated transitions between views
//   - High-contrast mode toggle (thicker arrows, stronger colors)
//   - Freeze mode (disables all pointer interaction)

import * as BABYLON from "@babylonjs/core";

export type CameraPreset = "free" | "top" | "front" | "side";

export class CameraController {
  private camera: BABYLON.ArcRotateCamera;
  private scene: BABYLON.Scene;
  private canvas: HTMLCanvasElement;
  private defaultRadius: number;
  private targetY: number;

  private frozen = false;
  private highContrast = false;

  public onFreezeChanged?: (frozen: boolean) => void;
  public onHighContrastChanged?: (enabled: boolean) => void;

  constructor(
    camera: BABYLON.ArcRotateCamera,
    scene: BABYLON.Scene,
    canvas: HTMLCanvasElement,
    targetY: number,
  ) {
    this.camera = camera;
    this.scene = scene;
    this.canvas = canvas;
    this.defaultRadius = camera.radius;
    this.targetY = targetY;
  }

  /** Smoothly animate to a preset view */
  public goToPreset(preset: CameraPreset, durationMs = 600): void {
    let targetAlpha: number;
    let targetBeta: number;
    let targetRadius = this.defaultRadius;

    switch (preset) {
      case "top":
        targetAlpha = -Math.PI / 2;
        targetBeta = 0.01;
        break;
      case "front":
        targetAlpha = -Math.PI / 2;
        targetBeta = Math.PI / 2;
        break;
      case "side":
        targetAlpha = 0;
        targetBeta = Math.PI / 2;
        break;
      case "free":
      default:
        targetAlpha = -Math.PI / 2;
        targetBeta = Math.PI / 3;
        break;
    }

    this.animateCamera(
      targetAlpha,
      targetBeta,
      targetRadius,
      this.camera.target.clone(),
      durationMs,
    );
  }

  /**
   * Animated zoom to a specific vector: orbits to a 3/4 angle facing the arrow
   * and sets the camera target to the arrow's midpoint so the whole arrow fills
   * the view comfortably. Press F (or the UI button) to trigger this.
   */
  public focusVector(
    renderedOrigin: BABYLON.Vector3,
    value: BABYLON.Vector3,
    durationMs = 750,
  ): void {
    const length = value.length();
    if (length < 0.001) return;

    // Target = midpoint of the arrow in world space
    const target = renderedOrigin.add(value.scale(0.5));

    // Radius: just enough to see the full arrow with breathing room
    const targetRadius = Math.max(length * 1.8, 4);

    // Angle: keep current beta (elevation), orient alpha to face the arrow's XZ direction
    const xzAngle = Math.atan2(value.z, value.x);
    const targetAlpha = -xzAngle + Math.PI * 0.55; // offset so we're slightly to the side
    const targetBeta = Math.PI / 4; // comfortable 45° elevation

    this.animateCamera(
      targetAlpha,
      targetBeta,
      targetRadius,
      target,
      durationMs,
    );
  }

  /**
   * Restore camera to its default position / target.
   */
  public resetView(durationMs = 600): void {
    this.animateCamera(
      -Math.PI / 2,
      Math.PI / 3,
      this.defaultRadius,
      new BABYLON.Vector3(0, this.targetY, 0),
      durationMs,
    );
  }

  private animateCamera(
    targetAlpha: number,
    targetBeta: number,
    targetRadius: number,
    targetPoint: BABYLON.Vector3,
    durationMs: number,
  ) {
    const startAlpha = this.camera.alpha;
    const startBeta = this.camera.beta;
    const startRadius = this.camera.radius;
    const startTarget = this.camera.target.clone();
    const startTime = performance.now();

    const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    // Cancel any previous animation by removing all render observers that share
    // the same tag — simplest approach is to track the observer reference.
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const e = ease(t);

      this.camera.alpha = startAlpha + (targetAlpha - startAlpha) * e;
      this.camera.beta = startBeta + (targetBeta - startBeta) * e;
      this.camera.radius = startRadius + (targetRadius - startRadius) * e;
      this.camera.target = BABYLON.Vector3.Lerp(startTarget, targetPoint, e);

      if (t >= 1) {
        this.scene.onBeforeRenderObservable.remove(obs);
      }
    });
  }

  /** Toggle freeze mode — disables camera and scene pointer events */
  public toggleFreeze(): boolean {
    this.frozen = !this.frozen;
    if (this.frozen) {
      this.camera.detachControl();
    } else {
      this.camera.attachControl(this.canvas);
    }
    this.onFreezeChanged?.(this.frozen);
    return this.frozen;
  }

  public isFrozen(): boolean {
    return this.frozen;
  }

  /** Toggle high-contrast mode for recording */
  public toggleHighContrast(): boolean {
    this.highContrast = !this.highContrast;
    this.onHighContrastChanged?.(this.highContrast);
    return this.highContrast;
  }

  public isHighContrast(): boolean {
    return this.highContrast;
  }
}
