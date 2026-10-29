import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { Link } from "../router";
import { useTheme } from "../theme";
import About from "./About";
import { explainers } from "./explainers";
import { bySlug, packages, type PackageInfo } from "./packages";
import { CopyCommand } from "./ui";
import "./lab.css";

// Each demo is its own chunk: the MCP SDK and zod only load when someone opens that demo.
const DEMOS: Record<string, React.LazyExoticComponent<ComponentType>> = {
  "mcp-devkit": lazy(() => import("./demos/McpDemo")),
  "ai-observer": lazy(() => import("./demos/AiDemo")),
  "bullmq-devkit": lazy(() => import("./demos/DevkitDemo")),
  "bullmq-autoqueue": lazy(() => import("./demos/AutoqueueDemo")),
  "node-observe": lazy(() => import("./demos/ObserveDemo")),
};

export default function Lab({ path }: { path: string }) {
  const { theme, toggle } = useTheme();
  const slug = path.replace(/^\/packages\/?/, "").replace(/\/$/, "");
  const pkg = slug ? bySlug(slug) : undefined;

  useEffect(() => {
    document.title = pkg ? `${pkg.name} live demo, Sriram Adari` : "npm packages, Sriram Adari";
  }, [pkg]);

  return (
    <div className="lab">
      <nav className="nav">
        <Link href="/" className="brand">
          sriram<span className="muted">.dev</span>
        </Link>
        <div className="nav-links">
          <Link href="/#projects">Projects</Link>
          <Link href="/packages" aria-current={!slug ? "page" : undefined}>
            Packages
          </Link>
        </div>
        <button className="theme-btn mono" onClick={toggle} aria-label="Switch theme">
          {theme === "dark" ? "light" : "dark"}
        </button>
      </nav>

      <div className="lab-body">
        <aside className="lab-rail" aria-label="Packages">
          <p className="rail-title mono muted">npm packages</p>
          <ul>
            {packages.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/packages/${p.slug}`}
                  className={`rail-link c-${p.color}`}
                  aria-current={p.slug === slug ? "page" : undefined}
                >
                  <i aria-hidden="true" />
                  <span className="mono">{p.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <main className="lab-main">
          {!slug && <Overview />}
          {slug && !pkg && <NotFound slug={slug} />}
          {pkg && <DemoPage pkg={pkg} />}
        </main>
      </div>
    </div>
  );
}

function Overview() {
  return (
    <>
      <header className="lab-hero">
        <p className="mono muted">5 packages · all on npm · all running live below</p>
        <h1>Package lab</h1>
        <p className="lab-lede">
          Backend tooling I wrote because I needed it at work first: MCP server testing, an LLM gateway, BullMQ operations
          and Node observability. Each one has a working demo that runs the published package in your browser.
        </p>
      </header>
      <ul className="pkg-grid">
        {packages.map((p) => (
          <li key={p.slug} className={`pkg-card c-${p.color}`}>
            <div className="pkg-card-top">
              <h2 className="mono">{p.name}</h2>
              <span className="mono muted">v{p.version}</span>
            </div>
            <p>{p.tagline}</p>
            <p className="muted pkg-demo-line">{p.demo}</p>
            <div className="pkg-card-foot">
              <Link className="btn" href={`/packages/${p.slug}`}>
                Open live demo
              </Link>
              <Link href={`/packages/${p.slug}#about`}>What it does</Link>
              <a href={p.npm} target="_blank" rel="noreferrer">
                npm
              </a>
              <a href={p.repo} target="_blank" rel="noreferrer">
                Source
              </a>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

type View = "demo" | "about";
const viewFromHash = (): View => (window.location.hash === "#about" ? "about" : "demo");

function DemoPage({ pkg }: { pkg: PackageInfo }) {
  const Demo = DEMOS[pkg.slug];
  // The tab lives in the URL hash so /packages/<name>#about can be shared.
  const [view, setView] = useState<View>(viewFromHash);
  useEffect(() => {
    const sync = () => setView(viewFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pkg.slug]);
  const show = (v: View) => {
    window.history.replaceState(null, "", window.location.pathname + (v === "about" ? "#about" : ""));
    setView(v);
  };

  return (
    <article className={`demo-page c-${pkg.color}`}>
      <header className="demo-head">
        <div className="demo-title">
          <h1 className="mono">{pkg.name}</h1>
          <span className="pill mono">v{pkg.version}</span>
        </div>
        <p className="lab-lede">{pkg.tagline}</p>
        <div className="demo-meta">
          <CopyCommand command={pkg.install} />
          <span className="links">
            <a href={pkg.npm} target="_blank" rel="noreferrer">
              npm
            </a>
            <a href={pkg.repo} target="_blank" rel="noreferrer">
              Source
            </a>
          </span>
        </div>
      </header>
      <div className="page-tabs" role="tablist" aria-label={`${pkg.name} views`}>
        <button role="tab" aria-selected={view === "demo"} onClick={() => show("demo")}>
          Live demo
        </button>
        <button role="tab" aria-selected={view === "about"} onClick={() => show("about")}>
          What it does
        </button>
      </div>
      {view === "about" ? (
        <About e={explainers[pkg.slug]} onTryIt={() => show("demo")} />
      ) : (
        <>
          <p className="real-note">
            <b>What's real here.</b> {pkg.realNote}
          </p>
          <Suspense fallback={<p className="muted mono loading">loading {pkg.npmName}…</p>}>
            <Demo />
          </Suspense>
        </>
      )}
    </article>
  );
}

function NotFound({ slug }: { slug: string }) {
  return (
    <div className="lab-hero">
      <h1>No package called "{slug}"</h1>
      <p className="lab-lede">
        <Link href="/packages">See all five packages</Link> instead.
      </p>
    </div>
  );
}
