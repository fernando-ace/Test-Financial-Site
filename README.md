# Income Ladder Snapshot

A static advisor tool for turning a private Income Ladder workbook into a concise client-ready PDF. Excel remains the source of truth; the app only reads an uploaded workbook in the browser and renders a clean web preview plus a compact print report.

No backend, database, authentication, serverless functions, analytics, or paid services are used.

## What the App Does

- Lets an advisor upload a local `.xlsx`, `.xls`, or `.xlsm` Income Ladder workbook.
- Parses displayed workbook values locally in browser memory.
- Summarizes annual cash flow, shortfall timing, distributions, withdrawals, and upcoming maturities.
- Adds report metadata fields for client name, prepared by, and report date.
- Generates a client PDF through the browser print flow.
- Clears all visible report data from React state when the advisor clears the report.

## Tech Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Recharts
- SheetJS/xlsx

## Run Locally

```bash
npm install
npm run dev
```

Vite will print the local URL in the terminal.

## Build

```bash
npm run build
```

The production build is written to `dist/` and is fully static.

## GitHub Pages Deployment From `main`

This repo is configured for a GitHub Project Page:

```text
https://fernando-ace.github.io/Income-Ladder-Snapshot/
```

`vite.config.ts` keeps the required project base path:

```ts
base: "/Income-Ladder-Snapshot/"
```

In GitHub Pages settings, use:

```text
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

Before pushing, run:

```bash
npm run build:pages
```

That command builds the Vite app, syncs the latest built bundle into root `assets/`, and updates the GitHub Pages fallback in `index.html` so the `main` branch can serve the app directly. This repo no longer uses a `gh-pages` branch.

## Privacy

The app is fully static and local-only. Uploaded workbooks are parsed locally in the browser and are not uploaded to a backend.

Workbook contents are kept in React memory state only. The app does not persist uploaded workbook data to localStorage, sessionStorage, IndexedDB, cookies, URL params, backend APIs, analytics, or external services.

Real advisor or client workbooks should never be committed to this repo or placed in `/public`. The local advisor workbook used during development is not part of the public app.
