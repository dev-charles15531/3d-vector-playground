// VectorOverlays.ts
// Pedagogical visual overlays:
//   - Component breakdown: solid RGB legs from origin showing X, Y, Z contributions
//   - Rectangular component box: faint edges connecting the legs (no clutter)
//   - Angle arc + degree label between two vectors when exactly 2 exist
//   - Dot product readout next to the arc

import * as BABYLON from "@babylonjs/core";
import { type Arrow } from "./types";

export class VectorOverlays {
  private scene: BABYLON.Scene;
  private defaultOriginHeight: number;

  private componentMeshes: Array<BABYLON.LinesMesh | BABYLON.Mesh> = [];
  private angleArc: BABYLON.LinesMesh | null = null;
  private angleLabel: BABYLON.Mesh | null = null;
  private dotLabel: BABYLON.Mesh | null = null;

  constructor(scene: BABYLON.Scene, defaultOriginHeight: number) {
    this.scene = scene;
    this.defaultOriginHeight = defaultOriginHeight;
  }

  public updateForSelection(selectedKey: string | null, vectors: Arrow[]): void {
    this.clearComponentMeshes();
    this.clearAngleArc();

    if (!selectedKey) return;

    const selected = vectors.find((v) => v.key === selectedKey);
    if (!selected) return;

    const origin = selected.origin.add(new BABYLON.Vector3(0, this.defaultOriginHeight, 0));
    const v = selected.value;

    this.drawComponentBreakdown(origin, v);

    // Angle arc: always draw when exactly 2 vectors present, regardless of which is selected
    const other = vectors.find((v) => v.key !== selectedKey);
    if (vectors.length === 2 && other) {
      this.drawAngleArc(
        origin, selected.value, other.value,
        selected.display?.color, other.display?.color,
      );
    }
  }

  // ─── Component breakdown ─────────────────────────────────────────────────
  // Shows three solid colored legs from the origin: X (red), Y (green), Z (blue)
  // plus a faint rectangular "box" of connecting edges so the parallelogram is clear.

  private drawComponentBreakdown(origin: BABYLON.Vector3, vec: BABYLON.Vector3) {
    const { x, y, z } = vec;

    // The three axis endpoints (one component each)
    const xTip = origin.add(new BABYLON.Vector3(x, 0, 0));
    const yTip = origin.add(new BABYLON.Vector3(0, y, 0));
    const zTip = origin.add(new BABYLON.Vector3(0, 0, z));

    // The full tip (all three components)
    const tip = origin.add(vec);

    // Intermediate corners for the "box" edges
    const xzCorner = origin.add(new BABYLON.Vector3(x, 0, z));   // floor corner
    const xTipUp = xTip.add(new BABYLON.Vector3(0, y, 0));      // = tip
    const zTipUp = zTip.add(new BABYLON.Vector3(0, y, 0));      // = tip from z side

    const RED = new BABYLON.Color3(0.95, 0.25, 0.25);
    const GREEN = new BABYLON.Color3(0.25, 0.90, 0.35);
    const BLUE = new BABYLON.Color3(0.25, 0.45, 1.00);
    const FAINT = new BABYLON.Color3(0.35, 0.35, 0.45);

    // ── Three primary legs (solid, bright) ──────────────────────────────
    this.makeLine([origin, xTip], RED, 0.90, "leg-x");
    this.makeLine([origin, yTip], GREEN, 0.90, "leg-y");
    this.makeLine([origin, zTip], BLUE, 0.90, "leg-z");

    // ── Completing edges of the rectangular box (faint) ──────────────────
    // Floor rectangle: origin → xTip → xzCorner → zTip → origin
    this.makeLine([xTip, xzCorner], RED, 0.22, "box-xz1");
    this.makeLine([zTip, xzCorner], BLUE, 0.22, "box-xz2");

    // Vertical edges from floor corners up to tip level
    this.makeLine([xzCorner, tip], FAINT, 0.20, "box-v1");
    this.makeLine([xTip, tip], FAINT, 0.20, "box-v2");
    this.makeLine([zTip, tip], FAINT, 0.20, "box-v3");
    this.makeLine([yTip, tip], GREEN, 0.22, "box-v4");

    // ── Floating component labels near leg midpoints ──────────────────────
    const xMid = origin.add(xTip).scale(0.5).add(new BABYLON.Vector3(0, 0.25, 0));
    const yMid = origin.add(yTip).scale(0.5).add(new BABYLON.Vector3(0.25, 0, 0));
    const zMid = origin.add(zTip).scale(0.5).add(new BABYLON.Vector3(0, 0.25, 0));

    if (Math.abs(x) > 0.3) this.makeComponentLabel(`x=${x.toFixed(1)}`, xMid, RED);
    if (Math.abs(y) > 0.3) this.makeComponentLabel(`y=${y.toFixed(1)}`, yMid, GREEN);
    if (Math.abs(z) > 0.3) this.makeComponentLabel(`z=${z.toFixed(1)}`, zMid, BLUE);
  }

