"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, SVGProps } from "react";
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { ArrowDownToLine, Check, CircleAlert, CircleCheck, Search, Star, X } from "lucide-react";
import { Button } from "../button/button";
import styles from "./agent-gallery.module.css";

export interface AgentApp {
  /** Stable id, used as the React key on the card and in the grant step. */
  id: string;
  /** App name, shown in the tooltip and read out before the permission. */
  name: string;
  /** 16px mark. Inline SVG; mono marks should draw with currentColor. */
  mark: ReactNode;
  /** Plain language permission shown on the grant step. */
  scope: string;
}

export interface AgentModel {
  /** Model name, read out as "Runs on …". */
  name: string;
  /** 16px provider mark. */
  mark: ReactNode;
}

export interface AgentPreviewStep {
  /** App or model name, read before the line for screen readers. */
  source: string;
  /** 16px mark for the step's source. */
  mark: ReactNode;
  /** One line of the sample run. */
  text: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  /** One line job, about 60 characters. The card reserves two lines and clamps the rest. */
  job: string;
  /** Must match one of `categories` to appear under its chip. */
  category: string;
  /** Connectors, in the order they are granted. */
  apps: AgentApp[];
  model: AgentModel;
  /** 0–5, rendered to one decimal. */
  rating: number;
  installs: number;
  /** First three lines of a sample run. */
  preview?: AgentPreviewStep[];
}

export interface AgentWorkspace {
  id: string;
  name: string;
  /** Secondary line, for example "Business · 48 seats". */
  detail?: string;
  /** Optional workspace mark. Without one the picker shows a monogram. */
  mark?: ReactNode;
}

export interface AgentGalleryProps {
  /** The catalog. Defaults to 20 sample agents. */
  agents?: AgentTemplate[];
  /** Filter chips, in order. */
  categories?: string[];
  /** The selected category. Pair with `onCategoryChange`. */
  category?: string;
  /** The first selected category when uncontrolled. Defaults to `categories[0]`. */
  defaultCategory?: string;
  /** Called when a chip is chosen, including from the empty state's "Show in" button. */
  onCategoryChange?: (category: string) => void;
  /** The search text. Pair with `onQueryChange`. */
  query?: string;
  /** The first search text when uncontrolled. */
  defaultQuery?: string;
  /** Called on every search edit and when search is cleared. */
  onQueryChange?: (query: string) => void;
  /** Workspaces offered on the first install step. A single workspace skips that step. */
  workspaces?: AgentWorkspace[];
  /** Ids of installed agents. Pair with `onInstalledChange`. */
  installed?: string[];
  /** Installed ids when uncontrolled. */
  defaultInstalled?: string[];
  /** Called with the new list after an install completes. */
  onInstalledChange?: (installed: string[]) => void;
  /** Runs the real install after access is granted. Reject to show the error state. */
  onInstall?: (agent: AgentTemplate, workspace: AgentWorkspace, signal: AbortSignal) => Promise<void>;
  /** Called when a card opens its sample run. */
  onPreview?: (agent: AgentTemplate) => void;
  /** Opens an installed agent. */
  onOpen?: (agent: AgentTemplate) => void;
  /** Heading of the card. */
  title?: string;
  /** One line under the heading. Pass an empty string to hide it. */
  description?: string;
  /** Extra class on the root section. */
  className?: string;
}

type MarkProps = SVGProps<SVGSVGElement>;

type CardView = "idle" | "preview" | "workspace" | "grant" | "done";
type InstallStatus = "ready" | "connecting" | "error";

const SPRING_SOFT: Transition = { type: "spring", visualDuration: 0.3, bounce: 0 };
const SPRING_TIGHT: Transition = { type: "spring", visualDuration: 0.24, bounce: 0 };
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ------------------------------------------------------------------ marks */

const HubSpotMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="HubSpot" {...props}>
    <path fill="#FF7A59" d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" />
  </svg>
);

const SlackMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="Slack" {...props}>
    <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
    <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
    <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
    <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
  </svg>
);

const GmailMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="Gmail" {...props}>
    <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
  </svg>
);

const GoogleCalendarMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="Google Calendar" {...props}>
    <path fill="#4285F4" d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" />
  </svg>
);

const NotionMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Notion" {...props}>
    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
  </svg>
);

const StripeMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="Stripe" {...props}>
    <path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
  </svg>
);

const ZendeskMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Zendesk" {...props}>
    <path d="M12.914 2.904V16.29L24 2.905H12.914zM0 2.906C0 5.966 2.483 8.45 5.543 8.45s5.542-2.484 5.543-5.544H0zm11.086 4.807L0 21.096h11.086V7.713zm7.37 7.84c-3.063 0-5.542 2.48-5.542 5.543H24c0-3.06-2.48-5.543-5.543-5.543z" />
  </svg>
);

const IntercomMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Intercom" {...props}>
    <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.658 1.343 3 3 3h18c1.658 0 3-1.342 3-3V3c0-1.657-1.342-3-3-3zm-5.801 4.399c0-.44.36-.8.802-.8.44 0 .8.36.8.8v10.688c0 .442-.36.801-.8.801-.443 0-.802-.359-.802-.801V4.399zM11.2 3.994c0-.44.357-.799.8-.799s.8.359.8.799v11.602c0 .44-.357.8-.8.8s-.8-.36-.8-.8V3.994zm-4 .405c0-.44.359-.8.799-.8.443 0 .802.36.802.8v10.688c0 .442-.36.801-.802.801-.44 0-.799-.359-.799-.801V4.399zM3.199 6c0-.442.36-.8.802-.8.44 0 .799.358.799.8v7.195c0 .441-.359.8-.799.8-.443 0-.802-.36-.802-.8V6zM20.52 18.202c-.123.105-3.086 2.593-8.52 2.593-5.433 0-8.397-2.486-8.521-2.593-.335-.288-.375-.792-.086-1.128.285-.334.79-.375 1.125-.09.047.041 2.693 2.211 7.481 2.211 4.848 0 7.456-2.186 7.479-2.207.334-.289.839-.25 1.128.086.289.336.25.84-.086 1.128zm.281-5.007c0 .441-.36.8-.801.8-.441 0-.801-.36-.801-.8V6c0-.442.361-.8.801-.8.441 0 .801.357.801.8v7.195z" />
  </svg>
);

const LinearMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="Linear" {...props}>
    <path fill="#5E6AD2" d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
  </svg>
);

const GitHubMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="GitHub" {...props}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const SentryMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Sentry" {...props}>
    <path d="M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z" />
  </svg>
);

const DatadogMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Datadog" {...props}>
    <path d="M19.57 17.04l-1.997-1.316-1.665 2.782-1.937-.567-1.706 2.604.087.82 9.274-1.71-.538-5.794zm-8.649-2.498l1.488-.204c.241.108.409.15.697.223.45.117.97.23 1.741-.16.18-.088.553-.43.704-.625l6.096-1.106.622 7.527-10.444 1.882zm11.325-2.712l-.602.115L20.488 0 .789 2.285l2.427 19.693 2.306-.334c-.184-.263-.471-.581-.96-.989-.68-.564-.44-1.522-.039-2.127.53-1.022 3.26-2.322 3.106-3.956-.056-.594-.15-1.368-.702-1.898-.02.22.017.432.017.432s-.227-.289-.34-.683c-.112-.15-.2-.199-.319-.4-.085.233-.073.503-.073.503s-.186-.437-.216-.807c-.11.166-.137.48-.137.48s-.241-.69-.186-1.062c-.11-.323-.436-.965-.343-2.424.6.421 1.924.321 2.44-.439.171-.251.288-.939-.086-2.293-.24-.868-.835-2.16-1.066-2.651l-.028.02c.122.395.374 1.223.47 1.625.293 1.218.372 1.642.234 2.204-.116.488-.397.808-1.107 1.165-.71.358-1.653-.514-1.713-.562-.69-.55-1.224-1.447-1.284-1.883-.062-.477.275-.763.445-1.153-.243.07-.514.192-.514.192s.323-.334.722-.624c.165-.109.262-.178.436-.323a9.762 9.762 0 0 0-.456.003s.42-.227.855-.392c-.318-.014-.623-.003-.623-.003s.937-.419 1.678-.727c.509-.208 1.006-.147 1.286.257.367.53.752.817 1.569.996.501-.223.653-.337 1.284-.509.554-.61.99-.688.99-.688s-.216.198-.274.51c.314-.249.66-.455.66-.455s-.134.164-.259.426l.03.043c.366-.22.797-.394.797-.394s-.123.156-.268.358c.277-.002.838.012 1.056.037 1.285.028 1.552-1.374 2.045-1.55.618-.22.894-.353 1.947.68.903.888 1.609 2.477 1.259 2.833-.294.295-.874-.115-1.516-.916a3.466 3.466 0 0 1-.716-1.562 1.533 1.533 0 0 0-.497-.85s.23.51.23.96c0 .246.03 1.165.424 1.68-.039.076-.057.374-.1.43-.458-.554-1.443-.95-1.604-1.067.544.445 1.793 1.468 2.273 2.449.453.927.186 1.777.416 1.997.065.063.976 1.197 1.15 1.767.306.994.019 2.038-.381 2.685l-1.117.174c-.163-.045-.273-.068-.42-.153.08-.143.241-.5.243-.572l-.063-.111c-.348.492-.93.97-1.414 1.245-.633.359-1.363.304-1.838.156-1.348-.415-2.623-1.327-2.93-1.566 0 0-.01.191.048.234.34.383 1.119 1.077 1.872 1.56l-1.605.177.759 5.908c-.337.048-.39.071-.757.124-.325-1.147-.946-1.895-1.624-2.332-.599-.384-1.424-.47-2.214-.314l-.05.059a2.851 2.851 0 0 1 1.863.444c.654.413 1.181 1.481 1.375 2.124.248.822.42 1.7-.248 2.632-.476.662-1.864 1.028-2.986.237.3.481.705.876 1.25.95.809.11 1.577-.03 2.106-.574.452-.464.69-1.434.628-2.456l.714-.104.258 1.834 11.827-1.424zM15.05 6.848c-.034.075-.085.125-.007.37l.004.014.013.032.032.073c.14.287.295.558.552.696.067-.011.136-.019.207-.023.242-.01.395.028.492.08.009-.048.01-.119.005-.222-.018-.364.072-.982-.626-1.308-.264-.122-.634-.084-.757.068a.302.302 0 0 1 .058.013c.186.066.06.13.027.207m1.958 3.392c-.092-.05-.52-.03-.821.005-.574.068-1.193.267-1.328.372-.247.191-.135.523.047.66.511.382.96.638 1.432.575.29-.038.546-.497.728-.914.124-.288.124-.598-.058-.698m-5.077-2.942c.162-.154-.805-.355-1.556.156-.554.378-.571 1.187-.041 1.646.053.046.096.078.137.104a4.77 4.77 0 0 1 1.396-.412c.113-.125.243-.345.21-.745-.044-.542-.455-.456-.146-.749" />
  </svg>
);

const WebflowMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="Webflow" {...props}>
    <path fill="#146EF5" d="m24 4.515-7.658 14.97H9.149l3.205-6.204h-.144C9.566 16.713 5.621 18.973 0 19.485v-6.118s3.596-.213 5.71-2.435H0V4.515h6.417v5.278l.144-.001 2.622-5.277h4.854v5.244h.144l2.72-5.244H24Z" />
  </svg>
);

const GoogleSheetsMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="Google Sheets" {...props}>
    <path fill="#34A853" d="M11.318 12.545H7.91v-1.909h3.41v1.91zM14.728 0v6h6l-6-6zm1.363 10.636h-3.41v1.91h3.41v-1.91zm0 3.273h-3.41v1.91h3.41v-1.91zM20.727 6.5v15.864c0 .904-.732 1.636-1.636 1.636H4.909a1.636 1.636 0 0 1-1.636-1.636V1.636C3.273.732 4.005 0 4.909 0h9.318v6.5h6.5zm-3.273 2.773H6.545v7.909h10.91v-7.91zm-6.136 4.636H7.91v1.91h3.41v-1.91z" />
  </svg>
);

const PostgreSQLMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="PostgreSQL" {...props}>
    <path fill="#4169E1" d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698zM2.371 11.8765c-.7435-2.4358-1.1779-4.8851-1.2123-5.5719-.1086-2.1714.4171-3.6829 1.5623-4.4927 1.8367-1.2986 4.8398-.5408 6.108-.13-.0032.0032-.0066.0061-.0098.0094-2.0238 2.044-1.9758 5.536-1.9708 5.7495-.0002.0823.0066.1989.0162.3593.0348.5873.0996 1.6804-.0735 2.9184-.1609 1.1504.1937 2.2764.9728 3.0892.0806.0841.1648.1631.2518.2374-.3468.3714-1.1004 1.1926-1.9025 2.1576-.5677.6825-.9597.5517-1.0886.5087-.3919-.1307-.813-.5871-1.2381-1.3223-.4796-.839-.9635-2.0317-1.4155-3.5126zm6.0072 5.0871c-.1711-.0428-.3271-.1132-.4322-.1772.0889-.0394.2374-.0902.4833-.1409 1.2833-.2641 1.4815-.4506 1.9143-1.0002.0992-.126.2116-.2687.3673-.4426a.3549.3549 0 0 0 .0737-.1298c.1708-.1513.2724-.1099.4369-.0417.156.0646.3078.26.3695.4752.0291.1016.0619.2945-.0452.4444-.9043 1.2658-2.2216 1.2494-3.1676 1.0128zm2.094-3.988-.0525.141c-.133.3566-.2567.6881-.3334 1.003-.6674-.0021-1.3168-.2872-1.8105-.8024-.6279-.6551-.9131-1.5664-.7825-2.5004.1828-1.3079.1153-2.4468.079-3.0586-.005-.0857-.0095-.1607-.0122-.2199.2957-.2621 1.6659-.9962 2.6429-.7724.4459.1022.7176.4057.8305.928.5846 2.7038.0774 3.8307-.3302 4.7363-.084.1866-.1633.3629-.2311.5454zm7.3637 4.5725c-.0169.1768-.0358.376-.0618.5959l-.146.4383a.3547.3547 0 0 0-.0182.1077c-.0059.4747-.054.6489-.115.8693-.0634.2292-.1353.4891-.1794 1.0575-.11 1.4143-.8782 2.2267-2.4172 2.5565-1.5155.3251-1.7843-.4968-2.0212-1.2217a6.5824 6.5824 0 0 0-.0769-.2266c-.2154-.5858-.1911-1.4119-.1574-2.5551.0165-.5612-.0249-1.9013-.3302-2.6462.0044-.2932.0106-.5909.019-.8918a.3529.3529 0 0 0-.0153-.1126 1.4927 1.4927 0 0 0-.0439-.208c-.1226-.4283-.4213-.7866-.7797-.9351-.1424-.059-.4038-.1672-.7178-.0869.067-.276.1831-.5875.309-.9249l.0529-.142c.0595-.16.134-.3257.213-.5012.4265-.9476 1.0106-2.2453.3766-5.1772-.2374-1.0981-1.0304-1.6343-2.2324-1.5098-.7207.0746-1.3799.3654-1.7088.5321a5.6716 5.6716 0 0 0-.1958.1041c.0918-1.1064.4386-3.1741 1.7357-4.4823a4.0306 4.0306 0 0 1 .3033-.276.3532.3532 0 0 0 .1447-.0644c.7524-.5706 1.6945-.8506 2.802-.8325.4091.0067.8017.0339 1.1742.081 1.939.3544 3.2439 1.4468 4.0359 2.3827.8143.9623 1.2552 1.9315 1.4312 2.4543-1.3232-.1346-2.2234.1268-2.6797.779-.9926 1.4189.543 4.1729 1.2811 5.4964.1353.2426.2522.4522.2889.5413.2403.5825.5515.9713.7787 1.2552.0696.087.1372.1714.1885.245-.4008.1155-1.1208.3825-1.0552 1.717-.0123.1563-.0423.4469-.0834.8148-.0461.2077-.0702.4603-.0994.7662zm.8905-1.6211c-.0405-.8316.2691-.9185.5967-1.0105a2.8566 2.8566 0 0 0 .135-.0406 1.202 1.202 0 0 0 .1342.103c.5703.3765 1.5823.4213 3.0068.1344-.2016.1769-.5189.3994-.9533.6011-.4098.1903-1.0957.333-1.7473.3636-.7197.0336-1.0859-.0807-1.1721-.151zm.5695-9.2712c-.0059.3508-.0542.6692-.1054 1.0017-.055.3576-.112.7274-.1264 1.1762-.0142.4368.0404.8909.0932 1.3301.1066.887.216 1.8003-.2075 2.7014a3.5272 3.5272 0 0 1-.1876-.3856c-.0527-.1276-.1669-.3326-.3251-.6162-.6156-1.1041-2.0574-3.6896-1.3193-4.7446.3795-.5427 1.3408-.5661 2.1781-.463zm.2284 7.0137a12.3762 12.3762 0 0 0-.0853-.1074l-.0355-.0444c.7262-1.1995.5842-2.3862.4578-3.4385-.0519-.4318-.1009-.8396-.0885-1.2226.0129-.4061.0666-.7543.1185-1.0911.0639-.415.1288-.8443.1109-1.3505.0134-.0531.0188-.1158.0118-.1902-.0457-.4855-.5999-1.938-1.7294-3.253-.6076-.7073-1.4896-1.4972-2.6889-2.0395.5251-.1066 1.2328-.2035 2.0244-.1859 2.0515.0456 3.6746.8135 4.8242 2.2824a.908.908 0 0 1 .0667.1002c.7231 1.3556-.2762 6.2751-2.9867 10.5405zm-8.8166-6.1162c-.025.1794-.3089.4225-.6211.4225a.5821.5821 0 0 1-.0809-.0056c-.1873-.026-.3765-.144-.5059-.3156-.0458-.0605-.1203-.178-.1055-.2844.0055-.0401.0261-.0985.0925-.1488.1182-.0894.3518-.1226.6096-.0867.3163.0441.6426.1938.6113.4186zm7.9305-.4114c.0111.0792-.049.201-.1531.3102-.0683.0717-.212.1961-.4079.2232a.5456.5456 0 0 1-.075.0052c-.2935 0-.5414-.2344-.5607-.3717-.024-.1765.2641-.3106.5611-.352.297-.0414.6111.0088.6356.1851z" />
  </svg>
);

const OktaMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="Okta" {...props}>
    <path fill="#007DC1" d="M12 0C5.389 0 0 5.35 0 12s5.35 12 12 12 12-5.35 12-12S18.611 0 12 0zm0 18c-3.325 0-6-2.675-6-6s2.675-6 6-6 6 2.675 6 6-2.675 6-6 6z" />
  </svg>
);

const ClaudeMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" fill="#D97757" role="img" aria-label="Claude" {...props}>
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
  </svg>
);

const OpenAIMark = (props: MarkProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="OpenAI" {...props}>
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>
);

const GeminiMark = (props: MarkProps) => {
  const id = useId();
  return (
  <svg viewBox="0 0 24 24" role="img" aria-label="Gemini" {...props}>
    <path fill="#3186FF" d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" />
    <path fill={`url(#lobe-icons-gemini-0-${id})`} d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" />
    <path fill={`url(#lobe-icons-gemini-1-${id})`} d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" />
    <path fill={`url(#lobe-icons-gemini-2-${id})`} d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" />
      <defs>
        <linearGradient id={`lobe-icons-gemini-0-${id}`} x1="7" y1="15.5" x2="11" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`lobe-icons-gemini-1-${id}`} x1="8" y1="5.5" x2="11.5" y2="11" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`lobe-icons-gemini-2-${id}`} x1="3.5" y1="13.5" x2="17.5" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
  </svg>
);
};

const NorthwindMark = (props: MarkProps) => {
  const id = useId();
  return (
  <svg viewBox="0 0 24 24" width={16} height={16} role="img" aria-label="Northwind" {...props}>
      <defs>
        <linearGradient id={`${id}-light`} x1="8" y1="3" x2="8" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".42" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".72" />
        </linearGradient>
        <linearGradient id={`${id}-dark`} x1="16" y1="3" x2="16" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" stopOpacity=".88" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".55" />
        </linearGradient>
      </defs>
    <path fill={`url(#${id}-light)`} d="M12 2.5 4.75 20.75 12 16.9Z" />
    <path fill={`url(#${id}-dark)`} d="M12 2.5 19.25 20.75 12 16.9Z" />
  </svg>
);
};

/* ---------------------------------------------------------------- samples */

export const defaultCategories = ["Sales", "Support", "Engineering", "Marketing", "Ops"];

export const defaultWorkspaces: AgentWorkspace[] = [
  { id: "northwind", name: "Northwind", detail: "Business · 48 seats", mark: <NorthwindMark aria-hidden="true" /> },
  { id: "northwind-sandbox", name: "Northwind sandbox", detail: "Test data", mark: <NorthwindMark aria-hidden="true" /> },
];

