"use client";

import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type Transition, type Variants } from "motion/react";
import { Check, Minus, Plus, ShoppingBag, Tag, Trash2, Truck, X } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Button } from "../button/button";
import { motionTokens } from "../motion-tokens";
import styles from "./cart-drawer.module.css";

export interface CartDrawerProps {
  className?: string;
}

interface Product {
  id: string;
  name: string;
  detail: string;
  price: number;
  photo: string;
  alt: string;
}

interface Line {
  id: string;
  qty: number;
}

interface Flight {
  key: number;
  product: Product;
  from: { x: number; y: number; w: number; h: number };
  to: { x: number; y: number };
}

/** Two-column shop above 380px, three above 640px; the drawer covers it once something is in the cart. */
const PRODUCTS: Product[] = [
  {
    id: "chair",
    name: "Oak lounge chair",
    detail: "Woven oak, sheepskin",
    price: 1240,
    photo: "lounge-chair",
    alt: "A woven oak lounge chair with a sheepskin and linen cushion on a concrete floor",
  },
  { id: "lamp", name: "Dome table lamp", detail: "Opal glass, 2700K", price: 186, photo: "table-lamp", alt: "A white mushroom table lamp glowing beside books and a small vase" },
  { id: "carafe", name: "Ribbed carafe", detail: "Mouth-blown glass, 1 L", price: 64, photo: "glass-carafe", alt: "A hand pouring water from a ribbed glass carafe into tumblers" },
  { id: "cups", name: "Stoneware cups", detail: "Set of two, speckled", price: 48, photo: "stoneware-cups", alt: "Two speckled stoneware cups with a lid on a pale table" },
  { id: "bowls", name: "Nesting bowls", detail: "Glazed stoneware, pair", price: 56, photo: "stacked-bowls", alt: "Two stacked speckled ceramic bowls against a dark wall" },
  { id: "throw", name: "Linen throw", detail: "Stonewashed, fringed", price: 118, photo: "linen-throw", alt: "Folded natural linen throws with fringed edges in soft window light" },
];

const BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]));

const FREE_SHIPPING = 250;
const SHIPPING = 12;
const PROMO = "STUDIO10";
const PROMO_RATE = 0.1;
const MAX_QTY = 9;
const INITIAL_LINES: Line[] = [{ id: "carafe", qty: 1 }];

/** The reference images are the same six files the rest of the gallery uses. */
const photo = (id: string) => `/media/photos/${id}.jpg`;
const fillStyle = { position: "absolute", height: "100%", width: "100%", inset: 0, color: "transparent" } as const;

const money = (value: number) => `$${value.toLocaleString("en-US")}`;

const { spring: SPRING, duration: DURATION, ease: EASE } = motionTokens;
const ENTER: [number, number, number, number] = [...EASE.enter];
const STANDARD: [number, number, number, number] = [...EASE.standard];

/** A spring written the way the block specifies it: settle time and bounce, not stiffness numbers. */
const springFor = (duration: number, bounce: number): Transition => {
  const period = (2 * Math.PI) / (1.2 * duration);
  return { type: "spring", stiffness: period * period, damping: 2 * (1 - bounce) * period, mass: 1 };
};

const DRAWER_SPRING = springFor(0.42, 0);
const SNAP_SPRING = springFor(0.34, 0);
const LAYOUT_SPRING = springFor(0.5, 0);

const subscribeNoop = () => () => {};

/** A counted figure. The counter rolls; the wrapper keeps it on the block's number class. */
function Count({ value, prefix = "" }: { value: number; prefix?: string }) {
  return (
    <span className={styles.num}>
      <AnimatedCounter value={value} prefix={prefix} />
    </span>
  );
}

