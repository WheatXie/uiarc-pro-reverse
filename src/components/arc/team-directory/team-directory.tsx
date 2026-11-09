"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { Copy, Search, X } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { motionTokens } from "../lib/motion-tokens";
import { writeClipboard } from "../lib/use-copy-feedback";
import { avatar } from "../lib/media";
import styles from "./team-directory.module.css";

/** The teams a person can belong to, and the values the filter bar offers after `All`. */
export type Team = "Design" | "Engineering" | "Operations";

/** One person in the directory. */
export interface DirectoryPerson {
  id: string;
  name: string;
  role: string;
  team: Team;
  location: string;
  timezone: string;
  email: string;
  /** Portrait path, read by Avatar. */
  photo: string;
  available: boolean;
  about: string;
  focus: string;
}

/** The shape handed to `onPersonSelect`, without the contact details. */
export interface DirectorySelection {
  id: string;
  name: string;
  team: Team;
}

export interface TeamDirectoryProps {
  /** Called when a person is chosen from the list. */
  onPersonSelect?: (person: DirectorySelection) => void;
}

const TEAM_FILTERS: readonly (Team | "All")[] = [
  "All",
  "Design",
  "Engineering",
  "Operations",
];

const PEOPLE: readonly DirectoryPerson[] = [
  {
    id: "emma",
    name: "Emma Collins",
    role: "Product designer",
    team: "Design",
    location: "Zürich",
    timezone: "CET",
    email: "emma@arc.example",
    photo: avatar("emma-collins"),
    available: true,
    about:
      "Shapes clear, considered experiences across the product. Ask Emma about interaction design, prototypes, or a second pair of eyes on a flow.",
    focus: "Design system and onboarding",
  },
  {
    id: "marcus",
    name: "Marcus Johnson",
    role: "Frontend engineer",
    team: "Engineering",
    location: "London",
    timezone: "GMT",
    email: "marcus@arc.example",
    photo: avatar("marcus-johnson"),
    available: true,
    about:
      "Builds the interfaces and systems behind the details. Marcus works closely with design so components feel as good in code as they do on screen.",
    focus: "Component architecture",
  },
  {
    id: "ava",
    name: "Ava Mitchell",
    role: "Design lead",
    team: "Design",
    location: "Amsterdam",
    timezone: "CET",
    email: "ava@arc.example",
    photo: avatar("ava-mitchell"),
    available: false,
    about:
      "Connects product direction to the everyday work of the team. Ava can help with design reviews, priorities, and bringing an idea into focus.",
    focus: "Product direction",
  },
  {
    id: "daniel",
    name: "Daniel Kim",
    role: "Platform engineer",
    team: "Engineering",
    location: "Berlin",
    timezone: "CET",
    email: "daniel@arc.example",
    photo: avatar("daniel-kim"),
    available: true,
    about:
      "Keeps the platform dependable as the product grows. Reach out to Daniel for integrations, performance, and technical planning.",
    focus: "Platform and performance",
  },
  {
    id: "sofia",
    name: "Sofia Ramirez",
    role: "Operations lead",
    team: "Operations",
    location: "New York",
    timezone: "ET",
    email: "sofia@arc.example",
    photo: avatar("sofia-ramirez"),
    available: false,
    about:
      "Makes collaboration easier across teams and time zones. Sofia helps people find context, coordinate work, and keep projects moving.",
    focus: "Team operations",
  },
  {
    id: "hannah",
    name: "Hannah Walsh",
    role: "Customer success",
    team: "Operations",
    location: "Dublin",
    timezone: "GMT",
    email: "hannah@arc.example",
    photo: avatar("hannah-walsh"),
    available: true,
    about:
      "Turns customer conversations into clear next steps for the team. Hannah knows which accounts are blocked and why.",
    focus: "Enterprise onboarding",
  },
];

type CopyState = "idle" | "copied" | "error";

const COPY_LABELS: readonly (readonly [CopyState, string])[] = [
  ["idle", "Copy"],
  ["copied", "Copied"],
  ["error", "Retry"],
];

