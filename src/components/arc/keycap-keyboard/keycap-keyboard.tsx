"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { ArrowBigUp, CornerDownLeft, Delete } from "lucide-react";
import styles from "./keycap-keyboard.module.css";

/** Characters that need Shift on a US layout, keyed by the unshifted legend. */
const SHIFTED: Record<string, string> = {
  "`": "~",
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
  "-": "_",
  "=": "+",
  "[": "{",
  "]": "}",
  "\\": "|",
  ";": ":",
  "'": '"',
  ",": "<",
  ".": ">",
  "/": "?",
};

/** `KeyboardEvent.code` overrides for punctuation, which has no `Key*` / `Digit*` name. */
const PUNCTUATION_CODES: Record<string, string> = {
  "`": "Backquote",
  "-": "Minus",
  "=": "Equal",
  "[": "BracketLeft",
  "]": "BracketRight",
  "\\": "Backslash",
  ";": "Semicolon",
  "'": "Quote",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
};

const ICON_PROPS = { size: 15, strokeWidth: 1.75, "aria-hidden": true } as const;

type KeyAction = "backspace" | "shift";

interface KeyDef {
  code: string;
  legend: ReactNode;
  name: string;
  value?: string;
  shifted?: string;
  action?: KeyAction;
  units: number;
  corner?: boolean;
  accent?: boolean;
  also?: string[];
}

/** A printable key, matched by physical position so every layout lights the right cap. */
function letter(char: string, units = 1): KeyDef {
  const lower = char.toLowerCase();
  const isLetter = /[a-z]/.test(lower);
  const code = isLetter
    ? `Key${lower.toUpperCase()}`
    : /\d/.test(char)
      ? `Digit${char}`
      : (PUNCTUATION_CODES[char] ?? `Char${char.charCodeAt(0)}`);
  const shifted = isLetter ? lower.toUpperCase() : SHIFTED[char];
  return { code, legend: lower, name: lower, value: lower, shifted, units };
}

/** A named function key. */
function special(name: string, units?: number): KeyDef {
  switch (name) {
    case "space":
      return { code: "Space", legend: null, name: "Space", value: " ", units: units ?? 5 };
    case "backspace":
      return {
        code: "Backspace",
        legend: <Delete {...ICON_PROPS} />,
        name: "Delete",
        action: "backspace",
        units: units ?? 1.6,
        corner: true,
      };
    case "enter":
      return {
        code: "Enter",
        legend: <CornerDownLeft {...ICON_PROPS} />,
        name: "Return",
        value: "\n",
        units: units ?? 2.25,
        corner: true,
        accent: true,
      };
    case "shift":
      return {
        code: "ShiftLeft",
        also: ["ShiftRight"],
        legend: <ArrowBigUp {...ICON_PROPS} />,
        name: "Shift",
        action: "shift",
        units: units ?? 2.25,
        corner: true,
      };
    case "tab":
      return { code: "Tab", legend: "tab", name: "Tab", units: units ?? 1.5, corner: true };
    case "caps":
      return { code: "CapsLock", legend: "caps", name: "Caps lock", units: units ?? 1.75, corner: true };
    default:
      return letter(name);
  }
}

/** Builds rows from a custom `rows` prop — one character, or a named function key. */
function buildRows(rows: string[][]): KeyDef[][] {
  return rows.map(row => row.map(key => (key.length === 1 ? letter(key) : special(key))));
}

const LETTERS: KeyDef[][] = buildRows([
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["shift", "z", "x", "c", "v", "b", "n", "m", "backspace"],
  ["space"],
]).map((row, index) =>
  index === 2
    ? row.map(key => (key.action ? { ...key, units: 1.5 } : key))
    : index === 3
      ? row.map(key => ({ ...key, units: 6, accent: true }))
      : row,
);

