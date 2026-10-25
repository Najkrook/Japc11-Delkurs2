# Sushi Game - JAPC11 Delkurs 2 Product and Technical Brief

> **Purpose:** Project-specific guidance for the personal sushi restaurant game in the existing Japanese study web app.
>
> **Status:** Planning / design specification. Ticket 01 accounting rules and the provisional MVP catalog were approved by the product owner on 2026-10-22. This document does not mean the game is implemented or authorize implementing every feature at once.
>
> **Priority:** The Japanese study experience must remain functional, fast, and the primary purpose of the app.
>
> **Decision labels:** Existing project facts describe current code. Confirmed decisions describe the agreed game. Proposals and open questions require further balancing or decisions.

## 1. Existing project facts

The app helps classmates study **Genki I, chapters 6-12**. The repository currently uses:

- **Frontend:** TypeScript, Vite, lit-html, and CSS. It does not use React or a game engine.
- **Navigation:** Hash-based routing in `src/course/router.ts`, with study views composed in `src/course/course-view.ts`.
- **Deferred loading:** Extra studies already uses dynamic imports, providing a precedent for loading a feature only when opened.
- **Identity:** Google sign-in through Firebase Authentication, configured in `src/cloud.ts`.
- **Study storage:** Per-user localStorage snapshots and Firestore at `users/{uid}/progress/course`. Cloud study data is a JSON `payload` with `updatedAt`.
- **Progression:** `CourseProgressData` records mastered vocabulary, kanji, and conjugations, plus the best chapter quiz results. `getWeekProgressSummary` and `getWeekMedalTier` in `src/course/course-state.ts` calculate summaries and medals.
- **Medals:** Bronze at 60%, silver at 80%, and gold at 100% of counted items. The calculation combines mastered vocabulary, kanji, conjugations, and the best quiz score; it is not simply a quiz pass percentage. Reuse the existing medal calculation rather than comparing rounded display percentages.
- **Chapter identity:** Course data exposes `lessonNumber`. Chapter 9 is currently `week-4`; map requirements through `lessonNumber`, not by treating week IDs as chapter numbers.
- **Backend gap:** The repository has Firebase Hosting and Firestore configuration, but no configured Cloud Functions implementation for a server-controlled game economy.

### Current study trust and synchronization

Study progress is **client-reported**, including when saved to Firestore. Vocabulary and kanji can be marked as mastered by the student, and exercises are scored in the browser. Current Firestore rules restrict who can write their progress document and validate its outer shape; they do not verify the learning represented by its JSON payload.

Study synchronization chooses the latest complete snapshot. Do not reuse this write-conflict policy for restaurant money and purchases.

The game accepts the existing study trust model. Server-controlled money does **not** turn these records into independently verified knowledge or examination results.

## 2. Confirmed game decisions

1. **Theme and scope:** A compact, cozy sushi restaurant tycoon combining idle earnings and personal decoration. Each student owns one restaurant.
2. **Own page within the app:** The game lives at `#/sushi`, with its own interface, without study menus. Simple navigation connects the restaurant and study pages. This is not a separate HTML application.
3. **Access:** The game is available only to signed-in users through the existing Google sign-in. There is no guest game or local guest demo. Direct navigation while signed out must not expose a playable restaurant or restaurant data.
4. **Loading and rendering:** Load game code and artwork only when the game page opens. Use image layers, lit-html, and CSS animations.
5. **Start:** A new player receives a simple functioning restaurant immediately. Chapter 6 bronze unlocks the first improvement, not permission to open the restaurant.
6. **Currency:** Yen is the only spendable currency. Uncollected earnings are separate from spendable yen until manually collected.
7. **Study gates:** Existing medals unlock purchase eligibility. Bronze unlocks the main chapter feature, silver an extra recipe or variant, and gold a decoration. There is no additional chapter-test requirement.
8. **Permanent grants:** Once awarded, an unlock remains available even if current study progress decreases. Existing saved progress is recognized at first game initialization.
9. **Capacity:** Kitchen and service are the only production bottlenecks in the first version.
10. **Time and collection:** The earning rate is identical with the page open or closed. The starting limit is eight production hours between manual collections. Higher limits require chapter unlocks and a yen purchase.
11. **Placement:** Functional equipment uses fixed locations. Decorations are selected for fixed decoration slots and are purely visual.
12. **Chapter 9 milestone:** The conveyor belt is one purchasable, predefined installation improving service capacity. There is no belt construction, routing, or segment-placement editor.
13. **Trust boundary:** Accept the existing client-reported study progress, while the server controls restaurant time, income, collection, purchases, and permanent unlock records.
14. **Mid-period purchases:** Production improvements and higher time caps take effect immediately after accounting up to the purchase with the previous rate and cap. Preserve earned income and used production time; never compensate past stopped time or collect automatically. See section 5.4.
15. **Precision:** Preserve fractional yen through accounting and collection. Display whole yen rounded down, without rounding the underlying balances. See section 5.5.

