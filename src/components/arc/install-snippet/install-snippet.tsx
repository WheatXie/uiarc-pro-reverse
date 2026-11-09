"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert } from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./install-snippet.module.css";

export type InstallSnippetPackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface InstallSnippetFramework {
  id: string;
  label: string;
  install: { packages: string } | { file: string; code: string };
  key: { file: string; code: string };
  code: { file: string; code: string };
}

export type InstallSnippetStep = "install" | "key" | "code";

export interface InstallSnippetProps {
  title?: ReactNode;
  description?: ReactNode;
  version?: ReactNode;
  frameworks?: InstallSnippetFramework[];
  framework?: string;
  defaultFramework?: string;
  onFrameworkChange?: (id: string) => void;
  packageManager?: InstallSnippetPackageManager;
  defaultPackageManager?: InstallSnippetPackageManager;
  onPackageManagerChange?: (id: InstallSnippetPackageManager) => void;
  apiKey?: string;
  keyPlaceholder?: string;
  generateKey?: (signal: AbortSignal) => Promise<string>;
  onKeyGenerated?: (key: string) => void;
  onCopy?: (step: InstallSnippetStep, value: string) => void;
  className?: string;
}

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

const PACKAGE_MANAGERS: { id: InstallSnippetPackageManager; label: string; command: string }[] = [
  { id: "npm", label: "npm", command: "npm install" },
  { id: "pnpm", label: "pnpm", command: "pnpm add" },
  { id: "yarn", label: "yarn", command: "yarn add" },
  { id: "bun", label: "bun", command: "bun add" },
];

const SAMPLE_FRAMEWORKS: InstallSnippetFramework[] = [
  {
    id: "next",
    label: "Next.js",
    install: { packages: "@lumen/next" },
    key: { file: ".env.local", code: "NEXT_PUBLIC_LUMEN_KEY={{key}}" },
    code: {
      file: "app/layout.tsx",
      code: `import { Lumen } from "@lumen/next";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}<Lumen /></body>
    </html>
  );
}`,
    },
  },
  {
    id: "react",
    label: "React",
    install: { packages: "@lumen/react" },
    key: { file: ".env", code: "VITE_LUMEN_KEY={{key}}" },
    code: {
      file: "src/main.tsx",
      code: `import { createRoot } from "react-dom/client";
import { LumenProvider } from "@lumen/react";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <LumenProvider apiKey={import.meta.env.VITE_LUMEN_KEY}>
    <App />
  </LumenProvider>
);`,
    },
  },
  {
    id: "vue",
    label: "Vue",
    install: { packages: "@lumen/vue" },
    key: { file: ".env", code: "VITE_LUMEN_KEY={{key}}" },
    code: {
      file: "src/main.ts",
      code: `import { createApp } from "vue";
import { lumen } from "@lumen/vue";
import App from "./App.vue";

createApp(App)
  .use(lumen, { apiKey: import.meta.env.VITE_LUMEN_KEY })
  .mount("#app");`,
    },
  },
  {
    id: "html",
    label: "HTML",
    install: {
      file: "index.html",
      code: '<script src="https://cdn.lumen.dev/v2/lumen.min.js" defer></script>',
    },
    key: {
      file: "index.html",
      code: '<meta name="lumen-key" content="{{key}}" />',
    },
    code: {
      file: "index.html",
      code: `<script>
  window.addEventListener("load", () => {
    lumen.page();
    document.querySelector("#upgrade").onclick = () =>
      lumen.track("upgrade_clicked", { plan: "pro" });
  });
</script>`,
    },
  },
];

