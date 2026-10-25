# Sushi Restaurant Game — Test Infrastructure & QA Architecture

**Status**: Active & Authoritative  
**Date**: 2026-10-25  
**Scope**: Japanese Language Study Platform — Sushi Restaurant Simulation (`src/course/sushi-game/`)  
**Maintainer**: E2E Test Engineering & QA Track

---

## 1. Executive Summary & Test Philosophy

The Sushi Restaurant Game is an idle simulation embedded within the Japanese language learning platform (JAPC11 Delkurs 2). Its primary pedagogical purpose is to reward regular study progress in Genki I (Chapters 6–12) with cozy, visual, and economic restaurant progression without creating distracting time-sinks or pay-to-win dynamics.

To ensure long-term stability, zero floating-point financial drift, and clean isolation from primary study views (flashcards, kanji cards, Dojo conjugation drills), this testing infrastructure enforces four fundamental principles:

1. **Opaque-Box, Requirement-Driven Testing**: Tests are written against strict interface specifications and mathematical invariants rather than implementation internals. Expected outputs are derived mathematically from the authoritative game brief (`sushigame.md`) and curriculum specifications (`PROJECT.md`).
2. **Deterministic, Lossless Math (Exact 1/60,000 Yen)**: Internal currency accounting uses fixed-point integer arithmetic where 1 yen = 60,000 units. Tests assert exact integer identities and verify zero drift across fractional millisecond accrual intervals.
3. **Progressive Testability & Isolation**: Tests are self-contained, order-independent, and execute without external live dependencies. The in-memory repository pattern (`InMemorySushiRepository`) enables fast, deterministic verification of concurrency, clock skew, and persistence.
4. **Adversarial & Boundary Verification**: In accordance with game studio QA best practices, test suites systematically stress edge conditions: clock rollback, extreme offline absence (e.g. 1 year), rapid concurrent requests, race conditions, duplicate idempotency keys, and malformed curriculum snapshots.

---

## 2. 4-Tier Testing Methodology

The testing architecture is organized into four complementary tiers, balancing execution speed, diagnostic precision, and full-stack integration:

```
┌───────────────────────────────────────────────────────────────────┐
│ Tier 4: Browser E2E, Lazy Loading & UI Integration (Playwright)  │
│  - Code-splitting deferred chunk verification (Vite)              │
│  - SVG vector scene rendering & animations                        │
│  - User journeys: study drill completion -> sushi game unlock     │
├───────────────────────────────────────────────────────────────────┤
│ Tier 3: Backend Security & Cloud Functions (Firebase Emulators)  │
│  - Firestore security rules (read-only for client)                │
│  - Server-side atomic Cloud Function transactions                 │
│  - Authenticated Google sign-in gating & guest rejection          │
├───────────────────────────────────────────────────────────────────┤
│ Tier 2: Boundary, Corner Cases, Concurrency & Idempotency         │
│  - Clock skew, zero/negative elapsed time, extreme offline time   │
│  - Cap clamping (8h default, 12h extended) & stopped time discard │
│  - Rapid concurrency, repository locking, idempotency replay      │
│  - Monotonic non-revocation under course reset / score drops      │
├───────────────────────────────────────────────────────────────────┤
│ Tier 1: Domain Logic, Mathematics & Feature Contracts             │
│  - Two-capacity production rate: O = min(K, S), R = O * A        │
│  - Exact 1/60,000 yen conversion functions & affordance math      │
│  - Offline lazy accrual & interval-splitting invariance           │
│  - Genki Chapters 6–12 curriculum medal-to-grant mapping          │
│  - Shop catalog definitions, purchase logic & prospective impact  │
└───────────────────────────────────────────────────────────────────┘
```

### 2.1 Tier 1: Domain Logic, Mathematics & Feature Contracts

