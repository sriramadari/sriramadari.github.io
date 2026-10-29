import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  conformanceCheck,
  createTestClient,
  expectToolResult,
  mockServer,
  type ConformanceReport,
  type MockToolSpec,
  type TestClient,
  type ToolResult,
} from "@sriramadari/mcp-devkit";
import { Badge, Code, Panel, Toggle } from "../ui";

type ParamType = "string" | "number" | "boolean";
type Param = { name: string; type: ParamType; required: boolean };
type ToolDraft = { id: number; name: string; description: string; params: Param[]; reply: string; fails: boolean };
type Frame = { n: number; dir: "→ server" | "← server"; summary: string; body: unknown };

let nextId = 1;
const tool = (t: Omit<ToolDraft, "id">): ToolDraft => ({ ...t, id: nextId++ });

const PRESETS: Record<string, { label: string; server: string; tools: () => ToolDraft[] }> = {
  clean: {
    label: "Well-behaved weather server",
    server: "weather",
    tools: () => [
      tool({
        name: "get_forecast",
        description: "Get the forecast for a city for the next N days",
        params: [
          { name: "city", type: "string", required: true },
          { name: "days", type: "number", required: true },
        ],
        reply: "Forecast for {{city}}: sunny for {{days}} day(s)",
        fails: false,
      }),
      tool({
        name: "get_alerts",
        description: "List active severe-weather alerts for a region",
        params: [{ name: "region", type: "string", required: true }],
        reply: "No active alerts in {{region}}",
        fails: false,
      }),
    ],
  },
  sloppy: {
    label: "Sloppy server (fails checks)",
    server: "",
    tools: () => [
      tool({
        name: "get weather",
        description: "Weather",
        params: [{ name: "city", type: "string", required: true }],
        reply: "It is raining in {{city}}",
        fails: false,
      }),
      tool({ name: "search", description: "", params: [{ name: "q", type: "string", required: false }], reply: "0 results for {{q}}", fails: false }),
      tool({
        name: "charge_card",
        description: "Charge a customer's saved card",
        params: [{ name: "amount", type: "number", required: true }],
        reply: "Payment gateway timed out",
        fails: true,
      }),
    ],
  },
};

const ZOD: Record<ParamType, () => z.ZodTypeAny> = { string: () => z.string(), number: () => z.number(), boolean: () => z.boolean() };

function toSpec(t: ToolDraft): MockToolSpec {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of t.params) if (p.name.trim()) shape[p.name.trim()] = p.required ? ZOD[p.type]() : ZOD[p.type]().optional();
  return {
    name: t.name,
    description: t.description || undefined,
    inputSchema: t.params.length ? shape : undefined,
    handler: (args) => {
      const text = t.reply.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => String(args[k] ?? ""));
      return t.fails ? { content: [{ type: "text", text }], isError: true } : text;
    },
  };
}

function sampleArgs(t: ToolDraft): string {
  const sample: Record<ParamType, unknown> = { string: "Paris", number: 3, boolean: true };
  const args: Record<string, unknown> = {};
  for (const p of t.params) if (p.name.trim()) args[p.name.trim()] = sample[p.type];
  return JSON.stringify(args, null, 2);
}

function summarize(msg: any): string {
  if (msg?.method) return msg.method + (msg.id !== undefined ? ` #${msg.id}` : " (notification)");
  if (msg?.error) return `error #${msg.id}: ${msg.error.message}`;
  if (msg?.result) return `result #${msg.id}` + (msg.result.isError ? " (isError)" : "");
  return "message";
}

