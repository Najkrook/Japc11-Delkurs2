# Sushi Game — Studio Forensic Audit Logs

> **Document:** Tamper-Evident Forensic Studio Audit Logs & Balancing History  
> **Origin:** Adapted from Claude-Code-Game-Studios `/audit-log` and forensic review protocol  
> **Target Scope:** Sushi Restaurant Tycoon (`src/course/sushi-game/`, `docs/sushi-game/`)  
> **Document Owner:** Lead QA Auditor & Producer (QL / PM)  
> **Status:** Active Forensic Register

---

## 1. Audit Framework & Logging Protocol

### 1.1 Purpose & Policy

Every change to economic balance parameters, progression gating, currency conversion formulas, Firestore security rules, or visual layer stacks requires an authoritative audit entry in this log.

Audit records are **immutable**, **quantitative**, and **traceable**:

- No vague descriptions: exact values, delta percentages, time-to-earn metrics, and code references are mandatory.
- All conclusions must be supported by automated test execution results (`npm test`, `npm run typecheck`, `npm run build`).

### 1.2 Standard Audit Log Entry Schema

Each audit record adheres to the following specification:

- **Audit ID:** `AUD-YYYY-MM-DD-NN`
- **Timestamp (UTC):** ISO 8601 UTC timestamp.
- **Auditor & Discipline:** Auditor agent identity and studio role (GD, ED, AD, LE, QL, PM).
- **Audit Scope & Target:** Concrete files, functions, and models analyzed.
- **Methodology & Tools:** Test runners, static analysis, emulation, Playwright, mathematical simulation.
- **Observations & Quantitative Metrics:** Measured parameters, earn rates, session yields.
- **Discrepancies / Anomalies Identified:** Defects, pacing imbalances, accessibility violations.
- **Remediation & Balance Adjustments:** Mathematical, architectural, or code adjustments made.
- **Verification Evidence:** Test pass counts, runtime, build chunk byte counts, exit codes.
- **Sign-Off Status:** `APPROVED`, `CONDITIONALLY APPROVED`, or `REJECTED`.

---

## 2. Historical Baseline Audit Records

### AUD-2026-10-22-01: Approved Accounting Contract & MVP Rules

- **Timestamp:** 2026-10-22T14:00:00Z
- **Auditor & Discipline:** Product Owner & Lead Systems Architect (PO / LE)
- **Audit Scope & Target:** `sushigame.md` Section 5.4–5.5 (Ticket 01 decisions)
- **Methodology & Tools:** Specification review, mathematical proofs of idle accrual limits.
- **Observations & Quantitative Metrics:**
  - Original draft permitted floating-point yen calculations, introducing potential precision loss over long idle periods.
  - Ambiguity existed regarding whether mid-period rate upgrades retroactively applied to uncollected earnings.
- **Discrepancies / Anomalies Identified:**
  - High risk of floating-point drift over multi-day idle periods.
  - Potential exploit where purchasing a cap upgrade could retroactively award earnings for stopped time.
- **Remediation & Balance Adjustments:**
  - Formalized exact $1 \text{ Yen} = 60{,}000 \text{ units}$ integer arithmetic.
  - Established prospective upgrade rule: past time accounts at old rate; new rate applies forward.
  - Enforced stopped time discard: excess time past cap is permanently discarded; cap extensions add future capacity only.
  - Mandated explicit manual collection ("Hämta intäkter") before funds become spendable.
- **Verification Evidence:** Formal approval documented in `sushigame.md` lines 133–159.
- **Sign-Off Status:** `APPROVED`

---

### AUD-2026-10-25-01: Architecture Boundary & Code-Splitting Audit

- **Timestamp:** 2026-10-25T11:45:00Z
- **Auditor & Discipline:** Lead Systems Engineer (LE)
- **Audit Scope & Target:** `vite.config.ts`, `src/course/course-view.ts`, `dist/assets/`
- **Methodology & Tools:** Static bundle analysis, Rollup chunk inspection, `npm run build`.
- **Observations & Quantitative Metrics:**
  - Production build produces `dist/assets/sushi-view-BkrdswyW.js` (47.74 kB, gzip: 13.06 kB) and `dist/assets/sushi-CSfESCgi.css` (18.98 kB, gzip: 4.07 kB).
  - Main bundle `dist/assets/index-7ugeI5rN.js` (325.73 kB) contains zero sushi UI or component code.
  - Extra study bundle `dist/assets/extra-studies-C6TsAQb8.js` (958.83 kB) operates completely independently.
