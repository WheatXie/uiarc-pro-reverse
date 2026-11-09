"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./sticker-peel.module.css";

export type StickerShape = "circle" | "rounded" | "pill";

export interface StickerPeelItem {
  id: string;
  /** Accessible name; the surface announces it while peeling, moving and sticking. */
  label: string;
  content: ReactNode;
  /** Horizontal anchor as a fraction of the surface width (0–1). */
  x: number;
  /** Vertical anchor as a fraction of the surface height (0–1). */
  y: number;
  /** Resting angle in degrees. */
  rotate?: number;
  shape?: StickerShape;
}

export interface StickerPlacement {
  x: number;
  y: number;
  rotate: number;
}

export interface StickerPeelProps {
  stickers: StickerPeelItem[];
  /** Controlled placements keyed by sticker id. Omit to let the surface track its own. */
  positions?: Record<string, StickerPlacement>;
  onPositionsChange?: (positions: Record<string, StickerPlacement>) => void;
  label?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

type Point = [number, number];

interface Fold {
  /** Where the paper starts to lift, in sticker-local pixels. */
  point: Point;
  /** Direction the fold travels, normalized. */
  dir: Point;
  /** Corner index for rounded shapes, -1 for circles. */
  corner: number;
}

interface PointerState {
  id: number;
  startX: number;
  startY: number;
  fromX: number;
  fromY: number;
  mode: "peel" | "held";
  grabX: number;
  grabY: number;
  lastX: number;
  lastY: number;
  lastT: number;
  pullSpeed: number;
}

const LIFT = { stiffness: 420, damping: 36, mass: 0.7 };
const MOVE = { stiffness: 380, damping: 40, mass: 0.9 };
const TILT = { stiffness: 300, damping: 36 };
const PULL = {
  duration: motionTokens.duration.standard,
  ease: [...motionTokens.ease.standard] as [number, number, number, number],
};
const RELEASE = {
  duration: motionTokens.duration.exit,
  ease: [...motionTokens.ease.standard] as [number, number, number, number],
};
/** Maximum lean of the fold away from the pull direction. */
const LEAN = (35 * Math.PI) / 180;

const subscribeNothing = () => () => {};

/**
 * Sutherland–Hodgman clip of a polygon against a half-plane, keeping the vertices whose signed
 * distance is >= 0 and inserting the crossings.
 */
function clipPolygon(points: Point[], side: (point: Point) => number): Point[] {
  const kept: Point[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const currentSide = side(current);
    const nextSide = side(next);
    if (currentSide >= 0) kept.push(current);
    if (currentSide >= 0 !== nextSide >= 0) {
      const t = currentSide / (currentSide - nextSide);
      kept.push([current[0] + (next[0] - current[0]) * t, current[1] + (next[1] - current[1]) * t]);
    }
  }
  return kept;
}

function toPolygon(points: Point[]) {
  return `polygon(${points.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(", ")})`;
}

/** Nearest corner (or edge point, for circles) to the pointer, plus the direction the fold travels. */
function startFold(shape: StickerShape, w: number, h: number, px: number, py: number): Fold {
  if (shape === "circle") {
    let dx = px - w / 2;
    let dy = py - h / 2;
    const length = Math.hypot(dx, dy);
    if (length < 1) {
      dx = 0.7071;
      dy = 0.7071;
    } else {
      dx /= length;
      dy /= length;
    }
    const radius = Math.min(w, h) / 2;
    return {
      point: [w / 2 + dx * radius, h / 2 + dy * radius],
      dir: [-dx, -dy],
      corner: -1,
    };
  }
  const right = px >= w / 2;
  const down = py >= h / 2;
  const diagonal = Math.SQRT1_2;
  return {
    point: [right ? w : 0, down ? h : 0],
    dir: [right ? -diagonal : diagonal, down ? -diagonal : diagonal],
    corner: (right ? 1 : 0) + (down ? 1 : 0) * 2,
  };
}

/** How far a point has to travel along the fold direction before it leaves the shape. */
function edgeDistance(point: Point, dir: Point, w: number, h: number, radius: number) {
  const inside = (distance: number) => {
    const x = point[0] + dir[0] * distance - w / 2;
    const y = point[1] + dir[1] * distance - h / 2;
    const qx = Math.abs(x) - w / 2 + radius;
    const qy = Math.abs(y) - h / 2 + radius;
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    return 0 >= outside + Math.min(Math.max(qx, qy), 0) - radius;
  };
  if (inside(0)) return 0;
  const limit = Math.min(w, h);
  let step = 1;
  while (step <= limit && !inside(step)) step += 1;
  if (step > limit) return 0;
  let below = step - 1;
  let above = step;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const middle = (below + above) / 2;
    if (inside(middle)) above = middle;
    else below = middle;
  }
  return above;
}

