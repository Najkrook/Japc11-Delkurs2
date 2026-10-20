# 01 — Grön baslinje för CI, formatering och E2E-filtertest

**What to build:** En grön verifieringsbaslinje där kodformatering, enhetstester och E2E-tester för kategorifiltrering i studieövningar passerar utan fel, och där arbetskatalogen inte innehåller överblivna temporära logg-/mapprester eller dubblerad glosdokumentation i projektroten.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Kodformateringskontrollen (`format:check`) passerar utan fel och ignorerar genererade kataloger, låsfiler och externa datamängder
- [x] E2E-testet för tom ordkategori i studieövningar verifierar beteendet mot en kategori som faktiskt saknar ord i en kursvecka (och kraschar inte när alla veckor har uttryck)
- [x] Hela testsviten (typkontroll, enhetstester och E2E-tester) passerar grönt
- [x] Överblivna lokala debug-loggar/tomma temp-mappar är bortstädade och glosdokumentation ligger samlad under dokumentationskatalogen utan krav på manuell dubbelsynkning i projektroten
