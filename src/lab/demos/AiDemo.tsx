import { useMemo, useRef, useState } from "react";
import {
  AIError,
  createAI,
  createPromptManager,
  DEFAULT_PRICING,
  memoryCache,
  Tracer,
  type AIClient,
  type ChatResponse,
  type FetchImpl,
  type Provider,
  type TracerStats,
} from "ai-observer";
import { Badge, Code, Panel, Segmented, Slider, Stat, Toggle, fmtMs, fmtUsd } from "../ui";

type Chaos = { rate429: number; rate5xx: number; latency: number };
type Attempt = { attempt: number; delayMs: number; reason: string };
type Entry = {
  id: number;
  provider: Provider;
  model: string;
  prompt: string;
  status: "pending" | "ok" | "failed";
  attempts: Attempt[];
  response?: ChatResponse;
  error?: string;
};

const REPLIES = [
  "Redis is an in-memory data store used as a cache, message broker and database.",
  "Exponential backoff doubles the wait after each failed attempt, with jitter to avoid thundering herds.",
  "A p99 latency tells you what the slowest 1% of requests experience.",
  "Idempotent jobs can be retried safely because running them twice has the same effect as once.",
  "MCP lets an LLM discover and call tools that a server exposes over JSON-RPC.",
];

const QUICK_PROMPTS = ["Summarize Redis in one line.", "Explain exponential backoff.", "What does p99 latency mean?"];

const tokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A fake fetch that answers each provider in its real wire format, with injectable failures. */
function simulatedFetch(chaos: { current: Chaos }): FetchImpl {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const { rate429, rate5xx, latency } = chaos.current;
    await new Promise((r) => setTimeout(r, latency * (0.6 + Math.random() * 0.8)));

    const roll = Math.random() * 100;
    if (roll < rate429) {
      return new Response(JSON.stringify({ error: { type: "rate_limit_error", message: "Rate limit exceeded" } }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "1" },
      });
    }
    if (roll < rate429 + rate5xx) {
      return new Response(JSON.stringify({ error: { type: "overloaded_error", message: "Upstream overloaded" } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }

    const body = JSON.parse(String(init?.body ?? "{}"));
    const prompt: string = url.includes(":generateContent")
      ? body.contents?.map((c: any) => c.parts?.[0]?.text).join(" ")
      : body.messages?.map((m: any) => m.content).join(" ");
    const reply = REPLIES[hash(prompt) % REPLIES.length];
    const inT = tokens(prompt) + 8;
    const outT = tokens(reply);

    let json: unknown;
    if (url.includes("/v1/messages")) {
      json = {
        id: "msg_sim",
        type: "message",
        role: "assistant",
        model: body.model,
        content: [{ type: "text", text: reply }],
        stop_reason: "end_turn",
        usage: { input_tokens: inT, output_tokens: outT },
      };
    } else if (url.includes("/v1/chat/completions")) {
      json = {
        id: "chatcmpl-sim",
        object: "chat.completion",
        model: body.model,
        choices: [{ index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" }],
        usage: { prompt_tokens: inT, completion_tokens: outT, total_tokens: inT + outT },
      };
    } else {
      json = {
        candidates: [{ content: { role: "model", parts: [{ text: reply }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: inT, candidatesTokenCount: outT, totalTokenCount: inT + outT },
      };
    }
    return new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } });
  }) as FetchImpl;
}

const PROVIDERS: Array<{ value: Provider; label: string }> = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
];

export default function AiDemo() {
  const [provider, setProvider] = useState<Provider>("anthropic");
  const models = Object.keys(DEFAULT_PRICING[provider]);
  const [modelByProvider, setModelByProvider] = useState<Record<Provider, string>>({
    anthropic: "claude-sonnet-4-6",
    openai: "gpt-4o-mini",
    gemini: "gemini-2.0-flash",
  });
  const model = modelByProvider[provider];
  const [prompt, setPrompt] = useState(QUICK_PROMPTS[0]);
  const [useCache, setUseCache] = useState(true);
  const [maxRetries, setMaxRetries] = useState(3);
  const [chaos, setChaos] = useState<Chaos>({ rate429: 25, rate5xx: 15, latency: 450 });
  const chaosRef = useRef(chaos);
  chaosRef.current = chaos;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<TracerStats | null>(null);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);

  // One tracer for every client so the stats roll up across providers.
  const tracer = useMemo(() => new Tracer(500), []);
  const cache = useMemo(() => memoryCache({ max: 200 }), []);
  const fetchImpl = useMemo(() => simulatedFetch(chaosRef), []);

  const patch = (id: number, p: Partial<Entry>) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const send = async (text: string) => {
    const id = nextId.current++;
    const entry: Entry = { id, provider, model, prompt: text, status: "pending", attempts: [] };
    setEntries((es) => [entry, ...es].slice(0, 40));

    const attempts: Attempt[] = [];
    const client: AIClient = createAI({
      provider,
      model,
      apiKey: "sk-demo",
      cache: useCache ? cache : undefined,
      tracing: true,
      onTrace: (rec) => tracer.record(rec),
      fetchImpl,
      retry: {
        maxRetries,
        baseDelayMs: 400,
        onRetry: (attempt, delayMs, err) => {
          attempts.push({ attempt, delayMs, reason: (err as Error).message });
          patch(id, { attempts: [...attempts] });
        },
      },
      logger: { info: () => {}, error: () => {}, warn: () => {} },
    });

    try {
      const response = await client.chat({ prompt: text, maxTokens: 256 });
      patch(id, { status: "ok", response });
    } catch (e) {
      const err = e as AIError;
      patch(id, { status: "failed", error: `${err.message} (after ${attempts.length + 1} attempt${attempts.length ? "s" : ""})` });
    }
    setStats(tracer.getStats());
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="demo-grid">
      <Panel title="Request">
        <div className="stack-sm">
          <Segmented label="Provider" options={PROVIDERS} value={provider} onChange={setProvider} />
          <label className="field">
            <span>Model (priced from DEFAULT_PRICING)</span>
            <select value={model} onChange={(e) => setModelByProvider((m) => ({ ...m, [provider]: e.target.value }))}>
              {models.map((m) => {
                const p = DEFAULT_PRICING[provider][m];
                return (
                  <option key={m} value={m}>
                    {m} · ${p.input}/${p.output} per 1M
                  </option>
                );
              })}
            </select>
          </label>
          <PromptPicker onUse={setPrompt} />
          <label className="field">
            <span>Prompt</span>
            <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
          <div className="row wrap">
            {QUICK_PROMPTS.map((q) => (
              <button key={q} className="chip" onClick={() => setPrompt(q)}>
                {q}
              </button>
            ))}
          </div>
          <div className="row wrap">
            <button className="btn" disabled={busy || !prompt.trim()} onClick={() => run(() => send(prompt))}>
              ai.chat()
            </button>
            <button
              className="ghost"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  for (let i = 0; i < 8; i++) await send(QUICK_PROMPTS[i % QUICK_PROMPTS.length]);
                })
              }
            >
              Burst of 8 (repeats hit the cache)
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Provider behaviour">
        <div className="stack-sm">
          <Slider label="429 rate limit" value={chaos.rate429} min={0} max={70} format={(n) => n + "%"} onChange={(n) => setChaos((c) => ({ ...c, rate429: n }))} />
          <Slider label="503 overloaded" value={chaos.rate5xx} min={0} max={50} format={(n) => n + "%"} onChange={(n) => setChaos((c) => ({ ...c, rate5xx: n }))} />
          <Slider label="Network latency" value={chaos.latency} min={50} max={1500} step={50} format={fmtMs} onChange={(n) => setChaos((c) => ({ ...c, latency: n }))} />
          <Slider label="maxRetries" value={maxRetries} min={1} max={5} onChange={setMaxRetries} />
          <Toggle label="Response cache (memoryCache)" checked={useCache} onChange={setUseCache} />
          <p className="hint muted">
            429s send <code>retry-after: 1</code>, which the client honours. 503s back off exponentially from 400ms with jitter. Other 4xx would fail
            immediately.
          </p>
        </div>
      </Panel>

      <Panel title="tracer.getStats()" className="span-2">
        <StatsView stats={stats} />
      </Panel>

      <Panel title="Requests" aside={<span className="mono muted">newest first</span>} className="span-2">
        {entries.length === 0 ? <p className="muted">Send a request to see it go through the middleware.</p> : <RequestLog entries={entries} />}
      </Panel>

      <Panel title="In your app" className="span-2">
        <Code label="server.ts">{`import Redis from "ioredis";
import { createAI } from "ai-observer";

const ai = createAI({
  provider: "${provider}",
  model: "${model}",
  cache: new Redis(process.env.REDIS_URL), // or memoryCache()
  tracing: true,
  retry: { maxRetries: ${maxRetries} },
});

const res = await ai.chat({ prompt: ${JSON.stringify(prompt)} });
console.log(res.text, res.costUsd, res.cached, res.latencyMs);
console.log(ai.getStats()); // count, cacheHitRate, totalCostUsd, byModel, ...`}</Code>
      </Panel>
    </div>
  );
}

