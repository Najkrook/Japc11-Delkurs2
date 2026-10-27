# Three restaurant tiers

The current restaurant has three permanent appearances. Tier 1 covers chapters 6–8. The next renovations cost ¥3,600 (chapter 9 bronze, tier 2, chapters 9–10) and ¥10,800 (chapter 11 bronze, tier 3, chapters 11–12). Renovations are sequential and use only collected funds. Production rules, optional projects and the original 21 reward prices are unchanged.

`renovations.ts` owns pricing, chapter mapping and the schema-v2 migration. `tier-scenes.ts` owns normalized room anchors. `assets.json` beside the images records ImageGen prompts and normalization. Foreground images contain the room's original pixels clipped to the counter, allowing characters behind the counter without showing their feet through it. Guest buttons remain outside decorative layers.

The authenticated `renovate` callable accepts only `expectedUid`, `targetTier` (2 or 3), and `idempotencyKey` alongside the operation. Shared domain transactions migrate saves, check the bronze grant and prior tier, settle accrual, and debit the server price once. Inventory purchases additionally enforce the required room tier. Schema migration is independent of balance migration; old item ownership grants its required room tier without charge. Storage keys and Firestore paths are unchanged.

The client previews only the next room, retains a request key after network uncertainty, and keeps the old room until new images decode. Failed image loading has a separate retry that never purchases again. All room animation remains illustrative and has no storage writes.

## Verification and release

Run sushi unit tests, Playwright desktop/mobile regressions, backend emulator tests, typecheck, Vite build, and Functions build. Visual checks include three room tiers, owned equipment, decoration previews, cooking/serving/reaction phases and reduced motion. Publish the compatible Functions backend before releasing the client. No production deployment is performed by the local implementation workflow.
