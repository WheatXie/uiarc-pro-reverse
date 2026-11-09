"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { CalendarDays, ListChecks, Plus, TriangleAlert, X } from "lucide-react";
import Image from "next/image";
import { DropdownMenu } from "../dropdown-menu/dropdown-menu";
import { avatar } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./kanban-board.module.css";

/* ------------------------------------------------------------------ types */

/** A column on the board. Set `limit` to flag the column when it holds more cards than that. */
export interface KanbanColumn {
  /** Stable column id, stored on every card as `column`. */
  id: string;
  /** Heading shown above the column. */
  name: string;
  /** Work in progress limit; the count turns to a warning above it. */
  limit?: number;
}

/** Someone a card can be assigned to. Used for the card face, swimlanes and the assignee select. */
export interface KanbanPerson {
  /** Stable person id, stored on every card as `assignee`. */
  id: string;
  /** Full name, shown on the face and in the swimlane head. */
  name: string;
  /** Avatar URL; initials show when it is missing. */
  avatar?: string;
}

/** One checklist row inside a card. */
export interface KanbanChecklistItem {
  /** Stable item id. */
  id: string;
  /** Row text. */
  text: string;
  /** Whether the row is ticked. */
  done: boolean;
}

/** A card in board order. The array order is the order inside each column. */
export interface KanbanCard {
  /** Stable card id, shown as the card key. */
  id: string;
  /** Card title. */
  title: string;
  /** Column id the card sits in. */
  column: string;
  /** Assignee person id. */
  assignee: string;
  /** Small label with a coloured dot. */
  label?: string;
  /** Due date as display text, for example "Oct 2". */
  due?: string;
  /** Story point estimate, drawn as "n pt". */
  points?: number;
  /** Long form context, edited in the drawer. */
  description?: string;
  /** Checklist rows; the card shows done over total. */
  checklist?: KanbanChecklistItem[];
}

/** How the board is grouped: plain columns, or a swimlane per person. */
export type KanbanGroupBy = "status" | "assignee";

export interface KanbanBoardProps {
  /** Columns in order. Set `limit` on a column to warn when it holds more cards. */
  columns?: readonly KanbanColumn[];
  /** Assignees, used for avatars, swimlanes and the assignee select. */
  people?: readonly KanbanPerson[];
  /** Controlled cards in board order. Leave out for uncontrolled use. */
  cards?: readonly KanbanCard[];
  /** Initial cards when uncontrolled. */
  defaultCards?: readonly KanbanCard[];
  /** Called with the full ordered list after every move, edit, checklist toggle or new card. */
  onCardsChange?: (cards: KanbanCard[]) => void;
  /** Start in columns only or in swimlanes by assignee. */
  defaultGroupBy?: KanbanGroupBy;
  /** Person id that new cards are assigned to. */
  currentUser?: string;
  /** Board title. */
  title?: string;
  /** Extra class on the root. */
  className?: string;
}

/* ------------------------------------------------------------------- data */

const sampleColumns: readonly KanbanColumn[] = [
  { id: "backlog", name: "Backlog" },
  { id: "progress", name: "In progress", limit: 3 },
  { id: "review", name: "In review", limit: 2 },
  { id: "done", name: "Done" },
];

const samplePeople: readonly KanbanPerson[] = [
  { id: "emma", name: "Emma Collins", avatar: avatar("emma-collins") },
  { id: "marcus", name: "Marcus Johnson", avatar: avatar("marcus-johnson") },
  { id: "chloe", name: "Chloe Nguyen", avatar: avatar("chloe-nguyen") },
  { id: "daniel", name: "Daniel Kim", avatar: avatar("daniel-kim") },
];

const checklist = (...rows: [string, boolean][]): KanbanChecklistItem[] =>
  rows.map(([text, done], index) => ({ id: `c${index}`, text, done }));

