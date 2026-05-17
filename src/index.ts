// index.ts

import * as BABYLON from "@babylonjs/core";
import { Playground } from "./main";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

if (canvas) {
  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true
  });

  const scene = Playground.CreateScene(engine, canvas);

  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener("resize", () => {
    engine.resize();
  });
}