  /** Safe line creation — skips if the two endpoints are identical (avoids BJS warning) */
  private makeLine(
    pts: BABYLON.Vector3[],
    color: BABYLON.Color3,
    alpha: number,
    name: string,
  ): void {
    // Guard: skip if any consecutive pair is too close (causes empty vertex buffer)
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].subtract(pts[i - 1]).lengthSquared() < 1e-8) return;
    }
    const line = BABYLON.MeshBuilder.CreateLines(name, { points: pts }, this.scene);
    line.color = color;
    line.alpha = alpha;
    this.componentMeshes.push(line);
  }

  private makeComponentLabel(text: string, pos: BABYLON.Vector3, color: BABYLON.Color3): void {
    const label = this.createFloatingLabel(text, pos, color, 11);
    this.componentMeshes.push(label);
  }

  private clearComponentMeshes() {
    for (const m of this.componentMeshes) m.dispose();
    this.componentMeshes = [];
  }

  // ─── Angle arc ───────────────────────────────────────────────────────────

  private drawAngleArc(
    origin: BABYLON.Vector3,
    vecA: BABYLON.Vector3,
    vecB: BABYLON.Vector3,
    colorA?: BABYLON.Color3,
    colorB?: BABYLON.Color3,
  ) {
    const lenA = vecA.length();
    const lenB = vecB.length();
    if (lenA < 0.001 || lenB < 0.001) return;

    const dirA = vecA.clone().normalize();
    const dirB = vecB.clone().normalize();
    const dot = Math.max(-1, Math.min(1, BABYLON.Vector3.Dot(dirA, dirB)));
    const angleRad = Math.acos(dot);
    const angleDeg = angleRad * (180 / Math.PI);

    const axisRaw = BABYLON.Vector3.Cross(dirA, dirB);
    if (axisRaw.lengthSquared() < 0.0001) return; // parallel vectors — no arc

    const arcRadius = Math.min(lenA, lenB) * 0.32;
    const segments = 40;
    const sinTotal = Math.sin(angleRad);
    const pts: BABYLON.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      let interp: BABYLON.Vector3;
      if (sinTotal < 0.0001) {
        interp = dirA.clone();
      } else {
        const sinA = Math.sin((1 - t) * angleRad) / sinTotal;
        const sinB = Math.sin(t * angleRad) / sinTotal;
        interp = dirA.scale(sinA).add(dirB.scale(sinB));
      }
      pts.push(origin.add(interp.scale(arcRadius)));
    }

    // Guard against degenerate arc
    if (pts.length < 2) return;

    this.angleArc = BABYLON.MeshBuilder.CreateLines("angleArc", { points: pts }, this.scene);
    const blendColor = (colorA && colorB)
      ? colorA.add(colorB).scale(0.5)
      : new BABYLON.Color3(1, 1, 0.3);
    this.angleArc.color = blendColor;
    this.angleArc.alpha = 0.9;

    // Label: degrees, positioned just outside arc midpoint
    const midPt = pts[Math.floor(segments / 2)];
    const midDir = midPt.subtract(origin).normalize();
    const labelPos = origin.add(midDir.scale(arcRadius * 1.6));
    this.angleLabel = this.createFloatingLabel(
      `${angleDeg.toFixed(1)}°`, labelPos, blendColor, 15,
    );

    // Dot product label: offset a bit further out
    const dotVal = BABYLON.Vector3.Dot(vecA, vecB);
    const dotPos = origin.add(midDir.scale(arcRadius * 2.5));
    this.dotLabel = this.createFloatingLabel(
      `A·B = ${dotVal.toFixed(2)}`, dotPos, new BABYLON.Color3(1, 0.85, 0.3), 11,
    );
  }

  private clearAngleArc() {
    this.angleArc?.dispose(); this.angleArc = null;
    this.angleLabel?.dispose(); this.angleLabel = null;
    this.dotLabel?.dispose(); this.dotLabel = null;
  }

  // ─── Floating billboard label ────────────────────────────────────────────

  private createFloatingLabel(
    text: string,
    position: BABYLON.Vector3,
    color: BABYLON.Color3,
    fontSize = 13,
  ): BABYLON.Mesh {
    const texW = Math.max(128, Math.ceil(text.length * fontSize * 0.7 / 64) * 64);
    const texH = 64;
    const worldW = text.length * fontSize * 0.018 + 0.3;

    const plane = BABYLON.MeshBuilder.CreatePlane(
      "label", { width: worldW, height: worldW * 0.35 }, this.scene,
    );
    plane.position = position;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const dt = new BABYLON.DynamicTexture(
      "labelTex", { width: texW, height: texH }, this.scene,
    );
    dt.hasAlpha = true;
    dt.drawText(
      text, null, null,
      `bold ${fontSize}px monospace`, "#ffffff", "transparent", true,
    );

    const mat = new BABYLON.StandardMaterial("labelMat", this.scene);
    mat.diffuseTexture = dt;
    mat.emissiveColor = color;
    mat.backFaceCulling = false;
    mat.useAlphaFromDiffuseTexture = true;
    plane.material = mat;

    return plane;
  }

  public dispose() {
    this.clearComponentMeshes();
    this.clearAngleArc();
  }
}
