"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useTransform, useReducedMotion } from "motion/react";
import { Circle, Hand, MessageSquare, MousePointer2, RotateCcw, Square, Star, StickyNote, Triangle, Type } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import Dock, { type DockItem } from "./dock";
import styles from "./dock.module.css";

export const meta = "Live · component";

type PlacedKind = "rectangle" | "ellipse" | "triangle" | "star" | "text" | "note";
type Tool = PlacedKind | "move" | "hand" | "comment";

interface Placed {
  id: number;
  kind: PlacedKind;
  x: number;
  y: number;
}

interface Pin {
  id: string;
  name: string;
  photo: string;
  text: string;
  x: number;
  y: number;
}

interface DragState {
  id: number;
  x: number;
  y: number;
  from: { x: number; y: number };
  samples: { t: number; x: number; y: number }[];
}

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;
const MEDIA = "/media/specials/dock-";

const SHAPE_MEMBERS: DockItem[] = [
  { id: "rectangle", label: "Rectangle", shortcut: "R", icon: <Square {...ICON} /> },
  { id: "ellipse", label: "Ellipse", shortcut: "O", icon: <Circle {...ICON} /> },
  { id: "triangle", label: "Triangle", icon: <Triangle {...ICON} /> },
  { id: "star", label: "Star", icon: <Star {...ICON} /> },
];

const INITIAL_ITEMS: DockItem[] = [
  { id: "move", label: "Move", shortcut: "V", icon: <MousePointer2 {...ICON} /> },
  { id: "hand", label: "Hand", shortcut: "H", icon: <Hand {...ICON} /> },
  { id: "shapes", label: "Shapes", icon: <Square {...ICON} />, items: SHAPE_MEMBERS },
  { id: "text", label: "Text", shortcut: "T", icon: <Type {...ICON} /> },
  { id: "note", label: "Sticky note", shortcut: "N", icon: <StickyNote {...ICON} /> },
  { id: "comment", label: "Comment", shortcut: "C", icon: <MessageSquare {...ICON} /> },
];

const SHORTCUTS: Record<string, Tool> = { v: "move", h: "hand", r: "rectangle", o: "ellipse", t: "text", n: "note", c: "comment" };

const LABELS: Record<string, string> = Object.fromEntries(
  [...INITIAL_ITEMS, ...SHAPE_MEMBERS].map((item) => [item.id, item.label]),
);

const SHAPE_KINDS = new Set<Tool>(["rectangle", "ellipse", "triangle", "star", "text", "note"]);

const INITIAL_PINS: Pin[] = [
  { id: "sarah", name: "Sarah Mitchell", photo: `${MEDIA}sarah-mitchell.svg`, text: "Lead the deck with this one?", x: 33, y: 13 },
  { id: "marcus", name: "Marcus Reed", photo: `${MEDIA}marcus-reed.svg`, text: "Warmer grade, please", x: 86, y: 15 },
];

/** Pan keeps up with the pointer for the first 120px, then lags: the board feels weighted. */
function friction(value: number) {
  const excess = Math.abs(value) - 120;
  return excess <= 0 ? value : Math.sign(value) * (120 + (80 * excess * 0.55) / (80 + 0.55 * excess));
}

const momentum = (velocity: number) => ((velocity / 1000) * 0.997) / (1 - 0.997);

function statusFor(tool: Tool) {
  return (
    {
      move: "Move is active. Pick a tool from the dock, or press its key.",
      hand: "Drag the board to pan around it.",
      text: "Click the board to add a text label.",
      note: "Click the board to drop a sticky note.",
      comment: "Click the board to leave a comment, or click a pin to resolve it.",
    }[tool as "move" | "hand" | "text" | "note" | "comment"] ?? `Click the board to place a ${LABELS[tool]?.toLowerCase()}.`
  );
}

