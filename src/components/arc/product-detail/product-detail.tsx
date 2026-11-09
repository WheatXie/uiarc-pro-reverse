"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion } from "motion/react";
import Image from "next/image";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
} from "lucide-react";
import { photo } from "../lib/media";
import type { PhotoId } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./product-detail.module.css";

export interface DetailImage {
  src: string;
  alt: string;
}

export interface DetailFinish {
  id: string;
  /** Swatch name, also the radio label and tooltip. */
  name: string;
  /** Any CSS color drawn in the swatch chip. */
  swatch: string;
  /** Photos for this finish; the gallery swaps to them when the finish changes. */
  images: DetailImage[];
}

export interface DetailSize {
  id: string;
  name: string;
  /** Price in whole currency units. */
  price: number;
  /** Short dimension line under the size label, such as 52 cm tall. */
  note?: string;
  /** Finish ids in which this size is out of stock. */
  soldOutIn?: string[];
}

export interface DetailShippingLine {
  title: string;
  text: string;
}

export interface DetailSection {
  id: string;
  title: string;
  /** One paragraph per entry. */
  body: string[];
}

export interface DetailProduct {
  id: string;
  name: string;
  /** Breadcrumb collection, such as Lighting. */
  collection: string;
  /** One or two sentences under the price. */
  summary: string;
  finishes: DetailFinish[];
  sizes: DetailSize[];
  /** Average rating out of five. */
  rating: number;
  reviewCount: number;
  /** Counts for 5, 4, 3, 2 and 1 stars. */
  distribution: [number, number, number, number, number] | number[];
  shipping: DetailShippingLine[];
  sections: DetailSection[];
}

export interface DetailSelection {
  productId: string;
  finish: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

export interface DetailNotifySelection {
  productId: string;
  finish: string;
  size: string;
  unitPrice: number;
}

export interface ProductDetailProps {
  /** @default sample lamp */
  product?: DetailProduct;
  /** Initial finish id. @default first finish */
  defaultFinish?: string;
  /** Initial size id. @default first size */
  defaultSize?: string;
  /**
   * Adds the selection. Return a promise to show Adding until it settles; a rejection shows Try again.
   * Without it the preview simulates a short request.
   */
  onAddToCart?: (selection: DetailSelection) => void | Promise<void>;
  /** Called when someone asks to be told when a sold out finish and size is back. */
  onNotify?: (selection: DetailNotifySelection) => void;
  /** Called when the heart is toggled. */
  onWishlistChange?: (saved: boolean) => void;
  /** Items already in the bag. @default 0 */
  defaultCartCount?: number;
  /** Upper bound of the stepper. @default 9 */
  maxQuantity?: number;
  /** @default "USD" */
  currency?: string;
  /** @default "en-US" */
  locale?: string;
  /** Extra class on the root. */
  className?: string;
}

const image = (id: PhotoId): DetailImage => ({ src: photo(id).src, alt: photo(id).alt });

const sampleProduct: DetailProduct = {
  id: "arch-lamp",
  name: "Arch ceramic lamp",
  collection: "Lighting",
  summary:
    "A hand thrown stoneware base under a washed linen shade. Warm, even light for a side table or a sideboard.",
  finishes: [
    {
      id: "clay",
      name: "Clay",
      swatch: "#b56a4c",
      images: [image("ceramic-lamp"), image("living-room"), image("home-office"), image("stacked-bowls")],
    },
    {
      id: "oat",
      name: "Oat",
      swatch: "#d8cbb3",
      images: [image("table-lamp"), image("sunroom"), image("bedroom"), image("linen-throw")],
    },
    {
      id: "charcoal",
      name: "Charcoal",
      swatch: "#3b3a38",
      images: [image("home-office"), image("ceramic-lamp"), image("reading-chair"), image("stoneware-cups")],
    },
  ],
  sizes: [
    { id: "small", name: "Small", price: 180, note: "38 cm tall" },
    { id: "large", name: "Large", price: 240, note: "52 cm tall", soldOutIn: ["charcoal"] },
  ],
  rating: 4.7,
  reviewCount: 128,
  distribution: [98, 20, 6, 3, 1],
  shipping: [
    { title: "Free delivery", text: "Arrives Sep 30 to Oct 2" },
    { title: "30 day returns", text: "Free pickup from your door" },
    { title: "Two year warranty", text: "Covers the wiring and the base" },
  ],
  sections: [
    {
      id: "details",
      title: "Details",
      body: [
        "Each base is thrown and glazed by hand in Porto, so the glaze pools a little differently on every lamp.",
        "Dimmable E27 socket, 2 m braided cable with an inline switch.",
      ],
    },
    {
      id: "dimensions",
      title: "Materials and dimensions",
      body: [
        "Base: glazed stoneware. Shade: stonewashed linen on a steel frame.",
        "Small: 38 cm tall, 26 cm shade. Large: 52 cm tall, 34 cm shade.",
      ],
    },
    {
      id: "care",
      title: "Care",
      body: [
        "Dust the base with a dry cloth. Spot clean the shade with a damp cloth and let it air dry.",
        "Use a bulb up to 40 W, or a warm 2700 K LED.",
      ],
    },
  ],
};

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const shippingIcons = [Package, RotateCcw, ShieldCheck];
const cn = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ");

/** Digits roll like odometer wheels; the text is duplicated for screen readers. */
function Roll({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const chars = Array.from(text);
  return (
    <span className={styles.roll}>
      <span aria-hidden="true" className={styles.rollChars}>
        {chars.map((char, index) => {
          const key = chars.length - index;
          return /\d/.test(char) ? (
            <span className={styles.rollDigit} key={key}>
              <motion.span
                className={styles.rollStrip}
                initial={false}
                animate={{ y: `${-10 * Number(char)}%` }}
                transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
              >
                {digits.map((digit) => (
                  <span key={digit}>{digit}</span>
                ))}
              </motion.span>
            </span>
          ) : (
            <span key={`s${key}`}>{char}</span>
          );
        })}
      </span>
      <span className={styles.srOnly}>{text}</span>
    </span>
  );
}

/** Five outline stars with a filled copy clipped to the rating. */
function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className={styles.stars} aria-hidden="true">
      <span className={styles.starsBase}>
        {[0, 1, 2, 3, 4].map((index) => (
          <Star key={index} size={size} strokeWidth={1.5} />
        ))}
      </span>
      <span className={styles.starsFill} style={{ width: `${(value / 5) * 100}%` }}>
        {[0, 1, 2, 3, 4].map((index) => (
          <Star key={index} size={size} strokeWidth={1.5} />
        ))}
      </span>
    </span>
  );
}

