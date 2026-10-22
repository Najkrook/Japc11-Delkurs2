# 08 — Köp ett längre produktionstidstak

**What to build:** Studenten kan låsa upp och köpa mer produktionstid mellan manuella hämtningar, med tydlig information om när det nya taket gäller och hur mycket tid som redan använts.

**Blocked by:** 06 — Köp den första förbättringen efter kapitel 6-brons

**Status:** ready-for-agent

- [ ] Minst en takuppgradering använder beslutad provisorisk kapiteltilldelning, pris och varaktighet från 01. Både permanent kapitelupplåsning och tillräckliga disponibla yen krävs.
- [ ] Butiken visar nuvarande och erbjudet tak samt när köpet börjar gälla. Kassans tidsvisning och fullt/stoppat läge motsvarar serverns beslut.
- [ ] En uppgradering under en aktiv eller redan full period följer exakt den godkända policyn i 01, inklusive hur tidigare förbrukad produktionstid och eventuell väntetid behandlas.
- [ ] Köpet hämtar inte intäkter och startar inte en ny period. En ny manuell hämtning använder rätt köpt tak enligt policyn.
- [ ] Ägande, debitering och bokföring sparas atomärt och består efter omladdning. Klientändringar, återförsök och samtidiga köp/hämtningar kan inte skapa extra tid eller duplicerad debitering.
- [ ] Logik-, emulator- och gränssnittstester verifierar kapitelkrav, otillräckliga hämtade yen, köp före/vid/efter det gamla taket och efterföljande hämtning.