const MARKS: Record<string, string> = {
  next: "M18.665 21.978C16.758 23.255 14.465 24 12 24 5.377 24 0 18.623 0 12S5.377 0 12 0s12 5.377 12 12c0 3.583-1.574 6.801-4.067 9.001L9.219 7.2H7.2v9.596h1.615V9.251l9.85 12.727Zm-3.332-8.533 1.6 2.061V7.2h-1.6v6.245Z",
  react:
    "M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z",
  vue: "M24,1.61H14.06L12,5.16,9.94,1.61H0L12,22.39ZM12,14.08,5.16,2.23H9.59L12,6.41l2.41-4.18h4.43Z",
  html: "M1.5 0h21l-1.91 21.563L11.977 24l-8.564-2.438L1.5 0zm7.031 9.75l-.232-2.718 10.059.003.23-2.622L5.412 4.41l.698 8.01h9.126l-.326 3.426-2.91.804-2.955-.81-.188-2.11H6.248l.33 4.171L12 19.351l5.379-1.443.744-8.157H8.531z",
  npm: "M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z",
  pnpm: "M0 0v7.5h7.5V0zm8.25 0v7.5h7.498V0zm8.25 0v7.5H24V0zM8.25 8.25v7.5h7.498v-7.5zm8.25 0v7.5H24v-7.5zM0 16.5V24h7.5v-7.5zm8.25 0V24h7.498v-7.5zm8.25 0V24H24v-7.5z",
  yarn: "M12 0C5.375 0 0 5.375 0 12s5.375 12 12 12 12-5.375 12-12S18.625 0 12 0zm.768 4.105c.183 0 .363.053.525.157.125.083.287.185.755 1.154.31-.088.468-.042.551-.019.204.056.366.19.463.375.477.917.542 2.553.334 3.605-.241 1.232-.755 2.029-1.131 2.576.324.329.778.899 1.117 1.825.278.774.31 1.478.273 2.015a5.51 5.51 0 0 0 .602-.329c.593-.366 1.487-.917 2.553-.931.714-.009 1.269.445 1.353 1.103a1.23 1.23 0 0 1-.945 1.362c-.649.158-.95.278-1.821.843-1.232.797-2.539 1.242-3.012 1.39a1.686 1.686 0 0 1-.704.343c-.737.181-3.266.315-3.466.315h-.046c-.783 0-1.214-.241-1.45-.491-.658.329-1.51.19-2.122-.134a1.078 1.078 0 0 1-.58-1.153 1.243 1.243 0 0 1-.153-.195c-.162-.25-.528-.936-.454-1.946.056-.723.556-1.367.88-1.71a5.522 5.522 0 0 1 .408-2.256c.306-.727.885-1.348 1.32-1.737-.32-.537-.644-1.367-.329-2.21.227-.602.412-.936.82-1.08h-.005c.199-.074.389-.153.486-.259a3.418 3.418 0 0 1 2.298-1.103c.037-.093.079-.185.125-.283.31-.658.639-1.029 1.024-1.168a.94.94 0 0 1 .328-.06zm.006.7c-.507.016-1.001 1.519-1.001 1.519s-1.27-.204-2.266.871c-.199.218-.468.334-.746.44-.079.028-.176.023-.417.672-.371.991.625 2.094.625 2.094s-1.186.839-1.626 1.881c-.486 1.144-.338 2.261-.338 2.261s-.843.732-.899 1.487c-.051.663.139 1.2.343 1.515.227.343.51.176.51.176s-.561.653-.037.931c.477.25 1.283.394 1.71-.037.31-.31.371-1.001.486-1.283.028-.065.12.111.209.199.097.093.264.195.264.195s-.755.324-.445 1.066c.102.246.468.403 1.066.398.222-.005 2.664-.139 3.313-.296.375-.088.505-.283.505-.283s1.566-.431 2.998-1.357c.917-.598 1.293-.76 2.034-.936.612-.148.57-1.098-.241-1.084-.839.009-1.575.44-2.196.825-1.163.718-1.742.672-1.742.672l-.018-.032c-.079-.13.371-1.293-.134-2.678-.547-1.515-1.413-1.881-1.344-1.997.297-.5 1.038-1.297 1.334-2.78.176-.899.13-2.377-.269-3.151-.074-.144-.732.241-.732.241s-.616-1.371-.788-1.483a.271.271 0 0 0-.157-.046z",
  bun: "M12 22.596c6.628 0 12-4.338 12-9.688 0-3.318-2.057-6.248-5.219-7.986-1.286-.715-2.297-1.357-3.139-1.89C14.058 2.025 13.08 1.404 12 1.404c-1.097 0-2.334.785-3.966 1.821a49.92 49.92 0 0 1-2.816 1.697C2.057 6.66 0 9.59 0 12.908c0 5.35 5.372 9.687 12 9.687v.001ZM10.599 4.715c.334-.759.503-1.58.498-2.409 0-.145.202-.187.23-.029.658 2.783-.902 4.162-2.057 4.624-.124.048-.199-.121-.103-.209a5.763 5.763 0 0 0 1.432-1.977Zm2.058-.102a5.82 5.82 0 0 0-.782-2.306v-.016c-.069-.123.086-.263.185-.172 1.962 2.111 1.307 4.067.556 5.051-.082.103-.23-.003-.189-.126a5.85 5.85 0 0 0 .23-2.431Zm1.776-.561a5.727 5.727 0 0 0-1.612-1.806v-.014c-.112-.085-.024-.274.114-.218 2.595 1.087 2.774 3.18 2.459 4.407a.116.116 0 0 1-.049.071.11.11 0 0 1-.153-.026.122.122 0 0 1-.022-.083 5.891 5.891 0 0 0-.737-2.331Zm-5.087.561c-.617.546-1.282.76-2.063 1-.117 0-.195-.078-.156-.181 1.752-.909 2.376-1.649 2.999-2.778 0 0 .155-.118.188.085 0 .304-.349 1.329-.968 1.874Zm4.945 11.237a2.957 2.957 0 0 1-.937 1.553c-.346.346-.8.565-1.286.62a2.178 2.178 0 0 1-1.327-.62 2.955 2.955 0 0 1-.925-1.553.244.244 0 0 1 .064-.198.234.234 0 0 1 .193-.069h3.965a.226.226 0 0 1 .19.07c.05.053.073.125.063.197Zm-5.458-2.176a1.862 1.862 0 0 1-2.384-.245 1.98 1.98 0 0 1-.233-2.447c.207-.319.503-.566.848-.713a1.84 1.84 0 0 1 1.092-.11c.366.075.703.261.967.531a1.98 1.98 0 0 1 .408 2.114 1.931 1.931 0 0 1-.698.869v.001Zm8.495.005a1.86 1.86 0 0 1-2.381-.253 1.964 1.964 0 0 1-.547-1.366c0-.384.11-.76.32-1.079.207-.319.503-.567.849-.713a1.844 1.844 0 0 1 1.093-.108c.367.076.704.262.968.534a1.98 1.98 0 0 1 .4 2.117 1.932 1.932 0 0 1-.702.868Z",
};

