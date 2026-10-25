# Game Studio Framework & Workflow Specification

> **Version:** 1.0.0  
> **Origin:** Adapted from Donchitos' *Claude-Code-Game-Studios*  
> **Context:** Japanese Study Platform (`JAPC11 Delkurs 2`) — Sushi Restaurant Tycoon  
> **Status:** Active Standard  

---

## 1. Executive Summary & Studio Philosophy

This framework establishes a disciplined multi-agent game studio development workflow for the personal sushi restaurant tycoon embedded within the Genki I Japanese language learning platform.

### 1.1 The "Study-First" Prime Directive
Unlike conventional mobile or idle games, the sushi restaurant's primary objective is to serve as an **intrinsically motivating companion** to Japanese studies (Genki I Chapters 6–12). The studio workflow enforces four non-negotiable pedagogical boundaries:
1. **Curriculum Synchronization:** Restaurant unlocks (kitchen upgrades, recipes, decorations) are earned exclusively via Genki study mastery (Bronze 60%, Silver 80%, Gold 100% medals).
2. **Anti-Grind Mechanics:** Answering exercises repeatedly never yields direct currency; income is earned exclusively through the bounded idle economy.
3. **Bounded Rest Intervals:** Production accumulates for a maximum of 8 hours (or 12 hours once upgraded) before halting, matching healthy student study and sleep cycles.
4. **Permanent Progress Grants:** Once earned, an unlock is permanently awarded; declining study scores or reset decks never revoke restaurant eligibility.

### 1.2 Anti-Features
The studio framework explicitly forbids:
- Microtransactions, real-money purchases, or pay-to-win mechanics.
- Premium gems, energy bars, or pay-for-speed cooldown skips.
- Loot boxes, random gacha rolls, or probabilistic item drops.
- Freeform drag-and-drop grid builders or complex layout editors that detract from study focus.
- Unauthenticated guest access or cross-user state modification.

---

## 2. Studio Organization & Department Roles

The 49 roles of Claude-Code-Game-Studios are distilled into 6 functional studio disciplines tailored for our multi-agent TypeScript/lit-html architecture:

```
┌────────────────────────────────────────────────────────┐
│             Game Director (GD)                         │
│  - Pedagogical Vision & Curriculum Synchronization     │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
┌───────────▼──────────────┐   ┌─────────────▼───────────┐
│ Economy & Balance (ED)   │   │ Art & UX Director (AD)  │
│ - Two-Capacity Math      │   │ - Edo-Modern Aesthetics │
│ - Pacing & Upgrade Rates │   │ - Responsive SVG Layout │
│ - 1/60,000 Yen Precision │   │ - WCAG 2.1 AA Checklist │
└───────────┬──────────────┘   └─────────────┬───────────┘
            │                                │
┌───────────▼──────────────┐   ┌─────────────▼───────────┐
│ Lead Engineer (LE)       │   │ QA Lead (QL)            │
│ - lit-html Component Law │   │ - 4-Tier Test Matrix    │
│ - Chunk Isolation        │   │ - Concurrency & Skew    │
│ - Atomic Server Tx       │   │ - Regression Gates      │
└───────────┬──────────────┘   └─────────────┬───────────┘
            │                                │
            └───────────────┬────────────────┘
                            │
              ┌─────────────▼───────────┐
              │ Producer / Tracker (PM) │
              │ - Backlog & DoR / DoD   │
              │ - Audit Trail & Logs    │
              └─────────────────────────┘
```

### 2.1 Role Specifications

| Role | Title | Core Responsibilities | Key Deliverables & Artifacts |
|---|---|---|---|
| **GD** | Game Director | Guards pedagogical integrity, aesthetic tone, and milestone roadmaps. | `docs/sushi-game/gdd.md`, milestone approvals |
| **ED** | Economy & Balancing Designer | Designs mathematical models ($O = \min(K, S)$), 1/60,000 yen math, 8h/12h caps, pricing curves, and Genki 6–12 sync. | `docs/sushi-game/economy-balance-model.md`, balance scripts |
| **AD** | Art & UX Director | Directs Edo-modern vector visuals, SVG layer hierarchies, WCAG 2.1 AA accessibility, keyboard focus, and responsive mobile layouts. | `docs/sushi-game/ux-art-quality-checklist.md`, SVG assets, CSS tokens |
| **LE** | Lead Engineer | Enforces architectural purity, lit-html templates, Vite code-splitting, Firebase Cloud Function atomicity, and zero-error typechecking. | `src/course/sushi-game/`, `functions/src/`, `vite.config.ts` |
| **QL** | QA Lead | Architects the 4-tier testing hierarchy (Domain math, Concurrency/adversarial, Backend rules/Cloud functions, Playwright browser E2E). | `docs/sushi-game/qa-test-plan.md`, test suites in `tests/` |
| **PM** | Producer / Ticket Tracker | Oversees ticket lifecycle, Definition of Ready (DoR), Definition of Done (DoD), dependency sequencing, and audit logs. | `docs/sushi-game/ticket-tracker.md`, `docs/sushi-game/audit-logs.md` |

---

## 3. Studio Pipelines & Review Gates

Development proceeds through five strictly sequenced review gates. No work may bypass a gate.

```
 [ Backlog ] ──► [ Gate 1: Design ] ──► [ Gate 2: DoR ] ──► [ Implementation ] 
                                                                    │
 [ Release ] ◄── [ Gate 5: Release ] ◄── [ Gate 4: QA ] ◄── [ Gate 3: Local QA ]
```