const COMPACT: KeyDef[][] = [
  [..."`1234567890-=".split("").map(char => letter(char)), special("backspace", 2)],
  [special("tab", 1.5), ..."qwertyuiop[]".split("").map(char => letter(char)), letter("\\", 1.5)],
  [special("caps", 1.75), ..."asdfghjkl;'".split("").map(char => letter(char)), special("enter", 2.25)],
  [{ ...special("shift", 2.25), also: [] }, ..."zxcvbnm,./".split("").map(char => letter(char)), { ...special("shift", 2.75), code: "ShiftRight", also: [] }],
  [
    { code: "ControlLeft", legend: "ctrl", name: "Control", units: 1.25, corner: true },
    { code: "AltLeft", legend: "opt", name: "Option", units: 1.25, corner: true },
    { code: "MetaLeft", legend: "cmd", name: "Command", units: 1.5, corner: true },
    { ...special("space"), units: 7 },
    { code: "MetaRight", legend: "cmd", name: "Command", units: 1.5, corner: true },
    { code: "AltRight", legend: "opt", name: "Option", units: 1.25, corner: true },
    { code: "ControlRight", legend: "ctrl", name: "Control", units: 1.25, corner: true },
  ],
];

function setAttribute(node: HTMLElement | null | undefined, name: string, on: boolean) {
  if (!node) return;
  if (on) node.setAttribute(name, "");
  else node.removeAttribute(name);
}

/** Reads a CSS duration (`580ms`, `0.58s`) with a numeric fallback. */
function parseDuration(value: string, fallback: number) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return /ms\s*$/.test(value) ? parsed : parsed * 1000;
}

interface CapProps {
  def: KeyDef;
  register: (code: string, node: HTMLButtonElement | null) => void;
  onDown: (def: KeyDef, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onUp: (def: KeyDef) => void;
  onActivate: (def: KeyDef, event: ReactMouseEvent<HTMLButtonElement>) => void;
}

/** One cap. Memoised with stable props so a press never re-renders the board. */
const Cap = memo(function Cap({ def, register, onDown, onUp, onActivate }: CapProps) {
  return (
    <button
      ref={node => register(def.code, node)}
      type="button"
      className={styles.key}
      style={{ "--w": def.units } as CSSProperties}
      data-keycap=""
      data-corner={def.corner ? "" : undefined}
      data-accent={def.accent ? "" : undefined}
      aria-label={def.name}
      onPointerDown={event => onDown(def, event)}
      onPointerUp={() => onUp(def)}
      onPointerCancel={() => onUp(def)}
      onLostPointerCapture={() => onUp(def)}
      onClick={event => onActivate(def, event)}
    >
      <span className={styles.glow} aria-hidden="true" />
      <span className={styles.housing} aria-hidden="true" />
      <span className={styles.cap} aria-hidden="true">
        <span className={styles.face}>
          <span className={styles.legend}>{def.legend}</span>
        </span>
      </span>
    </button>
  );
});

export interface KeycapKeyboardProps {
  /** Controlled text. */
  value?: string;
  /** Initial text when uncontrolled. */
  defaultValue?: string;
  /** Called with the new text after every key. */
  onValueChange?: (value: string) => void;
  /** Compact is a full 60% board; letters is three letter rows with shift, delete and a space bar. */
  layout?: "compact" | "letters";
  /** Custom rows that override `layout`. Single characters, plus space, backspace, enter, shift, tab and caps. */
  rows?: string[][];
  /** Longest text kept. Older characters drop off the start. */
  maxLength?: number;
  /** Where physical keys are heard. "window" listens across the page but ignores other text fields and Cmd/Ctrl/Alt shortcuts. */
  listen?: "focus" | "window";
  /** Shown while the text is empty. */
  placeholder?: string;
  /** Hides the typed text area when you render the value yourself. */
  showOutput?: boolean;
  /** Accessible name for the board. */
  label?: string;
  /** Extra class on the root. */
  className?: string;
  style?: CSSProperties;
}

/**
 * A board of sculpted mechanical keycaps. Physical typing and clicks press the matching cap into
 * its housing, bloom a faint light under it, and add the character to a wrapping text area above
 * the board.
 */
export function KeycapKeyboard({
  value,
  defaultValue = "",
  onValueChange,
  layout = "compact",
  rows,
  maxLength = 280,
  listen = "focus",
  placeholder = "Start typing",
  showOutput = true,
  label = "Keyboard",
  className,
  style,
}: KeycapKeyboardProps) {
  const [text, setText] = useState(defaultValue);
  const current = value ?? text;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());

