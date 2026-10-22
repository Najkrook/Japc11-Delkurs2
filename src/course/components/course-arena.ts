import { html } from 'lit-html';
import type { CourseHostContext, CourseTemplate } from '../types.ts';
import { ARENA_BOT_PRESETS, courseArenaManager } from '../multiplayer/arena-service.ts';
import type {
  ArenaFocusMode,
  ArenaRoundCount,
  ArenaWeekFilter,
} from '../multiplayer/arena-types.ts';

const WEEK_FILTER_LABELS: Record<ArenaWeekFilter, string> = {
  'week-1': 'Vecka 1 · Lektion 6 (て-form)',
  'week-2': 'Vecka 2 · Lektion 7 (～ています)',
  'week-3': 'Vecka 3 · Lektion 8 (Kortform)',
  'week-4': 'Vecka 4 · Lektion 9 (た-form)',
  'week-5': 'Vecka 5 · Lektion 10 (Planer)',
  'week-6': 'Vecka 6 · Lektion 11 (Erfarenheter)',
  'week-7': 'Vecka 7 · Lektion 12 (Råd & skyldigheter)',
  all: 'Alla veckor (Lektion 6–12 Mix)',
};

const FOCUS_MODE_LABELS: Record<ArenaFocusMode, string> = {
  mix: 'Alla moment (Mix)',
  'te-form': 'て-form & Böjning',
  vocab: 'Glosor',
  kanji: 'Kanji',
  grammar: 'Grammatik',
};

export function renderArenaAuthGate(
  host: CourseHostContext,
  onBackToHub: () => void,
): CourseTemplate {
  return html`
    <section
      class="course-module-section arena-section arena-auth-gate-section"
      aria-label="Kurs-Arena kräver inloggning"
      data-testid="arena-auth-gate"
    >
      <div class="course-module-topbar">
        <button type="button" class="course-back-btn" @click=${onBackToHub}>
          ← Tillbaka till studieplanen
        </button>
        <span class="arena-isolated-badge"> Lektion 6–12 · Kurs-Arena </span>
      </div>

      <div class="arena-auth-gate-card">
        <div class="arena-auth-gate-icon" aria-hidden="true">🔒</div>
        <span class="course-eyebrow">MULTIPLAYER · INLOGGNING KRÄVS</span>
        <h1 class="arena-auth-gate-title">Logga in för att gå in i Kurs-Arena</h1>
        <p class="arena-auth-gate-desc">
          Kurs-Arena är en flerspelararena där du utmanar kurskamrater i realtid på glosor,
          böjningar, kanji och grammatik från Genki I (Lektion 6–12).
        </p>
        <p class="arena-auth-gate-subdesc">
          För att skapa matchrum, ansluta med rumskod och spela mot andra studenter behöver du logga
          in med ditt Google-konto.
        </p>

        <div class="arena-auth-gate-actions">
          <button
            type="button"
            class="course-btn-primary arena-auth-login-btn"
            data-testid="arena-login-gate-btn"
            @click=${() => (host.onLogin ? host.onLogin() : host.account())}
          >
            Logga in med Google
          </button>
          <button
            type="button"
            class="course-btn-sage-outline arena-auth-back-btn"
            @click=${onBackToHub}
          >
            Tillbaka till studieplanen
          </button>
        </div>
      </div>
    </section>
  `;
}

export function renderCourseArenaModule(
  host: CourseHostContext,
  onBackToHub: () => void,
): CourseTemplate {
  if (!host.user) {
    return renderArenaAuthGate(host, onBackToHub);
  }

  const state = courseArenaManager.getState();
  const { room } = state;
  const error = state.errorMessage
    ? html`<p role="alert" class="arena-error">${state.errorMessage}</p>`
    : '';

  if (!room) {
    return renderArenaLobby(state, host, onBackToHub);
  }

  if (room.status === 'waiting') {
    return html`${error}${renderArenaWaitingRoom(state, host)}`;
  }

  if (room.status === 'finished') {
    return html`${error}${renderArenaPodium(state, host)}`;
  }

  return html`${error}${renderArenaLiveRound(state, host)}`;
}

