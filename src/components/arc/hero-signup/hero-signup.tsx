"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import { Check } from "lucide-react";

import { motionTokens } from "../lib/motion-tokens";
import { avatar } from "../lib/media";
import { GradientMesh, type MeshPoint } from "./gradient-mesh";
import styles from "./hero-signup.module.css";

const ENTER_EASE = [...motionTokens.ease.enter] as [number, number, number, number];
const REEL_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const NOOP_SUBSCRIBE = () => () => {};

export type HeroSignupState = "idle" | "submitting" | "success" | "error";

export interface HeroSignupPerson {
  name: string;
  src: string;
}

export interface HeroSignupProps {
  /** Headline. A string is split into words so each one can rise on its own. */
  title?: ReactNode;
  /** One sentence under the headline. */
  description?: ReactNode;
  /** Placeholder for the email field. */
  placeholder?: string;
  /** Submit label at wide widths. */
  buttonLabel?: string;
  /** Submit label under 340px. */
  shortButtonLabel?: string;
  /** Quiet note under the pill while idle. */
  footnote?: string;
  /** People already on the list. The visible count is this plus one. */
  count?: number;
  /** Faces in the proof row, at most five. */
  people?: HeroSignupPerson[];
  /** Custom proof line. Receives the animated count. */
  proof?: (count: ReactNode) => ReactNode;
  /** Accent hue in degrees, for the mesh. Defaults to the theme accent. */
  hue?: number;
  /** Called with the email on submit. Return a position to skip the simulated wait. */
  onSubscribe?: (email: string) => void | number | Promise<void | number>;
  /** Called whenever the form moves between idle, submitting, success and error. */
  onStateChange?: (state: HeroSignupState) => void;
  className?: string;
}

const DEFAULTS = {
  title: "Close the month in an afternoon",
  description:
    "Tally matches every card payment to its receipt as it lands, so month end is a short review instead of a week of spreadsheets.",
  placeholder: "you@company.com",
  buttonLabel: "Join waitlist",
  shortButtonLabel: "Join",
  footnote: "One email when your invite is ready. Nothing else.",
  count: 1283,
};

const PEOPLE: HeroSignupPerson[] = [
  { name: "Andre Williams", src: avatar("andre-williams") },
  { name: "Chloe Nguyen", src: avatar("chloe-nguyen") },
  { name: "Diane Foster", src: avatar("diane-foster") },
  { name: "Daniel Kim", src: avatar("daniel-kim") },
  { name: "Sofia Ramirez", src: avatar("sofia-ramirez") },
];

const DOMAIN_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmaill.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.co": "outlook.com",
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
  "icoud.com": "icloud.com",
};

type Validation = { ok: true; fix?: string } | { ok: false; message: string };

/** Local, forgiving check: catches typos and shapes before the network round trip. */
function validateEmail(raw: string): Validation {
  const value = raw.trim();
  if (!value) return { ok: false, message: "Enter your email to join the list" };
  if (/\s/.test(value)) return { ok: false, message: "Emails can't contain spaces" };
  const at = value.indexOf("@");
  if (at < 0) return { ok: false, message: "Add an @ and your domain, like you@company.com" };
  if (at === 0) return { ok: false, message: "Add your name before the @" };
  const domain = value.slice(at + 1);
  if (!domain) return { ok: false, message: "Add your domain after the @" };
  if (domain.includes("@")) return { ok: false, message: "Use a single @" };
  if (!/^[^\s.@]+(\.[^\s.@]+)*\.[a-z]{2,}$/i.test(domain)) {
    return { ok: false, message: "Finish the domain, like company.com" };
  }
  const fix = DOMAIN_FIXES[domain.toLowerCase()];
  return fix ? { ok: true, fix: `${value.slice(0, at)}@${fix}` } : { ok: true };
}

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

/* -------------------------------------------------------------------------------------------------
 * Mesh palette
 * ---------------------------------------------------------------------------------------------- */

