import type { Explainer } from "./explainers";

export default function About({ e, onTryIt }: { e: Explainer; onTryIt: () => void }) {
  return (
    <div className="about">
      <p className="about-summary">{e.summary}</p>

      <section>
        <h2>The problem</h2>
        <p className="about-prose">{e.problem}</p>
      </section>

      <section>
        <h2>What it does</h2>
        <ul className="feature-grid">
          {e.features.map((f) => (
            <li key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>How it helps</h2>
        <ul className="helps">
          {e.helps.map((h) => (
            <li key={h.before}>
              <div className="helps-before">
                <span className="mono small">before</span>
                <p>{h.before}</p>
              </div>
              <span className="helps-arrow" aria-hidden="true">
                →
              </span>
              <div className="helps-after">
                <span className="mono small">with it</span>
                <p>{h.after}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="fit">
        <div>
          <h2>Use it when</h2>
          <ul className="points">
            {e.useWhen.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Not the right tool for</h2>
          <ul className="points not">
            {e.notFor.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <h2>How it works</h2>
        <p className="about-prose">{e.howItWorks}</p>
      </section>

      <button className="btn" onClick={onTryIt}>
        Try it in the live demo
      </button>
    </div>
  );
}
