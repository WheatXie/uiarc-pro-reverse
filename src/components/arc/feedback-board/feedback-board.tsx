"use client";
/* eslint-disable @next/next/no-img-element -- plain images keep the block portable outside Next.js. */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronUp, MessageSquare, Plus, X } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./feedback-board.module.css";

export type FeedbackStatus = "review" | "planned" | "progress" | "done";

export interface FeedbackAuthor {
  name: string;
  avatar?: string;
}

export interface FeedbackComment {
  id: string;
  author: FeedbackAuthor;
  text: string;
  at: string;
  /** Marks a reply from your team, shown with a Team tag. */
  team?: boolean;
}

export interface FeedbackRequest {
  id: string;
  title: string;
  details: string;
  /** Shown as a dot and label; also the value used by the status filters. */
  status: FeedbackStatus;
  category: string;
  votes: number;
  /** Whether the current visitor has voted. */
  voted?: boolean;
  author: FeedbackAuthor;
  /** Display time, such as "3w ago". */
  at: string;
  /** Sort key for New; higher is newer. */
  created: number;
  comments: FeedbackComment[];
}

export interface FeedbackBoardProps {
  /**
   * Controlled requests. Pair with onRequestsChange.
   */
  requests?: FeedbackRequest[];
  /**
   * Initial requests when uncontrolled.
   * @default sample requests
   */
  defaultRequests?: FeedbackRequest[];
  /**
   * Called with the full list after a vote, a new request, or a comment.
   */
  onRequestsChange?: (requests: FeedbackRequest[]) => void;
  /**
   * Called after a vote is added or removed.
   */
  onVote?: (id: string, voted: boolean) => void;
  /**
   * Called with a new request once the title passes validation. The author's vote is added automatically.
   */
  onSubmit?: (draft: { title: string; details: string; category: string }) => void;
  /**
   * Called when a comment is posted.
   */
  onComment?: (id: string, text: string) => void;
  /**
   * Status names for filters and tags.
   * @default Under review, Planned, In progress, Complete
   */
  statuses?: { id: FeedbackStatus; name: string }[];
  /**
   * Category choices in the form.
   * @default ["Feature", "Integration", "Improvement"]
   */
  categories?: string[];
  /**
   * Author of new requests and comments.
   * @default { name: "You" }
   */
  currentUser?: FeedbackAuthor;
  /**
   * Initial sort.
   * @default "top"
   */
  defaultSort?: "top" | "new";
  /**
   * Page heading.
   * @default "Feedback"
   */
  title?: string;
  /**
   * Extra class on the root.
   */
  className?: string;
}

const statuses = [
  { id: "review" as const, name: "Under review" },
  { id: "planned" as const, name: "Planned" },
  { id: "progress" as const, name: "In progress" },
  { id: "done" as const, name: "Complete" },
];

const categories = ["Feature", "Integration", "Improvement"];

const portrait = (id: string) => `/media/people/${id}.svg`;

const emma = { name: "Emma Collins", avatar: portrait("emma-collins") };
const marcus = { name: "Marcus Johnson", avatar: portrait("marcus-johnson") };
const chloe = { name: "Chloe Nguyen", avatar: portrait("chloe-nguyen") };
const mateo = { name: "Mateo Alvarez", avatar: portrait("mateo-alvarez") };
const ava = { name: "Ava Mitchell", avatar: portrait("ava-mitchell") };
const jordan = { name: "Jordan Reyes", avatar: portrait("jordan-reyes") };
const olivia = { name: "Olivia Bennett", avatar: portrait("olivia-bennett") };

