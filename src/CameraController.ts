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
        // Bird's-eye: looking straight down
        targetAlpha = -Math.PI / 2;
        targetBeta = 0.01; // near-zero to avoid gimbal lock
        break;
      case "front":
        // Front face: XY plane
        targetAlpha = -Math.PI / 2;
        targetBeta = Math.PI / 2;
        break;
      case "side":
        // Side face: YZ plane
        targetAlpha = 0;
        targetBeta = Math.PI / 2;
        break;
      case "free":
      default:
        targetAlpha = -Math.PI / 2;
        targetBeta = Math.PI / 3;
        break;
    }

    this.animateCamera(targetAlpha, targetBeta, targetRadius, durationMs);
  }

  private animateCamera(
    targetAlpha: number,
    targetBeta: number,
    targetRadius: number,
    durationMs: number,
  ) {
    const startAlpha = this.camera.alpha;
    const startBeta = this.camera.beta;
    const startRadius = this.camera.radius;
    const startTime = performance.now();

    const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / durationMs, 1);
      const e = ease(t);

      this.camera.alpha = startAlpha + (targetAlpha - startAlpha) * e;
      this.camera.beta = startBeta + (targetBeta - startBeta) * e;
      this.camera.radius = startRadius + (targetRadius - startRadius) * e;

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
