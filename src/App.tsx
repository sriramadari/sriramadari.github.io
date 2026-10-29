import { useCallback, useEffect, useMemo, useState } from "react";
import Trace from "./Trace";
import Palette, { type Command } from "./Palette";
import { education, jobs, projects, site, stack } from "./data";
import { Link, navigate } from "./router";
import { useTheme } from "./theme";

const SECTIONS = ["top", "work", "projects", "resume", "contact"] as const;

function isTyping(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export default function App() {
  const { theme, setTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState("");
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    document.title = "Sriram Adari, Founding Software Engineer";
    // Arriving from the package lab via /#projects: jump to the section once it has rendered.
    if (window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }, []);

  const go = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1800);
  };

  const commands: Command[] = useMemo(() => {
    const list: Command[] = [
      { id: "work", label: "Go to work", hint: "j / k", run: () => go("work") },
      { id: "projects", label: "Go to projects", run: () => go("projects") },
      { id: "packages", label: "Open the package lab (live npm demos)", run: () => navigate("/packages") },
      { id: "resume", label: "Go to resume", run: () => go("resume") },
      { id: "contact", label: "Go to contact", run: () => go("contact") },
      {
        id: "theme",
        label: "Switch to " + (theme === "dark" ? "light" : "dark") + " theme",
        hint: "t",
        run: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      },
    ];
    if (site.email) {
      list.push({
        id: "copy",
        label: "Copy email address",
        run: () => {
          navigator.clipboard?.writeText(site.email).then(
            () => flash("Email copied"),
            () => flash(site.email)
          );
        },
      });
    }
    if (site.github) list.push({ id: "gh", label: "Open GitHub", run: () => window.open(site.github, "_blank") });
    if (site.linkedin) list.push({ id: "li", label: "Open LinkedIn", run: () => window.open(site.linkedin, "_blank") });
    if (site.x) list.push({ id: "x", label: "Open X", run: () => window.open(site.x, "_blank") });
    if (site.medium) list.push({ id: "md", label: "Open Medium", run: () => window.open(site.medium, "_blank") });
    if (site.resume) list.push({ id: "cv", label: "Open resume", run: () => window.open(site.resume, "_blank") });
    return list;
  }, [theme, go, setTheme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (paletteOpen || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "t") {
        setTheme((t) => (t === "dark" ? "light" : "dark"));
      } else if (e.key === "j" || e.key === "k") {
        const y = window.scrollY + 80;
        const tops = SECTIONS.map((id) => document.getElementById(id)?.offsetTop ?? 0);
        let current = 0;
        tops.forEach((t, i) => {
          if (y >= t) current = i;
        });
        const next = e.key === "j" ? Math.min(current + 1, SECTIONS.length - 1) : Math.max(current - 1, 0);
        go(SECTIONS[next]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, go]);

  return (
    <>
      <a className="skip" href="#work">
        Skip to work
      </a>

      <nav className="nav">
        <a href="#top" className="brand">
          sriram<span className="muted">.dev</span>
        </a>
        <div className="nav-links">
          <a href="#work" className="hide-narrow">Work</a>
          <a href="#projects">Projects</a>
          <Link href="/packages">Packages</Link>
          {site.resume && <a href="#resume">Resume</a>}
          <a href="#contact">Contact</a>
        </div>
        <button className="cmdk" onClick={() => setPaletteOpen(true)} aria-label="Open command menu">
          <kbd>{isMac ? "⌘" : "Ctrl"}</kbd>
          <kbd>K</kbd>
        </button>
      </nav>

      <main>
        <section id="top" className="hero">
          <div className="hero-copy">
            <p className="where muted">
              {site.role}, {site.location}
            </p>
            <h1>{site.name}</h1>
            <p className="intro">{site.intro}</p>
            <p className="open">
              <i aria-hidden="true" />
              {site.openTo}
            </p>
            <ul className="stack" aria-label="Stack">
              {stack.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <Trace />
        </section>

        <section id="work" className="block">
          <h2>Work</h2>
          <ol className="jobs">
            {jobs.map((j) => (
              <li key={j.company} className="job">
                <div className="job-meta">
                  <span className="mono">{j.when}</span>
                  <span className="muted">{j.place}</span>
                </div>
                <div>
                  <h3>
                    {j.title}, <span className="muted">{j.company}</span>
                  </h3>
                  <ul className="points">
                    {j.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
            <li className="job">
              <div className="job-meta">
                <span className="mono">{education.when}</span>
                <span className="muted">{education.place}</span>
              </div>
              <div>
                <h3>
                  {education.degree}, <span className="muted">{education.school}</span>
                </h3>
                <ul className="points">
                  {education.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </li>
          </ol>
        </section>

        <section id="projects" className="block">
          <h2>Projects</h2>
          <p className="section-note muted">Open source tools I built because I needed them at work first, and a few things I shipped along the way.</p>
          <Link href="/packages" className="lab-callout">
            <span className="mono">package lab</span>
            <span>
              All five npm packages run live in your browser. Break an MCP server, rate-limit an LLM, leak some memory.
            </span>
            <span aria-hidden="true">→</span>
          </Link>
          <ul className="projects">
            {projects.map((p) => (
              <li key={p.name} className="project">
                <div className="project-top">
                  <h3 className="mono">{p.name}</h3>
                  <span className="pill mono">{p.status}</span>
                </div>
                <p>{p.summary}</p>
                <div className="project-foot">
                  <ul className="tags">
                    {p.stack.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  <span className="links">
                    {p.demo && (
                      <Link href={`/packages/${p.demo}`} className="demo-link">
                        Live demo
                      </Link>
                    )}
                    {p.live && (
                      <a href={p.live} target="_blank" rel="noreferrer">
                        Live site
                      </a>
                    )}
                    {p.npm && (
                      <a href={p.npm} target="_blank" rel="noreferrer">
                        npm
                      </a>
                    )}
                    {p.repo && (
                      <a href={p.repo} target="_blank" rel="noreferrer">
                        Source
                      </a>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {site.resume && (
          <section id="resume" className="block">
            <h2>Resume</h2>
            <p className="section-note muted">The one page version. Open it in a new tab or grab the PDF.</p>
            <div className="resume-actions">
              <a className="btn" href={site.resume} download="Sriram_Adari_Resume.pdf">
                Download PDF
              </a>
              <a href={site.resume} target="_blank" rel="noreferrer">
                Open in new tab
              </a>
            </div>
            <object className="resume-frame" data={`${site.resume}#view=FitH`} type="application/pdf" aria-label="Resume preview">
              <p className="muted">
                Your browser can't preview PDFs here.{" "}
                <a href={site.resume} target="_blank" rel="noreferrer">
                  Open the resume
                </a>{" "}
                instead.
              </p>
            </object>
          </section>
        )}

        <section id="contact" className="block contact">
          <h2>Building something with LLMs, queues, or both?</h2>
          <p className="muted">
            I like hard backend problems and small teams that ship. Tell me what you are working on.
          </p>
          <div className="contact-actions">
            {site.email && (
              <a className="btn" href={`mailto:${site.email}`}>
                Email me
              </a>
            )}
            {site.github && (
              <a href={site.github} target="_blank" rel="noreferrer">
                GitHub
              </a>
            )}
            {site.linkedin && (
              <a href={site.linkedin} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            )}
            {site.x && (
              <a href={site.x} target="_blank" rel="noreferrer">
                X
              </a>
            )}
            {site.medium && (
              <a href={site.medium} target="_blank" rel="noreferrer">
                Medium
              </a>
            )}
            {site.instagram && (
              <a href={site.instagram} target="_blank" rel="noreferrer">
                Instagram
              </a>
            )}
            {site.resume && (
              <a href={site.resume} target="_blank" rel="noreferrer">
                Resume
              </a>
            )}
          </div>
        </section>
      </main>

      <footer className="foot muted">
        <span>Built with React and Vite.</span>
        <span className="keys">
          <kbd>j</kbd> <kbd>k</kbd> to move, <kbd>t</kbd> for theme, <kbd>/</kbd> for commands
        </span>
      </footer>

      <Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <div className={"toast" + (toast ? " show" : "")} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
