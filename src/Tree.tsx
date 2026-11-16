import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "./router";
import { tree, type TreeNode } from "./aboutTree";

// "About" as an explorable tree. Wide screens get an SVG graph with eased re-layout and
// packets flowing along the path to the selected node; narrow screens get an indented
// file tree. Both share the same expand/select state and the inspector panel.

const ROW = 34;
const PAD_X = 14;
const PAD_Y = 22;
const DURATION = 380;

type Pos = { x: number; y: number };
type Flat = { node: TreeNode; depth: number; parent: TreeNode | null; path: TreeNode[] };

const byId = new Map<string, Flat>();
(function index(n: TreeNode, depth: number, parent: TreeNode | null, path: TreeNode[]) {
  const p = [...path, n];
  byId.set(n.id, { node: n, depth, parent, path: p });
  n.children?.forEach((c) => index(c, depth + 1, n, p));
})(tree, 0, null, []);

const ALL_PARENTS = Array.from(byId.values())
  .filter((f) => f.node.children?.length)
  .map((f) => f.node.id);
const MAX_DEPTH = Math.max(...Array.from(byId.values()).map((f) => f.depth));
const DEFAULT_OPEN = ["root", "work", "propeers"];

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Visible nodes in pre-order, which is also the keyboard order. */
function visible(open: Set<string>): Flat[] {
  const out: Flat[] = [];
  const walk = (n: TreeNode) => {
    out.push(byId.get(n.id)!);
    if (open.has(n.id)) n.children?.forEach(walk);
  };
  walk(tree);
  return out;
}

/** Tidy left-to-right layout: leaves take consecutive rows, parents centre on their children. */
function layout(open: Set<string>, col: number): { pos: Record<string, Pos>; rows: number } {
  const pos: Record<string, Pos> = {};
  let row = 0;
  const place = (n: TreeNode, depth: number): number => {
    const kids = open.has(n.id) ? n.children ?? [] : [];
    let y: number;
    if (kids.length === 0) {
      y = row++ * ROW;
    } else {
      const ys = kids.map((k) => place(k, depth + 1));
      y = (ys[0] + ys[ys.length - 1]) / 2;
    }
    pos[n.id] = { x: PAD_X + depth * col, y: PAD_Y + y };
    return y;
  };
  place(tree, 0);
  return { pos, rows: row };
}