const sampleCards: readonly KanbanCard[] = [
  {
    id: "BIL-142",
    title: "Proration preview when seats change mid-cycle",
    column: "backlog",
    assignee: "daniel",
    label: "Billing",
    due: "Oct 2",
    points: 5,
    description: "Show the prorated amount before a seat change is confirmed, using the upcoming invoice endpoint.",
    checklist: checklist(["Upcoming invoice call", false], ["Preview row in seat dialog", false], ["Copy review", false]),
  },
  {
    id: "BIL-151",
    title: "Dunning emails for failed renewals",
    column: "backlog",
    assignee: "chloe",
    label: "Lifecycle",
    due: "Oct 6",
    points: 3,
  },
  {
    id: "BIL-155",
    title: "Tax ID field for EU customers",
    column: "backlog",
    assignee: "marcus",
    label: "Billing",
    points: 2,
  },
  {
    id: "BIL-160",
    title: "Empty state for invoices list",
    column: "backlog",
    assignee: "emma",
    label: "Design",
    points: 1,
  },
  {
    id: "BIL-128",
    title: "Usage meter on the billing page",
    column: "progress",
    assignee: "emma",
    label: "Design",
    due: "Sep 26",
    points: 3,
    description: "Meter per metered feature with the current period, the included amount, and a forecast marker.",
    checklist: checklist(["Meter component", true], ["Forecast marker", true], ["Dark mode pass", false], ["Handoff notes", false]),
  },
  {
    id: "BIL-133",
    title: "Webhook retries for invoice.paid",
    column: "progress",
    assignee: "daniel",
    label: "API",
    due: "Sep 25",
    points: 5,
    checklist: checklist(["Idempotency keys", true], ["Backoff schedule", false]),
  },
  {
    id: "BIL-137",
    title: "Coupon stacking rules",
    column: "progress",
    assignee: "marcus",
    label: "Billing",
    due: "Sep 30",
    points: 3,
  },
  {
    id: "BIL-119",
    title: "Annual plan switch keeps credits",
    column: "review",
    assignee: "chloe",
    label: "Billing",
    due: "Sep 24",
    points: 3,
    checklist: checklist(["Credit carry over", true], ["Receipt line", true], ["QA on staging", false]),
  },
  {
    id: "BIL-124",
    title: "Invoice PDF uses workspace logo",
    column: "review",
    assignee: "emma",
    label: "Design",
    points: 2,
  },
  {
    id: "BIL-102",
    title: "Migrate prices to the new catalog",
    column: "done",
    assignee: "daniel",
    label: "API",
    points: 8,
  },
  {
    id: "BIL-108",
    title: "Billing settings information architecture",
    column: "done",
    assignee: "emma",
    label: "Design",
    points: 3,
  },
  {
    id: "BIL-111",
    title: "Payment method update flow",
    column: "done",
    assignee: "marcus",
    label: "Billing",
    points: 5,
  },
];

/* ---------------------------------------------------------------- helpers */

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Cell key: the column on its own, or `lane|column` when the board is in swimlanes. */
const cellKey = (column: string, lane?: string) => (lane ? `${lane}|${column}` : column);

/** Splits a cell key back into its lane and column halves. */
function parseCellKey(key: string): { lane?: string; column: string } {
  const split = key.indexOf("|");
  return split < 0 ? { column: key, lane: undefined } : { lane: key.slice(0, split), column: key.slice(split + 1) };
}

/** Whether a card belongs in a cell. */
function matchesCell(card: KanbanCard, key: string): boolean {
  const { column, lane } = parseCellKey(key);
  return card.column === column && (!lane || card.assignee === lane);
}

interface PointerCandidate {
  id: string;
  x: number;
  y: number;
  pointerId: number;
  touch: boolean;
  element: HTMLElement;
  armed: boolean;
  timer?: number;
}

interface DragState {
  id: string;
  cell: string;
  index: number;
  width: number;
  height: number;
  origin: { cell: string; index: number };
  dropping: boolean;
}

interface KeyboardDrag {
  id: string;
  snapshot: KanbanCard[];
}

