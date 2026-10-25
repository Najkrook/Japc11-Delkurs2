# Sushi Game — Mathematical Economy & Balancing Model

> **Document:** Mathematical Economy & Progression Balancing Model  
> **Target Scope:** Genki I Chapters 6–12 (`JAPC11 Delkurs 2`)  
> **Document Owner:** Economy & Balancing Department (ED)  
> **Status:** Production Standard

---

## 1. Mathematical Foundations & Theorems

The economic model is designed to be deterministic, lossless, resilient against clock adjustments, and strictly sub-linear.

### 1.1 Precision & Unit Conversion Equations

To eliminate cumulative floating-point errors over weeks of idle simulation:

- **Integer Base Multiplier:**
  $$U_{\text{multiplier}} = 60{,}000 \quad [\text{units per Yen}]$$
- **Yen to Internal Units:**
  $$U = Y \times 60{,}000 \quad (U \in \mathbb{N}_0)$$
- **Display Conversion (Lossless Round-down):**
  $$Y_{\text{display}} = \left\lfloor \frac{U}{60{,}000} \right\rfloor$$
  _Fractional yen remainder $(U \pmod{60{,}000})$ is strictly retained in state._

### 1.2 Rate Determination

Production throughput is defined by the two-capacity model:
$$O(t) = \min(K(t), S(t)) \quad [\text{orders / minute}]$$
$$R(t) = O(t) \times A(t) \quad [\text{Yen / minute}]$$

Because $1 \text{ minute} = 60{,}000 \text{ ms}$ and $1 \text{ Yen} = 60{,}000 \text{ units}$, the unit rate per millisecond is numerically identical to the Yen rate per minute:
$$r(t) = \frac{R(t) \times 60{,}000 \text{ units}}{60{,}000 \text{ ms}} = R(t) \quad [\text{units / ms}]$$

### 1.3 Accrual Evaluation & Cap Clamping

Let:

- $t_{\text{accounted}}$: Timestamp of last accounting event (ms).
- $t_{\text{now}}$: Current timestamp ($t_{\text{now}} \ge t_{\text{accounted}}$).
- $T_{\text{used}}$: Active production time accumulated in current collection cycle (ms).
- $C$: Active cycle cap duration ($8\text{h} = 28{,}800{,}000\text{ ms}$; $12\text{h} = 43{,}200{,}000\text{ ms}$).

The deterministic accrual function is defined as:
$$\Delta t = \max(0, t_{\text{now}} - t_{\text{accounted}})$$
$$T_{\text{rem}} = \max(0, C - T_{\text{used}})$$
$$P = \min(\Delta t, T_{\text{rem}}) \quad [\text{produced ms}]$$
$$X = \Delta t - P \quad [\text{discarded excess ms}]$$
$$\Delta U = R(t) \times P \quad [\text{units earned}]$$

State update:
$$T_{\text{used}}^{\prime} = T_{\text{used}} + P$$
$$t_{\text{accounted}}^{\prime} = t_{\text{now}}$$
$$\text{uncollectedUnits}^{\prime} = \text{uncollectedUnits} + \Delta U$$

### 1.4 Theorem: Splitting Invariance

**Theorem:** _For any rate $R$ and any duration partition $\Delta t = \Delta t_1 + \Delta t_2$ where $\Delta t \le T\_{\text{rem}}$, the accrued units satisfy exact equality:_
$$E(\Delta t_1) + E(\Delta t_2) = R \times \Delta t_1 + R \times \Delta t_2 = R \times (\Delta t_1 + \Delta t_2) = E(\Delta t)$$
_Proof:_ Direct distributivity over integer multiplication.  
_Significance:_ Calling accrual calculation at 1 Hz, 60 Hz, or once after 8 hours produces the exact same integer units. Zero drift, zero rounding artifacts.

### 1.5 Mid-Period Upgrades & Transitions

1. **Capacity / Revenue Rate Upgrade ($\Delta K > 0, \Delta S > 0, \Delta A > 0$):**
   - Accrual up to $t_{\text{purchase}}$ is evaluated at rate $R_{\text{old}}$.
   - Future accrual beyond $t_{\text{purchase}}$ evaluates at rate $R_{\text{new}}$.
   - $T_{\text{used}}$ is preserved; accumulated uncollected units are preserved.
2. **Cap Extension Upgrade ($C\_{\text{old}} \to C\_{\text{new}}$ where $C\_{\text{new}} > C\_{\text{old}}$):**
   - Remaining allowance expands: $T_{\text{rem}}^{\text{new}} = C_{\text{new}} - T_{\text{used}}$.
   - If the restaurant reached $C_{\text{old}}$ prior to purchase, stopped time during $[t_{\text{cap\_reached}}, t_{\text{purchase}}]$ is permanently discarded and never backfilled.
