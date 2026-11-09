"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./glass-menu.module.css";

export interface GlassMenuItem {
  /** Stable id passed to `onSelect`. */
  id: string;
  /** Row text. Also used for typeahead. */
  label: string;
  /** A 16px icon. It takes the accent color while the row is highlighted. */
  icon?: ReactNode;
  /** Shortcut hint on the right, such as "⌘D". Display only. */
  shortcut?: string;
  /** Makes the row a checkbox item with an accent check. Leave undefined for plain actions. */
  checked?: boolean;
  /** Uses the danger color for destructive actions. */
  danger?: boolean;
  /** Skipped by the keyboard and ignores clicks. */
  disabled?: boolean;
  /** Nested rows. The submenu slides in place with a back row, one level deep. */
  items?: GlassMenuItem[];
  /** Keeps the menu open after the row is chosen. Handy for checkable rows. */
  keepOpen?: boolean;
}

export interface GlassMenuGroup {
  /** Stable id of the group. */
  id: string;
  /** A quiet heading above the group. */
  label?: string;
  /** Rows in this group. */
  items: GlassMenuItem[];
}

export interface GlassMenuProps {
  /** Rows in groups: `{ id, label?, items }`. Groups are separated by a hairline; `label` adds a quiet heading. */
  groups: GlassMenuGroup[];
  /** Trigger content, usually a short label and a chevron or an icon. */
  children: ReactNode;
  /** Accessible name of the menu. */
  label?: string;
  /** Accessible name of the trigger when it only shows an icon. */
  triggerLabel?: string;
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Called when the menu opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Called with the chosen row. Rows with `items` open their submenu instead. */
  onSelect?: (id: string, item: GlassMenuItem) => void;
  /** Which edge of the trigger the panel grows from. */
  align?: "start" | "end";
  /** Panel width in px, capped to the viewport. */
  width?: number;
  /** Extra class on the root. */
  className?: string;
  /** Inline styles on the root. */
  style?: CSSProperties;
}

type GlassMenuRow = { item: GlassMenuItem; groupIndex: number; groupLabel?: string } | { back: GlassMenuItem };

const BACK = "__glass-menu-back";

const rowKey = (row: GlassMenuRow) => ("back" in row ? BACK : row.item.id);
const rowItem = (row: GlassMenuRow) => ("back" in row ? row.back : row.item);

/**
 * A glass action menu. The trigger morphs into the panel on a spring, a glass pill slides between
 * rows, one submenu slides in place, and the panel morphs back into the trigger on close.
 */
