import TicketRouter from "./ticket-router";
import styles from "./ticket-router.module.css";

export const meta = "Live · component";

export default function TicketRouterDemo() {
  return (
    <div className={styles.demo}>
      <TicketRouter />
    </div>
  );
}
