# PRD: Ignatius Day Fund & Work Division Tool

## 1. Background & Problem
The class (24 students) is organizing an old age home visit for Ignatius Day. Work is unevenly distributed — a few students (Outreach, Internal Comms, Logistics, Documentation, Finance, Event Design) do real preparation work, while the rest only show up on event day. To keep this fair, the CR (Class Representative) wants contributions to scale **inversely with workload**: people who work harder pay less, people who do nothing pay more. The tool should let the CR assign each classmate a role/type and instantly see how much everyone owes.

## 2. Goals
- Let the CR (or another executive) assign each of the 24 students a Type (1–4) and, within Type 1–3, an actual role.
- Automatically calculate a fair, weighted money split based on Type.
- Support the two-stage collection model: Type 4 pays a fixed base fee upfront; once the total budget target is known, the remaining shortfall is split across **everyone** (including Type 4) weighted by Type.
- Give a clean summary/export the CR can share with the class (who owes what, total collected, total needed).

## 3. Non-Goals (out of scope for v1)
- No real payment collection/integration (eSewa, Khalti, etc.) — this is a calculator, not a payment gateway.
- No login/auth system — single-user (CR) tool, no need for multi-user accounts in v1.
- No multi-class/multi-event history in v1 (can be a fast-follow).

## 4. Users
- **Primary user:** You (the CR), and possibly the Internal Comms / Finance executive.
- Single shared session — no need to support simultaneous multi-editor use in v1.

## 5. Class Roster (seed data, hardcoded default list)
| Roll | Name |
|---|---|
| 25 | Nischal Karki |
| 26 | Nwang Chheten Lama |
| 27 | Prashant Adhikari |
| 28 | Prasoon Raj Shakya |
| 29 | Prince Poudel |
| 30 | Raj Tamang |
| 31 | Resha Pradhananga |
| 32 | Riwaz Mahat |
| 33 | Samir Tha |
| 34 | Sanil Sthapit |
| 35 | Saugat Niraula |
| 36 | Saugat Tamang |
| 37 | Shreyana Adhikari |
| 38 | Shrijal Maharjan |
| 39 | Shubham Adhikari |
| 40 | Siddhant Shrestha |
| 41 | Sohan Giri |
| 42 | Sugam Budhathoki |
| 43 | Sulav Pandey |
| 44 | Surakshya Dahal |
| 45 | Suyash Prajapati |
| 46 | Upasana Jayana Shrestha |
| 47 | Wrhythm Upadhyay |
| 48 | Yajyu Rani Maharjan |

The list should be **editable in-app** (add/remove/rename students) so it's reusable for future events, not hardcoded permanently — just pre-loaded as default data.

## 6. Roles & Types
| Type | Description | Roles (with headcount caps) |
|---|---|---|
| Type 1 (hardest) | Full external/internal coordination | Outreach Executive (max 2), Internal Comms Executive (max 1) |
| Type 2 | Procurement | Logistics Head / Material Buyer (max 2) |
| Type 3 | Support work | Documentation (max 1), Finance (max 1), Event Designer (max 1) |
| Type 4 | No prep work, event-day only | Unlimited — this is the default for anyone not assigned a role |

**Rule:** the app should warn (not necessarily block) the CR if a role's headcount cap is exceeded, in case plans change.

## 7. Money Division Algorithm

### Stage 1 — Base Collection
- Every student currently marked **Type 4** pays a fixed base fee: **Rs 350** (per your confirmation, this is fixed, not editable).
- `Stage1Total = (Number of Type 4 students) × 350`

### Stage 2 — Shortfall Split (percentage-weighted, across ALL 24 students)
- CR enters a **Total Budget Target** (e.g. Rs 15,000) for the event.
- `RemainingNeeded = TotalBudgetTarget − Stage1Total`
  - If this is ≤ 0, no further collection needed — show a "fully funded / surplus" state instead of negative numbers.