- **Discrepancies / Anomalies Identified:**
  - None. Code-splitting boundary at `#/sushi` is completely decoupled.
- **Remediation & Balance Adjustments:**
  - Maintained dynamic import boundary via `loadSushiGameModule()`.
- **Verification Evidence:** `npm run build` exits with code 0; `npm run typecheck` exits with code 0.
- **Sign-Off Status:** `APPROVED`

---

### AUD-2026-10-25-02: Genki I Chapters 6–12 Curriculum & Economy Balance Audit

- **Timestamp:** 2026-10-25T12:15:00Z
- **Auditor & Discipline:** Economy & Balance Designer (ED)
- **Audit Scope & Target:** `src/course/sushi-game/catalog.ts`, `medals.ts`, `economy.ts`, `sushigame.md`
- **Methodology & Tools:** Spreadsheet rate modeling, mathematical simulation of Genki study pacing (1 chapter per 3–6 days).
- **Observations & Quantitative Metrics:**
  - Base restaurant throughput: $O = \min(1, 2) = 1$ order/min $\implies 10$ ¥/min ($600$ ¥/h).
  - Chapter 6 Prep Counter: $K \to 3 \implies O = \min(3, 2) = 2$ orders/min $\implies 20$ ¥/min ($1{,}200$ ¥/h).
  - Single 8h sleep cycle yields $4{,}800$ ¥ at base or $9{,}600$ ¥ at 20 ¥/min.
- **Discrepancies / Anomalies Identified (Severity: High):**
  - **Curriculum Blackout:** 4 of 7 curriculum chapters (Chapters 8, 10, 11, and 12) have zero catalog items and zero medal rewards.
  - **Silver Recipe Gaps:** Chapters 7 and 9 lack Silver recipe unlocks.
  - **Runaway Wealth Risk:** Without downstream sinks in Chapters 8–12, students accumulating currency would experience excessive currency inflation once later chapters were introduced.
- **Remediation & Expansion Proposal:**
  - Formulated full 21-item progression matrix spanning all 7 Genki chapters (Chapters 6–12).
  - Introduced balanced pacing progression:
    - Chapter 8 (Bronze: Precision Knife +1 Kitchen, 2,400 ¥; Silver: Maguro recipe, 1,200 ¥; Gold: Noren curtain, 600 ¥).
    - Chapter 10 (Bronze: Service Counter +2 Service, 5,400 ¥; Silver: Tamago recipe, 1,800 ¥; Gold: Andon lantern, 750 ¥).
    - Chapter 11 (Bronze: Sous Chef +2 Kitchen, 7,200 ¥; Silver: Sashimi plate, 2,400 ¥; Gold: Sakura bonsai, 900 ¥).
    - Chapter 12 (Bronze: Master License +5 ¥/order, 10,800 ¥; Silver: Omakase menu, 3,000 ¥; Gold: Golden Maneki-Neko, 1,500 ¥).
    - Added Chapter 7 Silver (Kappamaki, 900 ¥) and Chapter 9 Silver (Ebi Nigiri, 1,500 ¥).
  - Rate growth scales sub-linearly from 10 ¥/min to 90 ¥/min (9x max expansion). Total catalog investment: 48,000 ¥.
  - Pacing ensures time-to-earn for any item is between 15 and 180 minutes of active idle time.
- **Verification Evidence:** Mathematical balance model published in `docs/sushi-game/economy-balance-model.md`.
- **Sign-Off Status:** `APPROVED` for Milestone 3 implementation.

---

### AUD-2026-10-25-03: UX, Responsive & WCAG 2.1 AA Accessibility Audit

