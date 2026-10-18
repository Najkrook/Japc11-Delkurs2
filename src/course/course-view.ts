import { html } from 'lit-html';
import type { CourseHostContext, CourseSubView, CourseTemplate } from './types.ts';
import { courseWeeks, getCourseWeekById } from './data/index.ts';
import { getWeekProgressSummary } from './course-state.ts';
import { studyDrills } from './study-drills.ts';
import { createCourseProgress } from './course-progress.ts';
import { renderTeFormDojo } from './components/te-form-dojo.ts';
import {
  renderGrammarModule,
  renderKanjiModule,
  renderVocabModule,
} from './components/flashcard-deck.ts';
import { renderWeekQuizModule } from './components/week-quiz.ts';
import { renderCourseArenaModule } from './components/course-arena.ts';
import { courseProgressPersistence } from '../cloud.ts';

export const courseProgress = createCourseProgress(courseProgressPersistence, studyDrills.reset);

export function selectCourseWeek(weekId: string, host?: CourseHostContext): void {
  courseProgress.update({ type: 'week', weekId });
  host?.render();
}

export function selectCourseSubView(subView: CourseSubView, host?: CourseHostContext): void {
  courseProgress.update({ type: 'subview', subView });
  host?.render();
}

export function renderCourseShell(host: CourseHostContext): CourseTemplate {
  const progress = courseProgress.snapshot();
  const week = getCourseWeekById(progress.activeWeekId);
  const summary = getWeekProgressSummary(progress, week);
  const subView = progress.activeSubView;

  const goHub = () => selectCourseSubView('hub', host);

  return html`
    <div class="course-app-shell" data-course-theme=${host.theme}>
      <!-- ================= TOP APP BAR (Alternativ 2 Layout + Mashup Palette) ================= -->
      <header class="course-topbar">
        <div class="course-topbar-inner">
          <div class="course-topbar-left">
            <button
              type="button"
              class="course-brand-btn"
              @click=${goHub}
              title="Gå till veckoöversikten"
            >
              <span class="course-brand-glyph" lang="ja">語</span>
              <span class="course-brand-text">
                <strong>JAPC11 · Delkurs 2</strong>
                <small>GENKI I · LEKTION 6–9</small>
              </span>
            </button>
          </div>

          <nav class="course-top-nav" aria-label="Kursplugg snabblänkar">
            <button
              type="button"
              class="course-top-link ${subView === 'hub' ? 'active' : ''}"
              @click=${goHub}
            >
              Översikt
            </button>
            <button
              type="button"
              class="course-top-link ${subView === 'vocab' ? 'active' : ''}"
              @click=${() => selectCourseSubView('vocab', host)}
            >
              Glosor
            </button>
            <button
              type="button"
              class="course-top-link ${subView === 'dojo' ? 'active' : ''}"
              @click=${() => selectCourseSubView('dojo', host)}
            >
              て-form Dojo
            </button>
            <button
              type="button"
              class="course-top-link ${subView === 'grammar' ? 'active' : ''}"
              @click=${() => selectCourseSubView('grammar', host)}
            >
              Grammatikregler
            </button>
            <button
              type="button"
              class="course-top-link ${subView === 'kanji' ? 'active' : ''}"
              @click=${() => selectCourseSubView('kanji', host)}
            >
              Kanji
            </button>
            <button
              type="button"
              class="course-top-link ${subView === 'quiz' ? 'active' : ''}"
              @click=${() => selectCourseSubView('quiz', host)}
            >
              Tentafokus
            </button>
            <button
              type="button"
              class="course-top-link arena-nav-pill ${subView === 'arena' ? 'active' : ''}"
              data-course-nav="arena"
              @click=${() => selectCourseSubView('arena', host)}
            >
              ⚔️ Kurs-Arena
            </button>
          </nav>

          <div class="course-topbar-right">
            <button
              type="button"
              class="course-icon-btn"
              @click=${() => host.toggleTheme()}
              title=${
                host.theme === 'sakura'
                  ? 'Växla till Washi & Matcha-tema'
                  : 'Slå på Sakura / Kawaii-tema'
              }
            >
              ${host.theme === 'sakura' ? '🍵 Washi' : '🌸 Sakura'}
            </button>

            <button
              type="button"
              class="course-account-btn"
              ?disabled=${host.authBusy}
              @click=${host.account}
            >
              ${host.user ? `👤 ${host.user.displayName || 'Konto'}` : 'Logga in'}
            </button>
          </div>
        </div>
      </header>

      <!-- ================= MAIN WORKSPACE WITH LEFT SIDEBAR (Alternativ 2) ================= -->
      <div class="course-workspace-grid">
        <aside class="course-sidebar" aria-label="Kursmeny och veckoplan">
          <div class="course-sidebar-top">
            <div class="course-sidebar-brand">
              <div class="course-sidebar-crest" lang="ja">語</div>
              <div>
                <strong>JAPC11 · Delkurs 2</strong>
                <span>Genki I · Lektion 6–9</span>
              </div>
            </div>

            <!-- View Switcher Pill Tray (Veckoöversikt vs Kurs-Arena) -->
            <div
              class="course-mode-switcher"
              role="group"
              aria-label="Växla mellan Studieplan och Kurs-Arena"
            >
              <button
                type="button"
                class="mode-switch-pill ${subView !== 'arena' ? 'active' : ''}"
                @click=${goHub}
              >
                <span class="mode-dot"></span>
                Studieplan
              </button>
              <button
                type="button"
                class="mode-switch-pill ${subView === 'arena' ? 'active' : ''}"
                @click=${() => selectCourseSubView('arena', host)}
              >
                ⚔️ Arena
              </button>
            </div>

            <div class="course-sidebar-section-label">STUDIEPLAN · 4 VECKOR</div>

            <!-- Vertical Navigation Timeline (Roadmap) -->
            <div class="course-week-ribbon" role="tablist" aria-label="Välj kursvecka">
              ${courseWeeks.map((w) => {
                const wSum = getWeekProgressSummary(progress, w);
                const isActive = w.id === week.id;
                const shortTitle = w.titleSv.includes(':')
                  ? w.titleSv.split(':')[1].trim()
                  : w.titleSv.includes('—')
                    ? w.titleSv.split('—')[1].trim()
                    : `Lektion ${w.lessonNumber}`;
                return html`
                  <button
                    type="button"
                    role="tab"
                    aria-selected=${isActive ? 'true' : 'false'}
                    class="course-week-tab ${isActive ? 'active' : ''} ${w.isPreview ? 'preview' : ''}"
                    @click=${() => {
                      selectCourseWeek(w.id, host);
                      if (subView === 'arena') selectCourseSubView('hub', host);
                    }}
                  >
                    <div class="week-tab-row">
                      <span class="week-tab-indicator ${isActive ? 'active' : ''}">
                        ${isActive ? '◉' : w.isPreview ? '🔒' : '○'}
                      </span>
                      <div class="week-tab-body">
                        <div class="week-tab-head">
                          <strong class="week-tab-title">
                            Vecka ${w.weekNumber} · Lektion ${w.lessonNumber}
                          </strong>
                          <span class="week-tab-pct">${wSum.overallPercent}%</span>
                        </div>
                        <span class="week-tab-sub">${shortTitle}</span>
                        <div class="week-tab-bar">
                          <span style="width: ${wSum.overallPercent}%"></span>
                        </div>
                      </div>
                    </div>
                  </button>
                `;
              })}
            </div>
          </div>

          <!-- Bottom Sticky Section: Multiplayer Arena & Quick Links -->
          <div class="course-sidebar-bottom">
            <div class="course-sidebar-arena-card">
              <div class="sidebar-arena-meta">
                <span class="live-pill">
                  <span class="live-dot"></span>
                  Live Utmaning
                </span>
                <span class="bot-count">3 studie-bots redo</span>
              </div>
              <h3>⚔️ Kurs-Arena (Multiplayer)</h3>
              <p>Tävla i snabb verbböjning & glosor (Lektion 6–9) i realtid.</p>
              <button
                type="button"
                class="course-sidebar-arena-btn"
                @click=${() => selectCourseSubView('arena', host)}
              >
                Gå med i Arenan →
              </button>
            </div>

            <div class="course-sidebar-links">
              <button
                type="button"
                class="course-sidebar-link"
                @click=${() => selectCourseSubView('grammar', host)}
              >
                📖 Ordbok & Grammatikreferens
              </button>
              <button
                type="button"
                class="course-sidebar-link"
                @click=${() => selectCourseSubView('quiz', host)}
              >
                🏁 Veckotest & Tentafokus
              </button>
            </div>
          </div>
        </aside>

        <!-- ================= MAIN WORK AREA (Canvas) ================= -->
        <main class="course-main-container" id="main">
          ${
            subView === 'hub'
              ? renderWeekBentoHub(week, summary, host)
              : subView === 'vocab'
                ? renderVocabModule(week, progress, host, courseProgress.update, goHub)
                : subView === 'dojo'
                  ? renderTeFormDojo(week, progress, host, courseProgress.update, goHub)
                  : subView === 'grammar'
                    ? renderGrammarModule(
                        week,
                        host,
                        () => selectCourseSubView('dojo', host),
                        goHub,
                      )
                    : subView === 'kanji'
                      ? renderKanjiModule(week, progress, host, courseProgress.update, goHub)
                      : subView === 'arena'
                        ? renderCourseArenaModule(host, goHub)
                        : renderWeekQuizModule(week, progress, host, courseProgress.update, goHub)
          }
        </main>
      </div>

      <footer class="course-footer">
        <span>${host.status} · JAPC11 Delkurs 2 (Genki I Lektion 6–9)</span>
        <div class="course-footer-links">
          <button
            type="button"
            class="course-text-link"
            @click=${() => selectCourseSubView('arena', host)}
          >
            ⚔️ Kurs-Arena (Multiplayer L6–L9)
          </button>
          <button
            type="button"
            class="course-text-link"
            @click=${() => selectCourseSubView('dojo', host)}
          >
            🥋 て-form Dojo
          </button>
        </div>
      </footer>
    </div>
  `;
}

