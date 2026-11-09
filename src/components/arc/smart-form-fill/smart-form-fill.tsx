"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import {
  Building2,
  Check,
  CircleAlert,
  CircleCheck,
  CircleX,
  PenLine,
  RotateCcw,
  Square,
} from "lucide-react";
import { Button } from "../button/button";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./smart-form-fill.module.css";

export type SmartFormFillFieldKind = "text" | "email" | "tel" | "url" | "address" | "company";

/** One row of the card's form. `kind` picks the input type; "company" also gets a logo slot. */
export interface SmartFormFillField {
  id: string;
  label: string;
  kind?: SmartFormFillFieldKind;
  placeholder?: string;
  /** One column, or two for a full-width row. */
  span?: 1 | 2;
  autoComplete?: string;
}

/** What the extractor read for one field: the value, a confidence from 0 to 1, and where it came from. */
export interface SmartFormFillExtraction {
  value: string;
  confidence: number;
  /** The exact substring of the pasted text, which powers the highlight. */
  source?: string;
  /** Why a guess is uncertain, shown in the status line and in the field's description. */
  note?: string;
}

/** The extractor's answer: one entry per field id it could fill. */
export type SmartFormFillResult = Record<string, SmartFormFillExtraction>;

/** One sample text behind Try sample. */
export interface SmartFormFillSample {
  label: string;
  text: string;
}

/** The model named beside the paste area. */
export interface SmartFormFillModel {
  name: string;
  mark?: ReactNode;
}

export type SmartFormFillPhase = "idle" | "reading" | "filling" | "done" | "error";
export type SmartFormFillView = "edit" | "source";
export type SmartFormFillFieldState = "ok" | "review" | "checked" | "edited";

export interface SmartFormFillProps {
  /** The form: { id, label, kind?, placeholder?, span?, autoComplete? }. kind picks the input type; "company" adds a logo slot. Defaults to name, title, company, email, phone and address. */
  fields?: SmartFormFillField[];
  /** Starting values keyed by field id. */
  defaultValues?: Record<string, string>;
  /** Called on every change, typed or filled. */
  onValuesChange?: (values: Record<string, string>) => void;
  /** Reads the pasted text and resolves { [fieldId]: { value, confidence, source?, note? } }. Abort when the signal fires (Stop, Escape, a new paste). Defaults to a simulated read: hand-checked results for the samples and a local parser for anything else. */
  extract?: (text: string, signal: AbortSignal) => Promise<SmartFormFillResult>;
  /** Fields with a confidence below this ask for review and block Save until checked or edited. */
  reviewThreshold?: number;
  /** Texts behind Try sample, cycled in order. Pass [] to hide the button and the autoplay. */
  samples?: SmartFormFillSample[];
  /** Loops paste, fill, review and undo while visible, and stops for good on the first pointer or key press inside the card. */
  autoPlay?: boolean;
  /** Called once every field from a read has been filled. */
  onFill?: (result: SmartFormFillResult) => void;
  /** Called after Undo restores the values from before the last fill. */
  onUndo?: (restored: Record<string, string>) => void;
  /** Saves the form. The button shows a loading state while the promise is pending; a rejection shows an error status. */
  onSubmit?: (values: Record<string, string>) => void | Promise<void>;
  /** Logo for the company field. Falls back to built-in marks for Stripe, Linear, Vercel, Figma and Notion, then a building icon. */
  resolveLogo?: (company: string) => ReactNode | undefined;
  /** The model named beside the paste area. */
  model?: SmartFormFillModel;
  /** Card title. */
  title?: string;
  /** One line under the title. Pass an empty string to hide it. */
  description?: string;
  /** Label of the primary action. */
  submitLabel?: string;
  /** Class on the root card. */
  className?: string;
}

const defaultFields: SmartFormFillField[] = [
  { id: "name", label: "Full name", placeholder: "Ada Lovelace", autoComplete: "name" },
  { id: "title", label: "Job title", placeholder: "Head of partnerships", autoComplete: "organization-title" },
  { id: "company", label: "Company", kind: "company", placeholder: "Company name", span: 2, autoComplete: "organization" },
  { id: "email", label: "Email", kind: "email", placeholder: "name@company.com", autoComplete: "email" },
  { id: "phone", label: "Phone", kind: "tel", placeholder: "+1 (555) 000-0000", autoComplete: "tel" },
  { id: "address", label: "Address", kind: "address", placeholder: "Street, city, region, postcode", span: 2, autoComplete: "street-address" },
];

