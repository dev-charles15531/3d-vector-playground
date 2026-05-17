// VectorRenderer.ts
import * as BABYLON from "@babylonjs/core";
import { type Arrow } from "./types";
import { VectorArrow } from "./VectorArrow";

export class VectorRenderer {
  private scene: BABYLON.Scene;
  private defaultOriginHeight: number;
  private defaultArrowHeight = 1;
  private headToTail = false;

  /** mesh → arrow key for picking */
  private meshToKey = new Map<BABYLON.Mesh, string>();

  constructor(scene: BABYLON.Scene, defaultOriginHeight: number) {
    this.scene = scene;
    this.defaultOriginHeight = defaultOriginHeight;
  }

  add(v: Arrow) {
    const color = v.display?.color || BABYLON.Color3.FromHexString("#ffffff");
    const mesh = new VectorArrow(
      this.scene,
      {
        shaftDiameter: 0.2,
        headHeight: this.defaultArrowHeight * 0.4,
        headDiameter: 0.35,
        shaftColor: color,
        headColor: new BABYLON.Color4(color.r, color.g, color.b, 0.6),
      },
      v,
      this.defaultOriginHeight,
    );
    v.vector = mesh;

    // Register meshes for picking
    for (const m of mesh.getMeshes()) {
      this.meshToKey.set(m, v.key);
    }
  }

  setHeadToTail(enabled: boolean) {
    this.headToTail = enabled;
  }

  refresh(vectors: Arrow[]) {
    if (this.headToTail) {
      const chainStart = new BABYLON.Vector3(0, 0, 0);
      let currentOrigin = chainStart.clone();
      for (const v of vectors) {
        if (!v.vector) continue;
        if (v.type === "derived") continue;
        v.vector.update(currentOrigin, v.value);
        currentOrigin = currentOrigin.add(v.value);
      }
      for (const v of vectors) {
        if (!v.vector) continue;
        if (v.type !== "derived") continue;
        v.vector.update(chainStart, v.value);
      }
      return;
    }
    vectors.forEach((v) => {
      v.vector?.update(v.origin, v.value);
    });
  }

  update(v: Arrow) {
    v.vector?.update(v.origin, v.value);
  }

  remove(v: Arrow) {
    if (v.vector) {
      for (const m of v.vector.getMeshes()) {
        this.meshToKey.delete(m);
      }
    }
    v.vector?.dispose();
    v.vector = null;
  }

  highlight(selectedKey: string | null, vectors: Arrow[]) {
    vectors.forEach((v) => {
      v.vector?.setSelected(v.key === selectedKey);
    });
  }

  /** Look up which arrow key a picked mesh belongs to */
  public getKeyForMesh(mesh: BABYLON.Mesh): string | undefined {
    return this.meshToKey.get(mesh);
  }
}
