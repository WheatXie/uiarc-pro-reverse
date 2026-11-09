import type { PhotoGridPhoto } from "./photo-grid";

const WIDTHS = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];

function source(slug: string) {
  const src = `/media/specials/photo-grid-${slug}.jpg`;
  return { src, srcSet: WIDTHS.map(width => `${src} ${width}w`).join(", ") };
}

function create(
  id: string,
  slug: string,
  width: number,
  height: number,
  title: string,
  detail: string,
  alt: string,
): PhotoGridPhoto {
  return { id, ...source(slug), width, height, title, detail, alt };
}

/** The set used by the live demo: a weekend in Joshua Tree, in the order the page serves it. */
export const desertWeekend: PhotoGridPhoto[] = [
  create("drive", "palm-canyon-drive", 1067, 1600, "Palm Canyon Drive", "Fri, Oct 9 · 8:14 AM", "An empty street lined with palms leading toward dry mountains under a clear sky"),
  create("street", "mountain-street", 1600, 1067, "Morning on Via Lola", "Fri, Oct 9 · 8:32 AM", "A quiet residential street with low white houses and tall palms beneath the San Jacinto mountains"),
  create("boulders", "boulder-house", 1280, 1600, "The boulder house", "Fri, Oct 9 · 9:05 AM", "A glass and steel modernist house above a garden of granite boulders and agave"),
  create("breeze", "breeze-block", 1062, 1600, "Breeze block wall", "Fri, Oct 9 · 10:20 AM", "A white house with a patterned breeze block wall and two palms against a deep blue sky"),
  create("motel", "motel", 1600, 1061, "Courtyard motel", "Fri, Oct 9 · 12:48 PM", "A white mid-century motel with palms and bare mountains behind it"),
  create("canopy", "canopy", 1600, 1299, "Butterfly canopy", "Fri, Oct 9 · 2:10 PM", "A flat-roofed mid-century canopy under three tall palms"),
  create("white-house", "white-house", 1600, 1067, "Low and white", "Fri, Oct 9 · 3:36 PM", "A low white house behind a lawn with a cluster of tall palms"),
  create("palms", "tall-palms", 1067, 1600, "Tall palms", "Fri, Oct 9 · 4:02 PM", "Skinny fan palms rising high above parked cars and distant mountains"),
  create("dusk", "dusk", 1067, 1600, "Dusk on Belardo Road", "Fri, Oct 9 · 6:41 PM", "A palm silhouetted against a pink evening sky above a lit house"),
  create("rocks", "rock-house", 1600, 1067, "House in the rocks", "Sat, Oct 10 · 7:12 AM", "A low desert house among palms and rounded rocks"),
  create("backlit", "backlit-joshua", 1067, 1600, "First light", "Sat, Oct 10 · 7:48 AM", "A Joshua tree backlit by a low sun, its long shadows falling across the sand"),
  create("lone", "lone-joshua", 900, 1600, "Hidden Valley", "Sat, Oct 10 · 9:30 AM", "A single Joshua tree against a pale blue sky"),
  create("ridge", "ridge", 1067, 1600, "Ryan Mountain trail", "Sat, Oct 10 · 11:05 AM", "A Joshua tree on a rocky slope under a turquoise sky"),
  create("twins", "twin-trees", 1067, 1600, "Two trees", "Sat, Oct 10 · 1:22 PM", "Two Joshua trees under streaked clouds and a bright blue sky"),
  create("sunset", "sunset", 1600, 1067, "Keys View at sunset", "Sat, Oct 10 · 6:28 PM", "Joshua trees silhouetted against an orange and violet sunset"),
  create("blue-hour", "blue-hour", 1600, 1600, "Blue hour", "Sat, Oct 10 · 7:04 PM", "The dark silhouette of a Joshua tree against a deep blue evening sky"),
];

export default desertWeekend;