These decisions supersede earlier suggestions in the initial brief. Undecided content and balance are listed in section 14.

## 3. Proposals that remain provisional

- A warm 2D pixel-art style with a top-down or simple angled perspective. Image-layer rendering is decided; final art style and perspective are not.
- Specific dishes, staff, decorations, production values, and prices.
- Chapter requirements, prices, and durations of upgrades beyond the confirmed eight-hour starting cap.
- A five-star restaurant review or a special cosmetic as the chapter 12 goal.
- A manually selected recipe menu in a later phase.
- Classmate visits as a possible later feature, outside MVP.

Section 5.6 supplies the selected provisional MVP defaults, approved for implementation and later playtesting, not final game balance. Other illustrative examples do not add items to that catalog.

## 4. Core player loop

1. Study using the existing Genki exercises.
2. Earn chapter medals that permanently unlock restaurant purchase options.
3. Let the restaurant accumulate uncollected income until its production-time cap is reached.
4. Press **"Hämta intäkter"** to transfer income into spendable yen and start a new accrual period.
5. Buy unlocked improvements or decorations with collected yen.
6. See the restaurant change and return to the relevant study chapter for the next milestone.

Keep these actions distinct:

- **Unlocking:** Permanently granting eligibility; it does not automatically buy an item.
- **Accruing:** Adding income to the uncollected cash register within the time limit.
- **Collecting:** Explicitly transferring accrued income to spendable yen.
- **Buying:** Spending collected yen on an eligible item.
- **Placing:** Selecting an owned decoration for a fixed slot, without changing production.

Do not pay unlimited direct yen for repetitive answers. The study connection is through the established medal system. Keeping a browser tab open gives no income-rate advantage and does not bypass the collection cap.

## 5. Economy and manual collection

### 5.1 Resources

- **Spendable yen:** Collected income available for purchases.
- **Uncollected income:** Earnings in the cash register; this is not another currency and cannot fund purchases before collection.
- **Study progress:** Existing course data used to award unlocks, not a spendable resource.
- **Production stats:** Derived from validated purchases, not client-editable rates.

Do not add premium currencies, energy systems, loot boxes, artificial waiting timers, ingredient inventories, salary accounting, or real-money systems.

### 5.2 Two-capacity production model

```ts
ordersPerMinute = Math.min(kitchenCapacityPerMinute, serviceCapacityPerMinute);
yenPerMinute = ordersPerMinute * averageRevenuePerOrder;
```

Kitchen and service are abstract rates. Demand and seating are not additional constraints in the first version. Customers can illustrate activity without an individual order simulation.

Show the current bottleneck and actual income effect of a proposed purchase. A kitchen upgrade may have no immediate income effect when service is limiting production. The conveyor belt raises service capacity and changes the scene visibly.

### 5.3 Purchase categories

| Category                    | Example                                       | First-version purpose                                         |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| Staff and kitchen equipment | Chef or prep-counter improvement              | Improve kitchen capacity                                      |
| Service                     | Server improvement or chapter 9 conveyor belt | Improve service capacity                                      |
| Recipes                     | Additional dishes                             | Menu variety; any revenue effects need balancing              |
| Collection-cap upgrades     | Longer unattended production period           | Increase the time cap after a chapter unlock and yen purchase |
| Seating and room appearance | Tables or a visual expansion                  | Visual progression; no independent seating bottleneck         |
| Decorations                 | Lanterns, plants, wall art                    | Personalization only, with no income or appeal bonus          |