function ShapeArt({ kind }: { kind: PlacedKind }) {
  switch (kind) {
    case "rectangle":
      return (
        <svg viewBox="0 0 96 64" aria-hidden="true">
          <rect x="1" y="1" width="94" height="62" rx="9" />
        </svg>
      );
    case "ellipse":
      return (
        <svg viewBox="0 0 76 76" aria-hidden="true">
          <circle cx="38" cy="38" r="37" />
        </svg>
      );
    case "triangle":
      return (
        <svg viewBox="0 0 84 74" aria-hidden="true">
          <path d="M37.2 5.1a5.5 5.5 0 0 1 9.6 0l34.5 60.2a5.5 5.5 0 0 1-4.8 8.2H7.5a5.5 5.5 0 0 1-4.8-8.2Z" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 80 77" aria-hidden="true">
          <path d="M37.3 3.3a3 3 0 0 1 5.4 0l9.4 19.1a3 3 0 0 0 2.3 1.6l21 3.1a3 3 0 0 1 1.7 5.1L61.9 47a3 3 0 0 0-.9 2.7l3.6 20.9a3 3 0 0 1-4.4 3.2l-18.8-9.9a3 3 0 0 0-2.8 0l-18.8 9.9a3 3 0 0 1-4.4-3.2L19 49.7a3 3 0 0 0-.9-2.7L2.9 32.2a3 3 0 0 1 1.7-5.1l21-3.1a3 3 0 0 0 2.3-1.6Z" />
        </svg>
      );
    case "text":
      return <>Fall trip, week one</>;
    case "note":
      return <>Book the Lake Agnes tea house</>;
  }
}

