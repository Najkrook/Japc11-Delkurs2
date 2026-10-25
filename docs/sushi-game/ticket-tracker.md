# Sushi Game Evolution — Standardized Ticket Tracker & Master Board

> **Standard:** Aligned with `docs/agents/issue-tracker.md` & `docs/game-studio/framework.md`  
> **Milestones:** M1 (Studio Framework Docs), M2 (Economy Audit), M3 (Implementation & Polish), M4 (QA Verification), E2E Track  
> **Source of Truth:** This file constitutes the master tracking board for the Sushi Game Evolution.  

---

## 1. Master Board Overview

| Ticket ID | Milestone | Title | Assignee | Status | Blocked by |
|:---|:---|:---|:---|:---|:---|
| **T-01** | M1 | Studio Framework Specification | Framework Worker | `done` | None — can start immediately |
| **T-02** | M1 | Standardized Ticket Tracker & DoR/DoD | Tracking Worker | `done` | None — can start immediately |
| **T-03** | M1 | Game Design Document (GDD) | GDD Worker | `done` | None — can start immediately |
| **T-04** | M1 | Mathematical Economy & Balancing Model | Economy Worker | `done` | None — can start immediately |
| **T-05** | M1 | UX & Art Quality Checklist | UX Worker | `done` | None — can start immediately |
| **T-06** | M1 | 4-Tier QA Test Plan Specification | QA Worker | `done` | None — can start immediately |
| **T-07** | M1 | Forensic Studio Audit Logs Template | Audit Worker | `done` | None — can start immediately |
| **T-08** | M2 | Studio Economy & Pacing Audit | Economy Specialist | `done` | T-03, T-04, T-07 |
| **T-09** | M2 | Bottleneck & Cap Balance Audit | Balance Specialist | `done` | T-04, T-07, T-08 |
| **T-10** | M3 | Catalog & Economy Expansion (21-Item Master) | Gameplay Engineer | `done` | T-04, T-07, T-08, T-09 |
| **T-11** | M3 | Curriculum Medal Grant Rules Expansion | Gameplay Engineer | `done` | T-03, T-10 |
| **T-12** | M3 | Visual Scene Layer Polish & Asset Expansion | Art & UI Designer | `done` | T-05, T-10 |
| **T-13** | M3 | UX, Accessibility & Bottleneck Feedback Polish | UI/UX Engineer | `done` | T-05, T-10 |
| **T-14** | M4 | Automated Test Suite Expansion (Tiers 1 & 2) | QA Tester | `done` | T-06, T-10, T-11 |
| **T-15** | M4 | Release Gate, Chunk Splitting & System Verification | QA Lead | `done` | T-10, T-11, T-12, T-13, T-14 |
| **T-E2E** | E2E | Requirement-Driven Opaque-Box E2E Test Suite | E2E Test Writer | `done` | None — can start immediately |

---

## 2. Formal Quality Definitions

### 2.1 Definition of Ready (DoR)
A ticket is **NOT READY** to be assigned or moved to `in-progress` until ALL six preconditions are verified:
1. **[DoR-1] Pedagogical Value:** The task clearly articulates how it reinforces Genki I Japanese learning motivation.
2. **[DoR-2] Exact Scope & File Boundaries:** The specific target file paths and functions to be modified are explicitly listed.
3. **[DoR-3] Dependencies Resolved:** All prerequisite tickets listed in `Blocked by` are marked `done`.
4. **[DoR-4] Interface & Type Contracts:** Data types, schemas, and mathematical formulations are specified before coding begins.
5. **[DoR-5] Verifiable Acceptance Criteria:** Concrete, unambiguous checkboxes defining required functional behavior are specified.
6. **[DoR-6] Verification Commands Defined:** Concrete shell commands (e.g. `npm test`, `npm run typecheck`, `npm run build`) to validate the change are identified.

### 2.2 Definition of Done (DoD)
A ticket is **NOT DONE** and cannot be closed until ALL eight postconditions are verified:
1. **[DoD-1] Criteria Fulfillment:** Every acceptance criteria checkbox in the ticket is satisfied and verified.
2. **[DoD-2] Zero Type Errors:** `npm run typecheck` exits with status 0 (`tsc --noEmit`).
3. **[DoD-3] Zero Test Regressions:** `npm test` executes the complete test suite with 100% passing and 0 failures.
4. **[DoD-4] New Test Coverage:** Automated unit or adversarial tests validating the specific changes have been added.
5. **[DoD-5] Clean Build & Chunk Isolation:** `npm run build` exits with status 0; `sushi-view-*.js` and `sushi-*.css` remain isolated lazy chunks with zero sushi code in `index-*.js`.
6. **[DoD-6] Study Platform Insulation:** Primary Japanese study views, flashcards, and Dojo drills remain completely unaffected.
7. **[DoD-7] Accessibility & Reduced Motion:** Interactive controls satisfy WCAG 2.1 AA (contrast, keyboard focus, ARIA live announcer, `prefers-reduced-motion`).
8. **[DoD-8] Audit Trail Recorded:** Handoff documentation and audit logs document the changes and verification evidence.