const LIGHT_PALETTE: [number, number, number][] = [
  [0.935, 0.042, 0],
  [0.95, 0.032, 38],
  [0.93, 0.04, -34],
  [0.955, 0.026, 150],
  [0.99, 0.004, 0],
];
const DARK_PALETTE: [number, number, number][] = [
  [0.29, 0.045, 0],
  [0.26, 0.036, 38],
  [0.27, 0.042, -34],
  [0.23, 0.024, 150],
  [0.18, 0.01, 0],
];
const MESH_POINTS = [
  { id: "a", x: 0.06, y: 0.04, spread: 1.05 },
  { id: "b", x: 0.96, y: 0.1, spread: 0.95 },
  { id: "c", x: 0.94, y: 0.96, spread: 1 },
  { id: "d", x: 0.04, y: 0.94, spread: 0.9 },
  { id: "pool", x: 0.5, y: 0.48, spread: 0.62 },
];

const toLinear = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
const fromLinear = (channel: number) =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
const clamp01 = (channel: number) => Math.min(1, Math.max(0, channel));

/** oklch → hex, so the palette can be authored in perceptual space. */
function oklch(l: number, chroma: number, hue: number) {
  const angle = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(angle);
  const b = chroma * Math.sin(angle);
  const light = clamp01(l);
  const l3 = (light + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (light - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (light - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return `#${[
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]
    .map(channel =>
      // Out-of-gamut channels are clamped before quantising, exactly as the
      // shipped helper does; without it 1.07 rounds to 273 and the hex grows an
      // extra digit, which normalises to a grey fallback.
      Math.round(255 * clamp01(fromLinear(clamp01(channel))))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** sRGB → oklch, used to read the theme accent back out of the cascade. */
function toOklch([r, g, b]: [number, number, number]): [number, number, number] {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const c = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    Math.hypot(a, c),
    ((180 * Math.atan2(c, a)) / Math.PI + 360) % 360,
  ];
}

let probeContext: CanvasRenderingContext2D | null = null;

/** Resolve any CSS colour to sRGB by painting one pixel. */
function probeColor(css: string): [number, number, number] | null {
  if (!css.trim()) return null;
  probeContext ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const context = probeContext;
  if (!context) return null;
  const canvas = context.canvas;
  canvas.width = canvas.height = 1;
  context.fillStyle = "#000";
  context.fillStyle = css.trim();
  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function readPalette(host: HTMLElement, hue?: number) {
  const computed = getComputedStyle(host);
  const dark = toOklch(probeColor(computed.getPropertyValue("--background")) ?? [1, 1, 1])[0] < 0.5;
  let resolved = hue;
  if (resolved === undefined) {
    const accent = probeColor(computed.getPropertyValue("--accent"));
    const parsed = accent ? toOklch(accent) : null;
    resolved = parsed && parsed[1] > 0.04 ? parsed[2] : 268;
  }
  const palette = dark ? DARK_PALETTE : LIGHT_PALETTE;
  return {
    base: oklch(dark ? 0.175 : 0.982, dark ? 0.012 : 0.008, resolved),
    points: MESH_POINTS.map<MeshPoint>((point, index) => ({
      ...point,
      color: oklch(palette[index][0], palette[index][1], resolved + palette[index][2]),
    })),
  };
}

/** The background field, re-tinted whenever the theme or accent changes. */
function MeshBackdrop({ hue }: { hue?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<{ base: string; points: MeshPoint[] } | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const read = () =>
      setPalette(previous => {
        const next = readPalette(host, hue);
        return previous && JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
      });
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-accent", "class", "style"],
    });
    return () => observer.disconnect();
  }, [hue]);

  return (
    <div ref={ref} className={styles.mesh} data-ready={palette ? "" : undefined} aria-hidden="true">
      {palette && (
        <GradientMesh
          base={palette.base}
          points={palette.points}
          grain={0.06}
          speed={0.55}
          maxPoints={8}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Rolling digits
 * ---------------------------------------------------------------------------------------------- */

interface RollProps {
  value: number;
  from?: number;
  reduced: boolean;
  delay?: number;
}

function Roll({ value, from, reduced, delay = 0 }: RollProps) {
  const digits = formatNumber(value).split("");
  const startFrom = from === undefined ? null : formatNumber(from).padStart(digits.length, "0");

  return (
    <span className={styles.roll} aria-hidden="true">
      {digits.map((character, index) => {
        const place = digits.length - 1 - index;
        if (!/\d/.test(character)) return <span key={`sep-${place}`}>{character}</span>;
        const digit = Number(character);
        const start = startFrom ? Number(/\d/.test(startFrom[index]) ? startFrom[index] : 0) : null;
        return (
          <span key={`digit-${place}`} className={styles.digit}>
            <motion.span
              className={styles.reel}
              initial={!reduced && start !== null ? { y: `${-(10 * start)}%` } : false}
              animate={{ y: `${-(10 * digit)}%` }}
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      type: "spring",
                      visualDuration: 0.9,
                      bounce: 0,
                      delay: delay + 0.06 * index,
                    }
              }
            >
              {REEL_DIGITS.map(tick => (
                <span key={tick}>{tick}</span>
              ))}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Hero signup
 * ---------------------------------------------------------------------------------------------- */

/**
 * A centered waitlist hero over a drifting mesh: headline words rise in, the email pill validates
 * locally with a handful of typo fixes, and a successful submit collapses the pill into a check and
 * a rolling position number. The note slot swaps between footnote, inline error, typo suggestion and
 * the success follow-up, and the whole thing works on touch, keyboard and screen readers.
 */
export function HeroSignup({
  title = DEFAULTS.title,
  description = DEFAULTS.description,
  placeholder = DEFAULTS.placeholder,
  buttonLabel = DEFAULTS.buttonLabel,
  shortButtonLabel = DEFAULTS.shortButtonLabel,
  footnote = DEFAULTS.footnote,
  count = DEFAULTS.count,
  people = PEOPLE,
  proof = value => (
    <>
      <span className={styles.proofStrong}>{value}</span> finance teams are on the list
    </>
  ),
  hue,
  onSubscribe,
  onStateChange,
  className,
}: HeroSignupProps) {
  const prefersReduced = useReducedMotion();
  const mounted = useSyncExternalStore(NOOP_SUBSCRIBE, () => true, () => false);
  const reduced = mounted && !!prefersReduced;
  const uid = useId();

  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<HeroSignupState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(count + 1);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [doneRect, setDoneRect] = useState<{
    top: number;
    left: number;
    right: number;
    bottom: number;
    radius: number;
  } | null>(null);

  const [formRef, animate] = useAnimate<HTMLFormElement>();
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const attempted = useRef(new Set<string>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const changeHandler = useRef(onStateChange);
  useEffect(() => {
    changeHandler.current = onStateChange;
  });

  const firstStatus = useRef(true);
  useEffect(() => {
    if (firstStatus.current) {
      firstStatus.current = false;
      return;
    }
    changeHandler.current?.(status);
  }, [status]);

  const check = validateEmail(value);
  const submitting = status === "submitting";
  const done = status === "success";
  const invalid = touched && !check.ok && !done;
  const noteId = `${uid}-note`;

  const measure = () => {
    const form = formRef.current;
    const button = buttonRef.current;
    if (!form || !button) return null;
    const top = button.offsetTop;
    const left = button.offsetLeft;
    return {
      top,
      left,
      right: form.clientWidth - left - button.offsetWidth,
      bottom: form.clientHeight - top - button.offsetHeight,
      radius: button.offsetHeight / 2,
    };
  };

  const submit = async (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    if (submitting || done) return;

    const email = value.trim();
    const result = validateEmail(email);
    if (!result.ok) {
      setTouched(true);
      setMessage(result.message);
      inputRef.current?.focus({ preventScroll: true });
      if (!reduced && formRef.current) {
        animate(formRef.current, { x: [0, -8, 7, -4, 2, 0] }, { duration: 0.4, ease: "easeOut" });
      }
      return;
    }

    setError(null);
    setStatus("submitting");
    setMessage("Joining the waitlist");

    try {
      let subscribed: number | void = undefined;
      if (onSubscribe) {
        subscribed = await onSubscribe(email);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1400));
        if (/fail/i.test(email) && !attempted.current.has(email.toLowerCase())) {
          attempted.current.add(email.toLowerCase());
          throw new Error("We couldn't save your spot");
        }
      }
      if (!alive.current) return;

      const number = typeof subscribed === "number" ? subscribed : count + 1;
      setDoneRect(measure());
      setPosition(number);
      setSuccess(true);
      setStatus("success");
      setMessage(
        `You're number ${formatNumber(number)} on the list. ${
          onSubscribe
            ? `We'll email ${email} when your invite is ready.`
            : "This preview is simulated, nothing was sent."
        }`,
      );
      requestAnimationFrame(() => doneRef.current?.focus({ preventScroll: true }));
    } catch (cause) {
      if (!alive.current) return;
      const text =
        cause instanceof Error && cause.message
          ? cause.message
          : "We couldn't save your spot. Try again";
      setStatus("error");
      setError(text);
      setMessage(text);
    }
  };

  let noteKey = "footnote";
  let note: ReactNode = footnote;

  if (done) {
    noteKey = "done";
    note = (
      <>
        {onSubscribe ? (
          <>We'll email {value.trim()} when your invite is ready.</>
        ) : (
          "Preview only, no email was sent."
        )}{" "}
        <button
          type="button"
          className={styles.link}
          onClick={() => {
            setDoneRect(measure());
            setStatus("idle");
            setSuccess(false);
            setMessage("");
            requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
          }}
        >
          Change email
        </button>
      </>
    );
  } else if (invalid && !check.ok) {
    noteKey = `invalid-${check.message}`;
    note = <span className={styles.error}>{check.message}</span>;
  } else if (status === "error" && error) {
    noteKey = "failure";
    note = (
      <>
        <span className={styles.error}>{error}.</span>{" "}
        <button type="button" className={styles.link} onClick={() => void submit()}>
          Try again
        </button>
      </>
    );
  } else if (check.ok && check.fix) {
    const fix = check.fix;
    noteKey = `fix-${fix}`;
    note = (
      <>
        Did you mean{" "}
        <button
          type="button"
          className={styles.link}
          onClick={() => {
            setValue(fix);
            inputRef.current?.focus({ preventScroll: true });
          }}
        >
          {fix}
        </button>
        ?
      </>
    );
  }

  const words = typeof title === "string" ? title.split(" ") : null;
  const rise = (delay: number) => ({
    initial: !reduced && { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: reduced ? { duration: 0 } : { duration: 0.7, ease: ENTER_EASE, delay },
  });

  const restingPill = doneRect
    ? `inset(${doneRect.top}px ${doneRect.right}px ${doneRect.bottom}px ${doneRect.left}px round ${doneRect.radius}px)`
    : "inset(6px 6px 6px calc(100% - 50px) round 22px)";
  const expandedPill = `inset(0px 0px 0px 0px round ${
    doneRect ? doneRect.top + doneRect.radius : 28
  }px)`;

  return (
    <MotionConfig reducedMotion="user">
      <section
        className={[styles.root, className].filter(Boolean).join(" ")}
        aria-labelledby={`${uid}-title`}
      >
        <MeshBackdrop hue={hue} />
        <div className={styles.inner}>
          <h1 id={`${uid}-title`} className={styles.title}>
            {words
              ? words.map((word, index) => (
                  <span key={index}>
                    <motion.span
                      className={styles.word}
                      initial={!reduced && { opacity: 0, y: "0.4em", filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
                      transition={{
                        duration: 0.8,
                        ease: ENTER_EASE,
                        delay: 0.06 + index * motionTokens.stagger.word * 1.5,
                      }}
                    >
                      {word}
                    </motion.span>
                    {index < words.length - 1 ? " " : null}
                  </span>
                ))
              : title}
          </h1>

          {description ? (
            <motion.p className={styles.description} {...rise(0.3)}>
              {description}
            </motion.p>
          ) : null}

          <motion.div className={styles.formWrap} {...rise(0.42)}>
            <form
              ref={formRef}
              className={styles.pill}
              onSubmit={submit}
              noValidate
              data-state={status}
              data-invalid={invalid || undefined}
              aria-busy={submitting}
            >
              <label className={styles.srOnly} htmlFor={`${uid}-email`}>
                Email address
              </label>
              <div className={styles.field} inert={done} data-valid={(check.ok && !submitting) || undefined}>
                <input
                  ref={inputRef}
                  id={`${uid}-email`}
                  name="email"
                  className={styles.input}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  placeholder={placeholder}
                  value={value}
                  readOnly={submitting}
                  aria-invalid={invalid || undefined}
                  aria-describedby={noteId}
                  onChange={event => {
                    setValue(event.target.value);
                    if (status === "error") {
                      setStatus("idle");
                      setError(null);
                    }
                  }}
                  onBlur={() => {
                    if (value.trim()) setTouched(true);
                  }}
                />

                <AnimatePresence initial={false}>
                  {check.ok && !submitting && (
                    <motion.span
                      key="valid"
                      className={styles.valid}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6, transition: { duration: motionTokens.duration.fast } }}
                      transition={motionTokens.spring.snappy}
                      aria-hidden="true"
                    >
                      <Check size={16} strokeWidth={2} />
                    </motion.span>
                  )}
                </AnimatePresence>

                <button
                  ref={buttonRef}
                  type="submit"
                  className={styles.go}
                  aria-disabled={submitting || undefined}
                  data-busy={submitting || undefined}
                >
                  <span className={styles.goLabel} data-hidden={submitting || undefined}>
                    <span className={styles.labelLong}>{buttonLabel}</span>
                    <span className={styles.labelShort} aria-hidden="true">
                      {shortButtonLabel}
                    </span>
                  </span>
                  <span className={styles.spinner} data-shown={submitting || undefined} aria-hidden="true" />
                  {submitting && <span className={styles.srOnly}>Joining</span>}
                </button>
              </div>

              <motion.div
                ref={doneRef}
                className={styles.done}
                tabIndex={-1}
                aria-hidden={!done}
                initial={false}
                animate={
                  done
                    ? { clipPath: expandedPill, opacity: 1 }
                    : { clipPath: restingPill, transitionEnd: { opacity: 0 } }
                }
                transition={
                  reduced ? { duration: 0 } : { clipPath: motionTokens.spring.smooth, opacity: { duration: 0 } }
                }
              >
                <motion.span
                  className={styles.doneBody}
                  initial={false}
                  animate={
                    done
                      ? { opacity: 1, y: 0, filter: "blur(0px)" }
                      : { opacity: 0, y: 6 * +!reduced, filter: reduced ? "blur(0px)" : "blur(4px)" }
                  }
                  transition={
                    done
                      ? { duration: motionTokens.duration.considered, ease: ENTER_EASE, delay: 0.12 * +!reduced }
                      : { duration: motionTokens.duration.instant }
                  }
                >
                  <span className={styles.doneMark} aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <motion.path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={false}
                        animate={{ pathLength: done || reduced ? 1 : 0 }}
                        transition={{
                          duration: 0.45 * +done,
                          ease: ENTER_EASE,
                          delay: 0.22 * +done,
                        }}
                      />
                    </svg>
                  </span>
                  <span>
                    You&apos;re #
                    {done ? (
                      <Roll value={position} from={0} reduced={reduced} delay={0.2} />
                    ) : (
                      formatNumber(position)
                    )}
                    {" on the list"}
                  </span>
                </motion.span>
              </motion.div>
            </form>

            <div id={noteId} className={styles.note}>
              <AnimatePresence initial={false}>
                <motion.p
                  key={noteKey}
                  className={styles.noteText}
                  initial={{ opacity: 0, y: reduced ? 0 : -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
                  transition={{ duration: motionTokens.duration.standard, ease: ENTER_EASE }}
                >
                  {note}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div className={styles.proof} {...rise(0.54)}>
            {people.length > 0 && (
              <span className={styles.faces}>
                {people.slice(0, 5).map(person => (
                  <img
                    key={person.src}
                    className={styles.face}
                    src={person.src}
                    alt=""
                    width={28}
                    height={28}
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </span>
            )}
            <p className={styles.proofText}>
              <span aria-hidden="true">{proof(<Roll value={count + +!!success} reduced={reduced} />)}</span>
              <span className={styles.srOnly}>{`${formatNumber(count + +!!success)} people are on the list`}</span>
            </p>
          </motion.div>

          <p className={styles.srOnly} role="status" aria-live="polite">
            {message}
          </p>
        </div>
      </section>
    </MotionConfig>
  );
}

export default HeroSignup;