3. **Manual Collection Reset:**
   - Uncollected units are transferred to the spendable wallet:
     $$\text{walletUnits}^{\prime} = \text{walletUnits} + \text{uncollectedUnits}$$
     $$\text{uncollectedUnits}^{\prime} = 0, \quad T_{\text{used}}^{\prime} = 0, \quad t_{\text{accounted}}^{\prime} = t_{\text{now}}$$

---

## 2. Comprehensive 21-Item Catalog Progression Matrix (Genki 6–12)

|   Ch   | Lesson |   Week   |  Tier  | Item ID              | Item Name (Swedish)       | Category       | Price (¥) | Price (Units) | Stat Delta       | Resulting $K, S, A$ | Rate (¥/m) | Rate (¥/h) | Bottleneck | Time to Earn (Current) |   % of Cap   |
| :----: | :----: | :------: | :----: | :------------------- | :------------------------ | :------------- | --------: | ------------: | :--------------- | :------------------ | ---------: | ---------: | :--------: | :--------------------: | :----------: |
| **6**  |   6    | `week-1` | Start  | _(Base)_             | Grundkök                  | Base           |       0 ¥ |             0 | Starting kitchen | $K:1, S:2, A:10$    |     10 ¥/m |    600 ¥/h |  Kitchen   |         0 min          |     0.0%     |
| **6**  |   6    | `week-1` | Bronze | `prep_counter`       | Förbättrad beredningsbänk | Kitchen        |     300 ¥ |    18,000,000 | $K+2$            | $K:3, S:2, A:10$    |     20 ¥/m |  1,200 ¥/h |  Service   |         30 min         |  6.25% (8h)  |
| **6**  |   6    | `week-1` | Silver | `salmon_nigiri`      | Laxnigiri                 | Recipe         |     600 ¥ |    36,000,000 | Recipe plate     | $K:3, S:2, A:10$    |     20 ¥/m |  1,200 ¥/h |  Service   |         30 min         |  6.25% (8h)  |
| **6**  |   6    | `week-1` |  Gold  | `paper_lantern`      | Papperslykta              | Decor (Wall)   |     300 ¥ |    18,000,000 | Wall slot        | $K:3, S:2, A:10$    |     20 ¥/m |  1,200 ¥/h |  Service   |         15 min         |  3.12% (8h)  |
| **7**  |   7    | `week-2` | Bronze | `cap_extension_12h`  | Längre produktionstid     | Cap            |   1,800 ¥ |   108,000,000 | Cap 8h $\to$ 12h | $K:3, S:2, A:10$    |     20 ¥/m |  1,200 ¥/h |  Service   |         90 min         | 18.75% (8h)  |
| **7**  |   7    | `week-2` | Silver | `kappamaki`          | Kappamaki (Gurkrulle)     | Recipe         |     900 ¥ |    54,000,000 | Recipe plate     | $K:3, S:2, A:10$    |     20 ¥/m |  1,200 ¥/h |  Service   |         45 min         | 6.25% (12h)  |
| **7**  |   7    | `week-2` |  Gold  | `potted_plant`       | Krukväxt (Bonsai)         | Decor (Floor)  |     450 ¥ |    27,000,000 | Floor slot       | $K:3, S:2, A:10$    |     20 ¥/m |  1,200 ¥/h |  Service   |        22.5 min        | 3.12% (12h)  |
| **8**  |   8    | `week-3` | Bronze | `precision_knife`    | Precisionskniv            | Kitchen        |   2,400 ¥ |   144,000,000 | $K+1$            | $K:4, S:2, A:10$    |     20 ¥/m |  1,200 ¥/h |  Service   |        120 min         | 16.67% (12h) |
| **8**  |   8    | `week-3` | Silver | `maguro_nigiri`      | Maguronigiri (Tonfisk)    | Recipe         |   1,200 ¥ |    72,000,000 | Recipe plate     | $K:4, S:2, A:10$    |     20 ¥/m |  1,200 ¥/h |  Service   |         60 min         | 8.33% (12h)  |
| **8**  |   8    | `week-3` |  Gold  | `noren_curtain`      | Noren-gardin              | Decor (Wall)   |     600 ¥ |    36,000,000 | Wall slot        | $K:4, S:2, A:10$    |     20 ¥/m |  1,200 ¥/h |  Service   |         30 min         | 4.17% (12h)  |
| **9**  |   9    | `week-4` | Bronze | `conveyor_belt`      | Transportband             | Service        |   3,600 ¥ |   216,000,000 | $S+2$            | $K:4, S:4, A:10$    |     40 ¥/m |  2,400 ¥/h |  Balanced  |        180 min         | 25.00% (12h) |
| **9**  |   9    | `week-4` | Silver | `ebi_nigiri`         | Ebinigiri (Räka)          | Recipe         |   1,500 ¥ |    90,000,000 | Recipe plate     | $K:4, S:4, A:10$    |     40 ¥/m |  2,400 ¥/h |  Balanced  |        37.5 min        | 5.21% (12h)  |
| **9**  |   9    | `week-4` |  Gold  | `wave_print`         | Vågmotiv (Ukiyo-e)        | Decor (Wall)   |     600 ¥ |    36,000,000 | Wall slot        | $K:4, S:4, A:10$    |     40 ¥/m |  2,400 ¥/h |  Balanced  |         15 min         | 2.08% (12h)  |
| **10** |   10   | `week-5` | Bronze | `service_counter`    | Utökad serveringsdisk     | Service        |   5,400 ¥ |   324,000,000 | $S+2$            | $K:4, S:6, A:10$    |     40 ¥/m |  2,400 ¥/h |  Kitchen   |        135 min         | 18.75% (12h) |
| **10** |   10   | `week-5` | Silver | `tamago_nigiri`      | Tamagonigiri (Ägg)        | Recipe         |   1,800 ¥ |   108,000,000 | Recipe plate     | $K:4, S:6, A:10$    |     40 ¥/m |  2,400 ¥/h |  Kitchen   |         45 min         | 6.25% (12h)  |
| **10** |   10   | `week-5` |  Gold  | `andon_lantern`      | Andon-golvlykta           | Decor (Floor)  |     750 ¥ |    45,000,000 | Floor slot       | $K:4, S:6, A:10$    |     40 ¥/m |  2,400 ¥/h |  Kitchen   |       18.75 min        | 2.60% (12h)  |
| **11** |   11   | `week-6` | Bronze | `sous_chef`          | Assisterande kock         | Kitchen        |   7,200 ¥ |   432,000,000 | $K+2$            | $K:6, S:6, A:10$    |     60 ¥/m |  3,600 ¥/h |  Balanced  |        180 min         | 25.00% (12h) |
| **11** |   11   | `week-6` | Silver | `sashimi_plate`      | Sashimi Moriawase         | Recipe         |   2,400 ¥ |   144,000,000 | Recipe plate     | $K:6, S:6, A:10$    |     60 ¥/m |  3,600 ¥/h |  Balanced  |         40 min         | 5.56% (12h)  |
| **11** |   11   | `week-6` |  Gold  | `sakura_bonsai`      | Sakura Bonsai             | Decor (Floor)  |     900 ¥ |    54,000,000 | Floor slot       | $K:6, S:6, A:10$    |     60 ¥/m |  3,600 ¥/h |  Balanced  |         15 min         | 2.08% (12h)  |
| **12** |   12   | `week-7` | Bronze | `master_license`     | Mästarcertifiering        | Revenue        |  10,800 ¥ |   648,000,000 | $A+5$            | $K:6, S:6, A:15$    |     90 ¥/m |  5,400 ¥/h |  Balanced  |        180 min         | 25.00% (12h) |
| **12** |   12   | `week-7` | Silver | `omakase_menu`       | Omakase-meny              | Recipe         |   3,000 ¥ |   180,000,000 | Recipe plate     | $K:6, S:6, A:15$    |     90 ¥/m |  5,400 ¥/h |  Balanced  |        33.3 min        | 4.63% (12h)  |
| **12** |   12   | `week-7` |  Gold  | `golden_maneki_neko` | Gyllene Maneki-Neko       | Decor (Trophy) |   1,500 ¥ |    90,000,000 | Prestige Decor   | $K:6, S:6, A:15$    |     90 ¥/m |  5,400 ¥/h |  Balanced  |        16.7 min        | 2.31% (12h)  |

