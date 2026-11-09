/**
 * Emoji picker — Arc Pro component, reconstructed from the shipped preview runtime
 * (`_next/static/chunks/9064.2b8ec861f86b9fa7.js`) and its CSS module
 * (`_next/static/css/ebe0889ce8e99b98.css`).
 *
 * Behaviour notes kept from the original:
 * - category dataset is parsed once into a module-level index (raw + FE0F-stripped keys)
 * - recents + skin tone persist in localStorage under `storageKey`, with an in-memory fallback
 * - the grid is virtualised by row; only rows inside the scroll window (+160px overscan) render
 * - arrow keys move by column/row, PageUp/PageDown by a viewport, typing forwards to the search box
 */
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
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Clock,
  Coffee,
  Flag,
  Lightbulb,
  PawPrint,
  Plane,
  Search,
  Shapes,
  Smile,
  Volleyball,
  X,
  type LucideIcon,
} from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { emojiGroups } from "./emoji-data";
import styles from "./emoji-picker.module.css";

export interface EmojiItem {
  emoji: string;
  name: string;
  label: string;
  keywords: string[];
  search: string;
  tones?: number[];
  order: number;
}

export interface EmojiSelection {
  /** The emoji with the active skin tone applied. */
  emoji: string;
  /** The untinted emoji. */
  base: string;
  /** Human readable name, e.g. "Raised hand". */
  name: string;
  /** Tone index applied to this emoji (0 when the emoji has no tone variants). */
  skinTone: number;
}

export interface EmojiPickerProps {
  onSelect?: (selection: EmojiSelection, event?: ReactMouseEvent | ReactKeyboardEvent) => void;
  /** Controlled skin tone (0–5). */
  skinTone?: number;
  /** Tone used when nothing is stored yet. */
  defaultSkinTone?: number;
  onSkinToneChange?: (tone: number) => void;
  storageKey?: string;
  recentLimit?: number;
  defaultRecent?: string[];
  columns?: number;
  autoFocus?: boolean;
  searchPlaceholder?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

interface Section {
  id: string;
  label: string;
  emojis: EmojiItem[];
}

interface Index {
  categories: Section[];
  byEmoji: Map<string, EmojiItem>;
  all: EmojiItem[];
}

type Row =
  | { kind: "header"; section: number; label: string; top: number; height: number }
  | { kind: "emojis"; section: number; items: EmojiItem[]; first: number; top: number; height: number };

const TONES = ["", "🏻", "🏼", "🏽", "🏾", "🏿"];
const TONE_LABELS = ["Default", "Light", "Medium light", "Medium", "Medium dark", "Dark"];

const DEFAULT_RECENT = [
  "👍", "❤️", "😂", "🎉", "🙏", "🔥", "😊", "👀", "✅", "🙌",
  "💯", "😍", "🤔", "👏", "🚀", "😅", "🥳", "👋",
];

const TAB_ICONS: Record<string, LucideIcon> = {
  recent: Clock,
  people: Smile,
  nature: PawPrint,
  food: Coffee,
  activity: Volleyball,
  travel: Plane,
  objects: Lightbulb,
  symbols: Shapes,
  flags: Flag,
};

const MEMORY_KEY = "\u0000arc-emoji-picker";
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function writeStore(key: string, value: string) {
  memory.set(key, value);
  if (key !== MEMORY_KEY) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage can be full or blocked; the in-memory copy still works */
    }
  }
  listeners.forEach((listener) => listener());
}

function subscribeStore(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readRaw(key: string) {
  if (key !== MEMORY_KEY) {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) return stored;
    } catch {}
  }
  return memory.get(key) ?? null;
}

let indexCache: Index | null = null;

