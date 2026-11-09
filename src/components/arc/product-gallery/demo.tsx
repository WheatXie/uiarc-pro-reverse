"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, RotateCcw, ShoppingBag } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { photo } from "../lib/media";
import { ProductGallery } from "./product-gallery";
import type { ProductGalleryColor, ProductGallerySize } from "./product-gallery";
import styles from "./product-gallery.module.css";

export const meta = "Live · component";

const bedroom = photo("bedroom");
const linenThrow = photo("linen-throw");
const livingRoom = photo("living-room");
const loungeChair = photo("lounge-chair");
const readingChair = photo("reading-chair");
const homeOffice = photo("home-office");
const sunroom = photo("sunroom");
const ceramicLamp = photo("ceramic-lamp");
const stonewareCups = photo("stoneware-cups");
const stackedBowls = photo("stacked-bowls");
const wineBar = photo("wine-bar");

const colors: ProductGalleryColor[] = [
  { value: "oat", label: "Oat", swatch: "oklch(86% .03 80)", images: [bedroom, linenThrow, livingRoom, loungeChair] },
  { value: "forest", label: "Forest", swatch: "oklch(42% .05 155)", images: [readingChair, homeOffice, sunroom] },
  { value: "walnut", label: "Walnut", swatch: "oklch(43% .06 50)", images: [ceramicLamp, stonewareCups, stackedBowls, wineBar] },
];

const sizes: ProductGallerySize[] = [
  { value: "twin", label: "Twin", soldOut: ["walnut"] },
  { value: "full", label: "Full" },
  { value: "queen", label: "Queen" },
  { value: "king", label: "King", soldOut: ["forest"] },
  { value: "cal-king", label: "Cal king", soldOut: true },
];

const prices: Record<string, number> = { twin: 188, full: 218, queen: 248, king: 278, "cal-king": 278 };

type AddStatus = "idle" | "added" | "missing";

export default function ProductGalleryDemo() {
  const reduced = Boolean(useReducedMotion());
  const [color, setColor] = useState("oat");
  const [size, setSize] = useState<string | null>(null);
  const [bag, setBag] = useState(0);
  const [status, setStatus] = useState<AddStatus>("idle");
  const [priceUp, setPriceUp] = useState(true);
  const timer = useRef<number | null>(null);

  const price = prices[size ?? "queen"];
  const activeColor = colors.find(entry => entry.value === color) ?? colors[0];
  const soldOutSizes = sizes.filter(entry => entry.soldOut === true || (Array.isArray(entry.soldOut) && entry.soldOut.includes(color)));

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleSizeChange = useCallback(
    (next: string | null) => {
      setPriceUp(prices[next ?? "queen"] >= prices[size ?? "queen"]);
      setSize(next);
    },
    [size],
  );

  const addToBag = () => {
    if (!size) {
      setStatus("missing");
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setStatus("idle"), 1800);
      return;
    }
    setBag(count => count + 1);
    setStatus("added");
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 1800);
  };

  const label = status === "added" ? "Added to bag" : status === "missing" ? "Choose a size first" : `Add to bag${size ? ` · $${price}` : ""}`;

  return (
    <div className={styles.demo}>
      <ProductGallery
        colors={colors}
        sizes={sizes}
        color={color}
        onColorChange={setColor}
        size={size}
        onSizeChange={handleSizeChange}
        label="Washed linen duvet set"
        header={
          <div className={styles.header}>
            <div className={styles.titleRow}>
              <h3 className={styles.title}>Washed linen duvet set</h3>
              <span className={styles.bag} aria-live="polite" aria-label={`${bag} items in bag`}>
                <ShoppingBag size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.bagCount}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={bag}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
                      transition={motionTokens.spring.snappy}
                    >
                      {bag}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </span>
            </div>
            <p className={styles.price}>
              <span className={styles.priceValue}>
                <AnimatePresence mode="popLayout" initial={false} custom={priceUp}>
                  <motion.span
                    key={price}
                    custom={priceUp}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: priceUp ? 12 : -12, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: priceUp ? -12 : 12, filter: "blur(3px)" }}
                    transition={motionTokens.spring.smooth}
                  >
                    ${price}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className={styles.priceNote}>{size ? "Duvet cover and two shams" : "From $188 · queen shown"}</span>
            </p>
            <p className={styles.copy}>
              Stonewashed European flax that softens with every wash. Hover the photo to look closer, or open it fullscreen.
            </p>
          </div>
        }
        footer={
          <div className={styles.footer}>
            <button type="button" className={styles.add} data-status={status} onClick={addToBag}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={label}
                  className={styles.addLabel}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, filter: `blur(${motionTokens.blur.subtle}px)` }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, filter: `blur(${motionTokens.blur.subtle}px)` }}
                  transition={motionTokens.spring.snappy}
                >
                  {status === "added" ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : null}
                  {label}
                </motion.span>
              </AnimatePresence>
            </button>
            <div className={styles.meta}>
              <span>
                {soldOutSizes.length > 0
                  ? `Sold out in ${activeColor.label.toLowerCase()}: ${soldOutSizes.map(entry => entry.label).join(", ")}`
                  : "Every size in stock"}
              </span>
              {bag > 0 ? (
                <button
                  type="button"
                  className={styles.reset}
                  onClick={() => {
                    setBag(0);
                    setStatus("idle");
                  }}
                >
                  <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
                  Empty bag
                </button>
              ) : null}
            </div>
          </div>
        }
      />
    </div>
  );
}
