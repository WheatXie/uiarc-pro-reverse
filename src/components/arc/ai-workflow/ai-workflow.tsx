"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Plus, RotateCcw, SkipForward, Square, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, SVGProps } from "react";
import Button from "../button/button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover/popover";
import TextShimmer from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./ai-workflow.module.css";

/* ------------------------------------------------------------------ types */

export type WorkflowStepKind = "trigger" | "ai" | "action" | "branch";

export type WorkflowOutput =
  | { type: "email"; from: string; address?: string; subject: string; preview: string }
  | { type: "label"; label: string; confidence?: number; reason?: string }
  | { type: "route"; pathId: string; note?: string }
  | { type: "message"; channel: string; author: string; text: string }
  | { type: "record"; id: string; title: string; meta?: string }
  | { type: "text"; text: string };

export interface WorkflowPath {
  id: string;
  label: string;
  steps: WorkflowStep[];
}

export interface WorkflowApp {
  name: string;
  mark: ReactNode;
}

export interface WorkflowStep {
  id: string;
  kind: WorkflowStepKind;
  /** A built in app id, or your own `{ name, mark }` pair. */
  app: string | WorkflowApp;
  title: string;
  detail?: string;
  activity?: string;
  output?: WorkflowOutput;
  durationMs?: number;
  error?: string;
  paths?: WorkflowPath[];
}

export interface WorkflowCatalogItem {
  kind: WorkflowStepKind;
  app: string | WorkflowApp;
  title: string;
  detail?: string;
  activity?: string;
  durationMs?: number;
  output?: WorkflowOutput;
}

export type WorkflowRunStatus = "idle" | "running" | "passed" | "failed" | "stopped";

export type WorkflowStepStatus = "idle" | "running" | "done" | "error" | "skipped";

export interface WorkflowStepRun {
  status: WorkflowStepStatus;
  ms?: number;
  output?: WorkflowOutput;
  error?: string;
}

export interface WorkflowRunResult {
  status: "passed" | "failed";
  durationMs: number;
  outputs: Record<string, WorkflowOutput | undefined>;
  failedStepId?: string;
}

export interface WorkflowStepContext {
  signal: AbortSignal;
  previous: Record<string, WorkflowOutput | undefined>;
  attempt: number;
}

export interface AiWorkflowProps {
  /** Accessible name for the card, and the workflow's title. */
  title?: string;
  description?: string;
  steps?: WorkflowStep[];
  defaultSteps?: WorkflowStep[];
  onStepsChange?: (steps: WorkflowStep[]) => void;
  catalog?: WorkflowCatalogItem[];
  onRunStep?: (step: WorkflowStep, context: WorkflowStepContext) => Promise<WorkflowOutput | void> | WorkflowOutput | void;
  onRunComplete?: (result: WorkflowRunResult) => void;
  loading?: boolean;
  autoPlay?: boolean;
  editable?: boolean;
  className?: string;
}

/* ------------------------------------------------------------- brand marks */

type MarkProps = Omit<SVGProps<SVGSVGElement>, "title"> & { title?: string };

function MarkSvg({ title, children, ...rest }: MarkProps & { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} focusable="false" {...rest}>{children}</svg>;
}

interface AppDef {
  name: string;
  Mark: (props: MarkProps) => ReactNode;
}

