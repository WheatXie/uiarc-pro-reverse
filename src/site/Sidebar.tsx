import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, Check, ChevronDown, ChevronRight, Component, Layers, Search, Sparkles, X } from "lucide-react";
import { blockGroups, componentGroups, docs, specialGroups, type CatalogItem } from "./catalog";
import styles from "./sidebar.module.css";

type Tier = "all" | "free" | "pro";
type Scope = "all" | "docs" | "components" | "blocks" | "special";

const DOC_ITEMS: CatalogItem[] = docs.map((doc) => ({
  slug: doc.slug,
  title: doc.title,
  description: "",
  categories: [],
  dependencies: [],
  pro: false,
}));

interface Group {
  key: string;
  title: string;
  items: CatalogItem[];
  href: (slug: string) => string;
}

interface Section {
  key: Scope;
  title: string;
  icon: typeof BookOpen;
  groups: Group[];
}

const SCOPES: { value: Scope; title: string }[] = [
  { value: "all", title: "Everything" },
  { value: "docs", title: "Docs only" },
  { value: "components", title: "Components only" },
  { value: "blocks", title: "Blocks only" },
  { value: "special", title: "Special components only" },
];

/** Reference height/timing: the collapsed body reaches 0 in ~520ms with no overshoot. */
const COLLAPSE = { type: "spring", visualDuration: 0.34, bounce: 0 } as const;

function ProBadge() {
  return (
    <span className={[styles.pbBadge, styles.pro].join(" ")} data-arc-pro-badge="sm">
      <span className={styles.pbLabel}>Pro</span>
    </span>
  );
}

