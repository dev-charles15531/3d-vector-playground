// types.ts
import * as BABYLON from "@babylonjs/core";
import { VectorArrow } from "./VectorArrow";

type VectorOperation = "base" | "add" | "subtract" | "cross" | "projection";

export type Arrow = {
  label: string;
  key: string;
  origin: BABYLON.Vector3;
  value: BABYLON.Vector3;
  type: "base" | "derived";
  dependencies?: string[];
  operation?: VectorOperation;
  lockedAxes?: ("x" | "y" | "z")[];
  /** Per-vector overlay toggles */
  showComponents?: boolean; // default true — show XYZ breakdown lines
  showAngle?: boolean; // default true — show angle arc when paired
  display?: {
    color?: BABYLON.Color3;
    dashed?: boolean;
  };
  vector: VectorArrow | null;
};
