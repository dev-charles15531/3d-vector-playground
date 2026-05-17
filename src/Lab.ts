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
  // private backWalls: BABYLON.Mesh[] = [];
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

    // Create the Glass Material
    const glassMat = new BABYLON.StandardMaterial("glassMat", this.scene);
    glassMat.alpha = 0.3; // Very faint
    glassMat.diffuseColor = new BABYLON.Color3(0.31, 0.66, 0.9); // blue-ish
    this.glassCube.material = glassMat;

    // Enable Edges Rendering (This makes the "skeleton" of the cube visible)
    this.glassCube.enableEdgesRendering();
    this.glassCube.edgesWidth = 4.0;
    this.glassCube.edgesColor = new BABYLON.Color4(1, 1.2, 1, 5); // Bright white edges
    this.glassCube.renderingGroupId = 0;

    // create lab back wall(grid)
    this.createBackWallGrid(
      new BABYLON.Vector3(this.labSize / 2, this.glassCube.position.y, 0),
      new BABYLON.Vector3(-1, 0, 0), // LEFT-facing normal
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

    const offset = this.labSize / 2 + 0.5; // Just outside the cube corner

    // X-Axis Label
    this.createLabel(
      "X",
      new BABYLON.Vector3(offset, this.labSize / 2, 0),
      new BABYLON.Color3(1, 0, 0),
      this.scene,
    );
    // Y-Axis Label
    this.createLabel(
      "Y",
      new BABYLON.Vector3(0, this.labSize, 0),
      new BABYLON.Color3(0, 1, 0),
      this.scene,
    );
    // Z-Axis Label
    this.createLabel(
      "Z",
      new BABYLON.Vector3(0, this.labSize / 2, offset),
      new BABYLON.Color3(0, 0, 1),
      this.scene,
    );

    const points = [
      // X Axis
      [
        new BABYLON.Vector3(-(this.labSize / 2), this.labSize / 2, 0),
        new BABYLON.Vector3(this.labSize / 2, this.labSize / 2, 0),
      ],
      // Y Axis
      [new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, this.labSize, 0)],
      // Z Axis
      [
        new BABYLON.Vector3(0, this.labSize / 2, -(this.labSize / 2)),
        new BABYLON.Vector3(0, this.labSize / 2, this.labSize / 2),
      ],
    ];

    const faintGray = new BABYLON.Color3(0.35, 0.35, 0.35);
    this.createFaintDashedAxis.call(this, "xAxis", points[0], faintGray);
    this.createFaintDashedAxis.call(this, "yAxis", points[1], faintGray);
    this.createFaintDashedAxis.call(this, "zAxis", points[2], faintGray);

    const zoomThreshold = this.labSize * 1.5;

    this.scene.onBeforeRenderObservable.add(() => {
      const camera = this.scene.activeCamera;
      if (!camera) return;

      if (camera instanceof BABYLON.ArcRotateCamera) {
        // console.log("radius:", camera.radius, "Secradius:", zoomThreshold);
        const isZoomedOut = camera.radius > zoomThreshold;

        this.backWalls.forEach(({ mesh, normal }) => {
          const toTarget = camera.target.subtract(mesh.position).normalize();
          const dot = BABYLON.Vector3.Dot(normal, toTarget);

          // console.log("boolius:", dot > 0 && isZoomedOut);
          mesh.setEnabled(dot > 0 && isZoomedOut);
        });
      }
    });
  }

  private createFaintDashedAxis(
    name: string,
    pts: BABYLON.Vector3[],
    color: BABYLON.Color3,
  ) {
    const line = BABYLON.MeshBuilder.CreateDashedLines(
      name,
      {
        points: pts,
        dashSize: 0.2, // length of visible dash
        gapSize: 0.2, // gap between dashes
        dashNb: 50, // total dash count
      },
      this.scene,
    );

    // line.color = color;
    line.color = color.scale(0.7);

    // make faint
    line.alpha = 0; // 0 = invisible, 1 = fully solid

    return line;
  }

  // Lab axis labels
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

    // always faces the camera
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const dynamicTexture = new BABYLON.DynamicTexture(
      "drawText-" + text,
      { width: 128, height: 128 },
      scene,
    );
    const material = new BABYLON.StandardMaterial("labelMat-" + text, scene);
    material.diffuseTexture = dynamicTexture;
    material.specularColor = new BABYLON.Color3(0, 0, 0); // Remove glare
    material.emissiveColor = color; // glow slightly for clarity
    material.backFaceCulling = false; // See from both sides

    // Use an invisible background
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

    // rotate plane to match normal
    const up = BABYLON.Vector3.Forward(); // (0,0,1)
    const dot = BABYLON.Vector3.Dot(up, normal);

    if (dot > 0.9999) {
      // same direction → no rotation
      wall.rotationQuaternion = BABYLON.Quaternion.Identity();
    } else if (dot < -0.9999) {
      // opposite direction → rotate 180° around ANY perpendicular axis
      wall.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
        BABYLON.Axis.Y, // or X, both work
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