  /** Latest props for the imperative key path — it must never close over a stale value. */
  const latest = useRef({ text: current, controlled: value !== undefined, onValueChange, maxLength });
  const shifted = useRef(false);
  const typingTimer = useRef(0);

  useEffect(() => {
    latest.current = { text: current, controlled: value !== undefined, onValueChange, maxLength };
  });

  const rowsKey = rows ? JSON.stringify(rows) : "";
  const board = useMemo(
    () => (rowsKey ? buildRows(JSON.parse(rowsKey) as string[][]) : layout === "letters" ? LETTERS : COMPACT),
    [rowsKey, layout],
  );
  const units = useMemo(
    () => Math.max(...board.map(row => row.reduce((total, key) => total + key.units, 0))),
    [board],
  );

  const byCode = useMemo(() => {
    const map = new Map<string, KeyDef>();
    for (const def of board.flat()) {
      map.set(def.code, def);
      def.also?.forEach(alias => {
        if (!map.has(alias)) map.set(alias, def);
      });
    }
    return map;
  }, [board]);

  const register = useCallback((code: string, node: HTMLButtonElement | null) => {
    if (node) nodes.current.set(code, node);
    else nodes.current.delete(code);
  }, []);

  const setPressed = useCallback((code: string, pressed: boolean) => {
    setAttribute(nodes.current.get(code), "data-pressed", pressed);
  }, []);

  const setLatched = useCallback((latched: boolean) => {
    shifted.current = latched;
    for (const code of ["ShiftLeft", "ShiftRight"]) setAttribute(nodes.current.get(code), "data-latched", latched);
  }, []);

  /** Trims to `maxLength` from the end, commits and restarts the caret hold. */
  const commit = useCallback((next: string) => {
    const { controlled, onValueChange: notify, maxLength: limit } = latest.current;
    const chars = Array.from(next);
    const kept = chars.length > limit ? chars.slice(chars.length - limit).join("") : next;
    latest.current.text = kept;
    if (!controlled) setText(kept);
    notify?.(kept);
    const output = outputRef.current;
    if (output) {
      output.dataset.typing = "";
      window.clearTimeout(typingTimer.current);
      typingTimer.current = window.setTimeout(() => {
        delete output.dataset.typing;
      }, 600);
    }
  }, []);

  const append = useCallback((char: string) => commit(latest.current.text + char), [commit]);
  const remove = useCallback(() => commit(Array.from(latest.current.text).slice(0, -1).join("")), [commit]);

  const activate = useCallback(
    (def: KeyDef) => {
      if (def.action === "shift") {
        setLatched(!shifted.current);
        return;
      }
      if (def.action === "backspace") {
        remove();
        return;
      }
      if (def.value === undefined) return;
      const char = shifted.current && def.shifted ? def.shifted : def.value;
      if (shifted.current) setLatched(false);
      append(char);
    },
    [append, remove, setLatched],
  );

  const onDown = useCallback(
    (def: KeyDef, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setPressed(def.code, true);
      activate(def);
    },
    [setPressed, activate],
  );

  const onUp = useCallback((def: KeyDef) => setPressed(def.code, false), [setPressed]);