export default function McpDemo() {
  const [serverName, setServerName] = useState(PRESETS.clean.server);
  const [tools, setTools] = useState<ToolDraft[]>(PRESETS.clean.tools);
  const [client, setClient] = useState<TestClient | null>(null);
  const [buildError, setBuildError] = useState("");
  const [report, setReport] = useState<ConformanceReport | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const frameN = useRef(0);

  // Rebuild the server and reconnect whenever the definition settles.
  useEffect(() => {
    let cancelled = false;
    let opened: TestClient | null = null;
    const timer = window.setTimeout(async () => {
      frameN.current = 0;
      setFrames([]);
      setReport(null);
      try {
        // A blank name is passed through as-is, so the identity check has something to catch.
        const server = mockServer({ name: serverName, version: serverName ? "1.0.0" : "", tools: tools.map(toSpec) });
        tapServer(server, (dir, body) => {
          if (cancelled) return;
          const n = ++frameN.current;
          setFrames((f) => [...f.slice(-79), { n, dir, summary: summarize(body), body }]);
        });
        opened = await createTestClient({ server });
        if (cancelled) return void opened.close();
        setBuildError("");
        setClient(opened);
        setReport(await conformanceCheck(opened));
      } catch (e) {
        if (!cancelled) {
          setClient(null);
          setBuildError((e as Error).message);
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      opened?.close();
    };
  }, [serverName, tools]);

  const update = (id: number, patch: Partial<ToolDraft>) => setTools((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const loadPreset = (key: string) => {
    setServerName(PRESETS[key].server);
    setTools(PRESETS[key].tools());
  };

  return (
    <div className="demo-grid">
      <Panel
        title="1. Define the server"
        aside={
          <select aria-label="Load a preset" onChange={(e) => e.target.value && loadPreset(e.target.value)} value="">
            <option value="">Load preset…</option>
            {Object.entries(PRESETS).map(([k, p]) => (
              <option key={k} value={k}>
                {p.label}
              </option>
            ))}
          </select>
        }
      >
        <label className="field">
          <span>Server name (blank to fail the identity check)</span>
          <input className="mono" value={serverName} onChange={(e) => setServerName(e.target.value)} placeholder="(none)" />
        </label>
        <ol className="tool-list">
          {tools.map((t) => (
            <ToolEditor key={t.id} t={t} onChange={(p) => update(t.id, p)} onRemove={() => setTools((ts) => ts.filter((x) => x.id !== t.id))} />
          ))}
        </ol>
        <button
          className="ghost"
          onClick={() =>
            setTools((ts) => [
              ...ts,
              tool({ name: `tool_${ts.length + 1}`, description: "", params: [], reply: "ok", fails: false }),
            ])
          }
        >
          + Add tool
        </button>
        <p className="hint muted">
          Edits rebuild the server with <code>mockServer()</code> and reconnect with <code>createTestClient()</code>.
        </p>
      </Panel>

      <Panel
        title="2. Conformance"
        aside={report && <Badge tone={report.ok ? "good" : "bad"}>{report.ok ? "ok" : "failing"}</Badge>}
      >
        {buildError && (
          <p className="error-box mono">
            mockServer() threw: {buildError}
          </p>
        )}
        {!report && !buildError && <p className="muted">Connecting…</p>}
        {report && <ConformanceView report={report} />}
      </Panel>

      <Panel title="3. Call a tool" className="span-2">
        {client ? <CallPlayground client={client} tools={tools} /> : <p className="muted">Waiting for a server.</p>}
      </Panel>

      <Panel title="JSON-RPC on the wire" aside={<span className="mono muted">{frames.length} frames</span>} className="span-2">
        <WireLog frames={frames} />
      </Panel>

      <Panel title="The same thing in your test suite" className="span-2">
        <Code label="server.test.ts">{testSnippet(serverName, tools)}</Code>
      </Panel>
    </div>
  );
}

/** Log every JSON-RPC message crossing the server's in-memory transport. */
function tapServer(server: ReturnType<typeof mockServer>, log: (dir: Frame["dir"], body: unknown) => void) {
  const connect = server.connect.bind(server);
  server.connect = async (transport) => {
    const send = transport.send.bind(transport);
    transport.send = (message, options) => {
      log("← server", message);
      return send(message, options);
    };
    await connect(transport);
    const onmessage = transport.onmessage;
    transport.onmessage = (message, extra) => {
      log("→ server", message);
      onmessage?.(message, extra);
    };
  };
}

function ToolEditor({ t, onChange, onRemove }: { t: ToolDraft; onChange: (p: Partial<ToolDraft>) => void; onRemove: () => void }) {
  const setParam = (i: number, p: Partial<Param>) => onChange({ params: t.params.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <li className="tool-card">
      <div className="row">
        <input className="mono grow" aria-label="Tool name" value={t.name} onChange={(e) => onChange({ name: e.target.value })} />
        <button className="icon-btn" onClick={onRemove} aria-label={`Remove ${t.name}`}>
          ×
        </button>
      </div>
      <input
        aria-label="Tool description"
        placeholder="Description (an LLM reads this to pick the tool)"
        value={t.description}
        onChange={(e) => onChange({ description: e.target.value })}
      />
      <div className="params">
        {t.params.map((p, i) => (
          <div className="row param" key={i}>
            <input className="mono grow" aria-label="Argument name" value={p.name} onChange={(e) => setParam(i, { name: e.target.value })} />
            <select aria-label="Argument type" value={p.type} onChange={(e) => setParam(i, { type: e.target.value as ParamType })}>
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
            </select>
            <label className="check">
              <input type="checkbox" checked={p.required} onChange={(e) => setParam(i, { required: e.target.checked })} />
              required
            </label>
            <button className="icon-btn" aria-label="Remove argument" onClick={() => onChange({ params: t.params.filter((_, j) => j !== i) })}>
              ×
            </button>
          </div>
        ))}
        <button className="link-btn" onClick={() => onChange({ params: [...t.params, { name: `arg${t.params.length + 1}`, type: "string", required: true }] })}>
          + argument
        </button>
      </div>
      <div className="row">
        <input
          className="mono grow"
          aria-label="Reply template"
          value={t.reply}
          onChange={(e) => onChange({ reply: e.target.value })}
          title="Reply text. {{arg}} inserts an argument."
        />
        <label className="check">
          <input type="checkbox" checked={t.fails} onChange={(e) => onChange({ fails: e.target.checked })} />
          returns isError
        </label>
      </div>
    </li>
  );
}

function ConformanceView({ report }: { report: ConformanceReport }) {
  const tone = (c: ConformanceReport["checks"][number]) =>
    c.status === "pass" ? "good" : c.status === "skip" ? "muted" : c.severity === "error" ? "bad" : c.severity === "warning" ? "warn" : "info";
  return (
    <>
      <p className="mono muted small">
        {report.summary.passed} passed · {report.summary.failed} failed · {report.summary.warnings} warnings
      </p>
      <ul className="checks">
        {report.checks.map((c) => (
          <li key={c.id}>
            <Badge tone={tone(c)}>{c.status === "pass" ? "pass" : c.status === "skip" ? "skip" : c.severity}</Badge>
            <div>
              <span>{c.title}</span>
              {c.status !== "pass" && c.detail && <span className="muted small d-block">{c.detail}</span>}
              {c.status === "pass" && c.detail && <span className="muted small">{c.detail}</span>}
              {c.findings && c.findings.length > 0 && <span className="mono small d-block finding">{c.findings.join(", ")}</span>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

type Outcome =
  | { kind: "result"; result: ToolResult; assertions: Array<{ label: string; ok: boolean; message?: string }> }
  | { kind: "error"; message: string };

function CallPlayground({ client, tools }: { client: TestClient; tools: ToolDraft[] }) {
  const names = tools.map((t) => t.name);
  const [name, setName] = useState(names[0] ?? "");
  const current = tools.find((t) => t.name === name) ?? tools[0];
  const [args, setArgs] = useState(() => (current ? sampleArgs(current) : "{}"));
  const [validate, setValidate] = useState(true);
  const [expectText, setExpectText] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!names.includes(name) && names[0]) setName(names[0]);
  }, [names.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (n: string) => {
    setName(n);
    const t = tools.find((x) => x.name === n);
    if (t) setArgs(sampleArgs(t));
    setOutcome(null);
  };

  const call = useCallback(async () => {
    setBusy(true);
    try {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(args || "{}");
      } catch (e) {
        setOutcome({ kind: "error", message: "Arguments are not valid JSON: " + (e as Error).message });
        return;
      }
      const result = await client.call(name, parsed, { validate });
      const assertions: Array<{ label: string; ok: boolean; message?: string }> = [];
      const run = (label: string, fn: () => unknown) => {
        try {
          fn();
          assertions.push({ label, ok: true });
        } catch (e) {
          assertions.push({ label, ok: false, message: (e as Error).message.split("\n")[0] });
        }
      };
      run(".toSucceed()", () => expectToolResult(result).toSucceed());
      if (expectText.trim()) run(`.toHaveText(${JSON.stringify(expectText)})`, () => expectToolResult(result).toHaveText(expectText));
      setOutcome({ kind: "result", result, assertions });
    } catch (e) {
      setOutcome({ kind: "error", message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, [client, name, args, validate, expectText]);

  return (
    <div className="call-grid">
      <div className="stack-sm">
        <label className="field">
          <span>Tool</span>
          <select value={name} onChange={(e) => pick(e.target.value)}>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Arguments (JSON). Try a string where a number goes.</span>
          <textarea className="mono" rows={5} value={args} onChange={(e) => setArgs(e.target.value)} spellCheck={false} />
        </label>
        <label className="field">
          <span>Expect the text to contain (optional)</span>
          <input className="mono" value={expectText} onChange={(e) => setExpectText(e.target.value)} placeholder="sunny" />
        </label>
        <Toggle label="Validate args against inputSchema before sending" checked={validate} onChange={setValidate} />
        <button className="btn" onClick={call} disabled={busy || !name}>
          {busy ? "Calling…" : `client.call("${name}")`}
        </button>
      </div>
      <div className="stack-sm">
        {!outcome && <p className="muted">The result and the assertion outcomes show up here.</p>}
        {outcome?.kind === "error" && (
          <>
            <Badge tone="bad">threw before or during the call</Badge>
            <pre className="error-box mono">{outcome.message}</pre>
            {validate && outcome.message.includes("inputSchema") && (
              <p className="muted small">
                Caught on the client, so the server never saw the bad call. Turn validation off to see how the server handles it.
              </p>
            )}
          </>
        )}
        {outcome?.kind === "result" && (
          <>
            <ul className="checks">
              {outcome.assertions.map((a) => (
                <li key={a.label}>
                  <Badge tone={a.ok ? "good" : "bad"}>{a.ok ? "pass" : "fail"}</Badge>
                  <div>
                    <span className="mono">expectToolResult(res){a.label}</span>
                    {a.message && <span className="muted small d-block">{a.message}</span>}
                  </div>
                </li>
              ))}
            </ul>
            <Code label="result">{JSON.stringify(outcome.result, null, 2)}</Code>
          </>
        )}
      </div>
    </div>
  );
}

function WireLog({ frames }: { frames: Frame[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = end.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [frames.length]);
  if (!frames.length) return <p className="muted">No traffic yet.</p>;
  return (
    <div className="wire">
      {frames.map((f) => (
        <div key={f.n} className={"frame " + (f.dir === "→ server" ? "in" : "out")}>
          <button onClick={() => setOpen(open === f.n ? null : f.n)} aria-expanded={open === f.n}>
            <span className="mono muted">{String(f.n).padStart(2, "0")}</span>
            <span className="mono dir">{f.dir}</span>
            <span className="mono">{f.summary}</span>
          </button>
          {open === f.n && <pre className="mono">{JSON.stringify(f.body, null, 2)}</pre>}
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

function testSnippet(serverName: string, tools: ToolDraft[]): string {
  const first = tools[0];
  const zodType: Record<ParamType, string> = { string: "z.string()", number: "z.number()", boolean: "z.boolean()" };
  const toolSrc = tools
    .map((t) => {
      const shape = t.params.map((p) => `${p.name}: ${zodType[p.type]}${p.required ? "" : ".optional()"}`).join(", ");
      return `    {\n      name: ${JSON.stringify(t.name)},\n${t.description ? `      description: ${JSON.stringify(t.description)},\n` : ""}${
        shape ? `      inputSchema: { ${shape} },\n` : ""
      }      handler: (args) => ${JSON.stringify(t.reply)},\n    }`;
    })
    .join(",\n");
  return `import { z } from "zod";
import { createTestClient, conformanceCheck, expectToolResult, mockServer } from "@sriramadari/mcp-devkit";

const server = mockServer({
  name: ${JSON.stringify(serverName || "my-server")},
  version: "1.0.0",
  tools: [
${toolSrc}
  ],
});

const client = await createTestClient({ server }); // or { command: "node", args: ["dist/server.js"] }
${
  first
    ? `expectToolResult(await client.call(${JSON.stringify(first.name)}, ${sampleArgs(first).replace(/\s+/g, " ")})).toSucceed();\n`
    : ""
}expect((await conformanceCheck(client)).ok).toBe(true);
await client.close();`;
}

