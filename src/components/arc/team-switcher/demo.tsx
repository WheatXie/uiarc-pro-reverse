import TeamSwitcher from "./team-switcher";
import styles from "./team-switcher.module.css";

export const meta = "Live · component";

export default function TeamSwitcherDemo() {
  return (
    <div className={styles.demo}>
      <TeamSwitcher defaultOpen />
    </div>
  );
}