function renderArenaLobby(
  state: ReturnType<typeof courseArenaManager.getState>,
  _host: CourseHostContext,
  onBackToHub: () => void,
): CourseTemplate {
  const { draftConfig, openRooms, joinCodeInput, errorMessage, localPlayerName } = state;

  return html`
    <section class="course-module-section arena-section" aria-label="Kurs-Arena Multiplayer">
      <div class="course-module-topbar">
        <button type="button" class="course-back-btn" @click=${onBackToHub}>
          ← Tillbaka till veckoöversikten
        </button>
        <span class="arena-isolated-badge"> Lektion 6–12 · Kurs-Arena </span>
      </div>

      <div class="dojo-header-banner arena-hero-banner">
        <div>
          <span class="course-eyebrow">KURS-ARENA · MULTIPLAYER</span>
          <h1>Tävla i det nya kursmaterialet</h1>
          <p>
            Utmana kursare i realtid med 4-siffrig rumskod, eller kör en snabbduell mot en
            studie-bot.
          </p>
        </div>
      </div>

      ${
        errorMessage
          ? html`<div class="arena-error-toast" role="alert">⚠️ ${errorMessage}</div>`
          : ''
      }

      <div class="arena-lobby-grid">
        <!-- LEFT: CREATE ROOM -->
        <article class="arena-card arena-create-card">
          <div class="bento-card-top">
            <span class="bento-step-num">SKAPA MATCH</span>
            <span class="bento-stat-pill">15s per fråga</span>
          </div>
          <h2>Starta ett rum</h2>

          <div class="arena-form-group">
            <label for="arena-player-name">Ditt visningsnamn</label>
            <input
              id="arena-player-name"
              type="text"
              class="arena-input arena-apple-input"
              maxlength="24"
              placeholder="Ditt namn..."
              .value=${localPlayerName}
              @input=${(e: Event) =>
                courseArenaManager.setPlayerName((e.target as HTMLInputElement).value)}
            />
          </div>

          <div class="arena-form-group">
            <span class="arena-label">Kursvecka</span>
            <div class="arena-segmented-control" role="group" aria-label="Välj kursvecka">
              ${(
                [
                  ['week-1', 'Vecka 1 (L6)'],
                  ['week-2', 'Vecka 2 (L7)'],
                  ['week-3', 'Vecka 3 (L8)'],
                  ['week-4', 'Vecka 4 (L9)'],
                  ['week-5', 'Vecka 5 (L10)'],
                  ['week-6', 'Vecka 6 (L11)'],
                  ['week-7', 'Vecka 7 (L12)'],
                  ['all', 'Alla (L6–L12)'],
                ] as Array<[ArenaWeekFilter, string]>
              ).map(
                ([val, label]) => html`
                  <button
                    type="button"
                    class="arena-segment-btn course-filter-chip ${draftConfig.weekFilter === val ? 'active' : ''}"
                    @click=${() => courseArenaManager.updateDraftConfig({ weekFilter: val })}
                  >
                    ${label}
                  </button>
                `,
              )}
            </div>
          </div>

          <div class="arena-form-group">
            <span class="arena-label">Fokusområde</span>
            <div class="arena-segmented-control" role="group" aria-label="Välj fokusområde">
              ${(
                [
                  ['mix', 'Mix'],
                  ['te-form', 'て-form'],
                  ['vocab', 'Glosor'],
                  ['kanji', 'Kanji'],
                  ['grammar', 'Grammatik'],
                ] as Array<[ArenaFocusMode, string]>
              ).map(
                ([val, label]) => html`
                  <button
                    type="button"
                    class="arena-segment-btn course-filter-chip ${draftConfig.focusMode === val ? 'active' : ''}"
                    @click=${() => courseArenaManager.updateDraftConfig({ focusMode: val })}
                  >
                    ${label}
                  </button>
                `,
              )}
            </div>
          </div>

          <div class="arena-form-group">
            <span class="arena-label">Antal frågor</span>
            <div
              class="arena-segmented-control arena-segmented-control-compact"
              role="group"
              aria-label="Välj antal rundor"
            >
              ${([5, 10, 15] as ArenaRoundCount[]).map(
                (cnt) => html`
                  <button
                    type="button"
                    class="arena-segment-btn course-filter-chip ${draftConfig.roundCount === cnt ? 'active' : ''}"
                    @click=${() => courseArenaManager.updateDraftConfig({ roundCount: cnt })}
                  >
                    ${cnt} frågor
                  </button>
                `,
              )}
            </div>
          </div>

          <div class="arena-create-actions">
            <button
              type="button"
              class="course-btn-primary arena-action-btn"
              data-arena-action="create-room"
              @click=${() => courseArenaManager.createRoom(false)}
            >
              Skapa rum med rumskod
            </button>
            <button
              type="button"
              class="course-btn-secondary arena-action-btn"
              data-arena-action="quick-bot-match"
              @click=${async () => {
                const created = await courseArenaManager.createRoom(true);
                if (created) await courseArenaManager.startMatch();
              }}
            >
              Snabbduell mot Sakura-bot →
            </button>
          </div>
        </article>

        <!-- RIGHT: JOIN BY CODE OR OPEN LOBBY -->
        <article class="arena-card arena-join-card">
          <div class="bento-card-top">
            <span class="bento-step-num">ANSLUT</span>
            <span class="bento-stat-pill">4 siffror</span>
          </div>
          <h2>Gå med via rumskod</h2>
          <p class="arena-card-sub">
            Skriv in den 4-siffriga koden för att ansluta till ett skapat rum:
          </p>

          <form
            class="arena-code-form"
            @submit=${(e: Event) => {
              e.preventDefault();
              void courseArenaManager.joinRoomByCode();
            }}
          >
            <label for="arena-code-input" class="sr-only">4-siffrig rumskod</label>
            <div class="arena-passcode-box">
              <input
                id="arena-code-input"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="4821"
                maxlength="4"
                class="arena-code-input arena-apple-passcode"
                .value=${joinCodeInput}
                @input=${(e: Event) =>
                  courseArenaManager.setJoinCodeInput((e.target as HTMLInputElement).value)}
              />
            </div>
            <button type="submit" class="course-btn-primary arena-join-submit-btn">Gå med →</button>
          </form>

          <div class="arena-open-rooms-box">
            <h3>Öppna rum just nu (${openRooms.length})</h3>
            ${
              openRooms.length === 0
                ? html`<p class="arena-empty-rooms">
                    Inga öppna rum väntar just nu. Skapa ett nytt rum till vänster!
                  </p>`
                : html`
                    <div class="arena-open-rooms-list">
                      ${openRooms.map(
                        (r) => html`
                          <div class="arena-open-room-row">
                            <div>
                              <strong>Rum #${r.roomCode} · ${r.hostName}</strong>
                              <small>
                                ${WEEK_FILTER_LABELS[r.weekFilter]} ·
                                ${FOCUS_MODE_LABELS[r.focusMode]} · ${r.roundCount} frågor
                              </small>
                            </div>
                            <button
                              type="button"
                              class="course-btn-secondary"
                              @click=${() => courseArenaManager.joinRoomById(r.roomId)}
                            >
                              Gå med (${r.playerCount}) →
                            </button>
                          </div>
                        `,
                      )}
                    </div>
                  `
            }
          </div>
        </article>
      </div>
    </section>
  `;
}

