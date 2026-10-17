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
```
