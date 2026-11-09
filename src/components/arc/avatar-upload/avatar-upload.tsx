"use client";

/**
 * Avatar upload — Arc Pro component, reconstructed from the shipped preview runtime
 * (`_next/static/chunks/14326.c0b2b168053f1d9e.js`) and its CSS module
 * (`_next/static/css/40d95e088e59aa89.css`).
 *
 * Behaviour kept from the original:
 * - picking, dropping and `ref.selectFile` all run the same type → size → decode checks
 * - the avatar itself grows into a 184px crop circle; the stage, the dimmed ghost and the
 *   crop copy share one transform so the circle can resize without per-frame layout
 * - drag, wheel, two-finger pinch and the slider all funnel through the same clamped view,
 *   with the pointer anchored while zooming and a falling-rate overshoot past the edges
 * - saving draws the crop once into a canvas at `outputSize`, then uploads through a ring
 *   that turns while waiting and fills with the reported progress
 * - errors, uploading and success live in a polite live region, with progress in 25% steps
 */
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { Camera, Check, CircleAlert, ImagePlus, Minus, Plus } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./avatar-upload.module.css";

const TYPE_LABELS: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "image/avif": "AVIF",
  "image/heic": "HEIC",
};

function formatBytes(bytes: number) {
  return bytes >= 1048576 ? `${Number((bytes / 1024 / 1024).toFixed(1))} MB` : `${Math.round(bytes / 1024)} KB`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type Phase = "idle" | "crop" | "uploading" | "failed";

interface Draft {
  url: string;
  file: File;
  width: number;
  height: number;
}

interface Pending {
  url: string;
  blob: Blob;
  original: File;
}

interface View {
  zoom: number;
  x: number;
  y: number;
}

interface Message {
  tone: "hint" | "error" | "success";
  text: ReactNode;
  key: string;
}

/** The error payload handed to `onError`. */
export interface AvatarUploadError {
  code: "type" | "size" | "decode" | "upload";
  message: string;
}

/** Second argument of `onUpload`: report bytes going out, and listen for a cancel. */
export interface AvatarUploadContext {
  /** Progress from 0 to 1; until it is called the ring turns without a value. */
  report: (progress: number) => void;
  /** Aborts when the person cancels or starts another upload. */
  signal: AbortSignal;
  /** The file the person picked, before cropping. */
  original: File;
}

/** Imperative handle, for your own buttons, paste handlers or camera capture. */
export interface AvatarUploadHandle {
  /** Opens the file picker. */
  open: () => void;
  /** Runs a file through the same checks as a pick or drop and opens the cropper. */
  selectFile: (file: File) => void;
}

export interface AvatarUploadProps {
  /** Person's name, used for the initials fallback. */
  name: string;
  /** Current photo URL. Changing it replaces the shown photo. */
  src?: string;
  /**
   * Receives the cropped square image. Call report with 0 to 1 as bytes go out to fill the ring;
   * until you do, the ring turns without a value. Resolve with the stored URL, or with nothing to
   * keep showing the local crop. Reject to show the error message and a Try again button.
   * signal aborts when the person cancels.
   */
  onUpload: (image: Blob, context: AvatarUploadContext) => Promise<string | void>;
  /** Called after Remove. Without it the Remove button is hidden. */
  onRemove?: () => void;
  /** Called whenever an error message is shown, for logging or analytics. */
  onError?: (error: AvatarUploadError) => void;
  /** Accepted MIME types. The default hint lists them. */
  accept?: string[];
  /** Largest file in bytes, 5 MB by default. Checked before the image is decoded. */
  maxSize?: number;
  /** Avatar diameter in px while not cropping. The crop circle is 184px. */
  size?: number;
  /** Side of the square image passed to onUpload, in px. PNGs stay PNG to keep transparency; everything else becomes JPEG at 92% quality. */
  outputSize?: number;
  /** Heading beside the avatar and the group's accessible name. */
  label?: string;
  /** Helper copy. Defaults to the accepted types and the size limit, such as PNG, JPG or WebP, up to 5 MB. */
  hint?: ReactNode;
  /** Blocks picking, dropping and removing. */
  disabled?: boolean;
  /** Class on the root element. */
  className?: string;
  /** Inline styles on the root element. */
  style?: CSSProperties;
  /** `open()` shows the file picker; `selectFile(file)` runs a file through the same checks as a pick or drop. */
  ref?: Ref<AvatarUploadHandle>;
}

/** Exported for the demo and for tests. */
export const AvatarUpload = function AvatarUpload({
  name,
  src,
  onUpload,
  onRemove,
  onError,
  accept = ["image/png", "image/jpeg", "image/webp"],
  maxSize = 5242880,
  size = 88,
  outputSize = 512,
  label = "Profile photo",
  hint,
  disabled,
  className,
  style,
  ref,
}: AvatarUploadProps) {
  const reduced = !!useReducedMotion();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);

  const [current, setCurrent] = useState<string | undefined>(src);
  const [trackedSrc, setTrackedSrc] = useState<string | undefined>(src);
  // A new src prop replaces the photo without an effect, so it lands in the same paint.
  if (src !== trackedSrc) {
    setTrackedSrc(src);
    setCurrent(src);
  }

  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [nudging, setNudging] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [settleCount, setSettleCount] = useState(0);
  const [dropActive, setDropActive] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);

  const labels = accept.map((type) => TYPE_LABELS[type] ?? type.replace(/^image\//, "").toUpperCase());
  const typeList =
    labels.length < 2 ? labels.join("") : `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
  const defaultHint = hint ?? `${typeList}, up to ${formatBytes(maxSize)}`;

  // Object URLs created here are revoked when replaced and on unmount, never left dangling.
  const objectUrls = useRef(new Set<string>());
  const revoke = useCallback((url?: string | null) => {
    if (url && objectUrls.current.has(url)) {
      URL.revokeObjectURL(url);
      objectUrls.current.delete(url);
    }
  }, []);
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const messageTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(messageTimer.current), []);

  // The photo on screen before this render, so an upload can revoke the local URL it replaces.
  const shownRef = useRef(current);
  useLayoutEffect(() => {
    shownRef.current = current;
  });

  function flash(next: Message, ms: number) {
    window.clearTimeout(messageTimer.current);
    setMessage(next);
    messageTimer.current = window.setTimeout(() => setMessage(null), ms);
  }

  const showError = useCallback(
    (code: AvatarUploadError["code"], text: string) => {
      window.clearTimeout(messageTimer.current);
      setMessage({ tone: "error", text, key: `${code}:${text}:${Date.now()}` });
      onError?.({ code, message: text });
    },
    [onError],
  );

  const selectFile = useCallback(
    (file: File) => {
      if (disabled || phase === "uploading") return;
      if (!accept.includes(file.type)) {
        const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toUpperCase() : "";
        showError(
          "type",
          `${ext ? `${ext} files aren’t supported` : "That file isn’t an image"}. Choose a ${typeList}.`,
        );
        return;
      }
      if (file.size > maxSize) {
        showError("size", `That photo is ${formatBytes(file.size)}. Choose one up to ${formatBytes(maxSize)}.`);
        return;
      }
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);
      const image = new Image();
      image.onload = () => {
        setDraft((previous) => {
          revoke(previous?.url);
          return { url, file, width: image.naturalWidth, height: image.naturalHeight };
        });
        setView({ zoom: 1, x: 0, y: 0 });
        setMessage(null);
        setPhase("crop");
      };
      image.onerror = () => {
        revoke(url);
        showError("decode", "That image couldn’t be opened. Try another file.");
      };
      image.src = url;
    },
    [accept, disabled, showError, maxSize, phase, revoke, typeList],
  );

  const openPicker = useCallback(() => {
    if (disabled || phase === "uploading") return;
    inputRef.current?.click();
  }, [disabled, phase]);

  useImperativeHandle(ref, () => ({ open: openPicker, selectFile }), [openPicker, selectFile]);

  // The photo is sized against its short side, so even a panorama always covers the circle.
  const ratio = draft
    ? { w: draft.width / Math.min(draft.width, draft.height), h: draft.height / Math.min(draft.width, draft.height) }
    : { w: 1, h: 1 };

  const bounds = useCallback(
    (zoom: number) => ({
      x: Math.max(0, (ratio.w * zoom - 1) / 2),
      y: Math.max(0, (ratio.h * zoom - 1) / 2),
    }),
    [ratio.w, ratio.h],
  );

  /** Inside the circle: the photo never shows a gap. */
  const fit = useCallback(
    (next: View): View => {
      const limit = bounds(next.zoom);
      return { zoom: next.zoom, x: clamp(next.x, -limit.x, limit.x), y: clamp(next.y, -limit.y, limit.y) };
    },
    [bounds],
  );

  /** Past the edge the photo follows at a falling rate and never more than a quarter of the circle. */
  const overshoot = useCallback(
    (next: View): View => {
      const limit = bounds(next.zoom);
      const soften = (value: number, edge: number) => {
        const past = Math.abs(value) - edge;
        return past <= 0 ? value : Math.sign(value) * (edge + (0.25 * past) / (past + 0.25));
      };
      return { zoom: next.zoom, x: soften(next.x, limit.x), y: soften(next.y, limit.y) };
    },
    [bounds],
  );

  const zoomTo = useCallback(
    (from: View, zoom: number, anchor: { x: number; y: number } = { x: 0, y: 0 }) => {
      const next = clamp(zoom, 1, 4);
      const scale = next / from.zoom;
      return fit({
        zoom: next,
        x: anchor.x - (anchor.x - from.x) * scale,
        y: anchor.y - (anchor.y - from.y) * scale,
      });
    },
    [fit],
  );

  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  });

  const springBack = useRef<{ stop: () => void } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: View; center: { x: number; y: number }; distance: number } | null>(null);

  const anchorFor = (clientX: number, clientY: number) => {
    if (!circleRef.current) return { x: 0, y: 0 };
    const rect = circleRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - rect.width / 2) / rect.width,
      y: (clientY - rect.top - rect.height / 2) / rect.height,
    };
  };

  function snapshot() {
    const list = Array.from(pointers.current.values());
    const center = list.reduce(
      (total, point) => ({ x: total.x + point.x / list.length, y: total.y + point.y / list.length }),
      { x: 0, y: 0 },
    );
    const distance = list.length > 1 ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) : 0;
    gesture.current = { view: viewRef.current, center, distance };
  }

  function release(pointerId: number) {
    if (!pointers.current.delete(pointerId)) return;
    if (pointers.current.size) {
      snapshot();
      return;
    }
    gesture.current = null;
    setNudging(false);
    const settled = fit(viewRef.current);
    if (settled.x === viewRef.current.x && settled.y === viewRef.current.y) return;
    if (reduced) {
      setView(settled);
      return;
    }
    const from = viewRef.current;
    springBack.current = animate(0, 1, {
      ...motionTokens.spring.smooth,
      onUpdate: (t: number) =>
        setView({ zoom: settled.zoom, x: from.x + (settled.x - from.x) * t, y: from.y + (settled.y - from.y) * t }),
    });
  }

  const cancelCrop = () => {
    revoke(draft?.url);
    setDraft(null);
    setPhase("idle");
    requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }));
  };

  /** Draws the crop once at `outputSize`; the original file is never re-encoded before this. */
  async function exportCrop(): Promise<Blob | null> {
    if (!draft) return null;
    const image = new Image();
    image.src = draft.url;
    await image.decode().catch(() => undefined);
    const short = Math.min(draft.width, draft.height);
    const { zoom, x, y } = fit(viewRef.current);
    const side = short / zoom;
    const left = draft.width / 2 - x * side - side / 2;
    const top = draft.height / 2 - y * side - side / 2;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingQuality = "high";
    const type = draft.file.type === "image/png" ? "image/png" : "image/jpeg";
    if (type === "image/jpeg") {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, outputSize, outputSize);
    }
    context.drawImage(image, left, top, side, side, 0, 0, outputSize, outputSize);
    return new Promise((resolve) => canvas.toBlob(resolve, type, 0.92));
  }

  async function runUpload(next: Pending) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setPhase("uploading");
    setProgress(null);
    setMessage(null);
    try {
      const stored = await onUpload(next.blob, {
        report: (value) => {
          if (!abort.signal.aborted) setProgress(clamp(value, 0, 1));
        },
        signal: abort.signal,
        original: next.original,
      });
      if (abort.signal.aborted) return;
      setProgress(1);
      // Let the ring close before the photo settles, unless motion is reduced.
      await new Promise((resolve) => window.setTimeout(resolve, reduced ? 0 : 280));
      if (abort.signal.aborted) return;
      const url = typeof stored === "string" && stored ? stored : next.url;
      if (url !== next.url) revoke(next.url);
      if (shownRef.current !== url) revoke(shownRef.current);
      setCurrent(url);
      setPending(null);
      setPhase("idle");
      setSettleCount((count) => count + 1);
      flash({ tone: "success", text: "Photo updated", key: `done:${Date.now()}` }, 2600);
    } catch (error) {
      if (abort.signal.aborted) return;
      setPhase("failed");
      showError(
        "upload",
        error instanceof Error && error.message ? error.message : "Upload failed. Your previous photo is unchanged.",
      );
    }
  }

  async function save() {
    if (!draft || phase !== "crop") return;
    const blob = await exportCrop();
    if (!blob) {
      showError("decode", "That image couldn’t be cropped. Try another file.");
      return;
    }
    const url = URL.createObjectURL(blob);
    objectUrls.current.add(url);
    const next: Pending = { url, blob, original: draft.file };
    setPending(next);
    revoke(draft.url);
    setDraft(null);
    void runUpload(next);
  }

  function cancelUpload() {
    controller.current?.abort();
    revoke(pending?.url);
    setPending(null);
    setPhase("idle");
    flash({ tone: "hint", text: "Upload canceled", key: `cancel:${Date.now()}` }, 2200);
    requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }));
  }

  const hoverTimer = useRef<number | undefined>(undefined);

  // Wheel is captured only over the stage, and only while cropping, so the page keeps scrolling elsewhere.
  useEffect(() => {
    const stage = stageRef.current;
    if (stage && phase === "crop") {
      stage.addEventListener("wheel", onWheel, { passive: false });
      return () => {
        stage.removeEventListener("wheel", onWheel);
        window.clearTimeout(hoverTimer.current);
      };
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      springBack.current?.stop();
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0022));
      setView((previous) => zoomTo(fit(previous), previous.zoom * factor, anchorFor(event.clientX, event.clientY)));
      setNudging(true);
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(() => setNudging(false), 260);
    }
  }, [phase, fit, zoomTo]);

  useEffect(() => {
    if (phase === "crop") circleRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const dragDepth = useRef(0);
  const isFileDrag = (event: ReactDragEvent<HTMLDivElement>) =>
    Array.from(event.dataTransfer?.types ?? []).includes("Files");
  const dragHandlers =
    disabled || phase === "uploading"
      ? {}
      : {
          onDragEnter: (event: ReactDragEvent<HTMLDivElement>) => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            dragDepth.current += 1;
            setDropActive(true);
          },
          onDragOver: (event: ReactDragEvent<HTMLDivElement>) => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          },
          onDragLeave: () => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (!dragDepth.current) setDropActive(false);
          },
          onDrop: (event: ReactDragEvent<HTMLDivElement>) => {
            event.preventDefault();
            dragDepth.current = 0;
            setDropActive(false);
            const file = event.dataTransfer.files[0];
            if (file) selectFile(file);
          },
        };

  const cropping = phase === "crop" && !!draft;
  const busy = phase === "uploading" || phase === "failed";
  const circleSize = cropping ? 184 : size;
  const imageStyle = (kind: "ghost" | "sharp") => ({
    width: `${100 * ratio.w}%`,
    height: `${100 * ratio.h}%`,
    transform: `translate(-50%, -50%) translate(${(view.x / ratio.w) * 100}%, ${(view.y / ratio.h) * 100}%) scale(${view.zoom})`,
    opacity: kind === "ghost" ? (nudging ? 0.42 : 0.24) : 1,
  });

  const photo = busy ? pending?.url : current;
  const showPhoto = photo && failedSrc !== photo;
  const layoutTransition = reduced ? { duration: 0 } : motionTokens.spring.smooth;
  const percent = progress === null ? null : Math.round(progress * 100);

  const liveMessage: Message =
    phase === "uploading"
      ? {
          tone: "hint",
          text: (
            <>
              Uploading
              {percent === null ? "" : (
                <>
                  {" "}
                  <span className={styles.number}>{percent}%</span>
                </>
              )}
            </>
          ),
          key: "uploading",
        }
      : (message ?? { tone: "hint", text: defaultHint, key: "hint" });

  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      role="group"
      aria-labelledby={titleId}
      data-phase={phase}
      data-dragging={dropActive ? "" : undefined}
      {...dragHandlers}
    >
      <input
        ref={inputRef}
        className={styles.file}
        type="file"
        accept={accept.join(",")}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) selectFile(file);
        }}
      />
      <AutoHeight reduced={reduced}>
        <div className={styles.layout} data-mode={cropping ? "crop" : "idle"}>
          <div
            ref={stageRef}
            className={styles.stage}
            onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
              if (phase !== "crop" || event.button !== 0) return;
              springBack.current?.stop();
              event.currentTarget.setPointerCapture(event.pointerId);
              pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              snapshot();
              setNudging(true);
            }}
            onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
              if (!pointers.current.has(event.pointerId) || !gesture.current || !circleRef.current) return;
              pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
              const list = Array.from(pointers.current.values());
              const center = list.reduce(
                (total, point) => ({ x: total.x + point.x / list.length, y: total.y + point.y / list.length }),
                { x: 0, y: 0 },
              );
              const width = circleRef.current.getBoundingClientRect().width;
              const start = gesture.current;
              let next: View = {
                zoom: start.view.zoom,
                x: start.view.x + (center.x - start.center.x) / width,
                y: start.view.y + (center.y - start.center.y) / width,
              };
              if (list.length > 1 && start.distance > 0) {
                const distance = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
                next = zoomTo(next, (start.view.zoom * distance) / start.distance, anchorFor(center.x, center.y));
              }
              setView(overshoot(next));
            }}
            onPointerUp={(event) => release(event.pointerId)}
            onPointerCancel={(event) => release(event.pointerId)}
          >
            <motion.div
              className={styles.stageBackdrop}
              layout
              initial={false}
              animate={{ opacity: +!!cropping }}
              style={{ borderRadius: 26 }}
              transition={{
                layout: layoutTransition,
                opacity: {
                  duration: reduced ? 0 : motionTokens.duration.standard,
                  ease: [...motionTokens.ease.standard],
                },
              }}
              aria-hidden="true"
            />
            <motion.div
              ref={circleRef}
              layout
              transition={{ layout: layoutTransition }}
              className={styles.circle}
              style={{ width: circleSize, height: circleSize }}
              data-busy={busy ? "" : undefined}
              tabIndex={cropping ? 0 : -1}
              role={cropping ? "group" : undefined}
              aria-roledescription={cropping ? "crop area" : undefined}
              aria-label={
                cropping
                  ? `Crop area, zoom ${Math.round(100 * view.zoom)}%. Drag or use the arrow keys to move the photo, plus and minus to zoom, Enter to save, Escape to cancel.`
                  : undefined
              }
              onKeyDown={
                cropping
                  ? (event: ReactKeyboardEvent<HTMLDivElement>) => {
                      const step = event.shiftKey ? 0.1 : 0.02;
                      const moves: Record<string, [number, number]> = {
                        ArrowLeft: [-step, 0],
                        ArrowRight: [step, 0],
                        ArrowUp: [0, -step],
                        ArrowDown: [0, step],
                      };
                      const move = moves[event.key];
                      if (move) {
                        event.preventDefault();
                        const [dx, dy] = move;
                        setView((previous) => fit({ ...previous, x: previous.x + dx, y: previous.y + dy }));
                      } else if (event.key === "+" || event.key === "=") {
                        event.preventDefault();
                        setView((previous) => zoomTo(previous, previous.zoom + 0.2));
                      } else if (event.key === "-" || event.key === "_") {
                        event.preventDefault();
                        setView((previous) => zoomTo(previous, previous.zoom - 0.2));
                      } else if (event.key === "0") {
                        event.preventDefault();
                        setView({ zoom: 1, x: 0, y: 0 });
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        void save();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        cancelCrop();
                      }
                    }
                  : undefined
              }
            >
              {cropping ? (
                <img className={styles.ghost} src={draft.url} alt="" draggable={false} style={imageStyle("ghost")} />
              ) : null}
              <motion.div
                className={styles.clip}
                initial={false}
                animate={{ scale: busy ? 0.9 : 1 }}
                transition={
                  reduced ? { duration: 0 } : busy ? motionTokens.spring.smooth : motionTokens.spring.snappy
                }
              >
                <AnimatePresence initial={false}>
                  {cropping ? (
                    <motion.img
                      key={`draft:${draft.url}`}
                      className={styles.cropImage}
                      src={draft.url}
                      alt=""
                      draggable={false}
                      style={imageStyle("sharp")}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduced ? 0 : motionTokens.duration.standard }}
                    />
                  ) : showPhoto ? (
                    <motion.img
                      key={`photo:${photo}`}
                      className={styles.photo}
                      src={photo}
                      alt=""
                      draggable={false}
                      onError={() => setFailedSrc(photo)}
                      initial={
                        reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${motionTokens.blur.soft}px)` }
                      }
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: reduced ? 0 : motionTokens.duration.standard,
                        ease: [...motionTokens.ease.enter],
                      }}
                    />
                  ) : (
                    <motion.span
                      key="initials"
                      className={styles.initials}
                      style={{ fontSize: Math.round(0.3 * size) }}
                      aria-hidden="true"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduced ? 0 : motionTokens.duration.standard }}
                    >
                      {name
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase())
                        .join("")}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              {!cropping && !busy ? (
                <button
                  type="button"
                  className={styles.hit}
                  onClick={openPicker}
                  disabled={disabled}
                  aria-label={current ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
                >
                  <span className={styles.hitIcon} aria-hidden="true">
                    {dropActive ? <ImagePlus size={20} strokeWidth={1.75} /> : <Camera size={20} strokeWidth={1.75} />}
                  </span>
                </button>
              ) : null}
              {busy ? <ProgressRing progress={progress} failed={phase === "failed"} reduced={reduced} /> : null}
              <SettleRing count={settleCount} reduced={reduced} />
            </motion.div>
          </div>
          <motion.div layout="position" transition={{ layout: layoutTransition }} className={styles.side}>
            <motion.div
              className={styles.sideContent}
              initial={!reduced && { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: motionTokens.duration.standard,
                ease: [...motionTokens.ease.standard],
              }}
            >
              <p id={titleId} className={styles.title}>
                {cropping ? "Adjust photo" : label}
              </p>
              {cropping ? (
                <>
                  <p className={styles.hint}>Drag to reposition. Scroll or pinch to zoom.</p>
                  <div className={styles.zoom}>
                    <button
                      type="button"
                      className={styles.zoomButton}
                      aria-label="Zoom out"
                      disabled={view.zoom <= 1}
                      onClick={() => setView((previous) => zoomTo(previous, previous.zoom - 0.25))}
                    >
                      <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <input
                      className={styles.range}
                      type="range"
                      min={1}
                      max={4}
                      step={0.01}
                      value={view.zoom}
                      aria-label="Zoom"
                      aria-valuetext={`${Math.round(100 * view.zoom)}%`}
                      style={{ "--fill": `${((view.zoom - 1) / 3) * 100}%` } as CSSProperties}
                      onPointerDown={() => setNudging(true)}
                      onPointerUp={() => setNudging(false)}
                      onBlur={() => setNudging(false)}
                      onChange={(event) => {
                        const zoom = Number(event.target.value);
                        setView((previous) => zoomTo(previous, zoom));
                      }}
                    />
                    <button
                      type="button"
                      className={styles.zoomButton}
                      aria-label="Zoom in"
                      disabled={view.zoom >= 4}
                      onClick={() => setView((previous) => zoomTo(previous, previous.zoom + 0.25))}
                    >
                      <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={styles.solid} onClick={() => void save()}>
                      Save photo
                    </button>
                    <button type="button" className={styles.ghostButton} onClick={cancelCrop}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <StatusMessage message={liveMessage} reduced={reduced} />
                  <div className={styles.actions}>
                    {phase === "uploading" ? (
                      <button type="button" className={styles.outline} onClick={cancelUpload}>
                        Cancel upload
                      </button>
                    ) : phase === "failed" ? (
                      <>
                        <button
                          type="button"
                          className={styles.solid}
                          onClick={() => {
                            if (pending) void runUpload(pending);
                          }}
                        >
                          Try again
                        </button>
                        <button type="button" className={styles.ghostButton} onClick={cancelUpload}>
                          Discard
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          ref={buttonRef}
                          type="button"
                          className={styles.outline}
                          onClick={openPicker}
                          disabled={disabled}
                        >
                          <span className={styles.stack}>
                            <span aria-hidden="true" className={styles.sizer}>
                              Upload photo
                            </span>
                            <span aria-hidden="true" className={styles.sizer}>
                              Replace photo
                            </span>
                            <span>{current ? "Replace photo" : "Upload photo"}</span>
                          </span>
                        </button>
                        <AnimatePresence initial={false} mode="popLayout">
                          {current && onRemove ? (
                            <motion.button
                              key="remove"
                              type="button"
                              className={styles.ghostButton}
                              onClick={() => {
                                revoke(current);
                                setCurrent(undefined);
                                onRemove();
                                flash({ tone: "hint", text: "Photo removed", key: `removed:${Date.now()}` }, 2200);
                                requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }));
                              }}
                              disabled={disabled}
                              initial={{ opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
                              animate={{ opacity: 1, filter: "blur(0px)" }}
                              exit={{ opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` }}
                              transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}
                            >
                              Remove
                            </motion.button>
                          ) : null}
                        </AnimatePresence>
                      </>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        </div>
      </AutoHeight>
      <span className={styles.srOnly} aria-live="polite">
        {phase === "uploading" && percent !== null && percent >= 25
          ? `Uploading ${25 * Math.floor(percent / 25)}%`
          : ""}
      </span>
    </div>
  );
};

export default AvatarUpload;

/** Springs the block's height to the content, so the circle can travel without the page jumping. */
function AutoHeight({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div
      className={styles.autoHeight}
      initial={false}
      animate={{ height }}
      transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/** One message at a time, swapped without reflow; errors pair an icon with a sentence. */
function StatusMessage({ message, reduced }: { message: Message; reduced: boolean }) {
  return (
    <div className={styles.message} aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.p
          key={message.key}
          className={styles.messageText}
          data-tone={message.tone}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4, filter: `blur(${motionTokens.blur.subtle}px)` }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={
            reduced
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: 3,
                  filter: `blur(${motionTokens.blur.subtle}px)`,
                  transition: { duration: motionTokens.duration.instant },
                }
          }
          transition={{ duration: reduced ? 0 : motionTokens.duration.standard, ease: [...motionTokens.ease.enter] }}
        >
          {message.tone === "error" ? (
            <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
          ) : message.tone === "success" ? (
            <Check size={14} strokeWidth={2} aria-hidden="true" />
          ) : null}
          <span>{message.text}</span>
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Turns while waiting, fills with reported progress, turns to the danger color on failure. */
function ProgressRing({ progress, failed, reduced }: { progress: number | null; failed: boolean; reduced: boolean }) {
  return (
    <motion.svg
      className={styles.ring}
      data-state={failed ? "failed" : progress === null ? "waiting" : "progress"}
      viewBox="0 0 100 100"
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}
    >
      <circle className={styles.ringTrack} cx="50" cy="50" r="48" pathLength={1} />
      <motion.circle
        className={styles.ringValue}
        cx="50"
        cy="50"
        r="48"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: progress === null ? 0.22 : Math.max(0.02, progress) }}
        transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}
      />
    </motion.svg>
  );
}

/** After success a second full ring widens by 12% and fades while the photo springs back to full size. */
function SettleRing({ count, reduced }: { count: number; reduced: boolean }) {
  if (!count || reduced) return null;
  return (
    <motion.svg
      key={count}
      className={styles.ring}
      data-state="settle"
      viewBox="0 0 100 100"
      aria-hidden="true"
      initial={{ opacity: 1, scale: 1 }}
      animate={{ opacity: 0, scale: 1.12 }}
      transition={{ duration: motionTokens.duration.considered, ease: [...motionTokens.ease.enter] }}
    >
      <circle className={styles.ringValue} cx="50" cy="50" r="48" />
    </motion.svg>
  );
}
