"use client";

import { Fragment, memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, MutableRefObject, PointerEvent as ReactPointerEvent, ReactNode, RefObject, SVGProps } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Bot, CircleCheck, CircleX, CornerDownRight, Pause, Play, RotateCw, RotateCcw, Wrench } from "lucide-react";
import Button from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import TextShimmer from "../text-shimmer/text-shimmer";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./agent-timeline.module.css";

export type AgentTimelineKind = "thinking" | "tool" | "waiting";

/** One row of the timeline: an agent, its model and the blended price used to cost its tokens. */
export interface AgentTimelineAgent {
  id: string;
  name: string;
  model?: string;
  role?: string;
  /** Series color for the row. Defaults to neutral for the orchestrator and --series-1 to --series-4 after it. */
  color?: string;
  /** Mark shown before the model name. Inferred from the model name when left out. */
  mark?: ReactNode;
  /** Blended USD rate per million tokens. */
  price?: number;
}

/** One stretch of work on an agent's lane. Times are seconds from the start of the run. */
export interface AgentTimelineSpan {
  id?: string;
  agentId: string;
  kind: AgentTimelineKind;
  start: number;
  /** Leave out while the span is open in a live run. */
  end?: number;
  label: string;
  detail?: string;
  tool?: string | { name: string; mark?: ReactNode };
  tokens?: number;
  cost?: number;
  status?: "ok" | "failed";
  retry?: boolean;
}

/** Work passed between two agents. The connector shape is inferred from the spans around it. */
export interface AgentTimelineHandoff {
  from: string;
  to: string;
  at: number;
  label?: string;
}

export interface AgentTimelineRun {
  title?: string;
  agents: AgentTimelineAgent[];
  spans: AgentTimelineSpan[];
  handoffs?: AgentTimelineHandoff[];
  duration?: number;
  /** Epoch ms the live run started, so a late mount still counts from the real start. */
  startedAt?: number;
}

export interface AgentTimelineProps {
  /** The run. Defaults to a sample incident investigation with five agents, a failed query and a retry. */
  run?: AgentTimelineRun;
  /** Overrides run.agents. */
  agents?: AgentTimelineAgent[];
  /** Overrides run.spans. */
  spans?: AgentTimelineSpan[];
  /** Overrides run.handoffs. */
  handoffs?: AgentTimelineHandoff[];
  /** Heading. Defaults to run.title, then "Agent run". */
  title?: string;
  /** Replay from zero when the timeline scrolls into view. Defaults to true for the sample run. */
  autoPlay?: boolean;
  /** Starting playback speed. 1 is real time. */
  speed?: number;
  /** Options in the speed control. The control hides when only one speed remains. */
  speeds?: number[];
  /** Follow a run in progress. */
  live?: boolean;
  /** Called when a span is pinned, with the span, or unpinned, with null. */
  onSpanSelect?: (span: AgentTimelineSpan | null) => void;
  /** Called once each time a replay reaches the end or a live run ends. */
  onComplete?: () => void;
  className?: string;
  style?: CSSProperties;
}

interface PlacedSpan extends AgentTimelineSpan {
  id: string;
  index: number;
  row: number;
  open: boolean;
  toolInfo?: { name: string; mark?: ReactNode };
  spanCost: number;
}

interface Connector {
  id: string;
  handoff: AgentTimelineHandoff;
  from: number;
  to: number;
  at: number;
  shape: "in" | "out" | "line";
  up: boolean;
  color: string;
  x0: number;
  x1: number;
  sourceSpan?: string;
  targetSpan?: string;
}

interface TimelineModel {
  agents: (AgentTimelineAgent & { index: number; color: string })[];
  spans: PlacedSpan[];
  byRow: PlacedSpan[][];
  connectors: Connector[];
  duration: number;
  totals: { tokens: number; cost: number; speedup: number };
}

export type MarkProps = SVGProps<SVGSVGElement>;


