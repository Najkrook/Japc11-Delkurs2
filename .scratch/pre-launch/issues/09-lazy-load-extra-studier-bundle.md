# 09 — Lazy-load av Extra studier (Tae Kim-data) för snabbt startpaket

**What to build:** Applikationens startvy och ordinarie kursveckor laddas snabbt utan att hämta den stora datamängden för Extra studier; Tae Kim-materialet laddas först när studenten navigerar till fliken Extra studier.

**Blocked by:** 01 — Grön baslinje för CI, formatering och E2E-filtertest

**Status:** ready-for-agent

- [ ] Startpaketet vid första sidladdning innehåller inte den stora Tae Kim-datamängden, och produktionsbygget (`npm run build`) passerar utan varningar för för stora paket (> 500 kB)
- [ ] När studenten öppnar fliken "Extra studier" laddas modulen och dess data asynkront med en tydlig laddningsindikator och fungerar därefter precis som tidigare
- [ ] Befintliga enhets- och E2E-tester fortsätter att passera
