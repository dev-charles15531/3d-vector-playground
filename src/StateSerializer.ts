// StateSerializer.ts
// Encodes/decodes the full vector state into a URL hash fragment.
// Format:  #v=label,x,y,z,originX,originY,originZ,hexColor|label,...
// Usage:
//   StateSerializer.encode(vectors)  → sets window.location.hash
//   StateSerializer.decode()         → returns Arrow-init params or null

import * as BABYLON from "@babylonjs/core";

export type SerializedVector = {
  label: string;
  key: string;
  x: number; y: number; z: number;
  ox: number; oy: number; oz: number;
  color: string;
  type: "base" | "derived";
};

export class StateSerializer {

  /** Encode current vector state into the URL hash and copy to clipboard */
  public static encode(vectors: Array<{
    key: string;
    label: string;
    value: BABYLON.Vector3;
    origin: BABYLON.Vector3;
    display?: { color?: BABYLON.Color3 };
    type: "base" | "derived";
  }>): string {
    const parts = vectors.map((v) => {
      const color = v.display?.color?.toHexString().replace("#", "") ?? "ffffff";
      return [
        encodeURIComponent(v.label),
        v.value.x.toFixed(3),
        v.value.y.toFixed(3),
        v.value.z.toFixed(3),
        v.origin.x.toFixed(3),
        v.origin.y.toFixed(3),
        v.origin.z.toFixed(3),
        color,
        v.type,
      ].join(",");
    });

    const hash = "v=" + parts.join("|");
    window.location.hash = hash;

    // Also copy full URL to clipboard
    const fullUrl = window.location.href;
    navigator.clipboard?.writeText(fullUrl).catch(() => { });
    return fullUrl;
  }

  /** Decode vector state from URL hash. Returns null if hash is absent/invalid. */
  public static decode(): SerializedVector[] | null {
    const hash = window.location.hash.replace("#", "");
    if (!hash.startsWith("v=")) return null;

    const raw = hash.slice(2);
    if (!raw) return null;

    try {
      return raw.split("|").map((part) => {
        const [label, x, y, z, ox, oy, oz, color, type] = part.split(",");
        return {
          label: decodeURIComponent(label),
          key: decodeURIComponent(label),
          x: parseFloat(x),
          y: parseFloat(y),
          z: parseFloat(z),
          ox: parseFloat(ox),
          oy: parseFloat(oy),
          oz: parseFloat(oz),
          color: "#" + (color ?? "ffffff"),
          type: (type === "derived" ? "derived" : "base") as "base" | "derived",
        };
      });
    } catch {
      return null;
    }
  }
}
