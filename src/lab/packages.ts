// The packages shown in the lab. Versions are the ones the demos run.

export type PackageInfo = {
  slug: string;
  name: string;
  npmName: string;
  version: string;
  tagline: string;
  /** What the demo shows, in one line. */
  demo: string;
  /** What is real vs simulated in the demo. Shown on every demo page. */
  realNote: string;
  install: string;
  repo: string;
  npm: string;
  color: "cobalt" | "amber" | "teal" | "rose";
};

export const packages: PackageInfo[] = [
  {
    slug: "mcp-devkit",
    name: "mcp-devkit",
    npmName: "@sriramadari/mcp-devkit",
    version: "0.1.1",
    tagline: "Test and lint Model Context Protocol servers.",
    demo: "Build an MCP server, connect a test client, call its tools and run the conformance battery.",
    realNote:
      "A real MCP server and client from the official SDK, connected in memory in this tab. Every check, validation error and JSON-RPC frame below is produced by the package.",
    install: "npm install -D @sriramadari/mcp-devkit",
    repo: "https://github.com/sriramadari/mcp-devkit",
    npm: "https://www.npmjs.com/package/@sriramadari/mcp-devkit",
    color: "rose",
  },
  {
    slug: "ai-observer",
    name: "ai-observer",
    npmName: "ai-observer",
    version: "0.2.0",
    tagline: "One client for OpenAI, Anthropic and Gemini, with the production glue built in.",
    demo: "Send prompts through the client while the provider rate-limits and fails, and watch retries, caching and cost.",
    realNote:
      "The real client, retry, cache, pricing and tracer run here. Only the provider is simulated: a fake fetch answers in each vendor's actual wire format, so the real adapters parse it.",
    install: "npm install ai-observer",
    repo: "https://github.com/sriramadari/ai-observer",
    npm: "https://www.npmjs.com/package/ai-observer",
    color: "cobalt",
  },
  {
    slug: "bullmq-devkit",
    name: "bullmq-devkit",
    npmName: "bullmq-devkit",
    version: "0.1.0",
    tagline: "Health checks, Prometheus metrics, dead letters and cron validation for BullMQ.",
    demo: "Run two simulated queues, break them, and diagnose them with the toolkit.",
    realNote:
      "Health checks, metrics, failure grouping, retries, purges, job inspection and cron parsing are the real package. The queues are an in-memory stand-in for Redis that implements the BullMQ methods the toolkit calls.",
    install: "npm install bullmq-devkit",
    repo: "https://github.com/sriramadari/bullmq-devkit",
    npm: "https://www.npmjs.com/package/bullmq-devkit",
    color: "amber",
  },
  {
    slug: "bullmq-autoqueue",
    name: "bullmq-autoqueue",
    npmName: "bullmq-autoqueue",
    version: "0.3.0",
    tagline: "Drop a folder with a processor, get a wired queue, worker and dashboard entry.",
    demo: "Edit a queues/ folder and see which queues the convention registers, with what settings.",
    realNote:
      "Discovery, naming, config validation, duplicate detection, settings merge and the scaffold templates all come from bullmq-autoqueue/core. The folder tree is virtual instead of on disk.",
    install: "npm install bullmq-autoqueue",
    repo: "https://github.com/sriramadari/bullmq-autoqueue",
    npm: "https://www.npmjs.com/package/bullmq-autoqueue",
    color: "amber",
  },
  {
    slug: "node-observe",
    name: "node-observe",
    npmName: "node-observe",
    version: "0.2.0",
    tagline: "API latency, MongoDB and Redis timing, leak detection and Slack alerts. No agent.",
    demo: "Point simulated traffic at an API, inject slow queries or a memory leak, and watch what it catches.",
    realNote:
      "Percentiles, path normalization, threshold alerts, cooldowns, the leak regression and the Slack message are the real Insights class. Requests, queries and heap readings are simulated.",
    install: "npm install node-observe",
    repo: "https://github.com/sriramadari/node-observe",
    npm: "https://www.npmjs.com/package/node-observe",
    color: "teal",
  },
];

export const bySlug = (slug: string) => packages.find((p) => p.slug === slug);