- **Timestamp:** 2026-10-25T12:30:00Z
- **Auditor & Discipline:** Art & UX Director (AD)
- **Audit Scope & Target:** `src/course/sushi-game/sushi.css`, `restaurant-scene.ts`, `sushi-view.ts`
- **Methodology & Tools:** CSS token audit, contrast ratio calculations, Playwright mobile emulation (375x812), screen reader markup inspection.
- **Observations & Quantitative Metrics:**
  - Contrast ratios for UI badges and text exceed WCAG 2.1 AA requirements ($\ge 4.5:1$).
  - Screen reader polite live region announces collections, purchases, and unlocks in Swedish.
  - Conveyor belt animation halts on `@media (prefers-reduced-motion: reduce)`.
  - All interactive controls provide minimum $44 \times 44 \text{ CSS px}$ touch targets.
- **Discrepancies / Anomalies Identified (Severity: Medium):**
  - Expanded catalog items (knife, sous chef, dishes, and decor) will require dedicated SVG rendering groups in `restaurant-scene.ts` during Milestone 3.
  - Keyboard `:focus-visible` styling must be maintained when adding new recipe and decor buttons.
- **Remediation & Balance Adjustments:**
  - Codified 7-layer SVG hierarchy and WCAG checklist in `docs/sushi-game/ux-art-quality-checklist.md`.
- **Verification Evidence:** `tests/e2e/mobile-layout.spec.ts` passes; scoped stylesheet inspection verified.
- **Sign-Off Status:** `APPROVED`

---

### AUD-2026-10-25-04: Milestone 1 Studio Documentation & Specification Sign-Off

- **Timestamp:** 2026-10-25T12:45:00Z
- **Auditor & Discipline:** Studio Framework Worker & QA Lead (Worker M1-1 / QL)
- **Audit Scope & Target:** All 7 Studio Documentation files:
  1. `docs/game-studio/framework.md`
  2. `docs/sushi-game/gdd.md`
  3. `docs/sushi-game/economy-balance-model.md`
  4. `docs/sushi-game/ux-art-quality-checklist.md`
  5. `docs/sushi-game/qa-test-plan.md`
  6. `docs/sushi-game/ticket-tracker.md`
  7. `docs/sushi-game/audit-logs.md`
- **Methodology & Tools:** Full repository verification: `npm run typecheck`, `npm test`, `npm run build`.
- **Observations & Quantitative Metrics:**
  - All 7 documentation files created cleanly in their designated directories.
  - Zero modifications to application source code or tests (pure documentation milestone).
  - TypeScript compilation: 0 errors (`tsc --noEmit`).
  - Unit test suite: 278 tests executed, 278 passed, 0 failed in 1.56s.
  - Production build: isolated bundles verified (`sushi-view-*.js` 47.74 kB, `sushi-*.css` 18.98 kB).
- **Discrepancies / Anomalies Identified:**
  - None. All Milestone 1 requirements satisfied.
- **Remediation & Balance Adjustments:**
  - N/A.
- **Verification Evidence:**
  - `npm run typecheck` $\implies$ exit code 0.
  - `npm test` $\implies$ 278 passed, 0 failed.
  - `npm run build` $\implies$ exit code 0.
- **Sign-Off Status:** `APPROVED`

---

### AUD-2026-10-25-05: Studio Economy, Pacing & Curriculum Balance Audit

- **Timestamp:** 2026-10-25T13:50:00Z
- **Auditor & Discipline:** Economy Audit Explorer & Worker (ED / GD)
- **Audit Scope & Target:** `src/course/sushi-game/economy.ts`, `catalog.ts`, `medals.ts`, `docs/sushi-game/economy-balance-model.md`, `ticket-tracker.md`
- **Methodology & Tools:** Mathematical simulation, Genki study pace modeling, 5,000-partition splitting invariance stress tests, static code analysis.
- **Observations & Quantitative Metrics:**
  - Base throughput is $O = \min(1, 2) = 1$ order/min $\implies 10$ ¥/min ($600$ ¥/h).
  - Current catalog contains only 7 items, creating severe progression dead-zones in Chapters 8, 10, 11, and 12, as well as missing Silver recipes in Chapters 7 and 9.
  - In current code, purchasing `conveyor_belt` at Chapter 9 yields only 30 ¥/min (because Chapter 8 knife is absent), deviating from the approved 40 ¥/min model rate.
  - Upgrade costs (300 ¥ to 10,800 ¥) require between 15 and 180 minutes of productive idle time.
  - Average Genki chapter study pace is 1–3 days (1,440–4,320 minutes). Idle earn time represents only 2.7%–12.5% of study time, proving that Japanese study is the strict pacing factor.
  - Total catalog sink across 21 items is exactly 48,000 ¥ (Functional: 31,500 ¥; Recipes: 11,400 ¥; Decor: 5,100 ¥).
  - Idle collection caps (8h = 28.8M ms; 12h = 43.2M ms) clamp idle earnings and discard stopped time ($X = \Delta t - P$), eliminating runaway inflation from absent players.
  - Study Lock guarantees that unspent wallet balances cannot bypass locked chapter requirements.
