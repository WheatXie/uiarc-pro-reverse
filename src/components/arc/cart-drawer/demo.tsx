import { CartDrawer } from "./cart-drawer";
import styles from "./demo.module.css";

export const meta = "Live · block";

/**
 * The shipped block opens on the grid with one Ribbed carafe already in the cart. The frame shows
 * it flattened into the page, so the demo passes the zeroed edge the reference writes inline.
 */
export default function CartDrawerDemo() {
  return <CartDrawer className={styles.flat} />;
}