- **Execution Target**: Node.js 24 native test runner (`node:test`, `node:assert/strict`).
- **Scope**: Pure functional core (`economy.ts`, `medals.ts`, `catalog.ts`, `types.ts`).
- **Characteristics**: Zero I/O, sub-millisecond execution per test case, 100% deterministic mathematical verification.
- **Key Verifications**:
  - Two-capacity throughput bottleneck formulation ($O = \min(K, S), R = O \times A$).
  - Conversion functions: `yenToUnits()`, `unitsToWholeYen()`, `unitsToYenDecimal()`, `canAfford()`.
  - Lazy offline accrual: earned units exactly match $\text{producedMs} \times \text{yenPerMinute}$.
  - Accrual interval splitting invariance: $\text{accrue}(t_1) + \text{accrue}(t_2) \equiv \text{accrue}(t_1 + t_2)$.
  - Genki I Chapters 6–12 medal tier thresholds (Bronze $\ge 60\%$, Silver $\ge 80\%$, Gold $100\%$) and unlock grant IDs.

### 2.2 Tier 2: Boundary, Corner Cases, Concurrency & Idempotency

- **Execution Target**: Node.js 24 native test runner with `InMemorySushiRepository`.
- **Scope**: State transitions, asynchronous concurrency, and adversarial temporal inputs (`domain-service.ts`, `service.ts`).
- **Characteristics**: Fast async in-memory execution, simulated clock manipulation, high-volume concurrent stresses.
- **Key Verifications**:
  - Exact cap boundaries ($T = 28,800,000\text{ ms}$, $T - 1\text{ ms}$, $T + 1\text{ ms}$).
  - Long absence stress (e.g. 72 hours, 1 year offline) safely clamped without integer overflow.
  - Negative elapsed time (backward clock skew) cleanly clamped to 0 ms without corrupting accounting timestamps.
  - Stopped time discard: offline time accumulated past the cap prior to buying a cap upgrade is never retroactively paid.
  - Strict monotonic accumulation (`mergePermanentGrants`): study score reductions or course resets NEVER delete previously unlocked sushi items.
  - Idempotency key deduplication: identical keys return cached results without double-crediting balances or double-debiting funds.
  - Concurrent race condition serialization: simultaneous collections and purchases resolve cleanly via repository locking.

### 2.3 Tier 3: Backend Security Rules & Cloud Functions Integration

- **Execution Target**: Firebase Emulator Suite (`firebase emulators:exec --only firestore,functions,auth`).
- **Scope**: `firestore.rules` and `functions/src/index.ts`.
- **Characteristics**: Emulator-backed integration testing verifying cloud security boundaries.
- **Key Verifications**:
  - Client-side writes to `/users/{userId}/sushi/restaurant` are strictly prohibited (`allow write: if false;`).
  - Read access is restricted to authenticated owners (`request.auth.uid == userId`); anonymous users are denied.
  - Cloud Function `sushi` executes atomic dual-document transactions (`restaurant` + `course`) preventing split-brain states.
  - Server-authoritative timestamps override client-submitted timestamps to prevent client clock manipulation.

### 2.4 Tier 4: Browser E2E, Lazy-Loading & UI Integration

- **Execution Target**: Playwright (`@playwright/test`) across Chromium and Mobile WebKit.
- **Scope**: Bundled web application (`dist/` or Vite dev server).
- **Characteristics**: Real browser automation, DOM inspection, visual snapshotting, network chunk monitoring.
- **Key Verifications**:
  - Code-splitting boundary: loading study views (`#/`, `#/vecka/week-1`, `#/dojo`) loads zero sushi JavaScript or CSS.
  - Navigating to `#/sushi` dynamically imports `sushi-view-*.js` and `sushi-*.css`.
  - SVG vector illustration (`restaurant-scene.ts`) dynamically displays purchased equipment and equipped decorations.
  - Accessibility standards (WCAG 2.1 AA): keyboard tab order, `:focus-visible`, and `aria-live="polite"` announcers.
  - Page Visibility API: background tabs throttle the 1 Hz ticker and pause CSS belt animations to conserve CPU.
  - Full end-to-end user loop: complete study drill $\to$ earn medal $\to$ visit sushi game $\to$ celebrate unlock $\to$ collect offline earnings $\to$ purchase item.

---

## 3. Feature Checklist & Coverage Matrix

