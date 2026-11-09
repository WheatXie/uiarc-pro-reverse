"use client";

import * as React from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Link2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Square,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import { writeClipboard } from "../lib/use-copy-feedback";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import { Tooltip } from "../tooltip/tooltip";
import { HoverCard } from "../hover-card/hover-card";
import { CopyButton } from "../copy-button/copy-button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover/popover";
import styles from "./ai-answer.module.css";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

export interface Source {
  id: string;
  title: string;
  site: string;
  domain: string;
  url: string;
  date: string;
  icon?: string;
  snippet?: string;
}

interface BrandIcon {
  viewBox: string;
  fill?: string;
  color?: string;
  paths: { fill?: string; d: string }[];
}

export type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "table"; columns: string[]; rows: string[][] }
  | { type: "code"; language?: string; filename?: string; code: string };

interface SampleTurn {
  question: string;
  thought: number;
  reasoning: string;
  sources: string[];
  blocks: Block[];
  altLead: string;
  extra: Block[];
}

export interface Model {
  id: string;
  name: string;
  mark: string;
}

type Mode = "answer" | "retry" | "concise" | "detailed" | "model";
type Status = "thinking" | "writing" | "done" | "stopped" | "error";
type FeedbackValue = "up" | "down";

export type RespondEvent =
  | { type: "reasoning"; text: string }
  | { type: "sources"; sources: Source[] }
  | { type: "thought"; seconds: number }
  | { type: "text"; text: string }
  | { type: "done"; tokens?: number; seconds?: number; followUps?: string[] };

export interface RespondArgs {
  question: string;
  mode: Mode;
  model: Model;
  previous?: string;
  signal: AbortSignal;
}

export type Responder = (args: RespondArgs) => AsyncGenerator<RespondEvent, void, unknown>;

interface Version {
  id: number;
  /* Increments every time the stream is (re)started, so a StrictMode remount cannot splice a
     stale run's events into the fresh one. */
  run?: number;
  mode: Mode;
  model: Model;
  status: Status;
  reasoning: string;
  sources: Source[];
  text: string;
  started: number;
  firstText?: number;
  ended?: number;
  thought?: number;
  tokens?: number;
  seconds?: number;
  error?: string;
  instant?: boolean;
  feedback?: FeedbackValue;
}

interface Turn {
  id: number;
  question: string;
  versions: Version[];
  index: number;
  followUps: string[];
}

export interface AiAnswerProps {
  models?: Model[];
  respond?: Responder;
  suggestions?: string[];
  title?: string;
  onFeedback?: (payload: {
    value: FeedbackValue | null;
    reason?: string;
    question: string;
    answer: string;
    model: Model;
    version: number;
  }) => void;
  onFollowUp?: (question: string) => void;
  onShare?: (payload: { question: string; answer: string; version?: number }) => string | Promise<string>;
  className?: string;
  model?: Model;
  question?: string;
  answer?: string;
  reasoning?: string;
  sources?: Source[];
  usage?: { tokens?: number; seconds?: number; thoughtSeconds?: number };
  followUps?: string[];
}

/* -------------------------------------------------------------------------------------------------
 * Sample data
 * -----------------------------------------------------------------------------------------------*/