---

## 3. Ticket Specifications & Checklists

### Milestone 1: Studio Framework & Specifications

#### Ticket T-01: Studio Framework Specification
- **Milestone:** M1
- **Status:** `done`
- **Blocked by:** None — can start immediately
- **What to build:** Create `docs/game-studio/framework.md` adapting Claude-Code-Game-Studios into 6 roles, 5 review gates, and 8 architectural non-negotiables.
- **DoR Checklist:**
  - [x] Clear pedagogical objective articulated.
  - [x] Target file path `docs/game-studio/framework.md` defined.
  - [x] No blockers.
- **Acceptance Criteria & DoD:**
  - [x] Documents 6 adapted studio roles (GD, ED, AD, LE, QL, PM).
  - [x] Documents 5 sequential review gates (G1 through G5).
  - [x] Defines Claude-Code-Game-Studios skill equivalents for autonomous agents.
  - [x] Establishes 8 architectural non-negotiables for engineers.

#### Ticket T-02: Standardized Ticket Tracker & Workflow
- **Milestone:** M1
- **Status:** `done`
- **Blocked by:** None — can start immediately
- **What to build:** Create `docs/sushi-game/ticket-tracker.md` standardizing ticket schemas, DoR, DoD, and master ticket inventory across M1–M4.
- **DoR Checklist:**
  - [x] Clear objective aligned with `docs/agents/issue-tracker.md`.
  - [x] Target file path `docs/sushi-game/ticket-tracker.md` defined.
  - [x] No blockers.
- **Acceptance Criteria & DoD:**
  - [x] Master status board listing all tickets and dependencies.
  - [x] Formal 6-point Definition of Ready (DoR).
  - [x] Formal 8-point Definition of Done (DoD).
  - [x] Full ticket specifications for T-01 through T-15 and T-E2E.

#### Ticket T-03: Comprehensive Game Design Document (GDD)
- **Milestone:** M1
- **Status:** `done`
- **Blocked by:** None — can start immediately
- **What to build:** Create `docs/sushi-game/gdd.md` formalizing high concept, player personas, core loop, mechanics, invariants, and anti-features.
- **DoR Checklist:**
  - [x] Incorporates approved decisions from `sushigame.md`.
  - [x] Target file path `docs/sushi-game/gdd.md` defined.
- **Acceptance Criteria & DoD:**
  - [x] 4 core design pillars documented (Study-First, Stress-Free Accrual, Tactical Bottlenecks, Personal Expression).
  - [x] Full player loop flowchart specified.
  - [x] Mechanical invariants and anti-features explicitly listed.
  - [x] Menu and decoration customization rules defined.

#### Ticket T-04: Mathematical Economy & Balancing Model
- **Milestone:** M1
- **Status:** `done`
- **Blocked by:** None — can start immediately
- **What to build:** Create `docs/sushi-game/economy-balance-model.md` defining math formulas, 1/60,000 yen math, 8h/12h caps, and full catalog expansion for Genki 6–12.
- **DoR Checklist:**
  - [x] Aligned with two-capacity model $O = \min(K, S)$ and integer math units.
  - [x] Target file path `docs/sushi-game/economy-balance-model.md` defined.
- **Acceptance Criteria & DoD:**
  - [x] Formal mathematical equations for accrual, capping, and whole-yen display rounding.
  - [x] Complete catalog expansion table covering all Genki I chapters 6–12.
  - [x] Balance pacing rationale ensuring non-inflationary linear rate growth (10 to 90 ¥/min).
  - [x] Proof of zero permanent progression deadlocks.

#### Ticket T-05: UX & Art Quality Checklist
- **Milestone:** M1
- **Status:** `done`
- **Blocked by:** None — can start immediately
- **What to build:** Create `docs/sushi-game/ux-art-quality-checklist.md` establishing Edo-modern visual tokens, SVG layer hierarchy, responsive breakpoints, and WCAG 2.1 AA checklist.
- **DoR Checklist:**
  - [x] Aligns with inline SVG scene (`viewBox 0 0 960 520`) and `sushi.css`.
  - [x] Target file path `docs/sushi-game/ux-art-quality-checklist.md` defined.
