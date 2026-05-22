# Monthly Budget Dashboard

A static Vite + React dashboard that reads `MoneySense-monthly-budget-template.xlsx` from the public folder and turns the workbook's `Summary` sheet into a polished personal finance dashboard.

## Tech Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- SheetJS/xlsx
- Recharts

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

## Build

```bash
npm run build
```

The production build is written to `dist/` and is fully static. The app loads the Excel workbook client-side from `public/MoneySense-monthly-budget-template.xlsx`.

## GitHub Pages Deployment

This repo is configured for a GitHub Project Page at:

```text
https://USERNAME.github.io/Test-Financial-Site/
```

`vite.config.ts` uses:

```ts
base: "/Test-Financial-Site/"
```

If you rename the repository, update that `base` value to match the new repository name.

To deploy with `gh-pages`:

```bash
npm run deploy
```

Then enable GitHub Pages in the repository settings and set the source branch to `gh-pages`.

## Workbook Notes

The dashboard parses the workbook's `Summary` sheet and extracts section names, line items, planned values, actual values, and differences where available. Blank or missing cells are treated as zero so the dashboard does not crash when the template is empty.
