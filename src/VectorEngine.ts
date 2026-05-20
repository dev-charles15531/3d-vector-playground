// VectorEngine.ts
import * as BABYLON from "@babylonjs/core";
import { type Arrow } from "./types";

export class VectorEngine {
  private vectors = new Map<string, Arrow>();
  private maxMagnitude: number;
  private headToTail = false;
  private selectedKey: string | null = null;
  private selectionListeners: Array<(key: string | null) => void> = [];

  public onVectorAdded?: (v: Arrow) => void;
  public onVectorUpdated?: (v: Arrow) => void;
  public onVectorRemoved?: (v: Arrow) => void;
  public onModeChanged?: () => void;

  constructor(maxMagnitude = 10) {
    this.maxMagnitude = maxMagnitude;
  }

  addVector(v: Arrow) {
    if (!v.lockedAxes) v.lockedAxes = [];
    this.vectors.set(v.key, v);
    this.onVectorAdded?.(v);
  }

  removeVector(key: string) {
    const v = this.vectors.get(key);
    if (!v) return;
    this.vectors.delete(key);
    this.onVectorRemoved?.(v);
  }

  updateVector(key: string, updates: Partial<Arrow>) {
    const v = this.vectors.get(key);
    if (!v) return;

    // Respect axis locks when updating value
    if (updates.value && v.lockedAxes && v.lockedAxes.length > 0) {
      const newVal = updates.value.clone();
      for (const axis of v.lockedAxes) {
        newVal[axis] = v.value[axis]; // preserve locked axis
      }
      updates.value = newVal;
    }

    Object.assign(v, updates);
    this.recompute();
    this.onVectorUpdated?.(v);
  }

  /** Toggle a per-vector axis lock. Locked axes cannot be changed by drag. */
  toggleAxisLock(key: string, axis: "x" | "y" | "z") {
    const v = this.vectors.get(key);
    if (!v) return;
    if (!v.lockedAxes) v.lockedAxes = [];
    const idx = v.lockedAxes.indexOf(axis);
    if (idx === -1) {
      v.lockedAxes.push(axis);
    } else {
      v.lockedAxes.splice(idx, 1);
    }
    this.onVectorUpdated?.(v);
  }

  selectVector(key: string | null) {
    if (this.selectedKey === key) return;
    this.selectedKey = key;
    for (const listener of this.selectionListeners) {
      listener(key);
    }
  }

  toggleVectorSelection(key: string) {
    this.selectVector(this.selectedKey === key ? null : key);
  }

  onSelectionChanged(listener: (key: string | null) => void) {
    this.selectionListeners.push(listener);
  }

  getSelectedKey(): string | null {
    return this.selectedKey;
  }

  getVector(key: string): Arrow | undefined {
    return this.vectors.get(key);
  }

  getVectors(): Arrow[] {
    return Array.from(this.vectors.values());
  }

  getMaxMagnitude(): number {
    return this.maxMagnitude;
  }

  getHeadToTail(): boolean {
    return this.headToTail;
  }

  setHeadToTail(value: boolean) {
    if (this.headToTail === value) return;
    this.headToTail = value;
    this.onModeChanged?.();
  }

  recompute() {
    this.vectors.forEach((v) => {
      if (v.type === "derived") this.compute(v);
      this.onVectorUpdated?.(v);
    });
  }

  private compute(v: Arrow) {
    if (!v.dependencies || !v.operation) return;
    const deps = v.dependencies.map((d) => this.vectors.get(d)!);
    if (deps.some((d) => !d)) return;
    switch (v.operation) {
      case "add": v.value = deps[0].value.add(deps[1].value); break;
      case "subtract": v.value = deps[0].value.subtract(deps[1].value); break;
      case "cross": v.value = BABYLON.Vector3.Cross(deps[0].value, deps[1].value); break;
      case "projection": {
        const a = deps[0].value, b = deps[1].value;
        const denom = b.lengthSquared();
        v.value = denom === 0 ? BABYLON.Vector3.Zero()
          : b.scale(BABYLON.Vector3.Dot(a, b) / denom);
        break;
      }
    }
  }

