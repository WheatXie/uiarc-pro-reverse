"use client";

/**
 * Help center — a self-serve support block with instant search, topic cards, a reading view
 * with a scroll-following outline, and an inline feedback question.
 *
 * The home screen is a big combobox search over the article corpus: matching words are wrapped
 * in `<mark>`, arrow keys move the active option, Enter opens it, and Escape clears the field
 * before it leaves it. Articles open as a view that slides in the direction of travel; the
 * outline follows the section in the scroller and focuses the heading it scrolls to.
 */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  LifeBuoy,
  LoaderCircle,
  Plug,
  Rocket,
  Search,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { helpArticles, helpCategories } from "./help-center-data";
import type { HelpArticle, HelpCategory, HelpCategoryIcon } from "./help-center-data";
import styles from "./help-center.module.css";

export type { HelpArticle, HelpCategory, HelpCategoryIcon, HelpSection } from "./help-center-data";
export { helpArticles, helpCategories } from "./help-center-data";

export interface HelpCenterProps {
  /** Articles with id, title, categoryId, summary, updated label, reading minutes, popular flag, and sections. */
  articles?: HelpArticle[];
  /** Topics with id, name, description, and an icon key. */
  categories?: HelpCategory[];
  /** Name in the top bar. */
  brand?: string;
  /** Heading above the big search. */
  heading?: string;
  /** Quick searches under the big search field. */
  suggestions?: string[];
  /** Opens this article on mount, for deep links. */
  defaultArticleId?: string;
  /** Ranks results. Replace it to search a server. */
  search?: (query: string, articles: HelpArticle[]) => HelpArticle[];
  /** Records a vote and the optional comment. */
  onFeedback?: (articleId: string, helpful: boolean, comment?: string) => void | Promise<void>;
  /** Opens your support channel. Without it the preview simulates a sent request. */
  onContact?: () => void | Promise<void>;
  /** Called when an article opens, for routing or analytics. */
  onArticleOpen?: (article: HelpArticle) => void;
  /** Extra class on the root. */
  className?: string;
}

type View = { kind: "home" } | { kind: "category"; id: string } | { kind: "article"; id: string };

const icons: Record<HelpCategoryIcon, ReactNode> = {
  start: <Rocket size={18} strokeWidth={1.75} />,
  billing: <CreditCard size={18} strokeWidth={1.75} />,
  team: <Users size={18} strokeWidth={1.75} />,
  integrations: <Plug size={18} strokeWidth={1.75} />,
  security: <Shield size={18} strokeWidth={1.75} />,
  troubleshooting: <Wrench size={18} strokeWidth={1.75} />,
};

const easeEnter = [...motionTokens.ease.enter] as [number, number, number, number];
const easeStandard = [...motionTokens.ease.standard] as [number, number, number, number];
const instant = { duration: 0 } as const;

const depth = (view: View) => (view.kind === "home" ? 0 : view.kind === "category" ? 1 : 2);

/**
 * Default ranking: every word has to match somewhere, and a word scores 6 in a title it starts,
 * 4 elsewhere in the title, 2 in the summary, and 1 in a section body. Popular articles get a
 * small tiebreak so the same query keeps returning the same order.
 */
export function searchArticles(query: string, articles: HelpArticle[]): HelpArticle[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return articles
    .map(article => {
      const title = article.title.toLowerCase();
      const summary = article.summary.toLowerCase();
      const body = article.sections
        .map(section => `${section.heading} ${section.paragraphs.join(" ")} ${(section.steps ?? []).join(" ")}`)
        .join(" ")
        .toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (title.includes(token)) score += title.startsWith(token) ? 6 : 4;
        else if (summary.includes(token)) score += 2;
        else {
          if (!body.includes(token)) return { article, score: 0 };
          score += 1;
        }
      }
      return { article, score: score + 0.5 * Number(!!article.popular) };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.article);
}

/** Wraps every query word in `<mark>`; the split keeps non-matching text as plain strings. */
function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${tokens.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>))}
    </>
  );
}

interface SearchFieldProps {
  size: "lg" | "sm";
  articles: HelpArticle[];
  categories: HelpCategory[];
  search: (query: string, articles: HelpArticle[]) => HelpArticle[];
  onOpen: (article: HelpArticle) => void;
  reduced: boolean;
  suggestions?: string[];
}

