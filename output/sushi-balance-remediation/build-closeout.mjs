import fs from 'node:fs/promises';
import { format } from 'prettier';
import { SUSHI_PROJECTS } from '../../src/course/sushi-game/projects.ts';
import { getGuestStudyDeck } from '../../src/course/sushi-game/study-companion.ts';
const here = new URL('./', import.meta.url);
const formatting = JSON.parse(await fs.readFile(new URL('../../.prettierrc.json', here), 'utf8'));
const economy = JSON.parse(
  await fs.readFile(new URL('../sushi-remedy-economy.json', here), 'utf8'),
);
const receipts = {};
for (const [key, file] of Object.entries({
  unit: 'sushi-remedy-all-unit-tests.txt',
  browser: 'sushi-remedy-e2e-final.log',
  backend: 'sushi-remedy-backend-tests.txt',
  rules: 'sushi-remedy-rules-tests.txt',
  build: 'sushi-remedy-build.log',
  backendBrowser: 'sushi-remedy-backend-browser.log',
  formatting: 'sushi-remedy-format.log',
}))
  receipts[key] = await fs.readFile(new URL('../' + file, here), 'utf8');
if (
  !/pass 394/.test(receipts.unit) ||
  !/fail 0/.test(receipts.unit) ||
  !/102 passed/.test(receipts.browser) ||
  !/Script exited successfully/.test(receipts.backend) ||
  !/pass 10/.test(receipts.rules) ||
  !/fail 0/.test(receipts.rules) ||
  !/built in/.test(receipts.build) ||
  !/3 passed/.test(receipts.backendBrowser) ||
  !/All matched files use Prettier code style/.test(receipts.formatting)
)
  throw Error('A required verification receipt is incomplete.');
const money = (n) => '¥' + Math.round(n).toLocaleString('en-US');
const curriculumDecks = Array.from({ length: 7 }, (_, index) => ({
  chapter: index + 6,
  examples: getGuestStudyDeck(index + 6).length,
}));
const imageData = {};
for (const [key, file] of Object.entries({
  room: '01-project-room.png',
  honors: '02-gold-honors.png',
  practice: '03-chapter-practice.png',
  finale: '04-completion.png',
  mobile: '05-mobile-completion.png',
}))
  imageData[key] =
    'data:image/png;base64,' + (await fs.readFile(new URL(file, here))).toString('base64');