const appMarks: Record<string, AppDef> = {
  gmail: {
    name: "Gmail",
    Mark: ({ title = "Gmail", ...rest }: MarkProps) => (
      <MarkSvg title={title} {...rest}>
        <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
      </MarkSvg>
    ),
  },
  slack: {
    name: "Slack",
    Mark: ({ title = "Slack", ...rest }: MarkProps) => (
      <MarkSvg title={title} {...rest}>
        <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
        <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
        <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
        <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
      </MarkSvg>
    ),
  },
  linear: {
    name: "Linear",
    Mark: ({ title = "Linear", ...rest }: MarkProps) => (
      <MarkSvg title={title} {...rest}>
        <path fill="#5E6AD2" d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z"/>
      </MarkSvg>
    ),
  },
  claude: {
    name: "Claude",
    Mark: ({ title = "Claude", ...rest }: MarkProps) => (
      <MarkSvg title={title} {...rest}>
        <path fill="#D97757" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>
      </MarkSvg>
    ),
  },
  notion: {
    name: "Notion",
    Mark: ({ title = "Notion", ...rest }: MarkProps) => (
      <MarkSvg title={title} {...rest}>
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
      </MarkSvg>
    ),
  },
  sheets: {
    name: "Google Sheets",
    Mark: ({ title = "Google Sheets", ...rest }: MarkProps) => (
      <MarkSvg title={title} {...rest}>
        <path fill="#34A853" d="M11.318 12.545H7.91v-1.909h3.41v1.91zM14.728 0v6h6l-6-6zm1.363 10.636h-3.41v1.91h3.41v-1.91zm0 3.273h-3.41v1.91h3.41v-1.91zM20.727 6.5v15.864c0 .904-.732 1.636-1.636 1.636H4.909a1.636 1.636 0 0 1-1.636-1.636V1.636C3.273.732 4.005 0 4.909 0h9.318v6.5h6.5zm-3.273 2.773H6.545v7.909h10.91v-7.91zm-6.136 4.636H7.91v1.91h3.41v-1.91z"/>
      </MarkSvg>
    ),
  },
  hubspot: {
    name: "HubSpot",
    Mark: ({ title = "HubSpot", ...rest }: MarkProps) => (
      <MarkSvg title={title} {...rest}>
        <path fill="#FF7A59" d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z"/>
      </MarkSvg>
    ),
  },
  zendesk: {
    name: "Zendesk",
    Mark: ({ title = "Zendesk", ...rest }: MarkProps) => (
      <MarkSvg title={title} {...rest}>
        <path d="M12.914 2.904V16.29L24 2.905H12.914zM0 2.906C0 5.966 2.483 8.45 5.543 8.45s5.542-2.484 5.543-5.544H0zm11.086 4.807L0 21.096h11.086V7.713zm7.37 7.84c-3.063 0-5.542 2.48-5.542 5.543H24c0-3.06-2.48-5.543-5.543-5.543z"/>
      </MarkSvg>
    ),
  },
  github: {
    name: "GitHub",
    Mark: ({ title = "GitHub", ...rest }: MarkProps) => (
      <MarkSvg title={title} {...rest}>
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
      </MarkSvg>
    ),
  },
  stripe: {
    name: "Stripe",
    Mark: ({ title = "Stripe", ...rest }: MarkProps) => (
      <MarkSvg title={title} {...rest}>
        <path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
      </MarkSvg>
    ),
  },
  branch: {
    name: "Branch",
    Mark: ({ title = "Branch", ...rest }: MarkProps) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={title} focusable="false" {...rest}>
        <circle cx={6} cy={5} r={2.25}/>
        <circle cx={6} cy={19} r={2.25}/>
        <circle cx={18} cy={9} r={2.25}/>
        <path d="M6 7.25v9.5M18 11.25c0 3.5-3 4.75-7 4.75H8.25"/>
      </svg>
    ),
  },
};

/* ------------------------------------------------------------ sample steps */

export const workflowSampleSteps: WorkflowStep[] = [
  {
    id: "new-email",
    kind: "trigger",
    app: "gmail",
    title: "New email in Gmail",
    detail: "support@northwind.dev",
    activity: "Fetching the latest email",
    durationMs: 420,
    output: {
      type: "email",
      from: "Maya Chen",
      address: "maya.chen@ledgerline.io",
      subject: "SSO sign-in broken for our whole team since this morning",
      preview: "Since the 2.14 update none of our 42 seats can sign in through Okta. We demo to our board on Thursday, can someone look today?"
    }
  },
  {
    id: "classify",
    kind: "ai",
    app: "claude",
    title: "Classify with Claude Sonnet 5.5",
    detail: "Urgent, billing, question or feedback",
    activity: "Reading the email",
    durationMs: 1050,
    output: {
      type: "label",
      label: "Urgent",
      confidence: 0.96,
      reason: "Full team lockout after the 2.14 release, 42 seats affected and a board demo on Thursday. Route to on-call now."
    }
  },
  {
    id: "route",
    kind: "branch",
    app: "branch",
    title: "Route by label",
    detail: "If label is Urgent",
    activity: "Checking the rule",
    durationMs: 260,
    output: { type: "route", pathId: "urgent", note: "Label is Urgent, so the email took the Urgent path." },
    paths: [
      {
        id: "urgent",
        label: "Urgent",
        steps: [
          {
            id: "slack",
            kind: "action",
            app: "slack",
            title: "Post to #support in Slack",
            detail: "As Triage bot, mentions @oncall",
            activity: "Posting the message",
            durationMs: 620,
            output: {
              type: "message",
              channel: "#support",
              author: "Triage bot",
              text: "Urgent from Ledgerline: SSO sign-in fails for all 42 seats since 2.14. Maya Chen is waiting on a reply. @oncall"
            }
          },
          {
            id: "linear",
            kind: "action",
            app: "linear",
            title: "Create Linear issue",
            detail: "Support team, priority Urgent",
            activity: "Creating the issue",
            durationMs: 700,
            output: { type: "record", id: "SUP-482", title: "SSO sign-in fails for Ledgerline after 2.14", meta: "Urgent · Assigned to Priya Raman" }
          }
        ]
      },
      {
        id: "other",
        label: "Everything else",
        steps: [
          {
            id: "notion",
            kind: "action",
            app: "notion",
            title: "Add to Support backlog in Notion",
            detail: "Database: Inbound, status Triage",
            activity: "Adding the page",
            durationMs: 560,
            output: { type: "record", id: "TRI-1284", title: "Ledgerline · Question about invoices", meta: "Added to Q4 inbound" }
          }
        ]
      }
    ]
  }
];

