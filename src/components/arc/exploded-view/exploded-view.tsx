"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { ArrowDownRight, ChartColumn, Check, CreditCard, House, User, Wifi } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./exploded-view.module.css";

export interface ExplodedLayer {
  /** Stable id, used as the React key. */
  id: string;
  /** Layer name: the floating label, the stop button's name and the caption title. */
  name: string;
  /** Short note under the name on the floating label, e.g. "Semantic tokens". */
  note: string;
  /** One or two sentences describing what the layer does, shown as its caption. */
  body: string;
}

export interface ExplodedEnds {
  /** Caption before the stack separates. */
  start: { title: string; body: string };
  /** Caption after the stack comes back together. */
  end: { title: string; body: string };
}

export interface ExplodedViewProps {
  /** Heading of the section. */
  title?: string;
  /** One or two sentences under the heading. */
  description?: string;
  /** Name, short note and caption for each of the five layers, bottom to top. */
  layers?: readonly ExplodedLayer[];
  /** Captions shown before the stack separates and after it comes back together. */
  ends?: ExplodedEnds;
  /** "container" scrolls inside its own rounded frame, "page" pins to the viewport. */
  scroll?: "container" | "page";
  /** Scroll distance as a multiple of the frame height. */
  length?: number;
  /** Called when the stop under the reading position changes. */
  onStopChange?: (stop: number) => void;
  /** Renders without the block's own surface. The preview frame flattens the frame. */
  flat?: boolean;
  /** Class on the root section. */
  className?: string;
}

/** Sample layer copy for the Tally demo screen, bottom to top. */
export const sampleLayers: readonly ExplodedLayer[] = [
  {
    id: "surface",
    name: "Surface",
    note: "Semantic tokens",
    body: "One neutral base. Every color resolves to a semantic role, so dark mode is a token swap instead of a redesign.",
  },
  {
    id: "grid",
    name: "Layout grid",
    note: "4px rhythm, 16px gutters",
    body: "Four columns and a 4px rhythm put every edge on the same lines, from the header to the tab bar.",
  },
  {
    id: "content",
    name: "Content",
    note: "Tabular figures",
    body: "The balance, the weekly chart and the ledger. Figures are tabular, so a new amount never nudges its neighbours.",
  },
  {
    id: "controls",
    name: "Controls",
    note: "44px targets",
    body: "A segmented control and the tab bar. Each target is at least 44px tall, sized for a thumb rather than a cursor.",
  },
  {
    id: "floating",
    name: "Floating layer",
    note: "The only shadow",
    body: "Notifications sit above everything else, so this is the one layer that earns a shadow.",
  },
];

/** Captions for the assembled screen at either end of the scroll. */
export const sampleEnds: ExplodedEnds = {
  start: { title: "One screen", body: "Scroll to pull it apart, one layer at a time." },
  end: { title: "Back to one screen", body: "Five layers with one job each. That is why nothing on it competes." },
};

const SEGMENTS = ["Week", "Month", "Year"] as const;

const CHART = [
  { day: "M", value: 84 },
  { day: "T", value: 42 },
  { day: "W", value: 118 },
  { day: "T", value: 66 },
  { day: "F", value: 164 },
  { day: "S", value: 212 },
  { day: "S", value: 58 },
] as const;

const CHART_MAX = 212;

const TRANSACTIONS = [
  { id: "t1", name: "Sofia Ramirez", detail: "Dinner split", amount: "+$38.00", incoming: true, photo: "/media/people/sofia-ramirez.svg" },
  { id: "t2", name: "Tavola wine bar", detail: "Food and drink", amount: "-$64.20", incoming: false, photo: "/media/photos/wine-bar.jpg" },
  { id: "t3", name: "Daniel Kim", detail: "Concert tickets", amount: "-$120.00", incoming: false, photo: "/media/people/daniel-kim.svg" },
] as const;

const TABS = [House, ChartColumn, CreditCard, User] as const;

