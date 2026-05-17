// VectorArrow.ts

import { type Arrow } from "./types";
import * as BABYLON from "@babylonjs/core";

export class VectorArrow {
  public root: BABYLON.TransformNode;

  private shaft: BABYLON.Mesh;
  private head: BABYLON.Mesh;

  private shaftHeight: number;
  private headHeight: number;

  private arrowStateObj: Arrow;
  private defaultOriginHeight: number;

  constructor(
    scene: BABYLON.Scene,
    options: {
      shaftDiameter?: number;
      headHeight?: number;
      headDiameter?: number;
      shaftColor?: BABYLON.Color3;
      headColor?: BABYLON.Color4;
    } = {},
    arrowStateObj: Arrow,
    defaultOriginHeight: number,
  ) {
    this.root = new BABYLON.TransformNode(
      `arrow-root-${arrowStateObj.key}`,
      scene,
    );

    const shaftDiameter = options.shaftDiameter ?? 0.08;
    const headDiameter = options.headDiameter ?? 0.16;

    this.headHeight = options.headHeight ?? 0.4;
    this.shaftHeight = 1;

    // SHAFT
    this.shaft = BABYLON.MeshBuilder.CreateCylinder(
      `shaft-${arrowStateObj.key}`,
      {
        height: this.shaftHeight,
        diameter: shaftDiameter,
      },
      scene,
    );

    this.shaft.position.y = this.shaftHeight / 2;
    this.shaft.parent = this.root;

    // HEAD
    this.head = BABYLON.MeshBuilder.CreateCylinder(
      `head-${arrowStateObj.key}`,
      {
        height: this.headHeight,
        diameterTop: 0,
        diameterBottom: headDiameter,
      },
      scene,
    );

    this.head.parent = this.root;

    // MATERIALS
    const shaftMat = new BABYLON.StandardMaterial(`shaftMat-${arrowStateObj.key}`, scene);
    shaftMat.diffuseColor =
      options.shaftColor ?? new BABYLON.Color3(0.2, 0.6, 1);
    this.shaft.material = shaftMat;

    const headMat = new BABYLON.StandardMaterial(`headMat-${arrowStateObj.key}`, scene);
    const hc = options.headColor;
    headMat.diffuseColor = hc
      ? new BABYLON.Color3(hc.r, hc.g, hc.b)
      : new BABYLON.Color3(1, 0.3, 0.3);
    this.head.material = headMat;

    this.arrowStateObj = arrowStateObj;
    this.defaultOriginHeight = defaultOriginHeight;

    this.update(this.arrowStateObj.origin, this.arrowStateObj.value);
  }

  /** Return all meshes that should be pickable for this arrow */
  public getMeshes(): BABYLON.Mesh[] {
    return [this.shaft, this.head];
  }

  /** Return the key of the arrow this VectorArrow represents */
  public getArrowKey(): string {
    return this.arrowStateObj.key;
  }

  public update(origin: BABYLON.Vector3, value: BABYLON.Vector3): void {
    const length = value.length();

    if (length < 0.0001) {
      this.root.setEnabled(false);
      return;
    }

    this.root.setEnabled(true);

    const direction = value.clone().normalize();

    const up = BABYLON.Vector3.Up();
    const axis = BABYLON.Vector3.Cross(up, direction);
    const angle = Math.acos(
      Math.max(-1, Math.min(1, BABYLON.Vector3.Dot(up, direction)))
    );

    if (axis.lengthSquared() < 0.0001) {
      this.root.rotationQuaternion =
        direction.y >= 0
          ? BABYLON.Quaternion.Identity()
          : BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, Math.PI);
    } else {
      this.root.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
        axis.normalize(),
        angle,
      );
    }

    const shaftLength = Math.max(0, length - this.headHeight);

    this.shaft.scaling.y = shaftLength;
    this.shaft.position.y = shaftLength / 2;
    this.head.position.y = shaftLength + this.headHeight / 2;

    this.root.position = origin.add(
      new BABYLON.Vector3(0, this.defaultOriginHeight, 0),
    );
  }

  public setSelected(selected: boolean): void {
    const shaftMat = this.shaft.material as BABYLON.StandardMaterial;
    const headMat = this.head.material as BABYLON.StandardMaterial;

    if (selected) {
      shaftMat.emissiveColor = shaftMat.diffuseColor.scale(0.5);
      headMat.emissiveColor = headMat.diffuseColor.scale(0.65);
      this.shaft.scaling.x = 1.1;
      this.shaft.scaling.z = 1.1;
      this.head.scaling.scaleInPlace(1.2);
    } else {
      shaftMat.emissiveColor = BABYLON.Color3.Black();
      headMat.emissiveColor = BABYLON.Color3.Black();
      this.shaft.scaling.x = 1;
      this.shaft.scaling.z = 1;
      this.head.scaling = BABYLON.Vector3.One();
    }
  }

  public dispose(): void {
    this.shaft.dispose();
    this.head.dispose();
    this.root.dispose();
  }
}