const findings = [
  {
    id: '01',
    title: 'Yen have a visible purpose.',
    before: 'The ¥48,000 catalog was overwhelmed by passive income.',
    after:
      'Four optional, one-time room projects provide ¥2.4m of savings goals. A bookshelf, lantern strand, garden and hanami setting appear permanently when purchased. The core restaurant has an explicit finish after its 21 rewards.',
    proof:
      'Actual service simulations show daily visitors still saving for the final project on day 42; weekly visitors afford all core rewards and two projects. Browser purchase → room change → reload passes. Authenticated backend checks prove server pricing, authorization and exactly-once debit.',
    files: 'projects.ts · domain-service.ts · restaurant-scene.ts · companion-view.ts',
  },
  {
    id: '02',
    title: 'The two empty income steps now pay off.',
    before: 'The knife spent ¥2,400 for 20 → 20; the counter spent ¥5,400 for 40 → 40.',
    after:
      'Knife adds +1 ¥/order; the counter adds +1 ¥/order. The license adds +3, keeping the final rate at 90. Fresh chapter-order income is 20 → 20 → 22 → 44 → 48 → 72 → 90. The storage upgrade improves storage rather than minute income.',
    proof:
      'Domain and browser checks compare preview, actual purchased state and announcement. Generic equal-capacity explanations name the future bottleneck. Legacy license owners retain their purchased benefit; previews explain bonuses already received.',
    files: 'catalog.ts · domain-service.ts · sushi-view.ts',
  },
  {
    id: '03',
    title: 'The first renovation fits a short visit.',
    before: 'A bronze-qualified newcomer needed 30 productive minutes to buy the first upgrade.',
    after:
      'The prep counter costs ¥50 at the unchanged base rate of 10 ¥/min. The first cash target takes five minutes. Bronze eligibility remains required, and the menu explains when restaurant income starts.',
    proof:
      'A zero-yen, bronze-qualified browser fixture advances exactly five minutes, collects ¥50, buys the prep counter, and ends at ¥0 with 20 ¥/min. The same boundary is tested through the real domain service.',
    files: 'catalog.ts · sushi-view.ts · tests/e2e/sushi-balance-remedies.spec.ts',
  },
  {
    id: '04',
    title: 'The register respects daily study rhythms.',
    before: 'An 8h/12h cap rewarded several checks per day and stopped overnight.',
    after:
      'New restaurants store 24h; the chapter-7 purchase stores 48h. Full-register copy says saved income remains safe and invites collection when convenient. Existing saves settle old earnings before adopting the new future rules.',
    proof:
      'Fixed-rate daily and twice-daily collection earn the same total. The modeled route differs by just ¥7,200 because an earlier visit buys the first upgrade earlier. Migration tests verify old capped earnings, discarded stopped time and idempotent future-only changes.',
    files: 'types.ts · domain-service.ts · sushi-view.ts',
  },
  {
    id: '05',
    title: 'Every gold achievement has a permanent home.',
    before: 'Seven gold decorations competed for one wall slot and one floor slot.',
    after:
      'All seven chapter honors appear in their own display as soon as permanent gold grants are earned. They require neither a purchase nor an equipped decoration and survive later practice-score changes. Wall/floor customization remains separate.',
    proof:
      'Domain tests check permanent grants independently of current progress. Browser fixtures show all seven honors with an empty wallet, no inventory and both decor slots empty; they persist after reload.',
    files: 'study-companion.ts · companion-view.ts',
  },
  {
    id: '06',
    title: 'Goals explain their value; guests teach the course.',
    before:
      'A catalog-order checklist mixed cosmetic and production goals. Guests repeated three fixed phrases.',
    after:
      'Separate “Bygg vidare” and “Inred” suggestions consider useful effects, affordability and actual study gates. Guests offer seven chapter-specific recall decks with Japanese, readings, Swedish meaning and the course source. Reveal and next support optional practice.',
    proof:
      'A service-limited restaurant recommends the conveyor ahead of cosmetics; switching goal type changes the suggestion. Browser checks verify selected chapter, source, reveal and next, while course records, grants, inventory and yen remain unchanged.',
    files: 'study-companion.ts · companion-view.ts · sushi-view.ts',
  },
];
const manifest = {
  date: '2026-10-27',
  scope: 'Local checkout remedies; no production deployment',
  baseCommit: '1137913',
  status: 'all six audit findings remedied and verified locally',
  findings: findings.map((f) => ({
    id: f.id,
    title: f.title,
    status: 'verified',
    evidence: f.proof,
    source: f.files,
  })),
  checks: {
    unit: 394,
    browser: 102,
    firestore: 10,
    authenticatedCallable: 'passed',
    realBackendBrowser: 3,
    productionBuild: 'passed',
    repositoryFormatting: 'passed',
  },
  economyPolicy: economy.policy,
  changedDefaults: {
    firstPurchaseYen: 50,
    baseCapHours: 24,
    extendedCapHours: 48,
    finalRateYenPerMinute: 90,
  },
  curriculumDecks,
  evidenceImages: Object.keys(imageData),
};
await fs.writeFile(
  new URL('remediation-evidence.json', here),
  await format(JSON.stringify(manifest), { ...formatting, parser: 'json' }),
);
const cards = findings
  .map(
    (f) =>
      `<article class="finding"><div class="row"><span class="number">${f.id}</span><span class="verified">✓ REMEDIED</span></div><h3>${f.title}</h3><p class="before"><b>Original finding</b> ${f.before}</p><p>${f.after}</p><details><summary>What proves it <span>↗</span></summary><p>${f.proof}</p><small>${f.files}</small></details></article>`,
  )
  .join('');