Only eligible items can be purchased. Shop entries may show locked items and explain their requirements. Section 5.6 selects provisional items, prices, and effects; final balance remains open. The conveyor-belt milestone itself is confirmed.

### 5.4 Accrual and collection rules

**Do not run a permanent server simulation loop.** Calculate accrued income from server-controlled elapsed time and validated restaurant state.

- The starting cap is **eight production hours between collections**, online and offline alike.
- New restaurants start their first accrual period when created. After reaching the cap, further time earns nothing until manual collection or a purchased higher cap provides additional production time.
- Returning to the app, signing in, loading a save, refreshing, or buying something does not collect income or restart the period.
- Only explicit **"Hämta intäkter"** transfers accrued income into spendable yen and starts a new period.
- Internal accounting may update calculation timestamps, but must preserve the used portion of the capped period. An accounting update is not a collection.
- Excess waiting time beyond the cap must not carry over as earnings into the next period.
- Cap upgrades follow the same chapter-unlock-plus-yen-purchase model as other functional upgrades.
- Displayed income may be estimated locally between server responses. The server decides persisted amounts; do not write to Firestore every second.

Use atomic, retry-safe operations for collection and purchases. Collection transfers the pending amount once; a purchase debits collected funds once. Concurrent tabs and repeated network requests must not duplicate either operation.

**Approved accounting policy — product owner, 2026-10-22:**

1. Account up to the server-controlled operation time using the previous production rate and cap. Only elapsed time within the remaining production allowance earns income. Preserve the cumulative used production time across accounting updates.
2. At a successful purchase, debit the catalog price from spendable yen and apply the purchased effect atomically with that accounting. Uncollected income cannot pay for a purchase. Keep existing uncollected income and used production time unchanged by the effect itself.
3. A production-rate change applies only to production after the purchase. Never recalculate previously earned income at the new rate. Buying a faster production rate while the register is full leaves production stopped.
4. A higher cap applies immediately within the same collection period. Remaining production time becomes the new cap minus already used production time. For example, raising the cap from eight to twelve hours after eight hours of production provides four more hours from the purchase onward.
5. Account through any stopped interval before applying a higher cap, advancing the accounting timestamp to the purchase time even when no income accrues. Stopped time is discarded: buying the upgrade after ten elapsed hours does not retrospectively pay for hours eight through ten or consume the four newly available hours.
6. Manual collection first accounts up to the collection time, transfers the entire uncollected amount (including fractional yen) into spendable yen, then sets uncollected income and used production time to zero. The new period starts at that server time with the currently purchased rate and cap. Excess waiting time never carries into it.

Purchases, accounting updates, and decoration placement are not collections. The cap measures **production time**, not a fixed yen amount: a period spanning different rates contains the sum earned at each applicable rate.

### 5.5 Precision and rounding

Use server-controlled integer milliseconds for elapsed and used production time; do not round partial minutes. For the provisional catalog's integer yen-per-minute rates, represent both money balances as integer accounting units of **1/60000 yen**. These are an internal representation of yen, not a second currency.

```text
producedMs = min(max(0, nowMs - accountedAtMs), max(0, capMs - usedProductionMs))
earnedUnits = yenPerMinute * producedMs
priceUnits = priceYen * 60000
displayedYen = floor(balanceUnits / 60000)
```

Add `producedMs` to used production time and `earnedUnits` to uncollected income. Advance the accounting timestamp through the operation time even if the cap prevents further production. Keep the collection period's start separate from accounting timestamps. Rate and cap changes use the old values for this calculation before applying the purchase.

Whole-yen prices are checked and debited in the same exact units. Collection transfers all units to the spendable balance, including the remainder below one yen; the register then contains exactly zero. Round down only for display, never during accrual, purchase, or collection. For equal produced time at equal rates, splitting accounting or collection into multiple operations must not change total earned yen. Waiting beyond a cap is not produced time.

### 5.6 Provisional MVP catalog

**Approved as provisional implementation defaults on 2026-10-22, subject to later balance and playtesting.** Item choices, prices, capacities, the twelve-hour upgrade duration, and its chapter assignment are provisional. The eight-hour starting cap, tier policy, and chapter 9 conveyor-belt role remain confirmed decisions.

