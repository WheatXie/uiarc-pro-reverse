"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { flushSync } from "react-dom";
import { useReducedMotion } from "motion/react";
import { ArrowUp, Check, ChevronUp, Play, X } from "lucide-react";
import styles from "./link-unfurl.module.css";

/** A link preview: the unfolded card and the chip that stands in for it. */
export interface LinkUnfurlPreview {
  /** Destination the chip and the card title point at. */
  url: string;
  /** Site name shown in the chip, the card head and the sample buttons. */
  site: string;
  /** Headline of the card. */
  title: string;
  /** One or two lines of supporting copy, clamped to two lines. */
  description?: string;
  /** Lead image for the card. The card waits for it to decode before unfolding. */
  image?: string;
  /** Alt text for `image`. Decorative when omitted. */
  imageAlt?: string;
  /** Small mark shown inside the chip and the card head. Falls back to the site initial. */
  favicon?: string;
  /** Media length, e.g. `"2:51:06"`. Adds the play badge over the image. */
  duration?: string;
}

/** What the composer hands to `onSend`. */
export interface LinkUnfurlMessage {
  /** Plain text of the message, with every chip expanded back to its URL. */
  text: string;
  /** Every resolved preview, in the order the links appear. */
  links: LinkUnfurlPreview[];
}

export interface LinkUnfurlProps {
  /** Accessible name of the composer. */
  label?: string;
  /** Placeholder shown while the message is empty. */
  placeholder?: string;
  /** Text the composer starts with. */
  defaultValue?: string;
  /** Sample links offered in the toolbar. */
  samples?: LinkUnfurlPreview[];
  /**
   * Resolve a pasted URL into a preview. Return `null` to mark the link as
   * failed. Without it the composer fakes a lookup against `samples`.
   */
  resolve?: (url: string, signal: AbortSignal) => Promise<LinkUnfurlPreview | null | undefined> | LinkUnfurlPreview | null | undefined;
  /** Unfold a freshly resolved preview immediately. */
  autoExpand?: boolean;
  /** Insert the first sample link once the composer scrolls into view. */
  autoPlay?: boolean;
  /** Playback rate of the unfold springs and the fake lookup. */
  speed?: number;
  /** Freeze every spring and animation in place. */
  paused?: boolean;
  /** Accent colour for the chip tint, the caret and the loading shine. */
  accent?: string;
  /** Accessible name of the send button. */
  sendLabel?: string;
  /** Called with the message when the send button or Enter is used. */
  onSend?: (message: LinkUnfurlMessage) => void | Promise<void>;
  className?: string;
  style?: CSSProperties;
}

type LinkStatus = "loading" | "ready" | "failed";
type SendState = "idle" | "pending" | "sent";

interface LinkEntry {
  id: string;
  url: string;
  status: LinkStatus;
  expanded: boolean;
  preview?: LinkUnfurlPreview;
}

interface Spring {
  p: number;
  v: number;
  target: 0 | 1;
  wrap: HTMLDivElement | null;
  plate: HTMLDivElement | null;
  card: HTMLElement | null;
  body: HTMLDivElement | null;
  media: HTMLImageElement | null;
  dragging: boolean;
  settle: (() => void) | null;
}

interface DragState {
  id: string;
  y: number;
  p: number;
  t: number;
  H: number;
  moved: boolean;
  pointer: number;
}

const DEFAULT_SAMPLES: LinkUnfurlPreview[] = [
  {
    url: "https://www.airbnb.com/rooms/48213907",
    site: "Airbnb",
    title: "Rooftop loft in Alfama with river views",
    description: "Entire loft for 8 guests. 4 bedrooms, a shared terrace, and a 6 minute walk to the tram.",
    image: "/media/photos/lisbon-rooftops.jpg",
    imageAlt: "Terracotta rooftops of Lisbon stepping down to the river",
    favicon: "/block-logos/airbnb-color.svg",
  },
  {
    url: "https://www.figma.com/design/q8Rk2/Offsite-itinerary",
    site: "Figma",
    title: "Offsite itinerary, day by day",
    description: "Design file with 14 frames. Edited by Sofia Ramirez 2 hours ago.",
    image: "/media/photos/lisbon-tram.jpg",
    imageAlt: "A yellow tram climbing a narrow Lisbon street",
    favicon: "/block-logos/figma-color.svg",
  },
  {
    url: "https://open.spotify.com/playlist/3cEYpjA9oz9GiPac4AsH4n",
    site: "Spotify",
    title: "Lisbon evenings",
    description: "Playlist by Daniel Kim. 42 songs, 2 hr 51 min.",
    image: "/media/photos/sea-at-dusk.jpg",
    imageAlt: "The sea at dusk under a soft pink sky",
    favicon: "/block-logos/spotify-color.svg",
    duration: "2:51:06",
  },
];

