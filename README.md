# Monthly Budget Planner

A fully static Vite + React personal budget planner for GitHub Pages. The app loads the included MoneySense Excel workbook as starter template data, then lets each user edit income, expense categories, planned amounts, actual amounts, and monthly budget details directly in the browser.

No backend, database, authentication, serverless functions, or paid services are used.

## What the App Does

- Loads `MoneySense-monthly-budget-template-v1.xlsx` client-side with SheetJS/xlsx.
- Converts workbook line items into editable React state.
- Lets users add, edit, move, duplicate, and delete budget rows.
- Calculates KPI cards, category cards, charts, budget balance, and planned-vs-actual differences from live edited data.
- Saves each month separately in `localStorage`.
- Exports the current budget as JSON or CSV and imports JSON backups.

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

## GitHub Pages Deployment

This repo is configured for a GitHub Project Page:

```text
https://fernando-ace.github.io/Test-Financial-Site/
```

`vite.config.ts` keeps the required project base path:

```ts
base: "/Test-Financial-Site/"
```

To publish with `gh-pages`:

```bash
npm run deploy
```

Then enable GitHub Pages in the repository settings and set the source branch to `gh-pages`.

## localStorage and Privacy

Budgets are stored only in the user's browser with month-specific keys such as:

```text
budget-dashboard:2026-05
```

On first visit for a month, the app uses the Excel workbook as the default template. After an edit, the app saves that month to `localStorage`; refreshing the page reloads the saved browser copy instead of resetting to the template.

Financial data is not sent to any server. Import, export, CSV download, reset, and clear actions all happen client-side.

## User Data Tools

- **Export JSON** saves the current month as a backup file.
- **Import JSON** restores a previously exported budget into the selected month.
- **Download CSV** exports the current editable table.
- **Reset to template** clears the selected month's saved browser data and reloads the original Excel template.
- **Clear all data** saves an empty budget for the selected month.

Destructive actions ask for confirmation before changing saved data.