const BRAND_ICONS: Record<string, BrandIcon> = {
  "Claude": {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    color: "#D97757",
    paths: [
      { d: "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" },
    ],
  },
  "Google": {
    viewBox: "0 0 48 48",
    
    paths: [
      { fill: "#EA4335", d: "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" },
      { fill: "#4285F4", d: "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" },
      { fill: "#FBBC05", d: "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" },
      { fill: "#34A853", d: "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" },
    ],
  },
  "MDN Web Docs": {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    paths: [
      { d: "m21.538 1.1-6.745 21.8h-2.77L18.77 1.1ZM24 1.1v21.8h-2.462V1.1Zm-12 0v21.8H9.538V1.1Zm-2.462 0L2.77 22.9H0L6.746 1.1Z" },
    ],
  },
  "Apple": {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    paths: [
      { d: "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" },
    ],
  },
  "GitHub": {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    paths: [
      { d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" },
    ],
  },
  "1Password": {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    color: "#145FE4",
    paths: [
      { d: "M12 0c6.627 0 12 5.373 12 12 0 6.628-5.373 12-12 12S0 18.628 0 12C0 5.373 5.373 0 12 0m-.893 4.86c-.485 0-.727.001-.913.095a.87.87 0 0 0-.378.379c-.094.185-.095.428-.095.912v2.747c0 .12 0 .182.016.238q.02.075.065.138a1 1 0 0 0 .175.162l.695.564c.113.092.17.139.19.194a.22.22 0 0 1 0 .15c-.02.056-.077.102-.19.194l-.695.564a1 1 0 0 0-.175.162.4.4 0 0 0-.065.138 1 1 0 0 0-.016.238v6.019c0 .485 0 .728.095.913a.87.87 0 0 0 .378.378c.186.094.428.094.913.094h1.786c.485 0 .727 0 .913-.094a.87.87 0 0 0 .378-.378c.095-.185.095-.428.095-.913v-2.747c0-.12 0-.182-.016-.238a.4.4 0 0 0-.065-.138 1 1 0 0 0-.175-.162l-.695-.564c-.113-.092-.17-.138-.191-.193a.22.22 0 0 1 0-.152c.02-.055.078-.1.19-.193l.696-.564a1 1 0 0 0 .175-.162.4.4 0 0 0 .065-.138 1 1 0 0 0 .016-.238V6.246c0-.484 0-.727-.095-.912a.87.87 0 0 0-.378-.379c-.186-.094-.428-.094-.913-.094Z" },
    ],
  },
  "Okta": {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    color: "#007DC1",
    paths: [
      { d: "M12 0C5.389 0 0 5.35 0 12s5.35 12 12 12 12-5.35 12-12S18.611 0 12 0zm0 18c-3.325 0-6-2.675-6-6s2.675-6 6-6 6 2.675 6 6-2.675 6-6 6z" },
    ],
  },
  "Auth0": {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    color: "#EB5424",
    paths: [
      { d: "M21.98 7.448L19.62 0H4.347L2.02 7.448c-1.352 4.312.03 9.206 3.815 12.015L12.007 24l6.157-4.552c3.755-2.81 5.182-7.688 3.815-12.015l-6.16 4.58 2.343 7.45-6.157-4.597-6.158 4.58 2.358-7.433-6.188-4.55 7.63-.045L12.008 0l2.356 7.404 7.615.044z" },
    ],
  },
  "Wikipedia": {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    paths: [
      { d: "M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z" },
    ],
  },
};

const SAMPLE_SOURCES: Source[] = [
  { id: "webdev", title: "Sign in with a passkey through form autofill", site: "web.dev", domain: "web.dev", url: "https://web.dev/articles/passkey-form-autofill", date: "Sep 24, 2026", icon: "Google", snippet: "Conditional mediation lists passkeys in the browser's autofill menu next to saved passwords, when the username field has autocomplete=\"username webauthn\"." },
  { id: "mdn", title: "Web Authentication API", site: "MDN Web Docs", domain: "developer.mozilla.org", url: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API", date: "Oct 2, 2026", icon: "MDN Web Docs", snippet: "Reference for navigator.credentials.create() and get(), the options they take, and the public key credential your server verifies." },
  { id: "apple", title: "Passkeys", site: "Apple Developer", domain: "developer.apple.com", url: "https://developer.apple.com/passkeys/", date: "Sep 15, 2026", icon: "Apple", snippet: "Passkeys sync through iCloud Keychain with end-to-end encryption, so they are ready on a person's other Apple devices." },
  { id: "github", title: "About passkeys", site: "GitHub Docs", domain: "docs.github.com", url: "https://docs.github.com/en/authentication/authenticating-with-a-passkey/about-passkeys", date: "Aug 28, 2026", icon: "GitHub", snippet: "Passkeys sit next to a password and two-factor authentication, and can be reviewed, renamed or removed from account settings." },
  { id: "onepassword", title: "Save and sign in with passkeys", site: "1Password", domain: "1password.com", url: "https://1password.com/product/passkeys", date: "Sep 9, 2026", icon: "1Password", snippet: "Passkeys saved in a password manager sync to a person's other devices and browsers, alongside their passwords." },
  { id: "okta", title: "Configure the FIDO2 (WebAuthn) authenticator", site: "Okta", domain: "help.okta.com", url: "https://help.okta.com/oie/en-us/content/topics/identity-engine/authenticators/configure-webauthn.htm", date: "Jul 30, 2026", icon: "Okta", snippet: "Admins can require specific authenticator types, such as hardware security keys, in sign-in policies for chosen groups." },
  { id: "auth0", title: "Passkeys", site: "Auth0 Docs", domain: "auth0.com", url: "https://auth0.com/docs/authenticate/database-connections/passkeys", date: "Sep 3, 2026", icon: "Auth0", snippet: "Progressive enrollment offers a passkey after a successful sign-in, while password sign-in stays available." },
  { id: "wikipedia", title: "WebAuthn", site: "Wikipedia", domain: "en.wikipedia.org", url: "https://en.wikipedia.org/wiki/WebAuthn", date: "Oct 11, 2026", icon: "Wikipedia", snippet: "WebAuthn is a W3C standard, part of FIDO2, for signing in with public key cryptography instead of a shared secret." },
];

const SAMPLE_MODELS: Model[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", mark: "Claude" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", mark: "Claude" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", mark: "Claude" },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1", mark: "Claude" },
];

const SAMPLE_TURNS: SampleTurn[] = [
  {
    question: "How do we roll out passkeys without locking anyone out?",
    thought: 9,
    reasoning: "The risk in a passkey rollout is rarely the passkey itself. It is removing the old way in before people have a reliable new one, so the plan should be additive: passkeys next to passwords, created right after a verified sign-in, offered through autofill so nobody has to find a new button.\n\nTwo places can strand an account: a device-bound passkey with no backup, and turning passwords off too early. I'll stage the rollout, compare synced and device-bound passkeys, and show the autofill call.",
    sources: ["webdev", "mdn", "onepassword", "apple", "auth0", "github", "okta", "wikipedia"],
    blocks: [{"type":"paragraph","text":"Add passkeys next to your current sign-in instead of replacing it. Offer one right after someone has proven who they are, which is how progressive enrollment works in most identity platforms. [5] Let the browser surface passkeys through autofill, so nobody has to learn a new button. [1] Only make passwords optional once an account has a reliable second way in."},{"type":"heading","text":"Roll it out in four stages"},{"type":"list","ordered":true,"items":["**Offer, don't force.** Prompt for a passkey after a successful sign-in or password reset, while the session is fresh. Keep passwords and existing two-factor methods working. [6]","**Sign in through autofill.** Request credentials with `mediation: \"conditional\"` so saved passkeys appear in the username field's suggestions. [1][2] People without one simply see their passwords.","**Make them manageable.** List each passkey in account settings with where it was created and when it was last used, and let people add a backup or remove a lost device. [6]","**Retire passwords last.** Offer to remove a password only when the account has a synced passkey or two registered credentials. [4] Keep a recovery path through a verified email or support."]},{"type":"heading","text":"Synced or device-bound"},{"type":"paragraph","text":"Passkeys are WebAuthn credentials, and they come in two kinds. [8] Most people will create synced passkeys, stored in their platform account or password manager. [3][4] Policies can still require device-bound keys for high-risk accounts. [7]"},{"type":"table","columns":["","Synced","Device-bound"],"rows":[["Stored in","Platform account or password manager","One security key or device"],["Lost phone","Restores on the next device","Needs a registered backup"],["Best for","Most customer and staff accounts","Admins and high-risk roles"],["Attestation","Usually not available","Available for policy checks"]]},{"type":"heading","text":"Turn on autofill sign-in"},{"type":"paragraph","text":"Mark the username field with `autocomplete=\"username webauthn\"`, then start a conditional request when the page loads. [1]"},{"type":"code","language":"js","filename":"sign-in.js","code":"// Passkeys appear in the username field's autofill menu.\nif (await PublicKeyCredential.isConditionalMediationAvailable?.()) {\n  const credential = await navigator.credentials.get({\n    mediation: \"conditional\",\n    publicKey: { challenge, rpId: \"example.com\", userVerification: \"preferred\" },\n  });\n  await verifyOnServer(credential);\n}"},{"type":"paragraph","text":"Before each stage, watch passkey sign-in success and recovery requests. If recovery requests rise, pause and fix the flow before moving on."}],
    altLead: "Treat passkeys as an extra way in until the numbers say otherwise. Enroll people right after a verified sign-in, where most identity platforms already prompt. [5] Surface passkeys in the username autofill menu so the sign-in page barely changes. [1] Keep passwords working until an account has a second reliable credential.",
    extra: [{"type":"heading","text":"Communicate each stage"},{"type":"list","items":["Explain the benefit in one line at the prompt: faster sign-in, nothing to remember.","Tell people where their passkey is saved, such as their phone or password manager. [3]","Send a notice to every verified email when a passkey is added or removed. [6]"]}],
  },
  {
    question: "How should account recovery work once passwords are optional?",
    thought: 6,
    reasoning: "Recovery is where passkey rollouts tend to fail, because the fallback becomes the weakest way in. The answer should keep recovery as strong as sign-in: verified channels, a short delay for risky changes, and a fresh passkey at the end instead of a temporary password.",
    sources: ["github", "apple", "okta", "auth0"],
    blocks: [{"type":"paragraph","text":"Recovery should be as hard to abuse as sign-in, or attackers will go through it instead. Most people never need it, because synced passkeys come back with their platform account on a new device. [2]"},{"type":"heading","text":"A recovery flow that holds up"},{"type":"list","ordered":true,"items":["**Start with what still works.** Offer a second passkey or a security key first, then a link to a verified email.","**Delay risky changes.** Hold a passkey added through recovery for a few hours and notify every verified channel, so the owner can cancel.","**Give admins a reset, not a bypass.** In workforce tools, an admin clears the credentials and the person enrolls again at next sign-in. [3]","**Offer recovery codes to people who want them.** Show them once, store only hashes, and let people generate a new set. [1]"]},{"type":"paragraph","text":"End every recovery with a new passkey, so the person leaves with a working credential instead of a temporary password. [4]"}],
    altLead: "Design recovery as a second sign-in path with the same strength as the first. People with synced passkeys rarely need it, since their passkeys return with their platform account. [2]",
    extra: [{"type":"heading","text":"What to log"},{"type":"list","items":["Every recovery attempt, its channel and its result.","Passkeys added within a day of a recovery, flagged for review.","Support resets, with the agent and the reason."]}],
  },
  {
    question: "What should we measure before each rollout stage?",
    thought: 7,
    reasoning: "Enrollment alone is a vanity number here. The useful signals show whether people actually get in with a passkey, whether they fall back to passwords, and whether recovery load moves. A small table of signals plus explicit gates between stages answers it.",
    sources: ["webdev", "mdn", "auth0"],
    blocks: [{"type":"paragraph","text":"Measure whether people get in, not just whether they enroll. A rising enrollment number can hide people who fall back to passwords or get stuck in recovery."},{"type":"heading","text":"Signals to track"},{"type":"table","columns":["Signal","What it tells you","Healthy trend"],"rows":[["Enrollment","Active accounts with a passkey","Rising weekly"],["Passkey success","Passkey attempts that complete","Above password success"],["Fallbacks","Passkey offered, password used","Falling"],["Recovery","Lockouts per 1,000 sign-ins","Flat or falling"]]},{"type":"paragraph","text":"Record the credential type on every sign-in event. The returned credential's `authenticatorAttachment` tells you whether the passkey came from this device or another one. [2]"},{"type":"code","language":"js","filename":"track-sign-in.js","code":"// One event per passkey sign-in attempt\nanalytics.track(\"passkey_sign_in\", {\n  result: verified ? \"success\" : \"failed\",\n  attachment: credential.authenticatorAttachment, // \"platform\" or \"cross-platform\"\n  autofill: true,\n});"},{"type":"heading","text":"Gates between stages"},{"type":"list","ordered":true,"items":["Prompt everyone once passkey success holds steady for two weeks. [3]","Count a fallback whenever the autofill menu offered a passkey and a password was used instead. [1]","Make passwords optional only when recovery stays flat after the previous stage."]}],
    altLead: "Track outcomes at the sign-in page, not only enrollment. More passkeys created does not mean fewer people stuck.",
    extra: [{"type":"heading","text":"Segment the numbers"},{"type":"list","items":["Split by platform and browser, since autofill support differs between them. [1]","Compare new and long-standing accounts, which recover in different ways."]}],
  },
  {
    question: "How do people sign in on a device without their passkey?",
    thought: 5,
    reasoning: "Someone on a borrowed laptop or a new work machine still needs a way in. Cross-device sign-in covers most of it, security keys cover the rest, and the password path stays as a fallback while it exists.",
    sources: ["apple", "webdev", "mdn", "wikipedia"],
    blocks: [{"type":"paragraph","text":"They can use the passkey on their phone. The browser shows a QR code, the phone scans it, and a Bluetooth proximity check confirms the two devices are near each other. [1] Nothing is installed on the borrowed device."},{"type":"heading","text":"What to support"},{"type":"list","ordered":true,"items":["**Cross-device sign-in.** Browsers offer it when you call WebAuthn normally, so there is no extra code to write. [3]","**Security keys.** USB and NFC keys work on any device with a matching port or reader. [4]","**Your existing fallback.** Until passwords are optional, the password and two-factor path stays available."]},{"type":"paragraph","text":"After a cross-device sign-in on a device the person owns, offer to create a passkey there, so the next sign-in is one step. [2]"}],
    altLead: "Their phone can stand in for the missing passkey. The browser shows a QR code, the phone scans it and confirms it is nearby over Bluetooth. [1]",
    extra: [{"type":"heading","text":"Shared and public devices"},{"type":"list","items":["Do not offer to save a passkey on a device marked as shared.","Keep cross-device sessions short and sign out on close."]}],
  },
];

const SAMPLE_SOURCE_BY_ID: Record<string, Source> = Object.fromEntries(
  SAMPLE_SOURCES.map((source) => [source.id, source]),
);

const TURNS = SAMPLE_TURNS.map((turn) => ({
  ...turn,
  sources: turn.sources.map((id) => SAMPLE_SOURCE_BY_ID[id]).filter(Boolean),
}));

const SAMPLE_QUESTION = TURNS[0].question;
const SAMPLE_FOLLOW_UPS = TURNS.slice(1).map((turn) => turn.question);
const MODEL_SPEED: Record<string, { tps: number; think: number }> = {
  "claude-fable-5-1": { tps: 42, think: 1.4 },
  "claude-opus-5-5": { tps: 58, think: 1 },
  "claude-sonnet-5-5": { tps: 76, think: 0.8 },
  "claude-haiku-5-5": { tps: 150, think: 0.45 },
};

const FALLBACK_BLOCKS: Block[] = [
  {
    type: "paragraph",
    text: "This preview answers four sample questions about passkeys. Pass a `respond` function to stream answers from a real model for anything else.",
  },
];

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

const cx = (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(" ");

const cellEscape = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ");

function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return block.text;
        case "heading":
          return `### ${block.text}`;
        case "list":
          return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${item}`).join("\n");
        case "table":
          return [
            `| ${block.columns.map(cellEscape).join(" | ")} |`,
            `| ${block.columns.map(() => "---").join(" | ")} |`,
            ...block.rows.map((row) => `| ${row.map(cellEscape).join(" | ")} |`),
          ].join("\n");
        case "code":
          return `\`\`\`${block.language ?? ""}${block.filename ? ` ${block.filename}` : ""}\n${block.code}\n\`\`\``;
      }
    })
    .join("\n\n");
}

const followUpsFor = (question: string) =>
  TURNS.filter((turn) => turn.question !== question)
    .slice(0, 3)
    .map((turn) => turn.question);

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = window.setTimeout(done, ms);
    function done() {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });

/** Splits text into chunks of two-ish words, so a stream lands at a readable cadence instead of one letter at a time. */
function chunkText(text: string, [min, max]: [number, number]): string[] {
  const words = text.split(/(\s+)/).filter(Boolean);
  const chunks: string[] = [];
  let index = 0;
  while (index < words.length) {
    const size = 2 * (min + Math.floor(Math.random() * (max - min + 1)));
    chunks.push(words.slice(index, index + size).join(""));
    index += size;
  }
  return chunks;
}

type Unit =
  | { kind: "word"; text: string; i: number; s: number; space: boolean; bold?: boolean }
  | { kind: "code"; text: string; i: number; s: number; space: boolean }
  | { kind: "cite"; n: number; i: number; s: number; space: boolean };

type UnitInit =
  | { kind: "word"; text: string; bold?: boolean }
  | { kind: "code"; text: string }
  | { kind: "cite"; n: number };

interface UnitState {
  i: number;
  s: number;
  cites: Map<number, Set<number>>;
  weights: number[];
}

/** Tokenizes one run of inline markdown into words, inline code and citations, tracking sentence breaks and citation coverage. */
function unitize(input: string, state: UnitState, fresh = true): Unit[] {
  const units: Unit[] = [];
  const text = input.replace(/\\([\\`*_[\]|])/g, "$1");
  let index = 0;
  let space = false;
  const push = (unit: UnitInit) => {
    const position = state.i;
    if (fresh) state.weights[position] = 1;
    else if (state.weights[position] === undefined) state.weights[position] = 1;
    state.i += 1;
    const next = { ...unit, i: position, s: state.s, space } as Unit;
    units.push(next);
    space = false;
    if (next.kind === "word" && /[.!?]["”)]?$/.test(next.text)) state.s += 1;
    return next;
  };

  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      space = true;
      index += 1;
      continue;
    }
    if (char === "`") {
      const end = text.indexOf("`", index + 1);
      const close = end === -1 ? text.length : end;
      push({ kind: "code", text: text.slice(index + 1, close) });
      index = close + 1;
      continue;
    }
    if (char === "*" && text[index + 1] === "*") {
      const end = text.indexOf("**", index + 2);
      const close = end === -1 ? text.length : end;
      const inner = text.slice(index + 2, close);
      inner
        .split(/\s+/)
        .filter(Boolean)
        .forEach((word, wordIndex) => {
          if (wordIndex > 0) space = true;
          push({ kind: "word", text: word, bold: true });
        });
      index = close + 2;
      continue;
    }
    const cite = /^\[(\d{1,2})\]/.exec(text.slice(index));
    if (cite) {
      const n = Number(cite[1]);
      const unit = push({ kind: "cite", n });
      const set = state.cites.get(state.s) ?? new Set<number>();
      set.add(n);
      state.cites.set(unit.s, set);
      index += cite[0].length;
      continue;
    }
    const word = /^[^\s`*[]+(\*\*)?/.exec(text.slice(index));
    if (word) {
      push({ kind: "word", text: word[0] });
      index += word[0].length;
      continue;
    }
    push({ kind: "word", text: char });
    index += 1;
  }
  return units;
}

const splitRow = (line: string) =>
  line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));

const isSeparatorRow = (line: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

type ParsedBlock =
  | { kind: "p" | "h"; units: Unit[] }
  | { kind: "ol" | "ul"; items: Unit[][] }
  | { kind: "table"; header: Unit[][]; headerIndex: number; rows: { i: number; cells: Unit[][] }[] }
  | { kind: "code"; language: string; filename: string; source: string; lines: { i: number; text: string }[] };

interface Parsed {
  blocks: ParsedBlock[];
  total: number;
  weights: number[];
  cites: Map<number, Set<number>>;
}

/** Parses the answer markdown. While the reply is still streaming, a half-written trailing line is dropped so nothing flickers. */
function parseMarkdown(markdown: string, live = false): Parsed {
  let text = markdown;
  if (live) {
    const cut = Math.max(text.lastIndexOf(" "), text.lastIndexOf("\n"));
    text = cut === -1 ? "" : text.slice(0, cut + 1);
    const lineStart = text.lastIndexOf("\n");
    const tail = text.slice(lineStart + 1);
    const openFence = (text.slice(0, lineStart + 1).match(/^\s*```/gm) ?? []).length % 2 === 1;
    if (
      /^\s*\|/.test(tail) ||
      /^\s*(#{1,6}|[-*+]|\d+[.)]|`{1,3}\S*)\s*$/.test(tail) ||
      openFence
    )
      text = text.slice(0, lineStart + 1);
  }

  const state: UnitState = { i: 0, s: 0, cites: new Map(), weights: [] };
  const blocks: ParsedBlock[] = [];
  const lines = text.split("\n");
  let list: { kind: "ol" | "ul"; items: Unit[][] } | null = null;
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "p", units: unitize(paragraph.join(" "), state) });
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    const fence = /^```(\S*)\s*(.*)$/.exec(line);
    if (fence) {
      flushParagraph();
      list = null;
      const body: string[] = [];
      for (index += 1; index < lines.length && !/^\s*```/.test(lines[index]); ) body.push(lines[index++]);
      const visible = index < lines.length || !live ? body : body.slice(0, -1);
      const block: ParsedBlock = {
        kind: "code",
        language: fence[1],
        filename: fence[2],
        source: body.join("\n"),
        lines: [],
      };
      for (const codeLine of visible) {
        const position = state.i++;
        state.weights[position] = 2.4;
        block.lines.push({ i: position, text: codeLine });
      }
      blocks.push(block);
      continue;
    }
    if (!line) {
      flushParagraph();
      list = null;
      continue;
    }
    if (line.startsWith("|")) {
      flushParagraph();
      list = null;
      const header = splitRow(line);
      const headerIndex = state.i++;
      state.weights[headerIndex] = 2.4;
      const block: ParsedBlock = {
        kind: "table",
        header: header.map((cell) => unitize(cell, state, false)),
        headerIndex,
        rows: [],
      };
      while (index + 1 < lines.length && lines[index + 1].trim().startsWith("|")) {
        index += 1;
        if (isSeparatorRow(lines[index])) continue;
        const position = state.i++;
        state.weights[position] = 3.2;
        block.rows.push({
          i: position,
          cells: splitRow(lines[index]).map((cell) => unitize(cell, state, false)),
        });
      }
      blocks.push(block);
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const kind = bullet ? "ul" : "ol";
      if (!list || list.kind !== kind) {
        list = { kind, items: [] };
        blocks.push(list);
      }
      list.items.push(unitize((bullet ?? numbered)![1], state));
      continue;
    }
    if (heading) {
      flushParagraph();
      list = null;
      blocks.push({ kind: "h", units: unitize(heading[1], state) });
      continue;
    }
    if (list && raw.startsWith("  ")) {
      const items = list.items;
      items[items.length - 1] = [...items[items.length - 1], ...unitize(line, state)];
      continue;
    }
    list = null;
    paragraph.push(line);
  }
  flushParagraph();
  return { blocks, total: state.i, weights: state.weights, cites: state.cites };
}

const blockStart = (block: ParsedBlock): number => {
  switch (block.kind) {
    case "p":
    case "h":
      return block.units[0]?.i ?? Infinity;
    case "ol":
    case "ul":
      return block.items[0]?.[0]?.i ?? Infinity;
    case "table":
      return block.headerIndex;
    case "code":
      return block.lines[0]?.i ?? Infinity;
  }
};

/** The default responder keeps every answer local: it replays a canned turn on a token-ish clock so the stream looks live. */
const FALLBACK_REASONING =
  "The question is outside the sample script, so the preview explains how to connect a model.";

async function* defaultRespond({
  question,
  mode,
  model,
  previous,
  signal,
}: RespondArgs): AsyncGenerator<RespondEvent> {
  const key = question.trim().toLowerCase();
  const turn = TURNS.find((entry) => entry.question.trim().toLowerCase() === key);
  const speed = MODEL_SPEED[model.id] ?? MODEL_SPEED["claude-opus-5-5"];
  const reasoning = turn?.reasoning ?? FALLBACK_REASONING;

  const reasonChunks = chunkText(reasoning, [4, 8]);
  const reasonStep = Math.max(16, 900 / reasonChunks.length);
  const sourceAt = Math.floor(0.4 * reasonChunks.length);

  for (let index = 0; index < reasonChunks.length; index += 1) {
    if (signal.aborted) return;
    yield { type: "reasoning", text: reasonChunks[index] };
    if (turn && index === sourceAt) yield { type: "sources", sources: turn.sources };
    await wait(reasonStep * (0.7 + 0.6 * Math.random()), signal);
  }
  await wait(90, signal);

  const thought = Math.max(
    1,
    Math.round((turn?.thought ?? 2) * speed.think * (mode === "concise" ? 0.7 : mode === "detailed" ? 1.25 : 1)),
  );
  yield { type: "thought", seconds: thought };

  let chosen: Block[] = turn?.blocks ?? FALLBACK_BLOCKS;
  if (turn && mode === "concise") {
    const firstParagraph = turn.blocks.find((block) => block.type === "paragraph");
    const listIndex = turn.blocks.findIndex((block) => block.type === "list");
    const heading = listIndex > 0 && turn.blocks[listIndex - 1].type === "heading" ? turn.blocks[listIndex - 1] : undefined;
    chosen = [firstParagraph, heading, turn.blocks[listIndex]].filter((block): block is Block => !!block);
  } else if (turn && mode === "detailed") {
    chosen = [...turn.blocks, ...turn.extra];
  } else if (turn && (mode === "retry" || mode === "model")) {
    const lead = previous?.startsWith(turn.altLead.slice(0, 40)) ? turn.blocks[0] : { type: "paragraph" as const, text: turn.altLead };
    chosen = [lead, ...turn.blocks.slice(1)];
  }

  const markdown = blocksToMarkdown(chosen);
  for (const chunk of chunkText(markdown, [3, 6])) {
    if (signal.aborted) return;
    yield { type: "text", text: chunk };
    await wait(30 + 10 * Math.random(), signal);
  }
  if (signal.aborted) return;

  const words = Math.round(markdown.length / 3.7);
  yield {
    type: "done",
    tokens: words + Math.round(reasoning.length / 3.7),
    seconds: Math.round((thought + words / speed.tps) * 10) / 10,
    followUps: followUpsFor(turn?.question ?? question),
  };
}

