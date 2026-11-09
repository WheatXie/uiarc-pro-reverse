"use client";

/**
 * Team showcase — an image-led team introduction with profiles that open in place.
 *
 * Four layouts share one selection model: gallery (portrait row), filmstrip (expanding
 * frames), directory (expandable rows) and spotlight (large portrait beside the copy).
 * Selection is announced in a polite live region, the directory rows expose
 * `aria-expanded`/`aria-controls`, and every profile carries the person's sample contact
 * details with a copy button per value.
 */

import { useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CopyButton } from "../copy-button/copy-button";
import SegmentedControl from "../segmented-control/segmented-control";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./team-showcase.module.css";

/** One person in the showcase. Portraits are sample artwork; swap the data for real profiles. */
export interface TeamPerson {
  id: string;
  name: string;
  role: string;
  location: string;
  /** Portrait source. Rendered through next/image with `fill`, so any aspect ratio works. */
  image: string;
  introduction: string;
  /** Only the directory layout shows this line. */
  focus: string;
  email: string;
  phone: string;
}

/** Layout of the section. */
export type TeamShowcaseVariant = "gallery" | "filmstrip" | "directory" | "spotlight";

export interface TeamShowcaseProps {
  /** Layout of the section. */
  variant?: TeamShowcaseVariant;
  /** Called when a person is chosen. Receives the full sample person object. */
  onPersonSelect?: (person: TeamPerson) => void;
  /** Replaces the sample people. Keep `id` stable, it keys the crossfades. */
  people?: TeamPerson[];
  /** Overrides the heading. Gallery and the other layouts default to different copy. */
  title?: string;
  /**
   * Drops the section's own card styling. The docs preview frame renders blocks flat and applies
   * exactly `border: 0 / radius 0 / no shadow / transparent` to the section, so the demo passes
   * this to match the live frame.
   */
  flat?: boolean;
}

const people: TeamPerson[] = [
  {
    id: "emma",
    name: "Emma Collins",
    role: "Product designer",
    location: "Zürich, Switzerland",
    image: "/media/people/portrait/emma-collins.svg",
    introduction:
      "Emma turns complex product decisions into calm, useful experiences. She cares about the first five minutes of a workflow and the details people notice much later.",
    focus: "Design systems and onboarding",
    email: "emma@arc.example",
    phone: "+1 (202) 555-0101",
  },
  {
    id: "marcus",
    name: "Marcus Johnson",
    role: "Frontend engineer",
    location: "London, United Kingdom",
    image: "/media/people/portrait/marcus-johnson.svg",
    introduction:
      "Marcus builds the foundations that let good ideas become dependable interfaces. He is happiest when a component feels simple to use and has room to grow.",
    focus: "Component architecture",
    email: "marcus@arc.example",
    phone: "+1 (202) 555-0102",
  },
  {
    id: "ava",
    name: "Ava Mitchell",
    role: "Design lead",
    location: "Amsterdam, Netherlands",
    image: "/media/people/portrait/ava-mitchell.svg",
    introduction:
      "Ava gives teams a shared point of view. She connects research, product direction, and the small decisions that make a service feel coherent.",
    focus: "Product direction",
    email: "ava@arc.example",
    phone: "+1 (202) 555-0103",
  },
  {
    id: "jasmine",
    name: "Jasmine Brooks",
    role: "Platform engineer",
    location: "Berlin, Germany",
    image: "/media/people/portrait/jasmine-brooks.svg",
    introduction:
      "Jasmine keeps the platform steady as the product finds its next shape. She works across performance, integrations, and the systems that should quietly keep working.",
    focus: "Platform and performance",
    email: "jasmine@arc.example",
    phone: "+1 (202) 555-0104",
  },
  {
    id: "sofia",
    name: "Sofia Ramirez",
    role: "Operations partner",
    location: "New York, United States",
    image: "/media/people/portrait/sofia-ramirez.svg",
    introduction:
      "Sofia makes space for focused work across a distributed team. She brings the right context together and helps a promising idea find its next practical step.",
    focus: "Team operations",
    email: "sofia@arc.example",
    phone: "+1 (202) 555-0105",
  },
];

