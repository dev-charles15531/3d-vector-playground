// VectorOverlays.ts
// Pedagogical visual overlays:
//   - Component breakdown: solid RGB legs from origin showing X, Y, Z contributions
//   - Rectangular component box: faint edges connecting the legs
//   - Angle arc + degree label between two vectors when exactly 2 exist
//
// Line animation: primary legs pulse alpha with offset sine waves to create a
// "flowing from origin" feel. Box edges breathe on a slower cycle.
// Overlay origins always follow the *rendered* position (head-to-tail aware).

import * as BABYLON from "@babylonjs/core";
import { type AnimatedSegment, type Arrow } from "./types";
import { VectorRenderer } from "./VectorRenderer";

export class VectorOverlays {
  private scene: BABYLON.Scene;
  private defaultOriginHeight: number;
  private renderer: VectorRenderer;
  private animatedLines: AnimatedSegment[] = [];
  private staticMeshes: BABYLON.Mesh[] = []; // labels (no pulse)
  // private angleArc: BABYLON.LinesMesh | null = null;
  private angleLabel: BABYLON.Mesh | null = null;

  /** Scene observable handle so we can remove it on dispose */
  private renderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> =
    null;

  constructor(
    scene: BABYLON.Scene,
    defaultOriginHeight: number,
    renderer: VectorRenderer,
  ) {
    this.scene = scene;
    this.defaultOriginHeight = defaultOriginHeight;
    this.renderer = renderer;

    // Single render loop for all overlay animation — added once, runs every frame
    this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (this.animatedLines.length === 0) return;

      const t = performance.now() / 1000;

      for (const seg of this.animatedLines) {
        const wave = Math.sin(
          t * seg.speed * 4 -
            (seg.segmentIndex / seg.segmentCount) * Math.PI * 2,
        );

        const intensity = 0.15 + Math.max(0, wave) * 1.8;

        seg.mesh.color = seg.baseColor.scale(intensity);
      }
    });
  }

  public updateForSelection(
    selectedKey: string | null,
    vectors: Arrow[],
  ): void {
    this.clearAll();

    if (!selectedKey) return;

    const selected = vectors.find((v) => v.key === selectedKey);
    if (!selected) return;

    const renderedOriginRaw = this.renderer.getRenderedOrigin(
      selected.key,
      selected.origin,
    );
    const origin = renderedOriginRaw.add(
      new BABYLON.Vector3(0, this.defaultOriginHeight, 0),
    );

    if (selected.showComponents !== false) {
      this.drawComponentBreakdown(origin, selected.value);
    }

    const other = vectors.find((v) => v.key !== selectedKey);
    if (
      vectors.length === 2 &&
      other &&
      selected.showAngle !== false &&
      other.showAngle !== false
    ) {
      const otherOriginRaw = this.renderer.getRenderedOrigin(
        other.key,
        other.origin,
      );
      const otherOrigin = otherOriginRaw.add(
        new BABYLON.Vector3(0, this.defaultOriginHeight, 0),
      );
      this.drawAngleArc(
        origin,
        selected.value,
        otherOrigin,
        other.value,
        selected.display?.color,
        other.display?.color,
      );
    }
  }

  // ─── Component breakdown ─────────────────────────────────────────────────

  private drawComponentBreakdown(
    origin: BABYLON.Vector3,
    vec: BABYLON.Vector3,
  ) {
    const { x, y, z } = vec;

    const xTip = origin.add(new BABYLON.Vector3(x, 0, 0));
    const yTip = origin.add(new BABYLON.Vector3(0, y, 0));
    const zTip = origin.add(new BABYLON.Vector3(0, 0, z));
    const tip = origin.add(vec);
    const xzCorner = origin.add(new BABYLON.Vector3(x, 0, z));

    const RED = new BABYLON.Color3(0.95, 0.25, 0.25);
    const GREEN = new BABYLON.Color3(0.25, 0.9, 0.35);
    const BLUE = new BABYLON.Color3(0.25, 0.45, 1.0);
    const FAINT = new BABYLON.Color3(0.35, 0.35, 0.45);

    // ── Primary legs — animated: pulse 0.5 ↔ 1.0, staggered by axis ────────
    // X lights first, then Y (2π/3 later), then Z (4π/3 later) → sequential glow
    this.makeAnimatedLine([origin, xTip], RED, 0.7, 0.3, 0, 1.2, "leg-x");
    this.makeAnimatedLine(
      [origin, yTip],
      GREEN,
      0.7,
      0.3,
      Math.PI * 0.67,
      1.2,
      "leg-y",
    );
    this.makeAnimatedLine(
      [origin, zTip],
      BLUE,
      0.7,
      0.3,
      Math.PI * 1.33,
      1.2,
      "leg-z",
    );

    // ── Box edges — slower breath, unified phase ──────────────────────────
    this.makeAnimatedLine([xTip, xzCorner], RED, 0.18, 0.1, 0, 0.6, "box-xz1");
    this.makeAnimatedLine([zTip, xzCorner], BLUE, 0.18, 0.1, 0, 0.6, "box-xz2");

    this.makeLine([xzCorner, tip], FAINT, 0.2, "box-v1");
    this.makeLine([xTip, tip], FAINT, 0.2, "box-v2");
    this.makeLine([zTip, tip], FAINT, 0.2, "box-v3");

    this.makeAnimatedLine([yTip, tip], GREEN, 0.18, 0.1, 0, 0.6, "box-v4");

    // ── Labels at leg tips (static, no pulse — values must be readable) ───
    if (Math.abs(x) > 0.3) {
      const pos = xTip.add(new BABYLON.Vector3(0, 0.35, 0.2));
      this.makeLabel(`x=${x.toFixed(2)}`, pos, RED);
    }
    if (Math.abs(y) > 0.3) {
      const pos = yTip.add(new BABYLON.Vector3(0.35, 0.15, 0));
      this.makeLabel(`y=${y.toFixed(2)}`, pos, GREEN);
    }
    if (Math.abs(z) > 0.3) {
      const pos = zTip.add(new BABYLON.Vector3(0.2, 0.35, 0));
      this.makeLabel(`z=${z.toFixed(2)}`, pos, BLUE);
    }
  }

  /**
   * Create an animated line and register it for per-frame pulse.
   * @param _baseAlpha  Resting alpha (mid-point of pulse)
   * @param _pulseAmp   Half-amplitude of the sine swing
   * @param _phaseOffset  Starting phase in radians
   * @param speed      Radians per second
   */ private makeAnimatedLine(
    pts: BABYLON.Vector3[],
    color: BABYLON.Color3,
    _baseAlpha: number,
    _pulseAmp: number,
    _phaseOffset: number,
    speed: number,
    name: string,
  ): void {
    if (pts.length < 2) return;

    const start = pts[0];
    const end = pts[pts.length - 1];

    const dir = end.subtract(start);
    const segments = 24;

    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;

      const p0 = start.add(dir.scale(t0));
      const p1 = start.add(dir.scale(t1));

      const seg = BABYLON.MeshBuilder.CreateLines(
        `${name}-${i}`,
        { points: [p0, p1] },
        this.scene,
      );

      seg.color = color.scale(0.25);

      this.animatedLines.push({
        mesh: seg,
        baseColor: color.clone(),
        segmentIndex: i,
        segmentCount: segments,
        speed,
      });
    }
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
    const line = BABYLON.MeshBuilder.CreateLines(
      name,
      { points: pts },
      this.scene,
    );
    line.color = color;
    line.alpha = alpha;
    this.staticMeshes.push(line);
  }

  private makeLabel(
    text: string,
    pos: BABYLON.Vector3,
    color: BABYLON.Color3,
  ): void {
    const label = this.createFloatingLabel(text, pos, color, 11);
    this.staticMeshes.push(label);
  }

  private clearAll() {
    // Dispose angle label first (not in animatedLines)
    this.angleLabel?.dispose();
    this.angleLabel = null;

    for (const al of this.animatedLines) al.mesh.dispose();
    this.animatedLines = [];
    for (const m of this.staticMeshes) m.dispose();
    this.staticMeshes = [];
  }

  // ─── Angle arc ───────────────────────────────────────────────────────────
  private drawAngleArc(
    origin: BABYLON.Vector3,
    vecA: BABYLON.Vector3,
    _originB: BABYLON.Vector3,
    vecB: BABYLON.Vector3,
    colorA?: BABYLON.Color3,
    colorB?: BABYLON.Color3,
  ) {
    const lenA = vecA.length();
    const lenB = vecB.length();
    if (lenA < 0.001 || lenB < 0.001) return;

    const dirA = vecA.normalizeToNew();
    const dirB = vecB.normalizeToNew();

    const dot = BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(dirA, dirB), -1, 1);

    const angleRad = Math.acos(dot);
    if (angleRad < 0.01) return;

    const angleDeg = BABYLON.Tools.ToDegrees(angleRad);

    const axis = BABYLON.Vector3.Cross(dirA, dirB);
    if (axis.lengthSquared() < 1e-6) return;

    axis.normalize();

    const arcRadius = Math.min(lenA, lenB) * 0.28;
    const segments = 40;

    const blendColor =
      colorA && colorB
        ? colorA.add(colorB).scale(0.5)
        : new BABYLON.Color3(1, 1, 0.3);

    const rotationStep = BABYLON.Quaternion.RotationAxis(
      axis,
      angleRad / segments,
    );

    let currentDir = dirA.clone();
    const points: BABYLON.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      points.push(origin.add(currentDir.scale(arcRadius)));

      currentDir = BABYLON.Vector3.TransformCoordinates(
        currentDir,
        BABYLON.Matrix.Compose(
          BABYLON.Vector3.One(),
          rotationStep,
          BABYLON.Vector3.Zero(),
        ),
      ).normalize();
    }

    const arc = BABYLON.MeshBuilder.CreateLines(
      "angleArc",
      { points },
      this.scene,
    );

    arc.color = blendColor;
    arc.alpha = 0.95;

    this.staticMeshes.push(arc);

    const mid = points[Math.floor(points.length / 2)];
    const labelPos = mid.add(mid.subtract(origin).normalize().scale(0.4));

    this.angleLabel = this.createFloatingLabel(
      `${angleDeg.toFixed(1)}°`,
      labelPos,
      blendColor,
      15,
    );
  }

  // ─── Floating billboard label ────────────────────────────────────────────

  private createFloatingLabel(
    text: string,
    position: BABYLON.Vector3,
    color: BABYLON.Color3,
    fontSize = 13,
  ): BABYLON.Mesh {
    const texW = Math.max(
      128,
      Math.ceil((text.length * fontSize * 0.7) / 64) * 64,
    );
    const texH = 64;
    const worldW = text.length * fontSize * 0.018 + 0.3;

    const plane = BABYLON.MeshBuilder.CreatePlane(
      "label",
      { width: worldW, height: worldW * 0.35 },
      this.scene,
    );
    plane.position = position;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const dt = new BABYLON.DynamicTexture(
      "labelTex",
      { width: texW, height: texH },
      this.scene,
    );
    dt.hasAlpha = true;
    dt.drawText(
      text,
      null,
      null,
      `bold ${fontSize}px monospace`,
      "#ffffff",
      "transparent",
      true,
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
    this.clearAll();
    if (this.renderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.renderObserver);
      this.renderObserver = null;
    }
  }
}
