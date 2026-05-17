// Lab.ts

import * as BABYLON from "@babylonjs/core";
import { GridMaterial } from "@babylonjs/materials/grid";

type Wall = {
  mesh: BABYLON.Mesh;
  normal: BABYLON.Vector3;
};

export class Lab {
  private scene: BABYLON.Scene;
  private labSize: number;
  private grid: GridMaterial;
  public glassCube: BABYLON.Mesh;
  private backWalls: Wall[] = [];

  constructor(scene: BABYLON.Scene, size: number, grid: GridMaterial) {
    this.scene = scene;
    this.labSize = size;
    this.grid = grid;

    this.glassCube = BABYLON.MeshBuilder.CreateBox(
      "this.glassCube",
      { size: this.labSize },
      this.scene,
    );
    this.prepareLab();
  }

  private prepareLab() {
    this.glassCube.position.y = this.labSize / 2;

    // Glass material
    const glassMat = new BABYLON.StandardMaterial("glassMat", this.scene);
    glassMat.alpha = 0.3;
    glassMat.diffuseColor = new BABYLON.Color3(0.31, 0.66, 0.9);
    this.glassCube.material = glassMat;

    // Edges
    this.glassCube.enableEdgesRendering();
    this.glassCube.edgesWidth = 4.0;
    this.glassCube.edgesColor = new BABYLON.Color4(1, 1.2, 1, 5);
    this.glassCube.renderingGroupId = 0;

    // Grid walls
    this.createBackWallGrid(
      new BABYLON.Vector3(this.labSize / 2, this.glassCube.position.y, 0),
      new BABYLON.Vector3(-1, 0, 0),
    );
    this.createBackWallGrid(
      new BABYLON.Vector3(-(this.labSize / 2), this.glassCube.position.y, 0),
      new BABYLON.Vector3(1, 0, 0),
    );
    this.createBackWallGrid(
      new BABYLON.Vector3(0, this.glassCube.position.y, this.labSize / 2),
      new BABYLON.Vector3(0, 0, -1),
    );
    this.createBackWallGrid(
      new BABYLON.Vector3(0, this.glassCube.position.y, -(this.labSize / 2)),
      new BABYLON.Vector3(0, 0, 1),
    );

    const offset = this.labSize / 2 + 0.5;

    this.createLabel(
      "X",
      new BABYLON.Vector3(offset, this.labSize / 2, 0),
      new BABYLON.Color3(1, 0, 0),
      this.scene,
    );
    this.createLabel(
      "Y",
      new BABYLON.Vector3(0, this.labSize, 0),
      new BABYLON.Color3(0, 1, 0),
      this.scene,
    );
    this.createLabel(
      "Z",
      new BABYLON.Vector3(0, this.labSize / 2, offset),
      new BABYLON.Color3(0, 0, 1),
      this.scene,
    );

    const points = [
      [
        new BABYLON.Vector3(-(this.labSize / 2), this.labSize / 2, 0),
        new BABYLON.Vector3(this.labSize / 2, this.labSize / 2, 0),
      ],
      [new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, this.labSize, 0)],
      [
        new BABYLON.Vector3(0, this.labSize / 2, -(this.labSize / 2)),
        new BABYLON.Vector3(0, this.labSize / 2, this.labSize / 2),
      ],
    ];

    const faintGray = new BABYLON.Color3(0.35, 0.35, 0.35);
    this.createFaintDashedAxis("xAxis", points[0], faintGray);
    this.createFaintDashedAxis("yAxis", points[1], faintGray);
    this.createFaintDashedAxis("zAxis", points[2], faintGray);

    const zoomThreshold = this.labSize * 1.5;
    // Fade edges based on camera distance to cube center.
    // fadeOutDist: edges fully visible beyond this radius.
    // fadeInDist:  edges fully gone at or below this radius.
    // These are tuned so the fade begins just before entering the cube face
    // and completes a little way inside — and stays gone as you zoom further.
    const half = this.labSize / 2;
    const fadeOutDist = half * 2; // start fading as you approach the surface
    const fadeInDist = half * 1; // fully gone once well inside

    this.scene.onBeforeRenderObservable.add(() => {
      const camera = this.scene.activeCamera;
      if (!(camera instanceof BABYLON.ArcRotateCamera)) return;

      // Distance from camera to the cube's world-space centre
      const cubeCenter = this.glassCube.position;
      const dist = BABYLON.Vector3.Distance(camera.position, cubeCenter);

      // t = 1 → far away (full edges), t = 0 → close / inside (no edges)
      const t = Math.max(
        0,
        Math.min(1, (dist - fadeInDist) / (fadeOutDist - fadeInDist)),
      );

      this.glassCube.edgesColor = new BABYLON.Color4(1, 1.2, 1, t * 5);
      glassMat.alpha = t * 0.3;

      // Grid walls: show only back-facing walls when zoomed out
      const isZoomedOut = camera.radius > zoomThreshold;
      this.backWalls.forEach(({ mesh, normal }) => {
        const toTarget = camera.target.subtract(mesh.position).normalize();
        const dot = BABYLON.Vector3.Dot(normal, toTarget);
        mesh.setEnabled(dot > 0 && isZoomedOut);
      });
    });
  }

  private createFaintDashedAxis(
    name: string,
    pts: BABYLON.Vector3[],
    color: BABYLON.Color3,
  ) {
    const line = BABYLON.MeshBuilder.CreateDashedLines(
      name,
      { points: pts, dashSize: 0.2, gapSize: 0.2, dashNb: 50 },
      this.scene,
    );
    line.color = color.scale(0.7);
    line.alpha = 0;
    return line;
  }

  private createLabel = (
    text: string,
    position: BABYLON.Vector3,
    color: BABYLON.Color3,
    scene: BABYLON.Scene,
  ) => {
    const plane = BABYLON.MeshBuilder.CreatePlane(
      "label-" + text,
      { size: 0.8 },
      scene,
    );
    plane.position = position;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const dynamicTexture = new BABYLON.DynamicTexture(
      "drawText-" + text,
      { width: 128, height: 128 },
      scene,
    );
    const material = new BABYLON.StandardMaterial("labelMat-" + text, scene);
    material.diffuseTexture = dynamicTexture;
    material.specularColor = new BABYLON.Color3(0, 0, 0);
    material.emissiveColor = color;
    material.backFaceCulling = false;
    material.diffuseTexture.hasAlpha = true;
    material.useAlphaFromDiffuseTexture = true;
    plane.material = material;

    dynamicTexture.drawText(
      text,
      null,
      null,
      "bold 80px Arial",
      "white",
      "transparent",
      true,
    );
    return plane;
  };

  private createBackWallGrid = (
    pos: BABYLON.Vector3,
    normal: BABYLON.Vector3,
  ) => {
    const wall = BABYLON.MeshBuilder.CreatePlane(
      "backWall",
      { size: this.labSize },
      this.scene,
    );
    wall.position = pos;
    wall.material = this.grid;

    const up = BABYLON.Vector3.Forward();
    const dot = BABYLON.Vector3.Dot(up, normal);

    if (dot > 0.9999) {
      wall.rotationQuaternion = BABYLON.Quaternion.Identity();
    } else if (dot < -0.9999) {
      wall.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
        BABYLON.Axis.Y,
        Math.PI,
      );
    } else {
      const axis = BABYLON.Vector3.Cross(up, normal).normalize();
      const angle = Math.acos(dot);
      wall.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
    }

    this.backWalls.push({ mesh: wall, normal: normal.normalize() });
  };
}