interface HeroGroupCard {
  tone: 'tone-mint' | 'tone-terracotta' | 'tone-sand' | 'tone-sage';
  metaLabel: string;
  badgeText: string;
  badgeKind: 'ok' | 'warn' | 'neutral';
  fromJp: string;
  toJp: string;
  warnArrow?: boolean;
  romajiLine: string;
  ruleHtml: CourseTemplate;
}

function getHeroDojoConfig(week: ReturnType<typeof getCourseWeekById>): {
  watermark: string;
  heading: string;
  description: string;
  sectionLabel: string;
  exampleLabel: string;
  exampleJp: string;
  exampleSv: string;
  cards: HeroGroupCard[];
} {
  const firstGrammarEx = week.grammar[0]?.examples[0];

  if (week.lessonNumber === 7) {
    return {
      watermark: 'て',
      heading: 'て-form Dojo — Pågående handling & Tillstånd (～ています)',
      description:
        'I Lektion 7 använder vi て-formen tillsammans med います för pågående aktiviteter (食べています) och resulterande tillstånd (結婚しています, 知っています) samt klädesverb.',
      sectionLabel: '4 NYCKELMÖNSTER FÖR VERB I LEKTION 7',
      exampleLabel: 'Exempelmening ur Lektion 7 (Mönster: ～ています & Klädesverb)',
      exampleJp: firstGrammarEx ? `「${firstGrammarEx.jp}」` : '「今、友だちを待っています。」',
      exampleSv: firstGrammarEx
        ? `Svenska: "${firstGrammarEx.sv}"`
        : 'Svenska: "Jag väntar på en vän just nu."',
      cards: [
        {
          tone: 'tone-mint',
          metaLabel: 'Pågående (U-verb)',
          badgeText: '✓ Aktivitet',
          badgeKind: 'ok',
          fromJp: '歌う',
          toJp: '歌っています',
          romajiLine: 'utau ➔ utatte imasu ("sjunger")',
          ruleHtml: html`Regel: <strong>う → って</strong> + います (pågår nu)`,
        },
        {
          tone: 'tone-terracotta',
          metaLabel: 'Fälla: 知る (U-verb!)',
          badgeText: 'Varning',
          badgeKind: 'warn',
          fromJp: '知る',
          toJp: '知っています',
          warnArrow: true,
          romajiLine: 'shiru ➔ shitte imasu ("vet / känner till")',
          ruleHtml: html`OBS! Nekande är <strong>知りません</strong> (ej 知っていません)!`,
        },
        {
          tone: 'tone-sand',
          metaLabel: 'Klädesverb (Överkropp)',
          badgeText: 'Ru-verb',
          badgeKind: 'neutral',
          fromJp: '着る',
          toJp: '着ています',
          romajiLine: 'kiru ➔ kite imasu ("har på sig")',
          ruleHtml: html`Överkropp: <strong>着る</strong> · Underkropp/skor:
            <strong>履く (履いて)</strong>`,
        },
        {
          tone: 'tone-sage',
          metaLabel: 'Tillstånd & Boende',
          badgeText: '★ Resultat',
          badgeKind: 'ok',
          fromJp: '住む',
          toJp: '住んでいます',
          romajiLine: 'sumu ➔ sunde imasu ("bor i...")',
          ruleHtml: html`Plats markeras med <strong>に</strong> (ルンドに住んでいます).`,
        },
      ],
    };
  }

  if (week.lessonNumber === 8) {
    return {
      watermark: 'ない',
      heading: 'て-form & Kortform Dojo — Nutid & Nekande (ない-form)',
      description:
        'I Lektion 8 kombinerar vi て-form med japanskans kortform (普通形) i nutid — särskilt nekande ない-form för att uttrycka åsikter (～と思います) och ～ないでください.',
      sectionLabel: 'DE 4 BÖJNINGSGRUPPERNA I LEKTION 8 (て-FORM & ない-FORM)',
      exampleLabel: 'Exempelmening ur Lektion 8 (Mönster: [Kortform] + と思います)',
      exampleJp: firstGrammarEx ? `「${firstGrammarEx.jp}」` : '「明日、雨が降らないと思います。」',
      exampleSv: firstGrammarEx
        ? `Svenska: "${firstGrammarEx.sv}"`
        : 'Svenska: "Jag tror inte att det kommer att regna imorgon."',
      cards: [
        {
          tone: 'tone-mint',
          metaLabel: 'Ru-verb (る)',
          badgeText: '✓ Grundregel',
          badgeKind: 'ok',
          fromJp: '捨てる',
          toJp: '捨てて・捨てない',
          romajiLine: 'suteru ➔ sutete / sutenai ("slänga")',
          ruleHtml: html`Regel: Byt <strong>る</strong> mot <strong>て</strong> eller
            <strong>ない</strong>`,
        },
        {
          tone: 'tone-terracotta',
          metaLabel: 'Fälla: U-verb på う',
          badgeText: 'う → わない',
          badgeKind: 'warn',
          fromJp: '思う',
          toJp: '思って・思わない',
          warnArrow: true,
          romajiLine: 'omou ➔ omotte / omowanai ("tycka/tro")',
          ruleHtml: html`OBS! Slutar på う → <strong>わない</strong> (ej おもあない)!`,
        },
        {
          tone: 'tone-sand',
          metaLabel: 'U-verb (-u → -aない)',
          badgeText: 'Vokalbyte',
          badgeKind: 'neutral',
          fromJp: '着く',
          toJp: '着いて・着かない',
          romajiLine: 'tsuku ➔ tsuite / tsukanai ("anlända")',
          ruleHtml: html`く blir <strong>いて</strong> i て-form och <strong>かない</strong> i
            ない-form`,
        },
        {
          tone: 'tone-sage',
          metaLabel: 'Undantag: ある & する',
          badgeText: '★ Centralt',
          badgeKind: 'ok',
          fromJp: 'ある',
          toJp: 'あって・ない',
          romajiLine: 'aru ➔ nai / suru ➔ shinai / kuru ➔ konai',
          ruleHtml: html`Nekande kortform av <strong>ある</strong> är bara <strong>ない</strong>!`,
        },
      ],
    };
  }

  if (week.lessonNumber === 9) {
    return {
      watermark: 'た',
      heading: 'て-form & Dåtid Dojo — Kortform i dåtid (た-form)',
      description:
        'Kan du て-formen kan du redan た-formen! I Lektion 9 byter vi bara て/で mot た/だ (買って → 買った, 読んで → 読んだ) för att bilda dåtid i kortform och bisatser.',
      sectionLabel: 'DE 4 BÖJNINGSGRUPPERNA I LEKTION 9 (て-FORM ➔ た-FORM)',
      exampleLabel: 'Exempelmening ur Lektion 9 (Mönster: Dåtid i kortform & Bisatser)',
      exampleJp: firstGrammarEx
        ? `「${firstGrammarEx.jp}」`
        : '「昨日の試験は難しくなかったと思います。」',
      exampleSv: firstGrammarEx
        ? `Svenska: "${firstGrammarEx.sv}"`
        : 'Svenska: "Jag tyckte inte att gårdagens prov var svårt."',
      cards: [
        {
          tone: 'tone-mint',
          metaLabel: 'U-verb: う・つ・る',
          badgeText: 'って ➔ った',
          badgeKind: 'ok',
          fromJp: '踊る',
          toJp: '踊って・踊った',
          romajiLine: 'odoru ➔ odotte / odotta ("dansa")',
          ruleHtml: html`Exakt samma ljudregel: <strong>って</strong> blir <strong>った</strong>!`,
        },
        {
          tone: 'tone-terracotta',
          metaLabel: 'Nekande dåtid',
          badgeText: 'ない ➔ なかった',
          badgeKind: 'warn',
          fromJp: '買わない',
          toJp: '買わなかった',
          warnArrow: true,
          romajiLine: 'kawanai ➔ kawanakatta ("köpte inte")',
          ruleHtml: html`Byt sista <strong>い</strong> i ない mot <strong>かった</strong>!`,
        },
        {
          tone: 'tone-sand',
          metaLabel: 'U-verb: く / ぐ & む / ぶ',
          badgeText: 'いて ➔ いた',
          badgeKind: 'neutral',
          fromJp: '聞く',
          toJp: '聞いて・聞いた',
          romajiLine: 'kiku ➔ kiite / kiita ("lyssna/fråga")',
          ruleHtml: html`<strong>いて → いた</strong> och tonande <strong>んで → んだ</strong>`,
        },
        {
          tone: 'tone-sage',
          metaLabel: 'Ru-verb i bisats',
          badgeText: '★ Bisatser',
          badgeKind: 'ok',
          fromJp: '覚える',
          toJp: '覚えて・覚えた',
          romajiLine: 'oboeru ➔ oboete / oboeta ("memorera")',
          ruleHtml: html`Används framför substantiv: <strong>今日覚えた単語</strong>`,
        },
      ],
    };
  }

  return {
    watermark: 'て',
    heading: 'て-form Dojo — Böjningsregler & Snabbträning',
    description:
      'Te-formen är nyckeln till att koppla ihop meningar, be om tillåtelse (〜てもいいですか) och uttrycka pågående handlingar (〜ています). Träna de fyra huvudsakliga böjningsmönstren steg för steg.',
    sectionLabel: `DE 4 BÖJNINGSGRUPPERNA I LEKTION ${week.lessonNumber}`,
    exampleLabel: 'Exempelmening ur kapitlet (Mönster: Handling A + Handling B)',
    exampleJp: '「図書館に行って、本を借ります。」',
    exampleSv: 'Svenska: "Jag går till biblioteket och (sedan) lånar en bok."',
    cards: [
      {
        tone: 'tone-mint',
        metaLabel: 'Ru-verb (る)',
        badgeText: '✓ Grundregel',
        badgeKind: 'ok',
        fromJp: '食べる',
        toJp: '食べて',
        romajiLine: 'taberu ➔ tabete ("att äta")',
        ruleHtml: html`Regel: Byt ut <strong>る</strong> direkt mot <strong>て</strong>`,
      },
      {
        tone: 'tone-terracotta',
        metaLabel: 'Undantag: 行く',
        badgeText: 'Varning',
        badgeKind: 'warn',
        fromJp: '行く',
        toJp: '行って',
        warnArrow: true,
        romajiLine: 'iku ➔ itte ("att gå / åka")',
        ruleHtml: html`OBS! Blir <strong>ej iite</strong>. Dubbelkonsonant <strong>って</strong>!`,
      },
      {
        tone: 'tone-sand',
        metaLabel: 'U-verb: む / ぶ / ぬ',
        badgeText: 'Assimilation',
        badgeKind: 'neutral',
        fromJp: '飲む',
        toJp: '飲んで',
        romajiLine: 'nomu ➔ nonde ("att dricka")',
        ruleHtml: html`Regel: <strong>む / ぶ / ぬ</strong> blir tonande <strong>んで</strong>`,
      },
      {
        tone: 'tone-sage',
        metaLabel: 'Oregelbundna verb',
        badgeText: '★ Centralt',
        badgeKind: 'ok',
        fromJp: 'する',
        toJp: 'して',
        romajiLine: 'suru ➔ shite / くる ➔ きて',
        ruleHtml: html`Måste memoreras utantill inför tentan.`,
      },
    ],
  };
}

