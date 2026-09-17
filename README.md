# WoW Market Dashboard

A small client-side market portfolio dashboard for WoW Forever.

## Features

- Up to dozens of market positions without a giant spreadsheet.
- Drag-and-drop manual priority ordering.
- Margin, turnover, sustainable acquisition rate, current stock and target buffer.
- Market status: Focus, Maintain, Watch, Speculate, Review, Drop.
- Suggested attention score (advisory only).
- Notes and last-checked date.
- Data persists in the browser with `localStorage`.
- No backend or account required.
- Vite + React + TypeScript, suitable for GitHub Pages.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The `dist/` directory is the static site.

## GitHub Pages

This project uses a relative Vite base (`./`), so the generated static files can be hosted under a repository path on GitHub Pages.

A future improvement would be a GitHub Actions workflow that automatically builds and deploys `dist/` whenever `main` changes.

## Data model

Each market currently stores:

- name
- margin percentage
- daily turnover percentage
- sustainable acquisition per day
- current stock
- target stock
- last checked date
- status
- notes

The suggested score is intentionally only a hint. Manual drag-and-drop priority is authoritative.