function PromptPicker({ onUse }: { onUse: (s: string) => void }) {
  const prompts = useMemo(
    () =>
      createPromptManager()
        .register("summarize", { version: 1, template: "Summarize: {{text}}", note: "first cut" })
        .register("summarize", { version: 2, template: "Summarize {{text}} in one line for a {{audience}}.", note: "adds audience" }),
    []
  );
  const [ref, setRef] = useState("summarize");
  const rendered = prompts.render(ref, { text: "Redis", audience: "backend engineer" });
  return (
    <div className="prompt-picker">
      <span className="muted small">PromptManager</span>
      <select aria-label="Prompt version" value={ref} onChange={(e) => setRef(e.target.value)}>
        <option value="summarize">summarize (latest)</option>
        <option value="summarize@1">summarize@1</option>
        <option value="summarize@2">summarize@2</option>
      </select>
      <span className="mono small muted">→ {prompts.label(ref)}</span>
      <button className="link-btn" onClick={() => onUse(rendered)}>
        use
      </button>
    </div>
  );
}

function StatsView({ stats }: { stats: TracerStats | null }) {
  if (!stats) return <p className="muted">No traces yet.</p>;
  const models = Object.entries(stats.byModel).sort((a, b) => b[1].costUsd - a[1].costUsd);
  return (
    <>
      <div className="stats">
        <Stat label="requests" value={stats.count} />
        <Stat label="errors" value={stats.errors} tone={stats.errors ? "bad" : undefined} />
        <Stat label="cache hit rate" value={Math.round(stats.cacheHitRate * 100) + "%"} tone={stats.cacheHitRate > 0 ? "good" : undefined} />
        <Stat label="total cost" value={fmtUsd(stats.totalCostUsd)} />
        <Stat label="avg latency" value={fmtMs(stats.avgLatencyMs)} />
        <Stat label="tokens in / out" value={`${stats.totalInputTokens} / ${stats.totalOutputTokens}`} />
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>model</th>
            <th>calls</th>
            <th>cost</th>
          </tr>
        </thead>
        <tbody>
          {models.map(([m, v]) => (
            <tr key={m}>
              <td className="mono">{m}</td>
              <td className="mono">{v.count}</td>
              <td className="mono">{fmtUsd(v.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function RequestLog({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ol className="req-log">
      {entries.map((e) => {
        const r = e.response;
        const tone = e.status === "pending" ? "muted" : e.status === "failed" ? "bad" : r?.cached ? "info" : "good";
        const label = e.status === "pending" ? "pending" : e.status === "failed" ? "failed" : r?.cached ? "cache hit" : "ok";
        return (
          <li key={e.id} className="req">
            <button className="req-row" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
              <Badge tone={tone}>{label}</Badge>
              <span className="mono small">{e.model}</span>
              <span className="req-prompt">{e.prompt}</span>
              <span className="mono small muted req-nums">
                {r ? `${fmtMs(r.latencyMs)} · ${r.usage.totalTokens} tok · ${fmtUsd(r.costUsd)}` : e.attempts.length ? `retry ${e.attempts.length}…` : ""}
              </span>
            </button>
            {e.attempts.length > 0 && (
              <ul className="attempts mono small">
                {e.attempts.map((a) => (
                  <li key={a.attempt}>
                    attempt {a.attempt} failed: {a.reason} → retrying in {fmtMs(a.delayMs)}
                  </li>
                ))}
              </ul>
            )}
            {e.error && <p className="error-box mono small">{e.error}</p>}
            {open === e.id && r && (
              <div className="req-detail">
                <Code label="normalized ChatResponse, same shape for every provider">
                  {JSON.stringify({ ...r, raw: "…" }, null, 2)}
                </Code>
                <Code label={`raw ${e.provider} body${r.cached ? " (stored in the cache)" : ""}`}>{JSON.stringify(r.raw, null, 2)}</Code>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
