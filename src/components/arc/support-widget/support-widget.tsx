"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, LayoutGroup, motion, useIsPresent, useReducedMotion } from "motion/react";
import { ArrowUp, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Info, MessageCircleQuestionMark, TriangleAlert } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import AnimatedCounter from "../animated-counter/animated-counter";
import { Avatar } from "../avatar/avatar";
import Button from "../button/button";
import { SearchField } from "../search-field/search-field";
import TextMorph from "../text-morph/text-morph";
import { defaultSuggestions, demoExports, helpArticles, popularArticleIds, supportEngineer, supportTeam } from "./support-widget-data";
import type { HelpArticle } from "./support-widget-data";
import styles from "./support-widget.module.css";

export type { HelpArticle, Person } from "./support-widget-data";
export { defaultSuggestions, demoExports, helpArticles, popularArticleIds } from "./support-widget-data";

const { spring, duration, ease, blur } = motionTokens;
const enter = [...ease.enter] as [number, number, number, number];
const standard = [...ease.standard] as [number, number, number, number];

type View = "home" | "article" | "chat";
type FocusTarget = "launcher" | "search" | "composer" | "talk" | "panel" | "article" | "feedback" | `card:${string}` | null;
type ChatMessage = { id: number; from: "you" | "ava"; text: string; time: string; status?: string };

/** The two directions a view can slide: opening a card pushes forward, going back pulls it back. */
const slide = {
  enter: (direction: number) => ({ x: 32 * direction, opacity: 0, filter: `blur(${blur.subtle}px)` }),
  center: { x: 0, opacity: 1, filter: "blur(0px)" },
  exit: (direction: number) => ({
    x: -32 * direction,
    opacity: 0,
    filter: `blur(${blur.subtle}px)`,
    transition: { x: spring.smooth, opacity: { duration: duration.fast, ease: standard }, filter: { duration: duration.fast } },
  }),
};