/** The combobox: field, quick searches and the result list under the field. */
function SearchField({ size, articles, categories, search, onOpen, reduced, suggestions }: SearchFieldProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const results = useMemo(() => search(query, articles).slice(0, 6), [search, query, articles]);
  const showResults = open && query.trim().length > 0;
  const active = Math.min(activeIndex, Math.max(0, results.length - 1));

  function openArticle(article: HelpArticle) {
    setQuery("");
    setOpen(false);
    input.current?.blur();
    onOpen(article);
  }

  return (
    <div
      className={styles.search}
      data-size={size}
      data-open={showResults || undefined}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div className={styles.field}>
        <Search size={size === "lg" ? 18 : 15} strokeWidth={1.75} aria-hidden="true" />
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={showResults && results[active] ? `${listboxId}-${results[active].id}` : undefined}
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              if (!results.length) return;
              event.preventDefault();
              setActiveIndex((active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
            } else if (event.key === "Enter") {
              if (!results[active]) return;
              event.preventDefault();
              openArticle(results[active]);
            } else if (event.key === "Escape") {
              if (query) {
                event.preventDefault();
                setQuery("");
              } else input.current?.blur();
            }
          }}
          placeholder={size === "lg" ? "Search articles, like invite or SSO" : "Search help"}
          aria-label="Search help articles"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>
      {suggestions && (
        <p className={styles.suggest}>
          {/* One text node, like the original: "Try " with the space inside it. */}
          {"Try "}
          {suggestions.map(suggestion => (
            <button
              key={suggestion}
              type="button"
              className={styles.suggestion}
              onClick={() => {
                setQuery(suggestion);
                setActiveIndex(0);
                input.current?.focus();
              }}
            >
              {suggestion}
            </button>
          ))}
        </p>
      )}
      <AnimatePresence>
        {showResults && (
          <motion.div
            className={styles.results}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
            transition={reduced ? instant : { duration: motionTokens.duration.fast, ease: easeEnter }}
          >
            <ul id={listboxId} role="listbox" aria-label="Matching articles">
              {results.map((article, index) => (
                <li
                  key={article.id}
                  id={`${listboxId}-${article.id}`}
                  role="option"
                  aria-selected={index === active}
                  className={styles.result}
                  onMouseDown={event => event.preventDefault()}
                  onMouseMove={() => {
                    if (index !== active) setActiveIndex(index);
                  }}
                  onClick={() => openArticle(article)}
                >
                  <span className={styles.resultTitle}>
                    <Highlight text={article.title} query={query} />
                  </span>
                  <span className={styles.resultSnippet}>
                    <Highlight
                      text={
                        article.sections
                          .flatMap(section => [...section.paragraphs, ...(section.steps ?? [])])
                          .join(" ")
                          .split(/(?<=\.)\s+/)
                          .find(sentence =>
                            query
                              .toLowerCase()
                              .split(/\s+/)
                              .filter(token => token.length > 1)
                              .some(token => sentence.toLowerCase().includes(token)),
                          ) ?? article.summary
                      }
                      query={query}
                    />
                  </span>
                  <span className={styles.resultMeta}>{categories.find(category => category.id === article.categoryId)?.name}</span>
                </li>
              ))}
            </ul>
            {!results.length && <p className={styles.noResults}>No articles match “{query.trim()}”. Try fewer words.</p>}
            <p className={styles.srOnly} role="status" aria-live="polite">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ArticleListProps {
  articles: HelpArticle[];
  category: (id: string) => HelpCategory | undefined;
  onOpen: (article: HelpArticle) => void;
  showSummary?: boolean;
}

/** Shared list rows: icon, title, then the category name or the summary on topic pages. */
function ArticleList({ articles, category, onOpen, showSummary }: ArticleListProps) {
  return (
    <ul className={styles.articles}>
      {articles.map(article => (
        <li key={article.id}>
          <button type="button" className={styles.articleRow} onClick={() => onOpen(article)}>
            <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className={styles.articleRowText}>
              <span className={styles.articleRowTitle}>{article.title}</span>
              <span className={styles.muted}>{showSummary ? article.summary : category(article.categoryId)?.name}</span>
            </span>
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" className={styles.chevron} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Contact card: idle, sending, then a sent thank-you; the copy swaps in place. */
function ContactCard({ onContact }: { onContact?: () => void | Promise<void> }) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");

  async function send() {
    if (state !== "idle") return;
    setState("busy");
    try {
      await (onContact ? onContact() : new Promise(resolve => setTimeout(resolve, 700)));
      setState("sent");
    } catch {
      setState("idle");
    }
  }

  return (
    <section className={styles.contact}>
      <div>
        <h3>Still need help?</h3>
        <p className={styles.muted}>
          {state === "sent" ? "Request sent. We reply by email within one business day." : "Our support team replies within one business day."}
        </p>
      </div>
      <button type="button" className={styles.primary} onClick={send} disabled={state === "sent"} aria-live="polite">
        <span className={styles.stack}>
          <span data-shown={state === "idle"}>Contact support</span>
          <span data-shown={state === "busy"}>
            <LoaderCircle size={15} strokeWidth={1.75} className={styles.spin} aria-hidden="true" />
            Sending
          </span>
          <span data-shown={state === "sent"}>
            <Check size={15} strokeWidth={1.75} aria-hidden="true" />
            Request sent
          </span>
        </span>
      </button>
    </section>
  );
}

interface FeedbackProps {
  articleId: string;
  reduced: boolean;
  onFeedback?: (articleId: string, helpful: boolean, comment?: string) => void | Promise<void>;
}

/** Was this helpful? A "no" opens a comment field; both paths end in the same thank-you. */
function Feedback({ articleId, reduced, onFeedback }: FeedbackProps) {
  const [state, setState] = useState<"ask" | "comment" | "thanks">("ask");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | string>("auto");

  // The card follows the height of whichever state is showing, on the smooth spring.
  useEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let measured = false;
    const observer = new ResizeObserver(() => {
      const next = node.offsetHeight;
      if (!measured || reduced) {
        measured = next > 0;
        height.jump(next || "auto");
        return;
      }
      animate(height, next, motionTokens.spring.smooth);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [height, reduced]);

  async function vote(helpful: boolean, message?: string) {
    setBusy(true);
    try {
      await onFeedback?.(articleId, helpful, message);
      setState("thanks");
    } catch {
      /* A failed vote leaves the question in place so it can be retried. */
    }
    setBusy(false);
  }

  const enter = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, transition: { duration: motionTokens.duration.instant } },
    transition: reduced ? instant : { duration: motionTokens.duration.standard, ease: easeEnter },
  };

  return (
    <motion.section className={styles.feedback} aria-live="polite" style={{ height }}>
      <div ref={inner} className={styles.feedbackInner}>
        <AnimatePresence mode="wait" initial={false}>
          {state === "ask" && (
            <motion.div key="ask" className={styles.feedbackRow} {...enter}>
              <p>Was this article helpful?</p>
              <div className={styles.votes}>
                <button type="button" className={styles.vote} onClick={() => vote(true)} disabled={busy}>
                  <ThumbsUp size={15} strokeWidth={1.75} aria-hidden="true" />
                  Yes
                </button>
                <button
                  type="button"
                  className={styles.vote}
                  onClick={() => {
                    setState("comment");
                    requestAnimationFrame(() => textarea.current?.focus());
                  }}
                >
                  <ThumbsDown size={15} strokeWidth={1.75} aria-hidden="true" />
                  No
                </button>
              </div>
            </motion.div>
          )}
          {state === "comment" && (
            <motion.form
              key="comment"
              className={styles.feedbackForm}
              {...enter}
              onSubmit={event => {
                event.preventDefault();
                void vote(false, comment.trim() || undefined);
              }}
            >
              <label htmlFor={`${articleId}-comment`}>What was missing?</label>
              <textarea
                ref={textarea}
                id={`${articleId}-comment`}
                value={comment}
                onChange={event => setComment(event.target.value)}
                rows={3}
                placeholder="Tell us what you were looking for"
              />
              <div className={styles.votes}>
                <button type="button" className={styles.vote} onClick={() => setState("ask")}>
                  Back
                </button>
                <button type="submit" className={styles.primary} disabled={busy}>
                  Send feedback
                </button>
              </div>
            </motion.form>
          )}
          {state === "thanks" && (
            <motion.div key="thanks" className={styles.feedbackRow} {...enter}>
              <p className={styles.thanks}>
                <Check size={16} strokeWidth={1.75} aria-hidden="true" />
                Thanks for the feedback.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

interface ArticleViewProps {
  article: HelpArticle;
  category: HelpCategory | undefined;
  related: HelpArticle[];
  scroller: React.RefObject<HTMLDivElement | null>;
  reduced: boolean;
  onBack: () => void;
  onHome: () => void;
  onOpen: (article: HelpArticle) => void;
  onFeedback?: (articleId: string, helpful: boolean, comment?: string) => void | Promise<void>;
}

/** Reading view: breadcrumbs, title, lede, prose sections, feedback and the on-this-page outline. */
function ArticleView({ article, category, related, scroller, reduced, onBack, onHome, onOpen, onFeedback }: ArticleViewProps) {
  const [activeSection, setActiveSection] = useState(article.sections[0]?.id);
  const uid = useId();
  const prose = useRef<HTMLDivElement>(null);
  /** Scrolls caused by the outline should not fight the spy for a moment. */
  const ignoreUntil = useRef(0);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const sync = () => {
      if (performance.now() < ignoreUntil.current) return;
      const top = node.getBoundingClientRect().top + 96;
      const sections = [...(prose.current?.querySelectorAll<HTMLElement>("[data-section]") ?? [])];
      const chosen =
        node.scrollTop + node.clientHeight >= node.scrollHeight - 4
          ? sections[sections.length - 1]
          : sections.filter(section => section.getBoundingClientRect().top <= top).pop() ?? sections[0];
      const current = chosen?.dataset.section;
      if (current) setActiveSection(current);
    };
    node.addEventListener("scroll", sync, { passive: true });
    return () => node.removeEventListener("scroll", sync);
  }, [scroller]);

  return (
    <div className={styles.articleLayout}>
      <article className={styles.article}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <button type="button" onClick={onHome}>
            Help
          </button>
          <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
          <button type="button" onClick={onBack}>
            {category?.name ?? "Articles"}
          </button>
        </nav>
        <h2 className={styles.articleTitle}>{article.title}</h2>
        <p className={styles.articleMeta}>
          <span>Updated {article.updated}</span>
          <span aria-hidden="true">·</span>
          <span className={styles.metaIcon}>
            <Clock size={13} strokeWidth={1.75} aria-hidden="true" />
            {article.minutes} min read
          </span>
        </p>
        <p className={styles.lede}>{article.summary}</p>
        <div ref={prose} className={styles.prose}>
          {article.sections.map(section => (
            <section key={section.id} aria-labelledby={`${uid}-${section.id}`}>
              <h3 id={`${uid}-${section.id}`} data-section={section.id} tabIndex={-1}>
                {section.heading}
              </h3>
              {section.paragraphs.map(paragraph => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.steps && (
                <ol>
                  {section.steps.map(step => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
        <Feedback key={article.id} articleId={article.id} reduced={reduced} onFeedback={onFeedback} />
        {related.length > 0 && (
          <section className={styles.related} aria-labelledby={`${uid}-related`}>
            <h3 id={`${uid}-related`} className={styles.sectionTitle}>
              Related articles
            </h3>
            <ul>
              {related.map(item => (
                <li key={item.id}>
                  <button type="button" onClick={() => onOpen(item)}>
                    {item.title}
                    <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      {article.sections.length > 1 && (
        <aside className={styles.toc} aria-label="On this page">
          <p className={styles.tocTitle}>On this page</p>
          <ul>
            {article.sections.map(section => (
              <li key={section.id}>
                <button
                  type="button"
                  aria-current={activeSection === section.id ? "location" : undefined}
                  onClick={event => {
                    const node = scroller.current;
                    const target = prose.current?.querySelector<HTMLElement>(`[data-section="${section.id}"]`);
                    if (!node || !target) return;
                    setActiveSection(section.id);
                    ignoreUntil.current = event.timeStamp + (reduced ? 50 : 700);
                    node.scrollTo({
                      top: node.scrollTop + target.getBoundingClientRect().top - node.getBoundingClientRect().top - 20,
                      behavior: reduced ? "auto" : "smooth",
                    });
                    target.focus({ preventScroll: true });
                  }}
                >
                  {activeSection === section.id && (
                    <motion.span
                      layoutId="toc-bar"
                      className={styles.tocBar}
                      transition={reduced ? instant : motionTokens.spring.snappy}
                    />
                  )}
                  {section.heading}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}

export function HelpCenter({
  articles = helpArticles,
  categories = helpCategories,
  brand = "Northwind",
  heading = "How can we help?",
  defaultArticleId,
  search = searchArticles,
  onFeedback,
  onContact,
  onArticleOpen,
  suggestions = ["invoice", "single sign-on", "slack"],
  className,
}: HelpCenterProps) {
  const reduced = !!useReducedMotion();
  const [view, setView] = useState<View>(defaultArticleId ? { kind: "article", id: defaultArticleId } : { kind: "home" });
  const [direction, setDirection] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(articles.map(article => [article.id, article])), [articles]);
  const categoryOf = (id: string) => categories.find(category => category.id === id);

  function navigate(next: View) {
    setDirection(depth(next) >= depth(view) ? 1 : -1);
    setView(next);
    if (next.kind === "article") {
      const article = byId.get(next.id);
      if (article) onArticleOpen?.(article);
    }
  }

  const open = (article: HelpArticle) => navigate({ kind: "article", id: article.id });
  const article = view.kind === "article" ? byId.get(view.id) : undefined;
  const popular = articles.filter(item => item.popular).slice(0, 6);
  const offset = 16 * Number(!reduced);

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <header className={styles.top}>
        <button type="button" className={styles.brand} onClick={() => navigate({ kind: "home" })}>
          <LifeBuoy size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>{brand}</span>
          <span className={styles.brandMuted}>Help</span>
        </button>
        <AnimatePresence initial={false}>
          {view.kind !== "home" && (
            <motion.div
              key="search"
              className={styles.topSearch}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant } }}
              transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}
            >
              <SearchField size="sm" articles={articles} categories={categories} search={search} onOpen={open} reduced={reduced} />
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      <div ref={scroller} className={styles.scroll}>
        <AnimatePresence mode="wait" initial={false} custom={direction} onExitComplete={() => scroller.current?.scrollTo({ top: 0 })}>
          <motion.div
            key={view.kind === "home" ? "home" : `${view.kind}-${view.id}`}
            className={styles.view}
            initial={{ opacity: 0, x: direction * offset }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -(direction * offset) / 2, transition: { duration: reduced ? 0 : motionTokens.duration.instant, ease: easeStandard } }}
            transition={reduced ? { duration: motionTokens.duration.fast } : { duration: motionTokens.duration.standard, ease: easeEnter }}
          >
            {view.kind === "home" && (
              <div className={styles.home}>
                <section className={styles.hero}>
                  <h2>{heading}</h2>
                  <SearchField
                    size="lg"
                    articles={articles}
                    categories={categories}
                    search={search}
                    onOpen={open}
                    reduced={reduced}
                    suggestions={suggestions}
                  />
                </section>
                <section aria-labelledby="help-categories" className={styles.section}>
                  <h3 id="help-categories" className={styles.sectionTitle}>
                    Browse by topic
                  </h3>
                  <ul className={styles.categories}>
                    {categories.map(item => {
                      const count = articles.filter(entry => entry.categoryId === item.id).length;
                      return (
                        <li key={item.id}>
                          <button type="button" className={styles.category} onClick={() => navigate({ kind: "category", id: item.id })}>
                            <span className={styles.categoryIcon} aria-hidden="true">
                              {icons[item.icon]}
                            </span>
                            <span className={styles.categoryName}>{item.name}</span>
                            <span className={styles.categoryText}>{item.description}</span>
                            <span className={styles.categoryCount}>
                              {count} {count === 1 ? "article" : "articles"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
                <section aria-labelledby="help-popular" className={styles.section}>
                  <h3 id="help-popular" className={styles.sectionTitle}>
                    Popular articles
                  </h3>
                  <ArticleList articles={popular} category={categoryOf} onOpen={open} />
                </section>
                <ContactCard onContact={onContact} />
              </div>
            )}

            {view.kind === "category" && (() => {
              const current = categoryOf(view.id);
              return (
                <div className={styles.narrow}>
                  <nav className={styles.crumbs} aria-label="Breadcrumb">
                    <button type="button" onClick={() => navigate({ kind: "home" })}>
                      <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
                      All topics
                    </button>
                  </nav>
                  <div className={styles.categoryHead}>
                    <span className={styles.categoryIcon} aria-hidden="true">
                      {current && icons[current.icon]}
                    </span>
                    <div>
                      <h2>{current?.name}</h2>
                      <p>{current?.description}</p>
                    </div>
                  </div>
                  <ArticleList articles={articles.filter(entry => entry.categoryId === view.id)} category={categoryOf} onOpen={open} showSummary />
                </div>
              );
            })()}

            {view.kind === "article" && article && (
              <ArticleView
                key={article.id}
                article={article}
                category={categoryOf(article.categoryId)}
                related={articles.filter(entry => entry.categoryId === article.categoryId && entry.id !== article.id).slice(0, 3)}
                scroller={scroller}
                reduced={reduced}
                onBack={() => navigate({ kind: "category", id: article.categoryId })}
                onHome={() => navigate({ kind: "home" })}
                onOpen={open}
                onFeedback={onFeedback}
              />
            )}

            {view.kind === "article" && !article && (
              <div className={styles.narrow}>
                <p>This article was moved or deleted.</p>
                <button type="button" className={styles.secondary} onClick={() => navigate({ kind: "home" })}>
                  Back to help center
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default HelpCenter;