/* -------------------------------------------------------------------------------------------------
 * State
 * -----------------------------------------------------------------------------------------------*/

const isBusyStatus = (status: Status) => status === "thinking" || status === "writing";

const patchVersion = (turn: Turn, id: number, patch: (version: Version) => Version): Turn => ({
  ...turn,
  versions: turn.versions.map((version) => (version.id === id ? patch(version) : version)),
});

type Action =
  | { type: "turn"; turn: Turn | null }
  | { type: "version"; version: Version }
  | { type: "reset"; id: number; run: number; now: number }
  | { type: "select"; index: number }
  | { type: "feedback"; id: number; value?: FeedbackValue }
  | { type: "end"; id: number; run: number; status: Status; error?: string; now: number }
  | { type: "event"; id: number; run: number; event: RespondEvent; now: number };

function reducer(state: Turn | null, action: Action): Turn | null {
  if (action.type === "turn") return action.turn;
  if (!state) return state;
  switch (action.type) {
    case "version":
      return { ...state, versions: [...state.versions, action.version], index: state.versions.length };
    case "reset":
      return patchVersion(state, action.id, (version) => ({
        ...version,
        run: action.run,
        status: "thinking",
        reasoning: "",
        sources: [],
        text: "",
        started: action.now,
        firstText: undefined,
        ended: undefined,
        thought: undefined,
        error: undefined,
      }));
    case "select":
      return { ...state, index: Math.max(0, Math.min(state.versions.length - 1, action.index)) };
    case "feedback":
      return patchVersion(state, action.id, (version) => ({ ...version, feedback: action.value }));
    case "end":
      return patchVersion(state, action.id, (version) =>
        version.run === action.run && isBusyStatus(version.status)
          ? { ...version, status: action.status, error: action.error, ended: action.now }
          : version,
      );
    case "event": {
      const { event, now } = action;
      if (
        !state.versions.some(
          (version) => version.id === action.id && version.run === action.run && isBusyStatus(version.status),
        )
      )
        return state;
      let next = state;
      if (event.type === "done" && event.followUps?.length) next = { ...next, followUps: event.followUps };
      return patchVersion(next, action.id, (version) => {
        switch (event.type) {
          case "reasoning":
            return { ...version, reasoning: version.reasoning + event.text };
          case "sources":
            return { ...version, sources: event.sources };
          case "thought":
            return { ...version, thought: event.seconds };
          case "text":
            return {
              ...version,
              text: version.text + event.text,
              status: "writing",
              firstText: version.firstText ?? now,
            };
          case "done":
            return {
              ...version,
              status: "done",
              ended: now,
              tokens: event.tokens ?? version.tokens,
              thought:
                version.thought ??
                (version.firstText
                  ? Math.max(1, Math.round((version.firstText - version.started) / 1e3))
                  : undefined),
              seconds: event.seconds ?? Math.round((now - version.started) / 100) / 10,
            };
        }
      });
    }
  }
}

let sequence = 0;
const nextId = () => {
  sequence += 1;
  return sequence;
};
const subscribeNothing = () => () => {};

function initTurn(props: AiAnswerProps, model: Model): Turn | null {
  const question = props.question ?? (props.answer ? "" : SAMPLE_QUESTION);
  if (!question.trim() && !props.answer) return null;
  const followUps = props.followUps ?? (props.respond ? [] : followUpsFor(question));
  const now = Date.now();
  const version: Version = props.answer
    ? {
        id: nextId(),
        mode: "answer",
        model,
        status: "done",
        reasoning: props.reasoning ?? "",
        sources: props.sources ?? [],
        text: blocksToMarkdown([{ type: "paragraph", text: props.answer }]),
        started: now,
        ended: now,
        thought: props.usage?.thoughtSeconds,
        tokens: props.usage?.tokens,
        seconds: props.usage?.seconds,
        instant: true,
      }
    : {
        id: nextId(),
        mode: "answer",
        model,
        status: "thinking",
        reasoning: "",
        sources: [],
        text: "",
        started: now,
      };
  return { id: nextId(), question, versions: [version], index: 0, followUps };
}

/* -------------------------------------------------------------------------------------------------
 * Motion presets
 * -----------------------------------------------------------------------------------------------*/

const { spring: springTokens, duration: durationTokens, ease: easeTokens, stagger } = motionTokens;
const enterEase = [...easeTokens.enter] as [number, number, number, number];
const standardEase = [...easeTokens.standard] as [number, number, number, number];
const snappy = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;

/* -------------------------------------------------------------------------------------------------
 * Small pieces
 * -----------------------------------------------------------------------------------------------*/

function BrandIconView({ name, icon }: { name: string; icon: BrandIcon }) {
  return (
    <svg
      viewBox={icon.viewBox}
      fill={icon.fill}
      role="img"
      aria-label={name}
      aria-hidden="true"
      style={icon.color ? { color: icon.color } : undefined}
    >
      {icon.paths.map((path, index) => (
        <path key={index} d={path.d} fill={path.fill} />
      ))}
    </svg>
  );
}

function Mark({ source, className }: { source: Source; className?: string }) {
  const icon = source.icon ? BRAND_ICONS[source.icon] : undefined;
  return (
    <span className={cx(styles.mark, className)} aria-hidden="true">
      {icon ? (
        <BrandIconView name={source.icon!} icon={icon} />
      ) : (
        <span className={styles.markLetter}>{source.domain.replace(/^www\./, "")[0]?.toUpperCase()}</span>
      )}
    </span>
  );
}

const IconButton = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<"button"> & { label: string }>(
  function IconButton({ label, className, children, ...props }, ref) {
    return (
      <button ref={ref} type="button" aria-label={label} className={cx(styles.iconButton, className)} {...props}>
        {children}
      </button>
    );
  },
);

function SwapIcon({ id, reduced, children }: { id: string; reduced: boolean; children: React.ReactNode }) {
  return (
    <span className={styles.swapIcon} aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapIconInner}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, scale: 0.85, transition: { duration: durationTokens.fast, ease: standardEase } }
          }
          transition={
            reduced
              ? { duration: durationTokens.instant }
              : {
                  scale: snappy,
                  opacity: { duration: durationTokens.standard, ease: enterEase },
                  filter: { duration: durationTokens.standard, ease: enterEase },
                }
          }
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function DrawnCheck({ reduced }: { reduced: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.drawnCheck}
    >
      <motion.path
        d="M4 12l5 5L20 6"
        initial={!reduced && { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.36, ease: standardEase, delay: 0.04 }}
      />
    </svg>
  );
}

function useCopyState(timeout = 1600) {
  const [state, setState] = React.useState<"idle" | "copied" | "error">("idle");
  const timer = React.useRef(0);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = React.useCallback(
    async (value: string | (() => string | Promise<string>)) => {
      window.clearTimeout(timer.current);
      let ok = false;
      try {
        const text = typeof value === "string" ? value : await value();
        await writeClipboard(text);
        ok = true;
      } catch {
        ok = false;
      }
      setState(ok ? "copied" : "error");
      timer.current = window.setTimeout(() => setState("idle"), timeout);
      return ok;
    },
    [timeout],
  );
  return { state, copy };
}

function CiteCard({ source, n }: { source: Source; n: number }) {
  return (
    <div className={styles.citeCard}>
      <div className={styles.citeCardSite}>
        <Mark source={source} className={styles.markSmall} />
        <span className={styles.truncate}>{source.site}</span>
        <span className={styles.citeCardNumber}>{n}</span>
      </div>
      <p className={styles.citeCardTitle}>{source.title}</p>
      {source.snippet ? <p className={styles.citeCardSnippet}>{source.snippet}</p> : null}
      <div className={styles.citeCardMeta}>
        <span className={styles.truncate}>{source.domain.replace(/^www\./, "")}</span>
        <span className={styles.dot} aria-hidden="true" />
        <span>{source.date}</span>
      </div>
    </div>
  );
}

interface Hot {
  n: number;
  s?: number;
}

function Cite({
  n,
  s,
  sources,
  hot,
  onHot,
}: {
  n: number;
  s: number;
  sources: Source[];
  hot: Hot | null;
  onHot: (value: Hot | null) => void;
}) {
  const source = sources[n - 1];
  if (!source) {
    return (
      <span className={styles.cite} data-missing="true">
        {n}
      </span>
    );
  }
  return (
    <HoverCard
      content={<CiteCard source={source} n={n} />}
      side="bottom"
      align="center"
      openDelay={220}
      closeDelay={140}
    >
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className={styles.cite}
        data-lit={hot?.n === n || undefined}
        aria-label={`Source ${n}: ${source.title}, ${source.site}`}
        onPointerEnter={() => onHot({ n, s })}
        onPointerLeave={() => onHot(null)}
        onFocus={() => onHot({ n, s })}
        onBlur={() => onHot(null)}
      >
        {n}
      </a>
    </HoverCard>
  );
}

function Caret() {
  return (
    <span className={styles.caret} aria-hidden="true">
      <span />
    </span>
  );
}

interface SentenceProps {
  units: Unit[];
  shown: number;
  sources: Source[];
  hot: Hot | null;
  onHot: (value: Hot | null) => void;
  cites: Map<number, Set<number>>;
  caret?: boolean;
}

