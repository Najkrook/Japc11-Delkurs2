# Sakura Sushi — Economy and balance model, version 2

> **Current local contract:** 2026-10-27 audit remedies, `balanceVersion: 2`.
> **Scope:** Genki I chapters 6–12 in the existing Japanese study app.
> **Status:** Implemented and verified locally. The [remediation report](../../output/sushi-balance-remediation/sakura-sushi-remedied.html) records the passing domain, browser, backend, rules, build and formatting checks. Student playtesting remains a separate assessment of satisfaction, learning outcomes and retention; no production deployment has been performed.
> **Supersedes:** The former 8h/12h, ¥300 first-upgrade, +5 license balance. The original audit and explicit version-1 accounting scenarios remain historical evidence.

The design is a finite, cozy study companion. Course medals unlock the core restaurant; optional visual projects give accumulated yen a use after small catalog purchases. Projects are separate from the 21 core rewards and never gate course completion. The restaurant has a clear finish rather than requiring endless growth or frequent checking.

Authoritative implementation is in `src/course/sushi-game/{types,catalog,economy,domain-service,projects,study-companion}.ts`. The [product brief](../../sushigame.md) contains marked historical context, which must not override the current balance version.

## 1. Exact accounting

### Currency and production

One yen is exactly 60,000 integer accounting units:

$$U = Y \times 60{,}000, \qquad Y_{display}=\left\lfloor U/60{,}000\right\rfloor$$

The fractional remainder stays in the wallet or cash register. Display rounding never changes accrual, collection, or affordability. With kitchen capacity $K$, service capacity $S$, and average revenue $A$ per order:

$$O=\min(K,S), \qquad R=O\times A \quad [\text{yen/minute}]$$

Since a minute also contains 60,000 milliseconds, $R$ yen/minute is numerically $R$ accounting units/millisecond. Customer animation illustrates activity; it is not a second income simulation.

### Accrual and caps

The base cap is **24 production hours** ($86{,}400{,}000$ ms); the chapter-7 purchase extends it to **48 hours** ($172{,}800{,}000$ ms). Its stable stored ID remains `cap_extension_12h` for save/grant compatibility; that historical ID does not describe its current effect.

For last-accounted time $t_a$, server operation time $t_n$, already-used production time $T$, and active cap $C$:

$$\Delta t=\max(0,t_n-t_a)$$
$$P=\min(\Delta t,\max(0,C-T)), \qquad X=\Delta t-P$$
$$\Delta U=R\times P$$

Add $P$ to used production time and $\Delta U$ to the register. Advance the accounting timestamp to $\max(t_a,t_n)$. $X$ is discarded stopped time. Clock rollback must not reopen an accounted interval.

For a fixed rate and the same productive duration, accounting splits are exact:

$$R\Delta t_1+R\Delta t_2=R(\Delta t_1+\Delta t_2)$$

This establishes precision, not good pacing. Once capped, waiting produces nothing until collection or a prospective cap expansion leaves additional allowance.

### Collection and purchases

1. Collection accounts to the operation time, transfers **all** pending units to spendable yen, empties the register, and resets used production time. The new period begins at the monotonic operation timestamp.
2. Loading, entering the page, purchasing, equipping, or internally accounting does not collect or reset the period.
3. A purchase accounts the old rate/cap first, debits collected funds only, then changes future production. Pending earnings and used production time survive.
4. A cap increase changes remaining allowance to new cap minus used production time. Previously stopped time is never backfilled.
5. Purchases are one-time, server-authoritative, atomic, and idempotent. A client cannot supply authoritative owner, price, eligibility, elapsed time, or effects.
6. Project purchases use the same collected-funds/retry rules. They do not change income, production time, medals, or course progress.

## 2. Current catalog and rate curve

New restaurants start at ¥0 wallet, ¥0 register, $K=1,S=2,A=10$, with the 24-hour cap and no used production time. Income begins at restaurant creation; earlier study time does not backfill restaurant income.

The table assumes all earlier bronze upgrades are owned. Actual previews use the player's state; there are no hidden item prerequisites.