The starting restaurant has **0 spendable yen**, **0 uncollected yen**, kitchen capacity **1 order/minute**, service capacity **2 orders/minute**, and average revenue **10 yen/order**. It starts producing **10 yen/minute** immediately, with an **eight-hour** cap and zero used production time. No medal is needed to operate it.

| Item                      | Permanent medal requirement | Price    | Effect and location                                                                                                                           |
| ------------------------- | --------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Förbättrad beredningsbänk | Chapter 6 bronze            | 300 yen  | Kitchen +2 orders/minute, from 1 to 3; fixed prep-counter upgrade state. With starting service, income rises from 10 to 20 yen/minute.        |
| Längre produktionstid     | Chapter 7 bronze            | 1800 yen | Raise the production-time cap from 8 to 12 hours, immediately under section 5.4. No rate change.                                              |
| Transportband             | Chapter 9 bronze            | 3600 yen | Service +2 orders/minute, from 2 to 4; one predefined installation. With the prep-counter improvement, income rises from 20 to 30 yen/minute. |
| Laxnigiri                 | Chapter 6 silver            | 600 yen  | Visible menu variation only; no revenue or capacity effect and no manual recipe-selection system.                                             |
| Papperslykta              | Chapter 6 gold              | 300 yen  | Purely visual decoration for the single fixed wall slot.                                                                                      |
| Krukväxt                  | Chapter 7 gold              | 450 yen  | Purely visual decoration for the single fixed floor slot.                                                                                     |
| Vågmotiv                  | Chapter 9 gold              | 600 yen  | Purely visual alternative for the same wall slot as Papperslykta.                                                                             |

Every item has **one purchasable level** and may be bought once. There are no item prerequisites beyond the listed medal eligibility and sufficient collected funds. Higher chapter medal tiers satisfy lower-tier requirements. Use permanent grants and map chapters through `lessonNumber`, including chapter 9 / `week-4`.

Buying the conveyor belt before the prep-counter improvement raises service capacity but leaves income at 10 yen/minute because kitchen capacity is still 1. Buying the prep-counter improvement afterward raises income to 30 yen/minute. Show the actual effect for the player's current purchases, rather than promising every purchase immediately increases income.

Each decoration slot holds at most one compatible owned item. Players may replace or remove a selected decoration without repurchasing it. Decorations do not change production or any economic value. Essential functional progression requires no gold medal or silver recipe purchase.

At 10 yen/minute, the first improvement costs 30 minutes of production, followed by manual collection, provided chapter 6 bronze has been unlocked. Later prices are provisional: at 20 yen/minute, the cap upgrade costs 90 minutes of production and the conveyor belt costs 180 minutes, considered separately without other spending.

### 5.7 Worked accounting examples

Times below are measured from the start of a collection period. Amounts are exact yen, not rounded estimates. Each independent scenario starts with base production and the eight-hour cap. Except for the first-purchase example, it starts with **10000 previously collected yen** and the required permanent grants; pending income never funds a purchase. Linked rows continue the same scenario.

| Scenario                                 | Operation and expected income                                                                                                                                                                            | Spendable balance and used production time                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| First purchase, starting balance 0       | At 00:30, pending income is 30 × 10 = 300. Collect, then buy the prep-counter improvement for 300. Production becomes 20 yen/minute.                                                                     | Balance 0; pending 0; used time 0 immediately after collection and purchase.          |
| Ordinary purchase                        | At 02:00, pending income is 120 × 10 = 1200. Buy the prep-counter improvement for 300 without collecting. At 03:00, pending is 1200 + 60 × 20 = 2400.                                                    | Balance 9700; used time 2 hours at purchase and 3 hours at 03:00.                     |
| Ordinary purchase, subsequent collection | Collect the 2400 at 03:00. Start a new period at 20 yen/minute with the unchanged eight-hour cap.                                                                                                        | Balance 12100; pending 0; used time 0.                                                |
| Purchase at a full register              | At 10:00, eight productive hours have earned 480 × 10 = 4800. Buy the prep-counter improvement for 300. Pending stays 4800 and production remains stopped.                                               | Balance 9700; used time stays 8 hours. The two stopped hours earn nothing.            |
| Same full period, raised cap             | Also buy the cap upgrade at 10:00 for 1800. Four future hours become available at 20 yen/minute. At 11:00, pending is 4800 + 60 × 20 = 6000. At 14:00, pending reaches 4800 + 240 × 20 = 9600 and stops. | Balance 7900; used time 8 hours at purchase, 9 hours at 11:00, and 12 hours at 14:00. |
| Same period, subsequent collection       | Collect at 14:00 or later without further purchases: transfer exactly 9600. The new period has a twelve-hour cap and 20 yen/minute production.                                                           | Balance 17500; pending 0; used time 0. Any further stopped time is discarded.         |
| Cap purchase before the old limit        | In a separate base-rate period, buy only the cap upgrade at 02:00. Pending stays 1200 and 10 production hours remain. At 12:00, pending is 720 × 10 = 7200.                                              | Balance 8200; used time 2 hours at purchase and 12 hours at the new cap.              |
| Cap purchase exactly at the old limit    | In a separate base-rate period, buy only the cap upgrade at 08:00. Pending stays 4800; four future hours remain. At 09:00, pending is 5400, and at 12:00 it is 7200.                                     | Balance 8200; used time 8 hours at purchase, then 9 and 12 hours respectively.        |