| #   | Feature Area               | Description                                                         | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Existing Test Files                                                              |
| --- | -------------------------- | ------------------------------------------------------------------- | :----: | :----: | :----: | :----: | -------------------------------------------------------------------------------- |
| F01 | Two-Capacity Model         | $O = \min(K, S), R = O \times A$; dynamic bottleneck identification |  [x]   |  [x]   |   -    |   -    | `sushi-economy.test.ts`                                                          |
| F02 | 1/60,000 Yen Math          | Fixed-point integer math; lossless currency calculations            |  [x]   |  [x]   |   -    |   -    | `sushi-economy.test.ts`                                                          |
| F03 | Lazy Offline Accrual       | Accrual evaluated on access; no background server timers            |  [x]   |  [x]   |  [x]   |   -    | `sushi-economy.test.ts`, `sushi-service.test.ts`                                 |
| F04 | Offline Cap Clamping       | 8h standard (28.8M ms), 12h extended (43.2M ms); excess discarded   |  [x]   |  [x]   |  [x]   |   -    | `sushi-economy.test.ts`, `sushi-service.test.ts`                                 |
| F05 | Manual Revenue Collection  | Transfer register earnings to wallet; reset production period       |  [x]   |  [x]   |  [x]   |  [x]   | `sushi-service.test.ts`, `sushi-view.test.ts`                                    |
| F06 | Prospective Upgrades       | Upgrades apply strictly forward; past earnings untouched            |  [x]   |  [x]   |  [x]   |   -    | `sushi-economy.test.ts`, `sushi-purchase.test.ts`                                |
| F07 | Stopped Time Discard       | Time spent capped before cap upgrade is permanently discarded       |  [x]   |  [x]   |  [x]   |   -    | `sushi-economy.test.ts`                                                          |
| F08 | Genki Curriculum Sync      | Chapters 6–12 mapped via `lessonNumber`; Chapter 9 is `week-4`      |  [x]   |  [x]   |  [x]   |  [x]   | `sushi-medals.test.ts`                                                           |
| F09 | Monotonic Non-Revocation   | Unlocks permanently retained; course resets cannot revoke           |  [x]   |  [x]   |  [x]   |   -    | `sushi-medals.test.ts`, `sushi-sync-medals-concurrency.test.ts`                  |
| F10 | Shop Catalog & Preview     | 7 MVP items (Ch 6, 7, 9); prospective rate impact preview           |  [x]   |  [x]   |  [x]   |  [x]   | `sushi-purchase.test.ts`, `sushi-view.test.ts`                                   |
| F11 | Single-Purchase Inventory  | Permanent purchases; repurchase rejected with `ALREADY_OWNED`       |  [x]   |  [x]   |  [x]   |   -    | `sushi-purchase.test.ts`                                                         |
| F12 | Fixed Decoration Slots     | `wallSlot` and `floorSlot` equip mechanics; economic neutrality     |  [x]   |  [x]   |  [x]   |  [x]   | `sushi-personalization.test.ts`                                                  |
| F13 | Idempotent Transactions    | Request keys deduplicated; repeat calls return cached state         |   -    |  [x]   |  [x]   |   -    | `sushi-service.test.ts`, `sushi-purchase.test.ts`                                |
| F14 | Concurrency & Locking      | Multi-request race safety; cold-start stampede protection           |   -    |  [x]   |  [x]   |   -    | `sushi-adversarial-concurrency.test.ts`, `sushi-sync-medals-concurrency.test.ts` |
| F15 | Client Clock Skew          | Negative elapsed time safely clamped to 0 ms                        |   -    |  [x]   |   -    |   -    | `sushi-economy.adversarial.test.ts`                                              |
| F16 | Firestore Security Rules   | Client writes blocked (`allow write: if false;`); read auth-gated   |   -    |   -    |  [x]   |   -    | `tests/firestore/sushi-rules.test.ts`                                            |
| F17 | Cloud Function Dual Tx     | Atomic read/write of restaurant and course progress                 |   -    |   -    |  [x]   |   -    | `tests/backend/sushi-function.test.ts`                                           |
| F18 | Google Auth Gate           | Anonymous & unauthenticated sessions denied access                  |   -    |   -    |  [x]   |  [x]   | `sushi-view.test.ts`, `functions/src/index.ts`                                   |
| F19 | Code-Splitting Isolation   | Deferred bundle chunk loaded dynamically only upon `#/sushi`        |   -    |   -    |   -    |  [x]   | `tests/e2e/sushi-lazy-chunk.spec.ts`                                             |
| F20 | Vector Scene & Polish      | Inline SVG cross-section rendering equipped decor & tread animation |   -    |   -    |   -    |  [x]   | `sushi-view.test.ts`                                                             |
| F21 | Page Visibility Throttling | `document.hidden` halts belt animation & throttles 1 Hz ticker      |   -    |  [x]   |   -    |  [x]   | `sushi-ticker.test.ts`                                                           |
| F22 | WCAG 2.1 AA Accessibility  | Semantic HTML, ARIA announcements, `:focus-visible` styling         |  [x]   |   -    |   -    |  [x]   | `sushi-view.test.ts`                                                             |
| F23 | Release Gate Config        | Sushi nav concealed in production until release flag enabled        |  [x]   |  [x]   |   -    |  [x]   | `sushi-view.test.ts`                                                             |

