"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { CSSProperties, ReactNode, SVGProps } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import {
  Check,
  CircleCheck,
  CircleDashed,
  FileText,
  Layers,
  ListChecks,
  LoaderCircle,
  MessageSquareText,
  Pause,
  Play,
  RotateCcw,
  StepForward,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import Button from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import TextShimmer from "../text-shimmer/text-shimmer";
import Tooltip from "../tooltip/tooltip";
import styles from "./agent-loop.module.css";

/* --------------------------------------------------------------------------------------------
 * Marks. The shipped package keeps these in `agent-loop-marks`; they live here so the component,
 * its sample run and any consumer share one set of brand glyphs.
 * ------------------------------------------------------------------------------------------ */

interface MarkProps extends Omit<SVGProps<SVGSVGElement>, "title"> {
  /** Accessible name for the brand glyph. */
  title?: string;
}

/** GitHub's mark, drawn in the current text colour. */
export function GitHubMark({ title = "GitHub", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/** PostgreSQL's elephant, tinted by the caller through `style`/`color`. */
export function PostgreSQLMark({ title = "PostgreSQL", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698zM2.371 11.8765c-.7435-2.4358-1.1779-4.8851-1.2123-5.5719-.1086-2.1714.4171-3.6829 1.5623-4.4927 1.8367-1.2986 4.8398-.5408 6.108-.13-.0032.0032-.0066.0061-.0098.0094-2.0238 2.044-1.9758 5.536-1.9708 5.7495-.0002.0823.0066.1989.0162.3593.0348.5873.0996 1.6804-.0735 2.9184-.1609 1.1504.1937 2.2764.9728 3.0892.0806.0841.1648.1631.2518.2374-.3468.3714-1.1004 1.1926-1.9025 2.1576-.5677.6825-.9597.5517-1.0886.5087-.3919-.1307-.813-.5871-1.2381-1.3223-.4796-.839-.9635-2.0317-1.4155-3.5126zm6.0072 5.0871c-.1711-.0428-.3271-.1132-.4322-.1772.0889-.0394.2374-.0902.4833-.1409 1.2833-.2641 1.4815-.4506 1.9143-1.0002.0992-.126.2116-.2687.3673-.4426a.3549.3549 0 0 0 .0737-.1298c.1708-.1513.2724-.1099.4369-.0417.156.0646.3078.26.3695.4752.0291.1016.0619.2945-.0452.4444-.9043 1.2658-2.2216 1.2494-3.1676 1.0128zm2.094-3.988-.0525.141c-.133.3566-.2567.6881-.3334 1.003-.6674-.0021-1.3168-.2872-1.8105-.8024-.6279-.6551-.9131-1.5664-.7825-2.5004.1828-1.3079.1153-2.4468.079-3.0586-.005-.0857-.0095-.1607-.0122-.2199.2957-.2621 1.6659-.9962 2.6429-.7724.4459.1022.7176.4057.8305.928.5846 2.7038.0774 3.8307-.3302 4.7363-.084.1866-.1633.3629-.2311.5454zm7.3637 4.5725c-.0169.1768-.0358.376-.0618.5959l-.146.4383a.3547.3547 0 0 0-.0182.1077c-.0059.4747-.054.6489-.115.8693-.0634.2292-.1353.4891-.1794 1.0575-.11 1.4143-.8782 2.2267-2.4172 2.5565-1.5155.3251-1.7843-.4968-2.0212-1.2217a6.5824 6.5824 0 0 0-.0769-.2266c-.2154-.5858-.1911-1.4119-.1574-2.5551.0165-.5612-.0249-1.9013-.3302-2.6462.0044-.2932.0106-.5909.019-.8918a.3529.3529 0 0 0-.0153-.1126 1.4927 1.4927 0 0 0-.0439-.208c-.1226-.4283-.4213-.7866-.7797-.9351-.1424-.059-.4038-.1672-.7178-.0869.067-.276.1831-.5875.309-.9249l.0529-.142c.0595-.16.134-.3257.213-.5012.4265-.9476 1.0106-2.2453.3766-5.1772-.2374-1.0981-1.0304-1.6343-2.2324-1.5098-.7207.0746-1.3799.3654-1.7088.5321a5.6716 5.6716 0 0 0-.1958.1041c.0918-1.1064.4386-3.1741 1.7357-4.4823a4.0306 4.0306 0 0 1 .3033-.276.3532.3532 0 0 0 .1447-.0644c.7524-.5706 1.6945-.8506 2.802-.8325.4091.0067.8017.0339 1.1742.081 1.939.3544 3.2439 1.4468 4.0359 2.3827.8143.9623 1.2552 1.9315 1.4312 2.4543-1.3232-.1346-2.2234.1268-2.6797.779-.9926 1.4189.543 4.1729 1.2811 5.4964.1353.2426.2522.4522.2889.5413.2403.5825.5515.9713.7787 1.2552.0696.087.1372.1714.1885.245-.4008.1155-1.1208.3825-1.0552 1.717-.0123.1563-.0423.4469-.0834.8148-.0461.2077-.0702.4603-.0994.7662zm.8905-1.6211c-.0405-.8316.2691-.9185.5967-1.0105a2.8566 2.8566 0 0 0 .135-.0406 1.202 1.202 0 0 0 .1342.103c.5703.3765 1.5823.4213 3.0068.1344-.2016.1769-.5189.3994-.9533.6011-.4098.1903-1.0957.333-1.7473.3636-.7197.0336-1.0859-.0807-1.1721-.151zm.5695-9.2712c-.0059.3508-.0542.6692-.1054 1.0017-.055.3576-.112.7274-.1264 1.1762-.0142.4368.0404.8909.0932 1.3301.1066.887.216 1.8003-.2075 2.7014a3.5272 3.5272 0 0 1-.1876-.3856c-.0527-.1276-.1669-.3326-.3251-.6162-.6156-1.1041-2.0574-3.6896-1.3193-4.7446.3795-.5427 1.3408-.5661 2.1781-.463zm.2284 7.0137a12.3762 12.3762 0 0 0-.0853-.1074l-.0355-.0444c.7262-1.1995.5842-2.3862.4578-3.4385-.0519-.4318-.1009-.8396-.0885-1.2226.0129-.4061.0666-.7543.1185-1.0911.0639-.415.1288-.8443.1109-1.3505.0134-.0531.0188-.1158.0118-.1902-.0457-.4855-.5999-1.938-1.7294-3.253-.6076-.7073-1.4896-1.4972-2.6889-2.0395.5251-.1066 1.2328-.2035 2.0244-.1859 2.0515.0456 3.6746.8135 4.8242 2.2824a.908.908 0 0 1 .0667.1002c.7231 1.3556-.2762 6.2751-2.9867 10.5405zm-8.8166-6.1162c-.025.1794-.3089.4225-.6211.4225a.5821.5821 0 0 1-.0809-.0056c-.1873-.026-.3765-.144-.5059-.3156-.0458-.0605-.1203-.178-.1055-.2844.0055-.0401.0261-.0985.0925-.1488.1182-.0894.3518-.1226.6096-.0867.3163.0441.6426.1938.6113.4186zm7.9305-.4114c.0111.0792-.049.201-.1531.3102-.0683.0717-.212.1961-.4079.2232a.5456.5456 0 0 1-.075.0052c-.2935 0-.5414-.2344-.5607-.3717-.024-.1765.2641-.3106.5611-.352.297-.0414.6111.0088.6356.1851z" />
    </svg>
  );
}

/** Linear's spiral. */
export function LinearMark({ title = "Linear", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" />
    </svg>
  );
}

/** Slack's four-colour mark; the colours are the brand, so they are not themed. */
export function SlackColorMark({ title = "Slack", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path
        fill="#E01E5A"
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
      />
      <path
        fill="#36C5F0"
        d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
      />
      <path
        fill="#2EB67D"
        d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
      />
      <path
        fill="#ECB22E"
        d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
      />
    </svg>
  );
}

/** Claude's sunburst. */
export function ClaudeMark({ title = "Claude", ...props }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={title} {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

/* --------------------------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------------------------ */

export type AgentLoopStation = "gather" | "act" | "verify";

/** One piece of context the agent pulls in before it acts. */
export interface AgentLoopGather {
  /** Short name of the source, e.g. "Task from Maya" or "Issue #312". */
  label: string;
  /** Optional second line, e.g. "14 comments, opened Oct 18". */
  detail?: string;
  /** Token count for the block, shown as "1.2K". */
  tokens: number;
  /** Optional mark for the source; falls back to a document glyph. */
  mark?: ReactNode;
}

/** One tool call the agent makes at the "act" station. */
export interface AgentLoopCall {
  /** Tool name, e.g. "GitHub". Spoken by the live region and used by the running chip. */
  tool: string;
  /** Optional tool mark; falls back to a wrench. */
  mark?: ReactNode;
  /** What the call does, e.g. "Read issue #312". This is the chip title. */
  action: string;
  /** What comes back, e.g. "EU cards, since Oct 18". */
  result: string;
  /** Set to "error" when the call failed; the chip turns danger and the icon becomes a cross. */
  status?: "error";
}

/** The check the agent runs before it decides whether to loop again. */
export interface AgentLoopVerify {
  passed: boolean;
  /** One line of evidence, e.g. "3DS times out at 5s". */
  note: string;
}

/** One full pass around the ring: gather → act → verify. */
export interface AgentLoopIteration {
  gather: AgentLoopGather;
  calls: AgentLoopCall[];
  verify: AgentLoopVerify;
}

export interface AgentLoopModel {
  name: string;
  mark?: ReactNode;
}

export interface AgentLoopProps {
  /** The run to play: one entry per loop, gather → calls → verify. Defaults to the sample triage run (3 loops). */
  iterations?: AgentLoopIteration[];
  /** The request the agent is working on. Shown under the title until the run ends. */
  task?: string;
  /** Caption once the run ends. Defaults to the loop and tool-call count, or a stopped note when the last check failed. */
  summary?: string;
  /** Model shown in the middle of the ring. `null` hides it and leaves only the loop counter. */
  model?: AgentLoopModel | null;
  /** Card title. Defaults to "Agent loop". */
  title?: string;
  /** Rename the three stations; any key left out keeps its default. */
  stationLabels?: Partial<Record<AgentLoopStation, string>>;
  /** Start when the card is mostly in the viewport. Under reduced motion it opens on the done state instead. */
  autoPlay?: boolean;
  /** Replay the run about four seconds after it ends. */
  loop?: boolean;
  /** Playback speed, controlled. Options are 0.5, 1 and 2. */
  speed?: number;
  /** Starting speed when `speed` is not controlled. Defaults to 1. */
  defaultSpeed?: number;
  /** Called when the speed control changes, whether or not `speed` is controlled. */
  onSpeedChange?: (speed: number) => void;
  /** Show the transport controls and the speed control. */
  controls?: boolean;
  /** Called once per beat with the station the agent reached and its loop index. */
  onStationChange?: (station: AgentLoopStation, iteration: number) => void;
  /** Called when the last loop finishes. */
  onDone?: () => void;
  className?: string;
  /** Inline styles; set `--al-accent` to recolour the ring for the surrounding product. */
  style?: CSSProperties;
}

/* --------------------------------------------------------------------------------------------
 * Sample run
 * ------------------------------------------------------------------------------------------ */

const brandColor = (color?: string) => (color ? { color } : undefined);

/** The frame's own run: a payments triage that gathers, queries, then files and posts. */
export const agentLoopSample: AgentLoopIteration[] = [
  {
    gather: {
      label: "Task from Maya",
      detail: "EU card declines at checkout",
      tokens: 1200,
      mark: <MessageSquareText aria-hidden strokeWidth={1.75} />,
    },
    calls: [
      {
        tool: "GitHub",
        mark: <GitHubMark aria-hidden />,
        action: "Read issue #312",
        result: "EU cards, since Oct 18",
      },
    ],
    verify: { passed: false, note: "No root cause yet" },
  },
  {
    gather: {
      label: "Issue #312",
      detail: "14 comments, opened Oct 18",
      tokens: 6400,
      mark: <GitHubMark aria-hidden />,
    },
    calls: [
      {
        tool: "PostgreSQL",
        mark: <PostgreSQLMark aria-hidden style={brandColor("#4169E1")} />,
        action: "Run query",
        result: "Timed out after 30s",
        status: "error",
      },
      {
        tool: "PostgreSQL",
        mark: <PostgreSQLMark aria-hidden style={brandColor("#4169E1")} />,
        action: "Narrow to 72 hours",
        result: "1,284 declines, all 3DS",
      },
    ],
    verify: { passed: true, note: "3DS times out at 5s" },
  },
  {
    gather: {
      label: "Query result",
      detail: "1,284 declined orders",
      tokens: 9800,
      mark: <PostgreSQLMark aria-hidden style={brandColor("#4169E1")} />,
    },
    calls: [
      {
        tool: "Linear",
        mark: <LinearMark aria-hidden style={brandColor("#5E6AD2")} />,
        action: "Update status",
        result: "PAY-118 now in progress",
      },
      {
        tool: "Slack",
        mark: <SlackColorMark aria-hidden />,
        action: "Post update",
        result: "Posted in #payments",
      },
    ],
    verify: { passed: true, note: "Ticket and team updated" },
  },
];

const SAMPLE_SUMMARY =
  "EU declines come from 3DS checks timing out after 5 seconds. PAY-118 is in progress and the plan is posted in #payments.";

const DEFAULT_MODEL: AgentLoopModel = {
  name: "Claude Opus 5.5",
  mark: <ClaudeMark aria-hidden style={brandColor("#D97757")} />,
};

/* --------------------------------------------------------------------------------------------
 * Constants and small helpers
 * ------------------------------------------------------------------------------------------ */

const DEFAULT_STATIONS: Record<AgentLoopStation, string> = {
  gather: "Gather context",
  act: "Take action",
  verify: "Verify",
};

const STATION_ICONS: Record<AgentLoopStation, ReactNode> = {
  gather: <Layers aria-hidden />,
  act: <Wrench aria-hidden />,
  verify: <ListChecks aria-hidden />,
};

const SPEEDS = [
  { value: "0.5", label: "0.5×" },
  { value: "1", label: "1×" },
  { value: "2", label: "2×" },
];

const EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const POP_SPRING = { type: "spring" as const, visualDuration: 0.24, bounce: 0 };
const STATIONS: AgentLoopStation[] = ["gather", "act", "verify"];

const cx = (...names: (string | undefined | false)[]) => names.filter(Boolean).join(" ");
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
/** 1200 → "1.2K", 640 → "640". */
const formatTokens = (tokens: number) =>
  tokens < 1000 ? `${Math.round(tokens)}` : `${(tokens / 1000).toFixed(1)}K`;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
/** Cubic in-out, so the head leaves and arrives a station without a visible kick. */
const easing = (progress: number) =>
  progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
/** Index read that never lies about its type: the ring always has three nodes and four stops. */
const at = <T,>(list: T[], index: number, fallback: T): T => list[index] ?? fallback;
const polar = (centerX: number, centerY: number, radius: number, degrees: number) => ({
  x: centerX + radius * Math.cos(toRadians(degrees)),
  y: centerY + radius * Math.sin(toRadians(degrees)),
});

interface Point {
  x: number;
  y: number;
}

interface Arrow extends Point {
  heading: number;
}

interface Geometry {
  w: number;
  h: number;
  cx: number;
  cy: number;
  r: number;
  compact: boolean;
  gap: number;
  angles: number[];
  nodes: Point[];
  arrows: Arrow[];
}

/** The ring path, drawn as two half arcs from top to bottom and back. */
const ringPath = (geometry: Geometry) =>
  `M ${geometry.cx} ${geometry.cy - geometry.r} A ${geometry.r} ${geometry.r} 0 1 1 ${geometry.cx} ${geometry.cy + geometry.r} A ${geometry.r} ${geometry.r} 0 1 1 ${geometry.cx} ${geometry.cy - geometry.r}`;

/* --------------------------------------------------------------------------------------------
 * Timeline
 * ------------------------------------------------------------------------------------------ */

interface TimelineEvent {
  t: number;
  kind: "arrive" | "depart" | "context" | "callStart" | "callEnd" | "verify" | "done";
  loop: number;
  station?: AgentLoopStation;
  call?: number;
}

interface Travel {
  t0: number;
  t1: number;
  u0: number;
}

interface Timeline {
  events: TimelineEvent[];
  travels: Travel[];
  /** Times at which a "Next step" press comes to rest. */
  settles: number[];
  start: number;
  end: number;
}

function buildTimeline(callCounts: number[]): Timeline {
  const events: TimelineEvent[] = [];
  const travels: Travel[] = [];
  const settles: number[] = [];
  let n = 0.2;

  callCounts.forEach((calls, loop) => {
    const base = loop * 3;
    events.push({ t: n, kind: "arrive", loop, station: "gather" });
    events.push({ t: n + 0.12, kind: "context", loop });
    settles.push(n + 0.12 + 0.4);
    n += 0.85;

    events.push({ t: n, kind: "depart", loop, station: "gather" });
    travels.push({ t0: n, t1: n + 0.7, u0: base });
    n += 0.7;
    events.push({ t: n, kind: "arrive", loop, station: "act" });
    n += 0.1;

    for (let index = 0; index < Math.max(1, calls); index += 1) {
      if (index > 0) n += 0.4;
      events.push({ t: n, kind: "callStart", loop, call: index });
      n += 0.75;
      events.push({ t: n, kind: "callEnd", loop, call: index });
      settles.push(n + 0.25);
    }

    n += 0.5;
    events.push({ t: n, kind: "depart", loop, station: "act" });
    travels.push({ t0: n, t1: n + 0.5, u0: base + 1 });
    n += 0.5;
    events.push({ t: n, kind: "arrive", loop, station: "verify" });
    events.push({ t: n + 0.1, kind: "verify", loop });
    settles.push(n + 0.1 + 0.4);
    n += 0.95;
    events.push({ t: n, kind: "depart", loop, station: "verify" });
    travels.push({ t0: n, t1: n + 0.7, u0: base + 2 });
    n += 0.7;
  });

  events.push({ t: n, kind: "done", loop: Math.max(0, callCounts.length - 1) });
  settles.push(n + 0.05);
  return { events, travels, settles, start: 0.2, end: n + 0.05 };
}

type Beat = "ready" | "gather" | "call" | "result" | "verify" | "done";

interface Snapshot {
  ready: boolean;
  done: boolean;
  loop: number;
  at: AgentLoopStation | null;
  last: AgentLoopStation | null;
  context: number;
  call: { loop: number; index: number; resolved: boolean } | null;
  verify: { loop: number } | null;
  beat: Beat;
}

/** Replays the event list up to `time` and returns what the ring should show. */
function readSnapshot(timeline: Timeline, time: number): Snapshot {
  const snapshot: Snapshot = {
    ready: time < timeline.start,
    done: false,
    loop: 0,
    at: null,
    last: null,
    context: 0,
    call: null,
    verify: null,
    beat: "ready",
  };
  if (snapshot.ready) return snapshot;

  for (const event of timeline.events) {
    if (event.t > time) break;
    switch (event.kind) {
      case "arrive":
        snapshot.at = event.station ?? null;
        snapshot.last = snapshot.at;
        if (event.station === "gather") snapshot.loop = event.loop;
        break;
      case "depart":
        snapshot.at = null;
        break;
      case "context":
        snapshot.context += 1;
        snapshot.beat = "gather";
        break;
      case "callStart":
        snapshot.call = { loop: event.loop, index: event.call ?? 0, resolved: false };
        snapshot.beat = "call";
        break;
      case "callEnd":
        if (snapshot.call) snapshot.call = { ...snapshot.call, resolved: true };
        snapshot.beat = "result";
        break;
      case "verify":
        snapshot.verify = { loop: event.loop };
        snapshot.beat = "verify";
        break;
      case "done":
        snapshot.done = true;
        snapshot.at = null;
        snapshot.beat = "done";
        break;
    }
  }
  return snapshot;
}

/** Identity of a snapshot, so re-reading an unchanged frame never re-renders. */
const snapshotKey = (snapshot: Snapshot) =>
  [
    snapshot.ready,
    snapshot.done,
    snapshot.loop,
    snapshot.at,
    snapshot.last,
    snapshot.context,
    snapshot.call ? `${snapshot.call.loop}.${snapshot.call.index}.${snapshot.call.resolved}` : "-",
    snapshot.verify ? snapshot.verify.loop : "-",
    snapshot.beat,
  ].join("|");

/* --------------------------------------------------------------------------------------------
 * Building blocks
 * ------------------------------------------------------------------------------------------ */

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Crossfades a single line in place; the outgoing line fades faster than the incoming one rises. */
function Swap({
  id,
  reduced,
  className,
  children,
}: {
  id: string;
  reduced: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced) } }}
          transition={{
            duration: reduced ? 0 : motionTokens.duration.fast,
            delay: 0.05 * Number(!reduced),
            ease: EASE,
          }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** A single digit that rolls up as it changes. */
function Roll({ value, reduced }: { value: number; reduced: boolean }) {
  const style = { "--digits": String(value).length } as CSSProperties;
  return (
    <span className={styles.roll} style={style}>
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          className={styles.rollItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.75em" }}
          animate={{ opacity: 1, y: "0em" }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, y: "-0.75em", transition: { duration: 0.14, ease: EASE } }
          }
          transition={{ duration: 0.22 * Number(!reduced), ease: [...motionTokens.ease.enter] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Counts the context total up to its new value instead of snapping. */
function TokenRoll({ value, reduced }: { value: number; reduced: boolean }) {
  const count = useMotionValue(value);
  const text = useTransform(count, (current: number) => formatTokens(current));

  useEffect(() => {
    if (reduced) {
      count.jump(value);
      return;
    }
    const controls = animate(count, value, { duration: 0.5, ease: EASE });
    return () => controls.stop();
  }, [value, reduced, count]);

  return <motion.span className={styles.tokenValue}>{text}</motion.span>;
}

/** One tool call at the act station: running, resolved, or failed. */
function CallChip({
  call,
  resolved,
  reduced,
}: {
  call: AgentLoopCall;
  resolved: boolean;
  reduced: boolean;
}) {
  const failed = call.status === "error";
  const phase = resolved ? (failed ? "error" : "success") : "running";
  return (
    <div className={styles.chip} data-state={phase}>
      <span className={styles.chipHead}>
        <span className={styles.chipMark}>{call.mark ?? <Wrench aria-hidden />}</span>
        <span className={styles.chipTitle}>{call.action}</span>
        <Swap id={phase} reduced={reduced} className={styles.chipIcon}>
          {phase === "running" ? (
            <LoaderCircle aria-hidden className={styles.spin} />
          ) : phase === "error" ? (
            <X aria-hidden />
          ) : (
            <Check aria-hidden />
          )}
        </Swap>
      </span>
      <Swap id={phase} reduced={reduced} className={styles.chipBody}>
        {phase === "running" ? (
          <TextShimmer active={!reduced}>{`Calling ${call.tool}`}</TextShimmer>
        ) : (
          <span className={styles.chipText}>
            <span className={styles.srOnly}>{failed ? `${call.tool} failed: ` : `${call.tool} returned: `}</span>
            {call.result}
          </span>
        )}
      </Swap>
    </div>
  );
}

/** The verification chip at the verify station. */
function CheckChip({ check }: { check: AgentLoopVerify }) {
  return (
    <div className={styles.chip} data-state={check.passed ? "passed" : "retry"}>
      <span className={styles.chipHead}>
        <span className={styles.chipMark} data-tone={check.passed ? "success" : "warning"}>
          {check.passed ? <CircleCheck aria-hidden /> : <RotateCcw aria-hidden />}
        </span>
        <span className={styles.chipTitle}>{check.passed ? "Check passed" : "Retry"}</span>
      </span>
      <span className={styles.chipBody}>
        <span className={styles.chipText}>{check.note}</span>
      </span>
    </div>
  );
}

interface LaneItem {
  id: string;
  node: ReactNode;
}

/** One lane under the ring. The chip pops from the pin it belongs to. */
function Lane({
  item,
  empty,
  live,
  reduced,
  pinX,
}: {
  item: LaneItem | null;
  empty: string;
  live: boolean;
  reduced: boolean;
  pinX: number;
}) {
  return (
    <div className={styles.lane} data-live={live || undefined}>
      <AnimatePresence initial={false}>
        <motion.div
          key={item?.id ?? "empty"}
          className={styles.pop}
          style={{ transformOrigin: `${pinX}px 0` }}
          initial={reduced || !item ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 * Number(!reduced) } }}
          transition={
            reduced
              ? { duration: 0 }
              : item
                ? { ...POP_SPRING, delay: 0.1 }
                : { duration: motionTokens.duration.fast }
          }
        >
          {item ? item.node : <div className={styles.laneEmpty}>{empty}</div>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------------------------ */

export function AgentLoop({
  iterations = agentLoopSample,
  task = "Find out why EU cards are declined at checkout, then update the team.",
  summary,
  model = DEFAULT_MODEL,
  title = "Agent loop",
  stationLabels,
  autoPlay = true,
  loop = false,
  speed,
  defaultSpeed = 1,
  onSpeedChange,
  controls = true,
  onStationChange,
  onDone,
  className,
  style,
}: AgentLoopProps) {
  const hydrated = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  const prefersReduced = useReducedMotion();
  const reduced = Boolean(hydrated && prefersReduced);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const labels = { ...DEFAULT_STATIONS, ...stationLabels };
  const empty = iterations.length === 0;
  const callCounts = useMemo(
    () => iterations.map(iteration => Math.min(3, Math.max(1, iteration.calls.length))),
    [iterations],
  );
  const callSignature = callCounts.join(",");
  const timeline = useMemo(() => buildTimeline(callCounts), [callSignature, callCounts]);
  const totalCalls = iterations.reduce((sum, iteration) => sum + Math.min(3, iteration.calls.length), 0);
  const lastIteration = iterations[iterations.length - 1];
  const stopped = Boolean(lastIteration && !lastIteration.verify.passed);
  const resolvedSummary =
    summary ??
    (iterations === agentLoopSample
      ? SAMPLE_SUMMARY
      : stopped
        ? `Stopped after ${plural(iterations.length, "loop")} without a passing check.`
        : `Finished after ${plural(iterations.length, "loop")} and ${plural(totalCalls, "tool call")}.`);

  const [uncontrolledSpeed, setUncontrolledSpeed] = useState(defaultSpeed);
  const currentSpeed = speed ?? uncontrolledSpeed;

  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const gradientRef = useRef<SVGLinearGradientElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef<HTMLButtonElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const geometryRef = useRef<Geometry | null>(null);
  const timeRef = useRef(0);
  const targetRef = useRef<number | null>(null);
  const [mode, setMode] = useState<"playing" | "stepping" | "idle">("idle");
  const [snapshot, setSnapshot] = useState<Snapshot>(() => readSnapshot(timeline, 0));
  const [live, setLive] = useState("");

  const playback = useRef({ tl: timeline, reduced, speed: currentSpeed });
  useLayoutEffect(() => {
    playback.current = { tl: timeline, reduced, speed: currentSpeed };
  });

  const handlers = useRef({ onStationChange, onDone });
  useLayoutEffect(() => {
    handlers.current = { onStationChange, onDone };
  });

  /* Draws the head and its trail for the current time. Writes straight to the SVG, so a moving
     frame never re-renders React. */
  const draw = useCallback(() => {
    const current = geometryRef.current;
    const head = headRef.current;
    const trail = trailRef.current;
    const gradient = gradientRef.current;
    if (!current || !head || !trail || !gradient) return;

    const { tl, reduced: reduce } = playback.current;

    let progress = 0;
    let moving = 0;
    for (const travel of tl.travels) {
      if (timeRef.current < travel.t0) break;
      if (timeRef.current >= travel.t1) {
        progress = travel.u0 + 1;
        continue;
      }
      if (reduce) {
        progress = travel.u0;
        moving = 0;
        break;
      }
      const raw = clamp((timeRef.current - travel.t0) / (travel.t1 - travel.t0));
      progress = travel.u0 + easing(raw);
      moving = Math.sin(Math.PI * raw);
      break;
    }

    const stops = [...current.angles, 270];
    const index = Math.min(2, Math.floor(((progress % 3) + 3) % 3));
    const from = at(stops, index, -90);
    const to = at(stops, index + 1, 270);
    const angle = from + (to - from) * (((progress % 3) + 3) % 3 - index);
    const point = polar(current.cx, current.cy, current.r, angle);
    head.setAttribute("transform", `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);

    const tailAngle = reduce ? 0 : moving * Math.min(72, 0.7 * (to - from));
    if (tailAngle < 1) {
      trail.setAttribute("d", "");
      return;
    }
    const tail = polar(current.cx, current.cy, current.r, angle - tailAngle);
    trail.setAttribute(
      "d",
      `M ${tail.x.toFixed(2)} ${tail.y.toFixed(2)} A ${current.r} ${current.r} 0 0 1 ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    );
    gradient.setAttribute("x1", tail.x.toFixed(2));
    gradient.setAttribute("y1", tail.y.toFixed(2));
    gradient.setAttribute("x2", point.x.toFixed(2));
    gradient.setAttribute("y2", point.y.toFixed(2));
  }, []);

  const sync = useCallback(() => {
    const next = readSnapshot(playback.current.tl, timeRef.current);
    setSnapshot(previous => (snapshotKey(previous) === snapshotKey(next) ? previous : next));
  }, []);

  /* Measures the ring and lays the three stations out on it. */
  useLayoutEffect(() => {
    const node = ringRef.current;
    if (!node) return;

    const measure = () => {
      const width = Math.round(node.getBoundingClientRect().width);
      if (!width || geometryRef.current?.w === width) return;

      const compact = width < 360;
      const gap = compact ? 13 : 14;
      let startAngle = 30;
      const margin = width / 2 - gap - (compact ? 64 : 106);
      let radius = margin / Math.cos(toRadians(30));
      if (radius < 66) {
        startAngle = 50;
        radius = margin / Math.cos(toRadians(startAngle));
      }
      const angles = [-90, startAngle, 180 - startAngle];
      const centerX = Math.round(width / 2);
      radius = Math.round(Math.min(94, Math.max(54, radius)));
      const centerY = (compact ? 30 : 34) + radius;
      const nodes = angles.map(angle => polar(centerX, centerY, radius, angle));
      const stops = [...angles, 270];
      const arrows = angles.map((angle, index) => {
        const middle = (angle + at(stops, index + 1, 270)) / 2;
        return { ...polar(centerX, centerY, radius, middle), heading: middle + 90 };
      });

      const next: Geometry = {
        w: width,
        h: centerY + radius + 6,
        cx: centerX,
        cy: centerY,
        r: radius,
        compact,
        gap,
        angles,
        nodes,
        arrows,
      };
      geometryRef.current = next;
      setGeometry(next);
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    draw();
  }, [geometry, reduced, draw]);

  /* A new run rewinds the clock; the first pass keeps the server's initial frame. */
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    timeRef.current = 0;
    targetRef.current = null;
    setMode("idle");
    sync();
    draw();
  }, [timeline, sync, draw]);

  useEffect(() => {
    if (!reduced || empty || timeRef.current !== 0) return;
    timeRef.current = timeline.end;
    sync();
    draw();
  }, [reduced, empty, timeline, sync, draw]);

  const active = mode !== "idle";
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const { tl, speed: rate, reduced: reduce } = playback.current;
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = targetRef.current;
      const previous = timeRef.current;
      const next = target !== null
        ? reduce
          ? target
          : Math.min(target, previous + delta * Math.max(1, rate) * 2.5)
        : Math.min(tl.end, previous + delta * rate);
      timeRef.current = next;

      draw();
      sync();
      if (previous < tl.end && next >= tl.end) handlers.current.onDone?.();
      if (target !== null && next >= target) {
        targetRef.current = null;
        setMode("idle");
        return;
      }
      if (next >= tl.end) setMode("idle");
      else frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, draw, sync]);

  const play = useCallback(() => {
    if (empty) return;
    if (timeRef.current >= timeline.end) {
      timeRef.current = 0;
      sync();
      draw();
    }
    targetRef.current = null;
    setMode("playing");
  }, [empty, timeline, sync, draw]);

  /* Auto-start once, when the card is mostly on screen. */
  const started = useRef(false);
  useEffect(() => {
    const node = rootRef.current;
    if (!autoPlay || reduced || empty || started.current || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();
        if (timeRef.current === 0) play();
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoPlay, reduced, empty, play]);

  useEffect(() => {
    if (!loop || !snapshot.done || mode !== "idle" || reduced) return;
    const timer = window.setTimeout(() => {
      timeRef.current = 0;
      sync();
      draw();
      setMode("playing");
    }, 4000 / Math.max(0.5, currentSpeed));
    return () => window.clearTimeout(timer);
  }, [loop, snapshot.done, mode, reduced, currentSpeed, sync, draw]);

  useEffect(() => {
    if (snapshot.at) handlers.current.onStationChange?.(snapshot.at, snapshot.loop);
  }, [snapshot.at, snapshot.loop]);

  const described = describeSnapshot(snapshot, iterations, resolvedSummary);
  const announced = mode !== "playing" || snapshot.done ? described : live;
  if (announced !== live) setLive(announced);

  useEffect(() => {
    if (snapshot.done && document.activeElement === nextRef.current) restartRef.current?.focus();
  }, [snapshot.done]);

  const playing = mode === "playing";
  const running = mode !== "idle";
  const done = snapshot.done;
  const tokenTotal = iterations.slice(0, snapshot.context).reduce((sum, iteration) => sum + iteration.gather.tokens, 0);

  const stationState = (station: AgentLoopStation) => {
    if (snapshot.ready) return "idle";
    if (done) return "visited";
    if (snapshot.at === station) return "active";
    const reached = snapshot.last ? STATIONS.indexOf(snapshot.last) : -1;
    return STATIONS.indexOf(station) <= reached ? "visited" : "idle";
  };

  const currentCall = snapshot.call ? iterations[snapshot.call.loop]?.calls[snapshot.call.index] : undefined;
  const currentCheck = snapshot.verify ? iterations[snapshot.verify.loop]?.verify : undefined;

  const callItem: LaneItem | null =
    currentCall && snapshot.call
      ? {
          id: `call-${snapshot.call.loop}-${snapshot.call.index}`,
          node: <CallChip call={currentCall} resolved={snapshot.call.resolved} reduced={reduced} />,
        }
      : null;
  const checkItem: LaneItem | null =
    currentCheck && snapshot.verify
      ? { id: `check-${snapshot.verify.loop}`, node: <CheckChip check={currentCheck} /> }
      : null;

  const laneFocus: AgentLoopStation =
    snapshot.verify && (!snapshot.call || snapshot.verify.loop >= snapshot.call.loop) ? "verify" : "act";

  const status = done
    ? stopped
      ? { key: "stopped", icon: <TriangleAlert aria-hidden />, label: "Stopped", tone: "warning" }
      : { key: "done", icon: <CircleCheck aria-hidden />, label: "Done", tone: "success" }
    : running
      ? { key: "running", icon: <LoaderCircle aria-hidden className={styles.spin} />, label: "Running", tone: "accent" }
      : snapshot.ready
        ? { key: "ready", icon: <CircleDashed aria-hidden />, label: "Ready", tone: "muted" }
        : { key: "paused", icon: <Pause aria-hidden />, label: "Paused", tone: "muted" };

  const playLabel = playing ? "Pause" : done ? "Play again" : "Play";

  const centerContent = empty ? (
    <span>No loops yet</span>
  ) : done ? (
    <span className={styles.centerEnd} data-tone={stopped ? "warning" : "success"}>
      {stopped ? <TriangleAlert aria-hidden /> : <CircleCheck aria-hidden />}
      <span>
        <span className={styles.centerLead}>{stopped ? "Stopped after " : "Done in "}</span>
        {plural(iterations.length, "loop")}
      </span>
    </span>
  ) : snapshot.ready ? (
    <span>Ready</span>
  ) : (
    <span className={styles.centerCount}>
      Loop <Roll value={snapshot.loop + 1} reduced={reduced} />
    </span>
  );

  const split = Boolean(geometry && !geometry.compact);
  const actX = geometry ? at(geometry.nodes, 1, { x: 0, y: 0 }).x : 0;
  const checkX = geometry ? at(geometry.nodes, 2, { x: 0, y: 0 }).x : 0;
  const half = geometry ? (split ? (geometry.w - 12) / 2 : geometry.w) : 0;

  const pins = geometry
    ? split
      ? [
          { key: "verify", x: checkX, on: Boolean(checkItem), live: snapshot.at === "verify" },
          { key: "act", x: actX, on: Boolean(callItem), live: snapshot.at === "act" },
        ]
      : [
          {
            key: laneFocus,
            x: laneFocus === "act" ? actX : checkX,
            on: Boolean(laneFocus === "act" ? callItem : checkItem),
            live: snapshot.at === "act" || snapshot.at === "verify",
          },
        ]
    : [];

  return (
    <div
      ref={rootRef}
      className={cx(styles.root, className)}
      style={style}
      role="group"
      aria-labelledby={`${id}-title`}
      data-ready={snapshot.ready || undefined}
      data-done={(done && !stopped) || undefined}
      data-ended={done || undefined}
      data-measured={geometry ? "" : undefined}
      data-compact={geometry?.compact || undefined}
    >
      <div className={styles.header}>
        <h3 id={`${id}-title`} className={styles.title}>
          {title}
        </h3>
        <span className={styles.status} data-tone={status.tone}>
          <Swap id={status.key} reduced={reduced} className={styles.statusSwap}>
            <span className={styles.statusItem}>
              {status.icon}
              {status.label}
            </span>
          </Swap>
        </span>
        <p className={styles.caption}>
          <Swap id={done ? "summary" : "task"} reduced={reduced}>
            {done ? resolvedSummary : task}
          </Swap>
        </p>
        <p className={styles.srOnly} role="status" aria-live="polite">
          {live}
        </p>
      </div>

      <div className={styles.stage}>
        <div className={styles.loop}>
          <div ref={ringRef} className={styles.ring} style={geometry ? { height: geometry.h } : undefined}>
            {geometry && (
              <>
                <svg
                  className={styles.svg}
                  width={geometry.w}
                  height={geometry.h + 14}
                  viewBox={`0 0 ${geometry.w} ${geometry.h + 14}`}
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient ref={gradientRef} id={`${id}-trail`} gradientUnits="userSpaceOnUse">
                      <stop offset="0" className={styles.trailStop} stopOpacity="0" />
                      <stop offset="1" className={styles.trailStop} stopOpacity="0.7" />
                    </linearGradient>
                  </defs>

                  {pins.map(pin => {
                    const anchor = at(geometry.nodes, pin.key === "act" ? 1 : 2, { x: 0, y: 0 });
                    const d = `M ${pin.x} ${anchor.y + 9} V ${geometry.h + 14}`;
                    const key = pin.key === "act" ? callItem?.id : checkItem?.id;
                    return (
                      <g key={pin.key}>
                        <path className={styles.pin} d={d} />
                        <AnimatePresence initial={false}>
                          {pin.on && (
                            <motion.path
                              key={key}
                              className={styles.pinLive}
                              d={d}
                              data-live={pin.live || undefined}
                              initial={reduced ? { pathLength: 1, opacity: 0 } : { pathLength: 0, opacity: 1 }}
                              animate={{ pathLength: 1, opacity: 1 }}
                              exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced) } }}
                              transition={{ duration: 0.18 * Number(!reduced), ease: EASE }}
                            />
                          )}
                        </AnimatePresence>
                      </g>
                    );
                  })}

                  <path className={styles.track} d={ringPath(geometry)} />

                  {geometry.arrows.map((arrow, index) => (
                    <path
                      key={index}
                      className={styles.arrow}
                      d="M -2.75 -4 L 1.75 0 L -2.75 4"
                      transform={`translate(${arrow.x.toFixed(2)} ${arrow.y.toFixed(2)}) rotate(${arrow.heading})`}
                    />
                  ))}

                  <path className={styles.doneLine} d={ringPath(geometry)} pathLength={1} />

                  <path ref={trailRef} className={styles.trail} stroke={`url(#${id}-trail)`} />

                  {STATIONS.map((station, index) => {
                    const node = at(geometry.nodes, index, { x: 0, y: 0 });
                    const state = stationState(station);
                    return (
                      <g key={station} transform={`translate(${node.x.toFixed(2)} ${node.y.toFixed(2)})`}>
                        <circle className={styles.nodeRing} r={10.5} data-on={(state === "active") || undefined} />
                        <circle className={styles.node} r={5} data-state={state} />
                      </g>
                    );
                  })}

                  <g ref={headRef} className={styles.headGroup}>
                    <circle className={styles.head} r={5} />
                  </g>
                </svg>

                {STATIONS.map((station, index) => {
                  const node = at(geometry.nodes, index, { x: 0, y: 0 });
                  const state = stationState(station);
                  const stationStyle: CSSProperties =
                    station === "gather"
                      ? { left: node.x, top: node.y - geometry.gap, maxWidth: geometry.w }
                      : station === "act"
                        ? { left: node.x + geometry.gap, top: node.y, maxWidth: geometry.w - node.x - geometry.gap }
                        : { left: node.x - geometry.gap, top: node.y, maxWidth: node.x - geometry.gap };
                  return (
                    <span
                      key={station}
                      className={styles.station}
                      data-key={station}
                      data-state={state}
                      style={stationStyle}
                    >
                      {STATION_ICONS[station]}
                      <TextShimmer
                        active={state === "active" && running && !reduced}
                        className={styles.stationText}
                      >
                        {labels[station]}
                      </TextShimmer>
                    </span>
                  );
                })}

                <div
                  className={styles.center}
                  style={{ left: geometry.cx, top: geometry.cy, maxWidth: 1.7 * geometry.r }}
                >
                  {model?.mark && <span className={styles.centerMark}>{model.mark}</span>}
                  {model && (
                    <span className={styles.centerName} title={model.name}>
                      {model.name}
                    </span>
                  )}
                  <Swap
                    id={empty ? "empty" : done ? "end" : snapshot.ready ? "ready" : "loop"}
                    reduced={reduced}
                    className={styles.centerLine}
                  >
                    {centerContent}
                  </Swap>
                </div>
              </>
            )}
          </div>

          <div className={styles.lanes} data-split={split || undefined}>
            {split ? (
              <>
                <Lane item={checkItem} empty="Checks land here" live={snapshot.at === "verify"} reduced={reduced} pinX={checkX} />
                <Lane
                  item={callItem}
                  empty="Tool calls land here"
                  live={snapshot.at === "act"}
                  reduced={reduced}
                  pinX={actX - half - 12}
                />
              </>
            ) : (
              <Lane
                item={laneFocus === "verify" ? checkItem : callItem}
                empty="Tool calls and checks land here"
                live={snapshot.at === "act" || snapshot.at === "verify"}
                reduced={reduced}
                pinX={laneFocus === "act" ? actX : checkX}
              />
            )}
          </div>
        </div>

        <div className={styles.context}>
          <div className={styles.contextHead}>
            <span className={styles.contextTitle}>Context</span>
            <span className={styles.tokens}>
              <TokenRoll value={tokenTotal} reduced={reduced} /> tokens
            </span>
          </div>
          <ol
            className={styles.blocks}
            style={
              {
                "--slots": Math.max(1, iterations.length),
                "--rows": Math.max(1, Math.ceil(iterations.length / 2)),
              } as CSSProperties
            }
            aria-label="Context blocks"
          >
            <AnimatePresence initial={false}>
              {iterations.slice(0, snapshot.context).map((iteration, index) => (
                <motion.li
                  key={`${index}-${iteration.gather.label}`}
                  className={styles.block}
                  data-fresh={(index === snapshot.context - 1 && snapshot.at === "gather") || undefined}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 * Number(!reduced) } }}
                  transition={reduced ? { duration: 0 } : POP_SPRING}
                >
                  <span className={styles.blockMark}>{iteration.gather.mark ?? <FileText aria-hidden />}</span>
                  <span className={styles.blockLabel}>{iteration.gather.label}</span>
                  <span className={styles.blockTokens}>
                    {formatTokens(iteration.gather.tokens)}
                    <span className={styles.srOnly}> tokens</span>
                  </span>
                  {iteration.gather.detail && (
                    <span className={styles.blockDetail}>{iteration.gather.detail}</span>
                  )}
                </motion.li>
              ))}
              {snapshot.context === 0 && (
                <motion.li
                  key="empty"
                  className={styles.blocksEmpty}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced) } }}
                  transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}
                >
                  {empty ? "Nothing to gather yet" : "Fills as the agent gathers context"}
                </motion.li>
              )}
            </AnimatePresence>
          </ol>
        </div>
      </div>

      {controls && (
        <div className={styles.footer}>
          <div className={styles.buttons}>
            <Tooltip content={playLabel}>
              <Button
                variant="secondary"
                size="sm"
                className={styles.iconButton}
                aria-label={playLabel}
                disabled={empty}
                onClick={
                  playing
                    ? () => {
                        targetRef.current = null;
                        setMode("idle");
                      }
                    : play
                }
              >
                <span className={styles.glyph}>
                  <Play data-on={!playing} aria-hidden />
                  <Pause data-on={playing} aria-hidden />
                </span>
              </Button>
            </Tooltip>
            <Tooltip content="Next step">
              <Button
                ref={nextRef}
                variant="secondary"
                size="sm"
                className={styles.iconButton}
                aria-label="Next step"
                disabled={empty || done}
                onClick={() => {
                  if (empty || timeRef.current >= timeline.end) return;
                  targetRef.current =
                    timeline.settles.find(settle => settle > timeRef.current + 0.01) ?? timeline.end;
                  setMode("stepping");
                }}
              >
                <StepForward aria-hidden />
              </Button>
            </Tooltip>
            <Tooltip content="Restart">
              <Button
                ref={restartRef}
                variant="secondary"
                size="sm"
                className={styles.iconButton}
                aria-label="Restart"
                disabled={empty}
                onClick={() => {
                  if (empty) return;
                  timeRef.current = 0;
                  targetRef.current = null;
                  sync();
                  draw();
                  setMode("playing");
                }}
              >
                <RotateCcw aria-hidden />
              </Button>
            </Tooltip>
          </div>
          <div className={styles.speed}>
            <span className={styles.speedLabel} aria-hidden="true">
              Speed
            </span>
            <SegmentedControl
              label="Speed"
              value={String(currentSpeed)}
              onValueChange={value => {
                const next = Number(value);
                if (speed === undefined) setUncontrolledSpeed(next);
                onSpeedChange?.(next);
              }}
              options={SPEEDS}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** What the polite live region says at each beat; silent while the run plays on its own. */
function describeSnapshot(snapshot: Snapshot, iterations: AgentLoopIteration[], summary: string): string {
  const iteration = iterations[snapshot.loop];
  switch (snapshot.beat) {
    case "ready":
      return "";
    case "done":
      return summary;
    case "gather":
      return iteration ? `Loop ${snapshot.loop + 1}. Gathered context: ${iteration.gather.label}` : "";
    case "call": {
      const call = snapshot.call && iterations[snapshot.call.loop]?.calls[snapshot.call.index];
      return call ? `Calling ${call.tool}: ${call.action}` : "";
    }
    case "result": {
      const call = snapshot.call && iterations[snapshot.call.loop]?.calls[snapshot.call.index];
      return call ? `${call.tool} ${call.status === "error" ? "failed" : "returned"}: ${call.result}` : "";
    }
    case "verify": {
      const check = snapshot.verify && iterations[snapshot.verify.loop]?.verify;
      if (!check) return "";
      return check.passed ? `Check passed: ${check.note}` : `Retry: ${check.note}. The loop runs again`;
    }
  }
}

export default AgentLoop;