function renderWeekBentoHub(
  week: ReturnType<typeof getCourseWeekById>,
  summary: ReturnType<typeof getWeekProgressSummary>,
  host: CourseHostContext,
): CourseTemplate {
  const previewVocab = week.vocab[0];
  const nextQueue = week.vocab.slice(1, 4);
  const topKanji = week.kanji.slice(0, 4);
  const firstKanji = week.kanji[0];
  const heroConfig = getHeroDojoConfig(week);

  const teFormCount = week.quiz.filter((q) => q.category === 'te-form').length;
  const grammarCount = week.quiz.filter((q) => q.category === 'grammar').length;
  const vocabKanjiCount = week.quiz.filter(
    (q) => q.category === 'vocab' || q.category === 'kanji',
  ).length;

  return html`
    <!-- ================= TOP EDITORIAL HEADER & STUDY STATS BAR ================= -->
    <section class="course-editorial-header">
      <div class="course-breadcrumb-row">
        <div class="course-breadcrumbs">
          <span>Universitetskurs: Japanska I</span>
          <span class="sep">/</span>
          <span>Vecka ${week.weekNumber} av 4</span>
          <span class="sep">/</span>
          <strong class="crumb-current">Genki I Kapitel ${week.lessonNumber}</strong>
          ${
            week.isPreview
              ? html`<span class="course-badge-preview">Förhandsvisning + Basövningar</span>`
              : ''
          }
        </div>

        <div class="course-quick-pill-bar">
          <span class="course-badge-jp" lang="ja">${week.subtitleJp}</span>
          ${
            host.tts && previewVocab
              ? html`
                  <button
                    type="button"
                    class="course-pill-icon-btn"
                    title="Lyssna på veckans nyckelord"
                    @click=${(e: Event) =>
                      host.speak(previewVocab.kana, e.currentTarget as HTMLElement)}
                  >
                    🔊 Uttal: PÅ
                  </button>
                `
              : ''
          }
        </div>
      </div>

      <h1 class="course-editorial-title" tabindex="-1">${week.titleSv}</h1>
      <p class="course-hero-desc">${week.themeDescriptionSv}</p>

      <!-- 3-Column Study Summary Stats Bar (Alternativ 2) -->
      <div class="course-stats-bar">
        <div class="course-stat-cell">
          <div class="stat-icon sage">📚</div>
          <div>
            <span class="stat-label">Bemästrade glosor</span>
            <strong class="stat-value">
              ${summary.vocabDone} / ${summary.vocabTotal} st
              <small
                >(${Math.round((summary.vocabDone / Math.max(1, summary.vocabTotal)) * 100)}%)</small
              >
            </strong>
          </div>
        </div>

        <div class="course-stat-cell">
          <div class="stat-icon terracotta">🔥</div>
          <div>
            <span class="stat-label">Verb & て-form Dojo</span>
            <strong class="stat-value terracotta-text">
              ${summary.dojoDone} / ${summary.dojoTotal} verb klara
            </strong>
          </div>
        </div>

        <div class="course-stat-cell">
          <div class="stat-icon sage">✓</div>
          <div>
            <span class="stat-label">Total veckoprogression</span>
            <strong class="stat-value ring-value">${summary.overallPercent}% genomfört</strong>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= HERO BANNER: て-form Dojo (Alternativ 2 Layout + Mashup Light Warm Palette) ================= -->
    <section class="course-dojo-hero-banner" aria-label="Dagens fokus: て-form Dojo">
      <div class="dojo-hero-watermark" lang="ja" aria-hidden="true">${heroConfig.watermark}</div>

      <div class="dojo-hero-top">
        <div class="dojo-hero-copy">
          <div class="dojo-hero-badges">
            <span class="badge-dagens-fokus">DAGENS FOKUS</span>
            <span class="badge-sub">
              Genki I Lektion ${week.lessonNumber} · Verbkonjugation (${week.conjugations.length}
              verb)
            </span>
          </div>
          <h2>${heroConfig.heading}</h2>
          <p>${heroConfig.description}</p>
        </div>

        <div class="dojo-hero-actions">
          <button
            type="button"
            class="course-btn-terracotta"
            @click=${() => selectCourseSubView('dojo', host)}
          >
            ⚡ Starta て-form Dojo
          </button>
          <button
            type="button"
            class="course-btn-sage-outline"
            @click=${() => selectCourseSubView('grammar', host)}
          >
            📖 Grammatikförklaring
          </button>
        </div>
      </div>

      <!-- The 4 Conjugation Groups Grid inside the Hero Banner -->
      <div class="dojo-groups-section">
        <div class="dojo-groups-head">
          <span>${heroConfig.sectionLabel}</span>
          <button
            type="button"
            class="dojo-schema-link"
            @click=${() => selectCourseSubView('dojo', host)}
          >
            Visa komplett böjningsschema →
          </button>
        </div>

        <div class="dojo-four-groups-grid">
          ${heroConfig.cards.map(
            (card) => html`
              <div class="dojo-group-card ${card.tone}">
                <div class="group-card-meta">
                  <span>${card.metaLabel}</span>
                  <span class="group-badge ${card.badgeKind}">${card.badgeText}</span>
                </div>
                <div class="group-card-jp" lang="ja">
                  ${card.fromJp}
                  <span class="arrow ${card.warnArrow ? 'warn' : ''}">➔</span>
                  ${card.toJp}
                </div>
                <div class="group-card-romaji">${card.romajiLine}</div>
                <div class="group-card-rule">${card.ruleHtml}</div>
              </div>
            `,
          )}
        </div>
      </div>

      <!-- Example Sentence Callout Strip -->
      <div class="dojo-hero-example-strip">
        <div class="example-strip-left">
          <span class="example-bulb">💡</span>
          <div>
            <small>${heroConfig.exampleLabel}</small>
            <strong lang="ja">${heroConfig.exampleJp}</strong>
            <span>${heroConfig.exampleSv}</span>
          </div>
        </div>
        <button
          type="button"
          class="dojo-example-btn"
          @click=${() => selectCourseSubView('grammar', host)}
        >
          Interaktiv grammatikförklaring →
        </button>
      </div>
    </section>

    <!-- ================= 3-COLUMN BENTO GRID: Veckans glosor, Kanji-kort, Veckotest ================= -->
    <section class="course-three-col-grid" aria-label="Veckans tre studiemoduler">
      <!-- COLUMN 1: VECKANS GLOSOR -->
      <article class="course-bento-card bento-vocab">
        <div>
          <div class="bento-col-header">
            <div class="bento-col-title">
              <span class="col-icon">🎴</span>
              <h2>Veckans glosor</h2>
            </div>
            <span class="bento-stat-pill">
              ${summary.vocabDone} / ${summary.vocabTotal} klara
            </span>
          </div>

          ${
            previewVocab
              ? html`
                  <div class="bento-mini-flashcard">
                    <div class="mini-card-meta">
                      <span>Ordkort 1 av ${week.vocab.length}</span>
                      <span class="mini-cat-pill">${previewVocab.category}</span>
                    </div>
                    <div class="mini-card-body" lang="ja">
                      <small class="mini-furigana">${previewVocab.kana}</small>
                      <strong class="mini-kanji">${previewVocab.kanji || previewVocab.kana}</strong>
                      <span class="mini-sv">${previewVocab.sv}</span>
                    </div>
                    ${
                      host.tts
                        ? html`
                            <button
                              type="button"
                              class="mini-audio-btn"
                              @click=${(e: Event) =>
                                host.speak(previewVocab.kana, e.currentTarget as HTMLElement)}
                            >
                              🔊 Lyssna på uttal
                            </button>
                          `
                        : ''
                    }
                  </div>
                `
              : ''
          }

          <div class="bento-queue-box">
            <span class="queue-heading">FLER NYCKELORD I VECKANS LISTA</span>
            <ul class="bento-queue-list">
              ${nextQueue.map(
                (item) => html`
                  <li>
                    <div class="q-left">
                      <strong lang="ja">${item.kanji || item.kana}</strong>
                      <span>${item.kana} · ${item.sv.split(';')[0]}</span>
                    </div>
                    <small>${item.category}</small>
                  </li>
                `,
              )}
            </ul>
          </div>
        </div>

        <div class="bento-card-actions">
          <button
            type="button"
            class="course-btn-primary full-width"
            @click=${() => selectCourseSubView('vocab', host)}
          >
            Öppna alla ${week.vocab.length} gloskort →
          </button>
        </div>
      </article>

      <!-- COLUMN 2: KANJI-KORT -->
      <article class="course-bento-card bento-kanji">
        <div>
          <div class="bento-col-header">
            <div class="bento-col-title">
              <span class="col-icon">🖌️</span>
              <h2>Kanji-kort</h2>
            </div>
            <span class="bento-stat-pill">
              ${summary.kanjiDone} / ${summary.kanjiTotal} tecken
            </span>
          </div>

          <div class="bento-kanji-2x2" lang="ja">
            ${topKanji.map(
              (k, idx) => html`
                <div class="kanji-mini-tile ${idx === 0 ? 'featured' : ''}">
                  <small class="stroke-tag">${k.strokes} streck</small>
                  <strong class="kanji-char">${k.kanji}</strong>
                  <span class="kanji-meaning">${k.meaningSv.split('/')[0]}</span>
                  <small class="kanji-reading">${k.kunyomi[0] || k.onyomi[0] || ''}</small>
                </div>
              `,
            )}
          </div>

          ${
            firstKanji
              ? html`
                  <div class="bento-mnemonic-box">
                    <strong
                      >💡 Mnemoteknik för ${firstKanji.kanji} (${firstKanji.meaningSv})</strong
                    >
                    <p>${firstKanji.mnemonicSv}</p>
                    ${
                      firstKanji.compounds[0]
                        ? html`
                            <div class="mnemonic-compound">
                              <span>Vanligt ord:</span>
                              <code lang="ja">
                                ${firstKanji.compounds[0].word} (${firstKanji.compounds[0].reading}
                                · ${firstKanji.compounds[0].sv})
                              </code>
                            </div>
                          `
                        : ''
                    }
                  </div>
                `
              : ''
          }
        </div>

        <div class="bento-card-actions">
          <button
            type="button"
            class="course-btn-primary full-width"
            @click=${() => selectCourseSubView('kanji', host)}
          >
            Studera alla ${week.kanji.length} Kanji →
          </button>
        </div>
      </article>

      <!-- COLUMN 3: VECKOTEST (TENTAFOKUS) -->
      <article class="course-bento-card bento-quiz">
        <div>
          <div class="bento-col-header">
            <div class="bento-col-title">
              <span class="col-icon">🏁</span>
              <h2>Veckotest</h2>
            </div>
            <span class="bento-stat-pill terracotta-pill">
              Tentafokus · L${week.lessonNumber}
            </span>
          </div>

          <div class="bento-exam-summary">
            <div class="exam-summary-top">
              <span class="exam-tag">Diagnostiskt delprov</span>
              <span class="exam-time">⏱️ ${week.quiz.length} frågor</span>
            </div>
            <h3>Lektion ${week.lessonNumber} Veckokontroll</h3>
            <p>
              Testa om veckans glosor, verbböjningar, partiklar och läsförståelse sitter med direkt
              förklaring efter varje fråga.
            </p>

            <ul class="exam-breakdown-list">
              <li>
                <span>⚡ て-form & verbkonjugation</span>
                <strong>${teFormCount} frågor</strong>
              </li>
              <li>
                <span>📐 Grammatik & partiklar</span>
                <strong>${grammarCount} frågor</strong>
              </li>
              <li>
                <span>字 Ordförråd & Kanji</span>
                <strong>${vocabKanjiCount} frågor</strong>
              </li>
            </ul>
          </div>

          <div class="bento-exam-status">
            <span>Status:</span>
            <strong>
              ${
                summary.quizScore !== null
                  ? `Bästa resultat: ${summary.quizScore} / ${summary.quizTotal} rätt`
                  : 'Redo att genomföras'
              }
            </strong>
          </div>
        </div>

        <div class="bento-card-actions">
          <button
            type="button"
            class="course-btn-terracotta full-width"
            @click=${() => selectCourseSubView('quiz', host)}
          >
            ▶ Starta veckans minitest (${week.quiz.length} frågor)
          </button>
        </div>
      </article>
    </section>

    <!-- ================= COMPACT GRAMMAR QUICK-RULE SECTION (Alternativ 2 Bottom Reference) ================= -->
    <section class="course-grammar-quickref" aria-label="Veckans grammatiköversikt">
      <div class="quickref-header">
        <div>
          <span class="course-eyebrow">REFERENS · LATHUND INFÖR TENTA</span>
          <h2>Viktiga grammatikmönster i Genki Kapitel ${week.lessonNumber}</h2>
        </div>
        <button
          type="button"
          class="course-btn-secondary"
          @click=${() => selectCourseSubView('grammar', host)}
        >
          Öppna komplett grammatikguide (${week.grammar.length}) →
        </button>
      </div>

      <div class="quickref-grid">
        ${week.grammar.slice(0, 3).map(
          (g) => html`
            <div class="quickref-card">
              <div class="quickref-card-head">
                <span class="quickref-pill" lang="ja">${g.patternJp.split('｜')[0]}</span>
                <strong>${g.title}</strong>
              </div>
              <p>${g.summarySv}</p>
              ${
                g.examples[0]
                  ? html`
                      <div class="quickref-example" lang="ja">
                        <strong>${g.examples[0].jp}</strong>
                        <small>${g.examples[0].sv}</small>
                      </div>
                    `
                  : ''
              }
            </div>
          `,
        )}
      </div>
    </section>
  `;
}