/** One-line crossfade: the old line leaves upward as the new one rises, without changing the box. */
function SwapText({ text, reduced, className, anchor = "left" }: { text: string; reduced: boolean; className?: string; anchor?: "left" | "right" }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false} anchorX={anchor}>
        <motion.span
          key={text}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.4em" }}
          animate={{ opacity: 1, y: "0em" }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.4em", transition: { duration: DURATION.fast, ease: STANDARD } }}
          transition={reduced ? { duration: DURATION.instant } : { duration: DURATION.standard, ease: ENTER }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Height follows the measured content, so the promo chip and the form can trade places without a jump. */
function FitHeight({ children, reduced, className }: { children: React.ReactNode; reduced: boolean; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | string>("auto");
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div className={[styles.fit, className].filter(Boolean).join(" ")} initial={false} animate={{ height }} transition={reduced ? { duration: 0 } : SPRING.smooth}>
      <div ref={inner} className={styles.fitInner}>
        {children}
      </div>
    </motion.div>
  );
}

/** The photo that arcs from the card into the cart: one motion value drives position, size, tilt and shadow. */
function Flyer({ flight, onLand }: { flight: Flight; onLand: (key: number) => void }) {
  const progress = useMotionValue(0);
  const land = useEffectEvent(() => onLand(flight.key));
  const { from, to } = flight;
  const start = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const control = { x: start.x + (to.x - start.x) * 0.55, y: Math.max(8, Math.min(start.y, to.y) - Math.min(160, 0.35 * Math.abs(to.x - start.x))) };
  const curve = (t: number, a: number, b: number, c: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  const width = useTransform(progress, (t) => from.w + (26 - from.w) * Math.min(1, 1.25 * t));
  const height = useTransform(progress, (t) => from.h + (26 - from.h) * Math.min(1, 1.25 * t));
  const transform = useTransform(
    progress,
    (t) =>
      `translate3d(${curve(t, start.x, control.x, to.x).toFixed(2)}px, ${curve(t, start.y, control.y, to.y).toFixed(2)}px, 0) translate(-50%, -50%) rotate(${(-10 * Math.sin(t * Math.PI)).toFixed(2)}deg)`,
  );
  const radius = useTransform(progress, (t) => 16 - 3 * t);
  const opacity = useTransform(progress, [0, 0.86, 1], [1, 1, 0]);
  const shadow = useTransform(
    progress,
    (t) => `0 ${(4 + 14 * Math.sin(t * Math.PI)).toFixed(1)}px ${(10 + 26 * Math.sin(t * Math.PI)).toFixed(1)}px oklch(0% 0 0 / ${(0.08 + 0.12 * Math.sin(t * Math.PI)).toFixed(3)})`,
  );

  useEffect(() => {
    const running = animate(progress, 1, { duration: 0.78, ease: [0.32, 0, 0.18, 1] });
    running.then(() => land());
    return () => running.stop();
  }, [progress]);

  return (
    <motion.div className={styles.flyer} style={{ width, height, transform, borderRadius: radius, opacity, boxShadow: shadow }} aria-hidden="true">
      <img src={photo(flight.product.photo)} alt="" sizes="240px" loading="lazy" decoding="async" style={fillStyle} />
    </motion.div>
  );
}

interface RowProps {
  line: Line;
  product: Product;
  reduced: boolean;
  onQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}

/** One cart line. Dragging left past 110px arms the removal layer behind it and lets go into a delete. */
function Row({ line, product, reduced, onQty, onRemove }: RowProps) {
  const x = useMotionValue(0);
  const face = useRef<HTMLDivElement>(null);
  const layerOpacity = useTransform(x, [-140, -28, 0], [1, 0.35, 0]);
  const hintScale = useTransform(x, [-120, -40], [1, 0.7]);
  const [armed, setArmed] = useState(false);

  return (
    <motion.li
      className={styles.row}
      initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={
        reduced
          ? { opacity: 0, transition: { duration: 0.12 } }
          : { opacity: 0, height: 0, transition: { height: { ...SPRING.smooth, delay: 0.06 }, opacity: { duration: DURATION.fast } } }
      }
      transition={reduced ? { duration: 0.12 } : { height: SPRING.smooth, opacity: { duration: DURATION.standard, ease: ENTER } }}
    >
      <div className={styles.rowInner}>
        <motion.div className={styles.removeLayer} data-armed={armed || undefined} style={{ opacity: layerOpacity }} aria-hidden="true">
          <motion.span style={{ scale: hintScale }} className={styles.removeHint}>
            <Trash2 size={16} strokeWidth={1.75} />
            Remove
          </motion.span>
        </motion.div>
        <motion.div
          ref={face}
          className={styles.rowFace}
          style={{ x }}
          drag={reduced ? false : "x"}
          dragDirectionLock
          dragMomentum={false}
          dragConstraints={{ left: -400, right: 0 }}
          dragElastic={{ left: 0.02, right: 0.08 }}
          onDrag={(_, info) => setArmed(info.offset.x < -110)}
          onDragEnd={(_, info) => {
            const width = face.current?.offsetWidth ?? 320;
            if (info.offset.x < -110 || (info.velocity.x < -520 && info.offset.x < -24)) {
              void animate(x, -width, { ...springFor(0.28, 0), velocity: info.velocity.x });
              onRemove(line.id);
              return;
            }
            setArmed(false);
            void animate(x, 0, { ...SNAP_SPRING, velocity: info.velocity.x });
          }}
        >
          <span className={styles.thumb}>
            <img src={photo(product.photo)} alt="" sizes="64px" loading="lazy" decoding="async" draggable={false} style={fillStyle} />
          </span>
          <div className={styles.rowText}>
            <p className={styles.rowName}>{product.name}</p>
            <p className={styles.rowDetail}>{product.detail}</p>
            <div className={styles.stepper} role="group" aria-label={`${product.name} quantity`}>
              <button
                type="button"
                className={styles.stepButton}
                aria-label={line.qty === 1 ? `Remove ${product.name}` : `Decrease ${product.name} quantity`}
                onClick={() => (line.qty === 1 ? onRemove(line.id) : onQty(line.id, line.qty - 1))}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={line.qty === 1 ? "trash" : "minus"}
                    className={styles.stepIcon}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: -30 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: 30 }}
                    transition={reduced ? { duration: 0.1 } : SPRING.snappy}
                  >
                    {line.qty === 1 ? <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" /> : <Minus size={14} strokeWidth={1.75} aria-hidden="true" />}
                  </motion.span>
                </AnimatePresence>
              </button>
              <span className={styles.qty}>
                <Count value={line.qty} />
              </span>
              <button type="button" className={styles.stepButton} aria-label={`Increase ${product.name} quantity`} disabled={line.qty >= MAX_QTY} onClick={() => onQty(line.id, line.qty + 1)}>
                <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className={styles.rowEnd}>
            <span className={styles.linePrice}>
              <Count value={product.price * line.qty} prefix="$" />
            </span>
            <button type="button" className={styles.iconButton} aria-label={`Remove ${product.name}`} onClick={() => onRemove(line.id)}>
              <X size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      </div>
    </motion.li>
  );
}

const bodyVariants: Variants = {
  shown: { opacity: 1, transition: { duration: DURATION.standard, ease: ENTER } },
  gone: { opacity: 0, transition: { duration: DURATION.fast, ease: STANDARD } },
};

/**
 * A product grid with a side cart. Adding an item arcs its photo into the cart button, the badge
 * counts up when it lands, and the drawer handles quantities, swipe-to-remove, the free shipping
 * bar, promo codes and a simulated checkout. Products, prices and the order are sample data.
 */
export function CartDrawer({ className }: CartDrawerProps) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const prefersReduced = useReducedMotion();
  const reduced = mounted && !!prefersReduced;
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const rootRef = useRef<HTMLElement>(null);
  const cartRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const promoRef = useRef<HTMLInputElement>(null);
  const frames = useRef(new Map<string, HTMLElement>());
  const flightKey = useRef(0);
  const timers = useRef<number[]>([]);

  const [lines, setLines] = useState<Line[]>(INITIAL_LINES);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<Record<string, number>>({});
  const [pulse, setPulse] = useState(0);
  const [promoText, setPromoText] = useState("");
  const [promo, setPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"cart" | "placing" | "done">("cart");
  const [order, setOrder] = useState<{ items: number; total: number } | null>(null);
  const [status, setStatus] = useState("");
  const [checkoutKey, setCheckoutKey] = useState(0);

  const count = lines.reduce((total, line) => total + line.qty, 0);
  const badge = Math.max(0, count - flights.length);
  const subtotal = lines.reduce((total, line) => total + (BY_ID.get(line.id)?.price ?? 0) * line.qty, 0);
  const discount = promo ? Math.round(PROMO_RATE * subtotal) : 0;
  const freeShipping = subtotal >= FREE_SHIPPING;
  const shipping = !lines.length || freeShipping ? 0 : SHIPPING;
  const total = subtotal - discount + shipping;
  const progress = Math.min(1, subtotal / FREE_SHIPPING);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true });
    else if (wasOpen.current) cartRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  /** Bump the pulse key and ring the cart: the badge count only moves once the photo has landed. */
  function pulseCart() {
    setPulse((value) => value + 1);
    const node = cartRef.current;
    if (node && !reduced) void animate(node, { scale: [1, 1.09, 0.98, 1] }, { duration: 0.42, ease: "easeOut", times: [0, 0.35, 0.7, 1] });
  }

  const land = useEffectEvent((key: number) => {
    setFlights((current) => current.filter((flight) => flight.key !== key));
    pulseCart();
  });
  const onLand = (key: number) => land(key);

  const setQty = (id: string, qty: number) => setLines((current) => current.map((line) => (line.id === id ? { ...line, qty } : line)));
  const remove = (id: string) => {
    setLines((current) => current.filter((line) => line.id !== id));
    setStatus(`Removed ${BY_ID.get(id)?.name ?? "item"}`);
  };

  const onEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && phase !== "placing") setOpen(false);
  });
  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => onEscape(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [open]);

  const drawerMotion = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.16 } }
    : { initial: { x: "104%" }, animate: { x: "0%" }, exit: { x: "104%", transition: springFor(0.34, 0) }, transition: DRAWER_SPRING };
  const layoutSpring = reduced ? { duration: 0 } : LAYOUT_SPRING;

  /** Add one of a product, then send its photo to the cart. */
  function addToCart(product: Product) {
    setLines((current) =>
      current.some((line) => line.id === product.id)
        ? current.map((line) => (line.id === product.id ? { ...line, qty: Math.min(MAX_QTY, line.qty + 1) } : line))
        : [...current, { id: product.id, qty: 1 }],
    );
    setAdded((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }));
    later(() => setAdded((current) => ({ ...current, [product.id]: Math.max(0, (current[product.id] ?? 1) - 1) })), 1400);
    setStatus(`Added ${product.name} to your cart`);
    if (phase === "done") {
      setPhase("cart");
      setOrder(null);
    }

    const frame = frames.current.get(product.id);
    const cart = cartRef.current;
    const root = rootRef.current;
    if (reduced || !frame || !cart || !root) {
      pulseCart();
      return;
    }
    const rootBox = root.getBoundingClientRect();
    const from = frame.getBoundingClientRect();
    const to = cart.getBoundingClientRect();
    flightKey.current += 1;
    setFlights((current) => [
      ...current,
      {
        key: flightKey.current,
        product,
        from: { x: from.left - rootBox.left, y: from.top - rootBox.top, w: from.width, h: from.height },
        to: { x: to.left - rootBox.left + 22, y: to.top - rootBox.top + to.height / 2 },
      },
    ]);
  }

  const applyPromo = (event: React.FormEvent) => {
    event.preventDefault();
    const code = promoText.trim().toUpperCase();
    if (!code) {
      promoRef.current?.focus();
      return;
    }
    if (code === PROMO) {
      setPromo(PROMO);
      setPromoError(null);
      setPromoText("");
      setStatus("Promo code applied, 10% off");
      return;
    }
    setPromoError(`${code} isn't a valid code`);
    const field = promoRef.current?.parentElement;
    if (field && !reduced) void animate(field, { x: [0, -6, 5, -3, 2, 0] }, { duration: 0.36, ease: "easeOut" });
  };

  const checkout = () => {
    if (!lines.length || phase !== "cart") return;
    setPhase("placing");
    setStatus("Placing your order");
    later(() => {
      setOrder({ items: count, total });
      setPhase("done");
      setStatus(`Order placed. ${count} ${count === 1 ? "item" : "items"}, ${money(total)}.`);
    }, 1300);
  };

  return (
    <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} aria-labelledby={`${uid}-title`}>
      <div className={styles.shop} inert={open || undefined}>
        <header className={styles.header}>
          <h2 id={`${uid}-title`} className={styles.title}>
            New in the studio
          </h2>
          <div className={styles.cartWrap}>
            <AnimatePresence>
              {pulse > 0 && !reduced ? (
                <motion.span
                  key={pulse}
                  className={styles.ring}
                  aria-hidden="true"
                  initial={{ opacity: 0.45, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.45 }}
                  transition={{ duration: 0.6, ease: ENTER }}
                />
              ) : null}
            </AnimatePresence>
            <button
              ref={cartRef}
              type="button"
              className={styles.cart}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-controls={`${uid}-drawer`}
              aria-label={`Cart, ${badge} ${badge === 1 ? "item" : "items"}`}
              onClick={() => {
                setCheckoutKey((value) => value + 1);
                setOpen(true);
              }}
            >
              <ShoppingBag size={18} strokeWidth={1.75} aria-hidden="true" />
              <span className={styles.cartLabel}>Cart</span>
              <AnimatePresence initial={false}>
                {badge > 0 ? (
                  <motion.span
                    key="badge"
                    className={styles.badge}
                    aria-hidden="true"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
                    transition={reduced ? { duration: 0.12 } : SPRING.snappy}
                  >
                    <Count value={badge} />
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </button>
          </div>
        </header>

        <ul className={styles.grid}>
          {PRODUCTS.map((product) => {
            const popped = (added[product.id] ?? 0) > 0;
            return (
              <li key={product.id} className={styles.card}>
                <span
                  className={styles.imageFrame}
                  ref={(node) => {
                    if (node) frames.current.set(product.id, node);
                    else frames.current.delete(product.id);
                  }}
                >
                  <img src={photo(product.photo)} alt={product.alt} sizes="(max-width: 640px) 50vw, 260px" loading="lazy" decoding="async" style={fillStyle} />
                </span>
                <div className={styles.cardText}>
                  <p className={styles.name}>{product.name}</p>
                  <p className={styles.price}>{money(product.price)}</p>
                </div>
                <p className={styles.detail}>{product.detail}</p>
                <Button variant="secondary" size="sm" className={styles.addButton} onClick={() => addToCart(product)} aria-label={`Add ${product.name} to cart`}>
                  {popped ? (
                    <>
                      <Check size={15} strokeWidth={1.75} aria-hidden="true" />
                      Added
                    </>
                  ) : (
                    <>
                      <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
                      Add to cart
                    </>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.flights} aria-hidden="true">
        {flights.map((flight) => (
          <Flyer key={flight.key} flight={flight} onLand={onLand} />
        ))}
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="scrim"
            className={styles.scrim}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.28, ease: STANDARD }}
            onClick={() => {
              if (phase !== "placing") setOpen(false);
            }}
            aria-hidden="true"
          />
        ) : null}
        {open ? (
          <motion.aside key="drawer" id={`${uid}-drawer`} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby={`${uid}-drawer-title`} {...drawerMotion}>
            <header className={styles.drawerHead}>
              <h3 id={`${uid}-drawer-title`} className={styles.drawerTitle}>
                {phase === "done" ? "Order placed" : "Your cart"}
              </h3>
              {phase !== "done" ? (
                <span className={styles.drawerCount}>
                  <Count value={count} /> {count === 1 ? "item" : "items"}
                </span>
              ) : null}
              <button ref={closeRef} type="button" className={styles.iconButton} aria-label="Close cart" onClick={() => setOpen(false)} disabled={phase === "placing"}>
                <X size={17} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </header>

            <AnimatePresence initial={false} mode="popLayout">
              {phase !== "done" ? (
                <motion.div key="cart" className={styles.drawerBody} variants={bodyVariants} initial="gone" animate="shown" exit="gone" inert={phase === "placing" || undefined}>
                  {lines.length > 0 ? (
                    <div className={styles.shipping} data-free={freeShipping || undefined}>
                      <p className={styles.shippingText}>
                        <Truck size={16} strokeWidth={1.75} aria-hidden="true" />
                        <SwapText reduced={reduced} text={freeShipping ? "Free shipping unlocked" : `${money(FREE_SHIPPING - subtotal)} away from free shipping`} />
                      </p>
                      <div className={styles.track} role="progressbar" aria-label="Progress to free shipping" aria-valuemin={0} aria-valuemax={FREE_SHIPPING} aria-valuenow={Math.min(subtotal, FREE_SHIPPING)}>
                        <motion.span className={styles.fill} initial={false} animate={{ scaleX: progress }} transition={reduced ? { duration: 0 } : SPRING.smooth} />
                      </div>
                    </div>
                  ) : null}
                  <ul className={styles.lines}>
                    <AnimatePresence initial={false}>
                      {lines.map((line) => {
                        const product = BY_ID.get(line.id);
                        return product ? <Row key={line.id} line={line} product={product} reduced={reduced} onQty={setQty} onRemove={remove} /> : null;
                      })}
                    </AnimatePresence>
                  </ul>
                  <AnimatePresence initial={false}>
                    {!lines.length ? (
                      <motion.div
                        key="empty"
                        className={styles.empty}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: 0.12, duration: DURATION.standard } }}
                        exit={{ opacity: 0, transition: { duration: 0.08 } }}
                      >
                        <ShoppingBag size={22} strokeWidth={1.5} aria-hidden="true" />
                        <p>Your cart is empty</p>
                        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                          Keep browsing
                        </Button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key="done"
                  className={styles.done}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.12 * (reduced ? 0 : 1), duration: DURATION.standard } }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div layoutId={`${uid}-checkout-${checkoutKey}`} className={styles.doneDisc} style={{ borderRadius: 999 }} transition={layoutSpring}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <motion.path
                        d="M6.5 12.5l3.6 3.6 7.4-8"
                        initial={reduced ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.3, ease: ENTER, delay: 0.38 * (reduced ? 0 : 1) }}
                      />
                    </svg>
                  </motion.div>
                  <p className={styles.doneTitle}>Thanks, Olivia</p>
                  <p className={styles.doneBody}>Order A-20417 is confirmed and a receipt is on its way to olivia@bennett.studio.</p>
                  {order ? (
                    <dl className={styles.doneFacts}>
                      <div>
                        <dt>Items</dt>
                        <dd>{order.items}</dd>
                      </div>
                      <div>
                        <dt>Paid</dt>
                        <dd>{money(order.total)}</dd>
                      </div>
                      <div>
                        <dt>Arrives</dt>
                        <dd>Oct 2 to Oct 4</dd>
                      </div>
                    </dl>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>

            <footer className={styles.drawerFoot}>
              <AnimatePresence initial={false}>
                {phase !== "done" && lines.length > 0 ? (
                  <motion.div
                    key="summary"
                    className={styles.summaryWrap}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={reduced ? { duration: 0.12 } : { height: SPRING.smooth, opacity: { duration: DURATION.fast } }}
                    inert={phase === "placing" || undefined}
                  >
                    <div className={styles.summary}>
                      <FitHeight reduced={reduced}>
                        <AnimatePresence initial={false} mode="popLayout">
                          {promo ? (
                            <motion.div
                              key="applied"
                              className={styles.promoApplied}
                              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={reduced ? { duration: 0.12 } : SPRING.snappy}
                            >
                              <Tag size={15} strokeWidth={1.75} aria-hidden="true" />
                              <span>
                                <strong>{promo}</strong> 10% off
                              </span>
                              <button
                                type="button"
                                className={styles.textButton}
                                onClick={() => {
                                  setPromo(null);
                                  setStatus("Promo code removed");
                                }}
                              >
                                Remove
                              </button>
                            </motion.div>
                          ) : (
                            <motion.form
                              key="promo"
                              className={styles.promo}
                              onSubmit={applyPromo}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: DURATION.fast }}
                            >
                              <div className={styles.promoField} data-error={promoError ? "" : undefined}>
                                <input
                                  ref={promoRef}
                                  className={styles.promoInput}
                                  value={promoText}
                                  onChange={(event) => {
                                    setPromoText(event.target.value);
                                    setPromoError(null);
                                  }}
                                  placeholder="Promo code"
                                  aria-label="Promo code"
                                  aria-invalid={!!promoError}
                                  aria-describedby={`${uid}-promo-note`}
                                  autoComplete="off"
                                  spellCheck={false}
                                />
                                <button type="submit" className={styles.applyButton}>
                                  Apply
                                </button>
                              </div>
                              <p id={`${uid}-promo-note`} className={styles.promoNote} data-error={promoError ? "" : undefined}>
                                <SwapText reduced={reduced} text={promoError ?? `Try ${PROMO} for 10% off`} />
                              </p>
                            </motion.form>
                          )}
                        </AnimatePresence>
                      </FitHeight>
                      <dl className={styles.totals}>
                        <div className={styles.totalRow}>
                          <dt>Subtotal</dt>
                          <dd>
                            <Count value={subtotal} prefix="$" />
                          </dd>
                        </div>
                        <AnimatePresence initial={false}>
                          {discount > 0 ? (
                            <motion.div
                              key="discount"
                              className={styles.totalRow}
                              data-tone="discount"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={reduced ? { duration: 0.12 } : { height: SPRING.smooth, opacity: { duration: DURATION.fast } }}
                            >
                              <dt>Discount</dt>
                              <dd>
                                −<Count value={discount} prefix="$" />
                              </dd>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                        <div className={styles.totalRow}>
                          <dt>Shipping</dt>
                          <dd>
                            <SwapText reduced={reduced} anchor="right" text={shipping ? money(shipping) : "Free"} />
                          </dd>
                        </div>
                        <div className={styles.totalRow} data-tone="total">
                          <dt>Total</dt>
                          <dd>
                            <Count value={total} prefix="$" />
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {phase === "done" ? (
                <motion.div className={styles.continueWrap} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.3 * (reduced ? 0 : 1), duration: DURATION.standard } }}>
                  <Button
                    variant="secondary"
                    size="lg"
                    className={styles.continue}
                    onClick={() => {
                      setLines([]);
                      setPromo(null);
                      setPromoText("");
                      setPromoError(null);
                      setOpen(false);
                      setPhase("cart");
                      later(() => {
                        setOrder(null);
                        setCheckoutKey((value) => value + 1);
                      }, 420);
                    }}
                  >
                    Continue shopping
                  </Button>
                </motion.div>
              ) : (
                <motion.button
                  layoutId={`${uid}-checkout-${checkoutKey}`}
                  type="button"
                  className={styles.checkout}
                  style={{ borderRadius: 18 }}
                  transition={layoutSpring}
                  onClick={checkout}
                  disabled={!lines.length}
                  aria-disabled={phase === "placing" || undefined}
                  aria-busy={phase === "placing" || undefined}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {phase === "placing" ? (
                      <motion.span
                        key="placing"
                        className={styles.checkoutLabel}
                        data-center=""
                        initial={{ opacity: 0, y: 8 * (reduced ? 0 : 1) }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: DURATION.standard, ease: ENTER }}
                      >
                        <span className={styles.spinner} aria-hidden="true" />
                        Placing order
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        className={styles.checkoutLabel}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, y: reduced ? 0 : -8, transition: { duration: DURATION.fast } }}
                        transition={{ duration: DURATION.standard, ease: ENTER }}
                      >
                        <span>Check out</span>
                        <Count value={total} prefix="$" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              )}
            </footer>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <p className={styles.srOnly} aria-live="polite">
        {status}
      </p>
    </section>
  );
}

export default CartDrawer;