const cadenceRows = economy.cadences
  .map(
    (c) =>
      `<tr><th>${c.gapHours === 168 ? 'Weekly' : c.gapHours === 24 ? 'Daily' : 'Twice daily'}</th><td>${c.final.inventory} / 21</td><td>${c.final.projects.length} / 4</td><td>${money(c.final.wallet)}</td></tr>`,
  )
  .join('');
const screenshots = [
  [
    'room',
    'The savings goals become part of the room.',
    'All four projects add persistent scenery without consuming the wall/floor slots.',
  ],
  [
    'honors',
    'Seven gold chapters, seven permanent places.',
    'The chapter honor display is independent of cash, purchases and current practice scores.',
  ],
  [
    'practice',
    'The selected chapter and the source agree.',
    'Actual course examples have reveal, next and pronunciation, with no automatic mastery or yen reward.',
  ],
  [
    'finale',
    'The core journey has a proper finish.',
    'Completion is based on the 21 course rewards. Optional projects do not delay it.',
  ],
]
  .map(
    ([key, title, caption]) =>
      `<figure><button type="button" class="image-open" data-image="${key}" aria-label="Inspect screenshot: ${title}"><img src="${imageData[key]}" alt="${title}" loading="lazy"></button><figcaption><b>${title}</b><span>${caption}</span></figcaption></figure>`,
  )
  .join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Sakura Sushi · Audit remedies verified</title><style>