/** Reduced motion keeps the crossfade but drops the travel: the swap still reads, nothing flies across the panel. */
const fade = {
  enter: { x: 0, opacity: 0, filter: "blur(0px)" },
  center: { x: 0, opacity: 1, filter: "blur(0px)" },
  exit: { x: 0, opacity: 0, filter: "blur(0px)", transition: { duration: duration.instant } },
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Search is a token filter, not a fuzzy match: every word has to land somewhere in the article. */
function tokensOf(query: string) {
  return Array.from(new Set(query.toLowerCase().split(/\s+/).filter(Boolean))).slice(0, 6);
}

export interface SupportWidgetProps {
  /** Called with the exact text someone sends to support, after it appears in the thread. */
  onSend?: (message: string) => void;
  /** Called whenever the panel opens or closes, so a page can pause a tour or log the intent. */
  onOpenChange?: (open: boolean) => void;
  /** Zeroes the frame's own chrome, for a page that supplies its own card around the block. */
  flat?: boolean;
  className?: string;
}

/**
 * A help launcher parked in the corner of an app page: it opens a searchable help center, reads an
 * article in place, and hands the conversation to a support engineer without leaving the page.
 * Answers are canned, so the whole flow can be tried without a backend.
 */
export function SupportWidget({ onSend, onOpenChange, flat, className }: SupportWidgetProps) {
  const reduced = useReducedMotion() ?? false;
  const panelId = useId();
  const listId = useId();
  const composerId = useId();

  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("home");
  const [returnView, setReturnView] = useState<"home" | "article">("home");
  const [direction, setDirection] = useState(1);
  const [articleId, setArticleId] = useState(helpArticles[0].id);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<Record<string, "yes" | "no">>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState(defaultSuggestions);
  const [unread, setUnread] = useState(0);
  const [live, setLive] = useState("");

  const stageRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLInputElement | null>(null);
  const talkRef = useRef<HTMLButtonElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  // Focus is restored after the DOM for the new view exists, so the target can be a node that only just mounted.
  const focusTarget = useRef<FocusTarget>(null);
  const openView = useRef({ open: false, view: "home" as View });
  const timers = useRef(new Set<number>());
  const pending = useRef(0);
  const nextId = useRef(1);
  const clock = useRef(42);
  const greeted = useRef(false);
  const nudged = useRef(false);

  const article = helpArticles.find(entry => entry.id === articleId) ?? helpArticles[0];

  const results = useMemo(() => {
    const tokens = tokensOf(query);
    if (!tokens.length) return popularArticleIds.map(id => helpArticles.find(entry => entry.id === id)).filter((entry): entry is HelpArticle => !!entry);
    return helpArticles
      .map((entry, index) => {
        const title = entry.title.toLowerCase();
        const summary = entry.summary.toLowerCase();
        const haystack = `${title} ${summary} ${entry.category.toLowerCase()} ${entry.keywords}`;
        if (!tokens.every(token => haystack.includes(token))) return null;
        const score = tokens.reduce((total, token) => total + 3 * Number(title.includes(token)) + Number(summary.includes(token)), 0);
        return { article: entry, score, index };
      })
      .filter((entry): entry is { article: HelpArticle; score: number; index: number } => entry !== null)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(entry => entry.article);
  }, [query]);

  const matcher = useMemo(() => {
    const tokens = tokensOf(query);
    return tokens.length ? new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi") : null;
  }, [query]);

  const searching = query.trim().length > 0;
  const chat = view === "chat";
  const shownView = chat ? returnView : view;
  // The panel pulls in at the edges: a narrow stage gives up more of itself than a wide one.
  const gutter = stage.w && stage.w + 2 < 520 ? 12 : 20;
  const width = stage.w ? Math.min(384, stage.w - 2 * gutter) : 384;
  const height = stage.h ? Math.min(600, stage.h - 2 * gutter) : 600;
  const chatHeight = height - 2 - 60;

  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setStage({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { openView.current = { open, view }; }, [open, view]);

  useEffect(() => {
    const set = timers.current;
    return () => set.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    const panel = panelRef.current;
    const node =
      target === "launcher" ? launcherRef.current
        : target === "search" ? searchRef.current
          : target === "composer" ? composerRef.current
            : target === "talk" ? talkRef.current
              : target === "panel" ? panel
                : target === "article" ? panel?.querySelector<HTMLElement>('[data-view="article"] h3')
                  : target === "feedback" ? panel?.querySelector<HTMLElement>('[data-view="article"] [data-feedback]')
                    : panel?.querySelector<HTMLElement>(`[data-view="home"] [data-article="${target.slice(5)}"]`) ?? searchRef.current;
    node?.focus({ preventScroll: true });
  }, [open, view, articleId, feedback]);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [messages, typing, open, view, reduced]);

  const coarse = () => window.matchMedia("(pointer: coarse)").matches;

  function later(ms: number, run: () => void) {
    const timer = window.setTimeout(() => { timers.current.delete(timer); run(); }, ms);
    timers.current.add(timer);
  }

  /** Message stamps run on a demo clock that starts mid-morning and ticks with each message. */
  function stamp() {
    const total = 600 + clock.current++;
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function pushReply(text: string) {
    const id = nextId.current++;
    const time = stamp();
    setMessages(current => [...current, { id, from: "ava", text, time }]);
    pending.current = Math.max(0, pending.current - 1);
    setTyping(pending.current > 0);
    // A reply that lands while the panel is closed becomes an unread badge instead of a silent thread.
    if (!(openView.current.open && openView.current.view === "chat")) {
      setUnread(count => count + 1);
      setLive("Ava replied. Open help to read it.");
    }
  }

  function close() {
    if (panelRef.current?.contains(document.activeElement)) focusTarget.current = "launcher";
    setOpen(false);
    onOpenChange?.(false);
    // A thread left open gets one soft follow-up, once, so the conversation does not feel dropped.
    if (chat && greeted.current && pending.current === 0 && !nudged.current) {
      nudged.current = true;
      pending.current += 1;
      later(1600, () => pushReply("No rush, Jordan. I’ll keep this conversation open, and my replies will wait for you here."));
    }
  }

  function openArticle(id: string) {
    setArticleId(id);
    setDirection(1);
    setView("article");
    focusTarget.current = "article";
  }

  function openChat(prefill?: string) {
    const back = view === "article" ? "article" : "home";
    setReturnView(back);
    setView("chat");
    setUnread(0);
    if (prefill) setDraft(prefill);
    focusTarget.current = coarse() ? "panel" : "composer";
    if (greeted.current) return;
    greeted.current = true;
    pending.current += 1;
    setTyping(true);
    later(900, () => pushReply(back === "article"
      ? `Hi Jordan, I’m Ava. I have “${article.title}” open too, so we can pick up from there. What’s going on?`
      : "Hi Jordan, I’m Ava from Harbor support. What can I help with today?"));
  }

  function send(text: string) {
    const message = text.trim();
    if (!message) return;
    const id = nextId.current++;
    const time = stamp();
    setMessages(current => [...current, { id, from: "you", text: message, time, status: "Sent" }]);
    setDraft("");
    setSuggestions(current => current.filter(suggestion => suggestion !== text));
    onSend?.(message);
    pending.current += 1;
    later(700, () => {
      setMessages(current => current.map(entry => (entry.id === id ? { ...entry, status: "Seen" } : entry)));
      setTyping(true);
    });
    later(2200, () => {
      const text = message.toLowerCase();
      return pushReply(
        /export|arrive|csv|pdf|report|churn/.test(text)
          ? "Found it. The Churned accounts export paused on Sep 21 because the Postgres password changed. Update it under Data sources and I’ll rerun the export for you."
          : /seat|plan|invite|billing|upgrade|invoice/.test(text)
            ? "You’re using 12 of 15 seats on Growth, so two more fit without changing plans. Invite them from Settings, then Members."
            : /sso|okta|saml|login|sign in/.test(text)
              ? "Happy to help with SSO. Send me the error from Okta’s sign-in log and I’ll check the SAML settings on our side."
              : /thank|great|perfect|works|worked/.test(text)
                ? "Anytime, Jordan. I’ll keep this thread open in case anything else comes up."
                : "Thanks, Jordan. I’m looking at your workspace now and will reply here within a few minutes.",
      );
    });
  }

  function rate(value: "yes" | "no") {
    setFeedback(current => ({ ...current, [articleId]: value }));
    focusTarget.current = "feedback";
  }

  const listState = searching ? (results.length ? "results" : "none") : "popular";
  const rating = feedback[article.id];
  const viewTransition = reduced
    ? { duration: duration.instant }
    : { x: spring.smooth, opacity: { duration: duration.standard, ease: enter }, filter: { duration: duration.standard, ease: enter } };

  const homeView = <motion.div key="home" data-view="home" className={styles.view} layoutScroll custom={direction} variants={reduced ? fade : slide} initial="enter" animate="center" exit="exit" transition={viewTransition}>
    <div className={styles.greeting}>
      <p>Hi Jordan</p>
      <h2>How can we help?</h2>
    </div>
    <div className={styles.search}>
      <SearchField
        ref={searchRef}
        label="Search help articles"
        placeholder="Search for answers"
        value={query}
        onValueChange={setQuery}
        onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
          if (event.key === "ArrowDown") { event.preventDefault(); panelRef.current?.querySelector<HTMLElement>('[data-view="home"] [data-article]')?.focus(); }
          if (event.key === "Enter" && searching && results[0]) { event.preventDefault(); openArticle(results[0].id); }
        }}
        autoComplete="off"
        aria-controls={listId}
      />
    </div>
    <p className={styles.listHead}>
      <Swap swapId={listState} reduced={reduced}>
        {listState === "popular" ? "Popular articles" : listState === "none" ? "No matching articles" : <>
          <span className={styles.count}><AnimatedCounter value={results.length} /></span>
          {results.length === 1 ? " article" : " articles"}
        </>}
      </Swap>
    </p>
    {results.length
      ? <ul
        id={listId}
        className={styles.list}
        aria-label={searching ? "Search results" : "Popular articles"}
        onKeyDown={event => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          const cards = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-article]"));
          const index = cards.indexOf(document.activeElement as HTMLElement);
          if (index < 0) return;
          event.preventDefault();
          const next = index + (event.key === "ArrowDown" ? 1 : -1);
          if (next < 0) searchRef.current?.focus();
          else cards[Math.min(next, cards.length - 1)]?.focus();
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {results.map(entry => <motion.li
            key={entry.id}
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: reduced ? 0 : duration.instant } }}
            transition={reduced ? { duration: 0 } : { layout: spring.smooth, opacity: { duration: duration.standard, ease: enter } }}
          >
            <button type="button" className={styles.card} data-article={entry.id} onClick={() => openArticle(entry.id)}>
              <span className={styles.cardText}>
                <strong><Highlight text={entry.title} matcher={matcher} /></strong>
                <span><Highlight text={entry.summary} matcher={matcher} /></span>
              </span>
              <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </motion.li>)}
        </AnimatePresence>
      </ul>
      : <div className={styles.empty}>
        <p>Nothing in the help center mentions “{query.trim()}” yet. Ava can answer it directly.</p>
        <Button variant="secondary" size="sm" onClick={() => openChat(query.trim())}>Ask Ava</Button>
      </div>}
  </motion.div>;

  const articleView = <motion.div key={`article-${article.id}`} data-view="article" className={styles.view} custom={direction} variants={reduced ? fade : slide} initial="enter" animate="center" exit="exit" transition={viewTransition}>
    <article className={styles.article}>
      <p className={styles.meta}>{article.category} · {article.minutes} min read</p>
      <h3 tabIndex={-1}><Highlight text={article.title} matcher={matcher} /></h3>
      <div className={styles.byline}>
        <Avatar name={article.author.name} src={article.author.src} size="sm" />
        <span>{article.author.name} · Updated {article.updated}</span>
      </div>
      <p><Highlight text={article.intro} matcher={matcher} /></p>
      <ol className={styles.steps}>
        {article.steps.map((step, index) => <li key={step}>
          <span aria-hidden="true">{index + 1}</span>
          <p><Highlight text={step} matcher={matcher} /></p>
        </li>)}
      </ol>
      <p className={styles.note}>
        <Info size={16} strokeWidth={1.75} aria-hidden="true" />
        <span><Highlight text={article.note} matcher={matcher} /></span>
      </p>
      <div className={styles.feedback} data-feedback="" tabIndex={-1}>
        <Swap swapId={rating ?? "ask"} reduced={reduced}>
          {rating
            ? <span className={styles.rated}>{rating === "yes" ? <><CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />Thanks, glad it helped.</> : "Sorry it missed. Ava can take it from here."}</span>
            : <span className={styles.ask}>
              <span>Was this helpful?</span>
              <span className={styles.askButtons}>
                <Button variant="secondary" size="sm" onClick={() => rate("yes")}>Yes</Button>
                <Button variant="secondary" size="sm" onClick={() => rate("no")}>No</Button>
              </span>
            </span>}
        </Swap>
      </div>
    </article>
  </motion.div>;

  const panel = <motion.div
    key="panel"
    ref={panelRef}
    className={styles.panel}
    style={{ width: width - 2, height: height - 2 }}
    role="dialog"
    aria-label={chat ? "Conversation with Ava Mitchell" : "Help"}
    tabIndex={-1}
    onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1, transition: { duration: reduced ? duration.instant : duration.standard, delay: 0.06 * Number(!reduced), ease: enter } }}
    exit={{ opacity: 0, transition: { duration: reduced ? 0 : duration.instant, ease: standard } }}
  >
    <LayoutGroup id={panelId}>
      <header className={styles.header}>
        <motion.div className={styles.backSlot} inert={view === "home"} initial={false} animate={{ width: 40 * Number(view !== "home"), opacity: Number(view !== "home") }} transition={reduced ? { duration: 0 } : spring.morph}>
          <button type="button" className={styles.iconButton} onClick={() => {
            if (chat) { setView(returnView); focusTarget.current = "talk"; return; }
            setDirection(-1);
            setView("home");
            focusTarget.current = `card:${articleId}`;
          }} aria-label={chat ? "Back to help" : "Back to articles"}>
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </motion.div>
        <motion.span className={styles.faceSlot} initial={false} animate={{ width: 40 * Number(chat) }} transition={reduced ? { duration: 0 } : spring.morph}>
          {chat && <motion.span layoutId="ava" className={styles.face} transition={reduced ? { duration: 0 } : spring.morph}>
            <Avatar name={supportEngineer.name} src={supportEngineer.src} status="online" />
          </motion.span>}
        </motion.span>
        <div className={styles.headTitle}>
          <Swap swapId={chat ? "chat" : view === "article" ? `article-${article.category}` : "home"} reduced={reduced}>
            {chat
              ? <span className={styles.headStack}><strong>Ava Mitchell</strong><span>Support engineer · replies in about 4 min</span></span>
              : <strong>{view === "article" ? article.category : "Help"}</strong>}
          </Swap>
        </div>
        <button type="button" className={styles.iconButton} onClick={close} aria-label="Close help">
          <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.body} inert={chat}>
        <AnimatePresence initial={false} custom={direction}>
          {shownView === "article" ? articleView : homeView}
        </AnimatePresence>
      </div>
      <motion.div className={styles.sheet} data-chat={chat || undefined} initial={false} animate={{ height: chat ? chatHeight : 76 }} transition={reduced ? { duration: 0 } : spring.smooth}>
        <div className={styles.sheetInner} style={{ height: chatHeight }}>
          <AnimatePresence initial={false}>
            {chat && <motion.div key="chat" className={styles.chatBody} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: reduced ? duration.instant : duration.standard, delay: 0.08 * Number(!reduced), ease: enter } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : duration.instant } }}>
              <div className={styles.thread} ref={threadRef} role="log" aria-label="Messages with Ava">
                <p className={styles.threadMeta}>Today</p>
                <AnimatePresence initial={false}>
                  {messages.map(message => <motion.div
                    key={message.id}
                    className={message.from === "you" ? styles.mine : styles.theirs}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reduced ? { duration: duration.instant } : { y: spring.smooth, opacity: { duration: duration.standard, ease: enter } }}
                  >
                    <p className={styles.bubble}>{message.text}</p>
                    <span className={styles.stamp}>
                      {message.from === "you"
                        ? <Swap swapId={message.status ?? "Sent"} reduced={reduced}>{message.status} · {message.time}</Swap>
                        : `Ava · ${message.time}`}
                    </span>
                  </motion.div>)}
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  {typing && <motion.div
                    key="typing"
                    className={styles.typing}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: duration.instant } }}
                    transition={reduced ? { duration: duration.instant } : spring.snappy}
                  >
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                    <span className={styles.srOnly}>Ava is typing</span>
                  </motion.div>}
                </AnimatePresence>
              </div>
              {messages.length > 0 && suggestions.length > 0 && <div className={styles.suggestions} aria-label="Suggested replies" role="group">
                <AnimatePresence mode="popLayout" initial={false}>
                  {suggestions.map(suggestion => <motion.button
                    key={suggestion}
                    type="button"
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: duration.instant } }}
                    transition={reduced ? { duration: 0 } : { layout: spring.smooth, opacity: { duration: duration.standard } }}
                    onClick={() => send(suggestion)}
                  >{suggestion}</motion.button>)}
                </AnimatePresence>
              </div>}
            </motion.div>}
          </AnimatePresence>
          <div className={styles.dockRow}>
            <motion.form
              className={styles.composer}
              onSubmit={event => { event.preventDefault(); send(draft); }}
              inert={!chat}
              initial={false}
              animate={{ opacity: Number(chat) }}
              transition={reduced ? { duration: chat ? duration.instant : 0 } : chat ? { duration: duration.standard, ease: enter } : { duration: duration.fast, ease: standard }}
            >
              <label className={styles.srOnly} htmlFor={composerId}>Message Ava</label>
              <input ref={composerRef} id={composerId} type="text" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Message Ava" autoComplete="off" />
              <button type="submit" className={styles.send} disabled={!draft.trim()} aria-label="Send message">
                <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </motion.form>
            <motion.button
              ref={talkRef}
              type="button"
              className={styles.talk}
              onClick={() => openChat()}
              inert={chat}
              aria-label={unread ? `Talk to us, ${unread} new ${unread === 1 ? "reply" : "replies"} from Ava` : "Talk to us"}
              initial={false}
              animate={{ opacity: Number(!chat), filter: chat && !reduced ? `blur(${blur.subtle}px)` : "blur(0px)" }}
              transition={reduced ? { duration: chat ? 0 : duration.instant } : chat ? { duration: duration.fast, ease: standard } : { duration: duration.standard, delay: 0.1, ease: enter }}
            >
              <span className={styles.stack} aria-hidden="true">
                <motion.span layoutId="ava" className={styles.stackFace} transition={reduced ? { duration: 0 } : spring.morph}>
                  <Avatar name={supportEngineer.name} src={supportEngineer.src} size="sm" />
                </motion.span>
                {supportTeam.slice(1).map(person => <span key={person.name} className={styles.stackFace}>
                  <Avatar name={person.name} src={person.src} size="sm" />
                </span>)}
              </span>
              <TextMorph className={styles.talkLabel}>{unread ? "Ava replied" : "Talk to us"}</TextMorph>
              <Swap swapId={unread ? "new" : "time"} className={styles.talkMeta} reduced={reduced}>{unread ? `${unread} new` : "About 4 min"}</Swap>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </LayoutGroup>
  </motion.div>;

  return <section className={[styles.root, className].filter(Boolean).join(" ")} aria-label="Support widget">
    <div
      className={styles.stage}
      ref={stageRef}
      data-frame-flat={flat ? "" : undefined}
      style={flat ? { border: 0, borderRadius: 0, boxShadow: "none", background: "transparent" } : undefined}
    >
      <div className={styles.app} role="group" aria-label="Sample app page">
        <div className={styles.appBar}>
          <strong>Harbor</strong>
          <span className={styles.appNav}>
            <span>Dashboards</span>
            <span>Reports</span>
            <span aria-current="page">Exports</span>
          </span>
          <span className={styles.appUser}>Fieldstone Roasters</span>
        </div>
        <div className={styles.appHead}>
          <h2>Scheduled exports</h2>
          <p>4 schedules · times in UTC</p>
        </div>
        <ul className={styles.appRows}>
          {demoExports.map(entry => <li key={entry.name}>
            <span>
              <strong>{entry.name}</strong>
              <small>{entry.detail}</small>
            </span>
            <span className={styles.appStatus} data-tone={entry.ok ? "success" : "warning"}>
              {entry.ok ? <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" /> : <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />}
              {entry.status}
            </span>
          </li>)}
        </ul>
      </div>
      <div className={styles.dock}>
        <motion.div
          className={styles.widget}
          data-open={open || undefined}
          initial={false}
          animate={{ width: open ? width : 56, height: open ? height : 56, borderRadius: open ? 16 : 28 }}
          transition={reduced ? { duration: 0 } : open ? spring.morph : spring.smooth}
        >
          <AnimatePresence initial={false}>
            {open ? panel : <motion.button
              key="launcher"
              ref={launcherRef}
              type="button"
              className={styles.launcher}
              onClick={() => {
                const toComposer = unread > 0 || view === "chat";
                if (unread > 0 && view !== "chat") { setReturnView(view); setView("chat"); }
                setUnread(0);
                focusTarget.current = coarse() ? "panel" : toComposer ? "composer" : view === "article" ? "article" : "search";
                setOpen(true);
                onOpenChange?.(true);
                setLive(unread > 0 ? "Help opened on your conversation with Ava." : "");
              }}
              aria-haspopup="dialog"
              aria-label={unread ? `Open help, ${unread} unread ${unread === 1 ? "reply" : "replies"} from Ava` : "Open help"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: reduced ? duration.instant : duration.fast, delay: 0.12 * Number(!reduced) } }}
              exit={{ opacity: 0, transition: { duration: 0.08 * Number(!reduced) } }}
            >
              <motion.span
                className={styles.launcherIcon}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={reduced ? { duration: duration.instant } : { ...spring.snappy, delay: 0.12 }}
              >
                <MessageCircleQuestionMark size={24} strokeWidth={1.75} aria-hidden="true" />
              </motion.span>
            </motion.button>}
          </AnimatePresence>
        </motion.div>
        <AnimatePresence>
          {!open && unread > 0 && <motion.span
            key="unread"
            className={styles.unread}
            aria-hidden="true"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.8, transition: { duration: duration.instant } }}
            transition={reduced ? { duration: duration.instant } : { ...spring.snappy, delay: 0.2 }}
          >
            <Swap swapId={String(unread)} reduced={reduced}>{unread}</Swap>
          </motion.span>}
        </AnimatePresence>
      </div>
    </div>
    <span className={styles.srOnly} role="status" aria-live="polite">{live}</span>
  </section>;
}

