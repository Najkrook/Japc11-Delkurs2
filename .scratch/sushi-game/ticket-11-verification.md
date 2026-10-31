# Ticket 11 — verifiering 2026-10-24

Vald riktning och tillgångarnas ursprung: [bildstil](visual-direction.md).

- Implementerad frontillustration ovanför kassan med lager från sparat ägande och fasta dekorationsval.
- 268 enhetstester passerar, inklusive befintliga ekonomi-, kontobytes-, vy- och tickerregressioner.
- Produktionsbygge och TypeScript-kontroll passerar. Illustrationen ingår i separat sushi-view-chunk, inte studiernas initiala modul.
- Riktade Firebase-emulator-/Chromiumtester verifierar 390 och 1280 px: grundrestaurang, köpt beredningsbänk/transportband/recept, placering/byte/borttagning av dekorationer, omladdning, misslyckad sparning och återförsök, tangentbord och touch.
- Samma tester kontrollerar separat laddning av illustrationsmodulen, prefers-reduced-motion, paus/återupptagning vid visibilitychange och att sidan inte får horisontellt överflöde. Visibilitychange simuleras deterministiskt i testet.
- Skärmbilder av grund- och uppgraderad restaurang granskas visuellt för båda bredderna. Tillfälliga bilder finns i test-results/restaurant-{base,upgraded}-{390,1280}.png.
- Ett långt användarnamn kunde orsaka överflöde efter typsnittsbytet. Rubriken bryter nu långa ord inom sin tillgängliga bredd.

Ingen publicering har gjorts. Samlad balans, releaseförutsättningar och produktionsverifiering återstår i ticket 12.
