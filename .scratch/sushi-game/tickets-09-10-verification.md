# Tickets 09–10 — verifiering 2026-10-24

Ticket 09 visar Laxnigiri i restaurangens meny först efter serverbekräftat köp. Kapitel 6-silver och 600 hämtade yen följer den godkända katalogen. Receptet är en visuell variation utan ekonomisk effekt eller manuellt receptval.

Ticket 10 tillför ett autentiserat `equip`-anrop. Servern kontrollerar fast plats, föremålets kategori, ägande och anropets konto. Papperslykta och Vågmotiv delar väggplats; Krukväxt använder golvplats. Valen kan bytas och tas bort utan nytt köp. Bokföringen räknar fram intäkten till serverns tid men ändrar inte hastighet, saldo, tak eller periodstart genom själva placeringen. Återförsök med en redan behandlad nyckel kan inte återställa ett senare dekorationsval.

Gränssnittet använder inbyggda expanderbara val och knappar med etiketter, fokusmarkering och sparstatus. Fel behåller senast bekräftade val. Sena svar efter kontobyte ignoreras. Mobilens toppmeny radbryts och följer med sidans rullning så att den inte täcker valen. Scenen använder fortsatt provisoriska symboler; slutlig bildstil hör till ticket 11.

Verifiering:

- `npm test`: 268 tester passerade, inklusive nya tester för receptets ekonomiska neutralitet, dekorationsval, ogiltig plats, ej ägda föremål, återförsök, byte/borttagning och sena svar efter kontobyte.
- `npm run test:backend`: Auth/Firestore/Functions-emulatorflödet passerade, utökat med servervaliderade recept-/dekorationsköp, placeringsval, manipulerade koordinater, ägarisolering och återöppning.
- `npm run test:backend:e2e`: tre tester passerade. De två nya flödena kör på 390 respektive 1280 pixels bredd med riktig Google-emulatoridentitet och callable-adapter. Köp, tangentbord, mobil touch, nätverksfel/återförsök, omladdning, borttagning och frånvaro av horisontell överströmning verifieras.
- Scenbilder i `test-results/personalization-390.png` och `test-results/personalization-1280.png` kontrollerades visuellt. Testresultat är temporära och regenereras av webbläsarsviten.
- Klient- och backendtypkontroll, produktionsbygge och Prettier för ändrade filer passerade. Ingen publicering har utförts. Tidigare formatteringsbrister i övriga filer omfattas inte av dessa tickets.

Nästa steg: produktägaren väljer bildstil och perspektiv enligt första acceptanskriteriet i ticket 11. Frågan är ställd; inget alternativ räknas som godkänt utan svar.
