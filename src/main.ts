import * as BABYLON from "@babylonjs/core";
import { GridMaterial } from "@babylonjs/materials/grid";

import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/loaders";

import { VectorRenderer } from "./VectorRenderer.ts";
import { VectorEngine } from "./VectorEngine.ts";
import { UI } from "./UI.ts";
import { Lab } from "./Lab.ts";

class Playground {
  public static CreateScene(
    engine: BABYLON.Engine,
    canvas: HTMLCanvasElement,
  ): BABYLON.Scene {
    // Create scene
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0);

    // Create camera
    const camera = new BABYLON.ArcRotateCamera(
      "camera1",
      -Math.PI / 2,
      Math.PI / 2,
      12,
      BABYLON.Vector3.Zero(),
      scene,
    );
    camera.upperBetaLimit = (Math.PI / 2) * 0.95;
    camera.attachControl(canvas);

    // Add light
    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene,
    );
    light.intensity = 0.6;

    const labLight = new BABYLON.SpotLight(
      "splight",
      new BABYLON.Vector3(0, 10, 0),
      new BABYLON.Vector3(0, -1, 0),
      Math.PI / 2,
      2,
      scene,
    );
    labLight.intensity = 0.8;

    // Create ground
    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: 500, height: 500 },
      scene,
    );

    // Create ground grid
    const grid = new GridMaterial("grid", scene);
    grid.gridRatio = 1;
    grid.opacity = 0.65;
    grid.mainColor = new BABYLON.Color3(0.2, 0.2, 0.25);
    grid.lineColor = new BABYLON.Color3(0.35, 0.35, 0.45);

    ground.material = grid;

    const labSize = 50;

    // Create lab
    new Lab(scene, labSize, grid);

    // Draw origin
    const origin = BABYLON.MeshBuilder.CreateSphere(
      "origin",
      { diameter: 0.3 },
      scene,
    );
    const defaultOriginHeight = labSize / 2;
    origin.position = new BABYLON.Vector3(0, defaultOriginHeight, 0);
    const originMat = new BABYLON.StandardMaterial("originMat", scene);
    originMat.emissiveColor = new BABYLON.Color3(0.6, 0.1, 0.8);
    origin.material = originMat;

    camera.setTarget(origin.position);

    const vecEngine = new VectorEngine(defaultOriginHeight);
    const renderer = new VectorRenderer(scene, defaultOriginHeight);

    vecEngine.onVectorAdded = (v) => {
      renderer.add(v);
      renderer.refresh(vecEngine.getVectors());
    };

    vecEngine.onVectorUpdated = (v) => {
      renderer.update(v);
      renderer.refresh(vecEngine.getVectors());
    };

    vecEngine.onVectorRemoved = (v) => {
      renderer.remove(v);
      renderer.refresh(vecEngine.getVectors());
    };

    vecEngine.onModeChanged = () => {
      renderer.setHeadToTail(vecEngine.getHeadToTail());
      renderer.refresh(vecEngine.getVectors());
    };

    vecEngine.addVector({
      label: "Vector-1",
      key: "Vector-1",

      origin: new BABYLON.Vector3(0, 0, 0),
      value: new BABYLON.Vector3(1, 1, 1),

      type: "base",

      display: {
        color: BABYLON.Color3.FromHexString("#FF6B6B"),
      },

      vector: null,
    });

    new UI(scene, vecEngine);

    return scene;
  }
}

export { Playground };