/** Roving tab stops for the radio groups: arrows step, wrap, and skip values the predicate rejects. */
function nudge(
  event: KeyboardEvent<HTMLDivElement>,
  order: string[],
  current: string,
  setter: (next: string) => void,
  allowed: (id: string) => boolean = () => true,
) {
  const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  let index = order.indexOf(current);
  for (let guard = 0; guard < order.length; guard += 1) {
    index = (index + step + order.length) % order.length;
    if (allowed(order[index])) break;
  }
  setter(order[index]);
  const next = event.currentTarget.querySelector<HTMLButtonElement>(`[data-radio="${order[index]}"]`);
  next?.focus();
}

/** Velocities shrink by this factor each frame, so a flick coasts about this far before it stops. */
const momentum = (velocity: number, ratio = 0.998) => ((velocity / 1000) * ratio) / (1 - ratio);

function Gallery({ images, name }: { images: DetailImage[]; name: string }) {
  const reduced = useReducedMotion() ?? false;
  const thumbRingId = useId();
  const [index, setIndex] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const width = useRef(0);
  const current = useRef(0);
  const x = useMotionValue(0);
  const count = images.length;

  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => {
      width.current = node.clientWidth;
      x.set(-current.current * width.current);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [x]);

  const go = useCallback(
    (next: number, velocity = 0) => {
      const clamped = Math.max(0, Math.min(count - 1, next));
      current.current = clamped;
      setIndex(clamped);
      animate(x, -clamped * width.current, reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.42, bounce: velocity ? 0.14 : 0.06, velocity });
    },
    [count, reduced, x],
  );

  return (
    <div className={styles.gallery}>
      <div
        ref={viewport}
        className={styles.viewport}
        role="region"
        aria-roledescription="carousel"
        aria-label={`${name} photos`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            go(current.current + 1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            go(current.current - 1);
          }
        }}
      >
        <motion.div
          className={styles.track}
          style={{ x }}
          drag={count > 1 && "x"}
          dragConstraints={viewport}
          dragElastic={0.16}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            const step = width.current || 1;
            const projected = Math.round(-(x.get() + momentum(info.velocity.x)) / step);
            go(Math.max(current.current - 1, Math.min(current.current + 1, projected)), info.velocity.x);
          }}
        >
          {images.map((image, position) => (
            <div
              key={position}
              className={styles.slide}
              role="group"
              aria-roledescription="slide"
              aria-label={`${position + 1} of ${count}`}
              aria-hidden={position !== index}
            >
              <AnimatePresence initial={false}>
                <motion.div
                  key={image.src}
                  className={styles.slideImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: motionTokens.duration.standard, ease: motionTokens.ease.standard }}
                >
                  <Image src={image.src} alt={image.alt} fill sizes="(max-width: 760px) 100vw, 560px" draggable={false} priority={position === 0} />
                </motion.div>
              </AnimatePresence>
            </div>
          ))}
        </motion.div>
        {count > 1 ? (
          <>
            <button type="button" className={cn(styles.arrow, styles.arrowPrev)} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous photo" tabIndex={-1}>
              <ChevronLeft size={18} strokeWidth={1.75} />
            </button>
            <button type="button" className={cn(styles.arrow, styles.arrowNext)} onClick={() => go(index + 1)} disabled={index === count - 1} aria-label="Next photo" tabIndex={-1}>
              <ChevronRight size={18} strokeWidth={1.75} />
            </button>
            <span className={styles.counter} aria-live="polite">
              <Roll text={String(index + 1)} />
              <span aria-hidden="true">/</span>
              {count}
            </span>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div className={styles.thumbs} role="group" aria-label="Choose a photo">
          {images.map((image, position) => (
            <button
              key={position}
              type="button"
              className={styles.thumb}
              aria-label={`Show photo ${position + 1} of ${count}`}
              aria-current={position === index || undefined}
              onClick={() => go(position)}
            >
              <AnimatePresence initial={false}>
                <motion.span
                  key={image.src}
                  className={styles.thumbImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: motionTokens.duration.standard }}
                >
                  <Image src={image.src} alt="" fill sizes="80px" draggable={false} />
                </motion.span>
              </AnimatePresence>
              {position === index ? (
                <motion.span
                  layoutId={thumbRingId}
                  className={styles.thumbRing}
                  transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A product page with a swipeable gallery and thumbnails, finish and size variants, a quantity
 * stepper, add to bag that confirms in place, shipping promises, a reviews summary, and a details
 * accordion.
 */
export function ProductDetail({
  product = sampleProduct,
  defaultFinish,
  defaultSize,
  onAddToCart,
  onNotify,
  onWishlistChange,
  defaultCartCount = 0,
  maxQuantity = 9,
  currency = "USD",
  locale = "en-US",
  className,
}: ProductDetailProps) {
  const id = useId();
  const reduced = useReducedMotion() ?? false;
  const price = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
    [locale, currency],
  );

  const [finishId, setFinishId] = useState(defaultFinish ?? product.finishes[0]?.id ?? "");
  const [sizeId, setSizeId] = useState(defaultSize ?? product.sizes[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [saved, setSaved] = useState(false);
  const [bagCount, setBagCount] = useState(defaultCartCount);
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");
  const [notified, setNotified] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState<string[]>([product.sections[0]?.id ?? ""]);
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  const bars = useRef<HTMLUListElement>(null);
  const inView = useInView(bars, { once: true, margin: "-40px" });

  // Re-armed on mount, not just cleared on unmount: React's development double-invoke runs the
  // cleanup once before the real mount, and a one-way flag would leave the add-to-bag stuck.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const finish = product.finishes.find((item) => item.id === finishId) ?? product.finishes[0];
  const size = product.sizes.find((item) => item.id === sizeId) ?? product.sizes[0];
  const isOut = (candidate = size) => !!candidate?.soldOutIn?.includes(finish.id);
  const soldOut = isOut();
  const selectionKey = `${finish.id}:${size.id}`;
  const distributionTotal = product.distribution.reduce((total, count) => total + count, 0) || 1;

  useEffect(() => {
    if (status !== "added" && status !== "error") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [status]);

  const chooseFinish = (next: string) => {
    setFinishId(next);
    setStatus("idle");
  };
  const chooseSize = (next: string) => {
    setSizeId(next);
    setStatus("idle");
  };

  const addToCart = async () => {
    if (status === "adding" || soldOut) return;
    const selection: DetailSelection = {
      productId: product.id,
      finish: finish.id,
      size: size.id,
      quantity,
      unitPrice: size.price,
    };
    setStatus("adding");
    try {
      if (onAddToCart) await onAddToCart(selection);
      else await new Promise((resolve) => window.setTimeout(resolve, 650));
      if (!mounted.current) return;
      setBagCount((count) => count + quantity);
      setStatus("added");
      setMessage(`${quantity} ${product.name} added to bag`);
    } catch {
      if (!mounted.current) return;
      setStatus("error");
      setMessage("Could not add to bag. Try again.");
    }
  };

  const addLabel =
    status === "adding"
      ? "Adding"
      : status === "added"
        ? "Added to bag"
        : status === "error"
          ? "Try again"
          : `Add to bag · ${price.format(size.price * quantity)}`;

  return (
    <div className={cn(styles.root, className)}>
      <div className={styles.scroller}>
        <header className={styles.top}>
          <nav aria-label="Breadcrumb" className={styles.crumbs}>
            <span>Shop</span>
            <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>{product.collection}</span>
            <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
            <span aria-current="page">{product.name}</span>
          </nav>
          <span className={styles.bag} role="img" aria-label={`${bagCount} items in bag`}>
            <motion.span
              key={bagCount}
              className={styles.bagIcon}
              initial={!reduced && bagCount !== defaultCartCount && { scale: 1.2, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={motionTokens.spring.snappy}
            >
              <ShoppingBag size={18} strokeWidth={1.75} aria-hidden="true" />
            </motion.span>
            <span aria-hidden="true">
              <Roll text={String(bagCount)} />
            </span>
          </span>
        </header>
        <div className={styles.layout}>
          <div className={styles.media}>
            <Gallery images={finish.images} name={product.name} />
          </div>
          <div className={styles.info}>
            <div className={styles.titleBlock}>
              <div className={styles.titleRow}>
                <h2>{product.name}</h2>
                <button
                  type="button"
                  className={styles.save}
                  aria-pressed={saved}
                  aria-label={saved ? "Remove from saved" : "Save for later"}
                  onClick={() => {
                    const next = !saved;
                    setSaved(next);
                    onWishlistChange?.(next);
                  }}
                >
                  <motion.span
                    key={String(saved)}
                    className={styles.saveIcon}
                    initial={!reduced && !!saved && { scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", visualDuration: 0.3, bounce: 0 }}
                  >
                    <Heart size={18} strokeWidth={1.75} />
                  </motion.span>
                </button>
              </div>
              <div className={styles.priceRow}>
                <span className={styles.price}>
                  <Roll text={price.format(size.price)} />
                </span>
                <a className={styles.ratingLink} href={`#${id}-reviews`}>
                  <Stars value={product.rating} />
                  <span>{product.rating.toFixed(1)}</span>
                  <span className={styles.muted}>({product.reviewCount})</span>
                </a>
              </div>
              <p className={styles.summary}>{product.summary}</p>
            </div>
            <div className={styles.option}>
              <p className={styles.optionLabel} id={`${id}-finish`}>
                Finish <span className={styles.muted}>{finish.name}</span>
              </p>
              <div
                className={styles.swatches}
                role="radiogroup"
                aria-labelledby={`${id}-finish`}
                onKeyDown={(event) =>
                  nudge(
                    event,
                    product.finishes.map((item) => item.id),
                    finish.id,
                    chooseFinish,
                  )
                }
              >
                {product.finishes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    data-radio={item.id}
                    aria-checked={item.id === finish.id}
                    tabIndex={item.id === finish.id ? 0 : -1}
                    aria-label={item.name}
                    title={item.name}
                    className={styles.swatch}
                    onClick={() => chooseFinish(item.id)}
                  >
                    <span className={styles.swatchFill} style={{ background: item.swatch }} />
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.option}>
              <p className={styles.optionLabel} id={`${id}-size`}>
                Size <span className={styles.muted}>{size.note}</span>
              </p>
              <div
                className={styles.sizes}
                role="radiogroup"
                aria-labelledby={`${id}-size`}
                onKeyDown={(event) =>
                  nudge(
                    event,
                    product.sizes.map((item) => item.id),
                    size.id,
                    chooseSize,
                  )
                }
              >
                {product.sizes.map((item) => {
                  const out = isOut(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      data-radio={item.id}
                      aria-checked={item.id === size.id}
                      tabIndex={item.id === size.id ? 0 : -1}
                      className={styles.sizeCard}
                      data-out={out || undefined}
                      onClick={() => chooseSize(item.id)}
                    >
                      <span className={styles.sizeName}>{item.name}</span>
                      <span className={styles.sizeMeta}>{out ? "Sold out" : price.format(item.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={styles.buyRow}>
              <div className={styles.stepper} role="group" aria-label="Quantity">
                <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1 || soldOut} aria-label="Decrease quantity">
                  <Minus size={15} strokeWidth={1.75} />
                </button>
                <span className={styles.qty} aria-live="polite">
                  <Roll text={String(quantity)} />
                </span>
                <button type="button" onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))} disabled={quantity >= maxQuantity || soldOut} aria-label="Increase quantity">
                  <Plus size={15} strokeWidth={1.75} />
                </button>
              </div>
              {soldOut ? (
                <button
                  type="button"
                  className={styles.notify}
                  data-done={notified.includes(selectionKey) || undefined}
                  onClick={() => {
                    if (notified.includes(selectionKey)) return;
                    setNotified((list) => [...list, selectionKey]);
                    onNotify?.({ productId: product.id, finish: finish.id, size: size.id, unitPrice: size.price });
                    setMessage(`We will email you when ${finish.name}, ${size.name} is back`);
                  }}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={String(notified.includes(selectionKey))}
                      className={styles.buttonInner}
                      initial={{ opacity: 0, y: 6 * Number(!reduced), filter: "blur(2px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: reduced ? 0 : -6, filter: "blur(2px)" }}
                      transition={{ duration: motionTokens.duration.standard, ease: motionTokens.ease.enter }}
                    >
                      {notified.includes(selectionKey) ? (
                        <>
                          <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                          We will email you
                        </>
                      ) : (
                        <>
                          <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
                          Notify me when it is back
                        </>
                      )}
                    </motion.span>
                  </AnimatePresence>
                </button>
              ) : (
                <button type="button" className={styles.addButton} data-state={status} aria-busy={status === "adding"} onClick={addToCart}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={status === "idle" ? `idle-${addLabel}` : status}
                      className={styles.buttonInner}
                      initial={{ opacity: 0, y: 6 * Number(!reduced), filter: "blur(2px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: reduced ? 0 : -6, filter: "blur(2px)" }}
                      transition={{
                        duration: status === "idle" ? motionTokens.duration.fast : motionTokens.duration.standard,
                        ease: motionTokens.ease.enter,
                      }}
                    >
                      {status === "adding" ? (
                        <span className={styles.spinner} aria-hidden="true" />
                      ) : status === "added" ? (
                        <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                      ) : null}
                      {addLabel}
                    </motion.span>
                  </AnimatePresence>
                </button>
              )}
            </div>
            <ul className={styles.shipping}>
              {product.shipping.map((line, index) => {
                const Icon = shippingIcons[index % shippingIcons.length];
                return (
                  <li key={line.title}>
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span>
                      <strong>{line.title}</strong>
                      <span className={styles.muted}>{line.text}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <section className={styles.reviews} id={`${id}-reviews`} aria-label="Reviews summary">
              <div className={styles.score}>
                <span className={styles.scoreValue}>{product.rating.toFixed(1)}</span>
                <Stars value={product.rating} size={16} />
                <span className={styles.muted}>{product.reviewCount} reviews</span>
              </div>
              <ul ref={bars} className={styles.bars}>
                {product.distribution.map((count, index) => (
                  <li key={index} aria-label={`${5 - index} stars: ${count} reviews`}>
                    <span className={styles.barLabel} aria-hidden="true">
                      {5 - index}
                    </span>
                    <span className={styles.bar} aria-hidden="true">
                      <motion.span
                        className={styles.barFill}
                        initial={false}
                        animate={{ scaleX: inView || reduced ? count / distributionTotal : 0 }}
                        transition={reduced ? { duration: 0 } : { ...motionTokens.spring.smooth, delay: 0.05 * index }}
                      />
                    </span>
                    <span className={styles.barCount} aria-hidden="true">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <div className={styles.accordion}>
              {product.sections.map((section) => {
                const open = openSections.includes(section.id);
                return (
                  <div className={styles.section} key={section.id}>
                    <h3>
                      <button
                        type="button"
                        className={styles.sectionButton}
                        aria-expanded={open}
                        aria-controls={`${id}-${section.id}`}
                        onClick={() =>
                          setOpenSections((list) => (list.includes(section.id) ? list.filter((item) => item !== section.id) : [...list, section.id]))
                        }
                      >
                        {section.title}
                        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" className={styles.sectionChevron} data-open={open || undefined} />
                      </button>
                    </h3>
                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.div
                          key="body"
                          id={`${id}-${section.id}`}
                          className={styles.sectionBody}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={
                            reduced
                              ? { duration: 0 }
                              : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast } }
                          }
                        >
                          <div className={styles.sectionText}>
                            {section.body.map((paragraph) => (
                              <p key={paragraph}>{paragraph}</p>
                            ))}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}

export default ProductDetail;