/** Eases every node from where it was drawn last to its new place. New nodes grow out of their parent. */
function useTween(target: Record<string, Pos>) {
  const [cur, setCur] = useState(target);
  const curRef = useRef(target);
  useEffect(() => {
    const from: Record<string, Pos> = {};
    for (const id of Object.keys(target)) {
      let anchor = curRef.current[id];
      if (!anchor) {
        let p = byId.get(id)!.parent;
        while (p && !curRef.current[p.id]) p = byId.get(p.id)!.parent;
        anchor = (p && curRef.current[p.id]) || target[id];
      }
      from[id] = anchor;
    }
    if (reducedMotion()) {
      curRef.current = target;
      setCur(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      const e = 1 - Math.pow(1 - t, 3);
      const next: Record<string, Pos> = {};
      for (const id of Object.keys(target)) {
        next[id] = {
          x: from[id].x + (target[id].x - from[id].x) * e,
          y: from[id].y + (target[id].y - from[id].y) * e,
        };
      }
      curRef.current = next;
      setCur(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return cur;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Edges leave a parent after its label, so they never cross the text. */
function edgePath(a: Pos, b: Pos, parent: TreeNode) {
  const root = parent.kind === "root";
  const x1 = a.x + (root ? 9 : 6) + 8 + parent.label.length * (root ? 9.1 : 7.85) + 8;
  const x2 = b.x - 6;
  const mx = (x1 + x2) / 2;
  return `M${x1},${a.y} C${mx},${a.y} ${mx},${b.y} ${x2},${b.y}`;
}

const count = (n: TreeNode): number => (n.children ?? []).reduce((s, c) => s + 1 + count(c), 0);
const TOTAL = count(tree) + 1;

export default function Tree() {
  // Starts folded to the root and unfolds the first time it scrolls into view.
  const [open, setOpen] = useState<Set<string>>(() => new Set(["root"]));
  const [sel, setSel] = useState("root");
  const [wrapRef, width] = useWidth<HTMLDivElement>();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        window.setTimeout(() => {
          setOpen(new Set(DEFAULT_OPEN));
          setSel("propeers");
        }, 250);
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [wrapRef]);
  const graph = width >= 560;
  const col = Math.max(120, Math.min(210, (width - 170) / MAX_DEPTH));

  const vis = useMemo(() => visible(open), [open]);
  const { pos: target, rows } = useMemo(() => layout(open, col), [open, col]);
  const pos = useTween(target);
  const selected = byId.get(sel)!;
  const onPath = new Set(selected.path.map((n) => n.id));
  const motion = !reducedMotion();

  const toggle = (id: string, force?: boolean) => {
    const want = force ?? !open.has(id);
    // Collapsing hides the subtree; keep the selection visible.
    if (!want && sel !== id && byId.get(sel)!.path.some((p) => p.id === id)) setSel(id);
    setOpen((o) => {
      const n = new Set(o);
      if (want) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const choose = (id: string) => {
    const has = !!byId.get(id)!.node.children?.length;
    if (id === sel) {
      if (has) toggle(id);
    } else {
      setSel(id);
      if (has) toggle(id, true);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    const i = vis.findIndex((f) => f.node.id === sel);
    const f = vis[i];
    const has = !!f.node.children?.length;
    let handled = true;
    if (e.key === "ArrowDown") setSel(vis[Math.min(i + 1, vis.length - 1)].node.id);
    else if (e.key === "ArrowUp") setSel(vis[Math.max(i - 1, 0)].node.id);
    else if (e.key === "ArrowRight") {
      if (has && !open.has(sel)) toggle(sel, true);
      else if (has) setSel(f.node.children![0].id);
    } else if (e.key === "ArrowLeft") {
      if (has && open.has(sel)) toggle(sel, false);
      else if (f.parent) setSel(f.parent.id);
    } else if (e.key === "Enter" || e.key === " ") {
      if (has) toggle(sel);
    } else if (e.key === "Home") setSel("root");
    else handled = false;
    if (handled) e.preventDefault();
  };

  const height = PAD_Y * 2 + Math.max(rows - 1, 0) * ROW;

  return (
    <div className="tree-wrap">
      <div className="tree-panel">
        <header className="tree-head mono">
          <span>
            <span className="tree-cmd">tree</span> ~/sriram <span className="muted hide-narrow">--interactive</span>
          </span>
          <span className="muted hide-narrow">
            {vis.length}/{TOTAL} nodes
          </span>
          <span className="tree-actions">
            <button onClick={() => setOpen(new Set(ALL_PARENTS))}>expand all</button>
            <button
              onClick={() => {
                setOpen(new Set(["root"]));
                setSel("root");
              }}
            >
              collapse
            </button>
          </span>
        </header>
        <div
          ref={wrapRef}
          className="tree-canvas"
          role="tree"
          aria-label="About Sriram, as a tree"
          aria-activedescendant={`tn-${sel}`}
          tabIndex={0}
          onKeyDown={onKey}
        >
          {width > 0 && graph && (
            <svg width={width} height={height} className="tree-svg">
              <defs>
                <filter id="tn-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="3" />
                </filter>
              </defs>
              {vis.map(({ node, parent }) => {
                if (!parent || !pos[node.id] || !pos[parent.id]) return null;
                const hot = onPath.has(node.id);
                const d = edgePath(pos[parent.id], pos[node.id], parent);
                return (
                  <g key={`e-${node.id}`} className={`tn-edge c-${node.color}${hot ? " hot" : ""}`}>
                    <path id={`ep-${node.id}`} d={d} />
                    {hot && motion && (
                      <circle r="2.6" className="tn-packet">
                        <animateMotion dur="1.6s" repeatCount="indefinite" begin={`${(selected.path.findIndex((p) => p.id === node.id) - 1) * 0.25}s`}>
                          <mpath href={`#ep-${node.id}`} />
                        </animateMotion>
                      </circle>
                    )}
                  </g>
                );
              })}
              {vis.map(({ node, depth }) => {
                const p = pos[node.id];
                if (!p) return null;
                const isSel = node.id === sel;
                const kids = node.children?.length ?? 0;
                const isOpen = open.has(node.id);
                const r = node.kind === "root" ? 9 : kids ? 6 : 4.5;
                return (
                  <g
                    key={node.id}
                    id={`tn-${node.id}`}
                    role="treeitem"
                    aria-level={depth + 1}
                    aria-selected={isSel}
                    aria-expanded={kids ? isOpen : undefined}
                    className={`tn c-${node.color}${isSel ? " sel" : ""}${onPath.has(node.id) ? " on" : ""}${node.kind === "root" ? " root" : ""}`}
                    transform={`translate(${p.x},${p.y})`}
                    onClick={() => choose(node.id)}
                  >
                    <rect className="tn-hit" x={-12} y={-ROW / 2} width={col - 8} height={ROW} />
                    {isSel && <circle r={r + 5} className="tn-halo" filter="url(#tn-glow)" />}
                    <circle r={r} className={"tn-dot" + (kids && !isOpen ? " closed" : "")} />
                    <text x={r + 8} dy="0.35em" className="tn-label">
                      {node.label}
                      {kids > 0 && !isOpen && <tspan className="tn-more"> +{kids}</tspan>}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
          {width > 0 && !graph && (
            <ul className="ftree mono">
              {vis.map(({ node, depth }) => {
                const kids = node.children?.length ?? 0;
                const isOpen = open.has(node.id);
                return (
                  <li
                    key={node.id}
                    id={`tn-${node.id}`}
                    role="treeitem"
                    aria-level={depth + 1}
                    aria-selected={node.id === sel}
                    aria-expanded={kids ? isOpen : undefined}
                    className={`c-${node.color}${node.id === sel ? " sel" : ""}`}
                    style={{ paddingLeft: depth * 18 + 10 }}
                    onClick={() => choose(node.id)}
                  >
                    <span className="ftree-caret" aria-hidden="true">
                      {kids ? (isOpen ? "▾" : "▸") : "·"}
                    </span>
                    <span className="ftree-dot" aria-hidden="true" />
                    {node.label}
                    {kids > 0 && !isOpen && <span className="muted"> +{kids}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="tree-foot mono muted">
          {graph ? "click a node, or focus the tree and use" : "tap to open a branch, or use"} <kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd>
        </footer>
      </div>

      <Inspector flat={selected} onPick={choose} />
    </div>
  );
}

function Inspector({ flat, onPick }: { flat: Flat; onPick: (id: string) => void }) {
  const { node, path } = flat;
  return (
    <aside className={`inspector c-${node.color}`} aria-live="polite">
      <header className="insp-head mono">
        <span className="insp-crumbs">
          {path.map((p, i) => (
            <span key={p.id}>
              {i > 0 && <span className="muted"> / </span>}
              {i < path.length - 1 ? (
                <button onClick={() => onPick(p.id)}>{p.label.replace(/\/$/, "")}</button>
              ) : (
                <b>{p.label.replace(/\/$/, "")}</b>
              )}
            </span>
          ))}
        </span>
        <span className="insp-kind">{node.kind}</span>
      </header>
      <div className="insp-body" key={node.id}>
        <h3>{node.title}</h3>
        {node.detail && <p>{node.detail}</p>}
        {node.meta && node.meta.length > 0 && (
          <pre className="insp-json mono">
            <span className="j-p">{"{"}</span>
            {node.meta.map(([k, v], i) => (
              <span key={k} className="j-row">
                {"  "}
                <span className="j-k">"{k}"</span>
                <span className="j-p">: </span>
                <span className="j-v">"{v}"</span>
                {i < node.meta!.length - 1 && <span className="j-p">,</span>}
              </span>
            ))}
            <span className="j-p">{"}"}</span>
          </pre>
        )}
        {node.children && node.children.length > 0 && (
          <div className="insp-kids">
            <span className="mono muted">children</span>
            <div>
              {node.children.map((c) => (
                <button key={c.id} className={`mono c-${c.color}`} onClick={() => onPick(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {node.links && node.links.length > 0 && (
          <div className="insp-links">
            {node.links.map((l) =>
              l.internal ? (
                <Link key={l.href} href={l.href}>
                  {l.label} →
                </Link>
              ) : (
                <a key={l.href} href={l.href} target={l.href.startsWith("mailto:") ? undefined : "_blank"} rel="noreferrer">
                  {l.label} ↗
                </a>
              )
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