const sampleRequests: FeedbackRequest[] = [
  {
    id: "f1",
    title: "Export reports to Google Sheets",
    details: "We rebuild the weekly report by hand every Monday. A scheduled export to a sheet would save our ops team an hour a week.",
    status: "planned",
    category: "Integration",
    votes: 248,
    author: marcus,
    at: "3w ago",
    created: 3,
    comments: [
      { id: "c1", author: chloe, text: "Same for us. A daily schedule would be even better.", at: "2w ago" },
      { id: "c2", author: olivia, text: "Planned for next quarter. We will start with a daily and weekly schedule.", at: "1w ago", team: true },
    ],
  },
  {
    id: "f2",
    title: "Keyboard shortcut to switch workspaces",
    details: "Cmd plus a number to jump between workspaces, like browser tabs.",
    status: "progress",
    category: "Improvement",
    votes: 191,
    author: mateo,
    at: "1mo ago",
    created: 1,
    comments: [{ id: "c3", author: olivia, text: "In beta now. Turn it on under Settings, Labs.", at: "4d ago", team: true }],
  },
  {
    id: "f3",
    title: "Two factor authentication with passkeys",
    details: "Let us use passkeys as a second factor instead of codes from an app.",
    status: "review",
    category: "Feature",
    votes: 164,
    author: ava,
    at: "5d ago",
    created: 8,
    comments: [{ id: "c4", author: jordan, text: "Our security team asked for this during the last audit.", at: "3d ago" }],
  },
  {
    id: "f4",
    title: "Bulk edit tags from the table view",
    details: "Select several rows and add or remove a tag in one go.",
    status: "review",
    category: "Improvement",
    votes: 97,
    author: emma,
    at: "2d ago",
    created: 9,
    comments: [],
  },
  {
    id: "f5",
    title: "Zapier trigger for new comments",
    details: "A trigger that fires when someone comments, so we can route it to Slack channels by project.",
    status: "done",
    category: "Integration",
    votes: 142,
    author: jordan,
    at: "2mo ago",
    created: 0,
    comments: [{ id: "c5", author: olivia, text: "Shipped. Find it under the Arc app in Zapier.", at: "3w ago", team: true }],
  },
  {
    id: "f6",
    title: "Dark mode for the mobile app",
    details: "Follow the system setting on iOS and Android.",
    status: "planned",
    category: "Feature",
    votes: 310,
    author: chloe,
    at: "6w ago",
    created: 2,
    comments: [
      { id: "c6", author: marcus, text: "Please also dim images a little at night.", at: "5w ago" },
      { id: "c7", author: olivia, text: "Designs are done. Building after the widgets release.", at: "2w ago", team: true },
    ],
  },
  {
    id: "f7",
    title: "Custom fields on requests",
    details: "Add a dropdown or number field to each request, such as plan or seat count.",
    status: "review",
    category: "Feature",
    votes: 58,
    author: mateo,
    at: "1d ago",
    created: 10,
    comments: [],
  },
];

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const fillStyle = { position: "absolute", height: "100%", width: "100%", inset: 0, color: "transparent" } as const;

const cn = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(" ");
const tokenize = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);
const voteMapOf = (list: FeedbackRequest[]) => Object.fromEntries(list.map((item) => [item.id, item.votes]));

