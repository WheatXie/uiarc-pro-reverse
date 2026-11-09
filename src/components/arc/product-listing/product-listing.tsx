"use client";
/* eslint-disable @next/next/no-img-element -- plain images keep the block portable outside Next.js. */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, Plus, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./product-listing.module.css";

export interface ListingColor {
  id: string;
  name: string;
  /** Any CSS color used for the swatch and the dots under each card. */
  swatch: string;
}

export interface ListingProduct {
  id: string;
  /** Product name, shown on the card and used in the quick add label. */
  name: string;
  /** Short line under the name, such as the material. */
  detail: string;
  /** Price in whole currency units. */
  price: number;
  /** Previous price, drawn struck through beside the sale price. */
  compareAt?: number;
  /** Main photo. */
  image: string;
  /** Description of the main photo. */
  alt: string;
  /** Second photo that crossfades in on hover inside the same 4:5 box. */
  hoverImage?: string;
  /** Color ids this product comes in. */
  colors: string[];
  /** Sizes this product comes in. A single size adds straight from the card. */
  sizes: string[];
  /** False shows Sold out and disables quick add. */
  inStock: boolean;
  /** Short status text in the meta row, such as New. */
  badge?: string;
  /** Sort key for newest; higher is newer. */
  added: number;
  /** Sort key for featured; lower comes first. */
  rank: number;
}

export interface ProductListingProps {
  /**
   * Products to list. Price range bounds come from these prices, rounded to 10.
   * @default sample catalog
   */
  products?: ListingProduct[];
  /**
   * Colors for the swatch filter and the dots under each card.
   * @default sample colors
   */
  colors?: ListingColor[];
  /**
   * Size filter options.
   * @default ["S", "M", "L"]
   */
  sizes?: string[];
  /**
   * Initial sort. Featured uses rank, newest uses added.
   * @default "featured"
   */
  defaultSort?: "featured" | "newest" | "price-asc" | "price-desc";
  /**
   * Called when a product is added from its card.
   */
  onAddToCart?: (product: ListingProduct, size: string) => void;
  /**
   * Items already in the bag.
   * @default 0
   */
  defaultCartCount?: number;
  /**
   * ISO currency for prices.
   * @default "USD"
   */
  currency?: string;
  /**
   * Locale for price formatting.
   * @default "en-US"
   */
  locale?: string;
  /**
   * Collection heading.
   * @default "Home goods"
   */
  title?: string;
  /**
   * Extra class on the root.
   */
  className?: string;
}

const sampleColors: ListingColor[] = [
  { id: "oat", name: "Oat", swatch: "#d8cbb3" },
  { id: "clay", name: "Clay", swatch: "#b56a4c" },
  { id: "sage", name: "Sage", swatch: "#98a58a" },
  { id: "charcoal", name: "Charcoal", swatch: "#3b3a38" },
  { id: "chalk", name: "Chalk", swatch: "#f1eee7" },
];

const sampleSizes = ["S", "M", "L"];

const photo = (id: string) => `/media/photos/${id}.jpg`;

