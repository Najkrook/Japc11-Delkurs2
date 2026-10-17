# Filstruktur och felanalys av JAPC11 Delkurs 2

Datum: 17 oktober 2026. Granskad commit: `f55eb40`.

Uppföljning: prioriterade fel har därefter rättats i arbetskopian. Se [rättningar och verifiering](atgarder-2026-10-17.md). Analysen nedan beskriver den ursprungliga versionen.

Projektet har en begriplig grundstruktur för en liten studieapp. Kursdata, progression och vykomponenter är delvis separerade, men stora filer blandar flera ansvar. De viktigaste felen finns i multiplayerlagring och synkning. **Prioritera behörighetsregler och samtidiga rumsskrivningar före en större omstrukturering.**

Analysen omfattar lokal källkod, konfiguration, testupplägg och riktade kontroller. Inga produktionsdata har ändrats. Applikationskoden har inte ändrats; denna rapport är leveransen. Faktiskt driftsatta Firestore-regler och multiplayer mellan olika enheter har inte verifierats.

## Projektets filstruktur

```text
Japc11-Delkurs2/
├── .github/workflows/checks.yml   CI för format, typer, tester och bygge
├── public/                       Ikoner, manifest och statisk 404-sida
├── src/
│   ├── main.ts                   Start, tema, konto och rendering
│   ├── cloud.ts                  Firebase, autentisering och molnprogression
│   ├── speech.ts                 Japanskt tal via Web Speech API
│   └── course/
│       ├── types.ts              Gemensamma kurs- och värdtyper
│       ├── course-state.ts       Lokal lagring och progressionsoperationer
│       ├── course-view.ts        Appskal, navigering, synkning och veckoöversikt
│       ├── course.css            Samlad styling
│       ├── apple-physics.ts      Svepgester och fjäderanimationer
│       ├── components/
│       │   ├── course-arena.ts    Lobby, väntrum, match och resultat
│       │   ├── flashcard-deck.ts  Glosor, kanji och grammatik
│       │   ├── te-form-dojo.ts    Böjningsträning och svarsalternativ
│       │   └── week-quiz.ts       Veckotest och resultat
│       ├── data/
│       │   ├── index.ts          Samlar veckornas kursdata
│       │   ├── week1-lesson6.ts
│       │   ├── week2-lesson7.ts
│       │   └── week3-4-preview.ts
│       └── multiplayer/
│           ├── arena-types.ts
│           ├── arena-questions.ts
│           └── arena-service.ts  Rum, spelare, poäng, timers och lagring
├── tests/
│   ├── course-mode.test.ts       Fem enhetstester
│   └── e2e/course_mode.spec.ts   Ett scenario i två webbläsarprojekt
├── firestore.rules              Databasbehörigheter
├── firebase.json                Hosting, Firestore och emulatorinställningar
├── playwright.config.ts
├── vite.config.ts
├── tsconfig.json
├── package.json
└── package-lock.json
```

`node_modules/`, `dist/`, `.firebase/` och `test-results/` finns lokalt och ignoreras av Git. Det är en rimlig uppdelning mellan källkod och genererade filer. Ingen `AGENTS.md` hittades i projektets filinventering.

### Arkitektur och beroenden

Appen använder TypeScript, Vite och `lit-html`. `main.ts` skapar ett `CourseHostContext` med funktioner för rendering, konto, tema och tal. `course-view.ts` väljer vy, förvaltar progression och synkar med `cloud.ts`. Komponenterna ändrar progression genom `course-state.ts` och begär därefter sparning och rendering.

Arena har en separat manager som kombinerar Firestore, localStorage och BroadcastChannel. Det gör lokal träning möjlig, men samma klass hanterar även spelregler, identitet, rumslivscykel, botar och timers. Ansvarsblandningen gör samtidighets- och livscykelfel svårare att isolera.

### Styrkor

- Kursinnehållet är separerat från merparten av presentationskoden och använder gemensamma typer.
- TypeScript körs med `strict`, kontroll av oanvänd kod och typkontroll före bygge.
- Låsfil och CI finns. CI omfattar även Chromium och mobil WebKit.
- Progressionsfunktionerna är relativt små och möjliga att testa utan webbläsare.
- Firebase får ett separat byggpaket och genererade kataloger hålls utanför Git.

### Strukturella förbättringar

