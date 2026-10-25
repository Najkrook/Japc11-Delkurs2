# Sushi Game — lokal tracker

Godkänd MVP-uppdelning från 2026-10-22, baserad på [speldesignen](../../sushigame.md). Varje ticket finns i en egen fil. Källspecifikationen är oförändrad av denna nedbrytning.

## Prova prototypen lokalt

Kör `npm run preview:sushi` från projektroten i Windows. Kommandot bygger backend,
startar Firebase-emulatorerna, förbereder två testkonton och startar Vite.
Öppna sedan [speltestets startsida](http://127.0.0.1:5178/.scratch/sushi-game/preview.html).
Node, Java 21, Firebase CLI och projektets npm-beroenden (även i `functions`) behöver finnas installerade.

- **Play fresh:** inga medaljer eller köp, 0 yen i disponibelt saldo och normal intjäning.
- **Play with upgrades unlocked:** guld i kapitel 6, 7 och 9, 10 000 disponibla yen,
  cirka 300 yen att hämta och inga genomförda köp. Alla sju katalogföremål kan provas direkt.
- Båda profilerna använder lokala testidentiteter; riktig Google-inloggning behövs inte.
  Köp och placeringar sparas mellan omladdningar medan emulatorerna körs.
- Webbläsarens Bakåt-knapp tar dig tillbaka till profilvalet från spelvyn.
- Låt terminalen vara igång. Ctrl+C stoppar förhandsvisningen. En omstart återställer båda
  testkontona. Startkommandot avbryter om någon av dess portar redan används.

Prova att hämta intäkter, köpa beredningsbänk och transportband, köpa laxreceptet,
placera/byta/ta bort dekorationer och ladda om. Kommentera gärna vad som är oklart,
om uppgraderingarna känns belönande och vad som skulle få dig att återvända.

Detta är en lokal speltestmiljö. Publicering och slutlig balansering ligger kvar i ticket 12.
Se även [körinstruktionerna för projektet](../../README.md) och
[verifieringen av speltestmiljön](preview-verification.md).

## Arbetssätt

- Ticketfilerna är den lokala trackern; skapa inga externa issues för detta arbete.
- Alla tickets börjar med status `ready-for-agent`. Det anger att uppgiften är beskriven, inte att dess blockerare är klara.
- Arbeta endast med en ticket vars samtliga blockerare är klara. Markera uppfyllda acceptanskriterier i ticketfilen och sätt status till `done` först när hela leveransen är verifierad.
- **01 till 08 är implementerade lokalt.** Granskningen hittade att spelvyn använde lokal lagring trots serverkraven, att medaljsynk dubbelräknade visad intäkt och att laddningsfel inte kunde återförsökas. Dessa tre brister är åtgärdade 2026-10-23; se [verifieringen](review-fixes-2026-10-23.md). Backendpublicering och produktionsverifiering återstår i ticket 12.
- **09 och 10 är klara lokalt 2026-10-24:** köpt lax­nigiri visas på menyn och ägda gulddekorationer kan placeras, bytas och tas bort på fasta platser. Se [verifieringen](tickets-09-10-verification.md). **11 är klar lokalt:** illustrerad restaurang med sparade utrustnings- och dekorationslager. Den lokala prototypen har 2026-10-25 ändrats från frontvy till isometrisk hörnvy. Se [den ursprungliga verifieringen](ticket-11-verification.md) och [aktuell bildriktning](visual-direction.md). Publicering och helhetsbalansering återstår i 12.
- Implementation, relevanta logik-/emulatortester och gränssnittskontroll ingår i respektive beteende. Ticket 12 verifierar helheten.
- Bevara TypeScript/lit-html, studieflöden, medaljberäkning och kurslagring. Spelet är inloggningskrävande och laddas separat.
- Besök, fri placering, transportbandseditor, multiplayerrestauranger och övriga funktioner utanför MVP ingår inte.

## Tickets och beroenden

| Ticket | Blockeras av | Status |
| --- | --- | --- |
| [01 — Bestäm ekonomiregler och provisorisk MVP-katalog](issues/01-ekonomiregler-och-provisorisk-mvp-katalog.md) | Inget | `done` |
| [02 — Öppna en separat spelvy med Google-inloggning](issues/02-separat-spelvy-och-google-inloggning.md) | Inget | `done` |
| [03 — Skapa och återöppna den personliga restaurangen](issues/03-skapa-och-ateroppna-personlig-restaurang.md) | 01, 02 | `done` |
| [04 — Tjäna och hämta intäkter med åttatimmarstak](issues/04-intakter-och-manuell-hamtning.md) | 03 | `done` |
| [05 — Lås upp belöningar permanent från kursmedaljer](issues/05-permanenta-upplasningar-fran-kursmedaljer.md) | 03 | `done` |
| [06 — Köp den första förbättringen efter kapitel 6-brons](issues/06-forsta-forbattringen-efter-kapitel-6.md) | 04, 05 | `done` |
| [07 — Köp och installera transportbandet från kapitel 9](issues/07-transportband-fran-kapitel-9.md) | 06 | `done` |
| [08 — Köp ett längre produktionstidstak](issues/08-kop-langre-produktionstidstak.md) | 06 | `done` |
| [09 — Köp en silverbelöning som recept eller variant](issues/09-silverbeloning-recept-eller-variant.md) | 06 | `done` |
| [10 — Köp och placera gulddekorationer i fasta platser](issues/10-gulddekorationer-pa-fasta-platser.md) | 06 | `done` |
| [11 — Ge restaurangscenen en sammanhängande visuell stil](issues/11-sammanhangande-visuell-restaurangscen.md) | 07, 10 | `done` |
| [12 — Speltesta, balansera och färdigställ MVP för publicering](issues/12-speltest-balans-och-publicering.md) | 08, 09, 11 | `ready-for-agent` |