**Fractional example, starting balance 0:** At 10 yen/minute, 1 ms earns 10 accounting units, or 1/6000 yen. Collecting that amount transfers all 10 units to the spendable balance even though both displayed amounts round down to zero. After 6000 such 1 ms production-and-collection intervals, the spendable balance contains 60000 units, exactly 1 yen: the same result as one 6000 ms interval followed by one collection. Separately, a 300-yen purchase debits exactly 18000000 units from a sufficient spendable balance and preserves any fractional remainder in it.

These examples specify outcomes for later economy tests; documenting and checking them does not implement the game.

## 6. Study integration and unlocks

### 6.1 Medal semantics and accepted trust

Reuse `getWeekProgressSummary` and its medal result. Bronze, silver, and gold correspond to the existing 60/80/100% calculation. A medal does not require a separate quiz pass. For example, the current chapter 6 data can reach roughly 87% through vocabulary, kanji, and conjugations without a recorded quiz score.

Use persisted course records to derive unlocks on the backend under the accepted study trust model. Do not accept a game request's claimed medal, balance, or unlock flag as authority. Reading client-reported course records on the backend does not prove independent knowledge verification; that limitation is intentional.

Do not modify study exercises, medal thresholds, or scoring to fit the game. Permanent restaurant grants are a history of awarded eligibility, not a second current course score.

### 6.2 Permanent and retroactive grants

- At first game initialization, award all unlocks supported by existing saved course progress.
- Award newly eligible unlocks as further course progress becomes available.
- Keep grants if the student unmarks knowledge, answers incorrectly in later practice, or receives a newer course snapshot with a lower medal.
- A previously achieved medal that cannot be derived from current saved data cannot be reconstructed reliably: the course store does not retain a complete medal history.
- Reconcile existing local and cloud progress through the established study flow before deriving grants. Temporary synchronization failure must not be interpreted as proof of no progress.
- Preserve the distinction between a permanent unlock and an item purchased with yen.

### 6.3 Chapter reward map

The tier policy is confirmed: **bronze = main feature; silver = extra recipe or variant; gold = decoration**. There is no extra chapter-test gate. Specific reward items remain proposals except where marked confirmed.

| Chapter | Bronze/main feature               | Status and intended effect                                                                                                             |
| ------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 6       | First restaurant improvement      | Confirmed role; provisional prep-counter improvement selected in section 5.6. The basic restaurant already operates before this medal. |
| 7       | Longer production-time cap        | Provisional MVP selection: purchase a twelve-hour cap. Replaces the earlier staffing-improvement proposal for this catalog.            |
| 8       | Additional recipes                | Proposed; menu variety and possible balanced revenue effects.                                                                          |
| 9       | Conveyor belt                     | Confirmed; one predefined installation improving service capacity. Map through `lessonNumber: 9`, currently `week-4`.                  |
| 10      | Restaurant expansion              | Proposed visual expansion and decoration room; no seating bottleneck.                                                                  |
| 11      | Specialist chef or premium dishes | Proposed production or recipe improvement.                                                                                             |
| 12      | Final milestone                   | Exact goal and reward remain open.                                                                                                     |