/** Phone art half width and half height, in design px. */
const HALF_W = 140;
/** Half of the art's height, for the fit corners. */
const HALF_H = 310;
/** Height inside the art where the floating label anchors, measured from the centre. */
const LABEL_Y = 266;

const { duration, ease } = motionTokens;
const ENTER = [...ease.enter] as [number, number, number, number];
const EXIT = [...ease.exit] as [number, number, number, number];

interface Geo {
  tiltX: number;
  tiltZ: number;
  gap: number;
}

const GEO_WIDE: Geo = { tiltX: 60, tiltZ: -40, gap: 136 };
const GEO_NARROW: Geo = { tiltX: 62, tiltZ: -20, gap: 150 };

const CORNERS: readonly (readonly [number, number])[] = [
  [-HALF_W, -HALF_H],
  [HALF_W, -HALF_H],
  [HALF_W, HALF_H],
  [-HALF_W, HALF_H],
];

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

/** Eased 0 to 1 ramp between two scroll positions. */
function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Depth of layer `index` at a given spread: a fan from the centre plane, one step per layer. */
const depth = (index: number, spread: number, gap: number) => (index - 2) * spread * gap + 0.5 * index;

/**
 * Projects a point in the untransformed stage onto the rotated, perspective-projected stage.
 * Mirrors the CSS on `.group` (rotateX then rotateZ) and `.perspective` (2400px), in flat space,
 * so labels stay upright while they follow their layer.
 */
function project(x: number, y: number, z: number, tiltX: number, tiltZ: number) {
  const rx = (tiltX * Math.PI) / 180;
  const rz = (tiltZ * Math.PI) / 180;
  const px = x * Math.cos(rz) - y * Math.sin(rz);
  const py = x * Math.sin(rz) + y * Math.cos(rz);
  const yd = py * Math.cos(rx) - z * Math.sin(rx);
  const zd = py * Math.sin(rx) + z * Math.cos(rx);
  const perspective = 2400 / (2400 - zd);
  return { x: px * perspective, y: yd * perspective };
}

interface Metrics {
  /** Stage width and height. */
  sw: number;
  sh: number;
  /** Scale of the assembled screen and of the fully separated stack. */
  s0: number;
  s1: number;
  /** Translation that centres the separated stack, applied at full spread. */
  ox1: number;
  oy1: number;
  geo: Geo;
}

/**
 * A scroll driven exploded view of a product screen: five layers stacked in CSS 3D separate in
 * depth, each one taking focus with a label that follows it, then reassemble.
 */