function getIndex(): Index {
  if (indexCache) return indexCache;
  const byEmoji = new Map<string, EmojiItem>();
  const all: EmojiItem[] = [];
  const categories = emojiGroups.map((group) => ({
    id: group.id,
    label: group.label,
    emojis: group.data.split("|").map((record) => {
      const [emoji, name, keywords = "", tones = ""] = record.split("~");
      const item: EmojiItem = {
        emoji,
        name,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        keywords: keywords ? keywords.split(",") : [],
        search: `${name.toLowerCase()} ${keywords.replaceAll(",", " ")}`,
        tones: tones ? tones.split(".").map(Number) : undefined,
        order: all.length,
      };
      all.push(item);
      byEmoji.set(emoji, item);
      byEmoji.set(emoji.replaceAll("\uFE0F", ""), item);
      return item;
    }),
  }));
  indexCache = { categories, byEmoji, all };
  return indexCache;
}

/** Inserts the tone modifier at every position the record declares, skipping a trailing FE0F. */
function toneEmoji(item: EmojiItem, tone: number) {
  if (!tone || !item.tones) return item.emoji;
  const chars = Array.from(item.emoji);
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    out += chars[i];
    if (item.tones.includes(i)) {
      out += TONES[tone];
      if (chars[i + 1] === "\uFE0F") i++;
    }
  }
  return out;
}

function searchEmoji(all: EmojiItem[], query: string) {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const phrase = tokens.join(" ");
  const scored: { item: EmojiItem; score: number }[] = [];
  for (const item of all) {
    if (!tokens.every((token) => item.search.includes(token))) continue;
    const name = item.name.toLowerCase();
    const score =
      name === phrase ? 0
      : name.startsWith(phrase) ? 1
      : name.includes(` ${phrase}`) ? 2
      : item.keywords.some((keyword) => keyword.startsWith(phrase)) ? 3
      : name.includes(phrase) ? 4
      : 5;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.item.order - b.item.order).map((entry) => entry.item);
}

function ToneGlyph({ value }: { value: number }) {
  return <span className={styles.emojiGlyph}>{`✋${TONES[value]}`}</span>;
}