Section 5.6 selects the provisional MVP cap upgrade and silver/gold catalog. Other proposed chapter rewards are not additional MVP catalog entries; further rewards and final balancing remain open. Necessary functional progression must not require gold.

## 7. Restaurant scene and decoration

Build a responsive scene from image layers and CSS animations, integrated with lit-html. Suggested elements include floor and walls, a prep counter, a chef, illustrative customers, tables, and decorative slots.

- Functional equipment and the conveyor belt have predetermined locations or visual upgrade states.
- Selecting a decoration slot opens a choice of owned items. Use accessible controls for mouse, touch, and keyboard.
- Decorations do not change capacity, income, or customer behavior.
- Freeform dragging, grid placement, collision systems, and pathfinding are outside the first version.
- Start with simple artwork and inexpensive animations. Respect reduced motion and stop unnecessary animation when the game is inactive.

The exact art style and perspective remain open. No new rendering library is needed for the agreed first version.

## 8. Game page and navigation

`#/sushi` is a distinct page experience inside the existing app. Render a game-specific shell without the study sidebar or study menus. Provide a simple link back to studies and an entry from the study app to the restaurant. Keep identity and course context shared across this navigation.

The first-version interface needs:

1. **Restaurant scene:** The visual focus, showing purchased improvements and chosen decorations.
2. **Spendable balance:** Clearly separate from uncollected income.
3. **Cash register:** Pending income, production-time cap and its progress, a clear full/stopped state, and **"Hämta intäkter"**.
4. **Production:** Approximate income per minute and the kitchen/service bottleneck.
5. **Shop:** Clear locked, unlocked, affordable, and owned states, including cap upgrades.
6. **Next study milestone:** The relevant chapter and a link to its existing exercises.

A return message may describe accumulated earnings, but must not imply they have already been collected. Game access requires sign-in, including direct URLs. Guest users receive no playable restaurant or demo state. Network and loading failures should be recoverable without breaking study pages.

## 9. Project-specific implementation guidance

### 9.1 Frontend boundaries

- Keep TypeScript, Vite, lit-html, and existing CSS conventions. Do not introduce React, react-konva, a state library, or a game engine for this scope.
- Extend the hash router and view types with the game route. Give the game its own shell rather than embedding it in a chapter panel.
- Dynamically import game code and load assets only when the game page opens, following the existing Extra studies loading pattern.
- Keep economy and unlock calculations in pure TypeScript, separate from DOM rendering, animation, authentication, and persistence.
- Follow existing module conventions, with a dedicated feature area such as `src/course/sushi-game/`. Isolate game assets and styles and use the existing `tests/` structure.
- Use a configurable catalog for prices, medal requirements, effects, fixed slots, and visual states. Label unapproved balance values as placeholders.

### 9.2 Required backend addition

Reuse Firebase Authentication and Firestore. A small trusted backend, such as Firebase callable Cloud Functions, is required for server-controlled restaurant accounting and purchases. The repository does not already provide this game service.

The service needs authenticated operations for initializing/loading a restaurant, reconciling study-based grants, explicitly collecting income, buying eligible items, and saving valid decoration choices. Derive identity from authenticated requests. Do not trust client-supplied prices, rates, balances, or elapsed times.

Deploying Cloud Functions requires the Firebase Blaze plan; the project's actual billing plan has not been inspected. Confirm deployment prerequisites before publishing. References: [callable functions](https://firebase.google.com/docs/functions/callable), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), and [Cloud Functions setup and deployment](https://firebase.google.com/docs/functions/get-started).

## 10. Restaurant persistence and consistency

Store each restaurant in a separate per-user Firestore document outside `users/{uid}/progress/course`, with dedicated access rules. Do not append the economy to the course JSON payload or reuse its latest-snapshot-wins synchronization.

The game save needs to represent:

- Spendable yen and uncollected income separately, preserving fractional yen in the exact units defined in section 5.5.
- Purchased upgrades and owned decorations.
- Decoration choices keyed by fixed slot, not freeform coordinates.
- Permanently awarded chapter/tier unlocks.
- Server-controlled accounting time, the current collection period and its used production time, and the applicable cap upgrade.
- A schema version and information needed to prevent duplicate operations.

