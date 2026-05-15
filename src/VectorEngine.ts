import * as BABYLON from "@babylonjs/core";
import { type Arrow } from "./types";

export class VectorEngine {
  private vectors = new Map<string, Arrow>();
  private maxMagnitude;
  private headToTail = false;

  public onVectorAdded?: (v: Arrow) => void;
  public onVectorUpdated?: (v: Arrow) => void;
  public onVectorRemoved?: (v: Arrow) => void;
  public onModeChanged?: () => void;

  constructor(maxMagnitude = 10) {
    this.maxMagnitude = maxMagnitude;
  }

  addVector(v: Arrow) {
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

    Object.assign(v, updates);

    this.recompute();
    this.onVectorUpdated?.(v);
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
      if (v.type === "derived") {
        this.compute(v);
      }

      this.onVectorUpdated?.(v);
    });
  }

  private compute(v: Arrow) {
    if (!v.dependencies || !v.operation) return;

    const deps = v.dependencies.map((d) => this.vectors.get(d)!);

    switch (v.operation) {
      case "add":
        v.value = deps[0].value.add(deps[1].value);
        break;

      case "subtract":
        v.value = deps[0].value.subtract(deps[1].value);
        break;

      case "cross":
        v.value = BABYLON.Vector3.Cross(deps[0].value, deps[1].value);
        break;

      case "projection": {
        const a = deps[0].value;
        const b = deps[1].value;
        v.value = b.scale(BABYLON.Vector3.Dot(a, b) / b.lengthSquared());
        break;
      }
    }
  }
}
