import { UsageForecast } from "./usage-forecast";

export const meta = "Live · block";

/**
 * September for Northwind Labs: 32.3M calls used through the 22nd, a forecast that crosses the 38M
 * budget on the 26th, and a 4 day window on either side of that date. Drag the budget line to
 * re-date the crossing, or switch the metric to storage and seats.
 */
export default function UsageForecastDemo() {
  return <UsageForecast flat />;
}