let counter = 0;
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter += 1)}`;

const smooth = motionTokens.spring.smooth;
const snappy = motionTokens.spring.snappy;
const morph = motionTokens.spring.morph;

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

function Avatar({ author, size = 20 }: { author: FeedbackAuthor; size?: number }) {
  const initials = author.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <span className={styles.face} style={{ width: size, height: size }}>
      {author.avatar ? (
        <img src={author.avatar} alt="" sizes={`${size}px`} style={fillStyle} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}

function VoteButton({
  request,
  onVote,
  compact,
}: {
  request: FeedbackRequest;
  onVote: (id: string) => void;
  compact?: boolean;
}) {
  const reduced = useReducedMotion();
  const [hop, setHop] = useState(0);
  return (
    <button
      type="button"
      className={cn(styles.vote, compact && styles.voteCompact)}
      aria-pressed={!!request.voted}
      aria-label={`${request.voted ? "Remove vote" : "Upvote"}: ${request.title}, ${request.votes} votes`}
      onClick={(event) => {
        event.stopPropagation();
        if (!request.voted) setHop((value) => value + 1);
        onVote(request.id);
      }}
    >
      <motion.span
        key={hop}
        className={styles.voteIcon}
        initial={false}
        animate={reduced || !hop ? undefined : { y: [0, -5, 0] }}
        transition={{ duration: 0.36, ease: [...motionTokens.ease.standard] as [number, number, number, number], times: [0, 0.4, 1] }}
      >
        <ChevronUp size={compact ? 14 : 16} strokeWidth={2} aria-hidden="true" />
      </motion.span>
      <Roll text={String(request.votes)} />
    </button>
  );
}

/**
 * A feature request board with a submit form that finds similar requests, upvotes, top and new
 * sorting, status filters, and comments.
 */
export function FeedbackBoard({
  requests,
  defaultRequests = sampleRequests,
  onRequestsChange,
  onVote,
  onSubmit,
  onComment,
  statuses: statusOptions = statuses,
  categories: categoryOptions = categories,
  currentUser = { name: "You" },
  defaultSort = "top",
  title = "Feedback",
  className,
}: FeedbackBoardProps) {
  const id = useId();
  const reduced = useReducedMotion() ?? false;
  const [inner, setInner] = useState(defaultRequests);
  const data = requests ?? inner;
  const latest = useRef(data);
  useLayoutEffect(() => {
    latest.current = data;
  });
  const commit = (next: FeedbackRequest[]) => {
    latest.current = next;
    if (!requests) setInner(next);
    onRequestsChange?.(next);
  };

  const [sort, setSort] = useState<"top" | "new">(defaultSort);
  const [filter, setFilter] = useState("all");
  const [votes, setVotes] = useState(() => voteMapOf(data));
  const changeSort = (next: "top" | "new") => {
    setSort(next);
    setVotes(voteMapOf(latest.current));
  };
  const changeFilter = (next: string) => {
    setFilter(next);
    setVotes(voteMapOf(latest.current));
  };

  const [formOpen, setFormOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDetails, setDraftDetails] = useState("");
  const [category, setCategory] = useState(categoryOptions[0] ?? "Feature");
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [freshId, setFreshId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const newButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (formOpen) titleRef.current?.focus({ preventScroll: true });
  }, [formOpen]);

  useEffect(() => {
    if (!freshId) return;
    const timer = window.setTimeout(() => setFreshId(null), 2200);
    return () => window.clearTimeout(timer);
  }, [freshId]);

  const statusName = (value: string) => statusOptions.find((status) => status.id === value)?.name ?? value;

  const counts = useMemo(() => {
    const next: Record<string, number> = { all: data.length };
    for (const request of data) next[request.status] = (next[request.status] ?? 0) + 1;
    return next;
  }, [data]);

  const visible = useMemo(() => {
    const next = data.filter((request) => filter === "all" || request.status === filter);
    const rank = (request: FeedbackRequest) => votes[request.id] ?? Number.MAX_SAFE_INTEGER;
    return [...next].sort(sort === "top" ? (a, b) => rank(b) - rank(a) : (a, b) => b.created - a.created);
  }, [data, filter, sort, votes]);

  const similar = useMemo(() => {
    const tokens = new Set(tokenize(draftTitle));
    if (!tokens.size) return [];
    return data
      .map((request) => ({ request, score: tokenize(request.title).filter((word) => tokens.has(word)).length }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.request.votes - a.request.votes)
      .slice(0, 2)
      .map((entry) => entry.request);
  }, [draftTitle, data]);

  const toggleVote = (requestId: string) => {
    const target = latest.current.find((request) => request.id === requestId);
    if (!target) return;
    const voted = !target.voted;
    commit(
      latest.current.map((request) =>
        request.id === requestId ? { ...request, voted, votes: request.votes + (voted ? 1 : -1) } : request,
      ),
    );
    onVote?.(requestId, voted);
    setAnnounce(`${voted ? "Voted for" : "Removed vote from"} ${target.title}`);
  };

  const closeForm = () => {
    setFormOpen(false);
    setError("");
    newButtonRef.current?.focus({ preventScroll: true });
  };

  const toggleOpen = (requestId: string) => {
    setOpenId((current) => (current === requestId ? null : requestId));
    setCommentDraft("");
  };

  const filters = [{ id: "all", name: "All" }, ...statusOptions];
  const panelTransition = reduced
    ? { duration: 0 }
    : { height: smooth, opacity: { duration: motionTokens.duration.fast } };

  return (
    <div className={cn(styles.root, className)}>
      <div className={styles.scroller}>
        <header className={styles.head}>
          <div className={styles.titleRow}>
            <h2>{title}</h2>
            <button
              ref={newButtonRef}
              type="button"
              className={styles.newButton}
              aria-expanded={formOpen}
              aria-controls={`${id}-form`}
              onClick={() => (formOpen ? closeForm() : setFormOpen(true))}
            >
              <motion.span
                className={styles.newIcon}
                animate={{ rotate: 45 * (formOpen ? 1 : 0) }}
                transition={reduced ? { duration: 0 } : snappy}
              >
                <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              </motion.span>
              <span className={styles.newLabel}>
                <span data-show={!formOpen || undefined}>New request</span>
                <span data-show={formOpen || undefined}>Cancel</span>
              </span>
            </button>
          </div>

          <AnimatePresence initial={false}>
            {formOpen ? (
              <motion.div
                key="form"
                className={styles.formWrap}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={panelTransition}
              >
                <form
                  id={`${id}-form`}
                  className={styles.form}
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = draftTitle.trim();
                    if (value.length < 8) {
                      setError("Add a few more words to the title");
                      titleRef.current?.focus();
                      return;
                    }
                    const created = Math.max(0, ...latest.current.map((request) => request.created)) + 1;
                    const request: FeedbackRequest = {
                      id: makeId("f"),
                      title: value,
                      details: draftDetails.trim(),
                      status: "review",
                      category,
                      votes: 1,
                      voted: true,
                      author: currentUser,
                      at: "Just now",
                      created,
                      comments: [],
                    };
                    commit([request, ...latest.current]);
                    onSubmit?.({ title: value, details: request.details, category });
                    setDraftTitle("");
                    setDraftDetails("");
                    setError("");
                    setFormOpen(false);
                    setSort("new");
                    setFilter("all");
                    setFreshId(request.id);
                    setAnnounce("Request posted. Your vote was added.");
                    newButtonRef.current?.focus({ preventScroll: true });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeForm();
                  }}
                >
                  <label className={styles.field}>
                    <span>Title</span>
                    <input
                      ref={titleRef}
                      value={draftTitle}
                      onChange={(event) => {
                        setDraftTitle(event.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Short, specific, one idea"
                      aria-invalid={!!error}
                      aria-describedby={error ? `${id}-title-error` : undefined}
                      maxLength={90}
                    />
                  </label>
                  <AnimatePresence initial={false}>
                    {error ? (
                      <motion.p
                        key="error"
                        id={`${id}-title-error`}
                        className={styles.error}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={panelTransition}
                      >
                        {error}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                  <AnimatePresence initial={false}>
                    {similar.length ? (
                      <motion.div
                        key="similar"
                        className={styles.similar}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={panelTransition}
                      >
                        <div className={styles.similarInner}>
                          <p className={styles.muted}>Similar requests</p>
                          <ul>
                            {similar.map((request) => (
                              <li key={request.id}>
                                <VoteButton request={request} onVote={toggleVote} compact />
                                <span className={styles.similarTitle}>{request.title}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                  <label className={styles.field}>
                    <span>
                      Details <span className={styles.muted}>optional</span>
                    </span>
                    <textarea
                      value={draftDetails}
                      onChange={(event) => setDraftDetails(event.target.value)}
                      rows={3}
                      placeholder="What are you trying to do?"
                    />
                  </label>
                  <div className={styles.formFoot}>
                    <div className={styles.categories} role="radiogroup" aria-label="Category">
                      {categoryOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={category === option}
                          className={styles.category}
                          onClick={() => setCategory(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <button type="submit" className={styles.submit}>
                      Post request
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className={styles.toolbar}>
            <div className={styles.statuses} role="radiogroup" aria-label="Filter by status">
              {filters.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={filter === option.id}
                  className={styles.statusFilter}
                  onClick={() => changeFilter(option.id)}
                >
                  {filter === option.id ? (
                    <motion.span
                      layoutId="status"
                      className={styles.statusPill}
                      transition={reduced ? { duration: 0 } : morph}
                    />
                  ) : null}
                  <span>
                    {option.id !== "all" ? (
                      <span className={styles.statusDot} data-status={option.id} aria-hidden="true" />
                    ) : null}
                    {option.name}
                  </span>
                  <span className={styles.statusCount}>
                    <Roll text={String(counts[option.id] ?? 0)} />
                  </span>
                </button>
              ))}
            </div>
            <div
              className={styles.sort}
              role="radiogroup"
              aria-label="Sort"
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const next = sort === "top" ? "new" : "top";
                changeSort(next);
                document.getElementById(`${id}-sort-${next}`)?.focus();
              }}
            >
              {(["top", "new"] as const).map((option) => (
                <button
                  key={option}
                  id={`${id}-sort-${option}`}
                  type="button"
                  role="radio"
                  aria-checked={sort === option}
                  tabIndex={sort === option ? 0 : -1}
                  className={styles.sortOption}
                  onClick={() => changeSort(option)}
                >
                  {sort === option ? (
                    <motion.span layoutId="sort" className={styles.sortPill} transition={reduced ? { duration: 0 } : snappy} />
                  ) : null}
                  <span>{option === "top" ? "Top" : "New"}</span>
                </button>
              ))}
            </div>
          </div>
        </header>

        {visible.length ? (
          <ul className={styles.list}>
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((request) => {
                const open = openId === request.id;
                return (
                  <motion.li
                    key={request.id}
                    className={styles.item}
                    data-open={open || undefined}
                    data-fresh={freshId === request.id || undefined}
                    layout={!reduced && "position"}
                    initial={{ opacity: 0, y: reduced ? 0 : -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
                    transition={reduced ? { duration: 0.12 } : smooth}
                  >
                    <VoteButton request={request} onVote={toggleVote} />
                    <div className={styles.itemBody}>
                      <h3>
                        <button
                          type="button"
                          className={styles.itemTitle}
                          aria-expanded={open}
                          aria-controls={`${id}-d-${request.id}`}
                          onClick={() => toggleOpen(request.id)}
                        >
                          {request.title}
                        </button>
                      </h3>
                      <AnimatePresence initial={false}>
                        {!open && request.details ? (
                          <motion.div
                            key="excerpt"
                            className={styles.excerptWrap}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={panelTransition}
                          >
                            <p className={styles.excerpt}>{request.details}</p>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                      <AnimatePresence initial={false}>
                        {open ? (
                          <motion.div
                            key="detail"
                            id={`${id}-d-${request.id}`}
                            className={styles.detail}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={panelTransition}
                          >
                            <div className={styles.detailInner}>
                              {request.details ? <p className={styles.fullText}>{request.details}</p> : null}
                              {request.comments.length ? (
                                <ol className={styles.comments}>
                                  <AnimatePresence initial={false}>
                                    {request.comments.map((comment) => (
                                      <motion.li
                                        key={comment.id}
                                        className={styles.comment}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        transition={panelTransition}
                                      >
                                        <div className={styles.commentInner}>
                                          <Avatar author={comment.author} size={24} />
                                          <div>
                                            <p className={styles.commentMeta}>
                                              <span className={styles.commentName}>{comment.author.name}</span>
                                              {comment.team ? <span className={styles.teamTag}>Team</span> : null}
                                              <span className={styles.muted}>{comment.at}</span>
                                            </p>
                                            <p className={styles.commentText}>{comment.text}</p>
                                          </div>
                                        </div>
                                      </motion.li>
                                    ))}
                                  </AnimatePresence>
                                </ol>
                              ) : null}
                              <form
                                className={styles.commentForm}
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const text = commentDraft.trim();
                                  if (!text) return;
                                  commit(
                                    latest.current.map((entry) =>
                                      entry.id === request.id
                                        ? {
                                            ...entry,
                                            comments: [
                                              ...entry.comments,
                                              { id: makeId("c"), author: currentUser, text, at: "Just now" },
                                            ],
                                          }
                                        : entry,
                                    ),
                                  );
                                  onComment?.(request.id, text);
                                  setCommentDraft("");
                                  setAnnounce("Comment posted");
                                }}
                              >
                                <input
                                  value={commentDraft}
                                  onChange={(event) => setCommentDraft(event.target.value)}
                                  placeholder="Add a comment"
                                  aria-label={`Comment on ${request.title}`}
                                />
                                <button type="submit" className={styles.commentSend} disabled={!commentDraft.trim()}>
                                  Post
                                </button>
                              </form>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                      <div className={styles.meta}>
                        <span className={styles.statusTag} data-status={request.status}>
                          <span className={styles.statusDot} data-status={request.status} aria-hidden="true" />
                          {statusName(request.status)}
                        </span>
                        <span className={styles.metaItem}>{request.category}</span>
                        <span className={styles.metaItem} aria-label={`${request.comments.length} comments`}>
                          <MessageSquare size={13} strokeWidth={1.75} aria-hidden="true" />
                          <Roll text={String(request.comments.length)} />
                        </span>
                        <span className={styles.author}>
                          <Avatar author={request.author} />
                          {request.author.name}
                          <span className={styles.muted}>{request.at}</span>
                        </span>
                      </div>
                    </div>
                    <AnimatePresence initial={false}>
                      {open ? (
                        <motion.button
                          key="collapse"
                          type="button"
                          className={styles.collapse}
                          onClick={() => toggleOpen(request.id)}
                          aria-label="Collapse"
                          initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{
                            opacity: 0,
                            scale: reduced ? 1 : 0.8,
                            transition: { duration: motionTokens.duration.instant },
                          }}
                          transition={reduced ? { duration: 0 } : snappy}
                        >
                          <X size={16} strokeWidth={1.75} aria-hidden="true" />
                        </motion.button>
                      ) : null}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        ) : (
          <div className={styles.empty}>
            <p>No requests {filter === "all" ? "yet" : `marked ${statusName(filter).toLowerCase()}`}</p>
            <button type="button" className={styles.category} onClick={() => changeFilter("all")}>
              Show all
            </button>
          </div>
        )}
      </div>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

export default FeedbackBoard;