export function ExplodedView({
  title = "Built in layers",
  description = "Take the Tally home screen apart. Each layer has one job, and together they read as one calm surface.",
  layers = sampleLayers,
  ends = sampleEnds,
  scroll = "container",
  length = 4,
  onStopChange,
  flat = false,
  className,
}: ExplodedViewProps) {
  // Reduced motion is read after hydration so the server and the first client render agree.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const prefersReduced = useReducedMotion();
  const reduced = mounted && !!prefersReduced;

  const headingId = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scalerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const metricsRef = useRef<Metrics | null>(null);
  const stepRef = useRef(0);
  const [step, setStep] = useState(0);

  const onStopChangeRef = useRef(onStopChange);
  useEffect(() => {
    onStopChangeRef.current = onStopChange;
  }, [onStopChange]);

  const { scrollYProgress } = useScroll({
    container: scroll === "container" ? viewportRef : undefined,
    target: trackRef,
    offset: ["start start", "end end"],
  });
  const spring = useSpring(scrollYProgress, { stiffness: 200, damping: 36, mass: 0.6, restDelta: 5e-4 });

  /** Writes the whole stage for one progress value, straight to the DOM. */
  const update = useCallback(
    (progress: number) => {
      const metrics = metricsRef.current;
      if (!metrics) return;

      const next = progress < 0.28 ? 0 : progress >= 0.8 ? 6 : 1 + Math.min(4, Math.floor((progress - 0.28) / 0.104));
      const inFocus = next > 0 && next < 6;
      const tiltMix = reduced ? Number(inFocus) : smoothstep(0.04, 0.22, progress) * (1 - smoothstep(0.84, 0.98, progress));
      const spread = reduced ? Number(inFocus) : smoothstep(0.08, 0.28, progress) * (1 - smoothstep(0.8, 0.95, progress));
      const tiltX = metrics.geo.tiltX * tiltMix;
      const tiltZ = metrics.geo.tiltZ * tiltMix;
      const scale = metrics.s0 + (metrics.s1 - metrics.s0) * tiltMix;
      const ox = metrics.ox1 * tiltMix;
      const oy = metrics.oy1 * tiltMix;

      const scaler = scalerRef.current;
      if (scaler) {
        scaler.style.transform = `translate3d(${ox.toFixed(2)}px, ${oy.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      }
      const group = groupRef.current;
      if (group) {
        group.style.transform = `rotateX(${tiltX.toFixed(3)}deg) rotateZ(${tiltZ.toFixed(3)}deg)`;
        group.style.setProperty("--spread", spread.toFixed(3));
      }

      for (let index = 0; index < 5; index += 1) {
        const z = depth(index, spread, metrics.geo.gap);
        const layer = layerRefs.current[index];
        if (layer) layer.style.transform = `translate3d(0, 0, ${z.toFixed(2)}px)`;

        const anchor = project(HALF_W, LABEL_Y, z, tiltX, tiltZ);
        const x = metrics.sw / 2 + ox + anchor.x * scale;
        const y = metrics.sh / 2 + oy + anchor.y * scale;
        const opacity = reduced ? spread : clamp((spread - 0.45 - 0.07 * index) / 0.22);
        const label = labelRefs.current[index];
        if (label) {
          label.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
          label.style.opacity = opacity.toFixed(3);
          label.style.setProperty("--draw", opacity.toFixed(3));
          label.style.visibility = opacity > 0.001 ? "visible" : "hidden";
        }
      }

      if (next !== stepRef.current) {
        stepRef.current = next;
        setStep(next);
        onStopChangeRef.current?.(next);
      }
    },
    [reduced],
  );

  /** Fits the separated stack to the stage: one measurement, reused every frame. */
  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;

    const labelPad =
      Math.max(
        0,
        ...labelRefs.current.map(label =>
          label?.firstElementChild instanceof HTMLElement ? label.firstElementChild.offsetWidth : 0,
        ),
      ) + 36;
    const geo = width < 560 && height > width ? GEO_NARROW : GEO_WIDE;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let maxRight = -Infinity;

    for (let index = 0; index < 5; index += 1) {
      const z = depth(index, 1, geo.gap);
      maxRight = Math.max(maxRight, project(HALF_W, LABEL_Y, z, geo.tiltX, geo.tiltZ).x);
      for (const [cornerX, cornerY] of CORNERS) {
        const point = project(cornerX, cornerY, z, geo.tiltX, geo.tiltZ);
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
    }

    const cap = 0.94 * width;
    const fit = Math.min(
      (cap - labelPad) / (maxRight - minX),
      cap / (maxX - minX),
      (0.88 * height) / (maxY - minY),
      1.15,
    );
    const assembled = Math.min((0.9 * width) / (HALF_W * 2), (0.9 * height) / (HALF_H * 2), 1.1);

    metricsRef.current = {
      sw: width,
      sh: height,
      s0: assembled,
      s1: Math.max(0.2, fit),
      ox1: -(minX * fit + Math.max(maxX * fit, maxRight * fit + labelPad)) / 2,
      oy1: (-(minY + maxY) / 2) * fit,
      geo,
    };

    update(reduced ? scrollYProgress.get() : spring.get());
  }, [update, reduced, scrollYProgress, spring]);

  useEffect(() => {
    if (reduced) return;
    return spring.on("change", value => {
      update(value);
    });
  }, [spring, reduced, update]);

  useEffect(() => {
    if (!reduced) return;
    return scrollYProgress.on("change", value => {
      spring.jump(value);
      update(value);
    });
  }, [reduced, scrollYProgress, spring, update]);

  useLayoutEffect(() => {
    measure();
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [measure]);

  const focusIndex = step > 0 && step < 6 ? step - 1 : -1;
  const caption =
    step === 0 ? ends.start : step === 6 ? ends.end : { title: layers[focusIndex]?.name ?? "", body: layers[focusIndex]?.body ?? "" };
  const stopLabels = ["Assembled", ...layers.map(layer => layer.name), "Reassembled"];
  const ghosts = [ends.start, ...layers.slice(0, 5).map(layer => ({ title: layer.name, body: layer.body })), ends.end];

  /** Scrolls the frame (or the page) to the middle of a stop's band. */
  const jump = (index: number) => {
    const target = index <= 0 ? 0 : index >= 6 ? 1 : 0.28 + (index - 0.5) * 0.104;
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
    if (scroll === "container") {
      const viewport = viewportRef.current;
      if (!viewport) return;
      viewport.scrollTo({ top: (viewport.scrollHeight - viewport.clientHeight) * target, behavior });
      return;
    }
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + (track.offsetHeight - window.innerHeight) * target, behavior });
  };

  return (
    <section
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-scroll={scroll}
      aria-labelledby={headingId}
    >
      <div
        ref={viewportRef}
        className={styles.viewport}
        tabIndex={scroll === "container" ? 0 : undefined}
        role={scroll === "container" ? "region" : undefined}
        aria-label={scroll === "container" ? `${title}, scroll to separate the layers` : undefined}
        data-frame-flat={flat ? "" : undefined}
        style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
      >
        <div ref={trackRef} className={styles.track} style={{ height: scroll === "page" ? `${100 * length}svh` : `${100 * length}%` }}>
          <div className={styles.sticky}>
            <header className={styles.intro}>
              <h2 id={headingId} className={styles.title}>
                {title}
              </h2>
              <p className={styles.description}>{description}</p>
            </header>

            <div ref={stageRef} className={styles.stage} data-focus={focusIndex >= 0 || undefined} aria-hidden="true">
              <div ref={scalerRef} className={styles.scaler} style={{ transform: "translate3d(0, 0, 0) scale(1)" }}>
                <div className={styles.perspective}>
                  <div ref={groupRef} className={styles.group} style={{ transform: "rotateX(0deg) rotateZ(0deg)" }}>
                    {layers.slice(0, 5).map((layer, index) => (
                      <div
                        key={layer.id}
                        ref={node => {
                          layerRefs.current[index] = node;
                        }}
                        className={styles.layer}
                        data-layer={index}
                        data-active={focusIndex === index || undefined}
                        style={{ transform: "translate3d(0, 0, 0)" }}
                      >
                        <LayerArt index={index} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Labels live in flat stage space, outside the 3D group, so text never tilts. */}
              {layers.slice(0, 5).map((layer, index) => (
                <div
                  key={layer.id}
                  ref={node => {
                    labelRefs.current[index] = node;
                  }}
                  className={styles.label}
                  data-active={focusIndex === index || undefined}
                  style={{ opacity: 0, visibility: "hidden" }}
                >
                  <span className={styles.labelBody}>
                    <span className={styles.labelName}>{layer.name}</span>
                    <span className={styles.labelNote}>{layer.note}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.footer}>
              <div className={styles.caption} aria-live="polite">
                {ghosts.map((item, index) => (
                  <div key={`ghost-${index}`} className={`${styles.captionItem} ${styles.captionGhost}`} aria-hidden="true">
                    <h3 className={styles.captionTitle}>{item.title}</h3>
                    <p className={styles.captionBody}>{item.body}</p>
                  </div>
                ))}
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={step}
                    className={styles.captionItem}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      reduced
                        ? { opacity: 0, transition: { duration: 0 } }
                        : { opacity: 0, y: -8, transition: { duration: duration.exit, ease: EXIT } }
                    }
                    transition={reduced ? { duration: 0 } : { duration: duration.considered, ease: ENTER }}
                  >
                    <h3 className={styles.captionTitle}>{caption.title}</h3>
                    <p className={styles.captionBody}>{caption.body}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className={styles.stops} role="group" aria-label="Jump to a layer">
                {stopLabels.map((label, index) => (
                  <button
                    key={`${label}-${index}`}
                    type="button"
                    className={styles.stopButton}
                    aria-label={label}
                    aria-current={step === index ? "step" : undefined}
                    onClick={() => jump(index)}
                  >
                    <span className={styles.tick} data-kind={index === 0 || index === 6 ? "end" : "layer"} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ol className={styles.srOnly} aria-label="Layers of the screen, bottom to top">
        {layers.map(layer => (
          <li key={layer.id}>
            {layer.name}: {layer.body}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default ExplodedView;

/** The built in Tally screen, split into five layers. */
function LayerArt({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className={styles.plate}>
        <div className={styles.statusBar}>
          <span>9:41</span>
          <span className={styles.island} />
          <span className={styles.statusIcons}>
            <Wifi size={13} strokeWidth={2} />
            <span className={styles.battery}>
              <span />
            </span>
          </span>
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className={styles.sheet}>
        <div className={styles.grid}>
          {[0, 1, 2, 3].map(column => (
            <span key={column} className={styles.column} />
          ))}
          {[52, 148, 208, 352, 548].map(top => (
            <span key={top} className={styles.keyline} style={{ top }} />
          ))}
        </div>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className={styles.sheet}>
        <div className={styles.head}>
          <span>Spending</span>
          <span className={styles.muted}>September</span>
        </div>
        <div className={styles.total}>$2,846.20</div>
        <div className={styles.delta}>
          <ArrowDownRight size={13} strokeWidth={1.75} />
          12% less than August
        </div>
        <div className={styles.chart}>
          {CHART.map((entry, bar) => (
            <span key={bar} className={styles.barCol}>
              <span
                className={styles.bar}
                data-peak={bar === 5 || undefined}
                style={{ height: `${Math.round((entry.value / CHART_MAX) * 92)}px` }}
              />
              <span className={styles.barDay}>{entry.day}</span>
            </span>
          ))}
        </div>
        <div className={styles.recentHead}>
          <span>Recent</span>
          <span className={styles.muted}>See all</span>
        </div>
        <ul className={styles.rows}>
          {TRANSACTIONS.map(row => (
            <li key={row.id} className={styles.row}>
              <img className={styles.thumb} src={row.photo} alt="" width={32} height={32} loading="lazy" decoding="async" />
              <span className={styles.rowText}>
                <span>{row.name}</span>
                <span className={styles.muted}>{row.detail}</span>
              </span>
              <span className={styles.amount} data-in={row.incoming || undefined}>
                {row.amount}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (index === 3) {
    return (
      <div className={styles.sheet}>
        <div className={styles.segment}>
          {SEGMENTS.map(segment => (
            <span key={segment} data-on={segment === "Month" || undefined}>
              {segment}
            </span>
          ))}
        </div>
        <div className={styles.tabBar}>
          {TABS.map((Icon, tab) => (
            <span key={tab} className={styles.tab} data-on={tab === 1 || undefined}>
              <Icon size={20} strokeWidth={1.75} />
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sheet}>
      <div className={styles.toast}>
        <span className={styles.toastMark}>
          <Check size={14} strokeWidth={2} />
        </span>
        <span className={styles.toastText}>
          <span className={styles.toastTitle}>
            Rent paid<span className={styles.muted}>now</span>
          </span>
          <span className={styles.toastBody}>$2,150.00 to Parkside Lofts</span>
        </span>
      </div>
    </div>
  );
}