/** Counts roll like the reference's stacked-digit counters instead of snapping. */
function RollingCount({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (reduceMotion) {
      setShown(value);
      return;
    }
    const timer = window.setTimeout(() => setShown(value), 120);
    return () => window.clearTimeout(timer);
  }, [value, reduceMotion]);
  return (
    <>
      <motion.span key={value} initial={reduceMotion ? false : { y: "60%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={COLLAPSE}>
        {shown}
      </motion.span>
    </>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className={styles.match}>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

/**
 * The list lives inside the shell, but every page mounts its own <Layout>, so navigating between
 * items unmounts and remounts the sidebar. Keep the scroll offset in module scope so the list
 * stays where the reader left it instead of snapping back to the first row.
 */
let rememberedScroll = 0;
/** Same reason: the tier filter and collapsed groups should survive an item change. */
let rememberedTier: Tier | null = null;
let rememberedClosed: Set<string> = new Set();

export function Sidebar() {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  const [tier, setTier] = useState<Tier>(() => rememberedTier ?? "all");
  const [scope, setScope] = useState<Scope>("all");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [closed, setClosed] = useState<Set<string>>(() => new Set(rememberedClosed));
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(true);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeSlug = pathname.split("/").filter(Boolean).slice(-1)[0] ?? "";
  const filtering = tier !== "all" || query.length > 0 || scope !== "all";

  const sections = useMemo<Section[]>(() => {
    const keep = (item: CatalogItem) => {
      if (tier === "free" && item.pro) return false;
      if (tier === "pro" && !item.pro) return false;
      if (query && !item.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    };
    const build = (
      title: string,
      icon: Section["icon"],
      key: Scope,
      base: string,
      groups: { title: string; items: CatalogItem[] }[],
      href: (slug: string) => string,
    ): Section => ({
      key,
      title,
      icon,
      groups: [
        ...(base === "docs"
          ? [{ key: "docs", title: "", items: DOC_ITEMS.filter(keep), href: (slug: string) => `/docs/${slug}` }]
          : []),
        ...groups
          .map((group) => ({ key: `${base}:${group.title}`, title: group.title, items: group.items.filter(keep), href }))
          .filter((group) => group.items.length > 0),
      ],
    });
    return [
      build("Docs", BookOpen, "docs", "docs", [], (slug) => `/docs/${slug}`),
      build("Components", Component, "components", "c", componentGroups, (slug) => `/components/${slug}`),
      build("Blocks", Layers, "blocks", "b", blockGroups, (slug) => `/components/blocks/${slug}`),
      build("Special components", Sparkles, "special", "s", specialGroups, (slug) => `/components/${slug}`),
    ].filter((section) => (scope === "all" || section.key === scope) && section.groups.some((group) => group.items.length > 0));
  }, [tier, query, scope]);

  const counts = useMemo(() => {
    const groups = [...componentGroups, ...blockGroups, ...specialGroups];
    const all = DOC_ITEMS.length + groups.flatMap((group) => group.items).length;
    const free = DOC_ITEMS.length + groups.flatMap((group) => group.items).filter((item) => !item.pro).length;
    return { all, free, pro: all - free };
  }, []);

  const toggle = useCallback((key: string) => {
    setClosed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // The reference keeps ⌘K bound at the document level and Escape clears the field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (event.key === "Escape") {
        setMenuOpen(false);
        setTip(null);
        if (document.activeElement === inputRef.current) setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  // Fade masks follow the scroll position, exactly like `data-fade-top` / `data-fade-bottom`.
  const readScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    rememberedScroll = node.scrollTop;
    const max = node.scrollHeight - node.clientHeight;
    setFadeTop(node.scrollTop > 4);
    setFadeBottom(max > 4 && node.scrollTop < max - 4);
  }, []);

  useEffect(() => {
    rememberedTier = tier;
  }, [tier]);

  useEffect(() => {
    rememberedClosed = closed;
  }, [closed]);

  // Restore the offset before the first paint, then once more after layout settles (fonts/rows).
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node || rememberedScroll === 0) return;
    node.scrollTop = rememberedScroll;
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current && Math.abs(scrollRef.current.scrollTop - rememberedScroll) > 1) {
        scrollRef.current.scrollTop = rememberedScroll;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    readScroll();
    const node = scrollRef.current;
    if (!node) return;
    const observer = new ResizeObserver(readScroll);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    return () => observer.disconnect();
  }, [readScroll, sections]);

  const moveCursor = (step: number) => {
    const rows = [...(scrollRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-row]") ?? [])];
    if (!rows.length) return;
    const index = rows.findIndex((row) => row.dataset.row === cursor);
    const next = rows[(index + step + rows.length) % rows.length];
    setCursor(next.dataset.row ?? null);
    next.focus({ preventScroll: false });
  };

  return (
    <aside className={styles.aside} aria-label="Library navigation">
      <div className={styles.panel}>
        <div className={styles.top}>
          <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <label className={styles.search} data-focused={focused || undefined}>
                <Search width={14} height={14} strokeWidth={1.8} aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  placeholder="Search"
                  aria-label="Filter components, blocks and docs"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setQuery(event.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      moveCursor(1);
                    }
                  }}
                />
                {query ? (
                  <button type="button" className={styles.clear} aria-label="Clear search" onClick={() => { setQuery(""); inputRef.current?.focus(); }}>
                    <X width={12} height={12} strokeWidth={2} aria-hidden="true" />
                  </button>
                ) : (
                  <kbd className={styles.kbd} aria-hidden="true">⌘K</kbd>
                )}
              </label>
              <span className={styles.srOnly} role="status" aria-live="polite" />
            </div>
          </div>

          <div className={styles.tiers}>
            <div className={styles.tierMain} role="radiogroup" aria-label="Show">
              {(["all", "free", "pro"] as Tier[]).map((value) => {
                const checked = tier === value;
                return (
                  <motion.button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    title={`${counts[value]} items`}
                    onClick={() => setTier(value)}
                    whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  >
                    {checked && (
                      <motion.span layoutId="tier-indicator" className={styles.tierIndicator} transition={reduceMotion ? { duration: 0 } : COLLAPSE} />
                    )}
                    <span>{value === "all" ? "All" : value === "free" ? "Free" : "Pro"}</span>
                  </motion.button>
                );
              })}
            </div>
            <div ref={menuRef} style={{ position: "relative", flex: "1.15 1 0", display: "flex" }}>
              <button
                type="button"
                className={styles.tierMore}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                data-active={scope !== "all" || undefined}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span>
                  More
                  <motion.span className={styles.tierChevron} animate={{ rotate: menuOpen ? 180 : 0 }} transition={COLLAPSE} style={{ display: "inline-grid" }}>
                    <ChevronDown width={12} height={12} strokeWidth={2} aria-hidden="true" />
                  </motion.span>
                </span>
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    className={styles.tierMenu}
                    role="menu"
                    initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
                    transition={COLLAPSE}
                  >
                    {SCOPES.map((option) => (
                      <button key={option.value} type="button" role="menuitemradio" aria-checked={scope === option.value} onClick={() => { setScope(option.value); setMenuOpen(false); }}>
                        <span className={styles.menuCheck}>{scope === option.value && <Check width={12} height={12} strokeWidth={2.4} aria-hidden="true" />}</span>
                        <span className={styles.menuText}>{option.title}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className={styles.scroll}
          data-fade-top={fadeTop || undefined}
          data-fade-bottom={fadeBottom || undefined}
          onScroll={readScroll}
        >
          <div className={styles.content}>
            {sections.map((section) => {
              const Icon = section.icon;
              const shut = closed.has(section.key) && !filtering;
              const total = section.groups.reduce((sum, group) => sum + group.items.length, 0);
              if (!total) return null;
              return (
                <div key={section.key} className={styles.section}>
                  <button type="button" className={styles.sectionHead} aria-expanded={!shut} onClick={() => toggle(section.key)}>
                    <span className={styles.sectionIcon}>
                      <Icon width={15} height={15} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className={styles.sectionLabel}>{section.title}</span>
                    {section.key !== "docs" && (
                      <span className={styles.sectionCount}>
                        <RollingCount value={total} />
                      </span>
                    )}
                    <motion.span className={styles.chevron} animate={{ rotate: shut ? -90 : 0 }} transition={COLLAPSE}>
                      <ChevronDown width={14} height={14} strokeWidth={2} aria-hidden="true" />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {!shut && (
                      <motion.div
                        key="body"
                        className={styles.sectionBody}
                        initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={COLLAPSE}
                        style={{ overflow: "clip" }}
                      >
                        {section.groups.map((group) => {
                          const groupShut = group.title !== "" && closed.has(group.key) && !filtering;
                          return (
                            <div key={group.key} className={styles.group}>
                              {group.title && (
                                <button type="button" className={styles.groupHead} aria-expanded={!groupShut} onClick={() => toggle(group.key)}>
                                  <motion.span className={styles.groupChevron} animate={{ rotate: groupShut ? -90 : 0 }} transition={COLLAPSE}>
                                    <ChevronDown width={12} height={12} strokeWidth={2} aria-hidden="true" />
                                  </motion.span>
                                  <span className={styles.groupLabel}>{group.title}</span>
                                  <span className={styles.groupCount}>
                                    <RollingCount value={group.items.length} />
                                  </span>
                                </button>
                              )}

                              <AnimatePresence initial={false}>
                                {!groupShut && (
                                  <motion.div
                                    key="body"
                                    className={styles.groupBody}
                                    initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={COLLAPSE}
                                    style={{ overflow: "clip" }}
                                  >
                                    <div className={styles.rows}>
                                      {group.items.map((item) => {
                                        const active = item.slug === activeSlug && !filtering;
                                        return (
                                          <div key={item.slug} className={styles.rowWrap}>
                                            <Link
                                              to={group.href(item.slug)}
                                              className={styles.row}
                                              data-row={`${group.key}/${item.slug}`}
                                              data-cursor={cursor === `${group.key}/${item.slug}` || undefined}
                                              aria-current={active ? "page" : undefined}
                                              onMouseEnter={(event) => {
                                                const label = event.currentTarget.querySelector<HTMLElement>(`.${styles.label}`);
                                                if (!label || label.scrollWidth <= label.clientWidth) return;
                                                const box = event.currentTarget.getBoundingClientRect();
                                                setTip({ text: item.title, x: box.right + 8, y: box.top + box.height / 2 });
                                              }}
                                              onMouseLeave={() => setTip(null)}
                                              onFocus={() => setCursor(`${group.key}/${item.slug}`)}
                                              onKeyDown={(event) => {
                                                if (event.key === "ArrowDown") {
                                                  event.preventDefault();
                                                  moveCursor(1);
                                                }
                                                if (event.key === "ArrowUp") {
                                                  event.preventDefault();
                                                  moveCursor(-1);
                                                }
                                              }}
                                            >
                                              {active && <motion.span layoutId="sb-active" className={styles.pill} transition={reduceMotion ? { duration: 0 } : COLLAPSE} />}
                                              <span className={styles.label}>
                                                <Highlight text={item.title} query={query} />
                                              </span>
                                              {item.pro && <ProBadge />}
                                            </Link>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {!sections.length && (
              <div className={styles.empty}>
                <p>No matches</p>
                <p>Try another word, or switch back to All.</p>
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <Link to="/docs/changelog" className={styles.whatsNew}>
            <span className={styles.dot} aria-hidden="true" />
            What&rsquo;s new
            <span className={styles.whatsNewCount}>4 new</span>
            <span className={styles.whatsNewArrow}>
              <ChevronRight width={13} height={13} strokeWidth={2} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>

      <span className={styles.tip} data-open={tip ? "" : undefined} style={tip ? ({ "--tip-x": `${tip.x}px`, "--tip-y": `${tip.y}px` } as React.CSSProperties) : undefined} aria-hidden="true">
        {tip?.text}
      </span>
    </aside>
  );
}