export function GlassMenu({
  groups,
  children,
  label = "Actions",
  triggerLabel,
  open,
  defaultOpen = false,
  onOpenChange,
  onSelect,
  align = "start",
  width = 256,
  className,
  style,
}: GlassMenuProps) {
  const reduced = !!useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const typed = useRef({ text: "", at: 0 });
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;
  const [submenu, setSubmenu] = useState<string | null>(null);
  const [direction, setDirection] = useState(1);
  const [active, setActive] = useState<string | null>(null);
  const [listHeight, setListHeight] = useState<number | "auto">("auto");
  const [triggerBox, setTriggerBox] = useState({ w: 0, h: 40 });

  const setOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  const parent = useMemo(() => {
    if (!submenu) return null;
    for (const group of groups) for (const item of group.items) if (item.id === submenu && item.items) return item;
    return null;
  }, [groups, submenu]);

  const rows = useMemo<GlassMenuRow[]>(
    () =>
      parent
        ? [
            { back: { id: BACK, label: parent.label, icon: <ChevronLeft size={16} strokeWidth={1.75} aria-hidden /> } },
            ...(parent.items ?? []).map(item => ({ item, groupIndex: 1 })),
          ]
        : groups.flatMap((group, index) => group.items.map(item => ({ item, groupIndex: index, groupLabel: group.label }))),
    [groups, parent],
  );

  const enabled = useMemo(() => rows.filter(row => !rowItem(row).disabled).map(rowKey), [rows]);
  const viewKey = submenu ?? "root";
  const reserveIcon = rows.some(row => !!rowItem(row).icon);
  const reserveTrail = rows.some(row => rowItem(row).checked !== undefined || !!rowItem(row).items?.length);

  useLayoutEffect(() => {
    const element = triggerRef.current;
    if (!element) return;
    const measure = () =>
      setTriggerBox(current => (current.w === element.offsetWidth && current.h === element.offsetHeight ? current : { w: element.offsetWidth, h: element.offsetHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const close = useCallback(
    (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    },
    [setOpen],
  );

  const openMenu = (focusFirst: boolean, last = false) => {
    setSubmenu(null);
    setDirection(1);
    setListHeight("auto");
    const ids = groups
      .flatMap(group => group.items)
      .filter(item => !item.disabled)
      .map(item => item.id);
    setActive(focusFirst ? ((last ? ids.at(-1) : ids[0]) ?? null) : null);
    setOpen(true);
  };

  const [lastOpen, setLastOpen] = useState(isOpen);
  if (lastOpen !== isOpen) {
    setLastOpen(isOpen);
    if (!isOpen) {
      setSubmenu(null);
      setActive(null);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      const element = active ? itemRefs.current.get(`${viewKey}:${active}`) : menuRef.current;
      if (element && document.activeElement !== element) element.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, active, viewKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [isOpen, close]);

  const measureList = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const measure = () => setListHeight(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const enter = (item: GlassMenuItem) => {
    setDirection(1);
    setSubmenu(item.id);
    setActive(item.items?.find(entry => !entry.disabled)?.id ?? BACK);
  };

  const back = () => {
    setDirection(-1);
    setSubmenu(null);
    setActive(submenu);
  };

  const choose = (row: GlassMenuRow) => {
    const item = rowItem(row);
    if (item.disabled) return;
    if ("back" in row) {
      back();
      return;
    }
    if (item.items?.length) {
      enter(item);
      return;
    }
    onSelect?.(item.id, item);
    if (!item.keepOpen) close(true);
  };

  const move = (where: "first" | "last" | "next" | "prev") => {
    if (!enabled.length) return;
    const index = active ? enabled.indexOf(active) : -1;
    const next =
      where === "first"
        ? 0
        : where === "last"
          ? enabled.length - 1
          : where === "next"
            ? index < 0
              ? 0
              : (index + 1) % enabled.length
            : index < 0
              ? enabled.length - 1
              : (index - 1 + enabled.length) % enabled.length;
    setActive(enabled[next]);
  };

  const shellTransition = reduced ? { duration: 0 } : motionTokens.spring.morph;
  const glideTransition = reduced ? { duration: 0 } : motionTokens.spring.morph;
  const heightTransition = reduced ? { duration: 0 } : motionTokens.spring.smooth;
  const shellId = `${uid}-shell`;
  const menuId = `${uid}-menu`;
  const panelWidth = `min(${width}px, calc(100vw - 24px))`;
  const shellRadius = Math.min(triggerBox.h / 2, 22);
  const collapsed =
    align === "end"
      ? `inset(0px 0px calc(100% - ${triggerBox.h}px) calc(100% - ${triggerBox.w}px) round ${shellRadius}px)`
      : `inset(0px calc(100% - ${triggerBox.w}px) calc(100% - ${triggerBox.h}px) 0px round ${shellRadius}px)`;

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style} data-open={isOpen ? "" : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={triggerLabel}
        onClick={() => (isOpen ? close(true) : openMenu(false))}
        onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openMenu(true);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(true, true);
          }
        }}
      >
        {!isOpen && <motion.span layoutId={shellId} className={styles.shell} style={{ borderRadius: shellRadius }} transition={shellTransition} aria-hidden />}
        <span className={styles.triggerContent}>{children}</span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <div key="panel" className={styles.panel} data-align={align} style={{ width: panelWidth, minHeight: triggerBox.h }}>
            <motion.div layoutId={shellId} className={styles.shell} style={{ borderRadius: 22 }} transition={shellTransition} aria-hidden />
            <motion.div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={parent ? parent.label : label}
              tabIndex={-1}
              className={styles.menu}
              onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                const row = rows.find(entry => rowKey(entry) === active);
                switch (event.key) {
                  case "ArrowDown":
                    event.preventDefault();
                    move("next");
                    return;
                  case "ArrowUp":
                    event.preventDefault();
                    move("prev");
                    return;
                  case "Home":
                  case "PageUp":
                    event.preventDefault();
                    move("first");
                    return;
                  case "End":
                  case "PageDown":
                    event.preventDefault();
                    move("last");
                    return;
                  case "Enter":
                  case " ":
                    event.preventDefault();
                    if (row) choose(row);
                    return;
                  case "ArrowRight":
                    if (row && !("back" in row) && row.item.items?.length && !row.item.disabled) {
                      event.preventDefault();
                      enter(row.item);
                    }
                    return;
                  case "ArrowLeft":
                    if (submenu) {
                      event.preventDefault();
                      back();
                    }
                    return;
                  case "Escape":
                    event.preventDefault();
                    if (submenu) back();
                    else close(true);
                    return;
                  case "Tab":
                    event.preventDefault();
                    close(true);
                    return;
                }
                if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
                  const now = performance.now();
                  const text = (now - typed.current.at < 700 ? typed.current.text : "") + event.key.toLowerCase();
                  typed.current = { text, at: now };
                  const from = active ? enabled.indexOf(active) + +(text.length === 1) : 0;
                  const match = [...enabled.slice(from), ...enabled.slice(0, from)].find(id => {
                    const entry = rows.find(candidate => rowKey(candidate) === id);
                    return entry ? rowItem(entry).label.toLowerCase().startsWith(text) : false;
                  });
                  if (match) setActive(match);
                }
              }}
              onPointerLeave={() => setActive(null)}
              initial={reduced ? { opacity: 0 } : { opacity: 0, clipPath: collapsed, filter: `blur(${motionTokens.blur.soft}px)` }}
              animate={{
                opacity: 1,
                clipPath: reduced
                  ? "none"
                  : align === "end"
                    ? "inset(0px 0px calc(0% - 0px) calc(0% - 0px) round 22px)"
                    : "inset(0px calc(0% - 0px) calc(0% - 0px) 0px round 22px)",
                filter: "blur(0px)",
                transition: reduced
                  ? { duration: 0 }
                  : {
                      opacity: { duration: motionTokens.duration.fast, delay: 0.06 },
                      filter: { duration: motionTokens.duration.standard, delay: 0.06 },
                      clipPath: shellTransition,
                    },
              }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: 0 } }
                  : {
                      opacity: 0,
                      clipPath: collapsed,
                      filter: `blur(${motionTokens.blur.soft}px)`,
                      transition: {
                        opacity: { duration: motionTokens.duration.instant },
                        filter: { duration: motionTokens.duration.instant },
                        clipPath: shellTransition,
                      },
                    }
              }
            >
              <motion.div className={styles.viewport} initial={false} animate={{ height: listHeight }} transition={heightTransition}>
                <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                  <motion.div
                    key={viewKey}
                    className={styles.view}
                    custom={direction}
                    variants={{
                      enter: (custom: number) => (reduced ? { opacity: 1 } : { x: 36 * custom, opacity: 0 }),
                      center: { x: 0, opacity: 1 },
                      exit: (custom: number) => (reduced ? { opacity: 0 } : { x: -36 * custom, opacity: 0 }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={heightTransition}
                  >
                    <div ref={measureList} className={styles.list}>
                      {rows.map((row, index) => {
                        const item = rowItem(row);
                        const id = rowKey(row);
                        const highlighted = active === id;
                        const previous = index > 0 ? rows[index - 1] : null;
                        const separator = !("back" in row) && previous && !("back" in previous) && previous.groupIndex !== row.groupIndex;
                        const heading =
                          !("back" in row) && row.groupLabel && (!previous || "back" in previous || previous.groupIndex !== row.groupIndex) ? row.groupLabel : null;
                        const checkable = item.checked !== undefined;
                        return (
                          <div role="none" className={styles.rowWrap} key={id}>
                            {(separator || ("back" in (previous ?? row) && index === 1)) && <div role="separator" className={styles.separator} />}
                            {heading && (
                              <div role="presentation" className={styles.heading}>
                                {heading}
                              </div>
                            )}
                            <button
                              ref={node => {
                                const key = `${viewKey}:${id}`;
                                if (node) itemRefs.current.set(key, node);
                                else itemRefs.current.delete(key);
                              }}
                              type="button"
                              role={checkable ? "menuitemcheckbox" : "menuitem"}
                              aria-checked={checkable ? !!item.checked : undefined}
                              aria-haspopup={item.items?.length ? "menu" : undefined}
                              aria-disabled={item.disabled || undefined}
                              tabIndex={-1}
                              className={styles.item}
                              data-active={highlighted ? "" : undefined}
                              data-danger={item.danger ? "" : undefined}
                              data-back={"back" in row ? "" : undefined}
                              onPointerMove={() => {
                                if (!item.disabled && active !== id) setActive(id);
                              }}
                              onClick={() => choose(row)}
                            >
                              {highlighted && (
                                <motion.span
                                  layoutId={`${uid}-glide-${viewKey}`}
                                  className={styles.highlight}
                                  transition={glideTransition}
                                  initial={reduced ? false : { opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  aria-hidden
                                />
                              )}
                              {(item.icon || reserveIcon) && (
                                <span className={styles.icon} aria-hidden>
                                  {item.icon}
                                </span>
                              )}
                              <span className={styles.label}>{item.label}</span>
                              {item.shortcut && <kbd className={styles.shortcut}>{item.shortcut}</kbd>}
                              {checkable && <Check className={styles.check} data-on={item.checked ? "" : undefined} size={16} strokeWidth={2} aria-hidden />}
                              {item.items?.length ? (
                                <ChevronRight className={styles.chevron} size={16} strokeWidth={1.75} aria-hidden />
                              ) : !checkable && reserveTrail ? (
                                <span className={styles.trail} aria-hidden />
                              ) : null}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GlassMenu;