---

## 4. Test Architecture & Directory Layout

```
japc11-delkurs2/
├── TEST_INFRA.md                       # Authoritative test infrastructure documentation (this file)
├── package.json                        # Test scripts: test, test:rules, test:backend, test:e2e
├── tsconfig.json                       # ES2022 / Bundler TypeScript configuration
├── tests/
│   ├── helpers/                        # Shared fixtures & test harnesses
│   │   └── arena-fixtures.ts
│   ├── firestore/                      # Tier 3: Firestore Security Rules tests (Emulator)
│   │   └── sushi-rules.test.ts
│   ├── backend/                        # Tier 3: Cloud Functions callable tests (Emulator)
│   │   └── sushi-function.test.ts
│   ├── e2e/                            # Tier 4: Browser E2E specs (Playwright)
│   │   ├── sushi-lazy-chunk.spec.ts
│   │   └── sushi-game.spec.ts
│   ├── sushi-tier1-feature-coverage.test.ts    # [NEW] Tier 1 comprehensive feature coverage
│   ├── sushi-tier2-boundary-adversarial.test.ts# [NEW] Tier 2 boundary, corner cases & adversarial
│   ├── sushi-economy.test.ts           # Tier 1: Canonical economy & accrual unit tests
│   ├── sushi-economy.adversarial.test.ts # Tier 2: Mathematical stress & precision edge cases
│   ├── sushi-medals.test.ts            # Tier 1: Curriculum medal mapping & tier evaluation
│   ├── sushi-purchase.test.ts          # Tier 1: Catalog purchase validation & affordance
│   ├── sushi-purchase-adversarial.test.ts # Tier 2: Inventory mutation & edge transactions
│   ├── sushi-service.test.ts           # Tier 1/2: InMemory repository lifecycle & accrual
│   ├── sushi-adversarial-concurrency.test.ts # Tier 2: Multi-threaded race conditions & locks
│   ├── sushi-sync-medals-concurrency.test.ts # Tier 2: Concurrent grant synchronization swarms
│   ├── sushi-personalization.test.ts   # Tier 1/2: Decoration slot equip logic & neutrality
│   ├── sushi-ticker.test.ts            # Tier 2: Visibility API & client ticker throttling
│   ├── sushi-view.test.ts              # Tier 1/4: Lit-html DOM shell & controller integration
│   ├── sushi-review-regressions.test.ts# Tier 1: Historical bug regressions & fixes
│   ├── sushi-m2-adversarial.test.ts    # Tier 2: Milestone 2 economy audit verification
│   └── sushi-prototype-deep-adversarial.test.ts # Tier 2: Deep state edge cases
```

---

## 5. Test Execution Guide

### 5.1 Unit, Domain & Boundary Tests (Tiers 1 & 2)

Fast, in-memory execution using Node.js native TypeScript runner. Runs in under 3 seconds with zero external dependencies.

```powershell
# Run all unit, domain, and boundary test suites
npm test

# Run specific Tier 1 Feature Coverage suite
node --test tests/sushi-tier1-feature-coverage.test.ts

# Run specific Tier 2 Boundary & Adversarial suite
node --test tests/sushi-tier2-boundary-adversarial.test.ts

# Run concurrency and adversarial stress suites
node --test tests/sushi-adversarial-concurrency.test.ts
node --test tests/sushi-sync-medals-concurrency.test.ts
```

