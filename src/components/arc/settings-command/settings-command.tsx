"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RefObject } from "react";
import { AnimatePresence, animate, LayoutGroup, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { MotionValue, Transition } from "motion/react";
import {
  Bell,
  CornerDownLeft,
  CreditCard,
  Palette as PaletteIcon,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Button } from "../button/button";
import { Select } from "../select/select";
import SegmentedControl from "../segmented-control/segmented-control";
import { Switch } from "../switch/switch";
import { TextMorph } from "../text-morph/text-morph";
import { motionTokens } from "../lib/motion-tokens";
import {
  savedSettings,
  settingDefinitions,
  settingsSections,
  suggestedSettingIds,
} from "./settings-command-data";
import styles from "./settings-command.module.css";

export type SettingKind = "text" | "segmented" | "select" | "switch";

export interface SettingOption {
  value: string;
  label: string;
}

export interface SettingsSection {
  id: string;
  label: string;
  description: string;
}

export interface SettingDefinition {
  id: string;
  section: string;
  label: string;
  description: string;
  kind: SettingKind;
  options?: SettingOption[];
  prefix?: string;
  placeholder?: string;
  keywords?: string[];
}

export type SettingsValues = Record<string, string | boolean>;

export interface SettingsCommandProps {
  /** Sections in page order: id, label, and a one line description. */
  sections?: SettingsSection[];
  /** Every setting: id, section, label, description, kind, options, keywords, placeholder, prefix. */
  settings?: SettingDefinition[];
  /** Saved values keyed by setting id. Edits are compared against these to count unsaved changes. */
  defaultValues?: SettingsValues;
  /** Setting ids listed in the palette before anything is typed. */
  suggested?: string[];
  /** Persists the draft. Resolve to confirm; reject to keep the bar open with Retry. */
  onSave?: (values: SettingsValues, changedIds: string[]) => Promise<void> | void;
  /** Called on every edit with the full draft. */
  onValuesChange?: (values: SettingsValues) => void;
  /** Heading beside the search field. */
  title?: string;
  /** Class on the root. */
  className?: string;
}

interface SearchResult {
  def: SettingDefinition;
  score: number;
  match: [number, number] | null;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Closing {
  to: Rect;
  mode: "trigger" | "row";
}

type BarState = "edit" | "saving" | "saved" | "failed";
type SaveStatus = "idle" | "saving" | "saved" | "failed";

const sectionIcons: Record<string, LucideIcon> = {
  general: SlidersHorizontal,
  appearance: PaletteIcon,
  notifications: Bell,
  security: ShieldCheck,
  members: Users,
  billing: CreditCard,
};

const easeEnter: [number, number, number, number] = [...motionTokens.ease.enter] as [
  number,
  number,
  number,
  number,
];
const flight: Transition = { type: "spring", visualDuration: 0.46, bounce: 0.1 };
const blur = (px: number) => `blur(${px}px)`;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Highlight({ text, match }: { text: string; match: [number, number] | null }) {
  if (!match) return <>{text}</>;
  return (
    <>
      {text.slice(0, match[0])}
      <mark className={styles.mark}>{text.slice(match[0], match[1])}</mark>
      {text.slice(match[1])}
    </>
  );
}

function rectOf(element: Element, frame: Element): Rect {
  const a = element.getBoundingClientRect();
  const b = frame.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, width: a.width, height: a.height };
}

function searchSettings(settings: SettingDefinition[], sections: SettingsSection[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const tokens = needle.split(/\s+/);
  const sectionLabels = new Map(sections.map((section) => [section.id, section.label.toLowerCase()]));
  return settings
    .flatMap((def) => {
      const label = def.label.toLowerCase();
      const haystack = [label, def.description.toLowerCase(), sectionLabels.get(def.section) ?? "", ...(def.keywords ?? [])].join(" ");
      if (!tokens.every((token) => haystack.includes(token))) return [];
      let score = 0;
      if (label.startsWith(needle)) score += 8;
      else if (label.includes(needle)) score += 5;
      for (const token of tokens) {
        if (label.split(/\s+/).some((word) => word.startsWith(token))) score += 3;
        else if (def.keywords?.some((word) => word.startsWith(token))) score += 2;
        else score += 0.5;
      }
      const full = label.indexOf(needle);
      const first = label.indexOf(tokens[0]);
      const match: [number, number] | null =
        full >= 0 ? [full, full + needle.length] : first >= 0 ? [first, first + tokens[0].length] : null;
      return [{ def, score, match }];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

interface PaletteProps {
  uid: string;
  origin: Rect;
  frameWidth: number;
  closing: Closing | null;
  onClosed: () => void;
  query: string;
  onQuery: (value: string) => void;
  results: SearchResult[];
  suggestions: SearchResult[];
  active: number;
  onActive: (index: number) => void;
  onPick: (result: SearchResult) => void;
  onClose: () => void;
  reduce: boolean;
}

function Palette({
  uid,
  origin,
  frameWidth,
  closing,
  onClosed,
  query,
  onQuery,
  results,
  suggestions,
  active,
  onActive,
  onPick,
  onClose,
  reduce,
}: PaletteProps) {
  const target = useMemo(() => {
    const width = Math.min(560, frameWidth - 24);
    return { x: (frameWidth - width) / 2, y: 12, width };
  }, [frameWidth]);
  const x = useMotionValue(reduce ? target.x : origin.x);
  const y = useMotionValue(reduce ? target.y : origin.y);
  const width = useMotionValue(reduce ? target.width : origin.width);
  const height = useMotionValue(origin.height);
  const radius = useMotionValue(reduce ? 14 : 10);
  const opacity = useMotionValue(reduce ? 0 : 1);
  const bodyOpacity = useMotionValue(0);

  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const options = query.trim() ? results : suggestions;

  useLayoutEffect(() => {
    if (closing) return;
    const element = contentRef.current;
    if (!element) return;
    const measure = (initial: boolean) => {
      const next = element.offsetHeight;
      if (reduce) {
        x.jump(target.x);
        y.jump(target.y);
        width.jump(target.width);
        height.jump(next);
        radius.jump(14);
        return;
      }
      animate(x, target.x, flight);
      animate(y, target.y, flight);
      animate(width, target.width, flight);
      animate(height, next, initial ? flight : motionTokens.spring.smooth);
      animate(radius, 14, flight);
    };
    measure(true);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(element);
    return () => observer.disconnect();
  }, [closing, reduce, target, x, y, width, height, radius]);

  useEffect(() => {
    if (closing) return;
    animate(opacity, 1, { duration: reduce ? motionTokens.duration.fast : 0 });
    animate(bodyOpacity, 1, {
      duration: reduce ? motionTokens.duration.fast : motionTokens.duration.standard,
      delay: reduce ? 0 : 0.06,
      ease: easeEnter,
    });
  }, [bodyOpacity, closing, reduce, opacity]);

  useEffect(() => {
    if (!closing) return;
    if (reduce) {
      const controls = animate(opacity, 0, { duration: motionTokens.duration.fast });
      controls.then(onClosed);
      return () => controls.stop();
    }
    const { to, mode } = closing;
    animate(bodyOpacity, 0, { duration: motionTokens.duration.instant });
    const spring = mode === "row" ? flight : motionTokens.spring.smooth;
    animate(x, to.x, spring);
    animate(y, to.y, spring);
    animate(width, to.width, spring);
    animate(height, to.height, spring);
    animate(radius, 10, spring);
    const fade = animate(opacity, 0, mode === "row" ? { duration: 0.22, delay: 0.2 } : { duration: 0.1, delay: 0.24 });
    fade.then(onClosed);
    return () => fade.stop();
  }, [bodyOpacity, closing, height, onClosed, opacity, radius, reduce, width, x, y]);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
    }
  }, [active]);

  const resultsId = `${uid}-results`;

  return (
    <motion.div
      className={styles.palette}
      role="dialog"
      aria-modal="true"
      aria-label="Search settings"
      style={{ x, y, width, height, borderRadius: radius, opacity }}
    >
      <div ref={contentRef} className={styles.paletteContent} style={{ width: target.width }}>
        <div className={styles.paletteField}>
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              onQuery(event.target.value);
              onActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (options.length) {
                  onActive((active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
                }
              } else if (event.key === "Enter") {
                event.preventDefault();
                if (options[active]) onPick(options[active]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              } else if (event.key === "Tab") {
                event.preventDefault();
              }
            }}
            placeholder="Search settings"
            role="combobox"
            aria-expanded="true"
            aria-controls={resultsId}
            aria-autocomplete="list"
            aria-activedescendant={options[active] ? `${uid}-option-${options[active].def.id}` : undefined}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>
        <motion.div className={styles.paletteBody} style={{ opacity: bodyOpacity }}>
          {!query.trim() && <p className={styles.paletteHint}>Suggested</p>}
          {options.length ? (
            <LayoutGroup id={`${uid}-palette`}>
              <ul ref={listRef} id={resultsId} role="listbox" aria-label="Matching settings" className={styles.results}>
                {options.map((option, index) => {
                  const Icon = sectionIcons[option.def.section] ?? SlidersHorizontal;
                  const selected = index === active;
                  return (
                    <li
                      key={option.def.id}
                      id={`${uid}-option-${option.def.id}`}
                      data-index={index}
                      role="option"
                      aria-selected={selected}
                      className={styles.result}
                      onPointerMove={() => {
                        if (!selected) onActive(index);
                      }}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => onPick(option)}
                    >
                      {selected && (
                        <motion.span
                          className={styles.resultHighlight}
                          layoutId="active"
                          transition={reduce ? { duration: 0 } : motionTokens.spring.snappy}
                          aria-hidden="true"
                        />
                      )}
                      <Icon size={15} aria-hidden="true" />
                      <span className={styles.resultText}>
                        <span className={styles.resultLabel}>
                          <Highlight text={option.def.label} match={option.match} />
                        </span>
                        <span className={styles.resultDescription}>{option.def.description}</span>
                      </span>
                      <span className={styles.resultEnd} aria-hidden="true">
                        {selected ? <CornerDownLeft size={14} /> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </LayoutGroup>
          ) : (
            <p className={styles.empty} role="status">
              No settings match “{query.trim()}”
            </p>
          )}
          <div className={styles.paletteFoot} aria-hidden="true">
            <span>
              <kbd className={styles.kbd}>↑</kbd>
              <kbd className={styles.kbd}>↓</kbd> Move
            </span>
            <span>
              <kbd className={styles.kbd}>↵</kbd> Jump to setting
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

interface ControlProps {
  def: SettingDefinition;
  id: string;
  value: string | boolean;
  error?: string;
  onChange: (value: string | boolean) => void;
  labelId: string;
}

function Control({ def, id, value, error, onChange, labelId }: ControlProps) {
  const describedBy = `${id}-hint${error ? ` ${id}-error` : ""}`;
  if (def.kind === "switch") {
    return (
      <Switch
        id={id}
        checked={value === true}
        onCheckedChange={onChange}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
      />
    );
  }
  if (def.kind === "segmented") {
    return (
      <div className={styles.segmented}>
        <SegmentedControl
          options={def.options ?? []}
          value={String(value)}
          onValueChange={onChange}
          label={def.label}
        />
      </div>
    );
  }
  if (def.kind === "select") {
    return (
      <div className={styles.select}>
        <Select
          id={id}
          label={def.label}
          className={styles.selectTrigger}
          value={String(value)}
          options={def.options ?? []}
          onValueChange={onChange}
        />
      </div>
    );
  }
  return (
    <span className={styles.text} data-invalid={error ? "" : undefined}>
      {def.prefix && (
        <span className={styles.prefix} aria-hidden="true">
          {def.prefix}
        </span>
      )}
      <input
        id={id}
        value={String(value)}
        placeholder={def.placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        spellCheck={false}
        autoComplete="off"
      />
    </span>
  );
}

interface RowProps {
  def: SettingDefinition;
  uid: string;
  value: string | boolean;
  dirty: boolean;
  error?: string;
  pulse: number;
  onChange: (value: string | boolean) => void;
  rowRef: (node: HTMLDivElement | null) => void;
}

function Row({ def, uid, value, dirty, error, pulse, onChange, rowRef }: RowProps) {
  const reduce = useReducedMotion();
  const id = `${uid}-${def.id}`;
  const labelId = `${id}-label`;
  const pulseClass = pulse ? (pulse % 2 ? styles.pulseA : styles.pulseB) : "";
  return (
    <div
      ref={rowRef}
      className={`${styles.row} ${def.kind === "text" ? styles.rowWide : ""} ${pulseClass}`}
      data-setting={def.id}
      data-kind={def.kind}
    >
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>
          <label id={labelId} htmlFor={def.kind === "segmented" || def.kind === "select" ? undefined : id}>
            {def.label}
          </label>
          <AnimatePresence initial={false}>
            {dirty && (
              <motion.span
                className={styles.dirty}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={reduce ? { duration: 0 } : motionTokens.spring.snappy}
              >
                <span className={styles.srOnly}>Edited</span>
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <p id={`${id}-hint`}>{def.description}</p>
        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              id={`${id}-error`}
              className={styles.error}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div className={styles.rowControl}>
        <Control def={def} id={id} value={value} error={error} onChange={onChange} labelId={labelId} />
      </div>
    </div>
  );
}

interface SaveBarProps {
  state: BarState;
  count: number;
  invalid: boolean;
  onDiscard: () => void;
  onSave: () => void;
  shake: MotionValue<number>;
  barRef: RefObject<HTMLDivElement | null>;
}

function SaveBar({ state, count, invalid, onDiscard, onSave, shake, barRef }: SaveBarProps) {
  const reduce = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const width = useMotionValue(44);
  const height = useMotionValue(44);
  const phase = state === "saved" ? "saved" : "edit";

  useLayoutEffect(() => {
    const element = contentRef.current?.querySelector<HTMLElement>(`[data-phase="${phase}"]`);
    if (!element) return;
    const measure = () => {
      const next = { width: element.offsetWidth + 2, height: element.offsetHeight + 2 };
      if (reduce) {
        width.jump(next.width);
        height.jump(next.height);
        return;
      }
      animate(width, next.width, motionTokens.spring.morph);
      animate(height, next.height, motionTokens.spring.morph);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [height, phase, reduce, width]);

  const content =
    reduce
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        }
      : {
          initial: { opacity: 0, filter: blur(motionTokens.blur.soft) },
          animate: { opacity: 1, filter: blur(0) },
          exit: { opacity: 0, filter: blur(motionTokens.blur.soft) },
        };
  const contentTransition: Transition = {
    duration: reduce ? motionTokens.duration.instant : motionTokens.duration.standard,
    ease: easeEnter,
  };

  return (
    <motion.div
      ref={barRef}
      className={styles.bar}
      role="group"
      aria-label={state === "saved" ? "Save status" : "Unsaved changes"}
      style={{ width, height, x: shake }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, filter: blur(motionTokens.blur.soft) }}
      animate={{ opacity: 1, y: 0, filter: blur(0) }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: motionTokens.duration.instant } }
          : {
              opacity: 0,
              y: 16,
              width: 44,
              height: 44,
              filter: blur(motionTokens.blur.soft),
              transition: {
                width: motionTokens.spring.smooth,
                height: motionTokens.spring.smooth,
                y: { ...motionTokens.spring.smooth, delay: 0.06 },
                opacity: { duration: motionTokens.duration.exit, delay: 0.1 },
                filter: { duration: motionTokens.duration.exit, delay: 0.1 },
              },
            }
      }
      transition={
        reduce
          ? { duration: motionTokens.duration.instant }
          : {
              y: motionTokens.spring.smooth,
              opacity: { duration: motionTokens.duration.fast },
              filter: { duration: motionTokens.duration.standard },
            }
      }
    >
      <div ref={contentRef} className={styles.barContent}>
        <AnimatePresence initial={false}>
          {state === "saved" ? (
            <motion.div key="saved" data-phase="saved" className={styles.barSaved} {...content} transition={contentTransition}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <motion.path
                  d="M5 12.5 9.5 17 19 7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: reduce ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { duration: 0.32, delay: 0.08, ease: easeEnter }
                  }
                />
              </svg>
              <span>Settings saved</span>
            </motion.div>
          ) : (
            <motion.div key="edit" data-phase="edit" className={styles.barEdit} {...content} transition={contentTransition}>
              <span className={styles.barCount}>
                {state === "failed" ? (
                  <span className={styles.barFailed}>Could not save</span>
                ) : invalid ? (
                  <span className={styles.barFailed}>Fix the highlighted field</span>
                ) : (
                  <>
                    <span className={styles.inherit}>
                      <AnimatedCounter value={count} />
                    </span>
                    {"\u00a0"}
                    <span className={styles.long}>unsaved&nbsp;</span>
                    <TextMorph>{count === 1 ? "change" : "changes"}</TextMorph>
                  </>
                )}
              </span>
              <Button type="button" variant="ghost" size="sm" disabled={state === "saving"} onClick={onDiscard}>
                Discard
              </Button>
              <Button type="button" size="sm" loading={state === "saving"} onClick={onSave}>
                {state === "saving" ? "Saving" : state === "failed" ? "Retry" : "Save"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function SettingsCommand({
  sections = settingsSections,
  settings = settingDefinitions,
  defaultValues = savedSettings,
  suggested = suggestedSettingIds,
  onSave,
  onValuesChange,
  title = "Settings",
  className,
}: SettingsCommandProps) {
  const uid = useId().replace(/:/g, "");
  const reduce = Boolean(useReducedMotion());
  const [saved, setSaved] = useState<SettingsValues>(defaultValues);
  const [draft, setDraft] = useState<SettingsValues>(defaultValues);
  const [section, setSection] = useState(sections[0]?.id ?? "general");
  const [origin, setOrigin] = useState<{ origin: Rect } | null>(null);
  const [closing, setClosing] = useState<Closing | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pulse, setPulse] = useState({ id: "", tick: 0 });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [live, setLive] = useState("");

  const frameRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLDivElement>());
  const sectionNodes = useRef(new Map<string, HTMLElement>());
  const timers = useRef(new Set<number>());
  const raf = useRef(0);
  const shake = useMotionValue(0);

  const dirty = settings.filter((setting) => draft[setting.id] !== saved[setting.id]).map((setting) => setting.id);

  const errors = useMemo(() => {
    const entry = (def: SettingDefinition, value: string | boolean) => {
      if (typeof value !== "string") return undefined;
      const text = value.trim();
      if (def.id === "workspace-name" && !text) return "Enter a workspace name";
      if (def.id === "workspace-url" && !/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/.test(text)) {
        return "Use 3 to 32 lowercase letters, numbers, or dashes";
      }
      if (def.id === "billing-email" && !emailPattern.test(text)) return "Enter a valid email address";
      if (def.id === "domains" && text && !text.split(/[\s,]+/).filter(Boolean).every((part) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(part))) {
        return "Separate domains with commas, like northwind.studio";
      }
      return undefined;
    };
    return Object.fromEntries(
      settings.flatMap((def) => {
        const message = entry(def, draft[def.id]);
        return message ? [[def.id, message] as const] : [];
      }),
    ) as Record<string, string>;
  }, [draft, settings]);

  const firstInvalid = settings.find((setting) => errors[setting.id]);

  const results = useMemo(() => searchSettings(settings, sections, query), [query, sections, settings]);

  const suggestions = useMemo(
    () =>
      suggested.flatMap((id) => {
        const def = settings.find((setting) => setting.id === id);
        return def ? [{ def, score: 0, match: null }] : [];
      }),
    [settings, suggested],
  );

  const barState: BarState | null =
    status === "saving"
      ? "saving"
      : status === "failed" && dirty.length
        ? "failed"
        : dirty.length
          ? "edit"
          : status === "saved"
            ? "saved"
            : null;

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((id) => window.clearTimeout(id));
      cancelAnimationFrame(raf.current);
    };
  }, []);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () => setFrameWidth(element.offsetWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (barState === "edit" || barState === "saving" || barState === "failed") return;
    if (barRef.current?.contains(document.activeElement)) triggerRef.current?.focus({ preventScroll: true });
  }, [barState]);

  const later = useCallback((fn: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, delay);
    timers.current.add(id);
  }, []);

  function open() {
    if (!frameRef.current || !triggerRef.current) return;
    setQuery("");
    setActive(0);
    setClosing(null);
    setOrigin((current) => current ?? { origin: rectOf(triggerRef.current as HTMLButtonElement, frameRef.current as HTMLDivElement) });
  }

  function close() {
    if (!frameRef.current || !triggerRef.current) return;
    setClosing({ to: rectOf(triggerRef.current, frameRef.current), mode: "trigger" });
    later(() => triggerRef.current?.focus({ preventScroll: true }), reduce ? 0 : 200);
  }

  function jump(id: string, focus: boolean) {
    const scroller = scrollerRef.current;
    const row = rows.current.get(id);
    const frame = frameRef.current;
    if (!scroller || !row || !frame) return null;
    const top = Math.max(0, Math.min(row.offsetTop - 0.28 * scroller.clientHeight, scroller.scrollHeight - scroller.clientHeight));
    scroller.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    const frameRect = rectOf(scroller, frame);
    later(() => setPulse((current) => ({ id, tick: current.tick + 1 })), reduce ? 0 : 280);
    if (focus) later(() => row.querySelector<HTMLElement>("input, button")?.focus({ preventScroll: true }), reduce ? 0 : 480);
    return {
      x: frameRect.x + row.offsetLeft - 12,
      y: frameRect.y + row.offsetTop - top,
      width: row.offsetWidth + 24,
      height: row.offsetHeight,
    };
  }

  const clearPalette = useCallback(() => {
    setOrigin(null);
    setClosing(null);
  }, []);

  const grouped = useMemo(
    () =>
      sections.map((entry) => ({
        section: entry,
        defs: settings.filter((setting) => setting.section === entry.id),
      })),
    [sections, settings],
  );

  return (
    <div
      className={`${styles.root} ${className ?? ""}`}
      onKeyDown={(event) => {
        if (origin && !closing) return;
        const target = event.target as HTMLElement;
        const inField = target.closest("input, textarea");
        if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") || (event.key === "/" && !inField)) {
          event.preventDefault();
          open();
        }
      }}
    >
      <div ref={frameRef} className={styles.frame}>
        <header className={styles.header}>
          <h2>{title}</h2>
          <div className={styles.triggerSlot}>
            <button
              ref={triggerRef}
              type="button"
              className={styles.trigger}
              data-hidden={origin ? "" : undefined}
              onClick={open}
              aria-haspopup="dialog"
              aria-keyshortcuts="Meta+K Control+K /"
            >
              <Search size={15} aria-hidden="true" />
              <span>Search settings</span>
              <kbd className={styles.kbd} aria-hidden="true">
                ⌘K
              </kbd>
            </button>
          </div>
        </header>
        <nav className={styles.nav} aria-label="Settings sections">
          <LayoutGroup id={`${uid}-nav`}>
            <ul>
              {grouped.map(({ section: entry, defs }) => {
                const Icon = sectionIcons[entry.id] ?? SlidersHorizontal;
                const current = section === entry.id;
                const edited = defs.filter((def) => dirty.includes(def.id)).length;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={styles.navItem}
                      aria-current={current ? "true" : undefined}
                      onClick={() => {
                        const scroller = scrollerRef.current;
                        const node = sectionNodes.current.get(entry.id);
                        if (!scroller || !node) return;
                        setSection(entry.id);
                        scroller.scrollTo({ top: Math.max(0, node.offsetTop - 16), behavior: reduce ? "auto" : "smooth" });
                      }}
                    >
                      {current && (
                        <motion.span
                          className={styles.navHighlight}
                          layoutId="highlight"
                          transition={reduce ? { duration: 0 } : motionTokens.spring.morph}
                          aria-hidden="true"
                        />
                      )}
                      <Icon size={15} aria-hidden="true" />
                      <span className={styles.navLabel}>{entry.label}</span>
                      <AnimatePresence initial={false}>
                        {edited > 0 && (
                          <motion.span
                            className={styles.navDot}
                            initial={{ opacity: 0, scale: 0.4 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.4 }}
                            transition={reduce ? { duration: 0 } : motionTokens.spring.snappy}
                          >
                            <span className={styles.srOnly}>{edited} edited</span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </li>
                );
              })}
            </ul>
          </LayoutGroup>
        </nav>
        <div className={styles.main}>
          <div
            ref={scrollerRef}
            className={styles.scroller}
            onScroll={() => {
              if (raf.current) return;
              raf.current = requestAnimationFrame(() => {
                raf.current = 0;
                const scroller = scrollerRef.current;
                if (!scroller) return;
                let current = sections[0]?.id;
                for (const entry of sections) {
                  const node = sectionNodes.current.get(entry.id);
                  if (node && node.offsetTop <= scroller.scrollTop + 0.3 * scroller.clientHeight) current = entry.id;
                }
                if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) {
                  current = sections[sections.length - 1]?.id;
                }
                if (current) setSection((value) => (value === current ? value : current));
              });
            }}
          >
            {grouped.map(({ section: entry, defs }) => (
              <section
                key={entry.id}
                ref={(node) => {
                  if (node) sectionNodes.current.set(entry.id, node);
                  else sectionNodes.current.delete(entry.id);
                }}
                className={styles.section}
                aria-labelledby={`${uid}-section-${entry.id}`}
              >
                <div className={styles.sectionHead}>
                  <h3 id={`${uid}-section-${entry.id}`}>{entry.label}</h3>
                  <p>{entry.description}</p>
                </div>
                <div className={styles.rows}>
                  {defs.map((def) => (
                    <Row
                      key={def.id}
                      def={def}
                      uid={uid}
                      value={draft[def.id] ?? ""}
                      dirty={dirty.includes(def.id)}
                      error={submitAttempted || dirty.includes(def.id) ? errors[def.id] : undefined}
                      pulse={pulse.id === def.id ? pulse.tick : 0}
                      onChange={(value) => {
                        setDraft((current) => {
                          const next = { ...current, [def.id]: value };
                          onValuesChange?.(next);
                          return next;
                        });
                        if (status === "saved" || status === "failed") setStatus("idle");
                      }}
                      rowRef={(node) => {
                        if (node) rows.current.set(def.id, node);
                        else rows.current.delete(def.id);
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className={styles.dock}>
            <AnimatePresence>
              {barState && (
                <SaveBar
                  key="bar"
                  state={barState}
                  count={dirty.length}
                  invalid={submitAttempted && Boolean(firstInvalid)}
                  onDiscard={() => {
                    if (status === "saving") return;
                    setDraft(saved);
                    onValuesChange?.(saved);
                    setSubmitAttempted(false);
                    setStatus("idle");
                    setLive("Changes discarded");
                  }}
                  onSave={() => {
                    if (!dirty.length || status === "saving") return;
                    if (firstInvalid) {
                      setSubmitAttempted(true);
                      setLive(`${errors[firstInvalid.id]} before saving`);
                      if (!reduce) animate(shake, [0, -6, 5, -3, 2, 0], { duration: 0.4, ease: "easeOut" });
                      jump(firstInvalid.id, true);
                      return;
                    }
                    setStatus("saving");
                    setLive("Saving settings");
                    const done = () => {
                      setSaved(draft);
                      setSubmitAttempted(false);
                      setStatus("saved");
                      setLive(`${dirty.length} ${dirty.length === 1 ? "change" : "changes"} saved`);
                      later(() => setStatus((current) => (current === "saved" ? "idle" : current)), 1800);
                    };
                    if (onSave) {
                      Promise.resolve()
                        .then(() => onSave(draft, dirty))
                        .then(done, () => {
                          setStatus("failed");
                          setLive("Could not save. Try again.");
                        });
                    } else {
                      later(done, 900);
                    }
                  }}
                  shake={shake}
                  barRef={barRef}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
        <AnimatePresence>
          {origin && !closing && (
            <motion.div
              key="scrim"
              className={styles.scrim}
              onPointerDown={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? motionTokens.duration.instant : motionTokens.duration.standard }}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
        {origin && frameWidth > 0 && (
          <Palette
            uid={uid}
            origin={origin.origin}
            frameWidth={frameWidth}
            closing={closing}
            onClosed={clearPalette}
            query={query}
            onQuery={setQuery}
            results={results}
            suggestions={suggestions}
            active={active}
            onActive={setActive}
            onPick={(result) => {
              const target = jump(result.def.id, true);
              setLive(`${result.def.label}, in ${sections.find((entry) => entry.id === result.def.section)?.label ?? "settings"}`);
              if (target) setClosing({ to: target, mode: "row" });
              else close();
            }}
            onClose={close}
            reduce={reduce}
          />
        )}
      </div>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {live}
      </p>
    </div>
  );
}

export default SettingsCommand;