Implement the accounting schema against the approved rules in sections 5.4-5.5. Preserve cumulative used production time separately from the last accounting timestamp, including when the cap rises after stopped time. A single last-settlement timestamp is not enough if ordinary accounting updates would accidentally restart the collection allowance.

Production requirements:

- Only the authenticated owner can access their personal restaurant through the authorized flow.
- Clients cannot directly overwrite balances, grant restaurant unlocks, or mark purchases complete.
- Validate ownership, catalog price, prerequisites, collected funds, and valid decoration slots.
- Accrual, collection, and purchase accounting must be atomic where their state changes belong together and safe under retries and concurrent tabs.
- Derive production from validated purchases. Keep awarded study grants when current course progress decreases.
- Failed operations must not be reported as successful or replace authoritative state with an empty/local restaurant. Study-local fallback is not a safe fallback for game money mutations.
- Version save data for future changes. There are no existing restaurant saves to migrate in this first version; preserve existing course storage.

Developer-only mocked state is acceptable for isolated tests and prototypes. It does not create a guest mode or satisfy production persistence requirements.

## 11. First playable MVP

**Required:**

- Signed-in-only `#/sushi`, a separate shell, simple study/game navigation, and deferred loading.
- One personal restaurant with basic production immediately available.
- A small image-layer/CSS scene with visible upgrade states.
- Kitchen/service production, spendable yen, and a separate uncollected cash register.
- Equal open/closed-page earning rates, the eight-hour starting cap, and explicit manual collection.
- Purchasable improvements from the provisional catalog in section 5.6, including its chapter-gated cap upgrade.
- Bronze/silver/gold integration, permanent grants, and recognition of existing saved progress.
- The chapter 9 conveyor belt as one fixed installation.
- A few purely visual decorations chosen for fixed slots.
- Server-controlled accounting, safe purchases, and save/reload behavior.

**Later or optional:** A manual recipe menu, richer illustrative animations, and more cosmetic content.

**Outside MVP:** Belt construction, freeform building, demand/seating simulation, pathfinding, individual customer AI, stock management, salaries, multiplayer restaurants, visits, leaderboards, trading, branches, prestige resets, daily quests, special customer dialogues, advertising, and microtransactions.

## 12. Implementation stages

### Stage A - Confirm integration and apply approved accounting choices

Recheck the project facts against the code at implementation time. Identify the route/shell integration and plan separate restaurant storage and backend deployment. Ticket 01 resolved mid-period rate/cap behavior and precision on 2026-10-22; use sections 5.4-5.7 as the accounting contract and provisional catalog. Final balance and artwork remain open.

### Stage B - Isolated vertical slice

Build the separate, lazily loaded page with placeholder image layers, basic production, a cash register, manual collection, one upgrade, and fixed decoration slots. Keep mocked developer state isolated from production accounts. Prove the short study-to-game loop.

### Stage C - Backend and study integration

Add server-controlled persistence and transactions, accepted client-reported progress integration, permanent and retroactive grants, and safe collection/purchase handling. Implement the chapter 9 conveyor belt and selected cap-upgrade progression. Enforce signed-in-only access.

### Stage D - Art and personalization

Apply the selected art style, fill out the small catalog, and polish fixed-slot decoration choices, visible equipment changes, and lightweight feedback animations.

### Stage E - Balance, verification, and release

Playtest with realistic class study intervals. Tune prices, production, and cap upgrades while preserving confirmed rules. Check mobile and keyboard use, reduced motion, loading isolation, network failures, retries, and concurrent sessions. Deploy the backend and access rules needed by the feature before exposing the production game entry point.

## 13. Acceptance criteria and test scenarios