export const defaultAgents: AgentTemplate[] = [
  {
    id: "lead-qualifier",
    name: "Lead qualifier",
    job: "Scores inbound demo requests and routes hot leads to the right rep.",
    category: "Sales",
    apps: [
      { id: "hubspot", name: "HubSpot", mark: <HubSpotMark />, scope: "Read and update contacts and deals" },
      { id: "slack", name: "Slack", mark: <SlackMark />, scope: "Post in the channels you pick" },
      { id: "gmail", name: "Gmail", mark: <GmailMark />, scope: "Draft email for your review" },
    ],
    model: { name: "Claude Sonnet 5.5", mark: <ClaudeMark /> },
    rating: 4.9,
    installs: 18200,
    preview: [
      { source: "HubSpot", mark: <HubSpotMark />, text: "New demo request from Priya Shah, Lattice" },
      { source: "Claude Sonnet 5.5", mark: <ClaudeMark />, text: "Scored 86: 240 seats, fits your ideal profile" },
      { source: "Slack", mark: <SlackMark />, text: "Sent to #hot-leads and assigned to Dana Kim" },
    ],
  },
  {
    id: "meeting-prep",
    name: "Meeting prep",
    job: "Briefs the account owner 30 minutes before every customer call.",
    category: "Sales",
    apps: [
      { id: "google-calendar", name: "Google Calendar", mark: <GoogleCalendarMark />, scope: "Read your calendar events" },
      { id: "hubspot", name: "HubSpot", mark: <HubSpotMark />, scope: "Read and update contacts and deals" },
      { id: "notion", name: "Notion", mark: <NotionMark />, scope: "Read and edit pages you share" },
    ],
    model: { name: "GPT-6.1 Sol", mark: <OpenAIMark /> },
    rating: 4.8,
    installs: 11700,
    preview: [
      { source: "Google Calendar", mark: <GoogleCalendarMark />, text: "Renewal call with Ramp at 2:30 PM" },
      { source: "HubSpot", mark: <HubSpotMark />, text: "Pulled 3 open deals and last 5 emails" },
      { source: "Notion", mark: <NotionMark />, text: "Brief ready: risks, champions, asks" },
    ],
  },
  {
    id: "follow-up-writer",
    name: "Follow-up writer",
    job: "Drafts a recap with next steps as soon as each call ends.",
    category: "Sales",
    apps: [
      { id: "gmail", name: "Gmail", mark: <GmailMark />, scope: "Draft email for your review" },
      { id: "hubspot", name: "HubSpot", mark: <HubSpotMark />, scope: "Read and update contacts and deals" },
    ],
    model: { name: "Claude Haiku 5.5", mark: <ClaudeMark /> },
    rating: 4.7,
    installs: 9400,
    preview: [
      { source: "HubSpot", mark: <HubSpotMark />, text: "Call with Vanta ended, notes attached" },
      { source: "Claude Haiku 5.5", mark: <ClaudeMark />, text: "Found 3 next steps and 1 open question" },
      { source: "Gmail", mark: <GmailMark />, text: "Recap drafted to Marcus Lee for review" },
    ],
  },
  {
    id: "renewal-watch",
    name: "Renewal watch",
    job: "Flags accounts with falling usage 60 days before renewal.",
    category: "Sales",
    apps: [
      { id: "stripe", name: "Stripe", mark: <StripeMark />, scope: "Read customers, invoices and refunds" },
      { id: "hubspot", name: "HubSpot", mark: <HubSpotMark />, scope: "Read and update contacts and deals" },
      { id: "slack", name: "Slack", mark: <SlackMark />, scope: "Post in the channels you pick" },
    ],
    model: { name: "Gemini 4 Argon", mark: <GeminiMark /> },
    rating: 4.6,
    installs: 5100,
    preview: [
      { source: "Stripe", mark: <StripeMark />, text: "Brex renews Dec 24 at $86,400 a year" },
      { source: "Gemini 4 Argon", mark: <GeminiMark />, text: "Weekly active seats down 31% since Sept" },
      { source: "Slack", mark: <SlackMark />, text: "Flagged in #renewals for Ana Ruiz" },
    ],
  },
  {
    id: "ticket-triage",
    name: "Ticket triage",
    job: "Tags, prioritizes and routes new tickets to the right queue.",
    category: "Support",
    apps: [
      { id: "zendesk", name: "Zendesk", mark: <ZendeskMark />, scope: "Read, tag and assign tickets" },
      { id: "slack", name: "Slack", mark: <SlackMark />, scope: "Post in the channels you pick" },
    ],
    model: { name: "Claude Haiku 5.5", mark: <ClaudeMark /> },
    rating: 4.9,
    installs: 24600,
    preview: [
      { source: "Zendesk", mark: <ZendeskMark />, text: "Ticket #48213: SSO login loop after update" },
      { source: "Claude Haiku 5.5", mark: <ClaudeMark />, text: "Tagged auth, priority high, queue Tier 2" },
      { source: "Slack", mark: <SlackMark />, text: "Posted to #support-escalations" },
    ],
  },
  {
    id: "reply-drafter",
    name: "Reply drafter",
    job: "Writes first replies from your help center, ready for review.",
    category: "Support",
    apps: [
      { id: "intercom", name: "Intercom", mark: <IntercomMark />, scope: "Read conversations and draft replies" },
      { id: "notion", name: "Notion", mark: <NotionMark />, scope: "Read and edit pages you share" },
    ],
    model: { name: "Claude Sonnet 5.5", mark: <ClaudeMark /> },
    rating: 4.8,
    installs: 16300,
    preview: [
      { source: "Intercom", mark: <IntercomMark />, text: "How do I export invoices as CSV?" },
      { source: "Notion", mark: <NotionMark />, text: "Matched help article Billing exports" },
      { source: "Claude Sonnet 5.5", mark: <ClaudeMark />, text: "Draft reply ready for your review" },
    ],
  },
  {
    id: "refund-handler",
    name: "Refund handler",
    job: "Checks the order and refunds anything under your policy limit.",
    category: "Support",
    apps: [
      { id: "stripe", name: "Stripe", mark: <StripeMark />, scope: "Read customers, invoices and refunds" },
      { id: "zendesk", name: "Zendesk", mark: <ZendeskMark />, scope: "Read, tag and assign tickets" },
    ],
    model: { name: "GPT-6.1 Sol", mark: <OpenAIMark /> },
    rating: 4.7,
    installs: 6800,
    preview: [
      { source: "Zendesk", mark: <ZendeskMark />, text: "Charged twice for the October invoice" },
      { source: "Stripe", mark: <StripeMark />, text: "Found duplicate charge of $49.00" },
      { source: "GPT-6.1 Sol", mark: <OpenAIMark />, text: "Refund issued, under your $200 limit" },
    ],
  },
  {
    id: "bug-reporter",
    name: "Bug reporter",
    job: "Turns confirmed bug reports into Linear issues with repro steps.",
    category: "Support",
    apps: [
      { id: "intercom", name: "Intercom", mark: <IntercomMark />, scope: "Read conversations and draft replies" },
      { id: "linear", name: "Linear", mark: <LinearMark />, scope: "Create and update issues" },
    ],
    model: { name: "Claude Sonnet 5.5", mark: <ClaudeMark /> },
    rating: 4.8,
    installs: 8900,
    preview: [
      { source: "Intercom", mark: <IntercomMark />, text: "4 customers report blank PDF exports" },
      { source: "Claude Sonnet 5.5", mark: <ClaudeMark />, text: "Wrote repro steps for Safari 19" },
      { source: "Linear", mark: <LinearMark />, text: "Filed ENG-2417 and linked 4 chats" },
    ],
  },
  {
    id: "pr-reviewer",
    name: "PR reviewer",
    job: "Reviews every pull request and comments on risky changes.",
    category: "Engineering",
    apps: [
      { id: "github", name: "GitHub", mark: <GitHubMark />, scope: "Read code and comment on pull requests" },
      { id: "slack", name: "Slack", mark: <SlackMark />, scope: "Post in the channels you pick" },
    ],
    model: { name: "Claude Opus 5.5", mark: <ClaudeMark /> },
    rating: 4.9,
    installs: 31400,
    preview: [
      { source: "GitHub", mark: <GitHubMark />, text: "PR #1842 opened: Move billing to queues" },
      { source: "Claude Opus 5.5", mark: <ClaudeMark />, text: "Found a missing retry on webhook failures" },
      { source: "GitHub", mark: <GitHubMark />, text: "Left 2 comments and requested changes" },
    ],
  },
  {
    id: "incident-responder",
    name: "Incident responder",
    job: "Summarizes error spikes and pages the on call engineer.",
    category: "Engineering",
    apps: [
      { id: "sentry", name: "Sentry", mark: <SentryMark />, scope: "Read issues and events" },
      { id: "datadog", name: "Datadog", mark: <DatadogMark />, scope: "Read monitors and metrics" },
      { id: "slack", name: "Slack", mark: <SlackMark />, scope: "Post in the channels you pick" },
    ],
    model: { name: "Claude Sonnet 5.5", mark: <ClaudeMark /> },
    rating: 4.8,
    installs: 12100,
    preview: [
      { source: "Sentry", mark: <SentryMark />, text: "TypeError in checkout up 12x in 10 min" },
      { source: "Datadog", mark: <DatadogMark />, text: "p95 latency on api-payments at 2.4s" },
      { source: "Slack", mark: <SlackMark />, text: "Paged Sam Ortiz with a summary" },
    ],
  },
  {
    id: "issue-groomer",
    name: "Issue groomer",
    job: "Dedupes, labels and sizes new issues every morning.",
    category: "Engineering",
    apps: [
      { id: "linear", name: "Linear", mark: <LinearMark />, scope: "Create and update issues" },
      { id: "github", name: "GitHub", mark: <GitHubMark />, scope: "Read code and comment on pull requests" },
    ],
    model: { name: "Gemini 3.8 Flash", mark: <GeminiMark /> },
    rating: 4.6,
    installs: 7300,
    preview: [
      { source: "Linear", mark: <LinearMark />, text: "14 new issues since yesterday" },
      { source: "Gemini 3.8 Flash", mark: <GeminiMark />, text: "Merged 3 duplicates, sized the rest" },
      { source: "Linear", mark: <LinearMark />, text: "Labeled and moved to Triage" },
    ],
  },
  {
    id: "release-notes",
    name: "Release notes",
    job: "Writes changelog entries from merged pull requests.",
    category: "Engineering",
    apps: [
      { id: "github", name: "GitHub", mark: <GitHubMark />, scope: "Read code and comment on pull requests" },
      { id: "notion", name: "Notion", mark: <NotionMark />, scope: "Read and edit pages you share" },
    ],
    model: { name: "GPT-6 Luna", mark: <OpenAIMark /> },
    rating: 4.7,
    installs: 10200,
    preview: [
      { source: "GitHub", mark: <GitHubMark />, text: "Release v4.12.0 tagged with 23 PRs" },
      { source: "GPT-6 Luna", mark: <OpenAIMark />, text: "Grouped into 5 features and 9 fixes" },
      { source: "Notion", mark: <NotionMark />, text: "Changelog draft added to Releases" },
    ],
  },
  {
    id: "blog-drafter",
    name: "Blog drafter",
    job: "Turns briefs into SEO ready drafts in your brand voice.",
    category: "Marketing",
    apps: [
      { id: "notion", name: "Notion", mark: <NotionMark />, scope: "Read and edit pages you share" },
      { id: "webflow", name: "Webflow", mark: <WebflowMark />, scope: "Create CMS drafts, never publish" },
    ],
    model: { name: "Claude Sonnet 5.5", mark: <ClaudeMark /> },
    rating: 4.7,
    installs: 13500,
    preview: [
      { source: "Notion", mark: <NotionMark />, text: "Brief: How we cut onboarding to 3 days" },
      { source: "Claude Sonnet 5.5", mark: <ClaudeMark />, text: "Wrote 1,450 words with 4 sections" },
      { source: "Webflow", mark: <WebflowMark />, text: "Saved as a CMS draft, not published" },
    ],
  },
  {
    id: "campaign-reporter",
    name: "Campaign reporter",
    job: "Sends a weekly digest of spend, signups and CAC by channel.",
    category: "Marketing",
    apps: [
      { id: "google-sheets", name: "Google Sheets", mark: <GoogleSheetsMark />, scope: "Edit the sheets you choose" },
      { id: "hubspot", name: "HubSpot", mark: <HubSpotMark />, scope: "Read and update contacts and deals" },
      { id: "slack", name: "Slack", mark: <SlackMark />, scope: "Post in the channels you pick" },
    ],
    model: { name: "Gemini 4 Argon", mark: <GeminiMark /> },
    rating: 4.6,
    installs: 6200,
    preview: [
      { source: "Google Sheets", mark: <GoogleSheetsMark />, text: "Read spend for Oct 20 to Oct 26" },
      { source: "HubSpot", mark: <HubSpotMark />, text: "Matched 312 signups to 6 channels" },
      { source: "Slack", mark: <SlackMark />, text: "Digest posted to #growth" },
    ],
  },
  {
    id: "launch-planner",
    name: "Launch planner",
    job: "Builds the launch checklist and chases owners until ship day.",
    category: "Marketing",
    apps: [
      { id: "notion", name: "Notion", mark: <NotionMark />, scope: "Read and edit pages you share" },
      { id: "linear", name: "Linear", mark: <LinearMark />, scope: "Create and update issues" },
      { id: "slack", name: "Slack", mark: <SlackMark />, scope: "Post in the channels you pick" },
    ],
    model: { name: "GPT-6.1 Sol", mark: <OpenAIMark /> },
    rating: 4.6,
    installs: 4400,
    preview: [
      { source: "Notion", mark: <NotionMark />, text: "Launch brief: Workflows 2.0 on Nov 12" },
      { source: "Linear", mark: <LinearMark />, text: "Created 18 tasks across 4 teams" },
      { source: "Slack", mark: <SlackMark />, text: "Reminded 3 owners with tasks due" },
    ],
  },
  {
    id: "lead-nurture",
    name: "Lead nurture",
    job: "Writes and sends follow up sequences to new signups.",
    category: "Marketing",
    apps: [
      { id: "hubspot", name: "HubSpot", mark: <HubSpotMark />, scope: "Read and update contacts and deals" },
      { id: "gmail", name: "Gmail", mark: <GmailMark />, scope: "Draft email for your review" },
    ],
    model: { name: "Claude Haiku 5.5", mark: <ClaudeMark /> },
    rating: 4.7,
    installs: 8100,
    preview: [
      { source: "HubSpot", mark: <HubSpotMark />, text: "41 trial signups this week" },
      { source: "Claude Haiku 5.5", mark: <ClaudeMark />, text: "Picked a sequence by role and company size" },
      { source: "Gmail", mark: <GmailMark />, text: "Queued 41 drafts for approval" },
    ],
  },
  {
    id: "invoice-chaser",
    name: "Invoice chaser",
    job: "Sends polite reminders for overdue invoices and logs replies.",
    category: "Ops",
    apps: [
      { id: "stripe", name: "Stripe", mark: <StripeMark />, scope: "Read customers, invoices and refunds" },
      { id: "gmail", name: "Gmail", mark: <GmailMark />, scope: "Draft email for your review" },
      { id: "google-sheets", name: "Google Sheets", mark: <GoogleSheetsMark />, scope: "Edit the sheets you choose" },
    ],
    model: { name: "Claude Haiku 5.5", mark: <ClaudeMark /> },
    rating: 4.8,
    installs: 9900,
    preview: [
      { source: "Stripe", mark: <StripeMark />, text: "INV-2093 for $12,400 is 9 days overdue" },
      { source: "Gmail", mark: <GmailMark />, text: "Reminder drafted to the billing contact" },
      { source: "Google Sheets", mark: <GoogleSheetsMark />, text: "Logged in AR tracker, row 214" },
    ],
  },
  {
    id: "onboarding-buddy",
    name: "Onboarding buddy",
    job: "Sets up tools and a first week plan for every new hire.",
    category: "Ops",
    apps: [
      { id: "notion", name: "Notion", mark: <NotionMark />, scope: "Read and edit pages you share" },
      { id: "slack", name: "Slack", mark: <SlackMark />, scope: "Post in the channels you pick" },
      { id: "google-calendar", name: "Google Calendar", mark: <GoogleCalendarMark />, scope: "Read your calendar events" },
    ],
    model: { name: "GPT-6 Luna", mark: <OpenAIMark /> },
    rating: 4.7,
    installs: 7600,
    preview: [
      { source: "Notion", mark: <NotionMark />, text: "Lena Fischer starts Monday in Design" },
      { source: "Google Calendar", mark: <GoogleCalendarMark />, text: "Booked 6 intro meetings in week one" },
      { source: "Slack", mark: <SlackMark />, text: "Added to 5 channels with a welcome note" },
    ],
  },
  {
    id: "data-janitor",
    name: "Data janitor",
    job: "Finds duplicate and stale records in your database every night.",
    category: "Ops",
    apps: [
      { id: "postgresql", name: "PostgreSQL", mark: <PostgreSQLMark />, scope: "Read only access to one database" },
      { id: "slack", name: "Slack", mark: <SlackMark />, scope: "Post in the channels you pick" },
    ],
    model: { name: "Gemini 3.8 Flash", mark: <GeminiMark /> },
    rating: 4.5,
    installs: 3200,
    preview: [
      { source: "PostgreSQL", mark: <PostgreSQLMark />, text: "Scanned 1.2M rows in customers" },
      { source: "Gemini 3.8 Flash", mark: <GeminiMark />, text: "Found 318 likely duplicates" },
      { source: "Slack", mark: <SlackMark />, text: "Review list posted to #data-quality" },
    ],
  },
  {
    id: "access-reviewer",
    name: "Access reviewer",
    job: "Audits who can reach which apps every quarter.",
    category: "Ops",
    apps: [
      { id: "okta", name: "Okta", mark: <OktaMark />, scope: "Read users, groups and app access" },
      { id: "github", name: "GitHub", mark: <GitHubMark />, scope: "Read code and comment on pull requests" },
      { id: "slack", name: "Slack", mark: <SlackMark />, scope: "Post in the channels you pick" },
    ],
    model: { name: "Claude Opus 5.5", mark: <ClaudeMark /> },
    rating: 4.8,
    installs: 5700,
    preview: [
      { source: "Okta", mark: <OktaMark />, text: "Checked 212 users across 34 apps" },
      { source: "GitHub", mark: <GitHubMark />, text: "7 people who left still have access" },
      { source: "Slack", mark: <SlackMark />, text: "Sent the Q4 review to #it-security" },
    ],
  },
];

