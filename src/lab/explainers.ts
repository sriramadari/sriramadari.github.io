// "What it does" content for each package. The package READMEs carry the same
// sections, so keep the two in step when either changes.

export type Explainer = {
  /** One sentence: what the package is. */
  summary: string;
  /** The pain it exists for. */
  problem: string;
  features: Array<{ title: string; body: string }>;
  /** Before → after, in the reader's terms. */
  helps: Array<{ before: string; after: string }>;
  useWhen: string[];
  notFor: string[];
  howItWorks: string;
};

export const explainers: Record<string, Explainer> = {
  "mcp-devkit": {
    summary: "A testing toolkit for Model Context Protocol servers: connect, call tools, assert on results, and lint the server for the mistakes that make LLMs use it badly.",
    problem:
      "MCP servers mostly get tested by clicking around an inspector, or not at all. The SDK ships no test helpers, so an automated test means wiring transports, spawning processes and digging through raw results. Worse, the mistakes that hurt most never throw: a vague tool description, an odd tool name or a schema that doesn't match what the handler expects just makes the model pick the wrong tool or send bad arguments.",
    features: [
      {
        title: "Test client",
        body: "createTestClient() connects to an McpServer in memory (no child process, no network) or launches any server over stdio. Tool listings are cached, and call() validates arguments against the tool's own inputSchema before sending.",
      },
      {
        title: "Assertions",
        body: "expectToolResult(res).toSucceed().toHaveText(/…/).toMatchStructured({…}) reads like the test runner you already use, and works in vitest, jest or node:test.",
      },
      {
        title: "Conformance checker",
        body: "Nine checks: server identity, tools/list works, unique and well-formed names, every tool described, descriptions long enough to be useful, object input schemas, required fields that exist, and graceful handling of an unknown tool. Error-level failures make the report fail; warnings don't.",
      },
      { title: "Mock servers", body: "mockServer() builds a throwaway server from a few lines of tool specs, for fixtures or for testing your client code." },
      { title: "CLI", body: "inspect, check and call any stdio server without writing a script, including as a CI step." },
    ],
    helps: [
      { before: "Each test sets up a transport, connects, lists tools and unwraps content blocks by hand.", after: "One line: createTestClient({ server }), then call and assert." },
      { before: "A wrong argument comes back from the server as an isError text blob, and the test may still pass.", after: "The call throws before it is sent, naming the field and the expected type." },
      { before: "Users find the confusing tool names and missing descriptions after you ship.", after: "conformanceCheck() in your test suite, or npx @sriramadari/mcp-devkit check in CI, fails the build first." },
    ],
    useWhen: ["You are building an MCP server and want real tests for it.", "You want to vet a third-party MCP server before handing it to an agent.", "You want a conformance gate in CI."],
    notFor: ["Load testing or fuzzing a server.", "A full JSON Schema implementation (the built-in validator covers what tool schemas use; reach for ajv beyond that)."],
    howItWorks:
      "A thin layer over the official SDK client. In-memory tests use the SDK's linked InMemoryTransport pair, so client and server talk real JSON-RPC inside one process. The stdio transport loads only when you target a command, which keeps the rest browser-safe. Argument validation uses a small built-in JSON Schema validator, so there are no runtime dependencies beyond the SDK.",
  },

  "ai-observer": {
    summary: "One client for Anthropic, OpenAI and Gemini with retries, response caching, cost tracking, tracing and prompt versioning built in.",
    problem:
      "Every app that calls an LLM ends up writing the same plumbing around the vendor SDK: retrying 429s, caching repeated prompts, working out what each call cost and remembering which prompt version produced an answer. Each vendor has a different SDK and response shape, so adding a second provider or switching models means writing that plumbing again.",
    features: [
      { title: "One client, three providers", body: "chat() and complete() work the same across Anthropic, OpenAI and Gemini, over plain HTTPS with no vendor SDK. Every call returns one shape: text, usage, costUsd, cached, latencyMs, and the raw body." },
      { title: "Retries", body: "429s, 5xx errors and network failures retry with exponential backoff and jitter, and a retry-after header is honoured. Other 4xx errors fail at once, so a bad request doesn't burn retries." },
      { title: "Response cache", body: "Redis (pass an ioredis client) or in-memory, keyed by a SHA-256 of the normalized request with a configurable TTL. Cache hits cost $0." },
      { title: "Cost tracking", body: "Per-model prices turn token usage into USD on every call. Override the table for new models or negotiated rates." },
      { title: "Tracing", body: "Every request is recorded, then rolled up into count, errors, cache hit rate, average latency, tokens and cost by provider and by model. onTrace streams records to your own logs." },
      { title: "Prompt versioning", body: "Register named templates with {{variables}} and pin a version with name@2, so a change to a prompt is deliberate and traceable." },
    ],
    helps: [
      { before: "Switching from OpenAI to Claude means new SDK calls and new response parsing.", after: "Change provider and model; the rest of your code is untouched." },
      { before: "A burst of 429s from the provider turns into 500s for your users.", after: "The client waits as told and retries; users see a slower answer, not an error." },
      { before: "Repeated prompts (FAQs, evals, users pressing retry) are billed every time.", after: "Identical requests come from the cache at zero cost." },
      { before: "\"What did we spend on gpt-4o this week?\" needs a dashboard export.", after: "getStats().byModel, or your own sink via onTrace." },
    ],
    useWhen: ["A backend calls one or more LLM APIs for text completions.", "You want caching, retries and cost numbers without adopting a framework.", "Code that must run on Node, Bun, Deno, edge runtimes or in the browser."],
    notFor: ["Streaming responses or tool calling; it covers request/response text chat today.", "Agent orchestration. It is the HTTP layer underneath, not a framework on top."],
    howItWorks:
      "Each call runs through a fixed pipeline: normalize the request, look up the cache, call the provider adapter inside the retry loop, price the usage, store the result, record a trace. Adapters are about fifty lines each and only translate between the unified shape and each vendor's wire format. It uses the global fetch (or one you inject) and has no dependencies.",
  },

  "bullmq-devkit": {
    summary: "The operations toolkit BullMQ doesn't ship: health checks, Prometheus metrics, failed-job triage, retry debugging and cron validation, as a library and a CLI.",
    problem:
      "BullMQ is a queue, not an ops layer. When jobs pile up or start failing in production you end up in redis-cli or a dashboard counting failures by hand, writing one-off scripts to retry them, and guessing why a job keeps retrying. A typo in a cron pattern shows up as a job that silently never runs.",
    features: [
      { title: "Health checks", body: "checkQueueHealth() compares waiting, active, delayed and failed counts, the failure ratio and the paused flag against thresholds. Over a threshold is degraded, over twice it is unhealthy, and the worst check sets the overall status." },
      { title: "Prometheus metrics", body: "bullmq_jobs{queue, state} and bullmq_queue_paused in the text exposition format. createMetricsHandler() gives you a /metrics route for Express or plain http." },
      { title: "Failed-job triage", body: "summarizeFailures() groups failed jobs by the first line of their error. retryFailedJobs(), purgeFailedJobs() and archiveFailedJobs() act on them, filtered by reason, age or any predicate." },
      { title: "Retry debugging", body: "inspectJob() returns a job's state, attempts, trimmed stack, timings and the estimated time of its next retry, using the same backoff math as BullMQ." },
      { title: "Cron validation", body: "validateCron() reports errors and suspicious patterns (every second, a date that never occurs); getNextRuns() lists upcoming run times in UTC." },
      { title: "CLI", body: "health, metrics, failed, retry, purge, inspect and cron, with queues discovered from Redis so most commands need no configuration." },
    ],
    helps: [
      { before: "\"Is the email queue OK?\" means opening a dashboard and eyeballing counts.", after: "A /health/queues endpoint your uptime monitor or load balancer can poll." },
      { before: "4,000 failed jobs and no idea which errors matter.", after: "Three failure reasons with counts; retry the transient one, purge the rest." },
      { before: "Queue alerting needs a custom exporter.", after: "Point the Prometheus you already run at /metrics." },
      { before: "0 0 31 2 * deploys fine and never fires.", after: "The validator warns before you ship it." },
    ],
    useWhen: ["You run BullMQ in production and need visibility and triage tools.", "You want queue health in your existing monitoring rather than another dashboard."],
    notFor: ["A visual dashboard (pair it with Bull Board).", "Managing workers or processing jobs; it only reads and acts on queue state."],
    howItWorks:
      "Every function takes an ordinary BullMQ Queue you already have and uses its public methods (getJobCounts, getFailed, getJob, job.retry and so on), so nothing about how you create queues changes. bullmq is a peer dependency imported only for types, and the cron parser is self-contained.",
  },

  "bullmq-autoqueue": {
    summary: "A convention-based loader for BullMQ: put a processor in a folder and get a configured queue, worker and Bull Board entry, with no central registry to edit.",
    problem:
      "Every BullMQ queue needs the same boilerplate: a Queue, a Worker, event logging, retry defaults and a line in the Bull Board setup, usually all in one central file that everyone edits. Adding a queue means touching several places, forgetting one of them (often the dashboard) is common, and defaults drift from queue to queue.",
    features: [
      { title: "Folder convention", body: "Any folder that contains processor.js (or .mjs, .cjs, .ts) is a queue, named after the folder in kebab-case. An optional config file beside it overrides the name, concurrency or job options. Folders without a processor group queues and can nest." },
      { title: "Full wiring", body: "Each queue gets a Queue and a Worker with your defaults merged under its own config, completed and failed logging, and an entry in one shared Bull Board router." },
      { title: "Registry", body: "registry.add(name, job, data) enqueues by name and rejects unknown names; closeAll() and installGracefulShutdown() drain workers on SIGTERM and SIGINT." },
      { title: "Scaffolder", body: "npx bullmq-auto --generate \"send welcome sms\" writes the folder in your project's style (CommonJS, ESM or TypeScript)." },
      { title: "bullmq-autoqueue/core", body: "The convention logic with no Node or bullmq imports, for previews, linting or build tools." },
    ],
    helps: [
      { before: "A new queue touches the queue file, the worker file and the dashboard setup.", after: "Create one folder. Nothing else changes." },
      { before: "Retry settings are copy-pasted and drift between queues.", after: "One set of defaults; a queue overrides only what it needs." },
      { before: "A queue missing from Bull Board goes unnoticed for weeks.", after: "The dashboard is built from the same list, so it can't fall out of sync." },
      { before: "Two queues with the same name collide quietly in Redis.", after: "Startup fails with a clear duplicate-name error." },
    ],
    useWhen: ["An Express (or any Node) service with several BullMQ queues.", "Teams where many people add queues and a central file keeps conflicting."],
    notFor: ["Single-queue apps, where plain BullMQ is simpler.", "Queues created at runtime from data; pass those as explicit definitions instead."],
    howItWorks:
      "At startup loadQueues() walks the folder, imports each processor and config (ESM or CommonJS), validates them, merges settings over your defaults and builds the queues. Bull Board packages are optional peers, loaded only when the dashboard is on.",
  },

  "node-observe": {
    summary: "Lightweight observability for a Node.js API: route latency percentiles, MongoDB and Redis timings, memory-leak detection and Slack alerts, without an agent or a SaaS bill.",
    problem:
      "Small teams often run without an APM, because an agent and a monthly bill feel like overkill for one or two services. Then the first sign of a slow endpoint, a missing Mongo index or a memory leak is a user complaint or an out-of-memory restart.",
    features: [
      { title: "API latency", body: "Express middleware records p50, p95 and p99 per route, 5xx error counts and status-class counters. Numeric IDs, ObjectIds and UUIDs in paths collapse to :id, so /users/42 and /users/43 share one row." },
      { title: "MongoDB timing", body: "A global Mongoose plugin times every query, aggregate and save, labelled Model.op." },
      { title: "Redis timing", body: "Wraps an ioredis client and times every command by name." },
      { title: "Leak detection", body: "Samples the heap every 15 seconds and fits a line through the last 30 samples. A sustained slope in MB per minute raises the alert; one high reading after a busy GC cycle doesn't." },
      { title: "Alerts", body: "Threshold breaches go to a Slack webhook or your onAlert handler, with a per-key cooldown (60 seconds by default) so one slow route can't flood the channel." },
      { title: "/insights", body: "insights.handler() serves everything above as one JSON snapshot." },
    ],
    helps: [
      { before: "\"The app feels slow\" with nothing to point at.", after: "The route, its p95, and the query inside it that crossed the threshold." },
      { before: "Averages hide the slow tail that users actually notice.", after: "Percentiles per route, kept in fixed-size buffers." },
      { before: "A leak shows up as an out-of-memory restart at 3am.", after: "A Slack message about steady heap growth, hours earlier." },
      { before: "An APM agent and per-host pricing for one service.", after: "One package, no agent, nothing to run alongside it." },
    ],
    useWhen: ["A Node service on Express, Mongoose and ioredis with no APM yet.", "You want alerts on slow routes, slow queries and leaks in a few lines of setup."],
    notFor: ["Distributed tracing across many services.", "Long-term metric storage; scrape /insights into a store you already have."],
    howItWorks:
      "Everything lives in memory inside your process. Each metric keeps a 1,024-sample ring buffer, so memory stays flat no matter how much traffic you get, and percentiles come from that recent window. express, mongoose and ioredis are duck-typed rather than imported, so the package depends on none of them.",
  },
};