/** A board with two photos and two comment pins; the dock drives what a click does. */
export default function DockDemo() {
  const reduced = !!useReducedMotion();
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [tool, setTool] = useState<Tool>("move");
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [pins, setPins] = useState(INITIAL_PINS);

  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  const contentTransform = useTransform(() => `translate3d(${panX.get()}px, ${panY.get()}px, 0)`);
  const [moved, setMoved] = useState(false);
  useMotionValueEvent(panX, "change", (value) => {
    if (!moved && Math.abs(value) > 0.5) setMoved(true);
  });
  useMotionValueEvent(panY, "change", (value) => {
    if (!moved && Math.abs(value) > 0.5) setMoved(true);
  });

  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const ghostTransform = useTransform(() => `translate3d(${cursorX.get()}px, ${cursorY.get()}px, 0)`);
  const [hovering, setHovering] = useState(false);
  const [status, setStatus] = useState(statusFor("move"));

  const counter = useRef(0);
  const drag = useRef<DragState | null>(null);

  const clean = placed.length === 0 && pins.length === INITIAL_PINS.length && !moved && items === INITIAL_ITEMS && tool === "move";
  const dockItems = items.map((item) => (item.id === "comment" ? { ...item, badge: pins.length } : item));
  const ghostVisible = SHAPE_KINDS.has(tool) && hovering;

  function pickTool(next: Tool) {
    setTool(next);
    setStatus(statusFor(next));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    drag.current = null;
    const recent = state.samples.filter((sample) => event.timeStamp - sample.t < 100);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const span = first && last && last.t > first.t && event.timeStamp - last.t < 60 ? (last.t - first.t) / 1000 : 0;
    const vx = span ? (last.x - first.x) / span : 0;
    const vy = span ? (last.y - first.y) / span : 0;
    const fling = (value: typeof panX, velocity: number) => {
      const target = Math.max(-120, Math.min(120, value.get() + momentum(velocity)));
      if (reduced) value.jump(target);
      else animate(value, target, { type: "spring", velocity, stiffness: 170, damping: 26, restDelta: 0.1 });
    };
    fling(panX, vx);
    fling(panY, vy);
  }

  const placedEnter = reduced ? { duration: 0.12 } : motionTokens.spring.snappy;
  const fadeTiming = { duration: reduced ? 0.1 : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] as [number, number, number, number] };
  const placedInitial = reduced ? { opacity: 0 } : { opacity: 0.5, scale: 0.94 };
  const pinInitial = reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 };

  return (
    <div
      className={styles.demo}
      onKeyDown={(event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        if (event.key === "Escape" && selected !== null) {
          setSelected(null);
          return;
        }
        const next = SHORTCUTS[event.key.toLowerCase()];
        if (next) {
          event.preventDefault();
          pickTool(next);
        }
      }}
    >
      <div
        className={styles.board}
        data-tool={tool}
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest("button, [data-dock]")) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left - panX.get()) / rect.width) * 100;
          const y = ((event.clientY - rect.top - panY.get()) / rect.height) * 100;
          if (tool === "hand") {
            if (drag.current) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            panX.stop();
            panY.stop();
            drag.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              from: { x: panX.get(), y: panY.get() },
              samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
            };
            return;
          }
          if (tool === "move") {
            const target = (event.target as Element).closest("[data-object]");
            setSelected(target ? Number(target.getAttribute("data-object")) : null);
            return;
          }
          counter.current += 1;
          if (tool === "comment") {
            setPins((current) => [...current, { id: `you-${counter.current}`, name: "Jake Miller", photo: `${MEDIA}jake-miller.svg`, text: "New comment", x, y }]);
            setStatus("Comment added. Click a pin to resolve it.");
          } else {
            setPlaced((current) => [...current, { id: counter.current, kind: tool, x, y }]);
            setSelected(counter.current);
            setStatus(`Placed a ${LABELS[tool].toLowerCase()}. Back to Move.`);
          }
          setTool("move");
        }}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const overChrome = !!(event.target as Element).closest("[data-dock], button");
          if (event.pointerType === "mouse") {
            cursorX.set(event.clientX - rect.left);
            cursorY.set(event.clientY - rect.top);
            if (hovering !== overChrome) setHovering(!overChrome);
          }
          const state = drag.current;
          if (!state || state.id !== event.pointerId) return;
          panX.set(friction(state.from.x + event.clientX - state.x));
          panY.set(friction(state.from.y + event.clientY - state.y));
          state.samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY });
          if (state.samples.length > 8) state.samples.shift();
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHovering(false)}
      >
        <motion.div className={styles.content} style={{ transform: contentTransform }}>
          <figure className={styles.frame} style={{ left: "8%", top: "12%" }}>
            <span className={styles.photo}>
              <Image src="/media/specials/cover-flow-lake-louise.jpg" alt="Lake Louise under a clear sky" fill sizes="200px" draggable={false} />
            </span>
            <figcaption>Lake Louise, sunrise</figcaption>
          </figure>
          <figure className={styles.frame} style={{ left: "56%", top: "16%" }} data-wide="">
            <span className={styles.photo}>
              <Image src="/media/specials/cover-flow-ocean-beach.jpg" alt="Cliffs above the Pacific at dusk" fill sizes="240px" draggable={false} />
            </span>
            <figcaption>Ocean Beach, dusk</figcaption>
          </figure>
          <AnimatePresence initial={false}>
            {placed.map((object) => (
              <motion.div
                key={object.id}
                className={styles.placed}
                data-kind={object.kind}
                data-object={object.id}
                style={{ left: `${object.x}%`, top: `${object.y}%` }}
                initial={placedInitial}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, transition: fadeTiming }}
                transition={reduced ? { duration: 0.12 } : { ...motionTokens.spring.snappy, opacity: { duration: 0.14 } }}
              >
                <ShapeArt kind={object.kind} />
                <AnimatePresence>
                  {selected === object.id && (
                    <motion.span
                      key="selection"
                      className={styles.placedSelection}
                      aria-hidden="true"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.16, delay: 0.08 * Number(!reduced) }}
                    >
                      <i data-corner="tl" />
                      <i data-corner="tr" />
                      <i data-corner="bl" />
                      <i data-corner="br" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
            {pins.map((pin) => (
              <motion.button
                key={pin.id}
                type="button"
                className={styles.pin}
                data-flip={pin.x > 55 ? "" : undefined}
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                aria-label={`${pin.name}: ${pin.text}. Resolve`}
                initial={pinInitial}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: motionTokens.duration.exit } }}
                transition={placedEnter}
                onClick={() => {
                  setPins((current) => current.filter((entry) => entry.id !== pin.id));
                  setStatus(`Resolved ${pin.id.startsWith("you") ? "your comment" : `${pin.name.split(" ")[0]}'s comment`}.`);
                }}
              >
                <Image src={pin.photo} alt="" width={24} height={24} draggable={false} />
                <span className={styles.bubble}>{pin.text}</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {ghostVisible && (
            <motion.div
              key={tool}
              className={styles.ghost}
              style={{ transform: ghostTransform }}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              transition={fadeTiming}
            >
              <div className={styles.placed} data-kind={tool}>
                <ShapeArt kind={tool as PlacedKind} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!clean && (
            <motion.button
              key="reset"
              type="button"
              className={styles.reset}
              onClick={() => {
                setItems(INITIAL_ITEMS);
                setTool("move");
                setPlaced([]);
                setSelected(null);
                setPins(INITIAL_PINS);
                if (reduced) {
                  panX.jump(0);
                  panY.jump(0);
                } else {
                  animate(panX, 0, motionTokens.spring.smooth);
                  animate(panY, 0, motionTokens.spring.smooth);
                }
                setMoved(false);
                setStatus("Board reset");
              }}
              aria-label="Reset board"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fadeTiming}
            >
              <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
            </motion.button>
          )}
        </AnimatePresence>

        <div className={styles.dock} data-dock="">
          <Dock
            items={dockItems}
            value={tool}
            label="Board tools"
            onValueChange={(id) => pickTool(id as Tool)}
            onItemsChange={(next) => setItems(next.map((item) => INITIAL_ITEMS.find((entry) => entry.id === item.id) ?? item))}
          />
        </div>

        <p className={styles.srOnly} role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  );
}