/** Soft edge so a sticker fights back instead of stopping dead at the surface border. */
function rubberBand(value: number, min: number, max: number) {
  if (value < min) return min - ((min - value) * 40) / (40 + (min - value));
  if (value > max) return max + ((value - max) * 40) / (40 + (value - max));
  return value;
}

interface StickerProps {
  item: StickerPeelItem;
  placement: StickerPlacement;
  board: React.RefObject<HTMLDivElement | null>;
  z: number;
  reduced: boolean;
  describedBy: string;
  onFront: (id: string) => void;
  onPlace: (id: string, placement: StickerPlacement) => void;
  announce: (message: string) => void;
}

function Sticker({
  item,
  placement,
  board,
  z,
  reduced,
  describedBy,
  onFront,
  onPlace,
  announce,
}: StickerProps) {
  const shape = item.shape ?? "rounded";
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const frontRef = useRef<HTMLSpanElement | null>(null);
  const flapRef = useRef<HTMLSpanElement | null>(null);
  const backRef = useRef<HTMLSpanElement | null>(null);
  const curlRef = useRef<HTMLSpanElement | null>(null);
  const [held, setHeld] = useState(false);

  const left = useMotionValue(`${100 * placement.x}%`);
  const top = useMotionValue(`${100 * placement.y}%`);
  const bodyX = useMotionValue(0);
  const bodyY = useMotionValue(0);
  const springX = useSpring(bodyX, MOVE);
  const springY = useSpring(bodyY, MOVE);
  const rotation = useMotionValue(placement.rotate);
  const tilt = useSpring(rotation, TILT);
  const lift = useMotionValue(0);
  const scale = useTransform(lift, [0, 1], [1, 1.03]);
  const peelX = useMotionValue(0);
  const peelY = useMotionValue(0);
  const foldX = useSpring(peelX, LIFT);
  const foldY = useSpring(peelY, LIFT);

  const foldRef = useRef<Fold>({ point: [0, 0], dir: [Math.SQRT1_2, Math.SQRT1_2], corner: 0 });
  const pendingFold = useRef<Fold | null>(null);
  const pointer = useRef<PointerState | null>(null);
  const keyboard = useRef<{ x: number; y: number } | null>(null);
  const lastPlaced = useRef<StickerPlacement | null>(null);

  const size = useCallback(
    () => ({
      w: frontRef.current?.offsetWidth ?? 0,
      h: frontRef.current?.offsetHeight ?? 0,
    }),
    [],
  );

  const surface = useCallback(
    () => ({
      W: board.current?.clientWidth ?? 0,
      H: board.current?.clientHeight ?? 0,
    }),
    [board],
  );

  const pull = useCallback(
    (x: number, y: number, jump = false) => {
      peelX.set(x);
      peelY.set(y);
      if (jump || reduced) {
        foldX.jump(x);
        foldY.jump(y);
      }
    },
    [foldX, foldY, peelX, peelY, reduced],
  );

  /** Distance the pointer has to travel before the sticker lets go, in the fold direction. */
  const requiredPull = useCallback(
    (fold: Fold) => {
      const { w, h } = size();
      const radius =
        shape === "rounded" ? Math.min(18, w / 2, h / 2) : Math.min(w, h) / 2;
      const distance = 2 * edgeDistance(fold.point, fold.dir, w, h, radius) + 9;
      return [fold.dir[0] * distance, fold.dir[1] * distance] as Point;
    },
    [shape, size],
  );

  /** Redraws the fold: front clipped to one side, mirrored paper on the other, shadow and curl. */
  const drawPeel = useCallback(() => {
    const front = frontRef.current;
    const flap = flapRef.current;
    const back = backRef.current;
    const curl = curlRef.current;
    if (!front || !flap || !back || !curl) return;

    const [dirX, dirY] = foldRef.current.dir;
    const px = foldX.get();
    const py = foldY.get();
    const along = px * dirX + py * dirY;
    const lateral = Math.max(
      -Math.abs(along) * Math.tan(LEAN),
      Math.min(Math.abs(along) * Math.tan(LEAN), -(px * dirY) + py * dirX),
    );
    const offsetX = along > 0 ? dirX * along - dirY * lateral : 0;
    const offsetY = along > 0 ? dirY * along + dirX * lateral : 0;

    const length = Math.hypot(px, py);
    if (pendingFold.current && length < 0.5 && !pointer.current) {
      foldRef.current = pendingFold.current;
      pendingFold.current = null;
      const [x, y] = requiredPull(foldRef.current);
      pull(x, y);
    }

    if (length < 0.5 || Math.hypot(offsetX, offsetY) < 0.5) {
      front.style.clipPath = "";
      flap.style.visibility = "hidden";
      return;
    }

    const w = front.offsetWidth;
    const h = front.offsetHeight;
    const [pointX, pointY] = foldRef.current.point;
    const span = Math.hypot(offsetX, offsetY);
    const nx = offsetX / span;
    const ny = offsetY / span;
    const midX = pointX + offsetX / 2;
    const midY = pointY + offsetY / 2;
    const quad: Point[] = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ];
    const signed = ([x, y]: Point) => (x - midX) * nx + (y - midY) * ny;
    const frontPoints = clipPolygon(quad, signed);
    const backPoints = clipPolygon(quad, (point) => -signed(point));

    front.style.clipPath = frontPoints.length > 2 ? toPolygon(frontPoints) : "inset(50%)";
    if (backPoints.length < 3) {
      flap.style.visibility = "hidden";
      return;
    }
    flap.style.visibility = "visible";

    const bend = Math.min(1, span / 80);
    const squash = 1 - 0.06 * bend;
    const plane = midX * nx + midY * ny;
    const skew = -(1 + squash) * nx * ny;
    back.style.transform = `matrix(${1 - (1 + squash) * nx * nx}, ${skew}, ${skew}, ${
      1 - (1 + squash) * ny * ny
    }, ${(1 + squash) * plane * nx}, ${(1 + squash) * plane * ny})`;
    back.style.clipPath = toPolygon(backPoints);

    const angle = (-tilt.get() * Math.PI) / 180;
    const offset = 0.8 + 2 * bend;
    flap.style.filter = `drop-shadow(${(-Math.sin(angle) * offset).toFixed(2)}px ${(
      Math.cos(angle) * offset
    ).toFixed(2)}px ${(1.5 + 3 * bend).toFixed(2)}px oklch(0% 0 0 / ${(
      0.1 + 0.06 * bend
    ).toFixed(3)}))`;

    const reach = 2 * Math.hypot(w, h);
    curl.style.width = `${reach}px`;
    curl.style.height = `${2 * reach}px`;
    curl.style.transform = `translate(${midX}px, ${midY}px) rotate(${Math.atan2(
      -ny,
      -nx,
    )}rad) translateY(-50%)`;
    curl.style.backgroundImage = `linear-gradient(90deg, oklch(0% 0 0 / .07) 0px, oklch(0% 0 0 / 0) ${Math.max(
      6,
      Math.min(18, 0.25 * span),
    )}px)`;
  }, [foldX, foldY, pull, requiredPull, tilt]);

  const drawRef = useRef(drawPeel);
  useEffect(() => {
    drawRef.current = drawPeel;
  });

  useEffect(() => {
    const redraw = () => drawRef.current();
    const offX = foldX.on("change", redraw);
    const offY = foldY.on("change", redraw);
    return () => {
      offX();
      offY();
    };
  }, [foldX, foldY]);

  /** Follow controlled placements without a jump: shift the base, then relax the local offset. */
  const previous = useRef(placement);
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = placement;
    if (before.x === placement.x && before.y === placement.y && before.rotate === placement.rotate) {
      return;
    }
    const { W, H } = surface();
    const dx = (placement.x - before.x) * W;
    const dy = (placement.y - before.y) * H;
    left.set(`${100 * placement.x}%`);
    top.set(`${100 * placement.y}%`);
    bodyX.jump(bodyX.get() - dx);
    bodyY.jump(bodyY.get() - dy);
    springX.jump(springX.get() - dx);
    springY.jump(springY.get() - dy);

    const placed = lastPlaced.current;
    lastPlaced.current = null;
    const echoed = placed && Math.abs(placed.x - placement.x) < 1e-6 && Math.abs(placed.y - placement.y) < 1e-6;
    if (echoed || pointer.current || keyboard.current) return;
    if (reduced) {
      bodyX.jump(0);
      bodyY.jump(0);
      springX.jump(0);
      springY.jump(0);
      rotation.jump(placement.rotate);
      tilt.jump(placement.rotate);
      return;
    }
    bodyX.set(0);
    bodyY.set(0);
    rotation.set(placement.rotate);
  });

  /** Pointer position in sticker-local pixels, undoing rotation and the lift scale. */
  const toLocal = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = rootRef.current?.getBoundingClientRect();
      const { w, h } = size();
      const angle = (-tilt.get() * Math.PI) / 180;
      const factor = scale.get() || 1;
      if (!rect) return [w / 2, h / 2];
      const x = (clientX - (rect.left + rect.width / 2)) / factor;
      const y = (clientY - (rect.top + rect.height / 2)) / factor;
      return [w / 2 + x * Math.cos(angle) - y * Math.sin(angle), h / 2 + x * Math.sin(angle) + y * Math.cos(angle)];
    },
    [scale, size, tilt],
  );

  const undoRotation = useCallback(
    (dx: number, dy: number): Point => {
      const angle = (-tilt.get() * Math.PI) / 180;
      return [dx * Math.cos(angle) - dy * Math.sin(angle), dx * Math.sin(angle) + dy * Math.cos(angle)];
    },
    [tilt],
  );

  /** How far the body may travel before its rotated box leaves the surface. */
  const bounds = useCallback(
    (angle = tilt.get()) => {
      const { w, h } = size();
      const { W, H } = surface();
      const radians = (angle * Math.PI) / 180;
      const cos = Math.abs(Math.cos(radians));
      const sin = Math.abs(Math.sin(radians));
      const halfWidth = (w * cos + h * sin) / 2 + 4;
      const halfHeight = (w * sin + h * cos) / 2 + 4;
      const originX = placement.x * W;
      const originY = placement.y * H;
      return {
        minX: Math.min(0, halfWidth - originX),
        maxX: Math.max(0, W - halfWidth - originX),
        minY: Math.min(0, halfHeight - originY),
        maxY: Math.max(0, H - halfHeight - originY),
      };
    },
    [placement.x, placement.y, size, surface, tilt],
  );

  const pickUp = useCallback(() => {
    pull(0, 0);
    if (reduced) lift.jump(1);
    else animate(lift, 1, PULL);
    setHeld(true);
  }, [lift, pull, reduced]);

  const stickDown = useCallback(() => {
    setHeld(false);
    const angle = placement.rotate;
    const { minX, maxX, minY, maxY } = bounds(angle);
    const nextX = Math.min(maxX, Math.max(minX, springX.get()));
    const nextY = Math.min(maxY, Math.max(minY, springY.get()));
    const moved = Math.abs(nextX - springX.get()) + Math.abs(nextY - springY.get()) > 0.5;
    bodyX.jump(nextX);
    bodyY.jump(nextY);
    if (!moved || reduced) {
      springX.jump(nextX);
      springY.jump(nextY);
    }
    if (reduced) lift.jump(0);
    else animate(lift, 0, RELEASE);

    const { W, H } = surface();
    if (!W || !H) return;
    const next: StickerPlacement = {
      x: placement.x + nextX / W,
      y: placement.y + nextY / H,
      rotate: Math.round(10 * angle) / 10,
    };
    lastPlaced.current = next;
    onPlace(item.id, next);
  }, [bodyX, bodyY, bounds, item.id, lift, onPlace, placement.rotate, placement.x, placement.y, reduced, springX, springY, surface]);

  /** Hovering opens the nearest corner so the sticker looks ready to come off. */
  const hoverPeel = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (pointer.current || event.pointerType !== "mouse" || reduced || held || keyboard.current) {
        return;
      }
      const { w, h } = size();
      const [px, py] = toLocal(event.clientX, event.clientY);
      const fold = startFold(shape, w, h, px, py);
      const previousFold = foldRef.current;
      const open = Math.hypot(foldX.get(), foldY.get()) > 0.5;
      const switchedCorners =
        (shape !== "circle" && open && fold.corner !== previousFold.corner) ||
        (shape === "circle" &&
          open &&
          Math.abs(
            Math.atan2(
              previousFold.dir[0] * fold.dir[1] - previousFold.dir[1] * fold.dir[0],
              previousFold.dir[0] * fold.dir[0] + previousFold.dir[1] * fold.dir[1],
            ),
          ) > 0.6);

      if (switchedCorners) {
        pendingFold.current = fold;
        pull(0, 0);
        return;
      }
      pendingFold.current = null;
      foldRef.current = fold;
      if (shape === "circle" && open) {
        const alongFold = Math.hypot(foldX.get(), foldY.get());
        foldX.jump(fold.dir[0] * alongFold);
        foldY.jump(fold.dir[1] * alongFold);
      }
      const [x, y] = requiredPull(fold);
      pull(x, y);
      drawPeel();
    },
    [drawPeel, foldX, foldY, held, pull, reduced, requiredPull, shape, size, toLocal],
  );

  const moveHeld = useCallback(
    (clientX: number, clientY: number) => {
      const drag = pointer.current;
      if (!drag) return;
      const rect = board.current?.getBoundingClientRect();
      if (!rect) return;
      const { W, H } = surface();
      const { minX, maxX, minY, maxY } = bounds();
      bodyX.set(rubberBand(clientX - drag.grabX - rect.left - placement.x * W, minX, maxX));
      bodyY.set(rubberBand(clientY - drag.grabY - rect.top - placement.y * H, minY, maxY));
      if (reduced) {
        springX.jump(bodyX.get());
        springY.jump(bodyY.get());
      }
    },
    [board, bodyX, bodyY, bounds, placement.x, placement.y, reduced, springX, springY, surface],
  );

  /** The fold cleared the middle, so the sticker comes off and follows the hand. */
  const peelOff = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = pointer.current;
      if (!drag) return;
      drag.mode = "held";
      const { w, h } = size();
      const [pointX, pointY] = foldRef.current.point;
      const angle = (tilt.get() * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const dx = pointX - w / 2;
      const dy = pointY - h / 2;
      drag.grabX = (dx * cos - dy * sin) * 0.8;
      drag.grabY = (dx * sin + dy * cos) * 0.8;
      pickUp();
      announce(`${item.label} peeled off.`);
      moveHeld(event.clientX, event.clientY);
    },
    [announce, item.label, moveHeld, pickUp, size, tilt],
  );

  const endPointer = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = pointer.current;
      if (!drag || event.pointerId !== drag.id) return;
      pointer.current = null;
      if (drag.mode === "held") {
        stickDown();
        announce(`${item.label} stuck down.`);
        return;
      }
      pull(0, 0);
    },
    [announce, item.label, pull, stickDown],
  );

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = pointer.current;
    if (!drag) {
      hoverPeel(event);
      return;
    }
    if (event.pointerId !== drag.id) return;
    const elapsed = Math.max(1, event.timeStamp - drag.lastT);
    const [dx, dy] = undoRotation(event.clientX - drag.lastX, event.clientY - drag.lastY);
    const [dirX, dirY] = foldRef.current.dir;
    drag.pullSpeed = 0.6 * drag.pullSpeed + ((dx * dirX + dy * dirY) / elapsed) * 400;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    if (drag.mode === "held") {
      moveHeld(event.clientX, event.clientY);
      return;
    }

    const { w, h } = size();
    const [movedX, movedY] = undoRotation(event.clientX - drag.startX, event.clientY - drag.startY);
    const nextX = drag.fromX + movedX;
    const nextY = drag.fromY + movedY;
    const alongFold = nextX * dirX + nextY * dirY;
    const [needX, needY] = requiredPull(foldRef.current);
    const needed = Math.hypot(needX, needY);
    if (alongFold < needed && Math.hypot(movedX, movedY) > 36 && movedX * dirX + movedY * dirY < 0) {
      peelOff(event);
      return;
    }
    const travel = Math.max(needed, alongFold);
    const lateral = Math.max(
      -travel * Math.tan(LEAN),
      Math.min(travel * Math.tan(LEAN), -(nextX * dirY) + nextY * dirX),
    );
    peelX.set(dirX * travel - dirY * lateral);
    peelY.set(dirY * travel + dirX * lateral);

    const [pointX, pointY] = foldRef.current.point;
    const maxAlong = Math.max(
      ...([
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ] as Point[]).map(([x, y]) => (x - pointX) * dirX + (y - pointY) * dirY),
    );
    if (
      travel > 0.95 * maxAlong ||
      (travel > 0.45 * maxAlong && drag.pullSpeed > 1100) ||
      Math.hypot(movedX, movedY) > Math.max(90, 1.15 * maxAlong)
    ) {
      peelOff(event);
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button > 0 || pointer.current) return;
    event.preventDefault();
    rootRef.current?.focus({ preventScroll: true });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture is best-effort: Safari can refuse on synthetic pointers */
    }
    onFront(item.id);
    const { w, h } = size();
    const [px, py] = toLocal(event.clientX, event.clientY);
    pendingFold.current = null;
    const open = Math.hypot(foldX.get(), foldY.get()) > 1.5;
    const fold = startFold(shape, w, h, px, py);
    if (!(open && (shape === "circle" || fold.corner === foldRef.current.corner))) {
      foldRef.current = fold;
      pull(0, 0, true);
    }
    peelX.set(foldX.get());
    peelY.set(foldY.get());

    const rect = rootRef.current?.getBoundingClientRect();
    pointer.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      fromX: foldX.get(),
      fromY: foldY.get(),
      mode: "peel",
      grabX: rect ? event.clientX - (rect.left + rect.width / 2) : 0,
      grabY: rect ? event.clientY - (rect.top + rect.height / 2) : 0,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: event.timeStamp,
      pullSpeed: 0,
    };
    if (reduced) {
      pointer.current.mode = "held";
      pickUp();
    } else {
      const [needX, needY] = requiredPull(foldRef.current);
      if (Math.hypot(foldX.get(), foldY.get()) < Math.hypot(needX, needY)) {
        peelX.set(needX);
        peelY.set(needY);
        pointer.current.fromX = needX;
        pointer.current.fromY = needY;
      }
    }
  };

  const onPointerLeave = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointer.current || event.pointerType !== "mouse" || held) return;
    pendingFold.current = null;
    pull(0, 0);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const carried = keyboard.current !== null;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (event.repeat || pointer.current) return;
      if (carried) {
        keyboard.current = null;
        stickDown();
        announce(`${item.label} stuck down.`);
      } else {
        onFront(item.id);
        keyboard.current = { x: bodyX.get(), y: bodyY.get() };
        pickUp();
        announce(
          `${item.label} picked up. Move with the arrow keys, press Enter to stick it down, or Escape to put it back.`,
        );
      }
      return;
    }
    if (!carried) return;
    if (event.key === "Escape" || event.key === "Tab") {
      const restore = event.key === "Escape" ? keyboard.current : null;
      if (restore) {
        event.preventDefault();
        bodyX.set(restore.x);
        bodyY.set(restore.y);
        if (reduced) {
          springX.jump(bodyX.get());
          springY.jump(bodyY.get());
        }
      }
      keyboard.current = null;
      if (restore) {
        setHeld(false);
        if (reduced) lift.jump(0);
        else animate(lift, 0, RELEASE);
        announce(`${item.label} put back.`);
      } else {
        stickDown();
        announce(`${item.label} stuck down.`);
      }
      return;
    }
    const step = event.shiftKey ? 40 : 10;
    const delta: Point | undefined = {
      ArrowLeft: [-step, 0] as Point,
      ArrowRight: [step, 0] as Point,
      ArrowUp: [0, -step] as Point,
      ArrowDown: [0, step] as Point,
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    const { minX, maxX, minY, maxY } = bounds();
    bodyX.set(Math.min(maxX, Math.max(minX, bodyX.get() + delta[0])));
    bodyY.set(Math.min(maxY, Math.max(minY, bodyY.get() + delta[1])));
    if (reduced) {
      springX.jump(bodyX.get());
      springY.jump(bodyY.get());
    }
  };

  return (
    <motion.button
      ref={rootRef}
      type="button"
      className={styles.sticker}
      data-shape={shape}
      data-held={held || undefined}
      aria-label={item.label}
      aria-roledescription="sticker"
      aria-pressed={held}
      aria-describedby={describedBy}
      style={{
        left,
        top,
        x: springX,
        y: springY,
        rotate: tilt,
        scale,
        zIndex: held ? 1000 : z,
      }}
      onPointerEnter={hoverPeel}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onLostPointerCapture={endPointer}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      onBlur={() => {
        if (!keyboard.current) return;
        keyboard.current = null;
        stickDown();
      }}
    >
      <motion.span className={styles.liftShadow} aria-hidden="true" style={{ opacity: lift }} />
      <span ref={frontRef} className={styles.front} aria-hidden="true">
        <span className={styles.face}>{item.content}</span>
      </span>
      <span ref={flapRef} className={styles.flap} aria-hidden="true">
        <span ref={backRef} className={styles.back}>
          <span ref={curlRef} className={styles.curl} />
        </span>
      </span>
    </motion.button>
  );
}

