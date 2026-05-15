import * as BABYLON from "@babylonjs/core";
import { Playground } from "./main";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

if (canvas) {
  // 1. Initialize the engine
  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true
  });

  // 2. Create the scene using your static method
  const scene = Playground.CreateScene(engine, canvas);

  // 3. The Heartbeat: This tells Babylon to draw 60 frames per second
  engine.runRenderLoop(() => {
    scene.render();
  });

  // 4. Resize listener to keep the lab full-screen
  window.addEventListener("resize", () => {
    engine.resize();
  });
}
