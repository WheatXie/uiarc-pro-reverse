import { NowPlaying } from "./now-playing";
import type { NowPlayingTrack } from "./now-playing";
import styles from "./demo.module.css";

const artwork = (name: string) => `/media/specials/now-playing-${name}.jpg`;

const TRACKS: NowPlayingTrack[] = [
  {
    id: "undertow",
    title: "Undertow",
    artist: "Hollis Reed",
    duration: 214,
    artwork: artwork("undertow"),
    artworkAlt: "A wave breaking in amber light, seen from above",
  },
  {
    id: "dune-light",
    title: "Dune light",
    artist: "The Meridian Line",
    duration: 247,
    artwork: artwork("dune"),
    artworkAlt: "Sand dunes under a pale sky",
  },
  {
    id: "halo",
    title: "Halo, slowly",
    artist: "Avery Cole",
    duration: 196,
    artwork: artwork("halo"),
    artworkAlt: "A circle of light painted in the dark",
  },
  {
    id: "concrete-garden",
    title: "Concrete garden",
    artist: "Sloane & Wilder",
    duration: 231,
    artwork: artwork("concrete"),
    artworkAlt: "Angular concrete facade in hard sunlight",
  },
  {
    id: "tidepool",
    title: "Tidepool",
    artist: "Hollis Reed",
    duration: 188,
    artwork: artwork("tide"),
    artworkAlt: "Teal swirls of ink in water",
  },
];

export const meta = "Live · component";

export default function NowPlayingDemo() {
  return (
    <div className={styles.demo}>
      <NowPlaying tracks={TRACKS} label="Now playing" />
    </div>
  );
}