const sampleProducts: ListingProduct[] = [
  {
    id: "p-lounge",
    name: "Woven lounge chair",
    detail: "Oak and paper cord",
    price: 340,
    image: photo("lounge-chair"),
    alt: "A woven oak lounge chair with a sheepskin and linen cushion on a concrete floor",
    hoverImage: photo("living-room"),
    colors: ["oat", "charcoal"],
    sizes: ["M"],
    inStock: true,
    added: 9,
    rank: 1,
  },
  {
    id: "p-lamp",
    name: "Dome table lamp",
    detail: "Opal glass",
    price: 128,
    image: photo("table-lamp"),
    alt: "A white mushroom table lamp glowing beside books and a small vase",
    hoverImage: photo("home-office"),
    colors: ["chalk", "oat"],
    sizes: ["S", "M"],
    inStock: true,
    added: 6,
    rank: 2,
  },
  {
    id: "p-throw",
    name: "Fringed linen throw",
    detail: "Stonewashed linen",
    price: 89,
    compareAt: 110,
    image: photo("linen-throw"),
    alt: "Folded natural linen throws with fringed edges in soft window light",
    hoverImage: photo("bedroom"),
    colors: ["oat", "sage", "clay"],
    sizes: ["S", "M", "L"],
    inStock: true,
    added: 4,
    rank: 3,
  },
  {
    id: "p-carafe",
    name: "Ribbed carafe set",
    detail: "Mouth blown glass",
    price: 64,
    image: photo("glass-carafe"),
    alt: "A hand pouring water from a ribbed glass carafe into tumblers",
    hoverImage: photo("sunroom"),
    colors: ["chalk"],
    sizes: ["M"],
    inStock: true,
    added: 8,
    rank: 4,
  },
  {
    id: "p-cups",
    name: "Speckled cups, pair",
    detail: "Glazed stoneware",
    price: 42,
    image: photo("stoneware-cups"),
    alt: "Two speckled stoneware cups with a lid on a pale table",
    hoverImage: photo("stacked-bowls"),
    colors: ["chalk", "clay"],
    sizes: ["S", "M"],
    inStock: false,
    added: 7,
    rank: 5,
  },
  {
    id: "p-bowls",
    name: "Stacking bowls",
    detail: "Glazed stoneware",
    price: 56,
    image: photo("stacked-bowls"),
    alt: "Two stacked speckled ceramic bowls against a dark wall",
    hoverImage: photo("stoneware-cups"),
    colors: ["charcoal", "chalk"],
    sizes: ["S", "M", "L"],
    inStock: true,
    added: 3,
    rank: 6,
  },
  {
    id: "p-ceramic",
    name: "Arch ceramic lamp",
    detail: "Linen shade",
    price: 210,
    image: photo("ceramic-lamp"),
    alt: "A sculptural ceramic lamp with a linen shade on a walnut sideboard",
    hoverImage: photo("living-room"),
    colors: ["clay", "oat"],
    sizes: ["M", "L"],
    inStock: true,
    added: 10,
    rank: 7,
  },
  {
    id: "p-reader",
    name: "Reading armchair",
    detail: "Boucle and ash",
    price: 390,
    compareAt: 460,
    image: photo("reading-chair"),
    alt: "A grey armchair and ottoman with a knit throw in a dark green room",
    hoverImage: photo("home-office"),
    colors: ["charcoal", "sage"],
    sizes: ["M", "L"],
    inStock: true,
    added: 2,
    rank: 8,
  },
];

const sortOptions = [
  { id: "featured", label: "Featured" },
  { id: "newest", label: "Newest" },
  { id: "price-asc", label: "Price, low to high" },
  { id: "price-desc", label: "Price, high to low" },
] as const;

type SortId = (typeof sortOptions)[number]["id"];

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const fillStyle = { position: "absolute", height: "100%", width: "100%", inset: 0, color: "transparent" } as const;
const cn = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ");

const smooth = motionTokens.spring.smooth;
const snappy = motionTokens.spring.snappy;
const enter = [...motionTokens.ease.enter] as [number, number, number, number];

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
                transition={reduced ? { duration: 0 } : snappy}
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

