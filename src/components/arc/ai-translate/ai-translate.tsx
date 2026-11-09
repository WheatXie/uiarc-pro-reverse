"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { Check, ChevronDown, Languages, RotateCcw, TriangleAlert } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./ai-translate.module.css";

export type AiTranslateCode = "en" | "de" | "fr" | "es" | "ja" | "pt";

export interface AiTranslateLanguage {
  code: AiTranslateCode;
  native: string;
  english: string;
}

export interface AiTranslateRequest {
  text: string;
  from: AiTranslateCode;
  to: AiTranslateCode;
  signal: AbortSignal;
}

/** A finished translation, or a stream of pieces that arrive in reading order. */
export type AiTranslateOutput = Promise<string> | AsyncIterable<string>;

export interface AiTranslateModel {
  name: string;
  mark?: ReactNode;
}

export interface AiTranslateAuthor {
  name: string;
  role?: string;
  avatar?: string;
}

export interface AiTranslateProps {
  /** The message to translate. Leaving it out shows the built in French sample. */
  text?: string;
  /** Language the text is written in. Detected from the text when omitted. */
  sourceLanguage?: AiTranslateCode;
  /** Languages offered in the picker, in order. */
  languages?: readonly AiTranslateCode[];
  /** Controlled target language. */
  value?: AiTranslateCode;
  /** Initial target language when uncontrolled. Defaults to the source. */
  defaultValue?: AiTranslateCode;
  onValueChange?: (code: AiTranslateCode) => void;
  /** Real translator. Without it the bundled sample translations are used. */
  translate?: (request: AiTranslateRequest) => AiTranslateOutput;
  /** Static translations for the bundled sample text. */
  translations?: Partial<Record<AiTranslateCode, string>>;
  onTranslate?: (result: { from: AiTranslateCode; to: AiTranslateCode; text: string }) => void;
  onError?: (error: Error, info: { from: AiTranslateCode; to: AiTranslateCode }) => void;
  /** Person who wrote the message. `null` hides the header block. */
  author?: AiTranslateAuthor | null;
  timestamp?: string;
  model?: AiTranslateModel;
  /** Cycle through the sample languages on its own. Defaults on for the bundled sample. */
  autoPlay?: boolean;
  /** Claim nothing leaves the page and say so to screen readers. */
  simulated?: boolean;
  className?: string;
}

const LANGUAGES: readonly AiTranslateLanguage[] = [
  { code: "en", native: "English", english: "English" },
  { code: "de", native: "Deutsch", english: "German" },
  { code: "fr", native: "Français", english: "French" },
  { code: "es", native: "Español", english: "Spanish" },
  { code: "ja", native: "日本語", english: "Japanese" },
  { code: "pt", native: "Português", english: "Portuguese" },
];

const language = (code: AiTranslateCode): AiTranslateLanguage =>
  LANGUAGES.find(entry => entry.code === code) ?? LANGUAGES[0]!;

const SAMPLE_AUTHOR: AiTranslateAuthor = {
  name: "Chloé Nguyen",
  role: "Mobile lead, Lyon",
  avatar: "/media/people/chloe-nguyen.svg",
};

const SAMPLE_TEXT =
  "Bonjour à toute l'équipe ! La version 4.2 de l'app iOS est partie en revue chez Apple hier soir, avec le nouveau mode hors ligne. Les premiers retours de la bêta sont très bons : la synchronisation passe de 9 à 3 secondes en moyenne. Pouvez-vous vérifier les traductions des écrans de paiement avant jeudi ? Merci d'avance, et bravo pour ce sprint.";