export const workflowSampleCatalog: WorkflowCatalogItem[] = [
  {
    kind: "trigger",
    app: "gmail",
    title: "New email in Gmail",
    detail: "support@northwind.dev",
    activity: "Fetching the latest email",
    durationMs: 420,
    output: {
      type: "email",
      from: "Maya Chen",
      address: "maya.chen@ledgerline.io",
      subject: "SSO sign-in broken for our whole team since this morning",
      preview: "Since the 2.14 update none of our 42 seats can sign in through Okta. We demo to our board on Thursday, can someone look today?"
    }
  },
  {
    kind: "trigger",
    app: "zendesk",
    title: "New ticket in Zendesk",
    detail: "Group: Tier 1",
    activity: "Fetching the latest ticket",
    durationMs: 460,
    output: { type: "record", id: "#90412", title: "Export to CSV times out on large workspaces", meta: "Opened by Tomás Silva · Normal" }
  },
  {
    kind: "trigger",
    app: "stripe",
    title: "Failed payment in Stripe",
    detail: "Live mode, all products",
    activity: "Fetching the latest event",
    durationMs: 400,
    output: { type: "record", id: "in_1QZ8", title: "Ledgerline · $1,260.00 declined", meta: "Card expired · Retry scheduled Oct 29" }
  },
  {
    kind: "trigger",
    app: "github",
    title: "New issue in GitHub",
    detail: "northwind/app",
    activity: "Fetching the latest issue",
    durationMs: 440,
    output: { type: "record", id: "#2291", title: "Okta callback returns 500 after 2.14", meta: "Opened by jkowalski · bug" }
  },
  {
    kind: "ai",
    app: "claude",
    title: "Draft reply with Claude Sonnet 5.5",
    detail: "Tone: calm, specific, no promises",
    activity: "Writing the draft",
    durationMs: 980,
    output: {
      type: "text",
      text: "Hi Maya, thanks for the detail. We reproduced the Okta sign-in failure from 2.14 and a fix is rolling out now. I will confirm here the moment your team can sign in again."
    }
  },
  {
    kind: "action",
    app: "slack",
    title: "Message the account owner in Slack",
    detail: "Direct message to the owner",
    activity: "Sending the message",
    durationMs: 560,
    output: { type: "message", channel: "Direct message", author: "Triage bot", text: "Heads up: Ledgerline reported an SSO lockout. On-call is on it, issue SUP-482." }
  },
  {
    kind: "action",
    app: "linear",
    title: "Create Linear issue",
    detail: "Support team, priority High",
    activity: "Creating the issue",
    durationMs: 680,
    output: { type: "record", id: "SUP-483", title: "Follow up with Ledgerline after the SSO fix", meta: "High · Unassigned" }
  },
  {
    kind: "action",
    app: "hubspot",
    title: "Update company in HubSpot",
    detail: "Property: health score",
    activity: "Updating the record",
    durationMs: 600,
    output: { type: "record", id: "Ledgerline", title: "Health score set to At risk", meta: "Owner: Priya Raman" }
  }
];

/* ------------------------------------------------------------------ tokens */

const kindStatusLabel: Record<WorkflowStepKind, string> = { trigger: "Trigger", ai: "AI step", action: "Action", branch: "Branch" };
const kindActivity: Record<WorkflowStepKind, string> = {
  trigger: "Waiting for the event",
  ai: "Thinking",
  action: "Working",
  branch: "Checking the rule"
};
const kindDuration: Record<WorkflowStepKind, number> = { trigger: 420, ai: 1000, action: 620, branch: 260 };
const ease: [number, number, number, number] = [...motionTokens.ease.standard];
const runIn = { opacity: 1, y: 0, transition: { duration: 0.16, ease } };
const runOut = { opacity: 0, transition: { duration: 0.1, ease } };
const urgentTone = /urgent|critical|outage|blocker/i;