| Fil                                       | Rader | Bedömning och förslag                                                                    |
| ----------------------------------------- | ----: | ---------------------------------------------------------------------------------------- |
| `src/course/course.css`                   |  2907 | Dela upp i bas, tema, layout och komponentstilar. Behåll en tydlig importordning.        |
| `src/course/course-view.ts`               |  1075 | Separera progressionssynkning, appskal och veckoöversikt.                                |
| `src/course/multiplayer/arena-service.ts` |   698 | Separera spelregler från lagring och sessionslivscykel.                                  |
| `src/course/components/course-arena.ts`   |   600 | Lobby, väntrum, runda och podium kan bli egna vyer.                                      |
| `src/course/components/flashcard-deck.ts` |   514 | Filnamnet döljer att den också innehåller kanji- och grammatikvyer. Dela efter funktion. |

Radantal avser den granskade versionen och inkluderar tomrader. Stora datafiler är mindre problematiska än stora logikfiler: de innehåller huvudsakligen kursinnehåll.

`arena-questions.ts` importerar `buildDojoChoices` från en UI-komponent. Flytta den rena funktionen till en domänmodul för böjningar så att frågegenereringen inte behöver bero på presentationslagret. Modulglobala tillstånd i quiz, dojo, flashcards och kursvyn bör få tydliga återställningsregler vid användarbyte.

### Kursinnehållets omfattning

| Vecka | Lektion | Glosor | Kanji | Böjningar | Quizfrågor | Status i data |
| ----- | ------: | -----: | ----: | --------: | ---------: | ------------- |
| 1     |       6 |     30 |    15 |        14 |         12 | Ordinarie     |
| 2     |       7 |     20 |    14 |         8 |         10 | Ordinarie     |
| 3     |       8 |     10 |     4 |         6 |          6 | Preview       |
| 4     |       9 |      6 |     3 |         6 |          6 | Preview       |

README beskriver lektion 6–9 men förklarar inte att vecka 3–4 är markerade `isPreview: true` och har mindre material. Förtydliga omfattningen. Antalen är kontrollerade mot kursdata; språkets och kursinnehållets fullständiga ämnesmässiga korrekthet ingår inte i denna analys.

## Buggar och fel

P1 betyder hög prioritet för säkerhet eller dataintegritet. P2 betyder funktionellt fel som bör åtgärdas. **Reproducerat lokalt** avser körd kod med minneslagring; **kodbelagt** avser en direkt identifierbar felväg som inte har verifierats i en driftsatt miljö.

### F1 P1 Inloggade användare får ändra andras rum

