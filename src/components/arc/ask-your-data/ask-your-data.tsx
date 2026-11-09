"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { ArrowUp, ChevronDown, CircleAlert, CircleX, Database, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "../button/button";
import { CopyButton } from "../copy-button/copy-button";
import SegmentedControl from "../segmented-control/segmented-control";
import { TextShimmer } from "../text-shimmer/text-shimmer";
import styles from "./ask-your-data.module.css";

/** One line of the chart: a plan, region or metric, with one value per category. */
export interface AskYourDataSeries {
  id: string;
  label: string;
  values: number[];
  /** Defaults to --series-1 through --series-4, in order. */
  color?: string;
}

export type AskYourDataChart = "bar" | "line" | "table";

/** What a run returns, shaped for the chart. */
export interface AskYourDataResult {
  /** Chart title, such as "Weekly signups by plan". */
  title: string;
  /** Quiet line under the title, such as "Aug 3 to Oct 25 · 1,284 signups". */
  subtitle?: string;
  /** X axis labels in order, such as week starts. */
  categories: string[];
  series: AskYourDataSeries[];
  /** Series add up: bars stack and totals show. Defaults to true. */
  stacked?: boolean;
  /** What follows each legend label: the series total, the latest value, or nothing. Defaults to "sum" when stacked. */
  legendValue?: "sum" | "last" | "none";
  /** View to open on for this result. */
  chart?: AskYourDataChart;
  /** Header of the table's first column, such as "Week". */
  categoryLabel?: string;
  /** Formats axis ticks, legend totals, tooltip and table cells. Defaults to en-US grouping. */
  formatValue?: (value: number) => string;
  /** One or two sentences that read the chart. */
  insight?: string;
  /** Rows the query returned, shown in the SQL meta as "48 rows". */
  rowCount?: number;
  /** Query time, shown as 214ms or 1.2s. */
  durationMs?: number;
}

/** The database the question runs against. */
export interface AskYourDataSource {
  name: string;
  /** Leads the SQL meta, such as "PostgreSQL". */
  dialect?: string;
  /** A mark before the name; defaults to a database glyph. */
  mark?: ReactNode;
}

export type AskYourDataStage = "sql" | "query";

export interface AskYourDataDetails {
  question: string;
  sql: string;
}

export interface AskYourDataErrorDetails {
  question: string;
  stage: AskYourDataStage;
}

export interface AskYourDataProgress {
  signal: AbortSignal;
  onProgress: (rowsScanned: number, totalRows?: number) => void;
  question: string;
}

export interface AskYourDataProps {
  /** Controlled question text. Pair with onQuestionChange. */
  question?: string;
  /** Starting question when uncontrolled; autoRun asks it. */
  defaultQuestion?: string;
  /** Called as the person types or picks a suggestion. */
  onQuestionChange?: (question: string) => void;
  /** Placeholder for the empty field. */
  placeholder?: string;
  /** The database the question runs against. */
  source?: AskYourDataSource;
  /** Questions offered in the empty state and after a question that matches no data. Pass [] to hide them. */
  suggestions?: string[];
  /** Writes SQL for the question. Return the whole string for a paced reveal, or an async iterable of chunks. */
  generateSql?: (
    question: string,
    options: { signal: AbortSignal; source: AskYourDataSource },
  ) => Promise<string | AsyncIterable<string>> | string | AsyncIterable<string>;
  /** Runs the SQL read only and returns a chart ready result. */
  runQuery?: (sql: string, options: AskYourDataProgress) => Promise<AskYourDataResult>;
  /** Called once a result is charted, for saving the question to a dashboard or logging. */
  onResult?: (result: AskYourDataResult, details: AskYourDataDetails) => void;
  /** Called when writing or running fails. Not called when the person stops a run. */
  onError?: (error: unknown, details: AskYourDataErrorDetails) => void;
  /** Controlled view. Pair with onChartChange. */
  chart?: AskYourDataChart;
  /** View for results that do not set result.chart. */
  defaultChart?: AskYourDataChart;
  /** Called when the person switches the view. */
  onChartChange?: (chart: AskYourDataChart) => void;
  /** Asks the starting question once the card is 35% on screen. */
  autoRun?: boolean;
  /** Keeps the SQL panel open after the query starts instead of folding it away. */
  keepSqlOpen?: boolean;
  /** Class on the card. */
  className?: string;
}

type Phase = "idle" | "writing" | "running" | "done" | "error";
type GlyphKind = "spinner" | "check" | "alert" | "stopped";

interface Sample {
  match: RegExp;
  question: string;
  rowsScanned: number;
  sql: string;
  result: AskYourDataResult;
}

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const defaultFormat = (value: number) => value.toLocaleString("en-US");

const seriesColor = (result: AskYourDataResult, index: number) =>
  result.series[index]?.color ?? `var(--series-${(index % 4) + 1})`;

const seriesTotal = (result: AskYourDataResult, index: number) =>
  result.series.reduce((sum, entry) => sum + (entry.values[index] ?? 0), 0);

const merge = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(" ");

/** Top rounded rect path for the last segment of a stacked bar. */
function topBarPath(x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/** A 1, 2, 2.5, 5, 10 scale that ends on a round number. */
function niceScale(max: number, count = 4) {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const step = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(step));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((m) => m >= step) ?? 10 * magnitude;
  const top = Math.ceil(max / nice - 1e-9) * nice;
  const ticks: number[] = [];
  for (let value = 0; value <= top + nice / 2; value += nice) ticks.push(Number(value.toFixed(6)));
  return { top, ticks };
}

/** The plot's inner size, measured without a chart library. */
function useBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () =>
      setSize((current) =>
        current.width === node.clientWidth && current.height === node.clientHeight
          ? current
          : { width: node.clientWidth, height: node.clientHeight },
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, ...size };
}

interface ChartProps {
  result: AskYourDataResult;
  kind: "bar" | "line";
  reduced: boolean;
}

