"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, MessageCircle, Plus } from "lucide-react";
import Image from "next/image";
import { people } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./project-board.module.css";

/** The four fixed columns a card can sit in, left to right. */
export type ProjectStage = "Planned" | "In progress" | "Review" | "Done";

/** A card that just changed column, as handed to {@link ProjectBoardProps.onTaskMove}. */
export interface ProjectTaskMove {
  /** Stable task id. */
  id: string;
  /** Task title. */
  title: string;
  /** Column the task moved into. */
  stage: ProjectStage;
}

export interface ProjectBoardProps {
  /** Called after a task moves to its new stage. */
  onTaskMove?: (task: ProjectTaskMove) => void;
}

/** A board task. `owner` is a person id resolved against the shared people list. */
interface Task {
  id: string;
  title: string;
  project: string;
  stage: ProjectStage;
  owner: string;
  comments: number;
  due: string;
}

type Filter = "all" | "mine";

const stages: ProjectStage[] = ["Planned", "In progress", "Review", "Done"];

/** The board's "you": cards owned by this person are the ones My work keeps. */
const me = "emma-collins";

/** Owner portraits that stack in the header. */
const team = ["emma-collins", "marcus-johnson", "ava-mitchell"];

const findPerson = (id: string) => people.find((person) => person.id === id) ?? people[0];

const initialTasks: Task[] = [
  {
    id: "flows",
    title: "Map the first-run journey",
    project: "Onboarding",
    stage: "Planned",
    owner: "emma-collins",
    comments: 3,
    due: "Today",
  },
  {
    id: "copy",
    title: "Write empty state copy",
    project: "Onboarding",
    stage: "Planned",
    owner: "ava-mitchell",
    comments: 1,
    due: "Tomorrow",
  },
  {
    id: "tokens",
    title: "Refine surface tokens",
    project: "Design system",
    stage: "In progress",
    owner: "emma-collins",
    comments: 5,
    due: "Thu",
  },
  {
    id: "motion",
    title: "Prototype menu motion",
    project: "Design system",
    stage: "In progress",
    owner: "marcus-johnson",
    comments: 2,
    due: "Fri",
  },
  {
    id: "audit",
    title: "Accessibility pass",
    project: "Onboarding",
    stage: "Review",
    owner: "marcus-johnson",
    comments: 7,
    due: "Today",
  },
  {
    id: "notes",
    title: "Publish research notes",
    project: "Research",
    stage: "Done",
    owner: "ava-mitchell",
    comments: 2,
    due: "Sep 14",
  },
];

/** Draft titles the Add task button cycles through, so repeated presses never repeat a card. */
const draftTitles = [
  "Outline next experiment",
  "Draft release notes",
  "Plan usability sessions",
  "Clean up icon set",
];

/**
 * A four-stage board (Planned, In progress, Review, Done) with a sprint progress bar, per-column
 * counts, arrow buttons to move cards, an All work / My work filter, and an add task action.
 * Tasks and owner portraits are sample data.
 */
