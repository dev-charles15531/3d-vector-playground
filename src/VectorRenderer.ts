import * as BABYLON from "@babylonjs/core";
import { type Arrow } from "./types";
import { VectorArrow } from "./VectorArrow";

export class VectorRenderer {
  private scene: BABYLON.Scene;
  private defaultOriginHeight: number;
  private defaultArrowHeight = 1;
  private headToTail = false;

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
  }

  setHeadToTail(enabled: boolean) {
    this.headToTail = enabled;
  }

  refresh(vectors: Arrow[]) {
    if (this.headToTail) {
      let currentOrigin = new BABYLON.Vector3(0, 0, 0);
      vectors.forEach((v) => {
        if (v.vector) {
          v.vector.update(currentOrigin, v.value);
          currentOrigin = currentOrigin.add(v.value);
        }
      });
      return;
    }

    vectors.forEach((v) => {
      if (v.vector) {
        v.vector.update(v.origin, v.value);
      }
    });
  }

  update(v: Arrow) {
    v.vector?.update(v.origin, v.value);
  }

  remove(v: Arrow) {
    v.vector?.root.dispose();
    v.vector = null;
  }
}