- **Discrepancies / Anomalies Identified (Severity: High):**
  - **T-10 Scope Divergence:** Ticket T-10 in `ticket-tracker.md` omitted Chapter 7 Silver (`kappamaki`, 900 ¥) and Chapter 9 Silver (`ebi_nigiri`, 1,500 ¥), and specified divergent prices for tamago (1,500 vs 1,800 ¥) and sashimi (2,000 vs 2,400 ¥), breaking the 48,000 ¥ equilibrium by 3,100 ¥.
  - **Item ID Divergence:** Outdated item IDs in T-10 (`prep_knife`, `tuna_nigiri`, `assistant_chef`, `golden_manekineko`).
  - **Missing Blocker:** T-08 and T-09 omitted T-07 blocker.
  - **DoR Checklists:** Backlog tickets lacked explicit 6-point DoR checklists.
- **Remediation & Balance Adjustments:**
  - Updated Ticket T-10 scope to 14 items (12 new chapter items + 2 Silver recipe variants) with canonical IDs and prices restoring 48,000 ¥ equilibrium.
  - Added T-07 to `Blocked by` in T-08 and T-09.
  - Formulated full 6-point DoR checklists for T-08, T-09, and T-10.
  - Approved 21-item progression matrix for Milestone 3 implementation.
- **Verification Evidence:**
  - `npm run typecheck` $\implies$ exit code 0.
  - `npm test` $\implies$ 296 passed, 0 failed in 1.29s.
  - `npm run build` $\implies$ exit code 0; clean lazy chunk isolation (`sushi-view-*.js`).
- **Sign-Off Status:** `APPROVED`

---

### AUD-2026-10-25-06: Final Studio Release & Regression Gate Audit