**Kodbelagt.** [firestore.rules](../firestore.rules#L15), rader 15–23.

`create, update` kräver autentisering, matchande `roomId`, en sträng som rumskod och en tillåten status. Reglerna kontrollerar inte medlemskap, värdidentitet eller vilka fält som ändras. En annan autentiserad användare kan därför enligt dessa regler ersätta spelare, poäng, frågor eller `hostUid`. Efter byte av `hostUid` kan även raderingsvillkoret uppfyllas. Detta gäller om reglerna i filen används vid drift.

**Kontrollscenario:** Låt användare B försöka uppdatera poäng eller värd i användare A:s rum i Firestore-emulatorn. Operationen ska nekas men hindras inte av nuvarande villkor.

**Åtgärd:** Definiera tillåtna operationer per roll, skydda oföränderliga fält och begränsa spelarens skrivningar till egna tillåtna uppgifter. För ett fusksäkert tävlingsläge behöver poäng och facit hanteras av en betrodd del av systemet. Lägg till regeltester för obehörig åtkomst.

### F2 P1 Överlappande sparningar tappar svar och poäng

**Reproducerat lokalt.** [arena-service.ts](../src/course/multiplayer/arena-service.ts#L675), särskilt rader 675–686, samt `submitAnswer`.

Varje klient sparar hela sin version av rummet med `setDoc`. Om A och B utgår från samma rumsversion, svarar och sparar innan de fått varandras uppdateringar, kan B:s skrivning ta bort A:s svar och poäng. Tidsstämpeln på dokumentet gör inte skrivningen atomär.

**Reproduktion:** Två managers fick varsin kopia av samma aktiva runda. A lämnade ett korrekt svar, därefter sparade B sin äldre kopia med sitt svar. Den sparade versionen innehöll B:s svar men saknade A:s. Kontrollen använde lokal minneslagring; samma helrumsskrivning finns i Firestore-grenen, men nätverksförloppet har inte körts mot Firebase.

**Åtgärd:** Spara svar separat per spelare/runda och använd transaktioner för gemensamma tillståndsövergångar. Att bara lägga till `merge: true` löser inte säkert konflikter i hela den aktuella datamodellen.

### F3 P2 Avmarkerad kunskap återkommer vid molnsynkning

**Kodbelagt.** [course-view.ts](../src/course/course-view.ts#L48), rader 48–67; [course-state.ts](../src/course/course-state.ts#L124), rader 124–160.

Avmarkering tar bort nyckeln ur en mastery-map. Vid inläsning av nyare molndata slås den lokala kartan och molnkartan ihop. Om den lokala kopian innehåller `{ord: true}` och den nyare molnkopian är `{}`, blir resultatet fortfarande `{ord: true}`. Borttagningen kan inte föras över.

**Kontrollscenario:** Markera ett ord på två enheter, avmarkera på den ena och ladda den nyare molnversionen på den andra. Den gamla markeringen överlever sammanslagningen.

**Åtgärd:** Välj en uttrycklig konfliktmodell. Antingen ersätts hela kartan av den valda versionen, eller så sparas tidsstämplar och även avmarkeringar per post. Testa både tillägg och borttagning mellan två kopior.

### F4 P2 Utloggning behåller kontots spelaridentitet

**Reproducerat lokalt.** [arena-service.ts](../src/course/multiplayer/arena-service.ts#L149), rader 149–174.

`bindHost(null)` sätter `isLoggedIn` till `false`, men byter bara spelar-ID om det befintliga ID:t redan börjar med `guest-`. Efter ett vanligt konto-ID ligger både ID och tidigare namn kvar i managern.

**Reproduktion:** Bind en manager till `account-probe`, bind sedan till `null`. `getState()` visar fortfarande `localPlayerUid: account-probe` samtidigt som `isLoggedIn` är `false`. Molnprenumerationen stängdes av i kontrollen, så ingen inloggning eller molnskrivning gjordes.

**Åtgärd:** Återställ identitet, rum och prenumerationer vid användarbyte. Hämta eller skapa gästidentitet oberoende av tidigare ID. Felet innebär fel lokal identitet; det bevisar inte att Firebase-autentisering kringgås.

### F5 P2 Rumskodskollision ersätter befintligt rum

**Reproducerat lokalt.** [arena-service.ts](../src/course/multiplayer/arena-service.ts#L103), rader 103–106 och 223–274.

Rumskoden slumpas bland 9000 värden och blir direkt dokument-ID. `createRoom` kontrollerar inte om rummet redan finns innan det sparas.

**Reproduktion:** Fixera slumpvärdet och skapa två rum. Båda får samma ID och den andra skapningen ersätter det första lokala rummet.

**Åtgärd:** Reservera koder atomärt och försök med en ny kod vid kollision. Använd gärna ett separat unikt internt rums-ID och en kodmappning. En vanlig läsning före skrivning räcker inte när två klienter skapar samtidigt.

### F6 P2 Lämnade och raderade rum hanteras inte fullständigt

**Delvis reproducerat lokalt.** [arena-service.ts](../src/course/multiplayer/arena-service.ts#L443), rader 443–467 och 571–589.

När en deltagare som inte är värd lämnar rummet tas deltagaren inte bort från `players`. Det verifierades genom att ansluta en andra gäst, lämna och läsa det sparade rummet. Spelarantalet blir fel och kontrollen för att alla har svarat väntar även på den som lämnat.

När värden raderar rummet gör snapshot-koden dessutom bara `return` om dokumentet saknas. Den grenen tömmer inte deltagarens aktiva rum. Den lokala kanalen skickar heller ingen särskild händelse för rumsradering. Denna del är kodbelagd.

**Åtgärd:** Ta bort deltagaren atomärt, hantera radering som en explicit stängning och rensa lokala kopior samt timers. Bestäm om värdbyte eller stängning ska gälla när värden lämnar.

### F7 P2 Valt frågefokus övergår tyst till blandade frågor

**Reproducerat lokalt.** [arena-questions.ts](../src/course/multiplayer/arena-questions.ts#L175), rader 175–186.

Om fokusurvalet innehåller färre frågor än önskat antal används hela veckans frågebank. Användaren kan välja grammatik men få glosor, kanji eller böjningar.

**Reproduktion:** Generera vecka 1 med `focusMode: 'grammar'` och `roundCount: 20`. Resultatet innehåller andra kategorier än grammatik.

**Åtgärd:** Behåll fokus och minska antalet frågor, tillåt tydligt angivna repetitioner eller begränsa valbara rundantal utifrån urvalet.

### F8 P2 Tomt glosfilter visar hela ordlistan

**Kodbelagt.** [flashcard-deck.ts](../src/course/components/flashcard-deck.ts#L51), rader 51–68.

`filtered.length > 0 ? filtered : week.vocab` återställer hela listan när filtret är tomt. När alla ord är bemästrade visar alltså filtret ”Kvar att lära (0)” ändå kort. Samma problem gäller en ordklass utan träffar.

**Kontrollscenario:** Markera alla ord och välj ”Kvar att lära”. Förväntat är ett tomt eller färdigt läge; koden väljer hela ordlistan.

**Åtgärd:** Rendera ett tydligt tomt läge före indexberäkning. När ett ord tas bort ur urvalet genom ”Kan” bör index dessutom behållas eller räknas om: dagens ökning kan hoppa över nästa kvarvarande kort.

### F9 P2 Alla deltagare kan styra matchens förlopp

**Kodbelagt.** [course-arena.ts](../src/course/components/course-arena.ts#L331), rader 331–360 och 503–512; `toggleBot`, `startMatch` och `nextRound` i `arena-service.ts`.

Knapparna för botar, start och nästa runda visas utan värdkontroll. Motsvarande servicefunktioner kontrollerar inte heller att den lokala spelaren är värd. En deltagare kan därför starta matchen och flytta alla till nästa runda. Det är separat från F1: även en vanlig användare via appens gränssnitt får dessa kontroller.

**Kontrollscenario:** Anslut som andra spelare till ett väntrum och använd startknappen. Nuvarande kod tillåter åtgärden.

**Åtgärd:** Om värden ska styra matchen, tillämpa samma regel i UI, servicelagret och databasreglerna. Skydda rundövergångar mot dubbla klick och konkurrerande övergångar.

## Verifiering och testluckor

| Kontroll                  | Resultat                                               |
| ------------------------- | ------------------------------------------------------ |
| `npm test`                | 5 av 5 tester passerade                                |
| `npm run build`           | Typkontroll och Vite-bygge passerade                   |
| `npm run test:e2e`        | 2 av 2 körningar passerade, Chromium och mobil WebKit  |
| `npm run format:check`    | Passerade före rapporttillägget                        |
| Riktade lokala kontroller | F2, F4, F5, deltagardelen av F6 samt F7 reproducerades |

Den första test- och byggkörningen blockerades av miljöns processrestriktion med `spawn EPERM`. Samma kommandon passerade när underprocesser tilläts. Det var inget konstaterat projektfel.

De befintliga testerna visar att grundflödet fungerar. E2E-scenariot öppnar appen, svarar i dojo och startar en lokal arenarunda med en bot. Trots testnamnet genomför det ingen flashcard-interaktion och verifierar inte inloggat multiplayer mellan två användare. Det finns inga separata Firestore-regeltester i projektet.

Prioriterade testtillägg är två samtidiga spelare, obehöriga rumsskrivningar, borttagning av mastery vid synkning, konto till gäst, rumskollisioner, lämnade rum och tomma filter. Typkontrollen omfattar endast `src/**/*.ts`, vilket lämnar test- och konfigurationsfiler utanför den kontrollen.

## Rekommenderad ordning

1. Begränsa rumsbehörigheter och gör svar samt rundövergångar säkra vid samtidiga skrivningar. Lägg regel- och tvåklientstester runt F1, F2 och F9.
2. Rätta progressionssynkning och sessionens livscykel: F3–F6.
3. Rätta fokusurval och glosfilter: F7–F8.
4. Extrahera progressionslagring och arenalagring från vyerna och spelreglerna. Behåll rena domänfunktioner utan Firebase- och DOM-beroenden.
5. Dela de största vy- och stilfilerna stegvis, förtydliga README och ge vecka 3–4 egna filer när materialet byggs ut.

En lämplig målstruktur kan behålla `src/course/data/`, lägga rena regler i `src/course/domain/`, lagringsadaptrar i `src/course/storage/` och dela vyerna efter kursmoment. Projektet behöver inte byta ramverk för att få tydligare ansvar och bättre testbarhet.
