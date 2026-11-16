import { contributions, education, projects, site, type SpanColor } from "./data";
import { packages } from "./lab/packages";

// The "about" section as a tree. Built from data.ts where it can be, so facts live in one place.

export type TreeLink = { label: string; href: string; internal?: boolean };

export type TreeNode = {
  id: string;
  label: string;
  kind: "root" | "dir" | "role" | "system" | "package" | "repo" | "pr" | "skills" | "fact";
  color: SpanColor;
  title: string;
  detail?: string;
  meta?: [string, string][];
  links?: TreeLink[];
  children?: TreeNode[];
};

const pkgColor = (slug: string): SpanColor =>
  (packages.find((p) => p.slug === slug)?.color as SpanColor | undefined) ?? "rose";

const builds: TreeNode[] = projects
  .filter((p) => p.demo)
  .map((p) => ({
    id: `pkg-${p.demo}`,
    label: p.name,
    kind: "package",
    color: pkgColor(p.demo!),
    title: p.name,
    detail: p.summary,
    meta: [
      ["stack", p.stack.join(", ")],
      ["status", p.status],
    ],
    links: [
      { label: "live demo", href: `/packages/${p.demo}`, internal: true },
      ...(p.npm ? [{ label: "npm", href: p.npm }] : []),
      ...(p.repo ? [{ label: "source", href: p.repo }] : []),
    ],
  }));

const repos = Array.from(new Set(contributions.map((c) => c.repo)));
const upstream: TreeNode[] = repos.map((repo) => {
  const prs = contributions.filter((c) => c.repo === repo);
  return {
    id: `repo-${repo}`,
    label: repo,
    kind: "repo",
    color: "teal",
    title: repo,
    detail: `${prs[0].about}. Fixes I found while using it, merged by the maintainers.`,
    meta: [
      ["merged PRs", String(prs.length)],
      ["areas", Array.from(new Set(prs.flatMap((p) => p.area))).join(", ")],
    ],
    links: [{ label: "repository", href: prs[0].repoUrl }],
    children: prs.map((c) => ({
      id: `pr-${c.pr}`,
      label: `#${c.pr}`,
      kind: "pr",
      color: "teal",
      title: c.title,
      detail: c.summary,
      meta: [
        ["state", "merged"],
        ["when", c.merged],
        ["area", c.area.join(", ")],
      ],
      links: [{ label: `PR #${c.pr}`, href: c.url }],
    })),
  };
});

