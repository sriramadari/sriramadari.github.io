import { useEffect, useRef, useState } from "react";
import { formatSlackMessage, Insights, normalizePath, type Alert, type HistogramSnapshot, type InsightsSnapshot } from "node-observe";
import { Badge, Code, Panel, Slider, Stat, Toggle, fmtMs } from "../ui";

const MB = 1024 * 1024;
const TICK_MS = 500;
/** Each tick advances the simulated clock by one memory sample interval (15s), so leaks show up in seconds. */
const SIM_STEP_MS = 15_000;
const THRESHOLDS = { requestMs: 800, mongoMs: 300, redisMs: 100, heapGrowthMbPerMin: 50, heapUsedMb: 450 };

type Knobs = { rps: number; errorRate: number; slowMongo: boolean; redisHiccup: boolean; leak: boolean };

const jitter = (base: number, spread = 0.5) => base * (1 - spread / 2 + Math.random() * spread) + (Math.random() < 0.03 ? base * 3 : 0);
const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const pickId = () => {
  const r = Math.random();
  if (r < 0.5) return String(Math.floor(Math.random() * 90000) + 100);
  if (r < 0.85) return hex(24); // Mongo ObjectId
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`; // UUID
};

/** One simulated request: its route, the queries it makes, and how long each takes. */
function simulateRequest(ins: Insights, k: Knobs): string {
  const r = Math.random();
  let method = "GET";
  let path: string;
  let ms = 0;
  const mongo = (op: string, base: number) => {
    const t = jitter(k.slowMongo && op.endsWith("aggregate") ? base + 700 : base);
    ins.recordMongo(op, t);
    ms += t;
  };
  const redis = (cmd: string) => {
    const t = jitter(k.redisHiccup ? 160 : 2.5);
    ins.recordRedis(cmd, t);
    ms += t;
  };

  if (r < 0.45) {
    path = `/users/${pickId()}`;
    redis("get");
    if (Math.random() < 0.3) {
      mongo("User.findOne", 18);
      redis("set");
    }
  } else if (r < 0.7) {
    path = `/search?q=${["redis", "queues", "mcp", "p99"][Math.floor(Math.random() * 4)]}`;
    mongo("Post.aggregate", 45);
  } else if (r < 0.88) {
    method = "POST";
    path = "/orders";
    mongo("Order.save", 25);
    mongo("Inventory.updateOne", 12);
  } else {
    path = `/users/${pickId()}/posts/${pickId()}`;
    mongo("Post.find", 30);
  }
  ms += jitter(12);
  const status = Math.random() * 100 < k.errorRate ? 500 : method === "POST" ? 201 : 200;
  ins.recordRequest(method, path, status, ms);
  return path;
}

export default function ObserveDemo() {
  const [knobs, setKnobs] = useState<Knobs>({ rps: 30, errorRate: 2, slowMongo: false, redisHiccup: false, leak: false });
  const knobsRef = useRef(knobs);
  knobsRef.current = knobs;
  const [running, setRunning] = useState(true);
  const [snap, setSnap] = useState<InsightsSnapshot | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [heap, setHeap] = useState<number[]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const [epoch, setEpoch] = useState(0);

  const sim = useRef({ clock: 0, heapMb: 120 });
  const insRef = useRef<Insights | null>(null);

  useEffect(() => {
    sim.current = { clock: Date.now(), heapMb: 120 };
    setAlerts([]);
    setHeap([]);
    setSnap(null);
    insRef.current = new Insights({
      serviceName: "orders-api",
      thresholds: THRESHOLDS,
      alertCooldownMs: 6000,
      memoryUsage: () => ({ heapUsed: sim.current.heapMb * MB, heapTotal: 512 * MB, rss: (sim.current.heapMb + 90) * MB, external: 6 * MB }),
      onAlert: (a) => setAlerts((as) => [a, ...as].slice(0, 30)),
      logger: { info: () => {}, error: () => {}, warn: () => {} },
    });
  }, [epoch]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const ins = insRef.current;
      if (!ins) return;
      const k = knobsRef.current;
      const n = Math.max(1, Math.round((k.rps * TICK_MS) / 1000 + (Math.random() - 0.5) * 2));
      let last = "";
      for (let i = 0; i < n; i++) last = simulateRequest(ins, k);
      setPaths((p) => [last, ...p].slice(0, 5));

      // Heap: a GC sawtooth around a baseline, plus steady growth when leaking.
      const s = sim.current;
      s.clock += SIM_STEP_MS;
      if (k.leak) s.heapMb += 14 + Math.random() * 6;
      else s.heapMb += (120 - s.heapMb) * 0.35 + (Math.random() - 0.5) * 8;
      s.heapMb = Math.max(60, s.heapMb);
      ins.checkMemory(s.clock);
      setHeap((h) => [...h, s.heapMb].slice(-60));
      setSnap(ins.snapshot());
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [running, epoch]);

  const set = <K extends keyof Knobs>(key: K, v: Knobs[K]) => setKnobs((k) => ({ ...k, [key]: v }));

  return (
    <div className="demo-grid">
      <Panel
        title="Traffic"
        aside={
          <div className="row">
            <button className="ghost" onClick={() => setRunning((r) => !r)}>
              {running ? "Pause" : "Resume"}
            </button>
            <button className="ghost" onClick={() => setEpoch((e) => e + 1)}>
              Reset
            </button>
          </div>
        }
      >
        <div className="stack-sm">
          <Slider label="Requests per second" value={knobs.rps} min={5} max={120} step={5} onChange={(n) => set("rps", n)} />
          <Slider label="5xx error rate" value={knobs.errorRate} min={0} max={40} format={(n) => n + "%"} onChange={(n) => set("errorRate", n)} />
          <Toggle label="Slow aggregate (missing index)" checked={knobs.slowMongo} onChange={(v) => set("slowMongo", v)} />
          <Toggle label="Redis latency spike" checked={knobs.redisHiccup} onChange={(v) => set("redisHiccup", v)} />
          <Toggle label="Memory leak" checked={knobs.leak} onChange={(v) => set("leak", v)} />
          <p className="hint muted">
            Thresholds: request {THRESHOLDS.requestMs}ms, Mongo {THRESHOLDS.mongoMs}ms, Redis {THRESHOLDS.redisMs}ms, heap growth{" "}
            {THRESHOLDS.heapGrowthMbPerMin}MB/min, heap {THRESHOLDS.heapUsedMb}MB. Same alert key is muted for 6s.
          </p>
        </div>
      </Panel>

      <Panel title="Memory" aside={snap && <Badge tone={snap.memory.growthMbPerMin > THRESHOLDS.heapGrowthMbPerMin ? "bad" : "good"}>{snap.memory.growthMbPerMin} MB/min</Badge>}>
        <HeapChart values={heap} limit={THRESHOLDS.heapUsedMb} />
        {snap && (
          <div className="stats">
            <Stat label="heap used" value={snap.memory.heapUsedMb + " MB"} tone={snap.memory.heapUsedMb > THRESHOLDS.heapUsedMb ? "bad" : undefined} />
            <Stat label="growth (least squares)" value={snap.memory.growthMbPerMin + " MB/min"} />
            <Stat label="rss" value={snap.memory.rssMb + " MB"} />
          </div>
        )}
        <p className="hint muted">One sample per tick on a simulated 15s interval. The trend is a regression over the last 30 samples, so a single GC spike never fires the leak alert.</p>
      </Panel>

      <Panel title="HTTP routes" aside={<PathNormalization paths={paths} />} className="span-2">
        {snap ? <HistTable data={snap.http} threshold={THRESHOLDS.requestMs} counters={snap.counters} /> : <p className="muted">Warming up…</p>}
      </Panel>

      <Panel title="MongoDB">{snap && <HistTable data={snap.mongo} threshold={THRESHOLDS.mongoMs} compact />}</Panel>
      <Panel title="Redis">{snap && <HistTable data={snap.redis} threshold={THRESHOLDS.redisMs} compact />}</Panel>

      <Panel title="Alerts → Slack" aside={<span className="mono muted">{alerts.length}</span>} className="span-2">
        {alerts.length === 0 ? (
          <p className="muted">Quiet. Flip a toggle to break something.</p>
        ) : (
          <ul className="slack-feed">
            {alerts.map((a, i) => (
              <li key={a.at + a.key + i}>
                <SlackMessage text={formatSlackMessage(a, "orders-api")} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="GET /insights" className="span-2">
        <details>
          <summary className="mono">insights.snapshot()</summary>
          <Code>{snap ? JSON.stringify(snap, null, 2) : "{}"}</Code>
        </details>
      </Panel>

      <Panel title="In your app" className="span-2">
        <Code label="server.ts">{`import express from "express";
import mongoose from "mongoose";
import Redis from "ioredis";
import { Insights } from "node-observe";

const insights = new Insights({
  serviceName: "orders-api",
  slackWebhook: process.env.SLACK_WEBHOOK_URL,
  thresholds: { requestMs: ${THRESHOLDS.requestMs}, mongoMs: ${THRESHOLDS.mongoMs}, redisMs: ${THRESHOLDS.redisMs} },
});

insights.instrumentMongoose(mongoose); // before models compile
const app = express();
app.use(insights.express());
insights.instrumentRedis(new Redis(process.env.REDIS_URL));
insights.startMemoryMonitor();
app.get("/insights", insights.handler());`}</Code>
      </Panel>
    </div>
  );
}

function HistTable({
  data,
  threshold,
  counters,
  compact,
}: {
  data: Record<string, HistogramSnapshot>;
  threshold: number;
  counters?: Record<string, number>;
  compact?: boolean;
}) {
  const rows = Object.entries(data).sort((a, b) => b[1].count - a[1].count);
  const scale = Math.max(threshold * 1.5, ...rows.map(([, h]) => h.p99));
  return (
    <>
      {counters && (
        <p className="mono small muted">
          {Object.entries(counters)
            .sort()
            .map(([k, v]) => `${k.replace("http.status.", "")}: ${v}`)
            .join(" · ")}
        </p>
      )}
      <table className="table hist">
        <thead>
          <tr>
            <th>{compact ? "op" : "route"}</th>
            <th>count</th>
            {!compact && <th>errors</th>}
            <th>p50</th>
            <th>p95</th>
            <th>p99</th>
            {!compact && <th className="bar-col">p50 · p95 · p99 vs threshold</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, h]) => (
            <tr key={name} className={h.p95 > threshold ? "hot" : ""}>
              <td className="mono">{name}</td>
              <td className="mono">{h.count}</td>
              {!compact && <td className={"mono" + (h.errors ? " bad" : "")}>{h.errors}</td>}
              <td className="mono">{fmtMs(h.p50)}</td>
              <td className="mono">{fmtMs(h.p95)}</td>
              <td className="mono">{fmtMs(h.p99)}</td>
              {!compact && (
                <td className="bar-col">
                  <span className="pbar" aria-hidden="true">
                    <i style={{ width: `${(h.p99 / scale) * 100}%` }} className="p99" />
                    <i style={{ width: `${(h.p95 / scale) * 100}%` }} className="p95" />
                    <i style={{ width: `${(h.p50 / scale) * 100}%` }} className="p50" />
                    <b style={{ left: `${(threshold / scale) * 100}%` }} />
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function PathNormalization({ paths }: { paths: string[] }) {
  const p = paths[0];
  if (!p) return null;
  return (
    <span className="mono small muted norm" title="normalizePath() keeps route cardinality low">
      {p.length > 38 ? p.slice(0, 36) + "…" : p} → <b>{normalizePath(p)}</b>
    </span>
  );
}

function HeapChart({ values, limit }: { values: number[]; limit: number }) {
  const W = 320;
  const H = 90;
  const max = Math.max(limit * 1.15, ...values);
  const x = (i: number) => (values.length < 2 ? 0 : (i / (60 - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="heap-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Heap used over time">
      <line x1="0" x2={W} y1={y(limit)} y2={y(limit)} className="limit" />
      <path d={d} className="line" />
    </svg>
  );
}

/** Render Slack mrkdwn (*bold*, `code`) the way the message would look in a channel. */
function SlackMessage({ text }: { text: string }) {
  const lines = text.split("\n");
  const inline = (s: string) =>
    s.split(/(\*[^*]+\*|`[^`]+`)/g).map((part, i) =>
      part.startsWith("*") && part.endsWith("*") ? (
        <b key={i}>{part.slice(1, -1)}</b>
      ) : part.startsWith("`") ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  return (
    <div className="slack">
      <span className="slack-avatar" aria-hidden="true">
        N
      </span>
      <div>
        <p className="slack-name">
          node-observe <span className="muted small">APP</span>
        </p>
        {lines.map((l, i) => (
          <p key={i}>{inline(l)}</p>
        ))}
      </div>
    </div>
  );
}