/** A number whose digits roll into place when the value changes. */
function RollingNumber({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const chars = Array.from(String(value));
  return (
    <span className={styles.roll}>
      {chars.map((char, index) => (
        <span className={styles.rollDigit} aria-hidden="true" key={chars.length - index}>
          <motion.span
            className={styles.rollStrip}
            initial={false}
            animate={{ y: `${-10 * Number(char)}%` }}
            transition={reduced ? { duration: 0 } : motionTokens.spring.snappy}
          >
            {DIGITS.map(digit => (
              <span key={digit}>{digit}</span>
            ))}
          </motion.span>
        </span>
      ))}
      <span className={styles.srOnly}>{value}</span>
    </span>
  );
}

/** A round face: the avatar when there is one, initials otherwise. */
function Face({ person, size = 22 }: { person?: KanbanPerson; size?: number }) {
  if (!person) return null;
  const initials = person.name
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2);
  return (
    <span className={styles.face} style={{ width: size, height: size }} title={person.name}>
      {person.avatar ? (
        <Image src={person.avatar} alt="" fill sizes={`${size}px`} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}

/** The inside of a card. Shared by the board card and the floating overlay so both match. */
const CardBody = memo(function CardBody({ card, person, lifted }: { card: KanbanCard; person?: KanbanPerson; lifted?: boolean }) {
  const done = card.checklist?.filter(item => item.done).length ?? 0;
  const total = card.checklist?.length ?? 0;
  return (
    <div className={styles.cardInner} data-lifted={lifted || undefined}>
      <div className={styles.cardTop}>
        <span className={styles.cardId}>{card.id}</span>
        {card.label ? (
          <span className={styles.label} data-label={card.label}>
            {card.label}
          </span>
        ) : null}
      </div>
      <p className={styles.cardTitle}>{card.title}</p>
      <div className={styles.cardMeta}>
        {card.due ? (
          <span className={styles.metaItem}>
            <CalendarDays size={13} aria-hidden="true" />
            {card.due}
          </span>
        ) : null}
        {total ? (
          <span className={styles.metaItem} data-complete={done === total || undefined}>
            <ListChecks size={13} aria-hidden="true" />
            {done}/{total}
          </span>
        ) : null}
        {card.points ? (
          <span className={styles.metaItem} aria-label={`${card.points} points`}>
            {card.points} pt
          </span>
        ) : null}
        <span className={styles.metaFace}>
          <Face person={person} />
        </span>
      </div>
    </div>
  );
});

/**
 * A kanban board with physical drag and drop. The lifted card follows the pointer from where you
 * grabbed it and tilts with speed, a slot opens where it will land, the board scrolls at its edges,
 * and the card springs into the slot on release. Group by assignee for swimlanes, with live WIP
 * limits, quick add and a detail drawer.
 */
export function KanbanBoard({
  columns = sampleColumns,
  people = samplePeople,
  cards,
  defaultCards = sampleCards,
  onCardsChange,
  defaultGroupBy = "status",
  currentUser = samplePeople[0].id,
  title = "Billing v2",
  className,
}: KanbanBoardProps) {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  const [internalCards, setInternalCards] = useState<KanbanCard[]>(() => [...defaultCards]);
  const list = cards ? [...cards] : internalCards;
  const listRef = useRef(list);
  useLayoutEffect(() => {
    listRef.current = list;
  });

  /** Writes the next list out: the internal copy when uncontrolled, plus the callback either way. */
  const updateCards = useCallback(
    (next: KanbanCard[]) => {
      listRef.current = next;
      if (!cards) setInternalCards(next);
      onCardsChange?.(next);
    },
    [cards, onCardsChange],
  );

  const [groupBy, setGroupBy] = useState<KanbanGroupBy>(defaultGroupBy);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const setDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDragState(next);
  };

  /** Remount keys: bumped after a drop so the settled card starts from its new slot. */
  const [remount, setRemount] = useState<Record<string, number>>({});
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [keyboardDrag, setKeyboardDrag] = useState<KeyboardDrag | null>(null);
  const [composerCell, setComposerCell] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const frameRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pointerCandidate = useRef<PointerCandidate | null>(null);
  const pointerPosition = useRef({ x: 0, y: 0 });
  const grabOffset = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0, t: 0, px: 0, py: 0 });
  const suppressClick = useRef(false);
  const openerRef = useRef<string | null>(null);

  const overlayX = useMotionValue(0);
  const overlayY = useMotionValue(0);
  const overlayTilt = useSpring(0, { stiffness: 380, damping: 38 });
  const personMap = useMemo(() => new Map(people.map(entry => [entry.id, entry])), [people]);
  const columnName = (id: string) => columns.find(column => column.id === id)?.name ?? id;
  const lanes = groupBy === "assignee" ? people.map(entry => entry.id) : [undefined];

  /* ----------------------------------------------------------- card order */

  /** Moves a card into `key` at `index`, keeping the flat array order as the board order. */
  const insertCard = useCallback((current: KanbanCard[], id: string, key: string, index: number): KanbanCard[] => {
    const card = current.find(entry => entry.id === id);
    if (!card) return current;
    const { column, lane } = parseCellKey(key);
    const moved: KanbanCard = { ...card, column, assignee: lane ?? card.assignee };
    const rest = current.filter(entry => entry.id !== id);
    const inCell = rest.filter(entry => matchesCell(entry, key));
    const target = inCell[index];
    const at = target
      ? rest.indexOf(target)
      : inCell.length
        ? rest.indexOf(inCell[inCell.length - 1]!) + 1
        : rest.length;
    return [...rest.slice(0, at), moved, ...rest.slice(at)];
  }, []);

  /** Where a card currently sits: its cell key and its index inside that cell. */
  const locateCard = useCallback(
    (id: string, current: KanbanCard[] = listRef.current) => {
      const card = current.find(entry => entry.id === id);
      if (!card) return null;
      const key = cellKey(card.column, groupBy === "assignee" ? card.assignee : undefined);
      return { key, index: current.filter(entry => matchesCell(entry, key)).findIndex(entry => entry.id === id) };
    },
    [groupBy],
  );

  /* ------------------------------------------------------------ hit test */

  /** Finds the cell under the pointer and the index the card would land at inside it. */
  const hitTest = useCallback((x: number, y: number) => {
    const board = frameRef.current;
    if (!board) return null;
    let best: HTMLElement | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const cell of Array.from(board.querySelectorAll<HTMLElement>("[data-cell]"))) {
      const rect = cell.getBoundingClientRect();
      if (y < rect.top - 12 || y > rect.bottom + 12) continue;
      const distance = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = cell;
      }
    }
    if (!best || bestDistance > 40) return null;
    const cardEls = Array.from(best.querySelectorAll<HTMLElement>("[data-card-id]"));
    let index = cardEls.length;
    for (let step = 0; step < cardEls.length; step++) {
      const rect = cardEls[step]!.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) {
        index = step;
        break;
      }
    }
    return { cell: best.dataset.cell as string, index };
  }, []);

  const updateTarget = useCallback(() => {
    const current = dragRef.current;
    if (!current || current.dropping) return;
    const target = hitTest(pointerPosition.current.x, pointerPosition.current.y);
    if (target && (target.cell !== current.cell || target.index !== current.index)) {
      setDrag({ ...current, ...target });
    }
  }, [hitTest]);

  const moveOverlay = useCallback(() => {
    const board = frameRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    overlayX.set(pointerPosition.current.x - rect.left - grabOffset.current.x);
    overlayY.set(pointerPosition.current.y - rect.top - grabOffset.current.y);
  }, [overlayX, overlayY]);

  /* ---------------------------------------------------------------- drag */

  const startDrag = useCallback(
    (candidate: PointerCandidate) => {
      const board = frameRef.current;
      const spot = locateCard(candidate.id);
      if (!board || !spot) return;
      const rect = candidate.element.getBoundingClientRect();
      const boardRect = board.getBoundingClientRect();
      grabOffset.current = { x: candidate.x - rect.left, y: candidate.y - rect.top };
      overlayX.set(rect.left - boardRect.left);
      overlayY.set(rect.top - boardRect.top);
      velocity.current = { x: 0, y: 0, t: performance.now(), px: candidate.x, py: candidate.y };
      setDrag({
        id: candidate.id,
        cell: spot.key,
        index: spot.index,
        width: rect.width,
        height: rect.height,
        origin: { cell: spot.key, index: spot.index },
        dropping: false,
      });
      suppressClick.current = true;
      const card = listRef.current.find(entry => entry.id === candidate.id);
      setAnnouncement(`Picked up ${card?.title}.`);
    },
    [locateCard, overlayX, overlayY],
  );

  /* Auto scroll while a card is held near an edge, then re-run the hit test. */
  useEffect(() => {
    if (!dragState || dragState.dropping) return;
    let frame = 0;
    const tick = () => {
      const scroller = scrollerRef.current;
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        const zone = Math.min(64, rect.width / 5);
        const push = (distance: number) => (distance <= 0 ? 0 : Math.ceil(20 * Math.min(1, distance / zone) ** 2));
        const { x, y } = pointerPosition.current;
        const dx = -1 * push(rect.left + zone - x) + push(x - (rect.right - zone));
        const dy = -1 * push(rect.top + zone - y) + push(y - (rect.bottom - zone));
        if (dx || dy) {
          const beforeX = scroller.scrollLeft;
          const beforeY = scroller.scrollTop;
          scroller.scrollLeft += dx;
          scroller.scrollTop += dy;
          if (scroller.scrollLeft !== beforeX || scroller.scrollTop !== beforeY) updateTarget();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragState, updateTarget]);

  const endDrag = useCallback(
    (cancel = false) => {
      const current = dragRef.current;
      if (!current || current.dropping) return;
      const target: DragState = cancel
        ? { ...current, ...current.origin, dropping: true }
        : { ...current, dropping: true };
      setDrag(target);
      overlayTilt.set(0);
      const { column } = parseCellKey(target.cell);
      const card = listRef.current.find(entry => entry.id === target.id);
      setAnnouncement(cancel ? `${card?.title} returned.` : `Dropped ${card?.title} in ${columnName(column)}.`);

      const commit = () => {
        if (!cancel) updateCards(insertCard(listRef.current, target.id, target.cell, target.index));
        setRemount(keys => ({ ...keys, [target.id]: (keys[target.id] ?? 0) + 1 }));
        setDrag(null);
      };

      if (reduced) {
        requestAnimationFrame(commit);
        return;
      }

      /* Chase the placeholder's live position on a spring, carrying the throw velocity. */
      let vx = velocity.current.x;
      let vy = velocity.current.y;
      let last = performance.now();
      const damping = 2 * Math.sqrt(460) * 0.8;
      const step = (now: number) => {
        const board = frameRef.current;
        const placeholder = board?.querySelector<HTMLElement>("[data-placeholder]");
        if (!board || !placeholder) {
          commit();
          return;
        }
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        const boardRect = board.getBoundingClientRect();
        const slot = placeholder.getBoundingClientRect();
        const tx = slot.left - boardRect.left;
        const ty = slot.top - boardRect.top;
        const cx = overlayX.get();
        const cy = overlayY.get();
        vx += (460 * (tx - cx) - damping * vx) * dt;
        vy += (460 * (ty - cy) - damping * vy) * dt;
        overlayX.set(cx + vx * dt);
        overlayY.set(cy + vy * dt);
        if (Math.abs(tx - cx) < 0.5 && Math.abs(ty - cy) < 0.5 && Math.abs(vx) < 20 && Math.abs(vy) < 20) {
          overlayX.set(tx);
          overlayY.set(ty);
          commit();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [insertCard, overlayTilt, overlayX, overlayY, reduced, updateCards],
  );

  /* Pointer travel, throw velocity, tilt, pointer-up and Escape. */
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const candidate = pointerCandidate.current;
      pointerPosition.current = { x: event.clientX, y: event.clientY };
      if (candidate && event.pointerId === candidate.pointerId && !dragRef.current) {
        const travel = Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y);
        if (candidate.touch && !candidate.armed) {
          if (travel > 8) {
            window.clearTimeout(candidate.timer);
            pointerCandidate.current = null;
          }
          return;
        }
        if (!(travel > 5)) return;
        startDrag(candidate);
      }
      const current = dragRef.current;
      if (!current || current.dropping || (candidate && event.pointerId !== candidate.pointerId)) return;
      const now = performance.now();
      const last = velocity.current;
      const dt = Math.max(1, now - last.t);
      last.x = 0.6 * last.x + ((event.clientX - last.px) / dt) * 400;
      last.y = 0.6 * last.y + ((event.clientY - last.py) / dt) * 400;
      last.t = now;
      last.px = event.clientX;
      last.py = event.clientY;
      if (!reduced) overlayTilt.set(Math.max(-7, Math.min(7, last.x / 160)));
      moveOverlay();
      updateTarget();
    };
    const onUp = (event: PointerEvent) => {
      const candidate = pointerCandidate.current;
      if (candidate && event.pointerId !== candidate.pointerId) return;
      if (candidate) window.clearTimeout(candidate.timer);
      pointerCandidate.current = null;
      if (dragRef.current) endDrag(event.type === "pointercancel");
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && dragRef.current) {
        event.preventDefault();
        endDrag(true);
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (dragRef.current || pointerCandidate.current?.armed) event.preventDefault();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [endDrag, moveOverlay, overlayTilt, reduced, startDrag, updateTarget]);

  /* ------------------------------------------------------- keyboard model */

  const focusCard = (id: string) =>
    requestAnimationFrame(() =>
      frameRef.current?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: false }),
    );

  const addCard = (key: string) => {
    const text = composerText.trim();
    if (!text) {
      setComposerCell(null);
      return;
    }
    const { column, lane } = parseCellKey(key);
    const highest = listRef.current.reduce((max, entry) => Math.max(max, Number(entry.id.replace(/\D/g, "")) || 0), 0);
    const card: KanbanCard = { id: `BIL-${highest + 1}`, title: text, column, assignee: lane ?? currentUser };
    updateCards(insertCard([...listRef.current, card], card.id, key, Number.MAX_SAFE_INTEGER));
    setComposerText("");
    setAnnouncement(`Added ${text} to ${columnName(column)}.`);
  };

  const openDrawer = (id: string) => {
    openerRef.current = id;
    setDrawerId(id);
  };

  const draggedCard = dragState ? list.find(entry => entry.id === dragState.id) : undefined;
  const counts = new Map(columns.map(column => [column.id, list.filter(entry => entry.column === column.id).length]));
  if (dragState && draggedCard) {
    const targetColumn = parseCellKey(dragState.cell).column;
    counts.set(draggedCard.column, (counts.get(draggedCard.column) ?? 1) - 1);
    counts.set(targetColumn, (counts.get(targetColumn) ?? 0) + 1);
  }
  const isOver = (column: KanbanColumn) => column.limit !== undefined && (counts.get(column.id) ?? 0) > column.limit;
  const layoutTransition = reduced ? { duration: 0 } : motionTokens.spring.smooth;
  const drawerCard = drawerId ? list.find(entry => entry.id === drawerId) : undefined;

  /** Physical pointer start: mouse drags after 5 px, touch after a 240 ms press. */
  const onCardPointerDown = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0 || dragRef.current || keyboardDrag) return;
    suppressClick.current = false;
    const touch = event.pointerType !== "mouse";
    const candidate: PointerCandidate = {
      id,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      touch,
      element: event.currentTarget,
      armed: !touch,
    };
    pointerPosition.current = { x: event.clientX, y: event.clientY };
    if (touch) {
      candidate.timer = window.setTimeout(() => {
        if (pointerCandidate.current === candidate) {
          candidate.armed = true;
          startDrag(candidate);
        }
      }, 240);
    }
    pointerCandidate.current = candidate;
  };

  /** Lift, move, drop and cancel from the keyboard, announced step by step. */
  const onCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, card: KanbanCard) => {
    if (event.key === "Enter" && !keyboardDrag) {
      event.preventDefault();
      openDrawer(card.id);
      return;
    }
    if (event.key === " " && !keyboardDrag) {
      event.preventDefault();
      setKeyboardDrag({ id: card.id, snapshot: listRef.current });
      const spot = locateCard(card.id);
      setAnnouncement(
        `Lifted ${card.title}. ${columnName(card.column)}, position ${(spot?.index ?? 0) + 1}. Use arrow keys to move, space to drop, escape to cancel.`,
      );
      return;
    }
    if (!keyboardDrag || keyboardDrag.id !== card.id) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setKeyboardDrag(null);
      setAnnouncement(`Dropped ${card.title} in ${columnName(card.column)}.`);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      updateCards(keyboardDrag.snapshot);
      setKeyboardDrag(null);
      setAnnouncement(`${card.title} returned.`);
      focusCard(card.id);
      return;
    }
    const spot = locateCard(card.id);
    if (!spot) return;
    const { column, lane } = parseCellKey(spot.key);
    const columnIndex = columns.findIndex(entry => entry.id === column);
    let key = spot.key;
    let index = spot.index;
    if (event.key === "ArrowUp" && event.shiftKey && lane) {
      const laneIndex = people.findIndex(entry => entry.id === lane);
      if (laneIndex > 0) key = cellKey(column, people[laneIndex - 1]!.id);
    } else if (event.key === "ArrowDown" && event.shiftKey && lane) {
      const laneIndex = people.findIndex(entry => entry.id === lane);
      if (laneIndex < people.length - 1) key = cellKey(column, people[laneIndex + 1]!.id);
    } else if (event.key === "ArrowUp") {
      index = Math.max(0, index - 1);
    } else if (event.key === "ArrowDown") {
      index += 1;
    } else if (event.key === "ArrowLeft" && columnIndex > 0) {
      key = cellKey(columns[columnIndex - 1]!.id, lane);
    } else if (event.key === "ArrowRight" && columnIndex < columns.length - 1) {
      key = cellKey(columns[columnIndex + 1]!.id, lane);
    } else {
      return;
    }
    event.preventDefault();
    if (key !== spot.key) {
      index = Math.min(index, listRef.current.filter(entry => entry.id !== card.id && matchesCell(entry, key)).length);
    }
    const next = insertCard(listRef.current, card.id, key, index);
    updateCards(next);
    const parsed = parseCellKey(key);
    const position = next.filter(entry => matchesCell(entry, key)).findIndex(entry => entry.id === card.id) + 1;
    setAnnouncement(
      `${columnName(parsed.column)}${parsed.lane ? `, ${personMap.get(parsed.lane)?.name}` : ""}, position ${position}.`,
    );
    focusCard(card.id);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div ref={frameRef} className={[styles.frame, className].filter(Boolean).join(" ")} data-dragging={dragState ? "" : undefined}>
        <header className={styles.toolbar}>
          <div className={styles.heading}>
            <h2>{title}</h2>
            <span className={styles.total}>
              <RollingNumber value={list.length} /> cards
            </span>
          </div>
          <div className={styles.group} role="radiogroup" aria-label="Group by">
            {(["status", "assignee"] as const).map(option => (
              <button
                type="button"
                role="radio"
                aria-checked={groupBy === option}
                className={styles.groupOption}
                onClick={() => {
                  setGroupBy(option);
                  setComposerCell(null);
                }}
                key={option}
              >
                {groupBy === option ? (
                  <motion.span layoutId={`${uid}-group`} className={styles.groupPill} transition={motionTokens.spring.morph} />
                ) : null}
                <span>{option === "status" ? "Status" : "Swimlanes"}</span>
              </button>
            ))}
          </div>
        </header>

        <LayoutGroup id={uid}>
          <motion.div ref={scrollerRef} layoutScroll className={styles.scroller}>
            <div className={styles.board} style={{ "--cols": columns.length } as CSSProperties} data-mode={groupBy}>
              <div className={styles.headRow}>
                {columns.map(column => {
                  const count = counts.get(column.id) ?? 0;
                  const over = isOver(column);
                  return (
                    <div className={styles.columnHead} data-over={over || undefined} key={column.id}>
                      <span className={styles.columnName}>{column.name}</span>
                      <span className={styles.count} aria-label={column.limit ? `${count} of ${column.limit}` : `${count} cards`}>
                        <RollingNumber value={count} />
                        {column.limit ? <span className={styles.limit}>/{column.limit}</span> : null}
                      </span>
                      <AnimatePresence initial={false}>
                        {over ? (
                          <motion.span
                            className={styles.overTag}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={motionTokens.spring.snappy}
                            key="over"
                          >
                            Over limit
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Add card to ${column.name}`}
                        onClick={() => {
                          setComposerText("");
                          setComposerCell(cellKey(column.id, groupBy === "assignee" ? currentUser : undefined));
                        }}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {lanes.map(lane => {
                const person = lane ? personMap.get(lane) : undefined;
                return (
                  <section className={styles.lane} aria-label={person ? `${person.name} lane` : undefined} key={lane ?? "all"}>
                    {person ? (
                      <div className={styles.laneHead}>
                        <Face person={person} size={24} />
                        <span>{person.name}</span>
                        <span className={styles.laneCount}>
                          <RollingNumber
                            value={
                              list.filter(entry => entry.assignee === lane && entry.id !== dragState?.id).length +
                              (dragState && parseCellKey(dragState.cell).lane === lane ? 1 : 0)
                            }
                          />
                        </span>
                      </div>
                    ) : null}
                    <div className={styles.row}>
                      {columns.map(column => {
                        const key = cellKey(column.id, lane);
                        const cellCards = list.filter(entry => matchesCell(entry, key) && entry.id !== dragState?.id);
                        const placeholderIndex = dragState && dragState.cell === key ? dragState.index : -1;
                        const overLimit = dragState && dragState.cell === key && isOver(column);
                        const nodes = cellCards.map(card => {
                          const lifted = keyboardDrag?.id === card.id;
                          return (
                            <motion.div
                              layoutId={`${uid}-${card.id}-${remount[card.id] ?? 0}`}
                              layout="position"
                              transition={layoutTransition}
                              className={styles.card}
                              data-card-id={card.id}
                              data-lifted={lifted || undefined}
                              role="button"
                              tabIndex={0}
                              aria-roledescription="Draggable card"
                              aria-label={`${card.title}, ${card.id}, ${personMap.get(card.assignee)?.name ?? "Unassigned"}`}
                              aria-pressed={lifted || undefined}
                              onPointerDown={event => onCardPointerDown(event, card.id)}
                              onClick={() => {
                                if (suppressClick.current) {
                                  suppressClick.current = false;
                                  return;
                                }
                                if (!keyboardDrag) openDrawer(card.id);
                              }}
                              onKeyDown={event => onCardKeyDown(event, card)}
                              key={card.id}
                            >
                              <CardBody card={card} person={personMap.get(card.assignee)} lifted={lifted} />
                            </motion.div>
                          );
                        });
                        if (placeholderIndex >= 0) {
                          nodes.splice(
                            placeholderIndex,
                            0,
                            <motion.div
                              layout="position"
                              transition={layoutTransition}
                              data-placeholder=""
                              className={styles.placeholder}
                              data-warn={overLimit || undefined}
                              style={{ height: dragState?.height }}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              key="placeholder"
                            >
                              {overLimit ? (
                                <span className={styles.placeholderNote}>
                                  <TriangleAlert size={14} aria-hidden="true" /> Over the limit of {column.limit}
                                </span>
                              ) : null}
                            </motion.div>,
                          );
                        }
                        const composing = composerCell === key;
                        return (
                          <div
                            className={styles.cell}
                            data-cell={key}
                            data-over={isOver(column) || undefined}
                            data-target={dragState && dragState.cell === key && !dragState.dropping ? "" : undefined}
                            key={key}
                          >
                            {nodes}
                            <AnimatePresence initial={false}>
                              {composing ? (
                                <motion.form
                                  className={styles.composer}
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={layoutTransition}
                                  onSubmit={event => {
                                    event.preventDefault();
                                    addCard(key);
                                  }}
                                  key="composer"
                                >
                                  <textarea
                                    autoFocus
                                    rows={2}
                                    value={composerText}
                                    placeholder="Card title"
                                    aria-label={`New card in ${column.name}`}
                                    onChange={event => setComposerText(event.target.value)}
                                    onBlur={() => {
                                      if (!composerText.trim()) setComposerCell(null);
                                    }}
                                    onKeyDown={event => {
                                      if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        addCard(key);
                                      }
                                      if (event.key === "Escape") {
                                        setComposerCell(null);
                                        setComposerText("");
                                      }
                                    }}
                                  />
                                  <div className={styles.composerActions}>
                                    <button type="submit" className={styles.primarySmall} disabled={!composerText.trim()}>
                                      Add card
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.ghostSmall}
                                      onMouseDown={event => event.preventDefault()}
                                      onClick={() => {
                                        setComposerCell(null);
                                        setComposerText("");
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </motion.form>
                              ) : groupBy === "status" ? (
                                <motion.button
                                  type="button"
                                  layout="position"
                                  transition={layoutTransition}
                                  className={styles.addRow}
                                  onClick={() => {
                                    setComposerText("");
                                    setComposerCell(key);
                                  }}
                                  key="add"
                                >
                                  <Plus size={14} aria-hidden="true" /> Add card
                                </motion.button>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </motion.div>
        </LayoutGroup>

        {dragState && draggedCard ? (
          <motion.div
            className={styles.overlay}
            style={{ x: overlayX, y: overlayY, rotate: overlayTilt, width: dragState.width }}
            aria-hidden="true"
          >
            <motion.div
              className={styles.overlayCard}
              initial={{ scale: 1 }}
              animate={{ scale: dragState.dropping ? 1 : 1.035 }}
              transition={motionTokens.spring.snappy}
              data-dropping={dragState.dropping || undefined}
            >
              <CardBody card={draggedCard} person={personMap.get(draggedCard.assignee)} />
            </motion.div>
          </motion.div>
        ) : null}

        <AnimatePresence>
          {drawerCard ? (
            <CardDrawer
              uid={uid}
              card={drawerCard}
              columns={columns}
              people={people}
              onClose={() => {
                setDrawerId(null);
                if (openerRef.current) focusCard(openerRef.current);
              }}
              onChange={patch =>
                updateCards(listRef.current.map(entry => (entry.id === drawerCard.id ? { ...entry, ...patch } : entry)))
              }
              key="drawer"
            />
          ) : null}
        </AnimatePresence>

        <p className={styles.srOnly} aria-live="assertive">
          {announcement}
        </p>
      </div>
    </MotionConfig>
  );
}

/* ---------------------------------------------------------------- drawer */

interface CardDrawerProps {
  uid: string;
  card: KanbanCard;
  columns: readonly KanbanColumn[];
  people: readonly KanbanPerson[];
  onClose: () => void;
  onChange: (patch: Partial<KanbanCard>) => void;
}

/** The detail drawer: title, status, properties, description and checklist for one card. */
function CardDrawer({ uid, card, columns, people, onClose, onChange }: CardDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const done = card.checklist?.filter(item => item.done).length ?? 0;
  const total = card.checklist?.length ?? 0;
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    drawerRef.current?.querySelector("button")?.focus({ preventScroll: true });
  }, []);

  /* The title textarea grows with its content. */
  useLayoutEffect(() => {
    const node = titleRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [card.title]);

  return (
    <>
      <motion.div
        className={styles.scrim}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] }}
        onClick={onClose}
      />
      <motion.div
        ref={drawerRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-drawer-title`}
        initial={{ x: "104%" }}
        animate={{ x: 0 }}
        exit={{ x: "104%" }}
        transition={motionTokens.spring.smooth}
        onKeyDown={event => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
            return;
          }
          if (event.key !== "Tab" || !drawerRef.current) return;
          const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>("button, input, textarea, select")).filter(
            node => !node.hasAttribute("disabled"),
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className={styles.drawerHead}>
          <span id={`${uid}-drawer-title`} className={styles.cardId}>
            {card.id}
          </span>
          <button type="button" className={styles.iconButton} aria-label="Close details" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <textarea
          ref={titleRef}
          className={styles.titleInput}
          value={card.title}
          rows={1}
          aria-label="Title"
          onChange={event => onChange({ title: event.target.value.replace(/\n/g, " ") })}
        />

        <div className={styles.statusRow} role="radiogroup" aria-label="Status">
          {columns.map(column => (
            <button
              type="button"
              role="radio"
              aria-checked={card.column === column.id}
              className={styles.statusOption}
              onClick={() => onChange({ column: column.id })}
              key={column.id}
            >
              {card.column === column.id ? (
                <motion.span layoutId={`${uid}-status`} className={styles.statusPill} transition={motionTokens.spring.morph} />
              ) : null}
              <span>{column.name}</span>
            </button>
          ))}
        </div>

        <dl className={styles.props}>
          <div>
            <dt>Assignee</dt>
            <dd>
              <span className={styles.selectRow}>
                <DropdownMenu
                  label={people.find(entry => entry.id === card.assignee)?.name ?? "Unassigned"}
                  icon={<Face person={people.find(entry => entry.id === card.assignee)} size={20} />}
                  items={people.map(entry => ({
                    label: entry.name,
                    icon: <Face person={entry} size={20} />,
                    onSelect: () => onChange({ assignee: entry.id }),
                  }))}
                />
              </span>
            </dd>
          </div>
          <div>
            <dt>Label</dt>
            <dd>{card.label ?? "None"}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>{card.due ?? "No date"}</dd>
          </div>
          <div>
            <dt>Estimate</dt>
            <dd>{card.points ? `${card.points} points` : "None"}</dd>
          </div>
        </dl>

        <label className={styles.drawerLabel} htmlFor={`${uid}-description`}>
          Description
        </label>
        <textarea
          id={`${uid}-description`}
          className={styles.description}
          rows={3}
          value={card.description ?? ""}
          placeholder="Add context for the team"
          onChange={event => onChange({ description: event.target.value })}
        />

        <div className={styles.checklistHead}>
          <span className={styles.drawerLabel}>Checklist</span>
          {total ? (
            <span className={styles.checkCount}>
              <RollingNumber value={done} />/{total}
            </span>
          ) : null}
        </div>
        {total ? (
          <div className={styles.progress} data-complete={done === total || undefined} aria-hidden="true">
            <motion.span initial={false} animate={{ scaleX: done / total }} transition={motionTokens.spring.smooth} />
          </div>
        ) : null}
        <ul className={styles.checklist}>
          <AnimatePresence initial={false}>
            {card.checklist?.map(item => (
              <motion.li
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={motionTokens.spring.smooth}
                key={item.id}
              >
                <label className={styles.checkItem} data-done={item.done || undefined}>
                  <input
                    type="checkbox"
                    className={styles.srOnly}
                    checked={item.done}
                    onChange={() =>
                      onChange({
                        checklist: card.checklist?.map(entry => (entry.id === item.id ? { ...entry, done: !entry.done } : entry)),
                      })
                    }
                  />
                  <span className={styles.box} aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="11" height="11">
                      <motion.path
                        d="M3.5 8.5l3 3 6-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={false}
                        animate={{ pathLength: item.done ? 1 : 0, opacity: item.done ? 1 : 0 }}
                        transition={motionTokens.spring.snappy}
                      />
                    </svg>
                  </span>
                  <span>{item.text}</span>
                </label>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <form
          className={styles.checkAdd}
          onSubmit={event => {
            event.preventDefault();
            if (!draft.trim()) return;
            onChange({
              checklist: [...(card.checklist ?? []), { id: `n${Date.now()}`, text: draft.trim(), done: false }],
            });
            setDraft("");
          }}
        >
          <input
            value={draft}
            placeholder="Add an item"
            aria-label="New checklist item"
            onChange={event => setDraft(event.target.value)}
          />
          <button type="submit" className={styles.ghostSmall} disabled={!draft.trim()}>
            Add
          </button>
        </form>
      </motion.div>
    </>
  );
}

export default KanbanBoard;
