// UI.ts

import * as BABYLON from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  InputText,
  Button,
  ScrollViewer,
  Checkbox,
  Grid,
} from "@babylonjs/gui";

import { VectorEngine } from "./VectorEngine";
import { type Arrow } from "./types";
import { DragController } from "./DragController";
import { CameraController, type CameraPreset } from "./CameraController";
import { StateSerializer } from "./StateSerializer";

export class UI {
  private advancedTexture: AdvancedDynamicTexture;
  private engine: VectorEngine;
  private contentPanel!: StackPanel;
  private lastHue: number | null = null;
  private dragController: DragController;
  private cameraController: CameraController;

  // Toolbar state refs for toggling button styles
  private snapBtn!: Button;
  private freezeBtn!: Button;
  private hcBtn!: Button;
  private axisLockBtns: Map<string, Button> = new Map();

  constructor(
    scene: BABYLON.Scene,
    engine: VectorEngine,
    dragController: DragController,
    cameraController: CameraController,
  ) {
    this.engine = engine;
    this.dragController = dragController;
    this.cameraController = cameraController;
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "UI",
      true,
      scene,
    );

    this.buildUI();

    this.engine.onSelectionChanged(() => {
      this.refreshVectorList();
    });

    // Wire camera controller callbacks to update button styles
    this.cameraController.onFreezeChanged = (frozen) => {
      this.freezeBtn.background = frozen ? "#EF4444" : "#334155";
      (this.freezeBtn.children[0] as TextBlock).text = frozen ? "▶ Unfreeze" : "❄ Freeze";
    };

