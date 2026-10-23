# 06 — Köp den första förbättringen efter kapitel 6-brons

**What to build:** Studenten kan köpa sin första upplåsta restaurangförbättring för hämtade yen och direkt se förändringen i scenen och produktionen. Butiken förklarar både kraven och förbättringens faktiska effekt.

**Blocked by:** 04 — Tjäna och hämta intäkter med åttatimmarstak; 05 — Lås upp belöningar permanent från kursmedaljer

**Status:** done

- [x] Kapitel 6-brons öppnar den första förbättringen enligt den provisoriska katalogen. Grundrestaurangen fortsätter fungera även innan upplåsningen.
- [x] Butiken visar låst, upplåst men för dyr, köpbar och ägd post med pris, medaljkrav och tydlig återkoppling vid köp.
- [x] Köpets förhandsvisning visar förändring i verklig intäkt och köks-/serviceflaskhals, inklusive fallet där högre kapacitet i ena ledet inte ger någon omedelbar intäktsökning.
- [x] Backend kontrollerar ägare, permanent upplåsning, serverns katalogpris, köpbar nivå och disponibla yen. Ohämtade intäkter kan inte finansiera köpet; klientens priser, saldo och effekter styr inte valideringen.
- [x] Debitering, ägande och tillhörande bokföring uppdateras atomärt en gång. Återförsök och samtidiga köp kan varken duplicera föremålet eller ge negativt saldo; samtidiga hämtningar ger ett konsistent resultat.
- [x] Förbättringen ändrar produktionen och ett fast visuellt utrustningstillstånd och finns kvar efter omladdning. Bokföringen följer 01 utan retroaktiv omvärdering, automatisk hämtning eller återställd period.
- [x] Tester verifierar hela medalj–hämtning–köp-flödet samt otillräckligt saldo, manipulerade anrop, full kassa, förlorat svar och samtidiga operationer.