const variantOptions = [
  { value: "gallery", label: "Gallery" },
  { value: "filmstrip", label: "Filmstrip" },
  { value: "directory", label: "Directory" },
  { value: "spotlight", label: "Spotlight" },
];

const easeStandard = [...motionTokens.ease.standard] as [number, number, number, number];
const easeEnter = [...motionTokens.ease.enter] as [number, number, number, number];

/** Portrait through next/image's `fill`, so the container owns the aspect ratio. */
function PersonPhoto({ person, sizes = "(max-width: 620px) 80vw, 30vw" }: { person: TeamPerson; sizes?: string }) {
  return <Image src={person.image} alt="" fill sizes={sizes} />;
}

/** Sample contact details; each value copies on its own and stays labelled per person. */
function PersonContact({ person }: { person: TeamPerson }) {
  return (
    <div className={styles.contact} aria-label={`Sample contact details for ${person.name}`}>
      <div className={styles.contactItems}>
        <span className={styles.contactItem}>
          <span>{person.email}</span>
          <CopyButton value={person.email} label={`Copy ${person.name}'s email`} iconOnly variant="plain" />
        </span>
        <span className={styles.contactItem}>
          <span>{person.phone}</span>
          <CopyButton value={person.phone} label={`Copy ${person.name}'s phone number`} iconOnly variant="plain" />
        </span>
      </div>
    </div>
  );
}

interface CrossfadeProps<T extends { id: string }> {
  items: T[];
  selectedIndex: number;
  reduce: boolean;
  offset?: number;
  className?: string;
  itemClassName?: string;
  render: (item: T) => ReactNode;
}

/**
 * Stacks every item in one grid cell and crossfades them. Leaving items drift by `offset` so the
 * change reads as a swap; inactive items are inert and hidden from assistive tech.
 */
function Crossfade<T extends { id: string }>({ items, selectedIndex, reduce, offset = 8, className, itemClassName, render }: CrossfadeProps<T>) {
  const transition = { duration: motionTokens.duration.standard, ease: easeStandard };
  return (
    <div className={[styles.crossfade, className].filter(Boolean).join(" ")}>
      {items.map((item, index) => {
        const active = index === selectedIndex;
        const y = reduce || active ? 0 : index < selectedIndex ? -offset : offset;
        return (
          <motion.div
            key={item.id}
            className={itemClassName}
            data-active={active || undefined}
            aria-hidden={!active}
            inert={!active}
            initial={false}
            animate={{ opacity: Number(!!active), x: 0, y }}
            transition={reduce ? { duration: 0 } : active ? transition : { ...transition, duration: motionTokens.duration.fast }}
          >
            {render(item)}
          </motion.div>
        );
      })}
    </div>
  );
}