---

## 3. Pacing & Macroeconomic Equilibrium Analysis

### 3.1 Sink vs Source Totals

- **Functional Upgrades (Bronze):** $300 + 1{,}800 + 2{,}400 + 3{,}600 + 5{,}400 + 7{,}200 + 10{,}800 = \mathbf{31{,}500 \text{ \yen}}$
- **Recipe Variations (Silver):** $600 + 900 + 1{,}200 + 1{,}500 + 1{,}800 + 2{,}400 + 3{,}000 = \mathbf{11{,}400 \text{ \yen}}$
- **Cosmetic Decor (Gold):** $300 + 450 + 600 + 600 + 750 + 900 + 1{,}500 = \mathbf{5{,}100 \text{ \yen}}$
- **Grand Total Catalog Investment:** $\mathbf{48{,}000 \text{ \yen}}$

### 3.2 Idle Session Yields Across Chapters

At standard collection intervals:

- **Chapter 6 Base (10 ¥/min):**
  - Full 8-hour cap yield: $10 \times 480\text{ min} = 4{,}800 \text{ \yen}$.
  - Easily covers Chapter 6 items ($1{,}200 \text{ \yen}$ total) with surplus.
- **Chapter 7 (20 ¥/min, 12h Cap):**
  - Full 12-hour cap yield: $20 \times 720\text{ min} = 14{,}400 \text{ \yen}$.
  - Covers Chapter 7 items ($3{,}150 \text{ \yen}$ total).