| Chapter | Bronze purchase                             |   Price | Effect        | Result K / S / A | Income ¥/min | Earn time from zero, previous rate |
| ------- | ------------------------------------------- | ------: | ------------- | ---------------- | -----------: | ---------------------------------: |
| 6       | Förbättrad beredningsbänk (`prep_counter`)  |     ¥50 | K +2          | 3 / 2 / 10       |      10 → 20 |                              5 min |
| 7       | Längre produktionstid (`cap_extension_12h`) |  ¥1,800 | Cap 24h → 48h | 3 / 2 / 10       |      20 → 20 |                             90 min |
| 8       | Precisionskniv (`precision_knife`)          |  ¥2,400 | K +1; A +1    | 4 / 2 / 11       |      20 → 22 |                            120 min |
| 9       | Transportband (`conveyor_belt`)             |  ¥3,600 | S +2          | 4 / 4 / 11       |      22 → 44 |                         163.64 min |
| 10      | Utökad serveringsdisk (`service_counter`)   |  ¥5,400 | S +2; A +1    | 4 / 6 / 12       |      44 → 48 |                         122.73 min |
| 11      | Assisterande kock (`sous_chef`)             |  ¥7,200 | K +2          | 6 / 6 / 12       |      48 → 72 |                            150 min |
| 12      | Mästarcertifiering (`master_license`)       | ¥10,800 | A +3          | 6 / 6 / 15       |      72 → 90 |                            150 min |

The knife and counter give immediate income increases in this route. The cap increases storage, not the rate. Nonsequential capacity purchases may still be limited by the other capacity; previews and recommendations must describe the actual effect.

The final current-catalog maximum remains **90 ¥/min, or 5,400 ¥/h**. This finite curve is not asserted to be mathematically “sub-linear” or evidence of retention quality.

Silver recipes and gold decorations remain visual:

| Chapter | Silver recipe          |  Price | Gold decoration     |  Price | Equipped slot |
| ------- | ---------------------- | -----: | ------------------- | -----: | ------------- |
| 6       | Laxnigiri              |   ¥600 | Papperslykta        |   ¥300 | Wall          |
| 7       | Kappamaki (Gurkrulle)  |   ¥900 | Krukväxt            |   ¥450 | Floor         |
| 8       | Maguronigiri (Tonfisk) | ¥1,200 | Noren-gardin        |   ¥600 | Wall          |
| 9       | Ebinigiri (Räka)       | ¥1,500 | Vågmotiv            |   ¥600 | Wall          |
| 10      | Tamagonigiri (Ägg)     | ¥1,800 | Andon-golvlykta     |   ¥750 | Floor         |
| 11      | Sashimi Moriawase      | ¥2,400 | Sakura Bonsai       |   ¥900 | Floor         |
| 12      | Omakase-meny           | ¥3,000 | Gyllene Maneki-Neko | ¥1,500 | Floor         |

Core cost: **¥31,250 bronze + ¥11,400 silver + ¥5,100 gold = ¥47,750**, across 21 purchases. The core is deliberately affordable for weekly visitors. A final-rate 48-hour register contains ¥259,200. That generosity comes with optional projects and a finite finish; cash is not claimed to stay scarce indefinitely.

## 3. Optional restaurant projects

Projects are finite visual savings goals. Eligibility uses the permanent bronze grant, without requiring purchase of the corresponding item. Completed IDs live separately in `completedProjects`; retries cannot charge again. Projects never count toward the 21 core rewards or gate honors, course progress, or restaurant completion.

| Project ID        | Name             | Permanent grant                       |      Price | Income effect |
| ----------------- | ---------------- | ------------------------------------- | ---------: | ------------- |
| `study_nook`      | Läshörna         | Chapter 6 bronze / `prep_counter`     |    ¥60,000 | None          |
| `lantern_evening` | Lyktkväll        | Chapter 8 bronze / `precision_knife`  |   ¥180,000 | None          |
| `garden_terrace`  | Japansk trädgård | Chapter 10 bronze / `service_counter` |   ¥540,000 | None          |
| `hanami_festival` | Hanamifest       | Chapter 12 bronze / `master_license`  | ¥1,620,000 | None          |

Their total cost is **¥2,400,000**. Players may save for a favorite or stop at the core finish. Prices give surplus a visible use; they do not establish that every student enjoys the wait. No production or mastery multiplier makes projects mandatory.

## 4. Existing-save migration

The document shape keeps `schemaVersion: 1`; `balanceVersion: 2` identifies these rules. A missing balance version means version 1. Migration runs inside the domain transaction before operations, not as a browser-only rewrite.

