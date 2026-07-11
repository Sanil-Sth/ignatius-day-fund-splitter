// ==========================================================================
// Ignatius Day Fund Splitter — script.js
// State, algorithm, rendering, events. No framework, no build step.
// ==========================================================================

/* --------------------------------- Data model ---------------------------------- */

// Role catalog — defines caps and which Type each role belongs to.
// Mutable: the CR can add or remove roles in-app (Roster tab).
let ROLES = {
  "Outreach Executive":       { type: 1, cap: 2 },
  "Internal Comms Executive": { type: 1, cap: 1 },
  "Logistics Head":           { type: 2, cap: 2 },
  "Documentation":            { type: 3, cap: 1 },
  "Finance":                  { type: 3, cap: 1 },
  "Event Designer":           { type: 3, cap: 1 }
};

const TYPE_LABELS = {
  1: "Type 1 — hardest",
  2: "Type 2 — procurement",
  3: "Type 3 — support",
  4: "Type 4 — no prep"
};

const DEFAULT_WEIGHTS = { 1: 65, 2: 76, 3: 87, 4: 100 };

// Seed roster (24 students, per PRD section 5)
const SEED_ROSTER = [
  [25, "Nischal Karki"], [26, "Nwang Chheten Lama"], [27, "Prashant Adhikari"],
  [28, "Prasoon Raj Shakya"], [29, "Prince Poudel"], [30, "Raj Tamang"],
  [31, "Resha Pradhananga"], [32, "Riwaz Mahat"], [33, "Samir Tha"],
  [34, "Sanil Sthapit"], [35, "Saugat Niraula"], [36, "Saugat Tamang"],
  [37, "Shreyana Adhikari"], [38, "Shrijal Maharjan"], [39, "Shubham Adhikari"],
  [40, "Siddhant Shrestha"], [41, "Sohan Giri"], [42, "Sugam Budhathoki"],
  [43, "Sulav Pandey"], [44, "Surakshya Dahal"], [45, "Suyash Prajapati"],
  [46, "Upasana Jayana Shrestha"], [47, "Wrhythm Upadhyay"], [48, "Yajyu Rani Maharjan"]
];

let nextId = 1;

const state = {
  students: SEED_ROSTER.map(([roll, name]) => ({
    _id: nextId++,
    roll,
    name,
    type: 4,      // 1 | 2 | 3 | 4, default 4
    role: null    // string | null
  })),
  settings: {
    baseFee: 350,               // fixed per PRD
    totalBudgetTarget: 0,       // set by CR
    weights: { ...DEFAULT_WEIGHTS }
  }
};

// UI-only state (not part of the documented data model)
let activeTab = "roster";
let resultsFilter = "all";
let userTheme = null; // null = follow OS preference

/* --------------------------------- Core algorithm -------------------------------- */

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

/* ----------------------------------- Helpers -------------------------------------- */

function formatRs(n) {
  const rounded = Math.round(n || 0);
  return `Rs ${rounded.toLocaleString("en-IN")}`;
}

function rolesForType(type) {
  return Object.entries(ROLES)
    .filter(([, def]) => def.type === type)
    .map(([name]) => name);
}

