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
} from "@babylonjs/gui";

import { VectorEngine } from "./VectorEngine";
import { type Arrow } from "./types";

export class UI {
  private advancedTexture: AdvancedDynamicTexture;
  private engine: VectorEngine;
  private contentPanel!: StackPanel;
  private lastHue: number | null = null;

  constructor(scene: BABYLON.Scene, engine: VectorEngine) {
    this.engine = engine;
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI(
      "UI",
      true,
      scene,
    );

    this.buildUI();
  }

  private buildUI() {
    const root = new Rectangle();
    root.width = "100%";
    root.height = "120px";
    root.thickness = 0;
    root.background = "#0F172AAA";
    root.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;

    const top = new Rectangle();
    root.width = "100%";
    root.height = "80px";
    root.thickness = 0;
    root.background = "#0F172AAA";
    root.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

    const modeRow = new StackPanel();
    modeRow.isVertical = false;
    modeRow.height = "28px";
    modeRow.paddingTop = "6px";

    const modeCheckbox = new Checkbox();
    modeCheckbox.width = "18px";
    modeCheckbox.height = "18px";
    modeCheckbox.color = "#fff";
    modeCheckbox.background = "#334155";
    modeCheckbox.isChecked = this.engine.getHeadToTail();
    modeCheckbox.onIsCheckedChangedObservable.add((checked) => {
      this.engine.setHeadToTail(checked);
    });

    const modeLabel = new TextBlock();
    modeLabel.text = "Head-to-tail";
    modeLabel.color = "#fff";
    modeLabel.fontSize = 12;
    modeLabel.paddingLeft = "8px";
    modeLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

    modeRow.addControl(modeCheckbox);
    modeRow.addControl(modeLabel);
    top.addControl(modeRow);

    const modeHelp = new TextBlock();
    modeHelp.text = "Toggle arrows drawn from origin or chained head-to-tail.";
    modeHelp.color = "#9CA3AF";
    modeHelp.fontSize = 10;
    modeHelp.height = "16px";
    top.addControl(modeHelp);

    this.advancedTexture.addControl(top);
    this.advancedTexture.addControl(root);

    const scroll = new ScrollViewer();
    scroll.width = "100%";
    scroll.height = "100%";
    scroll.thickness = 0;
    scroll.barSize = 6;
    scroll.horizontalBar.isVisible = true;
    scroll.verticalBar.isVisible = false;

    root.addControl(scroll);

    this.contentPanel = new StackPanel();
    this.contentPanel.isVertical = false;
    this.contentPanel.height = "100%";

    scroll.addControl(this.contentPanel);

    this.refreshVectorList();
  }

