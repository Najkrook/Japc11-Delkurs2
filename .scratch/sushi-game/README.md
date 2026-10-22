# Sushi Game — lokal tracker

Godkänd MVP-uppdelning från 2026-10-22, baserad på [speldesignen](../../sushigame.md). Varje ticket finns i en egen fil. Källspecifikationen är oförändrad av denna nedbrytning.

## Arbetssätt

- Ticketfilerna är den lokala trackern; skapa inga externa issues för detta arbete.
- Alla tickets börjar med status `ready-for-agent`. Det anger att uppgiften är beskriven, inte att dess blockerare är klara.
- Arbeta endast med en ticket vars samtliga blockerare är klara. Markera uppfyllda acceptanskriterier i ticketfilen och sätt status till `done` först när hela leveransen är verifierad.
- **01 och 02 är klara:** ekonomireglerna är godkända och en separat inloggad spelvy med åtkomstspärr och isolerad laddning är implementerad och verifierad. **03** saknar nu blockerare och kan påbörjas. Slutbalansen och bildstilen i 11 är fortfarande öppna.
- Implementation, relevanta logik-/emulatortester och gränssnittskontroll ingår i respektive beteende. Ticket 12 verifierar helheten.
- Bevara TypeScript/lit-html, studieflöden, medaljberäkning och kurslagring. Spelet är inloggningskrävande och laddas separat.
- Besök, fri placering, transportbandseditor, multiplayerrestauranger och övriga funktioner utanför MVP ingår inte.

## Tickets och beroenden

| Ticket | Blockeras av |
| --- | --- |
| [01 — Bestäm ekonomiregler och provisorisk MVP-katalog](issues/01-ekonomiregler-och-provisorisk-mvp-katalog.md) | Inget |
| [02 — Öppna en separat spelvy med Google-inloggning](issues/02-separat-spelvy-och-google-inloggning.md) | Inget |
| [03 — Skapa och återöppna den personliga restaurangen](issues/03-skapa-och-ateroppna-personlig-restaurang.md) | 01, 02 |
| [04 — Tjäna och hämta intäkter med åttatimmarstak](issues/04-intakter-och-manuell-hamtning.md) | 03 |
| [05 — Lås upp belöningar permanent från kursmedaljer](issues/05-permanenta-upplasningar-fran-kursmedaljer.md) | 03 |
| [06 — Köp den första förbättringen efter kapitel 6-brons](issues/06-forsta-forbattringen-efter-kapitel-6.md) | 04, 05 |
| [07 — Köp och installera transportbandet från kapitel 9](issues/07-transportband-fran-kapitel-9.md) | 06 |
| [08 — Köp ett längre produktionstidstak](issues/08-kop-langre-produktionstidstak.md) | 06 |
| [09 — Köp en silverbelöning som recept eller variant](issues/09-silverbeloning-recept-eller-variant.md) | 06 |
| [10 — Köp och placera gulddekorationer i fasta platser](issues/10-gulddekorationer-pa-fasta-platser.md) | 06 |
| [11 — Ge restaurangscenen en sammanhängande visuell stil](issues/11-sammanhangande-visuell-restaurangscen.md) | 07, 10 |
| [12 — Speltesta, balansera och färdigställ MVP för publicering](issues/12-speltest-balans-och-publicering.md) | 08, 09, 11 |
