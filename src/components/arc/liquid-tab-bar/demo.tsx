import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bookmark, House, MessageCircle, User } from "lucide-react";
import SegmentedControl from "../segmented-control/segmented-control";
import { LiquidTabBar, liquidPanelId, liquidTabId } from "./liquid-tab-bar";
import type { LiquidTab } from "./liquid-tab-bar";
import styles from "./liquid-tab-bar.module.css";

export const meta = "Live · component";

type LabelMode = "active" | "always" | "none";

const iconProps = { strokeWidth: 1.75, "aria-hidden": "true" } as const;

const tabs: LiquidTab[] = [
  { value: "home", label: "Home", icon: <House {...iconProps} /> },
  { value: "saved", label: "Saved", icon: <Bookmark {...iconProps} /> },
  {
    value: "inbox",
    label: "Inbox",
    icon: <MessageCircle {...iconProps} />,
    badge: 2,
    badgeLabel: "2 unread",
  },
  { value: "profile", label: "Profile", icon: <User {...iconProps} /> },
];

const notes: Record<string, string> = {
  home: "Your feed",
  saved: "Saved for later",
  inbox: "Two unread replies",
  profile: "Signed in as Jasmine",
};

const modes = [
  { value: "active", label: "Active label" },
  { value: "always", label: "All labels" },
  { value: "none", label: "Icons only" },
];

/** The frame sits on Home with the lens open on its label and the other three slots collapsed. */
export default function LiquidTabBarDemo() {
  const id = useId();
  const [value, setValue] = useState("home");
  const [labels, setLabels] = useState<LabelMode>("active");

  return (
    <div className={styles.demo}>
      <div className={styles.stage}>
        <LiquidTabBar id={id} tabs={tabs} value={value} onValueChange={setValue} labels={labels} />
        <div className={styles.noteRow}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={value}
              id={liquidPanelId(id, value)}
              role="tabpanel"
              aria-labelledby={liquidTabId(id, value)}
              className={styles.note}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              {notes[value]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      <div className={styles.modes}>
        <SegmentedControl
          options={modes}
          value={labels}
          onValueChange={(next) => setLabels(next as LabelMode)}
          label="Tab labels"
        />
      </div>
    </div>
  );
}
