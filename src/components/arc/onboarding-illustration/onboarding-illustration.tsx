"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";

import { motionTokens } from "../lib/motion-tokens";
import styles from "./onboarding-illustration.module.css";

const { spring, duration, blur } = motionTokens;
type Bezier = [number, number, number, number];
const enterEase: Bezier = [...motionTokens.ease.enter];
const standardEase: Bezier = [...motionTokens.ease.standard];
const instant = { duration: 0 };

type Tone = "paper" | "shade" | "note";

/** One rounded rectangle in the illustration, positioned by its centre. */
interface Shape {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  rot: number;
  tone: Tone;
  o: number;
}

/** One straight rule inside the illustration. */
interface Stroke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  accent: boolean;
}

/** A single step of the illustrated story. */
interface Scene {
  label: string;
  shapes: Shape[];
  strokes: Stroke[];
  /** Cubic control points: x0, y0, c1x, c1y, c2x, c2y, x1, y1. */
  curve: number[];
  curveOn: boolean;
  check: boolean;
}

interface Step {
  id: string;
  title: string;
  body: string;
}

/** Round to a tenth so SVG attributes stay short. */
const round = (value: number) => Math.round(value * 10) / 10;

function shape(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  rot = 0,
  tone: Tone = "paper",
  o = 1,
): Shape {
  return { x, y, w, h, r, rot, tone, o };
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  accent = false,
): Stroke {
  return { x1, y1, x2, y2, accent };
}

/** Eight identical numbers, i.e. a degenerate curve that reads as a dot. */
const dot = (x: number, y: number) => [x, y, x, y, x, y, x, y];