const signature = `Thanks again for the walkthrough on Tuesday. Redlines coming by Friday.

Maya Okafor
Head of Partnerships, Stripe
m +1 (415) 555-0142 · o +1 (415) 555-0100
maya.okafor@stripe.com
354 Oyster Pt Blvd, S. San Francisco 94080`;

const messyNote = `fwd from Jonas: met Priya Raman at Config last week,
she runs design eng at linear. priya@linear.app
cell is 628 555 0199, wants a follow up call
office near 1 Letterman Dr SF? not 100% sure`;

const defaultSamples: SmartFormFillSample[] = [
  { label: "Email signature", text: signature },
  { label: "Messy note", text: messyNote },
];

/** Hand-checked reads for the two samples, so the demo shows real confidence and real review reasons. */
const knownReads: Record<string, SmartFormFillResult> = {
  [signature]: {
    name: { value: "Maya Okafor", confidence: 0.99, source: "Maya Okafor" },
    title: { value: "Head of Partnerships", confidence: 0.97, source: "Head of Partnerships" },
    company: { value: "Stripe", confidence: 0.98, source: "Stripe" },
    email: { value: "maya.okafor@stripe.com", confidence: 0.99, source: "maya.okafor@stripe.com" },
    phone: { value: "+1 (415) 555-0142", confidence: 0.72, source: "+1 (415) 555-0142", note: "Two numbers found, picked the mobile one" },
    address: {
      value: "354 Oyster Point Blvd, South San Francisco, CA 94080",
      confidence: 0.68,
      source: "354 Oyster Pt Blvd, S. San Francisco 94080",
      note: "Expanded abbreviations and added the state",
    },
  },
  [messyNote]: {
    name: { value: "Priya Raman", confidence: 0.96, source: "Priya Raman" },
    title: { value: "Design Engineering Lead", confidence: 0.66, source: "runs design eng", note: "Paraphrased from “runs design eng”" },
    company: { value: "Linear", confidence: 0.94, source: "linear" },
    email: { value: "priya@linear.app", confidence: 0.99, source: "priya@linear.app" },
    phone: { value: "+1 (628) 555-0199", confidence: 0.9, source: "628 555 0199" },
    address: { value: "1 Letterman Drive, San Francisco, CA 94129", confidence: 0.48, source: "1 Letterman Dr SF", note: "The note itself says it is not sure" },
  },
};

const freeMail = /^(gmail|googlemail|outlook|hotmail|yahoo|icloud|me|proton|protonmail|aol|gmx|hey)$/i;
const roleWord =
  /\b(head|director|manager|engineer|designer|founder|co-?founder|ceo|cto|coo|cfo|vp|vice president|lead|partner|analyst|consultant|recruiter|developer|architect|officer|president|specialist|scientist|marketing|sales|product|operations)\b/i;
const streetWord =
  /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|way|lane|ln|ct|court|pl|place|sq|square|pkwy|parkway|hwy|ctr|center|strasse|straße|gasse|weg|platz)\b\.?/i;

const digitsOf = (value: string) => value.replace(/\D/g, "");

/** A local parser for anything that is not one of the hand-checked samples. */
function parseContact(text: string): SmartFormFillResult {
  const result: SmartFormFillResult = {};
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (email) result.email = { value: email[0].toLowerCase(), confidence: 0.98, source: email[0] };

  const numbers = [...text.matchAll(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}/g)].filter(
    (match) => digitsOf(match[0]).length >= 9,
  );
  if (numbers.length) {
    const mobile = numbers.find((match) =>
      /\b(m|mob|mobile|cell|c)\b[\s.:]*$/i.test(text.slice(Math.max(0, (match.index ?? 0) - 10), match.index)),
    );
    const picked = mobile ?? numbers[0];
    const raw = picked[0];
    const digits = digitsOf(raw);
    const several = numbers.length > 1;
    result.phone = {
      value:
        digits.length === 10
          ? `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
          : digits.length === 11 && digits.startsWith("1")
            ? `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
            : raw.trim(),
      confidence: several ? 0.72 : 0.92,
      source: raw.trim(),
      note: several ? `${numbers.length} numbers found, picked ${mobile ? "the mobile one" : "the first"}` : undefined,
    };
  }

  const nameLine = lines.find(
    (line) => /^[A-Z][a-z'-]+(?: [A-Z][a-z'-]+){1,2}$/.test(line) && !roleWord.test(line),
  );
  if (nameLine) result.name = { value: nameLine, confidence: 0.9, source: nameLine };

  const roleLine = lines.find((line) => roleWord.test(line) && line !== nameLine && !line.includes("@") && line.length < 80);
  if (roleLine) {
    const [role, employer] = roleLine.split(/\s*(?:,|\||\bat\b|@|·|–|-)\s+/);
    if (role) result.title = { value: role.trim(), confidence: 0.86, source: role.trim() };
    if (employer && /^[A-Z]/.test(employer)) result.company = { value: employer.trim(), confidence: 0.9, source: employer.trim() };
  }

  if (!result.company && email) {
    const domain = email[0].split("@")[1].split(".")[0];
    if (!freeMail.test(domain)) {
      result.company = {
        value: domain.charAt(0).toUpperCase() + domain.slice(1),
        confidence: 0.74,
        source: domain,
        note: "Guessed from the email domain",
      };
    }
  }

  const addressLine =
    lines.find((line) => /^\d+\s/.test(line) && streetWord.test(line)) ??
    lines.find((line) => /\b\d{5}(?:-\d{4})?\b/.test(line) && !/@/.test(line) && digitsOf(line).length < 9);
  if (addressLine) {
    const hasPostcode = /\b\d{4,5}\b/.test(addressLine.replace(/^\d+/, ""));
    result.address = {
      value: addressLine,
      confidence: hasPostcode ? 0.84 : 0.7,
      source: addressLine,
      note: hasPostcode ? undefined : "No postcode in the text",
    };
  }

  return result;
}