  // ── Duplicate / Opposite helpers ─────────────────────────────────────────

  /**
   * Find an empty origin position for a new vector.
   *
   * @param constrainToSameAxis  When true, only search along the same vertical
   *   axis (X/Z fixed to source origin).  When false, search anywhere in the XZ plane.
   * @param sourceOrigin  The XZ position to align to when constraining.
   * @param minClearance  Minimum distance from any existing origin.
   */
  private findEmptyOrigin(
    constrainToSameAxis: boolean,
    sourceOrigin: BABYLON.Vector3,
    minClearance = 2.5,
  ): BABYLON.Vector3 {
    const existing = this.getVectors().map((v) => v.origin);

    const isClear = (candidate: BABYLON.Vector3): boolean => {
      for (const o of existing) {
        const dx = candidate.x - o.x;
        const dz = candidate.z - o.z;
        if (Math.sqrt(dx * dx + dz * dz) < minClearance) return false;
      }
      return true;
    };

    if (constrainToSameAxis) {
      // Search along the same vertical axis: try offsets in Z then X
      const offsets = [3, -3, 6, -6, 9, -9, 12, -12, 15, -15];
      for (const dz of offsets) {
        const c = new BABYLON.Vector3(sourceOrigin.x, sourceOrigin.y, sourceOrigin.z + dz);
        if (isClear(c)) return c;
      }
      for (const dx of offsets) {
        const c = new BABYLON.Vector3(sourceOrigin.x + dx, sourceOrigin.y, sourceOrigin.z);
        if (isClear(c)) return c;
      }
      // Fallback: just push far enough
      return new BABYLON.Vector3(sourceOrigin.x, sourceOrigin.y, sourceOrigin.z + 20);
    }

    // Search anywhere in the XZ plane using a spiral-ish grid
    const step = minClearance;
    for (let radius = step; radius <= 40; radius += step) {
      const candidates: BABYLON.Vector3[] = [];
      const steps = Math.ceil((2 * Math.PI * radius) / step);
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        candidates.push(new BABYLON.Vector3(
          sourceOrigin.x + Math.round(Math.cos(angle) * radius / step) * step,
          sourceOrigin.y,
          sourceOrigin.z + Math.round(Math.sin(angle) * radius / step) * step,
        ));
      }
      for (const c of candidates) {
        if (isClear(c)) return c;
      }
    }
    // Fallback
    return new BABYLON.Vector3(sourceOrigin.x + 20, sourceOrigin.y, sourceOrigin.z + 20);
  }

  /**
   * Duplicate the selected vector.
   * @param constrainToSameAxis  ctrl+d = same vertical axis, ctrl+D = anywhere
   */
  duplicateSelected(constrainToSameAxis: boolean, randomColor: () => BABYLON.Color3) {
    const key = this.selectedKey;
    if (!key) return;
    const src = this.getVector(key);
    if (!src) return;

    const newOrigin = this.findEmptyOrigin(constrainToSameAxis, src.origin);
    const count = this.getVectors().length + 1;
    const newKey = `${src.label}-copy-${count}`;

    this.addVector({
      key: newKey,
      label: newKey,
      type: "base",
      origin: newOrigin,
      value: src.value.clone(),
      display: { color: randomColor() },
      vector: null,
    });

    this.selectVector(newKey);
  }

  /**
   * Duplicate the selected vector with its direction negated (opposite).
   * @param constrainToSameAxis  ctrl+o = same vertical axis, ctrl+O = anywhere
   */
  duplicateOppositeSelected(constrainToSameAxis: boolean, randomColor: () => BABYLON.Color3) {
    const key = this.selectedKey;
    if (!key) return;
    const src = this.getVector(key);
    if (!src) return;

    const newOrigin = this.findEmptyOrigin(constrainToSameAxis, src.origin);
    const count = this.getVectors().length + 1;
    const newKey = `${src.label}-opp-${count}`;

    this.addVector({
      key: newKey,
      label: newKey,
      type: "base",
      origin: newOrigin,
      value: src.value.negate(),  // opposite direction
      display: { color: randomColor() },
      vector: null,
    });

    this.selectVector(newKey);
  }
}
