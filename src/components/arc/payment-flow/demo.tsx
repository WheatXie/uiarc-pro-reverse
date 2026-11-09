import PaymentFlow from "./payment-flow";
import styles from "./payment-flow.module.css";

export const meta = "Live · component";

export default function PaymentFlowDemo() {
  return (
    <div className={styles.demo} data-canvas="wide">
      <PaymentFlow amount={42.5} fee={1.53} balance={1284.1} />
    </div>
  );
}