/** The default extractor: 720 ms of "reading", then the hand-checked sample or the local parser. */
async function simulateExtract(text: string, signal: AbortSignal): Promise<SmartFormFillResult> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, 720);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
  return knownReads[text.trim()] ?? knownReads[text] ?? parseContact(text);
}

const mark = (viewBox: string, children: ReactNode) =>
  function Mark({ size = 16, ...rest }: { size?: number } & Record<string, unknown>) {
    return (
      <svg viewBox={viewBox} width={size} height={size} aria-hidden="true" focusable="false" {...rest}>
        {children}
      </svg>
    );
  };

const ClaudeMark = mark(
  "0 0 24 24",
  <path
    fill="#D97757"
    d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"
  />,
);

const StripeMark = mark(
  "0 0 24 24",
  <path
    fill="#635BFF"
    d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"
  />,
);

const LinearMark = mark(
  "0 0 24 24",
  <path
    fill="#5E6AD2"
    d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z"
  />,
);

const VercelMark = mark("0 0 24 24", <path fill="currentColor" d="m12 1.608 12 20.784H0Z" />);

const FigmaMark = mark(
  "0 0 38 57",
  <>
    <path fill="#1ABCFE" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
    <path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
    <path fill="#FF7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
    <path fill="#F24E1E" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
    <path fill="#A259FF" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
  </>,
);

const NotionMark = mark(
  "0 0 24 24",
  <path
    fill="currentColor"
    d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"
  />,
);

const brandMarks: Record<string, (props: { size?: number }) => ReactNode> = {
  stripe: StripeMark,
  linear: LinearMark,
  vercel: VercelMark,
  figma: FigmaMark,
  notion: NotionMark,
};

const defaultModel: SmartFormFillModel = { name: "Claude Haiku 5.5", mark: <ClaudeMark size={14} /> };

const easeIn: Transition = { duration: 0.16, ease: [0.22, 1, 0.36, 1] };
const easeOut: Transition = { duration: 0.1, ease: [0.22, 1, 0.36, 1] };

const cx = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(" ");

