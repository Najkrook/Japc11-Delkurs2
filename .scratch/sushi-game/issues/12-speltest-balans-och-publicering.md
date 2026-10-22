# 12 — Speltesta, balansera och färdigställ MVP för publicering

**What to build:** MVP:n får en verifierad och begriplig studie–upplåsning–intjäning–köp-loop med rimlig progression för klasskamraternas studieintervall och kan publiceras utan att försämra studieappen.

**Blocked by:** 08 — Köp ett längre produktionstidstak; 09 — Köp en silverbelöning som recept eller variant; 11 — Ge restaurangscenen en sammanhängande visuell stil

**Status:** ready-for-agent

- [ ] Speltester omfattar en ny student utan medaljer, en student med befintliga medaljer och återbesök efter korta, åtta timmar långa och längre uppehåll. Katalogens priser och kapaciteter justeras efter dokumenterade utfall utan att ändra bekräftade spelregler.
- [ ] Den lilla MVP-katalogen innehåller flera förbättringar, kapitel 6:s första förbättring, kapitel 9:s fasta transportband, en köpt takuppgradering, en silverbelöning och några visuella gulddekorationer. Återstående innehåll och kapitel 12:s exakta slutmål förblir öppna om de inte uttryckligen beslutats.
- [ ] Samlad verifiering täcker initial och senare medaljtilldelning, minskad progression, manuell hämtning, köp, dekorationer, omladdning, kontobyte, återförsök och samtidiga sessioner. Bokföringspolicyn från 01 provas även vid full kassa.
- [ ] Åtkomstkontroller verifierar att utloggade/anonyma användare och andra konton inte kommer åt restaurangen samt att klienten inte kan skriva pengar, upplåsningar eller köp direkt. Nätverks- och backendfel ger återhämtning utan att ersätta sparad restaurangdata.
- [ ] Befintliga studieövningar, medaljberäkningar, kurslagring och navigation fungerar fortsatt. Typkontroll, bygge samt relevanta enhets-, emulator- och webbläsartester passerar; laddning jämförs före och efter så att spelet inte följer med studiernas initiala resurser.
- [ ] Mobil, tangentbord, minskad rörelse och inaktiv spelvy kontrolleras. Ingen permanent serversimulering eller skrivning till databasen varje sekund finns.
- [ ] Faktiska driftsförutsättningar för den valda Firebase-backenden, inklusive plan, behörigheter och konfiguration, kontrolleras innan publicering. Eventuellt saknad fakturering eller åtkomst dokumenteras som blockerare och får inte räknas som genomförd publicering.
- [ ] Backend och restaurangens åtkomstregler publiceras och verifieras innan produktionsingången till spelet exponeras. Ett produktionssmoketest verifierar inloggning, ägarisolering, intäktshämtning och köp; releaseutfall och återställningsväg dokumenteras.