/* ---------------------------------------------------------------- helpers */

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" ");

/** An abortable timeout: the install sequence waits between apps and must stop on cancel. */
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** Every whitespace token of the query must appear in the name, job, model or app names. */
function matchesQuery(agent: AgentTemplate, query: string) {
  if (!query) return true;
  const haystack = [agent.name, agent.job, agent.model.name, ...agent.apps.map((app) => app.name)].join(" ").toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function sentence(names: string[]) {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function formatInstalls(installs: number) {
  if (installs < 1000) return String(installs);
  return `${(installs / 1000).toFixed(installs >= 100000 ? 0 : 1).replace(/\.0$/, "")}k`;
}

/* --------------------------------------------------------------- gallery */

export function AgentGallery({
  agents = defaultAgents,
  categories = defaultCategories,
  category,
  defaultCategory,
  onCategoryChange,
  query,
  defaultQuery = "",
  onQueryChange,
  workspaces = defaultWorkspaces,
  installed,
  defaultInstalled,
  onInstalledChange,
  onInstall,
  onPreview,
  onOpen,
  title = "Agent templates",
  description = "Ready made agents that work in the tools your team already uses.",
  className,
}: AgentGalleryProps) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();

  const [ownCategory, setOwnCategory] = useState(defaultCategory ?? categories[0] ?? "");
  const activeCategory = category ?? ownCategory;
  const selectCategory = useCallback(
    (next: string) => {
      if (category === undefined) setOwnCategory(next);
      onCategoryChange?.(next);
    },
    [category, onCategoryChange],
  );

  const [ownQuery, setOwnQuery] = useState(defaultQuery);
  const activeQuery = query ?? ownQuery;
  const changeQuery = useCallback(
    (next: string) => {
      if (query === undefined) setOwnQuery(next);
      onQueryChange?.(next);
    },
    [query, onQueryChange],
  );

  const [ownInstalled, setOwnInstalled] = useState<string[]>(defaultInstalled ?? []);
  const installedIds = installed ?? ownInstalled;
  /** Workspace each agent landed in during this session, so the done step can name it. */
  const [installedIn, setInstalledIn] = useState<Record<string, string>>({});
  const markInstalled = useCallback(
    (agent: AgentTemplate, workspace: AgentWorkspace) => {
      setInstalledIn(current => ({ ...current, [agent.id]: workspace.name }));
      if (installedIds.includes(agent.id)) return;
      const next = [...installedIds, agent.id];
      if (installed === undefined) setOwnInstalled(next);
      onInstalledChange?.(next);
    },
    [installedIds, installed, onInstalledChange],
  );

  const [status, setStatus] = useState("");
  const trimmed = activeQuery.trim();
  const visible = useMemo(() => agents.filter(agent => agent.category === activeCategory && matchesQuery(agent, trimmed)), [agents, activeCategory, trimmed]);
  const suggestion = useMemo(() => {
    if (!trimmed || visible.length) return null;
    const counts = new Map<string, number>();
    for (const agent of agents) {
      if (agent.category === activeCategory || !matchesQuery(agent, trimmed)) continue;
      counts.set(agent.category, (counts.get(agent.category) ?? 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return best ? { category: best[0], count: best[1] } : null;
  }, [agents, activeCategory, trimmed, visible.length]);

  // Announce results after a change, but not on the first render. The signature also keeps the
  // dev-only double effect (StrictMode) from announcing the initial state, which the shipped
  // production build never renders.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    const signature = `${activeCategory}\u0000${trimmed}\u0000${visible.length}`;
    if (announced.current === null) {
      announced.current = signature;
      return;
    }
    if (announced.current === signature) return;
    announced.current = signature;
    const noun = visible.length === 1 ? "agent" : "agents";
    setStatus(trimmed ? `${visible.length} ${activeCategory} ${noun} match ${trimmed}` : `${visible.length} ${activeCategory} ${noun}`);
  }, [activeCategory, trimmed, visible.length]);

  // The grid's height springs to the new row count; a resize (or reduced motion) jumps instead.
  const height = useMotionValue<number | "auto">("auto");
  const innerRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let lastInline = -1;
    const observer = new ResizeObserver(entries => {
      const [entry] = entries;
      if (!entry) return;
      const block = entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight;
      const inline = entry.borderBoxSize?.[0]?.inlineSize ?? node.offsetWidth;
      if (reduced || inline !== lastInline) height.jump(block);
      else animate(height, block, SPRING_SOFT);
      lastInline = inline;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [innerRef, reduced, height]);

  const runInstall = onInstall ?? ((_agent: AgentTemplate, _workspace: AgentWorkspace, signal: AbortSignal) => wait(1200, signal));

  return (
    <section className={cx(styles.root, className)} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <SearchBox value={activeQuery} onChange={changeQuery} reduced={reduced} />
      </header>
      <Chips categories={categories} value={activeCategory} onChange={selectCategory} reduced={reduced} />
      <motion.div className={styles.viewport} style={{ height }}>
        <div ref={innerRef} className={styles.inner}>
          <ul className={styles.grid} role="list" aria-label={`${activeCategory} agents`}>
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((agent, index) => (
                <motion.li
                  key={agent.id}
                  className={styles.cell}
                  layout={!reduced && "position"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.09 * Number(!reduced), ease: EASE } }}
                  transition={{
                    layout: SPRING_SOFT,
                    opacity: { duration: 0.16 * Number(!reduced), delay: reduced ? 0 : 0.05 + 0.03 * Math.min(index, 3), ease: EASE },
                  }}
                >
                  <Card
                    agent={agent}
                    workspaces={workspaces}
                    installed={installedIds.includes(agent.id)}
                    installedIn={installedIn[agent.id]}
                    runInstall={runInstall}
                    simulated={!onInstall}
                    onInstalled={markInstalled}
                    onPreview={onPreview}
                    onOpen={onOpen}
                    notify={setStatus}
                    reduced={reduced}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <AnimatePresence initial={false}>
            {visible.length === 0 ? (
              <motion.div
                key="empty"
                className={styles.empty}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.16, delay: 0.06 * Number(!reduced), ease: EASE } }}
                exit={{ opacity: 0, transition: { duration: 0.09 } }}
              >
                <Search className={styles.emptyIcon} aria-hidden="true" />
                <p className={styles.emptyTitle}>{trimmed ? `No ${activeCategory} agents match “${trimmed}”` : `No ${activeCategory} agents yet`}</p>
                <p className={styles.emptyText}>
                  {suggestion
                    ? `${suggestion.count} ${suggestion.count === 1 ? "match" : "matches"} in ${suggestion.category}.`
                    : trimmed
                      ? "Try an app name, like Slack or GitHub."
                      : "Check back soon."}
                </p>
                {suggestion ? (
                  <Button size="sm" variant="secondary" onClick={() => selectCategory(suggestion.category)}>
                    Show in {suggestion.category}
                  </Button>
                ) : trimmed ? (
                  <Button size="sm" variant="secondary" onClick={() => changeQuery("")}>
                    Clear search
                  </Button>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- search */

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  reduced: boolean;
}

function SearchBox({ value, onChange, reduced }: SearchBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className={styles.search}>
      <Search className={styles.searchIcon} aria-hidden="true" />
      <input
        ref={inputRef}
        className={styles.searchInput}
        type="search"
        value={value}
        placeholder="Search agents or apps"
        aria-label="Search agents"
        spellCheck={false}
        autoComplete="off"
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
      />
      <AnimatePresence initial={false}>
        {value ? (
          <motion.button
            key="clear"
            type="button"
            className={styles.clear}
            aria-label="Clear search"
            initial={{ opacity: 0, scale: reduced ? 1 : 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.8, transition: { duration: 0.1 } }}
            transition={{ ...SPRING_TIGHT, opacity: { duration: 0.12 } }}
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
          >
            <X aria-hidden="true" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------------------------------------------- chips */

interface ChipsProps {
  categories: string[];
  value: string;
  onChange: (category: string) => void;
  reduced: boolean;
}

function Chips({ categories, value, onChange, reduced }: ChipsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, categories.indexOf(value));
  return (
    <div className={styles.chipScroller}>
      <div
        className={styles.chips}
        role="radiogroup"
        aria-label="Team"
        onKeyDown={event => {
          const last = categories.length - 1;
          const next =
            event.key === "ArrowRight" || event.key === "ArrowDown"
              ? index === last
                ? 0
                : index + 1
              : event.key === "ArrowLeft" || event.key === "ArrowUp"
                ? index === 0
                  ? last
                  : index - 1
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? last
                    : -1;
          if (next < 0) return;
          event.preventDefault();
          onChange(categories[next]);
          refs.current[next]?.focus();
          refs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
        }}
      >
        {categories.map((category, position) => {
          const selected = position === index;
          return (
            <button
              key={category}
              ref={node => {
                refs.current[position] = node;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={styles.chip}
              data-selected={selected || undefined}
              onClick={() => onChange(category)}
            >
              {selected ? <motion.span layoutId="agent-gallery-chip" className={styles.chipHighlight} transition={reduced ? { duration: 0 } : SPRING_TIGHT} /> : null}
              <span className={styles.chipLabel}>{category}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ view */

interface ViewProps {
  name: CardView;
  reduced: boolean;
  children: ReactNode;
}

/** One card step. Steps crossfade in place, and a leaving step is inert. */
function View({ name, reduced, children }: ViewProps) {
  const present = useIsPresent();
  return (
    <motion.div
      className={styles.view}
      data-view={name}
      inert={!present || undefined}
      initial={{ opacity: 0, y: 2 * Number(!reduced) }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.16 * Number(!reduced), delay: 0.04 * Number(!reduced), ease: EASE } }}
      exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced), ease: EASE } }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ card */

interface CardProps {
  agent: AgentTemplate;
  workspaces: AgentWorkspace[];
  installed: boolean;
  installedIn?: string;
  runInstall: (agent: AgentTemplate, workspace: AgentWorkspace, signal: AbortSignal) => Promise<void>;
  simulated: boolean;
  onInstalled: (agent: AgentTemplate, workspace: AgentWorkspace) => void;
  onPreview?: (agent: AgentTemplate) => void;
  onOpen?: (agent: AgentTemplate) => void;
  notify: (message: string) => void;
  reduced: boolean;
}

function Card({ agent, workspaces, installed, installedIn, runInstall, simulated, onInstalled, onPreview, onOpen, notify, reduced }: CardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [view, setView] = useState<CardView>("idle");
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [status, setStatus] = useState<InstallStatus>("ready");
  const [progress, setProgress] = useState(0);
  const [landed, setLanded] = useState<string | undefined>(installedIn);
  const controller = useRef<AbortController | null>(null);
  const focusPending = useRef(false);
  const workspace = workspaces.find(item => item.id === workspaceId) ?? workspaces[0];
  const steps = workspaces.length > 1 ? 2 : 1;
  const appsText = sentence(agent.apps.map(app => app.name));

  useEffect(() => () => controller.current?.abort(), []);

  // A step change made by the person moves focus to that step's main control.
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    const frame = requestAnimationFrame(() =>
      cardRef.current?.querySelector<HTMLElement>(`[data-view="${view}"] [data-autofocus]`)?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [view]);

  const show = (next: CardView) => {
    focusPending.current = true;
    setView(next);
  };

  const reset = () => {
    controller.current?.abort();
    setStatus("ready");
    setProgress(0);
  };

  const back = () => {
    reset();
    show("idle");
  };

  const startInstall = () => {
    reset();
    show(steps > 1 ? "workspace" : "grant");
  };

  const open = () => {
    onOpen?.(agent);
    if (!onOpen) notify(`Opening ${agent.name}. Simulated, nothing was opened.`);
  };

  const connect = async () => {
    if (!workspace) return;
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setStatus("connecting");
    setProgress(0);
    notify(`Connecting ${appsText}`);
    const install = Promise.resolve()
      .then(() => runInstall(agent, workspace, next.signal))
      .then(
        () => null,
        (error: unknown) => (error instanceof Error ? error : new Error("Install failed")) as Error | null,
      );
    try {
      for (let connected = 1; connected < agent.apps.length; connected++) {
        await wait(340 * Number(!reduced), next.signal);
        setProgress(connected);
      }
      const failure = await install;
      if (next.signal.aborted) return;
      if (failure) {
        setStatus("error");
        notify(`${agent.name} could not be installed. ${failure.message || "Try again."}`);
        return;
      }
      setProgress(agent.apps.length);
      await wait(280 * Number(!reduced), next.signal);
      setStatus("ready");
      setLanded(workspace.name);
      onInstalled(agent, workspace);
      show("done");
      notify(`${agent.name} installed in ${workspace.name}.${simulated ? " Simulated, nothing was connected." : ""}`);
    } catch {
      // The signal aborted between steps: cancel() already reset the card.
    }
  };

  const cancel = () => {
    reset();
    notify("Install canceled");
  };

  const marked = installed || Boolean(landed);

  return (
    <article
      ref={cardRef}
      className={styles.card}
      data-view={view}
      data-installed={marked || undefined}
      aria-label={agent.name}
      onKeyDown={event => {
        if (event.key !== "Escape" || view === "idle") return;
        event.stopPropagation();
        if (status === "connecting") cancel();
        else back();
      }}
    >
      <AnimatePresence initial={false}>
        {view === "idle" ? (
          <View key="idle" name="idle" reduced={reduced}>
            <div className={styles.top}>
              <span className={styles.apps} aria-hidden="true">
                {agent.apps.map(app => (
                  <span key={app.id} className={styles.mark} title={app.name}>
                    {app.mark}
                  </span>
                ))}
              </span>
              <span className={styles.srOnly}>Connects to {appsText}.</span>
              <span className={styles.model}>
                <span className={styles.mark} aria-hidden="true">
                  {agent.model.mark}
                </span>
                <span className={styles.modelName}>
                  <span className={styles.srOnly}>Runs on </span>
                  {agent.model.name}
                </span>
              </span>
            </div>
            <h3 className={styles.name}>{agent.name}</h3>
            <p className={styles.job}>{agent.job}</p>
            <div className={styles.footer}>
              <span className={styles.meta}>
                <span className={styles.metaItem} aria-hidden="true">
                  <Star className={styles.star} />
                  {agent.rating.toFixed(1)}
                </span>
                <span className={styles.metaItem} aria-hidden="true">
                  <ArrowDownToLine />
                  {formatInstalls(agent.installs)}
                </span>
                <span className={styles.srOnly}>
                  Rated {agent.rating.toFixed(1)} out of 5, {agent.installs.toLocaleString("en-US")} installs.
                </span>
              </span>
              <span className={styles.right}>
                {marked ? (
                  <span className={styles.installedTag}>
                    <Check aria-hidden="true" />
                    Installed
                  </span>
                ) : null}
                <span className={styles.actions}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      show("preview");
                      onPreview?.(agent);
                    }}
                  >
                    Preview
                  </Button>
                  {marked ? (
                    <Button size="sm" variant="secondary" data-autofocus onClick={open}>
                      Open
                    </Button>
                  ) : (
                    <Button size="sm" className={styles.accent} data-autofocus onClick={startInstall}>
                      Install
                    </Button>
                  )}
                </span>
              </span>
            </div>
          </View>
        ) : null}

        {view === "preview" ? (
          <View key="preview" name="preview" reduced={reduced}>
            <div className={styles.flowHead}>
              <span className={styles.flowTitle}>{agent.name}</span>
              <span className={styles.flowMeta}>Sample run</span>
            </div>
            <ol className={styles.steps}>
              {(agent.preview ?? []).slice(0, 3).map((step, index) => (
                <motion.li
                  key={index}
                  className={styles.step}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.16 * Number(!reduced), delay: reduced ? 0 : 0.06 + 0.05 * index, ease: EASE }}
                >
                  <span className={styles.mark} aria-hidden="true">
                    {step.mark}
                  </span>
                  <span className={styles.stepText}>
                    <span className={styles.srOnly}>{step.source}: </span>
                    {step.text}
                  </span>
                </motion.li>
              ))}
            </ol>
            <div className={styles.flowFooter}>
              <span />
              <span className={styles.flowActions}>
                <Button size="sm" variant="ghost" onClick={back}>
                  Back
                </Button>
                {marked ? (
                  <Button size="sm" variant="secondary" data-autofocus onClick={open}>
                    Open
                  </Button>
                ) : (
                  <Button size="sm" className={styles.accent} data-autofocus onClick={startInstall}>
                    Install
                  </Button>
                )}
              </span>
            </div>
          </View>
        ) : null}

        {view === "workspace" ? (
          <View key="workspace" name="workspace" reduced={reduced}>
            <div className={styles.flowHead}>
              <span className={styles.flowTitle}>Install to</span>
              <span className={styles.flowMeta}>Step 1 of {steps}</span>
            </div>
            <WorkspacePicker workspaces={workspaces} value={workspace?.id ?? ""} onChange={setWorkspaceId} />
            <div className={styles.flowFooter}>
              <span />
              <span className={styles.flowActions}>
                <Button size="sm" variant="ghost" onClick={back}>
                  Cancel
                </Button>
                <Button size="sm" className={styles.accent} onClick={() => show("grant")}>
                  Continue
                </Button>
              </span>
            </div>
          </View>
        ) : null}

        {view === "grant" ? (
          <View key="grant" name="grant" reduced={reduced}>
            <div className={styles.flowHead}>
              <span className={styles.flowTitle}>Allow access in {workspace?.name}</span>
              <span className={styles.flowMeta}>
                Step {steps} of {steps}
              </span>
            </div>
            <ul className={styles.scopes}>
              {agent.apps.map((app, index) => {
                const state = index < progress ? "done" : status === "connecting" && index === progress ? "busy" : "idle";
                return (
                  <li key={app.id} className={styles.scope} data-state={state}>
                    <span className={styles.mark} aria-hidden="true">
                      {app.mark}
                    </span>
                    <span className={styles.scopeText}>
                      <span className={styles.srOnly}>{app.name}: </span>
                      {app.scope}
                    </span>
                    <span className={styles.scopeStatus} aria-hidden="true">
                      <AnimatePresence initial={false} mode="popLayout">
                        {state === "busy" ? (
                          <motion.span
                            key="busy"
                            className={styles.spinner}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, transition: { duration: 0.08 } }}
                            transition={{ duration: 0.12 }}
                          />
                        ) : state === "done" ? (
                          <motion.span
                            key="done"
                            className={styles.scopeDone}
                            initial={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ ...SPRING_TIGHT, opacity: { duration: 0.12 } }}
                          >
                            <Check />
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className={styles.flowFooter}>
              <span className={styles.flowStatus}>
                <AnimatePresence initial={false} mode="popLayout">
                  {status === "error" ? (
                    <motion.span
                      key="error"
                      className={styles.error}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.16 }}
                    >
                      <CircleAlert aria-hidden="true" />
                      Could not connect
                    </motion.span>
                  ) : status === "connecting" ? (
                    <motion.span
                      key="busy"
                      className={styles.flowStatusText}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.16 }}
                    >
                      {Math.min(progress, agent.apps.length)} of {agent.apps.length} connected
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </span>
              <span className={styles.flowActions}>
                {status === "connecting" ? (
                  <Button size="sm" variant="ghost" onClick={cancel}>
                    Cancel
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      reset();
                      show(steps > 1 ? "workspace" : "idle");
                    }}
                  >
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  className={styles.accent}
                  data-autofocus
                  aria-disabled={status === "connecting" || undefined}
                  onClick={status === "connecting" ? undefined : connect}
                >
                  {status === "error" ? "Try again" : status === "connecting" ? "Connecting" : "Allow"}
                </Button>
              </span>
            </div>
          </View>
        ) : null}

        {view === "done" ? (
          <View key="done" name="done" reduced={reduced}>
            <div className={styles.flowHead}>
              <span className={styles.doneTitle}>
                <motion.span
                  className={styles.doneIcon}
                  initial={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...SPRING_TIGHT, delay: 0.06 * Number(!reduced), opacity: { duration: 0.12, delay: 0.06 * Number(!reduced) } }}
                >
                  <CircleCheck aria-hidden="true" />
                </motion.span>
                <span className={styles.flowTitle}>Installed</span>
              </span>
              <span className={styles.flowMeta}>{landed ?? workspace?.name}</span>
            </div>
            <p className={styles.doneText}>
              {agent.name} is live and connected to {appsText}. Turn it off any time from its settings.
            </p>
            <div className={styles.flowFooter}>
              <span />
              <span className={styles.flowActions}>
                <Button size="sm" variant="ghost" onClick={open}>
                  Open agent
                </Button>
                <Button size="sm" className={styles.accent} data-autofocus onClick={back}>
                  Done
                </Button>
              </span>
            </div>
          </View>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

/* ------------------------------------------------------- workspace picker */

interface WorkspacePickerProps {
  workspaces: AgentWorkspace[];
  value: string;
  onChange: (id: string) => void;
}

function WorkspacePicker({ workspaces, value, onChange }: WorkspacePickerProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(
    0,
    workspaces.findIndex(workspace => workspace.id === value),
  );
  return (
    <div
      className={styles.options}
      role="radiogroup"
      aria-label="Workspace"
      onKeyDown={event => {
        const last = workspaces.length - 1;
        const next =
          event.key === "ArrowDown" || event.key === "ArrowRight"
            ? index === last
              ? 0
              : index + 1
            : event.key === "ArrowUp" || event.key === "ArrowLeft"
              ? index === 0
                ? last
                : index - 1
              : -1;
        if (next < 0) return;
        event.preventDefault();
        onChange(workspaces[next].id);
        refs.current[next]?.focus();
      }}
    >
      {workspaces.map((workspace, position) => {
        const selected = position === index;
        return (
          <button
            key={workspace.id}
            ref={node => {
              refs.current[position] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={styles.option}
            data-selected={selected || undefined}
            data-autofocus={selected || undefined}
            onClick={() => onChange(workspace.id)}
          >
            {workspace.mark ? (
              <span className={styles.workspaceMark} aria-hidden="true">
                {workspace.mark}
              </span>
            ) : (
              <span className={styles.monogram} data-tone={position % 2} aria-hidden="true">
                {workspace.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className={styles.optionName}>{workspace.name}</span>
            {workspace.detail ? <span className={styles.optionDetail}>{workspace.detail}</span> : null}
            <span className={styles.radio} aria-hidden="true">
              {selected ? <Check /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default AgentGallery;