- **Timestamp:** 2026-10-25T15:15:00Z
- **Auditor & Discipline:** QA Lead & Release Verification Worker (worker_m4_1 / QL)
- **Audit Scope & Target:** `tests/sushi-m4-regression.test.ts`, `src/course/sushi-game/`, `dist/`, `docs/sushi-game/ticket-tracker.md`, `TEST_READY.md`
- **Methodology & Tools:** Node.js 24 native test runner (`node:test`), TypeScript compiler (`tsc --noEmit`), Vite production build bundle inspection, mathematical invariant proofs.
- **Observations & Quantitative Metrics:**
  - Automated test suite executed: 336 tests passed, 0 failed, 0 skipped across all test suites in 1.36s.
  - **Extended Offline Accrual Verified:**
    - 10 minutes: 200 ¥ (12,000,000 units), 600,000 ms produced, remaining cap 28.2M ms.
    - 1 hour: 1,200 ¥ (72,000,000 units), 3,600,000 ms produced, remaining cap 25.2M ms.
    - 8 hours (default cap): 9,600 ¥ (576,000,000 units), 28,800,000 ms produced, isCapped = true, remaining cap 0 ms.
    - 12 hours (with cap extension): 14,400 ¥ (864,000,000 units), 43,200,000 ms produced, isCapped = true.
    - 24 hours (clamped): 14,400 ¥ (864,000,000 units), 43,200,000 ms produced, 43,200,000 ms (12h) stopped time discarded.
    - Manual collection: resets uncollected register to 0, resets usedProductionMs to 0, transfers 14,400 ¥ to spendable balance, clears cap for fresh accumulation.
  - **Medal Unlock Monotonic Non-Revocation Verified:**
    - All 21 master catalog items map to Genki I chapters 6–12 by `lessonNumber` (3 items per chapter, Bronze/Silver/Gold).
    - Monotonic retention tested under student study score drops, quiz mistake additions, and complete course reset to 0%; all 21 items retained with zero loss.
  - **Purchase Transactions Verified:**
    - Exact 60,000 units/yen fixed-point integer accounting verified across all price points.
    - Balance floor enforcement: purchasing fails with `INSUFFICIENT_FUNDS` on a 1-unit deficit; uncollected register funds cannot fund purchases; exact funds purchase succeeds leaving 0 balance units.
    - Prospective upgrade rate transitions verified across the entire chain: $O = \min(K, S), R = O \times A$ stepping from 10 ¥/min baseline up to 90 ¥/min ceiling; bottleneck detection correctly differentiates kitchen vs service limits.
    - Idempotency verified: repeated request keys return cached state with `wasAlreadyProcessed: true` and 0 duplicate charges.
    - Decoration slot equipping verified for `wallSlot` and `floorSlot`, including unequipped `null`, slot mismatch rejection, and unowned item rejection.
  - **Japanese Study Platform Non-Interference Verified:**
    - Flashcards & vocabulary drills operate with zero sushi side-effects or state pollution.
    - Kanji bank and quiz questions generated across all Genki chapters without interference.
    - て-Form Dojo verb conjugation drills verify accurate forms and progress commands.
    - Curriculum data integrity across Genki I chapters 6–12 completely intact (26–49 vocab, 14–16 kanji, 8–14 conjugations, 10–14 quiz questions per chapter).
  - **Production Build & Deferred Chunk Isolation Verified:**
    - `npm run typecheck` exits with status 0.
    - `npm run build` exits with status 0.
    - Deferred lazy chunks: `dist/assets/sushi-view-CuB43N9a.js` (63.05 kB) and `dist/assets/sushi-DrZVPbTV.css` (20.01 kB).
    - `dist/assets/index-GGPyIhR8.js` verified to contain 0 sushi strings ("Hämta intäkter", "prep_counter", "kappamaki", "conveyor_belt", etc.).
- **Discrepancies / Anomalies Identified:**
  - None. All requirements for Milestone 4 and final release gating are satisfied.
- **Remediation & Balance Adjustments:**
  - N/A.
- **Verification Evidence:**
  - `npm run typecheck` $\implies$ exit code 0.
  - `npm test` $\implies$ 336 passed, 0 failed in 1.36s.
  - `npm run build` $\implies$ exit code 0; clean lazy chunk isolation.
- **Sign-Off Status:** `APPROVED`

---

## 3. Audit Verification & Regression Gate Sign-Off Matrix

|       Audit ID        | Scope Area                                   |   Status   | Verified Commands                                | Sign-Off Date |
| :-------------------: | :------------------------------------------- | :--------: | :----------------------------------------------- | :-----------: |
| **AUD-2026-10-22-01** | Accounting Contract & MVP Rules              | `APPROVED` | `node --test tests/sushi-economy.test.ts`        |  2026-10-22   |
| **AUD-2026-10-25-01** | Architecture Boundary & Code-Splitting       | `APPROVED` | `npm run build`, `npm run typecheck`             |  2026-10-25   |
| **AUD-2026-10-25-02** | Curriculum & Economy Balance Model           | `APPROVED` | `node --test tests/sushi-medals.test.ts`         |  2026-10-25   |
| **AUD-2026-10-25-03** | UX, Responsive & WCAG 2.1 AA                 | `APPROVED` | `npm run test:e2e`                               |  2026-10-25   |
| **AUD-2026-10-25-04** | Milestone 1 Studio Documentation Sign-Off    | `APPROVED` | `npm run typecheck`, `npm test`, `npm run build` |  2026-10-25   |
| **AUD-2026-10-25-05** | Studio Economy, Pacing & Curriculum Balance  | `APPROVED` | `npm run typecheck`, `npm test`, `npm run build` |  2026-10-25   |
| **AUD-2026-10-25-06** | Final Release Gate & Regression Verification | `APPROVED` | `npm run typecheck`, `npm test`, `npm run build` |  2026-10-25   |