1. Accrue to the operation timestamp using the saved **old** rate and cap. Discard previously stopped time.
2. Recompute canonical capacity/revenue from distinct owned catalog IDs, preserving any higher saved kitchen/service capacity instead of removing a purchased benefit.
3. Expand the cap prospectively to at least 24h, or 48h if the cap item is owned; preserve a higher saved cap. Preserve wallet, register remainder, used production time, inventory, equipment, and grants.
4. Set `legacyRevenueFloor = max(canonicalRevenue, previousRevenue)`. Later revenue purchases use `max(newCanonicalRevenue, legacyRevenueFloor)` rather than stacking a historical bonus twice.
5. Default missing `completedProjects` to an empty list and record version 2. Repeating migration does not re-award effects or backfill income.

A legacy player with the old +5 license retains at least the saved per-order revenue. Later knife/counter purchases can absorb this floor before producing a new revenue increase; the preview must report the actual result. Fresh version-2 production still ends at A=15 and 90 ¥/min. Previously paid prices are not refunded and no new purchase is auto-debited.

Historical 8h/12h fixtures remain valid **explicit old-state scenarios** for accounting/migration tests. They are not product defaults.

## 5. Study and recognition

- Bronze, silver, and gold remain **60/80/100% of counted items**, using the unrounded combined ratio. Counts combine marked vocabulary, kanji, conjugations, and best quiz points.
- Bronze does not require completion of every category or a separate quiz pass. In chapter 6, all non-quiz items yield about 86.7%, enough for silver. This follows the accepted client-reported study trust model; restaurant accounting does not independently certify knowledge.
- Backend-derived grants remain permanent when later practice or a reset lowers current progress. Existing saved records can grant eligibility at restaurant initialization.
- A gold grant awards its chapter honor immediately. All seven honors can remain displayed without buying/equipping decorations. Wall/floor slots remain separate room choices.
- Growth and personalization suggestions are separate. Useful eligible income changes precede unused capacity, and copy distinguishes money in the register, a cash shortfall, and a study gate.
- Optional chapter-specific guest recall uses actual course Japanese, readings, Swedish translations, and source titles. Reveal, next, and listen neither pay yen nor mark mastery.

## 6. Cadence evidence

Current deterministic results are saved in `output/sushi-remedy-economy.json`. Policy: start at zero; all three grants for a chapter become eligible every seven days, chapter 6 on day 0 through chapter 12 on day 42; collect each visit; buy eligible bronze items, then visual catalog items, then projects in listed order. No starter cash, active earnings, or extra learning rewards.

| Collection gap   | Core items by day 42 | Optional projects | Wallet after purchases |     Rate |
| ---------------- | -------------------: | ----------------: | ---------------------: | -------: |
| Weekly, 168h     |              21 / 21 |       First 2 / 4 |               ¥319,930 | 90 ¥/min |
| Daily, 24h       |              21 / 21 |       First 3 / 4 |             ¥1,435,930 | 90 ¥/min |
| Twice daily, 12h |              21 / 21 |       First 3 / 4 |             ¥1,443,130 | 90 ¥/min |

Twice-daily checking adds only ¥7,200 in this route, from buying the first rate upgrade twelve hours earlier. At a fixed configuration, 12h and 24h collection gaps both fit the base cap and earn the same income per elapsed day. The 48h purchase accommodates longer gaps. Weekly absences still exceed it and do not earn seven uninterrupted days.

Every modeled visitor affords core chapter rewards without extra check-ins. Projects consume some surplus and leave an optional favorite outstanding; this is a finite budget, not an infinite sink. These are scenario outcomes, not observed student behavior. Actual medal timings, missed weeks, preferences, and already-qualified students require playtesting.

## 7. Verification and release limits

Verify fractional accrual/collection, prospective changes, previews, migration before successful and rejected operations, revenue-floor behavior, project authorization/idempotency, and unchanged study progression. Rendered checks must cover honors, separate goals, guest reveal/next, projects, and completion on desktop/mobile.

Positive base production and finite prices rule out an unavoidable cash deadlock when collection works and the required grant can be earned. They do **not** prove satisfying pacing, fair workloads, engagement, accessibility compliance, or release readiness.

No production deployment is performed by these local remedies. Publishing is a separate step after current build, backend/rules verification, deployment prerequisites, and release configuration are inspected.
