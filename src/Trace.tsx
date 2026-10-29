import { useState } from "react";
import { spans } from "./data";

export default function Trace() {
  const [open, setOpen] = useState<number | null>(1);

  return (
    <figure className="trace" aria-label="Career shown as a trace">
      <header className="trace-head">
        <span className="mono">trace 7f3a91c2</span>
        <span className="mono muted">{spans.length} spans</span>
        <span className="status mono">
          <i aria-hidden="true" /> running
        </span>
      </header>
      <div className="trace-ruler mono muted" aria-hidden="true">
        <span>start</span>
        <span>now</span>
      </div>
      <ol className="spans">
        {spans.map((s, i) => {
          const isOpen = open === i;
          return (
            <li key={s.service + s.op} className={`span c-${s.color}`} style={{ "--d": i } as React.CSSProperties}>
              <button
                className="span-row"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span className="span-label mono" style={{ paddingLeft: `${s.depth * 14}px` }}>
                  <b>{s.service}</b>
                  <span className="muted">.{s.op}</span>
                </span>
                <span className="span-track">
                  <span
                    className="span-bar"
                    style={{ left: `${s.start * 100}%`, width: `${(s.end - s.start) * 100}%` }}
                  />
                </span>
              </button>
              {isOpen && <p className="span-detail">{s.detail}</p>}
            </li>
          );
        })}
      </ol>
      <figcaption className="muted">Click a span to see what happened there.</figcaption>
    </figure>
  );
}
