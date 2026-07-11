# Ignatius Day Fund Splitter

A small web app for dividing event costs fairly across a class, based on how much prep work each person takes on. Built for St. Xavier's College BSc. CSIT 2024 B — Ignatius Day social service event.

## Why

Not everyone puts in equal effort organizing a class event. This tool lets a class representative assign each student a role, then automatically calculates a fair contribution — people who take on more preparation work pay less, people who only show up on event day pay more.

## How it works

1. **Roster** — assign each student a Type (1–4) and, for Types 1–3, a specific role (Outreach, Internal Comms, Logistics, Documentation, Finance, Event Design).
2. **Budget** — enter the total amount needed. Type 4 students pay a fixed base fee (Rs 350); the remaining shortfall is split across everyone, weighted by Type.
3. **Results** — see exactly what each student owes, export as CSV, or copy a summary to share with the class.

## Tech

Plain HTML, CSS, and JavaScript — no framework, no build step, no backend. Open `index.html` in a browser and it runs.

- Apple-inspired minimal UI with light/dark mode
- Fully responsive
- No data leaves your browser — nothing is stored or transmitted anywhere

## Running it

```bash
git clone https://github.com/Sanil-Sth/ignatius-day-fund-splitter.git
cd ignatius-day-fund-splitter
open index.html
```

No install, no dependencies.

## Project structure

```
ignatius-day-fund-splitter/
  index.html
  style.css
  script.js
```

## Status

Built for a one-off college event. Roster and role list are specific to this class but easy to adapt — edit the seed data in `script.js`.

## Built with Claude

All three source files (index.html, style.css, script.js) for this project were drafted and iterated on with Claude, an AI assistant made by Anthropic. Requirements, the fund-splitting algorithm, and design decisions were directed by Sanil-Sth ; Claude handled the code generation.
