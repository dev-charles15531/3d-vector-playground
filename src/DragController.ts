// DragController.ts
// Handles click-to-select and drag-to-update for arrow meshes.
// - Normal drag:   XZ plane  (horizontal) — changes vector VALUE (tip position)
// - Shift+drag:    vertical plane facing the camera — Y axis movement of value
// - Ctrl+drag:     moves the entire vector (ORIGIN) on XZ plane, value unchanged
// - Ctrl+Shift+drag: moves the entire vector (ORIGIN) on vertical plane
// - Grid snap:     when snapToGrid is enabled, rounds to nearest integer

import * as BABYLON from "@babylonjs/core";
import { VectorEngine } from "./VectorEngine";
import { VectorRenderer } from "./VectorRenderer";

export class DragController {
  private scene: BABYLON.Scene;
  private camera: BABYLON.ArcRotateCamera;
  private canvas: HTMLCanvasElement;
  private engine: VectorEngine;
  private renderer: VectorRenderer;
  private defaultOriginHeight: number;

  private isDragging = false;
  private dragKey: string | null = null;
  private dragStartPick: BABYLON.Vector3 | null = null;
  private dragStartValue: BABYLON.Vector3 | null = null;
  private dragStartOrigin: BABYLON.Vector3 | null = null;
  private shiftHeld = false;
  private ctrlHeld = false;
  private snapToGrid = false;

  constructor(
    scene: BABYLON.Scene,
    camera: BABYLON.ArcRotateCamera,
    canvas: HTMLCanvasElement,
    engine: VectorEngine,
    renderer: VectorRenderer,
    defaultOriginHeight: number,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.engine = engine;
    this.renderer = renderer;
    this.defaultOriginHeight = defaultOriginHeight;

    this.attach();
  }

  public setSnapToGrid(enabled: boolean) {
    this.snapToGrid = enabled;
  }

  public getSnapToGrid(): boolean {
    return this.snapToGrid;
  }

  private snap(v: BABYLON.Vector3): BABYLON.Vector3 {
    if (!this.snapToGrid) return v;
    return new BABYLON.Vector3(
      Math.round(v.x),
      Math.round(v.y),
      Math.round(v.z),
    );
  }

  /** XZ horizontal drag plane at the lab mid-height */
  private getXZPlane(): BABYLON.Plane {
    return BABYLON.Plane.FromPositionAndNormal(
      new BABYLON.Vector3(0, this.defaultOriginHeight, 0),
      BABYLON.Vector3.Up(),
    );
  }

  /** Vertical plane that faces the camera, for Y-axis dragging */
  private getVerticalPlane(): BABYLON.Plane {
    const camDir = this.camera.position.subtract(this.camera.target);
    const normal = new BABYLON.Vector3(camDir.x, 0, camDir.z).normalize();
    return BABYLON.Plane.FromPositionAndNormal(
      new BABYLON.Vector3(0, this.defaultOriginHeight, 0),
      normal,
    );
  }

  private raycastPlane(plane: BABYLON.Plane): BABYLON.Vector3 | null {
    const ray = this.scene.createPickingRay(
      this.scene.pointerX,
      this.scene.pointerY,
      BABYLON.Matrix.Identity(),
      this.camera,
    );
    const dist = ray.intersectsPlane(plane);
    if (dist === null || dist === undefined) return null;
    return ray.origin.add(ray.direction.scale(dist));
  }

  private attach() {
    // Track modifier keys globally
    window.addEventListener("keydown", (e) => {
      if (e.key === "Shift") this.shiftHeld = true;
      if (e.key === "Control") this.ctrlHeld = true;
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === "Shift") this.shiftHeld = false;
      if (e.key === "Control") this.ctrlHeld = false;
    });

    this.scene.onPointerObservable.add((pointerInfo) => {
      const { type } = pointerInfo;

      // ── POINTER DOWN ────────────────────────────────────────────────────
      if (type === BABYLON.PointerEventTypes.POINTERDOWN) {
        const hit = this.scene.pick(this.scene.pointerX, this.scene.pointerY);

        if (!hit?.hit || !hit.pickedMesh) {
          this.engine.selectVector(null);
          return;
        }

        const key = this.renderer.getKeyForMesh(hit.pickedMesh as BABYLON.Mesh);
        if (!key) {
          this.engine.selectVector(null);
          return;
        }

        this.engine.selectVector(key);

        // Begin drag
        const plane = this.shiftHeld ? this.getVerticalPlane() : this.getXZPlane();
        const pick = this.raycastPlane(plane);
        if (!pick) return;

        this.dragKey = key;
        this.dragStartPick = pick;
        this.dragStartValue = this.engine.getVector(key)!.value.clone();
        this.dragStartOrigin = this.engine.getVector(key)!.origin.clone();
        this.isDragging = true;
        this.camera.detachControl(); // prevent camera panning during drag
      }

      // ── POINTER MOVE ────────────────────────────────────────────────────
      if (type === BABYLON.PointerEventTypes.POINTERMOVE && this.isDragging) {
        if (!this.dragKey || !this.dragStartPick || !this.dragStartValue || !this.dragStartOrigin) return;

        const plane = this.shiftHeld ? this.getVerticalPlane() : this.getXZPlane();
        const currentPick = this.raycastPlane(plane);
        if (!currentPick) return;

        const delta = currentPick.subtract(this.dragStartPick);

        if (this.ctrlHeld) {
          // ── CTRL+DRAG: move the entire vector by translating its origin ──
          let newOrigin: BABYLON.Vector3;

          if (this.shiftHeld) {
            // Ctrl+Shift+drag: move origin vertically
            newOrigin = new BABYLON.Vector3(
              this.dragStartOrigin.x,
              this.dragStartOrigin.y + delta.y,
              this.dragStartOrigin.z,
            );
          } else {
            // Ctrl+drag: move origin on XZ plane
            newOrigin = new BABYLON.Vector3(
              this.dragStartOrigin.x + delta.x,
              this.dragStartOrigin.y,
              this.dragStartOrigin.z + delta.z,
            );
          }

          newOrigin = this.snap(newOrigin);
          this.engine.updateVector(this.dragKey, { origin: newOrigin });
        } else {
          // ── NORMAL DRAG: change the vector VALUE (tip) ──────────────────
          let newValue: BABYLON.Vector3;

          if (this.shiftHeld) {
            // Y-axis drag: keep X and Z, apply vertical delta
            newValue = new BABYLON.Vector3(
              this.dragStartValue.x,
              this.dragStartValue.y + delta.y,
              this.dragStartValue.z,
            );
          } else {
            // XZ drag: keep Y, apply horizontal delta
            newValue = new BABYLON.Vector3(
              this.dragStartValue.x + delta.x,
              this.dragStartValue.y,
              this.dragStartValue.z + delta.z,
            );
          }

          newValue = this.snap(newValue);
          this.engine.updateVector(this.dragKey, { value: newValue });
        }
      }

      // ── POINTER UP ──────────────────────────────────────────────────────
      if (type === BABYLON.PointerEventTypes.POINTERUP && this.isDragging) {
        this.isDragging = false;
        this.dragKey = null;
        this.dragStartPick = null;
        this.dragStartValue = null;
        this.dragStartOrigin = null;
        this.camera.attachControl(this.canvas);
      }
    });
  }
}
