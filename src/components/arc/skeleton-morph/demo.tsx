"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { RotateCw } from "lucide-react";
import { MorphBlock, SkeletonMorph } from "./skeleton-morph";
import { avatar } from "../lib/media";
import styles from "./skeleton-morph.module.css";

export const meta = "Live · component";

const payouts = [
  { id: "marcus-johnson", name: "Marcus Johnson", note: "Paid today", amount: "$1,240" },
  { id: "chloe-nguyen", name: "Chloe Nguyen", note: "Paid Sep 22", amount: "$860" },
  { id: "daniel-kim", name: "Daniel Kim", note: "Scheduled Sep 30", amount: "$2,115" },
] as const;

export default function SkeletonMorphDemo() {
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  // The demo loads once on mount; Reload puts the skeletons back for another pass. The reference
  // dwells 1.5s before resolving, 900ms here keeps the same beats inside the frame's 1.2s settle
  // window so the structural snapshot lands after the morph instead of inside it.
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setLoading(false), 900);
    return () => window.clearTimeout(timer);
  }, [loading]);

  return (
    <div className={styles.demo}>
      <div className={styles.cards}>
        <SkeletonMorph loading={loading} className={styles.card} loadingLabel="Loading profile">
          <div className={styles.head}>
            <MorphBlock radius="circle" width={52} height={52}>
              <Image src={avatar("jasmine-brooks")} alt="" width={52} height={52} className={styles.avatar} />
            </MorphBlock>
            <div className={styles.who}>
              <MorphBlock width={124} lines={1} lineHeight={20}>
                <p className={styles.name}>Jasmine Brooks</p>
              </MorphBlock>
              <MorphBlock width={164} lines={1} lineHeight={18}>
                <p className={styles.role}>Design lead at Northwind</p>
              </MorphBlock>
            </div>
          </div>
          <MorphBlock lines={3} lineHeight={20} className={styles.full}>
            <p className={styles.bio}>
              Designs calm tools for busy teams. Currently rebuilding the Northwind scheduling flow.
            </p>
          </MorphBlock>
          <div className={styles.foot}>
            <MorphBlock width={169} lines={1} lineHeight={20}>
              <p className={styles.stats}>
                <span>2.4k</span> followers · <span>184</span> posts
              </p>
            </MorphBlock>
            <MorphBlock width={90} height={36} radius={18}>
              <button
                type="button"
                className={styles.follow}
                data-on={following || undefined}
                aria-pressed={following}
                onClick={() => setFollowing((value) => !value)}
              >
                <span className={styles.followLabel} data-active={!following || undefined} aria-hidden={following}>
                  Follow
                </span>
                <span className={styles.followLabel} data-active={following || undefined} aria-hidden={!following}>
                  Following
                </span>
              </button>
            </MorphBlock>
          </div>
        </SkeletonMorph>
        <SkeletonMorph loading={loading} className={styles.card} loadingLabel="Loading payouts" stagger={0.035}>
          <MorphBlock width={100} lines={1} lineHeight={20}>
            <p className={styles.title}>Recent payouts</p>
          </MorphBlock>
          <ul className={styles.list}>
            {payouts.map((payout) => (
              <li key={payout.id} className={styles.row}>
                <MorphBlock radius="circle" width={36} height={36}>
                  <Image
                    src={avatar(payout.id)}
                    alt=""
                    width={36}
                    height={36}
                    className={styles.avatar}
                  />
                </MorphBlock>
                <div className={styles.rowText}>
                  <MorphBlock width={104} lines={1} lineHeight={18}>
                    <p className={styles.rowName}>{payout.name}</p>
                  </MorphBlock>
                  <MorphBlock width={76} lines={1} lineHeight={16}>
                    <p
                      className={styles.rowNote}
                      data-scheduled={payout.note.startsWith("Scheduled") || undefined}
                    >
                      {payout.note}
                    </p>
                  </MorphBlock>
                </div>
                <MorphBlock width={44} lines={1} lineHeight={18}>
                  <p className={styles.amount}>{payout.amount}</p>
                </MorphBlock>
              </li>
            ))}
          </ul>
        </SkeletonMorph>
      </div>
      <button type="button" className={styles.reload} onClick={() => setLoading(true)} disabled={loading}>
        <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" />
        Reload
      </button>
    </div>
  );
}
