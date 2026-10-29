import { computeBackoffDelay } from "bullmq-devkit";

// An in-memory stand-in for a BullMQ queue + worker. It implements the Queue and
// Job methods bullmq-devkit calls, so the toolkit runs against it unchanged.

export type JobState = "waiting" | "active" | "delayed" | "completed" | "failed";
type Backoff = { type: "fixed" | "exponential"; delay: number };

export class SimJob {
  attemptsMade = 0;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  stacktrace: string[] = [];
  state: JobState = "waiting";
  runAt = 0;
  doneAt = 0;
  willFail = false;
  readonly timestamp = Date.now();

  constructor(
    readonly queue: SimQueue,
    readonly id: string,
    readonly name: string,
    readonly data: Record<string, unknown>,
    readonly opts: { attempts?: number; backoff?: Backoff; delay?: number; removeOnComplete?: boolean; removeOnFail?: boolean }
  ) {}

  async getState() {
    return this.state;
  }
  async retry() {
    if (this.state !== "failed") throw new Error(`job ${this.id} is not failed`);
    this.state = "waiting";
    this.failedReason = undefined;
    this.finishedOn = undefined;
  }
  async remove() {
    this.queue.jobs.delete(this.id);
  }
}

export type Failure = { reason: string; frame: string; weight: number };

export type SimConfig = {
  ratePerSec: number;
  concurrency: number;
  failRate: number; // 0..100
  workMs: number;
  attempts: number;
  backoff: Backoff;
  failures: Failure[];
};

export class SimQueue {
  readonly jobs = new Map<string, SimJob>();
  paused = false;
  private seq = 0;
  private carry = 0;

  constructor(
    readonly name: string,
    public config: SimConfig,
    private readonly jobName: string,
    private readonly makeData: (n: number) => Record<string, unknown>
  ) {}

  // ---- the BullMQ Queue surface bullmq-devkit uses ----
  async getJobCounts(...types: string[]) {
    const counts: Record<string, number> = {};
    for (const t of types) counts[t] = 0;
    for (const j of this.jobs.values()) counts[j.state] = (counts[j.state] ?? 0) + 1;
    return counts;
  }
  async isPaused() {
    return this.paused;
  }
  async getFailed(start = 0, end = -1) {
    const failed = [...this.jobs.values()].filter((j) => j.state === "failed").sort((a, b) => (b.finishedOn ?? 0) - (a.finishedOn ?? 0));
    return failed.slice(start, end < 0 ? undefined : end + 1);
  }
  async getFailedCount() {
    let n = 0;
    for (const j of this.jobs.values()) if (j.state === "failed") n++;
    return n;
  }
  async getJob(id: string) {
    return this.jobs.get(id);
  }
  async add(name: string, data: Record<string, unknown>, opts: SimJob["opts"] = {}) {
    const job = new SimJob(this, String(++this.seq), name, data, opts);
    this.jobs.set(job.id, job);
    return job;
  }

  // ---- simulation ----
  /** Pre-fill with jobs that already completed or exhausted their retries. */
  seed(now: number, completed: number, failed: number) {
    for (let i = 0; i < completed + failed; i++) {
      const job = new SimJob(this, String(++this.seq), this.jobName, this.makeData(this.seq), {
        attempts: this.config.attempts,
        backoff: this.config.backoff,
      });
      const ago = (completed + failed - i) * 2500;
      job.processedOn = now - ago - this.config.workMs;
      job.finishedOn = now - ago;
      job.willFail = i % Math.ceil((completed + failed) / failed) === 0;
      job.attemptsMade = job.willFail ? this.config.attempts - 1 : 0;
      job.state = "active";
      this.finish(job, job.finishedOn);
      this.jobs.set(job.id, job);
    }
  }

  /** Advance the producer and worker by `dtMs` of wall time. */
  tick(now: number, dtMs: number) {
    const c = this.config;
    this.carry += (c.ratePerSec * dtMs) / 1000;
    while (this.carry >= 1) {
      this.carry -= 1;
      const n = this.seq + 1;
      void this.add(this.jobName, this.makeData(n), { attempts: c.attempts, backoff: c.backoff });
    }

    let active = 0;
    for (const j of this.jobs.values()) {
      if (j.state === "delayed" && j.runAt <= now) j.state = "waiting";
      if (j.state === "active" && j.doneAt <= now) this.finish(j, now);
      if (j.state === "active") active++;
    }

    if (!this.paused) {
      for (const j of this.jobs.values()) {
        if (active >= c.concurrency) break;
        if (j.state !== "waiting") continue;
        j.state = "active";
        j.processedOn = now;
        j.doneAt = now + c.workMs * (0.5 + Math.random());
        j.willFail = Math.random() * 100 < c.failRate;
        active++;
      }
    }
    this.trim();
  }

  private finish(j: SimJob, now: number) {
    j.attemptsMade++;
    if (!j.willFail) {
      j.state = "completed";
      j.finishedOn = now;
      return;
    }
    const f = pickFailure(this.config.failures);
    j.failedReason = f.reason;
    j.stacktrace = [`Error: ${f.reason}\n    at ${f.frame}\n    at processJob (worker.js:42:11)`, ...j.stacktrace].slice(0, 5);
    const attempts = j.opts.attempts ?? 1;
    if (j.attemptsMade < attempts) {
      // Same math BullMQ uses to schedule the next attempt.
      j.state = "delayed";
      j.finishedOn = now;
      j.runAt = now + (computeBackoffDelay(j.opts.backoff, j.attemptsMade) ?? 0);
    } else {
      j.state = "failed";
      j.finishedOn = now;
    }
  }

  /** Like removeOnComplete: 300 / removeOnFail: 500. */
  private trim() {
    const keep = { completed: 300, failed: 500 };
    for (const state of ["completed", "failed"] as const) {
      const list = [...this.jobs.values()].filter((j) => j.state === state);
      if (list.length > keep[state]) {
        list.sort((a, b) => (a.finishedOn ?? 0) - (b.finishedOn ?? 0));
        for (const j of list.slice(0, list.length - keep[state])) this.jobs.delete(j.id);
      }
    }
  }
}

function pickFailure(failures: Failure[]): Failure {
  const total = failures.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  for (const f of failures) {
    r -= f.weight;
    if (r <= 0) return f;
  }
  return failures[0];
}