- **Acceptance Criteria & DoD:**
  - [x] Palette token specs: Edo wood, tatami cream, dark pine, salmon red.
  - [x] SVG layer order specification (Background $\to$ Architecture $\to$ Counter $\to$ Equipment $\to$ Dishes $\to$ Wall Decor $\to$ Floor Decor).
  - [x] Responsive design matrix (360px, 480px, 768px, 1024px+).
  - [x] WCAG 2.1 AA criteria (contrast, keyboard focus visible, ARIA live regions, reduced motion).

#### Ticket T-06: 4-Tier QA Test Plan Specification
- **Milestone:** M1
- **Status:** `done`
- **Blocked by:** None — can start immediately
- **What to build:** Create `docs/sushi-game/qa-test-plan.md` defining testing tiers (Domain logic, Concurrency/adversarial, Backend rules/emulator, Browser Playwright E2E).
- **DoR Checklist:**
  - [x] Based on existing 268-test baseline and package.json test scripts.
  - [x] Target file path `docs/sushi-game/qa-test-plan.md` defined.
- **Acceptance Criteria & DoD:**
  - [x] Tier 1 (Domain logic & integer math invariants) specified.
  - [x] Tier 2 (Concurrency, idempotency, clock skew) specified.
  - [x] Tier 3 (Firestore rules, Google auth gate, Cloud functions) specified.
  - [x] Tier 4 (Browser E2E, chunk splitting, user journeys) specified.

#### Ticket T-07: Forensic Studio Audit Logs Template & Records
- **Milestone:** M1
- **Status:** `done`
- **Blocked by:** None — can start immediately
- **What to build:** Create `docs/sushi-game/audit-logs.md` with standardized forensic log schema and initial audit baseline.
- **DoR Checklist:**
  - [x] Establishes audit structure for M2 economy balance findings.
  - [x] Target file path `docs/sushi-game/audit-logs.md` defined.
- **Acceptance Criteria & DoD:**
  - [x] Standardized audit record template defined.
  - [x] Baseline audit records documenting MVP state, architecture boundaries, curriculum balance, and UX/A11y.
  - [x] Clear sign-off schema for studio leads.

---

### Milestone 2: Studio Economy & Design Audit

#### Ticket T-08: Studio Economy & Pacing Audit
- **Milestone:** M2
- **Status:** `done`
- **Blocked by:** T-03, T-04, T-07
- **What to build:** Perform forensic audit of income pacing, upgrade costs, and Genki 6–12 curriculum study sync; log findings in `audit-logs.md`.
- **Target Files:** `docs/sushi-game/audit-logs.md`, `src/course/sushi-game/economy.ts`
- **DoR Checklist:**
  - [x] [DoR-1] Pedagogical Value: Verifies Japanese study pace (1-3 days) vs idle time (30-180m).
  - [x] [DoR-2] Exact Scope & File Boundaries: Analyzes `src/course/sushi-game/economy.ts` and `catalog.ts`.
  - [x] [DoR-3] Dependencies Resolved: T-03, T-04, T-07 marked `done`.
  - [x] [DoR-4] Interface & Type Contracts: Two-capacity model $O = \min(K, S)$ and 1/60,000 yen math verified.
  - [x] [DoR-5] Verifiable Acceptance Criteria: Pacing curve, dead-zones, and macro-equilibrium documented.
  - [x] [DoR-6] Verification Commands Defined: `npm test`, `npm run typecheck`, `npm run build`.
- **Acceptance Criteria & DoD:**
  - [x] Earn rates simulated across all Genki milestones (10 to 90 ¥/min sub-linear curve).
  - [x] Time-to-earn analyzed against expected study time per chapter (1–3 days).
  - [x] Identified pacing dead-zones or bottlenecks documented with recommendations.
  - [x] Audit record AUD-2026-10-25-05 signed off by ED and GD.

#### Ticket T-09: Bottleneck & Cap Balance Audit
- **Milestone:** M2
- **Status:** `done`
- **Blocked by:** T-04, T-07, T-08
- **What to build:** Audit 8h/12h idle accrual caps and prospective upgrade application behavior.
- **Target Files:** `docs/sushi-game/audit-logs.md`, `src/course/sushi-game/catalog.ts`
- **DoR Checklist:**
  - [x] [DoR-1] Pedagogical Value: Verifies that idle accumulation bounds prevent study disincentive.
  - [x] [DoR-2] Exact Scope & File Boundaries: Evaluates `calculateAccrual` and `applyProspectiveUpgrade`.
  - [x] [DoR-3] Dependencies Resolved: T-04, T-07, T-08 marked `done`.
  - [x] [DoR-4] Interface & Type Contracts: Bounded lazy accrual $P = \min(\Delta t, C - T_{\text{used}})$ verified.
  - [x] [DoR-5] Verifiable Acceptance Criteria: Cap clamping, stopped time discard, and prospective upgrades verified.
  - [x] [DoR-6] Verification Commands Defined: `node --test tests/sushi-m1-math-challenge.test.ts`.
