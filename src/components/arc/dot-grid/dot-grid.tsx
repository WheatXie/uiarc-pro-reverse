"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./dot-grid.module.css";

export interface DotGridProps {
  /** Distance between dots in px. Lower is denser. Defaults to `22`. */
  gap?: number;
  /** Dot radius in px at rest. Defaults to `1.4`. */
  dotSize?: number;
  /** Lens radius around the pointer in px. Defaults to `150`. */
  radius?: number;
  /** How far dots are pushed at the strongest point of the lens, in px. Defaults to `16`. */
  strength?: number;
  /** Clicks and taps send a ripple through the field. Defaults to `true`. */
  ripple?: boolean;
  /** Fades the field toward its edges. Defaults to `true`. */
  fade?: boolean;
  /** Dot color at rest. Defaults to the strong border token. */
  color?: string;
  /** Color dots take under the lens and in ripples. Defaults to the accent token. */
  activeColor?: string;
  /** Content drawn over the field, such as a hero headline. */
  children?: ReactNode;
  /** Class on the root. Give it a height or let children size it. */
  className?: string;
  /** Inline style on the root. */
  style?: CSSProperties;
}

interface Ripple {
  x: number;
  y: number;
  start: number;
}

interface FieldOptions {
  gap: number;
  dotSize: number;
  radius: number;
  strength: number;
  ripple: boolean;
  reduced: boolean;
}

/**
 * A canvas field of dots that bulge away from the pointer like a lens, wobble back on a spring,
 * and ripple outward from every click. Content placed inside sits on top and stays interactive.
 */
