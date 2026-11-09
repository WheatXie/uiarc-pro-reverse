import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Code2, Copy, Eye, Maximize2, PanelRight } from "lucide-react";
import { Layout } from "./Layout";
import { findBlock, findComponent } from "./catalog";
import { renderMarkdown } from "./markdown";
import { loadSource, type SourceFile } from "./source";
import { demos } from "../previews";
import styles from "./site.module.css";

export function ItemPage({ kind, slug }: { kind: "component" | "block"; slug: string }) {
  const item = kind === "component" ? findComponent(slug) : findBlock(slug);
  const demo = demos[slug];

  const [view, setView] = useState<"preview" | "code">("preview");
  const [tab, setTab] = useState(0);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeHeading, setActiveHeading] = useState("preview");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setView("preview");
    setTab(0);
    setMarkdown(null);
    let cancelled = false;
    fetch(`/docs/${slug}.md`)
      .then((response) => (response.ok ? response.text() : ""))
      .then((text) => {
        if (!cancelled) setMarkdown(text);
      })
      .catch(() => {
        if (!cancelled) setMarkdown("");
      });
    loadSource(slug).then((list) => {
      if (!cancelled) setFiles(list);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const parsed = useMemo(() => (markdown ? renderMarkdown(markdown) : null), [markdown]);

  useEffect(() => {
    if (!parsed || !bodyRef.current) return;
    const headings = Array.from(bodyRef.current.querySelectorAll<HTMLElement>("h2[id]"));
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveHeading(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 1] },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [parsed]);

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard can be blocked; the button simply does nothing */
    }
  };

  if (!item) {
    return (
      <Layout>
        <p className={styles.crumbs}>{kind === "block" ? "Blocks" : "Components"}</p>
        <h1 className={styles.h1}>Not found</h1>
        <p className={styles.lede} style={{ marginTop: 12 }}>
          No {kind} named “{slug}” in the mirrored catalog.
        </p>
      </Layout>
    );
  }

  const current = files[Math.min(tab, Math.max(files.length - 1, 0))];
  const install = `npx shadcn@latest add ${item.pro ? "@uiarc-pro" : "@uiarc"}/${slug}`;

  const rail = (
    <>
      <p className={styles.railTitle}>On this page</p>
      <a href="#preview" className={styles.railLink} data-on={activeHeading === "preview" || undefined}>
        Preview
      </a>
      {parsed?.toc.map((entry) => (
        <a key={entry.id} href={`#${entry.id}`} className={styles.railLink} data-on={activeHeading === entry.id || undefined}>
          {entry.text}
        </a>
      ))}
      <div className={styles.railFoot}>
        <a href={`/docs/${slug}.md`} target="_blank" rel="noreferrer">
          View as Markdown
        </a>
        <a href="#preview">Back to top ↑</a>
      </div>
    </>
  );

  return (
    <Layout rail={rail}>
      <div className={styles.crumbs}>
        <Link to={kind === "block" ? "/components/blocks/metrics-dashboard" : "/components/button"}>{kind === "block" ? "Blocks" : "Components"}</Link>
        <span aria-hidden="true">›</span>
        <span>{item.title}</span>
      </div>

      <div className={styles.titleRow} id="preview">
        <h1 className={styles.h1}>{item.title}</h1>
        {item.pro && <span className={styles.titleBadge}>Pro</span>}
      </div>

      <div className={styles.ledeRow}>
        <p className={styles.lede}>{item.description || `A Pro ${kind} from the Arc library.`}</p>
        <div className={styles.copySplit}>
          <button type="button" onClick={() => copy(markdown ?? item.description, "page")}>
            {copied === "page" ? <Check width={14} height={14} strokeWidth={2} /> : <Copy width={14} height={14} strokeWidth={1.75} />}
            Copy page
          </button>
          <button type="button" aria-label="Copy options">
            <ChevronDown width={14} height={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className={styles.viewTabs}>
        <button type="button" className={styles.viewTab} data-on={view === "preview" || undefined} onClick={() => setView("preview")}>
          <Eye width={15} height={15} strokeWidth={1.75} aria-hidden="true" />
          Preview
        </button>
        <button type="button" className={styles.viewTab} data-on={view === "code" || undefined} onClick={() => setView("code")}>
          <Code2 width={15} height={15} strokeWidth={1.75} aria-hidden="true" />
          Code
        </button>
        <span className={styles.viewMeta}>{demo?.meta ?? (files.length ? `${files.length} files` : "Reconstruction queued")}</span>
        <div className={styles.iconGroup}>
          <button type="button" aria-label="Fullscreen">
            <Maximize2 width={14} height={14} strokeWidth={1.75} />
          </button>
          <button type="button" aria-label="Toggle panel">
            <PanelRight width={14} height={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {view === "preview" ? (
        <div className={styles.stage} data-stage data-compact={!demo || undefined}>
          <div className={styles.stageInner}>
            {demo ? (
              <demo.Component />
            ) : (
              <div className={styles.pending}>
                <span className={styles.pendingTag}>{item.pro ? "Pro · source gated" : "Preview pending"}</span>
                <p className={styles.pendingTitle}>{item.title}</p>
                <p className={styles.pendingBody}>
                  {files.length
                    ? `Source is vendored at src/components/arc/${slug}/ — the live demo still needs a reconstruction pass. Switch to Code to read it.`
                    : `Queued for extraction from the public preview frame. Files land in src/components/arc/${slug}/.`}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.codeWrap}>
          <div className={styles.codeTabs} data-code-files>
            {files.length ? (
              files.map((file, index) => (
                <button key={file.name} type="button" className={styles.codeTab} data-on={index === tab || undefined} onClick={() => setTab(index)}>
                  {file.name}
                </button>
              ))
            ) : (
              <span className={styles.codeTab} data-on="true">
                pending
              </span>
            )}
          </div>
          <pre className={styles.pre}>
            <code>{current?.code ?? `// ${item.title} has not been reconstructed yet.\n// Expected location: src/components/arc/${slug}/`}</code>
          </pre>
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderTop: "1px solid var(--border-subtle)" }}>
            <code style={{ fontSize: 12, color: "var(--text-secondary)", overflowX: "auto", whiteSpace: "nowrap" }}>{install}</code>
            <button
              type="button"
              onClick={() => copy(install, "install")}
              style={{ marginLeft: "auto", border: 0, background: "transparent", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
            >
              {copied === "install" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className={styles.prose} ref={bodyRef}>
        {parsed ? parsed.node : <p style={{ color: "var(--text-muted)" }}>Loading the docs markdown…</p>}
      </div>
    </Layout>
  );
}
