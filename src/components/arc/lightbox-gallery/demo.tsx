"use client";

import { LightboxGallery, type LightboxImage } from "./lightbox-gallery";
import styles from "./demo.module.css";

export const meta = "Live · component";

const IMAGES: LightboxImage[] = [
  { src: "/media/photos/lisbon-tram.jpg", width: 1600, height: 1064, alt: "A yellow tram passing ochre buildings on a Lisbon street", title: "Tram 28 through Baixa", caption: "Photo by Aayush Gupta" },
  { src: "/media/photos/lisbon-rooftops.jpg", width: 1280, height: 1600, alt: "Terracotta rooftops of Alfama running down to the river", title: "Alfama rooftops at noon", caption: "Photo by Tom Byrom" },
  { src: "/media/photos/chef-plating.jpg", width: 1600, height: 1600, alt: "A chef spooning sauce over a plated dish in low light", title: "Last touch at the pass", caption: "Photo by Urban Gyllström" },
  { src: "/media/photos/lisbon-bridge.jpg", width: 1600, height: 1166, alt: "The red suspension bridge over the Tagus under a clear sky", title: "Across the Tagus", caption: "Photo by Svetlana Gumerova" },
  { src: "/media/photos/terracotta-waves.jpg", width: 1067, height: 1600, alt: "Curving terracotta facade against a blue sky", title: "Terracotta curves", caption: "Photo by Ricardo Gomez Angel" },
  { src: "/media/photos/restaurant.jpg", width: 1067, height: 1600, alt: "A bright dining room with wooden tables and paper lanterns", title: "Lunch under the lanterns", caption: "Photo by Jelezniac Bianca" },
  { src: "/media/photos/coastline.jpg", width: 1200, height: 1600, alt: "Waves breaking along a long green coastline at sunset", title: "Coast road north of Cascais", caption: "Photo by Vera Lee Bird" },
  { src: "/media/photos/wine-bar.jpg", width: 1600, height: 1067, alt: "A carafe of red wine on a wooden bar counter", title: "House red, poured to order", caption: "Photo by Fenghua" },
  { src: "/media/photos/curved-facade.jpg", width: 1600, height: 1067, alt: "White curved balconies of a modern building", title: "White balconies in Belém", caption: "Photo by Kimon Maritz" },
  { src: "/media/photos/salmon-dinner.jpg", width: 1067, height: 1600, alt: "Seared salmon on a bed of vegetables beside a glass of wine", title: "Salmon with spring vegetables", caption: "Photo by Casey Lee" },
  { src: "/media/photos/pool-house.jpg", width: 1600, height: 900, alt: "A modern house with a long pool and deck chairs", title: "Pool house in Comporta", caption: "Photo by Salman Saqib" },
  { src: "/media/photos/sea-at-dusk.jpg", width: 1067, height: 1600, alt: "Calm sea at dusk seen from a ferry railing", title: "Ferry back at dusk", caption: "Photo by Hannah Reding" },
];

export default function LightboxGalleryDemo() {
  return <div className={styles.demo}>
    <LightboxGallery images={IMAGES} label="Lisbon photos" minColumnWidth={140} gap={8} />
  </div>;
}