    this.cameraController.onHighContrastChanged = (enabled) => {
      this.hcBtn.background = enabled ? "#F59E0B" : "#334155";
    };
  }

  private buildUI() {
    // ── Bottom strip (vector list) ──────────────────────────────────────────
    const root = new Rectangle();
    root.width = "100%";
    root.height = "130px";
    root.thickness = 0;
    root.background = "#0A0F1EDD";
    root.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.advancedTexture.addControl(root);

    const scroll = new ScrollViewer();
    scroll.width = "100%";
    scroll.height = "100%";
    scroll.thickness = 0;
    scroll.barSize = 5;
    scroll.horizontalBar.isVisible = true;
    scroll.verticalBar.isVisible = false;
    root.addControl(scroll);

    this.contentPanel = new StackPanel();
    this.contentPanel.isVertical = false;
    this.contentPanel.height = "100%";
    scroll.addControl(this.contentPanel);

    this.refreshVectorList();

    // ── Top toolbar ─────────────────────────────────────────────────────────
    this.buildToolbar();
  }

  // ── Toolbar ──────────────────────────────────────────────────────────────

  private buildToolbar() {
    const bar = new Rectangle();
    bar.width = "100%";
    bar.height = "42px";
    bar.thickness = 0;
    bar.background = "#0A0F1ECC";
    bar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.advancedTexture.addControl(bar);

    const row = new StackPanel();
    row.isVertical = false;
    row.width = "100%";
    row.height = "100%";
    row.paddingLeft = "8px";
    row.paddingTop = "5px";
    row.paddingBottom = "5px";
    bar.addControl(row);

    // ── Section: Mode ──────────────────────────────────────────────────────
    row.addControl(this.makeSectionLabel("MODE"));

    const htCheck = new Checkbox();
    htCheck.width = "16px";
    htCheck.height = "16px";
    htCheck.color = "#38BDF8";
    htCheck.background = "#1E293B";
    htCheck.isChecked = this.engine.getHeadToTail();
    htCheck.onIsCheckedChangedObservable.add((v) => this.engine.setHeadToTail(v));
    row.addControl(this.wrapWithLabel(htCheck, "Head-Tail"));

    row.addControl(this.makeDivider());

    // ── Section: Snap ─────────────────────────────────────────────────────
    row.addControl(this.makeSectionLabel("SNAP"));
    this.snapBtn = this.makeToolBtn("⊞ Grid", () => {
      const on = this.dragController.getSnapToGrid();
      this.dragController.setSnapToGrid(!on);
      this.snapBtn.background = !on ? "#22C55E" : "#334155";
    });
    row.addControl(this.snapBtn);

    row.addControl(this.makeDivider());

    // ── Section: Camera presets ────────────────────────────────────────────
    row.addControl(this.makeSectionLabel("VIEW"));
    (["top", "front", "side", "free"] as CameraPreset[]).forEach((preset) => {
      const label = { top: "⬆ Top", front: "▣ Front", side: "◧ Side", free: "◎ 3D" }[preset];
      row.addControl(this.makeToolBtn(label, () => this.cameraController.goToPreset(preset)));
    });

    row.addControl(this.makeDivider());

    // ── Section: Freeze / HC ──────────────────────────────────────────────
    row.addControl(this.makeSectionLabel("RECORD"));

    this.freezeBtn = this.makeToolBtn("❄ Freeze", () => this.cameraController.toggleFreeze());
    row.addControl(this.freezeBtn);

    this.hcBtn = this.makeToolBtn("◐ Hi-Con", () => {
      const on = this.cameraController.toggleHighContrast();
      // In high-contrast mode, bump up arrow emissive globally
      // Signal is handled via onHighContrastChanged callback in constructor
    });
    row.addControl(this.hcBtn);

    row.addControl(this.makeDivider());

    // ── Section: Share ─────────────────────────────────────────────────────
    row.addControl(this.makeSectionLabel("SHARE"));
    const shareBtn = this.makeToolBtn("⎘ Copy URL", () => {
      const url = StateSerializer.encode(this.engine.getVectors());
      this.showToast("URL copied!");
    });
    row.addControl(shareBtn);
  }

  // ── Toast notification ───────────────────────────────────────────────────

  private showToast(message: string) {
    const toast = new Rectangle();
    toast.width = "200px";
    toast.height = "36px";
    toast.cornerRadius = 8;
    toast.background = "#22C55EEE";
    toast.thickness = 0;
    toast.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    toast.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    toast.top = "55px";
    this.advancedTexture.addControl(toast);

    const txt = new TextBlock();
    txt.text = message;
    txt.color = "white";
    txt.fontSize = 13;
    toast.addControl(txt);

    // Auto-remove after 2s
    setTimeout(() => {
      this.advancedTexture.removeControl(toast);
      toast.dispose();
    }, 2000);
  }

  // ── Toolbar helper widgets ────────────────────────────────────────────────

  private makeToolBtn(text: string, onClick: () => void): Button {
    const btn = Button.CreateSimpleButton("tbtn-" + text, text);
    btn.width = (text.length * 7.5 + 22) + "px";
    btn.height = "28px";
    btn.fontSize = 11;
    btn.color = "white";
    btn.background = "#334155";
    btn.cornerRadius = 5;
    btn.paddingLeft = "4px";
    btn.paddingRight = "4px";
    btn.onPointerUpObservable.add(onClick);
    return btn;
  }

  private makeSectionLabel(text: string): TextBlock {
    const lbl = new TextBlock();
    lbl.text = text;
    lbl.width = (text.length * 7 + 16) + "px";
    lbl.height = "28px";
    lbl.color = "#64748B";
    lbl.fontSize = 9;
    lbl.fontFamily = "monospace";
    return lbl;
  }

  private makeDivider(): Rectangle {
    const d = new Rectangle();
    d.width = "1px";
    d.height = "20px";
    d.background = "#334155";
    d.thickness = 0;
    d.paddingLeft = "6px";
    d.paddingRight = "6px";
    return d;
  }

  private wrapWithLabel(control: Control, labelText: string): StackPanel {
    const wrap = new StackPanel();
    wrap.isVertical = false;
    wrap.width = (labelText.length * 7.5 + 40) + "px";
    wrap.height = "28px";

    const lbl = new TextBlock();
    lbl.text = labelText;
    lbl.width = (labelText.length * 7.5 + 4) + "px";
    lbl.height = "28px";
    lbl.color = "#94A3B8";
    lbl.fontSize = 11;
    lbl.paddingLeft = "4px";

    wrap.addControl(control);
    wrap.addControl(lbl);
    return wrap;
  }

  // ── Vector list ───────────────────────────────────────────────────────────

  private refreshVectorList() {
    this.contentPanel.clearControls();
    this.contentPanel.addControl(this.createAddButton());
    this.engine.getVectors().forEach((arrow) => {
      this.contentPanel.addControl(this.createVectorBlock(arrow));
    });
    this.addOperationsPanel();
  }

  private createAddButton(): Rectangle {
    const box = new Rectangle();
    box.width = "56px";
    box.height = "120px";
    box.thickness = 1;
    box.color = "#22C55E";
    box.cornerRadius = 8;
    box.paddingLeft = "4px";
    box.paddingTop = "4px";
    box.paddingBottom = "4px";

    const btn = Button.CreateSimpleButton("add", "+");
    btn.fontSize = 26;
    btn.color = "white";
    btn.background = "#16A34A";
    btn.cornerRadius = 6;
    btn.onPointerUpObservable.add(() => this.addVector());
    box.addControl(btn);
    return box;
  }

  private createVectorBlock(arrow: Arrow): Rectangle {
    const isSelected = this.engine.getSelectedKey() === arrow.key;
    const accentHex = arrow.display?.color?.toHexString() ?? "#2563EB";

    const box = new Rectangle();
    box.width = "260px";
    box.height = "120px";
    box.thickness = isSelected ? 2 : 1;
    box.color = isSelected ? accentHex : "#334155";
    box.cornerRadius = 8;
    box.background = isSelected ? "#334155EE" : "#1E293BCC";
    box.paddingLeft = "5px";
    box.paddingRight = "5px";
    box.paddingTop = "4px";
    box.paddingBottom = "4px";
    box.isPointerBlocker = true;

    box.onPointerClickObservable.add(() => {
      this.engine.toggleVectorSelection(arrow.key);
    });

    const stack = new StackPanel();
    stack.height = "100%";
    box.addControl(stack);

    // ── Top row: label + axis lock + remove ──────────────────────────────
    const topRow = new StackPanel();
    topRow.isVertical = false;
    topRow.height = "26px";
    stack.addControl(topRow);

    const label = new TextBlock();
    label.text = arrow.label;
    label.width = "100px";
    label.color = accentHex;
    label.fontSize = 12;
    label.fontStyle = "bold";
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    topRow.addControl(label);

    // Axis lock buttons X/Y/Z
    (["x", "y", "z"] as const).forEach((axis) => {
      const lockKey = `${arrow.key}-lock-${axis}`;
      const isLocked = arrow.lockedAxes?.includes(axis) ?? false;
      const axisColor = { x: "#EF4444", y: "#22C55E", z: "#3B82F6" }[axis];
      const lockBtn = Button.CreateSimpleButton(lockKey, axis.toUpperCase());
      lockBtn.width = "18px";
      lockBtn.height = "18px";
      lockBtn.fontSize = 9;
      lockBtn.color = isLocked ? "#000" : "#fff";
      lockBtn.background = isLocked ? axisColor : "#475569";
      lockBtn.cornerRadius = 3;
      lockBtn.onPointerUpObservable.add(() => {
        this.engine.toggleAxisLock(arrow.key, axis);
        this.refreshVectorList();
      });
      this.axisLockBtns.set(lockKey, lockBtn);
      topRow.addControl(lockBtn);
    });

    const removeBtn = Button.CreateSimpleButton("rm-" + arrow.key, "✕");
    removeBtn.width = "20px";
    removeBtn.height = "20px";
    removeBtn.fontSize = 11;
    removeBtn.color = "white";
    removeBtn.background = "#DC2626";
    removeBtn.cornerRadius = 4;
    removeBtn.onPointerUpObservable.add(() => {
      this.engine.removeVector(arrow.key);
      this.refreshVectorList();
    });
    topRow.addControl(removeBtn);

    // ── Vector and origin inputs ─────────────────────────────────────────
    stack.addControl(this.createVecInputRow("V", arrow, arrow.value, "value"));
    stack.addControl(this.createVecInputRow("O", arrow, arrow.origin, "origin"));

    // ── Magnitude readout ────────────────────────────────────────────────
    const magRow = new StackPanel();
    magRow.isVertical = false;
    magRow.height = "20px";
    stack.addControl(magRow);

    const magLabel = new TextBlock();
    magLabel.text = `|v| = ${arrow.value.length().toFixed(3)}`;
    magLabel.color = "#94A3B8";
    magLabel.fontSize = 10;
    magLabel.fontFamily = "monospace";
    magLabel.width = "120px";
    magLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    magRow.addControl(magLabel);

    return box;
  }

  private createVecInputRow(
    labelStr: string,
    arrow: Arrow,
    vec: BABYLON.Vector3,
    field: "value" | "origin",
  ): StackPanel {
    const row = new StackPanel();
    row.isVertical = false;
    row.height = "28px";

    const lbl = new TextBlock();
    lbl.text = labelStr + ":";
    lbl.width = "18px";
    lbl.color = "#FACC15";
    lbl.fontSize = 10;
    row.addControl(lbl);

    const axisColors = { x: "#FCA5A5", y: "#86EFAC", z: "#93C5FD" };

    (["x", "y", "z"] as const).forEach((axis) => {
      const isLocked = field === "value" && (arrow.lockedAxes?.includes(axis) ?? false);

      const input = new InputText();
      input.width = "48px";
      input.height = "22px";
      input.text = Number(vec[axis]).toFixed(2);
      input.color = isLocked ? "#64748B" : axisColors[axis];
      input.background = isLocked ? "#1E293B" : "#334155";
      input.focusedBackground = "#334155";
      input.fontSize = 11;
      input.fontFamily = "monospace";
      input.isReadOnly = isLocked;

      input.onBlurObservable.add(() => {
        if (isLocked) return;
        const val = parseFloat(input.text);
        if (isNaN(val)) return;
        const updatedVec = vec.clone();
        updatedVec[axis] = val;
        this.engine.updateVector(arrow.key, { [field]: updatedVec } as Partial<Arrow>);
      });

      row.addControl(input);
    });

    return row;
  }

  // ── Operations panel ─────────────────────────────────────────────────────

  private addOperationsPanel() {
    const opBox = new Rectangle();
    opBox.width = "320px";
    opBox.height = "120px";
    opBox.thickness = 1;
    opBox.color = "#334155";
    opBox.cornerRadius = 8;
    opBox.background = "#111827CC";
    opBox.paddingLeft = "8px";
    opBox.paddingRight = "8px";
    opBox.paddingTop = "6px";
    opBox.paddingBottom = "6px";

    const opStack = new StackPanel();
    opStack.isVertical = false;
    opStack.height = "100%";
    opBox.addControl(opStack);

    const controls = new StackPanel();
    controls.width = "190px";
    controls.isVertical = true;
    opStack.addControl(controls);

    const selectorRow = new StackPanel();
    selectorRow.isVertical = false;
    selectorRow.height = "30px";

    const makeInput = (placeholder: string) => {
      const i = new InputText();
      i.width = "88px";
      i.height = "24px";
      i.placeholderText = placeholder;
      i.text = "";
      i.fontSize = 11;
      i.color = "#fff";
      i.placeholderColor = "#9CA3AF";
      i.background = "#334155";
      i.focusedBackground = "#334155";
      return i;
    };

    const leftSelect = makeInput("Vector A");
    const rightSelect = makeInput("Vector B");
    selectorRow.addControl(leftSelect);
    selectorRow.addControl(rightSelect);
    controls.addControl(selectorRow);

    const opsRow = new StackPanel();
    opsRow.isVertical = false;
    opsRow.height = "32px";
    opsRow.spacing = 4;

    const makeOpBtn = (text: string) => {
      const b = Button.CreateSimpleButton("op-" + text, text);
      b.width = "42px";
      b.height = "26px";
      b.fontSize = 11;
      b.color = "white";
      b.background = "#0EA5E9";
      b.cornerRadius = 4;
      return b;
    };

    const addBtn = makeOpBtn("+");
    const subBtn = makeOpBtn("−");
    const crossBtn = makeOpBtn("×");
    const projBtn = makeOpBtn("proj");
    opsRow.addControl(addBtn);
    opsRow.addControl(subBtn);
    opsRow.addControl(crossBtn);
    opsRow.addControl(projBtn);
    controls.addControl(opsRow);

    // Result panel
    const resultPanel = new StackPanel();
    resultPanel.width = "120px";
    resultPanel.isVertical = true;
    opStack.addControl(resultPanel);

    const resLabel = new TextBlock();
    resLabel.text = "Result:";
    resLabel.color = "#FACC15";
    resLabel.fontSize = 11;
    resLabel.height = "18px";
    resultPanel.addControl(resLabel);

    const resText = new TextBlock();
    resText.text = "—";
    resText.color = "#fff";
    resText.fontSize = 11;
    resText.fontFamily = "monospace";
    resText.textWrapping = true;
    resText.height = "72px";
    resultPanel.addControl(resText);

    const resolveVector = (input: string) => {
      if (!input) return undefined;
      return this.engine.getVector(input.trim());
    };

    const displayResult = (vec?: BABYLON.Vector3 | null) => {
      if (!vec) { resText.text = "Invalid"; return; }
      resText.text = `x: ${vec.x.toFixed(3)}\ny: ${vec.y.toFixed(3)}\nz: ${vec.z.toFixed(3)}`;
    };

    const pushResult = (vec: BABYLON.Vector3, labelPrefix: string) => {
      const count = this.engine.getVectors().length + 1;
      const key = `${labelPrefix}-${count}`;
      this.engine.addVector({
        key,
        label: key,
        type: "derived",
        origin: BABYLON.Vector3.Zero(),
        value: vec,
        display: { color: this.randomLightColor3() },
        vector: null,
        dependencies: [],
        operation: undefined,
      });
      this.refreshVectorList();
    };

    const perform = (op: "add" | "subtract" | "cross" | "projection") => {
      const a = resolveVector(leftSelect.text);
      const b = resolveVector(rightSelect.text);
      if (!a?.value || !b?.value) { displayResult(undefined); return; }

      let out: BABYLON.Vector3 | undefined;
      switch (op) {
        case "add": out = a.value.add(b.value); break;
        case "subtract": out = a.value.subtract(b.value); break;
        case "cross": out = BABYLON.Vector3.Cross(a.value, b.value); break;
        case "projection": {
          const denom = b.value.lengthSquared();
          out = denom === 0 ? BABYLON.Vector3.Zero()
            : b.value.scale(BABYLON.Vector3.Dot(a.value, b.value) / denom);
          break;
        }
      }

      if (out) {
        displayResult(out);
        pushResult(out, op === "add" ? "Sum" : op === "subtract" ? "Diff" : op === "cross" ? "Cross" : "Proj");
      }
    };

    addBtn.onPointerUpObservable.add(() => perform("add"));
    subBtn.onPointerUpObservable.add(() => perform("subtract"));
    crossBtn.onPointerUpObservable.add(() => perform("cross"));
    projBtn.onPointerUpObservable.add(() => perform("projection"));

    this.contentPanel.addControl(opBox);
  }

  // ── Vector creation ───────────────────────────────────────────────────────

  private randRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private addVector() {
    const count = this.engine.getVectors().length + 1;
    const mag = this.engine.getMaxMagnitude();
    this.engine.addVector({
      key: "Vector-" + count,
      label: "Vector-" + count,
      type: "base",
      origin: BABYLON.Vector3.Zero(),
      value: new BABYLON.Vector3(
        this.randRange(-mag, mag) / 2,
        this.randRange(-mag, mag) / 2,
        this.randRange(-mag, mag) / 2,
      ),
      display: { color: this.randomLightColor3() },
      vector: null,
    });
    this.refreshVectorList();
  }

  private randomLightColor3(minHueGap = 40): BABYLON.Color3 {
    const pickHue = (): number => {
      const h = Math.floor(Math.random() * 360);
      if (this.lastHue === null) return h;
      const diff = Math.abs(h - this.lastHue);
      return diff >= minHueGap && Math.abs(diff - 360) >= minHueGap ? h : pickHue();
    };
    const h = pickHue();
    this.lastHue = h;
    const s = 60 + Math.random() * 40;
    const l = 72 + Math.random() * 16;
    const hNorm = h / 360, sNorm = s / 100, lNorm = l / 100;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r, g, b;
    if (sNorm === 0) { r = g = b = lNorm; }
    else {
      const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
      const p = 2 * lNorm - q;
      r = hue2rgb(p, q, hNorm + 1 / 3);
      g = hue2rgb(p, q, hNorm);
      b = hue2rgb(p, q, hNorm - 1 / 3);
    }
    return new BABYLON.Color3(r, g, b);
  }

  public dispose() {
    this.advancedTexture.dispose();
  }
}