### 5.2 Static Analysis & Production Build

Ensures zero TypeScript compiler errors and verifies production chunk splitting.

```powershell
# Run TypeScript strict typecheck across src/
npm run typecheck

# Run Vite production build and verify bundle chunks
npm run build

# Verify sushi assets are strictly isolated into deferred chunks
Select-String -Path "dist/assets/index-*.js" -Pattern "Hämta intäkter"
Select-String -Path "dist/assets/sushi-view-*.js" -Pattern "Hämta intäkter"
```

### 5.3 Backend Security Rules & Cloud Functions (Tier 3)

Requires Firebase CLI and Java runtime for emulator execution.

```powershell
# Run Firestore security rules verification
npm run test:rules

# Build Cloud Functions and run backend transaction tests
npm run test:backend
```

### 5.4 End-to-End Browser Tests (Tier 4)

Runs Playwright automated browser tests against local dev/preview servers.

```powershell
# Run headless browser E2E tests
npm run test:e2e

# Run backend-integrated E2E tests with Firebase Emulators
npm run test:backend:e2e
```

---

## 6. Expected Output Derivation & Mathematical Proofs

Every test case in this track derives its expected values from first principles rather than matching implementation quirks:

### 6.1 Production Rate Formula

Given:

- Kitchen Capacity $K \in \mathbb{N}_{\ge 1}$ (orders/min)
- Service Capacity $S \in \mathbb{N}_{\ge 1}$ (orders/min)
- Average Revenue per Order $A \in \mathbb{N}_{\ge 1}$ (yen/order)

The effective throughput $O$ (orders/min) and revenue rate $R$ (yen/min) are strictly:
$$O = \min(K, S)$$
$$R = O \times A = \min(K, S) \times A$$

Bottleneck classification:

$$ \text{bottleneck} = \begin{cases}
\text{'kitchen'} & \text{if } K < S \\
\text{'service'} & \text{if } S < K \\
\text{'none'} & \text{if } K = S
\end{cases}$$

### 6.2 Accrual Invariance Identity
For any active production state with rate $R$ (yen/min), cap $C_{\text{ms}}$, and used production time $U_{\text{ms}}$:
The effective productive time produced during elapsed interval $\Delta t$ is:
$$\Delta t_{\text{prod}} = \min(\Delta t, \max(0, C_{\text{ms}} - U_{\text{ms}}))$$
The earned currency units (where $1\text{ yen} = 60,000\text{ units}$, and $1\text{ min} = 60,000\text{ ms}$) are:
$$\text{EarnedUnits} = \Delta t_{\text{prod}} \times R$$

**Mathematical Proof of Splitting Invariance**:
If interval $\Delta t = \Delta t_1 + \Delta t_2$ does not exceed remaining cap:
$$\Delta t_{\text{prod}, 1} = \Delta t_1 \implies \text{Units}_1 = \Delta t_1 \times R$$
$$\Delta t_{\text{prod}, 2} = \Delta t_2 \implies \text{Units}_2 = \Delta t_2 \times R$$
$$\text{Units}_1 + \text{Units}_2 = (\Delta t_1 + \Delta t_2) \times R = \text{Units}_{\text{total}}$$
This holds exactly with zero rounding error for any partition of milliseconds.

---

## 7. Defect Classification & Escalation Protocol

As members of the QA and Test Engineering track, test writers maintain strict separation between test code and implementation code:
- **Test Defects**: If a test fails due to faulty test setup, ambiguous assertions, invalid mocks, or incorrect expected values, the test writer corrects the test.
- **Implementation Bugs**: If a test fails because production implementation code diverges from specifications in `PROJECT.md`, `ORIGINAL_REQUEST.md`, or `sushigame.md`, the test writer does **NOT** modify implementation code. Instead, the bug is documented in `handoff.md` and escalated to the implementing agent (or parent orchestrator) with:
  1. Exact reproduction steps and test file path.
  2. Observed output vs. Expected output derived from specification.
  3. Impact analysis on game balance, security, or study insulation.
$$
