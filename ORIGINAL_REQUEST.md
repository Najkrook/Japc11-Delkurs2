# Original User Request

## 2026-10-25T12:11:57Z

Use a full multi-agent game studio team. Establish a structured game studio development workflow adapted from Claude-Code-Game-Studios for the Japanese study platform's sushi game, and apply these studio workflows to audit, balance, polish, and verify the game.

Working directory: C:\Users\Najk\.gemini\antigravity\worktrees\Japc11-Delkurs2\improve_sushi_game_teamwork
Integrity mode: development

## Requirements

### R1. Studio Framework & Workflows
Integrate game studio workflow skills and documentation adapted from Claude-Code-Game-Studios into the repository, establishing dedicated specifications for Game Design Documents (GDD), Economy & Balancing models, UX/Art quality checklists, and QA test plans tailored to the web-based sushi restaurant.

### R2. Sushi Game Economy & Design Audit
Execute a studio economy and design audit on the existing sushi restaurant game (`src/course/sushi-game/`), analyzing pacing, upgrade costs, income accrual rates, and progression synchronization with Genki I chapters 6–12 to ensure rewarding idle progression without disincentivizing Japanese study.

### R3. Polish & Code Implementation
Implement prioritized game improvements and balance adjustments identified during the studio audit, ensuring visual and UX polish while preserving the lit-html / TypeScript architecture and deferred loading boundaries.

### R4. Quality Assurance & Regression Verification
Provide automated verification demonstrating that the sushi game economy functions correctly across offline accrual periods, medal unlocks, and purchases, while ensuring the entire web application compiles and builds cleanly.

## Acceptance Criteria

### Studio Documentation & Workflow
- [ ] Game design and economy documentation (GDD, balance model/spec, UX checklist, QA test plan) are created and integrated into the project docs.
- [ ] Ticket tracker and audit logs document the findings, adjustments made, and balance verification.

### Gameplay & Economy Balance
- [ ] Economy parameters in `src/course/sushi-game/` reflect balanced progression milestones aligned with Genki chapters 6–12 and the confirmed game decisions in `sushigame.md`.
- [ ] Accrual, collection cap, and purchase transactions operate deterministically with verified non-negative integer or fractional accounting as specified.

### Build & Verification
- [ ] `npm run typecheck` exits with status 0 with no TypeScript errors.
- [ ] `npm run build` exits with status 0 and maintains separate bundle chunks for the sushi game view.
- [ ] Automated tests for sushi game domain logic pass cleanly when executed.
- [ ] Primary Japanese study views, flashcards, and Dojo drills remain unaffected.
