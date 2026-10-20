# 08 — Exakt koppling till misstagsbank i veckotest och städning av död kod

**What to build:** När en student svarar fel i ett veckotest läggs endast det specifika ord eller den böjning som frågan faktiskt prövar till i studentens misstagsbank i kursframstegen, utan falska träffar på korta ord som råkar ingå som delsträngar.

**Blocked by:** 06 — Autentiska glosor och kanji-fält för Lektion 6–9

**Status:** ready-for-agent

- [ ] Frågor i veckotesten knyts till exakt rätt glos- eller böjningspost i misstagsbanken utan oavsiktlig delsträngsmatchning på korta kana-sekvenser
- [ ] Oanvända/döda funktioner och typer för kursframsteg och kapitelhierarki som inte anropas någonstans i applikationen är bortstädade
- [ ] Enhetstest verifierar att ett felsvar på en veckotestfråga endast registrerar den avsedda glosan/böjningen i misstagsbanken