export const SAMPLE_TRANSLATIONS: Record<Exclude<AiTranslateCode, "fr">, string> = {
  en: "Hi everyone! Version 4.2 of the iOS app went into Apple review last night, with the new offline mode. Early beta feedback is very good: sync time drops from 9 to 3 seconds on average. Could you check the translations on the payment screens before Thursday? Thanks in advance, and great work on this sprint.",
  de: "Hallo zusammen! Version 4.2 der iOS-App ist gestern Abend mit dem neuen Offline-Modus in die Prüfung bei Apple gegangen. Die ersten Rückmeldungen aus der Beta sind sehr gut: Die Synchronisierung dauert im Schnitt nur noch 3 statt 9 Sekunden. Könnt ihr die Übersetzungen der Bezahlbildschirme bis Donnerstag prüfen? Danke im Voraus und großartige Arbeit in diesem Sprint.",
  es: "¡Hola a todo el equipo! La versión 4.2 de la app de iOS entró anoche en revisión de Apple, con el nuevo modo sin conexión. Los primeros comentarios de la beta son muy buenos: la sincronización baja de 9 a 3 segundos de media. ¿Podéis revisar las traducciones de las pantallas de pago antes del jueves? Gracias de antemano, y enhorabuena por este sprint.",
  ja: "チームの皆さん、こんにちは！iOSアプリのバージョン4.2を、新しいオフラインモードと一緒に昨夜Appleの審査に提出しました。ベータ版の初期フィードバックはとても好評で、同期時間は平均9秒から3秒に短縮されています。木曜日までに決済画面の翻訳を確認していただけますか？いつもありがとうございます、今回のスプリントもお疲れさまでした。",
  pt: "Olá a todos! A versão 4.2 do app para iOS entrou ontem à noite na revisão da Apple, com o novo modo offline. Os primeiros comentários da beta são muito bons: a sincronização caiu de 9 para 3 segundos, em média. Vocês podem revisar as traduções das telas de pagamento até quinta-feira? Obrigada desde já, e parabéns por este sprint.",
};

/** Common function words, used only to guess which language a message is written in. */
const STOPWORDS: Record<AiTranslateCode, readonly string[]> = {
  en: ["the", "and", "is", "you", "of", "to", "with", "for", "this", "that", "on"],
  de: ["der", "die", "das", "und", "ist", "nicht", "mit", "ihr", "für", "zu", "sind", "auf"],
  fr: ["le", "la", "les", "et", "est", "pour", "avec", "une", "des", "vous", "de", "ce"],
  es: ["el", "la", "los", "las", "y", "es", "para", "con", "una", "del", "por", "este"],
  ja: [],
  pt: ["o", "a", "os", "as", "e", "é", "para", "com", "uma", "do", "da", "não", "este"],
};

