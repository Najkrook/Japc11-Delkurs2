# Sushi Restaurant Tycoon — Game Design Document (GDD)

> **Game Title:** Sushi Restaurant Tycoon (`JAPC11 Delkurs 2`)  
> **Version:** 1.0 (Production Master)  
> **Target Audience:** Genki I Japanese Language Students (Chapters 6–12)  
> **Platform:** Web (Pure lit-html / TypeScript / Scoped CSS, Mobile & Desktop)  
> **Document Owner:** Game Design & Economy Department  
> **Status:** Approved Specification

---

## 1. Executive Summary & High Concept

**Sushi Restaurant Tycoon** is a compact, cozy, tactile personal sushi restaurant tycoon embedded within the Genki I Japanese language learning web platform. Each student owns and operates a single traditional restaurant that generates income while they study or rest.

The restaurant serves as a motivational companion to Japanese language acquisition: students master vocabulary, kanji, grammar conjugations, and chapter quizzes to earn chapter medals (Bronze 60%, Silver 80%, Gold 100%). These medals unlock kitchen equipment, sushi recipe variations, and traditional Japanese decorations in the restaurant catalog.

---

## 2. Core Game Pillars

### 2.1 Pillar 1: Study-First Integration

Language acquisition is the sole engine of restaurant progression. Answering flashcards or dojo drills never pays direct yen; doing so would incentivize repetitive spamming of easy exercises. Instead, progression gates are tied strictly to Genki I chapter mastery milestones.

### 2.2 Pillar 2: Bounded Stress-Free Idle Accrual

Production accrues deterministically whether the student has the page open or closed. Accrual is bounded by an 8-hour cap (upgradable to 12 hours) and requires deliberate manual collection ("Hämta intäkter"). There is no food spoilage, no penalty for being offline, and no compulsive check-in loop.

### 2.3 Pillar 3: Tactical Bottleneck Management

Throughput is governed by a transparent two-capacity model:
$$\text{Orders per minute } O = \min(K, S)$$
$$\text{Revenue per minute } R = O \times A$$
Students must actively identify whether their kitchen production ($K$) or customer service capacity ($S$) is the limiting factor, making upgrade decisions satisfying and educational.

### 2.4 Pillar 4: Authentic Aesthetic Expression

The restaurant is visualized as an authentic Edo-modern vector illustration (`viewBox="0 0 960 520"`). Upgrades dynamically update the visual scene—expanding counters, animating conveyor belts, placing authentic sushi plates (salmon, tuna, tamago, sashimi), and displaying cultural decorations (paper lanterns, bonsai, noren, ukiyo-e woodblock prints).

---

## 3. Core Player Loop

```
┌────────────────────────────────────────────────────────┐
│               Study Genki I Exercises                  │
│       (Vocabulary, Kanji, Conjugations, Quiz)          │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                 Earn Chapter Medals                    │
│      Bronze (60%)  •  Silver (80%)  •  Gold (100%)      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             Permanent Shop Catalog Unlocks             │
│      Kitchen Upgrades  •  Recipes  •  Decorations      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│           Bounded Idle Restaurant Accrual              │
│       Lazy accrual capped at 8h (or 12h upgraded)      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│         Manual Collection ("Hämta intäkter")          │
│    Lossless 1/60,000 yen transfer to spendable wallet  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               Purchase Upgrades & Polish               │
│       Expand Capacity  •  Update SVG Scene Layers      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│       Return to Studies for Next Chapter Unlock        │
│                ("Fortsätt studera")                    │
└────────────────────────────────────────────────────────┘
```

---

## 4. Formal Mechanics & System Rules

### 4.1 Production Engine

Throughput is determined by three variables:

- **Kitchen Capacity ($K$):** Rate at which chefs prepare sushi orders (orders/minute).
- **Service Capacity ($S$):** Rate at which the counter or conveyor belt serves orders (orders/minute).
- **Average Revenue ($A$):** Revenue earned per completed order (base: 10 ¥/order; upgraded to 15 ¥/order).

