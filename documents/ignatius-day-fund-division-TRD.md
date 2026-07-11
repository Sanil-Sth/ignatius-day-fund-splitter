# TRD: Ignatius Day Fund & Work Division Tool

Companion technical spec to the PRD. Defines file structure, data model, and logic so the app can be built (or handed to Claude Code) directly from this document.

## 1. Tech Stack
- Plain **HTML + CSS + JS** (no framework, no build step) — matches PRD's "no backend, single session" scope and keeps it easy to host anywhere (GitHub Pages, a local file, etc.).
- No external libraries required. Optional: a CDN font/icon set only if desired — not required for function.
- **No localStorage/sessionStorage** (unsupported in some hosting contexts like Claude artifacts) — state lives in memory (a single JS object) for the session; export/CSV is the save mechanism.

## 2. File Structure
```
/ignatius-day-app
  index.html      → structure/markup + screen containers
  style.css       → all styling
  script.js       → state, algorithm, rendering, events
```
Single-file simplicity: 3 files, no folders, no modules/bundler needed.

## 3. Data Model (in `script.js`)

```js
// One object per student
{
  roll: 34,
  name: "Sanil Sthapit",
  type: 4,              // 1 | 2 | 3 | 4, default 4
  role: null             // string | null, e.g. "Outreach Executive"
}

// Role catalog — defines caps and which Type each role belongs to
const ROLES = {
  "Outreach Executive":        { type: 1, cap: 2 },
  "Internal Comms Executive":  { type: 1, cap: 1 },
  "Logistics Head":            { type: 2, cap: 2 },
  "Documentation":             { type: 3, cap: 1 },
  "Finance":                   { type: 3, cap: 1 },
  "Event Designer":            { type: 3, cap: 1 }
};

// App-wide settings, editable via UI
const settings = {
  baseFee: 350,                  // fixed per PRD, but kept as a constant not magic number
  totalBudgetTarget: 0,          // set by CR
  weights: { 1: 65, 2: 76, 3: 87, 4: 100 }  // % , editable
};

// state = { students: [...], settings }
```

## 4. Core Algorithm (pure functions in `script.js`)

```js
function calculateSplit(students, settings) {
  const type4 = students.filter(s => s.type === 4);
  const stage1Total = type4.length * settings.baseFee;
  const remainingNeeded = Math.max(0, settings.totalBudgetTarget - stage1Total);

  const totalWeight = students.reduce(
    (sum, s) => sum + settings.weights[s.type], 0
  );

  // First pass: raw (unrounded) shares
  let results = students.map(s => {
    const rawShare = totalWeight > 0
      ? (settings.weights[s.type] / totalWeight) * remainingNeeded
      : 0;
    return { ...s, rawShare };
  });

  // Round each share, track drift
  let roundedSum = 0;
  results = results.map(r => {
    const rounded = Math.round(r.rawShare);
    roundedSum += rounded;
    return { ...r, share: rounded };
  });

  // Reconcile rounding drift onto the last student in the list
  const drift = remainingNeeded - roundedSum;
  if (results.length > 0) {
    results[results.length - 1].share += drift;
  }

  // Final owed amount
  results = results.map(r => ({
    ...r,
    owed: r.type === 4 ? settings.baseFee + r.share : r.share
  }));

  return {
    stage1Total,
    remainingNeeded,
    isSurplus: settings.totalBudgetTarget < stage1Total,
    students: results
  };
}
```

- **Surplus case:** if `totalBudgetTarget < stage1Total`, `remainingNeeded` clamps to 0 and UI shows a "fully funded / surplus of Rs X" banner instead of negative numbers.
- **Reconciliation:** guarantees `Σ owed === totalBudgetTarget` (when not in surplus) by dumping rounding drift onto the last row — acceptable since drift is always ≤ a few rupees.

## 5. UI Structure (`index.html`, driven by `script.js`)

Three tab/section containers, all in one page (toggle via JS, no routing needed):

### Section A — Roster & Roles
- Table: Roll | Name | Type (dropdown 1–4) | Role (dropdown, filtered to selected Type, disabled if Type 4)
- "Add student" / "Remove" row controls
- Live cap counter per role (e.g. `Outreach Executive: 2/2`), rendered by re-scanning `state.students` on every change
- Cap violations shown as a warning badge, non-blocking

### Section B — Budget Setup
- Input: Total Budget Target (number, Rs)
- Read-only display: Stage 1 Total, Remaining Needed (auto-recalculated on input/change)
- Editable weight % fields for Type 1–4, with a "Reset to defaults" button

### Section C — Results
- Table: Roll | Name | Type | Role | Base Fee | Shortfall Share | **Total Owed**
- Footer row: sums, must equal Total Budget Target (or show surplus banner)
- "Export CSV" button → generates CSV via `Blob` + downloadable link
- "Copy as text" button → formats a WhatsApp-friendly plain-text summary to clipboard

## 6. Event Flow / Reactivity
No framework, so use a simple manual re-render pattern:
1. Any input change (`type`, `role`, `totalBudgetTarget`, a `weight`) fires an `onChange` handler.
2. Handler updates the in-memory `state` object.
3. Handler calls a single `renderAll()` function that re-runs `calculateSplit()` and re-paints Sections A–C from scratch (simplest to reason about; roster size is only ~24–30 rows, so full re-render is cheap).

## 7. CSV Export Format
```
Roll,Name,Type,Role,BaseFee,ShortfallShare,TotalOwed
34,Sanil Sthapit,1,Internal Comms Executive,0,142,142
...
,,,,,,TOTAL,<sum>
```

## 8. Validation Rules (enforced in JS, not blocking submission)
- Role caps: warn only, don't prevent over-assignment (plans change late).
- `totalBudgetTarget` must be ≥ 0; treat blank/invalid input as 0.
- Weight % fields must be ≥ 0; no upper bound enforced (CR may want to experiment).

## 9. Out of Scope (confirmed in PRD)
- No backend, no auth, no localStorage/sessionStorage, no payment integration, no multi-event history.

## 10. Build Order (recommended)
1. `index.html` skeleton with 3 empty section containers + nav tabs.
2. `script.js`: data model, seed roster (24 students from PRD), `calculateSplit()`, `renderAll()`.
3. Wire Section A (roster/roles) — this is the biggest UI surface.
4. Wire Section B (budget/weights).
5. Wire Section C (results + CSV/copy export).
6. `style.css` pass for readability on mobile (tables should scroll horizontally on small screens, per PRD mobile requirement).
