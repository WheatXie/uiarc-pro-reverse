import type { ReactNode } from "react";
import { CardToArticle } from "./card-to-article";
import type { ArticleItem } from "./card-to-article";
import { person, photo, portrait } from "../lib/media";
import type { PersonId, PhotoId } from "../lib/media";
import styles from "./card-to-article.module.css";

export const meta = "Live · component";

/** Byline block the demo renders at the top of every article body. */
function Article({ by, date, children }: { by: PersonId; date: string; children: ReactNode }) {
  const author = person(by);
  return (
    <article className={styles.article}>
      <div className={styles.byline}>
        <img src={portrait(by)} alt="" className={styles.avatar} />
        <span className={styles.author}>{author.name}</span>
        <span className={styles.date}>{date}</span>
      </div>
      {children}
    </article>
  );
}

const story = (id: string, photoId: PhotoId, rest: Omit<ArticleItem, "id" | "image" | "imageAlt">): ArticleItem => ({
  id,
  image: photo(photoId).src,
  imageAlt: photo(photoId).alt,
  ...rest,
});

const items: ArticleItem[] = [
  story("pool-house", "pool-house", {
    tag: "Case study",
    title: "A glass house that stays cool in August",
    meta: "5 min read",
    body: (
      <Article by="jasmine-brooks" date="Sep 18, 2026">
        <p>
          The brief was simple and a little unreasonable: all glass on the south side, no air conditioning, and a pool
          that feels like part of the living room.
        </p>
        <p>
          We started with the roof. A deep overhang shades the glass from the high summer sun but lets the low winter
          light reach the back wall, which is poured concrete and holds the warmth into the evening.
        </p>
        <blockquote className={styles.quote}>
          The pool does half the work. Air crossing the water drops a few degrees before it reaches the house.
        </blockquote>
        <p>
          Every pane opens. On a still day the house breathes through the long side; when the wind turns, the clerestory
          at the back pulls warm air up and out.
        </p>
        <p>
          After two summers the owners have not once wished for a thermostat. The electricity bill is lower than the
          apartment they left.
        </p>
      </Article>
    ),
  }),
  story("lisbon-tram", "lisbon-tram", {
    tag: "Travel",
    title: "Three slow days in Lisbon",
    meta: "4 min read",
    body: (
      <Article by="sofia-ramirez" date="Sep 11, 2026">
        <p>
          Skip the famous tram line at noon. Take the 28 at seven in the morning, when it is full of people going to work
          and the light is still low on the tiles.
        </p>
        <p>
          Spend the second day on foot in Alfama. Get lost on purpose, stop for a bica whenever you see a counter with a
          queue of locals, and end at the viewpoint above the river.
        </p>
        <blockquote className={styles.quote}>Lisbon rewards the people who walk uphill twice.</blockquote>
        <p>
          On the last day, cross the river by ferry and eat grilled fish in Cacilhas with the whole city spread out on
          the other bank.
        </p>
      </Article>
    ),
  }),
  story("chef-plating", "chef-plating", {
    tag: "Changelog",
    title: "Menus now update in real time",
    meta: "2 min read",
    body: (
      <Article by="daniel-kim" date="Sep 4, 2026">
        <p>
          When the kitchen runs out of a dish, it now disappears from every table tablet and the online menu within a
          second.
        </p>
        <p>
          Prices, allergens, and photos sync the same way. Changes made on the pass show up for guests before the next
          order goes in.
        </p>
        <blockquote className={styles.quote}>Fewer awkward conversations about the last portion of salmon.</blockquote>
        <p>The update is live for every venue on the Kitchen plan. Nothing to install.</p>
      </Article>
    ),
  }),
  story("mountain-ridges", "mountain-ridges", {
    tag: "Essay",
    title: "Why we plan in seasons, not sprints",
    meta: "6 min read",
    body: (
      <Article by="nathan-cole" date="Aug 28, 2026">
        <p>
          Two week sprints taught us to ship small things quickly. They also taught us to avoid anything that needed a
          quarter of quiet thinking.
        </p>
        <p>
          So we moved to seasons: twelve weeks with one ambitious goal, a cooldown, and nothing on the roadmap that we
          cannot explain in one sentence.
        </p>
        <blockquote className={styles.quote}>A season is long enough to be wrong and still recover.</blockquote>
        <p>The surprising part was morale. People could see the shape of the work, and the end of it, from the first week.</p>
      </Article>
    ),
  }),
];

export default function CardToArticleDemo() {
  return (
    <div className={styles.demo}>
      <CardToArticle items={items} />
    </div>
  );
}