$$\text{Effective Throughput: } O = \min(K, S)$$
$$\text{Revenue Rate: } R = O \times A \quad (\text{Yen / minute})$$

### 4.2 Deterministic Lossless Integer Arithmetic

To eliminate floating-point drift over days of offline accrual:

- **Internal Units:** $1 \text{ Yen} = 60{,}000 \text{ units}$.
- **Rate in Units:** A rate of $R \text{ Yen/min}$ earns exactly $R \text{ units per millisecond}$:
  $$r = \frac{R \times 60{,}000 \text{ units}}{60{,}000 \text{ ms}} = R \text{ units/ms}$$
- **Display Conversion:** Whole yen displayed in the UI is rounded down without discarding fractional units:
  $$Y_{\text{display}} = \left\lfloor \frac{\text{balanceUnits}}{60{,}000} \right\rfloor$$

### 4.3 Lazy Accrual & Collection Lifecycle

There is no background server cron job running continuously for idle players. Instead, earnings are calculated on demand when state is accessed:

1. **Accrual Period:** Measured from the last accounting timestamp ($t_{\text{accounted}}$) to current time ($t_{\text{now}}$).
2. **Cap Clamping:** Productive time is clamped to the remaining allowance:
   $$P = \min(t_{\text{now}} - t_{\text{accounted}}, C - T_{\text{used}})$$
   where $C$ is the cap duration ($8\text{h} = 28{,}800{,}000\text{ ms}$; $12\text{h} = 43{,}200{,}000\text{ ms}$) and $T_{\text{used}}$ is accumulated productive time.
3. **Discarding Stopped Time:** Excess elapsed time beyond the cap ($X = \Delta t - P$) is permanently discarded; no retroactive earnings accumulate once capped.
4. **Manual Collection:** Activating "Hämta intäkter" transfers all uncollected units into the player's spendable wallet and resets $T_{\text{used}}$ to $0$.

### 4.4 Mid-Period Upgrade Transitions

When an upgrade is purchased mid-period:

- **Rate Increases ($\Delta K > 0$ or $\Delta S > 0$):** Uncollected earnings up to the purchase timestamp are accounted at the old rate; future elapsed time accrues at the new rate.
- **Cap Extensions ($8\text{h} \to 12\text{h}$):** Active production time is preserved; remaining allowance expands to $(12\text{h} - T_{\text{used}})$. Stopped time spent while capped before purchase is never compensated.

### 4.5 Study Medal Bridge & Monotonic Grants

Catalog items require specific Genki chapter medals:

- **Bronze (60% mastery):** Functional upgrades (Kitchen capacity, Service capacity, Cap extension, Revenue license).
- **Silver (80% mastery):** Authentic sushi recipe variations.
- **Gold (100% mastery):** High-prestige cosmetic decorations.
- **Monotonic Non-Revocation:** Progress grants are merged into permanent grants via set union (`mergePermanentGrants`). Lower subsequent quiz scores or deck resets never revoke unlocked items or purchased equipment.

### 4.6 Fixed-Slot Customization

To keep UI lightweight and prevent distraction:

- Exactly **1 Wall Slot** (`wallSlot`) and **1 Floor Slot** (`floorSlot`).
- Decorations are purely cosmetic and provide zero gameplay advantage (zero capacity or rate boost).
- Purchased decorations are placed into a drawer and can be swapped at any time.

---

## 5. Complete Curriculum Progression Catalog (21 Items)

The catalog covers all 7 lessons of Genki I (Chapters 6 through 12):