function SortControl({ value, onChange }: { value: SortId; onChange: (next: SortId) => void }) {
  const id = useId();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => sortOptions.findIndex((option) => option.id === value));
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const openMenu = () => {
    setActive(sortOptions.findIndex((option) => option.id === value));
    setOpen(true);
  };
  const close = () => setOpen(false);
  const select = (next: SortId) => {
    onChange(next);
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  };
  const current = sortOptions.find((option) => option.id === value) ?? sortOptions[0];

  return (
    <div className={styles.sort} ref={root}>
      <button
        ref={button}
        type="button"
        className={styles.sortButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          openMenu();
        }}
      >
        <span className={styles.sortLabel}>Sort</span>
        <span>{current.label}</span>
        <ChevronDown size={15} strokeWidth={1.75} className={styles.chevron} data-open={open || undefined} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.ul
            key="list"
            id={`${id}-list`}
            ref={list}
            className={styles.sortMenu}
            role="listbox"
            aria-label="Sort products"
            tabIndex={-1}
            aria-activedescendant={`${id}-${sortOptions[active]?.id}`}
            initial={{ opacity: 0, scale: reduced ? 1 : 0.96, y: reduced ? 0 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.98, transition: { duration: motionTokens.duration.exit } }}
            transition={{ duration: motionTokens.duration.fast, ease: enter }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(sortOptions.length - 1, index + 1));
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(0, index - 1));
                return;
              }
              if (event.key === "Home") {
                event.preventDefault();
                setActive(0);
                return;
              }
              if (event.key === "End") {
                event.preventDefault();
                setActive(sortOptions.length - 1);
                return;
              }
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                const option = sortOptions[active];
                if (option) select(option.id);
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                close();
                button.current?.focus({ preventScroll: true });
                return;
              }
              if (event.key === "Tab") close();
            }}
          >
            {sortOptions.map((option, index) => (
              <li
                key={option.id}
                id={`${id}-${option.id}`}
                role="option"
                aria-selected={option.id === value}
                data-active={index === active || undefined}
                className={styles.sortOption}
                onPointerMove={() => setActive(index)}
                onClick={() => select(option.id)}
              >
                <span>{option.label}</span>
                {option.id === value ? <Check size={15} strokeWidth={1.75} aria-hidden="true" /> : null}
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function PriceRange({
  min,
  max,
  value,
  onChange,
  format,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (next: [number, number]) => void;
  format: (value: number) => string;
}) {
  const [from, to] = value;
  const pct = (next: number) => ((next - min) / Math.max(1, max - min)) * 100;
  return (
    <div className={styles.price}>
      <div className={styles.range}>
        <div className={styles.rangeTrack}>
          <span className={styles.rangeFill} style={{ left: `${pct(from)}%`, right: `${100 - pct(to)}%` }} />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={10}
          value={from}
          aria-label="Minimum price"
          aria-valuetext={format(from)}
          onChange={(event) => onChange([Math.min(Number(event.target.value), to - 10), to])}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={10}
          value={to}
          aria-label="Maximum price"
          aria-valuetext={format(to)}
          onChange={(event) => onChange([from, Math.max(Number(event.target.value), from + 10)])}
        />
      </div>
      <div className={styles.priceValues}>
        <Roll text={format(from)} />
        <Roll text={format(to)} />
      </div>
    </div>
  );
}

function Fieldset({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.groupTitle}>
        {title}
        {action}
      </legend>
      {children}
    </fieldset>
  );
}

/** Swatches read as light or dark so the check stays visible. */
const isLight = (hex: string) => {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (r + g + b) / 3 > 150;
};

/**
 * A storefront listing with a filter sidebar (dual price range, color swatches, sizes, in stock
 * switch), a sort menu, and product cards that swap to a second photo on hover.
 */
export function ProductListing({
  products = sampleProducts,
  colors = sampleColors,
  sizes = sampleSizes,
  defaultSort = "featured",
  onAddToCart,
  defaultCartCount = 0,
  currency = "USD",
  locale = "en-US",
  title = "Home goods",
  className,
}: ProductListingProps) {
  const id = useId();
  const reduced = useReducedMotion() ?? false;
  const money = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }),
    [locale, currency],
  );
  const bounds = useMemo<[number, number]>(() => {
    if (!products.length) return [0, 100];
    const prices = products.map((product) => product.price);
    return [Math.floor(Math.min(...prices) / 10) * 10, Math.ceil(Math.max(...prices) / 10) * 10];
  }, [products]);

  const [sort, setSort] = useState<SortId>(defaultSort);
  const [range, setRange] = useState<[number, number]>(bounds);
  const [colorFilter, setColorFilter] = useState<string[]>([]);
  const [sizeFilter, setSizeFilter] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [cartCount, setCartCount] = useState(defaultCartCount);
  const [quickAddId, setQuickAddId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const sizeRow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!justAddedId) return;
    const timer = window.setTimeout(() => setJustAddedId(null), 1400);
    return () => window.clearTimeout(timer);
  }, [justAddedId]);

  useEffect(() => {
    if (sheetOpen) sheet.current?.focus({ preventScroll: true });
  }, [sheetOpen]);

  useEffect(() => {
    if (quickAddId) sizeRow.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [quickAddId]);

  const filtered = useMemo(() => {
    const list = products.filter((product) => {
      if (product.price < range[0] || product.price > range[1]) return false;
      if (colorFilter.length && !product.colors.some((color) => colorFilter.includes(color))) return false;
      if (sizeFilter.length && !product.sizes.some((size) => sizeFilter.includes(size))) return false;
      if (inStockOnly && !product.inStock) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "newest") return b.added - a.added;
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      return a.rank - b.rank;
    });
  }, [products, range, colorFilter, sizeFilter, inStockOnly, sort]);

  const activeFilterCount =
    colorFilter.length + sizeFilter.length + (inStockOnly ? 1 : 0) + (range[0] !== bounds[0] || range[1] !== bounds[1] ? 1 : 0);

  const clearAll = () => {
    setRange(bounds);
    setColorFilter([]);
    setSizeFilter([]);
    setInStockOnly(false);
  };

  const toggle = (list: string[], setList: (next: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    filtersButton.current?.focus({ preventScroll: true });
  };

  const addToCart = (product: ListingProduct, size: string) => {
    setCartCount((count) => count + 1);
    setQuickAddId(null);
    setJustAddedId(product.id);
    setAnnounce(`${product.name}${product.sizes.length > 1 ? `, size ${size},` : ""} added to bag`);
    onAddToCart?.(product, size);
  };

  const colorOf = (colorId: string) => colors.find((color) => color.id === colorId);
  const colorName = (colorId: string) => colorOf(colorId)?.name ?? colorId;

  const filters = (
    <div className={styles.filterBody}>
      <Fieldset title="Price">
        <PriceRange min={bounds[0]} max={bounds[1]} value={range} onChange={setRange} format={(value) => money.format(value)} />
      </Fieldset>
      <Fieldset title="Color">
        <div className={styles.swatches}>
          {colors.map((color) => (
            <button
              key={color.id}
              type="button"
              className={styles.swatch}
              aria-pressed={colorFilter.includes(color.id)}
              aria-label={color.name}
              title={color.name}
              onClick={() => toggle(colorFilter, setColorFilter, color.id)}
            >
              <span className={styles.swatchFill} style={{ background: color.swatch }} />
              <span
                className={styles.swatchCheck}
                data-on={colorFilter.includes(color.id) || undefined}
                data-light={isLight(color.swatch) || undefined}
              >
                <Check size={14} strokeWidth={2.25} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      </Fieldset>
      <Fieldset title="Size">
        <div className={styles.sizes}>
          {sizes.map((size) => (
            <button
              key={size}
              type="button"
              className={styles.sizeChip}
              aria-pressed={sizeFilter.includes(size)}
              onClick={() => toggle(sizeFilter, setSizeFilter, size)}
            >
              {size}
            </button>
          ))}
        </div>
      </Fieldset>
      <label className={styles.switchRow}>
        <span>In stock only</span>
        <button
          type="button"
          role="switch"
          aria-checked={inStockOnly}
          className={styles.switch}
          onClick={() => setInStockOnly((value) => !value)}
        >
          <span className={styles.thumb} />
        </button>
      </label>
      <button type="button" className={styles.clearAll} onClick={clearAll} disabled={!activeFilterCount}>
        Clear filters
      </button>
    </div>
  );

  return (
    <div className={cn(styles.root, className)}>
      <div className={styles.frame}>
        <header className={styles.top}>
          <div className={styles.heading}>
            <h2>{title}</h2>
            <span className={styles.count}>
              <Roll text={String(filtered.length)} /> items
            </span>
          </div>
          <div className={styles.tools}>
            <button
              ref={filtersButton}
              type="button"
              className={styles.filterButton}
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
            >
              <SlidersHorizontal size={15} strokeWidth={1.75} aria-hidden="true" />
              Filters
              {activeFilterCount ? <span className={styles.badge}>{activeFilterCount}</span> : null}
            </button>
            <SortControl value={sort} onChange={setSort} />
            <span className={styles.bag} role="img" aria-label={`${cartCount} items in bag`}>
              <motion.span
                key={cartCount}
                className={styles.bagIcon}
                initial={!reduced && cartCount !== defaultCartCount ? { scale: 1.18, rotate: -8 } : false}
                animate={{ scale: 1, rotate: 0 }}
                transition={snappy}
              >
                <ShoppingBag size={18} strokeWidth={1.75} aria-hidden="true" />
              </motion.span>
              <span className={styles.bagCount} aria-hidden="true">
                <Roll text={String(cartCount)} />
              </span>
            </span>
          </div>
        </header>

        <div className={styles.body}>
          <aside className={styles.sidebar} aria-label="Filters">
            {filters}
          </aside>
          <div className={styles.results}>
            {filtered.length ? (
              <ul className={styles.grid}>
                <AnimatePresence mode="popLayout" initial={false}>
                  {filtered.map((product) => {
                    const active = quickAddId === product.id || justAddedId === product.id;
                    return (
                      <motion.li
                        key={product.id}
                        className={styles.card}
                        data-active={active || undefined}
                        layout={!reduced && "position"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
                        transition={reduced ? { duration: 0.12 } : smooth}
                      >
                        <div className={styles.media}>
                          <img className={styles.image} src={product.image} alt={product.alt} sizes="(max-width: 640px) 50vw, 260px" style={fillStyle} />
                          {product.hoverImage ? (
                            <img
                              className={styles.hoverImage}
                              src={product.hoverImage}
                              alt=""
                              sizes="(max-width: 640px) 50vw, 260px"
                              style={fillStyle}
                            />
                          ) : null}
                          <div className={styles.quick}>
                            <AnimatePresence mode="popLayout" initial={false}>
                              {justAddedId === product.id ? (
                                <motion.span
                                  key="done"
                                  className={styles.quickDone}
                                  initial={{ opacity: 0, filter: "blur(2px)" }}
                                  animate={{ opacity: 1, filter: "blur(0px)" }}
                                  exit={{ opacity: 0, filter: "blur(2px)" }}
                                  transition={{ duration: motionTokens.duration.standard, ease: enter }}
                                >
                                  <Check size={15} strokeWidth={1.75} aria-hidden="true" />
                                  Added
                                </motion.span>
                              ) : quickAddId === product.id ? (
                                <motion.div
                                  key="sizes"
                                  ref={sizeRow}
                                  className={styles.quickSizes}
                                  role="group"
                                  aria-label={`Choose a size for ${product.name}`}
                                  initial={{ opacity: 0, filter: "blur(2px)" }}
                                  animate={{ opacity: 1, filter: "blur(0px)" }}
                                  exit={{ opacity: 0, filter: "blur(2px)" }}
                                  transition={{ duration: motionTokens.duration.standard, ease: enter }}
                                  onKeyDown={(event) => {
                                    if (event.key !== "Escape") return;
                                    event.stopPropagation();
                                    setQuickAddId(null);
                                  }}
                                >
                                  {product.sizes.map((size) => (
                                    <button
                                      key={size}
                                      type="button"
                                      className={styles.quickSize}
                                      onClick={() => addToCart(product, size)}
                                    >
                                      {size}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    className={styles.quickClose}
                                    aria-label="Close sizes"
                                    onClick={() => setQuickAddId(null)}
                                  >
                                    <X size={14} strokeWidth={1.75} aria-hidden="true" />
                                  </button>
                                </motion.div>
                              ) : (
                                <motion.button
                                  key="add"
                                  type="button"
                                  className={styles.quickAdd}
                                  disabled={!product.inStock}
                                  aria-label={product.inStock ? `Quick add ${product.name}` : `${product.name} is sold out`}
                                  onClick={() => {
                                    if (product.sizes.length === 1) addToCart(product, product.sizes[0]);
                                    else setQuickAddId(product.id);
                                  }}
                                  initial={{ opacity: 0, filter: "blur(2px)" }}
                                  animate={{ opacity: 1, filter: "blur(0px)" }}
                                  exit={{ opacity: 0, filter: "blur(2px)" }}
                                  transition={{ duration: motionTokens.duration.fast, ease: enter }}
                                >
                                  {product.inStock ? (
                                    <>
                                      <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
                                      Quick add
                                    </>
                                  ) : (
                                    "Sold out"
                                  )}
                                </motion.button>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                        <div className={styles.info}>
                          <h3 className={styles.name} title={product.name}>
                            {product.name}
                          </h3>
                          <p className={styles.detail}>{product.detail}</p>
                          <div className={styles.meta}>
                            <span className={styles.priceTag}>
                              {product.compareAt ? <s className={styles.compare}>{money.format(product.compareAt)}</s> : null}
                              <span data-sale={!!product.compareAt || undefined}>{money.format(product.price)}</span>
                            </span>
                            <span className={styles.aside}>
                              {!product.inStock || product.badge ? (
                                <span className={styles.status}>{product.inStock ? product.badge : "Sold out"}</span>
                              ) : null}
                              <span className={styles.dots} role="img" aria-label={`Colors: ${product.colors.map(colorName).join(", ")}`}>
                                {product.colors.map((colorId) => (
                                  <span key={colorId} className={styles.dot} style={{ background: colorOf(colorId)?.swatch }} />
                                ))}
                              </span>
                            </span>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            ) : (
              <div className={styles.empty}>
                <p>No products match these filters</p>
                <button type="button" className={styles.clearAll} onClick={clearAll}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {sheetOpen ? (
          <motion.div
            key="sheet"
            className={styles.sheetLayer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
            transition={{ duration: motionTokens.duration.fast }}
          >
            <button type="button" className={styles.scrim} aria-label="Close filters" tabIndex={-1} onClick={closeSheet} />
            <motion.div
              ref={sheet}
              className={styles.sheet}
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              tabIndex={-1}
              initial={{ x: reduced ? 0 : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: reduced ? 0 : "-100%", transition: { duration: motionTokens.duration.exit, ease: enter } }}
              transition={reduced ? { duration: 0 } : smooth}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeSheet();
              }}
            >
              <div className={styles.sheetHead}>
                <h3>Filters</h3>
                <button type="button" className={styles.sheetClose} aria-label="Close filters" onClick={closeSheet}>
                  <X size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
              {filters}
              <button type="button" className={styles.showResults} onClick={closeSheet}>
                Show {filtered.length} {filtered.length === 1 ? "item" : "items"}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p className={styles.srOnly} role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

export default ProductListing;
