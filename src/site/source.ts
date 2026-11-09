/**
 * Lazily pulls the vendored source of any component or block straight out of the repo,
 * so the Code tab mirrors exactly what ships in `src/components/arc/<slug>/`.
 */
const sources = import.meta.glob("../components/arc/**/*.{tsx,ts,css}", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

export interface SourceFile {
  name: string;
  code: string;
}

const ORDER = [".tsx", ".ts", ".module.css", ".css"];

export async function loadSource(slug: string): Promise<SourceFile[]> {
  const prefix = `../components/arc/${slug}/`;
  const paths = Object.keys(sources)
    .filter((path) => path.startsWith(prefix))
    .sort((a, b) => {
      const rank = (path: string) => {
        const index = ORDER.findIndex((ext) => path.endsWith(ext));
        return index === -1 ? ORDER.length : index;
      };
      return rank(a) - rank(b) || a.localeCompare(b);
    });

  return Promise.all(
    paths.map(async (path) => ({
      name: path.slice(prefix.length),
      code: await sources[path](),
    })),
  );
}
