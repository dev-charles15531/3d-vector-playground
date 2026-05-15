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
    defaultOriginHeight: number
  ) {
    this.root = new BABYLON.TransformNode(`arrow-root-${arrowStateObj.key}`, scene);

    const shaftDiameter = options.shaftDiameter ?? 0.08;
    const headDiameter = options.headDiameter ?? 0.16;

    this.headHeight = options.headHeight ?? 0.4;
    this.shaftHeight = 1; // normalized (we scale later)

    // SHAFT
    this.shaft = BABYLON.MeshBuilder.CreateCylinder("shaft", {
      height: this.shaftHeight,
      diameter: shaftDiameter
    }, scene);

    // base at y=0
    this.shaft.position.y = this.shaftHeight / 2;
    this.shaft.parent = this.root;

    // HEAD
    this.head = BABYLON.MeshBuilder.CreateCylinder("head", {
      height: this.headHeight,
      diameterTop: 0,
      diameterBottom: headDiameter
    }, scene);

    this.head.parent = this.root;

    // MATERIALS
    const shaftMat = new BABYLON.StandardMaterial("shaftMat", scene);
    shaftMat.diffuseColor = options.shaftColor ?? new BABYLON.Color3(0.2, 0.6, 1);
    this.shaft.material = shaftMat;

    const headMat = new BABYLON.StandardMaterial("headMat", scene);
    const hc = options.headColor;
    headMat.diffuseColor = hc
      ? new BABYLON.Color3(hc.r, hc.g, hc.b)
      : new BABYLON.Color3(1, 0.3, 0.3);
    this.head.material = headMat;

    this.arrowStateObj = arrowStateObj;
    this.defaultOriginHeight = defaultOriginHeight;

    // initial state
    this.update(this.arrowStateObj.origin, this.arrowStateObj.value);
  }

  public update(origin: BABYLON.Vector3, value: BABYLON.Vector3): void {
    const length = value.length();

    if (length < 0.0001) {
      this.root.setEnabled(false);
      return;
    }

    this.root.setEnabled(true);

    // SAFE NORMALIZATION (NO MUTATION)
    const direction = value.clone().normalize();

    // ROTATION
    const up = BABYLON.Vector3.Up();
    const axis = BABYLON.Vector3.Cross(up, direction);
    const angle = Math.acos(BABYLON.Vector3.Dot(up, direction));

    if (axis.lengthSquared() < 0.0001) {
      this.root.rotationQuaternion =
        direction.y >= 0
          ? BABYLON.Quaternion.Identity()
          : BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, Math.PI);
    } else {
      this.root.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
        axis.normalize(),
        angle
      );
    }

    // LENGTH DISTRIBUTION
    const shaftLength = Math.max(0, length - this.headHeight);

    // scale shaft ONLY
    this.shaft.scaling.y = shaftLength;

    // keep shaft base at 0
    this.shaft.position.y = shaftLength / 2;

    // place head at tip
    this.head.position.y = shaftLength + this.headHeight / 2;

    this.root.position = origin.add(
      new BABYLON.Vector3(0, this.defaultOriginHeight, 0)
    );
  }
}