- **Chapter 9 (40 ¥/min, 12h Cap):**
  - Full 12-hour cap yield: $40 \times 720\text{ min} = 28{,}800 \text{ \yen}$.
  - Covers Chapter 9 items ($5{,}700 \text{ \yen}$ total).
- **Chapter 11 (60 ¥/min, 12h Cap):**
  - Full 12-hour cap yield: $60 \times 720\text{ min} = 43{,}200 \text{ \yen}$.
  - Covers Chapter 11 items ($10{,}500 \text{ \yen}$ total).
- **Chapter 12 (90 ¥/min, 12h Cap):**
  - Full 12-hour cap yield: $90 \times 720\text{ min} = 64{,}800 \text{ \yen}$.
  - Covers Chapter 12 items ($15{,}300 \text{ \yen}$ total).

### 3.3 Rate Curve Profile

The rate curve scales sub-linearly:
$$R_6 = 10 \to 20 \to 20 \to 20 \to 40 \to 40 \to 60 \to 90 \text{ \yen/min}$$
A 9x total expansion over 7 curriculum chapters guarantees:

1. No hyperinflation or need for exponential suffixes (e.g. 1.2e8 or K/M/B).
2. Numbers remain friendly, tangible, and culturally authentic (Japanese Yen values).
3. Even if a student is away for several days, the 8h/12h idle cap ensures their earnings never exceed reasonable boundaries.

### 3.4 The Pedagogical Study Lock

The most vital economic property is the **Study Lock**:
$$\text{Wallet Accumulation} > \text{Catalog Item Cost} \quad \centernot\implies \quad \text{Purchase Permitted}$$
A student may accumulate $50{,}000 \text{ \yen}$ in idle earnings, but they **cannot spend** it on Chapter 10's Service Counter until they open Genki I Chapter 10, complete its vocabulary, kanji, and grammar exercises, and achieve at least 60% mastery to earn the Bronze Medal.

This preserves the "Study-First" Prime Directive: idle accumulation complements studies, but never bypasses curriculum mastery.

---

## 4. Bottleneck Alternation Strategy

The two-capacity engine $O = \min(K, S)$ creates intentional tactical pacing:

1. **Chapter 6 Start ($K=1, S=2 \implies O=1$):**
   - _Bottleneck:_ Kitchen. The chef is too slow for the counter.
2. **Chapter 6 Bronze ($K=3, S=2 \implies O=2$):**
   - _Bottleneck:_ Service. Upgrading the prep counter increases kitchen capacity to 3, but the counter can only serve 2. Rate rises from 10 to 20 ¥/min.
3. **Chapter 8 Bronze ($K=4, S=2 \implies O=2$):**
   - _Bottleneck:_ Service. Purchasing the Precision Knife increases kitchen capacity to 4, but service remains 2.
   - _Pedagogical UX:_ The UI's dynamic bottleneck explainer explains to the student that potential has increased, and that unlocking the Chapter 9 Conveyor Belt will uncap production.
4. **Chapter 9 Bronze ($K=4, S=4 \implies O=4$):**
   - _Bottleneck:_ Balanced. The Conveyor Belt doubles service capacity to 4, matching the kitchen. Rate doubles from 20 to 40 ¥/min! The purchase feels immensely rewarding.
5. **Chapter 10 Bronze ($K=4, S=6 \implies O=4$):**
   - _Bottleneck:_ Kitchen. Expanding the service counter to 6 prepares the restaurant for an assistant chef.
6. **Chapter 11 Bronze ($K=6, S=6 \implies O=6$):**
   - _Bottleneck:_ Balanced. The Assistant Chef brings kitchen capacity to 6. Rate jumps to 60 ¥/min.
7. **Chapter 12 Bronze ($K=6, S=6, A=15 \implies O=6, R=90$):**
   - _Capstone:_ The Master Chef License raises order revenue from 10 to 15 ¥/order, unlocking the final maximum rate of 90 ¥/min (5,400 ¥/h).

### 4.5 Proof of Zero Progression Deadlocks

1. Starting state has $K=1, S=2, A=10 \implies R=10 \text{ \yen/min} > 0$.
2. Because $R(t) \ge 10 \text{ \yen/min} > 0$ for all valid game states, a player always accrues funds while resting.
3. Chapter 6 Bronze upgrade costs 300 ¥, which requires exactly 30 minutes of idle accrual.
4. All upgrade costs are finite and strictly lower than the earnings yielded by a single 8h or 12h capped session at the prerequisite chapter's rate.
5. Therefore, no economic deadlocks exist.