  private addOperationsPanel() {
    const opBox = new Rectangle();
    opBox.width = "360px";
    opBox.height = "100px";
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

    // Left: controls column
    const controls = new StackPanel();
    controls.width = "220px";
    controls.isVertical = true;
    opStack.addControl(controls);

    // Row: Vector selectors
    const selectorRow = new StackPanel();
    selectorRow.isVertical = false;
    selectorRow.height = "28px";

    const leftSelect = new InputText();
    leftSelect.width = "90px";
    leftSelect.height = "24px";
    leftSelect.placeholderText = "Vector A";
    leftSelect.text = "";
    leftSelect.fontSize = 12;
    leftSelect.color = "#fff";
    leftSelect.placeholderColor = "#9CA3AF";
    leftSelect.background = "#334155";
    leftSelect.focusedBackground = "#334155";
    selectorRow.addControl(leftSelect);

    const rightSelect = new InputText();
    rightSelect.width = "90px";
    rightSelect.height = "24px";
    rightSelect.placeholderText = "Vector B";
    rightSelect.text = "";
    rightSelect.fontSize = 12;
    rightSelect.color = "#fff";
    rightSelect.placeholderColor = "#9CA3AF";
    rightSelect.background = "#334155";
    rightSelect.focusedBackground = "#334155";
    selectorRow.addControl(rightSelect);

    controls.addControl(selectorRow);

    // Row: operation buttons
    const opsRow = new StackPanel();
    opsRow.isVertical = false;
    opsRow.height = "36px";
    opsRow.spacing = 6;

    const makeOpBtn = (text: string) => {
      const b = Button.CreateSimpleButton("op-" + text, text);
      b.width = "48px";
      b.height = "28px";
      b.fontSize = 12;
      b.color = "white";
      b.background = "#0ea5e9";
      return b;
    };

    const addBtn = makeOpBtn("+");
    const subBtn = makeOpBtn("-");
    const crossBtn = makeOpBtn("×");
    const projBtn = makeOpBtn("proj");

    opsRow.addControl(addBtn);
    opsRow.addControl(subBtn);
    opsRow.addControl(crossBtn);
    opsRow.addControl(projBtn);

    controls.addControl(opsRow);

    // Right: result preview
    const resultPanel = new StackPanel();
    resultPanel.width = "120px";
    resultPanel.isVertical = true;
    resultPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;

    const resLabel = new TextBlock();
    resLabel.text = "Result:";
    resLabel.color = "#FACC15";
    resLabel.fontSize = 12;
    resLabel.height = "18px";
    resultPanel.addControl(resLabel);

    const resText = new TextBlock();
    resText.text = "—";
    resText.color = "#fff";
    resText.fontSize = 12;
    resText.textWrapping = true;
    resText.height = "64px";
    resultPanel.addControl(resText);

    opStack.addControl(resultPanel);

    // Helper to resolve input to Arrow
    const resolveVector = (input: string) => {
      if (!input) return undefined;
      const v = this.engine.getVector(input.trim());
      return v;
    };

    const displayResult = (vec?: BABYLON.Vector3 | null) => {
      if (!vec) {
        resText.text = "Invalid";
        return;
      }
      resText.text = `x:${vec.x.toFixed(2)}\ny:${vec.y.toFixed(2)}\nz:${vec.z.toFixed(2)}`;
    };

    const pushResultAsDerived = (vec: BABYLON.Vector3, label = "OpResult") => {
      const count = this.engine.getVectors().length + 1;
      const key = `${label}-${count}`;

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

    // wire buttons
    const perform = (op: "add" | "subtract" | "cross" | "projection") => {
      const a = resolveVector(leftSelect.text);
      const b = resolveVector(rightSelect.text);
      if (!a || !b || !a.value || !b.value) {
        displayResult(undefined);
        return;
      }

      let out: BABYLON.Vector3 | undefined;
      switch (op) {
        case "add":
          out = a.value.add(b.value);
          break;
        case "subtract":
          out = a.value.subtract(b.value);
          break;
        case "cross":
          out = BABYLON.Vector3.Cross(a.value, b.value);
          break;
        case "projection": {
          const denom = b.value.lengthSquared();
          out =
            denom === 0
              ? BABYLON.Vector3.Zero()
              : b.value.scale(BABYLON.Vector3.Dot(a.value, b.value) / denom);
          break;
        }
      }

      if (out) {
        displayResult(out);
        pushResultAsDerived(
          out,
          op === "add"
            ? "Vector"
            : op === "subtract"
              ? "A-B"
              : op === "cross"
                ? "A×B"
                : "proj(A,B)",
        );
      }
    };

    addBtn.onPointerUpObservable.add(() => perform("add"));
    subBtn.onPointerUpObservable.add(() => perform("subtract"));
    crossBtn.onPointerUpObservable.add(() => perform("cross"));
    projBtn.onPointerUpObservable.add(() => perform("projection"));

    // Add to UI: put it at the start of the content panel (after Add button)
    this.contentPanel.addControl(opBox);
  }

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
    box.width = "70px";
    box.height = "100px";
    box.thickness = 1;
    box.color = "#22C55E";
    box.cornerRadius = 8;

    const btn = Button.CreateSimpleButton("add", "+");
    btn.fontSize = 28;
    btn.color = "white";
    btn.background = "#16A34A";

    btn.onPointerUpObservable.add(() => {
      this.addVector();
    });

    box.addControl(btn);
    return box;
  }

