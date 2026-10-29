# sriram.dev

Personal portfolio. React 19 + Vite + TypeScript, no UI framework.

All content lives in `src/data.ts`. The resume served at `/resume.pdf` lives in `public/`.

## Package lab

`/packages` is a live demo of each npm package (mcp-devkit, ai-observer, bullmq-devkit,
bullmq-autoqueue, node-observe). The demos import the real packages and run them in the
browser; only the network, Redis and the filesystem are simulated. Code is in `src/lab/`,
one lazily loaded chunk per demo. `vercel.json` rewrites `/packages/*` to the SPA.

## Run locally

```bash
npm install
npm run dev
```

## Deploy

Live at https://sriramadari.github.io. `.github/workflows/deploy.yml` builds and publishes to
GitHub Pages on every push to `main`. Pages has no rewrites, so the workflow copies the app
shell to each `/packages/*` route and to `404.html`.

It also deploys on Vercel as is: import the repo at vercel.com/new (preset Vite, output `dist`);
`vercel.json` handles the `/packages/*` rewrites there.

The hero is a terminal (`src/Terminal.tsx`): it types out a short intro once per session, then visitors can run commands; `help` lists them. Its copy (`role`, `intro`, `fit`, `openTo`) is in `src/data.ts`.

Keyboard: `j` / `k` move between sections, `t` switches theme, `/` or Cmd/Ctrl+K opens the command menu.
