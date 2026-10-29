import { useEffect, useState } from "react";
import {
  assertUniqueNames,
  discoverQueueFolders,
  renderProcessor,
  resolveDefaults,
  resolveQueueSettings,
  toKebabCase,
  toQueueDefinition,
  type CodeStyle,
  type DirEntry,
  type QueueSettings,
} from "bullmq-autoqueue/core";
import { Badge, Code, Panel, Segmented, Toggle } from "../ui";

type Backoff = { type: "fixed" | "exponential"; delay: number };
type Cfg = { name?: string; concurrency?: number; attempts?: number; backoff?: Backoff };
type FileNode = { type: "processor"; exportsFunction: boolean } | { type: "config"; config: Cfg } | { type: "file" };
type Dir = { type: "dir"; children: Record<string, Node> };
type Node = Dir | FileNode;

const dir = (children: Record<string, Node> = {}): Dir => ({ type: "dir", children });
const proc = (): FileNode => ({ type: "processor", exportsFunction: true });

const initialTree = (): Dir =>
  dir({
    sendNotificationFollowers: dir({ "processor.js": proc() }),
    reelUpload: dir({ "processor.js": proc(), helpers: dir({ "processor.js": proc(), "ffmpeg.js": { type: "file" } }) }),
    emailQueues: dir({
      otpEmail: dir({
        "processor.js": proc(),
        "config.js": { type: "config", config: { name: "otp-emails", concurrency: 20, attempts: 2, backoff: { type: "fixed", delay: 1500 } } },
      }),
      welcomeEmail: dir({ "processor.js": proc() }),
    }),
    node_modules: dir({ somePkg: dir({ "processor.js": proc() }) }),
  });

const ROOT = "queues";

function at(tree: Dir, path: string): Node | undefined {
  let node: Node | undefined = tree;
  for (const part of path.split("/").slice(1)) node = node?.type === "dir" ? node.children[part] : undefined;
  return node;
}

function update(tree: Dir, path: string, fn: (node: Node | undefined) => Node | undefined): Dir {
  const parts = path.split("/").slice(1);
  const rec = (d: Dir, i: number): Dir => {
    const name = parts[i];
    const child = d.children[name];
    const next = i === parts.length - 1 ? fn(child) : child?.type === "dir" ? rec(child, i + 1) : child;
    const children = { ...d.children };
    if (next === undefined) delete children[name];
    else children[name] = next;
    return { type: "dir", children };
  };
  return rec(tree, 0);
}

type Row = QueueSettings & { folder: string; configFile: string | null; overrides: string[] };
type Plan = { rows: Row[]; queueDirs: Set<string>; error: string };

async function plan(tree: Dir, defaults: Parameters<typeof resolveDefaults>[0]): Promise<Plan> {
  const listDir = (p: string): DirEntry[] => {
    const node = at(tree, p);
    if (node?.type !== "dir") return [];
    return Object.entries(node.children).map(([name, n]) => ({ name, isDirectory: n.type === "dir" }));
  };
  const found = await discoverQueueFolders(ROOT, listDir);
  const queueDirs = new Set(found.map((f) => f.dir));
  try {
    const resolved = resolveDefaults(defaults);
    const defs = found.map((f) => {
      const p = at(tree, f.processorFile) as FileNode;
      const processor = p.type === "processor" && p.exportsFunction ? async () => ({ ok: true }) : { not: "a function" };
      const cfgNode = f.configFile ? (at(tree, f.configFile) as FileNode) : undefined;
      const config = cfgNode?.type === "config" ? toConfig(cfgNode.config) : undefined;
      return { def: toQueueDefinition(f, processor, config, toKebabCase), found: f, config: cfgNode?.type === "config" ? cfgNode.config : undefined };
    });
    assertUniqueNames(defs.map((d) => d.def));
    const rows = defs.map(({ def, found: f, config }) => ({
      ...resolveQueueSettings(def, resolved),
      folder: f.dir,
      configFile: f.configFile,
      overrides: config ? Object.keys(config).filter((k) => config[k as keyof Cfg] !== undefined) : [],
    }));
    return { rows, queueDirs, error: "" };
  } catch (e) {
    return { rows: [], queueDirs, error: (e as Error).message };
  }
}

/** The object a config.js would default-export. */
function toConfig(c: Cfg) {
  const out: Record<string, unknown> = {};
  if (c.name) out.name = c.name;
  if (c.concurrency !== undefined) out.concurrency = c.concurrency;
  if (c.attempts !== undefined || c.backoff) {
    out.defaultJobOptions = { ...(c.attempts !== undefined ? { attempts: c.attempts } : {}), ...(c.backoff ? { backoff: c.backoff } : {}) };
  }
  return out;
}

