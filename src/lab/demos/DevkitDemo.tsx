import { useEffect, useMemo, useRef, useState } from "react";
import {
  archiveFailedJobs,
  checkQueuesHealth,
  collectQueueMetrics,
  getNextRuns,
  inspectJob,
  listFailedJobs,
  purgeFailedJobs,
  renderPrometheus,
  retryFailedJobs,
  summarizeFailures,
  validateCron,
  type FailedJobInfo,
  type FailureSummary,
  type HealthCheckResult,
  type HealthStatus,
  type HealthThresholds,
  type JobReport,
} from "bullmq-devkit";
import { Badge, Code, Panel, Segmented, Slider, Stat, Toggle, fmtMs } from "../ui";
import { SimQueue, type SimConfig } from "./simQueue";

// The toolkit is typed against bullmq's Queue; the simulator implements the parts it calls.
type Queue = Parameters<typeof summarizeFailures>[0];
const asQueue = (q: SimQueue) => q as unknown as Queue;

function makeQueues() {
  const email = new SimQueue(
    "email",
    {
      ratePerSec: 8,
      concurrency: 5,
      failRate: 35,
      workMs: 400,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      failures: [
        { reason: "SMTP connect ETIMEDOUT 10.0.4.12:587", frame: "SESTransport.send (ses.js:88:13)", weight: 5 },
        { reason: "Invalid recipient: mailbox does not exist", frame: "validateRecipient (mailer.js:31:9)", weight: 2 },
        { reason: "Throttling: Maximum sending rate exceeded", frame: "SESTransport.send (ses.js:91:13)", weight: 3 },
      ],
    },
    "send-otp",
    (n) => ({ to: `user${n}@example.com`, template: "otp" })
  );
  const thumbs = new SimQueue(
    "thumbnails",
    {
      ratePerSec: 3,
      concurrency: 2,
      failRate: 25,
      workMs: 900,
      attempts: 2,
      backoff: { type: "fixed", delay: 2000 },
      failures: [
        { reason: "sharp: Input buffer contains unsupported image format", frame: "resize (thumbs.js:17:21)", weight: 3 },
        { reason: "S3 PutObject AccessDenied", frame: "upload (s3.js:54:7)", weight: 1 },
      ],
    },
    "resize",
    (n) => ({ key: `uploads/${n}.jpg`, sizes: [128, 512] })
  );
  // Start with some history so the dead-letter tools have something to work on.
  const now = Date.now();
  for (const q of [email, thumbs]) q.seed(now, 40, 14);
  return [email, thumbs];
}

const TONE: Record<HealthStatus, "good" | "warn" | "bad"> = { healthy: "good", degraded: "warn", unhealthy: "bad" };

