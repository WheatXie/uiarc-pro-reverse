import { useState } from "react";
import { Star, UserCheck } from "lucide-react";
import { person, portrait } from "../lib/media";
import { GlassCard } from "./glass-card";
import styles from "./glass-card.module.css";

export const meta = "Live · component";

const profile = person("jasmine-brooks");

/** The frame shows the collapsed sheet: photo, name, rating, and the two actions behind one tap. */
export default function GlassCardDemo() {
  const [following, setFollowing] = useState(false);
  const [requested, setRequested] = useState(false);

  return (
    <div className={styles.demo}>
      <GlassCard
        image={portrait("jasmine-brooks")}
        imageAlt={`Portrait of ${profile.name}`}
        title={profile.name}
        subtitle="Design lead, Lisbon"
        aside={
          <span className={styles.rating}>
            <Star size={14} strokeWidth={1.75} aria-hidden="true" className={styles.star} />
            4.9
          </span>
        }
      >
        <p className={styles.bio}>
          Leads design systems at Meridian. Mentors on motion, type, and shipping small teams fast.
        </p>
        <dl className={styles.stats}>
          <div>
            <dt>Sessions</dt>
            <dd>128</dd>
          </div>
          <div>
            <dt>Followers</dt>
            <dd>{following ? "12.5k" : "12.4k"}</dd>
          </div>
          <div>
            <dt>Replies in</dt>
            <dd>2 h</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            data-on={following || undefined}
            aria-pressed={following}
            onClick={() => setFollowing((value) => !value)}
          >
            {following ? (
              <>
                <UserCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                Following
              </>
            ) : (
              "Follow"
            )}
          </button>
          <button
            type="button"
            className={styles.secondary}
            data-on={requested || undefined}
            aria-pressed={requested}
            onClick={() => setRequested((value) => !value)}
          >
            {requested ? "Requested" : "Book a session"}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