function Plot({ result, kind, reduced }: ChartProps) {
  const { ref, width, height } = useBox();
  const [active, setActive] = useState<number | null>(null);
  const format = result.formatValue ?? defaultFormat;
  const stacked = result.stacked !== false;
  const count = result.categories.length;
  const innerWidth = Math.max(0, width - 44);
  const innerHeight = Math.max(0, height - 20 - 8);
  const slot = count ? innerWidth / count : 0;
  const { top, ticks } = niceScale(
    kind === "bar" && stacked
      ? Math.max(0, ...result.categories.map((_, index) => seriesTotal(result, index)))
      : Math.max(0, ...result.series.flatMap((entry) => entry.values)),
  );
  const yFor = (value: number) => 8 + innerHeight - (value / top) * innerHeight;
  const xFor = (index: number) => 44 + slot * index + slot / 2;
  const labelEvery = Math.max(1, Math.ceil(46 / Math.max(slot, 1)));
  const barWidth = kind === "bar" ? Math.min(28, slot * (stacked ? 0.58 : 0.76)) : 0;
  const track = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !slot) return;
    const index = Math.floor((clientX - rect.left - 44) / slot);
    setActive(index >= 0 && index < count ? index : null);
  };
  const readout =
    active === null
      ? ""
      : `${result.categories[active]}: ${result.series
          .map((entry) => `${entry.label} ${format(entry.values[active] ?? 0)}`)
          .join(", ")}${stacked ? `, total ${format(seriesTotal(result, active))}` : ""}`;
  const tipX =
    active === null ? 0 : xFor(active) + (xFor(active) > width / 2 ? -slot / 2 - 8 - 188 : slot / 2 + 8);

  return (
    <div
      ref={ref}
      className={styles.plot}
      tabIndex={0}
      role="group"
      aria-label={`${result.title}, ${kind === "bar" ? "bar" : "line"} chart. Use the left and right arrow keys to read each ${(result.categoryLabel ?? "category").toLowerCase()}.`}
      onKeyDown={(event) => {
        if (!count) return;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          const step = event.key === "ArrowRight" ? 1 : -1;
          setActive((current) =>
            current === null ? (step > 0 ? 0 : count - 1) : Math.min(count - 1, Math.max(0, current + step)),
          );
        } else if (event.key === "Home") {
          event.preventDefault();
          setActive(0);
        } else if (event.key === "End") {
          event.preventDefault();
          setActive(count - 1);
        } else if (event.key === "Escape") setActive(null);
      }}
      onBlur={() => setActive(null)}
      onPointerMove={(event) => {
        if (event.pointerType !== "touch" || event.buttons) track(event.clientX);
      }}
      onPointerDown={(event) => track(event.clientX)}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") setActive(null);
      }}
    >
      {width > 0 && height > 0 ? (
        <svg width={width} height={height} className={styles.svg} aria-hidden="true">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={44}
                x2={width}
                y1={Math.round(yFor(tick)) + 0.5}
                y2={Math.round(yFor(tick)) + 0.5}
                className={tick === 0 ? styles.baseline : styles.grid}
              />
              <text x={34} y={yFor(tick)} dy="0.32em" textAnchor="end" className={styles.axisText}>
                {format(tick)}
              </text>
            </g>
          ))}
          {result.categories.map((category, index) =>
            index % labelEvery === 0 ? (
              <text key={category + index} x={xFor(index)} y={height - 4} textAnchor="middle" className={styles.axisLabel}>
                {category}
              </text>
            ) : null,
          )}
          {active !== null ? (
            <rect
              x={44 + slot * active + 1}
              y={8}
              width={Math.max(0, slot - 2)}
              height={innerHeight}
              rx={6}
              className={styles.hoverBand}
            />
          ) : null}
          {kind === "bar"
            ? result.categories.map((_, index) => {
                const segmentWidth = barWidth;
                const groupWidth = stacked ? segmentWidth : (segmentWidth - (result.series.length - 1) * 2) / result.series.length;
                return (
                  <motion.g
                    key={index}
                    className={styles.column}
                    data-dim={(active !== null && active !== index) || undefined}
                    style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
                    initial={reduced ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      duration: 0.32,
                      ease,
                      delay: index * Math.min(0.016, 0.18 / Math.max(count, 1)),
                    }}
                  >
                    {(() => {
                      let running = 0;
                      const startX = xFor(index) - segmentWidth / 2;
                      return result.series.map((entry, seriesIndex) => {
                        const value = entry.values[index] ?? 0;
                        if (stacked) {
                          const isTop = result.series.slice(seriesIndex + 1).every((later) => !(later.values[index] > 0));
                          const bottom = yFor(running);
                          const nextTop = yFor(running + value);
                          running += value;
                          const band = Math.max(0, bottom - nextTop - 1.5 * Number(!isTop));
                          if (band <= 0) return null;
                          return isTop ? (
                            <path key={entry.id} d={topBarPath(startX, nextTop, segmentWidth, band, 4)} fill={seriesColor(result, seriesIndex)} />
                          ) : (
                            <rect key={entry.id} x={startX} y={nextTop + 1.5} width={segmentWidth} height={band} fill={seriesColor(result, seriesIndex)} />
                          );
                        }
                        const barHeight = Math.max(0, yFor(0) - yFor(value));
                        return (
                          <path
                            key={entry.id}
                            d={topBarPath(startX + seriesIndex * (groupWidth + 2), yFor(value), groupWidth, barHeight, 3)}
                            fill={seriesColor(result, seriesIndex)}
                          />
                        );
                      });
                    })()}
                  </motion.g>
                );
              })
            : (
                <>
                  {result.series.map((entry, seriesIndex) => {
                    const d = entry.values
                      .map((value, index) => `${index ? "L" : "M"}${xFor(index).toFixed(2)},${yFor(value).toFixed(2)}`)
                      .join("");
                    return (
                      <motion.path
                        key={entry.id}
                        d={d}
                        fill="none"
                        stroke={seriesColor(result, seriesIndex)}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={reduced ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.46, ease, delay: 0.04 * seriesIndex }}
                      />
                    );
                  })}
                  {active !== null
                    ? result.series.map((entry, seriesIndex) => (
                        <circle
                          key={entry.id}
                          cx={xFor(active)}
                          cy={yFor(entry.values[active] ?? 0)}
                          r={3.5}
                          fill="var(--surface)"
                          stroke={seriesColor(result, seriesIndex)}
                          strokeWidth={2}
                        />
                      ))
                    : null}
                </>
              )}
        </svg>
      ) : null}
      {active !== null && width > 0 ? (
        <div
          className={styles.tooltip}
          style={{ transform: `translate3d(${Math.max(0, Math.min(width - 188, tipX))}px, 8px, 0)`, width: 188 }}
          aria-hidden="true"
        >
          <span className={styles.tipHead}>{result.categories[active]}</span>
          {result.series.map((entry, seriesIndex) => (
            <span className={styles.tipRow} key={entry.id}>
              <span className={styles.dot} style={{ background: seriesColor(result, seriesIndex) }} />
              <span className={styles.tipLabel}>{entry.label}</span>
              <span className={styles.tipValue}>{format(entry.values[active] ?? 0)}</span>
            </span>
          ))}
          {stacked ? (
            <span className={merge(styles.tipRow, styles.tipTotal)}>
              <span className={styles.tipLabel}>Total</span>
              <span className={styles.tipValue}>{format(seriesTotal(result, active))}</span>
            </span>
          ) : null}
        </div>
      ) : null}
      <span className={styles.srOnly} aria-live="polite">
        {readout}
      </span>
    </div>
  );
}