function renderArenaWaitingRoom(
  state: ReturnType<typeof courseArenaManager.getState>,
  host: CourseHostContext,
): CourseTemplate {
  const room = state.room!;
  const players = Object.values(room.players);

  return html`
    <section class="course-module-section" aria-label="Väntrum i Kurs-Arenan">
      <div class="course-module-topbar">
        <button
          type="button"
          class="course-back-btn"
          @click=${() => courseArenaManager.leaveRoom()}
        >
          ← Stäng / Lämna rummet
        </button>
        <span class="arena-isolated-badge">
          ${WEEK_FILTER_LABELS[room.config.weekFilter]} ·
          ${FOCUS_MODE_LABELS[room.config.focusMode]}
        </span>
      </div>

      <div class="arena-waiting-hero">
        <div class="arena-room-code-showcase">
          <span class="course-eyebrow">RUMSKOD ATT DELA MED KURSARE</span>
          <strong class="arena-giant-code" data-testid="arena-room-code">${room.roomCode}</strong>
          <button
            type="button"
            class="course-btn-secondary"
            @click=${() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                void navigator.clipboard.writeText(room.roomCode);
              }
              host.announce(`Rumskod ${room.roomCode} kopierad!`);
            }}
          >
            Kopiera kod
          </button>
        </div>

        <div class="arena-waiting-details">
          <h1>Väntar på spelare (${players.length} i rummet)</h1>
          <p>
            <strong>Inställningar:</strong> ${WEEK_FILTER_LABELS[room.config.weekFilter]} ·
            ${FOCUS_MODE_LABELS[room.config.focusMode]} · ${room.questions.length} rundor (15s per
            fråga).
          </p>

          <div class="arena-players-grid">
            ${players.map(
              (p) => html`
                <div class="arena-player-chip ${p.isBot ? 'bot' : 'human'}">
                  <span class="avatar">${p.avatar}</span>
                  <div>
                    <strong>${p.name}</strong>
                    <small
                      >${p.uid === room.hostUid ? 'Värd' : p.isBot ? 'Studie-bot' : 'Spelare'}</small
                    >
                  </div>
                </div>
              `,
            )}
          </div>

          <div class="arena-bots-selector">
            <h3>Vill du lägga till studie-botar i matchen?</h3>
            <div class="arena-bots-row">
              ${ARENA_BOT_PRESETS.map((bot) => {
                const active = Boolean(room.players[bot.id]);
                return html`
                  <button
                    type="button"
                    class="arena-bot-toggle ${active ? 'active' : ''}"
                    data-bot-toggle=${bot.id}
                    ?disabled=${state.localPlayerUid !== room.hostUid}
                    @click=${() => courseArenaManager.toggleBot(bot.id)}
                  >
                    <span>${bot.avatar} <strong>${bot.name}</strong></span>
                    <small
                      >${active ? '✓ Med i rummet (Klicka för att ta bort)' : `+ ${bot.descriptionSv}`}</small
                    >
                  </button>
                `;
              })}
            </div>
          </div>

          <div class="arena-waiting-actions">
            <button
              type="button"
              class="course-btn-primary arena-start-btn"
              data-arena-action="start-match"
              ?disabled=${state.localPlayerUid !== room.hostUid}
              title=${state.localPlayerUid !== room.hostUid ? 'Endast värden kan styra matchen' : ''}
              @click=${() => courseArenaManager.startMatch()}
            >
              Starta matchen nu (${room.questions.length} frågor) →
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderArenaLiveRound(
  state: ReturnType<typeof courseArenaManager.getState>,
  _host: CourseHostContext,
): CourseTemplate {
  const room = state.room!;
  const roundIdx = room.currentRoundIndex;
  const totalRounds = room.questions.length;
  const currentQ = room.questions[roundIdx];
  const roundKey = String(roundIdx);
  const answersMap = room.roundAnswers[roundKey] || {};
  const myAnswer = answersMap[state.localPlayerUid] || null;
  const isReveal = room.status === 'reveal';
  const players = Object.values(room.players).sort((a, b) => b.score - a.score);

  if (!currentQ) return html``;

  return html`
    <section class="course-module-section" aria-label="Pågående runda i Kurs-Arenan">
      <div class="course-module-topbar">
        <button
          type="button"
          class="course-back-btn"
          @click=${() => courseArenaManager.leaveRoom()}
        >
          ← Avsluta match
        </button>
        <div class="arena-round-header-pills">
          <span class="bento-stat-pill">Rum #${room.roomCode}</span>
          <span class="bento-stat-pill"> Runda ${roundIdx + 1} av ${totalRounds} </span>
          <span
            class="arena-timer-pill ${state.timeRemainingSeconds <= 5 && !isReveal ? 'urgent' : ''}"
          >
            ⏱️ ${isReveal ? 'Runda klar' : `${state.timeRemainingSeconds}s`}
          </span>
        </div>
      </div>

      <div class="course-quiz-progress-bar arena-timer-bar">
        <span style="width: ${isReveal ? 100 : state.timeRemainingRatio * 100}%"></span>
      </div>

      <!-- LIVE SCOREBOARD STRIP -->
      <div class="arena-live-scoreboard" role="region" aria-label="Poängställning">
        ${players.map((p, idx) => {
          const pAns = answersMap[p.uid];
          return html`
            <div class="arena-score-chip ${p.uid === state.localPlayerUid ? 'me' : ''}">
              <span class="rank">#${idx + 1}</span>
              <span class="avatar">${p.avatar}</span>
              <div class="info">
                <strong>${p.name}</strong>
                <small> ${p.score} p ${p.streak >= 2 ? html`· 🔥x${p.streak}` : ''} </small>
              </div>
              <span
                class="status-dot ${pAns ? (isReveal ? (pAns.correct ? 'ok' : 'err') : 'locked') : 'waiting'}"
              >
                ${
                  isReveal
                    ? pAns?.correct
                      ? `+${pAns.pointsAwarded}p`
                      : '0p'
                    : pAns
                      ? '✓ Svarat'
                      : '⏳'
                }
              </span>
            </div>
          `;
        })}
      </div>

      <!-- QUESTION CARD -->
      <div class="dojo-arena-card arena-question-card">
        <div class="dojo-arena-meta">
          <span class="course-cat-tag">${currentQ.badgeLabel}</span>
          ${
            myAnswer && !isReveal
              ? html`<span class="dojo-mastered-tag"
                  >✓ Ditt svar är låst! Väntar på övriga...</span
                >`
              : ''
          }
        </div>

        ${
          currentQ.highlightJp
            ? html`<div class="arena-highlight-jp" lang="ja">${currentQ.highlightJp}</div>`
            : ''
        }

        <h1 class="course-quiz-prompt">${currentQ.prompt}</h1>

        <div class="dojo-choices-grid arena-choices-grid" role="group" aria-label="Svarsalternativ">
          ${currentQ.choices.map((choice, i) => {
            const isSelected = myAnswer?.choice === choice;
            const isCorrect = choice === currentQ.answer;
            let stateClass = '';
            if (isReveal) {
              if (isCorrect) stateClass = 'correct';
              else if (isSelected) stateClass = 'wrong';
            } else if (isSelected) {
              stateClass = 'selected-locked';
            }

            return html`
              <button
                type="button"
                class="dojo-choice-btn arena-choice-btn ${stateClass}"
                ?disabled=${Boolean(myAnswer) || isReveal}
                @click=${() => courseArenaManager.submitAnswer(choice)}
              >
                <span class="choice-num">${i + 1}</span>
                <span class="choice-text">${choice}</span>
              </button>
            `;
          })}
        </div>

        ${
          isReveal
            ? html`
                <div class="dojo-feedback-box ${myAnswer?.correct ? 'ok' : 'err'}" role="status">
                  <div class="dojo-feedback-header">
                    <strong>
                      ${
                        myAnswer?.correct
                          ? `🎉 Rätt svar! +${myAnswer.pointsAwarded} poäng (inkl. tidsbonus)`
                          : `💡 Rätt svar: ${currentQ.answer}`
                      }
                    </strong>
                  </div>
                  <p>${currentQ.explanationSv}</p>
                </div>

                <div class="dojo-footer-nav">
                  <span></span>
                  <button
                    type="button"
                    class="course-btn-primary"
                    data-arena-action="next-round"
                    ?disabled=${state.localPlayerUid !== room.hostUid}
                    title=${state.localPlayerUid !== room.hostUid ? 'Endast värden kan styra matchen' : ''}
                    @click=${() => courseArenaManager.nextRound()}
                  >
                    ${roundIdx < totalRounds - 1 ? 'Nästa runda →' : 'Visa prispallen 🏆'}
                  </button>
                </div>
              `
            : ''
        }
      </div>
    </section>
  `;
}

function renderArenaPodium(
  state: ReturnType<typeof courseArenaManager.getState>,
  _host: CourseHostContext,
): CourseTemplate {
  const room = state.room!;
  const sorted = Object.values(room.players).sort((a, b) => b.score - a.score);
  const totalQ = room.questions.length;
  const medals = ['🥇', '🥈', '🥉'];

  return html`
    <section class="course-module-section" aria-label="Slutresultat i Kurs-Arenan">
      <div class="course-quiz-result-card arena-podium-card">
        <span class="course-eyebrow"> KURS-ARENA AVSLUTAD · RUM #${room.roomCode} </span>
        <h1>🏆 Slutställning</h1>
        <p>
          ${WEEK_FILTER_LABELS[room.config.weekFilter]} ·
          ${FOCUS_MODE_LABELS[room.config.focusMode]}
        </p>

        <div class="arena-podium-list">
          ${sorted.map((p, idx) => {
            const pct = totalQ > 0 ? Math.round((p.correctCount / totalQ) * 100) : 0;
            return html`
              <div class="arena-podium-row rank-${idx + 1}">
                <span class="medal">${medals[idx] || `#${idx + 1}`}</span>
                <span class="avatar">${p.avatar}</span>
                <div class="podium-name">
                  <strong>${p.name}</strong>
                  <small>${p.correctCount} / ${totalQ} rätt (${pct}%)</small>
                </div>
                <strong class="podium-score">${p.score} p</strong>
              </div>
            `;
          })}
        </div>

        <div class="course-quiz-result-actions">
          <button
            type="button"
            class="course-btn-primary"
            data-arena-action="rematch"
            ?disabled=${state.localPlayerUid !== room.hostUid}
            title=${state.localPlayerUid !== room.hostUid ? 'Endast värden kan styra matchen' : ''}
            @click=${() => courseArenaManager.startMatch()}
          >
            🔄 Spela igen (Nya frågor)
          </button>
          <button
            type="button"
            class="course-btn-secondary"
            @click=${() => courseArenaManager.leaveRoom()}
          >
            Tillbaka till Arena-lobbyn
          </button>
        </div>

        <div class="course-quiz-review-list">
          <h3>Genomgång av matchens frågor:</h3>
          ${room.questions.map((q, i) => {
            const myAns = room.roundAnswers[String(i)]?.[state.localPlayerUid];
            const ok = myAns?.correct;
            return html`
              <div class="course-quiz-review-item ${ok ? 'ok' : 'err'}">
                <div class="course-quiz-review-head">
                  <span>Runda ${i + 1} · ${q.badgeLabel}</span>
                  <strong>${ok ? `✓ +${myAns?.pointsAwarded}p` : '✗ 0p'}</strong>
                </div>
                <p class="prompt">${q.prompt}</p>
                <p class="ans">
                  Ditt svar: <b>${myAns?.choice || 'Inget svar'}</b>
                  ${!ok ? html` · Rätt svar: <b>${q.answer}</b>` : ''}
                </p>
                <small>${q.explanationSv}</small>
              </div>
            `;
          })}
        </div>
      </div>
    </section>
  `;
}