- Existing exercises, medal calculation, course saves, and study navigation continue to work.
- The restaurant opens as its own page without study menus, and navigation back to studies works.
- Game code and artwork do not load until its page opens. Signed-out users cannot access a playable game or personal restaurant data, including through a direct URL.
- Two classmates have independent restaurants and cannot alter each other's data.
- A new player has a functioning basic restaurant before chapter 6 bronze.
- The existing medal calculation supplies bronze/silver/gold grants without an extra quiz pass requirement. Test chapter-to-week mapping, especially chapter 9 / `week-4`.
- Initial saved progress grants the appropriate unlocks; a later decline does not revoke grants. Do not claim recovery of historical medals absent from saved data.
- Direct changes to client-side restaurant money or unlock flags cannot authorize purchases. This does not claim that underlying study records are independently verified.
- Identical restaurant configurations and elapsed time yield the same income with the page open or closed.
- Without a cap upgrade, the initial period accrues at most eight production hours, then stops. Visits, logins, reloads, accounting updates, and purchases do not restart it. A purchased higher cap extends the same period while preserving used production time.
- **"Hämta intäkter"** transfers pending income exactly once, empties the register, and starts a fresh period. Excess time beyond the previous cap does not generate another payout.
- Purchases use collected funds only, debit them once, and apply the intended effect. A cap upgrade requires both its chapter grant and yen.
- Rate/cap changes follow sections 5.4-5.7: preserve prior earnings, apply changes prospectively, and discard stopped time. Test rate purchases at a full register and cap purchases before, exactly at, and after the old limit, followed by manual collection.
- Partial minutes and fractional yen survive accounting updates and collection. Equal produced time at equal rates earns the same exact total regardless of how accounting or collection is split; whole-yen display rounding does not alter balances.
- Concurrent tabs, repeated submissions, reloads, and failed/retried requests do not duplicate collection, income, or purchases.
- Decorations occupy fixed slots and do not affect income or production. The conveyor belt appears in its predefined location.
- The page works on small screens and with keyboard controls, honors reduced motion, and has no permanent server simulation loop or every-second database writes.
- Loading or backend failure in the game does not break studies or erase a valid restaurant save.

Use pure-logic tests for production and grants, backend/emulator tests for access and transactions, and existing browser-test tooling for navigation, loading, collection, and decoration interactions. These are future implementation requirements, not tests required for editing this brief.

## 14. Questions still open

Do not silently turn these into final product rules:

1. Final prices, production values, recipe effects, and purchase pacing after playtesting. Section 5.6 supplies provisional implementation defaults, including a purely visual silver recipe.
2. Final chapter assignments, prices, and durations of cap upgrades beyond the confirmed eight-hour starting cap. The provisional MVP uses one chapter 7 bronze upgrade to twelve hours for 1800 yen.
3. Further main-feature and silver/gold rewards beyond the small provisional catalog in section 5.6.
4. Final art style, perspective, artwork, and animation detail.
5. The exact chapter 12 goal, such as a five-star review or special cosmetic.

The product owner approved prospective rate changes, immediate cap increases without compensation for stopped time, and preservation of fractional yen on 2026-10-22. Those accounting rules are resolved in sections 5.4-5.5; they are not provisional balance questions.

## 15. Instructions for coding agents

1. Read this brief and check relevant project code before implementing. Distinguish existing facts, confirmed decisions, and unresolved choices.
2. Preserve TypeScript/lit-html, study workflows, scoring, authentication, and course storage.
3. Keep the game isolated, lazily loaded, and signed-in-only. Do not add a guest demo.
4. Separate pure economy/progression logic from rendering and persistence. Use image layers and CSS.
5. Accept the client-reported study trust model explicitly. Server validation of game operations is not proof of verified learning.
6. Keep uncollected income separate from spendable yen. Never replace explicit collection with a return/login/purchase side effect, or refresh the cap through accounting updates.
7. Award unlocks permanently and recognize existing saved progress where records support it.
8. Keep decorations purely visual and in fixed slots. Do not introduce a conveyor-belt editor.
9. Add the trusted backend and restaurant access rules before production release. Do not reuse course snapshot synchronization for money.
10. Follow the approved accounting rules and worked examples in sections 5.4-5.7. Keep provisional catalog values distinct from confirmed product rules; final balance and further content remain open.
11. Make incremental, reviewable changes and test the accounting, unlock, access, and integration requirements in section 13.
12. Use artwork and learning content the project has the right to distribute. Update this brief when further decisions are approved.

---

**Working vision:** A compact personal sushi restaurant that gives visible rewards for Genki study progress, with manual collection, a bounded idle economy, fixed-slot personalization, and a dedicated page inside the existing study app.