### 3.1 Gate 1: Design & Balance Gate (G1)
- **Objective:** Ensure feature designs and economy tweaks strictly satisfy pedagogical and mathematical constraints.
- **Criteria:**
  - GDD entry updated with player motivation, invariants, and anti-feature check.
  - Economy math verified: linear/sub-exponential rate curve, no deadlocks, 1/60,000 yen integer compatibility.
  - Genki curriculum milestone correctly mapped by `lessonNumber`.
- **Sign-off:** GD and ED.

### 3.2 Gate 2: Ticket Readiness Gate (DoR) (G2)
- **Objective:** Guarantee that tasks are fully specified, unblocked, and testable before assignment.
- **Criteria:**
  - Full compliance with Definition of Ready (DoR) in `docs/sushi-game/ticket-tracker.md`.
  - All dependency tickets marked `done`.
  - Target files, interfaces, and acceptance checkboxes explicitly enumerated.
- **Sign-off:** PM and LE.

### 3.3 Gate 3: Local Technical Verification Gate (G3)
- **Objective:** Verify code implementation quality at the component and domain level.
- **Criteria:**
  - `npm run typecheck` exits with status 0 (`tsc --noEmit`).
  - Unit tests covering the modified domain or view logic pass cleanly.
  - Architectural constraints satisfied: lit-html purity, no direct float math for currency, no global mutations.
- **Sign-off:** LE.

### 3.4 Gate 4: QA Regression Gate (G4)
- **Objective:** Verify end-to-end system stability, adversarial resilience, and bundle isolation.
- **Criteria:**
  - Full test suite passes: `npm test` (all tests passing with 0 failures).
  - Production build succeeds: `npm run build` exits 0.
  - Code-splitting verified: `dist/assets/sushi-view-*.js` and `sushi-*.css` remain isolated lazy chunks; zero sushi code in main bundle `index-*.js`.
  - WCAG 2.1 AA checklist verified: contrast $\ge 4.5:1$, `:focus-visible`, screen reader ARIA live updates.
- **Sign-off:** QL.

### 3.5 Gate 5: Release Audit Gate (G5)
- **Objective:** Authorize production release and record permanent forensic audit trail.
- **Criteria:**
  - Formal audit record appended to `docs/sushi-game/audit-logs.md`.
  - Feature flag configuration reviewed (`src/course/sushi-game/config.ts`).
  - Final milestone sign-off by all Department Leads.
- **Sign-off:** GD, PM, and QL.

---

## 4. Claude-Code-Game-Studios Skill Equivalents

In our autonomous multi-agent engineering workflow, Claude-Code-Game-Studios slash commands map to concrete scripts, verification tools, and protocols:

| Studio Slash Command | Multi-Agent Skill / Execution Equivalent | Primary Role |
|---|---|---|
| `/balance-check` | Run mathematical simulation scripts and assert non-inflationary pacing curves ($O = \min(K, S)$). | ED |
| `/art-bible` | Inspect and enforce CSS custom properties, color palette tokens, and SVG viewBox standards (`0 0 960 520`). | AD |
| `/asset-audit` | Verify SVG element layering, `<title>`/`<desc>` screen reader accessibility, and bundle asset weight. | AD / LE |
| `/create-architecture` | Review component boundaries: lit-html template purity, separate CSS scoping, and dual Firestore transactions. | LE |
| `/dev-story` | Execute targeted implementation strictly within file and ticket boundaries defined by DoR. | Specialist / LE |
| `/qa-plan` | Execute 4-tier test runner: pure logic, adversarial concurrency, backend rules emulator, and Playwright E2E. | QL |
| `/gate-check` | Execute `npm run typecheck && npm test && npm run build` and inspect generated chunks. | LE / QL |
| `/audit-log` | Append structured forensic balance and regression records to `docs/sushi-game/audit-logs.md`. | PM / GD |

---

## 5. Architectural Non-Negotiables for Engineers

All engineers and automated agents working on the sushi game must uphold the following 8 technical invariants:

1. **Exact Integer Arithmetic:** Internal currency must always use `units` where $1 \text{ Yen} = 60{,}000 \text{ units}$. Never calculate accrual or balances in JavaScript floating-point yen.
2. **Deterministic Lazy Accrual:** Accrual is calculated on demand: $\Delta t = \min(\text{nowMs} - \text{accountedAtMs}, \text{capMs} - \text{usedProductionMs})$. Unattended time beyond cap is discarded; stopped time is never compensated.
3. **Manual Collection Rule:** Cash in the uncollected register is strictly separate from spendable wallet yen until the user triggers "Hämta intäkter".
4. **Prospective Rate Adjustment:** Upgrades apply strictly from the purchase timestamp forward; historical earnings are never retroactively recalculated.
5. **Monotonic Grants Union:** Unlock eligibility earned from Genki study medals is permanently retained via set union (`mergePermanentGrants`); lower scores or unmastered cards never revoke access.
6. **Code-Splitting Isolation:** The sushi view, SVG scene, catalog, and CSS must remain dynamically imported at `#/sushi`. Never statically import `sushi-view.ts` into main course modules.
7. **Server-Authoritative Transactions:** In production, balance mutations and purchases occur inside atomic Cloud Function transactions (`functions/src/index.ts`). Client writes to Firestore are blocked (`firestore.rules`).
8. **Accessibility & Reduced Motion:** All animations must respect `prefers-reduced-motion: reduce`. Interactive elements must provide `:focus-visible` styling and minimum 44x44 CSS px touch targets.