export default function DevkitDemo() {
  const queues = useMemo(makeQueues, []);
  const dlq = useMemo(() => new SimQueue("email-dead", { ...queues[0].config, ratePerSec: 0, concurrency: 0 }, "", () => ({})), [queues]);
  const [tab, setTab] = useState<"health" | "dlq" | "cron">("health");
  const [selected, setSelected] = useState(0);
  const [, force] = useState(0);
  const [thresholds, setThresholds] = useState<HealthThresholds>({ maxWaiting: 60, maxFailedRatio: 0.1, maxDelayed: 40, maxActive: 20 });
  const [health, setHealth] = useState<{ status: HealthStatus; queues: HealthCheckResult[] } | null>(null);
  const [metrics, setMetrics] = useState("");
  const thresholdsRef = useRef(thresholds);
  thresholdsRef.current = thresholds;

  useEffect(() => {
    let last = Date.now();
    const sim = window.setInterval(() => {
      const now = Date.now();
      for (const q of queues) q.tick(now, now - last);
      last = now;
    }, 100);
    const check = window.setInterval(async () => {
      const qs = queues.map(asQueue);
      setHealth(await checkQueuesHealth(qs, thresholdsRef.current));
      setMetrics(renderPrometheus(await collectQueueMetrics(qs), { labels: { env: "demo" } }));
    }, 1000);
    return () => {
      window.clearInterval(sim);
      window.clearInterval(check);
    };
  }, [queues]);

  const q = queues[selected];
  const setConfig = (p: Partial<SimConfig>) => {
    q.config = { ...q.config, ...p };
    force((n) => n + 1);
  };

  return (
    <div className="demo-grid">
      <Panel
        title="Queues"
        aside={health && <Badge tone={TONE[health.status]}>{health.status}</Badge>}
        className="span-2"
      >
        <div className="queue-cards">
          {queues.map((sq, i) => {
            const h = health?.queues.find((x) => x.queue === sq.name);
            return (
              <button key={sq.name} className={"queue-card" + (i === selected ? " on" : "")} onClick={() => setSelected(i)} aria-pressed={i === selected}>
                <span className="row">
                  <b className="mono">{sq.name}</b>
                  {h && <Badge tone={TONE[h.status]}>{h.status}</Badge>}
                </span>
                {h && (
                  <span className="counts mono small">
                    <span>wait {h.counts.waiting}</span>
                    <span>active {h.counts.active}</span>
                    <span>delayed {h.counts.delayed}</span>
                    <span>done {h.counts.completed}</span>
                    <span className={h.counts.failed ? "bad" : ""}>failed {h.counts.failed}</span>
                    <span>fail rate {Math.round(h.failedRatio * 1000) / 10}%</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="controls-grid">
          <Slider label={`${q.name}: jobs added per second`} value={q.config.ratePerSec} min={0} max={30} onChange={(n) => setConfig({ ratePerSec: n })} />
          <Slider label="Worker concurrency" value={q.config.concurrency} min={0} max={20} onChange={(n) => setConfig({ concurrency: n })} />
          <Slider label="Failure rate per attempt" value={q.config.failRate} min={0} max={80} format={(n) => n + "%"} onChange={(n) => setConfig({ failRate: n })} />
          <div className="stack-sm">
            <Toggle
              label="Pause queue"
              checked={q.paused}
              onChange={(v) => {
                q.paused = v;
                force((n) => n + 1);
              }}
            />
            <span className="mono small muted">
              attempts {q.config.attempts} · backoff {q.config.backoff.type} {q.config.backoff.delay}ms
            </span>
          </div>
        </div>
      </Panel>

      <div className="span-2">
        <Segmented
          label="Tool"
          value={tab}
          onChange={setTab}
          options={[
            { value: "health", label: "Health & metrics" },
            { value: "dlq", label: "Dead letters" },
            { value: "cron", label: "Cron validator" },
          ]}
        />
      </div>

      {tab === "health" && (
        <>
          <Panel title="checkQueuesHealth()">
            <ThresholdEditor value={thresholds} onChange={setThresholds} />
            {health?.queues.map((h) => (
              <div key={h.queue} className="health-block">
                <p className="row">
                  <b className="mono">{h.queue}</b>
                  <Badge tone={TONE[h.status]}>{h.status}</Badge>
                </p>
                <ul className="checks">
                  {h.checks
                    .filter((c) => c.threshold !== undefined || c.status !== "healthy")
                    .map((c) => (
                      <li key={c.name}>
                        <Badge tone={TONE[c.status]}>{c.status}</Badge>
                        <span className="small">{c.message}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </Panel>
          <Panel title="GET /metrics" aside={<span className="mono muted small">Prometheus text format</span>}>
            <Code>{metrics || "# waiting for the first scrape"}</Code>
          </Panel>
        </>
      )}

      {tab === "dlq" && <DeadLetters queue={q} dlq={dlq} />}
      {tab === "cron" && <CronPanel />}

      <Panel title="In your app" className="span-2">
        <Code label="ops.ts">{`import { Queue } from "bullmq";
import { checkQueueHealth, createMetricsHandler, summarizeFailures, retryFailedJobs } from "bullmq-devkit";

const email = new Queue("email", { connection });

app.get("/health/queues", async (_req, res) => {
  const h = await checkQueueHealth(email, ${JSON.stringify(thresholds)});
  res.status(h.status === "unhealthy" ? 503 : 200).json(h);
});
app.get("/metrics", createMetricsHandler([email], { labels: { env: "prod" } }));

const { buckets } = await summarizeFailures(email);
await retryFailedJobs(email, { filter: (j) => j.reason === buckets[0].reason });

// or from a terminal: npx bullmq-devkit health --redis redis://localhost:6379`}</Code>
      </Panel>
    </div>
  );
}

function ThresholdEditor({ value, onChange }: { value: HealthThresholds; onChange: (t: HealthThresholds) => void }) {
  const field = (key: keyof HealthThresholds, label: string, step = 1) => (
    <label className="field inline">
      <span className="mono small">{label}</span>
      <input
        type="number"
        step={step}
        min={0}
        value={(value[key] as number | undefined) ?? ""}
        onChange={(e) => onChange({ ...value, [key]: e.target.value === "" ? undefined : Number(e.target.value) })}
      />
    </label>
  );
  return (
    <div className="threshold-row">
      {field("maxWaiting", "maxWaiting")}
      {field("maxActive", "maxActive")}
      {field("maxDelayed", "maxDelayed")}
      {field("maxFailedRatio", "maxFailedRatio", 0.01)}
    </div>
  );
}

function DeadLetters({ queue, dlq }: { queue: SimQueue; dlq: SimQueue }) {
  const [summary, setSummary] = useState<FailureSummary | null>(null);
  const [jobs, setJobs] = useState<FailedJobInfo[]>([]);
  const [report, setReport] = useState<JobReport | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [dlqCount, setDlqCount] = useState(0);

  const refresh = async () => {
    setSummary(await summarizeFailures(asQueue(queue)));
    setJobs(await listFailedJobs(asQueue(queue), { limit: 8 }));
    setDlqCount(dlq.jobs.size);
  };
  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 1500);
    return () => window.clearInterval(t);
  }, [queue]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (label: string, fn: () => Promise<unknown>) => {
    const res = await fn();
    setLog((l) => [`${label} → ${JSON.stringify(res)}`, ...l].slice(0, 6));
    refresh();
  };

  return (
    <>
      <Panel title="summarizeFailures()" aside={summary && <span className="mono muted small">{summary.totalFailed} failed</span>}>
        {!summary || summary.buckets.length === 0 ? (
          <p className="muted">No failed jobs on {queue.name} yet. Raise the failure rate.</p>
        ) : (
          <ul className="buckets">
            {summary.buckets.map((b) => (
              <li key={b.reason}>
                <span className="bucket-count mono">{b.count}</span>
                <div className="grow">
                  <span className="mono small">{b.reason}</span>
                  <span className="muted small d-block">sample ids: {b.sampleIds.join(", ")}</span>
                  <span className="row">
                    <button
                      className="link-btn"
                      onClick={() => act(`retryFailedJobs(${queue.name}, reason)`, () => retryFailedJobs(asQueue(queue), { filter: (j) => j.reason === b.reason }))}
                    >
                      retry these
                    </button>
                    <button
                      className="link-btn"
                      onClick={() => act(`purgeFailedJobs(${queue.name}, reason)`, () => purgeFailedJobs(asQueue(queue), { filter: (j) => j.reason === b.reason }))}
                    >
                      purge
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="row wrap">
          <button className="ghost" onClick={() => act(`archiveFailedJobs(${queue.name}, email-dead)`, () => archiveFailedJobs(asQueue(queue), asQueue(dlq)))}>
            Archive all to a dead-letter queue
          </button>
          <span className="mono small muted">email-dead holds {dlqCount}</span>
        </div>
        {log.length > 0 && (
          <ul className="action-log mono small">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="listFailedJobs() → inspectJob()">
        {jobs.length === 0 ? (
          <p className="muted">Nothing to inspect yet.</p>
        ) : (
          <table className="table clickable">
            <thead>
              <tr>
                <th>id</th>
                <th>attempts</th>
                <th>reason</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} onClick={async () => setReport(await inspectJob(asQueue(queue), String(j.id)))} tabIndex={0}>
                  <td className="mono">{j.id}</td>
                  <td className="mono">
                    {j.attemptsMade}/{j.attempts}
                  </td>
                  <td className="small">{j.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {report && (
          <>
            <div className="stats">
              <Stat label="state" value={report.state} />
              <Stat label="attempts" value={`${report.attemptsMade}/${report.attempts}`} />
              <Stat label="ran for" value={report.durationMs !== undefined ? fmtMs(report.durationMs) : "n/a"} />
            </div>
            <Code label={`inspectJob(${queue.name}, "${report.id}")`}>{JSON.stringify(report, null, 2)}</Code>
          </>
        )}
      </Panel>
    </>
  );
}

const CRON_PRESETS = ["*/5 * * * *", "0 9 * * mon-fri", "30 2 1,15 * *", "0 0 31 2 *", "* * * * * *", "0 0 L * *", "61 * * * *"];

function CronPanel() {
  const [pattern, setPattern] = useState("0 9 * * mon-fri");
  const result = validateCron(pattern);
  const runs = result.valid ? getNextRuns(pattern, { count: 6 }) : [];
  return (
    <>
      <Panel title="validateCron()">
        <label className="field">
          <span>Repeatable job pattern (5 fields, or 6 with seconds first)</span>
          <input className="mono big-input" value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} />
        </label>
        <div className="row wrap">
          {CRON_PRESETS.map((p) => (
            <button key={p} className="chip mono" onClick={() => setPattern(p)}>
              {p}
            </button>
          ))}
        </div>
        <p className="row">
          <Badge tone={result.valid ? (result.warnings.length ? "warn" : "good") : "bad"}>
            {result.valid ? (result.warnings.length ? "valid, with warnings" : "valid") : "invalid"}
          </Badge>
          <span className="mono small muted">
            {result.fieldCount} fields{result.hasSeconds ? ", seconds first" : ""}
          </span>
        </p>
        {[...result.errors, ...result.warnings].map((m) => (
          <p key={m} className={(result.errors.includes(m) ? "error-box" : "warn-box") + " small"}>
            {m}
          </p>
        ))}
        {result.fields && (
          <table className="table">
            <tbody>
              {result.fields.map((f) => (
                <tr key={f.name}>
                  <td className="mono">{f.name}</td>
                  <td className="mono small">{f.wildcard ? "* (every)" : f.values.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Panel title="getNextRuns()" aside={<span className="mono muted small">UTC</span>}>
        {runs.length === 0 ? (
          <p className="muted">{result.valid ? "Never fires in the next 5 years." : "Fix the pattern to see upcoming runs."}</p>
        ) : (
          <ol className="runs mono">
            {runs.map((d) => (
              <li key={d.toISOString()}>
                <span>{d.toISOString().replace("T", " ").replace(".000Z", "Z")}</span>
                <span className="muted small">{d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })} local</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