export const tree: TreeNode = {
  id: "root",
  label: "sriram",
  kind: "root",
  color: "cobalt",
  title: site.name,
  detail:
    "Founding engineer. I own systems end to end, from the database to the app in your hand, and build the tooling that keeps LLM features honest in production.",
  meta: [
    ["role", "Founding Software Engineer"],
    ["shipping since", "Sep 2023"],
    ["focus", "LLM tooling, queues, observability"],
    ["based in", site.location],
    ["status", "open to Applied AI / FDE roles"],
  ],
  links: [
    { label: "github", href: site.github },
    { label: "linkedin", href: site.linkedin },
    { label: "email", href: `mailto:${site.email}` },
  ],
  children: [
    {
      id: "work",
      label: "work/",
      kind: "dir",
      color: "cobalt",
      title: "Work",
      detail: "Where the production experience comes from.",
      meta: [["roles", "2"]],
      children: [
        {
          id: "propeers",
          label: "propeers",
          kind: "role",
          color: "cobalt",
          title: "Founding Software Engineer, ProPeers",
          detail:
            "First engineering hire on an ed-tech platform. I own the Node.js backend, the Next.js web app, the React Native app and the admin dashboard, and report to the founders.",
          meta: [
            ["since", "Mar 2024"],
            ["users", "500k+"],
            ["surface", "backend, web, mobile, admin"],
            ["services", "6, one monorepo"],
          ],
          children: [
            {
              id: "pp-cache",
              label: "api.cache",
              kind: "system",
              color: "teal",
              title: "Redis caching in the API layer",
              detail: "Read-through caching on the hot endpoints, with invalidation tied to writes.",
              meta: [
                ["result", "~70% faster responses"],
                ["tech", "Redis, Node.js"],
              ],
            },
            {
              id: "pp-web",
              label: "web.perf",
              kind: "system",
              color: "teal",
              title: "Next.js performance",
              detail: "Static ISR landings, deferred third-party scripts and leaner bundles on the pages ads send traffic to.",
              meta: [
                ["LCP / FCP", "4.4s → ~990ms"],
                ["tech", "Next.js, ISR"],
              ],
            },
            {
              id: "pp-mail",
              label: "mail.pipeline",
              kind: "system",
              color: "amber",
              title: "Async email and campaign pipeline",
              detail:
                "Queue-backed transactional and campaign mail: one-click unsubscribe, automatic bounce suppression, duplicate-send guards and per-sender warm-up.",
              meta: [
                ["tech", "BullMQ, Redis, AWS SES, Azure Communication Services"],
                ["shape", "producer API → queue → workers"],
              ],
            },
            {
              id: "pp-webinar",
              label: "webinar.funnel",
              kind: "system",
              color: "amber",
              title: "Webinar funnel on Zoom",
              detail:
                "A Zoom webinar per slot, a unique join link per lead, attendance synced from Zoom reports, and scheduled nurture sequences after each session.",
              meta: [
                ["tech", "Zoom API, BullMQ schedulers, MongoDB"],
                ["runs", "hourly + per-slot jobs"],
              ],
            },
            {
              id: "pp-db",
              label: "db.migration",
              kind: "system",
              color: "teal",
              title: "MongoDB off Atlas",
              detail: "Moved production MongoDB to self-hosted Azure VMs with replica sets and automated backups to Blob Storage.",
              meta: [
                ["topology", "replica set"],
                ["backups", "automated, Azure Blob"],
              ],
            },
            {
              id: "pp-ai",
              label: "ai.assistant",
              kind: "system",
              color: "rose",
              title: "Personalized learning assistant",
              detail: "Retrieval-augmented assistant over course content, shipped on web and mobile.",
              meta: [
                ["retrieval", "OpenAI embeddings + ChromaDB"],
                ["clients", "Next.js, React Native"],
              ],
            },
            {
              id: "pp-pay",
              label: "payments",
              kind: "system",
              color: "amber",
              title: "Payments",
              detail: "Revenue-critical checkout and upgrade flows on Razorpay, including tax and coupon math, owned through incidents.",
              meta: [["provider", "Razorpay"]],
            },
          ],
        },
        {
          id: "evaluate",
          label: "evaluate-health",
          kind: "role",
          color: "amber",
          title: "Software Engineer Intern, Evaluate Health",
          detail: "Flask APIs and third-party integrations, MySQL schema design, and React Native screens with S3 upload flows.",
          meta: [
            ["when", "Sep 2023 to Feb 2024"],
            ["tech", "Python, Flask, MySQL, React Native, S3"],
          ],
        },
      ],
    },
    {
      id: "builds",
      label: "builds/",
      kind: "dir",
      color: "rose",
      title: "Open source packages",
      detail: "Tools I built because I needed them at work first. All on npm, each with a live in-browser demo.",
      meta: [
        ["packages", String(builds.length)],
        ["language", "TypeScript"],
      ],
      links: [{ label: "package lab", href: "/packages", internal: true }],
      children: builds,
    },
    {
      id: "upstream",
      label: "upstream/",
      kind: "dir",
      color: "teal",
      title: "Upstream contributions",
      detail: "Merged pull requests to projects other people maintain.",
      meta: [["merged PRs", String(contributions.length)]],
      children: upstream,
    },
    {
      id: "stack",
      label: "stack/",
      kind: "dir",
      color: "amber",
      title: "Stack",
      detail: "What I reach for, grouped by layer.",
      children: [
        { id: "st-ai", label: "ai", kind: "skills", color: "rose", title: "AI", meta: [["uses", "MCP, RAG, embeddings, tool calling"], ["models", "OpenAI, Anthropic, Gemini"], ["store", "ChromaDB"]] },
        { id: "st-be", label: "backend", kind: "skills", color: "cobalt", title: "Backend", meta: [["languages", "TypeScript, JavaScript, Python"], ["runtime", "Node.js, Express, Flask"], ["async", "BullMQ, cron schedulers"]] },
        { id: "st-data", label: "data", kind: "skills", color: "teal", title: "Data", meta: [["databases", "MongoDB, PostgreSQL, MySQL"], ["cache / queues", "Redis"]] },
        { id: "st-client", label: "clients", kind: "skills", color: "amber", title: "Clients", meta: [["web", "React, Next.js"], ["mobile", "React Native, Expo, OTA updates"]] },
        { id: "st-infra", label: "infra", kind: "skills", color: "cobalt", title: "Infra", meta: [["cloud", "Azure, AWS"], ["ops", "Docker, pm2, GitHub Actions, Netlify, Vercel"]] },
      ],
    },
    {
      id: "edu",
      label: "edu/",
      kind: "dir",
      color: "amber",
      title: "Education",
      detail: `${education.degree}, ${education.school}.`,
      children: [
        { id: "ed-deg", label: "b.tech", kind: "fact", color: "amber", title: education.degree, detail: education.school, meta: [["when", education.when], ["CGPA", "8.7 / 10"]] },
        { id: "ed-hack", label: "hackathons", kind: "fact", color: "rose", title: "Hackathons", meta: [["GDSC WOW, 48h", "Best Innovative Track (PoolPay)"], ["SuShacks, 36h", "3rd of 75+ teams (MenuMate)"]] },
        { id: "ed-cp", label: "problem-solving", kind: "fact", color: "teal", title: "Competitive programming", meta: [["LeetCode", "600+ solved"], ["CodeChef", "3 star"], ["Codeforces", "Pupil"]] },
        { id: "ed-gdsc", label: "gdsc", kind: "fact", color: "cobalt", title: "Web Development Lead, GDSC VIIT", detail: "Ran web development for the Google Developer Student Club." },
      ],
    },
  ],
};

export const metrics: { value: string; label: string }[] = [
  { value: "500k+", label: "users on the platform I build" },
  { value: "4.4s→0.99s", label: "LCP on the Next.js app" },
  { value: "−70%", label: "API response time with Redis" },
  { value: String(builds.length), label: "npm packages, each with a live demo" },
  { value: String(contributions.length), label: "PRs merged into Twenty (60k★)" },
];