/** One label replacing another in place; both are laid out while they cross, so the row never jumps. */
function Swap({ swapId, reduced, className, children }: { swapId: string; reduced: boolean; className?: string; children: React.ReactNode }) {
  return <span className={[styles.swap, className].filter(Boolean).join(" ")}>
    <AnimatePresence mode="popLayout" initial={false}>
      <SwapItem key={swapId} reduced={reduced}>{children}</SwapItem>
    </AnimatePresence>
  </span>;
}

function SwapItem({ reduced, children }: { reduced: boolean; children: React.ReactNode }) {
  const present = useIsPresent();
  return <motion.span
    className={styles.swapItem}
    aria-hidden={!present || undefined}
    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${blur.soft}px)` }}
    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    exit={reduced
      ? { opacity: 0, transition: { duration: 0 } }
      : { opacity: 0, y: -4, filter: `blur(${blur.soft}px)`, transition: { duration: duration.fast, ease: standard } }}
    transition={reduced ? { duration: duration.instant } : { duration: duration.standard, ease: enter }}
  >{children}</motion.span>;
}

/** Wraps the words that matched the search, so the reason a result is listed is visible. */
function Highlight({ text, matcher }: { text: string; matcher: RegExp | null }) {
  if (!matcher) return <>{text}</>;
  return <>{text.split(matcher).map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part))}</>;
}

export default SupportWidget;
