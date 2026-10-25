# Sushi Game — 4-Tier QA Test Plan

> **Document:** Comprehensive Quality Assurance & Regression Test Plan  
> **Origin:** Adapted from Claude-Code-Game-Studios `/qa-plan`, `/regression-suite`, and `/soak-test`  
> **Target Scope:** Sushi Restaurant Game (`src/course/sushi-game/`, `functions/src/`, `tests/`)  
> **Document Owner:** Quality Assurance Department (QL)  
> **Status:** Active Standard

---

## 1. Test Architecture & Strategy Overview

The Sushi Game testing methodology uses a rigorous 4-tier testing hierarchy designed to guarantee mathematical accuracy, concurrency resilience, backend security, and seamless browser experience:

```
┌────────────────────────────────────────────────────────┐
│  Tier 4: Browser E2E & Visual Regression (Playwright)  │
│  - Chunk Splitting Boundary  •  Full User Journey      │
│  - Mobile Viewports          •  Screen Reader A11y     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Tier 3: Backend Rules & Cloud Functions (Emulators)   │
│  - Firestore Rules Read-Only  •  Google Auth Gate      │
│  - Dual-Document Atomic Transactions                   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Tier 2: Concurrency, Idempotency & Clock Adversarial  │
│  - Mutex Serialization  •  Idempotency Key Replays     │
│  - Multi-User Stampedes •  Clock Skew & Time Rewind    │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Tier 1: Domain Logic & Exact Mathematics (In-Memory)  │
│  - 1/60,000 Yen Math    •  Two-Capacity O = min(K, S)  │
│  - 8h/12h Lazy Accrual  •  Monotonic Medal Grants      │
└────────────────────────────────────────────────────────┘
```

---

## 2. Tier 1: Domain Logic & Mathematics

### 2.1 Execution & Environment

- **Command:** `node --test tests/*.test.ts`
- **Execution Target:** $< 2.5$ seconds across the full test suite.
- **Dependencies:** Pure Node.js native test runner, zero external cloud dependencies, in-memory repository (`InMemorySushiRepository`).

### 2.2 Test Matrices & Verifications

1. **Two-Capacity Production Formula:**
   - Evaluates $O = \min(K, S)$ and $R = O \times A$ across all combinations.
   - Verified in `tests/sushi-economy.test.ts`.
2. **Exact Lossless 1/60,000 Yen Arithmetic:**
   - 1 whole Yen $= 60{,}000$ internal units.
   - Confirms that $6{,}000$ consecutive 1-millisecond intervals yield the exact same integer units as a single $6{,}000\text{-ms}$ interval (splitting invariance).
   - Validates that display formatting uses integer floor division ($\lfloor \text{units} / 60{,}000 \rfloor$) without discarding underlying fractional units.
3. **Lazy Accrual & Cap Clamping:**
   - Production accrues deterministically without persistent background server loops.
   - Accrual duration is strictly bounded by active cap ($8\text{h} = 28{,}800{,}000\text{ ms}$; $12\text{h} = 43{,}200{,}000\text{ ms}$).
   - Unattended elapsed time beyond cap is discarded without state corruption.
4. **Mid-Period Prospective Upgrades:**
   - Purchasing a capacity upgrade mid-period preserves accrued earnings up to the purchase timestamp at the old rate; the new rate applies prospectively forward.
   - Purchasing a cap extension mid-period adds $(C_{\text{new}} - T_{\text{used}})$ of future capacity; historical stopped time is never backfilled.
5. **Curriculum Medal Mapping:**
   - Genki I Chapters 6–12 are mapped to `lessonNumber` in `medals.ts`.
   - Tier hierarchy is enforced: Gold satisfies Silver and Bronze; Silver satisfies Bronze.
   - Monotonic set union (`mergePermanentGrants`): Lower subsequent study scores or deck resets never revoke earned unlocks.

---

## 3. Tier 2: Concurrency, Idempotency & Adversarial Scenarios

### 3.1 Execution & Suites

- **Target Test Suites:**
  - `tests/sushi-adversarial-concurrency.test.ts`
  - `tests/sushi-sync-medals-concurrency.test.ts`
  - `tests/sushi-service.test.ts`
  - `tests/sushi-purchase-adversarial.test.ts`
  - `tests/sushi-economy.adversarial.test.ts`

### 3.2 Adversarial Test Scenarios

1. **Clock Skew & Time Rewind:**
   - If a client's system clock steps backwards ($t_{\text{now}} < t_{\text{accounted}}$), elapsed time is clamped to $0$. Timestamps never move backward, and uncollected revenue is never deducted.
2. **Idempotency Key Replay & Action Namespacing:**
   - Every transaction payload carries an `idempotencyKey` prefixed with its action type (`collect:`, `purchase:`, `equip:`).
   - Replaying the identical key returns the cached successful result without double collection, double debit, or duplicate inventory grant.
3. **Concurrent Mutation & Mutex Serialization:**
   - 50 simultaneous grant sync calls from multiple tabs serialize safely via mutex lock queues, converging to the exact set union.
   - Concurrent purchase attempts against insufficient balance: exactly one transaction succeeds, subsequent attempts fail with `INSUFFICIENT_FUNDS`.
