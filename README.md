# Client Financial Snapshot

An internal advisor proof of concept for turning Excel planning workbooks into clean client-ready summaries, screenshots, and PDFs. Excel remains the source of truth; the app visualizes workbook data in the browser without requiring private advisor files to be committed to the repo.

No backend, database, authentication, serverless functions, or paid services are used.

## What the App Does

- Loads the included MoneySense workbook as sample demo data.
- Lets an advisor upload a local `.xlsx` or `.xls` workbook for in-browser parsing.
- Converts workbook line items into KPI cards, charts, source rows, and report insights.
- Adds report metadata fields for client name, prepared by, and report date.
- Generates a client PDF through the browser print flow.

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
https://fernando-ace.github.io/Client-Financial-Snapshot/
```

`vite.config.ts` keeps the required project base path:

```ts
base: "/Client-Financial-Snapshot/"
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

That command builds the Vite app, syncs the latest built bundle into root `assets/`, and updates the GitHub Pages fallback in `index.html` so the `main` branch can serve the app directly.

The old `gh-pages` branch deploy command is still available as `npm run deploy:gh-pages` if it is ever needed again.

## Privacy

The sample workbook in `public/` is demo data. Real advisor workbooks do not need to be committed to `/public` or bundled with the app.

Uploaded Excel files are parsed locally in the browser for this proof of concept. Financial workbook data is not sent to a server by the app.
