import { photo } from "../lib/media";
import type { PhotoId } from "../lib/media";

export interface GlassSegmentedSlide {
  /** Value handed to the control and used as the crossfade key. */
  value: string;
  /** Segment text. */
  label: string;
  /** Caption title. */
  title: string;
  /** Caption detail line. */
  detail: string;
  photo: PhotoId;
}

export const slides: GlassSegmentedSlide[] = [
  {
    value: "rooftops",
    label: "Alfama",
    title: "Alfama at sunset",
    detail: "Miradouro de Santa Luzia",
    photo: "lisbon-rooftops",
  },
  {
    value: "tram",
    label: "Tram",
    title: "Tram 28",
    detail: "Rua da Conceição",
    photo: "lisbon-tram",
  },
  {
    value: "bridge",
    label: "Bridge",
    title: "25 de Abril Bridge",
    detail: "Across the Tagus",
    photo: "lisbon-bridge",
  },
  {
    value: "coast",
    label: "Coast",
    title: "Praia da Ursa",
    detail: "Sintra coast, 40 min west",
    photo: "coastline",
  },
];

export const segmentedOptions = slides.map(slide => ({ value: slide.value, label: slide.label }));

export const slideMedia = (value: string) => {
  const slide = slides.find(entry => entry.value === value) ?? slides[0];
  return { slide, media: photo(slide.photo) };
};