| Chapter |  Tier  | Item ID              | Swedish Name              | Category       | Cost (¥) | Effect / Delta   | Rate ($K, S, A$)                 | Bottleneck |
| :-----: | :----: | :------------------- | :------------------------ | :------------- | -------: | :--------------- | :------------------------------- | :--------: |
|  **6**  |  Base  | _(Start)_            | Grundkök                  | Base           |      0 ¥ | Starting kitchen | $K:1, S:2, A:10 \implies 10$ ¥/m |  Kitchen   |
|  **6**  | Bronze | `prep_counter`       | Förbättrad beredningsbänk | Kitchen        |    300 ¥ | $K+2$            | $K:3, S:2, A:10 \implies 20$ ¥/m |  Service   |
|  **6**  | Silver | `salmon_nigiri`      | Laxnigiri                 | Recipe         |    600 ¥ | Salmon plate     | $K:3, S:2, A:10 \implies 20$ ¥/m |  Service   |
|  **6**  |  Gold  | `paper_lantern`      | Papperslykta              | Decor (Wall)   |    300 ¥ | Wall slot        | $K:3, S:2, A:10 \implies 20$ ¥/m |  Service   |
|  **7**  | Bronze | `cap_extension_12h`  | Längre produktionstid     | Cap            |  1,800 ¥ | Cap 8h $\to$ 12h | $K:3, S:2, A:10 \implies 20$ ¥/m |  Service   |
|  **7**  | Silver | `kappamaki`          | Kappamaki (Gurkrulle)     | Recipe         |    900 ¥ | Cucumber roll    | $K:3, S:2, A:10 \implies 20$ ¥/m |  Service   |
|  **7**  |  Gold  | `potted_plant`       | Krukväxt (Bonsai)         | Decor (Floor)  |    450 ¥ | Floor slot       | $K:3, S:2, A:10 \implies 20$ ¥/m |  Service   |
|  **8**  | Bronze | `precision_knife`    | Precisionskniv            | Kitchen        |  2,400 ¥ | $K+1$            | $K:4, S:2, A:10 \implies 20$ ¥/m |  Service   |
|  **8**  | Silver | `maguro_nigiri`      | Maguronigiri (Tonfisk)    | Recipe         |  1,200 ¥ | Tuna plate       | $K:4, S:2, A:10 \implies 20$ ¥/m |  Service   |
|  **8**  |  Gold  | `noren_curtain`      | Noren-gardin              | Decor (Wall)   |    600 ¥ | Wall slot        | $K:4, S:2, A:10 \implies 20$ ¥/m |  Service   |
|  **9**  | Bronze | `conveyor_belt`      | Transportband             | Service        |  3,600 ¥ | $S+2$            | $K:4, S:4, A:10 \implies 40$ ¥/m |  Balanced  |
|  **9**  | Silver | `ebi_nigiri`         | Ebinigiri (Räka)          | Recipe         |  1,500 ¥ | Shrimp plate     | $K:4, S:4, A:10 \implies 40$ ¥/m |  Balanced  |
|  **9**  |  Gold  | `wave_print`         | Vågmotiv (Ukiyo-e)        | Decor (Wall)   |    600 ¥ | Wall slot        | $K:4, S:4, A:10 \implies 40$ ¥/m |  Balanced  |
| **10**  | Bronze | `service_counter`    | Utökad serveringsdisk     | Service        |  5,400 ¥ | $S+2$            | $K:4, S:6, A:10 \implies 40$ ¥/m |  Kitchen   |
| **10**  | Silver | `tamago_nigiri`      | Tamagonigiri (Ägg)        | Recipe         |  1,800 ¥ | Egg plate        | $K:4, S:6, A:10 \implies 40$ ¥/m |  Kitchen   |
| **10**  |  Gold  | `andon_lantern`      | Andon-golvlykta           | Decor (Floor)  |    750 ¥ | Floor slot       | $K:4, S:6, A:10 \implies 40$ ¥/m |  Kitchen   |
| **11**  | Bronze | `sous_chef`          | Assisterande kock         | Kitchen        |  7,200 ¥ | $K+2$            | $K:6, S:6, A:10 \implies 60$ ¥/m |  Balanced  |
| **11**  | Silver | `sashimi_plate`      | Sashimi Moriawase         | Recipe         |  2,400 ¥ | Sashimi plate    | $K:6, S:6, A:10 \implies 60$ ¥/m |  Balanced  |
| **11**  |  Gold  | `sakura_bonsai`      | Sakura Bonsai             | Decor (Floor)  |    900 ¥ | Floor slot       | $K:6, S:6, A:10 \implies 60$ ¥/m |  Balanced  |
| **12**  | Bronze | `master_license`     | Mästarcertifiering        | Revenue        | 10,800 ¥ | $A+5$ (15 ¥/ord) | $K:6, S:6, A:15 \implies 90$ ¥/m |  Balanced  |
| **12**  | Silver | `omakase_menu`       | Omakase-meny              | Recipe         |  3,000 ¥ | Master plate     | $K:6, S:6, A:15 \implies 90$ ¥/m |  Balanced  |
| **12**  |  Gold  | `golden_maneki_neko` | Gyllene Maneki-Neko       | Decor (Trophy) |  1,500 ¥ | Golden trophy    | $K:6, S:6, A:15 \implies 90$ ¥/m |  Balanced  |