4. **Cold Start Stampede:**
   - 30 simultaneous requests on a brand-new user account initialize the restaurant document exactly once without race conditions or duplicated welcome grants.

---

## 4. Tier 3: Backend Security Rules & Cloud Functions Integration

### 4.1 Execution & Environment

- **Commands:**
  - `npm run test:rules` (Firestore security rules testing).
  - `npm run test:backend` (Cloud Functions transaction testing).
- **Prerequisites:** Firebase Emulator Suite running Firestore, Auth, and Functions.

### 4.2 Security Test Scenarios

1. **Authentication Gate:**
   - Anonymous sessions or unauthenticated requests are rejected with `unauthenticated` / `permission-denied`.
   - Only verified Google Sign-In user tokens are authorized to access `/users/{uid}/sushi/restaurant`.
2. **User Data Isolation:**
   - User A cannot read or write User B's restaurant state (`/users/{uidA}/sushi/restaurant` vs `/users/{uidB}/sushi/restaurant`).
3. **Direct Client Write Prohibition:**
   - Client SDK writes directly to Firestore are blocked by security rules:
     ```
     match /users/{userId}/sushi/{docId} {
       allow read: if request.auth != null && request.auth.uid == userId;
       allow write: if false; // All mutations must go through Cloud Functions
     }
     ```
4. **Atomic Server Transactions:**
   - The Cloud Function (`sushi` callable in `functions/src/index.ts`) evaluates transactions using dual-document Firestore reads/writes (`/users/{uid}/course/progress` and `/users/{uid}/sushi/restaurant`).
   - Rejects invalid item IDs, unmet medal requirements, or tampering.

---

## 5. Tier 4: Browser E2E, Lazy-Loading & Integration (Playwright)

### 5.1 Execution & Tooling

- **Commands:** `npm run test:e2e` (`npx playwright test`)
- **Configurations:**
  - `playwright.config.ts`: Pure frontend test server (Vite port 5176).
  - `playwright.backend.config.ts`: Full integration server with Firebase Emulators (Port 5177).

### 5.2 Browser E2E Scenarios

1. **Code-Splitting & Deferred Loading Boundary:**
   - Loading the study home page (`#/`) or chapter view (`#/vecka/week-1`) makes **0 network requests** for `sushi-view-*.js` or `sushi-*.css`.
   - Only navigating to `#/sushi` dynamically imports the restaurant module.
2. **Auth Gate Flow:**
   - Unauthenticated users receive the accessible Auth Gate card with clear sign-in instructions.
   - Signing in instantly displays the personal sushi restaurant stage.
   - Signing out purges session state, cached balances, and listeners.
3. **Full Student Learning Loop:**
   - Student completes study exercises in Genki Chapter 8.
   - Student navigates to `#/sushi`; a celebratory banner announces the newly unlocked Precision Knife.
   - Student collects accumulated revenue via "Hämta intäkter".
   - Student purchases the Precision Knife; the cutting board appears in the kitchen.
   - Student clicks "Tillbaka till studierna" to immediately return to Chapter 9.
4. **Responsive Layout & Accessibility:**
   - Validates viewports at 360px, 375px, 768px, and 1280px.
   - Confirms touch targets meet or exceed $44 \times 44 \text{ px}$.
   - Verifies that `prefers-reduced-motion: reduce` halts conveyor belt animations.

---

## 6. Test Automation Execution Matrix

|    Tier    | Area                      | Test Command                              | Target Scope                           | Runner            |   Target SLA    |     Pass Threshold      |
| :--------: | :------------------------ | :---------------------------------------- | :------------------------------------- | :---------------- | :-------------: | :---------------------: |
| **Tier 1** | Pure Logic & Math         | `npm test`                                | `tests/*.test.ts`                      | Node 24 Native    | $< 2.5\text{s}$ |   100% pass (0 fails)   |
| **Tier 1** | TypeScript Types          | `npm run typecheck`                       | `src/**/*.ts`, `tests/**/*.ts`         | `tsc --noEmit`    |  $< 5\text{s}$  |    Code 0 (0 errors)    |
| **Tier 1** | Bundle & Chunks           | `npm run build`                           | Full application                       | Vite / Rollup     |  $< 8\text{s}$  | Code 0 (Isolated chunk) |
| **Tier 2** | Concurrency & Idempotency | `node --test tests/*concurrency*.test.ts` | Concurrency test files                 | Node 24 Native    |  $< 3\text{s}$  |   100% pass (0 fails)   |
| **Tier 3** | Security Rules            | `npm run test:rules`                      | `tests/firestore/sushi-rules.test.ts`  | Firebase Emulator | $< 10\text{s}$  |   100% pass (0 fails)   |
| **Tier 3** | Backend Callable          | `npm run test:backend`                    | `tests/backend/sushi-callable.test.ts` | Firebase Emulator | $< 15\text{s}$  |   100% pass (0 fails)   |
| **Tier 4** | Browser E2E & A11y        | `npm run test:e2e`                        | `tests/e2e/*.spec.ts`                  | Playwright        | $< 30\text{s}$  |   100% pass (0 fails)   |
