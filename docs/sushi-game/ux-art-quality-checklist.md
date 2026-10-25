# Sushi Game — UX & Art Quality Checklist

> **Document:** Visual, Responsive, and WCAG 2.1 AA Quality Checklist  
> **Origin:** Adapted from Claude-Code-Game-Studios `/art-bible`, `/asset-spec`, and `/ux-review`  
> **Target Scope:** Sushi Restaurant Game (`src/course/sushi-game/`)  
> **Document Owner:** Art & UX Department (AD)  
> **Status:** Active Standard  

---

## 1. Visual Standards & Art Direction (The Art Bible)

### 1.1 Color Palette & Design Tokens
The sushi restaurant uses a warm, tactile Edo-modern aesthetic rooted in traditional Japanese materials (cedar wood, woven tatami straw, sumi ink, and fresh sushi toppings):

| Token Name | Hex Code | Semantic Role | WCAG Contrast on White |
|---|---|---|---|
| `--sushi-bg-wall` | `#fff4da` | Warm paper / tatami wall | Decorative background |
| `--sushi-wood-cedar` | `#936346` | Traditional cedar counter & structural posts | 4.8:1 (Large text / UI) |
| `--sushi-wood-dark` | `#754b37` | Crossbeams, headers, frames | 6.5:1 (Pass Normal) |
| `--sushi-tatami-mat` | `#ead3ac` | Floor tatami woven texture | Decorative |
| `--sushi-tatami-border` | `#b57550` | Floor border trim | Decorative |
| `--sushi-pine-green` | `#23655f` | Noren valance, matcha accents | 6.2:1 (Pass Normal) |
| `--sushi-salmon-red` | `#e8896d` | Salmon toppings, accent highlights | Decorative graphic |
| `--sushi-ink-line` | `#583e32` | SVG structural line work, dark borders | 7.9:1 (Pass Normal) |
| `--sushi-accent-red` | `#c53030` | Danger, warnings, locked status badges | 5.8:1 (Pass Normal) |
| `--sushi-revenue-green` | `#276749` | Revenue rate badges, positive feedback | 5.6:1 (Pass Normal) |
| `--sushi-balance-blue` | `#2b6cb0` | Spendable wallet badges | 4.8:1 (Pass Normal) |

#### Theme Variations
- **Washi / Matcha (Default):** Classic natural wood, warm cream paper background, deep green accents.
- **Sakura / Kawaii (Toggleable):** Soft pink accents (`#fed7d7`, `#9b2c2c`), celebrating spring and cherry blossoms.

### 1.2 SVG Asset & Illustration Standards
All restaurant illustrations are rendered as pure, scalable inline SVG within `src/course/sushi-game/restaurant-scene.ts`:
- **Fixed Coordinate System:** `viewBox="0 0 960 520"`, `preserveAspectRatio="xMidYMid meet"`.
- **Consistent Stroke Rules:** `stroke="#583e32" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`.
- **Deterministic SVG Layer Stack (Z-Ordering):**
  1. *Layer 0 (Background):* Wall fill (`#fff4da`), Tatami mats (`#ead3ac`), Floor base (`#b57550`).
  2. *Layer 1 (Architecture):* Support posts, roof beams, window grid (`#754b37`, Shoji paper `#83b6af`).
  3. *Layer 2 (Furniture Base):* Service counter top (`#f0c88f`), Counter body (`#936346`).
  4. *Layer 3 (Equipment Upgrades):* Prep cutting board (`art-prep-counter`), Conveyor belt housing (`art-conveyor-belt`).
  5. *Layer 4 (Dishes & Food):* Rotating plates, salmon nigiri, tuna, tamago, sashimi plates.
  6. *Layer 5 (Wall Slot Decor):* Paper lantern, Ukiyo-e Great Wave print, Indigo shop noren.
  7. *Layer 6 (Floor Slot Decor):* Potted bonsai, Andon floor lantern, Sakura bonsai, Golden Maneki-Neko.

### 1.3 Animation & Performance Rules
- **Conveyor Belt Motion:** Linear CSS keyframe animation (`@keyframes sushi-belt-travel { to { stroke-dashoffset: -33; } }`) lasting 3.0s infinite.
- **Attention Glow:** When the cash register reaches cap capacity, a gentle 1.8s pulse (`.pulse-attention`) alerts the student to collect revenue.
- **Background Tab Throttling:** When the tab is hidden (`document.hidden`), `figure[data-paused='true']` halts CSS animations and suppresses client-side DOM re-renders, eliminating unnecessary CPU and battery drain.

---

## 2. Responsive Layout & Mobile Ergonomics

### 2.1 Viewport Breakpoints
The sushi interface is fully responsive across all device sizes:

| Viewport Category | Width Range | Layout Behavior |
|---|---|---|
| **Mobile Portrait** | 360px – 480px | Topbar wraps; restaurant SVG scales proportionally; wallet and register stack vertically; shop catalog renders in a single column; bottom padding accommodates mobile browser chrome. |
| **Mobile Landscape / Phablet** | 481px – 767px | Compact topbar; SVG stage padding reduced; shop cards arrange in a 2-column grid. |
| **Tablet Portrait** | 768px – 1023px | Topbar elements align horizontally; SVG stage scales up; shop cards arrange in a 2–3 column grid. |
| **Desktop / Laptop** | 1024px+ | Centered max-width container (1200px); sticky navigation header; shop cards arrange in a 3–4 column grid. |