const URL_PATTERN = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/[^\s]*)?$/i;
const URL_IN_TEXT = /(?:^|\s)(https?:\/\/[^\s]+|www\.[^\s]+)\s$/i;
const EASE_OUT = "cubic-bezier(.16, 1, .3, 1)";
const EASE_STANDARD = "cubic-bezier(.22, 1, .36, 1)";
const EASE_IN = "cubic-bezier(.7, 0, .84, 0)";

const GLOBE_SVG =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="8" cy="8" r="6.3"/><path d="M1.9 8h12.2M8 1.7c1.8 1.9 2.6 3.9 2.6 6.3S9.8 12.4 8 14.3M8 1.7C6.2 3.6 5.4 5.6 5.4 8s.8 4.4 2.6 6.3"/></svg>';
const BROKEN_SVG =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M6.6 4.2 7.8 3a3 3 0 0 1 4.2 4.2l-1.2 1.2M9.4 11.8 8.2 13A3 3 0 0 1 4 8.8l1.2-1.2M2.5 2.5l11 11"/></svg>';

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const addressOf = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

const sameUrl = (a: string, b: string) => addressOf(a).toLowerCase() === addressOf(b).toLowerCase();

/** Fallback preview built from the URL itself, used when no sample matches. */
function previewFromUrl(url: string): LinkUnfurlPreview {
  const site = hostOf(url);
  let title = site;
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (last) {
      const words = decodeURIComponent(last)
        .replace(/\.[a-z]+$/i, "")
        .replace(/[-_+]+/g, " ")
        .trim();
      if (words && /[a-z]/i.test(words)) title = words.charAt(0).toUpperCase() + words.slice(1);
    }
  } catch {
    /* keep the host as the title */
  }
  return { url, site, title, description: addressOf(url) };
}

/**
 * Message composer that turns a pasted link into a chip and unfolds it into a
 * preview card. Enter sends, Shift + Enter adds a line, Alt + Enter folds or
 * unfolds the link before the caret, and clicking a chip toggles its card.
 */