  private createVectorBlock(arrow: Arrow): Rectangle {
    const box = new Rectangle();
    box.width = "230px";
    box.height = "100px";
    box.thickness = 1;
    box.color = "#334155";
    box.cornerRadius = 8;
    box.background = "#1E293BCC";
    box.paddingLeft = "5px";
    box.paddingRight = "5px";

    const stack = new StackPanel();
    box.addControl(stack);

    const top = new StackPanel();
    top.isVertical = false;
    top.height = "24px";
    stack.addControl(top);

    const label = new TextBlock();
    label.text = arrow.label;
    label.width = "180px";
    label.color = arrow.display?.color?.toHexString() || "#fff";
    label.fontSize = 14;
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    top.addControl(label);

    const removeBtn = Button.CreateSimpleButton("rm", "✕");
    removeBtn.width = "24px";
    removeBtn.height = "24px";
    removeBtn.fontSize = 12;
    removeBtn.color = "white";
    removeBtn.background = "#DC2626";

    removeBtn.onPointerUpObservable.add(() => {
      this.engine.removeVector(arrow.key);
      this.refreshVectorList();
    });

    top.addControl(removeBtn);

    stack.addControl(this.createVecInputRow("V", arrow, arrow.value, "value"));
    stack.addControl(
      this.createVecInputRow("O", arrow, arrow.origin, "origin"),
    );

    return box;
  }

  private createVecInputRow(
    label: string,
    arrow: Arrow,
    vec: BABYLON.Vector3,
    field: "value" | "origin",
  ): StackPanel {
    const row = new StackPanel();
    row.isVertical = false;
    row.height = "30px";

    const lbl = new TextBlock();
    lbl.text = label + ":";
    lbl.width = "20px";
    lbl.color = "#FACC15";
    lbl.fontSize = 12;
    row.addControl(lbl);

    ["x", "y", "z"].forEach((axis) => {
      const input = new InputText();
      input.width = "40px";
      input.height = "24px";
      input.text = vec[axis as keyof BABYLON.Vector3].toString();
      input.color = "#fff";
      input.background = "#334155";
      input.fontSize = 12;

      input.onBlurObservable.add(() => {
        const val = parseFloat(input.text) || 0;

        const updatedVec = vec.clone();
        updatedVec[axis as "x" | "y" | "z"] = val;

        this.engine.updateVector(arrow.key, {
          [field]: updatedVec,
        } as Partial<Arrow>);
      });

      row.addControl(input);
    });

    return row;
  }

  private randRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private addVector() {
    const count = this.engine.getVectors().length + 1;

    this.engine.addVector({
      key: "Vector-" + count,
      label: "Vector-" + count,
      type: "base",
      origin: BABYLON.Vector3.Zero(),
      value: new BABYLON.Vector3(
        this.randRange(
          -1 * this.engine.getMaxMagnitude(),
          this.engine.getMaxMagnitude(),
        ) / 2,
        this.randRange(
          -1 * this.engine.getMaxMagnitude(),
          this.engine.getMaxMagnitude(),
        ) / 2,
        this.randRange(
          -1 * this.engine.getMaxMagnitude(),
          this.engine.getMaxMagnitude(),
        ) / 2,
      ),
      display: {
        color: this.randomLightColor3(),
      },
      vector: null,
    });

    this.refreshVectorList();
  }

  private randomLightColor3(minHueGap = 40): BABYLON.Color3 {
    // pick hue ensuring it's at least minHueGap away from lastHue
    const pickHue = (): number => {
      const h = Math.floor(Math.random() * 360);
      if (this.lastHue === null) return h;
      const diff = Math.abs(h - this.lastHue);
      return diff >= minHueGap && Math.abs(diff - 360) >= minHueGap
        ? h
        : pickHue();
    };

    const h = pickHue();
    this.lastHue = h;

    const s = 60 + Math.random() * 40; // 60–100% saturation (keeps colors vivid)
    const l = 72 + Math.random() * 16; // 72–88% lightness (keeps colors light)

    // HSL -> RGB conversion (returns 0..1 floats)
    const hNorm = h / 360;
    const sNorm = s / 100;
    const lNorm = l / 100;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r: number, g: number, b: number;
    if (sNorm === 0) {
      r = g = b = lNorm;
    } else {
      const q =
        lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
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
