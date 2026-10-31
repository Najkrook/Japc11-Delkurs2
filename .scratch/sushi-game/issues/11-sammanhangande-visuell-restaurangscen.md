# 11 — Ge restaurangscenen en sammanhängande visuell stil

**What to build:** Studenten möter en sammanhängande och lättläst restaurangscen där köpt utrustning, transportband och valda dekorationer syns tydligt på både mobil och dator.

**Blocked by:** 07 — Köp och installera transportbandet från kapitel 9; 10 — Köp och placera gulddekorationer i fasta platser

**Status:** done

- [x] Bildstil och perspektiv väljs uttryckligen med produktägaren innan slutligt bildarbete och dokumenteras som ett nytt beslut. Pixelstil och perspektiv behandlas inte som redan godkända.
- [x] Grundrestaurang, funktionella utrustningstillstånd, transportband och dekorationsplatser får en liten sammanhängande uppsättning bildlager som projektet får distribuera. Ursprung och användningsrätt dokumenteras.
- [x] Scenen återger faktiskt sparat ägande och dekorationsval. Den tillför ingen fri placering, kollision, kund-AI eller annan ekonomisk simulering.
- [x] Layouten fungerar på små skärmar och gör kassans status, köp och dekorationskontroller åtkomliga utan att scenen skymmer dem. Tangentbordsfokus och textläsbarhet bevaras.
- [x] Lätta CSS-animationer respekterar minskad rörelse och onödiga animationer stoppas när spelet är inaktivt. Bildresurserna laddas först när spelvyn öppnas.
- [x] Visuell kontroll och riktade webbläsartester verifierar grundrestaurang, uppgraderat kök/service, transportband och dekorationsbyten på mobil och dator samt reducerad rörelse och isolerad resursladdning.

## Leverans 2026-10-24

Produktägaren valde illustrerad 2D framifrån som ett tvärsnitt. Se [bildbeslut och ursprung](../visual-direction.md) och [verifiering](../ticket-11-verification.md). Tre emulatorbaserade webbläsartester, 268 enhetstester och produktionsbygget passerar.