const CJK = /[\u3040-\u30ff\u4e00-\u9faf]/;
const SENTENCES = /[\s\S]+?(?:[.!?…]+["'»”’)]*(?=\s|$)|[。！？]+|$)\s*/g;
const CHUNK_WORDS = [4, 3, 5, 6, 4, 5, 3, 6];
const EASE = [0.22, 1, 0.36, 1] as const;
const HEIGHT_SPRING = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
const AUTOPLAY: readonly AiTranslateCode[] = ["en", "de", "ja", "pt"];
const MENU_ICON = { size: 14, strokeWidth: 2 } as const;

const TEXT_VARIANTS: Variants = {
  enter: (fade: boolean) => (fade ? { opacity: 0, y: 2 } : { opacity: 1, y: 0 }),
  shown: { opacity: 1, y: 0, transition: { duration: 0.16, ease: EASE } },
  leave: (fade: boolean) => ({ opacity: 0, transition: { duration: 0.1 * Number(fade) } }),
};

const joinText = (state: TextState): string => {
  const done = state.chunks.join("");
  const rest = state.pending.join("");
  return rest ? (done && !/\s$/.test(done) ? `${done} ${rest}` : done + rest) : done;
};

const sentences = (value: string): string[] => value.match(SENTENCES)?.filter(Boolean) ?? [];

/** Split a finished string into the pieces a stream would have delivered, so both paths look the same. */
function chunkText(value: string): string[] {
  if (!/\s/.test(value.trim()) || CJK.test(value)) {
    const pieces: string[] = [];
    for (let index = 0, step = 0; index < value.length; step += 1) {
      const width = 2 * CHUNK_WORDS[step % CHUNK_WORDS.length]! + 2;
      pieces.push(value.slice(index, index + width));
      index += width;
    }
    return pieces;
  }
  const words = value.match(/\S+\s*/g) ?? [];
  const pieces: string[] = [];
  for (let index = 0, step = 0; index < words.length; step += 1) {
    const size = CHUNK_WORDS[step % CHUNK_WORDS.length]!;
    pieces.push(words.slice(index, index + size).join(""));
    index += size;
  }
  return pieces;
}

function detectLanguage(value: string): AiTranslateCode {
  if (CJK.test(value)) return "ja";
  const words = value.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  let best: AiTranslateCode = "en";
  let bestHits = 0;
  for (const [code, list] of Object.entries(STOPWORDS) as [AiTranslateCode, readonly string[]][]) {
    const hits = words.filter(word => list.includes(word)).length;
    if (hits > bestHits) {
      best = code;
      bestHits = hits;
    }
  }
  return best;
}

function ClaudeMark({ title = "Claude", ...props }: { title?: string } & Record<string, unknown>) {
  return (
    <svg viewBox="0 0 24 24" fill="#D97757" role="img" aria-label={title} {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

const DEFAULT_MODEL: AiTranslateModel = { name: "Claude Haiku 5.5", mark: <ClaudeMark title="Claude" /> };

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function isPromise(value: AiTranslateOutput): value is Promise<string> {
  return typeof (value as Promise<string>).then === "function";
}

interface TextState {
  id: number;
  lang: AiTranslateCode;
  chunks: string[];
  pending: string[];
  pendingOffset: number;
  pendingLang: AiTranslateCode;
  live: boolean;
  fade: boolean;
}

type Phase = "idle" | "thinking" | "streaming" | "done" | "error";

interface StatusView {
  key: string;
  label: string;
  shimmer?: boolean;
  tone?: "error";
}

export function AiTranslate({
  text,
  sourceLanguage,
  languages,
  value,
  defaultValue,
  onValueChange,
  translate,
  translations,
  onTranslate,
  onError,
  author,
  timestamp,
  model = DEFAULT_MODEL,
  autoPlay,
  simulated,
  className,
}: AiTranslateProps) {
  const reduced = useReducedMotion() ?? false;
  const bare = text === undefined;
  const message = text ?? SAMPLE_TEXT;
  const source = sourceLanguage ?? (bare ? "fr" : detectLanguage(message));
  const table = translations ?? (bare ? SAMPLE_TRANSLATIONS : undefined);
  const person = author === undefined ? (bare ? SAMPLE_AUTHOR : null) : author;
  const stamp = timestamp ?? (bare ? "Oct 27, 09:14" : undefined);
  const offered = (languages ?? LANGUAGES.map(entry => entry.code)).map(language);
  const isSimulated = simulated ?? !translate;
  const cycles = autoPlay ?? (bare && value === undefined && !translate);

  const [internal, setInternal] = useState<AiTranslateCode>(defaultValue ?? source);
  const target = value ?? internal;
  const [shown, setShown] = useState<TextState>(() => ({
    id: 0,
    lang: source,
    chunks: [message],
    pending: [],
    pendingOffset: 0,
    pendingLang: source,
    live: false,
    fade: false,
  }));
  const [phase, setPhase] = useState<Phase>("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [last, setLast] = useState<AiTranslateCode | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [inView, setInView] = useState(true);
  const [touched, setTouched] = useState(false);

  const root = useRef<HTMLElement>(null);
  const stateRef = useRef(shown);
  const cache = useRef(new Map<AiTranslateCode, string>());
  const controller = useRef<AbortController | null>(null);
  const seq = useRef(1);
  const step = useRef(0);
  const config = useRef({
    text: message,
    source,
    translate,
    translations: table,
    onTranslate,
    onError,
    isSimulated,
  });

  useLayoutEffect(() => {
    stateRef.current = shown;
    config.current = { text: message, source, translate, translations: table, onTranslate, onError, isSimulated };
  });

  // The clip grows with the spring while the stack underneath keeps its real height, so a longer language never jumps.
  const clip = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let stop: { stop: () => void } | undefined;
    const outer = clip.current;
    const inner = stack.current;
    if (!outer || !inner || typeof ResizeObserver === "undefined") return;
    let height = inner.offsetHeight;
    let width = inner.offsetWidth;
    const settle = () => {
      outer.style.height = "";
      outer.style.overflow = "";
      stop = undefined;
    };
    const observer = new ResizeObserver(() => {
      const next = inner.offsetHeight;
      const nextWidth = inner.offsetWidth;
      const reflowed = nextWidth !== width;
      width = nextWidth;
      if (next === height) return;
      const from = stop ? outer.getBoundingClientRect().height : height;
      height = next;
      stop?.stop();
      if (reduced || reflowed) {
        settle();
        return;
      }
      outer.style.overflow = "hidden";
      stop = animate(outer, { height: [from, next] }, { ...HEIGHT_SPRING, onComplete: settle });
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      stop?.stop();
    };
  }, [reduced]);

  const choose = (next: AiTranslateCode) => {
    if (next === target && phase === "error") setAttempt(count => count + 1);
    else {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    }
  };
  const chooseRef = useRef(choose);
  useLayoutEffect(() => {
    chooseRef.current = choose;
  });

  const previous = useRef({ text: message, source });
  const run = useRef<(next: AiTranslateCode) => () => void>(() => () => {});

  // One translation at a time: a new target or a retry aborts the stream that is still arriving.
  useLayoutEffect(() => {
    run.current = (next: AiTranslateCode) => {
      const { text: body, source: from, translate: translateFn, translations: table_, isSimulated: fake } = config.current;
      let current = stateRef.current;
      const english = language(next).english;

      controller.current?.abort();
      const session = new AbortController();
      controller.current = session;
      setFailure(null);

      const changed = previous.current.text !== body || previous.current.source !== from;
      if (changed) {
        previous.current = { text: body, source: from };
        cache.current.clear();
        setLast(null);
        current = {
          id: seq.current++,
          lang: from,
          chunks: [body],
          pending: [],
          pendingOffset: 0,
          pendingLang: from,
          live: false,
          fade: true,
        };
        setShown(current);
      }

      if (next === from) {
        setPhase("idle");
        if (!changed && (current.lang !== from || current.live || current.pending.length)) {
          setShown({
            id: seq.current++,
            lang: from,
            chunks: [body],
            pending: [],
            pendingOffset: 0,
            pendingLang: from,
            live: false,
            fade: true,
          });
          setAnnouncement(`Showing the original ${language(from).english}`);
        }
        return () => session.abort();
      }

      setLast(next);

      const cached = cache.current.get(next);
      if (cached !== undefined) {
        setPhase("done");
        if (current.lang !== next || current.live) {
          setShown({
            id: seq.current++,
            lang: next,
            chunks: [cached],
            pending: [],
            pendingOffset: 0,
            pendingLang: next,
            live: false,
            fade: true,
          });
        }
        setAnnouncement(`Translated from ${language(from).english} to ${english}`);
        return () => session.abort();
      }

      const ahead = sentences(joinText(current));
      const id = seq.current++;
      const received: string[] = [];
      let buffer = "";

      setShown({
        id,
        lang: next,
        chunks: [],
        pending: ahead,
        pendingOffset: 0,
        pendingLang: current.lang,
        live: true,
        fade: false,
      });
      setPhase("thinking");
      setAnnouncement(`Translating to ${english}.${fake ? " Simulated, nothing was sent." : ""}`);

      const push = (piece: string | undefined) => {
        if (session.signal.aborted || !piece) return;
        received.push(piece);
        buffer += piece;
        const delivered = sentences(buffer).length;
        setShown(state => (state.id === id
          ? { ...state, chunks: [...received], pending: ahead.slice(delivered), pendingOffset: delivered }
          : state));
        setPhase("streaming");
      };

      void (async () => {
        try {
          let output: AiTranslateOutput;
          if (translateFn) output = translateFn({ text: body, from, to: next, signal: session.signal });
          else {
            const ready = table_?.[next as Exclude<AiTranslateCode, "fr">];
            output = sleep(560, session.signal).then(() => {
              if (ready === undefined) throw Error(`No ${english} translation is available`);
              return ready;
            });
          }

          if (isPromise(output)) {
            const finished = await output;
            for (const piece of chunkText(finished)) {
              if (received.length) await sleep(34, session.signal);
              push(piece);
            }
          } else {
            for await (const piece of output) {
              if (session.signal.aborted) return;
              push(piece);
            }
          }

          if (session.signal.aborted) return;
          const whole = received.join("");
          if (!whole.trim()) throw Error("The translation came back empty");
          cache.current.set(next, whole);
          setShown(state => (state.id === id ? { ...state, pending: [], live: false } : state));
          setPhase("done");
          setAnnouncement(`Translated from ${language(from).english} to ${english}.${fake ? " Simulated, nothing was sent." : ""}`);
          config.current.onTranslate?.({ from, to: next, text: whole });
        } catch (error) {
          if (session.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
          const reason = error instanceof Error ? error : Error(String(error));
          setShown({
            ...current,
            id: seq.current++,
            chunks: [joinText(current)],
            pending: [],
            pendingOffset: 0,
            live: false,
            fade: true,
          });
          setPhase("error");
          setFailure(reason.message);
          setAnnouncement(`Couldn't translate to ${english}. ${reason.message}`);
          config.current.onError?.(reason, { from, to: next });
        }
      })();

      return () => session.abort();
    };
  });

  useEffect(() => run.current(target), [target, attempt, message, source]);

  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? true), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Autoplay walks the offered languages, then returns to the original, and stops for good once the reader takes over.
  const playing = cycles && !touched && inView;
  useEffect(() => {
    if (!playing || phase === "thinking" || phase === "streaming" || phase === "error" || (reduced && step.current > 0)) return;
    const atOriginal = target === source;
    const hold = step.current === 0 ? 900 : atOriginal ? 1800 : 2600;
    const timer = window.setTimeout(() => {
      const order = AUTOPLAY.filter(code => code !== source);
      const index = step.current % (order.length + 1);
      step.current += 1;
      if (index === order.length) chooseRef.current(source);
      else {
        if (index === 0) cache.current.clear();
        chooseRef.current(order[index]!);
      }
    }, hold);
    return () => window.clearTimeout(timer);
  }, [playing, phase, target, source, reduced]);

  const busy = phase === "thinking" || phase === "streaming";
  const original = target === source;
  const remembered = original ? last : source;
  const fromEnglish = language(source).english;
  const toEnglish = language(target).english;
  const empty = !message.trim();

  const status: StatusView = phase === "error"
    ? { key: "error", label: "Couldn't translate", tone: "error" }
    : busy
      ? { key: `busy-${target}`, label: `Translating to ${toEnglish}`, shimmer: true }
      : phase === "done"
        ? { key: `done-${target}`, label: `Translated from ${fromEnglish}` }
        : last
          ? { key: "original", label: "Showing original" }
          : { key: "ready", label: model.name };

  return (
    <section
      ref={root}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={person ? `Message from ${person.name}` : "Translatable text"}
      onPointerDownCapture={() => setTouched(true)}
      onKeyDownCapture={() => setTouched(true)}
    >
      <header className={styles.head}>
        {person && (
          <div className={styles.author}>
            <Avatar name={person.name} src={person.avatar} size="md" className={styles.avatar} />
            <div className={styles.byline}>
              <span className={styles.name}>{person.name}</span>
              {(person.role || stamp) && <span className={styles.meta}>{[person.role, stamp].filter(Boolean).join(" · ")}</span>}
            </div>
          </div>
        )}
        {!empty && (
          <span className={styles.chip}>
            <span className={styles.chipLabel}>{sourceLanguage ? "Written in" : "Detected"}</span>
            {fromEnglish}
          </span>
        )}
      </header>

      <div ref={clip} className={styles.textClip}>
        <div ref={stack} className={styles.textStack}>
          {empty ? (
            <p className={[styles.text, styles.empty].join(" ")}>Nothing to translate yet.</p>
          ) : (
            <AnimatePresence initial={false} custom={shown.fade}>
              <motion.p
                key={shown.id}
                lang={shown.lang}
                className={styles.text}
                custom={shown.fade}
                variants={reduced ? undefined : TEXT_VARIANTS}
                initial="enter"
                animate="shown"
                exit="leave"
                aria-busy={busy || undefined}
              >
                {shown.chunks.map((piece, index) => (
                  <span key={index} className={shown.live && !reduced ? styles.chunk : undefined}>{piece}</span>
                ))}
                {shown.pending.length > 0 && (
                  <>
                    {shown.chunks.length > 0 && !/\s$/.test(shown.chunks[shown.chunks.length - 1] ?? "") && " "}
                    {shown.pending.map((piece, index) => (
                      <span
                        key={shown.pendingOffset + index}
                        lang={shown.pendingLang}
                        className={[styles.pending, reduced ? styles.pendingStill : ""].filter(Boolean).join(" ")}
                      >
                        {piece}
                      </span>
                    ))}
                  </>
                )}
              </motion.p>
            </AnimatePresence>
          )}
        </div>
      </div>

      <footer className={styles.foot}>
        <div className={styles.controls}>
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger
              className={styles.trigger}
              disabled={empty}
              aria-label={`Translate to, ${original ? "original" : language(target).native}`}
            >
              <Languages size={16} strokeWidth={1.75} aria-hidden="true" className={styles.triggerIcon} />
              <span className={styles.stack} aria-hidden="true">
                <span className={styles.stackItem} data-active={original || undefined}>Translate</span>
                {offered.filter(entry => entry.code !== source).map(entry => (
                  <span key={entry.code} lang={entry.code} className={styles.stackItem} data-active={target === entry.code || undefined}>
                    {entry.native}
                  </span>
                ))}
              </span>
              <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" className={styles.chevron} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={styles.menu} align="start" sideOffset={6} collisionPadding={12} loop>
                <DropdownMenu.Label className={styles.menuLabel}>Translate to</DropdownMenu.Label>
                <DropdownMenu.RadioGroup value={target} onValueChange={code => choose(code as AiTranslateCode)}>
                  {offered.map(entry => (
                    <DropdownMenu.RadioItem key={entry.code} value={entry.code} className={styles.item}>
                      <span className={styles.itemCheck} aria-hidden="true">
                        <DropdownMenu.ItemIndicator>
                          <Check {...MENU_ICON} />
                        </DropdownMenu.ItemIndicator>
                      </span>
                      <span className={styles.itemName} lang={entry.code}>{entry.native}</span>
                      <span className={styles.itemMeta}>{entry.code === source ? "Original" : entry.english}</span>
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            type="button"
            className={styles.toggle}
            aria-pressed={original && !!last}
            disabled={empty || !remembered}
            onClick={() => { if (remembered) choose(remembered); }}
          >
            <span className={styles.stack}>
              <span className={styles.stackItem} data-active={!(original && last) || undefined} aria-hidden={original && !!last}>
                Show original
              </span>
              <span className={styles.stackItem} data-active={(original && !!last) || undefined} aria-hidden={!(original && last)}>
                Show translation
              </span>
            </span>
          </button>
        </div>

        <div className={styles.status}>
          <AnimatePresence initial={false}>
            <motion.span
              key={status.key}
              className={styles.statusItem}
              data-tone={status.tone}
              initial={!reduced && { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.16, ease: EASE } }}
              exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced) } }}
            >
              {status.tone === "error"
                ? <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" className={styles.errorIcon} />
                : <span className={styles.mark} title={model.name}>{model.mark ?? <Languages size={16} strokeWidth={1.75} aria-hidden="true" />}</span>}
              {status.shimmer
                ? <TextShimmer className={styles.statusText}>{status.label}</TextShimmer>
                : <span className={styles.statusText} title={status.tone === "error" ? failure ?? undefined : undefined}>{status.label}</span>}
              {status.tone === "error" && (
                <Button variant="ghost" size="sm" className={styles.retry} onClick={() => setAttempt(count => count + 1)}>
                  <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
                  Retry
                </Button>
              )}
            </motion.span>
          </AnimatePresence>
        </div>
      </footer>

      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    </section>
  );
}

export default AiTranslate;