export function ProjectBoard({ onTaskMove }: ProjectBoardProps) {
  const reduceMotion = useReducedMotion();
  const groupId = useId();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [moving, setMoving] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [status, setStatus] = useState("");
  const draftIndex = useRef(0);

  const visible = filter === "mine" ? tasks.filter((task) => task.owner === me) : tasks;
  const doneCount = tasks.filter((task) => task.stage === "Done").length;
  const transition = reduceMotion ? { duration: 0 } : motionTokens.spring.gentle;

  function moveTask(task: Task, delta: number) {
    const next = stages[stages.indexOf(task.stage) + delta];
    if (!next) return;
    // Mark the card first: the exiting copy under the old column fades with no tween so the
    // surviving card can travel on its layoutId instead of crossfading.
    setMoving(task.id);
    setTasks((list) => [...list.filter((item) => item.id !== task.id), { ...task, stage: next }]);
    setStatus(`${task.title} moved to ${next}.`);
    onTaskMove?.({ id: task.id, title: task.title, stage: next });
  }

  function addTask() {
    const title = draftTitles[draftIndex.current % draftTitles.length];
    draftIndex.current += 1;
    setTasks((list) => [
      ...list,
      {
        id: `task-${Date.now()}`,
        title,
        project: "Research",
        stage: "Planned",
        owner: me,
        comments: 0,
        due: "No date",
      },
    ]);
    setStatus(`${title} added to Planned.`);
  }

  return (
    <LayoutGroup id={groupId}>
      <section className={styles.board} aria-label="Project board">
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2>Product work</h2>
            <p>
              <span className={styles.tabular}>{doneCount}</span> of{" "}
              <span className={styles.tabular}>{tasks.length}</span> done this sprint
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.people} aria-label="Team">
              {team.map((id) => {
                const person = findPerson(id);
                return (
                  <Image
                    key={id}
                    src={person.src}
                    width={28}
                    height={28}
                    alt={person.name}
                  />
                );
              })}
            </div>
            <div className={styles.filters} role="group" aria-label="Show">
              {(
                [
                  ["all", "All work"],
                  ["mine", "My work"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {filter === value && (
                    <motion.span
                      layoutId="filter"
                      className={styles.filterHighlight}
                      transition={reduceMotion ? { duration: 0 } : motionTokens.spring.snappy}
                      aria-hidden="true"
                    />
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <button
              className={styles.addButton}
              type="button"
              onClick={addTask}
              aria-label="Add task"
            >
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>Add task</span>
            </button>
          </div>
        </header>
        <div className={styles.progress} aria-hidden="true">
          <motion.span
            initial={false}
            animate={{ scaleX: tasks.length ? doneCount / tasks.length : 0 }}
            transition={transition}
          />
        </div>
        <motion.div className={styles.stageScroll} layoutScroll>
          <div className={styles.stages}>
            {stages.map((stage, index) => {
              const column = visible.filter((task) => task.stage === stage);
              return (
                <section
                  key={stage}
                  className={styles.stage}
                  aria-label={`${stage}, ${column.length} tasks`}
                >
                  <div className={styles.stageHead}>
                    <h3>{stage}</h3>
                    <span className={styles.stageCount}>{column.length}</span>
                  </div>
                  <div className={styles.cardStack}>
                    <AnimatePresence mode="popLayout" initial={false} custom={moving}>
                      {column.map((task) => {
                        const person = findPerson(task.owner);
                        return (
                          <motion.article
                            key={task.id}
                            layoutId={reduceMotion ? undefined : `task-${task.id}`}
                            layoutCrossfade={false}
                            custom={moving}
                            variants={{
                              exit: (id: string | null) =>
                                id === task.id
                                  ? { opacity: 0, transition: { duration: 0 } }
                                  : reduceMotion
                                    ? { opacity: 0 }
                                    : { opacity: 0, scale: 0.98 },
                            }}
                            initial={
                              !reduceMotion &&
                              task.id !== moving && { opacity: 0, scale: 0.98 }
                            }
                            animate={{ opacity: 1, scale: 1 }}
                            exit="exit"
                            transition={transition}
                            onLayoutAnimationComplete={
                              task.id === moving ? () => setMoving(null) : undefined
                            }
                            className={styles.card}
                            data-moving={task.id === moving || undefined}
                            data-done={stage === "Done" || undefined}
                          >
                            <div className={styles.cardTop}>
                              <span>{task.project}</span>
                              <span
                                className={styles.due}
                                data-soon={
                                  task.due === "Today" && stage !== "Done" ? "" : undefined
                                }
                              >
                                {task.due}
                              </span>
                            </div>
                            <h4>{task.title}</h4>
                            <div className={styles.cardBottom}>
                              <Image
                                className={styles.avatar}
                                src={person.src}
                                width={22}
                                height={22}
                                alt={person.name}
                              />
                              {task.comments > 0 && (
                                <span className={styles.comments}>
                                  <MessageCircle size={14} strokeWidth={1.75} aria-hidden="true" />
                                  <span className={styles.tabular}>{task.comments}</span>
                                  <span className={styles.srOnly}> comments</span>
                                </span>
                              )}
                              <div className={styles.moveButtons}>
                                <button
                                  type="button"
                                  onClick={() => moveTask(task, -1)}
                                  disabled={index === 0}
                                  aria-label={`Move ${task.title} to ${stages[index - 1] ?? "previous stage"}`}
                                >
                                  <ArrowLeft size={14} strokeWidth={1.75} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveTask(task, 1)}
                                  disabled={index === stages.length - 1}
                                  aria-label={`Move ${task.title} to ${stages[index + 1] ?? "next stage"}`}
                                >
                                  <ArrowRight size={14} strokeWidth={1.75} />
                                </button>
                              </div>
                            </div>
                          </motion.article>
                        );
                      })}
                    </AnimatePresence>
                    {column.length === 0 && (
                      <p className={styles.empty}>
                        {filter === "mine" ? "Nothing assigned to you" : "No tasks yet"}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </motion.div>
        <span className={styles.srOnly} role="status">
          {status}
        </span>
      </section>
    </LayoutGroup>
  );
}

export default ProjectBoard;
