import PrizeWheel from "./prize-wheel";
import styles from "./prize-wheel.module.css";

export const meta = "Live · component";

/**
 * The shipped demo: the wheel with no props, so it runs the eight launch rewards declared in
 * `DEFAULT_SEGMENTS` (30 / 12 / 18 / 1 / 20 / 14 / 3 / 2 chances, Lifetime Pro featured), equal
 * slices, odds beside it, both gestures live.
 */
export default function PrizeWheelDemo() {
  return (
    <div className={styles.demo} data-canvas="wide">
      <PrizeWheel />
    </div>
  );
}