function configSource(c: Cfg, style: CodeStyle): string {
  const body = JSON.stringify(toConfig(c), null, 2).replace(/"(\w+)":/g, "$1:");
  if (style === "ts") return `import { defineConfig } from "bullmq-autoqueue";\n\nexport default defineConfig(${body});\n`;
  if (style === "esm") return `export default ${body};\n`;
  return `module.exports = ${body};\n`;
}

export default function AutoqueueDemo() {
  const [tree, setTree] = useState<Dir>(initialTree);
  const [style, setStyle] = useState<CodeStyle>("esm");
  const [defaults, setDefaults] = useState({ concurrency: 1, attempts: 3, backoff: { type: "exponential" as const, delay: 1000 } });
  const [result, setResult] = useState<Plan>({ rows: [], queueDirs: new Set(), error: "" });
  const [selected, setSelected] = useState(`${ROOT}/emailQueues/otpEmail/config.js`);

  useEffect(() => {
    let live = true;
    plan(tree, {
      concurrency: defaults.concurrency,
      defaultJobOptions: { attempts: defaults.attempts, backoff: defaults.backoff, removeOnComplete: 1000 },
    }).then((p) => live && setResult(p));
    return () => {
      live = false;
    };
  }, [tree, defaults]);

  const ext = style === "ts" ? ".ts" : ".js";

  return (
    <div className="demo-grid">
      <Panel title="queues/" aside={<Segmented label="Code style" value={style} onChange={setStyle} options={[{ value: "cjs", label: "cjs" }, { value: "esm", label: "esm" }, { value: "ts", label: "ts" }]} />}>
        <Generator tree={tree} ext={ext} onCreate={(t, path) => (setTree(t), setSelected(path))} />
        <TreeView tree={tree} queueDirs={result.queueDirs} selected={selected} onSelect={setSelected} onChange={setTree} ext={ext} />
      </Panel>

      <Panel title="What loadQueues() registers" aside={result.error ? <Badge tone="bad">throws</Badge> : <Badge tone="good">{result.rows.length} queues</Badge>}>
        {result.error ? (
          <pre className="error-box mono small">{result.error}</pre>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>queue</th>
                <th>concurrency</th>
                <th>attempts</th>
                <th>backoff</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => {
                const o = (k: string) => (r.overrides.includes(k) ? "override" : "");
                const b = r.defaultJobOptions.backoff as Backoff | undefined;
                return (
                  <tr key={r.name} className="clickable" onClick={() => setSelected(r.configFile ?? `${r.folder}/processor${ext}`)}>
                    <td>
                      <span className="mono">{r.name}</span>
                      <span className="muted small d-block mono">{r.folder.slice(ROOT.length + 1)}/</span>
                    </td>
                    <td className={"mono " + o("concurrency")}>{r.concurrency}</td>
                    <td className={"mono " + o("attempts")}>{String(r.defaultJobOptions.attempts ?? "—")}</td>
                    <td className={"mono small " + o("backoff")}>{b ? `${b.type} ${b.delay}ms` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="hint muted">
          <span className="override-key">Highlighted</span> values come from the folder's config file; the rest from <code>defaults</code>. Folders with a processor
          become queues and are not searched further, so <code>reelUpload/helpers</code> stays private. <code>node_modules</code> and dot-folders are skipped.
        </p>
        <DefaultsEditor value={defaults} onChange={setDefaults} />
      </Panel>

      <Panel title={selected.slice(ROOT.length + 1)} className="span-2">
        <FilePreview tree={tree} path={selected} style={style} rows={result.rows} onChange={setTree} />
      </Panel>

      <Panel title="In your app" className="span-2">
        <Code label="server.ts">{`import express from "express";
import { loadQueues, installGracefulShutdown } from "bullmq-autoqueue";

const registry = await loadQueues({
  dir: "./queues",
  connection: { host: "127.0.0.1", port: 6379 },
  defaults: {
    concurrency: ${defaults.concurrency},
    defaultJobOptions: { attempts: ${defaults.attempts}, backoff: ${JSON.stringify(defaults.backoff).replace(/"(\w+)":/g, "$1: ")} },
  },
  board: { basePath: "/admin/queues" },
});

const app = express();
app.use(registry.bullBoardBasePath, registry.bullBoardRouter); // one dashboard, every queue
${result.rows[0] ? `await registry.add(${JSON.stringify(result.rows[0].name)}, "job", { /* data */ });\n` : ""}installGracefulShutdown(registry);`}</Code>
      </Panel>
    </div>
  );
}

function Generator({ tree, ext, onCreate }: { tree: Dir; ext: string; onCreate: (t: Dir, selectPath: string) => void }) {
  const [name, setName] = useState("send welcome SMS");
  const [withConfig, setWithConfig] = useState(true);
  const [msg, setMsg] = useState("");
  const queueName = toKebabCase(name).replace(/^-+|-+$/g, "");

  const run = () => {
    if (!queueName) return setMsg(`bullmq-autoqueue: invalid queue name "${name}"`);
    const folder = `${ROOT}/${queueName}`;
    if (at(tree, `${folder}/processor${ext}`)) return setMsg(`bullmq-autoqueue: ${folder}/processor${ext} already exists (use --force to overwrite)`);
    let t = update(tree, folder, (n) => (n?.type === "dir" ? n : dir()));
    t = update(t, `${folder}/processor${ext}`, () => proc());
    if (withConfig) {
      t = update(t, `${folder}/config${ext}`, () => ({ type: "config", config: { concurrency: 5, attempts: 3, backoff: { type: "exponential", delay: 1000 } } }));
    }
    setMsg(`✓ created ${folder}/processor${ext}${withConfig ? ` and config${ext}` : ""}`);
    onCreate(t, `${folder}/processor${ext}`);
  };

  return (
    <div className="terminal">
      <div className="terminal-line mono">
        <span className="muted">$ npx bullmq-auto --generate</span>
        <input aria-label="New queue name" className="mono" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} />
        {withConfig && <span className="muted">--config</span>}
      </div>
      <div className="row wrap">
        <Toggle label="with a config file" checked={withConfig} onChange={setWithConfig} />
        <button className="ghost" onClick={run}>
          Run
        </button>
        <span className="mono small muted">→ queues/{queueName || "?"}/</span>
      </div>
      {msg && <p className={"mono small " + (msg.startsWith("✓") ? "good" : "bad")}>{msg}</p>}
    </div>
  );
}

function TreeView({
  tree,
  queueDirs,
  selected,
  onSelect,
  onChange,
  ext,
}: {
  tree: Dir;
  queueDirs: Set<string>;
  selected: string;
  onSelect: (p: string) => void;
  onChange: (t: Dir) => void;
  ext: string;
}) {
  const [newGroup, setNewGroup] = useState("");

  const render = (node: Dir, path: string, depth: number, inside: "group" | "queue" | "ignored"): React.ReactNode =>
    Object.entries(node.children)
      .sort(([a, x], [b, y]) => (x.type === "dir" ? 0 : 1) - (y.type === "dir" ? 0 : 1) || a.localeCompare(b))
      .map(([name, child]) => {
        const p = `${path}/${name}`;
        if (child.type === "dir") {
          const has = (base: string) => Object.keys(child.children).some((n) => n.startsWith(base + "."));
          const kind = inside !== "group" || name.startsWith(".") || name === "node_modules" ? "ignored" : queueDirs.has(p) ? "queue" : "group";
          return (
            <li key={p}>
              <div className={"tree-row dir " + kind} style={{ paddingLeft: depth * 16 }}>
                <span className="mono">{name}/</span>
                <span className="tree-tag small">{kind === "queue" ? "queue" : kind === "ignored" ? (inside === "queue" ? "private" : "skipped") : ""}</span>
                <span className="tree-actions">
                  {!has("processor") && kind !== "ignored" && (
                    <button className="link-btn" onClick={() => onChange(update(tree, `${p}/processor${ext}`, () => proc()))}>
                      + processor
                    </button>
                  )}
                  {has("processor") && !has("config") && kind !== "ignored" && (
                    <button className="link-btn" onClick={() => onChange(update(tree, `${p}/config${ext}`, () => ({ type: "config", config: {} })))}>
                      + config
                    </button>
                  )}
                  <button className="icon-btn" aria-label={`Delete ${name}`} onClick={() => onChange(update(tree, p, () => undefined))}>
                    ×
                  </button>
                </span>
              </div>
              <ul>{render(child, p, depth + 1, kind === "queue" ? "queue" : kind)}</ul>
            </li>
          );
        }
        return (
          <li key={p}>
            <div className={"tree-row file" + (selected === p ? " on" : "")} style={{ paddingLeft: depth * 16 }}>
              <button className="mono file-btn" onClick={() => onSelect(p)}>
                {name}
              </button>
              {child.type === "processor" && !child.exportsFunction && <span className="tree-tag bad small">not a function</span>}
              <span className="tree-actions">
                <button className="icon-btn" aria-label={`Delete ${name}`} onClick={() => onChange(update(tree, p, () => undefined))}>
                  ×
                </button>
              </span>
            </div>
          </li>
        );
      });

  return (
    <>
      <ul className="tree">
        <li>
          <div className="tree-row dir">
            <span className="mono">queues/</span>
          </div>
          <ul>{render(tree, ROOT, 1, "group")}</ul>
        </li>
      </ul>
      <div className="row">
        <input className="mono grow" placeholder="newGroupFolder" value={newGroup} onChange={(e) => setNewGroup(e.target.value.replace(/[/\s]/g, ""))} aria-label="New folder name" />
        <button
          className="ghost"
          disabled={!newGroup}
          onClick={() => {
            onChange(update(tree, `${ROOT}/${newGroup}`, (n) => n ?? dir()));
            setNewGroup("");
          }}
        >
          + folder
        </button>
      </div>
    </>
  );
}

function FilePreview({ tree, path, style, rows, onChange }: { tree: Dir; path: string; style: CodeStyle; rows: Row[]; onChange: (t: Dir) => void }) {
  const node = at(tree, path);
  if (!node || node.type === "dir") return <p className="muted">Pick a file in the tree.</p>;
  const folder = path.slice(0, path.lastIndexOf("/"));
  const row = rows.find((r) => r.folder === folder);
  const queueName = row?.name ?? toKebabCase(folder.split("/").pop() ?? "");

  if (node.type === "processor") {
    return (
      <div className="stack-sm">
        <Toggle
          label="Default-exports a processor function"
          checked={node.exportsFunction}
          onChange={(v) => onChange(update(tree, path, () => ({ type: "processor", exportsFunction: v })))}
        />
        <Code label={`what bullmq-auto --generate writes (${style})`}>
          {node.exportsFunction ? renderProcessor(queueName, style) : `${style === "cjs" ? "module.exports =" : "export default"} { handler: "oops, an object" };\n`}
        </Code>
      </div>
    );
  }
  if (node.type === "file") return <p className="muted">A helper file. The loader ignores anything that isn't processor.* or config.*.</p>;

  const c = node.config;
  const set = (p: Partial<Cfg>) => onChange(update(tree, path, () => ({ type: "config", config: { ...c, ...p } })));
  const num = (v: string) => (v === "" ? undefined : Number(v));
  return (
    <div className="config-grid">
      <div className="stack-sm">
        <label className="field">
          <span>name (overrides "{toKebabCase(folder.split("/").pop() ?? "")}")</span>
          <input className="mono" value={c.name ?? ""} placeholder="(from folder)" onChange={(e) => set({ name: e.target.value || undefined })} />
        </label>
        <label className="field">
          <span>concurrency</span>
          <input type="number" min={1} value={c.concurrency ?? ""} placeholder="(default)" onChange={(e) => set({ concurrency: num(e.target.value) })} />
        </label>
        <label className="field">
          <span>defaultJobOptions.attempts</span>
          <input type="number" min={1} value={c.attempts ?? ""} placeholder="(default)" onChange={(e) => set({ attempts: num(e.target.value) })} />
        </label>
        <div className="row">
          <label className="field grow">
            <span>backoff</span>
            <select
              value={c.backoff?.type ?? ""}
              onChange={(e) => set({ backoff: e.target.value ? { type: e.target.value as Backoff["type"], delay: c.backoff?.delay ?? 1000 } : undefined })}
            >
              <option value="">(default)</option>
              <option value="fixed">fixed</option>
              <option value="exponential">exponential</option>
            </select>
          </label>
          {c.backoff && (
            <label className="field">
              <span>delay ms</span>
              <input type="number" min={0} step={100} value={c.backoff.delay} onChange={(e) => set({ backoff: { ...c.backoff!, delay: Number(e.target.value) } })} />
            </label>
          )}
        </div>
        <p className="hint muted">Set two configs to the same name to see the duplicate check fire.</p>
      </div>
      <Code label={path.split("/").pop()}>{configSource(c, style)}</Code>
    </div>
  );
}

function DefaultsEditor({
  value,
  onChange,
}: {
  value: { concurrency: number; attempts: number; backoff: { type: "exponential"; delay: number } };
  onChange: (v: typeof value) => void;
}) {
  return (
    <div className="threshold-row">
      <span className="mono small muted">defaults:</span>
      <label className="field inline">
        <span className="mono small">concurrency</span>
        <input type="number" min={1} value={value.concurrency} onChange={(e) => onChange({ ...value, concurrency: Number(e.target.value) || 1 })} />
      </label>
      <label className="field inline">
        <span className="mono small">attempts</span>
        <input type="number" min={1} value={value.attempts} onChange={(e) => onChange({ ...value, attempts: Number(e.target.value) || 1 })} />
      </label>
      <label className="field inline">
        <span className="mono small">backoff ms</span>
        <input type="number" min={0} step={100} value={value.backoff.delay} onChange={(e) => onChange({ ...value, backoff: { ...value.backoff, delay: Number(e.target.value) } })} />
      </label>
    </div>
  );
}