/**
 * A searchable people list with team filters, availability, and a profile pane.
 *
 * Search and filters run in memory on every keystroke over the sample people below; swap the
 * `PEOPLE` array (and the `Team` union) for your own directory, and pass `onPersonSelect` to route
 * to a person page. The list is not virtualised, so paginate on the server past a few hundred rows.
 */
export function TeamDirectory({ onPersonSelect }: TeamDirectoryProps) {
  const id = useId();
  const reduceMotion = useReducedMotion();
  const reduced = !!reduceMotion;
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState<Team | "All">("All");
  const [selectedId, setSelectedId] = useState(PEOPLE[0].id);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const needle = query.trim().toLowerCase();
  const visible = PEOPLE.filter((person) => {
    const inTeam = team === "All" || person.team === team;
    const haystack =
      `${person.name} ${person.role} ${person.team} ${person.location}`.toLowerCase();
    return inTeam && haystack.includes(needle);
  });
  // A filter or a search can hide the selected person; the first match takes over so the pane is never stale.
  const selected =
    visible.find((person) => person.id === selectedId) ?? visible[0];

  // Copied and failed both settle back to the idle label so the button never sticks.
  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const copyEmail = useCallback(async () => {
    if (!selected) return;
    try {
      await writeClipboard(selected.email);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }, [selected]);

  const layoutTransition: Transition = reduced
    ? { duration: 0 }
    : motionTokens.spring.smooth;
  const exitDuration = reduced ? 0 : motionTokens.duration.exit;

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && query) {
      event.preventDefault();
      setQuery("");
    }
  }

  return (
    <section className={styles.directory} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <h2 id={`${id}-title`}>
          People <span className={styles.count}>{PEOPLE.length}</span>
        </h2>
        <label className={styles.search}>
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.srOnly}>Search people</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCopyState("idle");
            }}
            onKeyDown={onSearchKeyDown}
            placeholder="Search name, role, city"
          />
          <span className={styles.clearSlot}>
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
              >
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}
          </span>
        </label>
      </header>

      <div className={styles.filters} role="group" aria-label="Filter by team">
        {TEAM_FILTERS.map((option) => {
          const count =
            option === "All"
              ? PEOPLE.length
              : PEOPLE.filter((person) => person.team === option).length;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={team === option}
              onClick={() => {
                setTeam(option);
                setCopyState("idle");
              }}
            >
              {team === option && (
                <motion.span
                  layoutId={`${id}-filter`}
                  className={styles.filterHighlight}
                  transition={
                    reduced ? { duration: 0 } : motionTokens.spring.morph
                  }
                  aria-hidden="true"
                />
              )}
              <span className={styles.filterLabel}>
                {option}
                <span className={styles.filterCount}>{count}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.body}>
        <div className={styles.listPane}>
          <ul className={styles.peopleList} aria-label="Team members">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((person) => {
                const isSelected = selected?.id === person.id;
                return (
                  <motion.li
                    key={person.id}
                    layout={reduced ? false : "position"}
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{
                      opacity: 0,
                      transition: { duration: exitDuration },
                    }}
                    transition={{
                      layout: layoutTransition,
                      opacity: {
                        duration: reduced ? 0 : motionTokens.duration.fast,
                      },
                    }}
                  >
                    <button
                      type="button"
                      className={styles.personRow}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedId(person.id);
                        setCopyState("idle");
                        onPersonSelect?.({
                          id: person.id,
                          name: person.name,
                          team: person.team,
                        });
                      }}
                    >
                      {isSelected && (
                        <RowHighlight
                          layoutId={`${id}-row-${team}-${needle}`}
                          reduce={reduced}
                        />
                      )}
                      <Avatar
                        name={person.name}
                        src={person.photo}
                        status={person.available ? "online" : "offline"}
                      />
                      <span className={styles.personText}>
                        <span className={styles.personName}>{person.name}</span>
                        <span className={styles.personRole}>{person.role}</span>
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          {visible.length === 0 && (
            <div className={styles.empty}>
              <p>No one matches{needle ? ` “${query.trim()}”` : ""}</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setTeam("All");
                  setCopyState("idle");
                  searchRef.current?.focus();
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        <motion.div
          className={styles.detailPane}
          layout={reduced ? false : "position"}
          transition={{ layout: layoutTransition }}
          aria-live="polite"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {selected ? (
              <motion.article
                key={selected.id}
                className={styles.profile}
                initial={reduced ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  transition: {
                    duration: exitDuration,
                    ease: [...motionTokens.ease.standard],
                  },
                }}
                transition={{
                  duration: reduced ? 0 : motionTokens.duration.standard,
                  ease: [...motionTokens.ease.enter],
                }}
                aria-label={`${selected.name}, ${selected.role}`}
              >
                <div className={styles.profileTop}>
                  <Avatar name={selected.name} src={selected.photo} size="lg" />
                  <div className={styles.profileIdentity}>
                    <h3>{selected.name}</h3>
                    <p>{selected.role}</p>
                  </div>
                </div>
                <p className={styles.about}>{selected.about}</p>
                <dl className={styles.facts}>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span
                        className={styles.dot}
                        data-available={selected.available || undefined}
                        aria-hidden="true"
                      />
                      {selected.available ? "Available" : "Away"}
                    </dd>
                  </div>
                  <div>
                    <dt>Team</dt>
                    <dd>{selected.team}</dd>
                  </div>
                  <div>
                    <dt>Working on</dt>
                    <dd>{selected.focus}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>
                      {selected.location}{" "}
                      <span className={styles.muted}>{selected.timezone}</span>
                    </dd>
                  </div>
                  <div className={styles.contactRow}>
                    <dt>Email</dt>
                    <dd>
                      <a href={`mailto:${selected.email}`}>{selected.email}</a>
                      <button
                        type="button"
                        className={styles.copy}
                        data-state={copyState}
                        onClick={() => void copyEmail()}
                        aria-label={
                          copyState === "copied"
                            ? "Email copied"
                            : "Copy email address"
                        }
                      >
                        <span className={styles.copyIcon} aria-hidden="true">
                          <Copy
                            size={14}
                            strokeWidth={1.75}
                            data-on={copyState !== "copied" || undefined}
                          />
                          <svg
                            width={14}
                            height={14}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            data-on={copyState === "copied" || undefined}
                          >
                            <motion.path
                              d="M4 12l5 5L20 6"
                              initial={false}
                              animate={{
                                pathLength:
                                  copyState === "copied" || reduced ? 1 : 0,
                              }}
                              transition={
                                copyState === "copied"
                                  ? {
                                      duration: 0.22,
                                      ease: [...motionTokens.ease.standard],
                                      delay: 0.04,
                                    }
                                  : { duration: 0, delay: 0.12 }
                              }
                            />
                          </svg>
                        </span>
                        <span className={styles.copyLabel} aria-hidden="true">
                          {COPY_LABELS.map(([state, label]) => (
                            <span
                              key={state}
                              data-on={copyState === state || undefined}
                            >
                              {label}
                            </span>
                          ))}
                        </span>
                      </button>
                    </dd>
                  </div>
                </dl>
                <span className={styles.srOnly} role="status">
                  {copyState === "copied"
                    ? "Email address copied"
                    : copyState === "error"
                      ? "Copy failed. Try again."
                      : ""}
                </span>
              </motion.article>
            ) : (
              <motion.div
                key="none"
                className={styles.noProfile}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: exitDuration } }}
                transition={{
                  duration: reduced ? 0 : motionTokens.duration.standard,
                  ease: [...motionTokens.ease.standard],
                }}
              >
                <p>Nobody selected</p>
                <span>Clear your search to see the team.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

/** The shared layout highlight behind the selected row; only mounted for the current person. */
function RowHighlight({
  layoutId,
  reduce,
}: {
  layoutId: string;
  reduce: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.span
      layoutId={layoutId}
      className={styles.rowHighlight}
      transition={
        reduceMotion || reduce ? { duration: 0 } : motionTokens.spring.morph
      }
      aria-hidden="true"
    />
  );
}

export default TeamDirectory;
