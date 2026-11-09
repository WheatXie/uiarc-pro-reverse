"use client";

import {
  forwardRef,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import {
  BuildingComplex,
  ChartLine,
  Check,
  CornerDownLeft,
  FileText,
  Hash,
  Inbox,
  Plug,
  Receipt,
  Search,
  UserPlus,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { motionTokens } from "../lib/motion-tokens";
import { avatar, person, type PersonId } from "../lib/media";
import styles from "./feature-bento.module.css";

/** Which built-in illustration a cell draws. */
export type BentoVisual = "sync" | "command" | "chart" | "flow" | "permissions" | "history";

/** How much of the row a cell takes on wide screens. */
export type BentoSize = "regular" | "wide" | "tall" | "half";

export interface BentoFeature {
  id: string;
  title: string;
  description: string;
  visual: BentoVisual;
  /** Defaults to `"regular"`. */
  size?: BentoSize;
  /** Makes the title a link whose hit area covers the whole cell. */
  href?: string;
}

export interface FeatureBentoProps {
  /** Section heading. */
  title?: string;
  /** One or two sentences under the heading. Pass an empty string to hide it. */
  description?: string;
  /** The cells, in reading order. Six read best. */
  features?: BentoFeature[];
  /** Replaces an illustration by feature id, for your own screenshot or component. */
  visuals?: Partial<Record<string, ReactNode>>;
  /** Extra class on the section. */
  className?: string;
}

export interface FeatureBentoBlockProps {
  /** Drops the card frame around the block so it sits flush in the preview shell. */
  flat?: boolean;
}

const ENTER_EASE = [...motionTokens.ease.enter] as [number, number, number, number];
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

const iconProps = { size: 14, strokeWidth: 1.75, "aria-hidden": true } as const;

/** The default cells: wide, tall, two regular, two half. */
export const bentoFeatures: BentoFeature[] = [
  {
    id: "sync",
    title: "Edit together in real time",
    description: "See who is in the doc, what they selected, and what they are typing.",
    visual: "sync",
    size: "wide",
  },
  {
    id: "command",
    title: "Everything is a keystroke away",
    description: "Jump to any page, person, or setting from one menu.",
    visual: "command",
    size: "tall",
  },
  {
    id: "insights",
    title: "Numbers that explain themselves",
    description: "Weekly trends land right next to the work that moved them.",
    visual: "chart",
  },
  {
    id: "automations",
    title: "Automations that run on their own",
    description: "Route new signups, enrich them, and tell the right channel.",
    visual: "flow",
  },
  {
    id: "permissions",
    title: "Access that fits your team",
    description: "Roles for every workspace, reviewed and changed in one place.",
    visual: "permissions",
    size: "half",
  },
  {
    id: "history",
    title: "Every version, one scrub away",
    description: "Rewind a page to any moment and bring back what you need.",
    visual: "history",
    size: "half",
  },
];

/** The sample strings the illustrations act out. */
export const bentoSamples = {
  doc: {
    title: "Q3 launch plan",
    lines: ["Ship onboarding by", "Pricing review with finance", "Draft the launch post"],
    selected: "Sept 30",
    typed: " for Tuesday",
  },
  commands: ["Invite people", "Invoices", "Integrations", "Insights", "Inbox"],
  chart: {
    label: "Weekly active",
    value: "12,480",
    delta: "+24%",
    bars: [38, 46, 42, 55, 51, 63, 60, 78],
  },
  flow: ["New signup", "Enrich company", "Post to #sales"],
  roles: [
    { name: "Admins", access: "Full access", on: true },
    { name: "Editors", access: "Can edit", on: true },
    { name: "Guests", access: "Can comment", on: false },
  ],
  history: {
    current: "Launch on September 30",
    past: "Launch in early October",
    times: ["9:02", "Now"],
    viewing: "Viewing 10:14",
  },
} as const;

const COMMAND_ICONS: LucideIcon[] = [UserPlus, Receipt, Plug, ChartLine, Inbox];
const FLOW_ICONS: LucideIcon[] = [Zap, BuildingComplex, Hash];
const FACE_IDS: PersonId[] = ["emma-collins", "marcus-johnson", "sofia-ramirez"];

function SyncVisual() {
  const { doc } = bentoSamples;
  const emma = person("emma-collins");
  const marcus = person("marcus-johnson");

  return (
    <div className={styles.doc}>
      <div className={styles.docHead}>
        <FileText {...iconProps} />
        <span className={styles.docTitle}>{doc.title}</span>
        <span className={styles.faces}>
          {FACE_IDS.map(id => (
            <img key={id} src={avatar(id)} alt="" width={20} height={20} />
          ))}
        </span>
      </div>
      <p className={styles.line}>
        {doc.lines[0]}{" "}
        <span className={styles.selection}>
          <span className={styles.selectionFill} />
          <span className={styles.selectionText}>{doc.selected}</span>
          <span className={styles.cursorTrack}>
            <span className={styles.cursor} style={{ "--who": "var(--series-1)" } as CSSProperties}>
              <svg viewBox="0 0 12 14" aria-hidden="true">
                <path d="M1 1l10 5.2-4.4 1.3L4.4 12z" />
              </svg>
              <span className={styles.tag}>{emma.name.split(" ")[0]}</span>
            </span>
          </span>
        </span>
      </p>
      <p className={styles.line}>{doc.lines[1]}</p>
      <p className={styles.line}>
        {doc.lines[2]}
        <span className={styles.typed} style={{ "--chars": doc.typed.length } as CSSProperties}>
          {doc.typed}
        </span>
        <span className={styles.caret} style={{ "--who": "var(--series-3)" } as CSSProperties}>
          <span className={styles.tag}>{marcus.name.split(" ")[0]}</span>
        </span>
      </p>
    </div>
  );
}

function CommandVisual() {
  return (
    <div className={styles.palette}>
      <div className={styles.paletteSearch}>
        <Search {...iconProps} />
        <span className={styles.query}>
          in
          <span className={styles.queryTyped}>t</span>
        </span>
        <span className={styles.paletteCaret} />
      </div>
      <ul className={styles.commands}>
        <li className={styles.commandHighlight} aria-hidden="true" />
        {bentoSamples.commands.map((command, index) => {
          const Icon = COMMAND_ICONS[index % COMMAND_ICONS.length];
          return (
            <li
              key={command}
              className={styles.command}
              data-target={index === 2 ? "" : undefined}
              data-first={index === 0 ? "" : undefined}
            >
              <Icon {...iconProps} />
              {command}
            </li>
          );
        })}
      </ul>
      <div className={styles.paletteFoot}>
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> Move
        </span>
        <span>
          <kbd className={styles.enterKey}>
            <CornerDownLeft size={11} strokeWidth={2} aria-hidden="true" />
          </kbd>{" Open"}
        </span>
      </div>
    </div>
  );
}

function ChartVisual() {
  const { chart } = bentoSamples;
  const last = chart.bars.length - 1;

  return (
    <div className={styles.chart}>
      <div className={styles.chartHead}>
        <span>{chart.label}</span>
        <strong>{chart.value}</strong>
      </div>
      <div className={styles.bars}>
        {chart.bars.map((height, index) => (
          <span
            key={index}
            className={styles.bar}
            data-last={index === last ? "" : undefined}
            style={{ "--h": `${height}%`, "--i": index } as CSSProperties}
          />
        ))}
        <span className={styles.barTip} style={{ "--h": `${chart.bars[last]}%` } as CSSProperties}>
          {chart.delta}
        </span>
      </div>
    </div>
  );
}

function FlowVisual() {
  return (
    <ol className={styles.flow}>
      <li className={styles.flowLine} aria-hidden="true">
        <span className={styles.flowFill} />
      </li>
      {bentoSamples.flow.map((step, index) => {
        const Icon = FLOW_ICONS[index % FLOW_ICONS.length];
        return (
          <li key={step} className={styles.flowStep} style={{ "--i": index } as CSSProperties}>
            <span className={styles.flowIcon}>
              <Icon {...iconProps} />
            </span>
            <span className={styles.flowLabel}>{step}</span>
            <span className={styles.flowCheck}>
              <Check size={12} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PermissionsVisual() {
  return (
    <div className={styles.rolesWrap}>
      <div className={styles.roles}>
        {bentoSamples.roles.map(role => (
          <div key={role.name} className={styles.role} data-flips={role.on ? undefined : ""}>
            <span className={styles.roleText}>
              <span>{role.name}</span>
              <span>{role.access}</span>
            </span>
            <span className={styles.switch} data-on={role.on ? "" : undefined}>
              <span className={styles.thumb} />
            </span>
          </div>
        ))}
      </div>
      <span className={styles.saved}>
        <Check size={12} strokeWidth={2.5} aria-hidden="true" />
        Saved
      </span>
    </div>
  );
}

function HistoryVisual() {
  const { history } = bentoSamples;

  return (
    <div className={styles.history}>
      <div className={styles.historyHead}>
        <span className={styles.swap}>
          <span data-now="">Current version</span>
          <span data-past="">{history.viewing}</span>
        </span>
      </div>
      <p className={styles.historyText}>
        <span className={styles.swap}>
          <span data-now="">{history.current}</span>
          <span data-past="">{history.past}</span>
        </span>
      </p>
      <div className={styles.track}>
        {[0, 1, 2, 3, 4, 5].map(tick => (
          <span key={tick} className={styles.tick} style={{ "--x": `${20 * tick}%` } as CSSProperties} />
        ))}
        <span className={styles.trackFill} />
        <span className={styles.thumbTrack}>
          <span className={styles.scrub} />
        </span>
      </div>
      <div className={styles.times}>
        <span>{history.times[0]}</span>
        <span>{history.times[1]}</span>
      </div>
    </div>
  );
}

const VISUALS: Record<BentoVisual, () => ReactNode> = {
  sync: SyncVisual,
  command: CommandVisual,
  chart: ChartVisual,
  flow: FlowVisual,
  permissions: PermissionsVisual,
  history: HistoryVisual,
};

function subscribeFinePointer(onChange: () => void) {
  const query = window.matchMedia(FINE_POINTER);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

interface CellProps {
  feature: BentoFeature;
  index: number;
  custom?: ReactNode;
  fine: boolean;
  reduced: boolean;
}

function Cell({ feature, index, custom, fine, reduced }: CellProps) {
  const ref = useRef<HTMLLIElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.4 });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const Visual = VISUALS[feature.visual];

  return (
    <motion.li
      ref={ref}
      className={styles.cell}
      data-size={feature.size ?? "regular"}
      data-visual={feature.visual}
      data-seen={seen ? "" : undefined}
      data-on={hovered || focused || (!fine && seen) ? "" : undefined}
      onPointerEnter={event => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      initial={!reduced && { opacity: 0, y: 14 }}
      animate={seen || reduced ? { opacity: 1, y: 0 } : undefined}
      transition={{
        duration: motionTokens.duration.considered,
        ease: ENTER_EASE,
        delay: (index % 3) * motionTokens.stagger.line,
      }}
    >
      <div className={styles.visual} aria-hidden="true">
        {custom ?? (Visual ? <Visual /> : null)}
      </div>
      <div className={styles.copy}>
        <h3 className={styles.cellTitle}>
          {feature.href ? (
            <a href={feature.href} className={styles.cellLink}>
              {feature.title}
            </a>
          ) : (
            feature.title
          )}
        </h3>
        <p className={styles.cellText}>{feature.description}</p>
      </div>
    </motion.li>
  );
}

/**
 * A six cell feature grid in varied sizes. Each cell pairs a short title and sentence with a small
 * piece of real product UI that acts the feature out: hovering with a mouse (or focusing a linked
 * cell) plays the illustration, and touch screens play each cell once when it scrolls into view.
 * Cells rise 14px and fade in as they enter view, staggered by column, and only transform and
 * opacity animate. Reduced motion jumps straight to each end state.
 */
export const FeatureBento = forwardRef<HTMLElement, FeatureBentoProps>(function FeatureBento(
  {
    title = "Built for the way teams actually work",
    description = "Fast, shared, and quietly automatic. Everything your team needs to plan, ship, and look back.",
    features = bentoFeatures,
    visuals,
    className,
  },
  ref,
) {
  const uid = useId();
  const reduced = !!useReducedMotion();
  const fine = useSyncExternalStore(
    subscribeFinePointer,
    () => window.matchMedia(FINE_POINTER).matches,
    () => true,
  );

  return (
    <section ref={ref} className={[styles.bento, className].filter(Boolean).join(" ")} aria-labelledby={`${uid}-title`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 id={`${uid}-title`} className={styles.title}>
            {title}
          </h2>
          {description && <p className={styles.description}>{description}</p>}
        </header>
        <ul className={styles.grid}>
          {features.map((feature, index) => (
            <Cell
              key={feature.id}
              feature={feature}
              index={index}
              custom={visuals?.[feature.id]}
              fine={fine}
              reduced={reduced}
            />
          ))}
        </ul>
      </div>
    </section>
  );
});

FeatureBento.displayName = "FeatureBento";

/** The block: the bento inside the card the frame page renders, flat by default. */
export function FeatureBentoBlock({ flat = true }: FeatureBentoBlockProps) {
  return (
    <div
      className={styles.frame}
      data-frame-flat={flat ? "" : undefined}
      style={
        flat
          ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" }
          : undefined
      }
    >
      <FeatureBento />
    </div>
  );
}

export default FeatureBentoBlock;
