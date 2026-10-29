import { useState, type ReactNode } from "react";

export function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      {(title || aside) && (
        <header className="panel-head">
          {title && <h3>{title}</h3>}
          {aside && <div className="panel-aside">{aside}</div>}
        </header>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className={"stat" + (tone ? " tone-" + tone : "")}>
      <span className="stat-label">{label}</span>
      <span className="stat-value mono">{value}</span>
    </div>
  );
}

export function Code({ children, label }: { children: string; label?: string }) {
  return (
    <figure className="code">
      {label && <figcaption className="mono muted">{label}</figcaption>}
      <pre>
        <code>{children}</code>
      </pre>
    </figure>
  );
}

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(command).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      },
      () => {}
    );
  };
  return (
    <div className="copy-cmd mono">
      <span className="muted" aria-hidden="true">
        $
      </span>
      <span className="copy-text">{command}</span>
      <button onClick={copy} aria-label={"Copy " + command}>
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format = String,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="slider">
      <span className="slider-top">
        <span>{label}</span>
        <span className="mono">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "good" | "warn" | "bad" | "info" | "muted"; children: ReactNode }) {
  return <span className={"badge mono tone-" + tone}>{children}</span>;
}

export const fmtMs = (n: number) => (n >= 1000 ? (n / 1000).toFixed(2) + "s" : Math.round(n) + "ms");
export const fmtUsd = (n: number) => "$" + (n < 0.01 && n > 0 ? n.toFixed(6) : n.toFixed(4));
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