/** "a", "a and b", "a, b and c". */
const listOf = (values: string[]) =>
  values.length <= 1 ? values.join("") : `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;

const lineCount = (text: string) => text.split(/\r?\n/).filter((line) => line.trim()).length;

/** One keycap. Local port of the shared Kbd, so the hint keeps the shipped metrics without a shared stylesheet. */
function Keycap({ glyph, name }: { glyph: string; name: string }) {
  return (
    <kbd className={styles.key}>
      <span className={styles.glyph} aria-hidden="true">{glyph}</span>
      <span className={styles.hidden}>{name}</span>
    </kbd>
  );
}

function KeyHint({ className }: { className?: string }) {
  return (
    <kbd className={cx(styles.kbd, styles.kbdSm, className)}>
      <span className={styles.slot}>
        <Keycap glyph="⌘" name="Command" />
      </span>
      <span className={styles.slot}>
        <span className={styles.hidden}> </span>
        <Keycap glyph="↵" name="Return" />
      </span>
    </kbd>
  );
}

/** A swap in a shared grid cell: the old content fades out, the new one rises 2px in. */
function Swap({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: easeIn }}
          exit={{ opacity: 0, transition: easeOut }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Splits the pasted text into plain runs and the source span of each filled field. */
function sourceSegments(text: string, filled: Record<string, FilledField>, order: string[]) {
  const ranges: Array<{ id: string; start: number; end: number }> = [];
  for (const id of order) {
    const source = filled[id]?.source;
    if (!source) continue;
    let from = 0;
    let at = text.indexOf(source, from);
    while (at !== -1 && ranges.some((range) => at < range.end && at + source.length > range.start)) {
      from = at + 1;
      at = text.indexOf(source, from);
    }
    if (at !== -1) ranges.push({ id, start: at, end: at + source.length });
  }
  ranges.sort((a, b) => a.start - b.start);
  const segments: Array<{ text: string; id?: string }> = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start) });
    segments.push({ text: text.slice(range.start, range.end), id: range.id });
    cursor = range.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

interface FilledField extends SmartFormFillExtraction {
  state: SmartFormFillFieldState;
}

interface Status {
  text: string;
  tone: "neutral" | "success" | "warning" | "danger";
  sr?: string;
}

interface Progress {
  id: string | null;
  done: number;
  total: number;
}

export function SmartFormFill({
  fields = defaultFields,
  defaultValues,
  onValuesChange,
  extract,
  reviewThreshold = 0.8,
  samples = defaultSamples,
  autoPlay,
  onFill,
  onUndo,
  onSubmit,
  resolveLogo,
  model = defaultModel,
  title = "New contact",
  description = "Paste a signature, an email or rough notes. AI fills the fields and flags anything to check.",
  submitLabel = "Save contact",
  className,
}: SmartFormFillProps) {
  const rawId = useId();
  const reduced = useReducedMotion() ?? false;
  const simulated = !extract;
  const read = extract ?? simulateExtract;
  const order = useMemo(() => fields.map((field) => field.id), [fields]);
  const labelOf = useCallback((id: string) => fields.find((field) => field.id === id)?.label ?? id, [fields]);

  const [text, setText] = useState("");
  const [view, setView] = useState<SmartFormFillView>("edit");
  const [phase, setPhase] = useState<SmartFormFillPhase>("idle");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.id, defaultValues?.[field.id] ?? ""])),
  );
  const [filled, setFilled] = useState<Record<string, FilledField>>({});
  const [flashes, setFlashes] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<Progress>({ id: null, done: 0, total: 0 });
  const [snapshot, setSnapshot] = useState<Record<string, string> | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ text: "Paste text to fill the form", tone: "neutral" });
  const [saving, setSaving] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const inputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const controllerRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);
  const valuesRef = useRef(values);
  const filledRef = useRef(filled);
  const startedAt = useRef(0);
  const settleRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    valuesRef.current = values;
    filledRef.current = filled;
  });

  const commit = useCallback(
    (next: Record<string, string>) => {
      valuesRef.current = next;
      setValues(next);
      onValuesChange?.(next);
    },
    [onValuesChange],
  );

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  useEffect(
    () => () => {
      clearTimers();
      controllerRef.current?.abort();
    },
    [],
  );

  const reviewIds = order.filter((id) => filled[id]?.state === "review");

  const run = useCallback(
    async (raw: string) => {
      const source = raw.trim();
      if (!source) return;
      controllerRef.current?.abort();
      clearTimers();
      const controller = new AbortController();
      controllerRef.current = controller;
      startedAt.current = performance.now();
      setView("source");
      setPhase("reading");
      setFilled({});
      setHovered(null);
      setProgress({ id: null, done: 0, total: 0 });
      setStatus({ text: `Reading ${lineCount(source)} lines`, tone: "neutral" });

      let result: SmartFormFillResult;
      try {
        result = await read(raw, controller.signal);
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError") ||
          (error as { name?: string } | undefined)?.name === "AbortError"
        )
          return;
        setPhase("error");
        setStatus({ text: "Couldn't read that text. Try again.", tone: "danger" });
        settleRef.current?.();
        return;
      }
      if (controller.signal.aborted) return;

      const hits = order.filter((id) => result[id]?.value);
      if (!hits.length) {
        setPhase("error");
        setStatus({ text: "No contact details found in that text.", tone: "danger" });
        settleRef.current?.();
        return;
      }

      setSnapshot({ ...valuesRef.current });
      setPhase("filling");
      setProgress({ id: null, done: 0, total: hits.length });

      const apply = (id: string, index: number) => {
        const hit = result[id];
        commit({ ...valuesRef.current, [id]: hit.value });
        setFilled((current) => ({
          ...current,
          [id]: { ...hit, state: hit.confidence < reviewThreshold ? "review" : "ok" },
        }));
        setFlashes((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
        setProgress({ id, done: index + 1, total: hits.length });
      };

      const finish = () => {
        const toCheck = hits.filter((id) => result[id].confidence < reviewThreshold).map((id) => labelOf(id).toLowerCase());
        const seconds = ((performance.now() - startedAt.current) / 1000).toFixed(1);
        setPhase("done");
        setProgress({ id: null, done: hits.length, total: hits.length });
        setStatus(
          toCheck.length
            ? {
                text: `Filled ${hits.length} fields. Check the ${listOf(toCheck)}.`,
                tone: "warning",
                sr: simulated ? "Simulated, nothing was sent." : undefined,
              }
            : {
                text: `Filled ${hits.length} fields in ${seconds}s.`,
                tone: "success",
                sr: simulated ? "Simulated, nothing was sent." : undefined,
              },
        );
        onFill?.(result);
        settleRef.current?.();
      };

      if (reduced) {
        hits.forEach(apply);
        finish();
        return;
      }
      hits.forEach((id, index) => {
        timersRef.current.push(window.setTimeout(() => apply(id, index), 140 * index));
      });
      timersRef.current.push(window.setTimeout(finish, 140 * hits.length + 120));
    },
    [commit, labelOf, onFill, order, read, reduced, reviewThreshold, simulated],
  );

  const stop = useCallback(() => {
    if (phase !== "reading") return;
    controllerRef.current?.abort();
    setPhase("idle");
    setView("edit");
    setStatus({ text: "Stopped. Nothing changed.", tone: "neutral" });
  }, [phase]);

  const undo = useCallback(() => {
    if (!snapshot) return;
    controllerRef.current?.abort();
    clearTimers();
    commit(snapshot);
    onUndo?.(snapshot);
    setSnapshot(null);
    setFilled({});
    setHovered(null);
    setPhase("idle");
    setView("edit");
    setProgress({ id: null, done: 0, total: 0 });
    setStatus({ text: "Restored the previous values.", tone: "neutral" });
  }, [commit, onUndo, snapshot]);

  const confirm = useCallback(
    (id: string) => {
      setFilled((current) => (current[id] ? { ...current, [id]: { ...current[id], state: "checked" } } : current));
      const left = order.filter((other) => other !== id && filledRef.current[other]?.state === "review");
      setStatus(
        left.length
          ? { text: `${labelOf(id)} checked. ${left.length} left to review.`, tone: "warning" }
          : { text: "All fields checked.", tone: "success" },
      );
    },
    [labelOf, order],
  );

  const submit = async () => {
    if (reviewIds.length) {
      inputsRef.current[reviewIds[0]]?.focus();
      setStatus({ text: `Check the ${listOf(reviewIds.map((id) => labelOf(id).toLowerCase()))} before saving.`, tone: "warning" });
      return;
    }
    const current = valuesRef.current;
    if (!Object.values(current).some((value) => value.trim())) {
      setStatus({ text: "Nothing to save yet. Paste some text first.", tone: "neutral" });
      return;
    }
    setSaving(true);
    try {
      if (onSubmit) await onSubmit(current);
      else await new Promise((resolve) => window.setTimeout(resolve, 650));
      const first = current[order[0]]?.trim();
      setStatus({
        text: `Saved${first ? ` ${first}` : ""}.${onSubmit ? "" : " Simulated, nothing was sent."}`,
        tone: "success",
      });
    } catch {
      setStatus({ text: "Couldn't save. Try again.", tone: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const nextSample = () => samples[sampleIndex % samples.length];

  const activeId = phase === "filling" ? progress.id : hovered;

  const segments = useMemo(() => sourceSegments(text, filled, order), [text, filled, order]);

  // Keep the highlighted field in view as the fill walks down the card.
  useEffect(() => {
    const node = sourceRef.current;
    if (!node || !activeId) return;
    const target = node.querySelector<HTMLElement>(`[data-field="${CSS.escape(activeId)}"]`);
    if (!target) return;
    const top = target.offsetTop - node.offsetTop;
    const bottom = top + target.offsetHeight;
    if (top < node.scrollTop + 8) {
      node.scrollTo({ top: Math.max(0, top - 12), behavior: reduced ? "auto" : "smooth" });
    } else if (bottom > node.scrollTop + node.clientHeight - 8) {
      node.scrollTo({ top: bottom - node.clientHeight + 12, behavior: reduced ? "auto" : "smooth" });
    }
  }, [activeId, reduced]);

  // The autoplay loop: paste, read, fill, review, undo, forever, until someone touches the card.
  const playing = autoPlay ?? !extract;
  const stoppedRef = useRef(false);
  const visibleRef = useRef(true);
  const liveRef = useRef({ run, confirm, undo, samples, order });

  useLayoutEffect(() => {
    liveRef.current = { run, confirm, undo, samples, order };
  });

  useEffect(() => {
    const node = rootRef.current;
    if (!playing || !node || !liveRef.current.samples.length) return;
    const timers: number[] = [];
    stoppedRef.current = false;

    const stopForGood = () => {
      stoppedRef.current = true;
    };
    node.addEventListener("pointerdown", stopForGood);
    node.addEventListener("keydown", stopForGood);

    let resume: (() => void) | null = null;
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          visibleRef.current = entry.isIntersecting;
          if (entry.isIntersecting) resume?.();
        },
        { threshold: 0.35 },
      );
      observer.observe(node);
    }

    let cancelled = false;
    const halt = () => cancelled || stoppedRef.current;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const tick = () => {
          if (halt()) {
            resolve();
            return;
          }
          if (!visibleRef.current) {
            resume = () => {
              resume = null;
              tick();
            };
            return;
          }
          timers.push(window.setTimeout(resolve, ms));
        };
        tick();
      });

    const settled = () =>
      new Promise<void>((resolve) => {
        settleRef.current = () => {
          settleRef.current = null;
          resolve();
        };
      });

    void (async () => {
      for (let index = 0; !halt() && (await wait(index === 0 ? 700 : 600), !halt()); index += 1) {
        const { samples: list } = liveRef.current;
        const sample = list[index % list.length];
        setSampleIndex(index + 1);
        setText(sample.text);
        const done = settled();
        void liveRef.current.run(sample.text);
        await done;
        if (halt() || reduced || (await wait(1500), halt())) break;
        const low = liveRef.current.order.find((id) => filledRef.current[id]?.state === "review");
        if (low) {
          setHovered(low);
          if (await wait(900), halt()) break;
          liveRef.current.confirm(low);
          setHovered(null);
        }
        if (await wait(1800), halt()) break;
        liveRef.current.undo();
      }
    })();

    return () => {
      cancelled = true;
      resume?.();
      timers.forEach((timer) => window.clearTimeout(timer));
      settleRef.current = null;
      observer?.disconnect();
      node.removeEventListener("pointerdown", stopForGood);
      node.removeEventListener("keydown", stopForGood);
    };
  }, [playing, reduced]);

  const totalLines = lineCount(text);
  const state = view === "edit" ? (text.trim() ? "ready" : "empty") : phase;
  const barText =
    view === "edit"
      ? text.trim()
        ? `to read ${totalLines} ${totalLines === 1 ? "line" : "lines"}`
        : "Paste anything to fill the form"
      : phase === "reading"
        ? `Reading with ${model.name}`
        : phase === "filling"
          ? `Filling ${progress.done} of ${progress.total}`
          : `Read by ${model.name}`;

  const StatusIcon =
    status.tone === "success" ? CircleCheck : status.tone === "warning" ? CircleAlert : status.tone === "danger" ? CircleX : null;
  const note = hovered && filled[hovered]?.state === "review" ? filled[hovered]?.note : undefined;
  const shown = note && hovered ? { text: `${labelOf(hovered)}: ${note}.`, tone: "warning" as const } : status;
  const ShownIcon = note ? CircleAlert : StatusIcon;
  const busy = phase === "reading" || phase === "filling";

  return (
    <div
      ref={rootRef}
      className={cx(styles.root, className)}
      data-phase={phase}
      onKeyDown={(event) => {
        if (event.key === "Escape" && phase === "reading") {
          event.preventDefault();
          stop();
        }
      }}
    >
      <header className={styles.head}>
        <h3 className={styles.title} id={`${rawId}-title`}>{title}</h3>
        {description ? <p className={styles.description}>{description}</p> : null}
      </header>
      <div className={styles.body}>
        <div className={styles.well} data-view={view}>
          <div className={styles.editor}>
            <AnimatePresence initial={false}>
              {view === "edit" ? (
                <motion.div
                  key="edit"
                  className={styles.layer}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: easeIn }}
                  exit={{ opacity: 0, transition: easeOut }}
                >
                  <textarea
                    ref={textareaRef}
                    className={styles.textarea}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onPaste={(event) => {
                      const pasted = event.clipboardData.getData("text/plain");
                      if (!pasted.trim()) return;
                      event.preventDefault();
                      const area = event.currentTarget;
                      const next = text.slice(0, area.selectionStart) + pasted + text.slice(area.selectionEnd);
                      setText(next);
                      void run(next);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        void run(text);
                      }
                    }}
                    placeholder={
                      "Paste an email signature, a business card or any messy text.\n\nMaya Okafor\nHead of Partnerships, Stripe\nmaya.okafor@stripe.com"
                    }
                    aria-label="Paste anything"
                    aria-describedby={`${rawId}-bar`}
                    spellCheck={false}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="source"
                  ref={sourceRef}
                  className={cx(styles.layer, styles.source)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: easeIn }}
                  exit={{ opacity: 0, transition: easeOut }}
                  tabIndex={0}
                  role="region"
                  aria-label="Pasted text"
                >
                  {segments.map((segment, index) =>
                    segment.id ? (
                      <mark
                        key={`${segment.id}-${index}`}
                        data-field={segment.id}
                        data-review={filled[segment.id]?.state === "review" || undefined}
                        data-active={activeId === segment.id || undefined}
                        className={styles.span}
                      >
                        {segment.text}
                      </mark>
                    ) : (
                      <span key={index}>{segment.text}</span>
                    ),
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className={styles.bar} id={`${rawId}-bar`}>
            <span className={styles.model}>
              <span className={styles.modelMark} aria-hidden="true">
                {model.mark ?? <ClaudeMark size={14} />}
              </span>
              <Swap id={state} className={styles.barText}>
                {phase === "reading" && view === "source" ? (
                  <TextShimmer>{barText}</TextShimmer>
                ) : state === "ready" ? (
                  <span>
                    <KeyHint className={styles.hintKey} />
                    {barText}
                  </span>
                ) : state === "filling" ? (
                  <span>
                    Filling{" "}
                    <span className={styles.barNum}>
                      <span className={styles.barGhost} aria-hidden="true">{progress.total}</span>
                      <span>{progress.done}</span>
                    </span>{" "}
                    of {progress.total}
                  </span>
                ) : (
                  <span>{barText}</span>
                )}
              </Swap>
            </span>
            <span className={styles.barActions}>
              {view === "edit" ? (
                <>
                  {samples.length ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={styles.barButton}
                      onClick={() => {
                        const sample = nextSample();
                        setSampleIndex((current) => current + 1);
                        setText(sample.text);
                        void run(sample.text);
                      }}
                      title={`Paste the ${nextSample().label.toLowerCase()} sample`}
                    >
                      Try sample
                    </Button>
                  ) : null}
                  <Button
                    variant="primary"
                    size="sm"
                    className={styles.barButton}
                    onClick={() => void run(text)}
                    disabled={!text.trim()}
                    aria-keyshortcuts="Meta+Enter Control+Enter"
                  >
                    Fill
                  </Button>
                </>
              ) : phase === "reading" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.barButton}
                  onClick={stop}
                  aria-keyshortcuts="Escape"
                >
                  <Square size={12} aria-hidden="true" className={styles.stopIcon} />
                  Stop
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.barButton}
                  onClick={() => {
                    setView("edit");
                    if (phase === "error") setPhase("idle");
                    window.requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                  disabled={phase === "filling"}
                >
                  <PenLine size={14} aria-hidden="true" />
                  Edit text
                </Button>
              )}
            </span>
          </div>
        </div>
        <div className={styles.form} role="group" aria-labelledby={`${rawId}-title`}>
          {fields.map((field) => {
            const hit = filled[field.id];
            const value = values[field.id] ?? "";
            const flash = flashes[field.id] ?? 0;
            const id = `${rawId}-${field.id}`;
            const confidence = hit ? Math.round(hit.confidence * 100) : 0;
            const badge = hit
              ? hit.state === "review"
                ? { key: "review", label: `${confidence}% · Review`, tone: "warning" }
                : hit.state === "checked"
                  ? { key: "checked", label: "Checked", tone: "success" }
                  : hit.state === "edited"
                    ? { key: "edited", label: "Edited", tone: "neutral" }
                    : { key: "ok", label: `${confidence}%`, tone: "success" }
              : null;
            const logo =
              field.kind === "company" && value.trim()
                ? (resolveLogo?.(value) ?? brandMarks[value.trim().toLowerCase().replace(/,?\s+(inc|llc|ltd|gmbh)\.?$/, "")]?.({ size: 16 }))
                : undefined;
            return (
              <div
                key={field.id}
                className={styles.field}
                data-span={field.span ?? 1}
                data-state={hit?.state}
                onPointerEnter={() => hit && setHovered(field.id)}
                onPointerLeave={() =>
                  setHovered((current) =>
                    current === field.id && document.activeElement !== inputsRef.current[field.id] ? null : current,
                  )
                }
              >
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor={id}>{field.label}</label>
                  <span className={styles.badgeSlot} aria-hidden="true">
                    <AnimatePresence initial={false}>
                      {badge ? (
                        <motion.span
                          key={badge.key}
                          className={styles.badge}
                          data-tone={badge.tone}
                          title={hit ? `Confidence ${confidence}%` : undefined}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, transition: easeIn }}
                          exit={{ opacity: 0, transition: easeOut }}
                        >
                          <span className={styles.dot} />
                          {badge.label}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </span>
                </div>
                <div className={styles.control} data-company={field.kind === "company" || undefined}>
                  {field.kind === "company" ? (
                    <span className={styles.logo} aria-hidden="true">
                      <AnimatePresence initial={false}>
                        <motion.span
                          key={logo ? value.trim().toLowerCase() : "none"}
                          className={styles.logoItem}
                          data-empty={!logo || undefined}
                          initial={{ opacity: 0, scale: reduced ? 1 : 0.9 }}
                          animate={{ opacity: 1, scale: 1, transition: easeIn }}
                          exit={{ opacity: 0, transition: easeOut }}
                        >
                          {logo ?? <Building2 size={16} strokeWidth={1.75} />}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  ) : null}
                  <input
                    ref={(node) => {
                      inputsRef.current[field.id] = node;
                    }}
                    id={id}
                    className={styles.input}
                    type={
                      field.kind === "email" ? "email" : field.kind === "tel" ? "tel" : field.kind === "url" ? "url" : "text"
                    }
                    inputMode={field.kind === "tel" ? "tel" : field.kind === "email" ? "email" : undefined}
                    autoComplete={field.autoComplete}
                    placeholder={field.placeholder}
                    value={value}
                    data-flash={flash ? (flash % 2 ? "a" : "b") : undefined}
                    aria-invalid={hit?.state === "review" || undefined}
                    aria-description={
                      hit
                        ? hit.state === "review"
                          ? `Filled by AI with ${confidence}% confidence, needs review${hit.note ? `: ${hit.note}` : ""}`
                          : hit.state === "edited"
                            ? "Edited after filling"
                            : `Filled by AI with ${confidence}% confidence`
                        : undefined
                    }
                    onChange={(event) => {
                      const next = event.target.value;
                      commit({ ...valuesRef.current, [field.id]: next });
                      if (filledRef.current[field.id] && filledRef.current[field.id].state !== "edited") {
                        setFilled((current) => ({
                          ...current,
                          [field.id]: { ...current[field.id], state: "edited" },
                        }));
                      }
                    }}
                    onFocus={() => hit && setHovered(field.id)}
                    onBlur={() => setHovered((current) => (current === field.id ? null : current))}
                  />
                  <AnimatePresence initial={false}>
                    {hit?.state === "review" ? (
                      <motion.button
                        key="confirm"
                        type="button"
                        className={styles.confirm}
                        onClick={() => confirm(field.id)}
                        aria-label={`Mark ${field.label.toLowerCase()} as correct`}
                        title="Looks right"
                        initial={{ opacity: 0, scale: reduced ? 1 : 0.9 }}
                        animate={{ opacity: 1, scale: 1, transition: easeIn }}
                        exit={{ opacity: 0, scale: reduced ? 1 : 0.9, transition: easeOut }}
                        whileTap={reduced ? undefined : { scale: 0.92 }}
                      >
                        <Check size={14} strokeWidth={2} aria-hidden="true" />
                      </motion.button>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <footer className={styles.foot}>
        <p className={styles.status} data-tone={shown.tone}>
          <Swap id={shown.text} className={styles.statusSwap}>
            {ShownIcon ? <ShownIcon size={14} className={styles.statusIcon} aria-hidden="true" /> : null}
            <span className={styles.statusText}>{shown.text}</span>
          </Swap>
        </p>
        <span className={styles.srOnly} role="status" aria-live="polite">
          {[status.text, status.sr].filter(Boolean).join(" ")}
        </span>
        <div className={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={!snapshot || busy}
            className={styles.footButton}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Undo
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void submit()}
            loading={saving}
            disabled={busy}
            className={styles.footButton}
          >
            {submitLabel}
          </Button>
        </div>
      </footer>
    </div>
  );
}

export default SmartFormFill;

/** Unused type helper kept out of the public surface. */
export type SmartFormFillRootStyle = CSSProperties;
