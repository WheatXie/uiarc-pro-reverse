"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from "motion/react";
import styles from "./holo-card.module.css";

const TILT_SPRING = { stiffness: 160, damping: 22, mass: 0.7 } as const;
const FOLLOW_SPRING = { stiffness: 120, damping: 20 } as const;
const FLIP_SPRING = { type: "spring", visualDuration: 0.6, bounce: 0.1 } as const;

const subscribe = () => () => {};

/** iOS-only permission prompt; absent everywhere else. */
type GyroPermissionRequest = () => Promise<"granted" | "denied" | "default">;
const gyroPermissionRequest = (): GyroPermissionRequest | undefined =>
  (DeviceOrientationEvent as unknown as { requestPermission?: GyroPermissionRequest }).requestPermission;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export interface HoloCardProps {
  /** Face content for the front of the card — usually a photo and a name block. */
  front: ReactNode;
  /** Face content for the back. Supplying it makes the card interactive. */
  back?: ReactNode;
  /** Controlled flip state; omit to let the card flip itself. */
  flipped?: boolean;
  defaultFlipped?: boolean;
  onFlippedChange?: (flipped: boolean) => void;
  /** Peak tilt in degrees at the corners of the card. */
  maxTilt?: number;
  /** Multiplier for the foil, glitter and glare strength. */
  intensity?: number;
  /** Follow device orientation on touch devices. */
  gyroscope?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

type HoloVars = { [key: `--${string}`]: string | number | MotionValue<string> | MotionValue<number> | undefined };
type HoloStyle = MotionStyle & HoloVars;

/**
 * A card that tilts toward the pointer under a holographic foil, and flips to its
 * back face on click, Enter or Space.
 */
export function HoloCard({
  front,
  back,
  flipped,
  defaultFlipped = false,
  onFlippedChange,
  maxTilt = 14,
  intensity = 1,
  gyroscope = true,
  label,
  className,
  style,
}: HoloCardProps) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const reduced = !!useReducedMotion() && mounted;

  const [internalFlipped, setInternalFlipped] = useState(defaultFlipped);
  const isFlipped = flipped ?? internalFlipped;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const gyroState = useRef<"off" | "asked" | "on">("off");
  const gyroCleanup = useRef<(() => void) | null>(null);
  const gyroBase = useRef<{ beta: number; gamma: number } | null>(null);

  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const presence = useMotionValue(0);

  const x = useSpring(pointerX, FOLLOW_SPRING);
  const y = useSpring(pointerY, FOLLOW_SPRING);
  const active = useSpring(presence, FOLLOW_SPRING);

  const rotateX = useSpring(
    useTransform(() => (0.5 - y.get()) * 2 * maxTilt * active.get()),
    TILT_SPRING,
  );
  const rotateY = useSpring(
    useTransform(() => (x.get() - 0.5) * 2 * maxTilt * active.get()),
    TILT_SPRING,
  );
  const scale = useTransform(active, [0, 1], [1, 1.035]);

  const spin = useMotionValue(180 * (isFlipped ? 1 : 0));
  const turns = useRef(isFlipped ? 1 : 0);
  const direction = useRef(1);

  useEffect(() => {
    if ((Math.abs(Math.round(turns.current)) % 2 === 1) === isFlipped) return;
    turns.current += direction.current;
    if (reduced) {
      spin.jump(180 * turns.current);
      return;
    }
    const controls = animate(spin, 180 * turns.current, FLIP_SPRING);
    return () => controls.stop();
  }, [isFlipped, reduced, spin]);

  /** 0 on a flat face, 1 while edge-on — drives the foil sweep during a flip. */
  const progress = useTransform(spin, (value) => Math.abs(Math.sin((value / 180) * Math.PI)));

  const hue = useTransform(
    () => (x.get() - 0.5) * 120 + (y.get() - 0.5) * 60 + 90 * progress.get(),
  );
  const foilX = useTransform(() => `${100 * x.get() + 60 * progress.get()}%`);
  const foilY = useTransform(y, (value) => `${100 * value}%`);
  const glitterX = useTransform(x, (value) => `${(0.5 - value) * 36}px`);
  const glitterY = useTransform(y, (value) => `${(0.5 - value) * 36}px`);
  const holoX = useTransform(x, (value) => `${100 * value}%`);
  const holoY = useTransform(y, (value) => `${100 * value}%`);
  const shine = useTransform(() => Math.min(1, 0.35 + 0.65 * active.get() + 0.5 * progress.get()) * intensity);
  const shadowX = useTransform(rotateY, (value) => `${-(0.9 * value)}px`);
  const shadowY = useTransform(rotateX, (value) => `${18 + 0.9 * value}px`);
  const boxShadow = useMotionTemplate`${shadowX} ${shadowY} 42px -14px oklch(0% 0 0 / calc(.28 + ${active} * .12))`;

  const handleOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) return;
    gyroBase.current ??= { beta: event.beta, gamma: event.gamma };
    const base = gyroBase.current;
    pointerX.set(clamp01(0.5 + (event.gamma - base.gamma) / 50));
    pointerY.set(clamp01(0.5 + (event.beta - base.beta) / 50));
    presence.set(1);
  };
  const orientationRef = useRef(handleOrientation);

  useEffect(() => {
    orientationRef.current = handleOrientation;
  });

  useEffect(() => () => gyroCleanup.current?.(), []);

  useEffect(() => {
    if (
      !gyroscope ||
      reduced ||
      !("DeviceOrientationEvent" in window) ||
      !window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
      typeof gyroPermissionRequest() === "function"
    ) {
      return;
    }
    const listener = (event: DeviceOrientationEvent) => orientationRef.current(event);
    gyroState.current = "on";
    window.addEventListener("deviceorientation", listener);
    return () => {
      window.removeEventListener("deviceorientation", listener);
      gyroState.current = "off";
    };
  }, [gyroscope, reduced]);

  /** iOS needs a gesture before orientation events flow; ask once, on first tap. */
  const requestGyro = () => {
    if (!gyroscope || reduced || gyroState.current !== "off") return;
    const request = gyroPermissionRequest();
    if (typeof request !== "function") return;
    gyroState.current = "asked";
    request()
      .then((permission: "granted" | "denied" | "default") => {
        if (permission !== "granted") return;
        const listener = (event: DeviceOrientationEvent) => orientationRef.current(event);
        gyroState.current = "on";
        window.addEventListener("deviceorientation", listener);
        gyroCleanup.current = () => window.removeEventListener("deviceorientation", listener);
      })
      .catch(() => {});
  };

  const trackPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || (event.pointerType !== "mouse" && gyroState.current === "on")) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerX.set(clamp01((event.clientX - rect.left) / rect.width));
    pointerY.set(clamp01((event.clientY - rect.top) / rect.height));
    presence.set(1);
  };

  const releasePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" && gyroState.current === "on") return;
    pointerX.set(0.5);
    pointerY.set(0.5);
    presence.set(0);
  };

  const flip = (dir: number) => {
    requestGyro();
    if (!back) return;
    direction.current = dir;
    const next = !isFlipped;
    if (flipped === undefined) setInternalFlipped(next);
    onFlippedChange?.(next);
  };

  const interactive = !!back;
  const innerStyle: MotionStyle | undefined = reduced ? undefined : { rotateY: spin };

  const hueDegrees = useMotionTemplate`${hue}deg`;
  const vars: HoloVars = {
    "--holo-x": holoX,
    "--holo-y": holoY,
    "--holo-foil-x": foilX,
    "--holo-foil-y": foilY,
    "--holo-glitter-x": glitterX,
    "--holo-glitter-y": glitterY,
    "--holo-hue": hueDegrees,
    "--holo-shine": shine,
  };
  const cardStyle: HoloStyle = reduced
    ? vars
    : { ...vars, rotateX, rotateY, scale, transformPerspective: 900 };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      onPointerMove={trackPointer}
      onPointerEnter={trackPointer}
      onPointerLeave={releasePointer}
      onPointerCancel={releasePointer}
    >
      <motion.div
        className={styles.shadow}
        aria-hidden="true"
        style={reduced ? undefined : { boxShadow, rotateX, rotateY, scale, transformPerspective: 900 }}
      />
      <motion.div
        className={styles.card}
        style={cardStyle}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-pressed={interactive ? isFlipped : undefined}
        aria-roledescription={interactive ? "flip card" : undefined}
        aria-label={label}
        onClick={
          interactive
            ? (event) => {
                const rect = rootRef.current?.getBoundingClientRect();
                flip(rect && event.detail > 0 && event.clientX < rect.left + rect.width / 2 ? -1 : 1);
              }
            : requestGyro
        }
        onKeyDown={
          interactive
            ? (event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                flip(1);
              }
            : undefined
        }
        data-reduced={reduced || undefined}
        data-flipped={isFlipped || undefined}
      >
        <motion.div className={styles.inner} style={innerStyle}>
          <div className={styles.face} data-side="front" aria-hidden={isFlipped || undefined}>
            <div className={styles.content}>{front}</div>
            <span className={styles.foil} aria-hidden="true" />
            <span className={styles.glitter} aria-hidden="true" />
            <span className={styles.glare} aria-hidden="true" />
          </div>
          {back ? (
            <div className={styles.face} data-side="back" aria-hidden={!isFlipped || undefined}>
              <div className={styles.content}>{back}</div>
              <span className={styles.foil} aria-hidden="true" />
              <span className={styles.glare} aria-hidden="true" />
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default HoloCard;