- **Acceptance Criteria & DoD:**
  - [x] Verified that cap purchases preserve used production time and discard stopped time.
  - [x] Verified prospective upgrade transitions when purchasing at capped register.
  - [x] Bottleneck explanation UX messaging evaluated for clarity.
  - [x] Audit record AUD-2026-10-25-05 signed off by ED and QL.

---

### Milestone 3: Polish & Code Implementation

#### Ticket T-10: Catalog & Economy Expansion (21-Item Master)
- **Milestone:** M3
- **Status:** `done`
- **Blocked by:** T-04, T-07, T-08, T-09
- **What to build:** Expand `src/course/sushi-game/catalog.ts` and `types.ts` to implement 14 additional items completing the master 21-item progression matrix for Genki I chapters 6–12 (including Chapters 7 and 9 Silver recipe variants).
- **Target Files:** `src/course/sushi-game/catalog.ts`, `src/course/sushi-game/types.ts`
- **DoR Checklist:**
  - [x] [DoR-1] Pedagogical Value: Provides continuous motivation across all 7 Genki chapters.
  - [x] [DoR-2] Exact Scope & File Boundaries: Targets `catalog.ts` and `types.ts`.
  - [x] [DoR-3] Dependencies Resolved: T-04, T-07, T-08, T-09 marked `done`.
  - [x] [DoR-4] Interface & Type Contracts: `SushiCatalogItem` schema, canonical IDs, and integer prices specified.
  - [x] [DoR-5] Verifiable Acceptance Criteria: All 14 new items specified with exact IDs, prices, and stats.
  - [x] [DoR-6] Verification Commands Defined: `npm run typecheck`, `npm test`.
- **Acceptance Criteria & DoD:**
  - [x] Chapter 7 Silver: `kappamaki` (Recipe, 900 ¥, 54,000,000 units).
  - [x] Chapter 8 Bronze: `precision_knife` (+1 Kitchen, 2,400 ¥, 144,000,000 units).
  - [x] Chapter 8 Silver: `maguro_nigiri` (Recipe, 1,200 ¥, 72,000,000 units).
  - [x] Chapter 8 Gold: `noren_curtain` (Wall Decor, 600 ¥, 36,000,000 units).
  - [x] Chapter 9 Silver: `ebi_nigiri` (Recipe, 1,500 ¥, 90,000,000 units).
  - [x] Chapter 10 Bronze: `service_counter` (+2 Service, 5,400 ¥, 324,000,000 units).
  - [x] Chapter 10 Silver: `tamago_nigiri` (Recipe, 1,800 ¥, 108,000,000 units).
  - [x] Chapter 10 Gold: `andon_lantern` (Floor Decor, 750 ¥, 45,000,000 units).
  - [x] Chapter 11 Bronze: `sous_chef` (+2 Kitchen, 7,200 ¥, 432,000,000 units).
  - [x] Chapter 11 Silver: `sashimi_plate` (Recipe, 2,400 ¥, 144,000,000 units).
  - [x] Chapter 11 Gold: `sakura_bonsai` (Floor Decor, 900 ¥, 54,000,000 units).
  - [x] Chapter 12 Bronze: `master_license` (+5 ¥ Avg Revenue, 10,800 ¥, 648,000,000 units).
  - [x] Chapter 12 Silver: `omakase_menu` (Recipe, 3,000 ¥, 180,000,000 units).
  - [x] Chapter 12 Gold: `golden_maneki_neko` (Prestige Trophy/Floor Decor, 1,500 ¥, 90,000,000 units).
  - [x] Total catalog investment across all 21 items equals exactly 48,000 ¥ (2,880,000,000 units).
  - [x] `npm run typecheck` exits with status 0.
  - [x] `npm test` passes all catalog unit tests cleanly.

#### Ticket T-11: Curriculum Medal Grant Rules Expansion
- **Milestone:** M3
- **Status:** `done`
- **Blocked by:** T-03, T-10
- **What to build:** Update `src/course/sushi-game/medals.ts` to map new unlock grants to Genki I chapters 8, 10, 11, and 12 with monotonic non-revocation.
- **Target Files:** `src/course/sushi-game/medals.ts`
- **Acceptance Criteria & DoD:**
  - [x] `UnlockGrantId` union expanded to include all new items.
  - [x] `MEDAL_GRANT_RULES` maps each new item to `lessonNumber` (8, 10, 11, 12) and tier.
  - [x] Monotonic set union `mergePermanentGrants` retains all historical grants.
  - [x] `npm test` passes all medal unit tests cleanly.