---

## 6. Visual & Sensory Direction

- **Perspective:** 2D front-facing architectural cross-section vector illustration (`viewBox="0 0 960 520"`).
- **Color Palette:** Warm Edo-modern aesthetic:
  - Cedar wood (`#936346`), Tatami cream (`#fff4da`), Dark pine (`#23655f`), Salmon red (`#e8896d`), Deep ink outline (`#583e32`).
- **SVG Layering Stack:**
  1. Room background (cream wall, wooden floor).
  2. Room architecture (posts, crossbeams, Shoji window).
  3. Base sushi counter.
  4. Kitchen equipment (prep board, knives, conveyor belt casing).
  5. Dishes & food (plates rotating along the counter).
  6. Wall slot decoration (lanterns, prints, noren).
  7. Floor slot decoration (bonsai, lanterns, golden cat).
- **Animation & Performance:** Conveyor belt animation is driven by scoped CSS keyframes (`stroke-dashoffset: -33`). When the browser tab is hidden (`document.hidden`), animations pause to conserve battery and CPU.
- **Audio:** Purely silent web design; sensory feedback is provided through tactile ARIA screen reader announcements, smooth progress bars, and glowing status pills.

---

## 7. UI / UX Architecture & Navigation

- **Dedicated Routing:** Loaded dynamically at `#/sushi` via code-splitting; completely isolated from the standard Japanese study sidebar.
- **Header & Navigation:** Includes clear "Tillbaka till studierna" button, theme switcher, and student identity profile.
- **Cash Register & Wallet:** Distinct visual separation between spendable currency and register earnings awaiting manual collection.
- **Bottleneck Explainer:** Clear instructional banner explaining when an upgrade will increase potential rather than immediate output (e.g. adding knife capacity while service remains the limiting factor).
- **Catalog Shop Cards:** 4 distinct visual states:
  1. _Låst:_ Displays chapter/medal requirement with direct link to study exercises.
  2. _För dyr:_ Unlocked but wallet balance insufficient; displays remaining yen needed.
  3. _Köpbar:_ High-contrast primary action button.
  4. _Ägd:_ Equipment or recipe active in restaurant.
- **Accessibility:** Full WCAG 2.1 AA compliance (contrast $\ge 4.5:1$, visible 3px focus outline, `prefers-reduced-motion` support, `aria-live="polite"` transaction feedback).

---

## 8. Anti-Features & Guardrails

To preserve pedagogical focus and software maintainability, the following are strictly prohibited:

- ❌ **No Gacha or Lootboxes:** All items have deterministic costs and requirements.
- ❌ **No Microtransactions or Real Money:** All currency is earned in-game.
- ❌ **No Energy Bars or Cooldown Skips:** Time gating cannot be bypassed with currency.
- ❌ **No Exercise Grinding for Direct Yen:** Money is earned solely through the idle economy.
- ❌ **No Customer AI, Patience Bars, or Seating Queues:** Customers serve purely as visual ambience.
- ❌ **No Freeform Conveyor Belt Editors or Layout Grids:** Layout is fixed and elegant.
- ❌ **No Unauthenticated Guest Play:** A valid student account is required.
- ❌ **No Continuous Server Ticking Loops:** Accrual is 100% lazy and client/transaction evaluated.