/** Renders the revealed units of one block, grouping words into sentence spans so a hovered citation can light its own sentence. */
function Lines({ units, shown, sources, hot, onHot, cites, caret }: SentenceProps) {
  const nodes: React.ReactNode[] = [];
  let group: React.ReactNode[] = [];
  let groupSentence = -1;
  const visible = units.filter((unit) => unit.i < shown);

  const flush = () => {
    if (!group.length) return;
    const lit = hot?.s !== undefined && hot.s === groupSentence;
    nodes.push(
      <span key={`s-${groupSentence}-${nodes.length}`} className={styles.sentence} data-lit={lit || undefined}>
        {group}
      </span>,
    );
    group = [];
  };

  visible.forEach((unit, index) => {
    if (unit.kind === "cite") {
      flush();
      if (unit.space) nodes.push("\u00a0");
      nodes.push(
        <Cite key={`c-${unit.i}`} n={unit.n} s={unit.s} sources={sources} hot={hot} onHot={onHot} />,
      );
      return;
    }
    if (group.length && unit.s !== groupSentence) flush();
    if (group.length === 0) {
      groupSentence = unit.s;
      if (index > 0 && unit.space) nodes.push(" ");
    } else if (unit.space) {
      group.push(" ");
    }
    if (unit.kind === "code") {
      group.push(
        <code key={`w-${unit.i}`} className={cx(styles.word, styles.inlineCode)}>
          {unit.text}
        </code>,
      );
    } else {
      group.push(
        <span key={`w-${unit.i}`} className={cx(styles.word, unit.bold && styles.strong)}>
          {unit.text}
        </span>,
      );
    }
  });
  flush();

  return (
    <>
      {nodes}
      {caret ? <Caret /> : null}
    </>
  );
}

const KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "of",
  "return",
  "static",
  "switch",
  "throw",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "yield",
]);

const TOKEN_PATTERN =
  /\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b/g;

const LANGUAGE_NAMES: Record<string, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  tsx: "TypeScript",
  jsx: "JavaScript",
  json: "JSON",
  bash: "Bash",
  sh: "Shell",
  html: "HTML",
  css: "CSS",
  py: "Python",
  python: "Python",
};

