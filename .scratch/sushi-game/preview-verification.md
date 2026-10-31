# Lokal speltestmiljö — 2026-10-25

Starta med `npm run preview:sushi` på Windows. Startsidan finns på
<http://127.0.0.1:5178/.scratch/sushi-game/preview.html>.

## Förberedda profiler

- `sushi-preview-fresh`: inga medaljer, inga köp, 0 disponibla yen.
- `sushi-preview-progressed`: fullständiga kursframsteg för kapitel 6–12,
  50 000 disponibla yen, 30 minuters väntande produktion och inga köp.

Kontona finns endast i Auth- och Firestore-emulatorerna för `demo-japc11-delkurs2`.
Spelet använder ordinarie callable-funktion för laddning, hämtning, köp och placering.
Medaljupplåsningarna härleds från kursframstegen av backenden.
Startsidans inloggningshjälp kräver testläge, emulatorflagga och lokal värd innan
Firebase-modulen importeras. Startsidan och hjälpskripten ingår inte i produktionsbygget.

## Genomförda kontroller

- Startkommandot byggde backend, startade emulatorerna, skapade testkontona och startade Vite.
- Browserkontroll i Codex: den förberedda profilen öppnade restaurangen med 7/7 upplåsningar
  och 10 000 yen. Intäkter kunde hämtas och samtliga sju föremål köpas.
- Beredningsbänk och transportband höjde takten till 30 yen/minut; takuppgraderingen visade 12 timmar.
- Laxnigiri syntes på menyn; papperslykta och krukväxt kunde placeras och syntes i illustrationen.
- Omladdning behöll köp, menyvariation, väggdekoration, golvdekoration och intäktstakt.
- Byte till den nya profilen gav 0 disponibla yen, 0/7 upplåsningar och ingen köpt utrustning.
- Bakåt från spelvyn återöppnade profilvalet med fungerande knappar.
- Illustration och gränssnitt granskades visuellt vid normal skrivbordsbredd och 390 px.
  Ingen horisontell överströmning vid 390 px (dokumentbredd 375 px).
- `npm run build`: godkänt, inklusive TypeScript-kontroll.
- `npm test`: samtliga 268 tester godkända.
- Sökning i `dist` hittade inte testprofilernas hjälpkod eller startsidans text.

Skärmbild från den uppgraderade restaurangen:
`output/playwright/sushi-playtest-upgraded.png` (lokal, ignorerad av Git).
Testprofilerna återställdes efter genomgången så att användaren kan göra köpen själv.

Node 24 användes lokalt; Firebase rapporterar att produktionsfunktionen begär Node 22.
Detta verifierar lokal spelbarhet, inte produktionsruntime, slutlig ekonomi eller
samtliga releasekriterier i ticket 12. Ingen publicering utfördes.

## Återställning

Ctrl+C stoppar förhandsvisningen och dess emulatorprocesser. Nästa start skapar nya
testprofiler. Vid behov kan endast dessa två profiler återställas i de redan körande
emulatorerna med `node scripts/seed-sushi-preview.ts --reset`; gå sedan via profilvalet
igen så att webbläsaren hämtar den återställda kursprogressionen.
