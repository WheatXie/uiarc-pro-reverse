import type { ReactNode } from "react";

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

/** Inline markdown: `code`, **bold**, [label](href). Everything else is text. */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1]) {
      nodes.push(<code key={key++}>{match[1].slice(1, -1)}</code>);
    } else if (match[2]) {
      nodes.push(<strong key={key++}>{match[2].slice(2, -2)}</strong>);
    } else if (match[3]) {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(match[3]);
      if (link) {
        const external = /^https?:/.test(link[2]);
        nodes.push(
          <a key={key++} href={link[2]} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
            {link[1]}
          </a>,
        );
      }
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Renders the mirror of the docs markdown (headings, lists, tables, fenced code, quotes).
 * Returns the table of contents so the right rail can be built from the same pass.
 */
export function renderMarkdown(markdown: string): { node: ReactNode; toc: TocEntry[] } {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  const toc: TocEntry[] = [];
  const usedIds = new Set<string>();
  let i = 0;
  let key = 0;

  const flushParagraph = (buffer: string[]) => {
    if (!buffer.length) return;
    blocks.push(<p key={key++}>{inline(buffer.join(" "))}</p>);
    buffer.length = 0;
  };

  const paragraph: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      flushParagraph(paragraph);
      i++;
      continue;
    }

    // fenced code
    if (line.startsWith("```")) {
      flushParagraph(paragraph);
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key++}>
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // heading
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph(paragraph);
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level >= 2) {
        // Docs with repeated section titles (e.g. two "Variant" blocks) would otherwise
        // emit colliding anchors and duplicate TOC keys.
        const base = slugify(text);
        let id = base;
        for (let n = 2; usedIds.has(id); n += 1) id = `${base}-${n}`;
        usedIds.add(id);
        toc.push({ id, text, level });
        blocks.push(
          level === 2 ? (
            <h2 key={key++} id={id}>
              {inline(text)}
            </h2>
          ) : (
            <h3 key={key++} id={id}>
              {inline(text)}
            </h3>
          ),
        );
      }
      i++;
      continue;
    }

    // horizontal rule
    if (/^---+\s*$/.test(line)) {
      flushParagraph(paragraph);
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }

    // blockquote
    if (line.startsWith(">")) {
      flushParagraph(paragraph);
      const body: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) body.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={key++}>{inline(body.join(" "))}</blockquote>);
      continue;
    }

    // table
    if (line.includes("|") && lines[i + 1] && /^\|?[\s:-|]+\|[\s:-|]*$/.test(lines[i + 1].trim())) {
      flushParagraph(paragraph);
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) rows.push(cells(lines[i++]));
      blocks.push(
        <table key={key++}>
          <thead>
            <tr>
              {head.map((cell, index) => (
                <th key={index}>{inline(cell)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{inline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }

    // lists
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flushParagraph(paragraph);
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      const list = items.map((item, index) => <li key={index}>{inline(item)}</li>);
      blocks.push(ordered ? <ol key={key++}>{list}</ol> : <ul key={key++}>{list}</ul>);
      continue;
    }

    paragraph.push(line.trim());
    i++;
  }
  flushParagraph(paragraph);

  return { node: <>{blocks}</>, toc };
}