### 2.2 Touch Targets & Interactive Ergonomics
- **Minimum Interactive Size:** Every button, selector, link, and toggle satisfies a minimum touch target of **44 × 44 CSS pixels**.
- **Collection Button:** The main revenue collection button (`.sushi-collect-btn`) is prominent: minimum height of 48px, minimum width of 220px, with tactile active feedback.
- **Card Purchase Buttons:** Shop buttons (`.sushi-btn-buy`) provide full-width hit targets on mobile with clear tap states.
- **Hit Area Separation:** Adjacent interactive controls maintain at least 8px of clearance to eliminate accidental touches.

### 2.3 Layout Stability
- Zero horizontal scrolling on any viewport width $\ge 360\text{px}$.
- Text labels use `overflow-wrap: anywhere` to prevent overflow clipping on narrow screens.
- Sticky navigation topbar maintains appropriate z-index layering without obscuring keyboard focus indicators.

---

## 3. Accessibility & Inclusion (WCAG 2.1 AA Compliance)

### 3.1 Perceivable Criteria
- **Color Contrast:**
  - Standard body text and numeric displays achieve $\ge 4.5:1$ contrast against their backgrounds.
  - Large titles and UI interactive boundaries achieve $\ge 3.0:1$ contrast.
  - Verified ratios:
    - Dark text on Tatami Wall: `10.2:1` (Pass)
    - Revenue Green badge: `5.6:1` (Pass)
    - Balance Blue badge: `4.8:1` (Pass)
    - Accent Red badge: `5.8:1` (Pass)
    - Banner alert text on light green: `8.9:1` (Pass)
- **Non-Color Dependence:** Status is never communicated by color alone. Every shop item includes text pills: `"Låst"`, `"För dyr"`, `"Köpbar"`, or `"Ägd"`. Bottleneck notifications explicitly include `"(Flaskhals)"` text tags.
- **SVG Screen Reader Accessibility:**
  - SVG element has `role="img"`.
  - Accessible names provided via `aria-labelledby="restaurant-art-title restaurant-art-desc"`.
  - The `<desc id="restaurant-art-desc">` dynamically updates to describe active equipment, dishes, and decor for vision-impaired students.

### 3.2 Operable Criteria
- **Full Keyboard Navigation:**
  - All interactive elements are reachable via the Tab key in logical reading order:
    1. "Tillbaka till studierna" button
    2. Theme switcher toggle
    3. User account / logout button
    4. "Hämta intäkter" collection button
    5. Shop catalog cards (purchase buttons / study chapter links)
    6. Decoration slot selectors
- **Focus Visible:** All focusable controls display a crisp, high-contrast focus indicator (`outline: 3px solid var(--course-text, #2d3748); outline-offset: 3px;`). Outlines are never suppressed.
- **Reduced Motion Support:** When `prefers-reduced-motion: reduce` is detected:
  - Belt tread animation halts immediately (`animation: none`).
  - Pulsing register animations cease.
  - State changes render instantly without transition animations.

### 3.3 Understandable Criteria
- **Dual Balance Separation:** Explicit visual styling separates uncollected register revenue from spendable wallet funds.
- **Bottleneck Explainer:** Transparent educational card explains when an upgrade increases potential capacity rather than immediate income, teaching players how kitchen and service balance works.
- **Direct Pedagogical Links:** Locked items clearly indicate the required Genki I Chapter and medal tier, providing a direct one-click link back to the relevant chapter study deck.

### 3.4 Robust Criteria
- **ARIA Live Announcer:** A dedicated polite live region (`role="status" aria-live="polite" class="sr-only"`) announces:
  - Revenue collections (`"Hämtade 480 yen. Nytt saldo: 1 200 yen."`)
  - Purchases (`"Köpte Precisionskniv för 2 400 yen."`)
  - Newly unlocked items upon returning from study exercises.
  - Error messages if an action fails.
- **Semantic HTML Landmarks:** Proper use of `<header>`, `<main>`, `<section>`, `<figure>`, `<figcaption>`, and `<aside>`.

---

## 4. Verification & Audit Matrix

| ID | Category | Check Item | Target Standard | Verification Tool | Acceptance Criteria |
|:---:|:---:|:---|:---|:---|:---|
| **UX-01** | Art | SVG ViewBox Standard | `0 0 960 520` | Automated E2E | ViewBox exact match |
| **UX-02** | Art | Stroke Consistency | 4px, round joins & caps | Code Review | Consistent stroke attributes across layers |
| **UX-03** | Art | SVG Z-Order Hierarchy | 7-layer stack | Code Review | Equipment and decor render in correct z-index |
| **UX-04** | A11y | Text Contrast Ratio | $\ge 4.5:1$ (normal), $\ge 3:1$ (large) | Chrome DevTools / Lighthouse | Zero contrast violations |
| **UX-05** | A11y | Visible Focus Indicators | 3px solid outline, 3px offset | Manual Tab / E2E | Outline visible on keyboard navigation |
| **UX-06** | A11y | Reduced Motion Honor | Halts animations | CSS Inspection / E2E | Belt tread stops on `prefers-reduced-motion` |
| **UX-07** | A11y | ARIA Live Announcer | Polite Swedish announcements | Screen Reader / E2E | Announcer updates on collection & purchase |
| **UX-08** | Responsive | Mobile Touch Targets | $\ge 44 \times 44 \text{ CSS px}$ | Playwright E2E | All clickable controls meet minimum area |
| **UX-09** | Responsive | Zero Horizontal Overflow | Width $\le$ Viewport | Playwright E2E | `scrollWidth <= innerWidth` down to 360px |
| **UX-10** | Pedagogical | Bottleneck Guidance | Explanatory banner | Unit Test / E2E | Banner renders when capacity is unbalanced |