  /** Keyboard activation of a cap arrives as a click with `detail === 0`. */
  const onActivate = useCallback(
    (def: KeyDef, event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.detail !== 0) return;
      setPressed(def.code, true);
      activate(def);
      window.setTimeout(() => setPressed(def.code, false), 90);
    },
    [setPressed, activate],
  );

  useEffect(() => {
    const root = rootRef.current;
    const target: HTMLElement | Window | null = listen === "window" ? window : root;
    if (!target || !root) return;

    const onKeyDown = (rawEvent: Event) => {
      if (!(rawEvent instanceof KeyboardEvent)) return;
      const event = rawEvent;
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const node = event.target;
      const inside = node instanceof Node && root.contains(node);
      if (
        !inside &&
        node instanceof HTMLElement &&
        (node.isContentEditable || /^(input|textarea|select)$/i.test(node.tagName))
      )
        return;
      // A focused cap presses itself through its own click handler.
      if (
        inside &&
        node instanceof HTMLElement &&
        node.dataset.keycap !== undefined &&
        (event.key === "Enter" || event.key === " ")
      )
        return;
      const def = byCode.get(event.code);
      if (def && !event.repeat) setPressed(def.code, true);
      if (event.key === "Backspace") {
        event.preventDefault();
        remove();
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        append("\n");
        return;
      }
      if (event.key.length === 1) {
        event.preventDefault();
        if (shifted.current) setLatched(false);
        append(event.key);
      }
    };

    const onKeyUp = (rawEvent: Event) => {
      if (!(rawEvent instanceof KeyboardEvent)) return;
      const event = rawEvent;
      const def = byCode.get(event.code);
      if (def) setPressed(def.code, false);
    };

    const releaseAll = () => {
      for (const code of nodes.current.keys()) setPressed(code, false);
    };

    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    if (listen === "focus") root.addEventListener("focusout", releaseAll);
    return () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      root.removeEventListener("focusout", releaseAll);
    };
  }, [listen, byCode, setPressed, remove, append, setLatched]);

  useEffect(() => () => window.clearTimeout(typingTimer.current), []);

  /* Layout morph: the plate animates from its previous size to the new one, rows fading in. */
  const plateRef = useRef<HTMLDivElement | null>(null);
  const plateSize = useRef<{ w: number; h: number } | null>(null);
  const morphs = useRef<Animation[]>([]);

  useEffect(() => {
    const plate = plateRef.current;
    if (!plate || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      plateSize.current = { w: plate.offsetWidth, h: plate.offsetHeight };
    });
    observer.observe(plate);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const plate = plateRef.current;
    const previous = plateSize.current;
    if (!plate || !previous || typeof plate.animate !== "function") return;

    morphs.current.forEach(animation => animation.cancel());
    morphs.current = [];
    delete plate.dataset.morphing;

    const next = { w: plate.offsetWidth, h: plate.offsetHeight };
    plateSize.current = next;
    if ((previous.w === next.w && previous.h === next.h) || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;

    const computed = getComputedStyle(plate);
    const easing =
      computed.getPropertyValue("--ease-spring").trim() || "cubic-bezier(.22, 1, .36, 1)";
    const spring = parseDuration(computed.getPropertyValue("--duration-spring"), 580);
    const standard = parseDuration(computed.getPropertyValue("--duration-standard"), 240);

    const size = plate.animate(
      [
        { width: `${previous.w}px`, height: `${previous.h}px` },
        { width: `${next.w}px`, height: `${next.h}px` },
      ],
      { duration: spring, easing },
    );
    plate.dataset.morphing = "";
    size.onfinish = size.oncancel = () => {
      if (morphs.current[0] === size) delete plate.dataset.morphing;
    };
    morphs.current = [
      size,
      ...Array.from(plate.children, row =>
        row.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: standard,
          delay: 60,
          easing: "cubic-bezier(.22, 1, .36, 1)",
          fill: "backwards",
        }),
      ),
    ];
  }, [board]);

  const chars = Array.from(current);
  const rootStyle: CSSProperties & { "--units": number } = { ...style, "--units": units };

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={rootStyle}>
      {showOutput && (
        <div
          ref={outputRef}
          className={styles.output}
          role="textbox"
          aria-readonly="true"
          aria-multiline="true"
          aria-label="Typed text"
          tabIndex={0}
        >
          <p className={styles.text}>
            {chars.map((char, index) =>
              char === "\n" ? (
                <br key={index} />
              ) : (
                <span key={index} className={styles.char}>
                  {char}
                </span>
              ),
            )}
            <span className={styles.caret} aria-hidden="true" />
            {chars.length === 0 && <span className={styles.placeholder}>{placeholder}</span>}
          </p>
        </div>
      )}
      <div ref={plateRef} className={styles.plate} role="group" aria-label={label}>
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className={styles.row}>
            {row.map(def => (
              <Cap
                key={def.code}
                def={def}
                register={register}
                onDown={onDown}
                onUp={onUp}
                onActivate={onActivate}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default KeycapKeyboard;
