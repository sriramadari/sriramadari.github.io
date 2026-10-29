// Everything on the page comes from this file. Edit here, not in the components.
// Leave a link as "" to hide it.

export const site = {
  name: "Sriram Adari",
  role: "AI engineer, backend and LLM tooling",
  location: "Visakhapatnam, India",
  // Hero copy is about what I build, not any one employer. Work history lives in `jobs`.
  intro:
    "I build the layer that gets LLM features into production: MCP servers and the tools to test them, one client for OpenAI, Anthropic and Gemini with retries, caching and cost tracking, and the queues and observability that keep it all running. Five of those tools are open source on npm, each with a live demo.",
  // Why this fits Forward Deployed and Applied AI roles. Shown as `cat fit.md` in the hero.
  fit: [
    "Take an AI idea from prototype to production: retrieval, tool calling over MCP, prompt versioning, cost and latency tracking.",
    "Own the full path: APIs, web and mobile clients, queues, caching, monitoring, and the fix when it breaks.",
    "Build tools other engineers can pick up: typed, tested, documented, and demoable in a browser.",
  ],
  openTo: "Open to Applied AI Engineer and Forward Deployed Engineer roles, remote or hybrid.",
  email: "sriramadari.dev@gmail.com",
  github: "https://github.com/sriramadari",
  linkedin: "https://www.linkedin.com/in/sriramadari",
  x: "https://x.com/sriramadari",
  medium: "https://medium.com/@lakshmisriramadari1427",
  instagram: "https://instagram.com/sriramadari",
  resume: "/resume.pdf",
};

export type SpanColor = "cobalt" | "amber" | "teal" | "rose";

export type Span = {
  service: string;
  op: string;
  start: number; // 0 to 1 along the career timeline
  end: number;
  depth: 0 | 1 | 2;
  color: SpanColor;
  detail: string;
};

// The hero trace. The timeline runs Sep 2023 to now; positions show overlap, not exact dates.
export const spans: Span[] = [
  {
    service: "sriram",
    op: "career",
    start: 0,
    end: 1,
    depth: 0,
    color: "cobalt",
    detail: "Three years of shipping production software, starting with an internship. Still running.",
  },
  {
    service: "evaluate-health",
    op: "intern",
    start: 0,
    end: 0.16,
    depth: 1,
    color: "amber",
    detail: "Flask APIs, MySQL schemas and React Native screens with S3 upload flows.",
  },
  {
    service: "propeers",
    op: "founding_engineer",
    start: 0.16,
    end: 1,
    depth: 1,
    color: "cobalt",
    detail:
      "First engineering hire. Own the Node.js backend, Next.js web, React Native app and admin dashboard end to end.",
  },
  {
    service: "payments",
    op: "razorpay",
    start: 0.2,
    end: 1,
    depth: 2,
    color: "amber",
    detail: "Revenue critical payment flows on Razorpay, handled independently through incidents.",
  },
  {
    service: "mail",
    op: "bullmq_ses",
    start: 0.3,
    end: 0.6,
    depth: 2,
    color: "amber",
    detail: "Async email processing service on Node.js, BullMQ, Redis and AWS SES for transactional mail at scale.",
  },
  {
    service: "api",
    op: "redis_cache",
    start: 0.38,
    end: 0.56,
    depth: 2,
    color: "teal",
    detail: "Redis caching in the API layer cut response times by about 70%.",
  },
  {
    service: "web",
    op: "next_perf",
    start: 0.46,
    end: 0.64,
    depth: 2,
    color: "teal",
    detail: "Took the Next.js app's LCP/FCP from 4.4s to about 990ms.",
  },
  {
    service: "db",
    op: "mongo_migration",
    start: 0.58,
    end: 0.76,
    depth: 2,
    color: "teal",
    detail: "Moved MongoDB from Atlas to self hosted Azure VMs with replica sets and automated backups to Blob Storage.",
  },
  {
    service: "ai",
    op: "rag_assistant",
    start: 0.7,
    end: 1,
    depth: 2,
    color: "rose",
    detail: "Personalized learning assistant using RAG, OpenAI embeddings and ChromaDB, shipped on web and mobile.",
  },
  {
    service: "oss",
    op: "devtools",
    start: 0.84,
    end: 1,
    depth: 1,
    color: "rose",
    detail: "mcp-devkit, ai-observer, bullmq-devkit, bullmq-autoqueue and node-observe. All published on npm.",
  },
];

export type Job = {
  company: string;
  title: string;
  when: string;
  place: string;
  points: string[];
};

export const jobs: Job[] = [
  {
    company: "ProPeers",
    title: "Founding Software Engineer",
    when: "Mar 2024 to now",
    place: "Remote, India",
    points: [
      "First engineering hire. Ship features end to end across backend, web, mobile and admin for an ed-tech platform with 500k+ users, reporting directly to the founders.",
      "Took the Next.js app's LCP/FCP from 4.4s to about 990ms and built product UI from Figma designs.",
      "Cut API response times by about 70% with Redis caching, and built an async email service on BullMQ, Redis and AWS SES.",
      "Migrated MongoDB from Atlas to self hosted Azure VMs with replica sets and automated backups to Blob Storage.",
      "Built a personalized learning assistant using RAG, OpenAI embeddings and ChromaDB, shipped across web and mobile.",
      "Handle high severity incidents and Razorpay payment flows on my own, and guide teammates on system design.",
    ],
  },
  {
    company: "Evaluate Health",
    title: "Software Engineer Intern",
    when: "Sep 2023 to Feb 2024",
    place: "Remote, India",
    points: [
      "Built Flask (Python) APIs and third party integrations, and designed and tuned MySQL schemas.",
      "Built reusable React Native components and production screens, including AWS S3 upload flows.",
    ],
  },
];