#### Ticket T-12: Visual Scene Layer Polish & Asset Expansion
- **Milestone:** M3
- **Status:** `done`
- **Blocked by:** T-05, T-10
- **What to build:** Enhance `src/course/sushi-game/restaurant-scene.ts` to render visual SVG representations for new decorations and recipe plates.
- **Target Files:** `src/course/sushi-game/restaurant-scene.ts`
- **Acceptance Criteria & DoD:**
  - [x] Wall slot renders Noren curtain or Paper lantern based on equipped item.
  - [x] Floor slot renders Sakura bonsai, Andon lantern, or Golden Maneki-Neko.
  - [x] Recipe plates display tuna, tamago, or sashimi variations.
  - [x] SVG layer order strictly preserved; viewBox remains `0 0 960 520`.
  - [x] Reduced motion styles verified.

#### Ticket T-13: UX, Accessibility & Bottleneck Feedback Polish
- **Milestone:** M3
- **Status:** `done`
- **Blocked by:** T-05, T-10
- **What to build:** Polish `src/course/sushi-game/sushi-view.ts` for prospective rate previews, bottleneck explanation banners, keyboard focus visible, and screen reader ARIA live updates.
- **Target Files:** `src/course/sushi-game/sushi-view.ts`, `src/course/sushi-game/sushi.css`
- **Acceptance Criteria & DoD:**
  - [x] Bottleneck explainer displays prospective delta and tips.
  - [x] `aria-live="polite"` announces revenue collections, purchases, and unlocks in Swedish.
  - [x] `:focus-visible` styling prominent across all interactive elements.
  - [x] Minimum 44x44 CSS px touch targets across mobile views.

---

### Milestone 4: Quality Assurance & Regression Verification

#### Ticket T-14: Automated Test Suite Expansion (Tiers 1 & 2)
- **Milestone:** M4
- **Status:** `done`
- **Blocked by:** T-06, T-10, T-11
- **What to build:** Add automated unit, adversarial, and concurrency tests in `tests/` verifying all expanded items, medal grants, caps, and transactions.
- **Target Files:** `tests/sushi-economy.test.ts`, `tests/sushi-medals.test.ts`, `tests/sushi-purchase.test.ts`, `tests/sushi-m4-regression.test.ts`
- **Acceptance Criteria & DoD:**
  - [x] Unit tests for all 12 new catalog items.
  - [x] Adversarial tests for rapid concurrent purchases and cap extensions.
  - [x] Monotonic non-revocation tests across chapters 8, 10, 11, 12.
  - [x] All tests execute via `npm test` with 0 failures.

#### Ticket T-15: Release Gate, Chunk Splitting & System Verification
- **Milestone:** M4
- **Status:** `done`
- **Blocked by:** T-10, T-11, T-12, T-13, T-14
- **What to build:** Execute full system regression verification, verify bundle chunk isolation, audit feature flag configuration, and sign off.
- **Target Files:** `src/course/sushi-game/config.ts`, `dist/`, `docs/sushi-game/audit-logs.md`
- **Acceptance Criteria & DoD:**
  - [x] `npm run typecheck` exits 0.
  - [x] `npm test` passes 100% of tests.
  - [x] `npm run build` exits 0; `sushi-view-*.js` and `sushi-*.css` are deferred lazy chunks.
  - [x] Main study views, flashcards, and Dojo drills verified unaffected.
  - [x] Final audit log entry signed off by Department Leads.

---

### E2E Track

#### Ticket T-E2E: Requirement-Driven Opaque-Box E2E Test Suite
- **Milestone:** E2E
- **Status:** `done`
- **Blocked by:** None — can start immediately
- **What to build:** Autonomous end-to-end Playwright test suite validating full user journeys (study medal earn $\to$ restaurant unlock $\to$ manual collection $\to$ purchase $\to$ visual update).
- **Target Files:** `tests/e2e/sushi-view.spec.ts`, `tests/backend/sushi-browser.spec.ts`
- **Acceptance Criteria & DoD:**
  - [x] Opaque-box test harness independent of implementation details.
  - [x] Verifies deferred loading boundary at `#/sushi`.
  - [x] Verifies end-to-end medal synchronization and celebratory banner.
  - [x] Publishes `TEST_READY.md`.
