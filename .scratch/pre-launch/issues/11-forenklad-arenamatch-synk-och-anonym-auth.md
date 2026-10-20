# 11 — Förenklad Arenamatch-synk med anonym inloggning för gäster

**What to build:** Kurskamrater kan spela arenamatcher mot varandra mellan olika datorer och mobiler direkt via en 4-siffrig rumskod utan att behöva logga in med Google-konto, och samtidiga svar från flera spelare sparas utan skrivkonflikter.

**Blocked by:** 05 — Tydlig gästhantering och inloggningsfeedback i Arenamatch & Kontovy

**Status:** done

- [x] En oinloggad student som skapar eller går med i en arenamatch kan autentiseras anonymt i bakgrunden så att rummet synkroniseras via molnet mellan olika enheter (med lokal fallback om molnet är otillgängligt)
- [x] Samtidiga svar från flera deltagare i samma runda registreras oberoende av varandra utan att skriva över varandras poäng eller avvisas p.g.a. millisekundavrundning
- [x] Säkerhetsregeltesterna i emulatorn (`npm run test:rules`) verifierar att deltagare endast kan uppdatera sitt eget deltagartillstånd och att samtidiga svar fungerar
