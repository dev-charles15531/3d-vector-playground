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
  private compactBtn!: Button;

  private compactMode = true;

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

    // ── Fix 1: FXAA post-processing blurs the GUI ─────────────────────────
    // DefaultRenderingPipeline's FXAA pass runs over the entire composited
    // frame, including the GUI layer. Every text glyph and border gets
    // softened by the anti-aliasing kernel — that's the blur you see.
    // Setting applyPostProcess = false makes the GUI layer render after
    // the FXAA pass, bypassing it entirely. 3D geometry still gets FXAA.
    if (this.advancedTexture.layer) {
      this.advancedTexture.layer.applyPostProcess = false;
    }

    // ── Fix 2: HiDPI coordinate space ────────────────────────────────────
    // Without this, the ADT layout space = physical pixels (e.g. 3840).
    // fontSize:13 = 13 physical px on a 3840-wide texture = appears tiny.
    // We set widthInPixels = CSS logical width so font sizes are CSS pixels,
    // and scaleX = dpr so rendering fills physical pixels at native sharpness.
    const applyHiDPI = () => {
      const dpr = window.devicePixelRatio || 1;
      const canvas = scene.getEngine().getRenderingCanvas();
      const cssW = canvas ? canvas.clientWidth : window.innerWidth;
      const cssH = canvas ? canvas.clientHeight : window.innerHeight;
      const rc = this.advancedTexture.rootContainer;
      rc.scaleX = dpr;
      rc.scaleY = dpr;
      rc.widthInPixels = cssW;
      rc.heightInPixels = cssH;
    };
    applyHiDPI();
    scene.getEngine().onResizeObservable.add(applyHiDPI);

    this.buildUI();

    this.engine.onSelectionChanged(() => {
      this.refreshVectorList();
    });

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
    // Bottom strip — tighter than original (130px vs 160px)
    const root = new Rectangle();
    root.width = "100%";
    root.height = "130px";
    root.thickness = 0;
    root.background = "#0A0F1EE8";
    root.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.advancedTexture.addControl(root);

    const scroll = new ScrollViewer();
    scroll.width = "100%";
    scroll.height = "100%";
    scroll.thickness = 0;
    scroll.barSize = 4;
    scroll.horizontalBar.isVisible = true;
    scroll.verticalBar.isVisible = false;
    root.addControl(scroll);

    this.contentPanel = new StackPanel();
    this.contentPanel.isVertical = false;
    this.contentPanel.height = "100%";
    scroll.addControl(this.contentPanel);

    this.refreshVectorList();
    this.buildToolbar();
  }

  private buildToolbar() {
    const bar = new Rectangle();
    bar.width = "100%";
    bar.height = "38px";
    bar.thickness = 0;
    bar.background = "#080C18F5";
    bar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.advancedTexture.addControl(bar);

    const row = new StackPanel();
    row.isVertical = false;
    row.width = "100%";
    row.height = "100%";
    row.paddingLeft = "10px";
    row.paddingTop = "5px";
    row.paddingBottom = "5px";
    bar.addControl(row);

    // ── MODE ───────────────────────────────────────────────────────────────
    row.addControl(this.makeSectionPill("MODE"));

    const htCheck = new Checkbox();
    htCheck.width = "14px";
    htCheck.height = "14px";
    htCheck.color = "#38BDF8";
    htCheck.background = "#1E293B";
    htCheck.isChecked = this.engine.getHeadToTail();
    htCheck.onIsCheckedChangedObservable.add((v) =>
      this.engine.setHeadToTail(v),
    );
    const htWrap = this.wrapWithLabel(htCheck, "Head-to-Tail");
    htWrap.paddingRight = "8px";
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
    this.snapBtn.paddingRight = "4px";
    row.addControl(this.snapBtn);

    this.compactBtn = this.makeToolBtn("Compact", () => {
      this.compactMode = !this.compactMode;
      this.compactBtn.background = this.compactMode ? "#7C3AED" : "#1E293B";
      this.compactBtn.color = this.compactMode ? "#EDE9FE" : "#94A3B8";
    });
    this.compactBtn.background = "#7C3AED";
    this.compactBtn.color = "#EDE9FE";
    this.compactBtn.paddingRight = "4px";
    row.addControl(this.compactBtn);

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
      btn.paddingRight = "3px";
      row.addControl(btn);
    });

    row.addControl(this.makeDivider());

    // ── RECORD ─────────────────────────────────────────────────────────────
    row.addControl(this.makeSectionPill("RECORD"));

    this.freezeBtn = this.makeToolBtn("Freeze Scene", () =>
      this.cameraController.toggleFreeze(),
    );
    this.freezeBtn.paddingRight = "3px";
    row.addControl(this.freezeBtn);

    this.hcBtn = this.makeToolBtn("High Contrast", () => {
      this.cameraController.toggleHighContrast();
    });
    this.hcBtn.paddingRight = "3px";
    row.addControl(this.hcBtn);

    this.idleBtn = this.makeToolBtn("Orbit", () => {
      this.cameraController.toggleIdle();
    });
    this.idleBtn.background = "#1E3A5F";
    this.idleBtn.color = "#7DD3FC";
    this.idleBtn.paddingRight = "5px";
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

  // ── Toast ─────────────────────────────────────────────────────────────────

  private showToast(message: string) {
    const toast = new Rectangle();
    toast.width = "200px";
    toast.height = "30px";
    toast.cornerRadius = 7;
    toast.background = "#22C55EEE";
    toast.thickness = 0;
    toast.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    toast.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    toast.top = "46px";
    this.advancedTexture.addControl(toast);

    const txt = new TextBlock();
    txt.text = message;
    txt.color = "white";
    txt.fontSize = 12;
    toast.addControl(txt);

    setTimeout(() => {
      this.advancedTexture.removeControl(toast);
      toast.dispose();
    }, 2000);
  }

  // ── Toolbar helpers ───────────────────────────────────────────────────────

  private makeToolBtn(text: string, onClick: () => void): Button {
    const btn = Button.CreateSimpleButton("tbtn-" + text, text);
    btn.width = text.length * 7 + 22 + "px";
    btn.height = "26px";
    btn.fontSize = 11;
    btn.color = "#94A3B8";
    btn.background = "#1E293B";
    btn.cornerRadius = 4;
    btn.thickness = 1;
    btn.onPointerUpObservable.add(onClick);
    return btn;
  }

  private makeSectionPill(text: string): Rectangle {
    const pill = new Rectangle();
    pill.width = text.length * 6 + 14 + "px";
    pill.height = "16px";
    pill.cornerRadius = 8;
    pill.background = "#1E3A5F";
    pill.thickness = 0;
    pill.paddingRight = "5px";

    const lbl = new TextBlock();
    lbl.text = text;
    lbl.color = "#7DD3FC";
    lbl.fontSize = 8;
    lbl.fontFamily = "monospace";
    lbl.fontStyle = "bold";
    pill.addControl(lbl);
    return pill;
  }

  private makeDivider(): Rectangle {
    const d = new Rectangle();
    d.width = "1px";
    d.height = "20px";
    d.background = "#1E293B";
    d.thickness = 0;
    d.paddingLeft = "7px";
    d.paddingRight = "7px";
    return d;
  }

  private wrapWithLabel(control: Control, labelText: string): StackPanel {
    const wrap = new StackPanel();
    wrap.isVertical = false;
    wrap.width = labelText.length * 7 + 34 + "px";
    wrap.height = "26px";

    const lbl = new TextBlock();
    lbl.text = labelText;
    lbl.width = labelText.length * 7 + 6 + "px";
    lbl.height = "26px";
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
    box.width = "48px";
    box.height = "100px";
    box.thickness = 1;
    box.color = "#22C55E";
    box.cornerRadius = 7;
    box.paddingLeft = "4px";
    box.paddingTop = "4px";
    box.paddingBottom = "4px";

    const btn = Button.CreateSimpleButton("add", "+");
    btn.fontSize = 24;
    btn.color = "white";
    btn.background = "#16A34A";
    btn.cornerRadius = 5;
    btn.onPointerUpObservable.add(() => this.addVector());
    box.addControl(btn);
    return box;
  }

  private createVectorBlock(arrow: Arrow): Rectangle {
    const isSelected = this.engine.getSelectedKey() === arrow.key;
    const accentHex = arrow.display?.color?.toHexString() ?? "#2563EB";
    const boxHeight = isSelected ? "122px" : "100px";

    const box = new Rectangle();
    box.width = "220px";
    box.height = boxHeight;
    box.thickness = isSelected ? 2 : 1;
    box.color = isSelected ? accentHex : "#334155";
    box.cornerRadius = 7;
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
    topRow.height = "22px";
    stack.addControl(topRow);

    const label = new TextBlock();
    label.text = arrow.label;
    label.width = "88px";
    label.color = accentHex;
    label.fontSize = 11;
    label.fontStyle = "bold";
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    topRow.addControl(label);

    (["x", "y", "z"] as const).forEach((axis) => {
      const lockKey = `${arrow.key}-lock-${axis}`;
      const isLocked = arrow.lockedAxes?.includes(axis) ?? false;
      const axisColor = { x: "#EF4444", y: "#22C55E", z: "#3B82F6" }[axis];
      const lockBtn = Button.CreateSimpleButton(lockKey, axis.toUpperCase());
      lockBtn.width = "17px";
      lockBtn.height = "17px";
      lockBtn.fontSize = 8;
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
    removeBtn.width = "18px";
    removeBtn.height = "18px";
    removeBtn.fontSize = 10;
    removeBtn.color = "white";
    removeBtn.background = "#DC2626";
    removeBtn.cornerRadius = 3;
    removeBtn.paddingLeft = "3px";
    removeBtn.onPointerUpObservable.add(() => {
      this.engine.removeVector(arrow.key);
      this.refreshVectorList();
    });
    topRow.addControl(removeBtn);

    // ── Vector and origin inputs ─────────────────────────────────────────
    stack.addControl(this.createVecInputRow("V", arrow, arrow.value, "value"));
    stack.addControl(this.createVecInputRow("O", arrow, arrow.origin, "origin"));

    // ── Bottom row: magnitude + overlay toggles ──────────────────────────
    const bottomRow = new StackPanel();
    bottomRow.isVertical = false;
    bottomRow.height = "20px";
    stack.addControl(bottomRow);

    const magLabel = new TextBlock();
    magLabel.text = `|v|=${arrow.value.length().toFixed(2)}`;
    magLabel.color = "#64748B";
    magLabel.fontSize = 9;
    magLabel.fontFamily = "monospace";
    magLabel.width = "78px";
    magLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    bottomRow.addControl(magLabel);

    const showComp = arrow.showComponents !== false;
    const compBtn = Button.CreateSimpleButton("comp-" + arrow.key, "XYZ");
    compBtn.width = "28px";
    compBtn.height = "15px";
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

    const showAngle = arrow.showAngle !== false;
    const angleBtn = Button.CreateSimpleButton("angle-" + arrow.key, "∠");
    angleBtn.width = "20px";
    angleBtn.height = "15px";
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

    // ── Keymap hint (selected only) ──────────────────────────────────────
    if (isSelected) {
      const hint = new Rectangle();
      hint.height = "20px";
      hint.thickness = 1;
      hint.color = "#1E3A5F";
      hint.cornerRadius = 3;
      hint.background = "#0F172A";
      hint.paddingTop = "2px";
      stack.addControl(hint);

      const hintRow = new StackPanel();
      hintRow.isVertical = false;
      hint.addControl(hintRow);

      const makeHint = (key: string, desc: string, color = "#7DD3FC") => {
        const keyBadge = new Rectangle();
        keyBadge.width = "16px";
        keyBadge.height = "12px";
        keyBadge.cornerRadius = 3;
        keyBadge.background = "#1E3A5F";
        keyBadge.thickness = 0;
        keyBadge.paddingLeft = "4px";

        const keyTxt = new TextBlock();
        keyTxt.text = key;
        keyTxt.color = color;
        keyTxt.fontSize = 8;
        keyTxt.fontStyle = "bold";
        keyBadge.addControl(keyTxt);

        const descTxt = new TextBlock();
        descTxt.text = desc;
        descTxt.color = "#475569";
        descTxt.fontSize = 8;
        descTxt.width = desc.length * 4.5 + 4 + "px";
        descTxt.paddingLeft = "2px";
        descTxt.paddingRight = "5px";

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
    row.height = "24px";

    const lbl = new TextBlock();
    lbl.text = labelStr + ":";
    lbl.width = "16px";
    lbl.color = "#FACC15";
    lbl.fontSize = 9;
    row.addControl(lbl);

    const axisColors = { x: "#FCA5A5", y: "#86EFAC", z: "#93C5FD" };

    (["x", "y", "z"] as const).forEach((axis) => {
      const isLocked =
        field === "value" && (arrow.lockedAxes?.includes(axis) ?? false);

      const input = new InputText();
      input.width = "56px";
      input.height = "19px";
      input.text = Number(vec[axis]).toFixed(2);
      input.color = isLocked ? "#64748B" : axisColors[axis];
      input.background = isLocked ? "#1E293B" : "#334155";
      input.focusedBackground = "#334155";
      input.fontSize = 10;
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

  private addOperationsPanel() {
    const opBox = new Rectangle();
    opBox.width = "340px";
    opBox.height = "115px";
    opBox.thickness = 1;
    opBox.color = "#1E3A5F";
    opBox.cornerRadius = 7;
    opBox.background = "#09101EF0";
    opBox.paddingLeft = "9px";
    opBox.paddingRight = "9px";
    opBox.paddingTop = "5px";
    opBox.paddingBottom = "5px";

    const outer = new StackPanel();
    outer.isVertical = true;
    outer.height = "100%";
    opBox.addControl(outer);

    const header = new TextBlock();
    header.text = "OPERATIONS";
    header.height = "13px";
    header.color = "#7DD3FC";
    header.fontSize = 8;
    header.fontFamily = "monospace";
    header.fontStyle = "bold";
    header.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    outer.addControl(header);

    const mainRow = new StackPanel();
    mainRow.isVertical = false;
    mainRow.height = "90px";
    outer.addControl(mainRow);

    // Left side: inputs + ops + dot
    const leftCol = new StackPanel();
    leftCol.isVertical = true;
    leftCol.width = "192px";
    mainRow.addControl(leftCol);

    const inputRow = new StackPanel();
    inputRow.isVertical = false;
    inputRow.height = "24px";
    inputRow.paddingBottom = "3px";
    leftCol.addControl(inputRow);

    const makeVecInput = (placeholder: string) => {
      const i = new InputText();
      i.width = "88px";
      i.height = "21px";
      i.placeholderText = placeholder;
      i.text = "";
      i.fontSize = 10;
      i.color = "#E2E8F0";
      i.placeholderColor = "#475569";
      i.background = "#1E293B";
      i.focusedBackground = "#1E293B";
      i.thickness = 1;
      i.paddingRight = "3px";
      return i;
    };

    const leftSelect = makeVecInput("Vector A");
    const rightSelect = makeVecInput("Vector B");
    inputRow.addControl(leftSelect);
    inputRow.addControl(rightSelect);

    const opsRow = new StackPanel();
    opsRow.isVertical = false;
    opsRow.height = "26px";
    opsRow.spacing = 3;
    leftCol.addControl(opsRow);

    type OpDef = {
      label: string;
      op: "add" | "subtract" | "cross" | "projection";
      color: string;
    };
    const opDefs: OpDef[] = [
      { label: "A+B", op: "add", color: "#22C55E" },
      { label: "A−B", op: "subtract", color: "#F87171" },
      { label: "A×B", op: "cross", color: "#A78BFA" },
      { label: "proj", op: "projection", color: "#38BDF8" },
    ];

    opDefs.forEach(({ label, op, color }) => {
      const b = Button.CreateSimpleButton("op-" + op, label);
      b.width = label.length * 6 + 14 + "px";
      b.height = "22px";
      b.fontSize = 9;
      b.color = color;
      b.background = "#1E293B";
      b.cornerRadius = 4;
      b.thickness = 1;
      b.onPointerUpObservable.add(() => perform(op));
      opsRow.addControl(b);
    });

    const dotDisplay = new Rectangle();
    dotDisplay.height = "22px";
    dotDisplay.width = "90px";
    dotDisplay.cornerRadius = 4;
    dotDisplay.background = "#1E293B";
    dotDisplay.thickness = 1;
    dotDisplay.color = "#FACC15";
    dotDisplay.paddingLeft = "3px";
    leftCol.addControl(dotDisplay);

    const dotInner = new StackPanel();
    dotInner.isVertical = false;
    dotInner.height = "100%";
    dotDisplay.addControl(dotInner);

    const dotLabelTxt = new TextBlock();
    dotLabelTxt.text = "A·B = ";
    dotLabelTxt.width = "32px";
    dotLabelTxt.color = "#FACC15";
    dotLabelTxt.fontSize = 9;
    dotLabelTxt.fontStyle = "bold";
    dotLabelTxt.fontFamily = "monospace";
    dotInner.addControl(dotLabelTxt);

    const dotVal = new TextBlock();
    dotVal.text = "—";
    dotVal.width = "52px";
    dotVal.color = "#E2E8F0";
    dotVal.fontSize = 9;
    dotVal.fontFamily = "monospace";
    dotVal.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    dotInner.addControl(dotVal);

    // Divider
    const vDiv = new Rectangle();
    vDiv.width = "1px";
    vDiv.height = "70px";
    vDiv.background = "#1E3A5F";
    vDiv.thickness = 0;
    vDiv.paddingLeft = "6px";
    vDiv.paddingRight = "6px";
    mainRow.addControl(vDiv);

    // Result column
    const resultCol = new StackPanel();
    resultCol.isVertical = true;
    resultCol.width = "118px";
    mainRow.addControl(resultCol);

    const resTitle = new TextBlock();
    resTitle.text = "Result";
    resTitle.height = "13px";
    resTitle.color = "#FACC15";
    resTitle.fontSize = 9;
    resTitle.fontStyle = "bold";
    resTitle.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    resultCol.addControl(resTitle);

    const resCoords = new TextBlock();
    resCoords.text = "—";
    resCoords.height = "38px";
    resCoords.color = "#E2E8F0";
    resCoords.fontSize = 9;
    resCoords.fontFamily = "monospace";
    resCoords.textWrapping = true;
    resCoords.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    resultCol.addControl(resCoords);

    const resMag = new TextBlock();
    resMag.text = "";
    resMag.height = "12px";
    resMag.color = "#64748B";
    resMag.fontSize = 8;
    resMag.fontFamily = "monospace";
    resMag.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    resultCol.addControl(resMag);

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

    const addToSceneBtn = Button.CreateSimpleButton("addResult", "+ Add to scene");
    addToSceneBtn.width = "108px";
    addToSceneBtn.height = "18px";
    addToSceneBtn.fontSize = 9;
    addToSceneBtn.color = "#22C55E";
    addToSceneBtn.background = "#052E16";
    addToSceneBtn.cornerRadius = 3;
    addToSceneBtn.thickness = 1;
    addToSceneBtn.isEnabled = false;
    addToSceneBtn.alpha = 0.4;
    resultCol.addControl(addToSceneBtn);

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
      const depA = leftSelect.text.trim();
      const depB = rightSelect.text.trim();
      this.engine.addVector({
        key,
        label: key,
        type: "derived",
        origin: BABYLON.Vector3.Zero(),
        value: pendingResult.clone(),
        display: { color: this.randomLightColor3() },
        vector: null,
        dependencies: [depA, depB].filter(Boolean),
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
        case "add": out = a.value.add(b.value); break;
        case "subtract": out = a.value.subtract(b.value); break;
        case "cross": out = BABYLON.Vector3.Cross(a.value, b.value); break;
        case "projection": {
          const d = b.value.lengthSquared();
          out = d === 0
            ? BABYLON.Vector3.Zero()
            : b.value.scale(BABYLON.Vector3.Dot(a.value, b.value) / d);
          break;
        }
      }

      const labelMap = {
        add: "Sum", subtract: "Diff", cross: "Cross", projection: "Proj",
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

    let value: BABYLON.Vector3;
    if (this.compactMode) {
      const compMax = 4.5 / Math.sqrt(3);
      const compMaxInt = Math.floor(compMax * 10);
      const rand = () => (this.randRange(-compMaxInt, compMaxInt) / 10);
      value = new BABYLON.Vector3(rand(), rand(), rand());
    } else {
      value = new BABYLON.Vector3(
        this.randRange(-mag, mag) / 2,
        this.randRange(-mag, mag) / 2,
        this.randRange(-mag, mag) / 2,
      );
    }

    this.engine.addVector({
      key: "Vector-" + count,
      label: "Vector-" + count,
      type: "base",
      origin: BABYLON.Vector3.Zero(),
      value,
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
    const hNorm = h / 360, sNorm = s / 100, lNorm = l / 100;
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