:root{--paper:#faf8ef;--ink:#234638;--muted:#617064;--line:#d9ddcc;--green:#2a624b;--rust:#a65c42;--white:#fffef8}*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:80px}body{margin:0;color:var(--ink);background:var(--paper);font:16px/1.7 'Segoe UI',system-ui,sans-serif}button{font:inherit;cursor:pointer}a{color:inherit;text-underline-offset:4px}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid var(--rust);outline-offset:5px}header{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:17px 4vw;border-bottom:1px solid var(--line);background:#faf8eff7;position:sticky;top:0;z-index:3}header b{font-size:14px}nav{display:flex;gap:24px;font-size:12px}nav a{text-decoration:none}main{max-width:1160px;padding:0 40px;margin:auto}.hero{display:grid;grid-template-columns:1.1fr 1fr;gap:44px;align-items:center;padding:65px 0 40px}.eyebrow{font:11px/1.5 ui-monospace,Consolas,monospace;letter-spacing:1px;text-transform:uppercase;color:var(--muted)}h1{font:normal clamp(42px,5vw,66px)/1.08 Georgia,serif;letter-spacing:-1.8px;margin:18px 0 24px}h1 em{color:var(--rust);font-weight:normal}.deck{color:var(--muted);font-size:18px;line-height:1.7}.status{display:inline-block;background:#e7eedc;border:1px solid #a1b78c;font:11px/1.5 ui-monospace,Consolas,monospace;padding:9px 12px;margin-top:23px}.hero img{width:100%;height:350px;object-fit:cover;object-position:center 53%;border:1px solid #e1d6b9;border-radius:100px 100px 8px 8px;background:#fff4da}.meta{display:flex;flex-wrap:wrap;gap:12px 25px;font:10px/1.6 ui-monospace,Consolas,monospace;color:var(--muted);border-bottom:1px solid var(--line);padding:0 0 24px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:30px 0 35px;background:var(--white)}.metric{padding:23px;border-right:1px solid var(--line)}.metric:last-child{border-right:0}.metric strong{display:block;font:35px/1.2 Georgia,serif;letter-spacing:-1px;margin:8px 0}.metric span{display:block;font-size:12px;color:var(--muted);line-height:1.55}.intro{max-width:890px;font-size:16px;margin-bottom:50px}.intro p{margin:12px 0}.section{border-top:1px solid var(--line);padding:45px 0}.section-heading{display:flex;justify-content:space-between;gap:35px;align-items:end;margin-bottom:25px}.section-heading p{max-width:400px;font-size:14px;color:var(--muted);margin:0}h2{font:34px/1.2 Georgia,serif;letter-spacing:-.6px;margin:8px 0 0}.findings{display:grid;grid-template-columns:1fr 1fr;gap:18px}.finding{padding:26px;border:1px solid var(--line);border-radius:7px;background:var(--white);display:flex;flex-direction:column;gap:14px}.row{display:flex;gap:17px;align-items:center}.number{font:26px Georgia,serif;color:#9aa892}.verified{font:10px ui-monospace,Consolas,monospace;color:var(--green);background:#e9efdf;padding:4px 8px;border-radius:4px}.finding h3{font:26px/1.2 Georgia,serif;letter-spacing:-.4px;margin:0}.finding p{font-size:14px;line-height:1.75;margin:0;color:#4c6152}.finding .before{color:#796b59;font-size:13px;border-left:2px solid #d8b89d;padding-left:12px}.before b{display:block;color:#9a6045;font-size:11px;text-transform:uppercase;letter-spacing:.4px}details{margin-top:auto;border-top:1px solid var(--line);padding-top:13px}summary{font-size:12px;font-weight:600;cursor:pointer;list-style:none}summary span{float:right}details[open] summary{margin-bottom:12px}details small{font:10px/1.8 ui-monospace,Consolas,monospace;color:var(--muted);display:block;margin-top:12px}.evidence-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:22px}.panel{padding:26px;background:var(--white);border:1px solid var(--line);border-radius:7px}.panel h3{font:25px Georgia,serif;margin:6px 0 15px}.panel p,.note{font-size:13px;color:var(--muted);line-height:1.75}.panel p{margin:12px 0}.pills{display:flex;gap:7px;flex-wrap:wrap;margin:20px 0}.pill{border-radius:30px;padding:7px 13px;font-size:12px;border:1px solid #9bb092;background:transparent;color:var(--ink)}.pill[aria-pressed=true]{background:var(--green);color:white;border-color:var(--green)}.large{font:38px/1.2 Georgia,serif;letter-spacing:-1px;margin:12px 0}.goal-label{font-size:14px;font-weight:600}.savings{height:12px;background:#e5e8d9;margin:15px 0 8px;border-radius:4px;overflow:hidden}.savings>div{height:100%;background:var(--green);border-radius:4px}.curve{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:20px 0}.curve b{font:17px ui-monospace,Consolas,monospace;border:1px solid #bac8ab;background:#f1f4e9;padding:8px;border-radius:5px}.curve span{font-size:12px;color:#8a9e7f}.table-wrap{overflow:auto;margin-top:22px}table{width:100%;border-collapse:collapse;font-size:12px;text-align:left;min-width:400px}th,td{padding:12px 10px;border-bottom:1px solid var(--line)}thead{background:#ebefe2;font-size:10px;text-transform:uppercase}tbody th{font-weight:600}.callout{background:var(--ink);color:var(--paper);padding:25px 29px;border-radius:7px;margin-top:24px;display:grid;grid-template-columns:1fr 2fr;gap:35px}.callout strong{font:25px/1.3 Georgia,serif}.callout p{font-size:14px;color:#dce5d8;margin:0}.gallery{display:grid;grid-template-columns:1fr 1fr;gap:25px 20px}figure{margin:0}.image-open{padding:0;border:1px solid #dac8ad;background:#fff6df;width:100%;display:block;border-radius:7px;overflow:hidden}.image-open img{display:block;width:100%;height:335px;object-fit:cover;object-position:center 49%}figcaption{font-size:12px;color:var(--muted);margin-top:12px;line-height:1.65}figcaption b{display:block;color:var(--ink);font-size:14px;margin-bottom:4px}figcaption span{display:block}.checks{display:grid;grid-template-columns:1fr 1fr;gap:22px}.check-list{padding:0;list-style:none;margin:0}.check-list li{padding:12px 0;border-bottom:1px solid var(--line);font-size:13px}.check-list strong{color:var(--green);margin-right:8px}.check-list small{display:block;font-size:11px;margin:4px 0 0 23px;color:var(--muted)}code{font:11px/1.7 ui-monospace,Consolas,monospace;overflow-wrap:anywhere}.release-note{font-size:13px;color:var(--muted);border-left:3px solid #be9773;padding-left:18px;margin:24px 0}.closing{font:29px/1.35 Georgia,serif;max-width:820px;margin:30px 0 5px}.links{font-size:12px;color:var(--muted);line-height:2}.phone{display:grid;grid-template-columns:180px 1fr;gap:25px;align-items:center;margin-top:28px;padding:24px;border:1px solid var(--line);border-radius:7px;background:var(--white)}.phone img{height:290px;width:170px;object-fit:contain;object-position:center}.phone h3{font:25px Georgia,serif;margin:0 0 12px}.phone p{font-size:13px;color:var(--muted)}footer{padding:23px 0 40px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:22px;font:10px ui-monospace,Consolas,monospace;color:var(--muted)}dialog{background:var(--paper);border:1px solid var(--line);border-radius:8px;max-width:95vw;max-height:95vh;padding:17px}dialog::backdrop{background:#183224c9}dialog img{display:block;max-width:89vw;max-height:81vh;object-fit:contain;margin:auto}dialog button{display:block;margin:0 0 12px auto;padding:7px 13px;border:1px solid var(--line);background:var(--white);border-radius:4px;color:var(--ink)}dialog p{font-size:12px;color:var(--muted);margin:10px 0 0}.print{font:10px ui-monospace,Consolas,monospace;background:transparent;border:1px solid var(--line);color:var(--ink);padding:5px 10px;border-radius:4px}@media(max-width:750px){main{padding:0 21px}.hero{grid-template-columns:1fr;gap:27px;padding-top:40px}.hero img{height:280px}h1{font-size:49px}.metrics{grid-template-columns:1fr 1fr}.metric{border-bottom:1px solid var(--line)}.metric:nth-child(2){border-right:0}.metric:nth-child(n+3){border-bottom:0}.findings,.evidence-grid,.checks{grid-template-columns:1fr}.section-heading{display:block}.section-heading p{max-width:none;margin-top:15px}.callout{grid-template-columns:1fr;gap:14px}.gallery .image-open img{height:260px}.hero .deck{font-size:16px}header{padding:14px 20px}nav{gap:12px;font-size:11px}.phone{grid-template-columns:140px 1fr;padding:16px;gap:16px}.phone img{width:130px;height:245px}.phone h3{font-size:22px}footer{display:block;line-height:2}.print{margin-top:12px}}@media(max-width:480px){.gallery{grid-template-columns:1fr}.image-open img{height:310px!important}.phone{display:block}.phone img{margin:auto;display:block;width:170px;height:290px}.phone h3{margin-top:20px}.finding{padding:23px}.section{padding:35px 0}.metric{padding:18px}.metric strong{font-size:31px}.closing{font-size:25px}nav a:last-child{display:none}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{header{position:static}nav,.pills,.print{display:none}main{padding:0}.hero{padding:25px 0}.hero img{height:280px}h1{font-size:43px}.section{padding:28px 0}.finding,.panel,figure,.phone,.callout{break-inside:avoid}.finding{padding:17px;gap:10px}.finding h3{font-size:22px}.finding p{font-size:11px}.metrics{margin:20px 0}.metric{padding:15px}.metric strong{font-size:27px}.gallery img{height:260px}body{font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}a{text-decoration:none}}
</style></head><body><header><b>Sakura Sushi / Audit remedies</b><nav aria-label="Report navigation"><a href="#findings">Six findings</a><a href="#balance">Balance</a><a href="#proof">Evidence</a></nav></header><main>
<section class="hero"><div><div class="eyebrow">Balance version 2 · A finite study companion</div><h1>A clearer reward loop.<br><em>A place for the journey.</em></h1><p class="deck">All six findings from the Sakura Sushi game balance audit have been addressed in the local game and checked against their original symptoms.</p><span class="status">6 / 6 FINDINGS REMEDIED · VERIFIED LOCALLY</span></div><img src="${imageData.room}" alt="Sakura Sushi with its new reading nook, lantern strand, garden and hanami project scenery"></section>
<div class="meta"><span>27 OCTOBER 2026 · EUROPE/STOCKHOLM</span><span>BASE 1137913 + LOCAL CHANGES</span><span>BUILD + DOMAIN + EMULATORS + DESKTOP/MOBILE</span><span>NO PRODUCTION DEPLOYMENT</span></div>
<div class="metrics"><div class="metric"><div class="eyebrow">First cash target</div><strong>5 min</strong><span>¥50 at the unchanged base rate; bronze eligibility still applies</span></div><div class="metric"><div class="eyebrow">Storage grace</div><strong>24 / 48h</strong><span>Daily checking fits the base cap; the upgrade covers two days</span></div><div class="metric"><div class="eyebrow">Gold achievements</div><strong>7 / 7</strong><span>Permanent honors, independent of the two decor slots</span></div><div class="metric"><div class="eyebrow">Optional savings</div><strong>¥2.4m</strong><span>Four finite projects with visible changes to the room</span></div></div>
<div class="intro"><p>The game now follows its study-companion purpose more consistently: useful chapter rewards, separate growth and decoration goals, and a clear finish. Yen can fund bigger ideas without adding another requirement to completing the course restaurant.</p><p>Exact accounting, permanent medal grants and the existing 60/80/100 study thresholds remain intact. Existing restaurants migrate prospectively, keeping already-earned money and purchased benefits.</p></div>
<section class="section" id="findings"><div class="section-heading"><div><div class="eyebrow">01 / Closure against the original audit</div><h2>Every finding has a remedy and proof.</h2></div><p>The original audit is preserved. These are implemented changes, with domain checks and rendered interaction evidence behind each closure.</p></div><div class="findings">${cards}</div></section>
<section class="section" id="balance"><div class="section-heading"><div><div class="eyebrow">02 / Re-run the same scenarios</div><h2>Useful savings, a reachable core.</h2></div><p>Start at zero. A chapter’s three grants become eligible every seven days, through day 42. Each visit collects, buys core rewards, then considers optional projects in order.</p></div><div class="evidence-grid"><div class="panel"><div class="eyebrow">Actual domain-service simulation</div><h3>What remains to save for?</h3><div class="pills" role="group" aria-label="Collection schedule"><button class="pill" data-cadence="168" aria-pressed="false">Weekly</button><button class="pill" data-cadence="24" aria-pressed="true">Daily</button><button class="pill" data-cadence="12" aria-pressed="false">Twice daily</button></div><div class="large" id="wallet">¥1,435,930</div><div class="goal-label" id="saving-for">Toward Hanamifest · ¥1,620,000</div><div class="savings"><div id="saving-bar" style="width:88.6%"></div></div><div class="note" id="saving-note" aria-live="polite">21 core rewards and 3 projects owned · ¥184,070 still to save</div><div class="table-wrap"><table><thead><tr><th>Visit rhythm</th><th>Core owned</th><th>Projects built</th><th>Unspent yen</th></tr></thead><tbody>${cadenceRows}</tbody></table></div><p>The remaining money is a budget toward the next visible project. The goal is a finite, generous game with meaningful optional choices, rather than an endlessly empty wallet.</p></div><div class="panel"><div class="eyebrow">Expected chapter order</div><h3>The income curve has useful steps.</h3><div class="curve" aria-label="20,20,22,44,48,72,90 yen per minute"><b>20</b><span>→</span><b>20</b><span>→</span><b>22</b><span>→</span><b>44</b><span>→</span><b>48</b><span>→</span><b>72</b><span>→</span><b>90</b></div><p>Chapters 6 → 12. The knife and counter now improve income immediately on the expected route. Chapter 7 improves storage time. The final maximum stays at 90 ¥/min.</p><p>Legacy license benefits are preserved through a revenue floor. A previously bought +5 license can absorb the new +1 bonuses; its preview explains why those points have already been received.</p><p>At a fixed rate, daily and twice-daily collections now earn the same total. The modeled ¥7,200 difference comes from buying the first upgrade earlier, rather than an overnight cap penalty.</p><p>These scenarios establish the new pacing mechanics. Student satisfaction and long-term learning effects still require student playtesting.</p></div></div><div class="callout"><strong>The 21 course rewards remain the finish line.</strong><p>Every modeled cadence completes the core restaurant by day 42. Weekly visitors also build two optional projects; daily visitors build three and still have a real savings target. Projects never block honors, guest practice, or the completion celebration.</p></div></section>
<section class="section" id="proof"><div class="section-heading"><div><div class="eyebrow">03 / The current game</div><h2>What the remedies look like.</h2></div><p>Current local captures. Inspect any screenshot at full resolution. The automated browser checks also exercise purchase, reload, reveal, next, keyboard focus and return to study.</p></div><div class="gallery">${screenshots}</div><div class="phone"><img src="${imageData.mobile}" alt="Mobile WebKit completion ceremony with keyboard focus on the continue button"><div><h3>Verified on a phone-sized browser too.</h3><p>Desktop Chromium and mobile WebKit both pass the new remedy journeys. The compact layout keeps goal controls accessible beside unlock notices; the completion dialog supports keyboard focus and scrolls on shorter screens.</p><p class="note">This capture comes from the mobile keyboard-focus test. Its inner panel has scrolled to keep the focused button visible.</p></div></div></section>
<section class="section"><div class="section-heading"><div><div class="eyebrow">04 / Verification and handoff</div><h2>The checks behind the judgment.</h2></div><p>Verification covers both the new behavior and existing study/game flows. Saved receipts and the reproducible economic ledger accompany this report.</p></div><div class="checks"><div class="panel"><ul class="check-list"><li><strong>✓</strong>394 unit checks passed<small>Economy, migrations, projects, goals, honors, course data and existing application behavior.</small></li><li><strong>✓</strong>102 browser checks passed<small>Desktop Chromium and mobile WebKit, including 16 new audit-remedy journeys.</small></li><li><strong>✓</strong>10 Firestore rules/repository checks passed<small>Authenticated access and server-only mutation boundaries preserved.</small></li><li><strong>✓</strong>Authenticated callable integration passed<small>Server pricing, cross-account rejection, project concurrency and persisted legacy-save migration.</small></li><li><strong>✓</strong>Production build and typechecks passed<small>Sushi remains deferred until the game is opened.</small></li></ul></div><div class="panel"><h3>Reproducible evidence</h3><p><code>NODE_ENV=test node --test --test-isolation=none tests/*.test.ts</code><br><code>npm run test:e2e</code><br><code>npm run test:backend</code><br><code>npm run test:rules</code><br><code>npm run build</code></p><p class="links"><a href="../sushi-remedy-all-unit-tests.txt">Unit receipt</a> · <a href="../sushi-remedy-e2e-final.log">Browser receipt</a> · <a href="../sushi-remedy-backend-tests.txt">Callable receipt</a> · <a href="../sushi-remedy-rules-tests.txt">Rules receipt</a> · <a href="../sushi-remedy-build.log">Build receipt</a><br><a href="../sushi-remedy-economy.json">Full economic ledger</a> · <a href="../sushi-remedy-economy.mjs">Simulation source</a> · <a href="remediation-evidence.json">Finding-by-finding evidence manifest</a><br><a href="../../docs/sushi-game/economy-balance-model.md">Current balance specification</a> · <a href="../sushi-balance-audit-2026-10-27/sushi-balance-audit.html">Original audit</a></p></div></div><p class="release-note">These remedies are implemented and verified in the local checkout. No production deployment has been performed. The original study trust model and scoring are unchanged; this report does not claim measured retention or learning improvements.</p><p class="closing">The original six findings are remedied locally. The restaurant now rewards progress, makes room for achievement, and gives its course journey a satisfying place to finish.</p></section>
<footer><span>Sakura Sushi / Balance audit remedies / 27 October 2026</span><span>6 findings · 394 unit checks · 102 browser checks</span><button type="button" class="print" id="print">Print / Save PDF</button></footer></main><dialog id="viewer" aria-label="Screenshot evidence"><button type="button" id="close-viewer">Close image ×</button><img id="viewer-image" alt=""><p id="viewer-caption"></p></dialog><script>
const DATA=${JSON.stringify({ cadences: economy.cadences, projects: SUSHI_PROJECTS }).replaceAll('<', '\\u003c')};const IMAGES=${JSON.stringify(imageData).replaceAll('<', '\\u003c')};const fmt=n=>'¥'+Math.round(n).toLocaleString('en-US');function choose(gap){const s=DATA.cadences.find(c=>c.gapHours===gap).final;const target=DATA.projects.find(p=>!s.projects.includes(p.id));document.getElementById('wallet').textContent=fmt(s.wallet);document.getElementById('saving-for').textContent=target?'Toward '+target.name+' · '+fmt(target.priceYen):'All optional projects built';document.getElementById('saving-bar').style.width=target?Math.min(100,s.wallet/target.priceYen*100)+'%':'100%';document.getElementById('saving-note').textContent=s.inventory+' core rewards and '+s.projects.length+' projects owned'+(target?' · '+fmt(Math.max(0,target.priceYen-s.wallet))+' still to save':'');document.querySelectorAll('[data-cadence]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.cadence)===gap)));}document.querySelectorAll('[data-cadence]').forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.cadence))));document.querySelectorAll('[data-image]').forEach(b=>b.addEventListener('click',()=>{const img=b.querySelector('img');document.getElementById('viewer-image').src=IMAGES[b.dataset.image];document.getElementById('viewer-image').alt=img.alt;document.getElementById('viewer-caption').textContent=img.alt;document.getElementById('viewer').showModal();}));document.getElementById('close-viewer').addEventListener('click',()=>document.getElementById('viewer').close());document.getElementById('print').addEventListener('click',()=>window.print());choose(24);
</script></body></html>`;
const reportHtml = html
  .replace('</style>', '.panel{min-width:0}.table-wrap{max-width:100%}</style>')
  .replace('NODE_ENV=test node --test --test-isolation=none tests/*.test.ts', 'npm test')
  .replace(
    '<footer>',
    '<p class="note">The remaining required workflow checks also pass: <a href="../sushi-remedy-backend-browser.log">3 real-backend browser journeys</a>, including persistent project purchases at 390px and 1280px, and <a href="../sushi-remedy-format.log">the full repository formatting check</a>.</p><footer>',
  );
await fs.writeFile(
  new URL('sakura-sushi-remedied.html', here),
  await format(reportHtml, { ...formatting, parser: 'html' }),
);
console.log(
  'Built verified closeout: six finding closures, live cadence controls, screenshots and evidence manifest.',
);