/** `423ms` below a second, `3.1s` above it. */
function formatDuration(ms?: number) {
  if (ms === undefined || !Number.isFinite(ms)) return "";
  return ms < 1000 ? `${Math.max(1, Math.round(ms))}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function appName(app: string | WorkflowApp) {
  return typeof app === "string" ? appMarks[app].name : app.name;
}

function AppMark({ app, size = 16 }: { app: string | WorkflowApp; size?: number }) {
  if (typeof app !== "string") return <>{app.mark}</>;
  const { Mark, name } = appMarks[app];
  return <>{Mark({ width: size, height: size, title: name, "aria-hidden": "true" })}</>;
}

function describeOutput(output?: WorkflowOutput) {
  if (!output) return "done";
  switch (output.type) {
    case "email":
      return `${output.from}, ${output.subject}`;
    case "label":
      return output.confidence === undefined ? output.label : `${output.label}, ${Math.round(output.confidence * 100)}% confidence`;
    case "route":
      return output.note ?? `took the ${output.pathId} path`;
    case "message":
      return `posted to ${output.channel}`;
    case "record":
      return `${output.id}, ${output.title}`;
    case "text":
      return output.text;
  }
}

function abortError() {
  return new DOMException("The run was stopped.", "AbortError");
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      window.clearTimeout(timer);
      reject(abortError());
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/* ------------------------------------------------------------- sub views */

function Spinner() {
  return (
    <svg className={styles.spinner} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** Reveals a sentence word by word, one chunk every 34ms. */
function StreamedText({ text, reduced, className }: { text: string; reduced: boolean; className?: string }) {
  const chunks = (() => {
    const words = text.split(/(?<=\s)/);
    const list: string[] = [];
    for (let index = 0; index < words.length; index += 5) list.push(words.slice(index, index + 5).join(""));
    return list;
  })();
  const total = chunks.length;
  const [shown, setShown] = useState(reduced ? total : 0);
  const [previous, setPrevious] = useState({ text, reduced });

  if (previous.text !== text || previous.reduced !== reduced) {
    setPrevious({ text, reduced });
    setShown(reduced ? total : 0);
  }

  useEffect(() => {
    if (reduced) return;
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      setShown(count);
      if (count >= total) window.clearInterval(timer);
    }, 34);
    return () => window.clearInterval(timer);
  }, [text, total, reduced]);

  return (
    <p className={className}>
      {chunks.map((chunk, index) => (
        <span key={index} className={styles.chunk} data-shown={index < shown || undefined}>{chunk}</span>
      ))}
    </p>
  );
}

function OutputView({ output, reduced }: { output: WorkflowOutput; reduced: boolean }) {
  switch (output.type) {
    case "email":
      return (
        <>
          <p className={styles.outLine}>
            <span className={styles.name}>{output.from}</span>
            {output.address ? <span className={styles.mono}>{output.address}</span> : null}
          </p>
          <p className={`${styles.outStrong} ${styles.clamp1}`}>{output.subject}</p>
          <p className={styles.clamp1}>{output.preview}</p>
        </>
      );
    case "label":
      return (
        <>
          <p className={styles.outLine}>
            <span className={styles.label}>
              <span className={styles.labelDot} data-tone={urgentTone.test(output.label) ? "urgent" : undefined} aria-hidden="true" />
              {output.label}
            </span>
            {output.confidence === undefined ? null : <span className={styles.mono}>{output.confidence.toFixed(2)} confidence</span>}
          </p>
          {output.reason ? <StreamedText text={output.reason} reduced={reduced} /> : null}
        </>
      );
    case "route":
      return <p>{output.note ?? `Took the ${output.pathId} path.`}</p>;
    case "message":
      return (
        <>
          <p className={styles.outLine}>
            <span className={styles.name}>{output.author}</span>
            <span className={styles.muted}>{output.channel}</span>
            <span className={styles.muted}>now</span>
          </p>
          <p className={styles.clamp2}>{output.text}</p>
        </>
      );
    case "record":
      return (
        <>
          <p className={styles.outLine}>
            <span className={styles.mono}>{output.id}</span>
            <span className={`${styles.outStrong} ${styles.clamp1}`}>{output.title}</span>
          </p>
          {output.meta ? <p className={`${styles.muted} ${styles.clamp1}`}>{output.meta}</p> : null}
        </>
      );
    case "text":
      return <StreamedText text={output.text} reduced={reduced} />;
  }
}

function StatusCell({ kind, run }: { kind: WorkflowStepKind; run: WorkflowStepRun }) {
  const status = run.status;
  const content =
    status === "running" ? (
      <>
        <Spinner />
        <span>Running</span>
      </>
    ) : status === "done" ? (
      <>
        <Check size={14} strokeWidth={2} aria-hidden="true" />
        <span className={styles.tabular}>{formatDuration(run.ms)}</span>
      </>
    ) : status === "error" ? (
      <>
        <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
        <span>Failed</span>
      </>
    ) : status === "skipped" ? (
      <>
        <SkipForward size={14} strokeWidth={2} aria-hidden="true" />
        <span>Skipped</span>
      </>
    ) : (
      <span>{kindStatusLabel[kind]}</span>
    );

  return (
    <span className={styles.status} aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span key={status} className={styles.statusInner} data-status={status} initial={{ opacity: 0, y: 2 }} animate={runIn} exit={runOut}>
          {content}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function FlowLine({ state, reduced }: { state: "active" | "idle" | "done"; reduced: boolean }) {
  return (
    <>
      <span className={styles.head} aria-hidden="true">
        <span className={styles.fill} data-state={state} />
      </span>
      {state !== "active" || reduced ? null : <span className={styles.dot} aria-hidden="true" />}
    </>
  );
}

interface StepRowProps {
  step: WorkflowStep;
  run: WorkflowStepRun;
  head: "active" | "idle" | "done" | null;
  tail: boolean;
  reduced: boolean;
  removable: boolean;
  busy: boolean;
  onRemove: () => void;
  onRetry: () => void;
  children?: ReactNode;
}

function StepRow({ step, run, head, tail, reduced, removable, busy, onRemove, onRetry, children }: StepRowProps) {
  const name = appName(step.app);
  const activity = step.activity ?? kindActivity[step.kind];
  const running = run.status === "running";
  const hasOutput = run.status === "done" && run.output !== undefined && run.output.type !== "route";
  const spokenStatus =
    run.status === "idle"
      ? kindStatusLabel[step.kind]
      : run.status === "done"
        ? `Done in ${formatDuration(run.ms)}`
        : run.status === "running"
          ? "Running"
          : run.status === "error"
            ? "Failed"
            : "Skipped";

  return (
    <motion.li
      className={styles.item}
      initial={reduced ? false : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
      transition={reduced ? { duration: 0 } : { height: { type: "spring", visualDuration: 0.22, bounce: 0 }, opacity: { duration: 0.16, ease } }}
    >
      <div className={styles.inner} data-head={head ? "" : undefined}>
        {head ? <FlowLine state={head} reduced={reduced} /> : null}
        <div className={styles.body} data-status={run.status}>
          {tail ? (
            <span className={styles.tail} aria-hidden="true">
              <span className={styles.fill} data-state={run.status === "done" ? "done" : "idle"} />
            </span>
          ) : null}
          <div className={styles.row}>
            <span className={styles.mark}>
              <AppMark app={step.app} />
            </span>
            <div className={styles.text}>
              <p className={styles.stepTitle}>
                {step.title}
                <span className={styles.srOnly}>{", "}{name}{", "}{spokenStatus}</span>
              </p>
              <p className={styles.stepDetail}>
                <span className={styles.detailText} data-hidden={running || undefined}>{step.detail ?? kindStatusLabel[step.kind]}</span>
                <span className={styles.activity} data-hidden={!running || undefined} aria-hidden="true">
                  <TextShimmer active={running && !reduced}>{activity}</TextShimmer>
                </span>
              </p>
            </div>
            <StatusCell kind={step.kind} run={run} />
            <span className={styles.removeSlot}>
              {removable ? (
                <button type="button" className={styles.remove} onClick={onRemove} disabled={busy} aria-label={`Remove ${step.title}`}>
                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              ) : null}
            </span>
          </div>
          {children}
          <AnimatePresence initial={false}>
            {hasOutput && run.output ? (
              <motion.div
                key="output"
                className={styles.fold}
                initial={reduced ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                transition={reduced ? { duration: 0 } : { height: { type: "spring", visualDuration: 0.22, bounce: 0 }, opacity: { duration: 0.16, ease } }}
              >
                <div className={styles.output}>
                  <OutputView output={run.output} reduced={reduced} />
                </div>
              </motion.div>
            ) : null}
            {run.status === "error" ? (
              <motion.div
                key="error"
                className={styles.fold}
                initial={reduced ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                transition={reduced ? { duration: 0 } : { height: { type: "spring", visualDuration: 0.22, bounce: 0 }, opacity: { duration: 0.16, ease } }}
              >
                <div className={`${styles.output} ${styles.errorOut}`}>
                  <p className={styles.errorText}>{run.error ?? "This step failed."}</p>
                  <Button variant="secondary" size="sm" className={styles.retry} onClick={onRetry} aria-label={`Retry ${step.title}`}>
                    <RotateCcw size={12} strokeWidth={2} aria-hidden="true" />
                    Retry
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </motion.li>
  );
}

function PathTabs({
  label,
  paths,
  value,
  onChange,
  reduced
}: {
  label: string;
  paths: WorkflowPath[];
  value: string;
  onChange: (id: string) => void;
  reduced: boolean;
}) {
  const layoutId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div className={styles.tabs} role="radiogroup" aria-label={label}>
      {paths.map((path, index) => {
        const selected = path.id === value;
        const last = paths.length - 1;
        return (
          <button
            key={path.id}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            data-selected={selected || undefined}
            onClick={() => onChange(path.id)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight" || event.key === "ArrowDown"
                  ? index === last ? 0 : index + 1
                  : event.key === "ArrowLeft" || event.key === "ArrowUp"
                    ? index === 0 ? last : index - 1
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? last
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              onChange(paths[next].id);
              refs.current[next]?.focus();
            }}
          >
            {selected ? (
              <motion.span
                layoutId={layoutId}
                className={styles.tabHighlight}
                transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: 0.2, bounce: 0 }}
                aria-hidden="true"
              />
            ) : null}
            <span className={styles.tabLabel}>{path.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StepSkeleton() {
  return (
    <ol className={styles.list} aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <li key={index} className={styles.item}>
          <div className={styles.inner} data-head={index > 0 ? "" : undefined}>
            {index > 0 ? <span className={styles.head} /> : null}
            <div className={styles.body}>
              {index < 2 ? <span className={styles.tail} /> : null}
              <div className={styles.row}>
                <span className={`${styles.mark} ${styles.skeletonMark}`} />
                <span className={styles.skeletonLine} style={{ "--w": `${[52, 64, 44][index]}%` } as CSSProperties} />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------- component */

export function AiWorkflow({
  title = "Escalate urgent support email",
  description = "Runs on every new email to support@northwind.dev",
  steps,
  defaultSteps,
  onStepsChange,
  catalog = workflowSampleCatalog,
  onRunStep,
  onRunComplete,
  loading = false,
  autoPlay = true,
  editable = true,
  className
}: AiWorkflowProps) {
  const reduced = useReducedMotion() ?? false;
  const [ownSteps, setOwnSteps] = useState<WorkflowStep[]>(() => defaultSteps ?? steps ?? workflowSampleSteps);
  const list = steps ?? ownSteps;
  const [runs, setRuns] = useState<Record<string, WorkflowStepRun>>({});
  const [glide, setGlide] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkflowRunStatus>("idle");
  const [failedTitle, setFailedTitle] = useState("");
  const [total, setTotal] = useState(0);
  const [activePath, setActivePath] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const [inView, setInView] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const runsRef = useRef<Record<string, WorkflowStepRun>>({});
  const listRef = useRef(list);
  const attemptsRef = useRef<Record<string, number>>({});
  const controllerRef = useRef<AbortController | null>(null);
  const addedRef = useRef(0);
  const handlersRef = useRef({ onRunStep, onRunComplete });

  useLayoutEffect(() => {
    listRef.current = list;
    handlersRef.current = { onRunStep, onRunComplete };
  });

  const simulated = !onRunStep;

  const countSteps = (items: WorkflowStep[]): number =>
    items.reduce((sum, item) => sum + 1 + (item.paths ?? []).reduce((inner, path) => inner + countSteps(path.steps), 0), 0);
  const stepCount = countSteps(list);
  const running = status === "running";
  const noSteps = list.length === 0;

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const setRun = (id: string, run: WorkflowStepRun) => {
    runsRef.current = { ...runsRef.current, [id]: run };
    setRuns(runsRef.current);
  };

  async function runStep(step: WorkflowStep, context: WorkflowStepContext) {
    const handler = handlersRef.current.onRunStep;
    if (handler) return handler(step, context);
    await sleep(step.durationMs ?? kindDuration[step.kind], context.signal);
    if (step.error && context.attempt === 0) throw new Error(step.error);
    if (step.output) return step.output;
    if (step.kind === "branch" && step.paths?.[0]) return { type: "route", pathId: step.paths[0].id } satisfies WorkflowOutput;
    return undefined;
  }

  async function run(isRetry = false) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;

    if (!isRetry) {
      runsRef.current = {};
      setRuns({});
      attemptsRef.current = {};
      setTotal(0);
    }
    setStatus("running");
    setGlide(null);
    setAnnouncement(isRetry ? "Retrying the failed step." : `Test run started.${simulated ? " Simulated, nothing is sent." : ""}`);

    let outputs: Record<string, WorkflowOutput | undefined> = {};
    let queue = listRef.current;
    let index = 0;
    let first = true;
    let current: WorkflowStep | undefined;
    let elapsed = Object.values(runsRef.current).reduce((sum, run_) => sum + (run_.status === "done" ? run_.ms ?? 0 : 0), 0);

    try {
      while (index < queue.length) {
        const step = queue[index];
        current = step;
        const existing = runsRef.current[step.id];
        if (existing?.status === "done") {
          if (existing.output) outputs = { ...outputs, [step.id]: existing.output };
        } else {
          if (!first) {
            setGlide(step.id);
            await sleep(240 * (reduced ? 0 : 1), signal);
            setGlide(null);
          }
          setRun(step.id, { status: "running" });
          const attempt = attemptsRef.current[step.id] ?? 0;
          attemptsRef.current[step.id] = attempt + 1;
          const started = performance.now();
          let output: WorkflowOutput | void;
          try {
            output = await runStep(step, { signal, previous: { ...outputs }, attempt });
          } catch (error) {
            if (signal.aborted) throw error;
            const message = error instanceof Error ? error.message : "This step failed.";
            setRun(step.id, { status: "error", error: message });
            setFailedTitle(step.title);
            setStatus("failed");
            setAnnouncement(`${step.title} failed. ${message}`);
            handlersRef.current.onRunComplete?.({ status: "failed", durationMs: elapsed, outputs, failedStepId: step.id });
            return;
          }
          signal.throwIfAborted();
          const ms = Math.round(performance.now() - started);
          elapsed += ms;
          setTotal(elapsed);
          setRun(step.id, { status: "done", output: output ?? undefined, ms });
          if (output) outputs = { ...outputs, [step.id]: output };
          setAnnouncement(`${step.title}: ${describeOutput(output ?? undefined)}.`);
          await sleep(120 * (reduced ? 0 : 1), signal);
        }

        first = false;

        if (step.kind === "branch" && step.paths?.length) {
          const branchOutput = runsRef.current[step.id]?.output;
          const path =
            step.paths.find((candidate) => branchOutput?.type === "route" && candidate.id === branchOutput.pathId) ?? step.paths[0];
          setActivePath((previous) => ({ ...previous, [step.id]: path.id }));
          for (const other of step.paths) {
            if (other.id === path.id) continue;
            for (const skipped of other.steps) setRun(skipped.id, { status: "skipped" });
          }
          queue = path.steps;
          index = 0;
          continue;
        }
        index += 1;
      }
      setStatus("passed");
      setAnnouncement(`Test run passed in ${formatDuration(elapsed)}.${simulated ? " Simulated, nothing was sent." : ""}`);
      handlersRef.current.onRunComplete?.({ status: "passed", durationMs: elapsed, outputs });
    } catch {
      if (controllerRef.current !== controller) return;
      setGlide(null);
      if (current && runsRef.current[current.id]?.status === "running") setRun(current.id, { status: "idle" });
      setStatus("stopped");
      setAnnouncement(`Test run stopped.${simulated ? " Nothing was sent." : ""}`);
    }
  }

  useEffect(() => {
    if (!autoPlay || !inView || interacted || loading || stepCount === 0 || status === "running" || status === "stopped") return;
    const timer = window.setTimeout(() => { void run(); }, status === "idle" ? 600 : 4200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, inView, interacted, loading, stepCount, status]);

  const commitSteps = (next: WorkflowStep[]) => {
    if (steps === undefined) setOwnSteps(next);
    listRef.current = next;
    onStepsChange?.(next);
    if (status !== "idle") setStatus("idle");
  };

  const removeStep = (id: string) => {
    const find = (items: WorkflowStep[]): WorkflowStep | undefined => {
      for (const item of items) {
        if (item.id === id) return item;
        for (const path of item.paths ?? []) {
          const hit = find(path.steps);
          if (hit) return hit;
        }
      }
      return undefined;
    };
    const prune = (items: WorkflowStep[]): WorkflowStep[] =>
      items
        .filter((item) => item.id !== id)
        .map((item) => (item.paths ? { ...item, paths: item.paths.map((path) => ({ ...path, steps: prune(path.steps) })) } : item));
    const removed = find(list);
    commitSteps(prune(list));
    setAnnouncement(removed ? `Removed ${removed.title}.` : "Removed the step.");
  };

  const last = list[list.length - 1];
  const branchStep = last?.kind === "branch" && last.paths?.length ? last : undefined;
  const branchPathId = branchStep ? activePath[branchStep.id] ?? branchStep.paths?.[0].id : undefined;
  const branchLabel = branchStep?.paths?.find((path) => path.id === branchPathId)?.label;

  const addStep = (item: WorkflowCatalogItem) => {
    addedRef.current += 1;
    const step: WorkflowStep = { ...item, id: `${typeof item.app === "string" ? item.app : "step"}-added-${addedRef.current}` };
    if (branchStep && branchPathId) {
      commitSteps(
        list.map((candidate) =>
          candidate !== branchStep
            ? candidate
            : {
                ...candidate,
                paths: candidate.paths?.map((path) => (path.id === branchPathId ? { ...path, steps: [...path.steps, step] } : path))
              }
        )
      );
      setAnnouncement(`Added ${step.title} to the ${branchLabel ?? ""} path.`);
    } else {
      commitSteps([...list, step]);
      setAnnouncement(`Added ${step.title}.`);
    }
  };

  const runOf = (id: string): WorkflowStepRun => runs[id] ?? { status: "idle" };

  const renderStep = (step: WorkflowStep, isFirst: boolean, hasTail: boolean, extra?: ReactNode) => (
    <StepRow
      key={step.id}
      step={step}
      run={runOf(step.id)}
      head={isFirst ? null : glide === step.id ? "active" : runOf(step.id).status === "idle" || runOf(step.id).status === "skipped" ? "idle" : "done"}
      tail={hasTail}
      reduced={reduced}
      removable={editable && step.kind !== "trigger"}
      busy={running}
      onRemove={() => removeStep(step.id)}
      onRetry={() => { void run(true); }}
    >
      {extra}
    </StepRow>
  );

  const summaryContent = running ? (
    { key: "running", icon: <span className={styles.liveDot} />, text: <TextShimmer active={!reduced}>Test run in progress</TextShimmer> }
  ) : status === "passed" ? (
    {
      key: "passed",
      icon: <Check size={14} strokeWidth={2} aria-hidden="true" />,
      text: (
        <>
          Passed in <span className={styles.tabular}>{formatDuration(total)}</span>
          {simulated ? <span className={styles.summarySuffix}>, simulated, nothing was sent</span> : null}
        </>
      )
    }
  ) : status === "failed" ? (
    { key: "failed", icon: <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />, text: <>Failed at {failedTitle}</> }
  ) : status === "stopped" ? (
    { key: "stopped", icon: <Square size={11} strokeWidth={2} aria-hidden="true" />, text: <>Stopped{simulated ? ", nothing was sent" : ""}</> }
  ) : (
    {
      key: "idle",
      icon: null,
      text: loading ? (
        <>Loading steps</>
      ) : noSteps ? (
        <>No steps yet</>
      ) : (
        <>
          <span className={styles.tabular}>{stepCount}</span> {stepCount === 1 ? "step" : "steps"}
          {simulated ? <span className={styles.summarySuffix}>, test runs are simulated</span> : null}
        </>
      )
    }
  );

  const triggers = catalog.filter((item) => item.kind === "trigger");
  const addable = catalog.filter((item) => item.kind !== "trigger");

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      aria-label={title}
      aria-busy={running || loading || undefined}
      onPointerDownCapture={() => setInteracted(true)}
      onKeyDownCapture={() => setInteracted(true)}
    >
      <header className={styles.header}>
        <div className={styles.headText}>
          <h3 className={styles.title}>{title}</h3>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {running ? (
          <Button variant="secondary" size="sm" className={styles.runButton} onClick={() => controllerRef.current?.abort()}>
            <Square size={10} strokeWidth={2.4} aria-hidden="true" />
            Stop
          </Button>
        ) : (
          <Button variant="primary" size="sm" className={styles.runButton} onClick={() => { void run(); }} disabled={loading || noSteps}>
            {status === "idle" || status === "stopped" ? (
              <>
                <RotateCcw size={12} strokeWidth={2.2} aria-hidden="true" />
                Test run
              </>
            ) : (
              <>
                <RotateCcw size={12} strokeWidth={2.2} aria-hidden="true" />
                Run again
              </>
            )}
          </Button>
        )}
      </header>
      <div className={styles.canvas}>
        {loading ? (
          <StepSkeleton />
        ) : noSteps ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Start with a trigger</p>
            <p className={styles.emptyText}>Pick the event that starts this workflow.</p>
            {editable && triggers.length ? (
              <ul className={styles.triggerList}>
                {triggers.map((item) => (
                  <li key={item.title}>
                    <button type="button" className={styles.triggerOption} onClick={() => addStep(item)}>
                      <span className={styles.mark}>
                        <AppMark app={item.app} />
                      </span>
                      <span className={styles.optionTitle}>{item.title}</span>
                      {item.detail ? <span className={styles.triggerDetail}>{item.detail}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <ol className={styles.list}>
            <AnimatePresence initial={false}>
              {list.map((step, index) => {
                const isLast = index === list.length - 1;
                if (step.kind !== "branch" || !step.paths?.length) return renderStep(step, index === 0, !isLast);
                const path = step.paths.find((candidate) => candidate.id === (activePath[step.id] ?? step.paths?.[0].id)) ?? step.paths[0];
                const tabs = (
                  <PathTabs
                    label={`Paths for ${step.title}`}
                    paths={step.paths}
                    value={path.id}
                    reduced={reduced}
                    onChange={(id) => setActivePath((previous) => ({ ...previous, [step.id]: id }))}
                  />
                );
                return [
                  renderStep(step, index === 0, true, tabs),
                  <motion.li
                    key={`${step.id}-paths`}
                    className={styles.pathItem}
                    initial={false}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 * (reduced ? 0 : 1) } }}
                  >
                    <div>
                      <div>
                        <AnimatePresence initial={false} mode="popLayout">
                          <motion.ol
                            key={path.id}
                            className={styles.list}
                            aria-label={`${path.label} path`}
                            initial={reduced ? false : { opacity: 0 }}
                            animate={{ opacity: 1, transition: { duration: 0.16, ease, delay: 0.04 } }}
                            exit={{ opacity: 0, transition: { duration: 0.1 * (reduced ? 0 : 1), ease } }}
                          >
                            <AnimatePresence initial={false}>
                              {path.steps.map((child, childIndex) => renderStep(child, false, childIndex !== path.steps.length - 1))}
                            </AnimatePresence>
                          </motion.ol>
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.li>
                ];
              })}
            </AnimatePresence>
          </ol>
        )}
      </div>
      <footer className={styles.footer}>
        <p className={styles.summary} aria-hidden="true">
          <AnimatePresence initial={false}>
            <motion.span
              key={summaryContent.key}
              className={styles.summaryInner}
              data-state={summaryContent.key}
              initial={{ opacity: 0, y: 2 }}
              animate={runIn}
              exit={runOut}
            >
              {summaryContent.icon ? <span className={styles.summaryIcon}>{summaryContent.icon}</span> : null}
              <span className={styles.summaryText}>{summaryContent.text}</span>
            </motion.span>
          </AnimatePresence>
        </p>
        <Popover>
          <PopoverTrigger className={styles.addButton} disabled={running || loading}>
            <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
            <span className={styles.addLabel}>{branchLabel ? `Add to ${branchLabel}` : "Add a step"}</span>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className={styles.menu}>
            <ul className={styles.options} role="listbox" aria-label="Steps">
              {addable.map((item, index) => (
                <li key={item.title}>
                  <button type="button" className={styles.option} role="option" aria-selected={false} data-index={index} onClick={() => addStep(item)}>
                    <span className={styles.mark}>
                      <AppMark app={item.app} />
                    </span>
                    <span className={styles.optionTitle}>{item.title}</span>
                    <span className={styles.optionMeta}>{kindStatusLabel[item.kind]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </footer>
      <p className={styles.srOnly} role="status" aria-live="polite">{announcement}</p>
    </section>
  );
}

export default AiWorkflow;