/**
 * A sheet of stickers you can peel off the surface and move around. Each sticker folds back on
 * itself while you pull (a real clip-path fold, mirrored paper backing and a lifted shadow), comes
 * free once the fold passes its middle, and lands back with a soft shadow fade.
 */
export function StickerPeel({
  stickers,
  positions,
  onPositionsChange,
  label = "Stickers",
  children,
  className,
  style,
}: StickerPeelProps) {
  const mounted = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const prefersReduced = useReducedMotion();
  const reduced = Boolean(prefersReduced) && mounted;
  const helpId = useId();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [localPositions, setLocalPositions] = useState<Record<string, StickerPlacement>>({});
  const [order, setOrder] = useState<string[]>(() => stickers.map((sticker) => sticker.id));
  const [message, setMessage] = useState("");

  const resolved = useMemo(
    () =>
      stickers.map(
        (sticker) =>
          positions?.[sticker.id] ??
          localPositions[sticker.id] ?? { x: sticker.x, y: sticker.y, rotate: sticker.rotate ?? 0 },
      ),
    [localPositions, positions, stickers],
  );

  const raise = useCallback((id: string) => {
    setOrder((current) => [...current.filter((entry) => entry !== id), id]);
  }, []);

  const place = useCallback(
    (id: string, placement: StickerPlacement) => {
      const next = Object.fromEntries(
        stickers.map((sticker, index) => [sticker.id, sticker.id === id ? placement : resolved[index]]),
      );
      if (positions === undefined) setLocalPositions(next);
      onPositionsChange?.(next);
    },
    [onPositionsChange, positions, resolved, stickers],
  );

  return (
    <div
      ref={boardRef}
      className={[styles.board, className].filter(Boolean).join(" ")}
      style={style}
      role="group"
      aria-label={label}
    >
      {children}
      {stickers.map((sticker, index) => (
        <Sticker
          key={sticker.id}
          item={sticker}
          placement={resolved[index]}
          board={boardRef}
          z={Math.max(0, order.indexOf(sticker.id)) + 1}
          reduced={reduced}
          describedBy={`${helpId}-help`}
          onFront={raise}
          onPlace={place}
          announce={setMessage}
        />
      ))}
      <span id={`${helpId}-help`} className={styles.srOnly}>
        Drag to peel and move. With the keyboard, press Enter to pick up, arrow keys to move, and
        Enter to stick down.
      </span>
      <span className={styles.srOnly} role="status">
        {message}
      </span>
    </div>
  );
}

export default StickerPeel;
