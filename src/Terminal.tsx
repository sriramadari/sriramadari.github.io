import { useEffect, useRef, useState, type ReactNode } from "react";
import { projects, site, stack } from "./data";
import { packages } from "./lab/packages";
import { Link, navigate } from "./router";

// The hero, as a terminal session: a scripted intro that types itself out, then a prompt
// visitors can use. All script lines are in the DOM from the start (unrevealed ones are
// transparent and inert), so nothing shifts while it types and the text stays readable to
// assistive tech and crawlers.

const PROMPT = "sriram@dev:~$";
const TYPE_MS = 28;
const PAUSE_MS = 260;

type Step = { cmd: string; out: ReactNode };

const SEEN_KEY = "term-intro-seen";

/** Play the typing intro once per browser session, and never under reduced motion. */
function skipIntro(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function Builds() {
  const others = projects.filter((p) => !p.demo && p.live);
  return (
    <div className="t-ls">
      {packages.map((p) => (
        <div key={p.slug} className="t-ls-row">
          <Link href={`/packages/${p.slug}`} className={`t-pkg c-${p.color}`}>
            {p.name}/
          </Link>
          <span className="t-dim">{p.tagline}</span>
          <span className="t-ls-actions">
            <Link href={`/packages/${p.slug}`}>demo</Link>
            <Link href={`/packages/${p.slug}#about`}>about</Link>
          </span>
        </div>
      ))}
      {others.map((p) => (
        <div key={p.name} className="t-ls-row">
          <a href={p.live} target="_blank" rel="noreferrer" className="t-pkg t-app">
            {p.name.toLowerCase().replace(/\s+/g, "-")}*
          </a>
          <span className="t-dim">{p.summary.split(". ")[0].replace(/\.?$/, ".")}</span>
          <span className="t-ls-actions">
            <a href={p.live} target="_blank" rel="noreferrer">
              live
            </a>
          </span>
        </div>
      ))}
    </div>
  );
}

const SCRIPT: Step[] = [
  {
    cmd: "whoami",
    out: (
      <div className="t-whoami">
        <h1>{site.name}</h1>
        <p className="t-dim">
          {site.role} · {site.location}
        </p>
      </div>
    ),
  },
  { cmd: "cat about.md", out: <p className="t-prose">{site.intro}</p> },
  {
    cmd: "cat fit.md",
    out: (
      <ul className="t-list">
        {site.fit.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    ),
  },
  {
    cmd: "echo $OPEN_TO",
    out: (
      <p className="t-open">
        <i aria-hidden="true" />
        {site.openTo}
      </p>
    ),
  },
  { cmd: "ls ~/builds", out: <Builds /> },
];

const COMMANDS = ["help", "whoami", "about", "ls", "fit", "stack", "demo", "explain", "cd", "open", "contact", "theme", "clear"];
const OPEN_TARGETS: Record<string, string> = {
  github: site.github,
  linkedin: site.linkedin,
  x: site.x,
  medium: site.medium,
  resume: site.resume,
};

type Entry = { id: number; cmd: string; out: ReactNode };

export default function Terminal({ onTheme, go }: { onTheme: () => void; go: (id: string) => void }) {
  // Progress through the script: `step` lines are fully shown, `chars` of the next command are typed.
  const [step, setStep] = useState(() => (skipIntro() ? SCRIPT.length : 0));
  const [chars, setChars] = useState(0);
  const done = step >= SCRIPT.length;
  const [history, setHistory] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [cleared, setCleared] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const past = useRef<string[]>([]);
  const pastIdx = useRef(-1);
  const nextId = useRef(1);

  useEffect(() => {
    if (done) {
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* storage unavailable */
      }
      return;
    }
    const cmd = SCRIPT[step].cmd;
    const t =
      chars < cmd.length
        ? window.setTimeout(() => setChars((c) => c + 1), TYPE_MS)
        : window.setTimeout(() => {
            setStep((s) => s + 1);
            setChars(0);
          }, PAUSE_MS);
    return () => window.clearTimeout(t);
  }, [step, chars, done]);

  // Any key or click skips the intro animation.
  useEffect(() => {
    if (done) return;
    const skip = () => setStep(SCRIPT.length);
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [done]);

  // Keep the prompt on screen as output grows.
  useEffect(() => {
    if (history.length) inputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [history]);

  const print = (cmd: string, out: ReactNode) => setHistory((h) => [...h, { id: nextId.current++, cmd, out }].slice(-12));

  const run = (raw: string) => {
    const line = raw.trim();
    if (line) {
      past.current = [line, ...past.current].slice(0, 50);
      pastIdx.current = -1;
    }
    const [cmd = "", ...args] = line.split(/\s+/);
    const arg = args.join(" ").toLowerCase();
    const pkg = packages.find((p) => p.slug === arg || p.name === arg);
    const scriptOut = (c: string) => SCRIPT.find((s) => s.cmd === c)?.out;

    switch (cmd.toLowerCase()) {
      case "":
        return print("", null);
      case "help":
        return print(
          line,
          <div className="t-help">
            {[
              ["ls", "what I've built"],
              ["demo <package>", "open a package's live demo"],
              ["explain <package>", "what a package does and how it helps"],
              ["fit", "why I fit AI and FDE roles"],
              ["stack", "languages and tools"],
              ["cd work | projects | contact", "jump to a section"],
              ["open github | linkedin | resume", "open a profile"],
              ["contact", "how to reach me"],
              ["theme", "switch light / dark"],
              ["clear", "clear the screen"],
            ].map(([c, d]) => (
              <div key={c}>
                <span className="t-cmd">{c}</span>
                <span className="t-dim">{d}</span>
              </div>
            ))}
          </div>
        );
      case "whoami":
        return print(line, <p>{site.name}, {site.role}.</p>);
      case "about":
      case "cat":
        if (cmd === "cat" && arg === "fit.md") return print(line, scriptOut("cat fit.md"));
        if (cmd === "cat" && arg && arg !== "about.md") return print(line, <p className="t-err">cat: {arg}: No such file. Try about.md or fit.md</p>);
        return print(line, scriptOut("cat about.md"));
      case "ls":
        return print(line, <Builds />);
      case "fit":
        return print(line, scriptOut("cat fit.md"));
      case "stack":
        return print(line, <p>{stack.join("  ·  ")}</p>);
      case "demo":
      case "explain":
        if (!pkg) {
          return print(
            line,
            <p className={arg ? "t-err" : ""}>
              {arg ? `${cmd}: no package "${arg}". ` : `usage: ${cmd} <package>. `}
              Packages: {packages.map((p) => p.name).join(", ")}
            </p>
          );
        }
        navigate(`/packages/${pkg.slug}${cmd === "explain" ? "#about" : ""}`);
        return;
      case "cd":
        if (["work", "projects", "resume", "contact"].includes(arg)) {
          go(arg);
          return print(line, null);
        }
        return print(line, <p className="t-err">cd: {arg || "~"}: try work, projects, resume or contact</p>);
      case "open": {
        const url = OPEN_TARGETS[arg];
        if (!url) return print(line, <p className="t-err">open: try {Object.keys(OPEN_TARGETS).join(", ")}</p>);
        window.open(url, "_blank", "noopener");
        return print(line, <p className="t-dim">opening {url}</p>);
      }
      case "contact":
      case "email":
        return print(
          line,
          <p>
            <a href={`mailto:${site.email}`}>{site.email}</a>
            <span className="t-dim"> · or </span>
            <a href={site.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </p>
        );
      case "theme":
        onTheme();
        return print(line, <p className="t-dim">theme switched</p>);
      case "clear":
        setHistory([]);
        setCleared(true);
        return;
      case "sudo":
        return print(
          line,
          <p>
            Permission granted. Next step: <a href={`mailto:${site.email}?subject=Let's talk`}>{site.email}</a>
          </p>
        );
      default:
        return print(line, <p className="t-err">command not found: {cmd}. Type help to see what works.</p>);
    }
  };

  const complete = () => {
    const [cmd, ...rest] = input.split(" ");
    if (rest.length === 0) {
      const hit = COMMANDS.filter((c) => c.startsWith(cmd));
      if (hit.length === 1) setInput(hit[0] + " ");
      return;
    }
    const arg = rest.join(" ");
    const pool = cmd === "open" ? Object.keys(OPEN_TARGETS) : cmd === "cd" ? ["work", "projects", "resume", "contact"] : packages.map((p) => p.name);
    const hit = pool.filter((p) => p.startsWith(arg));
    if (hit.length === 1) setInput(`${cmd} ${hit[0]}`);
  };

  return (
    <div className="term" onClick={(e) => done && !(e.target as HTMLElement).closest("a") && inputRef.current?.focus({ preventScroll: true })}>
      <div className="term-bar" aria-hidden="true">
        <span className="term-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="term-title">sriram@dev: ~</span>
        <span className="term-hint">{done ? "type help" : "press any key to skip"}</span>
      </div>
      <div className="term-body">
        {!cleared &&
          SCRIPT.map((s, i) => {
            const shown = i < step;
            const typing = i === step;
            return (
              <div key={s.cmd} className={"t-block" + (shown || typing ? "" : " pending")}>
                <div className="t-line">
                  <span className="t-prompt">{PROMPT}</span>
                  <span className="t-cmd">
                    {typing ? (
                      <>
                        {s.cmd.slice(0, chars)}
                        <span className="t-cursor" aria-hidden="true" />
                        <span className="sr-only">{s.cmd.slice(chars)}</span>
                      </>
                    ) : (
                      s.cmd
                    )}
                  </span>
                </div>
                <div className={"t-out" + (shown ? "" : " pending")}>{s.out}</div>
              </div>
            );
          })}
        {history.map((h) => (
          <div key={h.id} className="t-block">
            <div className="t-line">
              <span className="t-prompt">{PROMPT}</span>
              <span className="t-cmd">{h.cmd}</span>
            </div>
            {h.out && <div className="t-out">{h.out}</div>}
          </div>
        ))}
        <form
          className={"t-line t-input" + (done ? "" : " pending")}
          onSubmit={(e) => {
            e.preventDefault();
            run(input);
            setInput("");
          }}
        >
          <label htmlFor="term-input" className="t-prompt">
            {PROMPT}
          </label>
          <input
            id="term-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && input) {
                e.preventDefault();
                complete();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                pastIdx.current = Math.min(pastIdx.current + 1, past.current.length - 1);
                if (past.current[pastIdx.current] !== undefined) setInput(past.current[pastIdx.current]);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                pastIdx.current = Math.max(pastIdx.current - 1, -1);
                setInput(pastIdx.current === -1 ? "" : past.current[pastIdx.current]);
              }
            }}
            placeholder={done ? "type help, or try: demo mcp-devkit" : ""}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Terminal command"
            tabIndex={done ? 0 : -1}
          />
        </form>
      </div>
    </div>
  );
}