function tokenizeCodeLine(line: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(line))) {
    if (match.index > last) out.push(line.slice(last, match.index));
    const token = match[0];
    const rest = line.slice(match.index + token.length);
    let tone = "";
    if (token.startsWith("//")) tone = "tok_comment";
    else if (/^["'`]/.test(token)) tone = "tok_string";
    else if (/^\d/.test(token)) tone = "tok_number";
    else if (KEYWORDS.has(token)) tone = "tok_keyword";
    else if (/^\s*\(/.test(rest) || /^\?\.\(/.test(rest)) tone = "tok_fn";
    else if (/^\s*:/.test(rest)) tone = "tok_prop";
    out.push(
      tone ? (
        <span key={match.index} className={styles[tone]}>
          {token}
        </span>
      ) : (
        token
      ),
    );
    last = match.index + token.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

function CodeBlock({ block, shown, complete }: { block: Extract<ParsedBlock, { kind: "code" }>; shown: number; complete: boolean }) {
  const language = LANGUAGE_NAMES[block.language] ?? block.language;
  return (
    <figure className={cx(styles.code, styles.develop)}>
      <figcaption className={styles.codeHeader}>
        <span className={styles.codeTitle}>
          {block.filename ? <span className={styles.truncate}>{block.filename}</span> : null}
          {language ? <span className={styles.codeLanguage}>{language}</span> : null}
        </span>
        <CopyButton
          value={block.source}
          variant="plain"
          label="Copy"
          className={styles.codeCopy}
          disabled={!complete}
        />
      </figcaption>
      <pre
        className={styles.pre}
        tabIndex={0}
        aria-label={block.filename ? `Code: ${block.filename}` : "Code"}
      >
        <code>
          {block.lines
            .filter((line) => line.i < shown)
            .map((line) => (
              <span key={line.i} className={cx(styles.codeLine, styles.develop)}>
                {line.text ? tokenizeCodeLine(line.text) : " "}
                {"\n"}
              </span>
            ))}
        </code>
      </pre>
    </figure>
  );
}

function CellText({ units }: { units: Unit[] }) {
  return (
    <>
      {units.map((unit, index) => (
        <React.Fragment key={unit.i}>
          {index > 0 && unit.space ? " " : null}
          {unit.kind === "cite" ? (
            `[${unit.n}]`
          ) : unit.kind === "code" ? (
            <code className={styles.inlineCode}>{unit.text}</code>
          ) : unit.bold ? (
            <span className={styles.strong}>{unit.text}</span>
          ) : (
            unit.text
          )}
        </React.Fragment>
      ))}
    </>
  );
}

function TableBlock({ block, shown }: { block: Extract<ParsedBlock, { kind: "table" }>; shown: number }) {
  if (!(block.headerIndex < shown)) return null;
  const headerIsLabelColumn = block.header[0]?.length === 0;
  return (
    <div className={cx(styles.tableWrap, styles.develop)} tabIndex={0} role="region" aria-label="Comparison table">
      <table className={styles.table}>
        <thead>
          <tr>
            {block.header.map((cell, index) =>
              headerIsLabelColumn && index === 0 ? (
                <td key={index}>
                  <CellText units={cell} />
                </td>
              ) : (
                <th key={index} scope="col">
                  <CellText units={cell} />
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {block.rows
            .filter((row) => row.i < shown)
            .map((row) => (
              <tr key={row.i} className={styles.develop}>
                {row.cells.map((cell, index) =>
                  headerIsLabelColumn && index === 0 ? (
                    <th key={index} scope="row">
                      <CellText units={cell} />
                    </th>
                  ) : (
                    <td key={index}>
                      <CellText units={cell} />
                    </td>
                  ),
                )}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

interface MarkdownProps {
  markdown: string;
  sources: Source[];
  hot: Hot | null;
  onHot: (value: Hot | null) => void;
  live: boolean;
  instant: boolean;
  still: boolean;
  onRevealed?: () => void;
}

/** Reveals the answer by weight rather than by character, so tables and code surfaces settle at a readable pace. */
function MarkdownAnswer({
  markdown,
  live,
  instant,
  still,
  sources,
  hot,
  onHot,
  onRevealed,
}: MarkdownProps) {
  const parsed = React.useMemo(() => parseMarkdown(markdown, live), [markdown, live]);
  const cumulative = React.useMemo(() => {
    const list: number[] = [];
    let total = 0;
    for (let index = 0; index < parsed.total; index += 1) {
      total += parsed.weights[index] ?? 1;
      list.push(total);
    }
    return list;
  }, [parsed.total, parsed.weights]);

  const [shown, setShown] = React.useState(() => (instant ? parsed.total : 0));
  const progress = React.useRef(0);
  const revealed = React.useRef(0);
  const published = React.useRef(0);

  React.useEffect(() => {
    const target = cumulative[parsed.total - 1] ?? 0;
    if (instant) {
      progress.current = target;
      revealed.current = parsed.total;
      setShown(parsed.total);
      return;
    }
    if (revealed.current > parsed.total) {
      revealed.current = 0;
      progress.current = 0;
    }
    let frame = 0;
    let time = performance.now();
    const step = (now: number) => {
      const delta = Math.min(0.05, Math.max(0, (now - time) / 1000));
      time = now;
      const remaining = target - progress.current;
      if (remaining > 0) {
        const rate = live ? 100 + 3 * remaining : Math.max(150, remaining / 0.4);
        progress.current = Math.min(target, progress.current + rate * delta);
      }
      if (now - published.current >= 34) {
        let next = revealed.current;
        while (next < parsed.total && cumulative[next] <= progress.current + 1e-6) next += 1;
        if (next !== revealed.current) {
          revealed.current = next;
          published.current = now;
          setShown(next);
        }
      }
      if (revealed.current < parsed.total) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [cumulative, parsed.total, live, instant]);

  const shownCount = instant ? parsed.total : Math.min(shown, parsed.total);
  const done = !live && shownCount >= parsed.total;
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (done && !fired.current) {
      fired.current = true;
      onRevealed?.();
    }
  }, [done, onRevealed]);

  const blocks = parsed.blocks.filter(
    (block) =>
      blockStart(block) < shownCount || (block.kind === "code" && block.lines.length === 0 && live && shownCount >= parsed.total),
  );
  const animateCaret = live || shownCount < parsed.total;
  const shared = { shown: shownCount, sources, hot, onHot, cites: parsed.cites };

  return (
    <div className={styles.body} data-instant={(instant || still) || undefined}>
      {blocks.map((block, index) => {
        const caret = animateCaret && index === blocks.length - 1;
        switch (block.kind) {
          case "p":
            return (
              <p key={index} className={styles.paragraph}>
                <Lines units={block.units} caret={caret} {...shared} />
              </p>
            );
          case "h":
            return (
              <h3 key={index} className={styles.heading}>
                <Lines units={block.units} caret={caret} {...shared} />
              </h3>
            );
          case "ol":
          case "ul": {
            const List = block.kind;
            const items = block.items.filter((item) => item.length && item[0].i < shownCount);
            return (
              <List key={index} className={styles.list}>
                {items.map((item, itemIndex) => (
                  <li key={item[0].i} className={styles.listItem}>
                    <Lines
                      units={item}
                      caret={caret && itemIndex === items.length - 1}
                      {...shared}
                    />
                  </li>
                ))}
              </List>
            );
          }
          case "table":
            return <TableBlock key={index} block={block} shown={shownCount} />;
          case "code":
            return (
              <CodeBlock
                key={index}
                block={block}
                shown={shownCount}
                complete={!live && shownCount >= parsed.total}
              />
            );
        }
      })}
    </div>
  );
}

/** Reasoning arrives as paragraphs of words; the caret trails the paragraph that is still growing. */
function Reasoning({ text, live }: { text: string; live: boolean }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className={styles.reasoningText}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {paragraph
            .split(/(\s+)/)
            .filter(Boolean)
            .map((token, tokenIndex) =>
              /\s/.test(token) ? (
                " "
              ) : (
                <span key={tokenIndex} className={styles.word}>
                  {token}
                </span>
              ),
            )}
          {live && index === paragraphs.length - 1 ? <Caret /> : null}
        </p>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Disclosure + panel
 * -----------------------------------------------------------------------------------------------*/

function Disclosure({
  open,
  controls,
  onClick,
  children,
}: {
  open: boolean;
  controls: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={styles.disclosure}
      aria-expanded={open}
      aria-controls={controls}
      data-open={open || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Panel({
  id,
  open,
  reduced,
  children,
}: {
  id: string;
  open: boolean;
  reduced: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      id={id}
      className={styles.panel}
      initial={false}
      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
      transition={
        reduced
          ? { duration: 0 }
          : {
              height: springTokens.smooth,
              opacity: { duration: durationTokens.fast, ease: standardEase },
            }
      }
      inert={!open}
    >
      {children}
    </motion.div>
  );
}

/** Keeps the column from jumping when a version swaps in: the outer box animates to the measured content height. */
function AutoHeight({
  morphKey,
  reduced,
  children,
}: {
  morphKey: string | number;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const inner = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | "auto">("auto");
  const current = useMotionValue(0);

  React.useEffect(() => {
    const element = inner.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const next = element.offsetHeight;
      setHeight(next);
      if (reduced) {
        current.set(next);
        return;
      }
      animate(current, next, springTokens.smooth);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [current, reduced]);

  React.useEffect(() => {
    const element = inner.current;
    if (element) {
      const next = element.offsetHeight;
      setHeight(next);
      current.set(next);
    }
  }, [morphKey, current]);

  return (
    <motion.div
      className={styles.autoHeight}
      data-morphing={height === "auto" ? undefined : true}
      style={{ height: height === "auto" ? "auto" : current }}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Sources
 * -----------------------------------------------------------------------------------------------*/

function Stack({ sources, reduced }: { sources: Source[]; reduced: boolean }) {
  const shown = sources.slice(0, 4);
  return (
    <span className={styles.stack} aria-hidden="true">
      {shown.map((source, index) => (
        <motion.span
          key={source.id}
          className={styles.stackItem}
          style={{ zIndex: 4 - index, ["--fan" as string]: index - (shown.length - 1) / 2 }}
          initial={reduced ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduced ? { duration: 0 } : { ...snappy, delay: index * 0.03 }}
          whileHover={reduced ? undefined : { translate: `${(index - (shown.length - 1) / 2) * 2.5}px 0` }}
        >
          <Mark source={source} />
        </motion.span>
      ))}
    </span>
  );
}

function SourceList({
  ref,
  sources,
  open,
  hot,
}: {
  ref?: React.Ref<HTMLOListElement>;
  sources: Source[];
  open: boolean;
  hot: Hot | null;
}) {
  return (
    <ol ref={ref} className={styles.sources} aria-label="Sources" data-open={open || undefined}>
      {sources.map((source, index) => (
        <li key={source.id} className={styles.sourceItem} style={{ ["--i" as string]: Math.min(index, 6) }}>
          <a
            className={styles.sourceCard}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            title={source.title}
            data-lit={hot?.n === index + 1 || undefined}
          >
            <span className={styles.sourceCardTop}>
              <Mark source={source} className={styles.markCard} />
              <span className={styles.truncate}>{source.domain.replace(/^www\./, "")}</span>
            </span>
            <span className={styles.sourceCardName}>{source.title}</span>
            <span className={styles.sourceIndex}>
              <span className={styles.srOnly}>Source </span>
              {index + 1}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Share
 * -----------------------------------------------------------------------------------------------*/

const SHARE_LABEL = { idle: "Share", copied: "Copied", error: "Failed" } as const;

function ShareButton({
  reduced,
  getLink,
}: {
  reduced: boolean;
  getLink: () => string | Promise<string>;
}) {
  const { state, copy } = useCopyState(1600);
  const measures = React.useRef(new Map<string, HTMLSpanElement | null>());
  const [widths, setWidths] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    const read = () => {
      const next: Record<string, number> = {};
      measures.current.forEach((element, key) => {
        if (element) next[key] = Math.round(element.offsetWidth);
      });
      setWidths(next);
    };
    read();
    const observer = new ResizeObserver(read);
    measures.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <button
      type="button"
      className={styles.shareButton}
      data-state={state}
      aria-label="Share thread"
      onClick={() => {
        void copy(getLink);
      }}
    >
      <SwapIcon id={state} reduced={reduced}>
        {state === "copied" ? <DrawnCheck reduced={reduced} /> : state === "error" ? <TriangleAlert /> : <Link2 />}
      </SwapIcon>
      <motion.span
        className={styles.shareLabel}
        aria-hidden="true"
        animate={{ width: widths[state] ?? "auto" }}
        transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.22, bounce: 0 }}
      >
        {(Object.keys(SHARE_LABEL) as (keyof typeof SHARE_LABEL)[]).map((key) => (
          <span
            key={key}
            className={styles.shareMeasure}
            ref={(element) => {
              measures.current.set(key, element);
            }}
          >
            {SHARE_LABEL[key]}
          </span>
        ))}
        <AnimatePresence initial={false}>
          <motion.span
            key={state}
            className={styles.shareLabelText}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : durationTokens.fast }}
          >
            {SHARE_LABEL[state]}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </button>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Action bar
 * -----------------------------------------------------------------------------------------------*/

const FEEDBACK_REASONS = [
  "Not accurate",
  "Out of date",
  "Missing a source",
  "Too long",
  "Did not answer the question",
];

function RegenerateMenu({
  models,
  model,
  disabled,
  onRegenerate,
}: {
  models: Model[];
  model: Model;
  disabled: boolean;
  onRegenerate: (mode: Mode, model: Model) => void;
}) {
  return (
    <DropdownMenu.Root>
      <Tooltip content="Regenerate">
        <DropdownMenu.Trigger asChild>
          <IconButton label="Regenerate" className={styles.anchor} disabled={disabled}>
            <RotateCcw />
          </IconButton>
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.menu} side="top" align="start" sideOffset={6} collisionPadding={12} loop>
          <DropdownMenu.Item className={styles.menuItem} onSelect={() => onRegenerate("retry", model)}>
            <RotateCcw />
            Try again
          </DropdownMenu.Item>
          <DropdownMenu.Item className={styles.menuItem} onSelect={() => onRegenerate("concise", model)}>
            <Minimize2 />
            More concise
          </DropdownMenu.Item>
          <DropdownMenu.Item className={styles.menuItem} onSelect={() => onRegenerate("detailed", model)}>
            <Maximize2 />
            More detailed
          </DropdownMenu.Item>
          <DropdownMenu.Separator className={styles.menuSeparator} />
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={styles.menuItem}>
              <ArrowLeftRight />
              Switch model
              <ChevronRight className={styles.menuChevron} />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className={styles.menu} sideOffset={6} alignOffset={-4}>
                <DropdownMenu.Label className={styles.menuLabel}>Answer again with</DropdownMenu.Label>
                {models
                  .filter((entry) => entry.id !== model.id)
                  .map((entry) => (
                    <DropdownMenu.Item
                      key={entry.id}
                      className={styles.menuItem}
                      onSelect={() => onRegenerate("model", entry)}
                    >
                      <span className={styles.menuMark}>
                        <BrandIconView name={entry.mark} icon={BRAND_ICONS[entry.mark]} />
                      </span>
                      {entry.name}
                    </DropdownMenu.Item>
                  ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function FeedbackPopover({
  active,
  reduced,
  onPick,
  onClear,
}: {
  active: boolean;
  reduced: boolean;
  onPick: (reason: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string | null>(null);
  const timer = React.useRef(0);
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next && !reason) onClear();
      }}
    >
      <PopoverTrigger asChild>
        <IconButton
          label="Bad response"
          aria-pressed={active}
          className={styles.anchor}
          onClick={() => setReason(null)}
        >
          <SwapIcon id={active ? "down" : "idle"} reduced={reduced}>
            <ThumbsDown className={active ? styles.filled : undefined} />
          </SwapIcon>
        </IconButton>
      </PopoverTrigger>
      <PopoverContent className={styles.feedback} side="top" align="start" sideOffset={8} aria-label="What went wrong">
        {reason ? (
          <div className={styles.feedbackThanks} role="status">
            <span className={styles.feedbackCheck}>
              <DrawnCheck reduced={reduced} />
            </span>
            <span>
              <span className={styles.feedbackTitle}>Thanks for telling us</span>
              <span className={styles.feedbackNote}>Noted: {reason.toLowerCase()}</span>
            </span>
          </div>
        ) : (
          <div>
            <p className={styles.feedbackTitle} id="ai-answer-feedback-title">
              What went wrong?
            </p>
            <div className={styles.reasons} role="group" aria-labelledby="ai-answer-feedback-title">
              {FEEDBACK_REASONS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className={styles.reason}
                  onClick={() => {
                    setReason(entry);
                    onPick(entry);
                    timer.current = window.setTimeout(() => setOpen(false), 1500);
                  }}
                >
                  {entry}
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface ActionBarProps {
  version: Version;
  models: Model[];
  busy: boolean;
  reduced: boolean;
  copied: { state: "idle" | "copied" | "error"; copy: (value: string | (() => string | Promise<string>)) => Promise<boolean> };
  onCopy: () => string;
  onRegenerate: (mode: Mode, model: Model) => void;
  onFeedback: (value: FeedbackValue | null, reason?: string) => void;
  onShare: () => string | Promise<string>;
  selected: number;
  total: number;
  onSelect: (index: number) => void;
}

function ActionBar({
  version,
  models,
  busy,
  reduced,
  copied,
  onCopy,
  onRegenerate,
  onFeedback,
  onShare,
  selected,
  total,
  onSelect,
}: ActionBarProps) {
  const direction = React.useRef(1);
  const go = (next: number) => {
    direction.current = next > selected ? 1 : -1;
    onSelect(next);
  };

  return (
    <div className={styles.actionBar}>
      <div className={styles.actions} role="toolbar" aria-label="Answer actions">
        <Tooltip content={copied.state === "copied" ? "Copied" : copied.state === "error" ? "Could not copy" : "Copy answer"}>
          <IconButton
            label="Copy answer"
            data-state={copied.state}
            onClick={() => {
              void copied.copy(onCopy);
            }}
          >
            <SwapIcon id={copied.state} reduced={reduced}>
              {copied.state === "copied" ? (
                <DrawnCheck reduced={reduced} />
              ) : copied.state === "error" ? (
                <TriangleAlert />
              ) : (
                <Copy />
              )}
            </SwapIcon>
          </IconButton>
        </Tooltip>
        <RegenerateMenu models={models} model={version.model} disabled={busy} onRegenerate={onRegenerate} />
        <Tooltip content="Good response">
          <IconButton
            label="Good response"
            aria-pressed={version.feedback === "up"}
            onClick={() => onFeedback(version.feedback === "up" ? null : "up")}
          >
            <SwapIcon id={version.feedback === "up" ? "up" : "idle"} reduced={reduced}>
              <ThumbsUp className={version.feedback === "up" ? styles.filled : undefined} />
            </SwapIcon>
          </IconButton>
        </Tooltip>
        <FeedbackPopover
          active={version.feedback === "down"}
          reduced={reduced}
          onPick={(reason) => onFeedback("down", reason)}
          onClear={() => onFeedback(null)}
        />
        <Tooltip content="Copy share link">
          <IconButton
            label="Copy share link"
            data-state={copied.state === "idle" ? undefined : copied.state}
            onClick={() => {
              void copied.copy(onShare);
            }}
          >
            <SwapIcon id={`link-${copied.state}`} reduced={reduced}>
              <Link2 />
            </SwapIcon>
          </IconButton>
        </Tooltip>
        <AnimatePresence initial={false}>
          {total > 1 ? (
            <motion.div
              key="versions"
              className={styles.versions}
              role="group"
              aria-label="Versions"
              initial={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
              transition={reduced ? { duration: 0 } : { duration: durationTokens.standard, ease: standardEase }}
            >
              <span className={styles.versionsRule} aria-hidden="true" />
              <IconButton
                label="Previous version"
                className={styles.versionStep}
                disabled={selected === 0}
                onClick={() => go(selected - 1)}
              >
                <ChevronLeft />
              </IconButton>
              <span className={styles.versionCount}>
                <span className={styles.versionRoll}>
                  <AnimatePresence initial={false} mode="popLayout" custom={direction.current}>
                    <motion.span
                      key={selected}
                      custom={direction.current}
                      initial={{ y: direction.current > 0 ? "70%" : "-70%", opacity: 0 }}
                      animate={{ y: "0%", opacity: 1 }}
                      exit={{ y: direction.current > 0 ? "-70%" : "70%", opacity: 0 }}
                      transition={{ duration: reduced ? 0 : durationTokens.fast, ease: standardEase }}
                    >
                      {selected + 1}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span>/</span>
                <span>{total}</span>
                <span className={styles.srOnly}>
                  Version {selected + 1} of {total}
                </span>
              </span>
              <IconButton
                label="Next version"
                className={styles.versionStep}
                disabled={selected >= total - 1}
                onClick={() => go(selected + 1)}
              >
                <ChevronRight />
              </IconButton>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <p className={styles.modelLine}>
        <span className={styles.modelMark}>
          <BrandIconView name={version.model.mark} icon={BRAND_ICONS[version.model.mark]} />
        </span>
        <span className={styles.modelName}>{version.model.name}</span>
        {version.tokens !== undefined ? (
          <>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.tabular}>{version.tokens.toLocaleString("en-US")} tokens</span>
          </>
        ) : null}
        {version.seconds !== undefined ? (
          <>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.tabular}>{version.seconds}s</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Composer
 * -----------------------------------------------------------------------------------------------*/

function Composer({
  hasThread,
  busy,
  reduced,
  onAsk,
  onStop,
}: {
  hasThread: boolean;
  busy: boolean;
  reduced: boolean;
  onAsk: (question: string) => void;
  onStop: () => void;
}) {
  const id = React.useId();
  const [value, setValue] = React.useState("");

  const submit = () => {
    if (busy) {
      onStop();
      return;
    }
    if (!value.trim()) return;
    onAsk(value.trim());
    setValue("");
  };

  return (
    <div className={styles.dock}>
      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className={styles.srOnly} htmlFor={id}>
          {hasThread ? "Ask a follow-up" : "Ask a question"}
        </label>
        <textarea
          id={id}
          className={styles.input}
          rows={1}
          value={value}
          placeholder={hasThread ? "Ask a follow-up" : "Ask anything"}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="submit"
          className={styles.send}
          data-kind={busy ? "stop" : "send"}
          aria-label={busy ? "Stop answer" : "Send"}
          disabled={!busy && !value.trim()}
        >
          <SwapIcon id={busy ? "stop" : "send"} reduced={reduced}>
            {busy ? <Square className={styles.stopGlyph} /> : <ArrowUp />}
          </SwapIcon>
        </button>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Turn
 * -----------------------------------------------------------------------------------------------*/

interface TurnProps {
  turn: Turn;
  models: Model[];
  reduced: boolean;
  revealed: Set<number>;
  onRevealed: (id: number) => void;
  onStop: () => void;
  onRegenerate: (mode: Mode, model: Model) => void;
  onAsk: (question: string) => void;
  onFeedback: (value: FeedbackValue | null, reason?: string) => void;
  onSelect: (index: number) => void;
  getLink: (version: number) => string | Promise<string>;
}

function TurnView({
  turn,
  models,
  reduced,
  revealed,
  onRevealed,
  onStop,
  onRegenerate,
  onAsk,
  onFeedback,
  onSelect,
  getLink,
}: TurnProps) {
  const id = React.useId();
  const version = turn.versions[turn.index];
  const [reasoningOpen, setReasoningOpen] = React.useState(false);
  const [sourcesOpen, setSourcesOpen] = React.useState(false);
  const [hot, setHot] = React.useState<Hot | null>(null);
  const sourcesRef = React.useRef<HTMLOListElement | null>(null);
  const copied = useCopyState(1600);

  const live = isBusyStatus(version.status);
  const busier = turn.versions.some((entry) => isBusyStatus(entry.status));
  const visible = version.status === "stopped" || version.status === "error" || (version.status === "done" && revealed.has(version.id));

  const label =
    version.status === "thinking"
      ? "Thinking"
      : version.thought !== undefined
        ? `Thought for ${version.thought}s`
        : version.firstText
          ? `Thought for ${Math.round((version.firstText - version.started) / 1e3)}s`
          : version.status === "stopped"
            ? "Stopped while thinking"
            : "Reasoning";
  const showReasoning = version.status === "thinking" || version.reasoning.length > 0;

  const shareLink = React.useCallback(
    () => getLink(turn.index),
    [getLink, turn.index],
  );

  const copyAnswer = React.useCallback(() => {
    const parsed = parseMarkdown(version.text, false);
    const cited = [...new Set([...parsed.cites.values()].flatMap((set) => [...set]))].sort((a, b) => a - b);
    const sources = cited
      .map((n) => {
        const source = version.sources[n - 1];
        return source ? `[${n}] ${source.title}, ${source.url}` : null;
      })
      .filter(Boolean);
    return sources.length ? `${version.text}\n\nSources\n${sources.join("\n")}` : version.text;
  }, [version.text, version.sources]);

  React.useEffect(() => {
    if (!hot || !sourcesOpen) return;
    const list = sourcesRef.current;
    const child = list?.children[hot.n - 1] as HTMLElement | undefined;
    if (!list || !child) return;
    const padding = parseFloat(getComputedStyle(list).paddingLeft || "0");
    list.scrollTo({ left: child.offsetLeft - padding, behavior: reduced ? "auto" : "smooth" });
  }, [hot, sourcesOpen, reduced]);

  return (
    <div className={styles.turn}>
      <div className={styles.steps}>
        {showReasoning ? (
          <div className={styles.step}>
            <Disclosure
              open={reasoningOpen}
              controls={`${id}-reasoning`}
              onClick={() => setReasoningOpen((open) => !open)}
            >
              <span className={styles.disclosureLabel}>
                <TextShimmer active={version.status === "thinking"} duration={1.1}>
                  {label}
                </TextShimmer>
              </span>
              <ChevronDown className={styles.chevron} data-open={reasoningOpen || undefined} />
            </Disclosure>
            <Panel id={`${id}-reasoning`} open={reasoningOpen} reduced={reduced}>
              <div className={styles.reasoning}>
                {version.reasoning ? (
                  <Reasoning text={version.reasoning} live={version.status === "thinking"} />
                ) : (
                  <p className={styles.muted}>Waiting for the first thought</p>
                )}
              </div>
            </Panel>
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {version.sources.length ? (
            <motion.div
              key="sources"
              className={styles.step}
              initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={reduced ? { duration: 0 } : { height: springTokens.smooth, opacity: { duration: durationTokens.standard } }}
            >
              <Disclosure
                open={sourcesOpen}
                controls={`${id}-sources`}
                onClick={() => setSourcesOpen((open) => !open)}
              >
                <Stack sources={version.sources} reduced={reduced} />
                <span className={styles.disclosureLabel}>
                  <span className={styles.tabular}>
                    {version.sources.length} {version.sources.length === 1 ? "source" : "sources"}
                  </span>
                </span>
                <ChevronDown className={styles.chevron} data-open={sourcesOpen || undefined} />
              </Disclosure>
              <Panel id={`${id}-sources`} open={sourcesOpen} reduced={reduced}>
                <SourceList ref={sourcesRef} sources={version.sources} open={sourcesOpen} hot={hot} />
              </Panel>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AutoHeight morphKey={version.id} reduced={reduced}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={version.id}
            className={styles.answer}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={reduced ? { duration: 0 } : { duration: durationTokens.standard, ease: enterEase }}
          >
            <MarkdownAnswer
              markdown={version.text}
              live={live}
              instant={!!version.instant || revealed.has(version.id)}
              still={reduced}
              sources={version.sources}
              hot={hot}
              onHot={setHot}
              onRevealed={() => onRevealed(version.id)}
            />
          </motion.div>
        </AnimatePresence>
      </AutoHeight>

      <AnimatePresence initial={false}>
        {version.status === "stopped" || version.status === "error" ? (
          <motion.div
            key="note"
            className={styles.note}
            data-tone={version.status === "error" ? "error" : "stopped"}
            role={version.status === "error" ? "alert" : undefined}
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: durationTokens.standard, ease: standardEase }}
          >
            <div className={styles.noteInner}>
              {version.status === "error" ? (
                <TriangleAlert className={styles.noteIcon} />
              ) : (
                <Square className={styles.noteIcon} />
              )}
              <span className={styles.noteText}>
                {version.status === "error" ? (
                  <>
                    <span className={styles.noteTitle}>The answer was cut off.</span> {version.error}
                  </>
                ) : version.text ? (
                  "You stopped this answer, so it may be incomplete."
                ) : (
                  "You stopped this answer before it started."
                )}
              </span>
              <button type="button" className={styles.noteAction} onClick={() => onRegenerate("retry", version.model)}>
                <RotateCcw />
                Try again
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className={styles.footer}>
        <AnimatePresence initial={false}>
          {visible ? (
            <motion.div
              key="actions"
              className={styles.footerSlot}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
              transition={reduced ? { duration: 0 } : { duration: durationTokens.standard, ease: enterEase }}
            >
              <ActionBar
                version={version}
                models={models}
                busy={busier}
                reduced={reduced}
                copied={copied}
                onCopy={copyAnswer}
                onRegenerate={onRegenerate}
                onFeedback={onFeedback}
                onShare={shareLink}
                selected={turn.index}
                total={turn.versions.length}
                onSelect={onSelect}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {visible && turn.followUps.length ? (
          <motion.section
            key="related"
            className={styles.related}
            aria-labelledby={`${id}-related`}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
            transition={reduced ? { duration: 0 } : { duration: durationTokens.standard, ease: enterEase }}
          >
            <h3 className={styles.relatedTitle} id={`${id}-related`}>
              Related
            </h3>
            <ul className={styles.relatedList}>
              {turn.followUps.map((question, index) => (
                <motion.li
                  key={question}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: durationTokens.standard, ease: enterEase, delay: 0.06 + index * stagger.item * 1.5 }
                  }
                >
                  <button
                    type="button"
                    className={styles.relatedItem}
                    disabled={busier}
                    onClick={() => onAsk(question)}
                  >
                    <span>{question}</span>
                    <ArrowRight />
                  </button>
                </motion.li>
              ))}
            </ul>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Root
 * -----------------------------------------------------------------------------------------------*/

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "answer";

export function AiAnswer({
  models = SAMPLE_MODELS,
  respond,
  suggestions,
  title,
  onFeedback,
  onFollowUp,
  onShare,
  className,
  model,
  ...rest
}: AiAnswerProps) {
  const reduced = useReducedMotion() ?? false;
  const scroller = React.useRef<HTMLDivElement>(null);
  const currentModel = model ?? models[0];
  const [turn, dispatch] = React.useReducer(reducer, null, () => initTurn({ ...rest, respond }, currentModel));
  const [revealed, setRevealed] = React.useState<Set<number>>(() => new Set());
  const [announcement, setAnnouncement] = React.useState("");
  const aborters = React.useRef(new Map<number, AbortController>());
  const started = React.useRef(new Set<number>());
  const run = React.useRef(0);
  const responder = React.useRef<Responder>(respond ?? defaultRespond);
  responder.current = respond ?? defaultRespond;
  const rootId = React.useId();

  const busy = !!turn && turn.versions.some((version) => isBusyStatus(version.status));
  const version = turn ? turn.versions[turn.index] : null;

  const announce = React.useCallback((message: string) => {
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(message));
  }, []);

  React.useEffect(() => {
    if (!turn || !version) return;
    if (!isBusyStatus(version.status) || started.current.has(version.id)) return;
    started.current.add(version.id);
    const controller = new AbortController();
    aborters.current.set(version.id, controller);
    const versionId = version.id;
    const question = turn.question;

    /* Restarting the stream must start from empty: in development React mounts effects twice, and
       the first run can push a chunk before its abort lands. */
    run.current += 1;
    const runId = run.current;
    dispatch({ type: "reset", id: versionId, run: runId, now: Date.now() });
    setRevealed((previous) => {
      if (!previous.has(versionId)) return previous;
      const next = new Set(previous);
      next.delete(versionId);
      return next;
    });

    void (async () => {
      try {
        for await (const event of responder.current({
          question,
          mode: version.mode,
          model: version.model,
          signal: controller.signal,
        })) {
          dispatch({ type: "event", id: versionId, run: runId, event, now: Date.now() });
        }
        if (controller.signal.aborted) return;
        dispatch({ type: "end", id: versionId, run: runId, status: "done", now: Date.now() });
      } catch (error) {
        if (!controller.signal.aborted) {
          dispatch({
            type: "end",
            id: versionId,
            run: runId,
            status: "error",
            error: error instanceof Error ? error.message : String(error),
            now: Date.now(),
          });
        }
      } finally {
        aborters.current.delete(versionId);
      }
    })();

    return () => {
      controller.abort();
      started.current.delete(versionId);
    };
  }, [version?.id]);

  const stop = React.useCallback(() => {
    if (!version) return;
    aborters.current.get(version.id)?.abort();
    dispatch({ type: "end", id: version.id, run: version.run ?? 0, status: "stopped", now: Date.now() });
  }, [version]);

  const regenerate = React.useCallback(
    (mode: Mode, nextModel: Model) => {
      if (!turn) return;
      const current = turn.versions[turn.index];
      if (isBusyStatus(current.status)) aborters.current.get(current.id)?.abort();
      dispatch({
        type: "version",
        version: {
          id: nextId(),
          mode,
          model: nextModel,
          status: "thinking",
          reasoning: "",
          sources: [],
          text: "",
          started: Date.now(),
        },
      });
      scroller.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    },
    [turn, reduced],
  );

  const ask = React.useCallback(
    (question: string) => {
      if (!question.trim()) return;
      turn?.versions.forEach((entry) => {
        if (isBusyStatus(entry.status)) aborters.current.get(entry.id)?.abort();
      });
      dispatch({
        type: "turn",
        turn: {
          id: nextId(),
          question,
          versions: [
            {
              id: nextId(),
              mode: "answer",
              model: currentModel,
              status: "thinking",
              reasoning: "",
              sources: [],
              text: "",
              started: Date.now(),
            },
          ],
          index: 0,
          followUps: respond ? [] : followUpsFor(question),
        },
      });
      setRevealed(new Set());
      announce("Asking " + question);
      onFollowUp?.(question);
    },
    [turn, currentModel, respond, announce, onFollowUp],
  );

  const newThread = React.useCallback(() => {
    turn?.versions.forEach((entry) => {
      if (isBusyStatus(entry.status)) aborters.current.get(entry.id)?.abort();
    });
    dispatch({ type: "turn", turn: null });
    setRevealed(new Set());
    setAnnouncement("");
  }, [turn]);

  const feedback = React.useCallback(
    (value: FeedbackValue | null, reason?: string) => {
      if (!turn || !version) return;
      dispatch({ type: "feedback", id: version.id, value: value ?? undefined });
      onFeedback?.({
        value,
        reason,
        question: turn.question,
        answer: version.text,
        model: version.model,
        version: turn.index + 1,
      });
    },
    [turn, version, onFeedback],
  );

  const getLink = React.useCallback(
    async (index: number) => {
      const payload = turn
        ? { question: turn.question, answer: turn.versions[index]?.text ?? "", version: turn.versions.length > 1 ? index + 1 : undefined }
        : { question: "", answer: "" };
      if (onShare) return onShare(payload);
      const base = `https://example.com/answers/${slugify(payload.question)}`;
      return payload.version ? `${base}?v=${payload.version}` : base;
    },
    [onShare, turn],
  );

  const status = !turn
    ? ""
    : busy
      ? version?.status === "thinking"
        ? "Thinking"
        : "Writing the answer"
      : version?.status === "stopped"
        ? "Answer stopped"
        : version?.status === "error"
          ? "The answer was cut off"
          : "Answer ready";

  const followUps = suggestions ?? SAMPLE_FOLLOW_UPS;

  return (
    <section
      className={cx(styles.root, className)}
      aria-labelledby={turn ? (title ? `${rootId}-title` : `${rootId}-question`) : `${rootId}-empty`}
      aria-busy={busy || undefined}
    >
      <header className={styles.topBar}>
        <Tooltip content="New thread">
          <IconButton label="New thread" disabled={!turn} onClick={newThread}>
            <SquarePen />
          </IconButton>
        </Tooltip>
        <div className={styles.topTitle}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.p
              key={title ?? turn?.question ?? "empty"}
              className={styles.topTitleText}
              title={title ?? turn?.question}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={reduced ? { duration: 0 } : { duration: durationTokens.fast, ease: enterEase }}
            >
              {title ?? turn?.question ?? "New thread"}
            </motion.p>
          </AnimatePresence>
        </div>
        <ShareButton reduced={reduced} getLink={() => getLink(turn?.index ?? 0)} />
      </header>

      <div className={styles.scroller} ref={scroller}>
        <div className={styles.column}>
          {turn ? (
            <>
              <h2 className={styles.question} id={`${rootId}-question`} tabIndex={-1}>
                <motion.span
                  className={styles.questionText}
                  initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduced ? { duration: 0 } : { duration: durationTokens.standard, ease: enterEase }}
                >
                  {turn.question}
                </motion.span>
              </h2>
              <TurnView
                key={turn.id}
                turn={turn}
                models={models}
                reduced={reduced}
                revealed={revealed}
                onRevealed={(id) =>
                  setRevealed((previous) => {
                    if (previous.has(id)) return previous;
                    const next = new Set(previous);
                    next.add(id);
                    return next;
                  })
                }
                onStop={stop}
                onRegenerate={regenerate}
                onAsk={ask}
                onFeedback={feedback}
                onSelect={(index) => dispatch({ type: "select", index })}
                getLink={getLink}
              />
            </>
          ) : (
            <div className={styles.empty}>
              <h2 className={styles.question} id={`${rootId}-empty`}>
                What do you want to know?
              </h2>
              <p className={styles.emptyText}>
                Answers stream in with their sources, and every citation points to the sentence it supports.
              </p>
              <ul className={styles.relatedList} aria-label="Suggested questions">
                {followUps.map((question) => (
                  <li key={question}>
                    <button type="button" className={styles.relatedItem} onClick={() => ask(question)}>
                      <span>{question}</span>
                      <ArrowRight />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Composer hasThread={!!turn} busy={busy} reduced={reduced} onAsk={ask} onStop={stop} />

      <p className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </p>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

export default AiAnswer;