export function DotGrid({
  gap = 22,
  dotSize = 1.4,
  radius = 150,
  strength = 16,
  ripple = true,
  fade = true,
  color,
  activeColor,
  children,
  className,
  style,
}: DotGridProps) {
  const reduced = Boolean(useReducedMotion());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // The loop reads live options through a ref so a prop change never tears the field down.
  const options = useRef<FieldOptions>({ gap, dotSize, radius, strength, ripple, reduced });

  useEffect(() => {
    options.current = { gap, dotSize, radius, strength, ripple, reduced };
  });

  // Set after the first mount: the intro fade only plays when the field is rebuilt (theme or
  // colour change), never on the very first paint.
  const painted = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let count = 0;
    let baseX = new Float32Array(0);
    let baseY = new Float32Array(0);
    let offsetX = new Float32Array(0);
    let offsetY = new Float32Array(0);
    let velocityX = new Float32Array(0);
    let velocityY = new Float32Array(0);
    let glow = new Float32Array(0);
    let restColor = "";
    let activeColorValue = "";
    let ripples: Ripple[] = [];
    const pointer = { x: 0, y: 0, inside: false };
    const lens = { x: 0, y: 0, power: 0 };
    let rafId = 0;
    let lastTime = 0;
    let visible = true;

    const readColors = () => {
      const computed = getComputedStyle(root);
      restColor = computed.getPropertyValue("--dot-grid-color").trim() || computed.color;
      activeColorValue = computed.getPropertyValue("--dot-grid-active").trim() || computed.color;
    };

    const resize = () => {
      const box = root.getBoundingClientRect();
      width = box.width;
      height = box.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const step = Math.max(6, options.current.gap);
      const columns = Math.floor(width / step) + 1;
      const rows = Math.floor(height / step) + 1;
      const startX = (width - (columns - 1) * step) / 2;
      const startY = (height - (rows - 1) * step) / 2;

      count = columns * rows;
      baseX = new Float32Array(count);
      baseY = new Float32Array(count);
      offsetX = new Float32Array(count);
      offsetY = new Float32Array(count);
      velocityX = new Float32Array(count);
      velocityY = new Float32Array(count);
      glow = new Float32Array(count);

      let index = 0;
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          baseX[index] = startX + column * step;
          baseY[index] = startY + row * step;
          index += 1;
        }
      }
      draw();
    };

    const draw = () => {
      const { dotSize: size } = options.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      // Resting dots share one path so a full field is a single fill.
      ctx.fillStyle = restColor;
      ctx.beginPath();
      for (let index = 0; index < count; index += 1) {
        if (glow[index] > 0.04) continue;
        const x = baseX[index] + offsetX[index];
        const y = baseY[index] + offsetY[index];
        ctx.moveTo(x + size, y);
        ctx.arc(x, y, size, 0, 2 * Math.PI);
      }
      ctx.fill();

      ctx.fillStyle = activeColorValue;
      for (let index = 0; index < count; index += 1) {
        const level = glow[index];
        if (level <= 0.04) continue;
        const x = baseX[index] + offsetX[index];
        const y = baseY[index] + offsetY[index];
        const boosted = size * (1 + 1.1 * level);
        ctx.globalAlpha = 0.35 + 0.65 * level;
        ctx.beginPath();
        ctx.arc(x, y, boosted, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Fading in, the dot keeps a core of its rest colour so it grows out of the field.
        if (level < 0.5) {
          ctx.fillStyle = restColor;
          ctx.globalAlpha = 1 - 2 * level;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, 2 * Math.PI);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = activeColorValue;
        }
      }
    };

    const frame = (now: number) => {
      rafId = 0;
      const delta = Math.min(2.5, lastTime ? (now - lastTime) / (1000 / 60) : 1);
      lastTime = now;

      const { radius: lensRadius, strength: lensStrength, reduced: still } = options.current;
      const follow = 1 - Math.pow(0.72, delta);
      lens.x += (pointer.x - lens.x) * follow;
      lens.y += (pointer.y - lens.y) * follow;

      const target = +pointer.inside;
      lens.power += (target - lens.power) * (1 - Math.pow(0.88, delta));
      if (Math.abs(target - lens.power) < 0.002) lens.power = target;

      for (let index = ripples.length - 1; index >= 0; index -= 1) {
        if (now - ripples[index].start > 1500) ripples.splice(index, 1);
      }

      let moving = lens.power > 0 && lens.power < 1;
      const springForce = 0.16 * delta;
      const damping = Math.pow(0.74, delta);

      for (let index = 0; index < count; index += 1) {
        const originX = baseX[index];
        const originY = baseY[index];
        let pushX = 0;
        let pushY = 0;
        let heat = 0;

        if (lens.power > 0) {
          const dx = originX - lens.x;
          const dy = originY - lens.y;
          const distance = Math.hypot(dx, dy);
          if (distance < lensRadius && distance > 0.001) {
            const ratio = distance / lensRadius;
            // The lens peaks a third of the way out and fades to nothing at its rim.
            const push = 6.75 * ratio * (1 - ratio) * (1 - ratio) * lensStrength * lens.power;
            pushX += (dx / distance) * push;
            pushY += (dy / distance) * push;
            heat = Math.max(heat, (1 - ratio) * (1 - ratio) * lens.power);
          }
        }

        for (let wave = 0; wave < ripples.length; wave += 1) {
          const ripple = ripples[wave];
          const age = now - ripple.start;
          const front = 0.62 * age;
          const dx = originX - ripple.x;
          const dy = originY - ripple.y;
          const distance = Math.hypot(dx, dy);
          const band = (distance - front) / 46;
          if (band < -2.2 || band > 2.2 || distance < 0.001) continue;
          const life = 1 - age / 1500;
          const push = Math.exp(-band * band) * life * life;
          pushX += (dx / distance) * 11 * push;
          pushY += (dy / distance) * 11 * push;
          heat = Math.max(heat, 0.9 * push);
        }

        if (still) {
          offsetX[index] = 0;
          offsetY[index] = 0;
          velocityX[index] = 0;
          velocityY[index] = 0;
        } else {
          velocityX[index] = (velocityX[index] + (pushX - offsetX[index]) * springForce) * damping;
          velocityY[index] = (velocityY[index] + (pushY - offsetY[index]) * springForce) * damping;
          offsetX[index] += velocityX[index] * delta;
          offsetY[index] += velocityY[index] * delta;
          if (
            !moving &&
            (Math.abs(velocityX[index]) > 0.01 ||
              Math.abs(velocityY[index]) > 0.01 ||
              Math.abs(pushX - offsetX[index]) > 0.05 ||
              Math.abs(pushY - offsetY[index]) > 0.05)
          ) {
            moving = true;
          }
        }

        glow[index] += (heat - glow[index]) * (1 - Math.pow(0.75, delta));
        if (!moving && Math.abs(heat - glow[index]) > 0.01) moving = true;
      }

      draw();
      if (ripples.length || moving || pointer.inside) schedule();
      else lastTime = 0;
    };

    const schedule = () => {
      if (!rafId && visible) rafId = requestAnimationFrame(frame);
    };

    const toLocal = (event: PointerEvent) => {
      const box = root.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };

    const onPointerMove = (event: PointerEvent) => {
      const { x, y } = toLocal(event);
      if (!pointer.inside) {
        lens.x = x;
        lens.y = y;
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

    const onPointerDown = (event: PointerEvent) => {
      if (!options.current.ripple || options.current.reduced || event.button > 0) return;
      const { x, y } = toLocal(event);
      ripples.push({ x, y, start: performance.now() });
      if (ripples.length > 6) ripples.shift();
      // Touch has no hover phase: the lens starts where the finger lands.
      if (event.pointerType !== "mouse") {
        pointer.x = x;
        pointer.y = y;
        lens.x = x;
        lens.y = y;
      }
      schedule();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") onPointerLeave();
    };

    readColors();
    resize();
    if (painted.current && !options.current.reduced) {
      canvas.animate?.([{ opacity: 0 }, { opacity: 1 }], {
        duration: 1000 * motionTokens.duration.standard,
        easing: `cubic-bezier(${motionTokens.ease.standard.join(",")})`,
      });
    }
    painted.current = true;

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(root);

    const mutationObserver = new MutationObserver(() => {
      readColors();
      draw();
    });
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent", "class", "style"],
    });

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
    });
    intersectionObserver.observe(root);

    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerLeave);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerLeave);
    };
  }, [color, activeColor]);

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={{
        ...(color ? { "--dot-grid-color": color } : null),
        ...(activeColor ? { "--dot-grid-active": activeColor } : null),
        ...style,
      }}
      data-fade={fade || undefined}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {children != null && <div className={styles.content}>{children}</div>}
    </div>
  );
}

export default DotGrid;
