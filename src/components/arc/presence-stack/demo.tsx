/**
 * PresenceStack demo — reconstructed from the Pro preview chunk (`captures/presence-stack/chunk.js`)
 * and its captured frame markup (`captures/presence-stack/frame.html`). A document header whose
 * face pile is fed by a small simulator: every 2.2s the room ticks — someone joins, someone leaves,
 * or a status flips — and picking a row follows that person into the header meta.
 *
 * The roster and the portraits are the shared demo people in `public/media/people/`, the same files
 * the reference loads.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play, UserMinus, UserPlus, X } from "lucide-react";
import { people as roster, person, type PersonId } from "../lib/media";
import { PresenceStack, type PresencePerson, type PresenceStatus } from "./presence-stack";
import styles from "./presence-stack.module.css";

export const meta = "Live · hover or focus the stack";

/** The signed-in reader. Their row is the one that says "you" and never leaves. */
const SELF_ID: PersonId = "jasmine-brooks";

/** Documents the simulated room is bouncing between. */
const DOCUMENTS = ["Pricing", "Launch checklist", "Timeline", "Press kit", "Budget", "Risks"] as const;

/** What each status is doing to a document, in the roster's second line. */
const ACTIVITY: Record<PresenceStatus, (document: string) => string> = {
  active: (document) => `Editing ${document}`,
  idle: () => "Away for a few minutes",
  typing: (document) => `Commenting on ${document}`,
};

/** Statuses the simulator can hand out when someone joins. `active` is weighted twice. */
const JOIN_STATUSES: PresenceStatus[] = ["active", "active", "typing"];

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** A member of the simulated room; the id stays narrowed to the shared roster. */
type Member = PresencePerson & { id: PersonId };

/** One member of the simulated room. */
function member(id: PersonId, status: PresenceStatus, document: string): Member {
  const entry = person(id);
  return {
    id,
    name: entry.name,
    src: entry.src,
    status,
    // The reader's own row always reads off the same overview, never a document.
    detail: id === SELF_ID ? "Viewing Overview" : ACTIVITY[status](document),
  };
}

const INITIAL: Member[] = [
  member(SELF_ID, "active", "Overview"),
  member("emma-collins", "typing", "Pricing"),
  member("marcus-johnson", "active", "Launch checklist"),
  member("sofia-ramirez", "idle", "Budget"),
  member("daniel-kim", "active", "Timeline"),
  member("chloe-nguyen", "active", "Risks"),
];

/** Uniform pick. */
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** Subscribes to the OS reduced-motion setting so the simulator starts paused for those readers. */
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export default function PresenceStackDemo() {
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const [people, setPeople] = useState<Member[]>(INITIAL);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [followingId, setFollowingId] = useState<string | null>(null);
  const following = people.find((entry) => entry.id === followingId) ?? null;
  const running = paused ?? !reduceMotion;

  // The interval reads the latest room without restarting on every tick.
  const latest = useRef(people);
  useEffect(() => {
    latest.current = people;
  }, [people]);

  /** Someone not in the room walks in, landing just behind the head of the stack. */
  const join = () =>
    setPeople((current) => {
      const waiting = roster.filter((candidate) => !current.some((entry) => entry.id === candidate.id));
      if (!waiting.length) return current;
      const arrival = pick(waiting);
      const [head, ...rest] = current;
      return [head, member(arrival.id, pick(JOIN_STATUSES), pick(DOCUMENTS)), ...rest];
    });

  /** Anyone but the reader leaves. */
  const leave = () =>
    setPeople((current) => {
      const others = current.filter((entry) => entry.id !== SELF_ID);
      if (!others.length) return current;
      const leaving = pick(others);
      return current.filter((entry) => entry.id !== leaving.id);
    });

  /** One person cycles to a different status on a different document. */
  const changeStatus = () =>
    setPeople((current) => {
      const others = current.filter((entry) => entry.id !== SELF_ID);
      if (!others.length) return current;
      const subject = pick(others);
      const next = pick(otherStatuses(subject.status ?? "active"));
      return current.map((entry) => (entry.id === subject.id ? member(entry.id, next, pick(DOCUMENTS)) : entry));
    });

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const count = latest.current.length;
      const roll = Math.random();
      // Small rooms only grow; big ones mostly shuffle; middling ones can lose people.
      if (count < 4 || (roll < 0.34 && count < 10)) join();
      else if (roll < 0.6 && count > 3) leave();
      else changeStatus();
    }, 2200);
    return () => window.clearInterval(timer);
  }, [running]);

  const others = people.length - 1;

  return (
    <div className={styles.demo} data-canvas="wide">
      <div className={styles.header}>
        <div className={styles.doc}>
          <span className={styles.title}>Q3 launch plan</span>
          <span className={styles.meta}>
            {following ? (
              <>
                Following {following.name}
                <button type="button" className={styles.stop} onClick={() => setFollowingId(null)} aria-label={`Stop following ${following.name}`}>
                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </>
            ) : others === 0 ? (
              "Only you"
            ) : (
              `You and ${others} ${others === 1 ? "other" : "others"}`
            )}
          </span>
        </div>
        <PresenceStack
          people={people}
          selfId={SELF_ID}
          max={4}
          align="end"
          onPersonSelect={(entry) => {
            if (entry.id !== SELF_ID) setFollowingId(entry.id);
          }}
        />
      </div>
      <div className={styles.controls} role="group" aria-label="Simulate people">
        <button type="button" className={styles.control} onClick={join} disabled={people.length >= roster.length}>
          <UserPlus size={16} strokeWidth={1.75} aria-hidden="true" />
          Someone joins
        </button>
        <button type="button" className={styles.control} onClick={leave} disabled={people.length <= 1}>
          <UserMinus size={16} strokeWidth={1.75} aria-hidden="true" />
          Someone leaves
        </button>
        <button type="button" className={styles.control} onClick={changeStatus} disabled={people.length <= 1}>
          Change a status
        </button>
        <button type="button" className={styles.control} onClick={() => setPaused(!running)} aria-pressed={running}>
          {running ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}
          {running ? "Pause" : "Simulate"}
        </button>
      </div>
    </div>
  );
}

/** The two statuses a person is not currently in. */
function otherStatuses(current: PresenceStatus): PresenceStatus[] {
  return (["active", "idle", "typing"] as PresenceStatus[]).filter((status) => status !== current);
}
