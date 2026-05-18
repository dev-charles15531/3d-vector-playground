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
  private idleBtn!: Button;

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
      this.freezeBtn.background = frozen ? "#EF4444" : "#1E293B";
      this.freezeBtn.color = frozen ? "#fff" : "#94A3B8";
      (this.freezeBtn.children[0] as TextBlock).text = frozen
        ? "Unfreeze"
        : "Freeze Scene";
    };

    this.cameraController.onHighContrastChanged = (enabled) => {
      this.hcBtn.background = enabled ? "#92400E" : "#1E293B";
      this.hcBtn.color = enabled ? "#FCD34D" : "#94A3B8";
    };

    this.cameraController.onIdleChanged = (enabled) => {
      this.idleBtn.background = enabled ? "#1E3A5F" : "#1E293B";
      this.idleBtn.color = enabled ? "#7DD3FC" : "#475569";
    };
  }

  private buildUI() {
    // ── Bottom strip (vector list) ──────────────────────────────────────────
    const root = new Rectangle();
    root.width = "100%";
    root.height = "160px";
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
  // Layout: [section pill] [btn] [btn] ... | [section pill] [btn] ...
  // Each section is visually separated by a vertical rule. Buttons have
  // consistent 6px right margin so they don't stack against the divider.

  private buildToolbar() {
    const bar = new Rectangle();
    bar.width = "100%";
    bar.height = "44px";
    bar.thickness = 0;
    bar.background = "#090D1BF2";
    bar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.advancedTexture.addControl(bar);

    const row = new StackPanel();
    row.isVertical = false;
    row.width = "100%";
    row.height = "100%";
    row.paddingLeft = "10px";
    row.paddingTop = "6px";
    row.paddingBottom = "6px";
    bar.addControl(row);

    // ── MODE ───────────────────────────────────────────────────────────────
    row.addControl(this.makeSectionPill("MODE"));

    const htCheck = new Checkbox();
    htCheck.width = "15px";
    htCheck.height = "15px";
    htCheck.color = "#38BDF8";
    htCheck.background = "#1E293B";
    htCheck.isChecked = this.engine.getHeadToTail();
    htCheck.onIsCheckedChangedObservable.add((v) =>
      this.engine.setHeadToTail(v),
    );
    const htWrap = this.wrapWithLabel(htCheck, "Head-to-Tail");
    htWrap.paddingRight = "10px";
    row.addControl(htWrap);

    row.addControl(this.makeDivider());

    // ── DRAG ───────────────────────────────────────────────────────────────
    row.addControl(this.makeSectionPill("DRAG"));

    this.snapBtn = this.makeToolBtn("Snap to Integer", () => {
      const on = this.dragController.getSnapToGrid();
      this.dragController.setSnapToGrid(!on);
      this.snapBtn.background = !on ? "#22C55E" : "#1E293B";
      this.snapBtn.color = !on ? "#000" : "#94A3B8";
    });
    this.snapBtn.paddingRight = "6px";
    row.addControl(this.snapBtn);

    row.addControl(this.makeDivider());

    // ── VIEW ───────────────────────────────────────────────────────────────
    row.addControl(this.makeSectionPill("VIEW"));

    const viewPresets: { preset: CameraPreset; label: string }[] = [
      { preset: "top", label: "Top" },
      { preset: "front", label: "Front" },
      { preset: "side", label: "Side" },
      { preset: "free", label: "3D" },
    ];
    viewPresets.forEach(({ preset, label }) => {
      const btn = this.makeToolBtn(label, () =>
        this.cameraController.goToPreset(preset),
      );
      btn.paddingRight = "4px";
      row.addControl(btn);
    });

    row.addControl(this.makeDivider());

    // ── RECORD ─────────────────────────────────────────────────────────────
    row.addControl(this.makeSectionPill("RECORD"));

    this.freezeBtn = this.makeToolBtn("Freeze Scene", () =>
      this.cameraController.toggleFreeze(),
    );
    this.freezeBtn.paddingRight = "4px";
    row.addControl(this.freezeBtn);

    this.hcBtn = this.makeToolBtn("High Contrast", () => {
      this.cameraController.toggleHighContrast();
    });
    this.hcBtn.paddingRight = "4px";
    row.addControl(this.hcBtn);

    // Idle orbit toggle — ON by default, matching CameraController's initial state
    this.idleBtn = this.makeToolBtn("Orbit", () => {
      this.cameraController.toggleIdle();
    });
    this.idleBtn.background = "#1E3A5F"; // on = tinted blue
    this.idleBtn.color = "#7DD3FC";
    this.idleBtn.paddingRight = "6px";
    row.addControl(this.idleBtn);

    row.addControl(this.makeDivider());

    // ── SHARE ──────────────────────────────────────────────────────────────
    row.addControl(this.makeSectionPill("SHARE"));

    const shareBtn = this.makeToolBtn("Copy Link", () => {
      StateSerializer.encode(this.engine.getVectors());
      this.showToast("Scene URL copied to clipboard");
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
    btn.width = text.length * 7 + 24 + "px";
    btn.height = "28px";
    btn.fontSize = 11;
    btn.color = "#94A3B8";
    btn.background = "#1E293B";
    btn.cornerRadius = 5;
    btn.thickness = 1;
    btn.onPointerUpObservable.add(onClick);
    return btn;
  }

  /** Compact coloured pill label that anchors each toolbar section */
  private makeSectionPill(text: string): Rectangle {
    const pill = new Rectangle();
    pill.width = text.length * 6.5 + 14 + "px";
    pill.height = "18px";
    pill.cornerRadius = 9;
    pill.background = "#1E3A5F";
    pill.thickness = 0;
    pill.paddingRight = "6px";

    const lbl = new TextBlock();
    lbl.text = text;
    lbl.color = "#7DD3FC";
    lbl.fontSize = 8.5;
    lbl.fontFamily = "monospace";
    lbl.fontStyle = "bold";
    pill.addControl(lbl);
    return pill;
  }

  private makeDivider(): Rectangle {
    const d = new Rectangle();
    d.width = "1px";
    d.height = "22px";
    d.background = "#1E293B";
    d.thickness = 0;
    d.paddingLeft = "8px";
    d.paddingRight = "8px";
    return d;
  }

  private wrapWithLabel(control: Control, labelText: string): StackPanel {
    const wrap = new StackPanel();
    wrap.isVertical = false;
    wrap.width = labelText.length * 7 + 36 + "px";
    wrap.height = "28px";

    const lbl = new TextBlock();
    lbl.text = labelText;
    lbl.width = labelText.length * 7 + 6 + "px";
    lbl.height = "28px";
    lbl.color = "#94A3B8";
    lbl.fontSize = 11;
    lbl.paddingLeft = "5px";

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

    // Height grows when selected to show the keymap hint row
    const boxHeight = isSelected ? "148px" : "120px";

    const box = new Rectangle();
    box.width = "270px";
    box.height = boxHeight;
    box.thickness = isSelected ? 2 : 1;
    box.color = isSelected ? accentHex : "#334155";
    box.cornerRadius = 8;
    box.background = isSelected ? "#1A2744EE" : "#1E293BCC";
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

    // ── Top row: label + axis locks + remove ────────────────────────────
    const topRow = new StackPanel();
    topRow.isVertical = false;
    topRow.height = "24px";
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
      topRow.addControl(lockBtn);
    });

    const removeBtn = Button.CreateSimpleButton("rm-" + arrow.key, "✕");
    removeBtn.width = "20px";
    removeBtn.height = "20px";
    removeBtn.fontSize = 11;
    removeBtn.color = "white";
    removeBtn.background = "#DC2626";
    removeBtn.cornerRadius = 4;
    removeBtn.paddingLeft = "4px";
    removeBtn.onPointerUpObservable.add(() => {
      this.engine.removeVector(arrow.key);
      this.refreshVectorList();
    });
    topRow.addControl(removeBtn);

    // ── Vector and origin inputs ─────────────────────────────────────────
    stack.addControl(this.createVecInputRow("V", arrow, arrow.value, "value"));
    stack.addControl(
      this.createVecInputRow("O", arrow, arrow.origin, "origin"),
    );

    // ── Bottom row: magnitude + overlay toggles ──────────────────────────
    const bottomRow = new StackPanel();
    bottomRow.isVertical = false;
    bottomRow.height = "22px";
    stack.addControl(bottomRow);

    const magLabel = new TextBlock();
    magLabel.text = `|v|=${arrow.value.length().toFixed(2)}`;
    magLabel.color = "#64748B";
    magLabel.fontSize = 9.5;
    magLabel.fontFamily = "monospace";
    magLabel.width = "90px";
    magLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    bottomRow.addControl(magLabel);

    // Components toggle
    const showComp = arrow.showComponents !== false;
    const compBtn = Button.CreateSimpleButton("comp-" + arrow.key, "XYZ");
    compBtn.width = "30px";
    compBtn.height = "16px";
    compBtn.fontSize = 8;
    compBtn.color = showComp ? "#000" : "#475569";
    compBtn.background = showComp ? "#38BDF8" : "#1E293B";
    compBtn.cornerRadius = 3;
    compBtn.thickness = 1;
    compBtn.onPointerUpObservable.add(() => {
      this.engine.updateVector(arrow.key, { showComponents: !showComp } as any);
      this.refreshVectorList();
    });
    bottomRow.addControl(compBtn);

    // Angle toggle
    const showAngle = arrow.showAngle !== false;
    const angleBtn = Button.CreateSimpleButton("angle-" + arrow.key, "∠");
    angleBtn.width = "22px";
    angleBtn.height = "16px";
    angleBtn.fontSize = 9;
    angleBtn.color = showAngle ? "#000" : "#475569";
    angleBtn.background = showAngle ? "#A78BFA" : "#1E293B";
    angleBtn.cornerRadius = 3;
    angleBtn.thickness = 1;
    angleBtn.paddingLeft = "3px";
    angleBtn.onPointerUpObservable.add(() => {
      this.engine.updateVector(arrow.key, { showAngle: !showAngle } as any);
      this.refreshVectorList();
    });
    bottomRow.addControl(angleBtn);

    // ── Keymap hint (only when selected) ────────────────────────────────
    if (isSelected) {
      const hint = new Rectangle();
      hint.height = "22px";
      hint.thickness = 1;
      hint.color = "#1E3A5F";
      hint.cornerRadius = 4;
      hint.background = "#0F172A";
      hint.paddingTop = "2px";
      stack.addControl(hint);

      const hintRow = new StackPanel();
      hintRow.isVertical = false;
      hint.addControl(hintRow);

      const makeHint = (key: string, desc: string, color = "#7DD3FC") => {
        const keyBadge = new Rectangle();
        keyBadge.width = "18px";
        keyBadge.height = "14px";
        keyBadge.cornerRadius = 3;
        keyBadge.background = "#1E3A5F";
        keyBadge.thickness = 0;
        keyBadge.paddingLeft = "4px";
        const keyTxt = new TextBlock();
        keyTxt.text = key;
        keyTxt.color = color;
        keyTxt.fontSize = 8.5;
        keyTxt.fontStyle = "bold";
        keyBadge.addControl(keyTxt);

        const descTxt = new TextBlock();
        descTxt.text = desc;
        descTxt.color = "#475569";
        descTxt.fontSize = 8;
        descTxt.width = desc.length * 5 + 4 + "px";
        descTxt.paddingLeft = "2px";
        descTxt.paddingRight = "6px";

        hintRow.addControl(keyBadge);
        hintRow.addControl(descTxt);
      };

      makeHint("F", "Focus");
      makeHint("Esc", "Reset", "#94A3B8");
    }

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
      const isLocked =
        field === "value" && (arrow.lockedAxes?.includes(axis) ?? false);

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
        this.engine.updateVector(arrow.key, {
          [field]: updatedVec,
        } as Partial<Arrow>);
      });

      row.addControl(input);
    });

    return row;
  }

  // ── Operations panel ─────────────────────────────────────────────────────
  // Layout:
  //   [A input] [op buttons: + − × proj] [B input]   →   Result box
  //   Result shows: vector components + magnitude + a "Add to scene" button

  private addOperationsPanel() {
    const opBox = new Rectangle();
    opBox.width = "400px";
    opBox.height = "138px";
    opBox.thickness = 1;
    opBox.color = "#1E3A5F";
    opBox.cornerRadius = 8;
    opBox.background = "#09101EF0";
    opBox.paddingLeft = "10px";
    opBox.paddingRight = "10px";
    opBox.paddingTop = "6px";
    opBox.paddingBottom = "6px";

    const outer = new StackPanel();
    outer.isVertical = true;
    outer.height = "100%";
    opBox.addControl(outer);

    // ── Header ────────────────────────────────────────────────────────────
    const header = new TextBlock();
    header.text = "OPERATIONS";
    header.height = "14px";
    header.color = "#7DD3FC";
    header.fontSize = 8.5;
    header.fontFamily = "monospace";
    header.fontStyle = "bold";
    header.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    outer.addControl(header);

    // ── Main row: [A] [ops] [B]  |  result ───────────────────────────────
    const mainRow = new StackPanel();
    mainRow.isVertical = false;
    mainRow.height = "106px";
    outer.addControl(mainRow);

    // Left side: inputs + op buttons
    const leftCol = new StackPanel();
    leftCol.isVertical = true;
    leftCol.width = "230px";
    mainRow.addControl(leftCol);

    // Input row
    const inputRow = new StackPanel();
    inputRow.isVertical = false;
    inputRow.height = "28px";
    inputRow.paddingBottom = "4px";
    leftCol.addControl(inputRow);

    const makeVecInput = (placeholder: string) => {
      const i = new InputText();
      i.width = "100px";
      i.height = "24px";
      i.placeholderText = placeholder;
      i.text = "";
      i.fontSize = 11;
      i.color = "#E2E8F0";
      i.placeholderColor = "#475569";
      i.background = "#1E293B";
      i.focusedBackground = "#1E293B";
      i.thickness = 1;
      i.paddingRight = "4px";
      return i;
    };

    const leftSelect = makeVecInput("Vector A  (key)");
    const rightSelect = makeVecInput("Vector B  (key)");
    inputRow.addControl(leftSelect);
    inputRow.addControl(rightSelect);

    // Op buttons row + dot product display on the same visual tier
    const opsRow = new StackPanel();
    opsRow.isVertical = false;
    opsRow.height = "32px";
    opsRow.spacing = 4;
    leftCol.addControl(opsRow);

    type OpDef = {
      label: string;
      op: "add" | "subtract" | "cross" | "projection";
      color: string;
      tip: string;
    };
    const opDefs: OpDef[] = [
      { label: "A + B", op: "add", color: "#22C55E", tip: "Add" },
      { label: "A − B", op: "subtract", color: "#F87171", tip: "Subtract" },
      { label: "A × B", op: "cross", color: "#A78BFA", tip: "Cross product" },
      {
        label: "proj",
        op: "projection",
        color: "#38BDF8",
        tip: "Projection of A onto B",
      },
    ];

    opDefs.forEach(({ label, op, color }) => {
      const b = Button.CreateSimpleButton("op-" + op, label);
      b.width = label.length * 6.5 + 18 + "px";
      b.height = "26px";
      b.fontSize = 10;
      b.color = color;
      b.background = "#1E293B";
      b.cornerRadius = 5;
      b.thickness = 1;
      b.onPointerUpObservable.add(() => perform(op));
      opsRow.addControl(b);
    });

    // Dot product — same row height and border style as op buttons so it
    // reads as a peer metric, not a buried footnote.
    const dotDisplay = new Rectangle();
    dotDisplay.height = "26px";
    dotDisplay.width = "82px";
    dotDisplay.cornerRadius = 5;
    dotDisplay.background = "#1E293B";
    dotDisplay.thickness = 1;
    dotDisplay.color = "#FACC15";
    dotDisplay.paddingLeft = "4px";
    leftCol.addControl(dotDisplay);

    const dotInner = new StackPanel();
    dotInner.isVertical = false;
    dotInner.height = "100%";
    dotDisplay.addControl(dotInner);

    const dotLabelTxt = new TextBlock();
    dotLabelTxt.text = "A·B = ";
    dotLabelTxt.width = "36px";
    dotLabelTxt.color = "#FACC15";
    dotLabelTxt.fontSize = 10;
    dotLabelTxt.fontStyle = "bold";
    dotLabelTxt.fontFamily = "monospace";
    dotInner.addControl(dotLabelTxt);

    const dotVal = new TextBlock();
    dotVal.text = "—";
    dotVal.width = "42px";
    dotVal.color = "#E2E8F0";
    dotVal.fontSize = 10;
    dotVal.fontFamily = "monospace";
    dotVal.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    dotInner.addControl(dotVal);

    // Divider
    const vDiv = new Rectangle();
    vDiv.width = "1px";
    vDiv.height = "80px";
    vDiv.background = "#1E3A5F";
    vDiv.thickness = 0;
    vDiv.paddingLeft = "8px";
    vDiv.paddingRight = "8px";
    mainRow.addControl(vDiv);

    // Result column
    const resultCol = new StackPanel();
    resultCol.isVertical = true;
    resultCol.width = "140px";
    mainRow.addControl(resultCol);

    const resTitle = new TextBlock();
    resTitle.text = "Result";
    resTitle.height = "14px";
    resTitle.color = "#FACC15";
    resTitle.fontSize = 10;
    resTitle.fontStyle = "bold";
    resTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    resultCol.addControl(resTitle);

    const resCoords = new TextBlock();
    resCoords.text = "—";
    resCoords.height = "42px";
    resCoords.color = "#E2E8F0";
    resCoords.fontSize = 10;
    resCoords.fontFamily = "monospace";
    resCoords.textWrapping = true;
    resCoords.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    resultCol.addControl(resCoords);

    const resMag = new TextBlock();
    resMag.text = "";
    resMag.height = "14px";
    resMag.color = "#64748B";
    resMag.fontSize = 9;
    resMag.fontFamily = "monospace";
    resMag.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    resultCol.addControl(resMag);

    /** Recompute dot product whenever inputs change */
    const refreshDot = () => {
      const a = this.engine.getVector(leftSelect.text.trim());
      const b = this.engine.getVector(rightSelect.text.trim());
      if (a?.value && b?.value) {
        dotVal.text = BABYLON.Vector3.Dot(a.value, b.value).toFixed(3);
        dotVal.color = "#E2E8F0";
      } else {
        dotVal.text = "—";
        dotVal.color = "#475569";
      }
    };

    leftSelect.onTextChangedObservable.add(refreshDot);
    rightSelect.onTextChangedObservable.add(refreshDot);

    const addToSceneBtn = Button.CreateSimpleButton(
      "addResult",
      "+ Add to scene",
    );
    addToSceneBtn.width = "120px";
    addToSceneBtn.height = "20px";
    addToSceneBtn.fontSize = 10;
    addToSceneBtn.color = "#22C55E";
    addToSceneBtn.background = "#052E16";
    addToSceneBtn.cornerRadius = 4;
    addToSceneBtn.thickness = 1;
    addToSceneBtn.isEnabled = false;
    addToSceneBtn.alpha = 0.4;
    resultCol.addControl(addToSceneBtn);

    // ── Logic ─────────────────────────────────────────────────────────────
    let pendingResult: BABYLON.Vector3 | null = null;
    let pendingLabel = "";

    const displayResult = (vec: BABYLON.Vector3 | null, opLabel: string) => {
      pendingResult = vec;
      pendingLabel = opLabel;
      refreshDot();
      if (!vec) {
        resCoords.text = "Invalid —\ncheck keys";
        resMag.text = "";
        addToSceneBtn.isEnabled = false;
        addToSceneBtn.alpha = 0.35;
        return;
      }
      resCoords.text = `x ${vec.x.toFixed(2)}\ny ${vec.y.toFixed(2)}\nz ${vec.z.toFixed(2)}`;
      resMag.text = `|v| = ${vec.length().toFixed(3)}`;
      addToSceneBtn.isEnabled = true;
      addToSceneBtn.alpha = 1;
    };

    addToSceneBtn.onPointerUpObservable.add(() => {
      if (!pendingResult) return;
      const count = this.engine.getVectors().length + 1;
      const key = `${pendingLabel}-${count}`;
      this.engine.addVector({
        key,
        label: key,
        type: "derived",
        origin: BABYLON.Vector3.Zero(),
        value: pendingResult.clone(),
        display: { color: this.randomLightColor3() },
        vector: null,
        dependencies: [],
        operation: undefined,
      });
      this.refreshVectorList();
    });

    const perform = (op: "add" | "subtract" | "cross" | "projection") => {
      const a = this.engine.getVector(leftSelect.text.trim());
      const b = this.engine.getVector(rightSelect.text.trim());
      if (!a?.value || !b?.value) {
        displayResult(null, "");
        return;
      }

      let out: BABYLON.Vector3;
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
          const d = b.value.lengthSquared();
          out =
            d === 0
              ? BABYLON.Vector3.Zero()
              : b.value.scale(BABYLON.Vector3.Dot(a.value, b.value) / d);
          break;
        }
      }

      const labelMap = {
        add: "Sum",
        subtract: "Diff",
        cross: "Cross",
        projection: "Proj",
      };
      displayResult(out!, labelMap[op]);
    };

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
      return diff >= minHueGap && Math.abs(diff - 360) >= minHueGap
        ? h
        : pickHue();
    };
    const h = pickHue();
    this.lastHue = h;
    const s = 60 + Math.random() * 40;
    const l = 72 + Math.random() * 16;
    const hNorm = h / 360,
      sNorm = s / 100,
      lNorm = l / 100;
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r, g, b;
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