export function LinkUnfurl({
  label = "Message #lisbon-offsite",
  placeholder = "Message #lisbon-offsite",
  defaultValue = "Found a place for the offsite, take a look",
  samples = DEFAULT_SAMPLES,
  resolve,
  autoExpand = true,
  autoPlay = true,
  speed = 1,
  paused = false,
  accent,
  sendLabel = "Send message",
  onSend,
  className,
  style,
}: LinkUnfurlProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const hintId = `${uid}-hint`;

  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [empty, setEmpty] = useState(!defaultValue);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [error, setError] = useState("");
  const [initialHtml] = useState(() => ({
    __html: defaultValue.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + (defaultValue ? " " : ""),
  }));

  const linksRef = useRef(links);
  useLayoutEffect(() => {
    linksRef.current = links;
  }, [links]);

  const springs = useRef(new Map<string, Spring>());
  const controllers = useRef(new Map<string, AbortController>());
  const counter = useRef(0);
  const interacted = useRef(false);
  const alive = useRef(true);
  const running = useRef(true);
  const savedRange = useRef<Range | null>(null);
  const options = useRef({ reduce: reduced, paused, speed, autoExpand, resolve, samples, onSend });

  useLayoutEffect(() => {
    options.current = { reduce: reduced, paused, speed, autoExpand, resolve, samples, onSend };
  });

  const tickRef = useRef<(time: number) => void>(() => {});
  const rafRef = useRef(0);
  const lastTime = useRef(0);
  const drag = useRef<DragState | null>(null);

  const animated = () => running.current && !options.current.reduce && !options.current.paused;

  const chipFor = (id: string) => editorRef.current?.querySelector<HTMLElement>(`[data-link-id="${id}"]`) ?? null;

  const announce = (message: string) => setAnnouncement((prev) => (prev === message ? `${message}\xa0` : message));

  /** Write one frame of geometry for every folded or unfolded link. */
  const frame = useCallback(() => {
    const editor = editorRef.current;
    const rows: Array<{
      spring: Spring;
      wrap: HTMLDivElement;
      plate: HTMLDivElement;
      card: HTMLElement;
      W: number;
      H: number;
      sx: number;
      sy: number;
      sw: number;
      sh: number;
      tx: number;
      ty: number;
      chip: HTMLElement | null;
    }> = [];

    springs.current.forEach((spring, id) => {
      if (!spring.wrap || !spring.plate || !spring.card) return;
      const { wrap, plate, card } = spring;
      const W = card.offsetWidth;
      const H = spring.card.offsetHeight;
      const wrapBox = wrap.getBoundingClientRect();
      const chip = editor?.querySelector<HTMLElement>(`[data-link-id="${id}"]`) ?? null;
      const inner = chip?.firstElementChild as HTMLElement | null | undefined;
      const fav = card.querySelector<HTMLElement>("[data-fav]");

      let sx = 0;
      let sy = 0;
      let sw = Math.min(W, 132);
      let sh = 26;
      let tx = 0;
      let ty = 0;

      if (inner && inner.isConnected && fav && inner.firstElementChild) {
        const chipBox = inner.getBoundingClientRect();
        const favBox = inner.firstElementChild.getBoundingClientRect();
        sx = fav.offsetLeft - (favBox.left - chipBox.left);
        sy = fav.offsetTop - (favBox.top - chipBox.top);
        sw = Math.min(chipBox.width, W - Math.max(0, sx));
        sh = Math.min(chipBox.height, H);
        tx = chipBox.left - wrapBox.left - sx;
        ty = chipBox.top - wrapBox.top - sy;
      }

      rows.push({ spring, wrap, plate, card, W, H, sx, sy, sw, sh, tx, ty, chip });
    });

    for (const row of rows) {
      const { spring, W, H } = row;
      const p = clamp01(spring.p);
      const lift = 1 - Math.pow(1 - p, 1.6);
      const grow = Math.pow(p, 1.35);
      const left = row.sx * (1 - lift);
      const width = row.sw + (W - row.sw) * lift;
      const top = row.sy * (1 - grow);
      const height = row.sh + (H - row.sh) * grow;
      const dx = row.tx * (1 - lift);
      const dy = row.ty * (1 - grow);
      const radius = row.sh / 2 + (18 - row.sh / 2) * p;
      const opacity = clamp01(p / 0.1);
      const visible = p > 5e-4;

      row.wrap.style.height = `${((H + 10) * grow).toFixed(2)}px`;

      const plate = row.plate.style;
      plate.transform = `translate3d(${(left + dx).toFixed(2)}px, ${(top + dy).toFixed(2)}px, 0)`;
      plate.width = `${width.toFixed(2)}px`;
      plate.height = `${height.toFixed(2)}px`;
      plate.borderRadius = `${radius.toFixed(2)}px`;
      plate.opacity = String(opacity);
      plate.setProperty("--lift", (p > 0 && p < 1 ? Math.sin(Math.PI * p) : 0).toFixed(3));

      const card = row.card;
      card.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
      card.style.clipPath = `inset(${top.toFixed(2)}px ${(W - left - width).toFixed(2)}px ${(H - top - height).toFixed(2)}px ${left.toFixed(2)}px round ${radius.toFixed(2)}px)`;
      card.style.opacity = String(opacity);
      card.style.visibility = visible ? "visible" : "hidden";
      if (card.inert !== !visible) card.inert = !visible;

      if (spring.body) spring.body.style.opacity = clamp01((grow - 0.15) / 0.55).toFixed(3);
      if (spring.media) spring.media.style.transform = `scale(${(1.08 - 0.08 * grow).toFixed(4)})`;
      if (row.chip) row.chip.dataset.expanded = spring.target === 1 ? "true" : "false";
    }
  }, []);

  /** One animation frame: advance every spring, then paint. */
  const tick = useCallback(
    (time: number) => {
      rafRef.current = 0;
      const dt = lastTime.current ? Math.min(0.034, Math.max(0.001, (time - lastTime.current) / 1000)) : 1 / 60;
      lastTime.current = time;

      const rate = options.current.speed || 1;
      let moving = false;
      const settles: Array<() => void> = [];

      springs.current.forEach((spring) => {
        if (!spring.card) return;
        if (spring.dragging) {
          moving = true;
          return;
        }
        if (spring.p === spring.target && spring.v === 0) {
          if (spring.settle) {
            settles.push(spring.settle);
            spring.settle = null;
          }
          return;
        }
        const omega = (spring.target === 1 ? 9.5 : 13) * rate;
        const accel = -omega * omega * (spring.p - spring.target) - 2 * omega * spring.v;
        spring.v += accel * dt;
        spring.p += spring.v * dt;
        if (Math.abs(spring.p - spring.target) < 3e-4 && Math.abs(spring.v) < 0.01) {
          spring.p = spring.target;
          spring.v = 0;
        }
        moving = true;
      });

      frame();
      settles.forEach((settle) => settle());
      if (moving) rafRef.current = requestAnimationFrame((time) => tickRef.current(time));
    },
    [frame],
  );

  useLayoutEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  /** Start the loop, or snap everything to its target when motion is off. */
  const wake = useCallback(() => {
    if (!animated()) {
      const settles: Array<() => void> = [];
      springs.current.forEach((spring) => {
        if (spring.dragging || !spring.card) return;
        spring.p = spring.target;
        spring.v = 0;
        if (spring.settle) {
          settles.push(spring.settle);
          spring.settle = null;
        }
      });
      frame();
      settles.forEach((settle) => settle());
      return;
    }
    if (!rafRef.current) {
      lastTime.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [frame, tick]);

  const springFor = (id: string) => {
    let spring = springs.current.get(id);
    if (!spring) {
      spring = {
        p: 0,
        v: 0,
        target: 0,
        wrap: null,
        plate: null,
        card: null,
        body: null,
        media: null,
        dragging: false,
        settle: null,
      };
      springs.current.set(id, spring);
    }
    return spring;
  };

  const partRef = (id: string, key: "wrap" | "plate" | "card" | "body" | "media") => (node: HTMLElement | null) => {
    if (!node) return;
    const spring = springFor(id);
    if (spring[key] !== node) {
      // Each key holds a single element per link; the union is narrowed by the caller.
      (spring as unknown as Record<string, HTMLElement | null>)[key] = node;
      if (spring.wrap && spring.plate && spring.card) wake();
    }
  };

  const setExpanded = useCallback(
    (id: string, expanded: boolean, notify = true) => {
      const link = linksRef.current.find((entry) => entry.id === id);
      if (!link || link.status !== "ready") return;
      setLinks((prev) => prev.map((entry) => (entry.id === id ? { ...entry, expanded } : entry)));
      const spring = springFor(id);
      spring.target = expanded ? 1 : 0;
      spring.settle = null;
      const chip = chipFor(id);
      if (chip) chip.dataset.expanded = expanded ? "true" : "false";
      if (notify && link.preview) {
        announce(
          expanded
            ? `Preview shown. ${link.preview.site}, ${link.preview.title}.`
            : `Preview collapsed into the link. ${link.preview.title}.`,
        );
      }
      wake();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wake],
  );

  const removeLink = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    springs.current.delete(id);
    setLinks((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  /** Swap the chip's spinner for a broken-link glyph and mark it failed. */
  const markFailed = (id: string) => {
    const chip = chipFor(id);
    if (!chip) return;
    chip.dataset.status = "failed";
    const fav = chip.firstElementChild?.firstElementChild;
    if (fav) fav.innerHTML = BROKEN_SVG;
    chip.setAttribute("aria-label", `${addressOf(chip.dataset.url ?? "")}, no preview. Click to try again.`);
  };

  /** Write a resolved preview into its chip and slide the chip to its new width. */
  const applyChip = (id: string, preview: LinkUnfurlPreview) => {
    const wrap = chipFor(id);
    if (!wrap) return;
    wrap.dataset.status = "ready";
    const chip = wrap.firstElementChild as HTMLElement;
    const fav = chip.firstElementChild as HTMLElement;
    const label = chip.lastElementChild as HTMLElement;
    const from = chip.getBoundingClientRect().width;

    fav.textContent = "";
    if (preview.favicon) {
      const img = document.createElement("img");
      img.src = preview.favicon;
      img.alt = "";
      img.width = 16;
      img.height = 16;
      img.draggable = false;
      fav.appendChild(img);
    } else {
      fav.textContent = preview.site.charAt(0).toUpperCase();
      fav.dataset.mono = "true";
    }
    label.textContent = preview.title;
    wrap.setAttribute("aria-label", `${preview.title}, ${preview.site} link`);

    if (!animated()) return;
    const to = chip.getBoundingClientRect().width;
    const duration = 340 / (options.current.speed || 1);
    chip.animate([{ width: `${from}px` }, { width: `${to}px` }], { duration, easing: EASE_OUT });
    label.animate(
      [
        { opacity: 0, transform: "translateY(5px)", filter: "blur(2px)" },
        { opacity: 1, transform: "none", filter: "blur(0)" },
      ],
      { duration, easing: EASE_OUT },
    );
    fav.animate([{ transform: "scale(.6)", opacity: 0 }, { transform: "none", opacity: 1 }], {
      duration: 0.8 * duration,
      easing: EASE_OUT,
    });
  };

  /** Resolve a link into a preview, then fold or unfold the card. */
  const resolvePreview = useCallback(
    (id: string, url: string) => {
      controllers.current.get(id)?.abort();
      const controller = new AbortController();
      controllers.current.set(id, controller);
      const { resolve: resolver, samples: catalog, speed: rate } = options.current;

      const pending: Promise<LinkUnfurlPreview | null | undefined> = resolver
        ? Promise.resolve(resolver(url, controller.signal))
        : (async () => {
            await new Promise<void>((done, fail) => {
              const timer = window.setTimeout(done, 1150 / (rate || 1));
              controller.signal.addEventListener(
                "abort",
                () => {
                  window.clearTimeout(timer);
                  fail(new Error("aborted"));
                },
                { once: true },
              );
            });
            return catalog.find((entry) => sameUrl(entry.url, url)) ?? previewFromUrl(url);
          })();

      pending
        .then(async (result) => {
          if (result?.image) {
            const image = new Image();
            image.src = result.image;
            await Promise.race([
              image.decode().catch(() => undefined),
              new Promise((done) => window.setTimeout(done, 1500)),
            ]);
          }
          return result;
        })
        .then((result) => {
          if (!alive.current || controller.signal.aborted || !linksRef.current.some((entry) => entry.id === id)) return;
          controllers.current.delete(id);

          if (!result) {
            markFailed(id);
            setLinks((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status: "failed" } : entry)));
            announce(`No preview for ${hostOf(url)}. The link stays in the message.`);
            return;
          }

          const preview = { ...result, url: result.url || url };
          applyChip(id, preview);
          const expand = options.current.autoExpand;
          setLinks((prev) =>
            prev.map((entry) => (entry.id === id ? { ...entry, status: "ready", preview, expanded: expand } : entry)),
          );
          springFor(id).target = expand ? 1 : 0;
          const chip = chipFor(id);
          if (chip) chip.dataset.expanded = expand ? "true" : "false";
          announce(expand ? `Preview shown. ${preview.site}, ${preview.title}.` : `Preview ready for ${preview.title}.`);
          wake();
        })
        .catch(() => {
          if (!alive.current || controller.signal.aborted || !linksRef.current.some((entry) => entry.id === id)) return;
          markFailed(id);
          setLinks((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status: "failed" } : entry)));
          announce(`Could not load a preview for ${hostOf(url)}. Click the link to try again.`);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wake],
  );

  const syncEmpty = () => {
    const editor = editorRef.current;
    if (editor) setEmpty(!editor.textContent?.trim() && !editor.querySelector("[data-link-id]"));
  };

  /** Insert a chip at the caret (or at the end) and start resolving it. */
  const insertLink = useCallback(
    (raw: string, placement: "caret" | "end" = "caret") => {
      const editor = editorRef.current;
      if (!editor) return;

      const trimmed = raw.trim();
      const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const id = `lu${++counter.current}`;
      const selection = window.getSelection();
      const live = selection && selection.rangeCount ? selection.getRangeAt(0) : null;

      let range: Range;
      if (placement === "caret" && live && editor.contains(live.commonAncestorContainer)) {
        range = live;
      } else if (placement === "caret" && savedRange.current && editor.contains(savedRange.current.commonAncestorContainer)) {
        range = savedRange.current.cloneRange();
      } else {
        range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
      }
      range.deleteContents();

      // Keep one space between the preceding word and the chip.
      let lead = "";
      const startNode = range.startContainer;
      const startOffset = range.startOffset;
      if (startNode.nodeType === Node.TEXT_NODE) {
        if (startOffset > 0 && !/\s/.test((startNode as Text).data.charAt(startOffset - 1))) lead = " ";
      } else if (startOffset > 0) {
        const before = startNode.childNodes[startOffset - 1];
        if (before && (before.nodeType !== Node.TEXT_NODE || !/\s$/.test((before as Text).data))) lead = " ";
      }

      const space = document.createTextNode(" ");

      const wrap = document.createElement("span");
      wrap.className = styles.chipWrap;
      wrap.contentEditable = "false";
      wrap.dataset.linkId = id;
      wrap.dataset.url = url;
      wrap.dataset.status = "loading";
      wrap.setAttribute("aria-label", `${addressOf(url)}, loading preview`);

      const chip = document.createElement("span");
      chip.className = styles.chip;
      const fav = document.createElement("span");
      fav.className = styles.chipFav;
      fav.innerHTML = GLOBE_SVG;
      const text = document.createElement("span");
      text.className = styles.chipLabel;
      text.textContent = addressOf(url);
      chip.appendChild(fav);
      chip.appendChild(text);
      wrap.appendChild(chip);

      range.insertNode(space);
      range.insertNode(wrap);
      if (lead) range.insertNode(document.createTextNode(lead));

      const caret = document.createRange();
      caret.setStart(space, 1);
      caret.collapse(true);
      savedRange.current = caret.cloneRange();
      if (document.activeElement === editor && selection) {
        selection.removeAllRanges();
        selection.addRange(caret);
      }

      setLinks((prev) => [...prev, { id, url, status: "loading", expanded: false }]);
      setEmpty(false);
      announce(`Link added. Loading a preview for ${hostOf(url)}.`);
      resolvePreview(id, url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvePreview],
  );

  /** Remove a link: fold its card first, then drop the chip and the extra space. */
  const remove = useCallback(
    (id: string) => {
      const link = linksRef.current.find((entry) => entry.id === id);
      const drop = () => {
        const chip = chipFor(id);
        const next = chip?.nextSibling;
        if (next && next.nodeType === Node.TEXT_NODE && (next as Text).data.startsWith(" ")) (next as Text).deleteData(0, 1);
        chip?.remove();
        removeLink(id);
        syncEmpty();
      };
      const spring = springs.current.get(id);
      if (spring && spring.card && spring.p > 0) {
        spring.target = 0;
        spring.settle = drop;
        setLinks((prev) => prev.map((entry) => (entry.id === id ? { ...entry, expanded: false } : entry)));
        wake();
      } else {
        drop();
      }
      announce(`Link removed${link?.preview ? `. ${link.preview.title}` : ""}.`);
      editorRef.current?.focus({ preventScroll: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [removeLink, wake],
  );

  const toggle = useCallback(
    (id: string) => {
      const link = linksRef.current.find((entry) => entry.id === id);
      if (!link) return;
      if (link.status === "failed") {
        const chip = chipFor(id);
        if (chip) {
          chip.dataset.status = "loading";
          const fav = chip.firstElementChild?.firstElementChild;
          if (fav) fav.innerHTML = GLOBE_SVG;
        }
        setLinks((prev) => prev.map((entry) => (entry.id === id ? { ...entry, status: "loading" } : entry)));
        announce(`Trying again for ${hostOf(link.url)}.`);
        resolvePreview(id, link.url);
        return;
      }
      if (link.status === "loading") {
        announce(`Still loading the preview for ${hostOf(link.url)}.`);
        return;
      }
      setExpanded(id, !link.expanded);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvePreview, setExpanded],
  );

  const rememberSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (editor && selection && selection.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
    }
  };

  /** Read the message back out of the DOM, chips expanded to their URLs. */
  const readMessage = () => {
    let out = "";
    const walk = (node: Node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          out += (child as Text).data;
        } else if (child instanceof HTMLElement) {
          if (child.dataset.url) out += child.dataset.url;
          else {
            if (child.tagName === "BR") out += "\n";
            if (child.tagName === "DIV" && out && !out.endsWith("\n")) out += "\n";
            walk(child);
          }
        }
      });
    };
    if (editorRef.current) walk(editorRef.current);
    return out.replace(/\u00a0/g, " ").trim();
  };

  const send = async () => {
    const text = readMessage();
    if (!text || sendState === "pending") {
      if (!text) announce("Write a message or paste a link first.");
      return;
    }

    interacted.current = true;
    setError("");
    const message: LinkUnfurlMessage = {
      text,
      links: linksRef.current.filter((entry) => entry.preview).map((entry) => entry.preview as LinkUnfurlPreview),
    };

    setSendState("pending");
    try {
      await Promise.resolve(options.current.onSend?.(message));
    } catch (cause) {
      if (!alive.current) return;
      setSendState("idle");
      setError(cause instanceof Error && cause.message ? cause.message : "The message could not be sent. Try again.");
      return;
    }
    if (!alive.current) return;

    const clear = () => {
      controllers.current.forEach((controller) => controller.abort());
      controllers.current.clear();
      springs.current.clear();
      if (editorRef.current) editorRef.current.textContent = "";
      savedRange.current = null;
      setLinks([]);
      setEmpty(true);
    };

    const content = contentRef.current;
    if (content && animated()) {
      const out = content.animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "translateY(-8px)" },
        ],
        { duration: 180, easing: EASE_IN, fill: "forwards" },
      );
      out.onfinish = () => {
        const before = content.offsetHeight;
        flushSync(clear);
        const after = content.offsetHeight;
        out.cancel();
        if (before !== after) {
          content.animate(
            [
              { height: `${before}px`, overflow: "hidden" },
              { height: `${after}px`, overflow: "hidden" },
            ],
            { duration: 480, easing: EASE_STANDARD },
          );
        }
        content.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 240,
          delay: 120,
          easing: EASE_STANDARD,
          fill: "backwards",
        });
      };
    } else {
      clear();
    }

    setSendState("sent");
    announce("Message sent.");
    window.setTimeout(() => {
      if (alive.current) setSendState("idle");
    }, 1600);
  };

  const onDragMove = (event: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointer) return;
    const spring = springs.current.get(state.id);
    if (!spring) return;

    const delta = event.clientY - state.y;
    if (!state.moved) {
      if (Math.abs(delta) < 4) return;
      state.moved = true;
      spring.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      rootRef.current?.setAttribute("data-dragging", "true");
    }

    const time = event.timeStamp;
    const raw = state.p - delta / (0.8 * state.H);
    const eased = raw > 1 ? 1 + (raw - 1) * 0.08 : clamp01(raw);
    const dt = Math.max(1, time - state.t) / 1000;
    spring.v = 0.6 * spring.v + ((Math.min(1, eased) - spring.p) / dt) * 0.4;
    spring.p = Math.min(1, eased);
    state.t = time;
    if (animated()) wake();
    else frame();
  };

  const onDragEnd = (event: React.PointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointer) return;
    drag.current = null;
    const spring = springs.current.get(state.id);
    rootRef.current?.removeAttribute("data-dragging");
    if (spring && state.moved) {
      spring.dragging = false;
      if (spring.v < -1.4 || (spring.p < 0.62 && spring.v < 1.2)) setExpanded(state.id, false);
      else {
        spring.target = 1;
        wake();
      }
    }
  };

  useEffect(() => {
    alive.current = true;
    const active = controllers.current;
    return () => {
      alive.current = false;
      active.forEach((controller) => controller.abort());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let visible = true;
    const apply = () => {
      running.current = visible && !document.hidden;
      root.dataset.running = running.current ? "true" : "false";
      if (!running.current) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        wake();
      }
    };

    const intersection = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      apply();
    });
    intersection.observe(root);

    const resize = new ResizeObserver(() => {
      if (!rafRef.current) frame();
    });
    resize.observe(root);

    document.addEventListener("visibilitychange", apply);
    document.addEventListener("selectionchange", rememberSelection);

    return () => {
      intersection.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", apply);
      document.removeEventListener("selectionchange", rememberSelection);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wake, frame]);

  useLayoutEffect(() => {
    if (reduced || paused) wake();
  }, [reduced, paused, wake]);

  useEffect(() => {
    const root = rootRef.current;
    if (!autoPlay || paused || !samples.length || !root) return;
    let timer = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[entries.length - 1].isIntersecting) return;
        observer.disconnect();
        timer = window.setTimeout(() => {
          if (interacted.current || !alive.current) return;
          if (linksRef.current.some((entry) => sameUrl(entry.url, samples[0].url))) return;
          insertLink(samples[0].url, "end");
        }, 650 * (reduced ? 0 : 1));
      },
      { threshold: 0.5 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hot = (id: string, on: boolean) => {
    const chip = chipFor(id);
    if (!chip) return;
    if (on) chip.dataset.hot = "true";
    else delete chip.dataset.hot;
  };

  const rootStyle: CSSProperties & Record<`--${string}`, string> = {
    ...style,
    ...(accent ? { "--lu-accent": accent } : null),
  };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-running="true"
      data-reduced={reduced || paused ? "true" : undefined}
    >
      <div className={styles.composer}>
        <div ref={contentRef} className={styles.content}>
          <div
            ref={editorRef}
            className={styles.editor}
            role="textbox"
            aria-multiline="true"
            aria-label={label}
            aria-describedby={hintId}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            data-empty={empty ? "true" : "false"}
            data-placeholder={placeholder}
            dangerouslySetInnerHTML={initialHtml}
            onPaste={(event) => {
              event.preventDefault();
              interacted.current = true;
              const text = event.clipboardData.getData("text/plain");
              if (!text) return;
              if (URL_PATTERN.test(text.trim())) insertLink(text.trim());
              else document.execCommand("insertText", false, text);
            }}
            onInput={(event) => {
              interacted.current = true;
              if (!editorRef.current) return;

              // Chips deleted with the keyboard or by an undo leave their card behind.
              for (const link of linksRef.current) {
                if (chipFor(link.id)) continue;
                const spring = springs.current.get(link.id);
                if (spring && spring.card && spring.p > 0) {
                  spring.target = 0;
                  spring.settle = () => removeLink(link.id);
                  wake();
                } else {
                  removeLink(link.id);
                }
                announce("Link removed.");
              }

              const native = event.nativeEvent;
              if (native.inputType === "insertText" && native.data === " ") {
                const selection = window.getSelection();
                const node = selection?.anchorNode;
                if (node && node.nodeType === Node.TEXT_NODE && selection) {
                  const textNode = node as Text;
                  const caret = selection.anchorOffset;
                  const typed = textNode.data
                    .slice(0, caret)
                    .match(URL_IN_TEXT);
                  if (typed && URL_PATTERN.test(typed[1])) {
                    const start = caret - 1 - typed[1].length;
                    const range = document.createRange();
                    range.setStart(node, start);
                    range.setEnd(node, start + typed[1].length);
                    range.collapse(true);
                    textNode.deleteData(start, typed[1].length + 1);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    insertLink(typed[1]);
                  }
                }
              }
              rememberSelection();
              syncEmpty();
            }}
            onKeyDown={(event) => {
              interacted.current = true;
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;

              if (event.altKey) {
                event.preventDefault();
                const editor = editorRef.current;
                const selection = window.getSelection();
                const chips = Array.from(editor?.querySelectorAll<HTMLElement>("[data-link-id]") ?? []);
                if (!chips.length) {
                  announce("There is no link in the message.");
                  return;
                }
                let target = chips[chips.length - 1];
                if (selection && selection.rangeCount) {
                  const range = selection.getRangeAt(0);
                  const before = chips.filter((chip) => range.comparePoint(chip, 0) <= 0);
                  target = before.length ? before[before.length - 1] : chips[0];
                }
                if (target.dataset.linkId) toggle(target.dataset.linkId);
                return;
              }

              event.preventDefault();
              if (event.shiftKey) {
                document.execCommand("insertLineBreak");
                return;
              }
              void send();
            }}
            onKeyUp={rememberSelection}
            onMouseUp={rememberSelection}
            onClick={(event) => {
              const chip = (event.target as HTMLElement).closest<HTMLElement>("[data-link-id]");
              if (chip?.dataset.linkId) {
                interacted.current = true;
                toggle(chip.dataset.linkId);
              }
            }}
            onFocus={() => {
              interacted.current = true;
            }}
          />
          <p id={hintId} className={styles.srOnly}>
            Paste a link to preview it. Alt and Enter shows or collapses the preview of the link before the caret. Enter
            sends, Shift and Enter adds a line.
          </p>
          <div className={styles.lane}>
            {links
              .filter((entry) => entry.status === "ready" && entry.preview)
              .map((entry) => {
                const preview = entry.preview as LinkUnfurlPreview;
                return (
                  <div key={entry.id} ref={partRef(entry.id, "wrap")} className={styles.wrap}>
                    <div ref={partRef(entry.id, "plate")} className={styles.plate} aria-hidden="true" />
                    <article
                      ref={partRef(entry.id, "card")}
                      className={styles.card}
                      aria-label={`${preview.site}: ${preview.title}`}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        const origin = event.target as HTMLElement;
                        if (origin.closest("button, a")) return;
                        if (event.pointerType === "touch" && !origin.closest("[data-grip]")) return;
                        const spring = springs.current.get(entry.id);
                        if (!spring || !spring.card || spring.target !== 1) return;
                        drag.current = {
                          id: entry.id,
                          y: event.clientY,
                          p: spring.p,
                          t: event.timeStamp,
                          H: spring.card.offsetHeight,
                          moved: false,
                          pointer: event.pointerId,
                        };
                      }}
                      onPointerMove={onDragMove}
                      onPointerUp={onDragEnd}
                      onPointerCancel={onDragEnd}
                      onPointerEnter={() => hot(entry.id, true)}
                      onPointerLeave={() => hot(entry.id, false)}
                    >
                      <div className={styles.head} data-grip="">
                        <span
                          className={styles.fav}
                          data-fav=""
                          data-mono={preview.favicon ? undefined : "true"}
                          aria-hidden="true"
                        >
                          {preview.favicon ? (
                            <img src={preview.favicon} alt="" width={16} height={16} draggable={false} />
                          ) : (
                            preview.site.charAt(0).toUpperCase()
                          )}
                        </span>
                        <span className={styles.site}>{preview.site}</span>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => setExpanded(entry.id, false)}
                          aria-label={`Collapse preview of ${preview.title}`}
                        >
                          <ChevronUp size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => remove(entry.id)}
                          aria-label={`Remove link to ${preview.title}`}
                        >
                          <X size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </div>
                      <div ref={partRef(entry.id, "body")} className={styles.body}>
                        <a className={styles.title} href={preview.url} target="_blank" rel="noreferrer">
                          {preview.title}
                        </a>
                        {preview.description ? <p className={styles.description}>{preview.description}</p> : null}
                        {preview.image ? (
                          <div className={styles.media}>
                            <img
                              ref={partRef(entry.id, "media")}
                              src={preview.image}
                              alt={preview.imageAlt ?? ""}
                              draggable={false}
                              decoding="async"
                            />
                            {preview.duration ? (
                              <span className={styles.play} aria-hidden="true">
                                <Play size={14} strokeWidth={1.75} fill="currentColor" />
                                <span>{preview.duration}</span>
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  </div>
                );
              })}
          </div>
        </div>
        <div className={styles.toolbar}>
          {samples.length ? (
            <div className={styles.samples} role="group" aria-label="Sample links">
              <span className={styles.tryLabel} aria-hidden="true">
                Try
              </span>
              {samples.map((sample) => {
                const existing = links.find((entry) => sameUrl(entry.url, sample.url));
                const hint = existing
                  ? existing.status === "ready"
                    ? `${existing.expanded ? "Collapse" : "Show"} ${sample.site} preview`
                    : `${sample.site} link is loading`
                  : `Paste ${sample.site} link`;
                return (
                  <button
                    key={sample.url}
                    type="button"
                    className={styles.sample}
                    onClick={() => {
                      interacted.current = true;
                      const match = linksRef.current.find((entry) => sameUrl(entry.url, sample.url));
                      if (match) toggle(match.id);
                      else insertLink(sample.url);
                    }}
                    aria-label={hint}
                    data-active={existing ? "true" : undefined}
                  >
                    {sample.favicon ? <img src={sample.favicon} alt="" width={14} height={14} draggable={false} /> : null}
                    <span>{sample.site}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span />
          )}
          <button
            type="button"
            className={styles.send}
            onClick={() => void send()}
            aria-label={sendState === "sent" ? "Message sent" : sendLabel}
            aria-disabled={empty || sendState === "pending" ? "true" : undefined}
            data-state={sendState}
          >
            <span className={styles.sendIcon} data-show={sendState !== "sent" ? "true" : "false"}>
              <ArrowUp size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className={styles.sendIcon} data-show={sendState === "sent" ? "true" : "false"}>
              <Check size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={styles.srOnly} role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

export default LinkUnfurl;