export function EmojiPicker({
  onSelect,
  skinTone: skinToneProp,
  defaultSkinTone,
  onSkinToneChange,
  storageKey = "arc-emoji-picker",
  recentLimit = 27,
  defaultRecent = DEFAULT_RECENT,
  columns,
  autoFocus = false,
  searchPlaceholder = "Search emoji",
  label = "Emoji picker",
  className,
  style,
}: EmojiPickerProps) {
  const id = useId();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const reduceMotion = useReducedMotion() ?? false;
  const calm = mounted && reduceMotion;

  const index = getIndex();
  const key = storageKey ?? MEMORY_KEY;
  const raw = useSyncExternalStore(subscribeStore, () => readRaw(key), () => null);

  const stored = useMemo(() => {
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      const recent = Array.isArray(parsed.recent) ? parsed.recent.filter((entry: unknown) => typeof entry === "string") : [];
      const tone = typeof parsed.tone === "number" && parsed.tone >= 0 && parsed.tone <= 5 ? parsed.tone : 0;
      return { recent, tone };
    } catch {
      return { recent: [], tone: 0 };
    }
  }, [raw]);

  const tone = skinToneProp ?? (raw === null && defaultSkinTone !== undefined ? defaultSkinTone : stored.tone);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [size, setSize] = useState({ width: 336, height: 280 });
  const [tabOverride, setTabOverride] = useState<number | null>(null);
  const [toneOpen, setToneOpen] = useState(false);
  const [gridFocused, setGridFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const toneButtonRef = useRef<HTMLButtonElement>(null);
  const tonesRef = useRef<HTMLDivElement>(null);
  const overrideTimer = useRef<number>(undefined);
  const pendingTab = useRef<number | null>(null);

  const popular = useMemo(
    () =>
      (stored.recent.length ? stored.recent : defaultRecent)
        .map((entry: string) => index.byEmoji.get(entry) ?? index.byEmoji.get(entry.replaceAll("\uFE0F", "")))
        .filter((entry: EmojiItem | undefined): entry is EmojiItem => !!entry),
    [stored.recent, defaultRecent, index],
  );

  const popularLabel = stored.recent.length ? "Recently used" : "Popular";
  const sections = useMemo<Section[]>(
    () => [{ id: "recent", label: popularLabel, emojis: popular }, ...index.categories],
    [popular, popularLabel, index],
  );

  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchEmoji(index.all, query) : []), [searching, query, index]);
  const visibleSections = useMemo<Section[]>(
    () => (searching ? (results.length ? [{ id: "results", label: "Search results", emojis: results }] : []) : sections),
    [searching, results, sections],
  );

  const columnCount = Math.max(1, columns ?? Math.max(6, Math.floor(size.width / 36)));
  const cell = size.width / columnCount;

  const { rows, flat, total } = useMemo(() => {
    const nextRows: Row[] = [];
    const nextFlat: { item: EmojiItem; row: number; col: number }[] = [];
    let top = 0;
    visibleSections.forEach((section, sectionIndex) => {
      nextRows.push({ kind: "header", section: sectionIndex, label: section.label, top, height: 30 });
      top += 30;
      for (let i = 0; i < section.emojis.length; i += columnCount) {
        const items = section.emojis.slice(i, i + columnCount);
        const rowIndex = nextRows.length;
        nextRows.push({ kind: "emojis", section: sectionIndex, items, first: nextFlat.length, top, height: cell });
        items.forEach((item, col) => nextFlat.push({ item, row: rowIndex, col }));
        top += cell;
      }
    });
    return { rows: nextRows, flat: nextFlat, total: top + 8 };
  }, [visibleSections, columnCount, cell]);

  const headerTops = useMemo(
    () => rows.filter((row) => row.kind === "header").map((row) => row.top),
    [rows],
  );

  useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const measure = () => {
      const computed = getComputedStyle(node);
      const width = node.clientWidth - parseFloat(computed.paddingLeft) - parseFloat(computed.paddingRight);
      setSize((current) => (current.width === width && current.height === node.clientHeight ? current : { width, height: node.clientHeight }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const changeQuery = (next: string) => {
    setQuery(next);
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    setScrollTop(0);
    setActive(next.trim() ? 0 : null);
  };

  const spy = useMemo(() => {
    if (searching || !headerTops.length) return -1;
    if (scrollTop + size.height >= total - 4) return headerTops.length - 1;
    let current = 0;
    for (let i = 0; i < headerTops.length; i++) if (headerTops[i] <= scrollTop + 12) current = i;
    return current;
  }, [searching, headerTops, scrollTop, size.height, total]);

  const currentTab = tabOverride ?? spy;

  const goToTab = useCallback(
    (sectionIndex: number) => {
      const node = scrollerRef.current;
      if (!node) return;
      const top = Math.min(headerTops[sectionIndex] ?? 0, Math.max(0, total - node.clientHeight));
      setTabOverride(sectionIndex);
      window.clearTimeout(overrideTimer.current);
      overrideTimer.current = window.setTimeout(() => setTabOverride(null), calm ? 50 : 1600);
      node.scrollTo({ top, behavior: calm ? "auto" : "smooth" });
    },
    [headerTops, total, calm],
  );

  useEffect(() => () => window.clearTimeout(overrideTimer.current), []);

  useLayoutEffect(() => {
    if (pendingTab.current === null || searching) return;
    const section = pendingTab.current;
    pendingTab.current = null;
    goToTab(section);
  }, [searching, goToTab]);

  const pick = (item: EmojiItem, event?: ReactMouseEvent | ReactKeyboardEvent) => {
    writeStore(
      key,
      JSON.stringify({
        recent: [item.emoji, ...stored.recent.filter((entry: string) => entry !== item.emoji)].slice(0, recentLimit),
        tone: stored.tone,
      }),
    );
    onSelect?.({ emoji: toneEmoji(item, tone), base: item.emoji, name: item.label, skinTone: item.tones ? tone : 0 }, event);
  };

  const reveal = useCallback(
    (indexInFlat: number) => {
      const scroller = scrollerRef.current;
      const entry = flat[indexInFlat];
      if (!scroller || !entry) return;
      const row = rows[entry.row];
      const top = rows[entry.row - 1]?.kind === "header" ? row.top - 30 : row.top;
      if (top < scroller.scrollTop) scroller.scrollTop = top;
      else if (row.top + row.height > scroller.scrollTop + scroller.clientHeight) {
        scroller.scrollTop = row.top + row.height - scroller.clientHeight + 4;
      }
    },
    [flat, rows],
  );

  const activate = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), flat.length - 1);
    setActive(clamped);
    reveal(clamped);
  };

  const stepRow = (from: number, direction: 1 | -1): number | null => {
    const entry = flat[from];
    for (let rowIndex = entry.row + direction; rowIndex >= 0 && rowIndex < rows.length; rowIndex += direction) {
      const row = rows[rowIndex];
      if (row.kind === "emojis") return row.first + Math.min(entry.col, row.items.length - 1);
    }
    return null;
  };

  const stateRef = useRef({ toneOpen, searching, clear: () => {} });
  useEffect(() => {
    stateRef.current = { toneOpen, searching, clear: () => changeQuery("") };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !rootRef.current?.contains(document.activeElement)) return;
      const state = stateRef.current;
      if (state.toneOpen) {
        event.preventDefault();
        setToneOpen(false);
        toneButtonRef.current?.focus();
      } else if (state.searching) {
        event.preventDefault();
        state.clear();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    if (!toneOpen) return;
    const checked = tonesRef.current?.querySelector<HTMLElement>("[aria-checked='true']");
    checked?.focus({ preventScroll: true });
  }, [toneOpen]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const onScrollEnd = () => {
      if (tabOverride !== null) {
        window.clearTimeout(overrideTimer.current);
        setTabOverride(null);
      }
    };
    node.addEventListener("scrollend", onScrollEnd);
    return () => node.removeEventListener("scrollend", onScrollEnd);
  }, [tabOverride]);

  const windowRows = useMemo(() => {
    const from = scrollTop - 160;
    const to = scrollTop + size.height + 160;
    let low = 0;
    let high = rows.length - 1;
    let start = rows.length;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (rows[middle].top + rows[middle].height >= from) {
        start = middle;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }
    const list: number[] = [];
    for (let i = start; i < rows.length && rows[i].top <= to; i++) list.push(i);
    const activeRow = active !== null ? flat[active]?.row : undefined;
    if (activeRow !== undefined && !list.includes(activeRow)) list.push(activeRow);
    return list;
  }, [rows, scrollTop, size.height, active, flat]);

  const hovered = active !== null ? flat[active]?.item : undefined;
  const cellId = (indexInFlat: number) => `${id}-cell-${indexInFlat}`;
  const activeDescendant = hovered && active !== null ? cellId(active) : undefined;

  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!flat.length) return;
    const current = active ?? 0;
    const pageSize = Math.max(1, Math.floor(size.height / cell) - 1);
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        activate(active === null ? 0 : current + 1);
        return;
      case "ArrowLeft":
        event.preventDefault();
        activate(active === null ? 0 : current - 1);
        return;
      case "ArrowDown": {
        event.preventDefault();
        if (active === null) return activate(0);
        const next = stepRow(current, 1);
        if (next !== null) activate(next);
        return;
      }
      case "ArrowUp": {
        event.preventDefault();
        const next = active === null ? null : stepRow(current, -1);
        if (next === null) inputRef.current?.focus();
        else activate(next);
        return;
      }
      case "PageDown":
      case "PageUp": {
        event.preventDefault();
        let cursor = current;
        for (let i = 0; i < pageSize; i++) {
          const next = stepRow(cursor, event.key === "PageDown" ? 1 : -1);
          if (next === null) break;
          cursor = next;
        }
        activate(cursor);
        return;
      }
      case "Home": {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) return activate(0);
        const row = rows[flat[current].row];
        if (row.kind === "emojis") activate(row.first);
        return;
      }
      case "End": {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) return activate(flat.length - 1);
        const row = rows[flat[current].row];
        if (row.kind === "emojis") activate(row.first + row.items.length - 1);
        return;
      }
      case "Enter":
      case " ":
        event.preventDefault();
        if (active !== null && flat[active]) pick(flat[active].item, event);
        return;
    }
    if ((event.key.length === 1 || event.key === "Backspace") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      inputRef.current?.focus();
    }
  };

  return (
    <div
      ref={rootRef}
      className={[styles.picker, className].filter(Boolean).join(" ")}
      style={{ ...style, "--emoji-cell": `${cell}px` } as CSSProperties}
      role="group"
      aria-label={label}
    >
      <div className={styles.header}>
        <label className={styles.search}>
          <Search className={styles.searchIcon} width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (flat.length) {
                  if (active === null) activate(0);
                  scrollerRef.current?.focus({ preventScroll: true });
                }
              } else if (event.key === "Enter" && active !== null && flat[active]) {
                event.preventDefault();
                pick(flat[active].item, event);
              }
            }}
            placeholder={searchPlaceholder}
            aria-label="Search emoji"
            aria-controls={`${id}-grid`}
            aria-activedescendant={searching ? activeDescendant : undefined}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
          />
          {query ? (
            <button
              type="button"
              className={styles.clear}
              onClick={() => {
                changeQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X width={14} height={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </label>

        <button
          ref={toneButtonRef}
          type="button"
          className={styles.toneButton}
          onClick={() => setToneOpen(true)}
          aria-haspopup="true"
          aria-expanded={toneOpen}
          aria-label={`Skin tone: ${TONE_LABELS[tone]}`}
        >
          <ToneGlyph value={tone} />
        </button>

        <div
          ref={tonesRef}
          className={styles.tones}
          data-open={toneOpen || undefined}
          role="radiogroup"
          aria-label="Skin tone"
          onKeyDown={(event) => {
            const radios = Array.from(tonesRef.current?.querySelectorAll<HTMLElement>("[role='radio']") ?? []);
            const at = radios.indexOf(document.activeElement as HTMLElement);
            const delta =
              event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
              : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1
              : 0;
            if (delta) {
              event.preventDefault();
              radios[(at + delta + radios.length) % radios.length]?.focus();
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              radios[event.key === "Home" ? 0 : radios.length - 1]?.focus();
            } else if (event.key === "Tab") {
              setToneOpen(false);
            }
          }}
          onBlur={(event) => {
            if (toneOpen && !event.currentTarget.contains(event.relatedTarget as Node)) setToneOpen(false);
          }}
        >
          {TONE_LABELS.map((toneLabel, value) => (
            <button
              key={toneLabel}
              type="button"
              role="radio"
              aria-checked={tone === value}
              aria-label={toneLabel}
              tabIndex={tone === value ? 0 : -1}
              className={styles.tone}
              onClick={() => {
                if (skinToneProp === undefined) writeStore(key, JSON.stringify({ recent: stored.recent, tone: value }));
                onSkinToneChange?.(value);
                setToneOpen(false);
                toneButtonRef.current?.focus();
              }}
            >
              <ToneGlyph value={value} />
            </button>
          ))}
        </div>
      </div>

      <div
        className={styles.tabs}
        role="toolbar"
        aria-label="Categories"
        style={{ "--emoji-tabs": sections.length } as CSSProperties}
        onKeyDown={(event) => {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button"));
          const at = buttons.indexOf(document.activeElement as HTMLElement);
          const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
          if (delta && at >= 0) {
            event.preventDefault();
            buttons[(at + delta + buttons.length) % buttons.length]?.focus();
          }
        }}
      >
        {sections.map((section, sectionIndex) => {
          const Icon = TAB_ICONS[section.id] ?? Smile;
          const current = currentTab === sectionIndex;
          return (
            <button
              key={section.id}
              type="button"
              className={styles.tab}
              data-current={current || undefined}
              aria-current={current || undefined}
              aria-label={section.label}
              tabIndex={sectionIndex === Math.max(currentTab, 0) ? 0 : -1}
              onClick={() => {
                setActive(null);
                if (searching) {
                  pendingTab.current = sectionIndex;
                  changeQuery("");
                  return;
                }
                goToTab(sectionIndex);
              }}
            >
              <Icon width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          );
        })}
        <motion.span
          className={styles.indicator}
          aria-hidden="true"
          initial={false}
          animate={{ x: `${100 * Math.max(currentTab, 0)}%`, opacity: currentTab < 0 ? 0 : 1 }}
          transition={calm ? { duration: 0 } : { x: motionTokens.spring.morph, opacity: { duration: motionTokens.duration.fast } }}
        />
      </div>

      <div
        ref={scrollerRef}
        id={`${id}-grid`}
        className={styles.scroller}
        role="grid"
        aria-label={searching ? "Search results" : "Emoji"}
        aria-rowcount={rows.length}
        aria-colcount={columnCount}
        aria-activedescendant={gridFocused ? activeDescendant : undefined}
        tabIndex={flat.length ? 0 : -1}
        onKeyDown={onGridKeyDown}
        onFocus={(event) => {
          if (event.target !== event.currentTarget) return;
          setGridFocused(true);
          if (active === null && flat.length) setActive(0);
        }}
        onBlur={(event) => {
          if (event.target === event.currentTarget) setGridFocused(false);
        }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        onScrollEnd={() => {
          if (tabOverride !== null) setTabOverride(null);
        }}
        onWheel={() => {
          if (tabOverride !== null) setTabOverride(null);
        }}
        onTouchStart={() => {
          if (tabOverride !== null) setTabOverride(null);
        }}
        onPointerLeave={() => {
          if (!gridFocused && !searching) setActive(null);
        }}
      >
        {flat.length ? (
          <div className={styles.canvas} style={{ height: total }}>
            {windowRows.map((rowIndex) => {
              const row = rows[rowIndex];
              return row.kind === "header" ? (
                <div
                  key={`h${rowIndex}`}
                  role="row"
                  aria-rowindex={rowIndex + 1}
                  className={styles.sectionRow}
                  style={{ transform: `translateY(${row.top}px)`, height: row.height }}
                >
                  <span role="columnheader" aria-colspan={columnCount} className={styles.sectionLabel}>
                    {row.label}
                  </span>
                </div>
              ) : (
                <div
                  key={`r${rowIndex}`}
                  role="row"
                  aria-rowindex={rowIndex + 1}
                  className={styles.row}
                  style={{ transform: `translateY(${row.top}px)`, height: row.height, gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
                >
                  {row.items.map((item, col) => {
                    const flatIndex = row.first + col;
                    return (
                      <button
                        key={item.emoji}
                        id={cellId(flatIndex)}
                        type="button"
                        role="gridcell"
                        tabIndex={-1}
                        aria-label={item.label}
                        aria-selected={active === flatIndex}
                        data-active={active === flatIndex || undefined}
                        className={styles.cell}
                        onPointerMove={(event: ReactPointerEvent<HTMLButtonElement>) => {
                          if (event.pointerType === "mouse" && active !== flatIndex) setActive(flatIndex);
                        }}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          setActive(flatIndex);
                          pick(item, event);
                        }}
                      >
                        <span className={styles.emojiGlyph}>{toneEmoji(item, tone)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{`No emoji match “${query.trim()}”`}</p>
            <p className={styles.emptyHint}>Try a shorter or different word</p>
          </div>
        )}
      </div>

      <div className={styles.preview} aria-hidden="true">
        {hovered ? (
          <>
            <span key={hovered.emoji} className={[styles.previewGlyph, styles.emojiGlyph].join(" ")}>
              {toneEmoji(hovered, tone)}
            </span>
            <span className={styles.previewText}>
              <span className={styles.previewName}>{hovered.label}</span>
              {hovered.keywords.length > 0 ? <span className={styles.previewKeywords}>{hovered.keywords.slice(0, 3).join(", ")}</span> : null}
            </span>
          </>
        ) : (
          <>
            <span className={[styles.previewGlyph, styles.previewIdle, styles.emojiGlyph].join(" ")}>
              {toneEmoji(index.byEmoji.get("👋") as EmojiItem, tone)}
            </span>
            <span className={styles.previewText}>
              <span className={styles.previewHint}>Pick an emoji</span>
            </span>
          </>
        )}
      </div>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {searching ? (results.length ? `${results.length} emoji found` : "No emoji found") : ""}
      </span>
    </div>
  );
}
