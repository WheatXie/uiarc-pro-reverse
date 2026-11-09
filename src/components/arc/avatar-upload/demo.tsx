/**
 * Avatar upload demo — reconstructed from the Pro preview chunk: a profile card where the sample
 * portraits and the failure chips push files through the picker's own `selectFile` path, and
 * uploads are simulated with a 1.9s ramp that can be made to fail at 62%.
 */
import { useRef, useState } from "react";
import { AvatarUpload, type AvatarUploadHandle } from "./avatar-upload";
import styles from "./demo.module.css";

interface Sample {
  name: string;
  src: string;
}

const SAMPLES: Sample[] = [
  { name: "Andre Williams", src: "/media/people/portrait/andre-williams.svg" },
  { name: "Sofia Ramirez", src: "/media/people/portrait/sofia-ramirez.svg" },
  { name: "Mateo Alvarez", src: "/media/people/portrait/mateo-alvarez.svg" },
];

export const meta = "Live · keyboard ready";

export default function AvatarUploadDemo() {
  const upload = useRef<AvatarUploadHandle>(null);
  const [failNext, setFailNext] = useState(false);
  const [loadingSrc, setLoadingSrc] = useState<string | null>(null);

  async function useSample(src: string, name: string) {
    setLoadingSrc(src);
    try {
      const blob = await (await fetch(src)).blob();
      upload.current?.selectFile(
        new File([blob], `${name.toLowerCase().replace(/\s+/g, "-")}.jpg`, { type: "image/jpeg" }),
      );
    } finally {
      setLoadingSrc(null);
    }
  }

  return (
    <div className={styles.demo}>
      <section className={styles.card} aria-labelledby="avatar-upload-demo-title">
        <div className={styles.header}>
          <h3 id="avatar-upload-demo-title" className={styles.title}>
            Profile
          </h3>
          <p className={styles.lede}>Click or drop a photo on the avatar. Uploads are simulated.</p>
        </div>
        <AvatarUpload
          ref={upload}
          name="Chloe Nguyen"
          src="/media/people/portrait/chloe-nguyen.svg"
          onUpload={(_image, { report, signal }) => {
            setFailNext(false);
            return new Promise<void>((resolve, reject) => {
              const started = performance.now();
              let frame = 0;
              const tick = (now: number) => {
                const t = Math.min(1, (now - started) / 1900);
                const eased = 1 - Math.pow(1 - t, 2.2);
                if (failNext && eased > 0.62) {
                  reject(new Error("Upload failed. Your previous photo is unchanged."));
                  return;
                }
                report(eased);
                if (t < 1) frame = requestAnimationFrame(tick);
                else resolve();
              };
              const start = window.setTimeout(() => {
                frame = requestAnimationFrame(tick);
              }, 380);
              signal.addEventListener("abort", () => {
                window.clearTimeout(start);
                cancelAnimationFrame(frame);
                reject(new DOMException("Canceled", "AbortError"));
              });
            });
          }}
          onRemove={() => undefined}
        />
        <div className={styles.tools}>
          <div className={styles.group}>
            <span className={styles.groupLabel} id="avatar-upload-samples">
              Sample photos
            </span>
            <div className={styles.samples} role="group" aria-labelledby="avatar-upload-samples">
              {SAMPLES.map((sample) => (
                <button
                  key={sample.src}
                  type="button"
                  className={styles.sample}
                  aria-label={`Use photo of ${sample.name}`}
                  data-loading={loadingSrc === sample.src ? "" : undefined}
                  onClick={() => void useSample(sample.src, sample.name)}
                >
                  <img src={sample.src} alt="" width={32} height={32} />
                </button>
              ))}
            </div>
          </div>
          <div className={styles.group}>
            <span className={styles.groupLabel}>Try a failure</span>
            <div className={styles.chips}>
              <button
                type="button"
                className={styles.chip}
                onClick={() =>
                  upload.current?.selectFile(
                    new File([new Uint8Array(13002342)], "raw-portrait.jpg", { type: "image/jpeg" }),
                  )
                }
              >
                12 MB photo
              </button>
              <button
                type="button"
                className={styles.chip}
                onClick={() =>
                  upload.current?.selectFile(new File(["%PDF-1.7"], "headshot.pdf", { type: "application/pdf" }))
                }
              >
                PDF file
              </button>
              <button
                type="button"
                className={styles.chip}
                aria-pressed={failNext}
                onClick={() => setFailNext((value) => !value)}
              >
                <span className={styles.check} aria-hidden="true" />
                Fail next upload
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