function ResultTable({ result }: { result: AskYourDataResult }) {
  const format = result.formatValue ?? defaultFormat;
  const stacked = result.stacked !== false;
  const ref = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onScroll = () => setScrolled(node.scrollTop > 0);
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      ref={ref}
      className={styles.tableWrap}
      tabIndex={0}
      role="region"
      aria-label={`${result.title}, table`}
      data-scrolled={scrolled || undefined}
    >
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{result.categoryLabel ?? "Category"}</th>
            {result.series.map((entry, index) => (
              <th scope="col" className={styles.num} key={entry.id}>
                <span className={styles.thInner}>
                  <span className={styles.dot} style={{ background: seriesColor(result, index) }} aria-hidden="true" />
                  {entry.label}
                </span>
              </th>
            ))}
            {stacked ? (
              <th scope="col" className={styles.num}>
                Total
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {result.categories.map((category, index) => (
            <tr key={category + index}>
              <th scope="row">{category}</th>
              {result.series.map((entry) => (
                <td className={styles.num} key={entry.id}>
                  {format(entry.values[index] ?? 0)}
                </td>
              ))}
              {stacked ? <td className={styles.num}>{format(seriesTotal(result, index))}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The Postgres elephant, in brand blue or monochrome. */
function PostgresMark({ size = 16, className, mono = false }: { size?: number; className?: string; mono?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill={mono ? "currentColor" : "#4169E1"}
        d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4794a9.449 9.449 0 0 0-.5159-.0816 8.044 8.044 0 0 0-1.3114-.1278c-1.1822-.0184-2.2038.2642-3.0498.8406-.8573-.3211-4.7888-1.645-7.2219.0788C.9359 2.1526.3086 3.8733.4302 6.3043c.0409.818.5069 3.334 1.2423 5.7436.4598 1.5065.9387 2.7019 1.4334 3.582.553.9942 1.1259 1.5933 1.7143 1.7895.4474.1491 1.1327.1441 1.8581-.7279.8012-.9635 1.5903-1.8258 1.9446-2.2069.4351.2355.9064.3625 1.39.3772a.0569.0569 0 0 0 .0004.0041 11.0312 11.0312 0 0 0-.2472.3054c-.3389.4302-.4094.5197-1.5002.7443-.3102.064-1.1344.2339-1.1464.8115-.0025.1224.0329.2309.0919.3268.2269.4231.9216.6097 1.015.6331 1.3345.3335 2.5044.092 3.3714-.6787-.017 2.231.0775 4.4174.3454 5.0874.2212.5529.7618 1.9045 2.4692 1.9043.2505 0 .5263-.0291.8296-.0941 1.7819-.3821 2.5557-1.1696 2.855-2.9059.1503-.8707.4016-2.8753.5388-4.1012.0169-.0703.0357-.1207.057-.1362.0007-.0005.0697-.0471.4272.0307a.3673.3673 0 0 0 .0443.0068l.2539.0223.0149.001c.8468.0384 1.9114-.1426 2.5312-.4308.6438-.2988 1.8057-1.0323 1.5951-1.6698zM2.371 11.8765c-.7435-2.4358-1.1779-4.8851-1.2123-5.5719-.1086-2.1714.4171-3.6829 1.5623-4.4927 1.8367-1.2986 4.8398-.5408 6.108-.13-.0032.0032-.0066.0061-.0098.0094-2.0238 2.044-1.9758 5.536-1.9708 5.7495-.0002.0823.0066.1989.0162.3593.0348.5873.0996 1.6804-.0735 2.9184-.1609 1.1504.1937 2.2764.9728 3.0892.0806.0841.1648.1631.2518.2374-.3468.3714-1.1004 1.1926-1.9025 2.1576-.5677.6825-.9597.5517-1.0886.5087-.3919-.1307-.813-.5871-1.2381-1.3223-.4796-.839-.9635-2.0317-1.4155-3.5126zm6.0072 5.0871c-.1711-.0428-.3271-.1132-.4322-.1772.0889-.0394.2374-.0902.4833-.1409 1.2833-.2641 1.4815-.4506 1.9143-1.0002.0992-.126.2116-.2687.3673-.4426a.3549.3549 0 0 0 .0737-.1298c.1708-.1513.2724-.1099.4369-.0417.156.0646.3078.26.3695.4752.0291.1016.0619.2945-.0452.4444-.9043 1.2658-2.2216 1.2494-3.1676 1.0128zm2.094-3.988-.0525.141c-.133.3566-.2567.6881-.3334 1.003-.6674-.0021-1.3168-.2872-1.8105-.8024-.6279-.6551-.9131-1.5664-.7825-2.5004.1828-1.3079.1153-2.4468.079-3.0586-.005-.0857-.0095-.1607-.0122-.2199.2957-.2621 1.6659-.9962 2.6429-.7724.4459.1022.7176.4057.8305.928.5846 2.7038.0774 3.8307-.3302 4.7363-.084.1866-.1633.3629-.2311.5454zm7.3637 4.5725c-.0169.1768-.0358.376-.0618.5959l-.146.4383a.3547.3547 0 0 0-.0182.1077c-.0059.4747-.054.6489-.115.8693-.0634.2292-.1353.4891-.1794 1.0575-.11 1.4143-.8782 2.2267-2.4172 2.5565-1.5155.3251-1.7843-.4968-2.0212-1.2217a6.5824 6.5824 0 0 0-.0769-.2266c-.2154-.5858-.1911-1.4119-.1574-2.5551.0165-.5612-.0249-1.9013-.3302-2.6462.0044-.2932.0106-.5909.019-.8918a.3529.3529 0 0 0-.0153-.1126 1.4927 1.4927 0 0 0-.0439-.208c-.1226-.4283-.4213-.7866-.7797-.9351-.1424-.059-.4038-.1672-.7178-.0869.067-.276.1831-.5875.309-.9249l.0529-.142c.0595-.16.134-.3257.213-.5012.4265-.9476 1.0106-2.2453.3766-5.1772-.2374-1.0981-1.0304-1.6343-2.2324-1.5098-.7207.0746-1.3799.3654-1.7088.5321a5.6716 5.6716 0 0 0-.1958.1041c.0918-1.1064.4386-3.1741 1.7357-4.4823a4.0306 4.0306 0 0 1 .3033-.276.3532.3532 0 0 0 .1447-.0644c.7524-.5706 1.6945-.8506 2.802-.8325.4091.0067.8017.0339 1.1742.081 1.939.3544 3.2439 1.4468 4.0359 2.3827.8143.9623 1.2552 1.9315 1.4312 2.4543-1.3232-.1346-2.2234.1268-2.6797.779-.9926 1.4189.543 4.1729 1.2811 5.4964.1353.2426.2522.4522.2889.5413.2403.5825.5515.9713.7787 1.2552.0696.087.1372.1714.1885.245-.4008.1155-1.1208.3825-1.0552 1.717-.0123.1563-.0423.4469-.0834.8148-.0461.2077-.0702.4603-.0994.7662zm.8905-1.6211c-.0405-.8316.2691-.9185.5967-1.0105a2.8566 2.8566 0 0 0 .135-.0406 1.202 1.202 0 0 0 .1342.103c.5703.3765 1.5823.4213 3.0068.1344-.2016.1769-.5189.3994-.9533.6011-.4098.1903-1.0957.333-1.7473.3636-.7197.0336-1.0859-.0807-1.1721-.151zm.5695-9.2712c-.0059.3508-.0542.6692-.1054 1.0017-.055.3576-.112.7274-.1264 1.1762-.0142.4368.0404.8909.0932 1.3301.1066.887.216 1.8003-.2075 2.7014a3.5272 3.5272 0 0 1-.1876-.3856c-.0527-.1276-.1669-.3326-.3251-.6162-.6156-1.1041-2.0574-3.6896-1.3193-4.7446.3795-.5427 1.3408-.5661 2.1781-.463zm.2284 7.0137a12.3762 12.3762 0 0 0-.0853-.1074l-.0355-.0444c.7262-1.1995.5842-2.3862.4578-3.4385-.0519-.4318-.1009-.8396-.0885-1.2226.0129-.4061.0666-.7543.1185-1.0911.0639-.415.1288-.8443.1109-1.3505.0134-.0531.0188-.1158.0118-.1902-.0457-.4855-.5999-1.938-1.7294-3.253-.6076-.7073-1.4896-1.4972-2.6889-2.0395.5251-.1066 1.2328-.2035 2.0244-.1859 2.0515.0456 3.6746.8135 4.8242 2.2824a.908.908 0 0 1 .0667.1002c.7231 1.3556-.2762 6.2751-2.9867 10.5405zm-8.8166-6.1162c-.025.1794-.3089.4225-.6211.4225a.5821.5821 0 0 1-.0809-.0056c-.1873-.026-.3765-.144-.5059-.3156-.0458-.0605-.1203-.178-.1055-.2844.0055-.0401.0261-.0985.0925-.1488.1182-.0894.3518-.1226.6096-.0867.3163.0441.6426.1938.6113.4186zm7.9305-.4114c.0111.0792-.049.201-.1531.3102-.0683.0717-.212.1961-.4079.2232a.5456.5456 0 0 1-.075.0052c-.2935 0-.5414-.2344-.5607-.3717-.024-.1765.2641-.3106.5611-.352.297-.0414.6111.0088.6356.1851z"
      />
    </svg>
  );
}

const SQL_KEYWORDS = new Set(
  "select from join left right inner outer full cross on where and or not in is null as group by order having limit offset with distinct case when then else end union all asc desc between like ilike exists interval date timestamp timestamptz true false filter over partition window rows range preceding following current row lateral using returning into values".split(
    " ",
  ),
);

const SQL_TOKEN = /--[^\n]*|'(?:[^']|'')*'?|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|\s+|::|<>|<=|>=|!=|[^\sA-Za-z0-9_]/g;

type TokenKind = "keyword" | "function" | "string" | "number" | "comment" | "punct" | "space" | "ident";

interface Token {
  text: string;
  kind: TokenKind;
}

/** One regular expression pass; everything before `::` is a type name, and a word before "(" is a function. */
function tokenize(sql: string): Token[] {
  const parts = sql.match(SQL_TOKEN) ?? [];
  return parts.map((part, index) => {
    if (part.startsWith("--")) return { text: part, kind: "comment" };
    if (part.startsWith("'")) return { text: part, kind: "string" };
    if (/^\s+$/.test(part)) return { text: part, kind: "space" };
    if (/^\d/.test(part)) return { text: part, kind: "number" };
    if (/^[A-Za-z_]/.test(part)) {
      if (parts[index - 1] === "::") return { text: part, kind: "keyword" };
      let next = index + 1;
      while (next < parts.length && /^\s+$/.test(parts[next])) next += 1;
      return parts[next] !== "(" || SQL_KEYWORDS.has(part.toLowerCase())
        ? { text: part, kind: SQL_KEYWORDS.has(part.toLowerCase()) ? "keyword" : "ident" }
        : { text: part, kind: "function" };
    }
    return { text: part, kind: "punct" };
  });
}

const TOKEN_CLASS: Partial<Record<TokenKind, string>> = {
  keyword: styles.tkKeyword,
  function: styles.tkFunction,
  string: styles.tkString,
  number: styles.tkNumber,
  comment: styles.tkComment,
  punct: styles.tkPunct,
};

function CodeBlock({ tokens, revealed, settled, label }: { tokens: Token[]; revealed: number; settled: boolean; label: string }) {
  const shown = tokens.slice(0, revealed);
  const ghost = tokens.slice(revealed).map((token) => token.text).join("");
  const lineCount = Math.max(1, tokens.reduce((count, token) => count + (token.text.match(/\n/g)?.length ?? 0), 1));
  const shownLines = shown.reduce((count, token) => count + (token.text.match(/\n/g)?.length ?? 0), 1);
  return (
    <div className={styles.code} data-settled={settled || undefined}>
      <div className={styles.gutter} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => (
          <span key={index} data-on={index < shownLines || undefined}>
            {index + 1}
          </span>
        ))}
      </div>
      <pre className={styles.pre} tabIndex={0} aria-label={label}>
        <code>
          {shown.map((token, index) => (
            <span key={index} className={[styles.tk, TOKEN_CLASS[token.kind]].filter(Boolean).join(" ")}>
              {token.text}
            </span>
          ))}
          {ghost ? (
            <span className={styles.ghost} aria-hidden="true">
              {ghost}
            </span>
          ) : null}
        </code>
      </pre>
    </div>
  );
}

const DEFAULT_SOURCE: AskYourDataSource = { name: "analytics", dialect: "PostgreSQL" };

const CHART_OPTIONS: Array<{ value: AskYourDataChart; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "table", label: "Table" },
];

/** A question that matched no table: shown as a plain sentence, not a database error. */
class NoMatchingData extends Error {}

/** A timer that rejects with an AbortError as soon as the signal aborts. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
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

const sampleSignups: Sample = {
  match: /sign ?ups?|registrations?|new users/i,
  question: "Weekly signups by plan since August",
  rowsScanned: 1284,
  sql: `-- Weekly signups by plan, full weeks since August
select
  date_trunc('week', u.created_at)::date as week,
  p.name as plan,
  count(*) as signups
from users u
join subscriptions s on s.user_id = u.id
join plans p on p.id = s.plan_id
where u.created_at >= date '2026-08-03'
  and u.created_at < date_trunc('week', now())
group by 1, 2
order by 1, 2;`,
  result: {
    title: "Weekly signups by plan",
    subtitle: "Aug 3 to Oct 25 · 1,284 signups",
    categoryLabel: "Week",
    categories: [
      "Aug 3",
      "Aug 10",
      "Aug 17",
      "Aug 24",
      "Aug 31",
      "Sep 7",
      "Sep 14",
      "Sep 21",
      "Sep 28",
      "Oct 5",
      "Oct 12",
      "Oct 19",
    ],
    series: [
      { id: "free", label: "Free", values: [58, 61, 55, 63, 45, 60, 64, 59, 62, 57, 61, 56] },
      { id: "pro", label: "Pro", values: [24, 26, 27, 29, 25, 31, 33, 34, 36, 35, 38, 40] },
      { id: "team", label: "Team", values: [9, 10, 11, 11, 12, 13, 14, 15, 16, 17, 18, 19] },
      { id: "enterprise", label: "Enterprise", values: [2, 2, 3, 2, 3, 3, 4, 3, 4, 4, 5, 5] },
    ],
    stacked: true,
    chart: "bar",
    formatValue: defaultFormat,
    insight:
      "Pro is up 67% since August, from 24 to 40 a week, and Team more than doubled. Free held flat near 60, with a dip in Labor Day week.",
    rowCount: 48,
    durationMs: 214,
  },
};

const samples: Sample[] = [
  sampleSignups,
  {
    match: /revenue|mrr|arr|billing|income/i,
    question: "Monthly recurring revenue by region in 2026",
    rowsScanned: 18402,
    sql: `-- Monthly recurring revenue by region in 2026
select
  date_trunc('month', i.period_start)::date as month,
  a.region,
  round(sum(i.amount_cents) / 100000.0) as mrr_usd_k
from invoices i
join accounts a on a.id = i.account_id
where i.status = 'paid'
  and i.period_start >= date '2026-01-01'
  and i.period_start < date '2026-10-01'
group by 1, 2
order by 1, 2;`,
    result: {
      title: "Monthly recurring revenue by region",
      subtitle: "Jan to Sep 2026 · $475k in September",
      categoryLabel: "Month",
      categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
      series: [
        { id: "na", label: "North America", values: [182, 189, 197, 204, 215, 223, 236, 244, 258] },
        { id: "eu", label: "Europe", values: [96, 101, 104, 111, 117, 124, 129, 138, 146] },
        { id: "apac", label: "Asia Pacific", values: [31, 34, 38, 41, 47, 52, 58, 63, 71] },
      ],
      stacked: true,
      legendValue: "last",
      chart: "line",
      formatValue: (value) => `$${value.toLocaleString("en-US")}k`,
      insight:
        "Asia Pacific more than doubled this year, from $31k to $71k. Total MRR reached $475k in September, up 54% since January.",
      rowCount: 27,
      durationMs: 386,
    },
  },
  {
    match: /churn|cancel|retention|lost/i,
    question: "Monthly churn rate by plan since May",
    rowsScanned: 3912,
    sql: `-- Monthly churn rate on paid plans since May
select
  m.month,
  p.name as plan,
  round(100.0 * sum(m.churned) / nullif(sum(m.active_at_start), 0), 1) as churn_pct
from plan_metrics_monthly m
join plans p on p.id = m.plan_id
where m.month >= date '2026-05-01'
  and m.month < date '2026-10-01'
  and p.name <> 'Free'
group by 1, 2
order by 1, 2;`,
    result: {
      title: "Monthly churn rate by plan",
      subtitle: "May to Sep 2026 · paid plans",
      categoryLabel: "Month",
      categories: ["May", "Jun", "Jul", "Aug", "Sep"],
      series: [
        { id: "pro", label: "Pro", values: [4.8, 4.6, 4.9, 4.2, 3.9] },
        { id: "team", label: "Team", values: [3.1, 2.9, 2.7, 2.6, 2.3] },
        { id: "enterprise", label: "Enterprise", values: [1.2, 0.9, 1.1, 0.8, 0.7] },
      ],
      stacked: false,
      legendValue: "last",
      chart: "line",
      formatValue: (value) => `${value.toFixed(1)}%`,
      insight:
        "Churn fell on every paid plan since May. Pro dropped below 4% for the first time in September, and Team is down to 2.3%.",
      rowCount: 15,
      durationMs: 172,
    },
  },
];

const sampleQuestions = samples.map((sample) => sample.question);

const findSample = (question: string) => samples.find((sample) => sample.match.test(question));

/** The sample model: it waits like a real one, then answers with the matching SQL or says it has no table. */
async function writeSql(question: string, source: AskYourDataSource, signal: AbortSignal) {
  await wait(560, signal);
  const sample = findSample(question);
  if (!sample) {
    throw new NoMatchingData(
      `No table in ${source.name} matches "${question}". This preview knows signups, revenue and churn.`,
    );
  }
  return sample.sql;
}

/** The sample database: it rolls the scanned row count, then returns the chart ready result. */
async function runSample(
  question: string,
  signal: AbortSignal,
  onProgress: (rowsScanned: number, totalRows?: number) => void,
  reduced: boolean,
) {
  const sample = findSample(question) ?? sampleSignups;
  if (reduced) {
    onProgress(sample.rowsScanned, sample.rowsScanned);
    await wait(700, signal);
    return sample.result;
  }
  onProgress(0, sample.rowsScanned);
  const roll = animate(0, sample.rowsScanned, {
    duration: 0.82,
    ease,
    onUpdate: (value) => onProgress(Math.round(value), sample.rowsScanned),
  });
  signal.addEventListener("abort", () => roll.stop(), { once: true });
  await wait(1040, signal);
  return sample.result;
}

const plural = (count: number, word: string) => `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;

const duration = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);

/** Crossfades a single line of text in place, keyed by value. */
function Swap({ value, children, className, reduced }: { value: string; children: ReactNode; className?: string; reduced: boolean }) {
  return (
    <span className={merge(styles.swap, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.16 * Number(!reduced), ease } }}
          exit={{ opacity: 0, transition: { duration: 0.1 * Number(!reduced), ease: "easeOut" } }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Spinner() {
  return (
    <svg className={styles.spinner} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx={8} cy={8} r={6} stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CheckMark({ reduced }: { reduced: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path d="M3.25 8.5 6.5 11.75 12.75 4.75" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.28, ease }} />
    </svg>
  );
}

/** The state glyph: never colour alone, always beside a text label. */
function Glyph({ kind, reduced }: { kind: GlyphKind | null; reduced: boolean }) {
  return (
    <span className={styles.glyph} aria-hidden="true">
      <AnimatePresence initial={false}>
        {kind ? (
          <motion.span
            key={kind}
            className={styles.glyphItem}
            data-kind={kind}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.6 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", visualDuration: 0.2, bounce: 0, opacity: { duration: 0.12 } }
            }
          >
            {kind === "spinner" ? (
              <Spinner />
            ) : kind === "check" ? (
              <CheckMark reduced={reduced} />
            ) : kind === "alert" ? (
              <CircleAlert size={16} strokeWidth={1.75} />
            ) : (
              <CircleX size={16} strokeWidth={1.75} />
            )}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

/** The insight streams four words a tick with its two lines reserved. */
function Insight({ text, shown }: { text: string; shown: number }) {
  const words = useMemo(() => text.split(/(\s+)/).filter(Boolean), [text]);
  let visible = 0;
  let cut = words.length;
  for (let index = 0; index < words.length; index += 1) {
    if (!/^\s+$/.test(words[index])) visible += 1;
    if (visible > shown) {
      cut = index;
      break;
    }
  }
  const bands: string[][] = [];
  words.slice(0, cut).forEach((word, index) => {
    const band = Math.floor(index / 8);
    (bands[band] ??= []).push(word);
  });
  return (
    <p className={styles.insight}>
      <Sparkles size={14} strokeWidth={1.75} className={styles.insightIcon} aria-hidden="true" />
      <span className={styles.insightText}>
        {bands.map((band, index) => (
          <span key={index} className={styles.tk}>
            {band.join("")}
          </span>
        ))}
        {cut < words.length ? (
          <span className={styles.ghost} aria-hidden="true">
            {words.slice(cut).join("")}
          </span>
        ) : null}
      </span>
    </p>
  );
}

/** Keeps the SQL panel's height animated while its contents stream in. */
function useAnimatedHeight(active: boolean, reduced: boolean) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let animation: ReturnType<typeof animate> | undefined;
    const node = outer.current;
    const body = inner.current;
    if (!node || !body || typeof ResizeObserver === "undefined") return;
    let height = body.offsetHeight;
    let width = body.offsetWidth;
    const clear = () => {
      node.style.height = "";
      node.style.overflow = "";
      animation = undefined;
    };
    const observer = new ResizeObserver(() => {
      const nextHeight = body.offsetHeight;
      const nextWidth = body.offsetWidth;
      const widthChanged = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = animation ? node.getBoundingClientRect().height : height;
      height = nextHeight;
      if (reduced || widthChanged) {
        clear();
        return;
      }
      node.style.overflow = "hidden";
      animation = animate(node, { height: [from, nextHeight] }, {
        type: "spring",
        visualDuration: 0.24,
        bounce: 0,
        onComplete: clear,
      });
    });
    observer.observe(body);
    return () => {
      observer.disconnect();
      animation?.stop();
    };
  }, [reduced, active]);
  return { outer, inner };
}

/** Where each four token reveal stops, always ending on the last token. */
function revealStops(tokens: Token[], every = 4) {
  const stops: number[] = [];
  let count = 0;
  tokens.forEach((token, index) => {
    if (token.kind !== "space") count += 1;
    if (count === every) {
      stops.push(index + 1);
      count = 0;
    }
  });
  if (!stops.length || stops[stops.length - 1] !== tokens.length) stops.push(tokens.length);
  return stops;
}

/**
 * Natural language to chart in one card. A question field with the data source, a collapsible Generated SQL panel
 * where PostgreSQL streams in with syntax tints, a running state with a rolling row count, then a result that builds
 * as stacked bars, lines or a table, with a legend, a hover and keyboard readout, and a streamed one line insight.
 */
export function AskYourData({
  question: controlledQuestion,
  defaultQuestion = sampleSignups.question,
  onQuestionChange,
  placeholder = "Ask a question about your data",
  source = DEFAULT_SOURCE,
  suggestions = sampleQuestions,
  generateSql,
  runQuery,
  onResult,
  onError,
  chart: controlledChart,
  defaultChart = "bar",
  onChartChange,
  autoRun,
  keepSqlOpen = false,
  className,
}: AskYourDataProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const [draftQuestion, setDraftQuestion] = useState(defaultQuestion);
  const question = controlledQuestion ?? draftQuestion;
  const [phase, setPhase] = useState<Phase>("idle");
  const [sql, setSql] = useState("");
  const [revealed, setRevealed] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [result, setResult] = useState<AskYourDataResult | null>(null);
  const [failure, setFailure] = useState<{ stage: "sql" | "query" | "stopped"; title: string; message: string; detail?: string } | null>(null);
  const [view, setView] = useState<AskYourDataChart>(defaultChart);
  const chart = controlledChart ?? view;
  const [sqlOpen, setSqlOpen] = useState(false);
  const [insightShown, setInsightShown] = useState(0);
  const [status, setStatus] = useState("");
  const [onscreen, setOnscreen] = useState(true);

  const toggledRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const lastQuestionRef = useRef("");
  const rootRef = useRef<HTMLDivElement>(null);
  const autoRanRef = useRef(false);
  const revealedRef = useRef(0);
  const runRef = useRef<(input: string) => Promise<void>>(async () => {});
  const [totalRows, setTotalRows] = useState<number | null>(null);

  const simulated = !generateSql || !runQuery;
  const tokens = useMemo(() => tokenize(sql), [sql]);
  const busy = phase === "writing" || phase === "running";
  const lineCount = sql ? sql.split("\n").length : 0;
  const height = useAnimatedHeight(sqlOpen && !!sql, reduced);

  const setProgress = (value: number) => {
    revealedRef.current = value;
    setRevealed(value);
  };
  const setQuestion = (next: string) => {
    if (controlledQuestion === undefined) setDraftQuestion(next);
    onQuestionChange?.(next);
  };

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(
    async (input: string) => {
      const asked = input.trim();
      if (!asked) return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const runId = ++runIdRef.current;
      const { signal } = controller;
      const alive = () => runIdRef.current === runId && !signal.aborted;
      lastQuestionRef.current = asked;
      let stage: "sql" | "query" = "sql";
      let written = "";
      setPhase("writing");
      setSql("");
      setProgress(0);
      setStreaming(false);
      setScanned(0);
      setTotalRows(null);
      setResult(null);
      setFailure(null);
      setInsightShown(0);
      if (!toggledRef.current) setSqlOpen(true);
      setStatus(`Writing SQL for: ${asked}`);
      try {
        const generated = generateSql ? await generateSql(asked, { signal, source }) : await writeSql(asked, source, signal);
        if (!alive()) return;
        if (typeof generated === "string") {
          written = generated;
          const stops = revealStops(tokenize(written), 4);
          setSql(written);
          if (reduced) setProgress(stops[stops.length - 1]);
          else {
            for (const stop of stops) {
              if (!alive()) return;
              setProgress(stop);
              await wait(34, signal);
            }
          }
        } else {
          for await (const chunk of generated) {
            if (!alive()) return;
            written += chunk;
            setSql(written);
            setProgress(Number.MAX_SAFE_INTEGER);
          }
        }
        if (!alive()) return;
        setStreaming(false);
        setProgress(Number.MAX_SAFE_INTEGER);
        await wait(140 * Number(!reduced), signal);
        stage = "query";
        setPhase("running");
        if (!toggledRef.current && !keepSqlOpen) setSqlOpen(false);
        setStatus("SQL ready. Running query.");
        const onProgress = (rows: number, total?: number) => {
          if (!alive()) return;
          setScanned(rows);
          if (total !== undefined) setTotalRows(total);
        };
        const next = runQuery
          ? await runQuery(written, { signal, onProgress, question: asked })
          : await runSample(asked, signal, onProgress, reduced);
        if (!alive()) return;
        setResult(next);
        setPhase("done");
        if (controlledChart === undefined) setView(next.chart ?? defaultChart);
        onResult?.(next, { question: asked, sql: written });
        const meta = [
          next.rowCount !== undefined ? plural(next.rowCount, "row") : "",
          next.durationMs !== undefined ? duration(next.durationMs) : "",
        ]
          .filter(Boolean)
          .join(", ");
        setStatus(
          `${next.title}${meta ? `, ${meta}` : ""}. ${next.insight ?? ""}${simulated ? " Simulated with sample data, nothing was queried." : ""}`.trim(),
        );
      } catch (error) {
        if (runIdRef.current !== runId) return;
        if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          setFailure({
            stage: "stopped",
            title: "Stopped",
            message: stage === "sql" ? "The SQL was not finished, so nothing ran." : "The query was cancelled before it returned.",
          });
          if (stage === "sql" && written && revealedRef.current < Number.MAX_SAFE_INTEGER) {
            setSql(tokenize(written).slice(0, revealedRef.current).map((token) => token.text).join("").trimEnd());
          }
          setProgress(Number.MAX_SAFE_INTEGER);
          setStreaming(false);
          setPhase("error");
          setStatus("Stopped.");
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setFailure(
          stage === "sql"
            ? {
                stage,
                title: error instanceof NoMatchingData ? "No matching data" : "Could not write a query",
                message,
              }
            : {
                stage,
                title: "The query failed",
                message: "The database returned an error. Edit the question or try again.",
                detail: message,
              },
        );
        setPhase("error");
        setStatus(`${stage === "sql" ? "Could not write a query" : "The query failed"}. ${message}`);
        onError?.(error, { question: asked, stage });
      }
    },
    [generateSql, runQuery, source, reduced, keepSqlOpen, controlledChart, defaultChart, onResult, onError, simulated],
  );

  runRef.current = (input: string) => run(input);

  const stop = () => controllerRef.current?.abort();

  const shouldAutoRun = autoRun ?? !generateSql;
  const questionRef = useRef(question);
  questionRef.current = question;

  useEffect(() => {
    let timer: number | undefined;
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setOnscreen(entry.isIntersecting);
        if (entry.isIntersecting && shouldAutoRun && !autoRanRef.current) {
          autoRanRef.current = true;
          timer = window.setTimeout(() => {
            if (runIdRef.current === 0) runRef.current(questionRef.current);
          }, 420);
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [shouldAutoRun]);

  const insight = phase === "done" ? result?.insight : undefined;
  const insightWords = insight ? insight.split(/\s+/).filter(Boolean).length : 0;

  useEffect(() => {
    if (!insightWords) return;
    if (reduced) {
      setInsightShown(insightWords);
      return;
    }
    let shown = 0;
    let timer = window.setTimeout(function tick() {
      shown = Math.min(insightWords, shown + 4);
      setInsightShown(shown);
      if (shown < insightWords) timer = window.setTimeout(tick, 34);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [insightWords, reduced, result]);

  const dialect = source.dialect ?? "SQL";
  const sqlTitle = "Generated SQL";
  const sqlMeta =
    phase === "done" && result
      ? [dialect, result.rowCount !== undefined ? plural(result.rowCount, "row") : `${lineCount} lines`, result.durationMs !== undefined ? duration(result.durationMs) : ""]
          .filter(Boolean)
          .join(" · ")
      : phase === "error" && failure?.stage === "query"
        ? `${dialect} · failed`
        : sql && phase !== "writing"
          ? `${dialect} · ${plural(lineCount, "line")}`
          : `${dialect} · ${source.name}`;
  const sqlMetaShort = sqlMeta.split(" · ")[1] ?? sqlMeta;
  const sqlGlyph: GlyphKind | null =
    phase === "writing"
      ? "spinner"
      : phase === "error" && failure?.stage === "query"
        ? "alert"
        : sql && (phase === "running" || phase === "done")
          ? "check"
          : null;
  const sqlSettled = !streaming && revealed >= tokens.length && phase !== "writing";
  const format = result?.formatValue ?? defaultFormat;
  const stageGlyph: GlyphKind | null =
    busy ? "spinner" : phase === "error" ? (failure?.stage === "stopped" ? "stopped" : "alert") : null;

  const head =
    phase === "done" && result
      ? { key: `done-${result.title}`, title: result.title, sub: result.subtitle ?? "" }
      : phase === "writing"
        ? { key: "writing", title: "Writing SQL", sub: `Reading the ${source.name} schema` }
        : phase === "running"
          ? { key: "running", title: "Running query", sub: `Read only on ${source.name}` }
          : phase === "error" && failure
            ? {
                key: `error-${failure.title}`,
                title: failure.title,
                sub:
                  failure.stage === "query"
                    ? `${dialect} returned an error`
                    : failure.stage === "stopped"
                      ? "Nothing else will run"
                      : "Try a different question",
              }
            : { key: "idle", title: "Ask in plain words", sub: `Answers are charted from a read only query on ${source.name}` };

  const showVariants = { duration: 0.16 * Number(!reduced), ease };
  const hideVariants = { duration: 0.1 * Number(!reduced), ease: "easeOut" as const };
  const legendValue = result ? (result.legendValue ?? (result.stacked !== false ? "sum" : "none")) : "none";

  const switcher = (
    <SegmentedControl
      options={CHART_OPTIONS}
      value={chart}
      onValueChange={(next) => {
        if (controlledChart === undefined) setView(next as AskYourDataChart);
        onChartChange?.(next as AskYourDataChart);
      }}
      label="Chart type"
    />
  );

  const suggestionList = suggestions.length ? (
    <ul className={styles.suggestions} aria-label="Suggested questions">
      {suggestions.map((entry) => (
        <li key={entry}>
          <button
            type="button"
            className={styles.suggestion}
            onClick={() => {
              setQuestion(entry);
              void run(entry);
            }}
          >
            <Sparkles size={14} strokeWidth={1.75} className={styles.suggestionIcon} aria-hidden="true" />
            <span className={styles.suggestionText}>{entry}</span>
          </button>
        </li>
      ))}
    </ul>
  ) : null;

  let layerKey: string = phase;
  let body: ReactNode;
  if (phase === "done" && result) {
    layerKey = `done-${result.title}`;
    body = (
      <div className={styles.result}>
        <div className={styles.viewsInline}>{switcher}</div>
        <ul className={styles.legend} aria-label="Series">
          {result.series.map((entry, index) => (
            <li className={styles.legendItem} key={entry.id}>
              <span className={styles.dot} style={{ background: seriesColor(result, index) }} aria-hidden="true" />
              <span>{entry.label}</span>
              {legendValue === "sum" ? (
                <span className={styles.legendValue}>{format(entry.values.reduce((sum, value) => sum + value, 0))}</span>
              ) : legendValue === "last" && entry.values.length ? (
                <span className={styles.legendValue}>{format(entry.values[entry.values.length - 1])}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <div className={styles.chartArea}>
          <AnimatePresence initial={false}>
            <motion.div
              key={chart}
              className={styles.chartLayer}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: showVariants }}
              exit={{ opacity: 0, transition: hideVariants }}
            >
              {chart === "table" ? <ResultTable result={result} /> : <Plot result={result} kind={chart} reduced={reduced} />}
            </motion.div>
          </AnimatePresence>
        </div>
        {result.insight ? (
          <Insight text={result.insight} shown={insightShown} />
        ) : (
          <div className={styles.insightSpacer} />
        )}
      </div>
    );
  } else if (phase === "writing" || phase === "running") {
    layerKey = "pending";
    body = (
      <div className={styles.skeleton} aria-hidden="true" data-running={phase === "running" || undefined}>
        <div className={styles.skeletonLegend}>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.skeletonPlot}>
          {[38, 52, 46, 61, 44, 66, 72, 64, 78, 70, 84, 80].map((value, index) => (
            <span key={index} style={{ height: `${value}%`, animationDelay: `${60 * index}ms` }} />
          ))}
        </div>
        <span className={styles.skeletonInsight} />
      </div>
    );
  } else if (phase === "error" && failure) {
    layerKey = `error-${failure.stage}`;
    body = (
      <div className={styles.message}>
        <p className={styles.messageText}>{failure.message}</p>
        {failure.detail ? <pre className={styles.errorDetail}>{failure.detail}</pre> : null}
        {failure.stage === "sql" && failure.title === "No matching data" ? (
          suggestionList
        ) : (
          <div className={styles.messageActions}>
            <Button variant="secondary" size="sm" onClick={() => void run(lastQuestionRef.current || question)}>
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
              {failure.stage === "stopped" ? "Run again" : "Try again"}
            </Button>
          </div>
        )}
      </div>
    );
  } else {
    body = <div className={styles.message}>{suggestionList}</div>;
  }

  return (
    <div ref={rootRef} className={merge(styles.root, className)} data-phase={phase} data-offscreen={!onscreen || undefined}>
      <form
        className={styles.ask}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) stop();
          else void run(question);
        }}
        role="search"
        aria-label={`Ask ${source.name}`}
      >
        <label className={styles.field}>
          <span className={styles.source}>
            {source.mark ?? <Database size={16} strokeWidth={1.75} aria-hidden="true" />}
            <span className={styles.sourceName}>{source.name}</span>
          </span>
          <input
            className={styles.input}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={placeholder}
            aria-label={`Question for ${source.name}`}
            enterKeyHint="go"
            onKeyDown={(event) => {
              if (event.key === "Escape" && busy) {
                event.preventDefault();
                stop();
              }
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className={styles.send}
            data-busy={busy || undefined}
            disabled={!busy && !question.trim()}
            aria-label={busy ? "Stop" : "Ask"}
          >
            <AnimatePresence initial={false}>
              <motion.span
                key={busy ? "stop" : "ask"}
                className={styles.sendIcon}
                initial={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", visualDuration: 0.18, bounce: 0, opacity: { duration: 0.1 } }
                }
              >
                {busy ? <span className={styles.stopIcon} /> : <ArrowUp size={16} strokeWidth={2} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </label>
      </form>
      <section className={styles.sql} data-open={sqlOpen || undefined} data-empty={!sql || undefined} aria-label="Generated SQL">
        <div className={styles.sqlHead}>
          <button
            type="button"
            className={styles.sqlToggle}
            onClick={() => {
              if (!sql) return;
              toggledRef.current = true;
              setSqlOpen((open) => !open);
            }}
            disabled={!sql}
            aria-expanded={sqlOpen && !!sql}
            aria-controls={`${uid}-sql`}
            aria-label={`${sqlTitle}, ${sqlMeta}`}
          />
          <PostgresMark className={styles.pgMark} />
          <span className={styles.sqlTitle}>
            <TextShimmer active={phase === "writing"} className={styles.sqlTitleText}>
              {sqlTitle}
            </TextShimmer>
          </span>
          <span className={styles.sqlMeta}>
            <Swap value={sqlMeta} reduced={reduced}>
              <span className={styles.metaFull}>{sqlMeta}</span>
              <span className={styles.metaShort}>{sqlMetaShort}</span>
            </Swap>
          </span>
          <Glyph kind={sqlGlyph} reduced={reduced} />
          <span className={styles.sqlCopy}>
            <CopyButton value={sql} label="Copy SQL" iconOnly variant="plain" disabled={!sql || phase === "writing"} />
          </span>
          <ChevronDown size={16} strokeWidth={1.75} className={styles.chevron} aria-hidden="true" />
        </div>
        <AnimatePresence initial={false}>
          {sqlOpen && sql ? (
            <motion.div
              key="sql"
              id={`${uid}-sql`}
              className={styles.sqlClip}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      height: { type: "spring", visualDuration: 0.3, bounce: 0 },
                      opacity: { duration: 0.14 },
                    }
              }
            >
              <div ref={height.outer}>
                <div ref={height.inner} className={styles.sqlBody}>
                  <CodeBlock
                    tokens={tokens}
                    revealed={revealed}
                    settled={sqlSettled}
                    label={`SQL for: ${lastQuestionRef.current}`}
                  />
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
      <section className={styles.stage} aria-label="Result" aria-busy={busy}>
        <div className={styles.stageHead}>
          <div className={styles.headText}>
            <Swap value={head.key} reduced={reduced}>
              <span className={stageGlyph ? styles.headLine : undefined}>
                {stageGlyph ? <Glyph kind={stageGlyph} reduced={reduced} /> : null}
                <span className={styles.headCopy}>
                  <span className={styles.headTitle}>
                    {busy ? (
                      <TextShimmer className={styles.headTitleText}>{head.title}</TextShimmer>
                    ) : (
                      <span className={styles.headTitleText}>{head.title}</span>
                    )}
                    {phase === "running" ? (
                      <span className={styles.headCount}>
                        <span aria-hidden="true">·</span>
                        <span
                          className={styles.count}
                          style={
                            totalRows !== null
                              ? { minWidth: `${totalRows.toLocaleString("en-US").length - 0.4}ch` }
                              : undefined
                          }
                        >
                          {scanned.toLocaleString("en-US")}
                        </span>
                        <span>rows</span>
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.headSub}>{head.sub}</span>
                </span>
              </span>
            </Swap>
          </div>
          <AnimatePresence initial={false}>
            {phase === "done" && result ? (
              <motion.div
                key="views"
                className={styles.views}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: showVariants }}
                exit={{ opacity: 0, transition: hideVariants }}
              >
                {switcher}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className={styles.stageBody}>
          <AnimatePresence initial={false}>
            <motion.div
              key={layerKey}
              className={styles.stageLayer}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: showVariants }}
              exit={{ opacity: 0, transition: hideVariants }}
            >
              {body}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}

export default AskYourData;
