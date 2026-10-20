# 04 — Mobilvänlig toppmeny och direkt synligt kursinnehåll

**What to build:** På mobilskärmar tar den klistrade toppmenyn minimalt med utrymme, veckans studieinnehåll syns direkt vid sidladdning utan att tryckas undan av sidopanelen, och interaktiva knappar är lätta att träffa med fingret.

**Blocked by:** 01 — Grön baslinje för CI, formatering och E2E-filtertest

**Status:** ready-for-agent

- [ ] På mobilvy (375×812 px) är den klistrade toppmenyn kompakt (navigeringsvalen ligger på en horisontellt skrollbar rad eller motsvarande kompakt layout) och upptar högst ~15 % av skärmhöjden
- [ ] Vid sidladdning på mobilvy börjar det primära studieinnehållet ovanför skrollgränsen (above the fold), utan att en hel sidopanel på flera hundra pixlar tvingar studenten att skrolla för att se kursmaterialet
- [ ] Ljudknappar och sekundära navigeringsknappar har en tillräcklig tryckyta på pekskärmar
- [ ] Playwright-test i mobilvy verifierar att toppmenyn är kompakt och att huvudytan syns utan skrollning
