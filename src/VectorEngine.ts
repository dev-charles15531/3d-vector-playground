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
}