export const education = {
  school: "Vignan's Institute of Information Technology",
  degree: "B.Tech, Computer Science and Engineering",
  when: "2021 to 2025",
  place: "Visakhapatnam",
  points: [
    "CGPA 8.7 / 10.",
    "Web Development Lead, Google Developer Student Club (GDSC), VIIT.",
    "Won Best Innovative Track at the GDSC WOW 48 hour hackathon with PoolPay.",
    "3rd of 75+ teams at the SuShacks 36 hour hackathon with MenuMate.",
    "600+ problems solved on LeetCode. 3 star on CodeChef, Pupil on Codeforces.",
  ],
};

export type Project = {
  name: string;
  summary: string;
  stack: string[];
  status: string;
  repo?: string;
  live?: string;
  npm?: string;
  /** Slug of the live demo in the package lab (/packages/<slug>). */
  demo?: string;
};

export const projects: Project[] = [
  {
    name: "mcp-devkit",
    demo: "mcp-devkit",
    summary:
      "Zero dependency testing toolkit for MCP servers: in-memory and stdio test clients, tool result assertions, input schema validation and an automated conformance checker. Library and CLI.",
    stack: ["TypeScript", "Node.js", "MCP"],
    status: "on npm · live demo",
    repo: "https://github.com/sriramadari/mcp-devkit",
    npm: "https://www.npmjs.com/package/@sriramadari/mcp-devkit",
  },
  {
    name: "ai-observer",
    demo: "ai-observer",
    summary:
      "One client for OpenAI, Anthropic and Gemini with retries, rate limit handling, Redis response caching, request tracing, cost tracking and prompt versioning.",
    stack: ["TypeScript", "Node.js", "LLM tracing"],
    status: "on npm · live demo",
    repo: "https://github.com/sriramadari/ai-observer",
    npm: "https://www.npmjs.com/package/ai-observer",
  },
  {
    name: "bullmq-devkit",
    demo: "bullmq-devkit",
    summary:
      "Zero dependency toolkit for BullMQ: health checks, Prometheus metrics, dead letter management, retry debugging and cron validation. Library and CLI.",
    stack: ["TypeScript", "BullMQ", "Redis"],
    status: "on npm · live demo",
    repo: "https://github.com/sriramadari/bullmq-devkit",
    npm: "https://www.npmjs.com/package/bullmq-devkit",
  },
  {
    name: "bullmq-autoqueue",
    demo: "bullmq-autoqueue",
    summary:
      "Convention based BullMQ queue loader. Drop in a folder with a processor and get a wired Queue, Worker and Bull Board dashboard entry.",
    stack: ["TypeScript", "BullMQ", "Bull Board"],
    status: "on npm · live demo",
    repo: "https://github.com/sriramadari/bullmq-autoqueue",
    npm: "https://www.npmjs.com/package/bullmq-autoqueue",
  },
  {
    name: "node-observe",
    demo: "node-observe",
    summary:
      "Lightweight backend observability for Node.js: API latency, MongoDB and Redis query timing, memory leak detection and Slack alerts. No agent.",
    stack: ["TypeScript", "Node.js", "MongoDB", "Redis"],
    status: "on npm · live demo",
    repo: "https://github.com/sriramadari/node-observe",
    npm: "https://www.npmjs.com/package/node-observe",
  },
  {
    name: "Support Chat",
    summary:
      "Businesses create AI support agents and embed a chat widget on any site with one script tag. Next.js dashboard for agents, tickets and analytics, Lyzr agents behind it.",
    stack: ["Next.js", "Node.js", "MongoDB", "Lyzr"],
    status: "live",
    repo: "https://github.com/sriramadari/chat-ai-agent",
    live: "https://lyzr-chat-agent.vercel.app",
  },
  {
    name: "SocialSync",
    summary: "Real time collaboration tool with low latency messaging, synced state and peer to peer video.",
    stack: ["Socket.io", "WebRTC", "Firebase", "MongoDB"],
    status: "live",
    repo: "https://github.com/sriramadari/SocialSync",
    live: "https://socialsync-eeuc.onrender.com/",
  },
  {
    name: "PoolPay",
    summary:
      "Pool money with a group for lending, spending or investing, with auto generated documentation. Won Best Innovative Track at the GDSC WOW 48 hour hackathon.",
    stack: ["React", "Node.js", "MongoDB"],
    status: "hackathon win",
    repo: "https://github.com/sriramadari/PoolPay-Backend",
    live: "https://pool-pay-frontend.vercel.app",
  },
];

export const stack = [
  "TypeScript",
  "Node.js",
  "Python",
  "React",
  "Next.js",
  "React Native",
  "MongoDB",
  "PostgreSQL",
  "Redis",
  "BullMQ",
  "AWS",
  "Azure",
  "RAG",
  "MCP",
];