/** Claude brand mark. */
function ClaudeMark(props: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

/** OpenAI brand mark. */
function OpenAIMark(props: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

/** Gemini mark. The gradient ids are per-instance so two marks never share a definition. */
function GeminiMark(props: MarkProps) {
  const id = `gemini-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const d = "M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path d={d} fill="#3186FF" />
      <path d={d} fill={`url(#${id}-0)`} />
      <path d={d} fill={`url(#${id}-1)`} />
      <path d={d} fill={`url(#${id}-2)`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-0`} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-1`} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${id}-2`} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** GitHub brand mark. */
function GitHubMark(props: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/** Google brand mark. */
function GoogleMark(props: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}

/** Postgres brand mark. */
function PostgresMark(props: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698zM2.371 11.8765c-.7435-2.4358-1.1779-4.8851-1.2123-5.5719-.1086-2.1714.4171-3.6829 1.5623-4.4927 1.8367-1.2986 4.8398-.5408 6.108-.13-.0032.0032-.0066.0061-.0098.0094-2.0238 2.044-1.9758 5.536-1.9708 5.7495-.0002.0823.0066.1989.0162.3593.0348.5873.0996 1.6804-.0735 2.9184-.1609 1.1504.1937 2.2764.9728 3.0892.0806.0841.1648.1631.2518.2374-.3468.3714-1.1004 1.1926-1.9025 2.1576-.5677.6825-.9597.5517-1.0886.5087-.3919-.1307-.813-.5871-1.2381-1.3223-.4796-.839-.9635-2.0317-1.4155-3.5126zm6.0072 5.0871c-.1711-.0428-.3271-.1132-.4322-.1772.0889-.0394.2374-.0902.4833-.1409 1.2833-.2641 1.4815-.4506 1.9143-1.0002.0992-.126.2116-.2687.3673-.4426a.3549.3549 0 0 0 .0737-.1298c.1708-.1513.2724-.1099.4369-.0417.156.0646.3078.26.3695.4752.0291.1016.0619.2945-.0452.4444-.9043 1.2658-2.2216 1.2494-3.1676 1.0128zm2.094-3.988-.0525.141c-.133.3566-.2567.6881-.3334 1.003-.6674-.0021-1.3168-.2872-1.8105-.8024-.6279-.6551-.9131-1.5664-.7825-2.5004.1828-1.3079.1153-2.4468.079-3.0586-.005-.0857-.0095-.1607-.0122-.2199.2957-.2621 1.6659-.9962 2.6429-.7724.4459.1022.7176.4057.8305.928.5846 2.7038.0774 3.8307-.3302 4.7363-.084.1866-.1633.3629-.2311.5454zm7.3637 4.5725c-.0169.1768-.0358.376-.0618.5959l-.146.4383a.3547.3547 0 0 0-.0182.1077c-.0059.4747-.054.6489-.115.8693-.0634.2292-.1353.4891-.1794 1.0575-.11 1.4143-.8782 2.2267-2.4172 2.5565-1.5155.3251-1.7843-.4968-2.0212-1.2217a6.5824 6.5824 0 0 0-.0769-.2266c-.2154-.5858-.1911-1.4119-.1574-2.5551.0165-.5612-.0249-1.9013-.3302-2.6462.0044-.2932.0106-.5909.019-.8918a.3529.3529 0 0 0-.0153-.1126 1.4927 1.4927 0 0 0-.0439-.208c-.1226-.4283-.4213-.7866-.7797-.9351-.1424-.059-.4038-.1672-.7178-.0869.067-.276.1831-.5875.309-.9249l.0529-.142c.0595-.16.134-.3257.213-.5012.4265-.9476 1.0106-2.2453.3766-5.1772-.2374-1.0981-1.0304-1.6343-2.2324-1.5098-.7207.0746-1.3799.3654-1.7088.5321a5.6716 5.6716 0 0 0-.1958.1041c.0918-1.1064.4386-3.1741 1.7357-4.4823a4.0306 4.0306 0 0 1 .3033-.276.3532.3532 0 0 0 .1447-.0644c.7524-.5706 1.6945-.8506 2.802-.8325.4091.0067.8017.0339 1.1742.081 1.939.3544 3.2439 1.4468 4.0359 2.3827.8143.9623 1.2552 1.9315 1.4312 2.4543-1.3232-.1346-2.2234.1268-2.6797.779-.9926 1.4189.543 4.1729 1.2811 5.4964.1353.2426.2522.4522.2889.5413.2403.5825.5515.9713.7787 1.2552.0696.087.1372.1714.1885.245-.4008.1155-1.1208.3825-1.0552 1.717-.0123.1563-.0423.4469-.0834.8148-.0461.2077-.0702.4603-.0994.7662zm.8905-1.6211c-.0405-.8316.2691-.9185.5967-1.0105a2.8566 2.8566 0 0 0 .135-.0406 1.202 1.202 0 0 0 .1342.103c.5703.3765 1.5823.4213 3.0068.1344-.2016.1769-.5189.3994-.9533.6011-.4098.1903-1.0957.333-1.7473.3636-.7197.0336-1.0859-.0807-1.1721-.151zm.5695-9.2712c-.0059.3508-.0542.6692-.1054 1.0017-.055.3576-.112.7274-.1264 1.1762-.0142.4368.0404.8909.0932 1.3301.1066.887.216 1.8003-.2075 2.7014a3.5272 3.5272 0 0 1-.1876-.3856c-.0527-.1276-.1669-.3326-.3251-.6162-.6156-1.1041-2.0574-3.6896-1.3193-4.7446.3795-.5427 1.3408-.5661 2.1781-.463zm.2284 7.0137a12.3762 12.3762 0 0 0-.0853-.1074l-.0355-.0444c.7262-1.1995.5842-2.3862.4578-3.4385-.0519-.4318-.1009-.8396-.0885-1.2226.0129-.4061.0666-.7543.1185-1.0911.0639-.415.1288-.8443.1109-1.3505.0134-.0531.0188-.1158.0118-.1902-.0457-.4855-.5999-1.938-1.7294-3.253-.6076-.7073-1.4896-1.4972-2.6889-2.0395.5251-.1066 1.2328-.2035 2.0244-.1859 2.0515.0456 3.6746.8135 4.8242 2.2824a.908.908 0 0 1 .0667.1002c.7231 1.3556-.2762 6.2751-2.9867 10.5405zm-8.8166-6.1162c-.025.1794-.3089.4225-.6211.4225a.5821.5821 0 0 1-.0809-.0056c-.1873-.026-.3765-.144-.5059-.3156-.0458-.0605-.1203-.178-.1055-.2844.0055-.0401.0261-.0985.0925-.1488.1182-.0894.3518-.1226.6096-.0867.3163.0441.6426.1938.6113.4186zm7.9305-.4114c.0111.0792-.049.201-.1531.3102-.0683.0717-.212.1961-.4079.2232a.5456.5456 0 0 1-.075.0052c-.2935 0-.5414-.2344-.5607-.3717-.024-.1765.2641-.3106.5611-.352.297-.0414.6111.0088.6356.1851z" />
    </svg>
  );
}

/** Notion brand mark. */
function NotionMark(props: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  );
}

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

/** Seconds as "7.4s", or as "1m 12s" once it passes a hundred. */
function formatTime(seconds: number) {
  if (seconds < 100) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

const tokenFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const formatTokens = (value: number) => tokenFormat.format(Math.round(value));
const formatCost = (value: number) => `$${value.toFixed(2)}`;
/** Short spans keep one decimal for longer, so a 9.4s span never reads as "9s". */
const formatSpanTime = (seconds: number) => (seconds < 10 ? `${seconds.toFixed(1)}s` : formatTime(seconds));

/** The axis keeps headroom past the last event and rounds to a tick step that never crowds the labels. */
function niceAxis(end: number, extra: number) {
  const padded = Math.max(end + 4, extra + 1, 10);
  const step = padded <= 30 ? 10 : padded <= 120 ? 30 : 60;
  return Math.ceil(padded / step) * step;
}

/** Vertical center of a row's bar, in plot pixels. */
const rowCenter = (row: number) => 6 + 44 * row + 22;
const timeOffset = (time: number) => `${time} / var(--axis) * 100%`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const subscribeHydration = () => () => {};

const KIND_LABEL: Record<AgentTimelineKind, string> = { thinking: "Thinking", tool: "Tool call", waiting: "Waiting" };

const enterEase = [...motionTokens.ease.enter] as [number, number, number, number];
const standardEase = [...motionTokens.ease.standard] as [number, number, number, number];

function modelMark(agent: AgentTimelineAgent) {
  if (agent.mark) return agent.mark;
  const model = (agent.model ?? "").toLowerCase();
  if (model.includes("claude")) return <ClaudeMark style={{ color: "#D97757" }} />;
  if (model.includes("gpt") || model.includes("openai")) return <OpenAIMark />;
  if (model.includes("gemini")) return <GeminiMark />;
  return <Bot aria-hidden="true" strokeWidth={1.75} />;
}

/** Built-in marks for the tools people reach for; anything else gets a wrench. */
function toolMark(tool: { name: string; mark?: ReactNode }) {
  if (tool.mark) return tool.mark;
  const name = tool.name.toLowerCase();
  if (name.includes("github")) return <GitHubMark />;
  if (name.includes("search") || name.includes("google")) return <GoogleMark style={{ color: "#4285F4" }} />;
  if (name.includes("postgres")) return <PostgresMark style={{ color: "#4169E1" }} />;
  if (name.includes("notion")) return <NotionMark />;
  return <Wrench aria-hidden="true" strokeWidth={1.75} />;
}

/** The play and pause glyphs share one cell, so the button never changes size. */
function PlayGlyph({ playing }: { playing: boolean }) {
  return (
    <span className={styles.glyph} data-playing={playing || undefined} aria-hidden="true">
      <Play className={styles.glyphPlay} fill="currentColor" strokeWidth={1.75} />
      <Pause className={styles.glyphPause} fill="currentColor" strokeWidth={1.75} />
    </span>
  );
}

function Separator() {
  return (
    <>
      <span className={styles.sep} aria-hidden="true">
        {"\u00a0\u00b7"}
      </span>{" "}
    </>
  );
}

/** Counters reserve the width of their final value, so the header never shifts while it counts. */
function Count({ value, reserve }: { value: string; reserve?: string }) {
  return (
    <span className={styles.count}>
      {reserve && reserve.length > value.length ? (
        <span className={styles.countSizer} aria-hidden="true">
          {reserve}
        </span>
      ) : null}
      <span className={styles.countValue}>{value}</span>
    </span>
  );
}

const sampleRun: AgentTimelineRun = {
title: "Checkout conversion drop on Oct 14",
agents: [
  {
    id: "lead",
    name: "Orchestrator",
    model: "Claude Opus 5.5",
    role: "Plans the run, delegates and merges results",
    price: 8,
  },
  {
    id: "checker",
    name: "Checker",
    model: "GPT-6 Luna",
    role: "Rules out causes outside the codebase",
    price: 0.8,
  },
  {
    id: "researcher",
    name: "Researcher",
    model: "Claude Sonnet 5.5",
    role: "Finds recent changes to checkout",
    price: 4,
  },
  {
    id: "analyst",
    name: "Analyst",
    model: "Claude Haiku 5.5",
    role: "Measures the drop in the orders database",
    price: 0.2,
  },
  {
    id: "writer",
    name: "Writer",
    model: "Gemini 3.8 Flash",
    role: "Drafts the incident summary",
    price: 0.85,
  },
],
spans: [
  {
    agentId: "lead",
    kind: "thinking",
    start: 0,
    end: 2,
    label: "Split the investigation into three tracks",
    tokens: 1920,
  },
  {
    agentId: "lead",
    kind: "waiting",
    start: 2,
    end: 14.6,
    label: "Waiting on the analyst, researcher and checker",
  },
  {
    agentId: "lead",
    kind: "thinking",
    start: 14.6,
    end: 16.8,
    label: "Merged findings: PR #4812 broke address autofill in Safari",
    tokens: 4380,
  },
  {
    agentId: "lead",
    kind: "waiting",
    start: 16.8,
    end: 23,
    label: "Waiting on the writer",
  },
  {
    agentId: "lead",
    kind: "thinking",
    start: 23,
    end: 25.2,
    label: "Reviewed the draft and tightened the timeline",
    tokens: 3140,
  },
  {
    agentId: "lead",
    kind: "tool",
    tool: "Notion",
    start: 25.2,
    end: 26.4,
    label: "Published the summary to the incidents page",
    tokens: 260,
  },
  {
    agentId: "checker",
    kind: "thinking",
    start: 3.5,
    end: 4.1,
    label: "Listed outside causes to rule out",
    tokens: 480,
  },
  {
    agentId: "checker",
    kind: "tool",
    tool: "Web search",
    start: 4.1,
    end: 5.6,
    label: "Searched for payment provider incidents on Oct 14",
    detail: "No matching incidents",
    tokens: 3920,
  },
  {
    agentId: "checker",
    kind: "thinking",
    start: 5.6,
    end: 6.3,
    label: "Checked browser releases next",
    tokens: 610,
  },
  {
    agentId: "checker",
    kind: "tool",
    tool: "Web search",
    start: 6.3,
    end: 7.7,
    label: "Searched browser release notes for autofill changes",
    tokens: 4460,
  },
  {
    agentId: "checker",
    kind: "thinking",
    start: 7.7,
    end: 9.1,
    label: "Ruled out causes outside the codebase",
    tokens: 1180,
  },
  {
    agentId: "researcher",
    kind: "thinking",
    start: 2.9,
    end: 3.5,
    label: "Planned the code search",
    tokens: 620,
  },
  {
    agentId: "researcher",
    kind: "tool",
    tool: "GitHub",
    start: 3.5,
    end: 4.8,
    label: "Listed 14 merged PRs touching checkout since Oct 10",
    tokens: 2140,
  },
  {
    agentId: "researcher",
    kind: "thinking",
    start: 4.8,
    end: 5.5,
    label: "Narrowed to 3 PRs shipped Oct 13 and 14",
    tokens: 980,
  },
  {
    agentId: "researcher",
    kind: "tool",
    tool: "GitHub",
    start: 5.5,
    end: 7.5,
    label: "Read the diff of PR #4812, an address autofill refactor",
    tokens: 6850,
  },
  {
    agentId: "researcher",
    kind: "thinking",
    start: 7.5,
    end: 8.5,
    label: "Traced the change to the Safari autofill path",
    tokens: 1410,
  },
  {
    agentId: "researcher",
    kind: "tool",
    tool: "GitHub",
    start: 8.5,
    end: 9.7,
    label: "Checked deploys: #4812 shipped Oct 13 at 21:40",
    tokens: 1760,
  },
  {
    agentId: "researcher",
    kind: "thinking",
    start: 9.7,
    end: 11.9,
    label: "Wrote up the suspect change with evidence",
    tokens: 2230,
  },
  {
    agentId: "analyst",
    kind: "thinking",
    start: 2.3,
    end: 3,
    label: "Wrote a conversion query for Oct 7 to 15",
    tokens: 540,
  },
  {
    agentId: "analyst",
    kind: "tool",
    tool: "PostgreSQL",
    start: 3,
    end: 5.1,
    label: "Conversion query timed out",
    detail: "Hit the 2s statement timeout on a full scan of orders",
    status: "failed",
    tokens: 410,
  },
  {
    agentId: "analyst",
    kind: "thinking",
    start: 5.1,
    end: 5.7,
    label: "Rewrote the query to use the date index",
    tokens: 380,
  },
  {
    agentId: "analyst",
    kind: "tool",
    tool: "PostgreSQL",
    start: 5.7,
    end: 7.3,
    label: "Retried: conversion by day and platform",
    detail: "Succeeded on the second attempt",
    retry: !0,
    tokens: 1960,
  },
  {
    agentId: "analyst",
    kind: "thinking",
    start: 7.3,
    end: 8.3,
    label: "Found the drop is Safari only, down 9.2%",
    tokens: 720,
  },
  {
    agentId: "analyst",
    kind: "tool",
    tool: "PostgreSQL",
    start: 8.3,
    end: 9.9,
    label: "Pulled checkout errors by step for Safari",
    tokens: 2310,
  },
  {
    agentId: "analyst",
    kind: "thinking",
    start: 9.9,
    end: 11.8,
    label: "Traced the failures to the address step",
    tokens: 860,
  },
  {
    agentId: "analyst",
    kind: "tool",
    tool: "PostgreSQL",
    start: 11.8,
    end: 13,
    label: "Counted affected orders: 1,284",
    tokens: 1140,
  },
  {
    agentId: "analyst",
    kind: "thinking",
    start: 13,
    end: 14.3,
    label: "Summarized the numbers",
    tokens: 640,
  },
  {
    agentId: "writer",
    kind: "thinking",
    start: 17.1,
    end: 17.9,
    label: "Read the merged findings",
    tokens: 1850,
  },
  {
    agentId: "writer",
    kind: "tool",
    tool: "GitHub",
    start: 17.9,
    end: 18.8,
    label: "Pulled the PR #4812 description for context",
    tokens: 1120,
  },
  {
    agentId: "writer",
    kind: "thinking",
    start: 18.8,
    end: 22.7,
    label: "Drafted the incident summary, 412 words",
    tokens: 2940,
  },
],
handoffs: [
  {
    from: "lead",
    to: "analyst",
    at: 2,
    label: "Measure the drop by day and platform",
  },
  {
    from: "lead",
    to: "researcher",
    at: 2.6,
    label: "Find recent changes to checkout",
  },
  {
    from: "lead",
    to: "checker",
    at: 3.2,
    label: "Rule out outside causes",
  },
  {
    from: "checker",
    to: "lead",
    at: 9.4,
    label: "No outside incident on Oct 14",
  },
  {
    from: "researcher",
    to: "lead",
    at: 12.2,
    label: "PR #4812 is the likely cause",
  },
  {
    from: "analyst",
    to: "lead",
    at: 14.6,
    label: "Safari only, 1,284 orders affected",
  },
  {
    from: "lead",
    to: "writer",
    at: 16.8,
    label: "Draft the incident summary",
  },
  {
    from: "writer",
    to: "lead",
    at: 23,
    label: "Draft ready for review",
  },
],
};

interface SpanButtonProps {
  span: PlacedSpan;
  agentName: string;
  state: "active" | "done";
  dim: boolean;
  pinned: boolean;
  tabbable: boolean;
  showIcon: boolean;
  onHover: (id: string) => void;
  onLeave: () => void;
  onFocusSpan: (id: string, visible: boolean) => void;
  onBlurSpan: () => void;
  onPick: (id: string) => void;
}

/** One bar on a lane. The width comes from --now, so a replay never re-renders it per frame. */
const SpanButton = memo(function SpanButton({ span, agentName, state, dim, pinned, tabbable, showIcon, onHover, onLeave, onFocusSpan, onBlurSpan, onPick }: SpanButtonProps) {
  const failed = span.status === "failed" && state === "done";
  const tool = span.toolInfo;
  const kindLabel = tool ? `${KIND_LABEL[span.kind]}, ${tool.name}` : KIND_LABEL[span.kind];
  const range = span.open ? `from ${formatTime(span.start)}, still running` : `${formatTime(span.start)} to ${formatTime(span.end ?? span.start)}`;
  const label = `${agentName}, ${kindLabel}${failed ? ", failed" : ""}: ${span.label}, ${range}${span.tokens ? `, ${formatTokens(span.tokens)} tokens` : ""}`;
  return (
    <button
      type="button"
      className={styles.span}
      data-kind={span.kind}
      data-state={state}
      data-failed={failed || undefined}
      data-dim={dim || undefined}
      data-span-id={span.id}
      aria-pressed={pinned}
      aria-label={label}
      tabIndex={tabbable ? 0 : -1}
      style={{ "--s": span.start, "--d": span.open ? 1e5 : (span.end ?? span.start) - span.start } as CSSProperties}
      onPointerEnter={event => {
        if (event.pointerType === "mouse") onHover(span.id);
      }}
      onPointerLeave={event => {
        if (event.pointerType === "mouse") onLeave();
      }}
      onFocus={event => onFocusSpan(span.id, event.currentTarget.matches(":focus-visible"))}
      onBlur={onBlurSpan}
      onClick={() => onPick(span.id)}
    >
      {state === "done" && showIcon
        ? failed
          ? <CircleX className={styles.spanIcon} aria-hidden="true" strokeWidth={2} />
          : span.retry
            ? <RotateCw className={styles.spanIcon} aria-hidden="true" strokeWidth={2} />
            : null
        : null}
    </button>
  );
});

interface SpanCardProps {
  span: PlacedSpan;
  model: TimelineModel;
  now: number;
  layoutKey: string;
  reduced: boolean;
  rootRef: RefObject<HTMLElement | null>;
  plotRef: React.RefObject<HTMLDivElement | null>;
  axisRef: MutableRefObject<number>;
}

/** The hover card. It glides between spans, flips below the row when there is no room above, and springs to a new height. */
function SpanCard({ span, model, now, layoutKey, reduced, rootRef, plotRef, axisRef }: SpanCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const flip = useMotionValue("0%");
  const height = useMotionValue<number | "auto">("auto");
  const anchor = useRef<{ id: string; above: boolean } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const plot = plotRef.current;
    if (!root || !plot) return;
    const rootBox = root.getBoundingClientRect();
    const plotBox = plot.getBoundingClientRect();
    const width = Math.min(280, rootBox.width - 16);
    const left = plotBox.left - rootBox.left + (span.start / Math.max(axisRef.current, .001)) * plotBox.width;
    const top = plotBox.top - rootBox.top + rowCenter(span.row) - 8;
    const above = top - 10 - 120 > 0;
    const nextX = clamp(left - 12, 8, rootBox.width - width - 8);
    const nextY = above ? top - 8 : top + 16 + 8;
    const last = anchor.current;
    anchor.current = { id: span.id, above };
    if (!last || reduced || last.above !== above || last.id === span.id) {
      x.jump(nextX);
      y.jump(nextY);
      flip.jump(above ? "-100%" : "0%");
      return;
    }
    animate(x, nextX, { type: "spring", visualDuration: .26, bounce: 0 });
    animate(y, nextY, { type: "spring", visualDuration: .26, bounce: 0 });
  }, [span.id, span.start, span.row, layoutKey, reduced, rootRef, plotRef, axisRef, x, y, flip]);

  useEffect(() => {
    const node = bodyRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let first = true;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight;
      if (first || reduced) {
        height.jump(next);
        first = false;
        return;
      }
      animate(height, next, motionTokens.spring.smooth);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [height, reduced]);

  const agent = model.agents[span.row];
  const tool = span.toolInfo;
  const ended = !span.open && now >= (span.end ?? 0);
  const failed = span.status === "failed" && ended;
  const elapsed = span.open ? Math.max(0, now - span.start) : Math.min(now, span.end ?? now) - span.start;
  const handoffs = model.connectors
    .filter(connector => (connector.targetSpan === span.id && connector.to === span.row) || (connector.sourceSpan === span.id && connector.from === span.row))
    .filter(connector => connector.at <= now + .01);

  return (
    <motion.div
      className={styles.cardLayer}
      style={{ x, y }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: motionTokens.duration.fast, ease: enterEase } }}
      exit={{ opacity: 0, transition: { duration: motionTokens.duration.instant, ease: standardEase } }}
      aria-hidden="true"
    >
      <motion.div style={{ y: flip }}>
        <motion.div className={styles.card} style={{ height }} initial={reduced ? false : { y: 3 }} animate={{ y: 0 }} transition={motionTokens.spring.smooth}>
          <div ref={bodyRef}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={span.id}
                className={styles.cardBody}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: motionTokens.duration.fast, ease: enterEase } }}
                exit={{ opacity: 0, transition: { duration: .1 } }}
              >
                <p className={styles.cardHead} style={{ "--c": agent.color } as CSSProperties}>
                  <span className={styles.dot} />
                  <span className={styles.cardAgent}>{agent.name}</span>
                  {agent.model ? <span className={styles.cardModel}>{agent.model}</span> : null}
                </p>
                <p className={styles.cardLabel}>{span.label}</p>
                <p className={styles.cardMeta}>
                  {tool ? (
                    <span className={styles.cardTool}>
                      <span className={styles.mark}>{toolMark(tool)}</span>
                      {tool.name}
                    </span>
                  ) : (
                    <span>{KIND_LABEL[span.kind]}</span>
                  )}
                  <span className={styles.sep}>{"\u00b7"}</span>
                  <span className={styles.tabular}>{ended ? formatSpanTime(elapsed) : `${formatSpanTime(elapsed)} so far`}</span>
                  {span.tokens ? (
                    <>
                      <span className={styles.sep}>{"\u00b7"}</span>
                      <span className={styles.tabular}>{formatTokens(span.tokens)} tokens</span>
                    </>
                  ) : null}
                </p>
                {failed ? (
                  <p className={styles.cardFailed}>
                    <CircleX aria-hidden="true" strokeWidth={1.75} />
                    <span>{`Failed${span.detail ? `: ${span.detail}` : ""}`}</span>
                  </p>
                ) : null}
                {!failed && span.detail && ended ? (
                  <p className={styles.cardNote}>
                    {span.retry ? <RotateCw aria-hidden="true" strokeWidth={1.75} /> : null}
                    <span>{span.detail}</span>
                  </p>
                ) : null}
                {handoffs.length > 0 && handoffs.length <= 2
                  ? handoffs.map(connector => {
                      const incoming = connector.targetSpan === span.id && connector.to === span.row;
                      const other = model.agents[incoming ? connector.from : connector.to];
                      const Icon = incoming ? ArrowRight : ArrowLeft;
                      return (
                        <p key={connector.id} className={styles.cardNote}>
                          <Icon aria-hidden="true" strokeWidth={1.75} />
                          <span>{`${incoming ? "From" : "To"} ${other.name.toLowerCase()}${connector.handoff.label ? `: ${connector.handoff.label}` : ""}`}</span>
                        </p>
                      );
                    })
                  : null}
                {handoffs.length > 2 ? (
                  <p className={styles.cardNote}>
                    <ArrowRight aria-hidden="true" strokeWidth={1.75} />
                    <span>{`${handoffs.length} handoffs during this span`}</span>
                  </p>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}


const EMPTY_AGENTS: AgentTimelineAgent[] = [];
const EMPTY_SPANS: AgentTimelineSpan[] = [];
const EMPTY_HANDOFFS: AgentTimelineHandoff[] = [];

/**
 * A compact timeline of one orchestrated agent run. Each row is an agent with a color dot, its name and its model,
 * the orchestrator on top. Spans on a shared axis show thinking, tool calls and waiting, thin elbows show handoffs,
 * and a playhead replays the run while the header counts time, tokens and cost.
 */
export function AgentTimeline({ run, agents, spans, handoffs, title, autoPlay, speed = 1, speeds = [1, 2], live = false, onSpanSelect, onComplete, className, style }: AgentTimelineProps) {
  const activeRun = run ?? (agents || spans ? undefined : sampleRun);
  const sourceAgents = agents ?? activeRun?.agents ?? EMPTY_AGENTS;
  const sourceSpans = spans ?? activeRun?.spans ?? EMPTY_SPANS;
  const sourceHandoffs = handoffs ?? activeRun?.handoffs ?? EMPTY_HANDOFFS;

  const model = useMemo<TimelineModel>(() => {
    const rowOf = new Map<string, number>();
    const placedAgents = sourceAgents.map((agent, index) => {
      rowOf.set(agent.id, index);
      return {
        ...agent,
        index,
        color: agent.color ?? (index === 0 ? "var(--text-secondary)" : SERIES[(index - 1) % SERIES.length]),
      };
    });

    const placedSpans: PlacedSpan[] = [];
    sourceSpans.forEach((span, index) => {
      const row = rowOf.get(span.agentId);
      if (row === undefined) return;
      const price = placedAgents[row].price ?? 0;
      placedSpans.push({
        ...span,
        id: span.id ?? `${span.agentId}-${index}`,
        index: placedSpans.length,
        row,
        open: span.end === undefined,
        toolInfo: span.tool == null ? undefined : typeof span.tool === "string" ? { name: span.tool } : span.tool,
        spanCost: span.cost ?? ((span.tokens ?? 0) * price) / 1e6,
      });
    });
    placedSpans.sort((a, b) => a.start - b.start || a.row - b.row);
    placedSpans.forEach((span, index) => {
      span.index = index;
    });

    const byRow = placedAgents.map(() => [] as PlacedSpan[]);
    placedSpans.forEach(span => byRow[span.row].push(span));

    const longestSpan = Math.max(0, ...placedSpans.map(span => span.end ?? span.start), ...sourceHandoffs.map(handoff => handoff.at));
    const duration = activeRun?.duration ?? longestSpan;

    /** Connectors are inferred: a dispatch drops from the source at `at` and enters the target's next span, a result leaves the source's last span and rises into the target. */
    const connectors: Connector[] = [];
    sourceHandoffs.forEach((handoff, index) => {
      const from = rowOf.get(handoff.from);
      const to = rowOf.get(handoff.to);
      if (from === undefined || to === undefined || from === to) return;
      const at = handoff.at;
      const sourceRow = byRow[from];
      const targetRow = byRow[to];
      const openIn = (row: PlacedSpan[]) => row.find(span => span.start <= at && (span.open || at < (span.end ?? at)));
      const lastEnding = openIn(sourceRow) ? undefined : sourceRow.filter(span => !span.open && (span.end ?? 0) <= at + .01 && (span.end ?? 0) >= at - 1.5).at(-1);
      const nextStart = targetRow.find(span => span.start >= at - .01 && span.start <= at + 2);
      const gapOut = lastEnding ? at - (lastEnding.end ?? at) : 0;
      const gapIn = nextStart ? nextStart.start - at : 0;
      const shape: Connector["shape"] = gapOut > .05 && gapOut > gapIn ? "in" : !(gapIn > .05) && (lastEnding || openIn(targetRow)) ? "line" : "out";
      const color = shape === "in" ? placedAgents[from].color : placedAgents[to].color;
      connectors.push({
        id: `h${index}`,
        handoff,
        from,
        to,
        at,
        shape,
        up: to < from,
        color,
        x0: shape === "in" ? lastEnding?.end ?? at : at,
        x1: shape === "out" ? nextStart?.start ?? at : at,
        sourceSpan: (shape === "in" ? lastEnding : openIn(sourceRow) ?? lastEnding)?.id,
        targetSpan: (nextStart ?? openIn(targetRow))?.id,
      });
    });

    const closed = placedSpans.filter(span => !span.open);
    const tokens = placedSpans.reduce((sum, span) => sum + (span.tokens ?? 0), 0);
    const cost = placedSpans.reduce((sum, span) => sum + span.spanCost, 0);
    const worked = closed.filter(span => span.kind !== "waiting").reduce((sum, span) => sum + ((span.end ?? span.start) - span.start), 0);

    return {
      agents: placedAgents,
      spans: placedSpans,
      byRow,
      connectors,
      duration,
      totals: { tokens, cost, speedup: duration > 0 ? worked / duration : 0 },
    };
  }, [sourceAgents, sourceSpans, sourceHandoffs, activeRun?.duration]);

  const duration = Math.max(model.duration, .001);
  const startedAt = activeRun?.startedAt;
  const lastEnd = useMemo(() => Math.max(0, ...model.spans.map(span => span.end ?? span.start)), [model]);
  const heading = title ?? activeRun?.title ?? "Agent run";
  const shouldAutoPlay = autoPlay ?? (run === undefined && agents === undefined && spans === undefined);
  const uid = useId();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const reducedMotion = useReducedMotion();
  const reduced = hydrated && !!reducedMotion;

  const rootRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLSpanElement>(null);
  const nowRef = useRef(shouldAutoPlay || live ? 0 : duration);
  const axisRef = useRef(live ? niceAxis(0, 0) : duration);
  const lastRender = useRef(0);
  const speedRef = useRef(speed);
  const pointer = useRef<{ id: number } | null>(null);
  const metrics = useRef({ auto: 0, manualUntil: 0, plotLeft: 0, plotWidth: 360, labels: 0 });
  const hoverTimer = useRef(0);
  const liveStart = useRef(0);
  const completed = useRef(!(shouldAutoPlay || live));
  const inView = useInView(rootRef, { amount: .2 });

  const [now, setNow] = useState(() => (shouldAutoPlay || live ? 0 : duration));
  const [playing, setPlaying] = useState(shouldAutoPlay && !live);
  const [interacted, setInteracted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(speed);
  const [scrubbing, setScrubbing] = useState(false);
  const [axis, setAxis] = useState(() => (live ? niceAxis(0, 0) : duration));
  const [plotWidth, setPlotWidth] = useState(360);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cardSpanId, setCardSpanId] = useState<string | null>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const [wasLive, setWasLive] = useState(live);

  if (wasLive !== live) {
    setWasLive(live);
    if (!live) {
      setNow(duration);
      setPlaying(false);
      setAxis(duration);
    }
  }

  const autoPlaying = reduced && shouldAutoPlay && !interacted && !live;
  const shownNow = autoPlaying ? duration : live ? now : Math.min(now, duration);
  const shownAxis = live ? axis : duration;
  const finished = !live && shownNow >= duration - 1e-6;
  const settled = (playing && !autoPlaying) || live;

  useEffect(() => {
    speedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const writeClock = useCallback((next: number, force = false) => {
    nowRef.current = next;
    plotRef.current?.style.setProperty("--now", next.toFixed(3));
    const stamp = performance.now();
    if (force || stamp - lastRender.current >= 48) {
      lastRender.current = stamp;
      setNow(next);
    }
  }, []);

  const followPlayhead = useCallback((time: number) => {
    const scroller = scrollerRef.current;
    const metricsNow = metrics.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth + 1 || performance.now() < metricsNow.manualUntil) return;
    const x = metricsNow.plotLeft + (time / Math.max(axisRef.current, .001)) * metricsNow.plotWidth;
    const visible = scroller.clientWidth - metricsNow.labels;
    const target = clamp(x - metricsNow.labels - .62 * visible, 0, scroller.scrollWidth - scroller.clientWidth);
    if (target > scroller.scrollLeft + .5) {
      metricsNow.auto = target;
      scroller.scrollLeft = target;
    }
  }, []);

  useEffect(() => {
    if (!playing || autoPlaying || live || scrubbing || !inView) return;
    let frame = 0;
    let last = performance.now();
    const step = (stamp: number) => {
      const delta = clamp((stamp - last) / 1000, 0, .1);
      last = stamp;
      const next = Math.min(duration, nowRef.current + delta * speedRef.current);
      writeClock(next, next >= duration);
      followPlayhead(next);
      if (next >= duration) setPlaying(false);
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, autoPlaying, live, scrubbing, inView, duration, writeClock, followPlayhead]);

  useEffect(() => {
    if (!live) return;
    if (!liveStart.current) liveStart.current = Date.now();
    const started = startedAt ?? liveStart.current;
    const plot = plotRef.current;
    let frame = 0;
    let last = performance.now();
    let current = axisRef.current;
    const step = (stamp: number) => {
      const delta = clamp((stamp - last) / 1000, 0, .1);
      last = stamp;
      const elapsed = Math.max(0, (Date.now() - started) / 1000);
      const target = niceAxis(elapsed, lastEnd);
      if (target !== current) {
        current = target;
        setAxis(target);
      }
      const eased = reduced ? current : axisRef.current + (current - axisRef.current) * (1 - Math.exp(-(7 * delta)));
      axisRef.current = Math.abs(current - eased) < .005 ? current : eased;
      plot?.style.setProperty("--axis", axisRef.current.toFixed(3));
      writeClock(elapsed);
      followPlayhead(elapsed);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      plot?.style.removeProperty("--axis");
    };
  }, [live, startedAt, lastEnd, reduced, writeClock, followPlayhead]);

  useEffect(() => {
    if (!live) axisRef.current = duration;
  }, [live, duration]);

  useLayoutEffect(() => {
    if (settled || scrubbing) return;
    nowRef.current = shownNow;
    plotRef.current?.style.setProperty("--now", shownNow.toFixed(3));
  }, [settled, scrubbing, shownNow]);

  useEffect(() => {
    if (finished && !completed.current) {
      completed.current = true;
      onComplete?.();
    }
    if (!finished) completed.current = false;
  }, [finished, onComplete]);

  useEffect(() => {
    const plot = plotRef.current;
    const scroller = scrollerRef.current;
    if (!plot || !scroller || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const plotBox = plot.getBoundingClientRect();
      const scrollerBox = scroller.getBoundingClientRect();
      const labels = scroller.querySelector<HTMLElement>(`.${styles.labels}`)?.offsetWidth ?? 0;
      Object.assign(metrics.current, {
        plotLeft: plotBox.left - scrollerBox.left + scroller.scrollLeft,
        plotWidth: plotBox.width,
        labels,
      });
      setPlotWidth(Math.round(plotBox.width));
    });
    observer.observe(plot);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const spansById = useMemo(() => new Map(model.spans.map(span => [span.id, span])), [model]);

  /** Pinning a span dims everything off its handoff path: a dispatch's whole subtree, or one agent's stretch between two handoffs. */
  const trace = useMemo(() => {
    if (!selectedId) return null;
    const focus = model.spans.find(span => span.id === selectedId);
    if (!focus) return null;
    const spans = new Set([focus.id]);
    const links = new Set<string>();
    const end = focus.end ?? Infinity;
    if (focus.row === 0) {
      model.connectors.forEach(connector => {
        if (connector.sourceSpan !== focus.id && connector.targetSpan !== focus.id) return;
        links.add(connector.id);
        if (connector.sourceSpan) spans.add(connector.sourceSpan);
        if (connector.targetSpan) spans.add(connector.targetSpan);
      });
    } else {
      const incoming = model.connectors.filter(connector => connector.to === focus.row && connector.at <= focus.start + .01).at(-1);
      const outgoing = model.connectors.find(connector => connector.from === focus.row && connector.at >= end - .01);
      const from = incoming?.at ?? -Infinity;
      const to = outgoing?.at ?? Infinity;
      model.byRow[focus.row].forEach(span => {
        if (span.start >= from - .01 && (span.end ?? Infinity) <= to + .01) spans.add(span.id);
      });
      [incoming, outgoing].forEach(connector => {
        if (!connector) return;
        links.add(connector.id);
        if (connector.sourceSpan) spans.add(connector.sourceSpan);
        if (connector.targetSpan) spans.add(connector.targetSpan);
      });
    }
    return { spans, links };
  }, [model, selectedId]);

  const started = useCallback((span: PlacedSpan) => span.start <= shownNow + 1e-6, [shownNow]);
  const cardId = hoveredId ?? focusedId ?? selectedId;
  const cardTarget = cardId ? spansById.get(cardId) : undefined;
  const cardSpan = cardTarget && started(cardTarget) ? cardTarget : undefined;
  const firstStarted = model.spans.find(started);
  const tabbableId = cardSpanId && spansById.get(cardSpanId) && started(spansById.get(cardSpanId) as PlacedSpan) ? cardSpanId : firstStarted?.id ?? null;

  const [visibleAtMount] = useState(() => new Set(model.connectors.filter(connector => connector.at <= (shouldAutoPlay || live ? 0 : duration)).map(connector => connector.id)));

  const hoverSpan = useCallback((id: string) => {
    window.clearTimeout(hoverTimer.current);
    setHoveredId(id);
  }, []);
  const leaveSpan = useCallback(() => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoveredId(null), 80);
  }, []);
  const focusSpan = useCallback((id: string, visible: boolean) => {
    setCardSpanId(id);
    if (visible) setFocusedId(id);
  }, []);
  const blurSpan = useCallback(() => setFocusedId(null), []);
  const pickSpan = useCallback((id: string) => {
    const next = selectedId === id ? null : id;
    setSelectedId(next);
    setCardSpanId(id);
    onSpanSelect?.(next ? spansById.get(next) ?? null : null);
  }, [selectedId, onSpanSelect, spansById]);
  const unpin = () => {
    if (!selectedId) return;
    setSelectedId(null);
    onSpanSelect?.(null);
  };

  const timeFrom = (clientX: number) => {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return nowRef.current;
    return clamp((clientX - box.left) / box.width, 0, 1) * duration;
  };

  const endScrub = (event: ReactPointerEvent) => {
    if (pointer.current?.id !== event.pointerId) return;
    pointer.current = null;
    setScrubbing(false);
    writeClock(nowRef.current, true);
    if (nowRef.current >= duration) setPlaying(false);
  };

  let shownTokens = 0;
  let totalTokens = 0;
  let shownCost = 0;
  let totalCost = 0;
  const working = new Set<number>();
  for (const span of model.spans) {
    const progress = (() => {
      if (shownNow <= span.start) return 0;
      if (span.open) return 1;
      const length = (span.end ?? span.start) - span.start;
      return length <= 0 ? 1 : Math.min(1, (shownNow - span.start) / length);
    })();
    shownTokens += (span.tokens ?? 0) * progress;
    totalTokens += span.tokens ?? 0;
    shownCost += span.spanCost * progress;
    totalCost += span.spanCost;
    if (span.kind !== "waiting" && span.start <= shownNow && (span.open || shownNow < (span.end ?? shownNow))) working.add(span.row);
  }
  const speedup = model.totals.speedup;
  const summaryParts = [
    `${model.agents.length} agents`,
    formatTime(duration),
    speedup >= 1.1 ? `${speedup.toFixed(1)}x faster than sequential` : null,
    formatCost(model.totals.cost),
  ].filter((part): part is string => Boolean(part));
  const status = settled ? "running" : shownNow <= 0 ? "ready" : "paused";
  const liveText = finished
    ? `Run finished: ${summaryParts.join(", ")}`
    : settled && interacted
      ? live
        ? "Following the live run"
        : `Replaying at ${playbackSpeed}x`
      : interacted && !scrubbing
        ? `Paused at ${formatTime(shownNow)}`
        : "";

  const tickStep = (() => {
    const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const pxPerSecond = plotWidth / Math.max(shownAxis, .001);
    return steps.find(step => step * pxPerSecond >= 56) ?? steps.at(-1) ?? 60;
  })();
  const ticks: number[] = [];
  for (let tick = 0; tick <= shownAxis + 1e-6; tick += tickStep) ticks.push(Math.round(100 * tick) / 100);
  const pxPerSecond = plotWidth / Math.max(shownAxis, .001);
  const drawLinks = hydrated && !reduced;
  const speedOptions = Array.from(new Set([...speeds, speed])).sort((a, b) => a - b).map(value => ({ value: String(value), label: `${value}x` }));
  const rowsHeight = 6 + 44 * model.agents.length;
  const layoutKey = `${scrollTick}:${plotWidth}:${axis}`;

  return (
    <section
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={style}
      aria-labelledby={`${uid}-title`}
      onKeyDown={event => {
        if (event.key === "Escape" && selectedId && !(event.target as HTMLElement).dataset?.spanId) unpin();
      }}
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <h3 id={`${uid}-title`} className={styles.title}>{heading}</h3>
          <div className={styles.status}>
            <p className={styles.layer} data-on={finished ? undefined : true} aria-hidden={finished || undefined}>
              <span className={styles.word}>
                <span className={styles.wordItem} data-on={status === "running" || undefined}>
                  <TextShimmer active={settled && !reduced}>{live ? "Live" : "Running"}</TextShimmer>
                </span>
                {!live && <span className={styles.wordItem} data-on={status === "paused" || undefined}>Paused</span>}
                {!live && <span className={styles.wordItem} data-on={status === "ready" || undefined}>Ready</span>}
              </span>
              <Separator />
              <span className={styles.part}>
                <Count value={formatTime(shownNow)} reserve={live ? undefined : formatTime(duration)} />
              </span>
              <Separator />
              <span className={styles.part}>
                <Count value={formatTokens(shownTokens)} reserve={live ? undefined : formatTokens(totalTokens)} /> <span className={styles.unit}>tokens</span>
              </span>
              <Separator />
              <span className={styles.part}>
                <Count value={formatCost(shownCost)} reserve={live ? undefined : formatCost(totalCost)} />
              </span>
              {working.size > 0 && settled ? <span className={styles.srOnly}>{`, ${working.size} agents working`}</span> : null}
            </p>
            <p className={styles.layer} data-on={finished || undefined} aria-hidden={finished ? undefined : true}>
              <CircleCheck className={styles.doneIcon} aria-hidden="true" strokeWidth={1.75} />
              <span className={styles.srOnly}>Finished: </span>
              {summaryParts.map((part, index) => (
                <Fragment key={part}>
                  {index > 0 && <Separator />}
                  <span className={styles.part}>{part}</span>
                </Fragment>
              ))}
            </p>
          </div>
        </header>

        <div
          ref={scrollerRef}
          className={styles.scroller}
          onScroll={() => {
            const scroller = scrollerRef.current;
            if (!scroller) return;
            scroller.toggleAttribute("data-scrolled", scroller.scrollLeft > 1);
            if (Math.abs(scroller.scrollLeft - metrics.current.auto) > 2) metrics.current.manualUntil = performance.now() + 2500;
            if (cardSpan) setScrollTick(value => value + 1);
          }}
        >
          <div
            className={styles.body}
            style={{ "--now": shownNow, "--axis": shownAxis, "--rows-h": `${rowsHeight}px`, "--row": "44px", "--bar": "16px", "--pad": "6px", "--axis-h": "30px" } as CSSProperties}
          >
            <div className={styles.labels}>
              {model.agents.map(agent => (
                <div key={agent.id} id={`${uid}-row-${agent.index}`} className={styles.label} style={{ "--c": agent.color } as CSSProperties}>
                  <span className={styles.dot} aria-hidden="true" />
                  <span className={styles.labelText}>
                    <span className={styles.name}>{agent.name}</span>
                    {agent.model && (
                      <span className={styles.model}>
                        <span className={styles.mark} aria-hidden="true">{modelMark(agent)}</span>
                        <span className={styles.modelName}>{agent.model}</span>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.track}>
              <div
                ref={plotRef}
                className={styles.plot}
                data-path={trace ? "" : undefined}
                onKeyDown={event => {
                  const targetId = (event.target as HTMLElement).dataset?.spanId;
                  const span = targetId ? spansById.get(targetId) : undefined;
                  if (!span) return;
                  if (event.key === "Escape") {
                    if (selectedId) {
                      event.preventDefault();
                      unpin();
                    }
                    return;
                  }
                  const startedInRow = (row: number) => model.byRow[row].filter(started);
                  const middle = (item: PlacedSpan) => (item.start + Math.min(item.end ?? shownNow, shownNow)) / 2;
                  const row = startedInRow(span.row);
                  const index = row.findIndex(item => item.id === span.id);
                  let next: PlacedSpan | undefined;
                  if (event.key === "ArrowRight") next = row[index + 1];
                  else if (event.key === "ArrowLeft") next = row[index - 1];
                  else if (event.key === "Home") next = row[0];
                  else if (event.key === "End") next = row.at(-1);
                  else {
                    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                    const direction = event.key === "ArrowDown" ? 1 : -1;
                    for (let r = span.row + direction; r >= 0 && r < model.agents.length && !next; r += direction) {
                      next = startedInRow(r).reduce<PlacedSpan | undefined>((best, item) => (!best || Math.abs(middle(item) - middle(span)) < Math.abs(middle(best) - middle(span)) ? item : best), undefined);
                    }
                  }
                  event.preventDefault();
                  if (!next) return;
                  setCardSpanId(next.id);
                  plotRef.current?.querySelector<HTMLElement>(`[data-span-id="${CSS.escape(next.id)}"]`)?.focus();
                }}
                onClick={event => {
                  const target = event.target as HTMLElement;
                  if (!target.closest("button") && !target.closest(`.${styles.axis}`)) unpin();
                }}
              >
                <div className={styles.grid} aria-hidden="true">
                  {ticks.map(tick => <span key={tick} className={styles.gridline} style={{ left: `calc(${timeOffset(tick)})` }} />)}
                </div>
                <div className={styles.links} aria-hidden="true">
                  {model.connectors.filter(connector => connector.at <= shownNow + 1e-6).map(connector => {
                    let top: number;
                    let bottom: number;
                    if (connector.shape === "out") {
                      [top, bottom] = connector.up ? [rowCenter(connector.to) - .75, rowCenter(connector.from) - 8] : [rowCenter(connector.from) + 8, rowCenter(connector.to) + .75];
                    } else if (connector.shape === "in") {
                      [top, bottom] = connector.up ? [rowCenter(connector.to) + 8, rowCenter(connector.from) + .75] : [rowCenter(connector.from) - .75, rowCenter(connector.to) - 8];
                    } else {
                      [top, bottom] = connector.up ? [rowCenter(connector.to) + 8, rowCenter(connector.from) - 8] : [rowCenter(connector.from) + 8, rowCenter(connector.to) - 8];
                    }
                    const inset = .75 * (connector.shape === "in" ? 0 : 1);
                    return (
                      <span
                        key={connector.id}
                        className={styles.link}
                        data-shape={connector.shape}
                        data-dir={connector.up ? "up" : "down"}
                        data-draw={(drawLinks && (interacted || live || !visibleAtMount.has(connector.id))) || undefined}
                        data-hot={trace?.links.has(connector.id) || undefined}
                        style={{
                          "--c": connector.color,
                          top,
                          height: Math.max(0, bottom - top),
                          left: `calc(${timeOffset(connector.x0)} - ${inset}px)`,
                          width: connector.shape === "line" ? 1.5 : `calc(${timeOffset(connector.x1 - connector.x0)} + 0.75px)`,
                        } as CSSProperties}
                      />
                    );
                  })}
                </div>
                {model.agents.map(agent => (
                  <div key={agent.id} role="group" aria-labelledby={`${uid}-row-${agent.index}`} className={styles.row} style={{ "--c": agent.color, top: 6 + 44 * agent.index } as CSSProperties}>
                    {model.byRow[agent.index].filter(started).map(span => {
                      const state: "active" | "done" = span.open ? (live ? "active" : "done") : shownNow < (span.end ?? shownNow) ? "active" : "done";
                      return (
                        <SpanButton
                          key={span.id}
                          span={span}
                          agentName={agent.name}
                          state={state}
                          dim={!!trace && !trace.spans.has(span.id)}
                          pinned={selectedId === span.id}
                          tabbable={tabbableId === span.id}
                          showIcon={!span.open && ((span.end ?? span.start) - span.start) * pxPerSecond >= 15}
                          onHover={hoverSpan}
                          onLeave={leaveSpan}
                          onFocusSpan={focusSpan}
                          onBlurSpan={blurSpan}
                          onPick={pickSpan}
                        />
                      );
                    })}
                  </div>
                ))}
                <div className={styles.ports} aria-hidden="true">
                  {model.connectors.filter(connector => connector.at <= shownNow + 1e-6).map(connector => {
                    const row = connector.shape === "in" ? connector.to : connector.from;
                    const top = connector.shape === "in" ? (connector.up ? rowCenter(row) + 8 : rowCenter(row) - 8) : connector.up ? rowCenter(row) - 8 : rowCenter(row) + 8;
                    return (
                      <span
                        key={connector.id}
                        className={styles.port}
                        data-draw={(drawLinks && (interacted || live || !visibleAtMount.has(connector.id))) || undefined}
                        data-hot={trace?.links.has(connector.id) || undefined}
                        style={{ "--c": connector.color, top, left: `calc(${timeOffset(connector.at)})`, "--delay": connector.shape === "in" ? "260ms" : "0ms" } as CSSProperties}
                      />
                    );
                  })}
                </div>
                <div className={styles.playhead} data-settled={(finished && !scrubbing) || undefined} aria-hidden="true" />
                <div
                  className={styles.axis}
                  data-live={live || undefined}
                  onPointerDown={event => {
                    if (live || event.button !== 0) return;
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    knobRef.current?.focus({ preventScroll: true });
                    pointer.current = { id: event.pointerId };
                    setInteracted(true);
                    setScrubbing(true);
                    if (autoPlaying) setPlaying(false);
                    writeClock(timeFrom(event.clientX), true);
                  }}
                  onPointerMove={event => {
                    if (pointer.current?.id !== event.pointerId) return;
                    writeClock(timeFrom(event.clientX));
                  }}
                  onPointerUp={endScrub}
                  onPointerCancel={endScrub}
                >
                  {ticks.map(tick => (
                    <span key={tick} className={styles.tick} style={{ left: `calc(${timeOffset(tick)})` }} aria-hidden="true">
                      {tick < 60 ? `${tick}s` : (() => {
                        const minutes = Math.floor(tick / 60);
                        const rest = Math.round(tick % 60);
                        return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
                      })()}
                    </span>
                  ))}
                  <span
                    ref={knobRef}
                    className={styles.knob}
                    data-active={scrubbing || undefined}
                    role="slider"
                    tabIndex={live ? -1 : 0}
                    aria-label="Run time"
                    aria-valuemin={0}
                    aria-valuemax={Number(duration.toFixed(1))}
                    aria-valuenow={Number(shownNow.toFixed(1))}
                    aria-valuetext={`${formatTime(shownNow)} of ${formatTime(live ? shownNow : duration)}`}
                    aria-disabled={live || undefined}
                    onKeyDown={event => {
                      if (live) return;
                      const step = event.shiftKey ? 5 : .5;
                      const from = autoPlaying ? duration : nowRef.current;
                      const next =
                        event.key === "ArrowRight" || event.key === "ArrowUp" ? from + step
                        : event.key === "ArrowLeft" || event.key === "ArrowDown" ? from - step
                        : event.key === "PageUp" ? from + 5
                        : event.key === "PageDown" ? from - 5
                        : event.key === "Home" ? 0
                        : event.key === "End" ? duration
                        : null;
                      if (next === null) return;
                      event.preventDefault();
                      setInteracted(true);
                      if (autoPlaying) setPlaying(false);
                      writeClock(clamp(next, 0, duration), true);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className={styles.footer}>
          {!live && (
            <div className={styles.controls}>
              <Button
                variant="secondary"
                size="sm"
                className={styles.iconButton}
                aria-label={settled ? "Pause" : finished || autoPlaying ? "Replay" : "Play"}
                onClick={() => {
                  setInteracted(true);
                  if (settled && !live) {
                    writeClock(nowRef.current, true);
                    setPlaying(false);
                    return;
                  }
                  if (finished || autoPlaying) {
                    writeClock(0, true);
                    unpin();
                    setHoveredId(null);
                    metrics.current.manualUntil = 0;
                    scrollerRef.current?.scrollTo({ left: 0, behavior: reduced ? "auto" : "smooth" });
                  }
                  setPlaying(true);
                }}
              >
                <PlayGlyph playing={settled} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={styles.iconButton}
                aria-label="Restart"
                onClick={() => {
                  setInteracted(true);
                  writeClock(0, true);
                  unpin();
                  setHoveredId(null);
                  metrics.current.manualUntil = 0;
                  scrollerRef.current?.scrollTo({ left: 0, behavior: reduced ? "auto" : "smooth" });
                  setPlaying(true);
                }}
              >
                <RotateCcw aria-hidden="true" strokeWidth={1.75} />
              </Button>
              {speedOptions.length > 1 && (
                <SegmentedControl label="Playback speed" options={speedOptions} value={String(playbackSpeed)} onValueChange={next => setPlaybackSpeed(Number(next))} />
              )}
            </div>
          )}
          <ul className={styles.legend} aria-label="Legend">
            <li><span className={styles.swatch} data-kind="thinking" aria-hidden="true" />Thinking</li>
            <li><span className={styles.swatch} data-kind="tool" aria-hidden="true" />Tool call</li>
            <li><span className={styles.swatch} data-kind="waiting" aria-hidden="true" />Waiting</li>
            <li><CornerDownRight className={styles.legendIcon} aria-hidden="true" strokeWidth={1.75} />Handoff</li>
            {model.spans.some(span => span.status === "failed") && (
              <li><CircleX className={styles.legendFailed} aria-hidden="true" strokeWidth={1.75} />Failed</li>
            )}
          </ul>
        </footer>
      </div>
      <AnimatePresence>
        {cardSpan && (
          <SpanCard
            key="card"
            span={cardSpan}
            model={model}
            now={shownNow}
            layoutKey={layoutKey}
            reduced={reduced}
            rootRef={rootRef}
            plotRef={plotRef}
            axisRef={axisRef}
          />
        )}
      </AnimatePresence>
      <p className={styles.srOnly} aria-live="polite">{liveText}</p>
    </section>
  );
}

export default AgentTimeline;