function Mark({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={MARKS[id]} />
    </svg>
  );
}

const KEY_TOKEN = "{{key}}";
const ease = [...motionTokens.ease.standard] as [number, number, number, number];
const easeEnter = [...motionTokens.ease.enter] as [number, number, number, number];
const show = { duration: 0.16, ease } as const;
const hide = { duration: 0.1, ease } as const;
const instant = { duration: 0 } as const;
const spring = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;

async function simulateKey(signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 780);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `lm_live_${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

const TOKEN_RE = /(\/\/.*$|<!--.*?-->)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(=>)|(<\/?[A-Za-z][\w.]*|\/?>)|\b(import|from|export|default|function|return|const|let|var|await|async|new|type|of)\b|([A-Za-z_$][\w$]*)(?=\()|([A-Za-z_][\w-]*)(?==)|(\b\d+\b)|(\{\{key\}\})|([{}()[\];,.:!])/g;
const TOKEN_KINDS = ["cm", "str", "punct", "tag", "kw", "fn", "attr", "num", "key", "punct"] as const;
type TokenKind = (typeof TOKEN_KINDS)[number] | "plain";

interface Token {
  kind: TokenKind;
  text: string;
}

function languageFor(file: string, packages = false) {
  if (packages) return "shell";
  if (/(^|\/)\.env/.test(file)) return "env";
  return "code";
}

function tokenizeLine(line: string, lang: string): Token[] {
  let tokens: Token[] = [];
  if (lang === "shell") {
    const [head, ...rest] = line.split(" ");
    tokens = [{ kind: "fn", text: head ?? "" }];
    rest.forEach((word) => {
      tokens.push({ kind: "plain", text: " " });
      tokens.push({ kind: /[@/]/.test(word) ? "str" : word.startsWith("-") ? "cm" : "plain", text: word });
    });
  } else if (lang === "env" && line.includes("=") && !line.trimStart().startsWith("#")) {
    const at = line.indexOf("=");
    tokens = [
      { kind: "attr", text: line.slice(0, at) },
      { kind: "punct", text: "=" },
      { kind: "str", text: line.slice(at + 1) },
    ];
  } else {
    let cursor = 0;
    for (const match of line.matchAll(TOKEN_RE)) {
      const at = match.index ?? 0;
      if (at > cursor) tokens.push({ kind: "plain", text: line.slice(cursor, at) });
      const group = match.slice(1).findIndex(Boolean);
      tokens.push({ kind: TOKEN_KINDS[group] ?? "plain", text: match[0] });
      cursor = at + match[0].length;
    }
    if (cursor < line.length) tokens.push({ kind: "plain", text: line.slice(cursor) });
  }
  return tokens.flatMap((token) => token.kind !== "key" && token.text.includes(KEY_TOKEN)
    ? token.text.split(KEY_TOKEN).flatMap((part, index) => [
        ...(index ? [{ kind: "key" as const, text: KEY_TOKEN }] : []),
        ...(part ? [{ kind: token.kind, text: part }] : []),
      ])
    : [token]);
}

/** Every swap shares one grid cell, so the old and the new content overlap while they crossfade and nothing around them moves. */
function Swap({ id, children, className, itemClassName }: { id: string; children: ReactNode; className?: string; itemClassName?: string }) {
  const reduced = useReducedMotion() ?? false;
  return <div className={cx(styles.swap, className)}>
    <AnimatePresence initial={false}>
      <motion.div key={id} className={cx(styles.swapItem, itemClassName)}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: reduced ? instant : hide }} transition={reduced ? instant : show}>
        {children}
      </motion.div>
    </AnimatePresence>
  </div>;
}

/** The slot eases from the placeholder's width to the key's width in ch, so the tint never jumps ahead of the wipe. */
function KeySlot({ value, placeholder, fresh }: { value?: string; placeholder: string; fresh?: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const text = value ?? placeholder;
  return <motion.span className={styles.keySlot} data-filled={value ? "" : undefined} data-fresh={fresh && value ? "" : undefined}
    initial={false} animate={{ width: `${text.length}ch` }} transition={reduced ? instant : spring}>
    <AnimatePresence initial={false}>
      {value
        ? <motion.span key={value} className={styles.keyText}
            initial={fresh && !reduced ? { clipPath: "inset(0 100% 0 0)" } : false}
            animate={{ clipPath: "inset(0 0% 0 0)" }} exit={{ opacity: 0, transition: reduced ? instant : hide }}
            transition={{ duration: 0.34, ease: easeEnter }}>{value}</motion.span>
        : <motion.span key="placeholder" className={styles.keyText} exit={{ opacity: 0, transition: reduced ? instant : hide }}>{placeholder}</motion.span>}
    </AnimatePresence>
  </motion.span>;
}

function Code({ code, lang, numbered, keyValue, placeholder, fresh }: { code: string; lang: string; numbered: boolean; keyValue?: string; placeholder: string; fresh: boolean }) {
  const lines = useMemo(() => code.split("\n").map((line) => tokenizeLine(line, lang)), [code, lang]);
  return <pre className={styles.pre}><code>
    {lines.map((tokens, index) => <span key={index} className={styles.line}>
      {numbered && <span className={styles.ln} aria-hidden="true">{index + 1}</span>}
      {tokens.length
        ? tokens.map((token, at) => token.kind === "key"
          ? <KeySlot key={at} value={keyValue} placeholder={placeholder} fresh={fresh} />
          : <span key={at} className={token.kind === "plain" ? undefined : styles[token.kind]}>{token.text}</span>)
        : " "}
    </span>)}
  </code></pre>;
}

interface TabItem {
  id: string;
  label: string;
  mark?: ReactNode;
}

/** The highlight slides to the measured tab on a spring with no bounce, and the tablist keeps one tab stop that arrows move. */
function Tabs({ items, value, onChange, label, variant, panelId, idBase }: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  variant: "framework" | "pm";
  panelId?: string;
  idBase: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const list = useRef<HTMLDivElement | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [marker, setMarker] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const node = buttons.current.get(value);
      if (!node) return;
      setMarker((current) => current && current.x === node.offsetLeft && current.w === node.offsetWidth ? current : { x: node.offsetLeft, w: node.offsetWidth });
    };
    measure();
    if (typeof ResizeObserver === "undefined" || !list.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(list.current);
    return () => observer.disconnect();
  }, [value, items.length]);
  const framework = variant === "framework";
  return <div ref={list} role="tablist" aria-label={label}
    className={framework ? styles.tabs : styles.pmTabs}
    style={framework ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined}
    onKeyDown={(event) => {
      const current = items.findIndex((item) => item.id === value);
      const next = event.key === "ArrowRight" ? (current + 1) % items.length
        : event.key === "ArrowLeft" ? (current - 1 + items.length) % items.length
        : event.key === "Home" ? 0
        : event.key === "End" ? items.length - 1
        : -1;
      if (next < 0) return;
      event.preventDefault();
      const target = items[next];
      if (!target) return;
      onChange(target.id);
      buttons.current.get(target.id)?.focus();
    }}
  >
    {marker && <motion.span className={framework ? styles.indicator : styles.pmIndicator} aria-hidden="true"
      initial={false} animate={{ x: marker.x, width: marker.w }} transition={reduced ? instant : spring} />}
    {items.map((item) => {
      const selected = item.id === value;
      return <button key={item.id} ref={(node) => { node ? buttons.current.set(item.id, node) : buttons.current.delete(item.id); }}
        id={`${idBase}-${item.id}`} type="button" role="tab" aria-selected={selected} aria-controls={panelId}
        tabIndex={selected ? 0 : -1} aria-label={variant === "pm" ? item.label : undefined}
        className={framework ? styles.tab : styles.pmTab} data-selected={selected ? "" : undefined}
        onClick={() => onChange(item.id)}>
        {item.mark}
        <span className={variant === "pm" ? styles.pmLabel : styles.tabLabel}>{item.label}</span>
      </button>;
    })}
  </div>;
}

function CodePanel({ head, copyValue, copyLabel, onCopied, minLines, children }: {
  head: ReactNode;
  copyValue: string;
  copyLabel: string;
  onCopied: () => void;
  minLines: number;
  children: ReactNode;
}) {
  return <div className={styles.code}>
    <div className={styles.codeHead}>
      <div className={styles.codeHeadMain}>{head}</div>
      <CopyButton value={copyValue} label={copyLabel} iconOnly variant="plain" className={styles.copy} onCopied={onCopied} />
    </div>
    <div className={styles.codeBody} style={{ minHeight: `calc(${minLines} * var(--is-line) + 2 * var(--is-pad-y))` }}>
      {children}
    </div>
  </div>;
}

function Step({ n, title, description, descriptionId, done, action, children }: {
  n: number;
  title: ReactNode;
  description: ReactNode;
  descriptionId: string;
  done: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return <li className={styles.step}>
    <span className={styles.circle} data-done={done ? "" : undefined} aria-hidden="true">
      <Swap id={done ? "done" : "n"} className={styles.circleSwap}>
        {done ? <Check size={14} strokeWidth={2} /> : n}
      </Swap>
    </span>
    <div className={styles.stepMain}>
      <div className={styles.stepHead}>
        <div className={styles.stepText}>
          <h4 className={styles.stepTitle}>
            {title}
            <span className={styles.srOnly}>{done ? ", done" : ""}</span>
          </h4>
          <Swap id={descriptionId} className={styles.stepDesc} itemClassName={styles.stepDescItem}>{description}</Swap>
        </div>
        {action}
      </div>
      {children}
    </div>
  </li>;
}

/** A "get started in 30 seconds" card: framework tabs, three numbered steps and highlighted snippets that crossfade in
 *  reserved space. Generate key wipes a fresh key into the placeholder in place; without a generateKey it simulates one
 *  and says so, so nothing is sent. */
export function InstallSnippet({
  title = "Get started in 30 seconds",
  description = "Three steps to your first event.",
  version = "v2.4.0",
  frameworks = SAMPLE_FRAMEWORKS,
  framework,
  defaultFramework,
  onFrameworkChange,
  packageManager,
  defaultPackageManager = "npm",
  onPackageManagerChange,
  apiKey,
  keyPlaceholder = "YOUR_LUMEN_KEY",
  generateKey,
  onKeyGenerated,
  onCopy,
  className,
}: InstallSnippetProps) {
  const base = useId().replace(/:/g, "");
  const [ownFramework, setOwnFramework] = useState(defaultFramework ?? frameworks[0]?.id ?? "");
  const [ownPackageManager, setOwnPackageManager] = useState<InstallSnippetPackageManager>(defaultPackageManager);
  const [generated, setGenerated] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState<{ install: boolean; key: boolean; code: boolean }>({ install: false, key: false, code: false });
  const [announce, setAnnounce] = useState("");
  const pending = useRef<AbortController | null>(null);
  const simulated = !generateKey;
  const current = framework ?? ownFramework;
  const active = frameworks.find((entry) => entry.id === current) ?? frameworks[0];
  const managerId = packageManager ?? ownPackageManager;
  const manager = PACKAGE_MANAGERS.find((entry) => entry.id === managerId) ?? PACKAGE_MANAGERS[0];
  const key = apiKey ?? generated;
  const hasKey = !!key;
  const minLines = useMemo(() => Math.max(1, ...frameworks.map((entry) => entry.code.code.split("\n").length)), [frameworks]);

  useEffect(() => () => pending.current?.abort(), []);

  if (!active || !manager) return null;

  const withKey = (text: string) => text.split(KEY_TOKEN).join(key ?? keyPlaceholder);
  const install = active.install;
  const byPackages = "packages" in install;
  const installValue = "packages" in install ? `${manager.command} ${install.packages}` : install.code;
  const installText = withKey(installValue);
  const keyText = withKey(active.key.code);
  const codeText = withKey(active.code.code);
  const panelId = `${base}-panel`;

  function copiedStep(step: InstallSnippetStep, value: string) {
    setCopied((state) => (step === "key" && !hasKey) || state[step] ? state : { ...state, [step]: true });
    onCopy?.(step, value);
  }

  async function create() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setStatus("loading");
    setAnnounce("Generating a key");
    try {
      const created = await (generateKey ?? simulateKey)(controller.signal);
      if (controller.signal.aborted) return;
      setGenerated(created);
      setFresh(created);
      setStatus("ready");
      setCopied((state) => ({ ...state, key: true }));
      setAnnounce(simulated ? "Simulated key added to step 2. Nothing was sent." : "Key created and added to step 2.");
      onKeyGenerated?.(created);
      window.setTimeout(() => setFresh((value) => (value === created ? null : value)), 1100);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      setStatus("error");
      setAnnounce("Could not create a key. Try again.");
    }
  }

  const keyDescription = status === "error"
    ? { id: "error", node: <span className={styles.descError}><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />Could not create a key</span> }
    : hasKey
      ? { id: "ready", node: simulated && !apiKey ? "Simulated, not sent" : "Key created" }
      : { id: "idle", node: "Create a project key" };
  const frameworkTabs = frameworks.map((entry) => ({ id: entry.id, label: entry.label, mark: entry.id in MARKS ? <Mark id={entry.id} size={16} /> : undefined }));
  const managerTabs = PACKAGE_MANAGERS.map((entry) => ({ id: entry.id, label: entry.label, mark: <Mark id={entry.id} size={14} /> }));

  return <section className={cx(styles.root, className)} aria-labelledby={`${base}-title`}>
    <header className={styles.header}>
      <div className={styles.headerText}>
        <h3 id={`${base}-title`} className={styles.title}>{title}</h3>
        {description && <p className={styles.subtitle}>{description}</p>}
      </div>
      {version != null && <span className={styles.version}>{version}</span>}
    </header>
    <div className={styles.tabsWrap}>
      <Tabs items={frameworkTabs} value={active.id} label="Framework" variant="framework" panelId={panelId} idBase={`${base}-fw`}
        onChange={(id) => {
          if (id === current) return;
          if (framework === undefined) setOwnFramework(id);
          onFrameworkChange?.(id);
          setAnnounce(`Showing ${frameworks.find((entry) => entry.id === id)?.label ?? id} setup`);
        }} />
    </div>
    <ol id={panelId} role="tabpanel" aria-labelledby={`${base}-fw-${active.id}`} className={styles.steps}>
      <Step n={1} title="Install" description={byPackages ? "Add the SDK to your project" : "Load the script from our CDN"}
        descriptionId={byPackages ? "pm" : "cdn"} done={copied.install}>
        <CodePanel copyValue={installText} copyLabel="Copy install command" onCopied={() => copiedStep("install", installText)} minLines={1}
          head={<Swap id={byPackages ? "pm" : "file"} className={styles.headSwap}>
            {byPackages
              ? <Tabs items={managerTabs} value={manager.id} label="Package manager" variant="pm" idBase={`${base}-pm`}
                  onChange={(id) => {
                    if (id === managerId) return;
                    if (packageManager === undefined) setOwnPackageManager(id as InstallSnippetPackageManager);
                    onPackageManagerChange?.(id as InstallSnippetPackageManager);
                  }} />
              : <span className={styles.file}>{"file" in install ? install.file : ""}</span>}
          </Swap>}>
          <Swap id={`${active.id}-${byPackages ? manager.id : "cdn"}`} className={styles.layers} itemClassName={styles.layer}>
            <Code code={installValue} lang={languageFor("", byPackages)} numbered={false} placeholder={keyPlaceholder} keyValue={key} fresh={false} />
          </Swap>
        </CodePanel>
      </Step>
      <Step n={2} title="Add your key" description={keyDescription.node} descriptionId={keyDescription.id} done={copied.key}
        action={apiKey === undefined ? <Button size="sm" variant={status === "ready" ? "secondary" : "primary"} loading={status === "loading"}
          onClick={() => void create()} className={styles.generate}>
          {status === "ready" ? "Regenerate" : status === "error" ? "Try again" : "Generate key"}
        </Button> : undefined}>
        <CodePanel copyValue={keyText} copyLabel="Copy key line" onCopied={() => copiedStep("key", keyText)} minLines={1}
          head={<Swap id={active.key.file} className={styles.headSwap}><span className={styles.file}>{active.key.file}</span></Swap>}>
          <Swap id={active.id} className={styles.layers} itemClassName={styles.layer}>
            <Code code={active.key.code} lang={languageFor(active.key.file)} numbered={false} placeholder={keyPlaceholder} keyValue={key} fresh={fresh !== null && fresh === key} />
          </Swap>
        </CodePanel>
      </Step>
      <Step n={3} title="Ship" description="Deploy and watch events arrive" descriptionId="ship" done={copied.code}>
        <CodePanel copyValue={codeText} copyLabel="Copy code" onCopied={() => copiedStep("code", codeText)} minLines={minLines}
          head={<Swap id={active.code.file} className={styles.headSwap}><span className={styles.file}>{active.code.file}</span></Swap>}>
          <Swap id={active.id} className={styles.layers} itemClassName={styles.layer}>
            <Code code={active.code.code} lang={languageFor(active.code.file)} numbered placeholder={keyPlaceholder} keyValue={key} fresh={false} />
          </Swap>
        </CodePanel>
      </Step>
    </ol>
    <span className={styles.srOnly} role="status" aria-live="polite">{announce}</span>
  </section>;
}

export default InstallSnippet;
