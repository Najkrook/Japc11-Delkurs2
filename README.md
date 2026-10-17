# JAPC11 · Delkurs 2 (Genki I Lektion 6–9)

Fristående, 100 % TypeScript-baserad studieplattform för **JAPC11 Delkurs 2** (_Genki I, Lektion 6–9_).

## Innehåll

- **Vecka för vecka (Lektion 6–9):** Strukturerad 4-veckors studieplan med fokus på verbens て-form, pågående handling (`〜ています`), kortformer (`普通形`) och dåtid kortform.
- **🥋 て-form Dojo:** Interaktiv böjningsträning med flervals- och skrivläge samt visuell lathund för alla 4 böjningsgrupperna (inklusive undantaget `行く → 行って`).
- **🎴 Glosor & Kanji:** Vändbara flashcards med Apple Fluid Interface-fysik (1:1 svep, rubber-banding, momentum-projektion) och uttal via Web Speech API.
- **⚔️ Kurs-Arena (Multiplayer):** Fristående realtids-multiplayer (Firestore `/courseRooms`) med 4-siffriga rumskoder, 15s Kahoot-liknande tidsbonus och valbara studie-bots (`Sakura-bot`, `Kenji-bot`, `Sensei-bot`).

## Kommandon

```bash
npm install
npm run dev        # Starta utvecklingsserver
npm run typecheck  # Kontrollera TypeScript-typer
npm run build      # Bygg produktionspaket
npm test           # Kör enhetstester (node --test)
npm run test:e2e   # Kör Playwright E2E-tester
npm run test:rules # Kör Firestore-regler och samtidiga klienter i lokal emulator
```

Regeltesterna kräver Java 21 och Firebase CLI (`firebase-tools`); CI installerar dessa.
Testkommandot använder endast demo-projektet `demo-japc11-delkurs2`.

Inloggade arenarum sparas med Firestore-transaktioner. Gästrum är lokala för samma
webbläsare och ursprung och använder Web Locks för att samordna flikar. Dessa rum
lagras separat från molnrum. Ett misslyckat molnanrop visas som fel och skapar inte
en separat lokal kopia av matchen.

Matchens värd styr botar, start och rundbyten. Spelare får ändra sitt namn, lämna
rummet och skicka ett eget svar per runda. Det är fortfarande en studiearena där
värden och klienten har tillgång till frågornas facit, inte en serverstyrd tävling
med skydd mot alla former av fusk.

Progressionssynkning väljer den senaste kompletta versionen, inklusive
avmarkeringar. Samtidiga offlineändringar på flera enheter slås inte ihop per ord.

Vid publicering måste frontend och `firestore.rules` uppdateras tillsammans.
Gamla klienter som skriver hela rum kan nekas av de nya reglerna. Avsluta pågående
matcher och ladda om klienterna vid uppdateringen. Äldre lokala arenarum migreras
inte till den nya separata gästlagringen; kursprogressionens lagringsnycklar är oförändrade.
