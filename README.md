# sriram.dev

Personal portfolio. React 19 + Vite + TypeScript, no UI framework.

All content lives in `src/data.ts`. The resume served at `/resume.pdf` lives in `public/`.

## Package lab

`/packages` is a live demo of each npm package (mcp-devkit, ai-observer, bullmq-devkit,
bullmq-autoqueue, node-observe). The demos import the real packages and run them in the
browser; only the network, Redis and the filesystem are simulated. Code is in `src/lab/`,
one lazily loaded chunk per demo. `vercel.json` rewrites `/packages/*` to the SPA.

Four packages are installed from their GitHub release tags (`github:sriramadari/<pkg>#vX.Y.Z`),
because the browser-compatible versions are not on npm yet. Once they are published, switch
each to the npm version, e.g. `npm install ai-observer@^0.2.0`.

## Run locally

```bash
npm install
npm run dev
```

## Push to GitHub

```bash
git init
git add .
git commit -m "Portfolio v1"
git branch -M main
git remote add origin https://github.com/<your-username>/portfolio.git
git push -u origin main
```

## Deploy on Vercel

1. vercel.com/new, import the repo.
2. Framework preset: Vite (auto detected). Build command `npm run build`, output `dist`.
3. Deploy. Every push to `main` redeploys.

The hero is a terminal (`src/Terminal.tsx`): it types out a short intro once per session, then visitors can run commands; `help` lists them. Its copy (`role`, `intro`, `fit`, `openTo`) is in `src/data.ts`.

Keyboard: `j` / `k` move between sections, `t` switches theme, `/` or Cmd/Ctrl+K opens the command menu.
