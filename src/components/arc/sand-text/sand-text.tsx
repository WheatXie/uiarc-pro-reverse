"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./sand-text.module.css";

export interface SandTextProps {
  /** The text to form. Keep it to one short line. Changing it collapses the old word and pours the new one. */
  text: string;
  /** Grain size in CSS px. Defaults to `2`. */
  grain?: number;
  /** Radius the pointer digs through, in CSS px. Defaults to `14`. */
  radius?: number;
  /** Grain colors. Each grain picks one and varies it slightly. Defaults to the text color. */
  palette?: string[];
  /** Element for the visually hidden text. Defaults to `"h2"`. */
  as?: "h1" | "h2" | "h3" | "p";
  /** Extra class on the root. Set font-size here to size the letters. */
  className?: string;
  /** Inline styles on the root. */
  style?: CSSProperties;
}

type Tone = [number, number, number];

interface Grain {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tone: number;
  target: number;
}

interface SandEngine {
  setText: (text: string) => void;
}

/**
 * A headline made of sand. Grains pour in and pack into the letters, the pointer digs through them
 * and throws grains that tumble and pile, and at rest the letters heal while the extra sand drifts
 * away. Changing the text collapses the old word into sand.
 */
export function SandText({
  text,
  grain = 2,
  radius = 14,
  palette,
  as = "h2",
  className,
  style,
}: SandTextProps) {
  const reduced = Boolean(useReducedMotion());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SandEngine | null>(null);
  // Radius is read live by the dig test; a new value never rebuilds the grid.
  const radiusRef = useRef({ radius });

  useEffect(() => {
    radiusRef.current = { radius };
  });

  const paletteKey = palette?.join("|") ?? "";

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!ctx || !probe) return;

    // Every palette colour becomes five tones (the colour, a darker and a lighter pair) so the
    // sand keeps a grain texture instead of a flat fill.
    let tones: Tone[] = [];
    const readTones = () => {
      tones = [];
      for (const entry of paletteKey ? paletteKey.split("|") : [getComputedStyle(root).color]) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = "#777";
        probe.fillStyle = entry;
        probe.fillRect(0, 0, 1, 1);
        const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
        const clamp = (value: number) => Math.max(0, Math.min(255, value));
        for (const shift of [-36, -18, 0, 18, 36]) {
          tones.push([clamp(r + shift), clamp(g + shift), clamp(b + shift)]);
        }
      }
    };
    readTones();

    let columns = 0;
    let rows = 0;
    let dpr = 1;
    let grainSize = grain;
    // Cell state: 0 empty, 1 packed sand, 2 falling sand.
    let state = new Uint8Array(0);
    // Letter mask from the rendered text.
    let mask = new Uint8Array(0);
    let toneIndex = new Uint8Array(0);
    // Frames a falling grain has spent without moving; gates sticking and cleanup.
    let settleTicks = new Uint8Array(0);
    // Cells a poured grain is aiming at, so healing does not double up.
    let claimed = new Uint8Array(0);
    let letterCells: number[] = [];
    let grains: Grain[] = [];
    let imageData: ImageData | null = null;
    const offscreen = document.createElement("canvas");
    let rafId = 0;
    let disposed = false;
    let lastDig = -Infinity;
    let scanParity = 0;
    let currentText = "";
    const pointer = { x: 0, y: 0, px: 0, py: 0, inside: false };

    const pickTone = () => (Math.random() * tones.length) | 0;

    /** Rasterize the text into the letter mask at the current grid resolution. */
    const buildMask = (value: string) => {
      mask.fill(0);
      letterCells = [];
      if (!columns || !value) return;
      const measure = document.createElement("canvas");
      measure.width = columns;
      measure.height = rows;
      const mctx = measure.getContext("2d", { willReadFrequently: true });
      if (!mctx) return;
      const computed = getComputedStyle(root);
      let cellFont = parseFloat(computed.fontSize) / grainSize;
      const family = computed.fontFamily;
      mctx.font = `500 ${cellFont}px ${family}`;
      const natural = mctx.measureText(value).width;
      if (natural > 0.94 * columns) cellFont *= (0.94 * columns) / natural;
      mctx.font = `500 ${cellFont}px ${family}`;
      if ("letterSpacing" in mctx) mctx.letterSpacing = `${-(0.03 * cellFont)}px`;
      mctx.textAlign = "center";
      mctx.textBaseline = "alphabetic";
      mctx.fillStyle = "#000";
      const metrics = mctx.measureText(value);
      const ascent = metrics.actualBoundingBoxAscent;
      const descent = metrics.actualBoundingBoxDescent;
      const baseline = Math.round((rows - 3 - (ascent + descent)) * 0.42 + ascent);
      mctx.fillText(value, columns / 2, baseline);
      const data = mctx.getImageData(0, 0, columns, rows).data;
      for (let cell = 0; cell < columns * rows; cell += 1) {
        if (data[4 * cell + 3] > 120) {
          mask[cell] = 1;
          letterCells.push(cell);
        }
      }
      for (const falling of grains) {
        if (falling.target >= 0 && !mask[falling.target]) {
          claimed[falling.target] = 0;
          falling.target = -1;
        }
      }
    };

    const setText = (value: string) => {
      currentText = value;
      if (!columns) return;
      buildMask(value);
      claimed.fill(0);
      // Packed sand outside the new word turns loose and collapses.
      for (let cell = 0; cell < state.length; cell += 1) {
        if (state[cell] === 1 && !mask[cell]) {
          state[cell] = 2;
          settleTicks[cell] = 0;
        }
      }
      if (reduced) {
        // Reduced motion swaps words instantly: the letters are simply formed.
        state.fill(0);
        for (const cell of letterCells) {
          state[cell] = 1;
          toneIndex[cell] = pickTone();
        }
        grains = [];
      } else {
        lastDig = -Infinity;
      }
      schedule();
    };

    const resize = () => {
      const box = root.getBoundingClientRect();
      if (!box.width || !box.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      grainSize = Math.max(2, grain);
      const nextColumns = Math.max(20, Math.floor(box.width / grainSize));
      const nextRows = Math.max(12, Math.floor(box.height / grainSize));
      if (nextColumns === columns && nextRows === rows) return;
      const first = !columns;
      columns = nextColumns;
      rows = nextRows;
      const cells = columns * rows;
      state = new Uint8Array(cells);
      mask = new Uint8Array(cells);
      toneIndex = new Uint8Array(cells);
      settleTicks = new Uint8Array(cells);
      claimed = new Uint8Array(cells);
      grains = [];
      offscreen.width = columns;
      offscreen.height = rows;
      imageData = new ImageData(columns, rows);
      canvas.width = Math.round(columns * grainSize * dpr);
      canvas.height = Math.round(rows * grainSize * dpr);
      canvas.style.width = `${columns * grainSize}px`;
      canvas.style.height = `${rows * grainSize}px`;
      buildMask(currentText);
      if (!first || reduced) {
        for (const cell of letterCells) {
          state[cell] = 1;
          toneIndex[cell] = pickTone();
        }
      }
      schedule();
    };

    /** Drop a grain into the first free cell at or above (column, row). */
    const dropAt = (falling: Grain, column: number, row: number) => {
      let landing = row;
      while (landing >= 0 && state[landing * columns + column] !== 0) landing -= 1;
      if (landing < 0) return;
      const cell = landing * columns + column;
      state[cell] = falling.target === cell || (mask[cell] && !nearPointer(column, landing)) ? 1 : 2;
      toneIndex[cell] = falling.tone;
      settleTicks[cell] = 0;
      if (falling.target >= 0) claimed[falling.target] = 0;
    };

    const nearPointer = (column: number, row: number) => {
      if (!pointer.inside) return false;
      const reach = (radiusRef.current.radius / grainSize) * 1.25;
      const dx = column + 0.5 - pointer.x;
      const dy = row + 0.5 - pointer.y;
      return dx * dx + dy * dy < reach * reach;
    };

    /** One falling-sand generation. Returns true while anything is still moving. */
    const settle = (healing: boolean) => {
      let moved = false;
      let alive = false;
      const strays: number[] = [];
      scanParity ^= 1;
      for (let row = rows - 1; row >= 0; row -= 1) {
        for (let step = 0; step < columns; step += 1) {
          const column = scanParity ? step : columns - 1 - step;
          const cell = row * columns + column;
          if (state[cell] !== 2) continue;
          if (row < rows - 1) {
            const below = cell + columns;
            if (state[below] === 0) {
              state[below] = 2;
              toneIndex[below] = toneIndex[cell];
              settleTicks[below] = 0;
              state[cell] = 0;
              moved = true;
              continue;
            }
            const bias = Math.random() < 0.5 ? -1 : 1;
            let slipped = false;
            for (const side of [bias, -bias]) {
              const nextColumn = column + side;
              if (nextColumn < 0 || nextColumn >= columns) continue;
              const diagonal = below + side;
              if (state[diagonal] === 0 && state[cell + side] === 0) {
                state[diagonal] = 2;
                toneIndex[diagonal] = toneIndex[cell];
                settleTicks[diagonal] = 0;
                state[cell] = 0;
                slipped = true;
                break;
              }
            }
            if (slipped) {
              moved = true;
              continue;
            }
          }
          if (settleTicks[cell] < 255) settleTicks[cell] += 1;
          if (mask[cell] && settleTicks[cell] > 4 && !nearPointer(column, row)) {
            // A grain that comes to rest inside a letter sticks again.
            state[cell] = 1;
          } else if (!mask[cell] && settleTicks[cell] > 20) {
            strays.push(cell);
          } else {
            alive = true;
          }
        }
      }
      let changed = strays.length > 0;
      if (healing && strays.length) {
        // Loose sand outside the letters drifts away instead of piling up forever.
        const budget = Math.max(3, Math.round(0.03 * strays.length));
        for (let removed = 0; removed < budget && strays.length; removed += 1) {
          const index = (Math.random() * strays.length) | 0;
          state[strays[index]] = 0;
          strays[index] = strays[strays.length - 1];
          strays.pop();
        }
        changed = true;
      }
      return moved || changed || alive;
    };

    const tick = (now: number) => {
      rafId = 0;
      if (!columns) return;
      let changed = false;

      if (!reduced) {
        if (pointer.inside) {
          const reach = radiusRef.current.radius / grainSize;
          const dx = pointer.x - pointer.px;
          const dy = pointer.y - pointer.py;
          const speed = Math.hypot(dx, dy);
          pointer.px = pointer.x;
          pointer.py = pointer.y;
          if (speed >= 0.15) {
            const left = Math.max(0, Math.floor(pointer.x - reach));
            const right = Math.min(columns - 1, Math.ceil(pointer.x + reach));
            const top = Math.max(0, Math.floor(pointer.y - reach));
            const bottom = Math.min(rows - 1, Math.ceil(pointer.y + reach));
            let dug = false;
            for (let row = top; row <= bottom; row += 1) {
              for (let column = left; column <= right; column += 1) {
                const cell = row * columns + column;
                if (state[cell] === 0) continue;
                const lx = column + 0.5 - pointer.x;
                const ly = row + 0.5 - pointer.y;
                const distance = Math.hypot(lx, ly);
                if (distance > reach) continue;
                state[cell] = 0;
                const kick = (1 - distance / reach) * 0.9 + 0.25;
                grains.push({
                  x: column + 0.5,
                  y: row + 0.5,
                  tone: toneIndex[cell],
                  target: -1,
                  vx:
                    (lx / (distance || 1)) * kick +
                    dx * (0.25 + 0.25 * Math.random()) +
                    (Math.random() - 0.5) * 0.5,
                  vy:
                    (ly / (distance || 1)) * kick +
                    dy * (0.2 + 0.2 * Math.random()) -
                    1.1 * Math.random(),
                });
                dug = true;
              }
            }
            if (dug) lastDig = now;
          }
        }

        const healing = now - lastDig > 650;
        if (healing) {
          // Missing grains pour back in from above once the pointer rests.
          const budget = Math.max(24, Math.round(letterCells.length / 55));
          const holes: number[] = [];
          for (const cell of letterCells) {
            if (state[cell] === 0 && !claimed[cell]) holes.push(cell);
          }
          if (holes.length) {
            holes.sort(
              (a, b) => ((b / columns) | 0) - ((a / columns) | 0) + (Math.random() - 0.5) * 6,
            );
            let left = budget;
            for (const cell of holes) {
              if (left <= 0) break;
              left -= 1;
              claimed[cell] = 1;
              grains.push({
                x: (cell % columns) + 0.5,
                y: -1 - 10 * Math.random(),
                vx: 0,
                vy: 1.4 + 0.8 * Math.random(),
                tone: pickTone(),
                target: cell,
              });
            }
            changed = true;
          }
        }

        const survivors: Grain[] = [];
        for (const falling of grains) {
          falling.vy = Math.min(falling.target >= 0 ? 5 : 4, falling.vy + 0.22);
          falling.vx *= 0.96;
          const steps = Math.max(
            1,
            Math.ceil(Math.max(Math.abs(falling.vx), Math.abs(falling.vy))),
          );
          let alive = true;
          for (let step = 0; step < steps; step += 1) {
            const nextX = falling.x + falling.vx / steps;
            const nextY = falling.y + falling.vy / steps;
            const column = Math.floor(nextX);
            const row = Math.floor(nextY);
            if (column < 0 || column >= columns) {
              alive = false;
              if (falling.target >= 0) claimed[falling.target] = 0;
              break;
            }
            if (falling.target >= 0) {
              const targetColumn = falling.target % columns;
              const targetRow = (falling.target / columns) | 0;
              if (row >= targetRow) {
                if (state[falling.target] === 0) {
                  state[falling.target] = 1;
                  toneIndex[falling.target] = falling.tone;
                } else {
                  dropAt(falling, targetColumn, targetRow);
                }
                claimed[falling.target] = 0;
                alive = false;
                break;
              }
              falling.x = nextX;
              falling.y = nextY;
              continue;
            }
            if (row >= rows) {
              dropAt(falling, Math.floor(falling.x), rows - 1);
              alive = false;
              break;
            }
            if (row >= 0 && state[row * columns + column] !== 0) {
              dropAt(falling, Math.floor(falling.x), Math.max(0, Math.floor(falling.y)));
              alive = false;
              break;
            }
            falling.x = nextX;
            falling.y = nextY;
          }
          if (alive) survivors.push(falling);
        }
        grains = survivors;

        for (let pass = 0; pass < 2; pass += 1) {
          if (settle(now - lastDig > 650)) changed = true;
        }
        if (grains.length) changed = true;
      }

      const data = imageData;
      if (data) {
        const pixels = data.data;
        pixels.fill(0);
        const put = (cell: number, tone: number) => {
          const color = tones[tone % tones.length];
          const offset = 4 * cell;
          pixels[offset] = color[0];
          pixels[offset + 1] = color[1];
          pixels[offset + 2] = color[2];
          pixels[offset + 3] = 255;
        };
        for (let cell = 0; cell < state.length; cell += 1) {
          if (state[cell] !== 0) put(cell, toneIndex[cell]);
        }
        for (const falling of grains) {
          const column = Math.floor(falling.x);
          const row = Math.floor(falling.y);
          if (column >= 0 && column < columns && row >= 0 && row < rows) {
            put(row * columns + column, falling.tone);
          }
        }
        offscreen.getContext("2d")?.putImageData(data, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
      }

      if (changed || pointer.inside) schedule();
    };

    const schedule = () => {
      if (!rafId && !disposed) rafId = requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      const x = (event.clientX - box.left) / grainSize;
      const y = (event.clientY - box.top) / grainSize;
      if (!pointer.inside) {
        pointer.px = x;
        pointer.py = y;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.inside = true;
      schedule();
    };

    const onPointerLeave = () => {
      pointer.inside = false;
      schedule();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") onPointerLeave();
    };

    engineRef.current = { setText };

    let fontsRebuilt = false;
    resize();
    setText(currentText);
    document.fonts?.ready.then(() => {
      if (disposed || fontsRebuilt) return;
      fontsRebuilt = true;
      // Web fonts land after the first raster: re-measure and drop the stale mask.
      buildMask(currentText);
      if (reduced) {
        // No falling sand to re-target: repaint the letters from the fresh mask instead, or the
        // cells the fallback font had and the web font does not would stay lit.
        state.fill(0);
        for (const cell of letterCells) {
          state[cell] = 1;
          toneIndex[cell] = pickTone();
        }
        grains = [];
      } else {
        for (let cell = 0; cell < state.length; cell += 1) {
          if (state[cell] === 1 && !mask[cell]) {
            state[cell] = 2;
            settleTicks[cell] = 0;
          }
        }
      }
      schedule();
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);

    const mutationObserver = new MutationObserver(() => {
      readTones();
      schedule();
    });
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent", "class", "style"],
    });

    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerLeave);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      engineRef.current = null;
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerLeave);
    };
  }, [grain, paletteKey, reduced]);

  useEffect(() => {
    engineRef.current?.setText(text);
  }, [text, grain, paletteKey, reduced]);

  const Tag = as;

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
    >
      <Tag className={styles.srOnly}>{text}</Tag>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    </div>
  );
}

export default SandText;