export function TeamShowcase({ variant = "gallery", onPersonSelect, people: list = people, title, flat = false }: TeamShowcaseProps) {
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  const filmTrack = useRef<HTMLDivElement>(null);
  const galleryGrid = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = list[selectedIndex];
  const [directoryOpen, setDirectoryOpen] = useState(true);

  const entrance = { duration: reduced ? 0 : motionTokens.duration.standard, ease: easeEnter };

  /** Wraps around and keeps the selected frame in view inside the horizontal layouts. */
  function select(next: number) {
    const index = (next + list.length) % list.length;
    setSelectedIndex(index);
    const film = filmTrack.current;
    const filmChild = film?.children[index] as HTMLElement | undefined;
    if (film && filmChild && film.scrollWidth > film.clientWidth) {
      film.scrollTo({ left: filmChild.offsetLeft - (film.firstElementChild as HTMLElement).offsetLeft, behavior: reduced ? "instant" : "smooth" });
    }
    const grid = galleryGrid.current;
    const gridChild = grid?.children[index] as HTMLElement | undefined;
    if (grid && gridChild && grid.scrollWidth > grid.clientWidth) {
      grid.scrollTo({ left: gridChild.offsetLeft - (grid.firstElementChild as HTMLElement).offsetLeft, behavior: reduced ? "instant" : "smooth" });
    }
    onPersonSelect?.(list[index]);
  }

  /* The compact profile stack used by filmstrip and spotlight. */
  const stack = (
    <Crossfade
      items={list}
      selectedIndex={selectedIndex}
      reduce={reduced}
      className={styles.bioStack}
      itemClassName={styles.bio}
      render={person => (
        <>
          <div>
            <h3>{person.name}</h3>
            <span>{person.role}</span>
          </div>
          <p>{person.introduction}</p>
          <span className={styles.location}>{person.location}</span>
        </>
      )}
    />
  );

  const announcement = (
    <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
      {selected.name}, {selected.role}
    </p>
  );

  const arrows = (
    <div className={styles.arrows}>
      <button type="button" onClick={() => select(selectedIndex - 1)} aria-label="Show previous team member">
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <span>
        {selectedIndex + 1} / {list.length}
      </span>
      <button type="button" onClick={() => select(selectedIndex + 1)} aria-label="Show next team member">
        <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <section
      className={`${styles.showcase} ${styles[variant]}`}
      aria-labelledby={`${id}-title`}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
    >
      <motion.header
        className={styles.header}
        initial={!reduced && { opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: reduced ? 0 : motionTokens.duration.considered, ease: easeEnter }}
      >
        <h2 id={`${id}-title`}>{title ?? (variant === "directory" ? "The people behind Arc" : "Meet the team")}</h2>
        {variant !== "gallery" && <p>Five people across design, engineering, and operations.</p>}
      </motion.header>

      {variant === "gallery" && (
        <>
          <div className={styles.galleryGrid} ref={galleryGrid}>
            {list.map((person, index) => (
              <motion.button
                key={person.id}
                type="button"
                initial={!reduced && { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: reduced ? 0 : motionTokens.duration.considered, delay: reduced ? 0 : 0.05 * index, ease: easeEnter }}
                onFocus={event => {
                  event.currentTarget.style.opacity = "1";
                  event.currentTarget.style.transform = "none";
                }}
                className={styles.galleryPerson}
                onClick={() => select(index)}
                aria-pressed={selectedIndex === index}
                aria-label={`Read about ${person.name}`}
                aria-controls={`${id}-detail`}
              >
                <span className={styles.galleryPhoto}>
                  <PersonPhoto person={person} sizes="(max-width: 620px) 70vw, 20vw" />
                </span>
                <span className={styles.personName}>{person.name}</span>
                <span className={styles.personRole}>{person.role}</span>
              </motion.button>
            ))}
          </div>
          <div id={`${id}-detail`} className={styles.galleryDetail}>
            <Crossfade
              items={list}
              selectedIndex={selectedIndex}
              reduce={reduced}
              className={styles.galleryBioStage}
              itemClassName={styles.galleryBio}
              render={person => (
                <>
                  <div className={styles.galleryBioIdentity}>
                    <h3>{person.name}</h3>
                    <span>
                      {person.role} · {person.location}
                    </span>
                  </div>
                  <div className={styles.galleryBioContent}>
                    <p>{person.introduction}</p>
                    <PersonContact person={person} />
                  </div>
                </>
              )}
            />
            <div className={styles.galleryNavigation}>{arrows}</div>
            {announcement}
          </div>
        </>
      )}

      {variant === "filmstrip" && (
        <>
          <div ref={filmTrack} className={styles.filmTrack}>
            {list.map((person, index) => (
              <button
                key={person.id}
                type="button"
                className={styles.filmPerson}
                data-selected={selectedIndex === index}
                aria-pressed={selectedIndex === index}
                aria-label={`Read about ${person.name}`}
                aria-controls={`${id}-detail`}
                onClick={() => select(index)}
              >
                <PersonPhoto person={person} />
                <span className={styles.filmName}>{person.name}</span>
              </button>
            ))}
          </div>
          <div id={`${id}-detail`} className={styles.filmDetail}>
            {stack}
            {arrows}
            {announcement}
          </div>
        </>
      )}

      {variant === "directory" && (
        <div className={styles.directoryList}>
          {list.map((person, index) => (
            <div key={person.id} className={styles.directoryPerson} data-selected={selectedIndex === index}>
              <button
                type="button"
                className={styles.directoryTrigger}
                onClick={() => {
                  setDirectoryOpen(index !== selectedIndex || !directoryOpen);
                  select(index);
                }}
                aria-expanded={selectedIndex === index && directoryOpen}
                aria-controls={`${id}-${person.id}`}
              >
                <span className={styles.directoryThumb}>
                  <PersonPhoto person={person} sizes="96px" />
                </span>
                <span className={styles.directoryName}>{person.name}</span>
                <span className={styles.directoryRole}>{person.role}</span>
                <svg
                  className={styles.directoryIcon}
                  data-open={(selectedIndex === index && directoryOpen) || undefined}
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path className={styles.directoryIconBar} d="M12 5v14" />
                </svg>
              </button>
              <AnimatePresence initial={false}>
                {selectedIndex === index && directoryOpen && (
                  <motion.div
                    key="panel"
                    id={`${id}-${person.id}`}
                    className={styles.directoryPanel}
                    initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                    transition={reduced ? { duration: 0 } : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard } }}
                  >
                    <div className={styles.directoryExpanded}>
                      <div className={styles.directoryPhoto}>
                        <PersonPhoto person={person} />
                      </div>
                      <div>
                        <p>{person.introduction}</p>
                        <dl>
                          <div>
                            <dt>Based in</dt>
                            <dd>{person.location}</dd>
                          </div>
                          <div>
                            <dt>Working on</dt>
                            <dd>{person.focus}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {variant === "spotlight" && (
        <>
          <div className={styles.spotlightStage}>
            <div className={styles.spotlightCopy}>
              {stack}
              {arrows}
              {announcement}
            </div>
            <div className={styles.spotlightPhoto}>
              {list.map((person, index) => {
                const active = index === selectedIndex;
                return (
                  <motion.div
                    key={person.id}
                    className={styles.spotlightLayer}
                    aria-hidden="true"
                    style={{ zIndex: Number(!!active) }}
                    initial={false}
                    animate={{ opacity: Number(!!active), x: active || reduced ? 0 : index < selectedIndex ? -12 : 12 }}
                    transition={reduced ? { duration: 0 } : active ? entrance : { duration: 0, delay: motionTokens.duration.standard }}
                  >
                    <PersonPhoto person={person} />
                  </motion.div>
                );
              })}
            </div>
          </div>
          <nav className={styles.spotlightNav} aria-label="Choose a team member">
            {list.map((person, index) => (
              <button key={person.id} type="button" onClick={() => select(index)} aria-pressed={selectedIndex === index}>
                <span className={styles.spotlightThumb}>
                  <PersonPhoto person={person} sizes="64px" />
                </span>
                <span>{person.name.split(" ")[0]}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </section>
  );
}

/** Demo wrapper with a SegmentedControl to switch variants. Use it for previews only. */
export function TeamShowcaseReview() {
  const [variant, setVariant] = useState<TeamShowcaseVariant>("gallery");
  return (
    <div className={styles.review}>
      <div className={styles.reviewControls}>
        <SegmentedControl label="Team section design" options={variantOptions} value={variant} onValueChange={value => setVariant(value as TeamShowcaseVariant)} />
      </div>
      <TeamShowcase key={variant} variant={variant} flat />
    </div>
  );
}

export default TeamShowcase;