function roleCounts(students) {
  const counts = {};
  Object.keys(ROLES).forEach(r => { counts[r] = 0; });
  students.forEach(s => { if (s.role && counts.hasOwnProperty(s.role)) counts[s.role]++; });
  return counts;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeCsvField(value) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/* --------------------------------- Mutations -------------------------------------- */

function addStudent() {
  const maxRoll = state.students.reduce((m, s) => Math.max(m, s.roll), 0);
  state.students.push({ _id: nextId++, roll: maxRoll + 1, name: "New student", type: 4, role: null });
}

function removeStudent(id) {
  state.students = state.students.filter(s => s._id !== id);
}

function updateStudent(id, field, value) {
  const s = state.students.find(s => s._id === id);
  if (!s) return;
  if (field === "type") {
    s.type = value;
    if (value === 4) {
      s.role = null;
    } else if (s.role && !rolesForType(value).includes(s.role)) {
      s.role = null;
    }
  } else if (field === "role") {
    s.role = value || null;
  } else if (field === "name") {
    s.name = value;
  }
}

function addRole(rawName, type, cap) {
  const name = (rawName || "").trim();
  if (!name) {
    showToast("Enter a role name");
    return;
  }
  const exists = Object.keys(ROLES).some(r => r.toLowerCase() === name.toLowerCase());
  if (exists) {
    showToast("That role already exists");
    return;
  }
  if (![1, 2, 3].includes(type)) {
    showToast("Roles must be Type 1, 2, or 3");
    return;
  }
  const safeCap = (isNaN(cap) || cap < 1) ? 1 : Math.round(cap);
  ROLES[name] = { type, cap: safeCap };
  showToast(`Added "${name}"`);
}

function removeRole(name) {
  if (!ROLES[name]) return;
  delete ROLES[name];
  // Any student holding this role loses it (their Type is unaffected)
  state.students.forEach(s => {
    if (s.role === name) s.role = null;
  });
  showToast(`Removed "${name}"`);
}

function updateRoleCap(name, cap) {
  if (!ROLES[name]) return;
  const safeCap = (isNaN(cap) || cap < 1) ? 1 : Math.round(cap);
  ROLES[name].cap = safeCap;
}

/* ----------------------------------- Rendering ------------------------------------- */

function renderAll() {
  const calc = calculateSplit(state.students, state.settings);
  renderRoster();
  renderBudget(calc);
  renderResults(calc);
}

function renderRoster() {
  const el = document.getElementById("section-roster");
  const counts = roleCounts(state.students);

  const chips = Object.entries(ROLES).map(([name, def]) => {
    const count = counts[name];
    const over = count > def.cap;
    return `<span class="cap-chip${over ? " over" : ""}">${escapeHtml(name)}: ${count}/${def.cap}</span>`;
  }).join("");

  const roleRows = Object.entries(ROLES).length
    ? Object.entries(ROLES).map(([name, def]) => roleMgmtRowHtml(name, def)).join("")
    : `<div class="row-empty">No roles yet — add one below.</div>`;

  const rows = state.students.length
    ? state.students.map(s => rosterRowHtml(s)).join("")
    : `<div class="row-empty">No students yet — add your first one below.</div>`;

  el.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title">Roles</span></div>
      ${roleRows}
      <div class="row add-role-row">
        <input type="text" id="newRoleName" class="field-input" placeholder="Role name" aria-label="New role name">
        <select id="newRoleType" class="field-select" aria-label="New role type">
          <option value="1">Type 1</option>
          <option value="2">Type 2</option>
          <option value="3">Type 3</option>
        </select>
        <input type="number" id="newRoleCap" class="field-input role-cap-input" min="1" step="1" value="1" aria-label="New role cap">
        <button class="btn btn-accent btn-sm" data-action="addRole">+ Add role</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Roster</span>
        <div class="card-actions">
          <button class="btn btn-accent btn-sm" data-action="add">+ Add student</button>
        </div>
      </div>
      <div class="cap-chips">${chips}</div>
      ${rows}
    </div>
  `;
}

function roleMgmtRowHtml(name, def) {
  return `
    <div class="row role-mgmt-row">
      <div class="role-mgmt-meta">
        <span class="type-badge"><span class="type-dot t${def.type}"></span>Type ${def.type}</span>
        <span class="role-mgmt-name">${escapeHtml(name)}</span>
      </div>
      <div class="role-mgmt-controls">
        <div class="weight-input-wrap">
          <input type="number" class="field-input role-cap-input" min="1" step="1" value="${def.cap}"
                 data-action="roleCap" data-role="${escapeHtml(name)}" aria-label="Cap for ${escapeHtml(name)}">
          <span class="stat-sub">cap</span>
        </div>
        <button class="btn btn-icon" data-action="removeRole" data-role="${escapeHtml(name)}" aria-label="Remove role ${escapeHtml(name)}">×</button>
      </div>
    </div>
  `;
}

function rosterRowHtml(s) {
  const typeOptions = [1, 2, 3, 4].map(t =>
    `<option value="${t}" ${s.type === t ? "selected" : ""}>Type ${t}</option>`
  ).join("");

  const isType4 = s.type === 4;
  const roleOptions = isType4
    ? `<option value="">—</option>`
    : [`<option value="">No role</option>`]
        .concat(rolesForType(s.type).map(r =>
          `<option value="${escapeHtml(r)}" ${s.role === r ? "selected" : ""}>${escapeHtml(r)}</option>`
        )).join("");

  return `
    <div class="row roster-row">
      <div class="roster-meta">
        <span class="roster-roll">${s.roll}</span>
        <input type="text" class="field-plain roster-name-input" value="${escapeHtml(s.name)}"
               data-action="name" data-id="${s._id}" aria-label="Student name">
      </div>
      <div class="roster-controls">
        <span class="type-badge"><span class="type-dot t${s.type}"></span></span>
        <select class="field-select" data-action="type" data-id="${s._id}" aria-label="Type">${typeOptions}</select>
        <select class="field-select" data-action="role" data-id="${s._id}" aria-label="Role" ${isType4 ? "disabled" : ""}>${roleOptions}</select>
      </div>
      <button class="btn btn-icon roster-remove" data-action="remove" data-id="${s._id}" aria-label="Remove student">×</button>
    </div>
  `;
}

function renderBudget(calc) {
  const el = document.getElementById("section-budget");
  const { settings } = state;

  const surplusBanner = calc.isSurplus
    ? `<div class="banner"><strong>Fully funded.</strong> Surplus of ${formatRs(calc.stage1Total - settings.totalBudgetTarget)} — no further collection needed.</div>`
    : "";

  const weightRows = [1, 2, 3, 4].map(t => `
    <div class="row weights-row">
      <span class="stat-label">${TYPE_LABELS[t]}</span>
      <div class="weight-input-wrap">
        <input type="number" class="field-input" min="0" step="1" value="${settings.weights[t]}"
               data-action="weight" data-type="${t}" aria-label="Weight for Type ${t}">
        <span class="stat-sub">%</span>
      </div>
    </div>
  `).join("");

  el.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title">Budget</span></div>
      <div class="row stat-row">
        <span class="stat-label">Total budget target</span>
        <input type="number" class="field-input" min="0" step="1" value="${settings.totalBudgetTarget}"
               data-action="budgetTarget" aria-label="Total budget target" style="width:120px; text-align:right;">
      </div>
      <div class="row stat-row">
        <span class="stat-label">Stage 1 total <span class="stat-sub">(Type 4 base fee × count)</span></span>
        <span class="money">${formatRs(calc.stage1Total)}</span>
      </div>
      <div class="row stat-row">
        <span class="stat-label">Remaining needed</span>
        <span class="money money-lg">${formatRs(calc.remainingNeeded)}</span>
      </div>
      ${surplusBanner}
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Shortfall weights</span>
        <div class="card-actions">
          <button class="btn btn-sm" data-action="resetWeights">Reset to defaults</button>
        </div>
      </div>
      ${weightRows}
    </div>
  `;
}

function renderResults(calc) {
  const el = document.getElementById("section-results");
  const { settings } = state;

  const filtered = resultsFilter === "all"
    ? calc.students
    : calc.students.filter(s => String(s.type) === resultsFilter);

  const sorted = filtered.slice().sort((a, b) => a.roll - b.roll);

  const rows = sorted.length
    ? sorted.map(s => resultsRowHtml(s, settings)).join("")
    : `<div class="row-empty">No students match this filter.</div>`;

  const sumBase = calc.students.reduce((sum, s) => sum + (s.type === 4 ? settings.baseFee : 0), 0);
  const sumShare = calc.students.reduce((sum, s) => sum + s.share, 0);
  const sumOwed = calc.students.reduce((sum, s) => sum + s.owed, 0);

  const reconcileNote = calc.isSurplus
    ? `Surplus: ${formatRs(calc.stage1Total - settings.totalBudgetTarget)}`
    : (sumOwed === settings.totalBudgetTarget ? "Matches target" : `Target: ${formatRs(settings.totalBudgetTarget)}`);

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Results</span>
        <div class="card-actions">
          <select class="field-select filter-select" data-action="filter" aria-label="Filter by type">
            <option value="all" ${resultsFilter === "all" ? "selected" : ""}>All types</option>
            <option value="1" ${resultsFilter === "1" ? "selected" : ""}>Type 1</option>
            <option value="2" ${resultsFilter === "2" ? "selected" : ""}>Type 2</option>
            <option value="3" ${resultsFilter === "3" ? "selected" : ""}>Type 3</option>
            <option value="4" ${resultsFilter === "4" ? "selected" : ""}>Type 4</option>
          </select>
          <button class="btn btn-sm" data-action="exportCsv">Export CSV</button>
          <button class="btn btn-sm" data-action="copyText">Copy summary</button>
        </div>
      </div>
      <div class="results-head">
        <span></span><span>Name</span><span>Type</span><span>Base</span><span>Shortfall</span><span>Owed</span>
      </div>
      ${rows}
      <div class="results-footer">
        <span class="stat-label">Total <span class="stat-sub">(${reconcileNote})</span></span>
        <span></span>
        <span class="cell-value money"><span class="cell-label">Base</span>${formatRs(sumBase)}</span>
        <span class="cell-value money"><span class="cell-label">Shortfall</span>${formatRs(sumShare)}</span>
        <span class="cell-value money money-lg"><span class="cell-label">Owed</span>${formatRs(sumOwed)}</span>
      </div>
    </div>
  `;
}

function resultsRowHtml(s, settings) {
  const baseFee = s.type === 4 ? settings.baseFee : 0;
  return `
    <div class="row results-row">
      <span class="roster-roll">${s.roll}</span>
      <div class="name-cell">
        <span>${escapeHtml(s.name)}</span>
        <span class="role-cell">${s.role ? escapeHtml(s.role) : "—"}</span>
      </div>
      <span class="type-badge"><span class="type-dot t${s.type}"></span>T${s.type}</span>
      <span class="cell-value money"><span class="cell-label">Base</span>${formatRs(baseFee)}</span>
      <span class="cell-value money"><span class="cell-label">Shortfall</span>${formatRs(s.share)}</span>
      <span class="cell-value money money-lg"><span class="cell-label">Owed</span>${formatRs(s.owed)}</span>
    </div>
  `;
}

/* ------------------------------------- Export -------------------------------------- */

function generateCsv(calc) {
  const { settings } = state;
  const lines = ["Roll,Name,Type,Role,BaseFee,ShortfallShare,TotalOwed"];
  calc.students.slice().sort((a, b) => a.roll - b.roll).forEach(s => {
    const baseFee = s.type === 4 ? settings.baseFee : 0;
    lines.push([
      s.roll,
      escapeCsvField(s.name),
      s.type,
      escapeCsvField(s.role || ""),
      baseFee,
      s.share,
      s.owed
    ].join(","));
  });
  const totalOwed = calc.students.reduce((sum, s) => sum + s.owed, 0);
  lines.push(`,,,,,,TOTAL,${totalOwed}`);
  return lines.join("\n");
}

function exportCsv() {
  const calc = calculateSplit(state.students, state.settings);
  const csv = generateCsv(calc);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ignatius-day-fund-split.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("CSV exported");
}

function generateSummaryText(calc) {
  const { settings } = state;
  const lines = [];
  lines.push("Ignatius Day Fund Split");
  lines.push(`Budget target: ${formatRs(settings.totalBudgetTarget)}`);
  lines.push(`Stage 1 (Type 4 base fee): ${formatRs(calc.stage1Total)}`);
  if (calc.isSurplus) {
    lines.push(`Surplus: ${formatRs(calc.stage1Total - settings.totalBudgetTarget)}`);
  } else {
    lines.push(`Remaining shortfall: ${formatRs(calc.remainingNeeded)}`);
  }
  lines.push("");
  calc.students.slice().sort((a, b) => a.roll - b.roll).forEach(s => {
    const roleLabel = s.role ? ` (${s.role})` : "";
    lines.push(`${s.roll}. ${s.name} — Type ${s.type}${roleLabel}: ${formatRs(s.owed)}`);
  });
  lines.push("");
  const total = calc.students.reduce((sum, s) => sum + s.owed, 0);
  lines.push(`Total: ${formatRs(total)}`);
  return lines.join("\n");
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    showToast("Copied to clipboard");
  } catch (e) {
    showToast("Could not copy — select manually");
  }
  document.body.removeChild(ta);
}

function copyAsText() {
  const calc = calculateSplit(state.students, state.settings);
  const text = generateSummaryText(calc);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast("Copied to clipboard"))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

/* -------------------------------------- Toast --------------------------------------- */

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ----------------------------------- Theme toggle ------------------------------------- */

function getEffectiveTheme() {
  if (userTheme) return userTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme() {
  const theme = getEffectiveTheme();
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.themeChoice === theme);
  });
  const highlight = document.getElementById("themeHighlight");
  highlight.style.transform = theme === "dark" ? "translateX(100%)" : "translateX(0)";
}

/* ----------------------------------- Tab switcher -------------------------------------- */

function switchTab(name) {
  activeTab = name;
  document.querySelectorAll(".tab-btn").forEach(b => {
    const active = b.dataset.tab === name;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".tab-panel").forEach(p => {
    p.classList.toggle("active", p.id === "section-" + name);
  });
  positionTabHighlight();
}

function positionTabHighlight() {
  const activeBtn = document.querySelector(".tab-btn.active");
  const highlight = document.getElementById("tabHighlight");
  if (!activeBtn || !highlight) return;
  highlight.style.width = activeBtn.offsetWidth + "px";
  highlight.style.transform = `translateX(${activeBtn.offsetLeft - 3}px)`;
}

/* ------------------------------------ Event wiring -------------------------------------- */

function handleChange(e) {
  const el = e.target;
  const action = el.dataset.action;
  if (!action) return;
  const id = el.dataset.id ? Number(el.dataset.id) : null;

  switch (action) {
    case "name":
      updateStudent(id, "name", el.value.trim() || "Unnamed");
      break;
    case "type":
      updateStudent(id, "type", Number(el.value));
      break;
    case "role":
      updateStudent(id, "role", el.value);
      break;
    case "budgetTarget": {
      const v = parseFloat(el.value);
      state.settings.totalBudgetTarget = (isNaN(v) || v < 0) ? 0 : v;
      break;
    }
    case "weight": {
      const t = Number(el.dataset.type);
      const v = parseFloat(el.value);
      state.settings.weights[t] = (isNaN(v) || v < 0) ? 0 : v;
      break;
    }
    case "roleCap":
      updateRoleCap(el.dataset.role, parseInt(el.value, 10));
      break;
    case "filter":
      resultsFilter = el.value;
      break;
    default:
      return;
  }
  renderAll();
}

function handleClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  switch (action) {
    case "add":
      addStudent();
      renderAll();
      break;
    case "remove":
      removeStudent(Number(btn.dataset.id));
      renderAll();
      break;
    case "resetWeights":
      state.settings.weights = { ...DEFAULT_WEIGHTS };
      renderAll();
      break;
    case "addRole": {
      const nameInput = document.getElementById("newRoleName");
      const typeInput = document.getElementById("newRoleType");
      const capInput = document.getElementById("newRoleCap");
      addRole(nameInput.value, Number(typeInput.value), parseInt(capInput.value, 10));
      renderAll();
      break;
    }
    case "removeRole":
      removeRole(btn.dataset.role);
      renderAll();
      break;
    case "exportCsv":
      exportCsv();
      break;
    case "copyText":
      copyAsText();
      break;
    default:
      return;
  }
}

function handleKeydown(e) {
  if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
  if (["newRoleName", "newRoleCap"].includes(e.target.id)) {
    e.preventDefault();
    document.querySelector('[data-action="addRole"]').click();
    return;
  }
  e.target.blur();
}

/* ------------------------------------- Init ---------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  const content = document.getElementById("content");
  content.addEventListener("change", handleChange);
  content.addEventListener("click", handleClick);
  content.addEventListener("keydown", handleKeydown);

  document.getElementById("tabSwitcher").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (btn) switchTab(btn.dataset.tab);
  });

  document.getElementById("themeToggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".theme-btn");
    if (btn) {
      userTheme = btn.dataset.themeChoice;
      applyTheme();
    }
  });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!userTheme) applyTheme();
  });

  window.addEventListener("resize", positionTabHighlight);

  renderAll();
  applyTheme();
  switchTab("roster");
});