/** Maps a line drawn in a shape's local space into illustration space. */
function within(target: Shape, x1: number, y1: number, x2: number, y2: number) {
  const rad = (target.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const px = (x: number, y: number) => round(target.x + x * cos - y * sin);
  const py = (x: number, y: number) => round(target.y + x * sin + y * cos);
  return line(px(x1, y1), py(x1, y1), px(x2, y2), py(x2, y2));
}

/** Radial tick around the badge centre, for the third and fourth steps. */
function spoke(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return line(
    round(160 + 64 * Math.cos(rad)),
    round(92 + 64 * Math.sin(rad)),
    round(160 + 74 * Math.cos(rad)),
    round(92 + 74 * Math.sin(rad)),
  );
}

const folderBase = shape(120, 62, 44, 22, 7, 0, "shade");
const folderBack = shape(160, 108, 136, 88, 12, 0, "shade");
const folderFront = shape(160, 122, 144, 64, 11);
const note = shape(258, 38, 48, 60, 6, 16, "note");
const badgeFill = shape(160, 92, 20, 20, 10, 0, "paper", 0);

const scenes: Scene[] = [
  {
    label: "An open, empty folder with a plus sign above it",
    shapes: [
      folderBase,
      folderBack,
      shape(112, 12, 44, 56, 5, -18, "paper", 0),
      shape(166, 0, 44, 56, 5, 6, "paper", 0),
      shape(214, 12, 44, 56, 5, 20, "paper", 0),
      shape(294, 6, 44, 56, 5, 30, "note", 0),
      folderFront,
    ],
    strokes: [line(148, 114, 172, 114), line(151, 36, 169, 36, true), line(160, 27, 160, 45, true)],
    curve: dot(226, 30),
    curveOn: false,
    check: false,
  },
  {
    label: "Documents flying into the open folder and stacking inside it",
    shapes: [
      folderBase,
      folderBack,
      shape(134, 80, 56, 72, 6, -10),
      shape(158, 74, 56, 72, 6, -2),
      shape(184, 80, 56, 72, 6, 9),
      note,
      folderFront,
    ],
    strokes: [
      within(note, -14, -18, 14, -18),
      within(note, -14, -9, 10, -9),
      within(note, -14, 0, 4, 0),
    ],
    curve: [226, 30, 214, 13, 198, 13, 190, 30],
    curveOn: true,
    check: false,
  },
  {
    label: "Three teammates gathered around one shared document",
    shapes: [
      shape(160, 58, 40, 34, 17),
      shape(160, 27, 22, 22, 11),
      shape(88, 128, 46, 40, 20),
      shape(88, 90, 28, 28, 14),
      shape(232, 128, 46, 40, 20),
      shape(232, 90, 28, 28, 14),
      shape(160, 106, 72, 88, 8),
    ],
    strokes: [
      line(138, 82, 174, 82),
      line(138, 94, 166, 94, true),
      line(138, 106, 178, 106),
    ],
    curve: [214, 82, 204, 64, 184, 66, 173, 92],
    curveOn: true,
    check: false,
  },
  {
    label: "A finished badge with a check mark",
    shapes: [
      shape(146, 156, 22, 52, 4, 16),
      shape(174, 156, 22, 52, 4, -16),
      shape(160, 92, 108, 108, 54, 0, "shade"),
      badgeFill,
      badgeFill,
      badgeFill,
      shape(160, 92, 84, 84, 42),
    ],
    strokes: [spoke(-140), spoke(-90), spoke(-40)],
    curve: dot(160, 92),
    curveOn: false,
    check: true,
  },
];

const steps: Step[] = [
  {
    id: "workspace",
    title: "Create your first workspace",
    body: "Each project gets one home. Start with Q3 vendor contracts and add files whenever you’re ready.",
  },
  {
    id: "files",
    title: "Bring in the files you already have",
    body: "Drop PDFs, docs, and spreadsheets onto the workspace. Folio files them by type and keeps every version.",
  },
  {
    id: "team",
    title: "Review together in one copy",
    body: "Invite Maya and Theo to the same draft. Comments stay pinned to the exact line they’re about.",
  },
  {
    id: "ready",
    title: "You’re ready to go",
    body: "Q3 vendor contracts has 4 files and 2 teammates. You can change any of this later in settings.",
  },
];

const finished: Step = {
  id: "done",
  title: "Your workspace is open",
  body: "Replay the intro to walk through each step again.",
};

/** Parallax weight per shape index; later shapes sit closer to the viewer. */
const depths = [0.4, 0.55, 0.7, 0.8, 0.9, 1, 1];
const lastStep = steps.length - 1;

const toPath = (points: number[]) =>
  `M${points[0]} ${points[1]}C${points[2]} ${points[3]} ${points[4]} ${points[5]} ${points[6]} ${points[7]}`;

interface Pointer {
  x: MotionValue<number>;
  y: MotionValue<number>;
}

/** Pointer offset scaled by depth, so the stack reads as layered. */
function parallax(pointer: Pointer, depth: number) {
  return {
    x: useTransform(pointer.x, value => value * depth),
    y: useTransform(pointer.y, value => value * depth),
  };
}

interface ShapeLayerProps {
  shape: Shape;
  delay: number;
  instant: boolean;
  pointer: Pointer;
  depth: number;
}

function ShapeLayer({ shape: item, delay, instant: still, pointer, depth }: ShapeLayerProps) {
  const offset = parallax(pointer, depth);
  return (
    <motion.g
      initial={false}
      animate={{ x: item.x, y: item.y }}
      transition={still ? instant : { ...spring.smooth, delay }}
    >
      <motion.rect
        className={`${styles.shape} ${styles[item.tone]}`}
        style={offset}
        initial={false}
        animate={{
          attrX: -item.w / 2,
          attrY: -item.h / 2,
          width: item.w,
          height: item.h,
          rx: item.r,
          rotate: item.rot,
          opacity: item.o,
        }}
        transition={
          still
            ? instant
            : {
                default: { ...spring.morph, delay },
                opacity: { duration: duration.standard, ease: standardEase, delay },
              }
        }
      />
    </motion.g>
  );
}

interface StrokeLayerProps {
  stroke: Stroke;
  delay: number;
  instant: boolean;
  pointer: Pointer;
}

function StrokeLayer({ stroke: rule, delay, instant: still, pointer }: StrokeLayerProps) {
  const offset = parallax(pointer, 1);
  return (
    <motion.line
      className={`${styles.stroke} ${rule.accent ? styles.accent : ""}`}
      style={offset}
      initial={false}
      animate={{ x1: rule.x1, y1: rule.y1, x2: rule.x2, y2: rule.y2 }}
      transition={still ? instant : { ...spring.smooth, delay }}
    />
  );
}

interface TrailLayerProps {
  points: number[];
  visible: boolean;
  delay: number;
  instant: boolean;
  pointer: Pointer;
}

/** Dotted flight path; the control points are tweened, not the rendered glyph. */
function TrailLayer({ points, visible, delay, instant: still, pointer }: TrailLayerProps) {
  const offset = parallax(pointer, 1);
  const path = useMotionValue(toPath(points));
  const previous = useRef(points);

  useEffect(() => {
    const from = previous.current;
    if (from === points) return;
    if (still) {
      previous.current = points;
      path.set(toPath(points));
      return;
    }
    const controls = animate(0, 1, {
      ...spring.morph,
      delay,
      onUpdate: (progress: number) => {
        previous.current = from.map(
          (value, index) => value + (points[index] - value) * progress,
        );
        path.set(toPath(previous.current));
      },
    });
    return () => controls.stop();
  }, [points, delay, still, path]);

  return (
    <motion.path
      d={path}
      className={`${styles.stroke} ${styles.trail}`}
      style={offset}
      initial={false}
      animate={{ opacity: Number(!!visible) }}
      transition={
        still
          ? instant
          : {
              duration: duration.standard,
              ease: standardEase,
              delay: visible ? delay + 0.06 : 0,
            }
      }
    />
  );
}

interface SceneLayerProps {
  scene: Scene;
  dir: number;
  rushed: boolean;
  instant: boolean;
  pointer: Pointer;
}

function SceneLayer({ scene, dir, rushed, instant: still, pointer }: SceneLayerProps) {
  const count = scene.shapes.length;
  // Rushed navigation drops the per-shape cascade so the new scene lands at once.
  const order = (index: number, total: number) =>
    dir > 0 ? index : total - 1 - index;
  const offset = parallax(pointer, 1);

  return (
    <>
      {scene.shapes.map((item, index) => (
        <ShapeLayer
          key={index}
          shape={item}
          depth={depths[index]}
          delay={rushed ? 0 : 0.03 * order(index, count)}
          instant={still}
          pointer={pointer}
        />
      ))}
      <TrailLayer
        points={scene.curve}
        visible={scene.curveOn}
        delay={0.1 * Number(!rushed)}
        instant={still}
        pointer={pointer}
      />
      {scene.strokes.map((rule, index) => (
        <StrokeLayer
          key={index}
          stroke={rule}
          delay={rushed ? 0 : 0.12 + 0.04 * order(index, 3)}
          instant={still}
          pointer={pointer}
        />
      ))}
      <motion.path
        d="M143 93L155 105L178 80"
        className={`${styles.stroke} ${styles.accent} ${styles.check}`}
        style={offset}
        initial={false}
        animate={{
          pathLength: Number(!!scene.check),
          opacity: Number(!!scene.check),
        }}
        transition={
          still
            ? instant
            : scene.check
              ? {
                  pathLength: {
                    duration: duration.considered,
                    ease: enterEase,
                    delay: rushed ? 0.12 : 0.32,
                  },
                  opacity: { duration: 0.01, delay: rushed ? 0.12 : 0.32 },
                }
              : { duration: duration.fast }
        }
      />
    </>
  );
}

/**
 * Four-step onboarding card: one SVG whose shapes morph between the folder,
 * files, team and badge scenes, with a shared copy slot underneath.
 */
export function OnboardingIllustration() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [nav, setNav] = useState({ dir: 1, rushed: false });
  const movedAt = useRef(0);
  const reduce = useReducedMotion() ?? false;

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const pointer: Pointer = {
    x: useSpring(pointerX, { visualDuration: 0.5, bounce: 0 }),
    y: useSpring(pointerY, { visualDuration: 0.5, bounce: 0 }),
  };

  const scene = scenes[step];
  const copy = done ? finished : steps[step];

  function go(index: number) {
    const next = Math.max(0, Math.min(lastStep, index));
    const now = performance.now();
    setNav({ dir: next >= step ? 1 : -1, rushed: now - movedAt.current < 650 });
    movedAt.current = now;
    setDone(false);
    setStep(next);
  }

  const primary = done
    ? { key: "replay", label: "Replay intro" }
    : step === lastStep
      ? { key: "start", label: "Get started" }
      : { key: "next", label: "Next" };
  const backDisabled = step === 0 || done;

  const enter = reduce
    ? { opacity: 0 }
    : { opacity: 0, y: 6, filter: `blur(${blur.soft}px)` };
  const leave = reduce
    ? { opacity: 0 }
    : { opacity: 0, y: -4, filter: `blur(${blur.soft}px)` };

  return (
    <section
      className={styles.card}
      aria-label="Folio onboarding"
      onKeyDown={event => {
        if (event.key === "ArrowRight" && !done && step < lastStep) {
          event.preventDefault();
          go(step + 1);
        }
        if (event.key === "ArrowLeft" && !done && step > 0) {
          event.preventDefault();
          go(step - 1);
        }
      }}
    >
      <div
        className={styles.stage}
        onPointerMove={event => {
          if (
            reduce ||
            event.pointerType !== "mouse" ||
            !window.matchMedia("(hover: hover)").matches
          ) {
            return;
          }
          const box = event.currentTarget.getBoundingClientRect();
          pointerX.set(((event.clientX - box.left) / box.width - 0.5) * 12);
          pointerY.set(((event.clientY - box.top) / box.height - 0.5) * 8);
        }}
        onPointerLeave={() => {
          pointerX.set(0);
          pointerY.set(0);
        }}
      >
        <svg
          className={styles.art}
          viewBox="0 0 320 200"
          role="img"
          aria-label={scene.label}
        >
          <AnimatePresence initial={false}>
            <motion.g
              key={reduce ? `still-${step}` : "live"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.standard, ease: standardEase }}
            >
              <SceneLayer
                scene={scene}
                dir={nav.dir}
                rushed={nav.rushed}
                instant={reduce}
                pointer={pointer}
              />
            </motion.g>
          </AnimatePresence>
        </svg>
        <AnimatePresence initial={false}>
          {!done && step < lastStep ? (
            <motion.button
              key="skip"
              type="button"
              className={styles.skip}
              onClick={() => go(lastStep)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.fast }}
            >
              Skip
            </motion.button>
          ) : null}
        </AnimatePresence>
      </div>

      <div className={styles.body}>
        <div className={styles.copy} aria-live="polite">
          <AnimatePresence initial={false}>
            <motion.div
              key={copy.id}
              className={styles.copyItem}
              initial={enter}
              animate={{
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                transition: {
                  duration: duration.considered,
                  ease: enterEase,
                  delay: 0.08 * Number(!reduce),
                },
              }}
              exit={{
                ...leave,
                transition: { duration: duration.exit, ease: standardEase },
              }}
            >
              <h2>{copy.title}</h2>
              <p>{copy.body}</p>
              <span className={styles.srOnly}>
                {done ? "Onboarding complete" : `Step ${step + 1} of ${steps.length}`}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={styles.footer}>
          <div className={styles.dots} role="group" aria-label="Onboarding steps">
            {steps.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                className={styles.dot}
                aria-label={`Step ${index + 1}: ${entry.title}`}
                aria-current={index === step ? "step" : undefined}
                onClick={() => go(index)}
              >
                <motion.span
                  className={styles.dotMark}
                  data-state={
                    index === step
                      ? "current"
                      : index < step || done
                        ? "complete"
                        : "upcoming"
                  }
                  initial={false}
                  animate={{ width: index === step ? 20 : 6 }}
                  transition={reduce ? instant : spring.morph}
                />
              </button>
            ))}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.back}
              aria-disabled={backDisabled}
              onClick={() => {
                if (backDisabled) return;
                go(step - 1);
              }}
            >
              <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.backLabel}>Back</span>
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                if (done) go(0);
                else if (step === lastStep) setDone(true);
                else go(step + 1);
              }}
            >
              <AnimatePresence initial={false}>
                <motion.span
                  key={primary.key}
                  className={styles.primaryLabel}
                  initial={enter}
                  animate={{
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                    transition: { duration: duration.standard, ease: enterEase },
                  }}
                  exit={{
                    ...leave,
                    transition: { duration: duration.exit, ease: standardEase },
                  }}
                >
                  {primary.key === "replay" ? (
                    <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
                  ) : null}
                  {primary.label}
                  {primary.key === "next" ? (
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  ) : null}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default OnboardingIllustration;
