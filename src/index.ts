// index.ts

import * as BABYLON from "@babylonjs/core";
import { Playground } from "./main";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;

if (canvas) {
  // antialias: true → requests 4x MSAA from WebGL (hardware-level AA).
  // This is the most important AA setting for recording quality — it happens
  // before any post-processing, so thin lines and arrow geometry are smooth
  // even when screen-captured by OBS or QuickTime.
  //
  // preserveDrawingBuffer: true  — required so screenshot/recording tools can
  // read pixels from the canvas without getting a blank frame.
  //
  // adaptToDeviceRatio (set in CreateScene) applies on top of this to ensure
  // we render at the monitor's native pixel density.
  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,       // hardware MSAA — sharpest lines in recordings
    powerPreference: "high-performance", // prevent GPU throttling during recording
  });

  const scene = Playground.CreateScene(engine, canvas);

  engine.runRenderLoop(() => {
    scene.render();
  });

  window.addEventListener("resize", () => {
    engine.resize();
  });
}