- Each Type has a **weight %** representing how much of a "full share" they carry (Type 4 = heaviest share since they did no prep work, Type 1 = lightest share since they worked hardest). Default weights (editable in Settings):

| Type | Default Weight |
|---|---|
| Type 1 | 65% |
| Type 2 | 76% |
| Type 3 | 87% |
| Type 4 | 100% |

- `TotalWeight = Σ (weight of each student's type)` across all 24 students
- `Each student's Stage 2 share = (their type's weight ÷ TotalWeight) × RemainingNeeded`

### Final Amount Owed Per Student
- Type 4 student: `350 + Stage2Share`
- Type 1/2/3 student: `Stage2Share only` (no base fee, since they already contribute via work)

*(This mirrors your original example logic: Type 1 pays least, Type 4 pays most, and the weight % is directly editable in-app so you're not locked into these numbers — you can tune them live and watch totals recalculate.)*

### Validation
- `Stage1Total + Σ(all Stage2 shares) = TotalBudgetTarget` exactly (rounding handled by adjusting the last student's share by a few paisa/rupees so the total reconciles).

## 8. Core Screens / Features

1. **Roster & Role Assignment Screen**
   - Table of all students (roll, name, editable).
   - Dropdown per student to assign Type (auto Type 4 by default) and specific Role (for Type 1–3).
   - Live counter showing role caps ("Outreach Executive: 2/2 assigned").

2. **Budget Setup Screen**
   - Input: Total Budget Target (Rs).
   - Auto-shows: Stage 1 Total collected, Remaining Needed.
   - Editable weight percentages per Type (with reset-to-default button).

3. **Results / Summary Screen**
   - Table: Roll, Name, Type, Role, Amount Owed, Breakdown (base + shortfall share).
   - Totals row (should equal Total Budget Target).
   - Sort/filter by Type.
   - Export/Copy as text or CSV, so it's easy to paste into WhatsApp/Google Sheets for the class.

4. **Persistence**
   - Since this is a single CR working across sessions, use in-app storage (no login) so data isn't lost on refresh.

## 9. Edge Cases to Handle
- A role has 0 people assigned (fine, just means TotalWeight recalculates).
- Total Budget Target set lower than Stage 1 Total alone (surplus — show refund/leftover state, don't show negative "owed" numbers).
- CR reassigns someone's Type mid-session — all numbers should recalculate live.
- Non-integer rupee amounts — round to nearest rupee, reconcile rounding drift into one student's share so totals match exactly.

## 10. Success Criteria
- CR can assign all 24 students a Type/Role in under 2 minutes.
- Final owed amounts sum exactly to the Total Budget Target.
- CR can adjust weight % or budget target and see instant recalculation, so they can experiment with fairness before locking numbers in.

## 11. Suggested Tech
Given this is a single-session tool for personal/class use, a single-file React artifact (or simple HTML/JS) with in-memory/browser state is sufficient — no backend needed for v1.

---

## Appendix: Ready-to-use Build Prompt

Use this prompt (in a fresh Claude conversation, or with Claude Code / Cowork) to generate the actual working app from this PRD:

> Build a single-page web app (React, Tailwind for styling) called "Ignatius Day Fund Splitter" implementing the attached PRD exactly. Key behaviors: (1) an editable roster table pre-seeded with the 24 given students, each assignable to Type 1–4 and a specific role within Type 1–3, with live headcount-cap warnings; (2) a budget screen where I enter a Total Budget Target and see Stage 1 (Type 4 base fee × count) auto-calculated, remaining shortfall, and editable per-Type weight percentages (defaults: Type1=65%, Type2=76%, Type3=87%, Type4=100%) that drive a weighted percentage split of the shortfall across all 24 students; (3) a results table showing each student's final amount owed (base fee + shortfall share for Type 4, shortfall share only for Type 1–3), with the total reconciling exactly to the Total Budget Target (handle rounding drift). Include CSV/text export of the final table. No login, no backend — all state in-browser. Make it clean and easy to scan on both desktop and mobile, since I'll likely check it on my phone.
